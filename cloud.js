// ===== الحسابات + مزامنة المكتبة والمذاكرة بين الأجهزة (Supabase — اختياري) =====
// من غير إعداد: الموقع شغال زي ما هو، وكل حاجة على الجهاز بس (ومفيش زرار دخول وهمي).
// مع الإعداد (config.js أو SUPABASE_URL/SUPABASE_ANON_KEY على السيرفر): دخول بإيميل وباسورد، والكتب (PDF) والكتابة عليها
// والملاحظات والتقدّم ونقط الضعف والخطط والامتحانات بتتزامن. الأمان في قاعدة البيانات نفسها (RLS — server/supabase.sql):
// كل مستخدم بيشوف ملفاته هو بس، ومحدش يقدر يوصل لكتب حد تاني حتى لو عرف اسم الملف.
(() => {
  const C = { sb: null, user: null, session: null, cfg: null, state: "off", last: +localStorage.getItem("cloud.last") || 0, err: "", busy: false };
  const KEYRE = /^(lib|notes|exams|settings|deleted|nb|idxmeta)$|^(ann_|prog:|weak:|plan:|vids:)/;
  // الإعدادات اللي بتتزامن (مش أي مفتاح API — مفاتيح المستخدم BYOK بتفضل على جهازه بس)
  const SET_KEYS = ["provider", "pmodel", "srclock", "embmode", "theme", "uiLang", "dialect", "dialectAr", "miclang", "autospeak", "lsize", "tts.settings"];
  const SDK = ["https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js", "https://unpkg.com/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"];
  let meta = {}; try { meta = JSON.parse(localStorage.getItem("cloud.meta") || "{}"); } catch {}
  let synced = {}; try { synced = JSON.parse(localStorage.getItem("cloud.synced") || "{}"); } catch {}
  let gone = new Set(); try { gone = new Set(JSON.parse(localStorage.getItem("cloud.gone") || "[]")); } catch {}   // المسح وإنت offline بيفضل محفوظ لحد ما يترفع (قبل كده كان بيضيع مع التحديث والحاجة ترجع)
  const saveMeta = () => { try { localStorage.setItem("cloud.meta", JSON.stringify(meta)); localStorage.setItem("cloud.synced", JSON.stringify(synced)); localStorage.setItem("cloud.gone", JSON.stringify([...gone].slice(-2000))); } catch {} };
  // دمج آمن للبيانات اللي ممكن تتعدّل على جهازين في نفس الوقت
  // a = المحلي، b = السحابة، ta/tb = وقت آخر تعديل لكل واحد. tomb = الكتب اللي اتمسحت (id → وقت المسح)
  function merge(k, a, b, ta = 0, tb = 0, tomb = {}) {
    const byId = (x, y, t = "updated") => { const m = new Map(); [...(y || []), ...(x || [])].forEach(e => { if (!e || e.id == null) return; const o = m.get(e.id); if (!o || (e[t] || 0) >= (o[t] || 0)) m.set(e.id, e); }); return [...m.values()]; };
    if (k === "deleted") { const o = { ...(b || {}) }; for (const [id, t] of Object.entries(a || {})) o[id] = Math.max(o[id] || 0, t); return o; }
    if (k === "lib") return byId(a, b, "added").filter(e => !(tomb[e.id] >= (e.added || 0)));   // كتاب اتمسح على جهاز تاني مايرجعش تاني بالدمج
    if (k === "notes" || k === "nb" || k.startsWith("vids:")) return byId(a, b);   // النوت بوك والفيديوهات المحفوظة: الممسوح بيفضل علامة (del) عشان مايرجعش
    if (k === "exams") return byId(a, b, "date").sort((x, y) => x.date - y.date).slice(-50);
    if (k.startsWith("ann_")) { const o = { ...(b || {}) }; for (const [p, items] of Object.entries(a || {})) { const seen = new Set((o[p] || []).map(x => JSON.stringify(x))); o[p] = [...(o[p] || []), ...items.filter(x => !seen.has(JSON.stringify(x)))]; } return o; }
    if (k.startsWith("prog:")) return { ...b, ...a, seen: [...new Set([...(a?.seen || []), ...(b?.seen || [])])].sort((x, y) => x - y), last: (a?.t || 0) >= (b?.t || 0) ? a?.last : b?.last, t: Math.max(a?.t || 0, b?.t || 0) };
    if (k === "idxmeta") { const o = { ...(b || {}) }; for (const [id, x] of Object.entries(a || {})) if (!o[id] || (x?.have || 0) > (o[id].have || 0)) o[id] = x; return o; }   // الفهرس اللي اتقرا منه صفحات أكتر يكسب
    if (k === "settings") return ta >= tb ? { ...(b || {}), ...(a || {}) } : { ...(a || {}), ...(b || {}) };
    return ta > tb ? a : b;   // الباقي (خطط / نقط ضعف): الأحدث فعلًا (قبل كده كانت السحابة بتكسب دايمًا حتى لو المحلي أحدث)
  }
  const T = s => window.I18N?.t(s) || s;

  // ----- كل تغيير محلي في بيانات المذاكرة بيتسجّل عشان يترفع -----
  const rawSet = window.idbSet, rawDel = window.idbDel, dirty = new Set(); let pushT = 0;
  window.idbSet = async (k, v) => { const r = await rawSet(k, v); if (r !== false && typeof k === "string" && k.startsWith("idx:")) scheduleIdx(k.slice(4)); if (r !== false && typeof k === "string" && KEYRE.test(k)) { meta[k] = Date.now(); gone.delete(k); saveMeta(); mark(k); } return r; };
  window.idbDel = async k => { const r = await rawDel(k); if (typeof k === "string" && KEYRE.test(k)) { delete meta[k]; dirty.delete(k); gone.add(k); saveMeta(); mark(k); } return r; };
  function mark(k) { if (!C.user) return; dirty.add(k); clearTimeout(pushT); pushT = setTimeout(push, 1500); }

  // ----- الكتب الممسوحة: علامة (tombstone) بتتزامن عشان الكتاب مايرجعش من جهاز تاني -----
  window.addEventListener("book-deleted", async e => { const d = (await idbGet("deleted")) || {}; d[e.detail.id] = Date.now(); await window.idbSet("deleted", d); });
  async function purgeDeleted() {   // كتاب اتمسح على جهاز تاني: نشيله من هنا كمان (الملف والفهرس والكتابة عليه)
    const tomb = (await idbGet("deleted")) || {}, kill = [];
    for (const id of Object.keys(tomb)) { const e = LIB.find(x => x.id === id); if (e && !(tomb[id] >= (e.added || 0))) continue;   // اتضاف تاني بعد المسح: يفضل
      if (e || (await idbGet(id)) != null) kill.push(e || { id }); }   // (الدمج ممكن يكون شاله من المكتبة بس ملفه لسه على الجهاز)
    if (!kill.length) return false;
    if (kill.some(e => LIB.includes(e))) { LIB = LIB.filter(e => !kill.includes(e)); await rawSet("lib", LIB); meta.lib = Date.now(); dirty.add("lib"); }
    for (const e of kill) { for (const k of [e.id, "idx:" + e.id, "emb:" + e.id, "thumb:" + e.id, "ann_" + e.id, "prog:" + e.id, "weak:" + e.id, "plan:" + e.id]) { await rawDel(k); delete meta[k]; dirty.delete(k); } delete docs[e.id]; delete BK[e.id];
      if (cur.id === e.id) { doc = null; cur.id = null; cur.mounted = null; cur.want = null; $("pages").innerHTML = ""; pgs = []; } }
    return true;
  }

  // ----- الإعدادات: أي تغيير في إعداد من SET_KEYS بيتحفظ في «settings» ويتزامن -----
  let applying = false, setT = 0;
  const snapshot = () => Object.fromEntries(SET_KEYS.map(k => [k, localStorage.getItem(k)]).filter(([, v]) => v != null));
  const onSetting = k => { if (applying || !SET_KEYS.includes(k)) return; clearTimeout(setT); setT = setTimeout(() => window.idbSet("settings", snapshot()), 400); };
  const SP = Storage.prototype, oSet = SP.setItem, oRem = SP.removeItem;
  SP.setItem = function (k, v) { const r = oSet.call(this, k, v); if (this === window.localStorage) onSetting(String(k)); return r; };
  SP.removeItem = function (k) { const r = oRem.call(this, k); if (this === window.localStorage) onSetting(String(k)); return r; };
  function applySettings(v) {
    if (!v || typeof v !== "object") return; const before = snapshot(); applying = true;
    try { for (const k of SET_KEYS) if (typeof v[k] === "string") localStorage.setItem(k, v[k]); } finally { applying = false; }
    if (JSON.stringify(before) === JSON.stringify(snapshot())) return;
    try { if (typeof setTheme === "function") setTheme(localStorage.getItem("theme")); window.syncSettings?.(); } catch {}
    toast(T("✅ اتجابت إعداداتك من الحساب (بعضها بيتطبق بالكامل بعد تحديث الصفحة)."));
  }

  async function push() {
    if (!C.user || C.busy) { if (C.user) pushT = setTimeout(push, 2000); return; }
    const ks = [...dirty], del = [...gone]; dirty.clear();
    try {
      const rows = []; for (const k of ks) { if (gone.has(k)) continue; const v = await idbGet(k); if (v != null) rows.push({ user_id: C.user.id, k, v, updated_at: new Date(meta[k] || Date.now()).toISOString() }); }
      if (rows.length) { const { error } = await C.sb.from("user_kv").upsert(rows); if (error) throw error; rows.forEach(r => { synced[r.k] = Date.parse(r.updated_at); }); saveMeta(); }
      if (del.length) { const { error } = await C.sb.from("user_kv").delete().eq("user_id", C.user.id).in("k", del); if (error) throw error; del.forEach(k => { gone.delete(k); delete synced[k]; }); saveMeta(); }
      done();
    } catch (e) { ks.forEach(k => dirty.add(k)); fail(e); pushT = setTimeout(push, 15000); }
  }
  const done = () => { C.last = Date.now(); localStorage.setItem("cloud.last", C.last); C.err = ""; C.state = "ok"; ui(); };
  const fail = e => { C.err = String(e?.message || e).slice(0, 160); C.state = "error"; ui(); };

  // ----- ملفات الكتب -----
  // الكتاب لحد 45 ميجا بيترفع ملف واحد. الأكبر بيتقسم أجزاء (حد Supabase المجاني 50 ميجا للملف) وبيتجمّع تاني وقت التنزيل.
  const PART = 45 * 1048576, path = id => `${C.user.id}/${id}.pdf`, tooBig = new Set();
  const partsOf = (have, id) => { for (const n of have) { const m = n.match(/^(.+)\.pdf\.n(\d+)$/); if (m && m[1] === id) return +m[2]; } return 0; };
  const onCloud = (have, id) => have.has(id + ".pdf") || partsOf(have, id) > 0;
  async function upBook(id) {
    const f = await idbGet(id); if (!f) return;
    const lim = window.SYNC_MAX_MB || 300;
    if (f.size > lim * 1048576) { if (!tooBig.has(id)) { tooBig.add(id); toast(T("ℹ️ كتاب أكبر من حد المزامنة") + ` (${lim} MB) — ` + T("هيفضل على الجهاز ده بس.")); } return; }   // مرة واحدة لكل كتاب (مش كل مزامنة)
    const st = C.sb.storage.from("books");
    if (f.size <= PART) { const { error } = await st.upload(path(id), f, { upsert: true, contentType: "application/pdf" }); if (error) throw error; return; }
    const n = Math.ceil(f.size / PART);
    for (let i = 0; i < n; i++) { ui(T("بيرفع «") + (NAMES[id] || id) + `» (${i + 1}/${n})…`); const { error } = await st.upload(`${path(id)}.p${i}`, f.slice(i * PART, (i + 1) * PART), { upsert: true, contentType: "application/octet-stream" }); if (error) throw error; }
    const { error } = await st.upload(`${path(id)}.n${n}`, new Blob([String(n)]), { upsert: true, contentType: "application/octet-stream" }); if (error) throw error;   // علامة إن كل الأجزاء اترفعت
  }
  async function downBook(id, have) {
    const st = C.sb.storage.from("books"), n = partsOf(have, id);
    if (!n) { const { data, error } = await st.download(path(id)); if (error) throw error; return data; }
    const parts = []; for (let i = 0; i < n; i++) { ui(T("بنزّل «") + (NAMES[id] || id) + `» (${i + 1}/${n})…`); const { data, error } = await st.download(`${path(id)}.p${i}`); if (error) throw error; parts.push(data); }
    return new Blob(parts, { type: "application/pdf" });
  }

  // ----- فهرس الكتاب (النص اللي اتقرا من كل صفحة، وفيه شغل الـ OCR البطيء) بيتزامن كمان، عشان الجهاز التاني مايذاكرش الكتاب من الأول -----
  const IDXP = id => `${C.user.id}/${id}.idx`, haveOf = v => (v?.s || []).filter(Boolean).length, idxT = {};
  const gz = async o => new Response(new Blob([JSON.stringify(o)]).stream().pipeThrough(new CompressionStream("gzip"))).blob();
  const ungz = async b => JSON.parse(await new Response(b.stream().pipeThrough(new DecompressionStream("gzip"))).text());
  function scheduleIdx(id) { if (!C.user || typeof CompressionStream === "undefined") return; clearTimeout(idxT[id]); idxT[id] = setTimeout(() => upIdx(id).catch(fail), 15000); }
  C.upIdx = id => upIdx(id);
  async function upIdx(id) {
    const v = await idbGet("idx:" + id), h = haveOf(v); if (!h || !LIB.some(e => e.id === id)) return;
    const m = (await idbGet("idxmeta")) || {}; if (m[id]?.up && (m[id].have || 0) >= h) return;
    const { error } = await C.sb.storage.from("books").upload(IDXP(id), await gz(v), { upsert: true, contentType: "application/octet-stream" }); if (error) throw error;
    m[id] = { have: h, n: v.n, up: 1, t: Date.now() }; await window.idbSet("idxmeta", m);
  }
  window.addEventListener("books-imported", async e => { if (!C.user) return; try { for (const id of e.detail.ids) await upBook(id); done(); } catch (err) { fail(err); } });
  window.addEventListener("book-deleted", async e => { if (!C.user) return; try { const id = e.detail.id, { data: fs } = await C.sb.storage.from("books").list(C.user.id, { limit: 1000 }); const names = (fs || []).map(f => f.name).filter(n => n.startsWith(id + ".")); if (names.length) await C.sb.storage.from("books").remove(names.map(n => `${C.user.id}/${n}`)); } catch (err) { fail(err); } });

  // ----- مزامنة كاملة: الأحدث يكسب لكل بيانة، والمكتبة بتتدمج (مفيش كتاب بيضيع) -----
  C.sync = async () => {
    if (!C.user || C.busy) return; C.busy = true; C.state = "sync"; ui(); const changed = new Set();
    try {
      const { data: rows, error } = await C.sb.from("user_kv").select("k,updated_at").eq("user_id", C.user.id); if (error) throw error;
      const remote = new Map((rows || []).map(r => [r.k, Date.parse(r.updated_at)]));
      const order = [...remote].sort(([a], [b]) => (b === "deleted") - (a === "deleted"));   // علامات المسح الأول، عشان دمج المكتبة يعرفها
      for (const [k, rt] of order) {
        if (gone.has(k)) continue;   // اتمسحت هنا ولسه ماترفعش المسح: متنزّلهاش تاني
        if (rt <= (synced[k] || 0) + 500 && (await idbGet(k)) != null) continue;   // السحابة ماتغيّرتش من آخر مزامنة
        const { data, error: e2 } = await C.sb.from("user_kv").select("v").eq("user_id", C.user.id).eq("k", k).maybeSingle(); if (e2) throw e2; if (!data) continue;
        // تعارض = اتغيّرت هنا وهناك من آخر مزامنة → دمج (مفيش حاجة بتتمسح بصمت). غير كده: الأحدث بس
        const tomb = (await idbGet("deleted")) || {}, loc0 = await idbGet(k);
        // المكتبة: بندمج مع اللي في الذاكرة دلوقتي (مش نسخة قديمة) ومن غير await في النص — عشان كتاب اتضاف في نفس اللحظة مايضيعش
        const loc = k === "lib" ? LIB : loc0, both = loc != null && (meta[k] || 0) > (synced[k] || 0) && rt > (synced[k] || 0);
        const v = loc != null && (k === "lib" || k === "deleted" || both) ? merge(k, loc, data.v, meta[k] || 0, rt, tomb) : data.v;
        if (k === "lib") LIB = v;
        await rawSet(k, v); const same = JSON.stringify(v) === JSON.stringify(data.v);
        if (k === "settings") applySettings(v);
        meta[k] = same ? rt : Date.now(); synced[k] = rt; if (!same) dirty.add(k); if (both) C.conflicts = (C.conflicts || 0) + 1;
        changed.add(k);
      }
      if (!remote.has("settings") && !(await idbGet("settings"))) await window.idbSet("settings", snapshot());   // أول مرة: إعدادات الجهاز ده تبقى إعدادات الحساب
      if (C.upload !== false) for (const k of await idbKeys()) if (typeof k === "string" && KEYRE.test(k) && (!remote.has(k) || (meta[k] || 0) > (synced[k] || 0) + 500)) { if (!meta[k]) meta[k] = Date.now(); dirty.add(k); }
      if (await purgeDeleted()) changed.add("lib");
      saveMeta();
      // الكتب نفسها: اللي في الحساب ومش على الجهاز تتنزّل، واللي على الجهاز ومش في الحساب تترفع
      const lib = (await idbGet("lib")) || [], { data: files, error: e3 } = await C.sb.storage.from("books").list(C.user.id, { limit: 1000 }); if (e3) throw e3;
      const have = new Set((files || []).map(f => f.name));
      for (const e of lib) {
        const local = await idbGet(e.id);
        if (!local && onCloud(have, e.id)) { C.state = "sync"; ui(T("بنزّل «") + e.name + "»…"); await rawSet(e.id, await downBook(e.id, have)); changed.add("book:" + e.id); }
        else if (local && !onCloud(have, e.id) && C.upload !== false) await upBook(e.id);
      }
      // الفهرس: لو اللي في الحساب مقري منه صفحات أكتر من اللي هنا ننزّله، ولو العكس نرفع اللي هنا
      if (typeof DecompressionStream !== "undefined") { const im = (await idbGet("idxmeta")) || {};
        for (const e of lib) { const lv = await idbGet("idx:" + e.id), lh = haveOf(lv), r = im[e.id];
          if (r?.up && (r.have || 0) > lh && have.has(e.id + ".idx")) { try { const { data: b, error: e5 } = await C.sb.storage.from("books").download(IDXP(e.id)); if (e5) throw e5; const v = await ungz(b); if (Array.isArray(v?.t) && haveOf(v) > lh) { await rawSet("idx:" + e.id, v); delete BK[e.id]; changed.add("idx:" + e.id); } } catch (err) { console.warn("idx down", err); } }
          else if (lh && (!r?.up || lh > (r.have || 0)) && C.upload !== false) await upIdx(e.id).catch(err => console.warn("idx up", err)); } }
      C.busy = false; await push(); done();
      if (changed.size) apply(changed);
    } catch (e) { C.busy = false; fail(e); }
  };
  async function apply(changed) {   // البيانات الجديدة تظهر على طول من غير تحديث للصفحة
    if (changed.has("lib") || [...changed].some(k => k.startsWith("book:"))) { LIB = (await idbGet("lib")) || []; syncNames(); renderLib(); if (!doc && LIB.length) openBook(LIB[0].id, 1); }
    if ([...changed].some(k => k.startsWith("idx:"))) { try { await bkPreload(); if (cur.id && changed.has("idx:" + cur.id) && doc) { await bkLoadFor(cur.id, doc); bkInit?.(); } } catch {} }
    if (cur.id && changed.has("ann_" + cur.id)) window.inkLoad?.(cur.id);
    window.dispatchEvent(new CustomEvent("cloud-synced", { detail: { keys: [...changed] } }));
    if (!$("hub")?.hidden) window.STUDY?.open();
  }

  // ----- فهرس بحث بالمعنى في الحساب (pgvector) — VectorStore تاني جنب المحلي -----
  const cloudVec = {
    name: "Supabase pgvector (الحساب)",
    async index(ids) {
      const be = RAG.backend?.(); if (!be) throw Object.assign(new Error("مفيش محرك embeddings متاح"), { code: "no_embed" }); if (!C.user) throw new Error("سجّل دخول الأول");
      for (const id of [].concat(ids)) { const cs = RAG.chunks(id);
        for (let i = 0; i < cs.length; i += 32) { const part = cs.slice(i, i + 32), vecs = await AI.embed(part.map(c => (c.sec ? c.sec + "\n" : "") + c.text.slice(0, 1800)), "document");
          const rows = part.map((c, j) => ({ user_id: C.user.id, book_id: id, chunk_id: String(c.key), page: c.page, section: c.sec || "", body: c.text.slice(0, 4000), model: be.model(), embedding: Array.from(vecs[j] || []) })).filter(r => r.embedding.length);
          const { error } = await C.sb.from("chunks").upsert(rows); if (error) throw error; } }
    },
    async search(q, { ids = null, k = 6 } = {}) {
      const be = RAG.backend?.(); if (!be || !C.user) return []; const [qv] = await AI.embed([q], "query");
      const { data, error } = await C.sb.rpc("match_chunks", { query: Array.from(qv), books: ids, emb_model: be.model(), k }); if (error) throw error;
      return (data || []).filter(r => LIB.some(e => e.id === r.book_id)).map(r => ({ id: r.book_id, book: NAMES[r.book_id] || "", page: r.page, sec: r.section || "", text: r.body, score: r.score }));
    },
    async delete(id) { if (!C.user) return; const { error } = await C.sb.from("chunks").delete().eq("user_id", C.user.id).eq("book_id", id); if (error) throw error; },
    update(ids) { return cloudVec.index(ids); }
  };
  window.addEventListener("book-deleted", e => { if (C.user) cloudVec.delete(e.detail.id).catch(() => {}); });

  // ----- إدارة الحساب: نسيت كلمة السر / امسح بياناتي / امسح الحساب -----
  C.resetPassword = async email => { const { error } = await C.sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }); if (error) throw error; };
  C.deleteCloudData = async () => {   // بصلاحيات المستخدم نفسه (RLS): بياناته وكتبه وفهرسه بس
    if (!C.user) return; const uid = C.user.id;
    const { data: files } = await C.sb.storage.from("books").list(uid, { limit: 1000 });
    if (files?.length) { const { error } = await C.sb.storage.from("books").remove(files.map(f => `${uid}/${f.name}`)); if (error) throw error; }
    for (const t of ["user_kv", "chunks"]) { const { error } = await C.sb.from(t).delete().eq("user_id", uid); if (error && t === "user_kv") throw error; }
    // بعد المسح بنخرج من الحساب: غير كده أول مزامنة كانت بترفع كل اللي على الجهاز تاني وكأن المسح ماحصلش
    dirty.clear(); gone.clear(); clearTimeout(pushT); meta = {}; synced = {}; saveMeta(); localStorage.removeItem("cloud.uid");
    try { await C.sb.auth.signOut(); } catch {}
  };
  C.deleteAccount = async () => {   // لازم السيرفر يكون عنده SUPABASE_SERVICE_ROLE_KEY (مبيظهرش للموقع أبدًا)
    if (!C.user) return; const r = await PX.post("/v1/account/delete", {}, { ms: 30000 }); await C.sb.auth.signOut(); return r;
  };

  // ----- الدخول -----
  C.signUp = async (email, password) => { const { data, error } = await C.sb.auth.signUp({ email, password }); if (error) throw error; return data; };
  // دخول بجوجل (Supabase ← Authentication ← Providers ← Google): بيروح لصفحة جوجل ويرجع للموقع وهو داخل
  C.signInGoogle = async () => { const { error } = await C.sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: "select_account" } } }); if (error) throw error; };
  C.signIn = async (email, password) => { const { data, error } = await C.sb.auth.signInWithPassword({ email, password }); if (error) throw error; return data; };
  C.signOut = async () => { clearTimeout(pushT); try { if (C.user && dirty.size) await push(); } catch {} const { error } = await C.sb.auth.signOut(); if (error) throw error; };
  C.token = () => C.session?.access_token || "";
  function setSession(s) {
    const was = C.user?.id; C.session = s || null; C.user = s?.user || null; C.state = C.user ? "ok" : "out";
    try { if (C.user && window.AI && !AI.vectors.list().includes("supabase")) AI.vectors.register("supabase", cloudVec); } catch {}
    if (C.user && C.user.id !== was) {
      const prev = localStorage.getItem("cloud.uid");
      if (prev && prev !== C.user.id) {   // حساب تاني على نفس الجهاز: بيانات الحساب القديم ماتترفعش للجديد غير بموافقة صريحة
        meta = {}; synced = {}; gone.clear(); dirty.clear(); saveMeta();
        C.upload = !LIB.length || confirm(T("الجهاز ده عليه كتب وبيانات من حساب تاني. ترفعها كمان لحسابك ده؟ (لو «إلغاء»: هننزّل بيانات حسابك بس، واللي على الجهاز مش هيترفع)"));
        localStorage.setItem("cloud.upload", C.upload ? "1" : "0");
      } else if (!prev) { C.upload = true; localStorage.setItem("cloud.upload", "1"); }
      else C.upload = localStorage.getItem("cloud.upload") !== "0";
      localStorage.setItem("cloud.uid", C.user.id); C.sync(); }
    ui();
  }
  async function init() {
    const tc = window.TUTOR_CONFIG || {}; let cfg = tc.supabaseUrl && tc.supabaseAnonKey ? { url: tc.supabaseUrl, anonKey: tc.supabaseAnonKey } : null;
    if (!cfg && window.PX?.on()) { const h = await PX.health(); if (h?.auth?.url) cfg = h.auth; }
    C.cfg = cfg; if (!cfg) { C.state = "off"; ui(); return; }
    try { if (!window.supabase?.createClient) { let ok = false; for (const u of SDK) { try { await loadScript(u); ok = true; break; } catch {} } if (!ok) throw new Error(T("مقدرتش أحمّل مكتبة الحسابات (محتاج نت)")); }
      C.sb = supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: true, autoRefreshToken: true } });
      C.sb.auth.onAuthStateChange((ev, s) => { setSession(s); if (ev === "PASSWORD_RECOVERY") setTimeout(async () => { const p = prompt(T("اكتب كلمة السر الجديدة (٦ حروف أو أكتر):")); if (p && p.length >= 6) { const { error } = await C.sb.auth.updateUser({ password: p }); toast(error ? "⚠️ " + error.message : T("✅ اتغيّرت كلمة السر.")); } }, 50); });
      const { data } = await C.sb.auth.getSession(); setSession(data?.session);
    } catch (e) { fail(e); }
  }
  addEventListener("online", () => { if (C.user) C.sync(); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && C.user && Date.now() - C.last > 60000) C.sync(); });

  // ----- الواجهة: قسم «الحساب» في الإعدادات + زرار في الهيدر -----
  const sec = document.createElement("div"); sec.className = "sc"; sec.id = "acct"; $("settings").prepend(sec);
  const hb = document.createElement("button"); hb.id = "acctBtn"; hb.className = "icon"; hb.hidden = true; hb.setAttribute("aria-label", T("الحساب"));
  hb.innerHTML = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><i class="dot"></i>';
  document.querySelector("header .hbtns")?.prepend(hb);
  hb.onclick = () => { $("settings").hidden = false; window.syncSettings?.(); sec.scrollIntoView({ behavior: "smooth", block: "start" }); };
  function ui(msg = "") {
    hb.hidden = !C.cfg; hb.classList.toggle("in", !!C.user); hb.title = C.user ? T("الحساب: ") + (C.user.email || "") : T("سجّل دخول عشان كتبك تتزامن على كل أجهزتك");
    const H = `<h2>👤 ${T("الحساب والمزامنة")}</h2>`;
    sec.hidden = !C.cfg && !window.DEV;   // «الحسابات مش متفعّلة… لصاحب الموقع: خطوات التفعيل» كلام لصاحب الموقع مش للطلبة
    if (!C.cfg) { sec.innerHTML = H + `<small>${T("الحسابات مش متفعّلة على الموقع ده، فكل حاجة محفوظة على الجهاز ده بس (ومحدش غيرك يقدر يوصلها). لصاحب الموقع: خطوات التفعيل في README ← «الحسابات».")}</small>`; return; }
    if (!C.user) {
      sec.innerHTML = H + `<button type="button" id="acGoogle" class="gbtn"><svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.3 5.7c4.3-4 7-9.9 7-17z"/><path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.2C1 16.5 0 20.1 0 24s1 7.5 2.6 10.8l7.9-6.2z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.3-5.7c-2 1.4-4.7 2.3-8.6 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.2C6.6 42.6 14.6 48 24 48z"/></svg>${T("ادخل بحساب جوجل")}</button>
        <div class="orline"><span>${T("أو بالإيميل")}</span></div><form id="acForm" class="acform"><input id="acEmail" type="email" autocomplete="email" placeholder="${T("الإيميل")}" dir="ltr" required><input id="acPass" type="password" autocomplete="current-password" placeholder="${T("كلمة السر (٦ حروف أو أكتر)")}" dir="ltr" minlength="6" required>
        <div class="row"><button type="submit" data-m="in">${T("دخول")}</button><button type="button" id="acUp" class="ghost">${T("حساب جديد")}</button><button type="button" id="acForgot" class="ghost">${T("نسيت كلمة السر")}</button></div></form><div id="acMsg" class="vnow">${esc(msg || C.err)}</div>
        <small>${T("لما تدخل، كتبك والكتابة عليها وملاحظاتك وتقدّمك بيتزامنوا على كل أجهزتك. كل حساب بيشوف بياناته هو بس.")}</small>`;
      const run = async up => { const e = $("acEmail").value.trim(), p = $("acPass").value; if (!e || p.length < 6) { $("acMsg").textContent = T("اكتب إيميل وكلمة سر ٦ حروف أو أكتر."); return; }
        $("acMsg").textContent = T("لحظة…"); try { const d = up ? await C.signUp(e, p) : await C.signIn(e, p); if (up && !d?.session) $("acMsg").textContent = T("✅ اتعمل الحساب — افتح الإيميل وأكّد، وبعدين ادخل."); }
        catch (err) { $("acMsg").textContent = "⚠️ " + (/invalid login/i.test(err.message) ? T("الإيميل أو كلمة السر غلط.") : /already registered/i.test(err.message) ? T("الإيميل ده عنده حساب — دوس «دخول».") : err.message); } };
      $("acGoogle").onclick = async () => { $("acMsg").textContent = T("لحظة… بنفتح صفحة جوجل"); try { await C.signInGoogle(); }
        catch (err) { $("acMsg").textContent = "⚠️ " + (/provider is not enabled|unsupported provider/i.test(err.message) ? T("الدخول بجوجل لسه مش متفعّل على الموقع (لصاحب الموقع: Supabase ← Authentication ← Providers ← Google).") : err.message); } };
      $("acForm").onsubmit = e => { e.preventDefault(); run(false); }; $("acUp").onclick = () => run(true);
      // زرار جوجل بيظهر بس لو الدخول بجوجل متفعّل فعلًا في Supabase (من غير كده كان بيودّي لصفحة خطأ)
      if (C.google == null) { const gb = $("acGoogle"), ol = sec.querySelector(".orline"); gb.hidden = true; if (ol) ol.hidden = true;
        fetch(C.cfg.url.replace(/\/+$/, "") + "/auth/v1/settings", { headers: { apikey: C.cfg.anonKey } }).then(r => r.json()).then(j => { C.google = !!j?.external?.google; }).catch(() => { C.google = false; })
          .finally(() => { if (C.google && $("acGoogle")) { $("acGoogle").hidden = false; if (ol) ol.hidden = false; } }); }
      else if (!C.google) { $("acGoogle").hidden = true; const ol = sec.querySelector(".orline"); if (ol) ol.hidden = true; }
      $("acForgot").onclick = async () => { const e = $("acEmail").value.trim(); if (!e) { $("acMsg").textContent = T("اكتب إيميلك الأول."); return; } try { await C.resetPassword(e); $("acMsg").textContent = T("✅ بعتنالك لينك تغيير كلمة السر على الإيميل."); } catch (err) { $("acMsg").textContent = "⚠️ " + err.message; } };
      return;
    }
    sec.innerHTML = H + `<div class="vnow">✅ ${T("داخل باسم")} ${C.user.user_metadata?.avatar_url ? `<img class="acav" src="${esc(C.user.user_metadata.avatar_url)}" alt="" referrerpolicy="no-referrer">` : ""}<b>${esc(C.user.user_metadata?.full_name || C.user.user_metadata?.name || "")}</b> <b dir="ltr">${esc(C.user.email || "")}</b><br>${C.state === "sync" ? "🔄 " + T("بنزامن…") + " " + esc(msg) : C.state === "error" ? "⚠️ " + T("المزامنة وقفت: ") + esc(C.err) : C.last ? T("آخر مزامنة: ") + new Date(C.last).toLocaleString(window.I18N?.lang === "en" ? "en" : "ar-EG") : ""}</div>
      <div class="row"><button type="button" id="acSync">🔄 ${T("زامن دلوقتي")}</button><button type="button" id="acOut" class="ghost">${T("خروج")}</button></div>
      <details class="danger"><summary>${T("مسح البيانات")}</summary><div class="row"><button type="button" id="acWipe" class="ghost">${T("امسح بياناتي من السحابة")}</button>
        <button type="button" id="acDel" class="ghost">${T("امسح حسابي نهائيًا")}</button></div><small>${T("المسح من السحابة مش بيمسح الكتب اللي على الجهاز ده.")}</small></details>`;
    $("acWipe").onclick = async () => { if (!confirm(T("تمسح كل كتبك وملاحظاتك وكتابتك وتقدّمك من السحابة؟ (اللي على الجهاز ده هيفضل، وهتخرج من الحساب)"))) return; try { await C.deleteCloudData(); toast(T("✅ اتمسحت بياناتك من السحابة وخرجت من الحساب.")); } catch (e) { toast("⚠️ " + e.message); } ui(); };
    $("acDel").onclick = async () => { if (!confirm(T("تمسح حسابك نهائيًا؟ مش هينفع ترجّعه."))) return; try { await C.deleteAccount(); toast(T("✅ اتمسح الحساب.")); } catch (e) { toast("⚠️ " + (e.code === "no_admin" ? T("مسح الحساب محتاج إعداد على السيرفر (SUPABASE_SERVICE_ROLE_KEY). امسح بياناتك من الزرار اللي جنبه، أو كلّم صاحب الموقع.") : e.message)); } };
    $("acSync").onclick = () => C.sync(); $("acOut").onclick = async () => { try { await C.signOut(); toast(T("خرجت من الحساب. البيانات اللي على الجهاز ده فاضلة.")); } catch (e) { toast("⚠️ " + (e?.message || e)); } };
  }
  ui(); init();
  window.CLOUD = C;
})();

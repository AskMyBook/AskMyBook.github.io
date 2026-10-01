// ===== RAG: فهم الكتاب بالكامل من غير ما نبعته كله للـ AI =====
// فوق الفهرس الموجود (BK: نص كل صفحة من طبقة الـ PDF أو الـ OCR، محفوظ في متصفح المستخدم بس):
//  ١) فهرس الدروس/الفصول/الوحدات (من العناوين وحجم الخط) + تحديد مدى كل درس بالصفحات.
//  ٢) أرقام الصفحات المطبوعة في الكتاب (ص ٢٧ في الكتاب ممكن تبقى ص ٣١ في الملف).
//  ٣) تقسيم كل صفحة لمقاطع ذات معنى (فقرات) مربوطة بعنوان القسم ورقم الصفحة.
//  ٤) بحث هجين: كلمات (BM25 مع دعم أخطاء الـ OCR) + معنى (embeddings) لو متاح، ودمج النتيجتين (RRF).
//  ٥) ضغط السياق: لو المطلوب فصل كامل بناخد أهم الجمل من كل صفحة بدل الفصل كله.
// كل ده بيتخزن في IndexedDB في متصفح المستخدم نفسه، فمستحيل مستخدم يوصل لكتب مستخدم تاني.
(() => {
  const R = {};
  const hash = s => { let h = 5381, g = 52711; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h = ((h << 5) + h + c) | 0; g = ((g << 5) + g + c) | 0; } return (h >>> 0).toString(36) + (g >>> 0).toString(36) + s.length.toString(36); };
  const nrm = s => norm(String(s || "")).replace(/[۰-۹]/g, d => d.charCodeAt(0) - 1776);
  const numOf2 = w => { w = (w || "").replace(/[().:\-–,،]/g, ""); return UNUM[w] || (/^\d{1,3}$/.test(w) ? +w : 0); };
  const docIds = () => Object.keys(BK).filter(id => BK[id]?.n && LIB.some(e => e.id === id));

  // ---------- ١) العناوين والفهرس ----------
  const KIND = [["unit", 1, /^(?:ال)?(?:وحده|باب)$|^(?:unit|part|module)$/], ["chapter", 2, /^(?:ال)?فصل$|^chapter$/], ["lesson", 3, /^(?:ال)?درس$|^lesson$/]];
  function headOf(line) {
    const raw = String(line || "").trim(), n = nrm(raw).replace(/^[\s\-–•*#(\[]+/, "").trim();
    if (n.length < 3 || n.length > 90 || /[؟?]$/.test(n)) return null;
    const ws = n.split(/\s+/); if (ws.length > 13) return null;
    const kw = ws[0].replace(/[:\-–.(]+$/, ""), K = KIND.find(k => k[2].test(kw)); if (!K) return null;
    let i = 1; if (/^(رقم|no\.?|number|#)$/.test(ws[i] || "")) i++;
    let num = numOf2(ws[i]); if (num) i++;
    else { const m = (ws[0].match(/(\d{1,3})$/) || [])[1]; if (m) num = +m; }
    const title = raw.split(/\s+/).slice(i).join(" ").replace(/^[\s:\-–.()]+/, "").trim();
    if (!num && title.replace(/[^A-Za-z\u0621-\u064A]/g, "").length < 3) return null;
    return { k: K[0], lv: K[1], num, title, line: raw.slice(0, 90) };
  }
  R.headOf = headOf;
  function outline(id) {
    const b = BK[id]; if (!b?.n) return [];
    if (b._ol && b._olv === b.v) return b._ol;
    const out = [], last = {}, fontFreq = {};
    (b.h || []).forEach(hs => (hs || []).forEach(x => { const k = nrm(x.t); fontFreq[k] = (fontFreq[k] || 0) + 1; }));
    const running = k => fontFreq[k] > Math.max(3, b.n * 0.15);   // عنوان متكرر أعلى كل صفحة
    b.toc = 0;
    for (let i = 0; i < b.n; i++) {
      const t = b.t[i]; if (!t) continue;
      const lines = t.split(/\n/).map(s => s.trim()).filter(Boolean), hs = lines.slice(0, 14).map(headOf).filter(Boolean);
      const dots = lines.filter(l => /(\.{3,}|…{2,}|_{3,})\s*[\d٠-٩]{1,3}\s*$/.test(l)).length;
      if (new Set(hs.map(h => h.k + h.num + h.title.slice(0, 12))).size >= 3 || dots >= 5) { b.toc ||= i + 1; continue; }   // صفحة الفهرس
      for (const h of hs) {
        const key = h.k + "|" + h.num + "|" + nrm(h.title).slice(0, 24);
        if (last[h.k] === key) continue;
        last[h.k] = key; KIND.forEach(k => { if (k[1] > h.lv) delete last[k[0]]; });
        out.push({ id, page: i + 1, k: h.k, lv: h.lv, num: h.num, exp: !!h.num, title: h.title, line: h.line });
      }
      for (const x of (b.h?.[i] || [])) {
        const k = nrm(x.t); if (running(k) || headOf(x.t) || k.length < 3) continue;
        if (out.some(o => o.page === i + 1 && nrm(o.line).includes(k))) continue;
        out.push({ id, page: i + 1, k: "heading", lv: 4, num: 0, title: x.t.slice(0, 80), line: x.t.slice(0, 80) });
      }
    }
    const cnt = {};   // ترقيم الدروس اللي مالهاش رقم مكتوب
    for (const h of out) { if (h.lv < 4) { KIND.forEach(k => { if (k[1] > h.lv) cnt[k[0]] = 0; }); cnt[h.k] = (cnt[h.k] || 0) + 1; h.seq = cnt[h.k]; if (!h.num) h.num = h.seq; } }
    out.forEach((h, j) => { const nx = out.slice(j + 1).find(o => o.lv <= h.lv); h.to = Math.max(h.page, nx ? (nx.page > h.page ? nx.page - 1 : h.page) : Math.min(b.n, h.lv === 4 ? h.page + 3 : b.n)); });
    b._ol = out; b._olv = b.v; return out;
  }
  R.outline = outline;
  R.sectionAt = (id, page, maxLv = 3) => {
    const ol = outline(id);
    for (let lv = Math.min(3, maxLv); lv >= 1; lv--) { const h = [...ol].reverse().find(o => o.lv === lv && o.page <= page && o.to >= page); if (h) return h; }
    return [...ol].reverse().find(o => o.lv <= maxLv && o.page <= page) || null;
  };
  // «أول درس» / «الدرس التاني» / «الفصل ٣» / «آخر وحدة» — ولو فيه وحدة محددة بندوّر جواها
  R.find = (id, { k, num = 0, ord = "", within = null }) => {
    const ol = outline(id); let order = [k]; if (k === "lesson") order = ["lesson", "chapter", "unit"]; else if (k === "chapter") order = ["chapter", "lesson", "unit"]; else if (k === "unit") order = ["unit", "chapter"];
    for (const kk of order) {
      const list = ol.filter(h => h.k === kk && (!within || (h.page >= within.page && h.page <= within.to)));
      if (!list.length) continue;
      if (ord === "last") return list.at(-1);
      if (num) return list.find(h => h.num === num) || list[num - 1] || null;
      return list[0];
    }
    return null;
  };
  // مطابقة دقيقة: «الدرس 3» = عنوان درس رقمه 3 مكتوب فعلًا في الكتاب (مش أي رقم 3 في النص، ومش فصل 3 بداله).
  // بيرجّع كل الاحتمالات: لو أكتر من واحد (زي «Lesson 3» في كل وحدة) الطالب بيختار بدل ما نخمّن.
  R.findExact = (id, { k, num = 0, ord = "", within = null, pos = false }) => {
    const list = outline(id).filter(h => h.k === k && (!within || (h.page >= within.page && h.page <= within.to)));
    if (!list.length) return [];
    if (ord === "last") return [list.at(-1)];
    if (!num) return [list[0]];
    if (pos) return list[num - 1] ? [list[num - 1]] : [];       // «تاني درس» = التاني بالترتيب (مش الدرس اللي رقمه 2)
    const exp = list.filter(h => h.exp && h.num === num); if (exp.length) return exp;
    if (list.some(h => h.exp)) return [];                       // الكتاب بيرقّم دروسه ومفيش رقم ده
    return list[num - 1] ? [list[num - 1]] : [];                // عناوين من غير أرقام: بالترتيب
  };
  R.kinds = id => { const c = {}; outline(id).forEach(h => { if (h.lv <= 3) c[h.k] = (c[h.k] || 0) + 1; }); return c; };
  R.findTitle = (id, q) => {   // «اشرح درس الخلية»: أقرب عنوان في الفهرس
    const qt = new Set(tok(q).filter(w => w.length > 2)); if (!qt.size) return null; let best = null, bs = 0;
    for (const h of outline(id)) { const ht = tok(h.title + " " + h.line); if (!ht.length) continue; const s = ht.filter(w => qt.has(w)).length / Math.max(2, ht.length) + (h.lv < 4 ? 0.05 : 0); if (s > bs) { bs = s; best = h; } }
    return bs >= 0.34 ? best : null;
  };
  R.outlineText = (id, max = 60) => outline(id).filter(h => h.lv <= 3 || outline(id).filter(o => o.lv <= 3).length < 4).slice(0, max)
    .map(h => `${"  ".repeat(Math.max(0, h.lv - 1))}- ${h.line} (${R.pg(id, h.page)}${h.to > h.page ? "–" + R.pgNum(id, h.to) : ""})`).join("\n");

  // ---------- ٢) أرقام الصفحات المطبوعة ----------
  R.offset = id => {
    const b = BK[id]; if (!b?.n) return null; if (b._pmv === b.v) return b._pm;
    const cnt = {}; let withT = 0;
    for (let i = 0; i < b.n; i++) {
      const t = b.t[i]; if (!t) continue; withT++;
      const L = t.split(/\n/).map(s => nrm(s).trim()).filter(Boolean), cand = [...L.slice(0, 2), ...L.slice(-2)], seen = new Set();
      for (const l of cand) {
        let m = l.match(/^[\s\-–—(\[|]*(\d{1,4})[\s\-–—)\]|]*$/); if (!m && l.length <= 40) m = l.match(/^(\d{1,4})\s/) || l.match(/\s(\d{1,4})$/);
        if (m) { const d = +m[1] - (i + 1); if (!seen.has(d)) { seen.add(d); cnt[d] = (cnt[d] || 0) + 1; } }
      }
    }
    let best = null, bc = 0; for (const d in cnt) if (cnt[d] > bc) { bc = cnt[d]; best = +d; }
    b._pm = bc >= Math.max(3, withT * 0.2) ? best : null; b._pmv = b.v; return b._pm;
  };
  R.pgNum = (id, p) => { const o = R.offset(id); return o ? p + o : p; };
  R.pg = (id, p) => { const o = R.offset(id); return o && p + o > 0 ? `ص ${p + o}` : `ص ${p}`; };
  R.toPdf = (id, printed) => { const o = R.offset(id), n = BK[id]?.n || 0, p = printed - (o || 0); return o && p >= 1 && p <= n ? p : null; };

  // ---------- ٣) المقاطع + فهرس الكلمات ----------
  function chunks(id) {
    const b = BK[id]; if (!b?.n) return [];
    if (b._ck && b._ckv === b.v) return b._ck;
    const ol = outline(id), out = []; let hi = 0;
    for (let p = 1; p <= b.n; p++) {
      const t = b.t[p - 1]; if (!t || t.replace(/\s/g, "").length < 20) continue;   // صفحة قصيرة (عنوان/شكل عليه كلام) لسه ليها مقطع — okText (٦٠ حرف) ده لاكتشاف صفحات الصور بس
      while (hi < ol.length && ol[hi].page <= p) hi++;
      const secH = [...ol.slice(0, hi)].reverse().find(h => h.lv <= 3) || ol[hi - 1], sec = secH ? secH.line : "";
      const paras = []; t.split(/\n+/).map(s => s.trim()).filter(Boolean).forEach(x => {
        if (x.length <= 900) return paras.push(x);
        let buf = ""; (x.match(/[^.!?؟…]+[.!?؟…]*\s*/g) || [x]).forEach(s => { if (buf.length + s.length > 700 && buf) { paras.push(buf.trim()); buf = ""; } buf += s; }); if (buf.trim()) paras.push(buf.trim());
      });
      let buf = "", k = 0; const start = out.length;
      const flush = () => { const x = buf.trim(); buf = ""; if (!x) return; out.push({ id, page: p, k: k++, sec, text: x, key: hash(x) }); };
      for (const para of paras) { if (buf && buf.length + para.length > 700) flush(); buf += (buf ? "\n" : "") + para; }
      flush();
      const lastC = out[out.length - 1];   // مقطع صغير قوي في آخر الصفحة: ندمجه في اللي قبله
      if (out.length - start >= 2 && lastC.text.length < 140) { const prev = out[out.length - 2]; prev.text += "\n" + lastC.text; prev.key = hash(prev.text); out.pop(); }
    }
    const df = {}, pdf = {}; let tot = 0;
    for (const c of out) {
      const w = []; tok(c.sec + " " + c.text).forEach(x => { w.push(x); if (x.length >= 5 && x[0] === "و") w.push(x.slice(1)); });
      const tf = {}, pf = {}; w.forEach(x => { tf[x] = (tf[x] || 0) + 1; if (x.length >= 5) { const q = x.slice(0, 4); pf[q] = (pf[q] || 0) + 1; } });
      c.tf = tf; c.pf = pf; c.len = w.length; tot += w.length;
      Object.keys(tf).forEach(x => df[x] = (df[x] || 0) + 1); Object.keys(pf).forEach(x => pdf[x] = (pdf[x] || 0) + 1);
    }
    b._ck = out; b._ckv = b.v; b._cix = { df, pdf, N: out.length, avg: tot / (out.length || 1) };
    return out;
  }
  R.chunks = chunks;
  const QSTOP = new Set(tok("لخص لخصلي ملخص تلخيص اشرح اشرحلي اشرحها اشرحه شرح اعمل اعمللي اعملي سوي سويلي امتحان اختبار اختبرني امتحني اسئله سؤال سوال اسالني حل حلي جاوب الفصل فصل الدرس درس الوحده وحده الباب باب الصفحه صفحه ده دي دا دول هذا هذه الكتاب كتاب الملف ملف مذاكره للمذاكره المذاكره اراجع مراجعه بيها عليها عليه فيها فيه بطريقه طريقه بسيطه ببساطه تاني ثاني كمان اهم الحاجات حاجات لازم احفظ نقط النقط نقاط وش ايش ابغي ابي ودي عطني ليش شلون كيف وين متي summarize summary explain quiz test chapter lesson unit page questions question please make give me the this about what"));
  const content = q => [...new Set(tok(q))].filter(w => !STOPW.has(w) && !BKSTOP.has(w) && !QSTOP.has(w));
  R.contentWords = content;
  function bm25(id, qt) {
    const cs = chunks(id), ix = BK[id]?._cix; if (!ix?.N || !qt.length) return [];
    const idf = d => Math.log(1 + (ix.N - d + .5) / (d + .5)), out = [];
    for (const c of cs) {
      let s = 0; const nl = .25 + .75 * c.len / ix.avg;
      for (const w of qt) {
        const f = c.tf[w];
        if (f) s += idf(ix.df[w]) * f * 2.2 / (f + 1.2 * nl);
        else if (w.length >= 5) { const g = c.pf[w.slice(0, 4)]; if (g) s += .45 * idf(ix.pdf[w.slice(0, 4)]) * g * 2.2 / (g + 1.2 * nl); }
      }
      if (s > 0) out.push({ c, s });
    }
    return out;
  }

  // ---------- ٤) فهم المعنى (embeddings) ----------
  // المصدر: سيرفر الموقع (لو متاح) ← مفتاح Gemini بتاع المستخدم ← موديل محلي في المتصفح (اختياري، ~١٢٠ ميجا مرة واحدة).
  const embMode = () => localStorage.getItem("embmode") || "auto";
  const LOCAL_W = `let P=null;const load=()=>P||=(async()=>{const{pipeline,env}=await import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3/+esm");try{env.backends.onnx.wasm.numThreads=1}catch(e){}
  try{return await pipeline("feature-extraction","Xenova/multilingual-e5-small",{dtype:"q8"})}catch(e){return await pipeline("feature-extraction","Xenova/multilingual-e5-small")}})().catch(e=>{P=null;throw e});
  onmessage=async e=>{const{id,texts}=e.data;try{const ex=await load(),o=await ex(texts,{pooling:"mean",normalize:true});postMessage({id,dims:o.dims,data:o.data},[o.data.buffer])}catch(err){postMessage({id,err:String(err&&err.message||err)})}};`;
  let LW = null, LWID = 0; const LWP = new Map();
  const lw = () => { if (LW) return LW; LW = new Worker(URL.createObjectURL(new Blob([LOCAL_W], { type: "text/javascript" }))); LW.onmessage = e => { const r = LWP.get(e.data.id); if (!r) return; LWP.delete(e.data.id); e.data.err ? r.rej(new Error(e.data.err)) : r.res(e.data); }; LW.onerror = e => { LWP.forEach(r => r.rej(new Error(e.message || "worker"))); LWP.clear(); LW = null; }; return LW; };
  const unit = v => { let s = 0; for (let i = 0; i < v.length; i++) s += v[i] * v[i]; s = Math.sqrt(s) || 1; const o = new Float32Array(v.length); for (let i = 0; i < v.length; i++) o[i] = v[i] / s; return o; };
  const BACK = {
    server: { ok: () => PX.on() && !!PX.cached()?.embed, model: () => "srv:" + (PX.cached()?.embedModel || "x"), batch: 64,
      run: async (texts, kind) => (await PX.post("/v1/embed", { texts, task: kind })).vectors },
    gemini: { ok: () => !!localStorage.getItem("gkey"), model: () => "gem768", batch: 50,
      run: async (texts, kind) => {
        const key = localStorage.getItem("gkey"), m = localStorage.getItem("gembm") || "gemini-embedding-001";
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:batchEmbedContents`, { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({ requests: texts.map(t => ({ model: "models/" + m, content: { parts: [{ text: t }] }, taskType: kind === "query" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT", outputDimensionality: 768 })) }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) { if (r.status === 404 && m !== "text-embedding-004") { localStorage.setItem("gembm", "text-embedding-004"); } const e = new Error(j.error?.message || "HTTP " + r.status); e.status = r.status; throw e; }
        return (j.embeddings || []).map(x => x.values);
      } },
    local: { ok: () => true, model: () => "e5s", batch: 16,
      run: (texts, kind) => new Promise((res, rej) => { const id = ++LWID; LWP.set(id, { res: d => { const dim = d.dims.at(-1), out = []; for (let i = 0; i < texts.length; i++) out.push(d.data.slice(i * dim, (i + 1) * dim)); res(out); }, rej });
        lw().postMessage({ id, texts: texts.map(t => (kind === "query" ? "query: " : "passage: ") + t) }); }) }
  };
  R.backend = () => { const m = embMode(); if (m === "off") return null; if (m === "local") return BACK.local; if (BACK.server.ok()) return BACK.server; if (BACK.gemini.ok()) return BACK.gemini; return null; };
  R.backendName = () => { const b = R.backend(); return b === BACK.server ? "server" : b === BACK.gemini ? "gemini" : b === BACK.local ? "local" : ""; };
  const V = {};   // V[id] = { m, map: Map(key -> Float32Array) }
  async function vload(id, m) {
    if (V[id]?.m === m) return V[id];
    const sv = await idbGet("emb:" + id), map = new Map();
    if (sv && sv.m === m && sv.buf) { const all = new Float32Array(sv.buf); sv.keys.forEach((k, i) => map.set(k, all.subarray(i * sv.dim, (i + 1) * sv.dim))); }
    return V[id] = { m, map, dim: sv?.dim || 0 };
  }
  async function vsave(id) {
    const v = V[id]; if (!v?.map.size) return; const keys = [...v.map.keys()], dim = v.map.get(keys[0]).length, all = new Float32Array(keys.length * dim);
    keys.forEach((k, i) => all.set(v.map.get(k), i * dim)); v.dim = dim; await idbSet("emb:" + id, { m: v.m, keys, dim, buf: all.buffer });
  }
  R.prog = null; R.err = "";
  const emit = () => window.dispatchEvent(new Event("rag-progress"));
  let jobRun = false; const jobQ = [];
  R.schedule = ids => { ids.forEach(id => { if (!jobQ.includes(id)) jobQ.push(id); }); if (!jobRun) runJobs(); };
  async function runJobs() {
    jobRun = true;
    try {
      while (jobQ.length) {
        const id = jobQ.shift(), be = R.backend(); if (!be || !BK[id]?.n) continue;
        const m = be.model(), v = await vload(id, m), cs = chunks(id), todo = cs.filter(c => !v.map.has(c.key));
        const live = new Set(cs.map(c => c.key)); for (const k of [...v.map.keys()]) if (!live.has(k)) v.map.delete(k);   // مقاطع قديمة اتغيرت
        if (!todo.length) continue;
        R.prog = { id, done: cs.length - todo.length, total: cs.length }; emit(); let unsaved = 0, fails = 0;
        for (let i = 0; i < todo.length;) {
          if (R.backend() !== be) break;
          const part = todo.slice(i, i + be.batch);
          try { const vecs = await be.run(part.map(c => (c.sec ? c.sec + "\n" : "") + c.text.slice(0, 1800)), "document"); part.forEach((c, j) => vecs[j] && v.map.set(c.key, unit(vecs[j]))); i += part.length; unsaved += part.length; fails = 0; R.err = ""; }
          catch (e) { fails++; R.err = e.message; emit(); if (fails > 3 || (e.status && e.status !== 429 && e.status < 500)) break; await tick(e.status === 429 ? 30000 : 5000); continue; }
          R.prog = { id, done: cs.length - todo.length + i, total: cs.length }; emit();
          if (unsaved >= 200) { await vsave(id); unsaved = 0; }
          await tick(be === BACK.local ? 30 : 250);
        }
        await vsave(id);
      }
    } finally { jobRun = false; R.prog = null; emit(); }
  }
  R.coverage = id => { const be = R.backend(), v = V[id]; if (!be || !v || v.m !== be.model()) return 0; const cs = chunks(id); return cs.length ? cs.filter(c => v.map.has(c.key)).length / cs.length : 0; };
  const qcache = new Map();
  async function embedQuery(q) {
    const be = R.backend(); if (!be) return null; const ck = be.model() + "|" + q; if (qcache.has(ck)) return qcache.get(ck);
    const v = unit((await be.run([q.slice(0, 1000)], "query"))[0]); qcache.set(ck, v); if (qcache.size > 60) qcache.delete(qcache.keys().next().value); return v;
  }
  const timeout = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);

  // ---------- ٥) البحث الهجين ----------
  // بيرجّع مقاطع مرتبة: [{ id, book, page, sec, text, score }] — بس من كتب المستخدم الحالي (المحفوظة في متصفحه).
  R.retrieve = async (q, { ids = null, k = 6, range = null, extraQ = "", maxLen = 1300 } = {}) => {
    ids = (ids || docIds()).filter(id => BK[id]?.n); if (!ids.length) return [];
    const qt = content(q + " " + extraQ), qtAll = tok(q), lex = [];
    for (const id of ids) {
      const nm = tok(NAMES[id] || "").filter(w => w.length >= 3), named = nm.some(w => qtAll.includes(w)), boost = (id === cur.id && doc ? 1.2 : 1) * (named ? 1.6 : 1);
      const qq = qt.filter(w => !(named && nm.includes(w))); if (!qq.length) continue;
      for (const x of bm25(id, qq)) lex.push({ c: x.c, s: x.s * boost });
    }
    const inR = c => !range || (c.id === range.id && c.page >= range.from && c.page <= range.to);
    let L = lex.filter(x => inR(x.c)); if (range && !L.length) L = lex;
    L.sort((a, b) => b.s - a.s); L = L.slice(0, 30);
    let D = [];
    const be = R.backend();
    if (be && q.trim()) {
      const withV = []; for (const id of ids) { const v = await vload(id, be.model()); if (v.map.size) withV.push(id); }
      if (withV.length) {
        const qv = await timeout(embedQuery(q + (extraQ ? " " + extraQ : "")).catch(() => null), 3500);
        if (qv) {
          for (const id of withV) { const v = V[id]; for (const c of chunks(id)) { const e = v.map.get(c.key); if (!e || !inR(c)) continue; let s = 0; for (let i = 0; i < e.length; i++) s += e[i] * qv[i]; D.push({ c, s: s * (id === cur.id && doc ? 1.02 : 1) }); } }
          D.sort((a, b) => b.s - a.s); const top = D[0]?.s || 0; D = D.slice(0, 30).filter(x => x.s >= top - 0.12 && x.s >= 0.2);   // حد أدنى للتشابه: مقطع مالوش علاقة ميتبعتش
        }
      }
    }
    if (!D.length && (!L.length || L[0].s < 0.8)) return [];
    if (L.length) L = L.filter(x => x.s >= L[0].s * 0.3);
    const sc = new Map(), add = (arr, w) => arr.forEach((x, r) => sc.set(x.c, (sc.get(x.c) || 0) + w / (60 + r)));
    add(L, 1); add(D, 1.1);
    const picked = [...sc.entries()].sort((a, b) => b[1] - a[1]).slice(0, k + 3).map(x => x[0]);
    for (const c of picked.slice(0, 2)) {   // الأقسام المرتبطة: المقطع اللي بعد أقوى نتيجة في نفس الدرس غالبًا بيكمّل الفكرة
      const cs = chunks(c.id), nb = cs[cs.indexOf(c) + 1]; if (nb && nb.sec === c.sec && !picked.includes(nb)) { picked.push(nb); sc.set(nb, (sc.get(c) || 0) * 0.5); }
    }
    const groups = new Map();   // ندمج المقاطع اللي من نفس الصفحة في بلوك واحد
    for (const c of picked) { const g = c.id + "|" + c.page; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(c); }
    const out = [];
    for (const [, cs] of groups) {
      cs.sort((a, b) => a.k - b.k); const text = cs.map(c => c.text).join("\n…\n");
      out.push({ id: cs[0].id, book: NAMES[cs[0].id] || "", page: cs[0].page, sec: cs[0].sec, text: text.length > maxLen ? bkWindow(text, q + " " + extraQ, maxLen) : text, score: sc.get(cs[0]) });
      if (out.length >= k) break;
    }
    return out;
  };

  // ---------- ٦) ضغط نص مجموعة صفحات (فصل/درس) على قد الميزانية ----------
  const DEF = /(يعرف|تعريف|يقصد|المقصود|مفهوم|عباره عن|يسمي|تسمي|اهميه|خصائص|انواع|اسباب|نتائج|مميزات|عيوب|قاعده|قانون|ملحوظه|ملاحظه|تذكر|هام|مهم|defin|is called|refers to|means|important|note|rule|formula|key)/;
  R.compress = (pages, budget, q = "") => {
    const total = pages.reduce((a, p) => a + p.text.length, 0);
    if (total <= budget) return pages.map(p => ({ page: p.page, text: p.text }));
    const qt = new Set(content(q)), per = pages.map(p => Math.max(160, Math.floor(budget * p.text.length / total)));
    return pages.map((p, pi) => {
      const units = p.text.split(/\n+/).flatMap(l => l.length > 260 ? (l.match(/[^.!?؟…]+[.!?؟…]*\s*/g) || [l]) : [l]).map(s => s.trim()).filter(Boolean);
      const scored = units.map((u, i) => { const n = nrm(u); let s = 1; if (u.length < 70 && !/[.،,؛]$/.test(u) && u.length > 3) s += 2; if (headOf(u)) s += 3; if (DEF.test(n)) s += 2; if (/\d/.test(n)) s += 0.5; if (/^[\-•*]|^\(?\d{1,2}[).\-]/.test(u)) s += 1; if (u.length < 15) s -= 1; tok(u).forEach(w => { if (qt.has(w)) s += 1.5; }); return { i, u, s: s - i * 0.002 }; });
      const keep = new Set(); let used = 0;
      for (const x of [...scored].sort((a, b) => b.s - a.s)) { if (used + x.u.length > per[pi] && keep.size) continue; keep.add(x.i); used += x.u.length + 1; if (used >= per[pi]) break; }
      let out = "", prev = -1; for (const x of scored) if (keep.has(x.i)) { out += (prev >= 0 && x.i !== prev + 1 ? "\n…\n" : prev >= 0 ? "\n" : "") + x.u; prev = x.i; }
      return { page: p.page, text: out };
    });
  };

  // جدولة فهم المعنى تلقائيًا للكتب المفهرسة (خفيف: بيشتغل واحد ورا التاني في الخلفية)
  R.kick = () => { if (R.backend()) R.schedule(docIds()); };
  window.addEventListener("proxy-health", () => setTimeout(R.kick, 1500));
  window.RAG = R;
})();

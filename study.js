// ===== مركز المذاكرة: المكتبة، الملاحظات، الامتحانات، نقط الضعف، خطة المذاكرة، البحث، الصور، وتصحيح خط الإيد =====
// كل البيانات حقيقية ومتخزّنة في المتصفح (IndexedDB) — ولو الحساب متوصّل بتتزامن (cloud.js). مفيش أرقام أو إجابات وهمية:
// التقدّم محسوب من الصفحات اللي اتفتحت فعلًا، ونقط الضعف من إجابات الطالب الحقيقية في الأسئلة والامتحانات.
(() => {
  const S = {}, I = b => `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${b}</svg>`;
  const nm = id => NAMES[id] || LIB.find(e => e.id === id)?.name || "";
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const dfmt = t => new Date(t).toLocaleDateString("ar-EG", { day: "numeric", month: "short", year: "numeric" });
  const bookSel = (sel = "") => LIB.map(e => `<option value="${esc(e.id)}"${e.id === sel ? " selected" : ""}>${esc(e.name)}</option>`).join("");
  const curBook = () => cur.id || $("book")?.value || LIB[0]?.id || "";
  const jsonOf = s => (window.TUTOR?.parseJSON ? TUTOR.parseJSON(s) : null);
  const emit = (k) => window.dispatchEvent(new CustomEvent("study-data", { detail: { key: k } }));   // cloud.js بيسمع ويزامن

  // ================= البيانات =================
  const DB = {
    async get(k, d) { const v = await idbGet(k); return v == null ? d : v; },
    async set(k, v) { await idbSet(k, v); emit(k); }
  };
  // ----- تقدّم القراءة لكل كتاب: الصفحات اللي اتفتحت فعلًا + آخر صفحة -----
  const PROG = {}; let progDirty = new Set();
  async function prog(id) { return PROG[id] ||= await DB.get("prog:" + id, { seen: [], last: 1, t: 0 }); }
  setInterval(async () => {
    if (!doc || !cur.id || document.hidden) return; const p = await prog(cur.id);
    if (!p.seen.includes(cur.page)) p.seen.push(cur.page); if (p.last !== cur.page || !p.seen.includes(cur.page)) progDirty.add(cur.id);
    p.last = cur.page; p.total = doc.numPages; p.t = Date.now(); progDirty.add(cur.id);
  }, 3000);
  setInterval(() => { for (const id of progDirty) DB.set("prog:" + id, PROG[id]); progDirty.clear(); }, 8000);
  addEventListener("pagehide", () => { for (const id of progDirty) idbSet("prog:" + id, PROG[id]); });

  // ----- نقط الضعف: من إجابات حقيقية بس -----
  async function weak(id) { return DB.get("weak:" + id, { topics: {} }); }
  async function record(id, list) {   // list: [{topic, page, ok}]
    if (!id || !list.length) return; const w = await weak(id);
    for (const r of list) { const k = (r.topic || "").trim() || ("صفحة " + r.page); const t = w.topics[k] ||= { name: k, page: r.page || 1, right: 0, wrong: 0, last: 0, hist: [] };
      r.ok ? t.right++ : t.wrong++; t.last = Date.now(); if (r.page) t.page = r.page;
      if (!t.chapter && r.page) { const ol = RAG.outline(id), sec = ol.filter(h => h.page <= r.page && (h.to || h.page) >= r.page); t.chapter = (sec.find(h => h.lv === 1) || sec[0])?.line || ""; }
      (t.hist ||= []).push({ t: Date.now(), ok: !!r.ok, diff: r.diff || "", src: r.src || "quiz", q: String(r.q || "").slice(0, 140) }); if (t.hist.length > 30) t.hist.splice(0, t.hist.length - 30); }
    await DB.set("weak:" + id, w);
  }
  window.addEventListener("study-result", e => { const d = e.detail; record(d.id, [{ topic: d.topic, page: d.page, ok: d.ok, q: d.q, src: "chat" }]); });
  // مفيش حكم من غير دليل كفاية: ٣ محاولات على الأقل، وغلطتين أو أكتر، ونسبة صح أقل من ٦٠٪
  const WEAK_MIN = 3, isWeak = t => t.right + t.wrong >= WEAK_MIN && t.wrong >= 2 && t.right / (t.right + t.wrong) < 0.6;

  // ================= الواجهة: لوحة المذاكرة =================
  const TABS = [["library", "📚 المكتبة"], ["notes", "📝 الملاحظات"], ["exam", "🧪 امتحان"], ["weak", "🎯 نقط الضعف"], ["plan", "🗓️ خطة المذاكرة"], ["search", "🔍 بحث"]];
  const hub = document.createElement("section"); hub.id = "hub"; hub.hidden = true; hub.setAttribute("aria-label", "مركز المذاكرة");
  hub.innerHTML = `<div class="hubhead"><nav class="hubtabs" role="tablist">${TABS.map(([k, l]) => `<button type="button" role="tab" data-h="${k}">${l}</button>`).join("")}</nav>
    <button type="button" class="icon" id="hubClose" title="قفل" aria-label="قفل">${I('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>')}</button></div><div id="hubBody"></div>`;
  document.body.append(hub);
  const hb = document.createElement("button"); hb.id = "hubBtn"; hb.className = "icon"; hb.title = "مركز المذاكرة: المكتبة، الامتحانات، الملاحظات، نقط الضعف، الخطة"; hb.setAttribute("aria-label", "مركز المذاكرة");
  hb.innerHTML = I('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>');
  document.querySelector("header .hbtns")?.prepend(hb);
  let TAB = "library";
  S.open = (t = TAB) => { TAB = t; hub.style.top = (document.querySelector("header")?.offsetHeight || 60) + "px"; hub.hidden = false; $("settings").hidden = true; hub.querySelectorAll("[data-h]").forEach(b => { b.classList.toggle("on", b.dataset.h === t); b.setAttribute("aria-selected", b.dataset.h === t); }); render(); };
  S.close = () => { hub.hidden = true; if (EX.timer && !EX.done) { /* الامتحان شغال: التايمر بيكمّل */ } };
  hb.onclick = () => hub.hidden ? S.open() : S.close();
  $("hubClose").onclick = S.close;
  hub.querySelector(".hubtabs").onclick = e => { const t = e.target.closest("[data-h]")?.dataset.h; if (t) S.open(t); };
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !hub.hidden && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) S.close(); });
  const body = () => $("hubBody");
  function render() { ({ library: rLibrary, notes: rNotes, exam: rExam, weak: rWeak, plan: rPlan, search: rSearch })[TAB]?.(); }
  const goPage = (id, p) => { S.close(); openBook(id, +p || 1); };
  hub.addEventListener("click", e => { const a = e.target.closest("[data-go]"); if (a) { e.preventDefault(); const [id, p] = a.dataset.go.split("|"); goPage(id, p); } });

  // ================= ١) المكتبة =================
  const THUMB = {};
  async function thumb(id) {
    if (THUMB[id]) return THUMB[id]; let t = await idbGet("thumb:" + id);
    if (!t) { try { const d = await loadDoc(id); if (!d) return ""; const pg = await d.getPage(1), v = pg.getViewport({ scale: 1 }), sc = 220 / v.width, vp = pg.getViewport({ scale: sc }), c = document.createElement("canvas");
      c.width = vp.width; c.height = vp.height; await pg.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise; t = c.toDataURL("image/jpeg", 0.72); idbSet("thumb:" + id, t); } catch { return ""; } }
    return THUMB[id] = t;
  }
  async function rLibrary() {
    if (!LIB.length) { body().innerHTML = `<div class="hempty"><p>مكتبتك فاضية.</p><button type="button" id="hAdd">➕ ضيف كتاب (PDF)</button></div>`; $("hAdd").onclick = () => $("files").click(); return; }
    const cards = await Promise.all(LIB.map(async e => { const p = await prog(e.id), tot = p.total || BK[e.id]?.n || 0, pc = tot ? Math.round(100 * p.seen.length / tot) : 0, w = await weak(e.id), wk = Object.values(w.topics).filter(isWeak).length;
      return `<article class="bcard" data-id="${esc(e.id)}"><div class="bth" data-th="${esc(e.id)}"></div><div class="bin"><h3 title="${esc(e.name)}">${esc(e.name)}</h3>
        <small>${e.added ? "اتضاف " + dfmt(e.added) : ""}${tot ? " · " + tot + " صفحة" : ""}</small>
        <div class="bar2" title="اتفتح ${p.seen.length} من ${tot || "?"} صفحة"><i style="width:${pc}%"></i></div>
        <small>${p.seen.length ? `قريت ${pc}% (${p.seen.length} صفحة) · آخر صفحة ${p.last}` : "لسه مفتحتوش"}${wk ? ` · <b class="wk">🎯 ${wk} نقطة ضعف</b>` : ""}</small>
        <small class="job" data-job="${esc(e.id)}">${esc(window.JOBS?.label(JOBS.get(e.id)) || "")}</small>${JOBS?.get(e.id)?.status === "failed" ? `<button type="button" class="ghost" data-b="retry">🔄 جرّب المعالجة تاني</button>` : ""}
        <div class="bact"><button type="button" data-b="open">▶ كمّل</button><button type="button" data-b="study" class="accent">🧑‍🏫 ذاكر مع الـ AI</button>
        <button type="button" data-b="rename" class="ghost" title="غيّر الاسم">✏️</button><button type="button" data-b="dl" class="ghost" title="نزّل الـ PDF">⬇️</button><button type="button" data-b="del" class="ghost" title="امسح">🗑️</button></div></div></article>`; }));
    body().innerHTML = `<div class="hrow"><h2>مكتبتي (${LIB.length})</h2><button type="button" id="hAdd">➕ ضيف كتاب</button></div><div class="bgrid">${cards.join("")}</div>`;
    $("hAdd").onclick = () => $("files").click();
    body().querySelectorAll("[data-th]").forEach(async el => { const t = await thumb(el.dataset.th); if (t) el.style.backgroundImage = `url(${t})`; else el.textContent = "📘"; });
    body().querySelector(".bgrid").onclick = async e => {
      const b = e.target.closest("[data-b]"); if (!b) return; const id = b.closest(".bcard").dataset.id, E = LIB.find(x => x.id === id);
      if (b.dataset.b === "open") { const p = await prog(id); goPage(id, p.last || 1); }
      else if (b.dataset.b === "study") S.studyWith(id);
      else if (b.dataset.b === "retry") { JOBS.retry(id); rLibrary(); }
      else if (b.dataset.b === "rename") { const v = prompt("اسم الكتاب الجديد:", E.name); if (v && v.trim()) { E.name = v.trim().slice(0, 120); syncNames(); await libSave(); renderLib(); emit("lib"); rLibrary(); } }
      else if (b.dataset.b === "dl") { const f = await idbGet(id); if (!f) return toast("الملف مش موجود على الجهاز ده."); const a = document.createElement("a"); a.href = URL.createObjectURL(f); a.download = E.name + ".pdf"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 30000); }
      else if (b.dataset.b === "del") { await delBook(id); rLibrary(); }
    };
  }
  window.addEventListener("books-imported", () => { if (!hub.hidden && TAB === "library") rLibrary(); });
  window.addEventListener("job-update", e => { const j = e.detail; if (!j?.book) return; const el = hub.querySelector(`[data-job="${CSS.escape(j.book)}"]`); if (el) { el.textContent = JOBS.label(j); el.className = "job " + j.status; }
    if (j.status === "failed" && !hub.hidden && TAB === "library" && !el?.nextElementSibling?.matches?.("[data-b=retry]")) rLibrary(); });
  window.addEventListener("book-deleted", async e => { const id = e.detail.id; delete PROG[id]; delete THUMB[id]; const ns = await DB.get("notes", []); await DB.set("notes", ns.filter(n => n.book !== id)); });
  // «ذاكر مع الـ AI»: المدرّس بيرحّب ويعرض فصول الكتاب كاختيارات
  S.studyWith = async id => {
    const p = await prog(id); S.close(); await openBook(id, p.last || 1); $("book").value = id; if (innerWidth <= 800) showTab("chat");
    const ol = RAG.outline(id).filter(h => h.lv <= 2).slice(0, 10), node = add("a", `أنا جاهز أذاكر معاك في «${nm(id)}». اختار فصل أو درس، أو ابدأ بسؤالك.`);
    const box = document.createElement("div"); box.className = "chips pick";
    const chip = (t, fn) => { const c = document.createElement("button"); c.type = "button"; c.className = "chip"; c.textContent = t; c.onclick = () => { if (!document.body.classList.contains("gen")) fn(); }; box.append(c); };
    ol.forEach(h => chip(h.line.slice(0, 60), () => TUTOR.handle("اشرحلي " + h.line)));
    if (!ol.length) chip("📖 اشرحلي الصفحة اللي أنا فيها", () => TUTOR.handle("اشرحلي الصفحة دي"));
    chip("❓ اختبرني", () => TUTOR.handle("اختبرني")); chip("🧪 امتحان كامل", () => S.open("exam"));
    node.insertBefore(box, node.querySelector(".acts"));
  };

  // ================= ٢) الملاحظات =================
  let NQ = "", NF = "all";
  async function rNotes() {
    const all = await DB.get("notes", []), id = curBook(), q = norm(NQ.trim());
    const list = all.filter(n => (NF === "all" || (NF === "book" && n.book === id) || (NF === "page" && n.book === id && n.page === cur.page)) && (!q || norm(n.text + " " + (n.lesson || "")).includes(q))).sort((a, b) => b.updated - a.updated);
    body().innerHTML = `<div class="hrow"><h2>ملاحظاتي (${all.length})</h2></div>
      <div class="nadd"><textarea id="nText" rows="3" placeholder="اكتب ملاحظة…"></textarea><div class="row"><label class="chk"><input type="checkbox" id="nLink" ${doc ? "checked" : "disabled"}> اربطها بالصفحة ${doc ? cur.page + " في «" + esc(nm(cur.id)) + "»" : "(افتح كتاب الأول)"}</label><button type="button" id="nSave">حفظ الملاحظة</button></div></div>
      <div class="row nfil"><input id="nSearch" type="search" placeholder="🔍 دوّر في ملاحظاتك" value="${esc(NQ)}"><select id="nFilter"><option value="all">كل الملاحظات</option><option value="book">الكتاب ده</option><option value="page">الصفحة دي</option></select></div>
      <div class="nlist">${list.map(n => `<article class="note" data-n="${n.id}"><div class="nm">${n.ai ? "🤖 من المدرّس" : "✍️ ملاحظتي"}${n.book ? ` · <a href="#" data-go="${esc(n.book)}|${n.page || 1}">${esc(nm(n.book))}${n.page ? " — ص " + n.page : ""}</a>` : ""}${n.lesson ? " · " + esc(n.lesson.slice(0, 50)) : ""} · <small>${dfmt(n.updated)}</small></div>
        <div class="nt">${md(n.text)}</div><div class="bact"><button type="button" class="ghost" data-e="edit">✏️ تعديل</button><button type="button" class="ghost" data-e="del">🗑️ مسح</button></div></article>`).join("") || `<p class="hempty">${all.length ? "مفيش ملاحظات بالبحث ده." : "لسه مفيش ملاحظات. اكتب واحدة فوق، أو دوس «📝 احفظ كملاحظة» تحت أي رد من المدرّس."}</p>`}</div>`;
    $("nFilter").value = NF; $("nFilter").onchange = e => { NF = e.target.value; rNotes(); };
    $("nSearch").oninput = e => { NQ = e.target.value; clearTimeout(rNotes.t); rNotes.t = setTimeout(() => { rNotes().then(() => { const s = $("nSearch"); s.focus(); s.setSelectionRange(s.value.length, s.value.length); }); }, 250); };
    $("nSave").onclick = async () => { const t = $("nText").value.trim(); if (!t) return; const link = $("nLink").checked && doc; await S.addNote({ text: t, book: link ? cur.id : "", page: link ? cur.page : 0 }); rNotes(); };
    body().querySelector(".nlist").onclick = async e => {
      const b = e.target.closest("[data-e]"); if (!b) return; const nid = b.closest(".note").dataset.n, ns = await DB.get("notes", []), n = ns.find(x => x.id === nid); if (!n) return;
      if (b.dataset.e === "del") { if (!confirm("تمسح الملاحظة دي؟")) return; await DB.set("notes", ns.filter(x => x.id !== nid)); }
      else { const art = b.closest(".note"); art.innerHTML = `<textarea rows="5">${esc(n.text)}</textarea><div class="bact"><button type="button" data-s="1">حفظ</button><button type="button" class="ghost" data-s="0">إلغاء</button></div>`;
        art.querySelector("[data-s='1']").onclick = async () => { n.text = art.querySelector("textarea").value.trim() || n.text; n.updated = Date.now(); await DB.set("notes", ns); rNotes(); };
        art.querySelector("[data-s='0']").onclick = rNotes; return; }
      rNotes();
    };
  }
  S.addNote = async ({ text, book = "", page = 0, ai = false }) => {
    const ns = await DB.get("notes", []), lesson = book && page ? RAG.sectionAt(book, page)?.line || "" : "";
    ns.push({ id: uid(), text: String(text).slice(0, 20000), book, page, lesson, ai, created: Date.now(), updated: Date.now() }); await DB.set("notes", ns); return ns.length;
  };
  // زرار «احفظ كملاحظة» تحت كل رد من المدرّس
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1 && n.classList?.contains("m") && n.classList.contains("a")) setTimeout(() => decorate(n), 50); }))).observe($("chat"), { childList: true });
  function decorate(n) {
    if (n._noted || n.classList.contains("typing") || n.classList.contains("sys")) return; const acts = n.querySelector(":scope > .acts"); if (!acts) return; n._noted = true;
    const b = document.createElement("button"); b.type = "button"; b.className = "noteBtn"; b.textContent = window.I18N?.lang === "en" ? "📝 Save as note" : "📝 احفظ كملاحظة"; b.title = "احفظ الرد ده في ملاحظاتك";
    b.onclick = async () => { const t = (n._copy || n.innerText.replace(/📝 احفظ كملاحظة|نسخ|انسخ/g, "")).trim(); if (!t) return; const book = $("book").value || cur.id || ""; await S.addNote({ text: t, book, page: book && book === cur.id ? cur.page : 0, ai: true }); b.textContent = window.I18N?.lang === "en" ? "✅ Saved" : "✅ اتحفظت"; b.disabled = true; toast("📝 اتحفظت في ملاحظاتك (مركز المذاكرة ← الملاحظات)."); };
    acts.append(b);
  }
  // الرد لسه بيتكتب وقت ما اتضاف: نزوّد الزرار لما يخلص
  new MutationObserver(() => $("chat").querySelectorAll(".m.a:not(.typing)").forEach(n => { if (!n._noted) decorate(n); })).observe($("chat"), { subtree: true, attributes: true, attributeFilter: ["class"] });

  // ================= ٣) الامتحانات =================
  const EX = { cfg: null, qs: [], ans: [], timer: 0, end: 0, done: false, res: null };
  const DIFF = { easy: "سهل", medium: "متوسط", hard: "صعب", vhard: "صعب جدًا" };
  const TYPES = { mcq: "اختيار من متعدد", tf: "صح وغلط", fill: "أكمل الفراغ", short: "إجابة قصيرة", essay: "مقالي", math: "مسائل" };
  function sections(id) {   // الفصول/الدروس من فهرس الكتاب، وإلا مجموعات كل ١٠ صفحات
    const n = BK[id]?.n || (cur.id === id ? doc?.numPages : 0) || 0, ol = RAG.outline(id).filter(h => h.lv <= 3);
    if (ol.length >= 2) return ol.slice(0, 60).map(h => ({ key: h.page + "-" + h.to, label: h.line, from: h.page, to: Math.max(h.page, h.to || h.page), lv: h.lv }));
    const out = []; for (let p = 1; p <= n; p += 10) out.push({ key: p + "-" + Math.min(n, p + 9), label: `صفحات ${p}–${Math.min(n, p + 9)}`, from: p, to: Math.min(n, p + 9), lv: 1 }); return out;
  }
  // الفصل المختار = الدروس اللي جواه (من غير تكرار نص الفصل والدرس مع بعض)
  function leaves(chosen, all) {
    const inChosen = all.filter(s => chosen.some(c => s.from >= c.from && s.to <= c.to && s.lv >= c.lv));
    const L = inChosen.filter(s => !inChosen.some(o => o !== s && o.from >= s.from && o.to <= s.to && o.lv > s.lv));
    return L.length ? L : chosen;
  }
  S.leaves = leaves;
  async function rExam() {
    if (EX.qs.length && !EX.done) return rTake();
    if (EX.res) return rReport();
    if (!LIB.length) { body().innerHTML = `<p class="hempty">ضيف كتاب الأول عشان أعملك امتحان منه.</p>`; return; }
    const id = EX.cfg?.id && LIB.some(e => e.id === EX.cfg.id) ? EX.cfg.id : curBook(); if (!BK[id] && typeof bkLoad === "function") { try { await bkLoad(id); } catch {} }
    const secs = sections(id), past = (await DB.get("exams", [])).filter(x => x.book === id).slice(-5).reverse();
    body().innerHTML = `<div class="hrow"><h2>🧪 امتحان من كتابك</h2></div>
      <div class="exform">
        <label>الكتاب <select id="eBook">${bookSel(id)}</select></label>
        <fieldset><legend>الجزء <label class="chk"><input type="checkbox" id="eAll"> الكتاب كله</label></legend><div class="secs">${secs.map((s, i) => `<label class="chk lv${s.lv}"><input type="checkbox" data-s="${i}"> ${esc(s.label.slice(0, 70))} <small>(ص ${s.from}${s.to > s.from ? "–" + s.to : ""})</small></label>`).join("") || "<small>الكتاب لسه متقراش — افتحه الأول.</small>"}</div></fieldset>
        <div class="row3"><label>عدد الأسئلة <input id="eN" type="number" min="3" max="30" value="10"></label>
          <label>الصعوبة <select id="eD">${Object.entries(DIFF).map(([k, v]) => `<option value="${k}"${k === "medium" ? " selected" : ""}>${v}</option>`).join("")}</select></label>
          <label>الوقت (دقايق، 0 = من غير وقت) <input id="eT" type="number" min="0" max="180" value="0"></label></div>
        <fieldset><legend>نوع الأسئلة</legend><div class="types">${Object.entries(TYPES).map(([k, v]) => `<label class="chk"><input type="checkbox" data-t="${k}"${k === "mcq" || k === "tf" || k === "short" ? " checked" : ""}> ${v}</label>`).join("")}</div></fieldset>
        <button type="button" id="eGo" class="accent">ابدأ الامتحان</button> <small id="eMsg" class="vnow"></small>
      </div>
      ${past.length ? `<h3>امتحاناتك اللي فاتت</h3><ul class="past">${past.map(x => `<li>${dfmt(x.date)} — <b>${x.score}%</b> (${x.right}/${x.total})${x.weak?.length ? " · ضعف في: " + esc(x.weak.slice(0, 3).join("، ")) : ""}</li>`).join("")}</ul>` : ""}`;
    $("eBook").onchange = e => { EX.cfg = { id: e.target.value }; rExam(); };
    $("eAll").onchange = e => body().querySelectorAll("[data-s]").forEach(c => c.checked = e.target.checked);
    $("eGo").onclick = () => {
      const chosen = [...body().querySelectorAll("[data-s]:checked")].map(c => secs[+c.dataset.s]), types = [...body().querySelectorAll("[data-t]:checked")].map(c => c.dataset.t);
      if (!types.length) return $("eMsg").textContent = "اختار نوع أسئلة واحد على الأقل.";
      S.startExam({ id: $("eBook").value, secs: leaves(chosen.length ? chosen : secs, secs), count: Math.min(30, Math.max(3, +$("eN").value || 10)), diff: $("eD").value, types, minutes: Math.max(0, +$("eT").value || 0) });
    };
  }
  // نص الجزء المختار (موزّع على الفصول) بميزانية مناسبة للموديل
  async function examBlocks(id, secs, budget) {
    const blocks = [], per = Math.max(700, Math.floor(budget / Math.max(1, secs.length)));
    for (const s of secs.slice(0, 20)) {
      let txt = "", pages = []; for (let p = s.from; p <= s.to && txt.length < per * 1.6 && p - s.from < 25; p++) { const t = await pageText(id, p); if (t) { txt += "\n" + t; pages.push(p); } }
      if (!txt.trim()) continue; blocks.push({ id, page: pages[0], sec: s.label, text: txt.replace(/\s+/g, " ").trim().slice(0, per) });
    }
    return blocks;
  }
  S.startExam = async cfg => {
    EX.cfg = cfg; EX.qs = []; EX.ans = []; EX.res = null; EX.done = false; clearInterval(EX.timer);
    if (!hub.hidden) body().innerHTML = `<div class="hload"><div class="spin"></div><p>بجهّز الامتحان من «${esc(nm(cfg.id))}»… <span id="eP"></span></p></div>`;
    try {
      const blocks = await examBlocks(cfg.id, cfg.secs, provider() === "free" ? 7000 : 14000);
      if (!blocks.length) throw new Error("مقدرتش أقرا نص من الجزء ده. لو الكتاب صور، دوس «ذاكر الكتاب كله» الأول عشان يتقري.");
      const lang = /[؀-ۿ]/.test(blocks.map(b => b.text).join(" ").slice(0, 2000)) ? "عربي" : "English";
      const dd = { easy: "سهلة ومباشرة", medium: "متوسطة: فهم وتطبيق", hard: "صعبة: تطبيق وتحليل وربط بين الأفكار، والاختيارات الغلط قريبة جدًا", vhard: "صعبة جدًا: مسائل ومواقف جديدة محتاجة تفكير عميق وربط أكتر من فكرة، من غير أسئلة حفظ" }[cfg.diff];
      const spec = `اعمل امتحان فيه ${cfg.count} سؤال بالظبط من المقاطع دي بس (مش من برّه)، موزّعين على كل المقاطع، والصعوبة ${dd}.
الأنواع المسموحة بس: ${cfg.types.map(t => t + " (" + TYPES[t] + ")").join("، ")} — ونوّع بينهم.
رجّع JSON بس بالشكل ده:
{"questions":[{"type":"mcq","q":"...","options":["...","...","...","..."],"answer":0,"explain":"ليه دي الإجابة","src":1}]}
- mcq: ٤ اختيارات و answer = رقم الصح (من 0). tf: options=${lang === "عربي" ? '["صح","غلط"]' : '["True","False"]'} و answer رقم.
- fill: جملة من الكتاب فيها ____ مكان الكلمة، و answer = الكلمة. short/essay/math: من غير options و answer = الإجابة النموذجية (للمسائل: الخطوات والناتج بالوحدة).
- src = رقم المقطع اللي السؤال جاي منه. الأسئلة بلغة الكتاب (${lang}).`;
      // الأسئلة بيانات منظّمة: schema + تحقق إن كل سؤال جاي من مقطع حقيقي من الجزء المختار + إعادة محاولة لو الرد باظ
      const r = await AI.structured({ tier: "smart", max: Math.min(6000, 450 * cfg.count + 800), temperature: 0.5,
        system: "إنت مدرّس بيعمل امتحانات دقيقة من كتاب الطالب بس. متخترعش معلومات مش في المقاطع. رجّع JSON صحيح بس.",
        prompt: "مقاطع من الكتاب:\n" + blocks.map((b, i) => `[${i + 1}] (${b.sec} — ص ${b.page})\n${b.text}`).join("\n\n") + "\n\n" + spec,
        validate: j => AI.validateQuestions(j, { blocks, types: cfg.types, max: cfg.count }),
        onText: t => { const e = $("eP"); if (e) e.textContent = Math.min(99, Math.round(t.length / (cfg.count * 3.2))) + "%"; } });
      const qs = r.value.map(x => ({ ...x, difficulty: cfg.diff, sec: x.sec || blocks[0].sec, page: x.page || blocks[0].page }));
      if (!qs.length) throw new Error("الموديل مرجّعش أسئلة صالحة. جرّب تاني.");
      EX.id = uid(); EX.qs = qs; EX.ans = qs.map(() => null); EX.start = Date.now(); EX.end = cfg.minutes ? Date.now() + cfg.minutes * 60000 : 0;
      if (EX.end) EX.timer = setInterval(tick, 1000);
      if (hub.hidden) S.open("exam"); else rTake();
    } catch (e) { if (!hub.hidden) { body().innerHTML = `<p class="hempty">⚠️ ${esc(e.name === "AbortError" ? "اتلغى." : errMsg(e) || e.message)}</p><button type="button" id="eBack">رجوع</button>`; $("eBack").onclick = () => { EX.qs = []; rExam(); }; } }
  };
  function tick() { const left = EX.end - Date.now(), el = $("eTimer"); if (el) { const m = Math.max(0, Math.floor(left / 60000)), s = Math.max(0, Math.floor(left / 1000) % 60); el.textContent = `⏱ ${m}:${String(s).padStart(2, "0")}`; el.classList.toggle("low", left < 60000); }
    if (left <= 0) { clearInterval(EX.timer); if (!EX.done) { toast("⏱ الوقت خلص — بصحح الامتحان."); submitExam(); } } }
  function rTake() {
    const L = ["أ", "ب", "ج", "د", "هـ", "و"];
    body().innerHTML = `<div class="hrow"><h2>🧪 امتحان — ${esc(nm(EX.cfg.id))} (${EX.qs.length} سؤال · ${DIFF[EX.cfg.diff]})</h2>${EX.end ? `<b id="eTimer" class="timer"></b>` : ""}</div>
      <ol class="exq">${EX.qs.map((x, i) => `<li data-i="${i}"><div class="qq">${md(x.q)} <small class="qt">${TYPES[x.type]}</small></div>${x.options ? `<div class="qo">${x.options.map((o, k) => `<label class="opt"><input type="radio" name="q${i}" value="${k}"${EX.ans[i] === k ? " checked" : ""}> <b>${L[k] || k + 1}</b> ${esc(o)}</label>`).join("")}</div>`
        : `<textarea rows="${x.type === "essay" || x.type === "math" ? 4 : 2}" placeholder="${x.type === "math" ? "اكتب الخطوات والناتج" : "إجابتك"}">${esc(EX.ans[i] || "")}</textarea>`}</li>`).join("")}</ol>
      <div class="row"><button type="button" id="eSubmit" class="accent">سلّم الامتحان</button><button type="button" id="eQuit" class="ghost">إلغاء</button></div>`;
    renderMath?.(body());
    body().querySelector(".exq").addEventListener("input", e => { const li = e.target.closest("li"); if (!li) return; const i = +li.dataset.i; EX.ans[i] = e.target.type === "radio" ? +e.target.value : e.target.value; });
    $("eSubmit").onclick = () => { const miss = EX.ans.filter(a => a == null || a === "").length; if (miss && !confirm(`فيه ${miss} سؤال من غير إجابة. تسلّم برضه؟`)) return; submitExam(); };
    $("eQuit").onclick = () => { if (!confirm("تلغي الامتحان؟")) return; clearInterval(EX.timer); EX.qs = []; rExam(); };
    if (EX.end) tick();
  }
  async function submitExam() {
    EX.done = true; clearInterval(EX.timer); if (!hub.hidden) body().innerHTML = `<div class="hload"><div class="spin"></div><p>بصحح إجاباتك…</p></div>`;
    const R = EX.qs.map((x, i) => ({ x, a: EX.ans[i], v: null, fb: "" }));
    R.forEach(r => { if (r.x.options) r.v = r.a === r.x.answer ? "correct" : "wrong"; else if (r.a == null || !String(r.a).trim()) { r.v = "wrong"; r.fb = "مفيش إجابة."; } });
    const open = R.map((r, i) => ({ r, i })).filter(o => !o.r.v);
    if (open.length) {
      try {
        const g = await AI.structured({ tier: "smart", max: 250 * open.length + 300, temperature: 0.2, system: "إنت مدرّس بيصحح إجابات الطالب بدقة وعدل. الإجابة الصح بكلام تاني = correct. رجّع JSON بس.",
          prompt: open.map(o => `#${o.i}\nالسؤال: ${o.r.x.q}\nالإجابة النموذجية: ${o.r.x.answer}\nإجابة الطالب: ${o.r.a}`).join("\n\n") + '\n\nرجّع: {"results":[{"i":رقم السؤال,"verdict":"correct"|"partial"|"wrong","feedback":"سطر: فين الغلط بالظبط أو إيه الناقص"}]}',
          validate: j => { const v = (j?.results || []).filter(x => open.some(o => o.i === +x.i) && ["correct", "partial", "wrong"].includes(x.verdict)); return { value: v.length ? v : null, errors: v.length ? [] : ["مفيش نتايج صالحة لأرقام الأسئلة المطلوبة"] }; } });
        g.value.forEach(x => { const o = open.find(o => o.i === +x.i); o.r.v = x.verdict; o.r.fb = String(x.feedback || ""); });
      } catch (e) { toast("⚠️ مقدرتش أصحح الأسئلة المكتوبة دلوقتي (" + (errMsg(e) || "").slice(0, 80) + ")."); }
    }
    const graded = R.filter(r => r.v), pts = graded.reduce((a, r) => a + (r.v === "correct" ? 1 : r.v === "partial" ? 0.5 : 0), 0);
    const topics = {}; graded.forEach(r => { const k = r.x.sec || "صفحة " + r.x.page, t = topics[k] ||= { name: k, page: r.x.page, right: 0, wrong: 0 }; r.v === "correct" ? t.right++ : t.wrong++; });
    const weakT = Object.values(topics).filter(t => t.wrong > 0).sort((a, b) => b.wrong - a.wrong);
    EX.res = { R, pts, graded: graded.length, total: R.length, score: graded.length ? Math.round(100 * pts / graded.length) : 0, weakT, ungraded: R.length - graded.length };
    await record(EX.cfg.id, graded.map(r => ({ topic: r.x.sec, page: r.x.page, ok: r.v === "correct", diff: EX.cfg.diff, q: r.x.q, src: "exam" })));
    // سجل الامتحان كامل (من إجابات حقيقية بس): الأسئلة ومصادرها وإجابتك والصح والوقت
    const ex = await DB.get("exams", []);
    ex.push({ id: EX.id || uid(), book: EX.cfg.id, date: Date.now(), startedAt: EX.start, seconds: Math.round((Date.now() - EX.start) / 1000), timeLimit: EX.cfg.minutes || 0,
      chapters: [...new Set(EX.cfg.secs.map(s => s.label))], difficulty: EX.cfg.diff, types: EX.cfg.types, score: EX.res.score, right: pts, total: graded.length, ungraded: EX.res.ungraded,
      weak: weakT.map(t => t.name), questions: R.map(r => ({ id: r.x.id, type: r.x.type, q: r.x.q, options: r.x.options, correct: r.x.answer, answer: r.a, verdict: r.v || "ungraded", lesson: r.x.sec, page: r.x.page })) });
    await DB.set("exams", ex.slice(-50));
    if (hub.hidden) S.open("exam"); else rReport();
  }
  function rReport() {
    const X = EX.res, L = ["أ", "ب", "ج", "د", "هـ", "و"], ans = r => r.x.options ? (r.a == null ? "—" : (L[r.a] || "") + " " + r.x.options[r.a]) : (r.a || "—");
    const right = r => r.x.options ? (L[r.x.answer] || "") + " " + r.x.options[r.x.answer] : r.x.answer;
    body().innerHTML = `<div class="hrow"><h2>🏁 نتيجة الامتحان</h2><button type="button" id="eNew">امتحان جديد</button></div>
      <div class="score"><b>${X.score}%</b><span>${X.pts} من ${X.graded} صح${X.ungraded ? ` · ${X.ungraded} سؤال ماتصححش (الذكاء مردّش)` : ""}</span></div>
      ${X.weakT.length ? `<div class="weakbox"><h3>🎯 محتاج تراجع</h3>${X.weakT.map(t => `<div class="wrow"><span>${esc(t.name)} — غلطت ${t.wrong}${t.right ? " وجبت " + t.right : ""}</span><a href="#" data-go="${esc(EX.cfg.id)}|${t.page}">افتح ص ${t.page}</a><button type="button" class="ghost" data-pr="${esc(t.name)}" data-p="${t.page}">اتدرّب عليها</button></div>`).join("")}</div>` : `<p class="good">🎉 مفيش غلطات — ممتاز!</p>`}
      <ol class="exr">${X.R.map(r => `<li class="${r.v || "ng"}"><div class="qq">${md(r.x.q)}</div><div>إجابتك: <b>${esc(String(ans(r)))}</b> ${r.v === "correct" ? "✅" : r.v === "partial" ? "🟡 ناقصة" : r.v === "wrong" ? "❌" : "⏳"}</div>
        ${r.v !== "correct" ? `<div>الإجابة الصح: <b>${md(String(right(r)))}</b></div>` : ""}${r.fb ? `<div class="fb">${md(r.fb)}</div>` : ""}${r.x.explain ? `<div class="ex">💡 ${md(r.x.explain)}</div>` : ""}
        <small>📍 ${esc(r.x.sec || "")} · <a href="#" data-go="${esc(EX.cfg.id)}|${r.x.page}">ص ${r.x.page}</a></small></li>`).join("")}</ol>`;
    renderMath?.(body());
    $("eNew").onclick = () => { EX.qs = []; EX.res = null; rExam(); };
    body().querySelectorAll("[data-pr]").forEach(b => b.onclick = () => S.practice(EX.cfg.id, b.dataset.pr, +b.dataset.p));
  }
  // تدريب مركّز على موضوع ضعيف: امتحان صغير من صفحات الموضوع ده بس
  S.practice = (id, topic, page) => {
    const s = sections(id).find(x => x.label === topic) || { label: topic, from: page, to: page + 1 };
    S.startExam({ id, secs: [s], count: 5, diff: "medium", types: ["mcq", "short"], minutes: 0 }); if (hub.hidden) S.open("exam");
  };

  // ================= ٤) نقط الضعف =================
  async function rWeak() {
    if (!LIB.length) { body().innerHTML = `<p class="hempty">ضيف كتاب الأول.</p>`; return; }
    const id = S._wb && LIB.some(e => e.id === S._wb) ? S._wb : curBook(), w = await weak(id), ts = Object.values(w.topics).sort((a, b) => (b.wrong / (b.right + b.wrong)) - (a.wrong / (a.right + a.wrong)) || b.wrong - a.wrong);
    const wk = ts.filter(isWeak);
    body().innerHTML = `<div class="hrow"><h2>🎯 نقط الضعف</h2><select id="wBook">${bookSel(id)}</select></div>
      <p class="vnow">محسوبة من إجاباتك الحقيقية بس (الأسئلة، «اختبرني»، والامتحانات). نقطة ضعف = ٣ محاولات على الأقل، غلطت في ٢ منهم أو أكتر، ونسبة صحتك أقل من 60%.</p>
      ${wk.length ? `<div class="weakbox">${wk.map(t => `<div class="wrow"><span>⚠️ بتغلط كتير في <b>${esc(t.name)}</b> (${t.wrong} غلط من ${t.right + t.wrong})</span><a href="#" data-go="${esc(id)}|${t.page}">ص ${t.page}</a><button type="button" data-pr="${esc(t.name)}" data-p="${t.page}">اتدرّب عليها</button><button type="button" class="ghost" data-ex="${esc(t.name)}">اشرحهالي</button></div>`).join("")}</div>` : ""}
      ${ts.length ? `<table class="wt"><thead><tr><th>الموضوع</th><th>صح</th><th>غلط</th><th>النسبة</th></tr></thead><tbody>${ts.map(t => `<tr${isWeak(t) ? ' class="bad"' : ""}><td><a href="#" data-go="${esc(id)}|${t.page}">${esc(t.name)}</a></td><td>${t.right}</td><td>${t.wrong}</td><td>${Math.round(100 * t.right / (t.right + t.wrong))}%</td></tr>`).join("")}</tbody></table>`
        : `<p class="hempty">لسه مفيش بيانات: حل أسئلة أو امتحان من الكتاب ده، وهنا هتظهر المواضيع اللي محتاجة مراجعة.</p>`}`;
    $("wBook").onchange = e => { S._wb = e.target.value; rWeak(); };
    body().querySelectorAll("[data-pr]").forEach(b => b.onclick = () => S.practice(id, b.dataset.pr, +b.dataset.p));
    body().querySelectorAll("[data-ex]").forEach(b => b.onclick = () => { S.close(); if (innerWidth <= 800) showTab("chat"); $("book").value = id; TUTOR.handle("اشرحلي " + b.dataset.ex + " ببساطة، أنا بغلط فيها كتير"); });
  }

  // ================= ٥) خطة المذاكرة =================
  // الخطة بتتحسب من فهرس الكتاب الحقيقي (عدد صفحات كل درس) وتقدّمك ونقط ضعفك — مش نص عشوائي
  S.buildPlan = async (id, { examDate = "", days = 7, secs = null, minutes = 60 } = {}) => {
    const all = secs || leaves(sections(id), sections(id)), p = await prog(id), w = await weak(id);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let D = examDate ? Math.round((new Date(examDate) - today) / 864e5) : days; D = Math.max(1, Math.min(120, D || 7));
    const seen = new Set(p.seen), left = all.map(s => ({ ...s, n: s.to - s.from + 1, read: [...Array(s.to - s.from + 1)].filter((_, k) => seen.has(s.from + k)).length }));
    const todo = left.filter(s => s.read < s.n * 0.8), review = left.filter(s => s.read >= s.n * 0.8), weakT = Object.values(w.topics).filter(isWeak);
    const studyDays = D >= 3 ? D - 1 : D, pagesTotal = todo.reduce((a, s) => a + s.n, 0), per = Math.max(1, Math.ceil(pagesTotal / studyDays));
    const plan = { book: id, created: Date.now(), examDate, minutes, days: [] };
    for (let d = 0; d < D; d++) { const dt = new Date(today); dt.setDate(dt.getDate() + d); plan.days.push({ date: dt.toISOString().slice(0, 10), tasks: [] }); }
    let day = 0, load = 0;
    for (const s of todo) {   // درس كبير بيتقسم على كذا يوم
      let from = s.from;
      while (from <= s.to) { const room = Math.max(1, per - load), to = Math.min(s.to, from + room - 1);
        plan.days[Math.min(day, studyDays - 1)].tasks.push({ id: uid(), type: "study", t: s.label + (from > s.from || to < s.to ? ` (ص ${from}–${to})` : ""), book: id, from, to, done: false });
        load += to - from + 1; from = to + 1; if (load >= per) { day++; load = 0; } }
    }
    weakT.forEach((t, i) => plan.days[Math.min(D - 1, Math.floor((i + 1) * D / (weakT.length + 1)))].tasks.push({ id: uid(), type: "weak", t: "مراجعة نقطة ضعف: " + t.name, book: id, from: t.page, to: t.page, topic: t.name, done: false }));
    if (D >= 3) { const last = plan.days[D - 1]; if (review.length) last.tasks.push({ id: uid(), type: "review", t: "مراجعة سريعة: " + review.slice(0, 4).map(s => s.label).join("، "), book: id, from: review[0].from, to: review[0].to, done: false });
      last.tasks.push({ id: uid(), type: "exam", t: "امتحان تجريبي على كل المنهج", book: id, done: false }); }
    if (!todo.length && !weakT.length && D < 3) plan.days[0].tasks.push({ id: uid(), type: "exam", t: "امتحان تجريبي على كل المنهج", book: id, done: false });
    await DB.set("plan:" + id, plan); return plan;
  };
  async function rPlan() {
    if (!LIB.length) { body().innerHTML = `<p class="hempty">ضيف كتاب الأول.</p>`; return; }
    const id = S._pb && LIB.some(e => e.id === S._pb) ? S._pb : curBook(), plan = await DB.get("plan:" + id, null);
    const tasks = plan ? plan.days.flatMap(d => d.tasks) : [], done = tasks.filter(t => t.done).length, today = new Date().toISOString().slice(0, 10);
    body().innerHTML = `<div class="hrow"><h2>🗓️ خطة المذاكرة</h2><select id="pBook">${bookSel(id)}</select></div>
      <div class="exform row3"><label>ميعاد الامتحان (اختياري) <input id="pDate" type="date" value="${esc(plan?.examDate || "")}"></label><label>أو عدد الأيام <input id="pDays" type="number" min="1" max="120" value="${plan ? plan.days.length : 7}"></label>
        <label>دقايق في اليوم <input id="pMin" type="number" min="15" max="600" step="15" value="${plan?.minutes || 60}"></label></div>
      <div class="row"><button type="button" id="pGo" class="accent">${plan ? "🔄 حدّث الخطة حسب تقدّمي" : "اعمل الخطة"}</button><small class="vnow">بتتحسب من فهرس الكتاب، والصفحات اللي قريتها فعلًا، ونقط ضعفك.</small></div>
      ${plan ? `<div class="bar2 big" title="${done} من ${tasks.length}"><i style="width:${tasks.length ? Math.round(100 * done / tasks.length) : 0}%"></i></div><small>خلّصت ${done} من ${tasks.length} مهمة</small>
      <div class="plan">${plan.days.map((d, i) => `<section class="pday${d.date === today ? " today" : ""}"><h4>اليوم ${i + 1} · ${new Date(d.date).toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "short" })}${d.date === today ? " — النهارده" : ""}</h4>
        ${d.tasks.length ? d.tasks.map(t => `<div class="ptask${t.done ? " done" : ""}"><label class="chk"><input type="checkbox" data-tk="${t.id}"${t.done ? " checked" : ""}> ${esc(t.t)}</label>
          ${t.from ? `<a href="#" data-go="${esc(t.book)}|${t.from}">افتح</a>` : ""}${t.type === "study" ? `<button type="button" class="ghost" data-tx="${esc(t.t)}">اشرحهولي</button>` : t.type === "weak" ? `<button type="button" class="ghost" data-pr="${esc(t.topic)}" data-p="${t.from}">اتدرّب</button>` : t.type === "exam" ? `<button type="button" class="ghost" data-exam="1">ابدأ</button>` : ""}</div>`).join("") : "<small>راحة / مراجعة خفيفة</small>"}</section>`).join("")}</div>` : ""}`;
    $("pBook").onchange = e => { S._pb = e.target.value; rPlan(); };
    $("pGo").onclick = async () => { await S.buildPlan(id, { examDate: $("pDate").value, days: +$("pDays").value, minutes: +$("pMin").value }); rPlan(); };
    body().querySelectorAll("[data-tk]").forEach(c => c.onchange = async () => { const pl = await DB.get("plan:" + id, null), t = pl?.days.flatMap(d => d.tasks).find(x => x.id === c.dataset.tk); if (t) { t.done = c.checked; await DB.set("plan:" + id, pl); rPlan(); } });
    body().querySelectorAll("[data-tx]").forEach(b => b.onclick = () => { S.close(); if (innerWidth <= 800) showTab("chat"); $("book").value = id; TUTOR.handle("اشرحلي " + b.dataset.tx.replace(/\s*\(ص [^)]*\)$/, "")); });
    body().querySelectorAll("[data-pr]").forEach(b => b.onclick = () => S.practice(id, b.dataset.pr, +b.dataset.p));
    body().querySelectorAll("[data-exam]").forEach(b => b.onclick = () => S.startExam({ id, secs: leaves(sections(id), sections(id)), count: 15, diff: "medium", types: ["mcq", "tf", "short"], minutes: 30 }));
  }

  // ================= ٦) البحث =================
  let SQ = "", SS = "book";
  async function pagesOf(id) {   // نص كل صفحة: من الفهرس المحفوظ، وإلا من طبقة النص في الملف المفتوح
    const t = BK[id]?.t || (await idbGet("idx:" + id))?.t; if (t?.some(x => x && x.length > 20)) return t;
    const d = cur.id === id ? doc : null; if (!d) return null; const out = [];
    for (let n = 1; n <= d.numPages; n++) { try { const tc = await (await d.getPage(n)).getTextContent(); out.push(tc.items.map(i => i.str).join(" ")); } catch { out.push(""); } }
    return out;
  }
  S.search = async (q, ids) => {
    const nq = norm(q.trim()); if (nq.length < 2) return []; const res = [];
    for (const id of ids) { const ps = await pagesOf(id); if (!ps) { res.push({ id, missing: true }); continue; }
      ps.forEach((t, i) => { if (!t) return; const n = norm(t), k = n.indexOf(nq); if (k < 0) return; let c = 0, j = k; while (j >= 0 && c < 50) { c++; j = n.indexOf(nq, j + 1); }
        res.push({ id, page: i + 1, hits: c, sec: RAG.sectionAt(id, i + 1)?.line || "", snip: n.slice(Math.max(0, k - 70), k + nq.length + 90) }); }); }
    return res.sort((a, b) => (b.hits || 0) - (a.hits || 0)).slice(0, 200);
  };
  async function rSearch() {
    body().innerHTML = `<div class="hrow"><h2>🔍 بحث</h2></div><form id="sForm" class="row nfil"><input id="sQ" type="search" placeholder="كلمة أو جملة…" value="${esc(SQ)}" autofocus>
      <select id="sScope"><option value="book">الكتاب المفتوح</option><option value="all">كل كتبي</option></select><button type="submit">دوّر</button></form><div id="sRes"></div>`;
    $("sScope").value = SS; $("sScope").onchange = e => { SS = e.target.value; };
    $("sForm").onsubmit = async e => { e.preventDefault(); SQ = $("sQ").value; const ids = SS === "all" ? LIB.map(x => x.id) : [curBook()].filter(Boolean); $("sRes").innerHTML = `<div class="spin"></div>`;
      const r = await S.search(SQ, ids), nq = norm(SQ.trim()), hl = s => esc(s).replace(new RegExp(nq.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), m => `<mark>${m}</mark>`);
      const miss = r.filter(x => x.missing), hits = r.filter(x => !x.missing);
      $("sRes").innerHTML = (hits.length ? `<p class="vnow">${hits.length} صفحة فيها «${esc(SQ)}»</p><ul class="sres">${hits.map(x => `<li><a href="#" data-go="${esc(x.id)}|${x.page}"><b>${esc(nm(x.id))} — ص ${x.page}</b>${x.sec ? ` · <small>${esc(x.sec.slice(0, 60))}</small>` : ""}<br><span>…${hl(x.snip)}…</span></a></li>`).join("")}</ul>` : `<p class="hempty">مفيش نتايج${nq.length < 2 ? " (اكتب حرفين على الأقل)" : ""}.</p>`)
        + (miss.length ? `<p class="vnow">⚠️ ${miss.map(x => "«" + esc(nm(x.id)) + "»").join("، ")} لسه متقراش — افتحه ودوس «ذاكر الكتاب كله» عشان يدخل في البحث.</p>` : ""); };
    if (SQ) $("sForm").requestSubmit(); setTimeout(() => $("sQ")?.focus(), 50);
  }

  // ================= ٧) صور في الشات + تصحيح خط الإيد =================
  const pend = []; const strip = document.createElement("div"); strip.id = "attach"; strip.hidden = true; document.querySelector("#form .composer")?.prepend(strip);
  const up = Object.assign(document.createElement("input"), { id: "imgUp", type: "file", accept: "image/*", multiple: true, hidden: true }); document.body.append(up);
  const ab = document.createElement("button"); ab.type = "button"; ab.id = "attachBtn"; ab.className = "cbtn"; ab.title = "ارفع صورة سؤال (أو الصق صورة / اسحبها هنا)"; ab.setAttribute("aria-label", "ارفع صورة");
  ab.innerHTML = I('<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>');
  document.querySelector("#form .ctools")?.insertBefore(ab, $("lang")); ab.onclick = () => up.click();
  async function toJpeg(file, max = 1600) {
    const img = await createImageBitmap(file), sc = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement("canvas"); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); return c.toDataURL("image/jpeg", 0.85);
  }
  S.addImages = async files => {
    for (const f of files) { if (!/^image\//.test(f.type)) continue; if (f.size > 15e6) { toast("⚠️ الصورة كبيرة أوي (أكتر من ١٥ ميجا)."); continue; }
      try { pend.push({ url: await toJpeg(f), label: f.name || "صورة" }); } catch { toast("⚠️ مقدرتش أفتح الصورة دي."); } }
    drawStrip();
  };
  function drawStrip() {
    strip.hidden = !pend.length; strip.innerHTML = pend.map((p, i) => `<span class="ath"><img src="${p.url}" alt=""><button type="button" data-x="${i}" aria-label="شيل الصورة">✕</button></span>`).join("") + (pend.length ? `<small>الصورة هتتبعت مع سؤالك${textOnly() ? " (المزوّد الحالي مبيشوفش الصور، فهقراها بالـ OCR)" : ""}</small>` : "");
  }
  strip.onclick = e => { const x = e.target.dataset?.x; if (x != null) { pend.splice(+x, 1); drawStrip(); } };
  up.onchange = () => { S.addImages([...up.files]); up.value = ""; };
  $("q").addEventListener("paste", e => { const fs = [...(e.clipboardData?.files || [])].filter(f => /^image\//.test(f.type)); if (fs.length) { e.preventDefault(); S.addImages(fs); } });
  $("side").addEventListener("dragover", e => { if ([...(e.dataTransfer?.items || [])].some(i => i.kind === "file")) { e.preventDefault(); $("side").classList.add("drop"); } });
  $("side").addEventListener("dragleave", () => $("side").classList.remove("drop"));
  $("side").addEventListener("drop", e => { $("side").classList.remove("drop"); const fs = [...(e.dataTransfer?.files || [])].filter(f => /^image\//.test(f.type)); if (fs.length) { e.preventDefault(); S.addImages(fs); } });
  let showNext = null;
  $("form").addEventListener("submit", e => {   // قبل ما السؤال يتبعت: الصور تتربط بيه
    if (!pend.length || document.body.classList.contains("gen")) return;
    if (!$("q").value.trim()) $("q").value = "حل السؤال اللي في الصورة واشرحلي الخطوات";
    TUTOR.attach(pend.map(p => ({ b64: p.url.split(",")[1], label: p.label }))); showNext = pend.map(p => p.url); pend.length = 0; drawStrip();
  }, true);
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (showNext && n.nodeType === 1 && n.classList?.contains("u")) { const urls = showNext; showNext = null; const w = document.createElement("div"); w.className = "uimgs"; w.innerHTML = urls.map(u => `<img class="thumb" src="${u}" alt="صورة السؤال">`).join(""); n.prepend(w); } }))).observe($("chat"), { childList: true });
  // «صحّحلي اللي كتبته»: صورة الصفحة + كتابة الطالب عليها → المدرّس يراجع كل خطوة
  S.checkWork = async () => {
    if (!doc) return toast("افتح كتاب الأول."); const n = cur.page, el = pgs[n - 1];
    if (!(window.inkPages?.() || []).includes(n)) return toast("اكتب حلّك على الصفحة بالقلم الأول (أداة القلم فوق)، وبعدين دوس «صحّحلي».");
    const pc = el?.firstChild, ink = el?._ink; if (!pc?.width) return toast("استنى الصفحة تظهر كاملة وجرّب تاني.");
    const c = document.createElement("canvas"), sc = Math.min(1, 1600 / pc.width); c.width = Math.round(pc.width * sc); c.height = Math.round(pc.height * sc);
    const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(pc, 0, 0, c.width, c.height); if (ink?.width) x.drawImage(ink, 0, 0, c.width, c.height);
    const url = c.toDataURL("image/jpeg", 0.88); TUTOR.attach([{ b64: url.split(",")[1], label: "صفحة " + n + " عليها حل الطالب بخط إيده" }]); showNext = [url];
    if (innerWidth <= 800) showTab("chat"); $("book").value = cur.id;
    TUTOR.handle(`صحّحلي الحل اللي كتبته بخط إيدي على صفحة ${n}: قولّي كل خطوة صح ولا غلط، وفين الغلط بالظبط وليه، والحل الصح. لو جزء من خطي مش واضح قول كده ومتخمّنش.`);
  };

  // ================= ٨) الحفظ التلقائي: «بيحفظ… / اتحفظ ✓ / الحفظ فشل» =================
  const sv = document.createElement("span"); sv.id = "saveState"; sv.setAttribute("role", "status"); sv.setAttribute("aria-live", "polite"); $("tools")?.append(sv);
  const WATCH = /^(ann_|notes$|prog:|plan:|weak:|exams$|lib$)/; let pendSave = 0, svT = 0;
  const origSet = window.idbSet;
  window.idbSet = async (k, v) => {
    const w = typeof k === "string" && WATCH.test(k); if (w) { pendSave++; sv.className = "saving"; sv.textContent = window.I18N?.lang === "en" ? "Saving…" : "بيحفظ…"; }
    let ok = false; try { ok = await origSet(k, v); } finally {
      if (w) { pendSave--; clearTimeout(svT);
        if (!ok) { sv.className = "fail"; sv.textContent = window.I18N?.lang === "en" ? "Save failed ⚠️" : "الحفظ فشل ⚠️"; toast(window.I18N?.lang === "en" ? "⚠️ Couldn't save on this device (storage full?). Your changes are still on screen — free some space and try again." : "⚠️ مقدرتش أحفظ على الجهاز (المساحة خلصت؟). التعديلات لسه قدامك — فضّي مساحة وجرّب تاني."); }
        else if (!pendSave) { sv.className = "ok"; sv.textContent = window.I18N?.lang === "en" ? "Saved ✓" : "اتحفظ ✓"; svT = setTimeout(() => { sv.className = ""; sv.textContent = ""; }, 2500); } } }
    return ok;
  };
  S._EX = EX;   // للاختبارات
  window.STUDY = S;
})();

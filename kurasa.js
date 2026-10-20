// ===== الكراسة: صفحة مسطّرة جنب الكتاب تكتب فيها بالقلم (أو بصباعك) أو بالكيبورد =====
// اللوحة الجانبية بقت فيها اختيارين: «🤖 المساعد» و«📓 الكراسة»، وزرار ✕ يقفلها خالص والكتاب ياخد الشاشة كلها.
// صفحات الكراسة هي نفس صفحات «📓 النوت بوك» في مركز المذاكرة (مفتاح «nb»)، ومعاها رسم القلم (ink) — وبتتزامن مع الحساب.
(() => {
  const W = 800, LH = 40, TOP = 40, MINH = 1120;
  const COLORS = [["#1d2a5b", "أزرق غامق"], ["#1565c0", "أزرق"], ["#c62828", "أحمر"], ["#2e7d32", "أخضر"]];
  const SIZES = [[2, "رفيع"], [3.5, "متوسط"], [6, "تخين"]];
  const T = s => window.I18N?.t(s) || s;
  const ls = { get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
  const mob = () => matchMedia("(max-width:800px)").matches;
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const clean = h => (window.STUDY?.nbClean ? STUDY.nbClean(h) : esc(String(h || "").replace(/<[^>]*>/g, "")));

  // ---------- اللوحة الجانبية: المساعد / الكراسة / مقفولة ----------
  const side = $("side"), app = $("app");
  let MODE = ls.get("side.mode", "chat") === "kur" ? "kur" : "chat", OFF = ls.get("side.off", "0") === "1";
  const head = document.createElement("div"); head.className = "sidehead";
  head.innerHTML = `<div class="seg" role="tablist"><button type="button" role="tab" data-sm="chat">🤖 ${T("المساعد")}</button><button type="button" role="tab" data-sm="kur">📓 ${T("الكراسة")}</button></div>
    <button type="button" class="icon" id="sideClose" title="${T("اقفل اللوحة الجانبية")}" aria-label="${T("اقفل اللوحة الجانبية")}"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`;
  side.prepend(head);
  const kur = document.createElement("div"); kur.id = "kur"; side.append(kur);
  const sb = document.createElement("button"); sb.type = "button"; sb.id = "sideBtn"; sb.className = "icon";
  sb.innerHTML = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/></svg>';
  document.querySelector("header .hbtns")?.prepend(sb);
  // تاب «الكراسة» على الموبايل جنب «الكتاب» و«المساعد»
  const tabs = $("tabs"), kt = document.createElement("button"); kt.type = "button"; kt.dataset.t = "kur";
  kt.innerHTML = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg> ' + T("الكراسة");
  tabs?.append(kt);

  function apply() {
    document.body.classList.toggle("side-kur", MODE === "kur");
    document.body.classList.toggle("side-off", OFF);
    head.querySelectorAll("[data-sm]").forEach(b => { const on = b.dataset.sm === MODE; b.classList.toggle("on", on); b.setAttribute("aria-selected", String(on)); });
    sb.title = sb.ariaLabel = OFF ? T("افتح اللوحة الجانبية (المساعد والكراسة)") : T("اقفل اللوحة الجانبية");
    sb.classList.toggle("on", !OFF);
    ls.set("side.mode", MODE); ls.set("side.off", OFF ? "1" : "0");
    if (MODE === "kur" && !OFF) K.show();
  }
  const setMode = m => { if (MODE === "kur" && m !== "kur") K.flush(); MODE = m; OFF = false; apply(); };
  head.onclick = e => { const b = e.target.closest("[data-sm]"); if (b) { setMode(b.dataset.sm); if (mob()) showTab(b.dataset.sm === "kur" ? "kur" : "chat"); } };
  $("sideClose").onclick = () => { K.flush(); OFF = true; apply(); };
  sb.onclick = () => { OFF = !OFF; if (OFF) K.flush(); apply(); };
  // أي حاجة في الموقع بتفتح المساعد (اشرح، حل، ذاكر مع الـ AI…) بترجّع اللوحة على المساعد
  const oShow = window.showTab;
  window.showTab = t => { if (t === "chat") setMode("chat"); if (t === "kur") setMode("kur"); oShow(t); };
  kt.onclick = () => showTab("kur");
  tabs?.querySelector('[data-t="chat"]')?.addEventListener("click", () => setMode("chat"));
  // رد جديد من المساعد بسبب حاجة الطالب داسها (مش رسايل الترحيب وقت الفتح) → اللوحة ترجع على المساعد
  let act = 0; document.addEventListener("pointerdown", e => { if (!e.target.closest?.("#kur,.sidehead")) act = Date.now(); }, true);
  document.addEventListener("keydown", e => { if (!e.target.closest?.("#kur")) act = Date.now(); }, true);
  new MutationObserver(ms => { if ((MODE !== "chat" || OFF) && Date.now() - act < 4000 && ms.some(m => [...m.addedNodes].some(n => n.classList?.contains("m")))) setMode("chat"); })
    .observe($("chat"), { childList: true });

  // ---------- الكراسة ----------
  const K = {}; let PAGES = [], CUR = "", TOOL = ls.get("kur.tool", "pen"), COLOR = ls.get("kur.color", COLORS[0][0]), SIZE = +ls.get("kur.size", SIZES[1][0]) || SIZES[1][0];
  let built = false, scale = 1, H = MINH, saveT = 0, dirty = false, undo = [], redo = [], penSeen = false;
  const page = () => PAGES.find(p => p.id === CUR);
  async function load() { PAGES = ((await idbGet("nb")) || []).filter(p => p && !p.del); PAGES.sort((a, b) => (a.created || 0) - (b.created || 0)); }
  async function save() {
    const pg = page(); if (!pg || !dirty) return; dirty = false; clearTimeout(saveT); saveT = 0;
    pg.html = clean(ed.innerHTML); pg.title = ($("kTitle").value.trim() || T("صفحة")).slice(0, 120); pg.h = H; pg.updated = Date.now();
    const all = (await idbGet("nb")) || [], i = all.findIndex(x => x.id === pg.id); if (i >= 0) all[i] = { ...all[i], ...pg }; else all.push(pg);
    await window.idbSet("nb", all); window.dispatchEvent(new CustomEvent("study-data", { detail: { key: "nb", from: "kur" } }));
    const st = $("kState"); if (st) st.textContent = "✓ " + T("اتحفظ");
  }
  const later = () => { dirty = true; const st = $("kState"); if (st) st.textContent = T("بيتحفظ…"); clearTimeout(saveT); saveT = setTimeout(save, 600); };
  K.flush = () => dirty ? save() : Promise.resolve();
  addEventListener("pagehide", K.flush);
  async function newPage() {
    const n = PAGES.length + 1, b = (typeof cur !== "undefined" && cur.id) || $("book")?.value || "";
    const pg = { id: uid(), title: T("صفحة") + " " + n, html: "", ink: [], book: b, h: MINH, created: Date.now(), updated: Date.now() };
    PAGES.push(pg); CUR = pg.id; const all = (await idbGet("nb")) || []; all.push(pg); await window.idbSet("nb", all);
    window.dispatchEvent(new CustomEvent("study-data", { detail: { key: "nb", from: "kur" } })); return pg;
  }

  let paper, cv, ctx, ed, wrap;
  function build() {
    built = true;
    const tb = (t, l, title, extra = "") => `<button type="button" class="ktool" data-tool="${t}" title="${T(title)}" aria-label="${T(title)}"${extra}>${l}</button>`;
    kur.innerHTML = `<div class="kbar" role="toolbar" aria-label="${T("أدوات الكراسة")}">
        <div class="kgrp">${tb("pen", "✍️", "قلم")}${tb("hl", "🖍️", "هايلايتر")}${tb("erase", "🧽", "ممحاة")}${tb("type", "⌨️", "كتابة بالكيبورد")}</div>
        <div class="kgrp kcol">${COLORS.map(([c, n]) => `<button type="button" class="kdot" data-color="${c}" style="--c:${c}" title="${T(n)}" aria-label="${T(n)}"></button>`).join("")}</div>
        <div class="kgrp ksz">${SIZES.map(([s, n]) => `<button type="button" class="ksize" data-size="${s}" title="${T(n)}" aria-label="${T(n)}"><i style="width:${s * 2 + 2}px;height:${s * 2 + 2}px"></i></button>`).join("")}</div>
        <div class="kgrp"><button type="button" class="ktool" id="kUndo" title="${T("تراجع")}" aria-label="${T("تراجع")}">↶</button><button type="button" class="ktool" id="kRedo" title="${T("إعادة")}" aria-label="${T("إعادة")}">↷</button></div>
      </div>
      <div class="kbar knav"><button type="button" class="ktool" id="kPrev" title="${T("الصفحة اللي قبلها")}" aria-label="${T("الصفحة اللي قبلها")}">›</button><span id="kNum" class="knum"></span><button type="button" class="ktool" id="kNext" title="${T("الصفحة اللي بعدها")}" aria-label="${T("الصفحة اللي بعدها")}">‹</button>
        <input id="kTitle" class="ktitle" maxlength="120" aria-label="${T("عنوان الصفحة")}"><small id="kState" class="kstate"></small>
        <button type="button" class="ktool" id="kAdd" title="${T("صفحة جديدة")}" aria-label="${T("صفحة جديدة")}">＋</button><button type="button" class="ktool" id="kMore" title="${T("مسح")}" aria-label="${T("مسح")}" aria-haspopup="true">🗑️</button>
        <div id="kMenu" class="kmenu" hidden><button type="button" data-k="clearInk">${T("امسح رسم القلم في الصفحة دي")}</button><button type="button" data-k="clearAll">${T("فضّي الصفحة كلها")}</button><button type="button" data-k="delPage" class="kdanger">${T("امسح الصفحة نهائيًا")}</button></div>
      </div>
      <div class="kscroll" id="kScroll"><div class="kwrap" id="kWrap"><div class="kpaper" id="kPaper"><canvas id="kBg" aria-hidden="true"></canvas><div class="ked" id="kEd" dir="auto" spellcheck="false" data-ph="${T("اكتب هنا…")}"></div><canvas id="kCv"></canvas></div></div></div>`;
    paper = $("kPaper"); cv = $("kCv"); ctx = cv.getContext("2d"); ed = $("kEd"); wrap = $("kWrap");
    kur.querySelector(".kbar").onclick = e => {
      const t = e.target.closest("[data-tool]"), c = e.target.closest("[data-color]"), s = e.target.closest("[data-size]");
      if (t) { TOOL = t.dataset.tool; ls.set("kur.tool", TOOL); }
      if (c) { COLOR = c.dataset.color; ls.set("kur.color", COLOR); if (TOOL === "erase" || TOOL === "type") TOOL = "pen"; if (TOOL === "type" && document.activeElement === ed) document.execCommand("foreColor", false, COLOR); }
      if (s) { SIZE = +s.dataset.size; ls.set("kur.size", String(SIZE)); if (TOOL === "erase" || TOOL === "type") TOOL = "pen"; }
      if (t || c || s) tools();
    };
    $("kUndo").onclick = () => { const pg = page(); if (!pg || !undo.length) return; redo.push(JSON.stringify(pg.ink || [])); pg.ink = JSON.parse(undo.pop()); draw(); later(); };
    $("kRedo").onclick = () => { const pg = page(); if (!pg || !redo.length) return; undo.push(JSON.stringify(pg.ink || [])); pg.ink = JSON.parse(redo.pop()); draw(); later(); };
    $("kPrev").onclick = () => go(-1); $("kNext").onclick = () => go(1);
    $("kAdd").onclick = async () => { await K.flush(); await newPage(); open(); };
    $("kTitle").oninput = later;
    $("kMore").onclick = e => { e.stopPropagation(); $("kMenu").hidden = !$("kMenu").hidden; };
    document.addEventListener("click", e => { if (!e.target.closest?.("#kMenu,#kMore")) { const m = $("kMenu"); if (m) m.hidden = true; } });
    $("kMenu").onclick = async e => {
      const k = e.target.closest("[data-k]")?.dataset.k, pg = page(); if (!k || !pg) return; $("kMenu").hidden = true;
      if (k === "clearInk") { undo.push(JSON.stringify(pg.ink || [])); pg.ink = []; draw(); later(); }
      else if (k === "clearAll") { undo.push(JSON.stringify(pg.ink || [])); pg.ink = []; ed.innerHTML = ""; H = MINH; layout(); later(); }
      else if (k === "delPage") { if (!confirmIn(e.target)) return; clearTimeout(saveT); dirty = false; const all = (await idbGet("nb")) || [], o = all.find(x => x.id === pg.id);
        if (o) { o.del = true; o.html = ""; o.ink = []; o.updated = Date.now(); await window.idbSet("nb", all); }
        PAGES = PAGES.filter(x => x.id !== pg.id); CUR = PAGES[PAGES.length - 1]?.id || ""; if (!CUR) await newPage(); open(); window.dispatchEvent(new CustomEvent("study-data", { detail: { key: "nb", from: "kur" } })); }
    };
    ed.addEventListener("input", () => { grow(); later(); });
    ed.addEventListener("paste", e => { const h = e.clipboardData?.getData("text/html"), tx = e.clipboardData?.getData("text/plain"); if (!h && !tx) return; e.preventDefault(); document.execCommand("insertHTML", false, h ? clean(h) : esc(tx).replace(/\n/g, "<br>")); });
    pointer();
    new ResizeObserver(() => layout()).observe($("kScroll"));
  }
  // تأكيد جوه الصفحة (مش confirm): أول ضغطة بتطلب ضغطة تانية
  function confirmIn(b) { if (b.dataset.sure) return true; b.dataset.sure = "1"; const o = b.textContent; b.textContent = T("متأكد؟ دوس تاني"); $("kMenu").hidden = false; setTimeout(() => { b.textContent = o; delete b.dataset.sure; }, 3000); return false; }
  function tools() {
    kur.querySelectorAll("[data-tool]").forEach(b => b.classList.toggle("on", b.dataset.tool === TOOL));
    kur.querySelectorAll("[data-color]").forEach(b => b.classList.toggle("on", b.dataset.color === COLOR));
    kur.querySelectorAll("[data-size]").forEach(b => b.classList.toggle("on", +b.dataset.size === SIZE));
    const typing = TOOL === "type"; ed.contentEditable = typing ? "true" : "false"; paper.classList.toggle("typing", typing); paper.dataset.tool = TOOL;
    if (typing) { ed.focus(); }
  }
  async function go(d) { const i = PAGES.findIndex(p => p.id === CUR), n = i + d; if (n < 0 || n >= PAGES.length) return; await K.flush(); CUR = PAGES[n].id; open(); }
  function open() {
    const pg = page(); if (!pg) return; undo = []; redo = [];
    ed.innerHTML = clean(pg.html); $("kTitle").value = pg.title || ""; $("kState").textContent = "";
    const i = PAGES.findIndex(p => p.id === CUR); $("kNum").textContent = `${(i + 1).toLocaleString("ar-EG")} / ${PAGES.length.toLocaleString("ar-EG")}`;
    $("kPrev").disabled = i <= 0; $("kNext").disabled = i >= PAGES.length - 1;
    H = Math.max(MINH, pg.h || 0); ls.set("kur.page", CUR); tools(); layout(); grow(); $("kScroll").scrollTop = 0;
  }
  // الورقة بتطول لوحدها لما الكتابة أو الرسم يوصلوا لآخرها
  function grow() {
    const pg = page(); let need = MINH; const tx = ed.scrollHeight + TOP + LH * 2; if (tx > need) need = tx;
    for (const s of pg?.ink || []) for (let j = 1; j < s.p.length; j += 2) if (s.p[j] + LH * 3 > need) need = s.p[j] + LH * 3;
    need = Math.ceil(need / LH) * LH; if (need !== H) { H = need; layout(); }
  }
  function layout() {
    if (!built || kur.offsetParent === null) return;
    const avail = $("kScroll").clientWidth - 24; scale = Math.max(.3, Math.min(1.25, avail / W));
    paper.style.height = H + "px"; paper.style.transform = `scale(${scale})`;
    wrap.style.width = W * scale + "px"; wrap.style.height = H * scale + "px";
    const k = Math.min(3, (devicePixelRatio || 1) * scale); cv.width = Math.round(W * k); cv.height = Math.round(H * k); cv.style.width = W + "px"; cv.style.height = H + "px";
    ctx.setTransform(k, 0, 0, k, 0, 0); lines(k); draw();
  }
  // السطور والهامش مترسومين على canvas (مش CSS) عشان المسافات تفضل متساوية بالظبط مع أي تكبير
  function lines(k = Math.min(3, (devicePixelRatio || 1) * scale)) {
    const bg = $("kBg"); if (!bg) return; bg.width = cv.width; bg.height = cv.height; bg.style.width = W + "px"; bg.style.height = H + "px";
    const g = bg.getContext("2d"), cs = getComputedStyle(paper); g.setTransform(k, 0, 0, k, 0, 0);
    g.fillStyle = cs.getPropertyValue("--kpaper").trim() || "#fffefa"; g.fillRect(0, 0, W, H);
    g.fillStyle = cs.getPropertyValue("--kline").trim() || "#c9d7ee"; const t = 1 / k * Math.max(1, Math.round(k));
    for (let y = TOP + LH; y < H - 8; y += LH) g.fillRect(0, y - t, W, t);
    g.fillStyle = cs.getPropertyValue("--kmargin").trim() || "#e57373"; g.fillRect(W - 88, 0, 2 / Math.max(1, k / 2), H);
  }
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => built && lines());
  new MutationObserver(() => built && lines()).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  function path(p) {
    ctx.beginPath(); ctx.moveTo(p[0], p[1]);
    if (p.length === 2) { ctx.lineTo(p[0] + .1, p[1] + .1); return; }
    for (let i = 2; i < p.length - 2; i += 2) { const mx = (p[i] + p[i + 2]) / 2, my = (p[i + 1] + p[i + 3]) / 2; ctx.quadraticCurveTo(p[i], p[i + 1], mx, my); }
    ctx.lineTo(p[p.length - 2], p[p.length - 1]);
  }
  function draw() {
    if (!ctx) return; ctx.clearRect(0, 0, W, H); const ink = page()?.ink || [];
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (const pass of ["hl", "pen"]) for (const s of ink) { if ((s.t === "hl") !== (pass === "hl")) continue;
      ctx.globalAlpha = s.t === "hl" ? .32 : 1; ctx.strokeStyle = s.c; ctx.lineWidth = s.w; path(s.p); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  function pointer() {
    let st = null, raf = 0;
    const pt = e => { const r = paper.getBoundingClientRect(); return [Math.round((e.clientX - r.left) / scale * 10) / 10, Math.round((e.clientY - r.top) / scale * 10) / 10]; };
    const erase = ([x, y]) => { const pg = page(), r = 14; const before = pg.ink.length;
      pg.ink = pg.ink.filter(s => { for (let i = 0; i < s.p.length; i += 2) if (Math.hypot(s.p[i] - x, s.p[i + 1] - y) < r + s.w / 2) return false; return true; });
      if (pg.ink.length !== before) { draw(); later(); } };
    cv.addEventListener("pointerdown", e => {
      if (TOOL === "type" || (e.pointerType === "touch" && penSeen) || e.button > 0) return;
      if (e.pointerType === "pen") penSeen = true;
      const pg = page(); if (!pg) return; pg.ink ||= []; e.preventDefault(); cv.setPointerCapture(e.pointerId);
      undo.push(JSON.stringify(pg.ink)); if (undo.length > 60) undo.shift(); redo = [];
      if (TOOL === "erase") { st = { erase: true }; erase(pt(e)); return; }
      st = { t: TOOL === "hl" ? "hl" : "pen", c: TOOL === "hl" ? "#ffd600" : COLOR, w: TOOL === "hl" ? 18 : SIZE, p: pt(e) }; pg.ink.push(st); draw();
    });
    cv.addEventListener("pointermove", e => {
      if (!st) return; e.preventDefault();
      const evs = e.getCoalescedEvents?.() || [e];
      if (st.erase) { evs.forEach(x => erase(pt(x))); return; }
      for (const x of evs) { const [a, b] = pt(x), n = st.p.length; if (Math.hypot(a - st.p[n - 2], b - st.p[n - 1]) >= 1.2) st.p.push(a, b); }
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); });
    });
    const end = () => { if (!st) return; const was = st; st = null; if (!was.erase) { draw(); grow(); later(); } };
    cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end); cv.addEventListener("lostpointercapture", end);
  }

  K.show = async () => {
    if (!built) build();
    if (!PAGES.length || !page()) { await load(); CUR = page()?.id || (PAGES.some(p => p.id === ls.get("kur.page", "")) ? ls.get("kur.page", "") : PAGES[PAGES.length - 1]?.id || ""); if (!CUR) await newPage(); open(); }
    else layout();
  };
  // لو الصفحات اتعدّلت من مركز المذاكرة أو من جهاز تاني بالمزامنة
  window.addEventListener("study-data", async e => { if (e.detail?.key !== "nb" || e.detail?.from === "kur" || !built) return; if (dirty) await save(); await load(); if (!page()) CUR = PAGES[PAGES.length - 1]?.id || ""; if (CUR) open(); });
  K.reload = async () => { if (dirty) await save(); await load(); if (!page()) CUR = PAGES[PAGES.length - 1]?.id || ""; if (built && CUR) open(); };
  window.KURASA = K;
  apply();
  if (mob() && MODE === "kur" && $("app").className === "show-chat") oShow("kur");
})();

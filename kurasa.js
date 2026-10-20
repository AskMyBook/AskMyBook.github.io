// ===== الكراسة: صفحة مسطّرة جنب الكتاب تكتب فيها بالقلم (أو بصباعك) أو بالكيبورد =====
// اللوحة الجانبية بقت فيها اختيارين: «🤖 المساعد» و«📓 الكراسة»، وزرار ✕ يقفلها خالص والكتاب ياخد الشاشة كلها.
// صفحات الكراسة هي نفس صفحات «📓 النوت بوك» في مركز المذاكرة (مفتاح «nb»)، ومعاها رسم القلم (ink) — وبتتزامن مع الحساب.
(() => {
  const W = 800, LH = 40, TOP = 40, MINH = 1120;
  const COLORS = [["#111111", "أسود"], ["#ffffff", "أبيض"], ["#1d2a5b", "أزرق غامق"], ["#1565c0", "أزرق"], ["#c62828", "أحمر"], ["#2e7d32", "أخضر"]];
  // لون الورقة: «تلقائي» بيمشي مع الوضع الفاتح/الغامق، أو لون ثابت تختاره (السطور والهامش ولون الكتابة بيتظبطوا عليه)
  const PAPERS = [["auto", "تلقائي"], ["#fffefa", "كريمي"], ["#ffffff", "أبيض"], ["#fff6cc", "أصفر"], ["#e6f1ff", "أزرق فاتح"], ["#e7f6e7", "أخضر فاتح"], ["#fde9f0", "وردي"], ["#2b303b", "رمادي غامق"], ["#111111", "أسود"]];
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
    pg.html = clean(ed.innerHTML); pg.title = ($("kTitle").value.trim() || T("صفحة")).slice(0, 120); pg.h = H; pg.paper = pg.paper || ""; pg.updated = Date.now();
    const all = (await idbGet("nb")) || [], i = all.findIndex(x => x.id === pg.id); if (i >= 0) all[i] = { ...all[i], ...pg }; else all.push(pg);
    await window.idbSet("nb", all); window.dispatchEvent(new CustomEvent("study-data", { detail: { key: "nb", from: "kur" } }));
    const st = $("kState"); if (st) st.textContent = "✓ " + T("اتحفظ");
  }
  const later = () => { dirty = true; const st = $("kState"); if (st) st.textContent = T("بيتحفظ…"); clearTimeout(saveT); saveT = setTimeout(save, 600); };
  K.flush = () => dirty ? save() : Promise.resolve();
  addEventListener("pagehide", K.flush);
  async function newPage() {
    const n = PAGES.length + 1, b = (typeof cur !== "undefined" && cur.id) || $("book")?.value || "";
    const lp = ls.get("kur.paper", "auto"), pg = { id: uid(), title: T("صفحة") + " " + n, html: "", ink: [], book: b, h: MINH, paper: lp === "auto" ? "" : lp, created: Date.now(), updated: Date.now() };
    PAGES.push(pg); CUR = pg.id; const all = (await idbGet("nb")) || []; all.push(pg); await window.idbSet("nb", all);
    window.dispatchEvent(new CustomEvent("study-data", { detail: { key: "nb", from: "kur" } })); return pg;
  }

  let paper, cv, ctx, ed, wrap;
  function build() {
    built = true;
    const tb = (t, l, title, extra = "") => `<button type="button" class="ktool" data-tool="${t}" title="${T(title)}" aria-label="${T(title)}"${extra}>${l}</button>`;
    kur.innerHTML = `<div class="kbar" role="toolbar" aria-label="${T("أدوات الكراسة")}">
        <div class="kgrp">${tb("pen", "✍️", "قلم")}${tb("hl", "🖍️", "هايلايتر")}${tb("erase", "🧽", "ممحاة")}${tb("type", "⌨️", "كتابة بالكيبورد")}</div>
        <div class="kgrp kcol">${COLORS.map(([c, n]) => `<button type="button" class="kdot" data-color="${c}" style="--c:${c}" title="${T(n)}" aria-label="${T(n)}"></button>`).join("")}<label class="kdot kpick" title="${T("اختار أي لون")}"><input type="color" id="kPick" aria-label="${T("اختار أي لون")}"></label></div>
        <div class="kgrp ksz">${SIZES.map(([s, n]) => `<button type="button" class="ksize" data-size="${s}" title="${T(n)}" aria-label="${T(n)}"><i style="width:${s * 2 + 2}px;height:${s * 2 + 2}px"></i></button>`).join("")}</div>
        <div class="kgrp"><button type="button" class="ktool" id="kUndo" title="${T("تراجع")}" aria-label="${T("تراجع")}">↶</button><button type="button" class="ktool" id="kRedo" title="${T("إعادة")}" aria-label="${T("إعادة")}">↷</button></div>
      </div>
      <div class="kbar knav"><button type="button" class="ktool" id="kPrev" title="${T("الصفحة اللي قبلها")}" aria-label="${T("الصفحة اللي قبلها")}">›</button><span id="kNum" class="knum"></span><button type="button" class="ktool" id="kNext" title="${T("الصفحة اللي بعدها")}" aria-label="${T("الصفحة اللي بعدها")}">‹</button>
        <input id="kTitle" class="ktitle" maxlength="120" aria-label="${T("عنوان الصفحة")}"><small id="kState" class="kstate"></small>
        <button type="button" class="ktool" id="kPaperBtn" title="${T("لون الورقة")}" aria-label="${T("لون الورقة")}" aria-haspopup="true"><i class="kpchip"></i></button>
        <div id="kPaperMenu" class="kmenu kpmenu" hidden><b>${T("لون الورقة")}</b><div class="kpgrid">${PAPERS.map(([c, n]) => `<button type="button" class="kpsw${c === "auto" ? " kauto" : ""}" data-paper="${c}" style="--p:${c === "auto" ? "transparent" : c}" title="${T(n)}" aria-label="${T(n)}">${c === "auto" ? "A" : ""}</button>`).join("")}<label class="kpsw kpick" title="${T("اختار أي لون")}"><input type="color" id="kPaperPick" aria-label="${T("لون ورقة تاني")}"></label></div>
          <label class="kchk"><input type="checkbox" id="kPaperAll"> ${T("طبّقه على كل الصفحات")}</label></div>
        <button type="button" class="ktool" id="kAdd" title="${T("صفحة جديدة")}" aria-label="${T("صفحة جديدة")}">＋</button><button type="button" class="ktool" id="kSave" title="${T("احفظ الكراسة PDF")}" aria-label="${T("احفظ الكراسة PDF")}" aria-haspopup="true">⬇️</button>
        <div id="kSaveMenu" class="kmenu" hidden><button type="button" data-save="one">📄 ${T("الصفحة دي بس (PDF)")}</button><button type="button" data-save="all">📚 ${T("كل صفحات الكراسة (PDF)")}</button></div>
        <button type="button" class="ktool" id="kMore" title="${T("مسح")}" aria-label="${T("مسح")}" aria-haspopup="true">🗑️</button>
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
    const MENUS = [["kMore", "kMenu"], ["kPaperBtn", "kPaperMenu"], ["kSave", "kSaveMenu"]];
    for (const [b, m] of MENUS) $(b).onclick = e => { e.stopPropagation(); const was = $(m).hidden; for (const [, x] of MENUS) $(x).hidden = true; $(m).hidden = !was; };
    document.addEventListener("click", e => { if (!e.target.closest?.(MENUS.flat().map(x => "#" + x).join(","))) for (const [, x] of MENUS) { const el = $(x); if (el) el.hidden = true; } });
    $("kSaveMenu").onclick = e => { const b = e.target.closest("[data-save]"); if (!b) return; $("kSaveMenu").hidden = true; exportPdf(b.dataset.save === "all"); };
    $("kPick").addEventListener("input", e => { COLOR = e.target.value; ls.set("kur.color", COLOR); if (TOOL === "erase") TOOL = "pen"; if (TOOL === "type" && document.activeElement === ed) document.execCommand("foreColor", false, COLOR); tools(); });
    const setPaper = async c => { const pg = page(); if (!pg) return; ls.set("kur.paper", c);
      const targets = $("kPaperAll").checked ? PAGES : [pg]; for (const x of targets) x.paper = c === "auto" ? "" : c;
      paperLook(); lines(); dirty = true; if (targets.length > 1) { const all = (await idbGet("nb")) || []; for (const x of all) if (targets.some(t => t.id === x.id)) x.paper = c === "auto" ? "" : c; await window.idbSet("nb", all); }
      later(); };
    $("kPaperMenu").addEventListener("click", e => { const b = e.target.closest("[data-paper]"); if (b) setPaper(b.dataset.paper); });
    $("kPaperPick").addEventListener("input", e => setPaper(e.target.value));
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
    const pk = kur.querySelector(".kcol .kpick"), custom = !COLORS.some(([c]) => c === COLOR); pk.classList.toggle("on", custom); pk.style.setProperty("--c", custom ? COLOR : "transparent"); $("kPick").value = /^#[0-9a-f]{6}$/i.test(COLOR) ? COLOR : "#000000";
    kur.querySelectorAll("[data-size]").forEach(b => b.classList.toggle("on", +b.dataset.size === SIZE));
    paper.style.setProperty("--kcur", cursor());
    const typing = TOOL === "type"; ed.contentEditable = typing ? "true" : "false"; paper.classList.toggle("typing", typing); paper.dataset.tool = TOOL;
    if (typing) { ed.focus(); }
  }
  async function go(d) { const i = PAGES.findIndex(p => p.id === CUR), n = i + d; if (n < 0 || n >= PAGES.length) return; await K.flush(); CUR = PAGES[n].id; open(); }
  function open() {
    const pg = page(); if (!pg) return; undo = []; redo = [];
    ed.innerHTML = clean(pg.html); $("kTitle").value = pg.title || ""; $("kState").textContent = "";
    const i = PAGES.findIndex(p => p.id === CUR); $("kNum").textContent = `${(i + 1).toLocaleString("ar-EG")} / ${PAGES.length.toLocaleString("ar-EG")}`;
    $("kPrev").disabled = i <= 0; $("kNext").disabled = i >= PAGES.length - 1;
    H = Math.max(MINH, pg.h || 0); ls.set("kur.page", CUR); paperLook(); tools(); layout(); grow(); $("kScroll").scrollTop = 0;
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
  // ألوان الورقة: لون ثابت → السطور والهامش ولون الكتابة بيتحسبوا منه (ورقة غامقة = سطور فاتحة وكتابة بيضا)
  const hexRgb = h => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ""); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16, n >> 8 & 255, n & 255]; };
  const mix = (a, b, t) => "#" + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, "0")).join("");
  const lum = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  function paperLook() {
    const pg = page(), c = hexRgb(pg?.paper), st = paper.style;
    for (const v of ["--kpaper", "--kline", "--kmargin", "--kink"]) st.removeProperty(v);
    if (c) { const dark = lum(c) < 0.45; st.setProperty("--kpaper", pg.paper); st.setProperty("--kline", dark ? mix(c, [255, 255, 255], .2) : mix(c, [59, 111, 208], .22));
      st.setProperty("--kmargin", dark ? "#d27a7a" : "#e57373"); st.setProperty("--kink", dark ? "#f2f4fa" : "#1d2a5b"); }
    paper.classList.toggle("kdark", c ? lum(c) < 0.45 : false);
    kur.querySelectorAll("[data-paper]").forEach(b => b.classList.toggle("on", (b.dataset.paper === "auto" && !c) || b.dataset.paper === pg?.paper));
    const pp = kur.querySelector(".kpgrid .kpick"), custom = c && !PAPERS.some(([x]) => x === pg.paper); pp.classList.toggle("on", !!custom); pp.style.setProperty("--c", custom ? pg.paper : "transparent");
    if (c) $("kPaperPick").value = pg.paper;
    $("kPaperBtn").querySelector(".kpchip").style.background = c ? pg.paper : "var(--kpaper)";
  }
  // السطور والهامش مترسومين على canvas (مش CSS) عشان المسافات تفضل متساوية بالظبط مع أي تكبير
  function lines(k = Math.min(3, (devicePixelRatio || 1) * scale)) {
    const bg = $("kBg"); if (!bg) return; bg.width = cv.width; bg.height = cv.height; bg.style.width = W + "px"; bg.style.height = H + "px";
    paintBg(bg.getContext("2d"), k);
  }
  function paintBg(g, k) {
    const cs = getComputedStyle(paper); g.setTransform(k, 0, 0, k, 0, 0);
    g.fillStyle = cs.getPropertyValue("--kpaper").trim() || "#fffefa"; g.fillRect(0, 0, W, H);
    g.fillStyle = cs.getPropertyValue("--kline").trim() || "#c9d7ee"; const t = 1 / k * Math.max(1, Math.round(k));
    for (let y = TOP + LH; y < H - 8; y += LH) g.fillRect(0, y - t, W, t);
    g.fillStyle = cs.getPropertyValue("--kmargin").trim() || "#e57373"; g.fillRect(W - 88, 0, 2 / Math.max(1, k / 2), H);
  }
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => built && lines());
  new MutationObserver(() => built && lines()).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  function path(p, g = ctx) {
    g.beginPath(); g.moveTo(p[0], p[1]);
    if (p.length === 2) { g.lineTo(p[0] + .1, p[1] + .1); return; }
    for (let i = 2; i < p.length - 2; i += 2) { const mx = (p[i] + p[i + 2]) / 2, my = (p[i + 1] + p[i + 3]) / 2; g.quadraticCurveTo(p[i], p[i + 1], mx, my); }
    g.lineTo(p[p.length - 2], p[p.length - 1]);
  }
  function paintInk(g, passes = ["hl", "pen"]) {
    const ink = page()?.ink || []; g.lineCap = "round"; g.lineJoin = "round";
    for (const pass of passes) for (const s of ink) { if ((s.t === "hl") !== (pass === "hl")) continue;
      g.globalAlpha = s.t === "hl" ? .32 : 1; g.strokeStyle = s.c; g.lineWidth = s.w; path(s.p, g); g.stroke(); }
    g.globalAlpha = 1;
  }
  function draw() { if (!ctx) return; ctx.clearRect(0, 0, W, H); paintInk(ctx); }

  // ---------- مؤشر الماوس: قلم بلون القلم الحالي (بدل علامة +)، وهايلايتر، ودايرة للممحاة ----------
  const svgCur = (svg, x, y, fb) => `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${x} ${y}, ${fb}`;
  function cursor() {
    if (TOOL === "erase") return svgCur(`<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><circle cx="14" cy="14" r="12" fill="rgba(255,255,255,.55)" stroke="#333" stroke-width="1.5"/></svg>`, 14, 14, "cell");
    if (TOOL === "hl") return svgCur(`<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><path d="M4 24l2-6L18 6l4 4-12 12z" fill="#ffd600" stroke="#333" stroke-width="1.4" stroke-linejoin="round"/><path d="M4 24l2-6 4 4z" fill="#b38f00" stroke="#333" stroke-width="1.2" stroke-linejoin="round"/></svg>`, 4, 24, "pointer");
    const c = /^#[0-9a-f]{6}$/i.test(COLOR) ? COLOR : "#1d2a5b";
    return svgCur(`<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><path d="M3.5 24.5l1.4-5.3L19 5.1a2.3 2.3 0 0 1 3.2 0l.7.7a2.3 2.3 0 0 1 0 3.2L8.8 23.1z" fill="${c}" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"/><path d="M3.5 24.5l1.4-5.3L19 5.1a2.3 2.3 0 0 1 3.2 0l.7.7a2.3 2.3 0 0 1 0 3.2L8.8 23.1z" fill="${c}" stroke="#222" stroke-width="1.1" stroke-linejoin="round"/><path d="M3.5 24.5l1.4-5.3 3.9 3.9z" fill="#f1d3a6" stroke="#222" stroke-width="1" stroke-linejoin="round"/><path d="M3.5 24.5l.6-2.3 1.7 1.7z" fill="#222"/></svg>`, 3, 25, "crosshair");
  }

  // ---------- حفظ الكراسة PDF: كل صفحة بتترسم صورة (الورقة + الكتابة + القلم) وتتحط في ملف PDF بمقاس الورقة ----------
  // الكتابة بتترسم كلمة كلمة في نفس مكانها على الشاشة، عشان العربي والسطور يطلعوا زي ما إنت شايفهم بالظبط.
  function paintText(g) {
    const pr = paper.getBoundingClientRect(), sc = pr.width / W, R = document.createRange();
    const box = r => ({ x: (r.left - pr.left) / sc, y: (r.top - pr.top) / sc, w: r.width / sc, h: r.height / sc });
    for (const el of ed.querySelectorAll("*")) { const bg = getComputedStyle(el).backgroundColor; if (bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) { g.fillStyle = bg; for (const r of el.getClientRects()) { const b = box(r); g.fillRect(b.x, b.y, b.w, b.h); } } }
    const tw = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      const cs = getComputedStyle(n.parentElement); g.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; g.fillStyle = cs.color;
      g.textAlign = "center"; g.textBaseline = "middle";
      const re = /\S+/g; let m;
      while ((m = re.exec(n.data))) {
        R.setStart(n, m.index); R.setEnd(n, m.index + m[0].length); const rs = [...R.getClientRects()].filter(r => r.width > 0);
        if (!rs.length) continue;
        if (rs.length === 1) { const b = box(rs[0]); g.direction = /[\u0590-\u08FF]/.test(m[0]) ? "rtl" : "ltr"; g.fillText(m[0], b.x + b.w / 2, b.y + b.h / 2); continue; }
        for (let i = 0; i < m[0].length; i++) { R.setStart(n, m.index + i); R.setEnd(n, m.index + i + 1); const r = R.getClientRects()[0]; if (!r) continue; const b = box(r); g.fillText(m[0][i], b.x + b.w / 2, b.y + b.h / 2); }
      }
    }
  }
  function renderPage(R = 2) {
    const c = document.createElement("canvas"); c.width = W * R; c.height = H * R; const g = c.getContext("2d");
    paintBg(g, R); g.setTransform(R, 0, 0, R, 0, 0); paintInk(g, ["hl"]); paintText(g); paintInk(g, ["pen"]);
    return c;
  }
  const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  let exporting = false;
  async function exportPdf(all) {
    if (exporting) return; exporting = true; const keep = CUR, st = $("kState");
    try {
      await K.flush(); st.textContent = T("بنجهّز الـ PDF…");
      if (!window.PDFLib) await loadScript("lib/pdf-lib.min.js").catch(() => loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js"));
      await document.fonts?.ready;
      const pdf = await PDFLib.PDFDocument.create(), list = all ? PAGES.slice() : [page()];
      for (const pg of list) {
        if (CUR !== pg.id) { CUR = pg.id; open(); } await frame();
        const c = renderPage(), png = await pdf.embedPng(await new Promise(r => c.toBlob(b => b.arrayBuffer().then(r), "image/png")));
        const w = W * .75, h = H * .75, p = pdf.addPage([w, h]); p.drawImage(png, { x: 0, y: 0, width: w, height: h });
      }
      pdf.setTitle(all ? T("الكراسة") : (list[0]?.title || T("الكراسة"))); pdf.setCreator("AskMyBook");
      const bytes = await pdf.save(), blob = new Blob([bytes], { type: "application/pdf" });
      const name = (all ? T("الكراسة") + " " + new Date().toLocaleDateString("en-CA") : (list[0]?.title || T("الكراسة"))).replace(/[\\/:*?"<>|]+/g, " ").trim() + ".pdf";
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
      K.lastPdf = { name, pages: list.length, size: blob.size };
      if (CUR !== keep) { CUR = keep; open(); }
      $("kState").textContent = "✓ " + T("اتحفظ PDF"); toast(`✅ ${T("اتحفظت الكراسة PDF")} (${list.length.toLocaleString("ar-EG")} ${T("صفحة")})`);
    } catch (e) { if (CUR !== keep) { CUR = keep; open(); } $("kState").textContent = ""; toast("⚠️ " + T("مقدرتش أعمل الـ PDF: ") + (e?.message || e)); }
    finally { exporting = false; }
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
  K._render = () => renderPage();
  window.KURASA = K;
  apply();
  if (mob() && MODE === "kur" && $("app").className === "show-chat") oShow("kur");
})();

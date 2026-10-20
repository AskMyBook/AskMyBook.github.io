// ===== تنظيم الشاشة + الكراسة =====
// الشاشة فيها مكانين: الرئيسي (الكتاب PDF، أو الكراسة، أو فيديو) والجانبي (المساعد، أو الكراسة، أو فيديو).
//  • شريط فوق (جنب أسماء الكتب): «📓 الكراسة» وأي فيديو مفتوح — تدوس عليه يتحط في المكان الرئيسي مكان الكتاب.
//  • اللوحة الجانبية: تختار المساعد/الكراسة/الفيديو، تكبّرها أو تصغّرها بالسحب، تكبّرها على الشاشة كلها، أو تقفلها.
//  • المساعد ممكن يتفتح «فوق» في شباك عايم (زرار 🤖 في الهيدر) وإنت فاتح الكراسة والكتاب مع بعض.
// الكراسة: صفحات مسطّرة ورا بعض (تنزل لتحت تلاقي الصفحة اللي بعدها)، قلم/هايلايتر/ممحاة/كتابة/صور من الكتاب،
// وصفحاتها هي نفس صفحات «📓 النوت بوك» في مركز المذاكرة (مفتاح «nb») وبتتزامن مع الحساب.
(() => {
  const W = 800, LH = 40, TOP = 40, MINH = 1440;
  const COLORS = [["#111111", "أسود"], ["#ffffff", "أبيض"], ["#1d2a5b", "أزرق غامق"], ["#1565c0", "أزرق"], ["#c62828", "أحمر"], ["#2e7d32", "أخضر"]];
  const PAPERS = [["auto", "تلقائي"], ["#fffefa", "كريمي"], ["#ffffff", "أبيض"], ["#fff6cc", "أصفر"], ["#e6f1ff", "أزرق فاتح"], ["#e7f6e7", "أخضر فاتح"], ["#fde9f0", "وردي"], ["#2b303b", "رمادي غامق"], ["#111111", "أسود"]];
  const SIZES = [[2, "رفيع"], [3.5, "متوسط"], [6, "تخين"]];
  const T = s => window.I18N?.t(s) || s;
  const ls = { get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
  const mob = () => matchMedia("(max-width:800px)").matches;
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const clean = h => (window.STUDY?.nbClean ? STUDY.nbClean(h) : esc(String(h || "").replace(/<[^>]*>/g, "")));
  const ico = b => `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${b}</svg>`;
  const ytId = u => { u = String(u || "").trim(); if (/^[\w-]{11}$/.test(u)) return u; const m = /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/|v\/))([\w-]{11})/.exec(u); return m ? m[1] : ""; };

  // =====================================================================
  //  ١) تنظيم الشاشة
  // =====================================================================
  const side = $("side"), viewer = $("viewer"), app = $("app"), body = document.body;
  let MAIN = ls.get("lay.main", "pdf"), SIDE = ls.get("side.mode", "chat"), OFF = ls.get("side.off", "0") === "1", MAX = false, AIF = false;
  if (!/^(pdf|kur)$/.test(MAIN)) MAIN = "pdf"; if (!/^(chat|kur)$/.test(SIDE)) SIDE = "chat";
  if (MAIN === "kur" && SIDE === "kur") SIDE = "chat";
  let VIDS = [], VCUR = "";   // الفيديوهات المفتوحة [{id,title}]، والفيديو اللي في الشاشة

  // --- شريط فوق: الكتب + «📓 الكراسة» + الفيديوهات المفتوحة ---
  const books = $("books"), vbar = document.createElement("div"); vbar.id = "viewbar"; books.before(vbar); vbar.append(books);
  const views = document.createElement("div"); views.id = "views"; vbar.append(views);
  function drawViews() {
    views.innerHTML = `<button type="button" data-v="kur" class="${MAIN === "kur" ? "on" : ""}" title="${T("افتح الكراسة مكان الكتاب")}">📓 ${T("الكراسة")}</button>`
      + VIDS.map(v => `<button type="button" data-v="vid" data-id="${esc(v.id)}" class="vchip${MAIN === "vid" && VCUR === v.id ? " on" : ""}" title="${esc(v.title || "")}">🎬 <span>${esc((v.title || T("فيديو")).slice(0, 28))}</span><span class="bx" data-x="${esc(v.id)}" title="${T("اقفل الفيديو")}">✕</span></button>`).join("");
    books.querySelectorAll("button").forEach(b => { if (MAIN !== "pdf") b.classList.remove("on"); else b.classList.toggle("on", b.dataset.id === (typeof cur !== "undefined" ? cur.id : "")); });
  }
  views.onclick = e => {
    const x = e.target.closest("[data-x]"); if (x) { e.stopPropagation(); closeVideo(x.dataset.x); return; }
    const b = e.target.closest("[data-v]"); if (!b) return;
    if (b.dataset.v === "kur") setMain(MAIN === "kur" ? "pdf" : "kur"); else { VCUR = b.dataset.id; setMain("vid"); }
  };
  // الضغط على اسم كتاب فوق = الكتاب يرجع في المكان الرئيسي
  books.addEventListener("click", e => { if (e.target.closest("button") && !e.target.dataset?.del && MAIN !== "pdf") setMain("pdf"); }, true);

  // --- اللوحة الجانبية: راس فيها الاختيارات + تكبير + قفل ---
  const head = document.createElement("div"); head.className = "sidehead";
  head.innerHTML = `<div class="seg" role="tablist"><button type="button" role="tab" data-sm="chat">🤖 ${T("المساعد")}</button><button type="button" role="tab" data-sm="kur">📓 ${T("الكراسة")}</button><button type="button" role="tab" data-sm="vid" hidden>🎬 ${T("فيديو")}</button></div>
    <button type="button" class="icon" id="sideMax" title="${T("كبّر على الشاشة كلها")}" aria-label="${T("كبّر على الشاشة كلها")}">${ico('<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>')}</button>
    <button type="button" class="icon" id="sideClose" title="${T("اقفل اللوحة الجانبية")}" aria-label="${T("اقفل اللوحة الجانبية")}">${ico('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>')}</button>`;
  side.prepend(head);
  const kur = document.createElement("div"); kur.id = "kur"; kur.className = "pane";
  const vid = document.createElement("div"); vid.id = "vidPane"; vid.className = "pane";
  side.append(kur, vid);
  // --- خط السحب بين الكتاب واللوحة (تكبير/تصغير اللوحة) ---
  const split = document.createElement("div"); split.id = "split"; split.setAttribute("role", "separator"); split.setAttribute("aria-orientation", "vertical"); split.title = T("اسحب عشان تكبّر أو تصغّر"); split.tabIndex = 0;
  side.before(split);
  const sw = +ls.get("side.w", "0"); if (sw > 0) side.style.setProperty("--sidew", sw + "px");
  (() => { let d = null;
    split.addEventListener("pointerdown", e => { d = { x: e.clientX, w: side.getBoundingClientRect().width }; split.setPointerCapture(e.pointerId); body.classList.add("resizing"); });
    split.addEventListener("pointermove", e => { if (!d) return; const rtl = getComputedStyle(app).direction === "rtl", dx = e.clientX - d.x, max = app.clientWidth - 260;
      const w = Math.round(Math.max(300, Math.min(max, d.w + (rtl ? dx : -dx)))); side.style.setProperty("--sidew", w + "px"); });
    const end = () => { if (!d) return; d = null; body.classList.remove("resizing"); ls.set("side.w", String(parseInt(side.style.getPropertyValue("--sidew")) || 0)); window.dispatchEvent(new Event("resize")); };
    split.addEventListener("pointerup", end); split.addEventListener("pointercancel", end);
    split.addEventListener("keydown", e => { if (!/Arrow(Left|Right)/.test(e.key)) return; const w = side.getBoundingClientRect().width + (e.key === "ArrowLeft" ? 40 : -40); side.style.setProperty("--sidew", Math.max(300, w) + "px"); ls.set("side.w", String(Math.round(Math.max(300, w)))); });
    split.addEventListener("dblclick", () => { side.style.removeProperty("--sidew"); ls.set("side.w", "0"); });
  })();

  // --- زرارين في الهيدر: اللوحة الجانبية، والمساعد العايم ---
  const sb = document.createElement("button"); sb.type = "button"; sb.id = "sideBtn"; sb.className = "icon"; sb.innerHTML = ico('<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/>');
  const ab = document.createElement("button"); ab.type = "button"; ab.id = "aiBtn"; ab.className = "icon"; ab.title = ab.ariaLabel = T("افتح المساعد فوق الشاشة");
  ab.innerHTML = ico('<rect x="4" y="7" width="16" height="12" rx="3"/><line x1="12" y1="3" x2="12" y2="7"/><circle cx="9" cy="13" r="1.2" fill="currentColor"/><circle cx="15" cy="13" r="1.2" fill="currentColor"/>');
  document.querySelector("header .hbtns")?.prepend(ab, sb);

  // --- المساعد العايم ---
  const flo = document.createElement("section"); flo.id = "aiFloat"; flo.hidden = true; flo.setAttribute("aria-label", T("المساعد"));
  flo.innerHTML = `<div class="afhead"><b>🤖 ${T("المساعد")}</b><span class="grow"></span><button type="button" class="icon" id="aiDock" title="${T("رجّعه في اللوحة الجانبية")}" aria-label="${T("رجّعه في اللوحة الجانبية")}">${ico('<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/>')}</button><button type="button" class="icon" id="aiClose" title="${T("اقفل")}" aria-label="${T("اقفل")}">${ico('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>')}</button></div><div class="afbody"></div>`;
  document.body.append(flo);
  try { const p = JSON.parse(ls.get("ai.float", "null")); if (p) Object.assign(flo.style, { left: Math.min(p.l, innerWidth - 200) + "px", top: Math.min(p.t, innerHeight - 120) + "px", right: "auto", bottom: "auto", width: p.w + "px", height: p.h + "px" }); } catch {}
  (() => { let d = null; const hd = flo.querySelector(".afhead");
    hd.addEventListener("pointerdown", e => { if (e.target.closest("button") || mob()) return; const r = flo.getBoundingClientRect(); d = { x: e.clientX - r.left, y: e.clientY - r.top }; hd.setPointerCapture(e.pointerId); });
    hd.addEventListener("pointermove", e => { if (!d) return; flo.style.left = Math.max(0, Math.min(innerWidth - 120, e.clientX - d.x)) + "px"; flo.style.top = Math.max(0, Math.min(innerHeight - 60, e.clientY - d.y)) + "px"; flo.style.right = flo.style.bottom = "auto"; });
    const save = () => { d = null; const r = flo.getBoundingClientRect(); ls.set("ai.float", JSON.stringify({ l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) })); };
    hd.addEventListener("pointerup", save); new ResizeObserver(() => { if (!flo.hidden && !d) save(); }).observe(flo);
  })();
  const chatEls = () => [document.querySelector(".chathead"), $("chat"), $("toBottom"), $("form")].filter(Boolean);
  function placeChat() {
    const into = AIF ? flo.querySelector(".afbody") : side, els = chatEls();
    if (els[0] && els[0].parentElement !== into) { if (AIF) into.append(...els); else head.after(...els); }
  }

  // --- الرسم: مين فين ---
  function render() {
    if (MAIN === "vid" && !VIDS.some(v => v.id === VCUR)) MAIN = "pdf";
    if (SIDE === "vid" && !VIDS.length) SIDE = "chat";
    if (SIDE === MAIN) SIDE = "chat";   // نفس الحاجة مينفعش تبقى في المكانين
    placeChat();
    // المكان الرئيسي
    viewer.classList.toggle("alt", MAIN !== "pdf");
    const mainPane = MAIN === "kur" ? kur : MAIN === "vid" ? vid : null;
    // الفيديو: لو هيستخبى أو هيتنقل، نشيل الـ iframe الأول (تحريكه في الصفحة بيعيد تشغيله لوحده) ونرجّعه في نفس الثانية بعدين
    const vidTo = MAIN === "vid" ? viewer : SIDE === "vid" ? side : null;
    if (vid.querySelector("iframe") && vidTo !== vid.parentElement) dropFrame();
    if (mainPane && mainPane.parentElement !== viewer) viewer.append(mainPane);
    // الجانبي
    const sidePane = SIDE === "kur" ? kur : SIDE === "vid" ? vid : null;
    if (sidePane && sidePane !== mainPane && sidePane.parentElement !== side) side.append(sidePane);
    [kur, vid].forEach(p => { const on = p === mainPane || p === sidePane; p.classList.toggle("show", on); if (!on && p === kur && p.parentElement !== side) side.append(p); });
    const sideChat = SIDE === "chat" && !AIF;
    body.classList.toggle("side-chat", sideChat);
    body.classList.toggle("side-off", OFF || (SIDE === "chat" && AIF && !mob()));
    body.classList.toggle("side-max", MAX && !OFF);
    body.classList.toggle("ai-float", AIF);
    flo.hidden = !AIF;
    head.querySelectorAll("[data-sm]").forEach(b => { const on = b.dataset.sm === SIDE; b.classList.toggle("on", on); b.setAttribute("aria-selected", String(on));
      if (b.dataset.sm === "vid") b.hidden = !VIDS.length || MAIN === "vid";
      if (b.dataset.sm === "kur") b.hidden = MAIN === "kur"; if (b.dataset.sm === "chat") b.hidden = AIF; });
    $("sideMax").title = $("sideMax").ariaLabel = MAX ? T("رجّعها جنب الكتاب") : T("كبّر على الشاشة كلها"); $("sideMax").classList.toggle("on", MAX);
    sb.title = sb.ariaLabel = OFF ? T("افتح اللوحة الجانبية") : T("اقفل اللوحة الجانبية"); sb.classList.toggle("on", !OFF);
    ab.classList.toggle("on", AIF);
    ls.set("side.mode", SIDE === "vid" ? "chat" : SIDE); ls.set("side.off", OFF ? "1" : "0"); ls.set("lay.main", MAIN === "vid" ? "pdf" : MAIN);
    drawViews(); drawVideo();
    if (kur.classList.contains("show")) K.show(); else K.flush();
    requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
  }
  const setMain = m => { MAIN = m; if (m === "kur" && SIDE === "kur") SIDE = "chat"; if (mob()) oShow("book"); render(); };
  const setSide = m => { SIDE = m; OFF = false; if (m === "chat" && AIF) AIF = false; if (m === MAIN) MAIN = "pdf"; render(); };
  const openAI = () => { if (AIF) { flo.hidden = false; return; } if (mob()) { setSide("chat"); oShow("chat"); return; } if (SIDE !== "chat" || OFF) setSide("chat"); };
  head.onclick = e => { const b = e.target.closest("[data-sm]"); if (b) { setSide(b.dataset.sm); if (mob()) oShow(b.dataset.sm === "chat" ? "chat" : "kur"); } };
  $("sideClose").onclick = () => { OFF = true; MAX = false; render(); };
  $("sideMax").onclick = () => { MAX = !MAX; render(); };
  sb.onclick = () => { OFF = !OFF; if (OFF) MAX = false; render(); };
  ab.onclick = () => { AIF = !AIF; if (AIF && SIDE === "chat") SIDE = MAIN === "kur" ? (VIDS.length && MAIN !== "vid" ? "vid" : "chat") : "kur"; if (AIF && SIDE === "chat") OFF = true; else if (AIF) OFF = false; render(); if (AIF) $("q")?.focus(); };
  $("aiClose").onclick = () => { AIF = false; render(); };
  $("aiDock").onclick = () => { AIF = false; SIDE = "chat"; OFF = false; render(); };

  // --- الموبايل: تاب «الكراسة» جنب «الكتاب» و«المساعد» ---
  const tabs = $("tabs"), kt = document.createElement("button"); kt.type = "button"; kt.dataset.t = "kur";
  kt.innerHTML = ico('<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>') + " " + T("الكراسة"); tabs?.append(kt);
  const oShow = window.showTab;
  // أي حاجة في الموقع بتفتح المساعد (اشرح، حل، ذاكر مع الـ AI…) بتوريه: في الشباك العايم لو مفتوح، وإلا في اللوحة الجانبية
  window.showTab = t => { if (t === "chat") { if (AIF && !mob()) { flo.hidden = false; return; } SIDE = "chat"; OFF = false; AIF = false; render(); }
    if (t === "kur") { if (MAIN === "kur") MAIN = "pdf"; SIDE = "kur"; OFF = false; render(); } oShow(t); };
  kt.onclick = () => showTab("kur");
  tabs?.querySelector('[data-t="chat"]')?.addEventListener("click", () => { AIF = false; SIDE = "chat"; render(); });
  tabs?.querySelector('[data-t="book"]')?.addEventListener("click", () => { if (MAIN !== "pdf") { MAIN = "pdf"; render(); } });
  // رد جديد بسبب حاجة الطالب داسها → المساعد يظهر (مش رسايل الترحيب وقت الفتح)
  let act = 0; document.addEventListener("pointerdown", e => { if (!e.target.closest?.("#kur,.sidehead,#views")) act = Date.now(); }, true);
  document.addEventListener("keydown", e => { if (!e.target.closest?.("#kur")) act = Date.now(); }, true);
  new MutationObserver(ms => { if (Date.now() - act < 4000 && ms.some(m => [...m.addedNodes].some(n => n.classList?.contains("m"))) && !(AIF ? !flo.hidden : SIDE === "chat" && !OFF)) openAI(); })
    .observe($("chat"), { childList: true });
  // فتح كتاب = الكتاب يرجع في المكان الرئيسي
  // (بعد ما الموقع يفتح: الكتاب اللي بيتفتح لوحده وقت التحميل مايشيلش الكراسة من مكانها)
  let booted = false; setTimeout(() => { booted = true; }, 2500);
  if (typeof window.openBook === "function") { const oOpen = window.openBook; window.openBook = (...a) => { if (booted && MAIN !== "pdf") { MAIN = "pdf"; render(); } return oOpen(...a); }; }

  // =====================================================================
  //  ٢) الفيديو جوه الموقع
  // =====================================================================
  // حالة كل فيديو (الثانية اللي وقف عندها، وكان شغال ولا لأ) من رسايل مشغّل يوتيوب نفسه (enablejsapi)
  const VST = {};
  const ytSrc = (id, start, auto) => `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?enablejsapi=1&rel=0&playsinline=1&autoplay=${auto ? 1 : 0}${start > 1 ? "&start=" + Math.floor(start) : ""}&origin=${encodeURIComponent(location.origin)}`;
  const frame = () => vid.querySelector("iframe");
  const cmd = (func, args = []) => { try { frame()?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "*"); } catch {} };
  window.addEventListener("message", e => {
    if (!/youtube(-nocookie)?\.com$/.test(new URL(e.origin || "http://x").hostname)) return; let d; try { d = typeof e.data === "string" ? JSON.parse(e.data) : e.data; } catch { return; }
    const f = frame(); if (!f || e.source !== f.contentWindow) return; const st = VST[vid._id] ||= { t: 0, playing: true };
    if (d?.info) { if (typeof d.info.currentTime === "number") st.t = d.info.currentTime; if (typeof d.info.playerState === "number") st.playing = d.info.playerState === 1 || d.info.playerState === 3; }
  });
  function dropFrame() { const f = frame(); if (!f) return; cmd("pauseVideo"); f.remove(); }
  function drawVideo() {
    const v = VIDS.find(x => x.id === VCUR) || VIDS[0]; if (!v) { vid.innerHTML = ""; vid._id = ""; return; }
    VCUR = v.id; const where = vid.parentElement === viewer ? "main" : "side", shown = vid.classList.contains("show");
    if (vid._id !== v.id || !vid.querySelector(".vpframe")) { dropFrame(); vid._id = v.id;
      vid.innerHTML = `<div class="vphead"><b class="grow" title="${esc(v.title || "")}">🎬 ${esc(v.title || T("فيديو يوتيوب"))}</b><button type="button" class="ghost" data-vp="move"></button><a href="https://www.youtube.com/watch?v=${esc(v.id)}" target="_blank" rel="noopener" class="ghost vplink">YouTube ↗</a><button type="button" class="icon" data-vp="close" title="${T("اقفل الفيديو")}" aria-label="${T("اقفل الفيديو")}">${ico('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>')}</button></div><div class="vpframe"></div>`; }
    if (!shown) { dropFrame(); return; }   // مستخبي = مفيش iframe خالص، فمستحيل يشتغل لوحده
    if (!frame()) { const st = VST[v.id], f = document.createElement("iframe");
      f.src = ytSrc(v.id, st?.t || 0, st ? st.playing : true); f.title = v.title || "YouTube"; f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen"; f.allowFullscreen = true;
      f.addEventListener("load", () => { try { f.contentWindow.postMessage(JSON.stringify({ event: "listening", id: "kv", channel: "widget" }), "*"); } catch {} });
      vid.querySelector(".vpframe").append(f); VST[v.id] ||= { t: 0, playing: true }; }
    vid.querySelector('[data-vp="move"]').textContent = where === "main" ? "⇥ " + T("حطه في اللوحة الجانبية") : "⇤ " + T("حطه مكان الكتاب");
  }
  vid.onclick = e => { const b = e.target.closest("[data-vp]"); if (!b) return;
    if (b.dataset.vp === "close") closeVideo(VCUR);
    else if (vid.parentElement === viewer) { MAIN = "pdf"; SIDE = "vid"; OFF = false; render(); } else { SIDE = "chat"; MAIN = "vid"; render(); } };
  function closeVideo(id) { if (vid._id === id) { dropFrame(); vid._id = ""; } delete VST[id]; VIDS = VIDS.filter(v => v.id !== id); if (VCUR === id) { VCUR = VIDS[0]?.id || ""; vid._id = ""; } if (!VIDS.length) { if (MAIN === "vid") MAIN = "pdf"; if (SIDE === "vid") SIDE = "chat"; } render(); }
  // where: "main" = مكان الكتاب، "side" = اللوحة الجانبية (مكان الكراسة/المساعد)
  function openVideo(v, where = "main") {
    if (!v?.id) return; if (!VIDS.some(x => x.id === v.id)) VIDS.push({ id: v.id, title: v.title || "" }); VCUR = v.id; vid._id = "";
    if (where === "side" && !mob()) { if (MAIN === "vid") MAIN = "pdf"; SIDE = "vid"; OFF = false; } else { MAIN = "vid"; if (SIDE === "vid") SIDE = "chat"; if (mob()) oShow("book"); }
    render();
  }

  // =====================================================================
  //  ٣) الكراسة: صفحات ورا بعض
  // =====================================================================
  const K = {}; let PAGES = [], VIEWS = new Map(), CUR = "", TOOL = ls.get("kur.tool", "pen"), COLOR = ls.get("kur.color", COLORS[0][0]), SIZE = +ls.get("kur.size", SIZES[1][0]) || SIZES[1][0];
  let built = false, loaded = false, scale = 1, saveT = 0, dirty = new Set(), undo = [], redo = [], penSeen = false, io = null, selImg = null;
  const page = (id = CUR) => PAGES.find(p => p.id === id);
  const pvOf = id => VIEWS.get(id);
  async function load() { PAGES = ((await idbGet("nb")) || []).filter(p => p && !p.del); PAGES.sort((a, b) => (a.created || 0) - (b.created || 0)); loaded = true; }
  const emit = () => window.dispatchEvent(new CustomEvent("study-data", { detail: { key: "nb", from: "kur" } }));
  async function save() {
    clearTimeout(saveT); saveT = 0; if (!dirty.size) return; const ids = [...dirty]; dirty.clear();
    const all = (await idbGet("nb")) || [];
    for (const id of ids) { const pg = page(id), pv = pvOf(id); if (!pg) continue;
      if (pv) { pg.html = clean(pv.ed.innerHTML); pg.h = pv.H; }
      pg.paper = pg.paper || ""; pg.updated = Date.now();
      const i = all.findIndex(x => x.id === id); if (i >= 0) all[i] = { ...all[i], ...pg }; else all.push(pg); }
    await window.idbSet("nb", all); emit();
    const st = $("kState"); if (st) st.textContent = "✓ " + T("اتحفظ");
  }
  const later = (id = CUR) => { dirty.add(id); const st = $("kState"); if (st) st.textContent = T("بيتحفظ…"); clearTimeout(saveT); saveT = setTimeout(save, 600); };
  K.flush = () => dirty.size ? save() : Promise.resolve();
  addEventListener("pagehide", () => K.flush());
  async function newPage() {
    const n = PAGES.length + 1, b = (typeof cur !== "undefined" && cur.id) || $("book")?.value || "", lp = ls.get("kur.paper", "auto");
    const pg = { id: uid(), title: T("صفحة") + " " + n, html: "", ink: [], imgs: [], book: b, h: MINH, paper: lp === "auto" ? "" : lp, created: Date.now(), updated: Date.now() };
    PAGES.push(pg); const all = (await idbGet("nb")) || []; all.push(pg); await window.idbSet("nb", all); emit(); return pg;
  }

  // ----- الشريط -----
  function build() {
    built = true;
    const tb = (t, l, title) => `<button type="button" class="ktool" data-tool="${t}" title="${T(title)}" aria-label="${T(title)}">${l}</button>`;
    const btn = (id, l, title, x = "") => `<button type="button" class="ktool" id="${id}" title="${T(title)}" aria-label="${T(title)}"${x}>${l}</button>`;
    kur.innerHTML = `<div class="kbar" role="toolbar" aria-label="${T("أدوات الكراسة")}">
        <div class="kgrp">${tb("pen", "✍️", "قلم")}${tb("hl", "🖍️", "هايلايتر")}${tb("erase", "🧽", "ممحاة")}${tb("type", "⌨️", "كتابة بالكيبورد")}${tb("move", "✋", "حرّك الصور")}</div>
        <div class="kgrp kcol">${COLORS.map(([c, n]) => `<button type="button" class="kdot" data-color="${c}" style="--c:${c}" title="${T(n)}" aria-label="${T(n)}"></button>`).join("")}<label class="kdot kpick" title="${T("اختار أي لون")}"><input type="color" id="kPick" aria-label="${T("اختار أي لون")}"></label></div>
        <div class="kgrp ksz">${SIZES.map(([s, n]) => `<button type="button" class="ksize" data-size="${s}" title="${T(n)}" aria-label="${T(n)}"><i style="width:${s * 2 + 2}px;height:${s * 2 + 2}px"></i></button>`).join("")}</div>
        <div class="kgrp">${btn("kUndo", "↶", "تراجع")}${btn("kRedo", "↷", "إعادة")}</div>
      </div>
      <div class="kbar knav">${btn("kPrev", "›", "الصفحة اللي قبلها")}<span id="kNum" class="knum"></span>${btn("kNext", "‹", "الصفحة اللي بعدها")}
        <input id="kTitle" class="ktitle" maxlength="120" aria-label="${T("عنوان الصفحة")}"><small id="kState" class="kstate"></small>
        <button type="button" class="ktool kask" id="kAsk" title="${T("اسأل المساعد عن الصفحة دي")}">🤖 ${T("اسأل")}</button>
        ${btn("kPaperBtn", '<i class="kpchip"></i>', "لون الورقة", ' aria-haspopup="true"')}
        <div id="kPaperMenu" class="kmenu kpmenu" hidden><b>${T("لون الورقة")}</b><div class="kpgrid">${PAPERS.map(([c, n]) => `<button type="button" class="kpsw${c === "auto" ? " kauto" : ""}" data-paper="${c}" style="--p:${c === "auto" ? "transparent" : c}" title="${T(n)}" aria-label="${T(n)}">${c === "auto" ? "A" : ""}</button>`).join("")}<label class="kpsw kpick" title="${T("اختار أي لون")}"><input type="color" id="kPaperPick" aria-label="${T("لون ورقة تاني")}"></label></div>
          <label class="kchk"><input type="checkbox" id="kPaperAll"> ${T("طبّقه على كل الصفحات")}</label></div>
        ${btn("kSave", "⬇️", "احفظ الكراسة PDF", ' aria-haspopup="true"')}
        <div id="kSaveMenu" class="kmenu" hidden><button type="button" data-save="one">📄 ${T("الصفحة دي بس (PDF)")}</button><button type="button" data-save="all">📚 ${T("كل صفحات الكراسة (PDF)")}</button></div>
        ${btn("kMore", "🗑️", "مسح", ' aria-haspopup="true"')}
        <div id="kMenu" class="kmenu" hidden><button type="button" data-k="clearInk">${T("امسح رسم القلم في الصفحة دي")}</button><button type="button" data-k="clearAll">${T("فضّي الصفحة كلها")}</button><button type="button" data-k="delPage" class="kdanger">${T("امسح الصفحة نهائيًا")}</button></div>
      </div>
      <div class="kscroll" id="kScroll"><div class="kstack" id="kStack"></div><button type="button" class="kaddpage" id="kAddPage">＋ ${T("صفحة جديدة")}</button></div>`;
    kur.querySelector(".kbar").onclick = e => {
      const t = e.target.closest("[data-tool]"), c = e.target.closest("[data-color]"), s = e.target.closest("[data-size]");
      if (t) { TOOL = t.dataset.tool; ls.set("kur.tool", TOOL); }
      if (c) { COLOR = c.dataset.color; ls.set("kur.color", COLOR); if (TOOL === "type" && document.activeElement?.classList.contains("ked")) document.execCommand("foreColor", false, COLOR); else if (TOOL !== "pen" && TOOL !== "type") TOOL = "pen"; }
      if (s) { SIZE = +s.dataset.size; ls.set("kur.size", String(SIZE)); if (TOOL !== "pen") TOOL = "pen"; }
      if (t || c || s) tools();
    };
    $("kPick").addEventListener("input", e => { COLOR = e.target.value; ls.set("kur.color", COLOR); if (TOOL === "type" && document.activeElement?.classList.contains("ked")) document.execCommand("foreColor", false, COLOR); else if (TOOL !== "pen" && TOOL !== "type") TOOL = "pen"; tools(); });
    $("kUndo").onclick = () => step(undo, redo); $("kRedo").onclick = () => step(redo, undo);
    $("kPrev").onclick = () => go(-1); $("kNext").onclick = () => go(1);
    $("kAddPage").onclick = async () => { await K.flush(); const pg = await newPage(); mount(pg); counts(); scrollTo(pg.id); };
    $("kTitle").oninput = () => { const pg = page(); if (!pg) return; pg.title = $("kTitle").value.trim().slice(0, 120) || T("صفحة"); const l = pvOf(pg.id)?.el.querySelector(".klabel"); if (l) l.textContent = pg.title; later(); };
    $("kAsk").onclick = () => askAboutPage();
    const MENUS = [["kMore", "kMenu"], ["kPaperBtn", "kPaperMenu"], ["kSave", "kSaveMenu"]];
    for (const [b, m] of MENUS) $(b).onclick = e => { e.stopPropagation(); const was = $(m).hidden; for (const [, x] of MENUS) $(x).hidden = true; $(m).hidden = !was; };
    document.addEventListener("click", e => { if (!e.target.closest?.(MENUS.flat().map(x => "#" + x).join(","))) for (const [, x] of MENUS) { const el = $(x); if (el) el.hidden = true; } });
    $("kSaveMenu").onclick = e => { const b = e.target.closest("[data-save]"); if (!b) return; $("kSaveMenu").hidden = true; exportPdf(b.dataset.save === "all"); };
    $("kPaperMenu").addEventListener("click", e => { const b = e.target.closest("[data-paper]"); if (b) { setPaper(b.dataset.paper); $("kPaperMenu").hidden = true; } });
    $("kPaperPick").addEventListener("input", e => setPaper(e.target.value));
    $("kMenu").onclick = async e => {
      const k = e.target.closest("[data-k]")?.dataset.k, pg = page(), pv = pvOf(CUR); if (!k || !pg || !pv) return; $("kMenu").hidden = true;
      if (k === "clearInk") { snapshot(pg); pg.ink = []; draw(pv); later(); }
      else if (k === "clearAll") { snapshot(pg); pg.ink = []; pg.imgs = []; pv.ed.innerHTML = ""; drawImgs(pv); pv.H = MINH; layoutPage(pv); later(); }
      else if (k === "delPage") { if (!confirmIn(e.target)) return; dirty.delete(pg.id); const all = (await idbGet("nb")) || [], o = all.find(x => x.id === pg.id);
        if (o) { o.del = true; o.html = ""; o.ink = []; o.imgs = []; o.updated = Date.now(); await window.idbSet("nb", all); }
        const i = PAGES.indexOf(pg); PAGES.splice(i, 1); pv.el.remove(); VIEWS.delete(pg.id); if (!PAGES.length) mount(await newPage()); CUR = (PAGES[i] || PAGES[i - 1]).id; counts(); scrollTo(CUR); emit(); }
    };
    const sc = $("kScroll"); sc.addEventListener("scroll", () => { clearTimeout(sc._t); sc._t = setTimeout(track, 80); }, { passive: true });
    new ResizeObserver(() => layoutAll()).observe(sc);
    io = new IntersectionObserver(es => es.forEach(en => { const pv = [...VIEWS.values()].find(v => v.el === en.target); if (!pv) return; pv.vis = en.isIntersecting; if (pv.vis) paint(pv); else release(pv); }), { root: sc, rootMargin: "800px 0px" });
    document.addEventListener("keydown", e => { if (selImg && (e.key === "Delete" || e.key === "Backspace") && !e.target.closest?.("input,textarea,[contenteditable=true]")) { e.preventDefault(); delImg(selImg); } });
  }
  function confirmIn(b) { if (b.dataset.sure) return true; b.dataset.sure = "1"; const o = b.textContent; b.textContent = T("متأكد؟ دوس تاني"); $("kMenu").hidden = false; setTimeout(() => { b.textContent = o; delete b.dataset.sure; }, 3000); return false; }

  // ----- صفحة واحدة في الكومة -----
  function mount(pg) {
    const el = document.createElement("div"); el.className = "kpage"; el.dataset.id = pg.id;
    el.innerHTML = `<div class="klabel"></div><div class="kwrap"><div class="kpaper"><canvas class="kbg" aria-hidden="true"></canvas><div class="kimgs"></div><div class="ked" dir="auto" spellcheck="false" data-ph="${T("اكتب هنا…")}"></div><canvas class="kcv"></canvas></div></div>`;
    $("kStack").append(el);
    const pv = { pg, el, wrap: el.querySelector(".kwrap"), paper: el.querySelector(".kpaper"), bg: el.querySelector(".kbg"), cv: el.querySelector(".kcv"), ed: el.querySelector(".ked"), imgs: el.querySelector(".kimgs"), H: Math.max(MINH, pg.h || 0), k: 0, vis: false };
    pv.ctx = pv.cv.getContext("2d"); el.querySelector(".klabel").textContent = pg.title || ""; pv.ed.innerHTML = clean(pg.html); pv.ed.contentEditable = TOOL === "type" ? "true" : "false";
    VIEWS.set(pg.id, pv); look(pv); drawImgs(pv); layoutPage(pv); io?.observe(el);
    pv.ed.addEventListener("input", () => { CUR = pg.id; grow(pv); later(pg.id); });
    pv.ed.addEventListener("focus", () => { if (CUR !== pg.id) { CUR = pg.id; counts(); } });
    pv.ed.addEventListener("paste", e => { const h = e.clipboardData?.getData("text/html"), tx = e.clipboardData?.getData("text/plain"); if (!h && !tx) return; e.preventDefault(); document.execCommand("insertHTML", false, h ? clean(h) : esc(tx).replace(/\n/g, "<br>")); });
    pointer(pv); paperTool(pv);
    return pv;
  }
  function layoutAll() { if (!built || !kur.classList.contains("show")) return; const avail = $("kScroll").clientWidth - 28; scale = Math.max(.3, Math.min(1.3, avail / W)); VIEWS.forEach(layoutPage); }
  function layoutPage(pv) {
    pv.paper.style.height = pv.H + "px"; pv.paper.style.transform = `scale(${scale})`; pv.wrap.style.width = W * scale + "px"; pv.wrap.style.height = pv.H * scale + "px";
    pv.paper.dataset.tool = TOOL; pv.paper.classList.toggle("typing", TOOL === "type"); pv.paper.classList.toggle("moving", TOOL === "move");
    pv.k = 0; if (pv.vis) paint(pv);
  }
  function paint(pv) {   // الـ canvas بتتعمل بس للصفحات القريبة من الشاشة (عشان الذاكرة)
    const k = Math.min(2.5, (devicePixelRatio || 1) * scale); if (pv.k === k && pv.cv.width > 1) return; pv.k = k;
    for (const c of [pv.bg, pv.cv]) { c.width = Math.round(W * k); c.height = Math.round(pv.H * k); c.style.width = W + "px"; c.style.height = pv.H + "px"; }
    pv.ctx.setTransform(k, 0, 0, k, 0, 0); paintBg(pv.bg.getContext("2d"), k, pv); draw(pv);
  }
  function release(pv) { for (const c of [pv.bg, pv.cv]) { c.width = 1; c.height = 1; } pv.k = 0; }
  function grow(pv) {
    let need = MINH; const tx = pv.ed.scrollHeight + TOP + LH * 2; if (tx > need) need = tx;
    for (const s of pv.pg.ink || []) for (let j = 1; j < s.p.length; j += 2) if (s.p[j] + LH * 3 > need) need = s.p[j] + LH * 3;
    for (const im of pv.pg.imgs || []) if (im.y + im.h + LH * 2 > need) need = im.y + im.h + LH * 2;
    need = Math.ceil(need / LH) * LH; if (need !== pv.H) { pv.H = need; layoutPage(pv); }
  }
  // الصفحة اللي في نص الشاشة = الصفحة الحالية (العنوان والرقم ولون الورقة بتوعها)
  function track() {
    const sc = $("kScroll"), mid = sc.getBoundingClientRect().top + sc.clientHeight * .35; let best = null, bd = 1e9;
    VIEWS.forEach(pv => { const r = pv.el.getBoundingClientRect(), d = r.top <= mid && r.bottom >= mid ? 0 : Math.min(Math.abs(r.top - mid), Math.abs(r.bottom - mid)); if (d < bd) { bd = d; best = pv; } });
    if (best && best.pg.id !== CUR) { CUR = best.pg.id; ls.set("kur.page", CUR); counts(); }
  }
  function counts() {
    const i = PAGES.findIndex(p => p.id === CUR), pg = page(); if (!pg || !$("kNum")) return;
    $("kNum").textContent = `${(i + 1).toLocaleString("ar-EG")} / ${PAGES.length.toLocaleString("ar-EG")}`; $("kPrev").disabled = i <= 0; $("kNext").disabled = i >= PAGES.length - 1;
    if (document.activeElement !== $("kTitle")) $("kTitle").value = pg.title || ""; paperMenu();
  }
  function scrollTo(id, smooth = true) { const pv = pvOf(id); if (!pv) return; CUR = id; counts(); $("kScroll").scrollTo({ top: pv.el.offsetTop - 8, behavior: smooth && !matchMedia("(prefers-reduced-motion: reduce)").matches ? "smooth" : "auto" }); }
  async function go(d) { const i = PAGES.findIndex(p => p.id === CUR), n = i + d; if (n < 0 || n >= PAGES.length) return; await K.flush(); scrollTo(PAGES[n].id); }
  function tools() {
    kur.querySelectorAll("[data-tool]").forEach(b => b.classList.toggle("on", b.dataset.tool === TOOL));
    kur.querySelectorAll("[data-color]").forEach(b => b.classList.toggle("on", b.dataset.color === COLOR));
    const pk = kur.querySelector(".kcol .kpick"), custom = !COLORS.some(([c]) => c === COLOR); pk.classList.toggle("on", custom); pk.style.setProperty("--c", custom ? COLOR : "transparent"); $("kPick").value = /^#[0-9a-f]{6}$/i.test(COLOR) ? COLOR : "#000000";
    kur.querySelectorAll("[data-size]").forEach(b => b.classList.toggle("on", +b.dataset.size === SIZE));
    kur.style.setProperty("--kcur", cursor());
    VIEWS.forEach(pv => { pv.ed.contentEditable = TOOL === "type" ? "true" : "false"; pv.paper.dataset.tool = TOOL; pv.paper.classList.toggle("typing", TOOL === "type"); pv.paper.classList.toggle("moving", TOOL === "move"); });
    if (TOOL !== "move") selectImg(null);
    if (TOOL === "type") pvOf(CUR)?.ed.focus();
  }
  // ----- ألوان الورقة -----
  const hexRgb = h => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ""); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16, n >> 8 & 255, n & 255]; };
  const mix = (a, b, t) => "#" + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, "0")).join("");
  const lum = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  function look(pv) {
    const c = hexRgb(pv.pg.paper), st = pv.paper.style; for (const v of ["--kpaper", "--kline", "--kink"]) st.removeProperty(v);
    if (c) { const dark = lum(c) < 0.45; st.setProperty("--kpaper", pv.pg.paper); st.setProperty("--kline", dark ? mix(c, [255, 255, 255], .2) : mix(c, [59, 111, 208], .22)); st.setProperty("--kink", dark ? "#f2f4fa" : "#1d2a5b"); }
  }
  function paperMenu() {
    const pg = page(); if (!pg || !$("kPaperBtn")) return; const c = hexRgb(pg.paper);
    kur.querySelectorAll("[data-paper]").forEach(b => b.classList.toggle("on", (b.dataset.paper === "auto" && !c) || b.dataset.paper === pg.paper));
    const pp = kur.querySelector(".kpgrid .kpick"), custom = c && !PAPERS.some(([x]) => x === pg.paper); pp.classList.toggle("on", !!custom); pp.style.setProperty("--c", custom ? pg.paper : "transparent");
    if (c) $("kPaperPick").value = pg.paper; $("kPaperBtn").querySelector(".kpchip").style.background = c ? pg.paper : "var(--kpaper,#fffefa)";
  }
  async function setPaper(c) {
    const pg = page(); if (!pg) return; ls.set("kur.paper", c); const targets = $("kPaperAll").checked ? PAGES : [pg];
    for (const x of targets) { x.paper = c === "auto" ? "" : c; const pv = pvOf(x.id); if (pv) { look(pv); pv.k = 0; if (pv.vis) paint(pv); } dirty.add(x.id); }
    paperMenu(); later(pg.id);
  }
  function paintBg(g, k, pv) {
    const cs = getComputedStyle(pv.paper); g.setTransform(k, 0, 0, k, 0, 0);
    g.fillStyle = cs.getPropertyValue("--kpaper").trim() || "#fffefa"; g.fillRect(0, 0, W, pv.H);
    g.fillStyle = cs.getPropertyValue("--kline").trim() || "#c9d7ee"; const t = 1 / k * Math.max(1, Math.round(k));
    for (let y = TOP + LH; y < pv.H - 8; y += LH) g.fillRect(0, Math.round((y - t) * k) / k, W, t);   // على بكسل كامل عشان السطور تطلع كلها بنفس التخانة
  }
  const repaintAll = () => VIEWS.forEach(pv => { pv.k = 0; if (pv.vis) paint(pv); });
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => built && repaintAll());
  new MutationObserver(() => built && repaintAll()).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  // ----- القلم -----
  function path(p, g) {
    g.beginPath(); g.moveTo(p[0], p[1]); if (p.length === 2) { g.lineTo(p[0] + .1, p[1] + .1); return; }
    for (let i = 2; i < p.length - 2; i += 2) { const mx = (p[i] + p[i + 2]) / 2, my = (p[i + 1] + p[i + 3]) / 2; g.quadraticCurveTo(p[i], p[i + 1], mx, my); }
    g.lineTo(p[p.length - 2], p[p.length - 1]);
  }
  function paintInk(g, pg, passes = ["hl", "pen"]) {
    g.lineCap = "round"; g.lineJoin = "round";
    for (const pass of passes) for (const s of pg.ink || []) { if ((s.t === "hl") !== (pass === "hl")) continue; g.globalAlpha = s.t === "hl" ? .32 : 1; g.strokeStyle = s.c; g.lineWidth = s.w; path(s.p, g); g.stroke(); }
    g.globalAlpha = 1;
  }
  function draw(pv) { if (pv.cv.width <= 1) return; pv.ctx.clearRect(0, 0, W, pv.H); paintInk(pv.ctx, pv.pg); }
  const snapshot = pg => { undo.push({ id: pg.id, ink: JSON.stringify(pg.ink || []), imgs: JSON.stringify(pg.imgs || []) }); if (undo.length > 80) undo.shift(); redo = []; };
  function step(from, to) {
    const s = from.pop(); if (!s) return; const pg = page(s.id), pv = pvOf(s.id); if (!pg) return;
    to.push({ id: pg.id, ink: JSON.stringify(pg.ink || []), imgs: JSON.stringify(pg.imgs || []) }); pg.ink = JSON.parse(s.ink); pg.imgs = JSON.parse(s.imgs);
    if (pv) { draw(pv); drawImgs(pv); } later(pg.id);
  }
  function pointer(pv) {
    let st = null, raf = 0; const { cv } = pv;
    const pt = e => { const r = pv.paper.getBoundingClientRect(); return [Math.round((e.clientX - r.left) / scale * 10) / 10, Math.round((e.clientY - r.top) / scale * 10) / 10]; };
    const erase = ([x, y]) => { const pg = pv.pg, n0 = pg.ink.length; pg.ink = pg.ink.filter(s => { for (let i = 0; i < s.p.length; i += 2) if (Math.hypot(s.p[i] - x, s.p[i + 1] - y) < 14 + s.w / 2) return false; return true; }); if (pg.ink.length !== n0) { draw(pv); later(pg.id); } };
    cv.addEventListener("pointerdown", e => {
      if (TOOL === "type" || TOOL === "move" || (e.pointerType === "touch" && penSeen) || e.button > 0) return;
      if (e.pointerType === "pen") penSeen = true;
      const pg = pv.pg; pg.ink ||= []; e.preventDefault(); cv.setPointerCapture(e.pointerId); if (CUR !== pg.id) { CUR = pg.id; counts(); }
      if (pv.cv.width <= 1) paint(pv); snapshot(pg);
      if (TOOL === "erase") { st = { erase: true }; erase(pt(e)); return; }
      st = { t: TOOL === "hl" ? "hl" : "pen", c: TOOL === "hl" ? "#ffd600" : COLOR, w: TOOL === "hl" ? 18 : SIZE, p: pt(e) }; pg.ink.push(st); draw(pv);
    });
    cv.addEventListener("pointermove", e => {
      if (!st) return; e.preventDefault(); const evs = e.getCoalescedEvents?.() || [e];
      if (st.erase) { evs.forEach(x => erase(pt(x))); return; }
      for (const x of evs) { const [a, b] = pt(x), n = st.p.length; if (Math.hypot(a - st.p[n - 2], b - st.p[n - 1]) >= 1.2) st.p.push(a, b); }
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(pv); });
    });
    const end = () => { if (!st) return; const was = st; st = null; if (!was.erase) { draw(pv); grow(pv); later(pv.pg.id); } };
    cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end); cv.addEventListener("lostpointercapture", end);
  }
  function paperTool(pv) { pv.paper.addEventListener("pointerdown", e => { if (TOOL === "move" && !e.target.closest(".kimg")) selectImg(null); }); }
  // ----- الصور (اللي جاية من الكتاب) -----
  function drawImgs(pv) {
    pv.imgs.innerHTML = (pv.pg.imgs || []).map(im => `<div class="kimg${selImg === im.id ? " sel" : ""}" data-img="${esc(im.id)}" style="left:${im.x}px;top:${im.y}px;width:${im.w}px;height:${im.h}px"><img src="${esc(im.src)}" alt="" draggable="false"><i class="kh" data-h="1" title="${T("كبّر أو صغّر")}"></i><button type="button" class="kdel" data-del="1" title="${T("امسح الصورة")}" aria-label="${T("امسح الصورة")}">✕</button></div>`).join("");
    pv.imgs.querySelectorAll(".kimg").forEach(el => imgDrag(pv, el));
  }
  function selectImg(id) { selImg = id; VIEWS.forEach(pv => pv.imgs.querySelectorAll(".kimg").forEach(el => el.classList.toggle("sel", el.dataset.img === id))); }
  function delImg(id) { VIEWS.forEach(pv => { const i = (pv.pg.imgs || []).findIndex(x => x.id === id); if (i < 0) return; snapshot(pv.pg); pv.pg.imgs.splice(i, 1); drawImgs(pv); later(pv.pg.id); }); selImg = null; }
  function imgDrag(pv, el) {
    let d = null; const im = () => pv.pg.imgs.find(x => x.id === el.dataset.img);
    el.addEventListener("pointerdown", e => {
      if (TOOL !== "move") return; const m = im(); if (!m) return; e.preventDefault(); e.stopPropagation(); selectImg(m.id);
      if (e.target.closest("[data-del]")) { delImg(m.id); return; }
      snapshot(pv.pg); d = { x: e.clientX, y: e.clientY, m: { ...m }, rs: !!e.target.closest("[data-h]") }; el.setPointerCapture(e.pointerId);
    });
    el.addEventListener("pointermove", e => { if (!d) return; const m = im(), dx = (e.clientX - d.x) / scale, dy = (e.clientY - d.y) / scale;
      if (d.rs) { const r = d.m.h / d.m.w, w = Math.max(60, Math.min(W - m.x, d.m.w + dx)); m.w = Math.round(w); m.h = Math.round(w * r); }
      else { m.x = Math.round(Math.max(-m.w / 2, Math.min(W - m.w / 2, d.m.x + dx))); m.y = Math.round(Math.max(0, d.m.y + dy)); }
      Object.assign(el.style, { left: m.x + "px", top: m.y + "px", width: m.w + "px", height: m.h + "px" }); });
    const end = () => { if (!d) return; d = null; grow(pv); later(pv.pg.id); };
    el.addEventListener("pointerup", end); el.addEventListener("pointercancel", end);
  }
  // حط صورة (جزء من الكتاب) في الصفحة اللي قدامك، في الحتة اللي باينة على الشاشة
  K.addImage = async (src, meta = {}) => {
    if (!kur.classList.contains("show")) { if (MAIN !== "kur") { SIDE = "kur"; OFF = false; } render(); if (mob()) oShow("kur"); }
    await K.show(); const pv = pvOf(CUR); if (!pv) return;
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(T("الصورة مش سليمة"))); i.src = src; });
    const w = Math.min(W - 72, Math.max(160, img.naturalWidth / 2.2)), h = Math.round(w * img.naturalHeight / img.naturalWidth);
    const sc = $("kScroll"), top = Math.max(0, (sc.scrollTop - pv.el.offsetTop) / scale + 60), y = Math.ceil(Math.max(TOP + 8, top) / LH) * LH;
    const m = { id: uid(), src, x: Math.round((W - w) / 2), y, w: Math.round(w), h, book: meta.book || "", page: meta.page || 0 };
    snapshot(pv.pg); (pv.pg.imgs ||= []).push(m); drawImgs(pv); grow(pv); later(pv.pg.id);
    TOOL = "move"; ls.set("kur.tool", TOOL); tools(); selectImg(m.id);
    toast("📓 " + T("اتحطت في الكراسة — حرّكها أو كبّرها، وبعدين اختار القلم واكتب عليها"));
    return m;
  };

  // ----- مؤشر الماوس: قلم بلون القلم الحالي (بدل علامة +) -----
  const svgCur = (svg, x, y, fb) => `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${x} ${y}, ${fb}`;
  function cursor() {
    if (TOOL === "erase") return svgCur(`<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><circle cx="14" cy="14" r="12" fill="rgba(255,255,255,.55)" stroke="#333" stroke-width="1.5"/></svg>`, 14, 14, "cell");
    if (TOOL === "hl") return svgCur(`<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><path d="M4 24l2-6L18 6l4 4-12 12z" fill="#ffd600" stroke="#333" stroke-width="1.4" stroke-linejoin="round"/><path d="M4 24l2-6 4 4z" fill="#b38f00" stroke="#333" stroke-width="1.2" stroke-linejoin="round"/></svg>`, 4, 24, "pointer");
    const c = /^#[0-9a-f]{6}$/i.test(COLOR) ? COLOR : "#1d2a5b";
    return svgCur(`<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><path d="M3.5 24.5l1.4-5.3L19 5.1a2.3 2.3 0 0 1 3.2 0l.7.7a2.3 2.3 0 0 1 0 3.2L8.8 23.1z" fill="${c}" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"/><path d="M3.5 24.5l1.4-5.3L19 5.1a2.3 2.3 0 0 1 3.2 0l.7.7a2.3 2.3 0 0 1 0 3.2L8.8 23.1z" fill="${c}" stroke="#222" stroke-width="1.1" stroke-linejoin="round"/><path d="M3.5 24.5l1.4-5.3 3.9 3.9z" fill="#f1d3a6" stroke="#222" stroke-width="1" stroke-linejoin="round"/><path d="M3.5 24.5l.6-2.3 1.7 1.7z" fill="#222"/></svg>`, 3, 25, "crosshair");
  }

  // ----- صورة الصفحة (للـ PDF ولسؤال المساعد): الورقة + الصور + الكتابة + القلم زي ما هي على الشاشة -----
  function paintText(g, pv) {
    const pr = pv.paper.getBoundingClientRect(), sc = pr.width / W, R = document.createRange();
    const box = r => ({ x: (r.left - pr.left) / sc, y: (r.top - pr.top) / sc, w: r.width / sc, h: r.height / sc });
    for (const el of pv.ed.querySelectorAll("*")) { const bg = getComputedStyle(el).backgroundColor; if (bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) { g.fillStyle = bg; for (const r of el.getClientRects()) { const b = box(r); g.fillRect(b.x, b.y, b.w, b.h); } } }
    const tw = document.createTreeWalker(pv.ed, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      const cs = getComputedStyle(n.parentElement); g.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; g.fillStyle = cs.color; g.textAlign = "center"; g.textBaseline = "middle";
      const re = /\S+/g; let m;
      while ((m = re.exec(n.data))) {
        R.setStart(n, m.index); R.setEnd(n, m.index + m[0].length); const rs = [...R.getClientRects()].filter(r => r.width > 0); if (!rs.length) continue;
        if (rs.length === 1) { const b = box(rs[0]); g.direction = /[֐-ࣿ]/.test(m[0]) ? "rtl" : "ltr"; g.fillText(m[0], b.x + b.w / 2, b.y + b.h / 2); continue; }
        for (let i = 0; i < m[0].length; i++) { R.setStart(n, m.index + i); R.setEnd(n, m.index + i + 1); const r = R.getClientRects()[0]; if (!r) continue; const b = box(r); g.fillText(m[0][i], b.x + b.w / 2, b.y + b.h / 2); }
      }
    }
  }
  function renderPage(pv, R = 2) {
    const c = document.createElement("canvas"); c.width = W * R; c.height = pv.H * R; const g = c.getContext("2d");
    paintBg(g, R, pv); g.setTransform(R, 0, 0, R, 0, 0);
    for (const el of pv.imgs.querySelectorAll(".kimg")) { const m = pv.pg.imgs.find(x => x.id === el.dataset.img), i = el.querySelector("img"); if (m && i?.complete && i.naturalWidth) g.drawImage(i, m.x, m.y, m.w, m.h); }
    paintInk(g, pv.pg, ["hl"]); paintText(g, pv); paintInk(g, pv.pg, ["pen"]); return c;
  }
  let exporting = false;
  async function exportPdf(all) {
    if (exporting) return; exporting = true; const st = $("kState");
    try {
      await K.flush(); st.textContent = T("بنجهّز الـ PDF…");
      if (!window.PDFLib) await loadScript("lib/pdf-lib.min.js").catch(() => loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js"));
      await document.fonts?.ready;
      const pdf = await PDFLib.PDFDocument.create(), list = all ? PAGES.slice() : [page()];
      for (const pg of list) { const pv = pvOf(pg.id), c = renderPage(pv), png = await pdf.embedPng(await new Promise(r => c.toBlob(b => b.arrayBuffer().then(r), "image/png")));
        const w = W * .75, h = pv.H * .75, p = pdf.addPage([w, h]); p.drawImage(png, { x: 0, y: 0, width: w, height: h }); }
      pdf.setTitle(all ? T("الكراسة") : (list[0]?.title || T("الكراسة"))); pdf.setCreator("AskMyBook");
      const blob = new Blob([await pdf.save()], { type: "application/pdf" });
      const name = (all ? T("الكراسة") + " " + new Date().toLocaleDateString("en-CA") : (list[0]?.title || T("الكراسة"))).replace(/[\\/:*?"<>|]+/g, " ").trim() + ".pdf";
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
      K.lastPdf = { name, pages: list.length, size: blob.size }; st.textContent = "✓ " + T("اتحفظ PDF"); toast(`✅ ${T("اتحفظت الكراسة PDF")} (${list.length.toLocaleString("ar-EG")} ${T("صفحة")})`);
    } catch (e) { st.textContent = ""; toast("⚠️ " + T("مقدرتش أعمل الـ PDF: ") + (e?.message || e)); }
    finally { exporting = false; }
  }
  // ----- اسأل المساعد عن الصفحة: صورتها بتتحط مع السؤال، والنص المكتوب بالكيبورد كمان -----
  async function askAboutPage() {
    const pv = pvOf(CUR); if (!pv) return; await K.flush();
    const blob = await new Promise(r => renderPage(pv, 1.4).toBlob(r, "image/jpeg", .9)), f = new File([blob], (pv.pg.title || "kurasa") + ".jpg", { type: "image/jpeg" });
    if (window.STUDY?.addImages) await STUDY.addImages([f]);
    if (!(AIF && !mob())) { if (MAIN === "kur" || mob()) { if (mob()) { SIDE = "chat"; render(); oShow("chat"); } else { SIDE = "chat"; OFF = false; render(); } } else { AIF = true; OFF = SIDE === "chat"; render(); } }
    const q = $("q"); q.value = T("بص على صفحة الكراسة دي: "); q.focus(); q.setSelectionRange(q.value.length, q.value.length); window.autoGrow?.();
  }
  K.askAboutPage = askAboutPage;
  // ----- حط رد المساعد في الكراسة -----
  K.appendText = async text => {
    if (!loaded) await load(); if (!PAGES.length) await newPage(); if (!CUR || !page()) CUR = PAGES[PAGES.length - 1].id;
    const pg = page(), html = String(text).split(/\n+/).filter(Boolean).map(l => `<div>${esc(l)}</div>`).join("");
    const pv = pvOf(pg.id); if (pv) { pv.ed.insertAdjacentHTML("beforeend", html); grow(pv); later(pg.id); } else { pg.html = clean((pg.html || "") + html); dirty.add(pg.id); await save(); }
    return pg;
  };

  let showing = null;
  K.show = () => showing ||= show1().finally(() => { showing = null; });
  async function show1() {
    if (!built) build();
    if (!loaded) await load();
    if (!PAGES.length) await newPage();
    if (VIEWS.size !== PAGES.length || PAGES.some(p => !VIEWS.has(p.id))) { $("kStack").innerHTML = ""; VIEWS.clear(); PAGES.forEach(mount); if (!page()) CUR = PAGES.some(p => p.id === ls.get("kur.page", "")) ? ls.get("kur.page", "") : PAGES[PAGES.length - 1].id; tools(); counts(); requestAnimationFrame(() => scrollTo(CUR, false)); }
    else layoutAll();
  }
  // الصفحات اتعدّلت من مركز المذاكرة أو من جهاز تاني بالمزامنة
  window.addEventListener("study-data", async e => { if (e.detail?.key !== "nb" || e.detail?.from === "kur") return; await K.flush(); await load(); if (built) { $("kStack").innerHTML = ""; VIEWS.clear(); if (kur.classList.contains("show")) K.show(); } });
  K._render = () => renderPage(pvOf(CUR));
  K.layout = () => ({ MAIN, SIDE, OFF, MAX, AIF, VIDS: VIDS.map(v => v.id) });
  // نص الرد من غير أزرار التحكم والمصادر
  window.answerText = n => { if (n._copy) return String(n._copy).trim(); const c = n.cloneNode(true); c.querySelectorAll(".acts,.src,.vchat,.ytlink").forEach(x => x.remove()); return c.innerText.trim(); };
  window.KURASA = K;
  window.LAYOUT = { openVideo, closeVideo, openAI, setMain, setSide, state: K.layout };
  window.ytId = ytId;

  // «📓 للكراسة» تحت كل رد من المساعد
  const deco = n => { if (n._kur || n.classList.contains("typing") || n.classList.contains("sys")) return; const acts = n.querySelector(":scope > .acts"); if (!acts) return; n._kur = true;
    const b = document.createElement("button"); b.type = "button"; b.className = "noteBtn"; b.textContent = "📓 " + T("كراسة"); b.title = T("حط الرد ده في الكراسة");
    b.onclick = async () => { const t = window.answerText(n); if (!t) return;
      await K.appendText(t); b.textContent = "✅ " + T("اتحط في الكراسة"); b.disabled = true; toast("📓 " + T("اتحط الرد في الكراسة")); };
    acts.append(b); };
  new MutationObserver(() => $("chat").querySelectorAll(".m.a:not(.typing)").forEach(deco)).observe($("chat"), { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });

  render();
  if (mob() && SIDE === "kur" && app.className === "show-chat") oShow("kur");
})();

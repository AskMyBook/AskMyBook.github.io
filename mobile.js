// ===== قراءة مريحة على الموبايل: تكبير بصباعين، شريط أدوات قابل للطي، وإخفاء الأشرطة وقت القراءة =====
(() => {
  const W = $("wrap"), mob = () => matchMedia("(max-width:800px)").matches;

  // زرار القلم: بيفتح/يقفل شريط الكتابة على الموبايل
  const pen = document.createElement("button");
  pen.type = "button"; pen.id = "inkToggle"; pen.className = "icon"; pen.title = "أدوات الكتابة"; pen.setAttribute("aria-label", "أدوات الكتابة"); pen.setAttribute("aria-expanded", "false");
  pen.innerHTML = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
  $("bar").insertBefore(pen, $("solve"));
  const setTools = open => { document.body.classList.toggle("tools-open", open); pen.setAttribute("aria-expanded", String(open)); pen.classList.toggle("on", open); };
  pen.onclick = () => setTools(!document.body.classList.contains("tools-open"));

  // «إضافة كتب» بتتنقل لقايمة ⋮ على الموبايل عشان الشريط يساع
  const mm = $("moreMenu");
  if (mm) { mm.insertAdjacentHTML("afterbegin", '<button type="button" class="mobonly" role="menuitem" id="addMenu">➕ إضافة كتب (PDF)</button>');
    $("addMenu").onclick = e => { e.stopPropagation(); mm.hidden = true; $("files").click(); }; }

  // أسماء أقصر لزراير الشرح والحل على الشاشات الصغيرة
  [["solve", "حل"], ["explain", "اشرح"]].forEach(([id, short]) => { const b = $(id); if (!b) return;
    [...b.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()).forEach(n => { const s = document.createElement("span"); s.className = "lbl"; s.textContent = n.textContent.trim(); n.replaceWith(s); });
    b.insertAdjacentHTML("beforeend", `<span class="sh">${short}</span>`); });

  // تكبير بصباعين (pinch) — الصفحة بتتكبّر حوالين نص الصباعين
  let pz = null;
  const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  W.addEventListener("touchstart", e => {
    if (e.touches.length !== 2 || !doc) return;
    const r = W.getBoundingClientRect(), cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left, cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top;
    pz = { d: dist(e.touches), z: zoom, fx: (W.scrollLeft + cx) / (W.scrollWidth || 1), fy: (W.scrollTop + cy) / (W.scrollHeight || 1), cx, cy, raf: 0 };
  }, { passive: true });
  W.addEventListener("touchmove", e => {
    if (!pz || e.touches.length !== 2) return; e.preventDefault();
    const nz = clamp(pz.z * dist(e.touches) / pz.d, .5, 4); if (pz.raf) return;
    pz.raf = requestAnimationFrame(() => { if (!pz) return; pz.raf = 0;
      zoom = nz; sizePages();
      W.scrollLeft = pz.fx * W.scrollWidth - pz.cx; W.scrollTop = pz.fy * W.scrollHeight - pz.cy; });
  }, { passive: false });
  const endPinch = e => { if (!pz || e.touches.length >= 2) return; pz = null;
    const l = W.scrollLeft, t = W.scrollTop; setZoom(zoom); W.scrollLeft = l; W.scrollTop = t; };   // رندر بجودة كاملة بعد ما الصباعين يسيبوا
  W.addEventListener("touchend", endPinch); W.addEventListener("touchcancel", endPinch);

  // وضع القراءة: لما تنزل في الكتاب الأشرطة بتختفي، ولما تطلع لفوق ترجع
  let last = 0, acc = 0;
  W.addEventListener("scroll", () => {
    if (!mob() || pz) return;
    const y = W.scrollTop, d = y - last; last = y;
    acc = Math.sign(d) === Math.sign(acc) ? acc + d : d;
    if (y < 40 || acc < -30) document.body.classList.remove("reading");
    else if (acc > 60 && !document.body.classList.contains("tools-open")) document.body.classList.add("reading");
  }, { passive: true });
  document.addEventListener("click", e => { if (e.target.closest?.("#tabs,#bar,#settingsBtn")) document.body.classList.remove("reading"); });
  matchMedia("(max-width:800px)").addEventListener?.("change", () => document.body.classList.remove("reading"));
})();

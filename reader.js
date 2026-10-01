// ===== أدوات القارئ الإضافية: ملء العرض / الصفحة كاملة / ملء الشاشة / تنزيل الأصل / تنزيل بالكتابة / معلومات الملف / نسخ النص =====
// بيشتغل فوق app.js (doc, cur, zoom, setZoom, pgs, LIB) و ink.js (inkRender, inkPages). مفيش أي زرار شكلي: كل واحد بيعمل حاجة حقيقية.
(() => {
  const R = {};
  const bookName = id => (LIB.find(e => e.id === id)?.name || "book").replace(/\.pdf$/i, "");
  const need = () => { if (!doc || !cur.id) { toast("افتح كتاب الأول."); return false; } return true; };
  const saveBlob = (blob, name) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 30000); };

  R.fitWidth = () => { if (need()) setZoom(1); };
  R.fitPage = () => {
    if (!need() || !pgs.length) return; const w = $("wrap"), el = pgs[cur.page - 1] || pgs[0];
    const baseW = Math.max(160, w.clientWidth - 28), h = w.clientHeight - 16;
    setZoom(Math.min(1, h / (baseW * (el._r || 1.414))));
  };
  R.fullscreen = () => {
    const v = $("viewer");
    if (document.fullscreenElement) return document.exitFullscreen?.();
    (v.requestFullscreen || v.webkitRequestFullscreen)?.call(v)?.catch?.(() => toast("المتصفح منع ملء الشاشة."));
  };
  R.downloadOriginal = async () => {
    if (!need()) return; const f = await idbGet(cur.id); if (!f) return toast("الملف الأصلي مش موجود على الجهاز.");
    saveBlob(f, bookName(cur.id) + ".pdf");
  };
  // PDF بالكتابة: كل صفحة فيها كتابة بيتحط فوقها صورة شفافة للكتابة (بجودة عالية)، والنص الأصلي بيفضل زي ما هو
  R.downloadAnnotated = async () => {
    if (!need()) return; window.finishText?.(); const pages = window.inkPages?.() || [];
    if (!pages.length) { toast("مفيش كتابة على الكتاب ده — نزّلت الأصل."); return R.downloadOriginal(); }
    toast("بجهّز الـ PDF بالكتابة…");
    try {
      if (!window.PDFLib) await loadScript("lib/pdf-lib.min.js").catch(() => loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js"));
      const f = await idbGet(cur.id), pdf = await PDFLib.PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true });
      for (const n of pages) {
        const page = pdf.getPage(n - 1); if (!page) continue;
        const { width, height } = page.getSize(), rot = (page.getRotation?.().angle || 0) % 360, sw = rot === 90 || rot === 270;
        const W = Math.round((sw ? height : width) * 2.5), H = Math.round((sw ? width : height) * 2.5);
        const c = document.createElement("canvas"); c.width = W; c.height = H; window.inkRender(c.getContext("2d"), n, W, H);
        const png = await pdf.embedPng(await new Promise(r => c.toBlob(b => b.arrayBuffer().then(r), "image/png")));
        if (!rot) page.drawImage(png, { x: 0, y: 0, width, height });
        else page.drawImage(png, rot === 90 ? { x: width, y: 0, width: height, height: width, rotate: PDFLib.degrees(90) } : rot === 180 ? { x: width, y: height, width, height, rotate: PDFLib.degrees(180) } : { x: 0, y: height, width: height, height: width, rotate: PDFLib.degrees(270) });
      }
      saveBlob(new Blob([await pdf.save()], { type: "application/pdf" }), bookName(cur.id) + " - مع الكتابة.pdf");
    } catch (e) { toast("⚠️ مقدرتش أعمل PDF بالكتابة (" + String(e.message || e).slice(0, 90) + "). لو الملف محمي بكلمة سر مش هينفع."); }
  };
  R.info = async () => {
    if (!need()) return; let m = {}; try { m = await doc.getMetadata(); } catch {}
    const f = await idbGet(cur.id), I = m.info || {}, e = LIB.find(x => x.id === cur.id) || {};
    const rows = [["الاسم", bookName(cur.id)], ["العنوان", I.Title], ["المؤلف", I.Author], ["عدد الصفحات", doc.numPages], ["الحجم", f ? (f.size / 1048576).toFixed(1) + " ميجا" : ""],
      ["إصدار PDF", I.PDFFormatVersion], ["اتعمل بـ", I.Producer || I.Creator], ["اتضاف", e.added ? new Date(e.added).toLocaleString("ar-EG") : ""], ["الصفحة الحالية", cur.page]].filter(r => r[1] !== undefined && r[1] !== "");
    toast("ℹ️ " + rows.map(r => r[0] + ": " + r[1]).join(" · "));
    R.lastInfo = Object.fromEntries(rows);
    return R.lastInfo;
  };

  // ----- قايمة «المزيد» في شريط الكتاب -----
  const I = b => `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${b}</svg>`;
  const wrapEl = document.createElement("span"); wrapEl.className = "morewrap";
  wrapEl.innerHTML = `<button type="button" id="moreBtn" class="icon" title="أدوات الكتاب: ملء العرض، ملء الشاشة، تنزيل، بحث…" aria-label="أدوات الكتاب" aria-haspopup="true">${I('<circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>')}</button>
    <div id="moreMenu" class="menu" role="menu" hidden>
      <button type="button" data-a="search" role="menuitem">🔍 دوّر في الكتاب</button>
      <button type="button" data-a="fitWidth" role="menuitem">↔️ ملء العرض</button>
      <button type="button" data-a="fitPage" role="menuitem">🗎 الصفحة كاملة</button>
      <button type="button" data-a="fullscreen" role="menuitem">⛶ ملء الشاشة</button>
      <button type="button" data-a="downloadOriginal" role="menuitem">⬇️ تنزيل الـ PDF الأصلي</button>
      <button type="button" data-a="downloadAnnotated" role="menuitem">🖊️ تنزيل الـ PDF بالكتابة</button>
      <button type="button" data-a="checkWork" role="menuitem">✍️ صحّحلي اللي كتبته على الصفحة</button>
      <button type="button" data-a="info" role="menuitem">ℹ️ معلومات الملف</button>
    </div>`;
  $("bar").insertBefore(wrapEl, $("solve"));
  $("moreBtn").onclick = e => { e.stopPropagation(); $("moreMenu").hidden = !$("moreMenu").hidden; };
  $("moreMenu").onclick = e => { const a = e.target.closest("button")?.dataset.a; if (!a) return; $("moreMenu").hidden = true;
    if (a === "search") return window.STUDY?.open("search");
    if (a === "checkWork") return window.STUDY?.checkWork();
    R[a](); };
  document.addEventListener("pointerdown", e => { if (!e.target.closest?.(".morewrap")) $("moreMenu").hidden = true; });
  document.addEventListener("fullscreenchange", () => setTimeout(() => { if (doc) setZoom(zoom); }, 150));

  // ----- نسخ النص المحدد (فوق التحديد في وضع «تحديد») -----
  chip.insertAdjacentHTML("beforeend", '<button type="button" data-k="copy">📋 انسخ النص</button>');
  chip.addEventListener("click", async e => {
    const b = e.target.closest("button"); if (!b || b.dataset.k !== "copy" || !hoverSpec) return; e.stopImmediatePropagation();
    const spec = hoverSpec, n = spec.n;
    try {
      let t = ""; if (spec.type === "band") { const bc = await bandContext(spec, n); t = (bc.target || bc.t || "").trim(); } else t = await regionText(spec, n, await snap(spec, n));
      await navigator.clipboard.writeText(t); clearPin(); toast("📋 اتنسخ: " + t.slice(0, 60) + (t.length > 60 ? "…" : ""));
    } catch (err) { toast("⚠️ مقدرتش أنسخ (" + String(err.message || err).slice(0, 80) + ")"); }
  }, true);

  window.READER = R;
})();

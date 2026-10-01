// ===== معالجة الكتب كـ «مهام» في الخلفية: حالة حقيقية لكل كتاب (مفيش نسب وهمية) =====
// الخطوات: queued → extracting (نص كل صفحة) → ocr (لو فيه صفحات صور) → structuring (الفهرس) → chunking (المقاطع)
//          → embedding (البحث بالمعنى، لو فيه محرك) → indexing (الحفظ) → completed / failed
// كل مهمة ليها: id, status, stage, done/total (عدّ حقيقي), startedAt, completedAt, error, retries. بتتحفظ وبتكمّل بعد التحديث.
(() => {
  const J = {}, JOBS = {}, Q = []; let running = false, saveT = 0;
  const AUTO_OCR_MAX = 40;   // كتاب صور صغير: OCR تلقائي. أكبر من كده: بنستنى الطالب يدوس «ذاكر الكتاب» (تحميل وتشغيل تقيل)
  const emit = j => { window.dispatchEvent(new CustomEvent("job-update", { detail: j })); clearTimeout(saveT); saveT = setTimeout(() => idbSet("jobs", J), 800); };
  const set = (j, o) => { Object.assign(j, o); emit(j); };
  JOBS.get = id => J[id] || null;
  JOBS.all = () => Object.values(J);
  JOBS.progress = (id, stage, done, total) => { const j = J[id]; if (!j || j.status === "completed") return; set(j, { stage, done, total, status: "processing" }); };
  JOBS.enqueue = (id, { force = false } = {}) => {
    const j = J[id]; if (j && !force && ["queued", "processing"].includes(j.status)) return j;
    const nj = J[id] = { id: "job-" + id + "-" + Date.now().toString(36), book: id, status: "queued", stage: "queued", done: 0, total: 0, startedAt: 0, completedAt: 0, error: "", retries: j ? (j.retries || 0) + (force ? 1 : 0) : 0, detail: {} };
    if (!Q.includes(id)) Q.push(id); emit(nj); pump(); return nj;
  };
  JOBS.retry = id => JOBS.enqueue(id, { force: true });
  async function pump() { if (running) return; running = true; try { while (Q.length) { const id = Q.shift(); if (LIB.some(e => e.id === id)) await run(id); } } finally { running = false; } }
  async function run(id) {
    const j = J[id]; set(j, { status: "processing", stage: "extracting", startedAt: Date.now(), error: "" });
    try {
      const d = await loadDoc(id); if (!d) throw new Error(docErr[id]?.message ? "الملف مش PDF سليم أو متلف (" + String(docErr[id].message).slice(0, 80) + ")" : "الملف مش موجود على الجهاز");
      const b = await bkLoadFor(id, d); set(j, { total: b.n, done: 0 });
      await bkEnsureQuick(id, d, b);
      let have = bkHave(b); j.detail = { pages: b.n, textPages: have, ocrPages: b.n - have };
      if (have < b.n) {   // صفحات صور
        if (b.n - have <= AUTO_OCR_MAX || b.run) { set(j, { stage: "ocr", done: 0, total: b.n - have }); await bkOcr(id, d, b); have = bkHave(b); j.detail.textPages = have; j.detail.ocrPages = b.n - have; }
        else j.detail.waitingOcr = b.n - have;
      }
      set(j, { stage: "structuring", done: 0, total: 1 }); const ol = RAG.outline(id); j.detail.sections = ol.length; set(j, { done: 1 });
      set(j, { stage: "chunking", done: 0, total: 1 }); const ch = RAG.chunks(id); j.detail.chunks = ch.length; set(j, { done: 1 });
      const be = RAG.backend?.();
      if (be && ch.length) {
        set(j, { stage: "embedding", done: Math.round(RAG.coverage(id) * ch.length), total: ch.length }); RAG.schedule([id]);
        const t0 = Date.now();
        await new Promise(res => { const on = () => { const p = RAG.prog; if (p?.id === id) set(j, { done: p.done, total: p.total }); const cov = RAG.coverage(id);
            if (cov >= 0.99 || (!p && Date.now() - t0 > 1500) || RAG.err || Date.now() - t0 > 15 * 60000) { window.removeEventListener("rag-progress", on); clearInterval(iv); res(); } };
          const iv = setInterval(on, 1000); window.addEventListener("rag-progress", on); on(); });
        j.detail.embedded = Math.round(RAG.coverage(id) * ch.length); if (RAG.err) j.detail.embedError = RAG.err;
      } else j.detail.embedded = be ? 0 : "off";
      set(j, { stage: "indexing", done: 0, total: 1 }); await bkSave(id, b); set(j, { done: 1 });
      // تحقق: لازم نص حقيقي اتقرا ومقاطع اتعملت — غير كده مش «جاهز»
      if (!ch.length || !bkHave(b)) { if (j.detail.waitingOcr) { set(j, { status: "waiting", stage: "ocr", done: 0, total: j.detail.waitingOcr, completedAt: Date.now() }); return; } throw new Error("مقدرتش أقرا أي نص من الكتاب ده"); }
      set(j, { status: j.detail.waitingOcr ? "waiting" : "completed", stage: j.detail.waitingOcr ? "ocr" : "completed", done: j.detail.waitingOcr ? 0 : 1, total: j.detail.waitingOcr || 1, completedAt: Date.now() });
    } catch (e) { set(j, { status: "failed", stage: "failed", error: String(e?.message || e).slice(0, 200), completedAt: Date.now() }); console.warn("job failed", id, e); }
  }
  // نص الحالة للواجهة (نفس العدّ الحقيقي)
  const ST = { queued: "⏳ في الطابور", extracting: "📄 بيقرا نص الصفحات", ocr: "🔎 بيقرا الصفحات الصور (OCR)", structuring: "🗂️ بيطلّع الفهرس", chunking: "🧩 بيقسّم لمقاطع", embedding: "🧠 بيجهّز البحث بالمعنى", indexing: "💾 بيحفظ الفهرس" };
  JOBS.label = j => {
    if (!j) return ""; const en = window.I18N?.lang === "en";
    if (j.status === "completed") return (en ? "✅ Ready to study" : "✅ جاهز للمذاكرة") + (j.detail?.pages ? ` · ${j.detail.textPages}/${j.detail.pages} ${en ? "pages read" : "صفحة مقروءة"}` : "");
    if (j.status === "failed") return (en ? "⚠️ Processing failed: " : "⚠️ المعالجة فشلت: ") + j.error;
    if (j.status === "waiting") return en ? `🔎 ${j.total} scanned pages need OCR — press “Study the whole book”` : `🔎 فيه ${j.total} صفحة صور محتاجة OCR — دوس «ذاكر الكتاب كله»`;
    return ST[j.stage] ? ST[j.stage] + (j.total > 1 ? ` ${j.done}/${j.total}` : "") : j.stage;
  };
  window.addEventListener("books-imported", e => e.detail.ids.forEach(id => JOBS.enqueue(id, { force: true })));
  window.addEventListener("book-deleted", e => { delete J[e.detail.id]; const i = Q.indexOf(e.detail.id); if (i > -1) Q.splice(i, 1); emit({}); });
  // بعد التحديث/القفل المفاجئ: المهام اللي ماخلصتش بتكمّل
  (async () => { const saved = await idbGet("jobs"); if (saved && typeof saved === "object") Object.assign(J, saved);
    const wait = () => new Promise(r => { const t = setInterval(() => { if (LIB.length || document.readyState === "complete") { clearInterval(t); r(); } }, 300); });
    await wait(); for (const e of LIB) { const j = J[e.id]; if (!j || ["queued", "processing"].includes(j.status)) JOBS.enqueue(e.id, { force: !!j }); } })();
  window.JOBS = JOBS;
})();

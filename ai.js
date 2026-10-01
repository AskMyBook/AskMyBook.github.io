// ===== بوابة الذكاء الاصطناعي (AI Gateway) — واجهة واحدة للتطبيق كله =====
// باقي الموقع بيكلّم AI.* بس، ومش بيعرف مين المزوّد. المزوّدات نفسها (مجاني / Puter / Claude / Gemini / سيرفر الموقع / محلي)
// متسجّلة في llm0 (app.js)، وسيرفر الموقع عنده router تاني للمزوّدات (server/worker.js). تغيير مزوّد = مفيش تعديل في التطبيق.
//
//   AI.generate / AI.stream / AI.analyzeImage / AI.structured (JSON متحقّق منه بـ schema + إعادة محاولة) / AI.embed
//   AI.speech.transcribe / detectLanguage — AI.voice.synthesize — AI.document.extractText / ocr / analyzeStructure
//   AI.vectors: VectorStore (index / search / delete / update) — المحلي (IndexedDB) افتراضي، وتقدر تسجّل غيره (pgvector مثلًا)
(() => {
  const AI = {};
  const info = () => ({ provider: provider(), vision: !textOnly(), server: !!window.PX?.on() });
  AI.info = info;
  AI.generate = ({ system = "", messages, prompt, tier = "fast", max = 1500, temperature } = {}) => llm({ system, messages: messages || [{ role: "user", content: prompt }], tier, max, temperature, noStyle: true, long: true });
  AI.stream = ({ onText, ...o } = {}) => llm({ system: o.system || "", messages: o.messages || [{ role: "user", content: o.prompt }], tier: o.tier || "fast", max: o.max || 1500, onText, noStyle: true, long: true });
  // صورة: المزوّد بيشوف الصور → نبعتها. مبيشوفش → OCR ونقول ده صراحة (مش بنمثّل إننا شفنا الصورة)
  AI.analyzeImage = async ({ prompt, images, system = "" } = {}) => {
    if (!textOnly()) return llm({ system, messages: [{ role: "user", content: prompt }], imgs: images, max: 2000, noStyle: true, long: true, tier: "smart" });
    const txt = []; for (const b64 of images) { try { txt.push(await ocrImg(cur.id || LIB[0]?.id || "", "data:image/jpeg;base64," + b64)); } catch {} }
    return llm({ system, max: 2000, noStyle: true, long: true, tier: "smart", messages: [{ role: "user", content: `${prompt}\n\n(المزوّد الحالي مبيشوفش الصور — ده النص اللي اتقرا من الصورة بالـ OCR وممكن يكون فيه أخطاء، قول كده لو حاجة مش واضحة:)\n${txt.join("\n---\n") || "(مقدرتش أقرا نص)"}` }] });
  };
  AI.embed = async (texts, task = "document") => { const be = RAG.backend?.(); if (!be) throw Object.assign(new Error("مفيش محرك embeddings متاح (سيرفر الموقع أو مفتاح Gemini أو المحلي)"), { code: "no_embed" }); return be.run(texts, task); };

  // ----- JSON متحقّق منه -----
  function extractJSON(s) {
    s = String(s || "").replace(/```(?:json)?/gi, "").replace(/[“”]/g, '"'); const a = s.indexOf("{"), b = s.lastIndexOf("}"); if (a < 0 || b < a) return null;
    let t = s.slice(a, b + 1); for (let i = 0; i < 3; i++) { try { return JSON.parse(t); } catch { t = t.replace(/,\s*([}\]])/g, "$1").replace(/[\u0000-\u001f]+/g, " ").replace(/([{,]\s*)([A-Za-z_]\w*)\s*:/g, '$1"$2":'); } }
    return null;
  }
  AI.extractJSON = extractJSON;
  // validate(obj) → { value, errors }: لو value فاضي بنعيد المحاولة مرة برسالة الأخطاء، وبعدها خطأ مفهوم (مفيش crash)
  AI.structured = async ({ system, prompt, validate, tier = "smart", max = 3000, temperature = 0.4, retries = 1, onText }) => {
    let last = { errors: ["no output"] }, msgs = [{ role: "user", content: prompt }];
    for (let a = 0; a <= retries; a++) {
      const raw = await llm({ system, messages: msgs, tier, max, temperature, noStyle: true, long: true, onText: a ? undefined : onText });
      const j = extractJSON(raw); last = j ? validate(j) : { value: null, errors: ["الرد مكانش JSON صحيح"] };
      if (last.value) return { ...last, attempts: a + 1 };
      msgs = [...msgs, { role: "assistant", content: String(raw).slice(0, 4000) }, { role: "user", content: "الرد اللي فات مش صالح: " + last.errors.slice(0, 6).join("؛ ") + ". رجّع JSON صحيح بالشكل المطلوب بالظبط، ومن غير أي كلام تاني." }];
    }
    throw Object.assign(new Error("الذكاء الاصطناعي رجّع بيانات مش صالحة (" + last.errors.slice(0, 3).join("؛ ") + "). جرّب تاني."), { code: "malformed_ai", errors: last.errors });
  };

  // ----- شكل السؤال الموحّد (schema) + تصحيح الأشكال القريبة -----
  const TYPE = { mcq: "mcq", multiple_choice: "mcq", choice: "mcq", tf: "tf", true_false: "tf", truefalse: "tf", boolean: "tf", fill: "fill", fill_blank: "fill", fill_in_the_blank: "fill", blank: "fill",
    short: "short", short_answer: "short", essay: "essay", long: "essay", math: "math", problem: "math", calculation: "math" };
  AI.QUESTION_SCHEMA = '{"questions":[{"question":"نص السؤال","type":"multiple_choice|true_false|fill_blank|short_answer|essay|problem","difficulty":"easy|medium|hard|very_hard","options":["..."],"correctAnswer":"رقم الاختيار الصح (من 0) للاختيارات، أو الإجابة النموذجية كنص","explanation":"ليه دي الإجابة","source":1}]}';
  // blocks = المقاطع اللي اتبعتت للموديل: source لازم يشاور على مقطع حقيقي، ومنه بناخد الصفحة والدرس (مش من كلام الموديل)
  AI.validateQuestions = (j, { blocks = [], types = null, max = 30 } = {}) => {
    const list = Array.isArray(j?.questions) ? j.questions : Array.isArray(j) ? j : [], out = [], errors = [];
    list.forEach((x, i) => {
      if (!x || typeof x !== "object") return errors.push(`سؤال ${i + 1}: مش object`);
      const q = String(x.question ?? x.q ?? "").trim(), rawType = String(x.type || "").toLowerCase().replace(/[\s-]+/g, "_");
      let type = TYPE[rawType] || (Array.isArray(x.options) && x.options.length ? (x.options.length === 2 ? "tf" : "mcq") : "short");
      if (q.length < 3) return errors.push(`سؤال ${i + 1}: من غير نص`);
      let options = Array.isArray(x.options) ? x.options.map(o => String(o ?? "").trim()).filter(Boolean) : null, ans = x.correctAnswer ?? x.answer ?? x.correct;
      if (type === "mcq" || type === "tf") {
        if (!options || options.length < 2 || options.length > 6 || new Set(options).size !== options.length) return errors.push(`سؤال ${i + 1}: الاختيارات ناقصة أو مكررة`);
        let k = typeof ans === "number" ? ans : /^\d+$/.test(String(ans ?? "").trim()) ? +String(ans).trim() : options.findIndex(o => o.toLowerCase() === String(ans ?? "").trim().toLowerCase());
        if (k < 0 && typeof ans === "string" && /^[a-fأ-ي]$/i.test(ans.trim())) k = "abcdef".indexOf(ans.trim().toLowerCase()) >= 0 ? "abcdef".indexOf(ans.trim().toLowerCase()) : ["أ", "ب", "ج", "د", "ه", "و"].indexOf(ans.trim());
        if (!(k >= 0 && k < options.length)) return errors.push(`سؤال ${i + 1}: الإجابة الصح مش واحد من الاختيارات`);
        ans = k; if (options.length === 2) type = "tf";
      } else { options = null; ans = String(ans ?? "").trim(); if (!ans) return errors.push(`سؤال ${i + 1}: من غير إجابة نموذجية`); if (type === "fill" && !/_{2,}|\.{3}|…|\(\s*\)/.test(q)) type = "short"; }
      if (types && !types.includes(type)) { if (types.includes("short") && ["fill", "essay", "math"].includes(type)) type = "short"; else return errors.push(`سؤال ${i + 1}: نوع مش مطلوب (${type})`); }
      const si = +(x.source ?? x.src ?? (Array.isArray(x.sourcePages) ? 0 : 0)), b = blocks.length ? blocks[si - 1] || null : null;
      if (blocks.length && !b) errors.push(`سؤال ${i + 1}: المصدر ${si || "؟"} مش من المقاطع — اتشال ربط المصدر`);
      const sec = b?.sec || (b ? RAG.sectionAt(b.id, b.page)?.line || "" : "");
      out.push({ id: "q" + (i + 1) + "-" + Math.random().toString(36).slice(2, 7), type, q, options, answer: ans, explain: String(x.explanation ?? x.explain ?? "").trim(),
        difficulty: String(x.difficulty || "").toLowerCase(), s: b ? { id: b.id, page: b.page, sec } : null, page: b?.page || 0, sec, book: b?.id || "" });
    });
    return { value: out.length ? out.slice(0, max) : null, errors };
  };

  // ----- الصوت / الكلام / المستندات -----
  AI.speech = {
    detectLanguage: t => { const L = (String(t).match(/[A-Za-z]/g) || []).length, A = (String(t).match(/[؀-ۿ]/g) || []).length; return !L && !A ? "unknown" : L > A * 2 ? "en" : A > L * 2 ? "ar" : "mixed"; },
    transcribe: async (blob, lang = "ar-EG") => { if (!window.PX?.cached?.()?.stt) throw Object.assign(new Error("تحويل الصوت لنص على السيرفر مش متظبط (STT)"), { code: "no_stt" });
      const r = await fetch(PX.base() + "/v1/stt?lang=" + encodeURIComponent(lang), { method: "POST", headers: { "content-type": blob.type || "audio/webm", ...(PX.authH?.() || {}) }, body: blob });
      const j = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(j.error || "HTTP " + r.status), { status: r.status }); return (j.text || "").trim(); }
  };
  AI.voice = { synthesize: (text, { lang } = {}) => { const p = TTS.current(); if (!p || p.kind !== "audio") throw Object.assign(new Error("مفيش محرك صوت بيرجّع ملف"), { code: "no_tts" }); return TTS.synth(p, { t: text, l: lang || TTS.langOf(text) }); } };
  AI.document = { extractText: (id, page) => pageText(id, page), ocr: async (id, page) => ocrPage(id, page, docs[id] || await loadDoc(id)), analyzeStructure: id => RAG.outline(id) };

  // ----- VectorStore -----
  const STORES = {
    local: { name: "IndexedDB (على الجهاز)", index: ids => RAG.schedule(ids), search: (q, o = {}) => RAG.retrieve(q, o), delete: async id => { await idbDel("emb:" + id); await idbDel("idx:" + id); }, update: ids => RAG.schedule(ids) }
  };
  let active = "local";
  AI.vectors = {
    register: (name, store) => { for (const k of ["index", "search", "delete", "update"]) if (typeof store[k] !== "function") throw new Error("VectorStore ناقص " + k); STORES[name] = store; },
    use: name => { if (!STORES[name]) throw new Error("مفيش VectorStore اسمه " + name); active = name; },
    active: () => active, list: () => Object.keys(STORES),
    index: (...a) => STORES[active].index(...a), search: (...a) => STORES[active].search(...a), delete: (...a) => STORES[active].delete(...a), update: (...a) => STORES[active].update(...a)
  };
  window.AI = AI;
})();

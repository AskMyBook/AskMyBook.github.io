// ===== طبقة تحويل النص لصوت (TTS) — مستقلة تمامًا عن المدرّس الذكي =====
// المدرّس (AI Teacher) بيولّد النص بس. الطبقة دي بتحوّل النص لصوت بس، ومفيهاش أي اعتماد على Gemini.
//
// Provider/Adapter: كل محرك صوت ليه نفس الشكل، وتقدر تضيف محرك جديد بـ TTS.register({...}) من غير ما تغيّر باقي الموقع:
//   { id, label, kind: "audio" | "speech", fallbackOnly?,
//     available() → bool, caps() → { pitch, mixed, langs }, voices() → [{ id, name, lang: "ar"|"en", gender }],
//     synth({ text, lang, voice, pitch, rate, signal }) → Promise<{ url, rate, provider?, voice? }>  ← محركات بترجع ملف صوت (kind: "audio")
//       rate = السرعة اللي المحرك ولّد بيها فعلًا؛ المشغّل بيكمّل الفرق بسرعة التشغيل (لو المحرك ليه حد، زي ElevenLabs 0.7–1.2)
//     speak({ text, lang, voice, rate, pitch }) → Promise, cancel()           ← محركات بتتكلم بنفسها (kind: "speech") }
//
// الترتيب: ١) سيرفر الموقع POST /api/tts (Piper/XTTS مستضاف عندك، أو Azure/ElevenLabs/OpenAI — المفاتيح على السيرفر بس)
//          ٢) صوت OpenAI الطبيعي عن طريق Puter (مجاني بحساب Puter بتاع كل طالب، من غير مفتاح ولا فيزا)
//          ٣) «كريم» Piper جوه المتصفح (مفتوح المصدر، بلا مفتاح ولا حدود)
//          ٤) صوت المتصفح (SpeechSynthesis) — احتياطي بس لو اللي فوق مش متاح أو فشل.
(() => {
  // ---------- الإعدادات ----------
  const KEY = "tts.settings", RATES = [0.75, 1, 1.25, 1.5];
  const DEF = { provider: "auto", teacher: "ar", voice: "", lang: "auto", rate: 1, pitch: 1, oneVoice: true };   // oneVoice: نفس صوت المدرّس للعربي والإنجليزي والمخلوط
  const TEACHERS = { ar: { id: "ar", name: "المدرّس العربي", lang: "ar" }, en: { id: "en", name: "English Teacher", lang: "en" } };
  let S; try { const o = JSON.parse(localStorage.getItem(KEY) || "{}"); S = { ...DEF, rate: +o.rate || DEF.rate }; } catch { S = { ...DEF }; }   // صوت واحد ثابت: بنحتفظ بالسرعة بس
  // مرة واحدة: «تلقائي» للكل (بيختار: سيرفر الموقع ← Puter/ElevenLabs لو الطالب مسجّل ← صوت المتصفح ← كريم) — وكل واحد يقدر يثبّت محرك من ⚙️ ← الصوت
  try { if (!localStorage.getItem("tts.migAuto")) { localStorage.setItem("tts.migAuto", "1"); if (S.provider === "browser" || S.provider === "local") { S.provider = "auto"; S.voice = ""; localStorage.setItem(KEY, JSON.stringify(S)); } } } catch {}
  if (!RATES.includes(+S.rate)) S.rate = RATES.reduce((a, b) => Math.abs(b - S.rate) < Math.abs(a - S.rate) ? b : a, 1);
  const subs = new Set(), emit = () => subs.forEach(f => { try { f(S); } catch {} });
  function set(p) { S = { ...S, ...p }; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} emit(); }

  // ---------- أدوات ----------
  // تحديد العربي بدقة أعلى (كل نطاقات الحروف العربية) — من نسخة v3
  const AR_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g;
  const arabicCount = t => (String(t).match(AR_RE) || []).length, latinCount = t => (String(t).match(/[A-Za-z]/g) || []).length;
  const isLatin = t => latinCount(t) > arabicCount(t) * 3;
  const langOf = t => { if (S.lang === "ar" || S.lang === "en") return S.lang; const a = arabicCount(t), l = latinCount(t); return a && a >= l / 3 ? "ar" : "en"; };
  // تنظيف العربي قبل النطق: أشكال العرض (ﻻ ﷲ …) لحروف عادية، والتطويل «ـــ»، والحروف الخفية، وعلامات المصحف.
  // ⚠️ مش بنشيل التشكيل ولا الهمزات ولا نحوّل «ى» لـ«ي» (نسخة v3 كانت بتعمل كده: «على» كانت بتتقري «علي» و«إن/أن» بتضيع).
  const normalizeArabicTTS = t => String(t ?? "").normalize("NFKC").replace(/\u0640/g, "").replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "").replace(/[\u0610-\u061A\u06D6-\u06ED]/g, "").replace(/[ \t]{2,}/g, " ").trim();
  // تقسيم الجملة لأجزاء عربي / English من غير ما أي حرف يضيع:
  // - كلمة إنجليزي = حرفين لاتيني على الأقل (cell, DNA). الحرف الواحد (x في معادلة) والأرقام والرموز بتفضل مع الكلام العربي
  // - أي جزء مفيهوش حروف (رموز / مسافات) بيتلزق في اللي قبله
  const EN_RUN = /[A-Za-z][A-Za-z0-9'’&.\-]*[A-Za-z0-9](?:[\s,]+[A-Za-z][A-Za-z0-9'’&.\-]*)*/g;
  function splitLang(text) {
    const out = []; let last = 0, m; EN_RUN.lastIndex = 0;
    const push = (t, l) => { if (!t) return; const p = out[out.length - 1];
      if (!/[A-Za-z0-9\u0600-\u06FF\u0660-\u0669]/.test(t)) { if (p) p.t += t; else out.push({ t, l: "ar" }); return; }   // رموز بس → مع اللي قبلها
      if (p && p.l === l) p.t += t; else out.push({ t, l }); };
    while ((m = EN_RUN.exec(text))) { push(text.slice(last, m.index), "ar"); push(m[0], "en"); last = m.index + m[0].length; }
    push(text.slice(last), "ar");
    // أرقام ورموز ومتغيرات من غير حروف عربي بين كلام إنجليزي (Solve 2x + 3 equals 7) = جزء من الجملة الإنجليزي، مش صوت تاني
    for (let i = 0; i < out.length; i++) { const x = out[i];
      if (x.l === "ar" && !/[\u0600-\u06FF]/.test(x.t) && (out[i - 1]?.l === "en" || (!out[i - 1] && out[i + 1]?.l === "en"))) x.l = "en"; }
    for (let i = 1; i < out.length; i++) { const x = out[i], p = out[i - 1]; if (x.l !== "ar" || p.l !== "en") continue;   // «Solve 2x + 3 = 7 وبعدين…»
      const k = x.t.search(/[\u0600-\u06FF]/), lead = k > 0 ? x.t.slice(0, k).replace(/\S+$/, "") : ""; if (/[0-9A-Za-z]/.test(lead)) { p.t += lead; x.t = x.t.slice(lead.length); } }
    const merged = []; for (const x of out) { const p = merged[merged.length - 1]; if (p && p.l === x.l) p.t += x.t; else merged.push({ ...x }); }
    return merged.map(x => ({ t: x.t.trim(), l: x.l })).filter(x => x.t);
  }

  // ---------- سجل المحركات ----------
  const P = new Map(), ORDER = [], down = new Map();   // down: محرك فشل → مستني لحد وقت معيّن
  function register(p) { P.set(p.id, p); if (!ORDER.includes(p.id)) ORDER.push(p.id); emit(); }
  const isDown = id => (down.get(id) || 0) > Date.now();
  function markDown(id, err) { if (err?.code === "signin") return;   // مش متسجّل: المحرك بيتخطّى لوحده لحد ما الطالب يسجّل
    const perm = /NOSUPPORT|not supported|wasm/i.test(err?.message || ""); down.set(id, Date.now() + (perm ? 864e5 : err?.status === 429 || /limit|quota|insufficient|credit/i.test(err?.message || "") ? 10 * 60e3 : 20e3)); emit(); }
  const ok = p => p && !isDown(p.id) && (() => { try { return !!p.available(); } catch { return false; } })();
  // سلسلة المحركات بالترتيب (المختار يدويًا الأول)، والاحتياطي دايمًا في الآخر
  function chain() {
    const all = ORDER.map(id => P.get(id)), forced = S.provider !== "auto" ? P.get(S.provider) : null;
    const RANK = { server: 0, puter: 1, browser: 2, local: 3 };   // الترتيب التلقائي: الأجود الأول، و«كريم» (التقيل) آخر واحد
    const main = all.filter(p => !p.fallbackOnly).sort((a, b) => (RANK[a.id] ?? 1.5) - (RANK[b.id] ?? 1.5)), fb = all.filter(p => p.fallbackOnly);
    return [...(forced && !forced.fallbackOnly ? [forced] : []), ...main.filter(p => p !== forced), ...fb].filter(ok);
  }
  const current = () => chain()[0] || null;
  function after(id) { const c = chain(); const i = c.findIndex(p => p.id === id); return i < 0 ? c[0] || null : c[i + 1] || null; }
  // الصوت المناسب للجزء ده: اللي الطالب اختاره لو بيتكلم نفس اللغة، وإلا صوت المدرّس الافتراضي للغة دي
  const one = () => S.oneVoice !== false;
  function voiceFor(p, lang) {
    const vs = p.voices() || [], chosen = vs.find(v => v.id === S.voice);
    if (one()) {   // صوت واحد: المختار، وإلا الصوت الافتراضي للغة المدرّس — لأي لغة في النص
      // إلا لو الجزء عربي والصوت المختار إنجليزي على محرك مبيخلطش: صوت إنجليزي بيقرا العربي بنطق أجنبي مش مفهوم → صوت عربي للجزء ده بس (من v3)
      if (chosen && !(lang === "ar" && chosen.lang && chosen.lang !== "ar" && !p.caps().mixed)) return chosen.id;
      if (chosen && lang === "ar") { const a = vs.filter(v => v.lang === "ar"); const v = a.find(x => x.default && x.gender !== "f") || a.find(x => x.gender === "m") || a[0]; if (v) return v.id; }
      const tl = TEACHERS[S.teacher]?.lang || "ar", pref = vs.filter(v => v.lang === tl);
      return (pref.find(v => v.default && v.gender !== "f") || pref.find(v => v.gender === "m") || pref[0] || vs[0] || {}).id || ""; }
    if (chosen && (chosen.lang === lang || (p.caps().mixed && p.id !== "local"))) return chosen.id;
    const pref = vs.filter(v => v.lang === lang);
    return (pref.find(v => v.default && v.gender !== "f") || pref.find(v => v.gender === "m") || pref[0] || {}).id || "";
  }

  // الصوت اللي بيقرا اللغة دي فعلًا (للعرض): المختار لو من نفس اللغة، وإلا صوت اللغة الافتراضي (السيرفر بيقرا الكلام الإنجليزي بصوت إنجليزي حتى لو المختار عربي)
  function shownVoice(p, lang) {
    const vs = p.voices() || [], chosen = vs.find(v => v.id === S.voice);
    if (one()) { const id = voiceFor(p, lang); return vs.find(v => v.id === id) || null; }
    if (chosen && chosen.lang === lang) return chosen;
    const pref = vs.filter(v => v.lang === lang); return pref.find(v => v.default && v.gender !== "f") || pref.find(v => v.gender === "m") || pref[0] || null;
  }
  // ---------- ١) سيرفر الموقع ----------
  const srvInfo = () => (window.PX?.on() && PX.cached()?.tts) || null;
  register({
    id: "server", label: "سيرفر الموقع", kind: "audio",
    available: () => !!srvInfo(),
    // القدرات بتتحدد من المحرك اللي هيقرا فعلًا: صاحب الصوت المختار، وإلا أول محرك على السيرفر
    caps: () => { const i = srvInfo(), own = i?.voices?.find(v => v.id === S.voice)?.provider, pr = i?.providers?.find(x => x.id === own) || i?.providers?.[0]; return pr?.caps || i?.caps || { pitch: false, mixed: false, langs: ["ar", "en"] }; },
    voices: () => { const i = srvInfo(), many = (i?.providers || []).length > 1; return (i?.voices || []).map(v => ({ ...v, name: many ? `${v.name} (${i.providers.find(x => x.id === v.provider)?.label || v.provider})` : v.name, default: v.default && v.provider === i.provider })); },
    async synth({ text, lang, voice, pitch, rate, signal }) {
      const r = await PX.post("/api/tts", { text, lang, voice, pitch, rate }, { raw: true, signal, ms: 30000 }), h = r.headers;
      const blob = await r.blob(); if (!blob.size) throw Object.assign(new Error("السيرفر رجّع صوت فاضي"), { status: 502 });
      return { url: URL.createObjectURL(blob), rate: +h.get("x-tts-rate") || 1, provider: h.get("x-tts-provider") || "", voice: h.get("x-tts-voice") || "", fallback: decodeURIComponent(h.get("x-tts-fallback") || "") };
    }
  });

  // ---------- ٢) Puter: صوت OpenAI الطبيعي (gpt-4o-mini-tts) من غير مفتاح ولا سيرفر ولا فيزا ----------
  // نظام Puter «المستخدم بيدفع»: كل طالب بيسجّل دخول مرة واحدة بحساب Puter مجاني، والاستهلاك على رصيده هو — صاحب الموقع مبيدفعش حاجة.
  // مش متسجّل؟ المحرك ده بيتخطّى بهدوء والصوت بيكمّل بـ«كريم»، وفي ⚙️ ← الصوت زرار «سجّل دخول».
  // ElevenLabs (eleven_multilingual_v2) الافتراضي: عربيه واضح ومفهوم وإنجليزيه طبيعي بنفس الصوت.
  // OpenAI (gpt-4o-mini-tts) إنجليزيه ممتاز بس العربي عنده مش واضح — موجود كاختيار.
  const PUTER_VOICES = [["el:pNInz6obpgDQGcFmaJgB", "Adam — رجالي (ElevenLabs، عربي واضح)", "m"], ["el:JBFqnCBsd6RMkjVDRZzb", "George — رجالي دافي (ElevenLabs)", "m"], ["el:nPczCjzI2devNBz1zQrb", "Brian — رجالي عميق (ElevenLabs)", "m"],
    ["el:onwK4e9ZLuTAKqWW03F9", "Daniel — رجالي هادي (ElevenLabs)", "m"], ["el:EXAVITQu4vr4xnAAx5gL", "Sarah — حريمي (ElevenLabs)", "f"], ["el:XrExE9yKIg1WjnnlVkGX", "Matilda — حريمي (ElevenLabs)", "f"],
    ["oa:ash", "Ash — OpenAI (إنجليزي ممتاز، عربي أضعف)", "m"], ["oa:onyx", "Onyx — OpenAI (إنجليزي ممتاز، عربي أضعف)", "m"], ["oa:coral", "Coral — OpenAI (إنجليزي ممتاز، عربي أضعف)", "f"]]
    .flatMap(([id, name, gender], i) => ["ar", "en"].map(lang => ({ id, name, lang, gender, default: i === 0 })));
  const pOpts = v => { v = PUTER_VOICES.some(x => x.id === v) ? v : PUTER_VOICES[0].id; const [k, id] = v.split(":");
    return k === "oa" ? { provider: "openai", model: "gpt-4o-mini-tts", voice: id, instructions: P_STYLE, response_format: "mp3" }
      : { provider: "elevenlabs", model: "eleven_multilingual_v2", voice: id, output_format: "mp3_44100_128", voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true } }; };
  const P_STYLE = "You are one warm, calm, patient teacher explaining a lesson to a student. Keep exactly the same voice the whole time. Read Arabic words clearly and correctly, like a native Arabic speaker from Egypt, word by word, never mumbled or anglicized. Read English words as natural English. Switch smoothly between Arabic and English inside the same sentence without changing voice. Natural rhythm, short pauses at commas and full stops, never rushed.";
  // null = لسه متعرفش (بنفتكر آخر مرة: tts.puter)، true = متسجّل، false = مش متسجّل
  let pSigned = null, pHint = false;
  const pOK = () => location.protocol !== "file:";
  const pSet = v => { pSigned = v; try { if (v !== null) localStorage.setItem("tts.puter", v ? "1" : "0"); } catch {} emit(); };
  const puterTTS = {
    id: "puter", label: "صوت طبيعي (ElevenLabs / OpenAI عن طريق Puter — مجاني بحسابك)", kind: "audio",
    available: () => pOK() && (pSigned === true || (pSigned === null && localStorage.getItem("tts.puter") === "1")),
    caps: () => ({ pitch: false, mixed: true, langs: ["ar", "en"] }),
    voices: () => PUTER_VOICES,
    state: () => pSigned,
    async check() { try { await ensurePuter(); pSet(!!(await puter.auth.isSignedIn())); } catch { emit(); } return pSigned; },
    async signIn() { await ensurePuter(); await puter.auth.signIn(); down.delete("puter"); pSet(!!(await puter.auth.isSignedIn())); return pSigned; },
    async synth({ text, lang, voice, signal }) {
      // أصوات OpenAI في Puter كويسة في الإنجليزي بس العربي فيها أضعف: الجزء العربي بصوت Adam (ElevenLabs multilingual) — من v3
      if (lang === "ar" && /^oa:/.test(voice || "")) voice = "el:pNInz6obpgDQGcFmaJgB";
      await ensurePuter();
      if (!(await puter.auth.isSignedIn())) {
        pSet(false);
        if (!pHint) { pHint = true; try { toast("ℹ️ للصوت الطبيعي (زي جيمني): سجّل دخول Puter مجانًا من ⚙️ ← الصوت. لحد كده الصوت شغال بالمحرك العادي."); } catch {} }
        throw Object.assign(new Error("مش مسجّل دخول في Puter"), { code: "signin" });
      }
      if (pSigned !== true) pSet(true);
      const o = pOpts(voice); let a; try { a = await puter.ai.txt2speech(text, o); }
      catch (e) { const m = typeof perr === "function" ? perr(e) : String(e?.message || e); throw Object.assign(new Error("Puter: " + String(m).slice(0, 140)), { status: e?.status || e?.error?.status }); }
      if (signal?.aborted) throw Object.assign(new Error("aborted"), { name: "AbortError" });
      const url = a?.src || a?.currentSrc || (typeof a === "string" ? a : ""); if (!url) throw new Error("Puter رجّع صوت فاضي");
      return { url, rate: 1, provider: "puter-" + o.provider, voice: PUTER_VOICES.some(x => x.id === voice) ? voice : PUTER_VOICES[0].id };   // السرعة بيكمّلها المشغّل (من غير ما الطبقة تتغيّر)
    }
  };
  register(puterTTS);

  // ---------- ٣) «كريم» — Piper جوه المتصفح (Web Worker عشان الصفحة متهنّجش) ----------
  // محرك خفيف مكتوب هنا مباشرة (onnxruntime-web + piper-phonemize):
  //  - «النطق» (espeak، ١٨ ميجا) بيتحمّل مرة واحدة ويفضل شغال، وكل موديل صوت بيتحمّل مرة واحدة ويفضل في الذاكرة
  //  - كل جملة (عربي + الكلمات الإنجليزي اللي جواها) بتطلع ملف صوت واحد متصل = من غير سكتات بين الكلمات
  //  - وقفة طبيعية قصيرة في آخر كل جملة، والموديل بيتخزن على الجهاز (OPFS) بنفس أسماء النسخة القديمة فمش بيتحمّل تاني
  const PIPER_VOICES = [
    { id: "ar_JO-kareem-medium", name: "كريم — عربي (جودة أعلى)", lang: "ar", gender: "m", default: true },
    { id: "ar_JO-kareem-low", name: "كريم — عربي (أخف وأسرع للموبايل)", lang: "ar", gender: "m" },
    { id: "en_US-ryan-medium", name: "Ryan — English", lang: "en", gender: "m", default: true },
    { id: "en_GB-alan-medium", name: "Alan — British English", lang: "en", gender: "m" },
    { id: "en_US-hfc_male-medium", name: "HFC — English", lang: "en", gender: "m" }
  ];
  const PIPER_PATHS = { "en_US-ryan-low": "en/en_US/ryan/low/en_US-ryan-low.onnx", "ar_JO-kareem-medium": "ar/ar_JO/kareem/medium/ar_JO-kareem-medium.onnx", "ar_JO-kareem-low": "ar/ar_JO/kareem/low/ar_JO-kareem-low.onnx",
    "en_US-ryan-medium": "en/en_US/ryan/medium/en_US-ryan-medium.onnx", "en_GB-alan-medium": "en/en_GB/alan/medium/en_GB-alan-medium.onnx", "en_US-hfc_male-medium": "en/en_US/hfc_male/medium/en_US-hfc_male-medium.onnx" };
  // تشكيل العربي قبل ما «كريم» يقراه (موديل CATT — Apache 2.0، نسخة int8 حوالي 21 ميجا في فولدر models/):
  // Piper العربي متدرّب على كلام متشكّل، ومن غير تشكيل النطق بيطلع مش مفهوم. ده نفس اللي Piper على السيرفر بيعمله (libtashkeel).
  const B2U = { "'": "\u0621", "|": "\u0622", ">": "\u0623", "&": "\u0624", "<": "\u0625", "}": "\u0626", A: "\u0627", b: "\u0628", p: "\u0629", t: "\u062A", v: "\u062B", j: "\u062C", H: "\u062D", x: "\u062E", d: "\u062F", "*": "\u0630", r: "\u0631", z: "\u0632", s: "\u0633", $: "\u0634", S: "\u0635", D: "\u0636", T: "\u0637", Z: "\u0638", E: "\u0639", g: "\u063A", f: "\u0641", q: "\u0642", k: "\u0643", l: "\u0644", m: "\u0645", n: "\u0646", h: "\u0647", w: "\u0648", Y: "\u0649", y: "\u064A", F: "\u064B", N: "\u064C", K: "\u064D", a: "\u064E", u: "\u064F", i: "\u0650", "~": "\u0651", o: "\u0652" };
  const TKDATA = { B2U, U2B: Object.fromEntries(Object.entries(B2U).map(([k, v]) => [v, k])),
    LET: ["<PAD>", "<BOS>", "<EOS>", " ", "$", "&", "'", "*", "<", ">", "A", "D", "E", "H", "S", "T", "Y", "Z", "b", "d", "f", "g", "h", "j", "k", "l", "m", "n", "p", "q", "r", "s", "t", "v", "w", "x", "y", "z", "|", "}", "<MASK>"],
    TAG: ["<PAD>", "<BOS>", "<EOS>", "<NT>", "<SD>", "<SDD>", "<SF>", "<SFF>", "<SK>", "<SKK>", "F", "K", "N", "a", "i", "o", "u", "~"],
    OUT: { "<SF>": "~a", "<SD>": "~u", "<SK>": "~i", "<SFF>": "~F", "<SDD>": "~N", "<SKK>": "~K" } };
  // ---------- تجهيز الكلام العربي لـ«كريم» (متقاس بـ Whisper: الأرقام والإنجليزي والعامية كانوا بيطلعوا مش مفهومين) ----------
  // ١) الأرقام → كلمات مصري (كريم كان بيقرا «2» «تمان» و«10 نيوتن» «عشعنيوتني»)
  const U1 = ["صفر", "واحد", "اتنين", "تلاتة", "أربعة", "خمسة", "ستة", "سبعة", "تمانية", "تسعة", "عشرة", "حداشر", "اتناشر", "تلاتاشر", "أربعتاشر", "خمستاشر", "ستاشر", "سبعتاشر", "تمنتاشر", "تسعتاشر"];
  const U10 = ["", "", "عشرين", "تلاتين", "أربعين", "خمسين", "ستين", "سبعين", "تمانين", "تسعين"];
  const U100 = ["", "مية", "ميتين", "تلتمية", "ربعمية", "خمسمية", "ستمية", "سبعمية", "تمنمية", "تسعمية"];
  function num2ar(n) {
    if (n < 20) return U1[n];
    if (n < 100) return (n % 10 ? U1[n % 10] + " و" : "") + U10[Math.floor(n / 10)];
    if (n < 1000) return U100[Math.floor(n / 100)] + (n % 100 ? " و" + num2ar(n % 100) : "");
    if (n < 1e6) { const k = Math.floor(n / 1000), r = n % 1000; return (k === 1 ? "ألف" : k === 2 ? "ألفين" : k <= 10 ? num2ar(k) + " آلاف" : num2ar(k) + " ألف") + (r ? " و" + num2ar(r) : ""); }
    if (n < 1e9) { const m = Math.floor(n / 1e6), r = n % 1e6; return (m === 1 ? "مليون" : m === 2 ? "مليونين" : num2ar(m) + (m <= 10 ? " ملايين" : " مليون")) + (r ? " و" + num2ar(r) : ""); }
    return String(n).split("").map(d => U1[+d]).join(" ");
  }
  const numWords = s => { const d = s.replace(/[٠-٩]/g, c => "٠١٢٣٤٥٦٧٨٩".indexOf(c)).replace(/[,٬](?=\d{3}\b)/g, ""), [a, b] = d.split(/[.٫]/);
    let out = a.length > 12 ? a.split("").map(x => U1[+x]).join(" ") : num2ar(+a); if (b) out += " فاصلة " + (b.length <= 2 && b[0] !== "0" ? num2ar(+b) : b.split("").map(x => U1[+x]).join(" ")); return out; };
  // ٢) الإنجليزي جوه جملة عربي → بالحروف العربي زي ما بيتنطق (كريم مبيعرفش أصوات الإنجليزي: «mitochondria» كانت بتختفي)
  const LETTERS = { a: "إيه", b: "بي", c: "سي", d: "دي", e: "إي", f: "إف", g: "جي", h: "إتش", i: "آي", j: "جيه", k: "كيه", l: "إل", m: "إم", n: "إن", o: "أو", p: "بي", q: "كيو", r: "آر", s: "إس", t: "تي", u: "يو", v: "في", w: "دبليو", x: "إكس", y: "واي", z: "زد" };
  const EN_AR = { the: "ذا", and: "آند", of: "أوف", is: "إز", a: "أ", to: "تو", in: "إن", mitochondria: "ميتوكوندريا", nucleus: "نيوكلياس", cell: "سيل", cells: "سيلز", force: "فورس", mass: "ماس", acceleration: "أكسيليريشن", velocity: "فيلوسيتي", speed: "سبيد", energy: "إنرجي", power: "باور", work: "ورك", newton: "نيوتن", joule: "جول", watt: "وات", volt: "فولت", ampere: "أمبير", ohm: "أوم", atom: "أتوم", molecule: "موليكيول", electron: "إلكترون", proton: "بروتون", neutron: "نيوترون", photosynthesis: "فوتوسينثيسيس", protein: "بروتين", enzyme: "إنزيم", gene: "جين", genes: "جينز", chromosome: "كروموسوم", virus: "فايرس", bacteria: "باكتيريا", oxygen: "أوكسجين", hydrogen: "هيدروجين", carbon: "كاربون", nitrogen: "نيتروجين", function: "فانكشن", equation: "إكويجن", variable: "فاريابل", graph: "جراف", matrix: "ماتريكس", vector: "فيكتور", present: "بريزنت", past: "باست", future: "فيوتشر", simple: "سيمبل", continuous: "كونتينيوس", perfect: "بيرفكت", tense: "تنس", verb: "فيرب", noun: "ناون", adjective: "أدجكتيف", adverb: "أدفيرب", subject: "سبجكت", object: "أوبجكت", sentence: "سينتنس", question: "كويستشن", answer: "آنسر", example: "إجزامبل", ok: "أوكيه", okay: "أوكيه", flashcards: "فلاش كاردز", quiz: "كويز", test: "تست", exam: "إكزام", chapter: "تشابتر", lesson: "ليسون", page: "بيدج", unit: "يونيت", definition: "ديفينيشن", physics: "فيزيكس", chemistry: "كيميستري", biology: "بايولوجي", math: "ماث", english: "إنجلش", computer: "كمبيوتر", internet: "إنترنت" };
  function translit(w) {
    const lw = w.toLowerCase(); if (EN_AR[lw]) return EN_AR[lw];
    if (/^[A-Z]{2,6}s?$/.test(w) || /^[A-Za-z]$/.test(w)) return w.replace(/s$/, m => w.length > 2 ? "" : m).split("").map(c => LETTERS[c.toLowerCase()]).join(" ") + (/[A-Z]s$/.test(w) ? "ز" : "");   // ATP / DNA / x
    let s = lw.replace(/e$/, "").replace(/(.)\1/g, "$1"), o = "";
    const R = [["tion", "شن"], ["sion", "جن"], ["ture", "تشر"], ["ph", "ف"], ["th", "ث"], ["sh", "ش"], ["ch", "ك"], ["ck", "ك"], ["qu", "كو"], ["oo", "و"], ["ee", "ي"], ["ea", "ي"], ["ou", "او"], ["ai", "ي"], ["ay", "اي"], ["ey", "اي"], ["oa", "و"]];
    for (let i = 0; i < s.length;) {
      const r = R.find(([k]) => s.startsWith(k, i)); if (r) { o += r[1]; i += r[0].length; continue; }
      const c = s[i], nx = s[i + 1] || "", first = i === 0;
      if ("aeiou".includes(c)) o += first ? ({ a: "أ", e: "إ", i: "إ", o: "أو", u: "أ" })[c] : ({ a: "ا", e: nx ? "ي" : "", i: "ي", o: "و", u: "و" })[c];
      else o += ({ b: "ب", c: /[eiy]/.test(nx) ? "س" : "ك", d: "د", f: "ف", g: "ج", h: "ه", j: "ج", k: "ك", l: "ل", m: "م", n: "ن", p: "ب", q: "ك", r: "ر", s: "س", t: "ت", v: "ف", w: "و", x: "كس", y: first ? "ي" : "ي", z: "ز" })[c] || "";
      i++;
    }
    return o || w;
  }
  const AR_L = /[ء-ي]/g, LA_L = /[A-Za-z]/g;
  // جملة أغلبها عربي: الأرقام كلمات والإنجليزي بالحروف العربي. جملة أغلبها إنجليزي: زي ما هي (بتتقري بنطق إنجليزي)
  function arPrep(text) {
    return text.split(/(?<=[.!?؟…\n])\s+/).map(s => {
      const ar = (s.match(/[ء-ي]+/g) || []).length, la = (s.match(/[A-Za-z]+/g) || []).length; if (!ar || la > ar) return s;   // بعدد الكلمات مش الحروف (كلمة إنجليزي طويلة زي mitochondria كانت بتقلب الجملة كلها إنجليزي)
      return s.replace(/\b(?:the|The)\s+(?=[A-Za-z])/g, "").replace(/(?:ال)?ـ?\s*\b([A-Z]{2,6}s?)\b/g, (m, w) => " " + w).replace(/(?:ال)?ـ\s*(?=[A-Za-z])/g, "ال")
        .replace(/[0-9٠-٩]+(?:[.,٫٬][0-9٠-٩]+)*/g, m => " " + numWords(m) + " ")
        .replace(/[A-Za-z]+(?:'[a-z]+)?/g, w => translit(w.replace(/'.*/, "")))
        .replace(/(^|\s)ال\s+(?=[ء-ي])/g, "$1ال").replace(/\s{2,}/g, " ");
    }).join(" ");
  }
  const TK_BASE = (() => { try { return location.protocol === "file:" ? "" : new URL("models/", location.href).href; } catch { return ""; } })();
  const WSRC = `
const ORT = "https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/1.18.0/", PW = "https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize", HF = "https://huggingface.co/diffusionstudio/piper-voices/resolve/main/";
const PATHS = ${JSON.stringify(PIPER_PATHS)};
importScripts(ORT + "ort.wasm.min.js", PW + ".js");
ort.env.wasm.wasmPaths = ORT; ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1;
let lines = [], PH = null; const V = new Map();
const phonemizer = () => PH ||= createPiperPhonemize({ print: l => lines.push(l), printErr: () => {}, locateFile: u => u.endsWith(".wasm") ? PW + ".wasm" : u.endsWith(".data") ? PW + ".data" : u }).catch(e => { PH = null; throw e; });
async function file(url, prog) {   // كاش على الجهاز (OPFS): أول مرة بس بيتحمّل
  const name = url.split("/").pop(); let dir = null;
  try { dir = await (await navigator.storage.getDirectory()).getDirectoryHandle("piper", { create: true }); const f = await (await dir.getFileHandle(name)).getFile(); if (f.size > 100) return f; } catch (e) {}
  const r = await fetch(url); if (!r.ok) throw new Error("تحميل الصوت فشل (" + r.status + ")");
  const total = +r.headers.get("content-length") || 0, rd = r.body.getReader(), parts = []; let got = 0, last = 0;
  for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length; if (prog && total && got - last > total / 50) { last = got; prog(100 * got / total); } }
  const blob = new Blob(parts);
  try { if (dir) { const w = await (await dir.getFileHandle(name, { create: true })).createWritable(); await w.write(blob); await w.close(); } } catch (e) {}
  return blob;
}
const voice = id => { if (!PATHS[id]) id = "ar_JO-kareem-medium";
  if (!V.has(id)) V.set(id, (async () => { const p = PATHS[id];
    const cfg = JSON.parse(await (await file(HF + p + ".json")).text());
    const buf = await (await file(HF + p, pc => postMessage({ t: "prog", p: pc }))).arrayBuffer();
    return { cfg, s: await ort.InferenceSession.create(buf, { executionProviders: ["wasm"], graphOptimizationLevel: "all" }) }; })().catch(e => { V.delete(id); throw e; }));
  return V.get(id); };
// الأصوات → أرقام بجدول الموديل نفسه (زي Piper الأصلي). أي صوت الموديل مايعرفوش بيتشال بدل ما المحرك يقع
// (مثلًا صوت إنجليزي بيقرا كلمة عربي، أو العكس)
function toIds(cfg, j) {
  const map = cfg.phoneme_id_map, n = cfg.num_symbols || 256;
  if (!map || !Array.isArray(j.phonemes)) return (j.phoneme_ids || []).filter(x => x >= 0 && x < n);
  const pad = (map["_"] || [0])[0], out = [...(map["^"] || [1]), pad];
  for (const ph of j.phonemes.flatMap(p => Array.from(String(p)))) { const v = map[ph]; if (v) out.push(...v, pad); }
  out.push(...(map["$"] || [2])); return out.filter(x => x >= 0 && x < n);
}
// ----- تشكيل (CATT encoder-only) -----
const TKD = ${JSON.stringify(TKDATA)}; let TKP = null; const TKC = new Map();
const tkModel = base => TKP ||= (async () => { const [e, d] = await Promise.all([file(base + "catt-eo-q8.onnx"), file(base + "catt-eo-dec.onnx")]);
  const o = { executionProviders: ["wasm"], graphOptimizationLevel: "all" };
  return { e: await ort.InferenceSession.create(await e.arrayBuffer(), o), d: await ort.InferenceSession.create(await d.arrayBuffer(), o) }; })().catch(e => { TKP = null; throw e; });
async function tkRun(ar, m) {   // جملة عربي (حروف ومسافات بس) → نفس الجملة متشكّلة
  const bw = Array.from(ar).map(c => TKD.U2B[c] || c).join(""), ids = Array.from(bw).map(c => Math.max(0, TKD.LET.indexOf(c))), L = ids.length;
  const enc = (await m.e.run({ src: new ort.Tensor("int64", BigInt64Array.from(ids, BigInt), [1, L]), src_mask: new ort.Tensor("bool", new Uint8Array(L * L).fill(1), [1, 1, L, L]) })).encoder_output;
  const out = (await m.d.run({ enc_src: enc })).decoder_output.data, C = TKD.TAG.length; let res = "";
  for (let i = 0; i < L; i++) { const c = bw[i]; res += c; if (c === " ") continue;
    let best = 0, bv = -Infinity; for (let k = 0; k < C; k++) { const v = out[i * C + k]; if (v > bv) { bv = v; best = k; } }
    const t = TKD.TAG[best]; if (t === "<NT>" || t === "<PAD>" || t === "<BOS>" || t === "<EOS>") continue; res += TKD.OUT[t] || t; }
  return Array.from(res).map(c => TKD.B2U[c] || c).join("");
}
async function tashkeel(text, base) {   // بيشكّل الكلام العربي بس، والأرقام والرموز والإنجليزي زي ما هم. أي مشكلة → النص الأصلي
  if (!base || !/[\u0621-\u064A]/.test(text)) return text;
  if (TKC.has(text)) return TKC.get(text);
  try { const m = await tkModel(base); let out = "", last = 0; const src = text.replace(/[\u064B-\u0652\u0640]/g, ""), re = /[\u0621-\u063A\u0641-\u064A]+(?: +[\u0621-\u063A\u0641-\u064A]+)*/g; let x;
    while ((x = re.exec(src))) { out += src.slice(last, x.index); let run = x[0], done = "";
      while (run.length > 280) { const cut = run.lastIndexOf(" ", 280) > 50 ? run.lastIndexOf(" ", 280) : 280; done += (await tkRun(run.slice(0, cut), m)) + (run[cut] === " " ? " " : ""); run = run.slice(cut).replace(/^ /, ""); }
      out += done + (await tkRun(run, m)); last = x.index + x[0].length; }
    out += src.slice(last); if (TKC.size > 300) TKC.clear(); TKC.set(text, out); if (!self.tkOK) { self.tkOK = 1; postMessage({ t: "tkstate", ok: true }); } return out;
  } catch (e) { if (self.tkOK !== 0) { self.tkOK = 0; postMessage({ t: "tkstate", ok: false, msg: String(e && e.message || e).slice(0, 120) }); } return text; }
}
let busy = 0;
async function run(text, id, speed = 1, ph = "", tk = "") {   // نص → PCM (speed: السرعة بتتولّد جوه الموديل نفسه = نطق طبيعي مش تسريع)
  const [{ cfg, s }, m] = await Promise.all([voice(id), phonemizer()]);   // ph: نطق لغة تانية بنفس الصوت (كلمة إنجليزي بصوت كريم)
  if ((ph || cfg.espeak.voice) === "ar") text = await tashkeel(text, tk);   // العربي متشكّل = نطق مفهوم
  const t0 = performance.now(); lines = []; m.callMain(["-l", ph || cfg.espeak.voice, "--input", JSON.stringify([{ text }]), "--espeak_data", "/espeak-ng-data"]);
  const ids = lines.flatMap(l => { try { return toIds(cfg, JSON.parse(l)); } catch (e) { return []; } }); if (ids.length < 3) return { pcm: new Float32Array(0), rate: cfg.audio.sample_rate };
  const inf = cfg.inference || {}, feeds = { input: new ort.Tensor("int64", BigInt64Array.from(ids, BigInt), [1, ids.length]), input_lengths: new ort.Tensor("int64", BigInt64Array.from([BigInt(ids.length)]), [1]),
    scales: new ort.Tensor("float32", Float32Array.from([inf.noise_scale ?? 0.667, (inf.length_scale ?? 1) / (speed || 1), inf.noise_w ?? 0.8]), [3]) };
  if ((cfg.num_speakers || 1) > 1) feeds.sid = new ort.Tensor("int64", BigInt64Array.from([0n]), [1]);
  const r = await s.run(feeds); busy += performance.now() - t0; return { pcm: r.output.data, rate: cfg.audio.sample_rate };
}
function resample(x, from, to) { if (from === to) return x; const n = Math.round(x.length * to / from), y = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i * from / to, j = Math.floor(t), f = t - j; y[i] = (x[j] || 0) * (1 - f) + (x[j + 1] || 0) * f; } return y; }
function wav(parts, rate, tail) {   // أجزاء PCM → ملف WAV واحد (+ وقفة في الآخر)
  const n = parts.reduce((a, p) => a + p.length, 0) + Math.round(rate * tail), v = new DataView(new ArrayBuffer(44 + n * 2)), w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true);
  let o = 44; for (const p of parts) for (let i = 0; i < p.length; i++, o += 2) v.setInt16(o, Math.max(-1, Math.min(1, p[i])) * 32767, true);
  return v.buffer;
}
let Q = Promise.resolve();   // طلب واحد في المرة (المحرك واحد) بالترتيب
onmessage = e => { const d = e.data;
  if (d.tkTest) { tashkeel(d.tkTest, d.tk).then(t => postMessage({ t: "tk", id: d.id, text: t })); return; }
  if (d.warm) { Q = Q.then(() => Promise.all([phonemizer(), voice(d.warm)])).catch(() => {}); return; }
  Q = Q.then(async () => {
    if (d.cancelled) return;
    try { const outs = []; busy = 0; for (const r of d.runs) outs.push(await run(r.t, r.v, d.speed, r.ph, d.tk));
      const rate = (outs[0] && outs[0].rate) || 22050, pcm = outs.map(o => resample(o.pcm, o.rate, rate)), buf = wav(pcm, rate, d.pause || 0);
      postMessage({ t: "done", id: d.id, buf, sec: pcm.reduce((a, p) => a + p.length, 0) / rate, ms: busy }, [buf]);
    } catch (err) { postMessage({ t: "err", id: d.id, msg: String(err && err.message || err) }); }
  });
};`;
  let W = null, WID = 0, TKS = null, TKH; const WP = new Map(), prog = new Set();
  function worker() {
    if (W) return W;
    W = new Worker(URL.createObjectURL(new Blob([WSRC], { type: "text/javascript" })));
    W.onmessage = e => { const m = e.data; if (m.t === "prog") { prog.forEach(f => f(m.p)); return; }
      if (m.t === "tkstate") { TKS = { ok: m.ok, msg: m.msg || "", at: Date.now() }; emit(); return; }
      const r = WP.get(m.id); if (!r) return; WP.delete(m.id); if (m.t === "tk") { r.res(m.text); return; }
      if (m.t === "done") { try { localStorage.setItem("tts.localReady", "1"); if (m.ms > 50 && m.sec > 0.5) { const sp = m.sec * 1000 / m.ms, old = +localStorage.getItem("tts.localSpeed") || 0; localStorage.setItem("tts.localSpeed", String(old ? old * 0.7 + sp * 0.3 : sp)); } } catch {} r.res(URL.createObjectURL(new Blob([m.buf], { type: "audio/wav" }))); } else r.rej(new Error(m.msg)); };
    W.onerror = e => { e.preventDefault?.(); const err = new Error("NOSUPPORT: " + (e.message || "worker")); WP.forEach(r => r.rej(err)); WP.clear(); try { W.terminate(); } catch {} W = null; };
    return W;
  }
  // الجملة → أجزاء (عربي / English) كل جزء بصوته، والـ worker بيلزقهم في ملف واحد
  function runs(text, arV, enV) {
    if (S.lang === "ar" || S.lang === "en") return [{ t: text, v: S.lang === "en" ? enV : arV }];
    if (one()) {   // صوت واحد: نفس الموديل للجملة كلها، وكل جزء بنطق لغته (الإنجليزي بنطق إنجليزي بصوت كريم نفسه)
      const main = arV, mainLang = PIPER_VOICES.find(v => v.id === main)?.lang || (/^en/.test(main) ? "en" : "ar");
      return splitLang(text).map(x => ({ t: x.t, v: main, ph: x.l === mainLang ? "" : x.l === "en" ? "en-us" : "ar" }));
    }
    return splitLang(text).map(x => ({ t: x.t, v: x.l === "en" ? enV : arV }));
  }
  // جهاز بطيء (بيولّد الكلام أبطأ من سرعة الكلام نفسه) → الموديل الأخف تلقائيًا من المرة الجاية، عشان ميبقاش فيه سكتات
  const SLOW = (() => { try { const sp = +localStorage.getItem("tts.localSpeed"); return sp > 0 && sp < 1.2; } catch { return false; } })();
  const local = {
    id: "local", label: "«كريم» على جهازك (مجاني بلا حدود)", kind: "audio",
    available: () => !!(window.Worker && window.WebAssembly && window.Blob),
    caps: () => ({ pitch: false, mixed: true, langs: ["ar", "en"] }),   // mixed: بيقرا الجملة كلها بصوتين من غير تقطيع
    voices: () => PIPER_VOICES,
    slow: SLOW,
    synth({ text, rate = 1, signal }) {
      const pick = l => { const v = voiceFor(local, l); return SLOW && !PIPER_VOICES.some(x => x.id === S.voice && x.lang === l) ? (l === "ar" ? "ar_JO-kareem-low" : "en_US-ryan-low") : v; };
      const tl = one() ? PIPER_VOICES.find(v => v.id === voiceFor(local, "ar"))?.lang || "ar" : "", arV = pick(tl || "ar"), enV = tl ? arV : pick("en"), pause = (/[.!?؟…:]\s*$/.test(text) ? 0.22 : 0.08) / rate;
      if (S.lang !== "en") text = arPrep(text);   // الأرقام كلمات + الإنجليزي بالحروف العربي (جوه الجمل العربي بس)
      return new Promise((res, rej) => {
        const id = ++WID; let dog = 0;
        const arm = () => { clearTimeout(dog); dog = setTimeout(() => { if (WP.delete(id)) { unp(); rej(Object.assign(new Error("المحرك المحلي وقف ومردّش (أكتر من دقيقة)"), { code: "timeout" })); } }, 60000); };   // مفيش رد ولا تقدّم في التحميل
        const unp = local.onProgress(arm); arm();
        // الموديل مش بيتحكم في السرعة بشكل خطّي: length_scale بيدّي حوالي نص التغيير المطلوب (متقاس: 1.5× → ~1.24×).
        // بنقول للمشغّل السرعة الفعلية عشان يكمّل الباقي بسرعة التشغيل → النتيجة بالظبط زي ما الطالب اختار
        const eff = +(1 + 0.5 * (rate - 1)).toFixed(3);
        WP.set(id, { res: url => { clearTimeout(dog); unp(); res({ url, rate: eff, provider: "local", voice: arV }); }, rej: e => { clearTimeout(dog); unp(); rej(e); } });
        signal?.addEventListener("abort", () => { if (WP.delete(id)) { clearTimeout(dog); unp(); rej(Object.assign(new Error("aborted"), { name: "AbortError" })); } });
        try { worker().postMessage({ id, runs: runs(text, arV, enV), pause, speed: rate, tk: TK_BASE }); } catch (e) { WP.delete(id); clearTimeout(dog); unp(); rej(e); }
      });
    },
    tkState: () => TKS,
    tkCheck: () => {   // ملفات التشكيل موجودة على الموقع؟ (null = لسه بنشوف)
      if (TKH === undefined) { TKH = null; if (!TK_BASE) TKH = false; else fetch(TK_BASE + "catt-eo-dec.onnx", { method: "HEAD", cache: "no-store" }).then(r => r.ok, () => false).then(ok => { TKH = ok; emit(); }); }
      return TKH; },
    tashkeel: text => new Promise((res, rej) => { const id = ++WID; WP.set(id, { res, rej }); try { worker().postMessage({ id, tkTest: text, tk: TK_BASE }); } catch (e) { WP.delete(id); rej(e); } }),   // للاختبار والتجربة
    warm(force) { try { if (localStorage.getItem("tts.localReady") || force) worker().postMessage({ warm: SLOW && !S.voice ? "ar_JO-kareem-low" : voiceFor(local, "ar") }); worker().postMessage({ id: -1, tkTest: "مرحبا", tk: TK_BASE }); } catch {} },   // + موديل التشكيل
    onProgress: f => { prog.add(f); return () => prog.delete(f); }
  };
  register(local);
  // الموديل متحمّل قبل كده؟ نجهّزه في الخلفية أول ما الطالب يلمس الصفحة، عشان أول «اسمع» يشتغل على طول
  // وكمان نعرف الطالب متسجّل في Puter ولا لأ (من غير ما نفتح أي نافذة) عشان نعرف مين هيتكلم
  addEventListener("pointerdown", async () => { if (pSigned === null && localStorage.getItem("tts.puter") === "1" && pOK()) await puterTTS.check(); if (current() === local) local.warm(); }, { once: true, capture: true });
  // أول مرة خالص: الموديل (~90 ميجا مع المحرك) بيبدأ يتحمّل في الخلفية أول ما الطالب يبعت أول سؤال — لو النت كويس ومش في وضع توفير البيانات —
  // فلما يدوس «اسمع» يلاقيه جاهز بدل ما يستنى
  const goodNet = () => { const c = navigator.connection; return !c || (!c.saveData && (!c.effectiveType || c.effectiveType === "4g")); };
  addEventListener("submit", () => { if (current() === local && !localStorage.getItem("tts.localReady") && goodNet()) local.warm(true); }, { once: true, capture: true });

  // ---------- ٣) صوت المتصفح — احتياطي بس ----------
  const HAS = !!window.speechSynthesis;
  const MALE = /\b(shakir|hamed|hamdan|taim|rami|fahed|moaz|ali|abdullah|bassel|saleh|laith|ismael|jamal|hedi|omar|naayf|maged|majed|tarik|guy|ryan|davis|andrew|brian|christopher|eric|roger|steffan|mark|david|george|james|daniel|thomas|oliver|alex|fred|aaron|evan|male)\b/i;
  const FEMALE = /\b(salma|zariyah|fatima|sana|layla|laila|noura|amal|aysha|rana|maryam|amany|amina|mouna|reem|iman|hoda|aria|ava|jenny|michelle|emma|sonia|libby|samantha|karen|zira|susan|hazel|female|zoe|nora|mariam|amira)\b/i;
  const gen = v => MALE.test(v.name) ? "m" : FEMALE.test(v.name) ? "f" : "?";
  const score = (v, ar) => (/natural|neural|online/i.test(v.name) ? 12 : 0) + (/premium|enhanced/i.test(v.name) ? 8 : 0) + (/google/i.test(v.name) ? 4 : 0) - (/compact|espeak/i.test(v.name) ? 6 : 0)
    + (gen(v) === "m" ? 6 : gen(v) === "f" ? -4 : 0) + (ar ? (/^ar-EG/i.test(v.lang) ? 8 : /^ar-SA/i.test(v.lang) ? 6 : /^ar/i.test(v.lang) ? 4 : -20) : (/^en-US/i.test(v.lang) ? 2 : 0));
  const bVoices = () => HAS ? speechSynthesis.getVoices().filter(v => /^(ar|en)/i.test(v.lang)) : [];
  let keep = null;
  register({
    id: "browser", label: "صوت المتصفح (من جهازك، مجاني)", kind: "speech",
    available: () => HAS && bVoices().length > 0,   // من غير أي صوت متسطّب مفيش حاجة تتكلم
    caps: () => ({ pitch: true, mixed: false, langs: ["ar", "en"] }),
    voices: () => bVoices().map(v => ({ id: v.name, name: v.name.replace(/^Microsoft\s+/, "").replace(/\s*Online \(Natural\)\s*-\s*/, " — "), lang: /^ar/i.test(v.lang) ? "ar" : "en", gender: gen(v) })),
    speak({ text, lang, voice, rate, pitch }) {
      return new Promise((res, rej) => {
        const pool = bVoices().filter(v => (lang === "en" ? /^en/i : /^ar/i).test(v.lang));
        const v = bVoices().find(x => x.name === voice && (lang === "en" ? /^en/i : /^ar/i).test(x.lang)) || pool.sort((a, b) => score(b, lang === "ar") - score(a, lang === "ar"))[0];
        // مفيش صوت عربي متسطّب في الجهاز/المتصفح: المتصفح كان بيقرا العربي بصوت إنجليزي = كلام بلغة مش مفهومة. منقرأهوش وبنقول السبب
        // → نقول للمشغّل إن المتصفح ده مينفعش للعربي، فيكمّل بالمحرك اللي بعده («كريم») بدل كلام بلغة مش مفهومة
        if (lang === "ar" && !v && bVoices().length) return rej(new Error("NOSUPPORT: مفيش صوت عربي متسطّب في المتصفح ده (جرّب Microsoft Edge أو Chrome على أندرويد)"));
        const u = new SpeechSynthesisUtterance(text); if (v) { u.voice = v; u.lang = v.lang; } else u.lang = lang === "en" ? "en-US" : "ar-EG";
        u.rate = rate || 1; u.pitch = pitch || 1; u.onend = u.onerror = () => res(); keep = u; speechSynthesis.speak(u);
      });
    },
    cancel: () => { if (HAS) speechSynthesis.cancel(); }
  });
  if (HAS) speechSynthesis.addEventListener?.("voiceschanged", emit);
  window.addEventListener("proxy-health", emit);

  // ---------- واجهة الطبقة ----------
  // plan(text, provider): تقسيم النص لأجزاء قصيرة (جمل) + لغة كل جزء، عشان الصوت يبدأ بسرعة ويتولّد على دفعات
  function plan(text, p, { first = true } = {}) {
    // السيرفر (Azure وغيره): أجزاء كبيرة = طلبات أقل (باقة Azure المجانية ٢٠ طلب في الدقيقة) — أول جملة بس قصيرة عشان الصوت يبدأ على طول
    const mixed = p?.caps().mixed, big = (p?.id === "server" || p?.id === "puter") && mixed ? 900 : first ? 140 : 220, parts = window.splitChunks ? splitChunks(text, big) : [text], out = [];
    const fmax = p?.id === "local" ? 55 : 70;   // أول جملة قصيرة = الصوت يبدأ أسرع
    if (first && parts[0] && parts[0].length > fmax + 20 && window.splitChunks) { const [a, ...r] = splitChunks(parts[0], fmax); parts.splice(0, 1, a, ...((p?.id === "server" || p?.id === "puter") && mixed ? [r.join(" ")] : r)); }
    for (const c of parts) {
      if (mixed || S.lang !== "auto" || (one() && p?.id !== "browser")) { out.push({ t: c, l: langOf(c) }); continue; }
      out.push(...splitLang(c));   // المحركات اللي مبتخلطش لغتين: كل جزء بصوت لغته، ومن غير ما حاجة تتشال
    }
    return out.map(({ t, l }) => ({ t: t.trim(), l })).filter(x => x.t);
  }
  const segText = seg => seg.l === "ar" ? normalizeArabicTTS(seg.t) : seg.t;
  const synth = async (p, seg, signal) => { const r = await p.synth({ text: segText(seg), lang: seg.l, voice: voiceFor(p, seg.l), pitch: p.caps().pitch ? S.pitch : 1, rate: +S.rate || 1, signal }); return typeof r === "string" ? { url: r, rate: 1 } : r; };
  const speakWith = (p, seg) => p.speak({ text: segText(seg), lang: seg.l, voice: voiceFor(p, seg.l), rate: S.rate, pitch: S.pitch });

  // آخر تشغيل نجح فعلًا (المحرك + الصوت اللي رجع الصوت) — عشان الإعدادات متقولش «شغال» غير لو اشتغل بجد
  let LAST = null; try { LAST = JSON.parse(localStorage.getItem("tts.last") || "null"); } catch {}
  function played(p, meta) { const vid = meta?.voice || ""; const v = p.voices?.().find(x => x.id === vid);
    LAST = { id: p.id, label: p.label, engine: meta?.provider || p.id, voice: v?.name || vid, at: Date.now() }; try { localStorage.setItem("tts.last", JSON.stringify(LAST)); } catch {} emit(); }
  window.TTS = { splitLang, arPrep, played, last: () => LAST, register, providers: () => ORDER.map(id => P.get(id)), get: id => P.get(id), chain, current, after, markDown, isDown,
    settings: () => S, oneVoice: one, shownVoice, set, onChange: f => { subs.add(f); return () => subs.delete(f); }, RATES, TEACHERS, voiceFor, plan, synth, speakWith, langOf };
})();

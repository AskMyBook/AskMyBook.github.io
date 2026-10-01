// ===== إعدادات الصوت المركزية — مكان واحد لكل إعدادات صوت المدرّس =====
// كلها environment variables على السيرفر (مفيش حاجة منها في كود الموقع):
//
//   VOICE_PROVIDER    المحرك الأساسي: azure | elevenlabs | openai | openai_compatible | piper
//                     (ممكن قايمة بالترتيب: "elevenlabs,azure"). نفس TTS_PROVIDER القديم — لو الاتنين موجودين VOICE_PROVIDER بيكسب.
//   VOICE_ID          صوت واحد للعربي والإنجليزي والكلام المخلوط (للمحرك الأساسي).
//                     أمثلة: ar-EG-ShakirNeural (Azure) — ID صوت من ElevenLabs — ash (OpenAI)
//   VOICE_NAME        اسم الصوت اللي يظهر في الإعدادات (اختياري)
//   VOICE_MODEL       الموديل: ElevenLabs eleven_multilingual_v2 (الافتراضي) / eleven_v3 — OpenAI gpt-4o-mini-tts — سيرفر متوافق مع OpenAI
//   VOICE_SPEED       سرعة أساسية 0.7–1.3 (الافتراضي 1). سرعة الطالب في الموقع بتتضرب فيها. 0.95 بتدّي إحساس مدرّس هادي.
//   VOICE_STABILITY   ElevenLabs 0–1 (الافتراضي 0.45): أقل = تعبير أكتر، أعلى = ثبات أكتر
//   VOICE_SIMILARITY  ElevenLabs 0–1 (الافتراضي 0.8): قد إيه يفضل شبه الصوت الأصلي
//   VOICE_STYLE       رقم 0–1 = ElevenLabs style (الافتراضي 0.25). نص = تعليمات أسلوب الكلام لـ OpenAI (gpt-4o-mini-tts)
//   VOICE_ONE         true (الافتراضي) = نفس الصوت لكل اللغات. false = صوت عربي وصوت إنجليزي منفصلين (الطريقة القديمة)
const num = (x, lo, hi, d) => { const n = parseFloat(x); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const ID = /^[\w.:\-]{1,80}$/;

export function voiceConfig(env = {}) {
  const provider = String(env.VOICE_PROVIDER || env.TTS_PROVIDER || "").trim();
  const style = String(env.VOICE_STYLE ?? "").trim(), styleNum = /^\d*\.?\d+$/.test(style);
  const vid = String(env.VOICE_ID || "").trim();
  return {
    provider,                                   // "" = الترتيب التلقائي
    primary: provider.split(",")[0].trim(),
    voiceId: ID.test(vid) ? vid : "",
    voiceName: String(env.VOICE_NAME || "").trim().slice(0, 60),
    model: String(env.VOICE_MODEL || "").trim(),
    speed: num(env.VOICE_SPEED, 0.7, 1.3, 1),
    stability: num(env.VOICE_STABILITY, 0, 1, 0.45),
    similarity: num(env.VOICE_SIMILARITY, 0, 1, 0.8),
    style: styleNum ? num(style, 0, 1, 0.25) : 0.25,
    instructions: styleNum ? "" : style.slice(0, 600),
    one: String(env.VOICE_ONE ?? "true").trim().toLowerCase() !== "false"
  };
}

// تحذيرات إعداد واضحة (من غير أسرار)
export function voiceWarnings(env = {}) {
  const w = [], vid = String(env.VOICE_ID || "").trim();
  if (vid && !ID.test(vid)) w.push("VOICE_ID فيه حروف مش مسموحة — اتجاهل");
  if (env.VOICE_PROVIDER && env.TTS_PROVIDER && env.VOICE_PROVIDER !== env.TTS_PROVIDER) w.push("VOICE_PROVIDER و TTS_PROVIDER الاتنين متحددين — اتستخدم VOICE_PROVIDER");
  for (const k of ["VOICE_SPEED", "VOICE_STABILITY", "VOICE_SIMILARITY"]) if (env[k] && !Number.isFinite(parseFloat(env[k]))) w.push(`${k} لازم يكون رقم`);
  return w;
}

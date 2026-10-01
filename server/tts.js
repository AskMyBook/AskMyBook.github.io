// ===== طبقة تحويل النص لصوت (TTS) على السيرفر — مستقلة تمامًا عن الذكاء الاصطناعي =====
// الـ AI بيولّد النص بس، والطبقة دي بتحوّل النص لصوت بس. مفيش أي اعتماد على Gemini هنا.
//
// كل مزوّد (Provider/Adapter) ليه نفس الشكل:
//   { id, label, configured(env), caps: { pitch, mixed, langs, clone }, voices(env), owns(voiceId, env), synth(env, req) → Response(audio stream) }
// req = { text, lang: "ar"|"en", voice, pitch (0.5–1.5), rate (0.5–2) }
//
// عشان تضيف محرك جديد: اكتب adapter بنفس الشكل وضيفه في PROVIDERS — من غير ما تلمس الموقع.
// الترتيب: TTS_PROVIDER (قايمة مفصولة بفاصلة) وإلا التلقائي: piper ← openai_compatible ← azure ← elevenlabs ← openai
// ولو مزوّد فشل، اللي بعده بيتجرّب تلقائيًا.

import { voiceConfig, voiceWarnings } from "./voice-config.js";
// صوت واحد (VOICE_ONE، الافتراضي): نفس الصوت بيقرا العربي والإنجليزي والمخلوط — مفيش تبديل صوت حسب اللغة.
// VOICE_ID بيبقى الصوت الافتراضي للمحرك الأساسي في اللغتين.
const primaryId = env => { const C = voiceConfig(env); return PROVIDERS[C.primary] ? C.primary : ttsChain(env)[0]; };
function withVoiceId(id, env, list) {
  const C = voiceConfig(env); if (!C.voiceId || id !== primaryId(env)) return list;
  const known = list.find(v => v.id === C.voiceId), name = C.voiceName || known?.name || C.voiceId, g = known?.gender || "";
  return [{ id: C.voiceId, name, lang: "ar", gender: g, default: true }, { id: C.voiceId, name, lang: "en", gender: g, default: true },
    ...list.filter(v => v.id !== C.voiceId).map(v => ({ ...v, default: false }))];
}
// الصوت اللي هيقرا الطلب ده: اللي الموقع طلبه، وإلا (صوت واحد) الصوت الأساسي للمحرك، وإلا صوت لغة النص
function pickVoice(vs, q, env) { return vs.find(x => x.id === q.voice) || (voiceConfig(env).one ? byLang(vs, "ar") : byLang(vs, q.lang)); }
const modelFor = (id, env, d) => { const C = voiceConfig(env); return C.model && id === primaryId(env) ? C.model : d; };
const jsonEnv = (s, d) => { try { const v = s ? JSON.parse(s) : d; return Array.isArray(d) && !(Array.isArray(v) && v.length && v.every(x => x && x.id && x.lang)) ? d : v; } catch { return d; } };
const xml = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const clip = (s, n = 200) => String(s ?? "").slice(0, n);
export const ttsErr = (m, status = 502) => Object.assign(new Error(m), { status });

async function upstream(r, name) {
  if (r.ok) return r;
  let m = ""; try { const j = await r.json(); m = j.error?.message || j.error || j.message || j.detail?.message || j.detail || JSON.stringify(j); } catch { m = await r.text().catch(() => ""); }
  if (r.status === 401 || r.status === 403) throw Object.assign(ttsErr(`${name}: المفتاح غلط أو منتهي أو مش مسموح له بالخدمة دي (${r.status})`, 502), { code: "auth" });
  throw ttsErr(`${name}: ${r.status === 429 ? "وصلت لحد المزوّد" : clip(m) || "HTTP " + r.status}`, r.status === 429 ? 429 : 502);
}
// كل طلب لمزوّد صوت ليه حد زمني — عشان لو المزوّد علّق، المشغّل ميفضلش مستني للأبد
let TIMEOUT = 20000;   // TTS_TIMEOUT_MS في الـ env بيغيّره
async function tfetch(name, url, init, ms = TIMEOUT) {
  try { return await fetch(url, { ...init, signal: AbortSignal.timeout(ms) }); }
  catch (e) { throw Object.assign(ttsErr(`${name}: ${e?.name === "TimeoutError" || e?.name === "AbortError" ? "اتأخر في الرد (أكتر من " + ms / 1000 + " ثانية)" : "مش قادر يوصل للخدمة (" + clip(e?.message, 80) + ")"}`, 504), { code: "timeout" }); }
}
// عربي / إنجليزي عشان كل جزء يتقري بنطقه الصح (للمحركات اللي بتدعم أكتر من صوت في نفس الطلب)
// كلمة إنجليزي = حرفين لاتيني على الأقل (DNA, cell). الحرف الواحد (x في معادلة) بيفضل مع الكلام العربي.
function segments(text) {
  const out = [], re = /[A-Za-z][A-Za-z0-9'’&.\-]*[A-Za-z0-9](?:[\s,]+[A-Za-z][A-Za-z0-9'’&.\-]*)*/g; let last = 0, m;
  while ((m = re.exec(text))) { if (m.index > last) out.push({ en: false, t: text.slice(last, m.index) }); out.push({ en: true, t: m[0] }); last = m.index + m[0].length; }
  if (last < text.length) out.push({ en: false, t: text.slice(last) });
  // أرقام/رموز من غير حروف عربي بعد كلام إنجليزي = تبع الجملة الإنجليزي (Solve 2x + 3 …)
  out.forEach((x, i) => { if (!x.en && !/[\u0600-\u06FF]/.test(x.t) && (out[i - 1]?.en || (i === 0 && out[1]?.en))) x.en = true; });
  // «Solve 2x + 3 = 7 وبعدين…»: المعادلة اللي بعد الكلام الإنجليزي على طول تفضل معاه لحد أول حرف عربي
  for (let i = 1; i < out.length; i++) { const x = out[i], p = out[i - 1]; if (x.en || !p.en) continue;
    const k = x.t.search(/[\u0600-\u06FF]/), lead = k > 0 ? x.t.slice(0, k).replace(/\S+$/, "") : ""; if (/[0-9A-Za-z]/.test(lead)) { p.t += lead; x.t = x.t.slice(lead.length); } }
  const merged = []; for (const x of out) { const p = merged[merged.length - 1]; if (p && p.en === x.en) p.t += x.t; else merged.push({ ...x }); }
  return merged.filter(x => x.t.trim());
}
// x-tts-rate = السرعة اللي المحرك طبّقها فعلًا (الموقع بيكمّل الفرق بتسريع التشغيل لو المحرك ليه حد)
const audio = (r, prov, voice, type, rate = 1) => new Response(r.body, { headers: { "content-type": type || (/^audio\//.test(r.headers.get("content-type") || "") ? r.headers.get("content-type") : "audio/mpeg"), "cache-control": "private, max-age=86400", "x-tts-provider": prov, "x-tts-voice": voice || "", "x-tts-rate": String(rate) } });
const byLang = (list, lang) => list.find(v => v.lang === lang && v.default) || list.find(v => v.lang === lang) || list[0];

// ---------- Piper (مفتوح المصدر، استضافة ذاتية، سريع على CPU) ----------
// pip install "piper-tts[http]" ثم python3 -m piper.http_server -m ar_JO-kareem-medium --port 5000
// POST /synthesize {"text","voice","length_scale"} → wav (النسخ القديمة: POST /). Piper على السيرفر بيشكّل العربي تلقائيًا (tashkeel) فنطقه أحسن.
const PIPER_DEFAULT = [
  { id: "ar_JO-kareem-medium", name: "كريم — عربي", lang: "ar", gender: "m", default: true },
  { id: "en_US-ryan-medium", name: "Ryan — English", lang: "en", gender: "m", default: true }
];
const piper = {
  id: "piper", label: "Piper (سيرفر خاص)", caps: { pitch: false, mixed: false, langs: ["ar", "en"], clone: false },
  configured: env => !!env.PIPER_URL,
  voices: env => withVoiceId("piper", env, jsonEnv(env.PIPER_VOICES, PIPER_DEFAULT)),
  owns(v, env) { return this.voices(env).some(x => x.id === v); },
  async synth(env, q) {
    const vs = this.voices(env), v = pickVoice(vs, q, env), sp = q.rate * voiceConfig(env).speed;
    const base = env.PIPER_URL.replace(/\/+$/, ""), init = { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: q.text, voice: v.id, length_scale: +(1 / sp).toFixed(3) }) };
    let r = await tfetch("piper", base + "/synthesize", init); if (r.status === 404 || r.status === 405) r = await tfetch("piper", base + "/", init);
    await upstream(r, "piper");
    return audio(r, "piper", v.id, "audio/wav", q.rate);   // Piper بيرجّع wav من غير content-type صح
  }
};

// ---------- أي سيرفر TTS متوافق مع OpenAI (استضافة ذاتية) ----------
// مثال: openedai-speech (Piper + XTTS v2 ويدعم استنساخ صوتك من تسجيل)، Kokoro-FastAPI، أو أي خدمة بنفس الـ API.
const oaiCompat = {
  id: "openai_compatible", label: "سيرفر TTS خاص (متوافق مع OpenAI)", caps: { pitch: false, mixed: true, langs: ["ar", "en"], clone: true },
  configured: env => !!env.TTS_OAI_URL,
  voices: env => withVoiceId("openai_compatible", env, jsonEnv(env.TTS_OAI_VOICES, [{ id: "alloy", name: "alloy", lang: "ar", gender: "m", default: true }, { id: "echo", name: "echo", lang: "en", gender: "m", default: true }])),
  owns(v, env) { return this.voices(env).some(x => x.id === v); },
  async synth(env, q) {
    const vs = this.voices(env), v = pickVoice(vs, q, env), sp = q.rate * voiceConfig(env).speed;
    const r = await upstream(await tfetch("openai_compatible", env.TTS_OAI_URL.replace(/\/+$/, "") + "/audio/speech", { method: "POST",
      headers: { "content-type": "application/json", ...(env.TTS_OAI_KEY ? { authorization: "Bearer " + env.TTS_OAI_KEY } : {}) },
      body: JSON.stringify({ model: modelFor("openai_compatible", env, env.TTS_OAI_MODEL || "tts-1"), voice: v.id, input: q.text, speed: +sp.toFixed(3), response_format: "mp3" }) }), "openai_compatible");
    return audio(r, "openai_compatible", v.id, "", q.rate);
  }
};

// ---------- Azure Speech (أصوات Neural: «شاكر» المصري وغيره — فيه طبقة صوت pitch) ----------
const AZ_DEFAULT = [
  { id: "ar-EG-ShakirNeural", name: "شاكر — مصري", lang: "ar", gender: "m", default: true },
  { id: "ar-EG-SalmaNeural", name: "سلمى — مصري", lang: "ar", gender: "f" },
  { id: "ar-SA-HamedNeural", name: "حامد — سعودي", lang: "ar", gender: "m" },
  { id: "en-US-AndrewMultilingualNeural", name: "Andrew — English", lang: "en", gender: "m", default: true },
  { id: "en-US-AvaMultilingualNeural", name: "Ava — English", lang: "en", gender: "f" }
];
const azure = {
  id: "azure", label: "Azure Speech", caps: { pitch: true, mixed: true, langs: ["ar", "en"], clone: false },
  configured: env => !!env.AZURE_SPEECH_KEY,
  voices: env => withVoiceId("azure", env, jsonEnv(env.AZURE_VOICES, AZ_DEFAULT)),
  owns(v, env) { return this.voices(env).some(x => x.id === v); },
  async synth(env, q) {
    const C = voiceConfig(env), vs = this.voices(env), main = pickVoice(vs, q, env), en = byLang(vs, "en");
    const pitch = Math.round((q.pitch - 1) * 100), rate = Math.round((q.rate * C.speed - 1) * 100), pros = t => `<prosody pitch="${pitch >= 0 ? "+" : ""}${pitch}%" rate="${rate >= 0 ? "+" : ""}${rate}%">${t}</prosody>`;
    let body;
    if (C.one) {   // صوت واحد لكل الكلام. الأصوات Multilingual بتاخد كل جزء بنطق لغته (<lang>) من غير ما الصوت يتغيّر
      const multi = /multilingual/i.test(main.id), loc = { ar: /^ar-/i.test(main.id) ? main.id.slice(0, 5) : "ar-EG", en: "en-US" };
      body = `<voice name="${main.id}">${pros(multi ? segments(q.text).map(s => `<lang xml:lang="${s.en ? loc.en : loc.ar}">${xml(s.t)}</lang>`).join(" ") : xml(q.text))}</voice>`;
    } else {   // VOICE_ONE=false: الطريقة القديمة (العربي بصوت عربي والكلام الإنجليزي بصوت إنجليزي)
      let segs = q.lang === "en" || main.lang === "en" ? [{ en: true, t: q.text }] : segments(q.text);
      if (segs.length > 45) segs = [{ en: false, t: q.text }];   // Azure: أقصى ٥٠ <voice> في الطلب
      if (main.lang !== "en") segs = segs.map(x => x.en && !/[A-Za-z]{2}/.test(x.t) ? { ...x, en: false } : x);
      body = segs.map(s => `<voice name="${s.en && main.lang !== "en" ? en.id : main.id}">${pros(xml(s.t))}<break time="120ms"/></voice>`).join("");
    }
    const url = env.AZURE_TTS_URL || `https://${env.AZURE_SPEECH_REGION || "westeurope"}.tts.speech.microsoft.com/cognitiveservices/v1`;
    const init = { method: "POST", headers: { "Ocp-Apim-Subscription-Key": env.AZURE_SPEECH_KEY, "content-type": "application/ssml+xml", "X-Microsoft-OutputFormat": "audio-24khz-96kbitrate-mono-mp3", "user-agent": "study-tutor" },
      body: `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${main.id.slice(0, 5)}">${body}</speak>` };
    let r = await tfetch("azure", url, init);
    if (r.status === 429) { const wait = Math.min(3, +r.headers.get("retry-after") || 1.5); await new Promise(res => setTimeout(res, wait * 1000)); r = await tfetch("azure", url, init); }   // الباقة المجانية: ٢٠ طلب في الدقيقة
    await upstream(r, "azure");
    return audio(r, "azure", main.id, "", q.rate);
  }
};

// ---------- ElevenLabs (أصوات طبيعية جدًا + استنساخ صوتك بتسجيلات قانونية) ----------
const elevenlabs = {
  id: "elevenlabs", label: "ElevenLabs", caps: { pitch: false, mixed: true, langs: ["ar", "en"], clone: true },
  configured: env => !!env.ELEVENLABS_API_KEY,
  voices: env => withVoiceId("elevenlabs", env, jsonEnv(env.ELEVENLABS_VOICES, [{ id: "pNInz6obpgDQGcFmaJgB", name: "Adam", lang: "ar", gender: "m", default: true }, { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", lang: "en", gender: "m", default: true }])),
  owns(v, env) { return this.voices(env).some(x => x.id === v); },
  async synth(env, q) {
    const C = voiceConfig(env), vs = this.voices(env), v = pickVoice(vs, q, env);
    const sp = Math.min(1.2, Math.max(0.7, q.rate * C.speed));   // ElevenLabs بيقبل 0.7–1.2 بس، والباقي بيتكمّل في المتصفح
    const r = await upstream(await tfetch("elevenlabs", `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(v.id)}/stream?output_format=mp3_44100_128`, { method: "POST",
      headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({ text: q.text, model_id: modelFor("elevenlabs", env, env.ELEVENLABS_MODEL || "eleven_multilingual_v2"), voice_settings: { stability: C.stability, similarity_boost: C.similarity, style: C.style, use_speaker_boost: true, speed: +sp.toFixed(3) } }) }), "elevenlabs");
    return audio(r, "elevenlabs", v.id, "", +(sp / C.speed).toFixed(3));   // السرعة الأساسية (VOICE_SPEED) مقصودة فمش بتتعوّض في المتصفح
  }
};

// ---------- OpenAI TTS ----------
// صوت واحد: نفس المدرّس بنفس الشخصية في اللغتين — مصري طبيعي للكلام المصري، وإنجليزي طبيعي للإنجليزي، وتنقّل ناعم بينهم
const ONE_STYLE = "You are one warm, calm, patient teacher talking to a student. Keep exactly the same voice and personality the whole time. When the text is Egyptian Arabic, speak natural colloquial Egyptian Arabic (not formal MSA, not a news reader). When it is English, speak natural conversational English. Switch smoothly between Arabic and English inside the same sentence without changing voice. Natural rhythm, short pauses at commas and full stops, gentle emphasis on key terms, never robotic or rushed.";
const STYLE = { ar: "Speak natural Egyptian Arabic like a calm, clear, patient teacher explaining a lesson: natural pauses between sentences, gentle emphasis on key words, never robotic.", en: "Speak natural, warm English like a calm, clear, patient teacher explaining a lesson: natural pauses, gentle emphasis on key words, never robotic." };
const openai = {
  id: "openai", label: "OpenAI TTS", caps: { pitch: false, mixed: true, langs: ["ar", "en"], clone: false },
  configured: env => !!env.OPENAI_API_KEY && env.OPENAI_TTS_DISABLED !== "true",
  voices: env => withVoiceId("openai", env, jsonEnv(env.OPENAI_TTS_VOICES, [{ id: "ash", name: "Ash", lang: "ar", gender: "m", default: true }, { id: "ash", name: "Ash", lang: "en", gender: "m", default: true }, { id: "coral", name: "Coral", lang: "ar", gender: "f" }])),
  owns(v, env) { return this.voices(env).some(x => x.id === v); },
  async synth(env, q) {
    const C = voiceConfig(env), vs = this.voices(env), v = pickVoice(vs, q, env), sp = q.rate * C.speed;
    const r = await upstream(await tfetch("openai", (env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "") + "/audio/speech", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + env.OPENAI_API_KEY },
      body: JSON.stringify({ model: modelFor("openai", env, env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts"), voice: v.id, input: q.text, instructions: C.instructions || (C.one ? ONE_STYLE : STYLE[q.lang] || STYLE.ar), speed: +sp.toFixed(3), response_format: "mp3" }) }), "openai");
    return audio(r, "openai", v.id, "", q.rate);
  }
};

export const PROVIDERS = { piper, openai_compatible: oaiCompat, azure, elevenlabs, openai };
const AUTO = ["piper", "openai_compatible", "azure", "elevenlabs", "openai"];

// TTS_PROVIDER=azure,piper → دول بس وبالترتيب ده. TTS_AUTO_FALLBACK=true → وبعدهم أي محرك تاني متظبط.
// من غير TTS_PROVIDER: كل المحركات المتظبطة بالترتيب التلقائي.
const KEYS = { piper: "PIPER_URL", openai_compatible: "TTS_OAI_URL", azure: "AZURE_SPEECH_KEY", elevenlabs: "ELEVENLABS_API_KEY", openai: "OPENAI_API_KEY" };
export function ttsChain(env) {
  const want = voiceConfig(env).provider.split(",").map(s => s.trim()).filter(s => PROVIDERS[s]);
  return [...new Set([...want, ...AUTO])].filter(id => (want.length ? want.includes(id) || env.TTS_AUTO_FALLBACK === "true" : true) && PROVIDERS[id].configured(env));
}
// تحذيرات إعداد واضحة (من غير أسرار) بتظهر في /v1/health و /api/tts/voices
export function ttsWarnings(env) {
  const w = [...voiceWarnings(env)], names = voiceConfig(env).provider.split(",").map(s => s.trim()).filter(Boolean);
  names.filter(n => !PROVIDERS[n]).forEach(n => w.push(`VOICE_PROVIDER/TTS_PROVIDER فيه اسم مش معروف: «${n}» (المتاح: ${AUTO.join(", ")})`));
  names.filter(n => PROVIDERS[n] && !PROVIDERS[n].configured(env)).forEach(n => w.push(n === "openai" && env.OPENAI_TTS_DISABLED === "true" ? "openai مطلوب في TTS_PROVIDER بس OPENAI_TTS_DISABLED=true" : `TTS_PROVIDER فيه ${n} بس ${KEYS[n]} مش موجود`));
  if (env.AZURE_SPEECH_KEY && !env.AZURE_SPEECH_REGION && !env.AZURE_TTS_URL) w.push("AZURE_SPEECH_REGION مش متحدد — هيتستخدم westeurope. لازم يطابق الـ Region بتاع المفتاح");
  for (const [k, id] of [["PIPER_VOICES", "piper"], ["TTS_OAI_VOICES", "openai_compatible"], ["AZURE_VOICES", "azure"], ["ELEVENLABS_VOICES", "elevenlabs"], ["OPENAI_TTS_VOICES", "openai"]])
    if (env[k]) { let ok = false; try { const v = JSON.parse(env[k]); ok = Array.isArray(v) && v.every(x => x && x.id && x.lang); } catch {} if (!ok) w.push(`${k} مش JSON صحيح (لازم قايمة [{"id","name","lang","gender"}]) — اتستخدمت الأصوات الافتراضية`); }
  if (!ttsChain(env).length) w.push("مفيش محرك صوت متظبط على السيرفر (حط AZURE_SPEECH_KEY أو PIPER_URL أو غيرهم)");
  return w;
}
export function ttsInfo(env) {
  const chain = ttsChain(env); if (!chain.length) return null;
  const P = chain.map(id => ({ id, label: PROVIDERS[id].label, caps: PROVIDERS[id].caps, voices: PROVIDERS[id].voices(env).map(v => ({ ...v, provider: id })) }));
  const C = voiceConfig(env);
  return { provider: chain[0], chain, caps: P[0].caps, providers: P, voices: P.flatMap(p => p.voices), oneVoice: C.one, voiceId: C.voiceId && chain[0] === primaryId(env) ? C.voiceId : "", warnings: ttsWarnings(env) };
}

// POST /api/tts → { text, lang?, voice?, pitch?, rate? } → صوت (stream). لو المزوّد الأول فشل بيتجرّب اللي بعده.
export async function ttsHandle(b, env) {
  TIMEOUT = Math.min(60000, Math.max(2000, +env.TTS_TIMEOUT_MS || 20000));
  const chain = ttsChain(env); if (!chain.length) throw ttsErr(ttsWarnings(env).join(" — ") || "مفيش محرك صوت متظبط على السيرفر", 503);
  if (typeof b.text !== "string" || !b.text.trim()) throw ttsErr("لازم تبعت نص (text)", 400);
  const max = +env.MAX_TTS_CHARS || 1500, text = b.text.replace(/\s+/g, " ").trim();
  if (text.length > max) throw ttsErr(`النص طويل (${text.length} حرف) — الحد ${max} في الطلب الواحد، قسّمه لجمل`, 413);
  const lang = /^en/i.test(b.lang || "") ? "en" : /^ar/i.test(b.lang || "") ? "ar" : (text.match(/[A-Za-z]/g) || []).length > (text.match(/[؀-ۿ]/g) || []).length * 3 ? "en" : "ar";
  const num = (x, lo, hi, d) => { const n = +x; return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
  const voice = typeof b.voice === "string" && /^[\w.:\-]{1,80}$/.test(b.voice) ? b.voice : "";
  const q = { text, lang, voice, pitch: num(b.pitch, 0.5, 1.5, 1), rate: num(b.rate, 0.5, 2, 1) };
  const order = voice ? [...chain.filter(id => PROVIDERS[id].owns(voice, env)), ...chain.filter(id => !PROVIDERS[id].owns(voice, env))] : chain;
  const errs = [];
  for (const id of order) {
    try { const r = await PROVIDERS[id].synth(env, { ...q, voice: PROVIDERS[id].owns(voice, env) ? voice : "" });
      if (errs.length) r.headers.set("x-tts-fallback", encodeURIComponent(errs.map(x => x.message).join(" | ").slice(0, 300)));   // الموقع بيعرّف الطالب إن محرك وقع واتبدّل
      return r; }
    catch (e) { errs.push(e); }
  }
  const all429 = errs.every(x => x.status === 429), auth = errs.some(x => x.code === "auth"), to = errs.every(x => x.code === "timeout");
  throw Object.assign(ttsErr(errs.map(x => x.message).join(" | "), all429 ? 429 : to ? 504 : 502), { code: auth ? "auth" : to ? "timeout" : errs.some(x => x.status === 429) ? "rate" : "provider" });
}

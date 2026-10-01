// ===== سلسلة مزوّدين الشات: اللي يخلص حصته أو يقع، ننط للي بعده أوتوماتيك =====
// كل مزوّد هنا رسمي وبطبقة مجانية شرعية (أو مدفوع لو صاحب الموقع حط مفتاحه). مفيش تدوير حسابات.
// الترتيب: LLM_ORDER (من صفحة الأدمن) ← LLM_PROVIDER (القديم، ممكن قايمة بفواصل) ← الافتراضي (المجاني الأول).
// المزوّد اللي يرجّع 429 بياخد «راحة» لحد ما الحد يتجدد، والمفتاح الغلط (401/403) بياخد راحة أطول، وكده محدش بيستنى على مزوّد خلصان.

const oa = (id, label, base, keyName, model, vision, link, extraHeaders = {}) => ({
  id, label, keyName, link, kind: "openai",
  configured: env => !!env[keyName],
  base: env => (id === "openai" ? (env.OPENAI_BASE_URL || base) : base).replace(/\/+$/, ""),
  model: env => env[id.toUpperCase() + "_MODEL"] || model, defaultModel: model,
  vision: env => (id === "openai" ? env.LLM_VISION !== "false" : env[id.toUpperCase() + "_VISION"] === "true" || vision),
  headers: env => ({ authorization: "Bearer " + env[keyName], ...extraHeaders })
});

export const CHAT_PROVIDERS = [
  { id: "gemini", label: "Google Gemini", keyName: "GEMINI_API_KEY", link: "https://aistudio.google.com/apikey", kind: "gemini",
    configured: env => !!env.GEMINI_API_KEY, model: env => env.GEMINI_MODEL || "gemini-3.8-flash", defaultModel: "gemini-3.8-flash", vision: () => true },
  { id: "geminilite", label: "Google Gemini Lite (احتياطي)", keyName: "GEMINI_API_KEY", link: "https://aistudio.google.com/apikey", kind: "gemini",
    configured: env => !!env.GEMINI_API_KEY, model: env => env.GEMINILITE_MODEL || "gemini-flash-lite-latest", defaultModel: "gemini-flash-lite-latest", vision: () => true },
  oa("groq", "Groq", "https://api.groq.com/openai/v1", "GROQ_API_KEY", "openai/gpt-oss-120b", false, "https://console.groq.com/keys"),
  oa("openrouter", "OpenRouter", "https://openrouter.ai/api/v1", "OPENROUTER_API_KEY", "openrouter/free", true, "https://openrouter.ai/settings/keys", { "x-title": "Study Tutor" }),
  oa("nvidia", "NVIDIA NIM", "https://integrate.api.nvidia.com/v1", "NVIDIA_API_KEY", "nvidia/nemotron-3-super-120b-a12b", false, "https://build.nvidia.com/settings/api-keys"),
  { id: "cloudflare", label: "Cloudflare Workers AI", keyName: "", link: "https://developers.cloudflare.com/workers-ai/", kind: "cfai",
    configured: env => !!env.AI?.run, model: env => env.CLOUDFLARE_MODEL || "@cf/meta/llama-3.3-70b-instruct-fp8-fast", defaultModel: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", vision: () => false },
  { id: "anthropic", label: "Anthropic Claude (مدفوع)", keyName: "ANTHROPIC_API_KEY", link: "https://console.anthropic.com/settings/keys", kind: "anthropic",
    configured: env => !!env.ANTHROPIC_API_KEY, model: env => env.ANTHROPIC_MODEL || "claude-sonnet-5-5", defaultModel: "claude-sonnet-5-5", vision: () => true },
  oa("openai", "OpenAI (مدفوع)", "https://api.openai.com/v1", "OPENAI_API_KEY", "gpt-4o-mini", true, "https://platform.openai.com/api-keys")
];
export const DEFAULT_ORDER = CHAT_PROVIDERS.map(p => p.id);
const byId = Object.fromEntries(CHAT_PROVIDERS.map(p => [p.id, p]));
const list = s => String(s || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean);

// الترتيب الكامل (حتى اللي مش متظبط) — صفحة الأدمن بتعرضه
export function chatOrder(env) {
  const want = list(env.LLM_ORDER).length ? list(env.LLM_ORDER) : list(env.LLM_PROVIDER);
  const head = want.filter(id => byId[id]);
  // لو LLM_PROVIDER القديم محدد مزوّد واحد، يفضل هو بس (زي السلوك القديم). الأدمن بيحدد الترتيب الكامل
  const tail = list(env.LLM_ORDER).length || !want.length ? DEFAULT_ORDER.filter(id => !head.includes(id)) : [];
  return [...head, ...tail];
}
// السلسلة الفعلية: المتظبط ومش مقفول من الأدمن
export function chatChain(env) {
  const off = new Set(list(env.LLM_DISABLED));
  return chatOrder(env).filter(id => !off.has(id) && byId[id].configured(env));
}
export const providerById = id => byId[id];

// ---------- حالة كل مزوّد (لكل نسخة من السيرفر — تقريبية) ----------
const STAT = new Map();
const today = () => new Date().toISOString().slice(0, 10);
export function statOf(id) {
  let s = STAT.get(id); if (!s || s.day !== today()) { s = { day: today(), ok: 0, fail: 0, lastError: s?.lastError || "", lastErrorAt: s?.lastErrorAt || 0, coolUntil: s?.coolUntil || 0, lastUsed: s?.lastUsed || 0 }; STAT.set(id, s); }
  return s;
}
export function providerStatus(env) {
  const now = Date.now();
  return chatOrder(env).map(id => { const p = byId[id], s = statOf(id);
    return { id, label: p.label, keyName: p.keyName, link: p.link, model: p.model(env), defaultModel: p.defaultModel, vision: !!p.vision(env),
      configured: p.configured(env), disabled: list(env.LLM_DISABLED).includes(id), okToday: s.ok, failToday: s.fail,
      resting: s.coolUntil > now ? Math.ceil((s.coolUntil - now) / 1000) : 0, lastError: s.lastError, lastErrorAt: s.lastErrorAt, lastUsed: s.lastUsed }; });
}
export const resetCooldown = id => { if (id) statOf(id).coolUntil = 0; else for (const s of STAT.values()) s.coolUntil = 0; };
function cool(id, status, retryAfter, msg) {
  const s = statOf(id), ra = Math.min(Math.max(+retryAfter || 0, 0), 3600);
  const sec = status === 429 ? (ra || 60) : status === 401 || status === 403 ? 600 : status === 400 || status === 404 ? 120 : 20;
  s.coolUntil = Date.now() + sec * 1000; s.fail++; s.lastError = String(msg || status).slice(0, 200); s.lastErrorAt = Date.now();
}

// ---------- طلب واحد لمزوّد واحد → { body: ReadableStream, pick } أو خطأ فيه status ----------
const HINT = { 401: "المفتاح غلط أو اتلغى", 403: "المفتاح مرفوض أو مالوش صلاحية", 404: "اسم الموديل غلط أو اتشال", 429: "خلص الحد المجاني لدلوقتي" };
async function errText(r) {
  let m = ""; const raw = await r.text().catch(() => "");
  try { const j = JSON.parse(raw); m = j.error?.message || j.error || j.message || JSON.stringify(j); } catch { m = raw; }
  m = String(typeof m === "string" ? m : JSON.stringify(m)).replace(/\s+/g, " ").trim();
  if (!m || m.length < 6 || /^error$/i.test(m)) m = "";
  return `HTTP ${r.status}${HINT[r.status] ? " — " + HINT[r.status] : ""}${m ? ": " + m : ""}`.slice(0, 240);
}
function fail(status, msg, retryAfter) { return Object.assign(new Error(msg), { status, retryAfter }); }

async function callOne(p, env, { system, msgs, imgs, max, temp, signal }) {
  const last = msgs.length - 1, model = p.model(env);
  let r, pick;
  if (p.kind === "anthropic") {
    const m = msgs.map((x, i) => i === last && imgs.length ? { role: x.role, content: [...imgs.map(d => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: d } })), { type: "text", text: x.content }] } : x);
    r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", signal, headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: max, system, messages: m, stream: true, ...(temp != null ? { temperature: temp } : {}) }) });
    pick = j => { if (j.type === "error") throw new Error(j.error?.message || "stream error"); return j.type === "content_block_delta" ? j.delta?.text || "" : ""; };
  } else if (p.kind === "gemini") {
    const contents = msgs.map((x, i) => ({ role: x.role === "assistant" ? "model" : "user", parts: i === last && imgs.length ? [...imgs.map(d => ({ inline_data: { mime_type: "image/jpeg", data: d } })), { text: x.content }] : [{ text: x.content }] }));
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`, { method: "POST", signal, headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents, generationConfig: { maxOutputTokens: Math.round(max * 2.5), ...(temp != null ? { temperature: temp } : {}) } }) });
    pick = j => { if (j.error) throw new Error(j.error.message || "stream error"); return (j.candidates?.[0]?.content?.parts || []).map(x => x.text || "").join(""); };
  } else if (p.kind === "cfai") {
    const messages = [{ role: "system", content: system }, ...msgs];
    let stream;
    try { stream = await env.AI.run(model, { messages, max_tokens: max, stream: true, ...(temp != null ? { temperature: temp } : {}) }); }
    catch (e) { const m = String(e?.message || e); throw fail(/limit|quota|neuron|429|capacity/i.test(m) ? 429 : 502, m); }
    if (!(stream instanceof ReadableStream)) { const t = stream?.response || ""; stream = new Response(`data: ${JSON.stringify({ response: t })}\n\n`).body; }
    return { body: stream, pick: j => j.response ?? j.choices?.[0]?.delta?.content ?? "" };
  } else {
    const m = [{ role: "system", content: system }, ...msgs.map((x, i) => i === last && imgs.length ? { role: "user", content: [{ type: "text", text: x.content }, ...imgs.map(d => ({ type: "image_url", image_url: { url: "data:image/jpeg;base64," + d } }))] } : x)];
    r = await fetch(p.base(env) + "/chat/completions", { method: "POST", signal, headers: { "content-type": "application/json", ...p.headers(env) },
      body: JSON.stringify({ model, messages: m, stream: true, max_tokens: max, ...(/gpt-oss/.test(model) && p.id === "groq" ? { reasoning_effort: "low" } : {}), ...(temp != null ? { temperature: temp } : {}) }) });
    pick = j => { if (j.error) throw new Error(j.error.message || "stream error"); return j.choices?.[0]?.delta?.content || ""; };
  }
  if (!r.ok) throw fail(r.status, await errText(r), r.headers.get("retry-after"));
  return { body: r.body, pick };
}

// قارئ SSE: بيطلّع النص قطعة قطعة
function sseReader(body, pick) {
  const rd = body.getReader(), dec = new TextDecoder(); let buf = "", done = false;
  return async function next() {
    for (;;) {
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!line.startsWith("data:")) continue;
        const d = line.slice(5).trim(); if (!d || d === "[DONE]") continue; let j; try { j = JSON.parse(d); } catch { continue; }
        const t = pick(j); if (t) return t;
      }
      if (done) return null;
      const c = await rd.read(); if (c.done) { done = true; buf += dec.decode() + "\n"; } else buf += dec.decode(c.value, { stream: true });
    }
  };
}

// ---------- السلسلة: بنجرّب لحد ما مزوّد يطلّع أول كلمة فعلًا ----------
// (لو مزوّد رجّع 200 بس الرد فاضي أو وقع قبل أول كلمة، بنعدّي للي بعده من غير ما الطالب يحس)
export async function chatWithFallback(env, req) {
  const chain = chatChain(env); if (!chain.length) throw fail(400, "مفيش مزوّد ذكاء اصطناعي متظبط على السيرفر — افتح /admin وحط مفتاح واحد على الأقل");
  const now = Date.now(), needVision = req.imgs.length > 0;
  let cand = chain.filter(id => !needVision || byId[id].vision(env));
  if (!cand.length) throw fail(400, "مفيش مزوّد متظبط بيشوف الصور (Gemini / Claude / OpenAI)");
  const fresh = cand.filter(id => statOf(id).coolUntil <= now), resting = cand.filter(id => statOf(id).coolUntil > now).sort((a, b) => statOf(a).coolUntil - statOf(b).coolUntil);
  cand = [...fresh, ...resting];   // اللي في راحة بنجرّبه في الآخر بس (يمكن حده اتجدد)
  const errors = [];
  for (const id of cand) {
    const p = byId[id];
    try {
      const { body, pick } = await callOne(p, env, req), next = sseReader(body, pick);
      const first = await next(); if (!first) throw fail(502, "رد فاضي");
      const s = statOf(id); s.ok++; s.lastUsed = Date.now(); s.coolUntil = 0;
      return { provider: id, first, next, tried: errors };
    } catch (e) {
      if (e?.name === "AbortError") throw e;
      const st = e?.status || 502; cool(id, st, e?.retryAfter, e?.message);
      errors.push({ id, status: st, error: String(e?.message || e).slice(0, 160) });
    }
  }
  const all429 = errors.length && errors.every(x => x.status === 429);
  throw Object.assign(new Error((all429 ? "كل المزوّدات المجانية وصلت لحدها دلوقتي — جرّب بعد شوية" : "كل المزوّدات فشلت") + ": " + errors.map(x => `${x.id} (${x.status})`).join("، ")), { status: all429 ? 429 : 502, code: all429 ? "all_limited" : "all_failed", tried: errors });
}

// اختبار سريع لمزوّد واحد (من صفحة الأدمن): رد قصير من غير ما نأثّر على حالته
export async function testProvider(env, id) {
  const p = byId[id]; if (!p) return { ok: false, error: "مزوّد مش معروف" };
  if (!p.configured(env)) return { ok: false, error: p.kind === "cfai" ? "ربط Workers AI (باسم AI) مش موجود" : "مفيش مفتاح" };
  const t0 = Date.now();
  try {
    const { body, pick } = await callOne(p, env, { system: "Reply in one short Arabic sentence.", msgs: [{ role: "user", content: "قول: أهلاً، أنا شغال." }], imgs: [], max: 600, temp: 0, signal: AbortSignal.timeout(25000) });
    const next = sseReader(body, pick); let out = "", t; while (out.length < 200 && (t = await next())) out += t;
    if (!out) return { ok: false, error: "رد فاضي", ms: Date.now() - t0 };
    statOf(id).coolUntil = 0;
    return { ok: true, reply: out.slice(0, 200), model: p.model(env), ms: Date.now() - t0 };
  } catch (e) { return { ok: false, status: e?.status, error: String(e?.message || e).slice(0, 300), ms: Date.now() - t0 }; }
}

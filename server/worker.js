// ===== سيرفر الـ AI الآمن لمساعد المذاكرة =====
// Cloudflare Worker (أو Node عن طريق node.mjs). كل المفاتيح environment variables / secrets — ولا مفتاح في كود الموقع.
// السيرفر stateless: مبيخزّنش كتب ولا محادثات ولا صوت. كتب كل مستخدم فاضلة في متصفحه هو بس،
// والسيرفر بياخد بس المقاطع الصغيرة اللي المستخدم نفسه بعتها في الطلب ده.
//
// المسارات:
//   GET  /v1/health  → القدرات المتاحة (من غير أي أسرار)
//   POST /v1/chat    → { system, messages:[{role,content}], images:[base64 jpeg], max_tokens, temperature } → SSE: data: {"t":"..."}
//   POST /v1/embed   → { texts:[...], task:"document"|"query" } → { model, dim, vectors }
//   POST /api/tts    → { text, lang?:"ar"|"en", voice?, pitch?, rate? } → audio (streamed) — طبقة TTS مستقلة (server/tts.js)، مش Gemini
//   GET  /api/tts/voices → المحركات والأصوات المتاحة (من غير أسرار)
//   (POST /v1/tts اسم قديم لنفس الـ endpoint)
//   POST /v1/stt?lang=ar-EG  (body = audio/webm أو ogg أو wav) → { text }
//
// الحسابات (اختياري): SUPABASE_URL + SUPABASE_ANON_KEY (دول عامّين بطبيعتهم — الحماية بـ RLS في قاعدة البيانات).
//   REQUIRE_AUTH=true → كل طلبات الـ POST لازم يكون معاها توكن مستخدم متسجّل (Authorization: Bearer …)، والحد بيتحسب لكل مستخدم.

import { TEACHER_PERSONA } from "./persona.js";
import { ttsHandle, ttsInfo, ttsWarnings } from "./tts.js";
import { chatChain, chatWithFallback, providerById } from "./providers.js";
import { adminHandle, withSettings } from "./admin.js";

const LIMITS = { chat: 30, embed: 90, tts: 150, stt: 30, "account/delete": 3 };   // طلبات في الدقيقة لكل IP (تقريبي، لكل نسخة من السيرفر)
const hits = new Map();
const trim = (s, n = 300) => String(s ?? "").slice(0, n);

export default { fetch: handle };

// ---------- كل طلب: request ID + لوج منظّم (من غير أسرار ولا محتوى الكتب/الأسئلة) ----------
export async function handle(req, env = {}, ctx = {}) {
  const rid = (req.headers.get("x-request-id") || "").replace(/[^\w-]/g, "").slice(0, 64) || crypto.randomUUID(), t0 = Date.now(), M = { rid, route: "", user: null };
  let res;
  try { res = await handle0(req, env, ctx, M); } catch (e) { M.err = trim(e?.message, 200); res = json({ error: "خطأ داخلي في السيرفر", rid }, 500, {}); }
  try { res.headers.set("x-request-id", rid); } catch { res = new Response(res.body, res); res.headers.set("x-request-id", rid); }
  log(env, { rid, method: req.method, path: new URL(req.url).pathname, status: res.status, ms: Date.now() - t0, route: M.route || undefined, user: M.user ? fnv(M.user.id) : undefined, provider: M.provider, code: M.code, err: M.err });
  return res;
}
const fnv = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); };
export function log(env, o) { if (env.LOG === "off" || globalThis.__TUTOR_LOG_OFF) return; try { console.log(JSON.stringify({ t: new Date().toISOString(), level: o.status >= 500 ? "error" : o.status >= 400 ? "warn" : "info", ...o })); } catch {} }

// ---------- حدود الاستخدام اليومية (لكل مستخدم مسجّل، وإلا لكل IP) — عشان مستخدم واحد مايخلّصش موارد السيستم ----------
const USAGE = new Map(), QDEF = { chat: 500, images: 100, ttsChars: 300000, sttBytes: 100e6, embedTexts: 20000 };
const QENV = { chat: "QUOTA_CHAT_PER_DAY", images: "QUOTA_IMAGES_PER_DAY", ttsChars: "QUOTA_TTS_CHARS_PER_DAY", sttBytes: "QUOTA_STT_BYTES_PER_DAY", embedTexts: "QUOTA_EMBED_TEXTS_PER_DAY" };
const principal = (req, user) => user ? "u:" + user.id : "ip:" + (req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "0");
function usageOf(p) { const day = new Date().toISOString().slice(0, 10), k = day + "|" + p; let u = USAGE.get(k); if (!u) { u = { day, chat: 0, images: 0, ttsChars: 0, sttBytes: 0, embedTexts: 0, outChars: 0 }; USAGE.set(k, u); if (USAGE.size > 20000) for (const kk of USAGE.keys()) if (!kk.startsWith(day)) USAGE.delete(kk); } return u; }
const limits = env => Object.fromEntries(Object.keys(QDEF).map(k => [k, +env[QENV[k]] > 0 ? +env[QENV[k]] : QDEF[k]]));
function overQuota(u, env, add) { const L = limits(env); return Object.keys(add).find(k => u[k] + add[k] > L[k]) || ""; }
export function usageTotal() {
  const day = new Date().toISOString().slice(0, 10), t = { day, chat: 0, images: 0, principals: 0 };
  for (const [k, u] of USAGE) if (k.startsWith(day)) { t.chat += u.chat; t.images += u.images; t.principals++; }
  return t;
}
export function usageReport(req, env, user) { const u = usageOf(principal(req, user)), L = limits(env), est = +env.COST_PER_1K_OUTPUT_CHARS > 0 ? +(u.outChars / 1000 * +env.COST_PER_1K_OUTPUT_CHARS).toFixed(4) : null;
  return { day: u.day, by: user ? "user" : "ip", used: { chat: u.chat, images: u.images, ttsChars: u.ttsChars, sttBytes: u.sttBytes, embedTexts: u.embedTexts, outputChars: u.outChars, estTokens: Math.round(u.outChars / 4) }, limits: L, estimatedCost: est }; }

async function handle0(req, env, ctx, M) {
  const url = new URL(req.url);
  if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) { M.route = "admin"; return adminHandle(req, env, url, { usage: usageTotal }); }
  if (url.pathname === "/" && req.method === "GET") return new Response("سيرفر المدرّس شغال ✅ — لوحة التحكم على /admin", { headers: { "content-type": "text/plain; charset=utf-8" } });
  env = await withSettings(env);   // المفاتيح والإعدادات اللي اتحطت من /admin
  const cors = corsFor(req, env, url);
  if (cors === null) return json({ error: "origin not allowed" }, 403, {});
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  try {
    if (url.pathname === "/v1/health" && req.method === "GET") return json(health(env), 200, cors);
    if (url.pathname === "/api/tts/voices" && req.method === "GET") return json(ttsInfo(env) || { providers: [], voices: [], warnings: ttsWarnings(env) }, 200, cors);
    if (url.pathname === "/v1/usage" && req.method === "GET") { const user = await authUser(req, env); return json(usageReport(req, env, user), 200, cors); }
    if (req.method !== "POST") return json({ error: "not found" }, 404, cors);
    const route = url.pathname === "/api/tts" ? "tts" : url.pathname.replace(/^\/v1\//, "");
    if (!LIMITS[route]) return json({ error: "not found" }, 404, cors);
    const user = await authUser(req, env); M.route = route; M.user = user;
    if (req.headers.get("authorization") && env.SUPABASE_URL && !user) M.code = "bad_token";
    if (((env.REQUIRE_AUTH === "true" && env.SUPABASE_URL) || route === "account/delete") && !user) { M.code = "auth_required"; return json({ error: "لازم تسجّل دخول الأول", code: "auth_required" }, 401, cors); }
    const lim = Math.round(LIMITS[route] * (+env.RATE_LIMIT_MULTIPLIER || 1));
    if (!allow(req, route, lim, user?.id)) { M.code = "rate"; return json({ error: "طلبات كتير — استنى دقيقة وجرّب تاني", code: "rate" }, 429, cors); }
    const U = usageOf(principal(req, user));
    const quota = k => { M.code = "quota"; return json({ error: `وصلت للحد اليومي (${k}) — جرّب بكرة، أو كلّم صاحب الموقع`, code: "quota", limit: k }, 429, cors); };
    if (route === "account/delete") return await deleteAccount(user, env, cors);
    if (route === "stt") { const n = +req.headers.get("content-length") || 0, q = overQuota(U, env, { sttBytes: n }); if (q) return quota(q); const r = await stt(req, env, url, cors); U.sttBytes += n; return r; }
    const len = +req.headers.get("content-length") || 0; if (len > 6e6) return json({ error: "الطلب كبير" }, 413, cors);
    const raw = await req.text(); if (raw.length > 6e6) return json({ error: "الطلب كبير" }, 413, cors);
    let body; try { body = JSON.parse(raw); } catch { return json({ error: "bad json" }, 400, cors); }
    if (route === "chat") { const im = Array.isArray(body.images) ? Math.min(4, body.images.length) : 0, q = overQuota(U, env, { chat: 1, images: im }); if (q) return quota(q);
      const r = await chat(body, env, cors, n => { U.outChars += n; }, M); U.chat++; U.images += im; return r; }
    if (route === "embed") { const n = Array.isArray(body.texts) ? Math.min(100, body.texts.length) : 0, q = overQuota(U, env, { embedTexts: n }); if (q) return quota(q); const r = await embed(body, env, cors); U.embedTexts += n; return r; }
    if (route === "tts") { const n = String(body.text || "").length, q = overQuota(U, env, { ttsChars: n }); if (q) return quota(q);
      const r = await ttsHandle(body, env); U.ttsChars += n; M.provider = r.headers.get("x-tts-provider") || undefined; for (const [k, v] of Object.entries(cors)) r.headers.set(k, v); r.headers.set("access-control-expose-headers", "x-tts-provider, x-tts-voice, x-tts-rate, x-tts-fallback, x-request-id"); return r; }
  } catch (e) {
    M.err = trim(e?.message || e, 200); M.code = e?.code || M.code;
    return json({ error: trim(e?.message || e, 600), rid: M.rid, ...(e?.code ? { code: e.code } : {}) }, e?.status || 502, cors);
  }
  return json({ error: "not found" }, 404, cors);
}

// ---------- أمان: CORS + حد الطلبات ----------
function corsFor(req, env, url) {
  const o = req.headers.get("origin"); if (!o) return {};
  const allowList = String(env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  let same = false; try { same = new URL(o).host === url.host; } catch {}
  if (!(same || allowList.includes("*") || allowList.includes(o))) return null;
  return { "access-control-allow-origin": o, vary: "origin", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type, authorization, x-request-id", "access-control-expose-headers": "x-request-id, x-llm-provider", "access-control-max-age": "86400" };
}
function allow(req, route, limit, uid) {
  const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "0", k = route + "|" + (uid ? "u:" + uid : ip), now = Date.now();
  const h = hits.get(k); if (!h || now - h.t > 60000) { hits.set(k, { t: now, n: 1 }); if (hits.size > 5000) for (const [kk, v] of hits) if (now - v.t > 60000) hits.delete(kk); return true; }
  return ++h.n <= limit;
}
const json = (o, status = 200, h = {}) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json; charset=utf-8", ...h } });
const bad = m => Object.assign(new Error(m), { status: 400 });
async function upstream(r, name) {
  if (r.ok) return r;
  let m = ""; try { const j = await r.json(); m = j.error?.message || j.error || j.message || j.detail?.message || JSON.stringify(j); } catch { m = await r.text().catch(() => ""); }
  throw Object.assign(new Error(`${name}: ${r.status === 429 ? "وصلت لحد المزوّد، جرّب بعد شوية" : trim(m, 200)}`), { status: r.status === 429 ? 429 : 502 });
}

// ---------- اختيار المزوّدين ----------
const chatProvider = env => chatChain(env)[0] || "";   // أول واحد في السلسلة (الباقي احتياطي — providers.js)
const embedProvider = env => env.EMBED_PROVIDER || (env.GEMINI_API_KEY ? "gemini" : env.OPENAI_API_KEY ? "openai" : "");
const sttKey = env => env.STT_API_KEY || env.OPENAI_API_KEY || env.GROQ_API_KEY || "";
// لو مفيش غير مفتاح Groq: Whisper بتاع Groq (مجاني) للتعرّف على الكلام
const sttGroq = env => !env.STT_API_KEY && !env.OPENAI_API_KEY && !!env.GROQ_API_KEY;
const oaBase = env => (env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const embedModel = env => embedProvider(env) === "gemini" ? (env.GEMINI_EMBED_MODEL || "gemini-embedding-001") : (env.OPENAI_EMBED_MODEL || "text-embedding-3-small");

// ---------- الحسابات: التأكد من توكن المستخدم عند Supabase (مع كاش دقيقة) ----------
const AUTHC = new Map();
export async function authUser(req, env) {
  const h = req.headers.get("authorization") || "", tok = /^Bearer\s+(.{20,4096})$/i.exec(h)?.[1]; if (!tok || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;
  const c = AUTHC.get(tok); if (c && Date.now() - c.t < 60000) return c.u;
  let u = null;
  try { const r = await fetch(env.SUPABASE_URL.replace(/\/+$/, "") + "/auth/v1/user", { headers: { apikey: env.SUPABASE_ANON_KEY, authorization: "Bearer " + tok }, signal: AbortSignal.timeout(6000) });
    if (r.ok) { const j = await r.json(); if (j?.id) u = { id: j.id, email: j.email || "" }; } } catch {}
  AUTHC.set(tok, { u, t: Date.now() }); if (AUTHC.size > 5000) AUTHC.clear();
  return u;
}
function health(env) {
  const chain = chatChain(env), cp = chain[0] || "", ep = embedProvider(env);
  return { ok: true, chat: !!cp, chatProvider: cp, chatChain: chain, vision: chain.some(id => providerById(id).vision(env)),
    embed: !!ep, embedModel: ep ? ep + ":" + embedModel(env) : "",
    tts: ttsInfo(env), ttsWarnings: ttsWarnings(env),
    stt: !!sttKey(env) && env.STT_DISABLED !== "true",
    // إعدادات الحسابات العامة (مش أسرار): الموقع بياخدها من هنا لو config.js فاضي
    auth: env.SUPABASE_URL && env.SUPABASE_ANON_KEY ? { provider: "supabase", url: env.SUPABASE_URL, anonKey: env.SUPABASE_ANON_KEY, required: env.REQUIRE_AUTH === "true" } : null };
}

// ---------- الشات (streaming) ----------
async function chat(b, env, cors, onOut = () => {}, M = {}) {
  if (!chatChain(env).length) throw bad("مفيش مزوّد ذكاء اصطناعي على السيرفر — افتح /admin وحط مفتاح");
  const persona = env.TEACHER_PERSONA === "off" ? "" : String(env.TEACHER_PERSONA || TEACHER_PERSONA), system = (persona ? persona + "\n\n" : "") + trim(b.system, 24000), max = Math.min(Math.max(+b.max_tokens || 1500, 64), 4000), temp = b.temperature == null ? undefined : Math.min(1, Math.max(0, +b.temperature));
  let msgs = (Array.isArray(b.messages) ? b.messages : []).slice(-20).map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: trim(m.content, 40000) }));
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  if (!msgs.length) throw bad("no messages");
  if (msgs.reduce((a, m) => a + m.content.length, 0) > 120000) throw bad("السياق كبير");
  const imgs = (Array.isArray(b.images) ? b.images : []).slice(0, 4).filter(x => typeof x === "string" && x.length < 2.5e6 && /^[A-Za-z0-9+/=]+$/.test(x.slice(0, 200)));
  // السلسلة: لو الأول خلص حصته (429) أو وقع، بنجرّب اللي بعده لحد ما واحد يطلّع أول كلمة
  const got = await chatWithFallback(env, { system, msgs, imgs, max, temp });
  M.provider = got.provider;
  const enc = new TextEncoder(), { readable, writable } = new TransformStream(), w = writable.getWriter();
  (async () => {
    try {
      let t = got.first;
      while (t) { onOut(t.length); await w.write(enc.encode("data: " + JSON.stringify({ t }) + "\n\n")); t = await got.next(); }
      await w.write(enc.encode("data: [DONE]\n\n"));
    } catch (e) { try { await w.write(enc.encode("data: " + JSON.stringify({ error: trim(e.message) }) + "\n\n")); } catch {} }
    finally { try { await w.close(); } catch {} }
  })();
  return new Response(readable, { headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store", "x-llm-provider": got.provider, ...cors } });
}

// ---------- مسح الحساب نهائيًا (محتاج SUPABASE_SERVICE_ROLE_KEY على السيرفر بس — عمره ما بيتبعت للموقع) ----------
async function deleteAccount(user, env, cors) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: "مسح الحساب مش متظبط على السيرفر", code: "no_admin" }, 501, cors);
  const base = env.SUPABASE_URL.replace(/\/+$/, ""), H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY, "content-type": "application/json" };
  const lr = await fetch(`${base}/storage/v1/object/list/books`, { method: "POST", headers: H, body: JSON.stringify({ prefix: user.id, limit: 1000 }) });
  const files = lr.ok ? await lr.json() : [];
  if (Array.isArray(files) && files.length) await upstream(await fetch(`${base}/storage/v1/object/books`, { method: "DELETE", headers: H, body: JSON.stringify({ prefixes: files.map(f => `${user.id}/${f.name}`) }) }), "storage");
  for (const t of ["user_kv", "chunks"]) await fetch(`${base}/rest/v1/${t}?user_id=eq.${encodeURIComponent(user.id)}`, { method: "DELETE", headers: H });
  await upstream(await fetch(`${base}/auth/v1/admin/users/${encodeURIComponent(user.id)}`, { method: "DELETE", headers: H }), "auth");
  for (const [t, c] of AUTHC) if (c.u?.id === user.id) AUTHC.delete(t);   // التوكنات القديمة متتقبلش تاني
  return json({ ok: true, deletedFiles: Array.isArray(files) ? files.length : 0 }, 200, cors);
}

// ---------- embeddings (فهم المعنى) ----------
async function embed(b, env, cors) {
  const prov = embedProvider(env); if (!prov) throw bad("مفيش مزوّد embeddings على السيرفر");
  const texts = (Array.isArray(b.texts) ? b.texts : []).slice(0, 100).map(t => trim(t, 4000)); if (!texts.length) throw bad("no texts");
  const model = embedModel(env); let vectors;
  if (prov === "gemini") {
    const r = await upstream(await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents`, { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      body: JSON.stringify({ requests: texts.map(t => ({ model: "models/" + model, content: { parts: [{ text: t }] }, taskType: b.task === "query" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT", outputDimensionality: 768 })) }) }), "gemini");
    vectors = ((await r.json()).embeddings || []).map(x => x.values);
  } else {
    const r = await upstream(await fetch(oaBase(env) + "/embeddings", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + env.OPENAI_API_KEY }, body: JSON.stringify({ model, input: texts, dimensions: 768 }) }), "openai");
    vectors = ((await r.json()).data || []).sort((a, c) => a.index - c.index).map(x => x.embedding);
  }
  return json({ model: prov + ":" + model, dim: vectors[0]?.length || 0, vectors }, 200, cors);
}

// ---------- تحويل الكلام لنص (للمتصفحات اللي مفيهاش تعرّف على الكلام) ----------
async function stt(req, env, url, cors) {
  const key = sttKey(env); if (!key || env.STT_DISABLED === "true") throw bad("مفيش تعرّف على الكلام على السيرفر");
  const len = +req.headers.get("content-length") || 0; if (len > 10e6) return json({ error: "التسجيل طويل" }, 413, cors);
  const buf = await req.arrayBuffer(); if (buf.byteLength > 10e6) return json({ error: "التسجيل طويل" }, 413, cors); if (buf.byteLength < 500) return json({ text: "" }, 200, cors);
  const type = (req.headers.get("content-type") || "audio/webm").split(";")[0], ext = { "audio/webm": "webm", "audio/ogg": "ogg", "audio/wav": "wav", "audio/mp4": "mp4", "audio/mpeg": "mp3" }[type] || "webm";
  const fd = new FormData(); fd.append("file", new Blob([buf], { type }), "speech." + ext); fd.append("model", env.STT_MODEL || (sttGroq(env) ? "whisper-large-v3-turbo" : "whisper-1"));
  const lang = (url.searchParams.get("lang") || "").slice(0, 2); if (/^(ar|en)$/.test(lang)) fd.append("language", lang);
  const r = await upstream(await fetch((env.STT_BASE_URL || (sttGroq(env) ? "https://api.groq.com/openai/v1" : oaBase(env))).replace(/\/+$/, "") + "/audio/transcriptions", { method: "POST", headers: { authorization: "Bearer " + key }, body: fd }), "stt");
  const j = await r.json(); return json({ text: trim(j.text, 4000) }, 200, cors);
}

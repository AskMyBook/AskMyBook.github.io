// ===== لوحة تحكم صاحب الموقع (/admin) =====
// المفاتيح بتتحفظ في Cloudflare KV (ربط باسم CONFIG) — جوه حسابك على Cloudflare بس. عمرها ما بتتبعت للموقع ولا للمتصفح
// (صفحة الأدمن نفسها بتشوف آخر ٤ حروف بس). المفتاح اللي متحط كـ Secret في Cloudflare بيشتغل برضه، واللي في الأدمن بيغلبه.
// الدخول بباسورد: أول مرة بتختاره، أو حطه كـ Secret باسم ADMIN_PASSWORD. الجلسة توكن موقّع (HMAC) صالح ١٢ ساعة.
import { CHAT_PROVIDERS, chatOrder, chatChain, providerStatus, testProvider, resetCooldown } from "./providers.js";
import { TEACHER_PERSONA } from "./persona.js";
import { ADMIN_HTML } from "./admin-page.js";

export const KEY_NAMES = ["GEMINI_API_KEY", "GROQ_API_KEY", "OPENROUTER_API_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY"];
export const VAR_NAMES = ["ALLOWED_ORIGINS", "LLM_ORDER", "LLM_DISABLED", "GEMINI_MODEL", "GROQ_MODEL", "OPENROUTER_MODEL", "CLOUDFLARE_MODEL", "ANTHROPIC_MODEL", "OPENAI_MODEL",
  "TEACHER_PERSONA", "QUOTA_CHAT_PER_DAY", "QUOTA_IMAGES_PER_DAY"];

// ---------- التخزين: KV لو موجود، وإلا ذاكرة مؤقتة (للتجربة على Node بس) ----------
const MEM = globalThis.__TUTOR_MEM_KV ||= new Map();
const kv = env => env.CONFIG?.get ? env.CONFIG : { get: async k => MEM.get(k) ?? null, put: async (k, v) => { MEM.set(k, v); }, delete: async k => { MEM.delete(k); }, memory: true };
let CACHE = { t: 0, v: null };
async function readSettings(env, fresh = false) {
  if (!fresh && CACHE.v && Date.now() - CACHE.t < 15000) return CACHE.v;
  let v = null; try { v = JSON.parse(await kv(env).get("settings") || "null"); } catch {}
  v = { keys: {}, vars: {}, ...(v || {}) }; CACHE = { t: Date.now(), v }; return v;
}
async function writeSettings(env, v) { await kv(env).put("settings", JSON.stringify(v)); CACHE = { t: Date.now(), v }; }

// env النهائي = Secrets/Variables بتاعة Cloudflare + اللي اتحفظ من الأدمن (الأدمن بيغلب)
export async function withSettings(env) {
  let s; try { s = await readSettings(env); } catch { return env; }
  const out = { ...env };
  for (const [k, v] of Object.entries(s.keys || {})) if (KEY_NAMES.includes(k) && v) out[k] = v;
  for (const [k, v] of Object.entries(s.vars || {})) if (VAR_NAMES.includes(k) && v !== "" && v != null) out[k] = String(v);
  return out;
}

// ---------- باسورد + جلسة ----------
const te = new TextEncoder();
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const rand = n => b64u(crypto.getRandomValues(new Uint8Array(n)));
async function pbkdf2(pass, salt) {
  const k = await crypto.subtle.importKey("raw", te.encode(pass), "PBKDF2", false, ["deriveBits"]);
  return b64u(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: te.encode(salt), iterations: 100000 }, k, 256));
}
async function hmac(secret, msg) { const k = await crypto.subtle.importKey("raw", te.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return b64u(await crypto.subtle.sign("HMAC", k, te.encode(msg))); }
const same = (a, b) => { a = String(a); b = String(b); let d = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return d === 0; };
async function adminRec(env) { try { return JSON.parse(await kv(env).get("admin") || "null"); } catch { return null; } }
async function sessionSecret(env) { if (env.ADMIN_PASSWORD) return "envpw|" + env.ADMIN_PASSWORD; return (await adminRec(env))?.secret || ""; }
async function issue(env) { const exp = Date.now() + 12 * 3600e3, sec = await sessionSecret(env); return exp + "." + await hmac(sec, "adm|" + exp); }
async function authed(req, env) {
  const tok = /^Bearer\s+(\d+)\.([\w-]+)$/.exec(req.headers.get("authorization") || ""); if (!tok || +tok[1] < Date.now()) return false;
  const sec = await sessionSecret(env); return !!sec && same(tok[2], await hmac(sec, "adm|" + tok[1]));
}

// ---------- الراوتر ----------
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" } });
const mask = v => v ? "••••" + String(v).slice(-4) : "";
const tries = new Map();
function tooMany(req) {
  const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "0", now = Date.now(), h = tries.get(ip);
  if (!h || now - h.t > 10 * 60e3) { tries.set(ip, { t: now, n: 1 }); return false; }
  return ++h.n > 8;   // ٨ محاولات كل ١٠ دقايق
}

export async function adminHandle(req, rawEnv, url, { usage } = {}) {
  if (url.pathname === "/admin" || url.pathname === "/admin/") {
    if (req.method !== "GET") return J({ error: "not found" }, 404);
    return new Response(ADMIN_HTML, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-frame-options": "DENY", "referrer-policy": "no-referrer",
      "content-security-policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" } });
  }
  // الـ API بتاع الأدمن: من نفس الصفحة بس
  const o = req.headers.get("origin"); if (o) { let ok = false; try { ok = new URL(o).host === url.host; } catch {} if (!ok) return J({ error: "forbidden" }, 403); }
  if (req.method !== "POST") return J({ error: "not found" }, 404);
  const path = url.pathname.replace(/^\/admin\/api\//, "");
  let body = {}; try { const t = await req.text(); if (t.length > 200000) return J({ error: "كبير" }, 413); body = t ? JSON.parse(t) : {}; } catch { return J({ error: "bad json" }, 400); }
  const store = kv(rawEnv), rec = await adminRec(rawEnv), hasPw = !!rawEnv.ADMIN_PASSWORD || !!rec;

  if (path === "hello") return J({ needSetup: !hasPw, envPassword: !!rawEnv.ADMIN_PASSWORD, persistent: !store.memory });
  if (path === "setup") {
    if (hasPw) return J({ error: "الباسورد متحدد خلاص — ادخل بيه" }, 409);
    if (store.memory && !rawEnv.ALLOW_MEMORY_ADMIN) return J({ error: "لازم تربط KV باسم CONFIG الأول (الخطوات في الصفحة)", code: "no_kv" }, 400);
    const pw = String(body.password || ""); if (pw.length < 10) return J({ error: "الباسورد لازم ١٠ حروف على الأقل" }, 400);
    const salt = rand(16); await store.put("admin", JSON.stringify({ salt, hash: await pbkdf2(pw, salt), secret: rand(32), at: Date.now() }));
    return J({ token: await issue(rawEnv) });
  }
  if (path === "login") {
    if (tooMany(req)) return J({ error: "محاولات كتير — استنى ١٠ دقايق" }, 429);
    const pw = String(body.password || "");
    const ok = rawEnv.ADMIN_PASSWORD ? same(pw, rawEnv.ADMIN_PASSWORD) : rec ? same(await pbkdf2(pw, rec.salt), rec.hash) : false;
    if (!ok) return J({ error: "الباسورد غلط" }, 401);
    return J({ token: await issue(rawEnv) });
  }
  if (!(await authed(req, rawEnv))) return J({ error: "سجّل دخول تاني", code: "auth" }, 401);

  const s = await readSettings(rawEnv, true), env = await withSettings(rawEnv);
  if (path === "state") {
    return J({
      persistent: !store.memory, workersAI: !!rawEnv.AI?.run, chain: chatChain(env), order: chatOrder(env),
      providers: providerStatus(env).map(p => ({ ...p, key: p.keyName ? { admin: mask(s.keys[p.keyName]), secret: mask(rawEnv[p.keyName]) } : null })),
      vars: Object.fromEntries(VAR_NAMES.filter(k => k !== "TEACHER_PERSONA").map(k => [k, s.vars[k] ?? ""])),
      envVars: { ALLOWED_ORIGINS: rawEnv.ALLOWED_ORIGINS || "" },
      persona: { custom: !!s.vars.TEACHER_PERSONA, text: s.vars.TEACHER_PERSONA || (rawEnv.TEACHER_PERSONA && rawEnv.TEACHER_PERSONA !== "off" ? rawEnv.TEACHER_PERSONA : TEACHER_PERSONA) },
      usage: usage ? usage() : null, host: new URL(req.url).host
    });
  }
  if (path === "save") {
    const keys = body.keys || {}, vars = body.vars || {};
    for (const [k, v] of Object.entries(keys)) { if (!KEY_NAMES.includes(k)) continue; const t = String(v ?? "").trim(); if (t === "__delete__") delete s.keys[k]; else if (t) { if (t.length > 400 || /\s/.test(t)) return J({ error: "المفتاح شكله غلط: " + k }, 400); s.keys[k] = t; } }
    for (const [k, v] of Object.entries(vars)) { if (!VAR_NAMES.includes(k)) continue; const t = String(v ?? "").slice(0, k === "TEACHER_PERSONA" ? 60000 : 2000); if (t.trim() === "") delete s.vars[k]; else s.vars[k] = t; }
    if (s.vars.LLM_ORDER) s.vars.LLM_ORDER = s.vars.LLM_ORDER.split(",").map(x => x.trim()).filter(x => CHAT_PROVIDERS.some(p => p.id === x)).join(",");
    await writeSettings(rawEnv, s); resetCooldown();
    return J({ ok: true });
  }
  if (path === "test") return J(await testProvider(env, String(body.id || "")));
  if (path === "reset-rest") { resetCooldown(body.id ? String(body.id) : ""); return J({ ok: true }); }
  if (path === "password") {
    if (rawEnv.ADMIN_PASSWORD) return J({ error: "الباسورد متحط كـ Secret في Cloudflare — غيّره من هناك" }, 400);
    const pw = String(body.password || ""); if (pw.length < 10) return J({ error: "الباسورد لازم ١٠ حروف على الأقل" }, 400);
    const salt = rand(16); await store.put("admin", JSON.stringify({ salt, hash: await pbkdf2(pw, salt), secret: rand(32), at: Date.now() }));   // سر جديد = كل الجلسات القديمة اتلغت
    return J({ token: await issue(rawEnv) });
  }
  return J({ error: "not found" }, 404);
}

// سلسلة المزوّدين (اللي يخلص ينط للي بعده) + لوحة الأدمن (/admin): الأمان والحفظ ووصول المفاتيح للشات.
import path from "node:path";
import { fileURLToPath } from "node:url";
globalThis.__TUTOR_LOG_OFF = true;
const SRV = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "server");
const { handle } = await import(path.join(SRV, "worker.js"));
const { resetCooldown, chatOrder } = await import(path.join(SRV, "providers.js"));
let pass = 0, failN = 0;
const ok = (name, cond, info = "") => { if (cond) { pass++; console.log("✅ " + name); } else { failN++; console.log("❌ " + name + (info ? "  → " + info : "")); } };

// fetch وهمي: كل مزوّد بيرد حسب السيناريو
const realFetch = globalThis.fetch; let plan = {}, calls = [];
const sse = lines => new Response(lines.map(l => "data: " + l + "\n\n").join(""), { status: 200, headers: { "content-type": "text/event-stream" } });
globalThis.fetch = async (u, init = {}) => {
  const s = String(u), who = /googleapis/.test(s) ? "gemini" : /groq/.test(s) ? "groq" : /openrouter/.test(s) ? "openrouter" : /anthropic/.test(s) ? "anthropic" : /openai\.com/.test(s) ? "openai" : "other";
  calls.push({ who, auth: init.headers?.authorization || init.headers?.["x-goog-api-key"] || "" });
  const p = plan[who] || "ok";
  if (p === 429) return new Response(JSON.stringify({ error: { message: "quota" } }), { status: 429, headers: { "retry-after": "30" } });
  if (p === 401) return new Response(JSON.stringify({ error: { message: "bad key" } }), { status: 401 });
  if (p === "empty") return sse(["{}", "[DONE]"]);
  if (who === "gemini") return sse([JSON.stringify({ candidates: [{ content: { parts: [{ text: "جيميناي" }] } }] })]);
  if (who === "anthropic") return sse([JSON.stringify({ type: "content_block_delta", delta: { text: "كلود" } })]);
  return sse([JSON.stringify({ choices: [{ delta: { content: who } }] }), "[DONE]"]);
};
const chat = async (env, extra = {}) => { const r = await handle(new Request("https://w.dev/v1/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: "اشرح" }], ...extra }) }), env);
  const txt = await r.text(); return { status: r.status, prov: r.headers.get("x-llm-provider"), text: txt.split("\n").filter(l => l.startsWith("data: {")).map(l => JSON.parse(l.slice(6)).t || "").join(""), raw: txt }; };
const fresh = () => { resetCooldown(); plan = {}; calls = []; };
const KEYS = { GEMINI_API_KEY: "g-SECRET-1111", GROQ_API_KEY: "q-SECRET-2222", OPENROUTER_API_KEY: "o-SECRET-3333" };

// ---------- السلسلة ----------
fresh(); let r = await chat(KEYS);
ok("default order: free providers first (Gemini answers)", r.status === 200 && r.prov === "gemini" && r.text === "جيميناي", JSON.stringify(r).slice(0, 200));
fresh(); plan.gemini = 429; r = await chat(KEYS);
ok("Gemini out of quota (429) → Groq answers in the same request", r.status === 200 && r.prov === "groq" && r.text === "groq", r.raw.slice(0, 200));
calls = []; r = await chat(KEYS);
ok("…and the next request skips the resting Gemini (no wasted call)", r.prov === "groq" && !calls.some(c => c.who === "gemini"), JSON.stringify(calls));
fresh(); plan.gemini = 429; plan.groq = 401; r = await chat(KEYS);
ok("bad key on Groq too → OpenRouter answers", r.prov === "openrouter" && r.text === "openrouter");
fresh(); plan.gemini = "empty"; r = await chat(KEYS);
ok("empty reply (200 with no text) also falls through", r.prov === "groq");
fresh(); plan = { gemini: 429, groq: 429, openrouter: 429 }; r = await chat(KEYS); const j = JSON.parse(r.raw);
ok("all providers limited → clear 429 'all_limited' (site then uses its in-browser free providers)", r.status === 429 && j.code === "all_limited", r.raw.slice(0, 200));
ok("error lists what was tried, never the keys", /gemini/.test(j.error) && !/SECRET/.test(r.raw));
// Cloudflare Workers AI (ربط AI، من غير مفتاح)
fresh(); plan = { gemini: 429 }; const AI = { run: async () => new Response('data: {"response":"كلاودفلير"}\n\ndata: [DONE]\n\n').body };
r = await chat({ GEMINI_API_KEY: "g", AI }); ok("Workers AI binding works as a free keyless fallback", r.prov === "cloudflare" && r.text === "كلاودفلير", r.raw.slice(0, 200));
fresh(); r = await chat({ GEMINI_API_KEY: "g", AI: { run: async () => { throw new Error("daily neuron limit"); } }, GROQ_API_KEY: "q", LLM_ORDER: "cloudflare,groq" });
ok("Workers AI limit error → next provider", r.prov === "groq");
// صور: بنروح بس للمزوّدات اللي بتشوف
fresh(); r = await chat({ GROQ_API_KEY: "q", GEMINI_API_KEY: "g", LLM_ORDER: "groq,gemini" }, { images: ["QUJD"] });
ok("question with an image skips text-only providers (Groq) → Gemini", r.prov === "gemini");
fresh(); r = await chat({ GROQ_API_KEY: "q" }, { images: ["QUJD"] });
ok("image but no vision provider → clear message (not a crash)", r.status === 400 && /الصور/.test(r.raw));
// توافق مع الإعداد القديم
fresh(); r = await chat({ LLM_PROVIDER: "openai", OPENAI_API_KEY: "x", GEMINI_API_KEY: "g" });
ok("old LLM_PROVIDER=openai still means only OpenAI", r.prov === "openai" && JSON.stringify(chatOrder({ LLM_PROVIDER: "openai" })) === '["openai"]');
fresh(); r = await chat({});
ok("no provider at all → 400 pointing to /admin", r.status === 400 && /admin/.test(r.raw));
const h = await (await handle(new Request("https://w.dev/v1/health"), { ...KEYS })).json();
ok("health shows the chain, no secrets", JSON.stringify(h.chatChain) === '["gemini","groq","openrouter"]' && !JSON.stringify(h).includes("SECRET"));

// ---------- الأدمن ----------
globalThis.__TUTOR_MEM_KV.clear();
const store = new Map(), KV = { get: async k => store.get(k) ?? null, put: async (k, v) => { store.set(k, v); } };
const ENV = { CONFIG: KV };
const A = (p, body, tok, headers = {}) => handle(new Request("https://w.dev/admin/api/" + p, { method: "POST", headers: { "content-type": "application/json", ...(tok ? { authorization: "Bearer " + tok } : {}), ...headers }, body: JSON.stringify(body || {}) }), ENV);
let page = await handle(new Request("https://w.dev/admin"), ENV);
ok("GET /admin serves the page with strict headers", page.status === 200 && /لوحة تحكم/.test(await page.text()) && page.headers.get("x-frame-options") === "DENY" && /frame-ancestors 'none'/.test(page.headers.get("content-security-policy")));
let x = await (await A("hello")).json(); ok("first visit asks for setup", x.needSetup === true && x.persistent === true);
x = await A("setup", { password: "short" }); ok("setup rejects a short password", x.status === 400);
x = await (await A("setup", { password: "correct-horse-1" })).json(); const tok = x.token; ok("setup returns a session token", /^\d+\.[\w-]+$/.test(tok || ""));
ok("password is stored hashed, not plain", !store.get("admin").includes("correct-horse-1"));
x = await A("setup", { password: "attacker-pass-1" }); ok("nobody can run setup a second time", x.status === 409);
x = await A("state", {}); ok("state without login → 401", x.status === 401);
x = await A("state", {}, tok.replace(/.$/, c => c === "A" ? "B" : "A")); ok("forged token → 401", x.status === 401);
x = await A("state", {}, tok, { origin: "https://evil.example" }); ok("admin API from another site → 403", x.status === 403);
x = await A("login", { password: "wrong-password" }); ok("wrong password → 401", x.status === 401);
let blocked = false; for (let i = 0; i < 10; i++) if ((await A("login", { password: "nope-nope-nope" }, "", { "x-real-ip": "9.9.9.9" })).status === 429) blocked = true;
ok("login brute force is throttled", blocked);
x = await (await A("login", { password: "correct-horse-1" })).json(); ok("right password logs in", !!x.token);
x = await A("save", { keys: { GROQ_API_KEY: "gsk_ADMIN-KEY-9876" }, vars: { ALLOWED_ORIGINS: "https://site.example", LLM_ORDER: "groq,gemini,bogus" } }, tok);
ok("save works", x.status === 200);
let st = await (await A("state", {}, tok)).json();
ok("state shows only the last 4 chars of the key", JSON.stringify(st).includes("••••9876") && !JSON.stringify(st).includes("ADMIN-KEY"));
ok("unknown providers are dropped from the order", st.order[0] === "groq" && !st.order.includes("bogus"));
fresh(); calls = [];
r = await handle(new Request("https://w.dev/v1/chat", { method: "POST", headers: { "content-type": "application/json", origin: "https://site.example" }, body: JSON.stringify({ messages: [{ role: "user", content: "x" }] }) }), ENV);
await r.text(); ok("chat uses the key saved from /admin, and the saved site origin is allowed", r.status === 200 && r.headers.get("x-llm-provider") === "groq" && calls[0]?.auth === "Bearer gsk_ADMIN-KEY-9876", r.status + " " + JSON.stringify(calls));
r = await handle(new Request("https://w.dev/v1/health", { headers: { origin: "https://other.example" } }), ENV);
ok("other sites are still blocked by CORS", r.status === 403);
r = await handle(new Request("https://w.dev/v1/health", { headers: { origin: "https://site.example" } }), ENV); const ht = await r.text();
ok("public health never leaks the admin key", !ht.includes("ADMIN-KEY"));
x = await A("save", { keys: { GROQ_API_KEY: "has space" } }, tok); ok("malformed key rejected", x.status === 400);
x = await A("save", { keys: { GROQ_API_KEY: "__delete__" } }, tok); st = await (await A("state", {}, tok)).json();
ok("key can be deleted", !st.providers.find(p => p.id === "groq").configured);
x = await (await A("password", { password: "new-password-22" }, tok)).json();
ok("changing the password logs out old sessions", (await A("state", {}, tok)).status === 401 && (await A("state", {}, x.token)).status === 200);
x = await A("test", { id: "gemini" }, x.token); const tj = await x.json(); ok("provider test without key says so", tj.ok === false && /مفتاح/.test(tj.error));
// من غير KV: مينفعش نعمل setup (عشان الإعدادات متضيعش)
x = await handle(new Request("https://w.dev/admin/api/setup", { method: "POST", body: JSON.stringify({ password: "correct-horse-1" }) }), {});
ok("without KV binding, setup explains it must be added first", x.status === 400 && (await x.json()).code === "no_kv");

globalThis.fetch = realFetch;
console.log(`\n${pass} passed, ${failN} failed`);
process.exit(failN ? 1 : 0);

// اختيار الموديل تلقائي (server/providers.js): بيسأل المزوّد عن الموديلات المتاحة ويختار الأحسن،
// ولو موديل اتشال (410) أو مش متاح لحسابك (404) بيعدّيه ويجرّب اللي بعده — في الشات وفي زرار «اختبر».
const P = await import(new URL("../server/providers.js", import.meta.url));
let pass = 0, fail = 0;
const ok = (n, c, info = "") => { c ? pass++ : fail++; console.log((c ? "✅ " : "❌ ") + n + (c ? "" : "  → " + JSON.stringify(info).slice(0, 300))); };
// ١) الاختيار من القايمة
ok("gemini: prefers the flash alias over previews, images and embeddings", P.pickModel("gemini", ["gemini-2.5-flash-preview-09", "gemini-embedding-001", "gemini-2.5-flash-image", "gemini-flash-latest", "gemini-2.5-pro"]) === "gemini-flash-latest");
ok("gemini: newest numbered flash when no alias", P.pickModel("gemini", ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-3.5-flash"]) === "gemini-3.5-flash");
ok("gemini lite picks a flash-lite", P.pickModel("geminilite", ["gemini-2.5-flash", "gemini-2.5-flash-lite"]) === "gemini-2.5-flash-lite");
ok("nvidia: skips vision/embedding/reward models", P.pickModel("nvidia", ["nvidia/nv-embedqa-e5-v5", "nvidia/llama-3.1-nemotron-70b-reward", "meta/llama-3.2-90b-vision-instruct", "google/gemma-4-31b-it"]) === "google/gemma-4-31b-it");
ok("nvidia: a model marked unavailable is skipped", P.pickModel("nvidia", ["deepseek-ai/deepseek-v4.1-flash", "google/gemma-4-31b-it"], new Set(["deepseek-ai/deepseek-v4.1-flash"])) === "google/gemma-4-31b-it");
ok("groq: gpt-oss-120b first, never whisper", P.pickModel("groq", ["whisper-large-v3", "llama-3.3-70b-versatile", "openai/gpt-oss-120b"]) === "openai/gpt-oss-120b");
// ٢) موديل اتشال → يجرّب اللي بعده لوحده
const seen = [];
globalThis.fetch = async (u, o) => { u = String(u);
  if (u.endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "meta/llama-3.3-70b-instruct" }, { id: "deepseek-ai/deepseek-v4.1-flash" }, { id: "google/gemma-4-31b-it" }] }));
  const m = JSON.parse(o.body).model; seen.push(m);
  if (m === "deepseek-ai/deepseek-v4.1-flash") return new Response(JSON.stringify({ status: 404, detail: "Function not found for account" }), { status: 404 });
  if (m === "meta/llama-3.3-70b-instruct") return new Response(JSON.stringify({ status: 410, detail: "reached its end of life" }), { status: 410 });
  return new Response(`data: ${JSON.stringify({ choices: [{ delta: { content: "أهلاً، أنا شغال" } }] })}\n\n`); };
const env = { NVIDIA_API_KEY: "nvapi-x", LLM_ORDER: "nvidia", LLM_DISABLED: "gemini,geminilite,groq,openrouter,cloudflare,anthropic,openai" };
const t = await P.testProvider(env, "nvidia");
ok("«اختبر» with an empty model field finds a model that works", t.ok && t.model === "google/gemma-4-31b-it" && t.auto, t);
ok("…preferring a fast model over a «thinking» one (no skips needed)", !seen.includes("deepseek-ai/deepseek-v4.1-flash"), seen);
seen.length = 0;
const r = await P.chatWithFallback({ ...env, NVIDIA_MODEL: "meta/llama-3.3-70b-instruct" }, { system: "s", msgs: [{ role: "user", content: "hi" }], imgs: [], max: 50 });
ok("a hand-typed model that was retired (410) falls back to an available one in chat", r.provider === "nvidia" && r.model === "google/gemma-4-31b-it" && r.first, { model: r.model, seen });
const st = P.providerStatus(env).find(p => p.id === "nvidia");
ok("admin status shows auto + the chosen model", st.auto && st.model === "google/gemma-4-31b-it", st);
// ٣) موديل بطيء (بيفكر وساكت) → «اختبر» بيعدّيه ويلاقي موديل أسرع
{ const P2 = await import(new URL("../server/providers.js?slow", import.meta.url));
  globalThis.fetch = async (u, o) => { u = String(u);
    if (u.endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "deepseek-ai/deepseek-v4.1-flash" }, { id: "nvidia/nemotron-3-super-120b-a12b" }] }));
    const m = JSON.parse(o.body).model;
    if (m.includes("deepseek")) return new Promise((res, rej) => o.signal.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" }))));
    return new Response(`data: ${JSON.stringify({ choices: [{ delta: { content: "أهلاً" } }] })}\n\n`); };
  const t2 = await P2.testProvider({ NVIDIA_API_KEY: "nvapi-y", FIRST_TOKEN_MS: "5000" }, "nvidia");
  ok("a slow «thinking» model is skipped and a faster one is chosen", t2.ok && /nemotron/.test(t2.model) && t2.tried.some(x => /deepseek.*بطيء/.test(x)), t2); }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

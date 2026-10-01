// اختبارات السيرفر وطبقة الصوت — Node 18+ بس، من غير أي مكتبات ومن غير مفاتيح حقيقية (المزوّدات متقلّدة).
// التشغيل: node tests/server.test.mjs
import { spawn, execFileSync } from "node:child_process";
import { readdirSync, readFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), SRV = path.join(ROOT, "server");
let pass = 0, fail = 0; const skipped = [];
const ok = (name, cond, info = "") => { cond ? pass++ : fail++; console.log((cond ? "✅ " : "❌ ") + name + (cond ? "" : "  → " + String(info).slice(0, 300))); };
const skip = (name, why) => { skipped.push(name); console.log("⏭️  " + name + " — " + why); };

// ---------- 1) JavaScript syntax ----------
const jsFiles = [...readdirSync(ROOT).filter(f => f.endsWith(".js")).map(f => path.join(ROOT, f)), ...["worker.js", "persona.js", "tts.js", "voice-config.js", "worker-bundle.js", "node.mjs"].map(f => path.join(SRV, f))];
for (const f of jsFiles) { let e = ""; try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); } catch (x) { e = String(x.stderr || x); } ok("syntax: " + path.relative(ROOT, f), !e, e); }

// ---------- mocked providers (global fetch) ----------
globalThis.__TUTOR_LOG_OFF = true;   // اللوج المنظّم بيتختبر لوحده تحت
const { handle } = await import(path.join(SRV, "worker.js"));
const { ttsChain, ttsWarnings, PROVIDERS } = await import(path.join(SRV, "tts.js"));
const realFetch = globalThis.fetch; const calls = [];
const wav = () => { const n = 2400, b = new Uint8Array(44 + n * 2); const v = new DataView(b.buffer); "RIFF".split("").forEach((c, i) => b[i] = c.charCodeAt(0)); v.setUint32(4, 36 + n * 2, true); "WAVEfmt ".split("").forEach((c, i) => b[8 + i] = c.charCodeAt(0)); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 24000, true); v.setUint32(28, 48000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); "data".split("").forEach((c, i) => b[36 + i] = c.charCodeAt(0)); v.setUint32(40, n * 2, true); return b; };
let MODE = {};   // per-provider behaviour: "ok" | "401" | "429" | "500" | "hang"
const mockFetch = globalThis.fetch = async (url, init = {}) => {
  const u = String(url), prov = /azure|tts\.speech/.test(u) ? "azure" : /piper/.test(u) ? "piper" : /elevenlabs/.test(u) ? "elevenlabs" : /oai-compat/.test(u) ? "openai_compatible" : /openai/.test(u) ? "openai" : "other";
  calls.push({ prov, url: u, body: typeof init.body === "string" ? init.body : "" });
  const m = MODE[prov] || "ok";
  if (m === "hang") return new Promise((_, rej) => init.signal?.addEventListener("abort", () => rej(init.signal.reason || Object.assign(new Error("aborted"), { name: "AbortError" }))));
  if (m === "401") return new Response(JSON.stringify({ error: { message: "invalid key" } }), { status: 401 });
  if (m === "429") return new Response("{}", { status: 429 });
  if (m === "500") return new Response(JSON.stringify({ error: "boom" }), { status: 500 });
  return new Response(wav(), { status: 200, headers: { "content-type": prov === "piper" ? "text/html" : "audio/mpeg" } });
};
const ENV = { AZURE_SPEECH_KEY: "SECRET-AZ", AZURE_SPEECH_REGION: "westeurope", PIPER_URL: "http://piper.local", ALLOWED_ORIGINS: "https://me.github.io", RATE_LIMIT_MULTIPLIER: "100" };
const tts = (body, env = ENV, origin) => handle(new Request("https://w.dev/api/tts", { method: "POST", headers: { "content-type": "application/json", ...(origin ? { origin } : {}) }, body: typeof body === "string" ? body : JSON.stringify(body) }), env);
const get = (p, env = ENV) => handle(new Request("https://w.dev" + p), env);

// ---------- 2–3) health endpoint (no secrets) ----------
{ const r = await get("/v1/health"), j = await r.json(), txt = JSON.stringify(j);
  ok("health: 200 + TTS engines listed", r.status === 200 && j.tts?.provider === "piper" && j.tts.chain.includes("azure"), txt.slice(0, 200));
  ok("health: never exposes secrets", !txt.includes("SECRET-AZ"), txt); }

// ---------- 4) TTS provider configuration ----------
ok("TTS_PROVIDER=azure → only azure", JSON.stringify(ttsChain({ ...ENV, TTS_PROVIDER: "azure" })) === '["azure"]');
ok("TTS_PROVIDER=azure,piper keeps that order", JSON.stringify(ttsChain({ ...ENV, TTS_PROVIDER: "azure,piper" })) === '["azure","piper"]');
ok("TTS_AUTO_FALLBACK=true adds the other configured engines after", JSON.stringify(ttsChain({ ...ENV, TTS_PROVIDER: "azure", TTS_AUTO_FALLBACK: "true" })) === '["azure","piper"]');
ok("no TTS_PROVIDER → all configured engines, auto order", JSON.stringify(ttsChain(ENV)) === '["piper","azure"]');
ok("bad AZURE_VOICES JSON → warning + default voices", ttsWarnings({ ...ENV, AZURE_VOICES: "{oops" }).some(w => /AZURE_VOICES/.test(w)) && PROVIDERS.azure.voices({ AZURE_VOICES: "{oops" })[0].id === "ar-EG-ShakirNeural");

// ---------- 6) invalid provider name ----------
{ const env = { ...ENV, TTS_PROVIDER: "azur" }, r = await get("/v1/health", env), j = await r.json();
  ok("unknown TTS_PROVIDER name → clear warning (not silent)", j.ttsWarnings.some(w => /azur/.test(w) && /مش معروف/.test(w)), JSON.stringify(j.ttsWarnings)); }

// ---------- 7) missing API key ----------
{ const env = { TTS_PROVIDER: "azure", ALLOWED_ORIGINS: "*" }, r = await tts({ text: "مرحبا" }, env), j = await r.json();
  ok("TTS_PROVIDER=azure without AZURE_SPEECH_KEY → 503 + says which variable is missing", r.status === 503 && /AZURE_SPEECH_KEY/.test(j.error), r.status + " " + j.error);
  const h = await (await get("/v1/health", env)).json();
  ok("…and health shows tts:null with the warning", h.tts === null && h.ttsWarnings.some(w => /AZURE_SPEECH_KEY/.test(w))); }

// ---------- 5) request validation ----------
for (const [name, body, code] of [["empty text → 400", { text: "  " }, 400], ["no text field → 400", { x: 1 }, 400], ["bad JSON → 400", "{oops", 400], ["too long → 413", { text: "ا".repeat(1600) }, 413]]) { const r = await tts(body); ok("validation: " + name, r.status === code, r.status); }
{ const r = await tts({ text: "مرحبا" }, ENV, "https://evil.example"); ok("CORS: other websites blocked (403)", r.status === 403); }
{ const r = await tts({ text: "مرحبا" }, ENV, "https://me.github.io"); ok("CORS: your site allowed + custom headers exposed", r.status === 200 && r.headers.get("access-control-allow-origin") === "https://me.github.io" && /x-tts-rate/.test(r.headers.get("access-control-expose-headers"))); }
{ calls.length = 0; const r = await tts({ text: "مرحبا", voice: "../../etc" }); ok("unknown/unsafe voice id ignored → default voice", r.status === 200 && r.headers.get("x-tts-voice") === "ar_JO-kareem-medium"); }

// ---------- 8) audio response + speed forwarded ----------
for (const rate of [0.75, 1, 1.25, 1.5]) {
  calls.length = 0; const r = await tts({ text: "الغشاء cell membrane بيحمي الخلية.", voice: "ar-EG-ShakirNeural", rate });
  const ssml = calls.find(c => c.prov === "azure")?.body || "", pct = Math.round((rate - 1) * 100), want = `rate="${pct >= 0 ? "+" : ""}${pct}%"`;
  ok(`speed ${rate}× → Azure SSML ${want}, x-tts-rate ${rate}, audio returned`, r.status === 200 && /^audio\//.test(r.headers.get("content-type")) && ssml.includes(want) && +r.headers.get("x-tts-rate") === rate && (await r.arrayBuffer()).byteLength > 44, ssml.slice(0, 200));
}
{ calls.length = 0; const r = await tts({ text: "مرحبا", rate: 1.25 }); const b = JSON.parse(calls[0].body);
  ok("speed → Piper length_scale 0.8 + wav content-type fixed", r.status === 200 && b.length_scale === 0.8 && r.headers.get("content-type") === "audio/wav", JSON.stringify(b)); }
{ calls.length = 0; const r = await tts({ text: "hello", rate: 1.5 }, { ELEVENLABS_API_KEY: "k", ALLOWED_ORIGINS: "*" }); const b = JSON.parse(calls[0].body);
  ok("ElevenLabs speed clamped to 1.2 and reported (site makes up the rest)", b.voice_settings.speed === 1.2 && r.headers.get("x-tts-rate") === "1.2"); }
{ calls.length = 0; const r = await tts({ text: "hello", rate: 0.75 }, { OPENAI_API_KEY: "k", OPENAI_BASE_URL: "http://openai.local/v1", ALLOWED_ORIGINS: "*" }); const b = JSON.parse(calls[0].body);
  ok("OpenAI TTS: speed forwarded (0.75) and reported", b.speed === 0.75 && r.headers.get("x-tts-rate") === "0.75" && r.headers.get("x-tts-provider") === "openai"); }
{ calls.length = 0; const r = await tts({ text: "hello", rate: 1.25 }, { TTS_OAI_URL: "http://oai-compat.local/v1", ALLOWED_ORIGINS: "*" }); const b = JSON.parse(calls[0].body);
  ok("self-hosted OpenAI-compatible TTS: speed forwarded (1.25) and reported", b.speed === 1.25 && r.headers.get("x-tts-rate") === "1.25" && r.headers.get("x-tts-provider") === "openai_compatible"); }
// ---------- one voice for every language (VOICE_ONE, default) + central VOICE_* settings ----------
{ calls.length = 0; await tts({ text: "Solve 2x + 3 = 7 وبعدين اكتب الناتج", voice: "ar-EG-ShakirNeural" }); const ssml = calls.find(c => c.prov === "azure").body;
  ok("one voice (default): mixed Arabic/English read by Shakir only — no switch to an English voice", (ssml.match(/<voice /g) || []).length === 1 && /Shakir/.test(ssml) && !/Andrew/.test(ssml) && ssml.includes("Solve 2x + 3 = 7 وبعدين"), ssml); }
{ calls.length = 0; await tts({ text: "Newton's second law says F = m a, and that's it.", lang: "en" }, { ...ENV, TTS_PROVIDER: "azure" }); const ssml = calls.find(c => c.prov === "azure").body;
  ok("one voice: an all-English reply keeps the same default voice (Shakir), not Andrew", /Shakir/.test(ssml) && !/Andrew/.test(ssml), ssml); }
{ calls.length = 0; await tts({ text: "Solve 2x + 3 = 7 وبعدين اكتب الناتج", voice: "ar-EG-ShakirNeural" }, { ...ENV, VOICE_ONE: "false" }); const ssml = calls.find(c => c.prov === "azure").body;
  ok("VOICE_ONE=false keeps the old two-voice mode (English part in Andrew)", /Andrew[^>]*><prosody[^>]*>Solve 2x \+ 3 = 7/.test(ssml) && /Shakir[^>]*><prosody[^>]*>\s*وبعدين/.test(ssml), ssml); }
{ calls.length = 0; const env = { ...ENV, VOICE_PROVIDER: "azure", VOICE_ID: "en-US-AndrewMultilingualNeural" }; await tts({ text: "القوة force بتساوي الكتلة في العجلة" }, env); const ssml = calls.find(c => c.prov === "azure").body;
  ok("VOICE_ID multilingual voice: one <voice>, each language part tagged with <lang> (same voice)", (ssml.match(/<voice /g) || []).length === 1 && /<lang xml:lang="ar-EG">القوة/.test(ssml) && /<lang xml:lang="en-US">force/.test(ssml), ssml);
  const v = PROVIDERS.azure.voices(env).filter(x => x.default);
  ok("VOICE_ID becomes the default voice for both Arabic and English", v.length === 2 && v.every(x => x.id === "en-US-AndrewMultilingualNeural") && new Set(v.map(x => x.lang)).size === 2, JSON.stringify(v)); }
{ const env = { ...ENV, VOICE_PROVIDER: "azure", VOICE_ID: "ar-EG-SalmaNeural" }, h = await (await get("/v1/health", env)).json();
  ok("health reports oneVoice + VOICE_ID (no secrets)", h.tts.oneVoice === true && h.tts.voiceId === "ar-EG-SalmaNeural" && h.tts.provider === "azure" && !JSON.stringify(h).includes("SECRET-AZ"), JSON.stringify(h.tts).slice(0, 200)); }
{ calls.length = 0; const env = { ELEVENLABS_API_KEY: "k", ALLOWED_ORIGINS: "*", VOICE_PROVIDER: "elevenlabs", VOICE_ID: "myVoice123", VOICE_MODEL: "eleven_v3", VOICE_STABILITY: "0.6", VOICE_SIMILARITY: "0.9", VOICE_STYLE: "0.1", VOICE_SPEED: "0.9" };
  await tts({ text: "مرحبا يا بطل", lang: "ar" }, env); await tts({ text: "hello there", lang: "en" }, env);
  const [a, e] = calls.filter(c => c.prov === "elevenlabs"), ba = JSON.parse(a.body), be = JSON.parse(e.body);
  ok("ElevenLabs: same VOICE_ID for Arabic and English + VOICE_MODEL/STABILITY/SIMILARITY/STYLE/SPEED applied", a.url.includes("/myVoice123/") && e.url.includes("/myVoice123/") && ba.model_id === "eleven_v3" && ba.voice_settings.stability === 0.6 && ba.voice_settings.similarity_boost === 0.9 && ba.voice_settings.style === 0.1 && ba.voice_settings.speed === 0.9, a.url + " " + a.body); }
{ calls.length = 0; const env = { OPENAI_API_KEY: "k", OPENAI_BASE_URL: "http://openai.local/v1", ALLOWED_ORIGINS: "*" };
  const r = await tts({ text: "hello", lang: "en", rate: 1 }, { ...env, VOICE_SPEED: "0.9" }); await tts({ text: "ازيك يا بطل", lang: "ar" }, env);
  const [e, a] = calls.filter(c => c.prov === "openai").map(c => JSON.parse(c.body));
  ok("OpenAI: one voice + one style instruction for Arabic and English; VOICE_SPEED applied but not undone by the site", e.voice === a.voice && e.instructions === a.instructions && /Egyptian Arabic/.test(a.instructions) && /English/.test(a.instructions) && e.speed === 0.9 && r.headers.get("x-tts-rate") === "1", JSON.stringify([e, a]).slice(0, 300)); }

// ---------- errors: 401 / 429 / timeout / fallback ----------
MODE = { azure: "401" }; { const r = await tts({ text: "مرحبا" }, { ...ENV, TTS_PROVIDER: "azure" }), j = await r.json();
  ok("invalid API key → 502 with code 'auth' and a clear message", r.status === 502 && j.code === "auth" && /المفتاح غلط/.test(j.error), JSON.stringify(j)); }
MODE = { azure: "429" }; { const t0 = Date.now(), r = await tts({ text: "مرحبا" }, { ...ENV, TTS_PROVIDER: "azure" }), j = await r.json();
  ok("provider limit (429) → retried once, then 429 to the site", r.status === 429 && calls.filter(c => c.prov === "azure").length >= 2 && Date.now() - t0 >= 1000, JSON.stringify(j)); }
MODE = { azure: "hang" }; { const keep = setInterval(() => {}, 500); /* Node مبيستناش timer لوحده — السيرفر الحقيقي دايمًا فيه حاجة شغالة */ const t0 = Date.now(), r = await tts({ text: "مرحبا" }, { ...ENV, TTS_PROVIDER: "azure", TTS_TIMEOUT_MS: "2000" }), j = await r.json();
  ok("provider hangs → timeout 504 (code 'timeout') instead of waiting forever", r.status === 504 && j.code === "timeout" && Date.now() - t0 < 6000, r.status + " " + JSON.stringify(j)); clearInterval(keep); }
MODE = { piper: "500" }; { calls.length = 0; const r = await tts({ text: "مرحبا" });
  ok("first engine fails → next engine answers + x-tts-fallback tells the site", r.status === 200 && r.headers.get("x-tts-provider") === "azure" && /piper/.test(decodeURIComponent(r.headers.get("x-tts-fallback") || ""))); }
MODE = {};

// ---------- 2) real server startup (node server/node.mjs) ----------
{ globalThis.fetch = realFetch; const port = 18000 + Math.floor(Math.random() * 1000);
  const p = spawn(process.execPath, [path.join(SRV, "node.mjs")], { env: { ...process.env, PORT: String(port), AZURE_SPEECH_KEY: "", OPENAI_API_KEY: "", ANTHROPIC_API_KEY: "", GEMINI_API_KEY: "", PIPER_URL: "" }, stdio: "pipe" });
  let up = false; for (let i = 0; i < 40 && !up; i++) { await new Promise(r => setTimeout(r, 150)); try { up = (await fetch(`http://127.0.0.1:${port}/v1/health`)).ok; } catch {} }
  ok("server starts (node server/node.mjs) and answers /v1/health", up);
  if (up) { const h = await (await fetch(`http://127.0.0.1:${port}/v1/health`)).json(); ok("server without keys: chat off, tts null + warning (site falls back to in-browser voice)", h.chat === false && h.tts === null && h.ttsWarnings.length > 0);
    const idx = await fetch(`http://127.0.0.1:${port}/`); ok("server also serves the site (index.html)", idx.ok && /AskMyBook/.test(await idx.text()));
    const env = await fetch(`http://127.0.0.1:${port}/server/.env.example`); ok("server/ folder is never served", env.status === 404); }
  p.kill(); }

// ---------- 8b) teacher persona is injected server-side ----------
{ const { TEACHER_PERSONA } = await import(path.join(SRV, "persona.js")); let sent = null;
  const prev = globalThis.fetch;
  globalThis.fetch = async (u, init = {}) => { if (/chat\/completions/.test(String(u))) { sent = JSON.parse(init.body); return new Response('data: {"choices":[{"delta":{"content":"تمام"}}]}\n\ndata: [DONE]\n\n', { status: 200, headers: { "content-type": "text/event-stream" } }); } return prev(u, init); };
  const chat = (env, system) => handle(new Request("https://w.dev/v1/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ system, messages: [{ role: "user", content: "اشرح" }] }) }), env);
  const E = { OPENAI_API_KEY: "k", ALLOWED_ORIGINS: "*", RATE_LIMIT_MULTIPLIER: "100" };
  let r = await chat(E, "قاعدة المصدر X"); await r.text(); const sys = sent?.messages?.[0]?.content || "";
  ok("chat: persona goes first, then the client's rules (client can't replace it)", r.status === 200 && sys.startsWith(TEACHER_PERSONA) && sys.endsWith("قاعدة المصدر X"), r.status + " " + sys.slice(0, 80));
  sent = null; r = await chat({ ...E, TEACHER_PERSONA: "شخصية مخصصة" }, "ق"); await r.text();
  ok("chat: TEACHER_PERSONA env overrides the built-in text", (sent?.messages?.[0]?.content || "").startsWith("شخصية مخصصة"));
  sent = null; r = await chat({ ...E, TEACHER_PERSONA: "off" }, "ق"); await r.text();
  ok("chat: TEACHER_PERSONA=off disables it", sent?.messages?.[0]?.content === "ق");
  const gen = readFileSync(path.join(ROOT, "persona.js"), "utf8");
  ok("persona.js (browser) is in sync with server/persona.js (run: npm run bundle)", gen.includes(JSON.stringify(TEACHER_PERSONA)));
  globalThis.fetch = prev; }

// ---------- 9) worker-bundle.js is in sync with worker.js + tts.js ----------
{ const tmp = mkdtempSync(path.join(tmpdir(), "bundle-")), out = path.join(tmp, "b.js"); let built = false;
  try { execFileSync("npx", ["-y", "esbuild@0.24.0", "worker.js", "--bundle", "--format=esm", "--platform=neutral", "--outfile=" + out], { cwd: SRV, stdio: "pipe", timeout: 120000 }); built = existsSync(out); } catch {}
  if (!built) skip("worker-bundle.js in sync", "esbuild مش متاح (محتاج نت لـ npx)");
  else { const strip = s => s.replace(/^\/\/ ملف واحد[^\n]*\n/, "").trim(); ok("server/worker-bundle.js is in sync with worker.js + tts.js (run: npm run bundle)", strip(readFileSync(out, "utf8")) === strip(readFileSync(path.join(SRV, "worker-bundle.js"), "utf8"))); }
  rmSync(tmp, { recursive: true, force: true }); }

// ---------- secrets never in public files ----------
{ const pub = [...readdirSync(ROOT).filter(f => /\.(js|html|css|json|md)$/.test(f)), ...readdirSync(SRV).filter(f => /\.(js|mjs|toml|json|md|example)$/.test(f)).map(f => "server/" + f)];
  const hits = pub.filter(f => /AIza[0-9A-Za-z_-]{30,}|sk-[A-Za-z0-9]{20,}|xi-api-key"\s*:\s*"[A-Za-z0-9]{20,}/.test(readFileSync(path.join(ROOT, f), "utf8")));
  ok("no API keys in public files", !hits.length, hits.join(", ")); }

// ---------- request ID + لوج منظّم + حدود الاستخدام + مسح الحساب ----------
globalThis.fetch = mockFetch; MODE = {};
{ const r = await get("/v1/health"); ok("every response carries an x-request-id", /^[\w-]{8,}$/.test(r.headers.get("x-request-id") || ""));
  const r2 = await handle(new Request("https://w.dev/v1/health", { headers: { "x-request-id": "abc-123" } }), ENV); ok("client request id is kept (for tracing)", r2.headers.get("x-request-id") === "abc-123"); }
{ const logs = [], orig = console.log; globalThis.__TUTOR_LOG_OFF = false; console.log = x => logs.push(String(x));
  await tts({ text: "مرحبا" }, { ...ENV, AZURE_SPEECH_KEY: "SECRET-AZ" }); console.log = orig; globalThis.__TUTOR_LOG_OFF = true;
  const L = logs.map(x => { try { return JSON.parse(x); } catch { return null; } }).filter(Boolean);
  ok("structured JSON log per request (rid, route, status, latency, provider)", L.some(l => l.rid && l.route === "tts" && l.status === 200 && typeof l.ms === "number" && l.provider), logs.join("\n").slice(0, 300));
  ok("logs never contain secrets or the request text", !logs.join("\n").includes("SECRET-AZ") && !logs.join("\n").includes("مرحبا")); }
{ const env = { ...ENV, QUOTA_TTS_CHARS_PER_DAY: "12" }, h = { "cf-connecting-ip": "9.9.9.9" };
  const call = t => handle(new Request("https://w.dev/api/tts", { method: "POST", headers: { "content-type": "application/json", ...h }, body: JSON.stringify({ text: t }) }), env);
  const a = await call("مرحبا بيك"), b2 = await call("مرحبا تاني"), j = await b2.json();
  ok("daily quota: over the TTS limit → 429 with code 'quota' (not a crash)", a.status === 200 && b2.status === 429 && j.code === "quota", [a.status, b2.status, j]);
  const u = await (await handle(new Request("https://w.dev/v1/usage", { headers: h }), env)).json();
  ok("/v1/usage shows real usage and limits for this user/IP", u.used.ttsChars === 9 && u.limits.ttsChars === 12 && u.by === "ip", u); }
{ const r = await handle(new Request("https://w.dev/v1/account/delete", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }), ENV);
  ok("account deletion requires a signed-in user (401)", r.status === 401); }

console.log(`\n${pass} passed, ${fail} failed${skipped.length ? ", " + skipped.length + " skipped" : ""}`); process.exit(fail ? 1 : 0);

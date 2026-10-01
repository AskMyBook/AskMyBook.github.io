// صوت Puter (الافتراضي ElevenLabs eleven_multilingual_v2 — عربي واضح، واختيار OpenAI gpt-4o-mini-tts): المحرك الطبيعي المجاني بحساب كل طالب.
// ⚠️ مكتبة Puter متقلّدة هنا (stub بيرجّع ملف صوت سكوت): الاختبار بيتأكد من الربط (التسجيل، الإعدادات اللي بتتبعت، صوت واحد،
//    الاحتياطي لو Puter وقع) — مش من جودة صوت OpenAI الحقيقي ولا من رصيد Puter الحقيقي.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let pw; try { pw = await import(process.env.PLAYWRIGHT_PATH || "playwright"); } catch (e) { console.error("❌ FAILED: Playwright مش متسطّب (" + (e?.message || e).slice(0, 120) + ") — شغّل: npm install && npx playwright install chromium"); process.exit(1); }
const { chromium } = pw.default || pw;
let pass = 0, fail = 0; const errs = [];
const ok = (n, c, info = "") => { c ? pass++ : fail++; console.log((c ? "✅ " : "❌ ") + n + (c ? "" : "  → " + JSON.stringify(info).slice(0, 400))); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const port = 19950 + Math.floor(Math.random() * 40);
const srv = spawn(process.execPath, [path.join(ROOT, "server", "node.mjs")], { env: { ...process.env, PORT: String(port), AZURE_SPEECH_KEY: "", OPENAI_API_KEY: "", ANTHROPIC_API_KEY: "", GEMINI_API_KEY: "", PIPER_URL: "" }, stdio: "pipe" });
for (let i = 0; i < 40; i++) { await sleep(150); try { if ((await fetch(`http://127.0.0.1:${port}/v1/health`)).ok) break; } catch {} }
// نسخة متقلّدة من puter.js: بتسجّل كل طلب صوت، وبترجّع ملف wav سكوت على قد النص
const STUB = `(() => { const wav = s => { const r = 8000, n = Math.round(r * s), v = new DataView(new ArrayBuffer(44 + n * 2)), w = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, r, true); v.setUint32(28, r * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true); return new Blob([v.buffer], { type: "audio/wav" }); };
  window.__pcalls = []; window.__psigned = localStorage.getItem("stub.signed") === "1"; window.__pfail = "";
  window.puter = { auth: { isSignedIn: () => window.__psigned, signIn: async () => { window.__psigned = true; localStorage.setItem("stub.signed", "1"); return {}; } },
    ai: { txt2speech: async (text, o) => { __pcalls.push({ text, ...o }); await new Promise(r => setTimeout(r, 60)); if (window.__pfail) throw { success: false, error: { message: window.__pfail } };
      return new Audio(URL.createObjectURL(wav(Math.min(3, 0.4 + text.length / 60)))); } } }; })();`;
const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
try {
  const ctx = await b.newContext();
  await ctx.addInitScript(() => { localStorage.setItem("dev", "1"); });   // «تلقائي»: الاختبار ده عن Puter/كريم (صوت المتصفح الافتراضي ليه اختبار في regress)
  await ctx.route(/fonts\.(googleapis|gstatic)\.com|huggingface\.co|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|generativelanguage/, r => r.fulfill({ status: 404, body: "" }));
  await ctx.route("https://js.puter.com/**", r => r.fulfill({ status: 200, headers: { "content-type": "text/javascript" }, body: STUB }));
  const page = await ctx.newPage(); page.on("pageerror", e => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/`); await sleep(700);
  const s0 = await page.evaluate(() => ({ cur: TTS.current()?.id, puterAvail: TTS.get("puter").available() }));
  ok("new student (not signed in to Puter): voice starts with in-browser Kareem, Puter skipped silently", s0.cur === "local" && !s0.puterAvail, s0);
  await page.click("#settingsBtn"); await sleep(600);
  const st = await page.evaluate(() => ({ btn: !$("tsign").hidden, txt: $("vnow").innerText }));
  ok("settings: «سجّل دخول Puter» button + a clear hint about the natural voice", st.btn && /سجّل دخول Puter/.test(st.txt), st);
  await page.click("#tsign"); await sleep(500);
  const s1 = await page.evaluate(() => ({ cur: TTS.current()?.id, btn: !$("tsign").hidden, saved: localStorage.getItem("tts.puter"), toast: $("ttoast")?.textContent || "" }));
  ok("after signing in: Puter natural voice becomes the engine, button hidden, remembered", s1.cur === "puter" && !s1.btn && s1.saved === "1" && /الصوت الطبيعي اشتغل/.test(s1.toast), s1);
  await page.evaluate(() => $("settingsBtn").click()).catch(() => {});
  // تشغيل رد مخلوط عربي/إنجليزي
  await page.evaluate(() => { const d = add("a", "بص يا سيدي، قانون نيوتن التاني Newton's second law بيقول إن القوة بتساوي الكتلة في العجلة F = m a. يعني لو زقيت عربية فاضية هتجري أسرع من المليانة، لأن الكتلة أقل. Can you see why? عشان كده الـ acceleration بتقل لما الكتلة تزيد."); window._b = d._spk; d._spk.click(); });
  await page.waitForFunction(() => _b.dataset.st === "play", null, { timeout: 10000 }).catch(() => {});
  await page.waitForFunction(() => _b.dataset.st === "idle", null, { timeout: 30000 }).catch(() => {});
  const c = await page.evaluate(() => __pcalls);
  ok("default: Puter → ElevenLabs eleven_multilingual_v2 (clear Arabic + natural English)", c.length >= 1 && c.every(x => x.provider === "elevenlabs" && x.model === "eleven_multilingual_v2" && x.voice_settings?.stability === 0.5), c.map(x => [x.provider, x.model]));
  ok("ONE voice for Arabic + English parts (same voice on every request)", c.every(x => x.voice === "pNInz6obpgDQGcFmaJgB"), c.map(x => x.voice));
  ok("few big requests (first one short for a fast start), nothing lost", c.length <= 3 && c[0].text.length <= 90 && c.map(x => x.text).join(" ").includes("acceleration"), c.map(x => x.text.length));
  const last = await page.evaluate(() => TTS.last());
  ok("settings remember that Puter really played", last?.id === "puter" && /Adam/.test(last?.voice || ""), last);
  // تغيير الصوت
  await page.evaluate(() => TTS.set({ voice: "oa:coral" })); await page.evaluate(() => { __pcalls.length = 0; voiceSpeak("جملة قصيرة للتجربة.", { btn: _b }); });
  await page.waitForFunction(() => _b.dataset.st === "idle" && __pcalls.length, null, { timeout: 15000 }).catch(() => {});
  const oc = await page.evaluate(() => __pcalls[0]);
  ok("OpenAI voice picked + Arabic sentence → read by ElevenLabs Adam instead (OpenAI's Arabic wasn't intelligible)", oc?.provider === "elevenlabs" && oc.voice === "pNInz6obpgDQGcFmaJgB", oc);
  await page.evaluate(() => { __pcalls.length = 0; voiceSpeak("Newton's second law explains force and acceleration.", { btn: _b }); });
  await page.waitForFunction(() => _b.dataset.st === "idle" && __pcalls.length, null, { timeout: 15000 }).catch(() => {});
  const oe = await page.evaluate(() => __pcalls[0]);
  ok("OpenAI option still available for English: gpt-4o-mini-tts + the chosen voice", oe?.provider === "openai" && oe.model === "gpt-4o-mini-tts" && oe.voice === "coral", oe);
  await page.evaluate(() => { TTS.set({ voice: "ash" }); __pcalls.length = 0; voiceSpeak("تجربة.", { btn: _b }); });   // صوت قديم متسيّف قبل التحديث
  await page.waitForFunction(() => _b.dataset.st === "idle" && __pcalls.length, null, { timeout: 15000 }).catch(() => {});
  ok("an old saved voice from before the update → falls back to the clear ElevenLabs default", (await page.evaluate(() => __pcalls[0]?.provider)) === "elevenlabs");
  await page.evaluate(() => TTS.set({ voice: "" }));
  // رصيد Puter خلص في النص → يكمّل بمحرك تاني من غير ما يعلّق
  await page.evaluate(() => { __pfail = "Insufficient funds: usage limit reached"; __pcalls.length = 0; voiceSpeak("جملة أولى. وجملة تانية كمان عشان نختبر. وتالتة.", { btn: _b }); });
  await page.waitForFunction(() => _b.dataset.st === "idle", null, { timeout: 30000 }).catch(() => {});
  const f = await page.evaluate(() => ({ st: _b.dataset.st, down: TTS.isDown("puter"), toast: $("ttoast")?.textContent || "" }));
  ok("Puter limit reached → user told, continues with another engine, Puter paused ~10 min, player not stuck", f.st === "idle" && f.down && /Puter/.test(f.toast) && /مشتغلش/.test(f.toast), f);
  // بعد التحديث: فاكر إنه متسجّل
  await page.reload(); await sleep(700);
  ok("after reload: Puter is still the voice (sign-in remembered)", (await page.evaluate(() => TTS.current()?.id)) === "puter");
  // سجّل خروج من Puter → يتخطّاه بهدوء
  await page.evaluate(() => { localStorage.setItem("stub.signed", "0"); }); await page.reload(); await sleep(600);
  await page.evaluate(() => { const d = add("a", "تجربة بعد الخروج من Puter."); window._b = d._spk; d._spk.click(); });
  await page.waitForFunction(() => _b.dataset.st === "idle", null, { timeout: 30000 }).catch(() => {});
  const g = await page.evaluate(() => ({ cur: TTS.current()?.id, saved: localStorage.getItem("tts.puter"), toast: $("ttoast")?.textContent || "" }));
  ok("signed out → falls back quietly (no scary error), tells how to get the natural voice back", g.cur !== "puter" && g.saved === "0" && /سجّل دخول Puter/.test(g.toast) && !/Puter[^\n]*مشتغلش/.test(g.toast), g);   // (كريم مش متاح هنا لأن النت مقفول في الاختبار)
  ok("no page errors", !errs.length, errs);
} finally { await b.close(); srv.kill(); }
console.log(`\n${pass} passed, ${fail} failed  (Puter library mocked — not real ElevenLabs/OpenAI audio)`);
process.exit(fail ? 1 : 0);

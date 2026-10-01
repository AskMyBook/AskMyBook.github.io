// اختبار محادثة المدرّس كاملة (فهم المتابعة + الذاكرة + اللغة + البحث في الكتاب) + مقاطعة الصوت («استنى» / «كمّل»).
// ⚠️ الموديل (LLM) والتعرف على الكلام ومحرك الصوت متقلّدين هنا: الاختبار بيتأكد من اللي المدرّس بيفهمه وبيبعته للموديل
//    (النية، حالة المحادثة، لغة الرد، مقاطع الكتاب) — مش من جودة إجابة موديل حقيقي ولا جودة صوت حقيقي.
// التشغيل: node tests/conversation.test.mjs   (محتاج Playwright زي browser.test)
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), FX = path.join(ROOT, "tests", "fixtures");
let pw; try { pw = await import(process.env.PLAYWRIGHT_PATH || "playwright"); } catch (e) { console.error("❌ FAILED: Playwright مش متسطّب (" + (e?.message || e).slice(0, 120) + ") — شغّل: npm install && npx playwright install chromium"); process.exit(1); }
const { chromium } = pw.default || pw;
let pass = 0, fail = 0; const errs = [];
const ok = (n, c, info = "") => { c ? pass++ : fail++; console.log((c ? "✅ " : "❌ ") + n + (c ? "" : "  → " + JSON.stringify(info).slice(0, 400))); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const port = 19600 + Math.floor(Math.random() * 300);
const srv = spawn(process.execPath, [path.join(ROOT, "server", "node.mjs")], { env: { ...process.env, PORT: String(port), AZURE_SPEECH_KEY: "", OPENAI_API_KEY: "", ANTHROPIC_API_KEY: "", GEMINI_API_KEY: "", PIPER_URL: "", ELEVENLABS_API_KEY: "" }, stdio: "pipe" });
for (let i = 0; i < 40; i++) { await sleep(150); try { if ((await fetch(`http://127.0.0.1:${port}/v1/health`)).ok) break; } catch {} }
const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
try {
  const ctx = await b.newContext(); const page = await ctx.newPage();
  page.on("pageerror", e => errs.push(e.message));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com|huggingface\.co|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|generativelanguage|llm7|kepler|kilo/, r => r.fulfill({ status: 404, body: "" }));
  await page.addInitScript(() => {   // تعرّف على الكلام متقلّد: الاختبار بيقول الكلام بنفسه
    window.__sr = [];
    class FakeSR { constructor() { this.continuous = false; this.interimResults = false; window.__sr.push(this); this.live = false; }
      start() { this.live = true; } stop() { this.end(); } abort() { this.end(); } end() { if (!this.live) return; this.live = false; this.onend?.(); }
      say(t, final = true) { this.onresult?.({ results: [{ 0: { transcript: t }, isFinal: final, length: 1 }] }); } }
    window.SpeechRecognition = window.webkitSpeechRecognition = FakeSR;
  });
  await page.goto(`http://127.0.0.1:${port}/`); await sleep(800);
  await page.setInputFiles("#files", path.join(FX, "newton.pdf")); await sleep(3000);
  await page.click('#tabs button[data-t="chat"]').catch(() => {});
  // موديل متقلّد بيسجّل اللي اتبعتله
  const REPLIES = ["قانون نيوتن التاني: $F = m a$ [1]. تخيل عربية سوبر ماركت فاضية ومليانة. فاهم ليه المليانة أصعب؟", "بص، كل ما تزق أقوى العربية بتسرع أكتر.", "مثال: عربية كتلتها 2 kg وقوة 10 N → عجلة 5 m/s² [1].", "لو الكتلة زادت والقوة ثابتة، العجلة هتقل [1].", "Newton's second law: acceleration = net force / mass [1].", "قانون نيوتن التاني: القوة = الكتلة × العجلة [1].", "الـ acceleration يعني العجلة: قد إيه السرعة بتتغير كل ثانية [1]."];
  await page.evaluate(R => { let i = 0; window.__calls = []; window.__q = 0;
    window.llm = async o => { if (o.purpose === "query") { window.__q++; return "Newton's second law force mass acceleration"; } window.__calls.push({ system: o.system, messages: o.messages, tier: o.tier }); const t = R[i++] || "تمام."; o.onText?.(t); return t; }; }, REPLIES);
  const TURNS = ["اشرحلي قانون نيوتن التاني.", "مش فاهم.", "طب هات مثال.", "طب لو الكتلة زادت؟", "Can you explain that in English?", "طيب رجعها بالعربي.", "مش فاهم الـ acceleration."], out = [];
  for (const q of TURNS) {
    const I = await page.evaluate(q => { const I = TUTOR.parse(q); return { kind: I.kind, mods: I.mods, follow: I.follow, lang: I.lang || "" }; }, q), n0 = await page.evaluate(() => __calls.length);
    await page.fill("#q", q); await page.click("#send");
    await page.waitForFunction(n => __calls.length > n && !document.body.classList.contains("gen"), n0, { timeout: 20000 }).catch(() => {}); await sleep(250);
    const c = await page.evaluate(() => __calls.at(-1)), dia = await page.evaluate(() => TUTOR.dialect()), user = c?.messages?.at(-1)?.content || "", sys = c?.system || "";
    out.push({ q, I, dia, hist: (c?.messages?.length || 1) - 1, task: (sys.split("المطلوب دلوقتي:\n")[1] || "").slice(0, 500), lang: (sys.match(/\n\n(اللغة|Language):[^\n]*/) || [""])[0], book: /Second Law|F = m a/.test(user), other: /Photosynthesis/.test(user), state: (user.match(/حالة المحادثة:[\s\S]*?\n\n/) || [""])[0], xq: await page.evaluate(() => __q) });
  }
  const [t1, t2, t3, t4, t5, t6, t7] = out;
  ok("1 «اشرحلي قانون نيوتن التاني»: explain, Egyptian, English book passage found from an Arabic question", t1.I.kind === "explain" && t1.dia === "eg" && t1.book && !t1.other && t1.xq === 1, t1);
  ok("1 explain instruction: answer sized to the question, closing question optional (no forced template)", /على قد السؤال/.test(t1.task) && /اختياري/.test(t1.task), t1.task);
  ok("2 «مش فاهم»: follow-up → simpler re-explanation of the same topic", t2.I.follow && t2.I.mods.includes("nu") && /نيوتن/.test(t2.state) && t2.book, t2);
  ok("3 «طب هات مثال»: follow-up → real-life example on the same point", t3.I.follow && t3.I.mods.includes("ex") && /من الحياة/.test(t3.task) && /نيوتن/.test(t3.state), t3);
  ok("4 «طب لو الكتلة زادت؟»: follow-up, Newton context kept", t4.I.follow && /نيوتن/.test(t4.state) && t4.book, t4);
  ok("5 «Can you explain that in English?»: reply in English, same topic", t5.dia === "en" && t5.I.follow && t5.I.lang === "en" && /Language:/.test(t5.lang) && /نفس آخر شرح/.test(t5.task) && t5.book, t5);
  ok("6 «طيب رجعها بالعربي»: back to Egyptian Arabic, same topic", t6.dia === "eg" && t6.I.follow && t6.I.lang === "ar" && /المصري/.test(t6.lang) && /نيوتن/.test(t6.state), t6);
  ok("7 «مش فاهم الـ acceleration»: stays in Newton's law and focuses on the term", t7.I.follow && t7.I.mods.includes("nu") && /نيوتن/.test(t7.state) && t7.book && /حتة معينة/.test(t7.task) && !/للمرة التانية/.test(t7.task), t7);
  ok("cross-language search query made once per topic, not every turn", out.every(o => o.xq === 1), out.map(o => o.xq));
  ok("small context: at most 3 previous exchanges sent", out.every(o => o.hist <= 6), out.map(o => o.hist));
  const P = q => page.evaluate(q => { const I = TUTOR.parse(q); return { kind: I.kind, mods: I.mods, follow: I.follow, answering: !!I.answering }; }, q);
  ok("«الإجابة دي صح؟» → check the student's answer", (await P("الإجابة دي صح؟ ٥ نيوتن")).kind === "grade");
  ok("«الإجابة فقط» → answer only", (await P("احسب العجلة لو القوة 10 نيوتن والكتلة 2 كيلو، الإجابة فقط")).mods.includes("direct"));
  ok("«اختبرني» → quiz one question at a time", (await P("اختبرني")).kind === "quiz");
  ok("«لو سمحت اشرحلي الخلية» is a new request, not a follow-up", !(await P("لو سمحت اشرحلي الخلية")).follow);
  await page.evaluate(() => history.push({ role: "user", content: "x" }, { role: "assistant", content: "لو الكتلة اتضاعفت والقوة ثابتة، العجلة هتعمل إيه؟" }));
  const an = await P("هتقل للنص");
  ok("short reply after the teacher's question → treated as the student's answer to it", an.follow && an.answering, an);

  // ----- مقاطعة الصوت: محرك صوت متقلّد (ملف سكوت) عشان الاختبار ميعتمدش على نت -----
  await page.evaluate(() => {
    const wav = s => { const r = 8000, n = r * s, v = new DataView(new ArrayBuffer(44 + n * 2)), w = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
      w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, r, true); v.setUint32(28, r * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true); return new Blob([v.buffer], { type: "audio/wav" }); };
    TTS.register({ id: "fake", label: "fake", kind: "audio", available: () => true, caps: () => ({ pitch: false, mixed: true, langs: ["ar", "en"] }), voices: () => [{ id: "one", name: "One", lang: "ar", default: true }, { id: "one", name: "One", lang: "en", default: true }],
      synth: async ({ text }) => ({ url: URL.createObjectURL(wav(Math.min(6, 1 + text.length / 40))), rate: 1, provider: "fake", voice: "one" }) });
    TTS.set({ provider: "fake" });
    let i = 0; const LONG = "قانون نيوتن التاني بيقول إن العجلة بتتناسب طرديًا مع القوة. يعني كل ما تزق أقوى الحاجة بتسرع أكتر. وكل ما الكتلة تزيد العجلة بتقل. ".repeat(3);
    window.__asked = []; window.llm = async o => { if (o.purpose === "query") return ""; window.__asked.push(o.messages.at(-1).content); const t = i++ === 0 ? LONG : "عشان الكتلة أكبر."; o.onText?.(t); return t; };
  });
  const sr = () => page.evaluate(() => { const r = __sr.at(-1); return { cont: r?.continuous, live: r?.live }; });
  const say = t => page.evaluate(t => { const r = __sr.at(-1); r.say(t); if (!r.continuous) r.end(); }, t);
  const interim = t => page.evaluate(t => __sr.at(-1).say(t, false), t);
  await page.evaluate(() => $("talk").click()); await sleep(300);
  await say("اشرحلي قانون نيوتن التاني");
  await page.waitForFunction(() => window.voiceCtl?.speaking() && !AUD.paused, null, { timeout: 15000 }).catch(() => {}); await sleep(300);
  const s1 = await sr(); ok("voice call: while the teacher speaks a barge-in listener is on", s1.cont === true && s1.live === true, s1);
  await interim("وده صدى كلام المدرس نفسه"); ok("echo of the teacher's own words does not stop it", await page.evaluate(() => voiceCtl.speaking() && !voiceCtl.paused()));
  await interim("استنى");
  ok("«استنى» pauses the voice immediately", await page.evaluate(() => voiceCtl.paused() && AUD.paused));
  const t0 = await page.evaluate(() => AUD.currentTime);
  await say("كمّل"); await sleep(400);
  const r2 = await page.evaluate(() => ({ p: voiceCtl.paused(), a: AUD.paused, t: AUD.currentTime, n: __asked.length }));
  ok("«كمّل» resumes from the same place without asking the AI again", !r2.p && !r2.a && r2.t >= t0 && r2.n === 1, r2);
  await interim("استني"); await say("طب ليه المليانة أصعب؟");
  await page.waitForFunction(() => __asked.length >= 2, null, { timeout: 15000 }).catch(() => {});
  const r3 = await page.evaluate(() => __asked.at(-1) || "");
  ok("a new question after «استنى» replaces the old answer and keeps the conversation context", /طب ليه المليانة أصعب/.test(r3) && /حالة المحادثة/.test(r3), r3.slice(0, 300));
  await page.evaluate(() => $("vstop").click());
  ok("no page errors", !errs.length, errs);
} finally { await b.close(); srv.kill(); }
console.log(`\n${pass} passed, ${fail} failed  (LLM + speech recognition + TTS mocked)`);
process.exit(fail ? 1 : 0);

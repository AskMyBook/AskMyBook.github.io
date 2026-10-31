// اختبار أزرار التحديد على الكتاب (اسأل / المعنى / Definition / نطق / ترجمة / للكراسة) في متصفح حقيقي:
// كتاب فيه نص (بيتقري من طبقة النص) وكتاب صور (الصورة بتروح للذكي اللي بيشوف الصور بدل OCR في المتصفح).
// سيرفر الذكاء متقلّد (/v1/chat و /v1/health) — بنتأكد إن كل زرار بيرد في الشات ومفيش «مقدرتش أقرا».
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), FX = path.join(ROOT, "tests", "fixtures");
let pw; try { pw = await import(process.env.PLAYWRIGHT_PATH || "playwright"); } catch (e) { console.error("❌ FAILED: Playwright مش متسطّب"); process.exit(1); }
const { chromium } = pw.default || pw;
let pass = 0, fail = 0; const errs = [];
const ok = (n, c, info = "") => { c ? pass++ : fail++; console.log((c ? "✅ " : "❌ ") + n + (c ? "" : "  → " + JSON.stringify(info).slice(0, 400))); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const port = 20600 + Math.floor(Math.random() * 90);
const srv = spawn(process.execPath, [path.join(ROOT, "server", "node.mjs")], { env: { ...process.env, PORT: String(port), LOG: "off", ALLOWED_ORIGINS: "*" }, stdio: "ignore" });
for (let i = 0; i < 60; i++) { await sleep(150); try { if ((await fetch(`http://127.0.0.1:${port}/v1/health`)).ok) break; } catch {} }
const b = await chromium.launch(); const calls = [];
let PROV = "";
async function run(book) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }), page = await ctx.newPage();
  page.on("pageerror", e => errs.push(e.message));
  await ctx.route(/fonts|youtube|ytimg|puter|cdnjs|jsdelivr|workers\.dev|mymemory|dictionaryapi|llm7|kepler|kilo|pollinations/, r => r.fulfill({ status: 404, body: "" }));
  await ctx.route(/\/v1\/health/, r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, chat: true, chatProvider: "gemini", vision: true, embed: false, tts: null, stt: false, videos: false }) }));
  await ctx.route(/\/v1\/chat/, async r => { const j = JSON.parse(r.request().postData() || "{}"); calls.push({ imgs: (j.images || []).length, text: JSON.stringify(j.messages).slice(-300) });
    const reply = /اكتب النص اللي في الصورة/.test(JSON.stringify(j.messages)) ? "Newton's first law of motion" : "رد تجريبي من المدرّس على الجزء المحدد";
    await r.fulfill({ status: 200, contentType: "text/event-stream", body: `data: ${JSON.stringify({ t: reply })}\n\ndata: [DONE]\n\n` }); });
  await page.addInitScript(([pv]) => { localStorage.setItem("proxy", "/"); if (pv) { localStorage.setItem("provider", pv); localStorage.setItem("srvmig", "1"); for (const k of ["aimig2", "aimig3", "aimig4"]) localStorage.setItem(k, "1"); } }, [PROV]);
  await page.goto(`http://127.0.0.1:${port}/`); await sleep(900);
  await page.setInputFiles("#files", [path.join(FX, book)]); await sleep(3500);
  const res = {};
  for (const k of ["ask", "mean", "def", "tr", "say"]) {
    const pg = page.locator("#pages .pg").first(); await pg.scrollIntoViewIfNeeded(); const pb = await pg.boundingBox();
    await page.mouse.move(pb.x + pb.width * .92, pb.y + pb.height * .06); await page.mouse.down(); await page.mouse.move(pb.x + pb.width * .05, pb.y + pb.height * .22, { steps: 8 }); await page.mouse.up(); await sleep(300);
    if (!(await page.locator(`#chip [data-k="${k}"]`).isVisible())) { res[k] = "no button"; continue; }
    await page.click(`#chip [data-k="${k}"]`);
    await page.waitForFunction(() => !document.querySelector("#chat .m.a.typing"), null, { timeout: 25000 }).catch(() => {}); await sleep(400);
    res[k] = await page.evaluate(() => [...document.querySelectorAll("#chat .m.a")].at(-1)?.innerText.split("\n")[0] || "");
  }
  await ctx.close(); return res;
}
// «📋 انسخ النص» من كتاب عربي اتعمل PDF من Chrome/Word: العربي جوه الملف حرف حرف وبترتيب الشاشة — لازم يتنسخ كلام مقروء
async function copyArabic() {
  const ctx = await b.newContext({ viewport: { width: 1300, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] }), page = await ctx.newPage();
  page.on("pageerror", e => errs.push(e.message));
  await ctx.route(/fonts|youtube|ytimg|puter|cdnjs|jsdelivr|workers\.dev|mymemory|dictionaryapi|llm7|kepler|kilo|pollinations/, r => r.fulfill({ status: 404, body: "" }));
  await page.addInitScript(() => localStorage.setItem("proxy", "/"));
  await page.goto(`http://127.0.0.1:${port}/`); await sleep(900);
  await page.setInputFiles("#files", [path.join(FX, "arabic-chrome.pdf")]); await sleep(3500);
  const pg = page.locator("#pages .pg").first(); await pg.scrollIntoViewIfNeeded(); const pb = await pg.boundingBox();
  await page.mouse.move(pb.x + pb.width * .97, pb.y + pb.height * .02); await page.mouse.down(); await page.mouse.move(pb.x + pb.width * .03, pb.y + pb.height * .16, { steps: 8 }); await page.mouse.up(); await sleep(300);
  await page.click('#chip [data-k="copy"]'); await sleep(800);
  const t = await page.evaluate(() => navigator.clipboard.readText()); await ctx.close(); return t;
}
try {
  const cp = await copyArabic();
  ok("copy from an Arabic PDF (letters stored one by one, screen order): real words in reading order", /الدرس الأول: قانون نيوتن الثاني/.test(cp) && /القوة تساوي الكتلة مضروبة في العجلة/.test(cp) && !/(?:^|\s)[\u0621-\u064A](?:\s[\u0621-\u064A]){3}/.test(cp), cp.slice(0, 200));
  calls.length = 0; const a = await run("newton.pdf");
  for (const [k, v] of Object.entries(a)) ok(`text book: «${k}» answers in the chat`, v && !/مقدرتش|خطأ|no button/.test(v), v);
  ok("text book: «نطق» reads the selected words", /🔊.*(Newton|law|Physics|Lesson)/i.test(a.say), a.say);
  calls.length = 0; PROV = "free"; const s = await run("scanned.pdf");   // حتى لو الطالب مختار «مجاني»: سيرفر الموقع بيشوف الصور
  for (const [k, v] of Object.entries(s)) ok(`scanned book: «${k}» answers in the chat (no OCR needed)`, v && !/مقدرتش|خطأ|no button/.test(v), v);
  ok("scanned book: the picture goes to the AI", calls.some(c => c.imgs > 0), calls.map(c => c.imgs));
  ok("scanned book: «نطق» reads the text the AI found in the picture", /🔊.*Newton/.test(s.say), s.say);
  ok("no JS errors", !errs.length, errs);
} finally { await b.close(); srv.kill(); }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

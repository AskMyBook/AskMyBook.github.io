// ورقة تمارين: «اشرحلي الدرس» لازم يخلّي الذكي يعلّم الفكرة مش يحل الورقة. «حل السؤال» لسه بيحل. كتاب شرح عادي ميتأثرش.
// ⚠️ الموديل متقلّد: بنتأكد من التعليمات اللي بتتبعت للموديل (system prompt) مش من جودة رده الحقيقي.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), FX = path.join(ROOT, "tests", "fixtures");
let pw; try { pw = await import(process.env.PLAYWRIGHT_PATH || "playwright"); } catch { console.error("❌ FAILED: Playwright مش متسطّب"); process.exit(1); }
const { chromium } = pw.default || pw;
let pass = 0, fail = 0; const errs = [];
const ok = (n, c, info = "") => { c ? pass++ : fail++; console.log((c ? "✅ " : "❌ ") + n + (c ? "" : "  → " + JSON.stringify(info).slice(0, 500))); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const port = 20100 + Math.floor(Math.random() * 300);
const srv = spawn(process.execPath, [path.join(ROOT, "server", "node.mjs")], { env: { ...process.env, PORT: String(port), AZURE_SPEECH_KEY: "", OPENAI_API_KEY: "", ANTHROPIC_API_KEY: "", GEMINI_API_KEY: "", PIPER_URL: "", LOG: "off" }, stdio: "ignore" });
for (let i = 0; i < 40; i++) { await sleep(150); try { if ((await fetch(`http://127.0.0.1:${port}/v1/health`)).ok) break; } catch {} }
const b = await chromium.launch();
const MARK = "المقاطع دي أغلبها تمارين", LMARK = "متحلّهاش ومتسردش إجاباتها";
async function session(pdf, qs) {
  const ctx = await b.newContext(), page = await ctx.newPage(); page.on("pageerror", e => errs.push(e.message));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com|huggingface\.co|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|generativelanguage|llm7|kepler|kilo/, r => r.fulfill({ status: 404, body: "" }));
  await page.goto(`http://127.0.0.1:${port}/`); await sleep(800);
  await page.setInputFiles("#files", path.join(FX, pdf)); await sleep(3000);
  await page.click('#tabs button[data-t="chat"]').catch(() => {});
  await page.evaluate(() => { window.__calls = []; window.llm = async o => { if (o.purpose === "query") return ""; window.__calls.push({ system: o.system || "", user: o.messages.at(-1).content }); const t = "تمام."; o.onText?.(t); return t; }; });
  const res = [];
  for (const q of qs) {
    const n0 = await page.evaluate(() => __calls.length);
    await page.fill("#q", q); await page.click("#send");
    await page.waitForFunction(n => __calls.length > n && !document.body.classList.contains("gen"), n0, { timeout: 20000 }).catch(() => {}); await sleep(300);
    res.push(await page.evaluate(q => { const c = __calls.at(-1) || { system: "", user: "" }; return { kind: TUTOR.parse(q).kind, sys: c.system, user: c.user.slice(0, 200) }; }, q));
  }
  await ctx.close(); return res;
}
try {
  const [e1, e2, e3] = await session("worksheet.pdf", ["اشرحلي الدرس بتاعي", "حل السؤال 3", "مش فاهم الـ goes"]);
  ok("worksheet page + «اشرحلي الدرس بتاعي» → lesson explainer is told to TEACH the idea, not solve the sheet (and to let the student try first)", e1.kind === "explain" && e1.sys.includes(LMARK) && /خلّي الطالب يجاوب الأول/.test(e1.sys) && /ورقة تدريب/.test(e1.sys), { kind: e1.kind, user: e1.user, hasLMark: e1.sys.includes(LMARK) });
  ok("…and told to give a new example of its own (labelled), not reuse the exercises", /مثال جديد من عندك/.test(e1.sys) && /مثال من عندي/.test(e1.sys));
  ok("worksheet + «حل السؤال 3» (explicit solve request) → still solves, no teach-instead note", e2.kind === "solve" && !e2.sys.includes(MARK) && !e2.sys.includes(LMARK), { kind: e2.kind, hasMark: e2.sys.includes(MARK) });
  ok("worksheet + «مش فاهم الـ goes» → explains that point (teach note present, nu instruction present)", e3.sys.includes(MARK) && /الطالب مش فاهم/.test(e3.sys), { hasMark: e3.sys.includes(MARK) });
  const [n1] = await session("newton.pdf", ["اشرحلي قانون نيوتن التاني"]);
  ok("a normal lesson book is NOT affected (no teach-instead note)", n1.kind === "explain" && !n1.sys.includes(MARK), { hasMark: n1.sys.includes(MARK) });
  ok("no page errors", !errs.length, errs);
} finally { await b.close(); srv.kill(); }
console.log(`\n${pass} passed, ${fail} failed  (LLM mocked — checks the instructions sent to the model, not a real model's answer)`);
process.exit(fail ? 1 : 0);

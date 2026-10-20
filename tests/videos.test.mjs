// اختبار فيديوهات يوتيوب: السيرفر (/v1/videos) بيرتّب ويشيل الـ Shorts ويخزّن، والموقع (مركز المذاكرة ← 🎬) بيعرض ويشغّل،
// ومن غير مفتاح YouTube بيعرض روابط بحث بدل ما يقع. يوتيوب نفسه متقلّد بسيرفر محلي (YOUTUBE_API_BASE) — مفيش نت.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), FX = path.join(ROOT, "tests", "fixtures");
let pw; try { pw = await import(process.env.PLAYWRIGHT_PATH || "playwright"); } catch (e) { console.error("❌ FAILED: Playwright مش متسطّب (" + String(e?.message || e).slice(0, 120) + ")"); process.exit(1); }
const { chromium } = pw.default || pw;
let pass = 0, fail = 0; const errs = [];
const ok = (n, c, info = "") => { c ? pass++ : fail++; console.log((c ? "✅ " : "❌ ") + n + (c ? "" : "  → " + JSON.stringify(info).slice(0, 400))); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// يوتيوب المتقلّد: فيديو طويل كويس، وShort عليه مشاهدات كتير (لازم يتشال)، وفيديو أقل
let searches = 0, lastQ = "";
const VID = [["goodvideo01", "شرح ممتاز", "PT18M", 800000, 30000], ["shortvid002", "Short", "PT50S", 9000000, 1], ["okvideo0003", "شرح عادي", "PT9M", 2000, 20]];
const yt = createServer((req, res) => { const u = new URL(req.url, "http://x"); res.setHeader("content-type", "application/json");
  if (u.pathname.endsWith("/search")) { searches++; lastQ = u.searchParams.get("q"); return res.end(JSON.stringify({ items: VID.map(v => ({ id: { videoId: v[0] } })) })); }
  res.end(JSON.stringify({ items: VID.map(v => ({ id: v[0], snippet: { title: v[1], channelTitle: "قناة" }, statistics: { viewCount: String(v[3]), likeCount: String(v[4]) }, contentDetails: { duration: v[2] } })) })); });
await new Promise(r => yt.listen(0, "127.0.0.1", r));
const ytPort = yt.address().port;

async function boot(env) {
  const port = 19900 + Math.floor(Math.random() * 90);
  const srv = spawn(process.execPath, [path.join(ROOT, "server", "node.mjs")], { env: { ...process.env, PORT: String(port), LOG: "off", ALLOWED_ORIGINS: "*", AZURE_SPEECH_KEY: "", OPENAI_API_KEY: "", ANTHROPIC_API_KEY: "", GEMINI_API_KEY: "", GROQ_API_KEY: "", ...env }, stdio: "ignore" });
  for (let i = 0; i < 60; i++) { await sleep(150); try { if ((await fetch(`http://127.0.0.1:${port}/v1/health`)).ok) break; } catch {} }
  return { port, stop: () => srv.kill() };
}
const b = await chromium.launch();
try {
  // ----- ١) السيرفر -----
  let S = await boot({ YOUTUBE_API_KEY: "test", YOUTUBE_API_BASE: `http://127.0.0.1:${ytPort}` });
  const h = await (await fetch(`http://127.0.0.1:${S.port}/v1/health`)).json();
  ok("health says videos are available when YOUTUBE_API_KEY is set", h.videos === true, h);
  const post = q => fetch(`http://127.0.0.1:${S.port}/v1/videos`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ queries: [q] }) });
  let r = await post("شرح الحركة"), j = await r.json();
  ok("server returns ranked videos, Shorts removed", r.status === 200 && j.videos.map(v => v.id).join() === "goodvideo01,okvideo0003", j);
  ok("each video has duration, views and title", j.videos[0].seconds === 1080 && j.videos[0].views === 800000 && j.videos[0].title === "شرح ممتاز", j.videos[0]);
  await (await post("شرح الحركة")).json();
  ok("same search again is served from cache (no extra YouTube quota)", searches === 1, { searches });
  r = await post(""); ok("empty search → 400, not a crash", r.status === 400, r.status);

  // ----- ٢) الموقع -----
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }), page = await ctx.newPage();
  page.on("pageerror", e => errs.push(e.message));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com|huggingface\.co|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|generativelanguage|llm7|kepler|kilo|js\.puter\.com|ytimg\.com|youtube/, r => r.fulfill({ status: 404, body: "" }));
  await page.addInitScript(() => localStorage.setItem("proxy", "/"));
  await page.goto(`http://127.0.0.1:${S.port}/`); await sleep(800);
  await page.setInputFiles("#files", [path.join(FX, "newton.pdf")]); await sleep(3000);
  await page.click("#hubBtn"); await sleep(400);
  ok("book card has a 🎬 videos button", await page.locator(".bcard [data-b=videos]").count() === 1);
  await page.click(".bcard [data-b=videos]"); await page.waitForSelector(".vcard", { timeout: 8000 }).catch(() => {});
  ok("videos tab shows the ranked videos for the book", await page.locator(".vcard").count() === 2, await page.locator("#hubBody").innerText());
  ok("search uses the book's name", /شرح|explained/.test(lastQ) && /newton/i.test(lastQ), lastQ);
  await page.click(".vcard >> nth=0"); await sleep(300);
  ok("clicking a video plays it inside the site (youtube-nocookie embed)", /youtube-nocookie\.com\/embed\/goodvideo01/.test(await page.locator("#vPlayer iframe").getAttribute("src") || ""));
  await page.click("#vClose"); ok("player closes", await page.locator("#vPlayer iframe").count() === 0);
  await page.fill("#vQ", "قانون نيوتن التاني"); await page.click("#vForm button[type=submit]"); await page.waitForSelector(".vcard", { timeout: 8000 }).catch(() => {});
  ok("custom lesson search goes to YouTube with the student's words", lastQ === "قانون نيوتن التاني", lastQ);
  S.stop(); await ctx.close();

  // ----- ٣) من غير مفتاح: روابط بحث، مفيش أخطاء -----
  S = await boot({ YOUTUBE_API_KEY: "" });
  const c2 = await b.newContext(), p2 = await c2.newPage(); p2.on("pageerror", e => errs.push(e.message));
  await c2.route(/fonts\.(googleapis|gstatic)\.com|huggingface\.co|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|generativelanguage|llm7|kepler|kilo|js\.puter\.com/, r => r.fulfill({ status: 404, body: "" }));
  await p2.addInitScript(() => localStorage.setItem("proxy", "/"));
  await p2.goto(`http://127.0.0.1:${S.port}/`); await sleep(800);
  await p2.setInputFiles("#files", [path.join(FX, "newton.pdf")]); await sleep(3000);
  await p2.click("#hubBtn"); await sleep(300); await p2.click('[data-h="videos"]'); await sleep(1200);
  const href = await p2.locator("#vRes .ytlink").getAttribute("href").catch(() => "");
  ok("no YouTube key → a YouTube search link instead of an error", /youtube\.com\/results\?search_query=/.test(href || ""), await p2.locator("#hubBody").innerText());
  S.stop();
  ok("no JS errors", !errs.length, errs);
} finally { await b.close(); yt.close(); }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

// اختبار الكراسة جنب الكتاب: التبديل بين المساعد والكراسة، قفل اللوحة، الكتابة بالقلم (رسم حقيقي بالماوس) والكيبورد،
// الحفظ بعد إعادة التحميل، الصفحات، التراجع، الممحاة، وإن صفحات الكراسة بتظهر في «📓 النوت بوك»، والموبايل.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), FX = path.join(ROOT, "tests", "fixtures");
let pw; try { pw = await import(process.env.PLAYWRIGHT_PATH || "playwright"); } catch (e) { console.error("❌ FAILED: Playwright مش متسطّب (" + String(e?.message || e).slice(0, 120) + ")"); process.exit(1); }
const { chromium } = pw.default || pw;
let pass = 0, fail = 0; const errs = [];
const ok = (n, c, info = "") => { c ? pass++ : fail++; console.log((c ? "✅ " : "❌ ") + n + (c ? "" : "  → " + JSON.stringify(info).slice(0, 400))); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const port = 20300 + Math.floor(Math.random() * 90), SHOTS = process.env.KURASA_SHOTS || "";
const srv = spawn(process.execPath, [path.join(ROOT, "server", "node.mjs")], { env: { ...process.env, PORT: String(port), LOG: "off", ALLOWED_ORIGINS: "*", AZURE_SPEECH_KEY: "", OPENAI_API_KEY: "", ANTHROPIC_API_KEY: "", GEMINI_API_KEY: "", GROQ_API_KEY: "" }, stdio: "ignore" });
for (let i = 0; i < 60; i++) { await sleep(150); try { if ((await fetch(`http://127.0.0.1:${port}/v1/health`)).ok) break; } catch {} }
const BLOCK = /fonts\.(googleapis|gstatic)\.com|huggingface\.co|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|generativelanguage|llm7|kepler|kilo|js\.puter\.com|youtube|ytimg/;
const inkCount = p => p.evaluate(async () => ((await idbGet("nb")) || []).filter(x => !x.del).reduce((n, x) => n + (x.ink || []).length, 0));
const b = await chromium.launch();
try {
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } }), page = await ctx.newPage();
  page.on("pageerror", e => errs.push(e.message));
  await ctx.route(BLOCK, r => r.fulfill({ status: 404, body: "" }));
  await page.addInitScript(() => localStorage.setItem("proxy", "/"));
  await page.goto(`http://127.0.0.1:${port}/`); await sleep(800);
  await page.setInputFiles("#files", [path.join(FX, "newton.pdf")]); await sleep(3000);
  ok("side panel has «المساعد» and «الكراسة» switch + close button", await page.locator('.sidehead [data-sm="kur"]').isVisible() && await page.locator("#sideClose").isVisible());
  await page.click('.sidehead [data-sm="kur"]'); await sleep(500);
  ok("الكراسة opens beside the book (chat hidden, book still visible)", await page.locator("#kPaper").isVisible() && !(await page.locator("#chat").isVisible()) && await page.locator("#viewer").isVisible());
  // رسم بالقلم
  const box = await page.locator("#kCv").boundingBox();
  await page.mouse.move(box.x + 200, box.y + 150); await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + 200 + i * 15, box.y + 150 + Math.sin(i) * 20);
  await page.mouse.up(); await sleep(900);
  ok("drawing with the pen saves a stroke", await inkCount(page) === 1);
  const px = await page.evaluate(() => { const c = document.getElementById("kCv"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; });
  ok("the stroke is really drawn on the page", px > 50, px);
  await page.click("#kUndo"); await sleep(800); ok("undo removes it", await inkCount(page) === 0);
  await page.click("#kRedo"); await sleep(800); ok("redo brings it back", await inkCount(page) === 1);
  // كتابة بالكيبورد
  await page.click('[data-tool="type"]'); await page.keyboard.type("قانون نيوتن الأول"); await sleep(1000);
  await page.fill("#kTitle", "ملخص الفيزيا"); await sleep(1000);
  if (SHOTS) await page.screenshot({ path: SHOTS + "/desk-kurasa.png" });
  // صفحة تانية
  await page.click("#kAdd"); await sleep(500);
  ok("new page opens empty, numbered ٢ / ٢", (await page.textContent("#kNum")) === "٢ / ٢" && (await page.textContent("#kEd")) === "");
  await page.click('[data-tool="pen"]'); const b2 = await page.locator("#kCv").boundingBox();
  await page.mouse.move(b2.x + 100, b2.y + 300); await page.mouse.down(); await page.mouse.move(b2.x + 300, b2.y + 300, { steps: 8 }); await page.mouse.up(); await sleep(800);
  await page.click('[data-tool="erase"]'); await page.mouse.move(b2.x + 200, b2.y + 300); await page.mouse.down(); await page.mouse.move(b2.x + 205, b2.y + 302); await page.mouse.up(); await sleep(900);
  ok("eraser removes the stroke it touches", await inkCount(page) === 1);
  // قفل اللوحة
  const w1 = (await page.locator("#viewer").boundingBox()).width;
  await page.click("#sideClose"); await sleep(300);
  const w2 = (await page.locator("#viewer").boundingBox()).width;
  ok("✕ closes the side panel and the book takes the whole width", !(await page.locator("#side").isVisible()) && w2 > w1 + 300, { w1, w2 });
  if (SHOTS) await page.screenshot({ path: SHOTS + "/desk-off.png" });
  await page.click("#sideBtn"); await sleep(400);
  ok("header button opens it again (still on الكراسة)", await page.locator("#kPaper").isVisible());
  // بعد التحميل
  await page.reload(); await sleep(1500);
  ok("after reload: الكراسة is still open", await page.locator("#kPaper").isVisible());
  await page.click("#kPrev"); await sleep(500);
  ok("after reload: page 1 kept its title, text and drawing", (await page.inputValue("#kTitle")) === "ملخص الفيزيا" && /قانون نيوتن الأول/.test(await page.textContent("#kEd")) && await inkCount(page) === 1, { t: await page.inputValue("#kTitle"), x: await page.textContent("#kEd") });
  // الألوان: أسود وأبيض ظاهرين، وأي لون من المنتقي، ولون الورقة
  ok("black and white are in the notebook colors", await page.locator('#kur [data-color="#111111"]').isVisible() && await page.locator('#kur [data-color="#ffffff"]').isVisible());
  await page.click('[data-tool="pen"]'); await page.locator("#kPick").evaluate(el => { el.value = "#ff00aa"; el.dispatchEvent(new Event("input", { bubbles: true })); });
  const b3 = await page.locator("#kCv").boundingBox(); await page.mouse.move(b3.x + 120, b3.y + 420); await page.mouse.down(); await page.mouse.move(b3.x + 260, b3.y + 430, { steps: 6 }); await page.mouse.up(); await sleep(900);
  const lastC = await page.evaluate(async () => { const p = ((await idbGet("nb")) || []).find(x => x.id === localStorage.getItem("kur.page")); return p?.ink?.at(-1)?.c; });
  ok("a color from the picker is used by the pen", lastC === "#ff00aa", lastC);
  ok("the picker dot shows the custom color as selected", await page.locator("#kur .kcol .kpick.on").count() === 1);
  await page.click("#kPaperBtn"); await page.click('[data-paper="#111111"]'); await sleep(900);
  const look = await page.evaluate(() => { const p = document.getElementById("kPaper"), bg = document.getElementById("kBg"), d = bg.getContext("2d").getImageData(5, 5, 1, 1).data; return { paper: p.style.getPropertyValue("--kpaper"), ink: p.style.getPropertyValue("--kink"), px: [...d.slice(0, 3)] }; });
  ok("black paper: background repainted and typed text turns light", look.paper === "#111111" && look.ink === "#f2f4fa" && look.px.every(v => v < 40), look);
  await page.reload(); await sleep(1500);
  ok("paper color is saved with the page", await page.evaluate(() => document.getElementById("kPaper").style.getPropertyValue("--kpaper")) === "#111111");
  await page.click("#kPaperBtn"); await page.click('[data-paper="auto"]'); await sleep(700);
  ok("«تلقائي» goes back to the theme paper", await page.evaluate(() => document.getElementById("kPaper").style.getPropertyValue("--kpaper")) === "");
  // ناحية الـ PDF: أبيض + أي لون
  ok("PDF tools have white and a «pick any color» button", await page.locator('#colors [data-c="#ffffff"]').count() === 1 && await page.locator("#inkPick").count() === 1);
  await page.locator("#inkPick").evaluate(el => { el.value = "#00b3a4"; el.dispatchEvent(new Event("input", { bubbles: true })); });
  ok("picking a color on the PDF side switches to the pen with that color", await page.evaluate(() => INK.pc === "#00b3a4" && INK.tool === "pen"));
  // مركز المذاكرة
  await page.click("#hubBtn"); await sleep(300); await page.click('[data-h="notebook"]'); await sleep(500);
  ok("الكراسة pages show in «📓 النوت بوك»", /ملخص الفيزيا/.test(await page.textContent(".nblist")));
  await page.click("#hubClose"); await sleep(200);
  // المساعد يرجع لما الطالب يسأل
  await page.click('.sidehead [data-sm="chat"]'); await sleep(200);
  ok("switching back shows the tutor chat", await page.locator("#q").isVisible() && !(await page.locator("#kPaper").isVisible()));
  if (SHOTS) await page.screenshot({ path: SHOTS + "/desk-chat.png" });
  await ctx.close();
  // موبايل
  const m = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }), mp = await m.newPage(); mp.on("pageerror", e => errs.push(e.message));
  await m.route(BLOCK, r => r.fulfill({ status: 404, body: "" })); await mp.addInitScript(() => localStorage.setItem("proxy", "/"));
  await mp.goto(`http://127.0.0.1:${port}/`); await sleep(1000);
  await mp.click('#tabs [data-t="kur"]'); await sleep(600);
  const ov = await mp.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok("mobile: «الكراسة» tab opens the notebook full screen, no sideways scroll", await mp.locator("#kPaper").isVisible() && ov <= 0, { ov });
  if (SHOTS) await mp.screenshot({ path: SHOTS + "/mob-kurasa.png" });
  await mp.click('#tabs [data-t="chat"]'); await sleep(300);
  ok("mobile: «المساعد» tab goes back to the chat", await mp.locator("#q").isVisible());
  await m.close();
  ok("no JS errors", !errs.length, errs);
} finally { await b.close(); srv.kill(); }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

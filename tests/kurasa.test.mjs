// اختبار تنظيم الشاشة + الكراسة + مهارات المساعد في متصفح حقيقي:
// الكراسة جنب الكتاب (صفحات ورا بعض، أطول، من غير هامش أحمر)، قلم/ممحاة/كتابة/تراجع، صور من الكتاب، ألوان ولون الورقة، حفظ PDF،
// اللوحة الجانبية (سحب للتكبير، شاشة كاملة، قفل)، الكراسة مكان الكتاب من الشريط اللي فوق، المساعد العايم، سؤال المساعد عن الكراسة،
// «هاتلي فيديوهات» في الشات (يوتيوب متقلّد) والفيديو يشتغل مكان الكتاب أو جنب الكراسة، ومؤشر القلم على الكتاب، والموبايل.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), FX = path.join(ROOT, "tests", "fixtures");
let pw; try { pw = await import(process.env.PLAYWRIGHT_PATH || "playwright"); } catch (e) { console.error("❌ FAILED: Playwright مش متسطّب (" + String(e?.message || e).slice(0, 120) + ")"); process.exit(1); }
const { chromium } = pw.default || pw;
let pass = 0, fail = 0; const errs = [];
const ok = (n, c, info = "") => { c ? pass++ : fail++; console.log((c ? "✅ " : "❌ ") + n + (c ? "" : "  → " + JSON.stringify(info).slice(0, 400))); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SHOTS = process.env.KURASA_SHOTS || "";
// يوتيوب متقلّد
let lastQ = "";
const VID = [["goodvideo01", "شرح قانون نيوتن التاني", "PT14M", 500000, 20000], ["okvideo0003", "قانون نيوتن مراجعة", "PT8M", 9000, 300]];
const yt = createServer((req, res) => { const u = new URL(req.url, "http://x"); res.setHeader("content-type", "application/json");
  if (u.pathname.endsWith("/search")) { lastQ = u.searchParams.get("q"); return res.end(JSON.stringify({ items: VID.map(v => ({ id: { videoId: v[0] } })) })); }
  res.end(JSON.stringify({ items: VID.map(v => ({ id: v[0], snippet: { title: v[1], channelTitle: "قناة" }, statistics: { viewCount: String(v[3]), likeCount: String(v[4]) }, contentDetails: { duration: v[2] } })) })); });
await new Promise(r => yt.listen(0, "127.0.0.1", r));
const port = 20300 + Math.floor(Math.random() * 90);
const srv = spawn(process.execPath, [path.join(ROOT, "server", "node.mjs")], { env: { ...process.env, PORT: String(port), LOG: "off", ALLOWED_ORIGINS: "*", YOUTUBE_API_KEY: "test", YOUTUBE_API_BASE: `http://127.0.0.1:${yt.address().port}`, AZURE_SPEECH_KEY: "", OPENAI_API_KEY: "", ANTHROPIC_API_KEY: "", GEMINI_API_KEY: "", GROQ_API_KEY: "" }, stdio: "ignore" });
for (let i = 0; i < 60; i++) { await sleep(150); try { if ((await fetch(`http://127.0.0.1:${port}/v1/health`)).ok) break; } catch {} }
const BLOCK = /fonts\.(googleapis|gstatic)\.com|huggingface\.co|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|generativelanguage|llm7|kepler|kilo|js\.puter\.com|youtube|ytimg|workers\.dev/;
const nb = p => p.evaluate(async () => ((await idbGet("nb")) || []).filter(x => !x.del));
const inkCount = async p => (await nb(p)).reduce((n, x) => n + (x.ink || []).length, 0);
const cv = (p, i = 0) => p.locator(".kpage .kcv").nth(i);
async function stroke(p, i, x0, y0, x1, y1, steps = 10) { const b = await cv(p, i).boundingBox(); await p.mouse.move(b.x + x0, b.y + y0); await p.mouse.down(); await p.mouse.move(b.x + x1, b.y + y1, { steps }); await p.mouse.up(); }
async function ask(p, q) { await p.fill("#q", q); await p.press("#q", "Enter"); await sleep(1200); }
const b = await chromium.launch();
try {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true }), page = await ctx.newPage();
  page.on("pageerror", e => errs.push(e.message)); page.on("dialog", d => d.accept());
  await ctx.route(BLOCK, r => r.fulfill({ status: 404, body: "" }));
  await page.addInitScript(() => localStorage.setItem("proxy", "/"));
  await page.goto(`http://127.0.0.1:${port}/`); await sleep(800);
  await page.setInputFiles("#files", [path.join(FX, "newton.pdf")]); await sleep(3000);

  // ===== حالة قراءة الكتاب فوق مش في الشات =====
  ok("book-reading status shows as a slim bar on top, not a chat message", await page.locator("#bkStatus .bkst").count() === 1 && !/قريت الكتاب|بقرا الكتاب/.test(await page.locator("#chat").innerText()));
  // ===== الكتاب: مفيش شريط أصفر بيمشي ورا الماوس =====
  { const pb0 = await page.locator("#pages .pg").first().boundingBox(); await page.mouse.move(pb0.x + pb0.width / 2, pb0.y + 200); await page.mouse.move(pb0.x + pb0.width / 2 + 5, pb0.y + 260, { steps: 3 }); await sleep(200);
    ok("hovering the PDF with the mouse shows nothing", await page.locator("#band").isHidden() && await page.locator("#chip").isHidden());
    await page.mouse.click(pb0.x + pb0.width / 2, pb0.y + 300); await sleep(200);
    ok("a plain click on the PDF selects nothing", await page.locator("#chip").isHidden()); }
  // ===== الكراسة جنب الكتاب =====
  await page.click('.sidehead [data-sm="kur"]'); await sleep(600);
  ok("الكراسة opens beside the book", await page.locator("#side #kur.show .kpage").count() === 1 && await page.locator("#pages").isVisible());
  const geo = await page.evaluate(() => { const p = document.querySelector(".kpaper"), bg = p.querySelector(".kbg"), g = bg.getContext("2d"), k = bg.width / 800;
    const at = (x, y) => [...g.getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data.slice(0, 3)]; return { h: parseInt(p.style.height), margin: at(712.5, 20), paper: at(400, 20) }; });
  ok("pages are taller (1440)", geo.h >= 1440, geo.h);
  ok("no red margin line (margin pixel = paper color)", JSON.stringify(geo.margin) === JSON.stringify(geo.paper), geo);
  await stroke(page, 0, 200, 150, 380, 170); await sleep(900);
  ok("pen draws a stroke", await inkCount(page) === 1);
  await page.click("#kUndo"); await sleep(700); ok("undo", await inkCount(page) === 0);
  await page.click("#kRedo"); await sleep(700); ok("redo", await inkCount(page) === 1);
  ok("pen cursor in الكراسة is a pen icon (no +)", /^url\("data:image\/svg\+xml/.test(await page.evaluate(() => getComputedStyle(document.querySelector(".kcv")).cursor)));
  await page.click('#kur [data-tool="type"]'); await page.keyboard.type("قانون نيوتن الأول"); await page.fill("#kTitle", "ملخص الفيزيا"); await sleep(1000);
  // صفحات ورا بعض
  await page.click("#kAddPage"); await sleep(900);
  ok("＋ at the bottom adds page ٢ under page ١", await page.locator(".kpage").count() === 2 && (await page.textContent("#kNum")) === "٢ / ٢");
  await page.locator("#kScroll").evaluate(el => { el.scrollTop = 0; }); await sleep(400);
  ok("scrolling up shows page ١ as current", (await page.textContent("#kNum")) === "١ / ٢" && (await page.inputValue("#kTitle")) === "ملخص الفيزيا");
  await page.locator("#kScroll").evaluate(el => { el.scrollTop = el.scrollHeight; }); await sleep(500);
  ok("scrolling down reaches the next page", (await page.textContent("#kNum")) === "٢ / ٢");
  await page.click('#kur [data-tool="pen"]'); await stroke(page, 1, 100, 300, 300, 300, 8); await sleep(800);
  await page.click('#kur [data-tool="erase"]'); await stroke(page, 1, 200, 300, 205, 302, 2); await sleep(900);
  ok("eraser removes the stroke it touches (other page untouched)", await inkCount(page) === 1);
  if (SHOTS) await page.screenshot({ path: SHOTS + "/k-side.png" });

  // ===== من الكتاب للكراسة: علّم بمربع ← «📓 للكراسة» =====
  await page.click('#tools [data-tool="select"]').catch(() => {});
  const pg = page.locator("#pages .pg").first(); await pg.scrollIntoViewIfNeeded(); const pb = await pg.boundingBox();
  await page.mouse.move(pb.x + pb.width * .9, pb.y + pb.height * .3); await page.mouse.down(); await page.mouse.move(pb.x + pb.width * .5, pb.y + pb.height * .45, { steps: 8 }); await page.mouse.up(); await sleep(400);
  ok("drawing a box on the PDF shows «📓 للكراسة»", await page.locator('#chip [data-k="kur"]').isVisible());
  await page.click('#chip [data-k="kur"]'); await sleep(2000);
  const imgs = (await nb(page)).flatMap(x => x.imgs || []);
  ok("the boxed part lands in الكراسة as a picture", imgs.length === 1 && /^data:image\/jpeg/.test(imgs[0].src) && await page.locator(".kimg img").count() === 1, imgs.length);
  const ib = await page.locator(".kimg").boundingBox(), x0 = imgs[0].x;
  await page.mouse.move(ib.x + ib.width / 2, ib.y + ib.height / 2); await page.mouse.down(); await page.mouse.move(ib.x + ib.width / 2 - 60, ib.y + ib.height / 2 + 40, { steps: 6 }); await page.mouse.up(); await sleep(900);
  const x1 = (await nb(page)).flatMap(x => x.imgs || [])[0].x;
  ok("✋ moves the picture", x1 !== x0, { x0, x1 });
  if (SHOTS) await page.screenshot({ path: SHOTS + "/k-img.png" });
  // مؤشر القلم على الكتاب
  await page.click('#tools [data-tool="pen"]'); await sleep(200);
  ok("pen cursor on the PDF is a pen icon (no +)", /^url\("data:image\/svg\+xml/.test(await page.evaluate(() => getComputedStyle(document.querySelector("#pages canvas.ink")).cursor)));
  await page.click('#tools [data-tool="select"]').catch(() => {});

  // ===== اللوحة الجانبية: سحب / شاشة كاملة / قفل =====
  const w0 = (await page.locator("#side").boundingBox()).width, sp = await page.locator("#split").boundingBox();
  await page.mouse.move(sp.x + sp.width / 2, sp.y + sp.height / 2); await page.mouse.down(); await page.mouse.move(sp.x + sp.width / 2 + 200, sp.y + sp.height / 2, { steps: 6 }); await page.mouse.up(); await sleep(400);
  const w1 = (await page.locator("#side").boundingBox()).width;
  ok("dragging the divider makes الكراسة wider", w1 > w0 + 120, { w0, w1 });
  await page.click("#sideMax"); await sleep(400);
  ok("⤢ makes الكراسة take the whole screen", !(await page.locator("#viewer").isVisible()) && (await page.locator("#side").boundingBox()).width > 1300);
  await page.click("#sideMax"); await sleep(300);
  await page.click("#sideClose"); await sleep(300);
  ok("✕ closes the panel, book takes the width", !(await page.locator("#side").isVisible()));
  await page.click("#sideBtn"); await sleep(400);

  // ===== الكراسة مكان الكتاب من الشريط اللي فوق =====
  await page.click('#views [data-v="kur"]'); await sleep(600);
  ok("«📓 الكراسة» in the top bar puts it in place of the book", await page.locator("#viewer #kur.show").count() === 1 && !(await page.locator("#pages").isVisible()));
  ok("…and the side panel shows the tutor", await page.locator("#side #chat").isVisible());
  if (SHOTS) await page.screenshot({ path: SHOTS + "/k-main.png" });
  await page.click("#books button >> nth=0"); await sleep(600);
  ok("clicking the book name brings the PDF back", await page.locator("#pages").isVisible() && await page.locator("#viewer #kur").count() === 0);

  // ===== المساعد العايم =====
  await page.click('.sidehead [data-sm="kur"]'); await sleep(300);
  await page.click("#aiBtn"); await sleep(500);
  ok("🤖 opens the tutor floating on top, الكراسة stays open", await page.locator("#aiFloat #chat").isVisible() && await page.locator("#side #kur.show").isVisible() && await page.locator("#pages").isVisible());
  // اسأل عن الكراسة
  await page.click("#kAsk"); await sleep(1200);
  ok("«🤖 اسأل» attaches the page picture and prepares the question", await page.locator("#attach img").count() === 1 && /الكراسة/.test(await page.inputValue("#q")));
  await page.click("#attach [data-x]").catch(() => {}); await page.fill("#q", "");
  if (SHOTS) await page.screenshot({ path: SHOTS + "/k-float.png" });
  // ===== مهارات المساعد: فيديوهات =====
  await ask(page, "حيبلي فيديوهات يوتيوب عن قانون نيوتن التاني"); await sleep(1500);
  ok("the welcome suggestions hide once the chat starts", await page.locator("#chat .hello").isHidden().catch(() => true));
  ok("«هاتلي فيديوهات…» in the chat shows video cards", await page.locator("#chat .vchat .vc").count() === 2, await page.locator("#chat").innerText().then(t => t.slice(-300)));
  ok("…searched for the topic (+ the book name for context)", lastQ.startsWith("قانون نيوتن التاني") && !/هات|حيبلي|فيديو|يوتيوب/.test(lastQ), lastQ);
  const t1 = await page.evaluate(() => SKILLS.videoTopic("عايز فيديو عن الدرس الاول في الكتاب ده"));
  ok("«الدرس الاول في الكتاب ده» → the real first lesson name from the book", /Lesson 1|Newton/i.test(t1) && !/الكتاب ده|الدرس الاول/.test(t1), t1);
  ok("the «open on YouTube» fallback is a real link, not raw markdown", await page.evaluate(() => !document.getElementById("chat").innerText.includes("](http")));
  await page.click('#chat .vc >> nth=0 >> [data-play="main"] >> nth=1'); await sleep(600);
  ok("▶ «مكان الكتاب» plays the video in place of the book", /youtube-nocookie\.com\/embed\/goodvideo01/.test(await page.locator("#viewer #vidPane iframe").getAttribute("src").catch(() => "")));
  ok("the video shows as a chip in the top bar", await page.locator("#views .vchip").count() === 1);
  if (SHOTS) await page.screenshot({ path: SHOTS + "/k-video.png" });
  await page.click('#vidPane [data-vp="move"]'); await sleep(500);
  ok("⇥ moves the video into the side panel, book comes back", await page.locator("#side #vidPane.show iframe").count() === 1 && await page.locator("#pages").isVisible());
  await page.click('.sidehead [data-sm="kur"]'); await sleep(500);
  ok("switching to الكراسة stops the video (no player left running in the background)", await page.locator("#vidPane iframe").count() === 0 && await page.locator("#side #kur.show").isVisible());
  await page.click('.sidehead [data-sm="vid"]'); await sleep(500);
  ok("switching back to the video brings it back", await page.locator("#side #vidPane.show iframe").count() === 1);
  await page.evaluate(() => { const f = document.querySelector("#vidPane iframe"); window.__vsrc = f.src; });
  await page.click('#views [data-v="kur"]'); await sleep(400); await page.click("#books button >> nth=0"); await sleep(400);
  ok("opening الكراسة/book elsewhere doesn't restart the video", await page.evaluate(() => document.querySelector("#vidPane iframe")?.src === window.__vsrc));
  await page.click('#vidPane [data-vp="close"]'); await sleep(400);
  ok("✕ closes the video", await page.locator("#views .vchip").count() === 0 && await page.locator("#vidPane iframe").count() === 0);
  await ask(page, "https://youtu.be/dQw4w9WgXcQ"); await sleep(400);
  ok("a YouTube link in the chat opens inside the site", /embed\/dQw4w9WgXcQ/.test(await page.locator("#vidPane iframe").getAttribute("src").catch(() => "")));
  await page.click('#vidPane [data-vp="close"]'); await sleep(300);
  await ask(page, "تقدر تعمل ايه؟");
  ok("«تقدر تعمل إيه؟» lists the skills", /فيديوهات يوتيوب/.test(await page.locator("#chat .m.a").last().innerText()));
  await ask(page, "حط ده في الكراسة"); await sleep(600);
  ok("«حط ده في الكراسة» writes the last answer into الكراسة", (await nb(page)).some(x => /فيديوهات يوتيوب/.test(x.html || "")));
  await page.click("#aiClose"); await sleep(300);
  ok("closing the floating tutor puts it back", await page.locator("#aiFloat").isHidden());

  // ===== ألوان + لون الورقة + PDF =====
  await page.click('.sidehead [data-sm="kur"]'); await sleep(300);
  ok("black and white pens", await page.locator('#kur [data-color="#111111"]').isVisible() && await page.locator('#kur [data-color="#ffffff"]').isVisible());
  await page.click("#kPaperBtn"); await page.click('[data-paper="#111111"]'); await sleep(800);
  ok("paper color applies to the page", await page.evaluate(() => [...document.querySelectorAll(".kpaper")].some(p => p.style.getPropertyValue("--kpaper") === "#111111")));
  await page.click("#kPaperBtn"); await page.click('[data-paper="auto"]'); await sleep(500);
  const pagesOf = async buf => page.evaluate(async b64 => { if (!window.PDFLib) await loadScript("lib/pdf-lib.min.js"); return (await PDFLib.PDFDocument.load(Uint8Array.from(atob(b64), c => c.charCodeAt(0)))).getPageCount(); }, buf.toString("base64"));
  let [dl] = await Promise.all([page.waitForEvent("download", { timeout: 30000 }).catch(() => null), page.click("#kSave").then(() => page.click('[data-save="all"]'))]);
  const buf = dl ? await readFile(await dl.path()) : Buffer.from("");
  ok("⬇️ «كل الصفحات» saves one PDF with every page", buf.length && await pagesOf(buf) === (await nb(page)).length);

  // ===== بعد إعادة التحميل =====
  await page.reload(); await sleep(1800);
  ok("after reload: الكراسة, its pages, text, drawing and picture are all back", await page.locator("#kur.show .kpage").count() === 2 && /قانون نيوتن الأول/.test(await page.locator(".ked").first().innerText()) && await inkCount(page) === 1 && await page.locator(".kimg img").count() === 1);
  await ctx.close();

  // ===== الموبايل =====
  const m = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }), mp = await m.newPage(); mp.on("pageerror", e => errs.push(e.message));
  await m.route(BLOCK, r => r.fulfill({ status: 404, body: "" })); await mp.addInitScript(() => localStorage.setItem("proxy", "/"));
  await mp.goto(`http://127.0.0.1:${port}/`); await sleep(1000);
  await mp.click('#tabs [data-t="kur"]'); await sleep(700);
  ok("mobile: «الكراسة» tab, no sideways scroll", await mp.locator(".kpaper").first().isVisible() && await mp.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 0);
  if (SHOTS) await mp.screenshot({ path: SHOTS + "/k-mob.png" });
  await mp.click('#tabs [data-t="chat"]'); await sleep(300);
  ok("mobile: «المساعد» tab shows the chat", await mp.locator("#q").isVisible());
  await m.close();
  ok("no JS errors", !errs.length, errs);
} finally { await b.close(); srv.kill(); yt.close(); }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

// كتب كبيرة (٦٠٠ صفحة) + كتاب صور بـ OCR حقيقي (Tesseract محلي من node_modules) + مهام المعالجة + الموبايل/التابلت + الإتاحة.
// ⚠️ مفيش mocks هنا للـ PDF ولا الـ OCR ولا البحث: كله الكود الحقيقي. (مكتبات الـ CDN بتتخدم من node_modules عشان الاختبار مايحتاجش نت.)
import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), FX = path.join(ROOT, "tests", "fixtures"), NM = path.join(ROOT, "node_modules");
let pw; try { pw = await import(process.env.PLAYWRIGHT_PATH || "playwright"); } catch (e) { console.error("❌ FAILED: Playwright مش متسطّب — npm install && npx playwright install chromium"); process.exit(1); }
if (!existsSync(path.join(NM, "tesseract.js"))) { console.error("❌ FAILED: tesseract.js مش متسطّب (npm install)"); process.exit(1); }
const { chromium } = pw.default || pw;
let pass = 0, fail = 0; const errs = [];
const ok = (n, c, info = "") => { c ? pass++ : fail++; console.log((c ? "✅ " : "❌ ") + n + (c ? "" : "  → " + JSON.stringify(info).slice(0, 400))); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const port = 19300 + Math.floor(Math.random() * 90);
const srv = spawn(process.execPath, [path.join(ROOT, "server", "node.mjs")], { env: { ...process.env, PORT: String(port), AZURE_SPEECH_KEY: "", OPENAI_API_KEY: "", ANTHROPIC_API_KEY: "", GEMINI_API_KEY: "", PIPER_URL: "", LOG: "off" }, stdio: "pipe" });
for (let i = 0; i < 40; i++) { await sleep(150); try { if ((await fetch(`http://127.0.0.1:${port}/v1/health`)).ok) break; } catch {} }
const ty = f => f.endsWith(".wasm") ? "application/wasm" : f.endsWith(".js") ? "text/javascript" : "application/octet-stream";
const serve = (r, f) => existsSync(f) ? r.fulfill({ status: 200, headers: { "content-type": ty(f), "access-control-allow-origin": "*" }, body: readFileSync(f) }) : r.fulfill({ status: 404, body: "" });
async function ctxFor(b, opts = {}) {
  const ctx = await b.newContext(opts);
  await ctx.route(/fonts\.(googleapis|gstatic)\.com|huggingface\.co|generativelanguage|llm7|kepler|kilo|js\.puter\.com/, r => r.fulfill({ status: 404, body: "" }));
  await ctx.route(/cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net/, r => r.fulfill({ status: 404, body: "" }));   // الأول: آخر route بيتسجّل هو اللي بيتطبق الأول
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/tesseract\.js@[^/]+\/dist\/(.+)$/, r => serve(r, path.join(NM, "tesseract.js", "dist", r.request().url().split("/dist/")[1])));
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/tesseract\.js-core@[^/]+\/(.+)$/, r => serve(r, path.join(NM, "tesseract.js-core", r.request().url().split("/").pop())));
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/@tesseract\.js-data\/(\w+)\/([^/]+)\/(.+)$/, r => { const m = r.request().url().match(/@tesseract\.js-data\/(\w+)\/([^/]+)\/(.+)$/); serve(r, path.join(NM, "@tesseract.js-data", m[1], m[2], m[3])); });
  return ctx;
}
const b = await chromium.launch();
try {
  // ===== كتاب ٦٠٠ صفحة =====
  { const ctx = await ctxFor(b, { viewport: { width: 1300, height: 900 } }), page = await ctx.newPage(); page.on("pageerror", e => errs.push(e.message)); page.on("dialog", d => d.accept());
    await page.addInitScript(() => { window.__long = []; try { new PerformanceObserver(l => l.getEntries().forEach(e => __long.push(Math.round(e.duration)))).observe({ type: "longtask", buffered: true }); } catch {} });
    await page.goto(`http://127.0.0.1:${port}/`); await sleep(600);
    const t0 = Date.now(); await page.setInputFiles("#files", path.join(FX, "big600.pdf"));
    await page.waitForFunction(() => doc?.numPages === 600 && pgs[0]?._done, null, { timeout: 30000 }).catch(() => {});
    const open = Date.now() - t0;
    ok(`600-page PDF: first page visible quickly (${open} ms)`, open < 15000, open);
    const live = await page.evaluate(() => pgs.filter(p => p.firstChild.width > 0).length);
    ok(`only the pages near the screen are rendered (${live} of 600) — memory-safe`, live > 0 && live <= 16, live);
    const jid = await page.evaluate(() => LIB[0].id);
    await page.waitForFunction(id => ["completed", "failed", "waiting"].includes(JOBS.get(id)?.status), jid, { timeout: 90000 }).catch(() => {});
    const job = await page.evaluate(id => JOBS.get(id), jid);
    ok("processing job: real states and counts, finishes «completed» with 600/600 pages read", job?.status === "completed" && job.detail.pages === 600 && job.detail.textPages === 600 && job.detail.chunks > 0 && job.startedAt && job.completedAt >= job.startedAt, job);
    const stages = await page.evaluate(() => JSON.parse(JSON.stringify(window.__stages || [])));
    const longest = await page.evaluate(() => Math.max(0, ...__long));
    ok(`UI stays responsive while indexing (longest main-thread block ${longest} ms)`, longest < 1500, longest);
    await page.evaluate(() => gotoPage(500)); await page.waitForFunction(() => pgs[499]._done, null, { timeout: 10000 }).catch(() => {});
    const far = await page.evaluate(() => ({ cur: cur.page, r: !!pgs[499]._done, first: pgs[0]._done ? 1 : 0 }));
    ok("jump to page 500 renders it, and page 1 is released from memory", far.cur === 500 && far.r && far.first === 0, far);
    const hits = await page.evaluate(() => STUDY.search("zebracrossing", [LIB[0].id]));
    ok("search inside the 600-page book finds the exact page", hits.length === 1 && hits[0].page === 437, hits.map(h => h.page));
    const mem = await page.evaluate(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : 0);
    ok(`JS memory stays reasonable with a 600-page book (${mem} MB)`, mem > 0 && mem < 400, mem);
    // بعد التحديث: المهمة محفوظة والفهرس مايتعملش تاني
    await page.reload(); await sleep(2500);
    ok("after reload the finished job and index are kept (no re-processing)", await page.evaluate(id => JOBS.get(id)?.status === "completed", jid));
    await ctx.close(); }

  // ===== كتاب صور (scanned) + OCR حقيقي =====
  { const ctx = await ctxFor(b), page = await ctx.newPage(); page.on("pageerror", e => errs.push(e.message)); page.on("dialog", d => d.accept());
    await page.goto(`http://127.0.0.1:${port}/`); await sleep(600);
    await page.setInputFiles("#files", path.join(FX, "scanned.pdf"));
    const sid = await page.waitForFunction(() => LIB[0]?.id, null, { timeout: 10000 }).then(h => h.jsonValue());
    const seen = new Set(); page.on("console", () => {});
    const poll = setInterval(async () => { try { const s = await page.evaluate(id => JOBS.get(id)?.stage, sid); if (s) seen.add(s); } catch {} }, 150);
    await page.waitForFunction(id => ["completed", "failed", "waiting"].includes(JOBS.get(id)?.status), sid, { timeout: 120000 }).catch(() => {});
    clearInterval(poll);
    const job = await page.evaluate(id => JOBS.get(id), sid);
    ok("scanned PDF: job detects image pages and runs OCR automatically (small book)", job?.status === "completed" && job.detail.textPages === 3 && seen.has("ocr"), { job, seen: [...seen] });
    const txt = await page.evaluate(id => (BK[id].t || []).join(" | "), sid);
    ok("OCR really read the scanned text (Tesseract, no mock)", /photosynthesis/i.test(txt) && /mitochondria/i.test(txt) && /nucleus/i.test(txt), txt.slice(0, 200));
    const hs = await page.evaluate(id => STUDY.search("mitochondria", [id]), sid);
    ok("OCR'd pages are searchable (page 2)", hs.some(h => h.page === 2), hs);
    await ctx.close(); }

  // ===== ملف بايظ / مش PDF =====
  { const ctx = await ctxFor(b), page = await ctx.newPage(); page.on("pageerror", e => errs.push(e.message));
    await page.goto(`http://127.0.0.1:${port}/`); await sleep(500);
    await page.setInputFiles("#files", [{ name: "fake.pdf", mimeType: "application/pdf", buffer: Buffer.from("not really a pdf file at all") }]); await sleep(1200);
    ok("invalid PDF rejected with a clear message (not stored, no job)", await page.evaluate(() => LIB.length === 0 && /مش PDF سليم/.test($("ttoast")?.textContent || "") && !JOBS.all().length));
    await ctx.close(); }

  // ===== الموبايل والتابلت =====
  for (const [name, vp] of [["mobile", { width: 390, height: 844 }], ["tablet", { width: 820, height: 1180 }], ["laptop", { width: 1366, height: 768 }]]) {
    const ctx = await ctxFor(b, { viewport: vp, isMobile: name === "mobile", hasTouch: name !== "laptop" }), page = await ctx.newPage(); page.on("pageerror", e => errs.push(name + ": " + e.message)); page.on("dialog", d => d.accept());
    await page.goto(`http://127.0.0.1:${port}/`); await sleep(500); await page.setInputFiles("#files", path.join(FX, "newton.pdf")); await sleep(3000);
    const r = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth, page: pgs[0]?._done }));
    await page.evaluate(() => setTool("pen")); const bb = await page.locator("#pages .pg").first().boundingBox();
    await page.mouse.move(bb.x + 40, bb.y + 60); await page.mouse.down(); await page.mouse.move(bb.x + 140, bb.y + 90, { steps: 5 }); await page.mouse.up(); await sleep(300);
    const drew = await page.evaluate(() => (INK.ann[1] || []).length > 0);
    if (name === "mobile") await page.click('#tabs button[data-t="chat"]');
    const chatOk = await page.evaluate(() => { const q = $("q"), r = q.getBoundingClientRect(); return r.width > 150 && r.bottom <= innerHeight + 2 && getComputedStyle($("side")).display !== "none"; });
    await page.click("#hubBtn"); await sleep(600); const hubOk = await page.evaluate(() => !$("hub").hidden && $("hub").getBoundingClientRect().width <= innerWidth + 1 && document.documentElement.scrollWidth - innerWidth <= 1);
    ok(`${name} ${vp.width}×${vp.height}: no sideways scroll, PDF shows, drawing works, tutor reachable, study hub fits`, r.overflow <= 1 && r.page && drew && chatOk && hubOk, { ...r, drew, chatOk, hubOk });
    await ctx.close();
  }

  // ===== الإتاحة =====
  { const ctx = await ctxFor(b, { reducedMotion: "reduce" }), page = await ctx.newPage(); page.on("pageerror", e => errs.push(e.message));
    await page.goto(`http://127.0.0.1:${port}/`); await sleep(600);
    const unnamed = await page.evaluate(() => [...document.querySelectorAll("button, [role=button], input, select, textarea")].filter(e => e.offsetParent !== null || e.closest("#settings,#hub"))
      .filter(e => !(e.getAttribute("aria-label") || e.textContent.trim() || e.title || e.labels?.length || e.placeholder)).map(e => e.id || e.className || e.tagName));
    ok("every visible control has an accessible name (screen readers)", !unnamed.length, unnamed);
    await page.keyboard.press("Tab"); const skip = await page.evaluate(() => document.activeElement.classList.contains("skip"));
    await page.keyboard.press("Enter"); await sleep(200); const inQ = await page.evaluate(() => document.activeElement.id === "q" || location.hash === "#q");
    ok("keyboard: first Tab reaches «skip to question», Enter jumps to the question box", skip && inQ, { skip, inQ });
    await page.click("#hubBtn"); await sleep(100); const anim = await page.evaluate(() => getComputedStyle($("hub")).animationDuration);
    ok("reduced-motion users get no animations", anim === "0s", anim);
    await page.keyboard.press("Escape"); ok("Escape closes the study hub", await page.evaluate(() => $("hub").hidden));
    const rtl = await page.evaluate(() => document.documentElement.dir === "rtl" && document.documentElement.lang === "ar");
    ok("Arabic UI is proper RTL (dir + lang)", rtl);
    await ctx.close(); }
  ok("no page errors", !errs.length, errs);
} finally { await b.close(); srv.kill(); }
console.log(`\n${pass} passed, ${fail} failed  (real PDF.js, real Tesseract OCR, real search — no mocks)`);
process.exit(fail ? 1 : 0);

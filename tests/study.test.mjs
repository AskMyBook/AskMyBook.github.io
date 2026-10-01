// اختبار أدوات المذاكرة: المكتبة، الملاحظات، الامتحان (توليد/حل/تصحيح/تقرير/وقت)، نقط الضعف، الخطة، البحث،
// صور الأسئلة، تصحيح خط الإيد، الرسم (أشكال/تحريك/تكبير/تراجع/إعادة/مسح)، وتنزيل الـ PDF بالكتابة.
// ⚠️ الموديل (LLM) متقلّد: الاختبار بيتأكد إن الموقع بيبعت محتوى الكتاب الحقيقي ويتعامل مع الرد صح — مش من جودة موديل حقيقي.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), FX = path.join(ROOT, "tests", "fixtures");
let pw; try { pw = await import(process.env.PLAYWRIGHT_PATH || "playwright"); } catch (e) { console.error("❌ FAILED: Playwright مش متسطّب (" + (e?.message || e).slice(0, 120) + ") — شغّل: npm install && npx playwright install chromium"); process.exit(1); }
const { chromium } = pw.default || pw;
let pass = 0, fail = 0; const errs = [];
const ok = (n, c, info = "") => { c ? pass++ : fail++; console.log((c ? "✅ " : "❌ ") + n + (c ? "" : "  → " + JSON.stringify(info).slice(0, 400))); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const port = 19700 + Math.floor(Math.random() * 200);
const srv = spawn(process.execPath, [path.join(ROOT, "server", "node.mjs")], { env: { ...process.env, PORT: String(port), AZURE_SPEECH_KEY: "", OPENAI_API_KEY: "", ANTHROPIC_API_KEY: "", GEMINI_API_KEY: "", PIPER_URL: "" }, stdio: "pipe" });
for (let i = 0; i < 40; i++) { await sleep(150); try { if ((await fetch(`http://127.0.0.1:${port}/v1/health`)).ok) break; } catch {} }
const b = await chromium.launch();
try {
  const ctx = await b.newContext({ acceptDownloads: true, viewport: { width: 1300, height: 900 } }); const page = await ctx.newPage();
  page.on("pageerror", e => errs.push(e.message)); page.on("dialog", d => d.accept(d.type() === "prompt" ? "فيزيا نيوتن" : undefined));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com|huggingface\.co|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|generativelanguage|llm7|kepler|kilo|js\.puter\.com/, r => r.fulfill({ status: 404, body: "" }));
  await page.addInitScript(() => localStorage.setItem("provider", "claude"));   // مزوّد بيشوف الصور (الموديل نفسه متقلّد تحت)
  await page.goto(`http://127.0.0.1:${port}/`); await sleep(700);
  await page.setInputFiles("#files", [path.join(FX, "newton.pdf"), path.join(FX, "biology.pdf")]); await sleep(3500);
  // موديل متقلّد: بيرجّع امتحان/تصحيح/رد حسب الطلب، وبيسجّل اللي اتبعتله
  await page.evaluate(() => {
    window.__llm = [];
    window.llm = async o => { const u = o.messages.at(-1).content, sys = o.system || ""; __llm.push({ sys, u, imgs: (o.imgs || []).length });
      let t;
      if (/امتحانات دقيقة/.test(sys)) t = JSON.stringify({ questions: [
        { type: "mcq", q: "F = ?", options: ["m a", "m/a", "a/m", "m+a"], answer: 0, explain: "Newton's second law", src: 2 },
        { type: "tf", q: "If mass increases with the same force, acceleration increases.", options: ["True", "False"], answer: 1, explain: "It decreases", src: 2 },
        { type: "short", q: "What is inertia?", answer: "Resistance to change in motion", explain: "", src: 1 },
        { type: "fill", q: "Force is measured in ____.", answer: "newtons", explain: "", src: 2 }] });
      else if (/بيصحح إجابات/.test(sys)) { const ids = [...u.matchAll(/#(\d+)/g)].map(m => +m[1]); t = JSON.stringify({ results: ids.map((i, k) => ({ i, verdict: k === 0 ? "correct" : "wrong", feedback: k === 0 ? "تمام" : "الوحدة غلط" })) }); }
      else if (/بتجهّز أسئلة/.test(sys)) t = JSON.stringify({ questions: [{ type: "mcq", q: "Unit of force?", options: ["kg", "N", "m", "s"], answer: 1, explain: "newton", src: 1 }] });
      else t = "إجابة تجريبية من الموديل المتقلّد.";
      o.onText?.(t); return t; };
  });
  const L = () => page.evaluate(() => __llm.at(-1) || {});

  // ===== المكتبة =====
  await page.click("#hubBtn"); await sleep(1500);
  const lib = await page.evaluate(() => ({ cards: document.querySelectorAll(".bcard").length, thumbs: [...document.querySelectorAll(".bth")].filter(x => /url\(/.test(x.style.backgroundImage)).length, dates: /اتضاف/.test(document.querySelector(".bcard")?.innerText || "") }));
  ok("library: a card per book with a real first-page thumbnail and the upload date", lib.cards === 2 && lib.thumbs === 2 && lib.dates, lib);
  const nid = await page.evaluate(() => LIB.find(e => /newton/i.test(e.name)).id);
  await page.click(`.bcard[data-id="${nid}"] [data-b=rename]`); await sleep(500);
  ok("library: rename a book", await page.evaluate(id => LIB.find(e => e.id === id).name === "فيزيا نيوتن" && /فيزيا نيوتن/.test($("book").innerText), nid));
  await page.click(`.bcard[data-id="${nid}"] [data-b=open]`); await sleep(1200);
  ok("library: «كمّل» opens the book", await page.evaluate(id => cur.id === id && !!doc, nid));
  const dl = page.waitForEvent("download", { timeout: 5000 }).catch(() => null); await page.evaluate(() => READER.downloadOriginal()); const d0 = await dl;
  ok("reader: download the original PDF", !!d0 && readFileSync(await d0.path()).subarray(0, 5).toString() === "%PDF-", d0 && d0.suggestedFilename());

  // ===== أدوات القارئ =====
  const z = await page.evaluate(async () => { READER.fitPage(); const a = zoom; READER.fitWidth(); return { a, b: zoom }; });
  ok("reader: fit page shrinks to the whole page, fit width returns to full width", z.a < 1 && z.b === 1, z);
  const info = await page.evaluate(() => READER.info());
  ok("reader: document info (pages, size, name)", info?.["عدد الصفحات"] === 3 && /ميجا/.test(info?.["الحجم"] || ""), info);

  // ===== الرسم: شكل + تحديد + تحريك + تكبير + تراجع + إعادة + مسح =====
  const box = async () => (await page.locator("#pages .pg").first().boundingBox());
  await page.evaluate(() => gotoPage(1)); await sleep(500); await page.evaluate(() => setTool("rect"));
  let bb = await box(); await page.mouse.move(bb.x + 100, bb.y + 100); await page.mouse.down(); await page.mouse.move(bb.x + 200, bb.y + 160, { steps: 5 }); await page.mouse.up(); await sleep(300);
  const r1 = await page.evaluate(() => (INK.ann[1] || []).filter(x => x.t === "rect").map(x => ({ a: x.a, b: x.b })));
  ok("annotations: rectangle drawn and stored on its page", r1.length === 1, r1);
  await page.evaluate(() => setTool("move")); bb = await box();
  await page.mouse.move(bb.x + 100, bb.y + 130); await page.mouse.down(); await page.mouse.move(bb.x + 160, bb.y + 190, { steps: 5 }); await page.mouse.up(); await sleep(300);
  const r2 = await page.evaluate(() => INK.ann[1].find(x => x.t === "rect").a);
  ok("annotations: select + move a shape", r2[0] > r1[0].a[0] + 0.02, { before: r1[0].a, after: r2 });
  await page.evaluate(() => inkUndo()); const r3 = await page.evaluate(() => INK.ann[1].find(x => x.t === "rect").a);
  await page.evaluate(() => inkRedo()); const r4 = await page.evaluate(() => INK.ann[1].find(x => x.t === "rect").a);
  ok("annotations: undo puts it back, redo moves it again", Math.abs(r3[0] - r1[0].a[0]) < 1e-6 && Math.abs(r4[0] - r2[0]) < 1e-6, { r3, r4 });
  // تكبير من المربع الأزرق
  const rb = await page.evaluate(() => { const it = INK.ann[1].find(x => x.t === "rect"); INK.sel = { n: 1, it }; inkDraw(pageEl(1)); const el = pageEl(1), W = el.clientWidth, H = el.clientHeight; return { x: Math.max(it.a[0], it.b[0]) * W + 4, y: Math.max(it.a[1], it.b[1]) * H + 4, w: Math.abs(it.b[0] - it.a[0]) }; });
  bb = await box(); await page.mouse.move(bb.x + rb.x, bb.y + rb.y); await page.mouse.down(); await page.mouse.move(bb.x + rb.x + 80, bb.y + rb.y + 40, { steps: 5 }); await page.mouse.up(); await sleep(200);
  const rw = await page.evaluate(() => { const it = INK.ann[1].find(x => x.t === "rect"); return Math.abs(it.b[0] - it.a[0]); });
  ok("annotations: resize from the blue handle", rw > rb.w * 1.3, { before: rb.w, after: rw });
  await page.evaluate(() => inkDelSel()); ok("annotations: delete the selected shape", await page.evaluate(() => !(INK.ann[1] || []).some(x => x.t === "rect")));
  await page.evaluate(() => { setTool("hl"); INK.op = 0.6; }); bb = await box(); await page.mouse.move(bb.x + 60, bb.y + 60); await page.mouse.down(); await page.mouse.move(bb.x + 260, bb.y + 62, { steps: 5 }); await page.mouse.up();
  await page.evaluate(() => setTool("arrow")); await page.mouse.move(bb.x + 60, bb.y + 250); await page.mouse.down(); await page.mouse.move(bb.x + 220, bb.y + 300, { steps: 5 }); await page.mouse.up();
  await page.evaluate(() => setTool("pen")); await page.mouse.move(bb.x + 80, bb.y + 350); await page.mouse.down(); await page.mouse.move(bb.x + 180, bb.y + 380, { steps: 8 }); await page.mouse.up(); await sleep(400);
  const kinds = await page.evaluate(() => (INK.ann[1] || []).map(x => x.t + (x.o ? ":" + x.o : "")));
  ok("annotations: highlighter keeps its opacity, arrow and pen saved", kinds.includes("hl:0.6") && kinds.includes("arrow") && kinds.includes("pen"), kinds);
  await sleep(500); await page.reload(); await sleep(1500);
  ok("annotations survive a reload", (await page.evaluate(() => (INK.ann[1] || []).length)) >= 3);
  // الموديل المتقلّد تاني بعد التحديث
  await page.evaluate(() => { window.__llm = []; window.llm = async o => { const u = o.messages.at(-1).content, sys = o.system || ""; __llm.push({ sys, u, imgs: (o.imgs || []).length });
    let t = /امتحانات دقيقة/.test(sys) ? JSON.stringify({ questions: [{ type: "mcq", q: "F = ?", options: ["m a", "m/a", "a/m", "m+a"], answer: 0, explain: "Newton's second law", src: 2 }, { type: "tf", q: "More mass, same force → more acceleration.", options: ["True", "False"], answer: 1, explain: "It decreases", src: 2 }, { type: "short", q: "What is inertia?", answer: "Resistance to change in motion", src: 1 }, { type: "fill", q: "Force is measured in ____.", answer: "newtons", src: 2 }] })
      : /بيصحح إجابات/.test(sys) ? JSON.stringify({ results: [...u.matchAll(/#(\d+)/g)].map((m, k) => ({ i: +m[1], verdict: k === 0 ? "correct" : "wrong", feedback: k === 0 ? "تمام" : "الوحدة غلط" })) })
      : /بتجهّز أسئلة/.test(sys) ? JSON.stringify({ questions: [{ type: "mcq", q: "Unit of force?", options: ["kg", "N", "m", "s"], answer: 1, explain: "newton", src: 1 }] }) : "إجابة تجريبية.";
    o.onText?.(t); return t; }; });
  const dl2 = page.waitForEvent("download", { timeout: 15000 }).catch(() => null); await page.evaluate(() => READER.downloadAnnotated()); const d2 = await dl2;
  let annOk = false, annInfo = ""; if (d2) { const buf = readFileSync(await d2.path()), orig = readFileSync(path.join(FX, "newton.pdf")); annOk = buf.subarray(0, 5).toString() === "%PDF-" && buf.length > orig.length + 1000; annInfo = buf.length + " vs " + orig.length; }
  ok("reader: download the PDF WITH annotations (valid PDF, drawings embedded)", annOk, annInfo || "no download");

  // ===== صورة سؤال + تصحيح خط الإيد =====
  await page.setInputFiles("#imgUp", path.join(FX, "question.png")); await sleep(500);
  ok("chat: uploaded image shows as a preview before sending", await page.evaluate(() => !$("attach").hidden && $("attach").querySelectorAll("img").length === 1));
  await page.fill("#q", "حل السؤال ده"); await page.click("#send"); await sleep(1200);
  let c = await L();
  ok("chat: the image is sent to the AI with the question (vision provider)", c.imgs === 1 && /رفع صورة/.test(c.sys + c.u), { imgs: c.imgs });
  ok("chat: the student's message shows the image", await page.evaluate(() => !!document.querySelector("#chat .m.u .uimgs img")));
  await page.evaluate(() => { gotoPage(1); }); await sleep(600);
  await page.evaluate(() => STUDY.checkWork()); await sleep(1200); c = await L();
  ok("handwriting check: page + student's ink sent as an image with a careful-checking request", c.imgs === 1 && /خط إيدي/.test(c.u) && /مش واضح/.test(c.u), { imgs: c.imgs, u: c.u.slice(-200) });

  // ===== الملاحظات =====
  await page.click("#chat .m.a:last-child .noteBtn").catch(() => {}); await sleep(400);
  await page.evaluate(() => STUDY.open("notes")); await sleep(500);
  await page.fill("#nText", "قانون نيوتن التاني: F = m a"); await page.click("#nSave"); await sleep(500);
  let notes = await page.evaluate(() => idbGet("notes"));
  ok("notes: AI answer saved as a note + personal note linked to the page and lesson", notes.length === 2 && notes.some(n => n.ai) && notes.some(n => !n.ai && n.page >= 1 && n.book), notes.map(n => ({ ai: n.ai, page: n.page, lesson: n.lesson })));
  await page.fill("#nSearch", "نيوتن"); await sleep(600);
  ok("notes: search", await page.evaluate(() => document.querySelectorAll(".note").length) === 1);
  await page.click(".note [data-e=edit]"); await page.fill(".note textarea", "ملاحظة متعدلة عن نيوتن"); await page.click(".note [data-s='1']"); await sleep(400);
  notes = await page.evaluate(() => idbGet("notes")); ok("notes: edit", notes.some(n => n.text === "ملاحظة متعدلة عن نيوتن"));
  await page.click(".note [data-e=del]"); await sleep(400); ok("notes: delete", (await page.evaluate(() => idbGet("notes"))).length === 1);

  // ===== الامتحان =====
  await page.evaluate(() => STUDY.open("exam")); await sleep(700);
  await page.check("#eAll"); await page.fill("#eN", "4"); await page.fill("#eT", "5"); await page.check('[data-t="fill"]');
  await page.click("#eGo"); await page.waitForSelector(".exq li", { timeout: 15000 });
  c = await page.evaluate(() => __llm.find(x => /امتحانات دقيقة/.test(x.sys)));
  ok("exam: generated from the real book text of the chosen chapters", /Second Law|F = m a/.test(c?.u || "") && /4 سؤال/.test(c?.u || ""), (c?.u || "").slice(0, 200));
  ok("exam: questions + timer shown", await page.evaluate(() => document.querySelectorAll(".exq li").length === 4 && /⏱/.test($("eTimer")?.textContent || "")));
  await page.check('.exq li[data-i="0"] input[value="0"]'); await page.check('.exq li[data-i="1"] input[value="0"]');
  await page.fill('.exq li[data-i="2"] textarea', "resisting change in motion"); await page.fill('.exq li[data-i="3"] textarea', "kilograms");
  await page.click("#eSubmit"); await page.waitForSelector(".score", { timeout: 15000 });
  const rep = await page.evaluate(() => ({ s: document.querySelector(".score b").textContent, weak: document.querySelector(".weakbox")?.innerText || "", items: [...document.querySelectorAll(".exr li")].map(li => li.className), expl: /It decreases/.test(document.querySelector(".exr").innerText), links: document.querySelectorAll(".exr [data-go]").length }));
  ok("exam report: score, per-question right/wrong, explanation, chapter + page link, weak topics", rep.s === "50%" && rep.items.join() === "correct,wrong,correct,wrong" && rep.expl && rep.links === 4 && /Second Law/.test(rep.weak), rep);
  const ex = await page.evaluate(async id => ({ exams: (await idbGet("exams")).length, weak: await idbGet("weak:" + id) }), nid);
  ok("exam saved + real mistakes recorded per topic", ex.exams === 1 && Object.values(ex.weak.topics).some(t => /Second Law/.test(t.name) && t.wrong === 2), ex);
  // الوقت خلص = تسليم تلقائي
  await page.click("#eNew"); await sleep(300); await page.check("#eAll"); await page.fill("#eN", "4"); await page.fill("#eT", "1"); await page.click("#eGo"); await page.waitForSelector(".exq li", { timeout: 15000 });
  await page.evaluate(() => { STUDY._EX.end = Date.now() - 10; }); await page.waitForSelector(".score", { timeout: 8000 }).catch(() => {});
  ok("exam: time limit ends → auto-submitted and graded", await page.evaluate(() => !!document.querySelector(".score")));

  // ===== نقط الضعف =====
  await page.evaluate(() => STUDY.open("weak")); await sleep(600);
  const wk = await page.evaluate(() => document.querySelector("#hubBody").innerText);
  ok("weak areas: repeated real mistakes flagged («بتغلط كتير في …»)", /بتغلط كتير في/.test(wk) && /Second Law/.test(wk), wk.slice(0, 300));
  await page.click("#hubBody [data-pr]"); await page.waitForSelector(".exq li", { timeout: 15000 });
  c = await page.evaluate(() => __llm.filter(x => /امتحانات دقيقة/.test(x.sys)).at(-1));
  ok("weak areas: «اتدرّب عليها» starts a focused practice from that topic's pages", /Second Law/.test(c.u) && !/Photosynthesis/.test(c.u) && /5 سؤال/.test(c.u), c.u.slice(0, 300));
  await page.click("#eQuit");
  // سؤال من الشات («اختبرني») بيتسجل في نقط الضعف
  await page.evaluate(() => STUDY.close()); await page.evaluate(() => { $("book").value = cur.id; }); await page.fill("#q", "اعملي سؤال واحد اختيار من متعدد من الكتاب"); await page.click("#send"); await sleep(1500);
  const before = await page.evaluate(async id => Object.values((await idbGet("weak:" + id)).topics).reduce((a, t) => a + t.right + t.wrong, 0), nid);
  await page.click("#chat .qopt[data-k='1']").catch(() => {}); await sleep(600);
  const after = await page.evaluate(async id => Object.values((await idbGet("weak:" + id)).topics).reduce((a, t) => a + t.right + t.wrong, 0), nid);
  ok("chat quiz answers are recorded too (real interactions only)", after === before + 1, { before, after });

  // ===== خطة المذاكرة =====
  await page.evaluate(() => STUDY.open("plan")); await sleep(500); await page.fill("#pDays", "5"); await page.click("#pGo"); await sleep(800);
  const plan = await page.evaluate(async id => idbGet("plan:" + id), nid);
  const tasks = plan.days.flatMap(d => d.tasks);
  ok("study plan: built from the book's real chapters over the chosen days, with weak-topic review and a mock exam", plan.days.length === 5 && tasks.some(t => t.type === "study" && /Newton/.test(t.t)) && tasks.some(t => t.type === "weak") && tasks.some(t => t.type === "exam"), tasks.map(t => t.type + ":" + t.t.slice(0, 30)));
  await page.check("#hubBody [data-tk]"); await sleep(500);
  ok("study plan: ticking a task is saved and progress updates", await page.evaluate(async id => (await idbGet("plan:" + id)).days.flatMap(d => d.tasks).filter(t => t.done).length === 1 && /خلّصت 1/.test($("hubBody").innerText), nid));

  // ===== البحث =====
  await page.evaluate(() => STUDY.open("search")); await sleep(400); await page.fill("#sQ", "acceleration"); await page.click("#sForm button[type=submit]"); await sleep(1200);
  const sr = await page.evaluate(() => [...document.querySelectorAll(".sres a")].map(a => a.dataset.go));
  ok("search: finds the pages inside the open book", sr.length >= 1 && sr.some(g => /\|2$/.test(g)), sr);
  await page.selectOption("#sScope", "all"); await page.fill("#sQ", "photosynthesis"); await page.click("#sForm button[type=submit]"); await sleep(1500);
  const sr2 = await page.evaluate(() => [...document.querySelectorAll(".sres a")].map(a => a.dataset.go.split("|")[0]));
  ok("search: across all my books", new Set(sr2).size === 2, sr2);
  await page.click(".sres a"); await sleep(1200); ok("search: clicking a result opens that page", await page.evaluate(() => $("hub").hidden && !!doc));

  // ===== «ذاكر مع الـ AI» =====
  await page.evaluate(id => STUDY.studyWith(id), nid); await sleep(1500);
  ok("«study with AI»: teacher greets and offers the book's chapters", await page.evaluate(() => { const n = [...document.querySelectorAll("#chat .m.a")].at(-1); return /جاهز أذاكر معاك/.test(n.innerText) && n.querySelectorAll(".chip").length >= 3; }));
  ok("no page errors", !errs.length, errs);
} finally { await b.close(); srv.kill(); }
console.log(`\n${pass} passed, ${fail} failed  (LLM mocked)`);
process.exit(fail ? 1 : 0);

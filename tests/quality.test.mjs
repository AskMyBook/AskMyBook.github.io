// جودة الإجابات: التحقق من المصادر، البيانات المنظمة (schema + إعادة محاولة + خطأ مفهوم)، بوابة الذكاء، وسياق «اشرحها تاني».
// ⚠️ الموديل متقلّد: الاختبار بيتأكد إن الموقع مايعرضش مصدر مش حقيقي، ومايقعش لو الرد باظ — مش من ذكاء موديل حقيقي.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), FX = path.join(ROOT, "tests", "fixtures");
let pw; try { pw = await import(process.env.PLAYWRIGHT_PATH || "playwright"); } catch (e) { console.error("❌ FAILED: Playwright مش متسطّب — npm install && npx playwright install chromium"); process.exit(1); }
const { chromium } = pw.default || pw;
let pass = 0, fail = 0; const errs = [];
const ok = (n, c, info = "") => { c ? pass++ : fail++; console.log((c ? "✅ " : "❌ ") + n + (c ? "" : "  → " + JSON.stringify(info).slice(0, 400))); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const port = 19500 + Math.floor(Math.random() * 90);
const srv = spawn(process.execPath, [path.join(ROOT, "server", "node.mjs")], { env: { ...process.env, PORT: String(port), AZURE_SPEECH_KEY: "", OPENAI_API_KEY: "", ANTHROPIC_API_KEY: "", GEMINI_API_KEY: "", PIPER_URL: "", LOG: "off" }, stdio: "pipe" });
for (let i = 0; i < 40; i++) { await sleep(150); try { if ((await fetch(`http://127.0.0.1:${port}/v1/health`)).ok) break; } catch {} }
const b = await chromium.launch();
try {
  const ctx = await b.newContext(); const page = await ctx.newPage(); page.on("pageerror", e => errs.push(e.message)); page.on("dialog", d => d.accept());
  await ctx.route(/fonts\.(googleapis|gstatic)\.com|huggingface\.co|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|generativelanguage|llm7|kepler|kilo|js\.puter\.com/, r => r.fulfill({ status: 404, body: "" }));
  await page.goto(`http://127.0.0.1:${port}/`); await sleep(700);
  await page.setInputFiles("#files", [path.join(FX, "newton.pdf")]); await sleep(3500);
  const nid = await page.evaluate(() => LIB[0].id);
  // ===== ١) التحقق من المصادر (unit) =====
  const v = await page.evaluate(id => {
    const B = [{ id, page: 2, sec: "Lesson 2: Newton's Second Law", text: "The acceleration of an object is directly proportional to the net force acting on it and inversely proportional to its mass: F = m a." },
      { id, page: 3, sec: "Lesson 3", text: "Green plants make glucose from carbon dioxide and water using light energy." }, { id, page: 999, sec: "?", text: "F = m a acceleration force mass" }, { id: "not-a-book", page: 1, sec: "", text: "F = m a acceleration force mass" }];
    const r = s => { const x = TUTOR.verifyCites(s, B); return { t: x.text, ok: [...x.ok], bad: [...x.bad] }; };
    return {
      good: r("العجلة (acceleration) بتتناسب مع القوة (force) وعكسيًا مع الكتلة (mass): F = m a [1]."),
      wrongBlock: r("القوة بتساوي الكتلة في العجلة F = m a acceleration [2]."),
      missing: r("كلام [7]."), badPage: r("F = m a acceleration force mass [3]."), badBook: r("F = m a acceleration force mass [4]."),
      mixed: r("F = m a والعجلة acceleration بتقل مع الكتلة mass [1,2].")
    };
  }, nid);
  ok("citation verified when the sentence really comes from that chunk", v.good.ok.includes(1) && !v.good.bad.length && /\[1\]/.test(v.good.t), v.good);
  ok("citation pointing at an unrelated chunk is NOT shown as a verified source", v.wrongBlock.bad.includes(2) && /\[\?2\]/.test(v.wrongBlock.t), v.wrongBlock);
  ok("citation to a chunk that wasn't retrieved is dropped", !/\[7\]/.test(v.missing.t) && !v.missing.ok.length, v.missing);
  ok("citation to a page that doesn't exist in the book is rejected", v.badPage.bad.includes(3), v.badPage);
  ok("citation to a book that isn't in the library is rejected", v.badBook.bad.includes(4), v.badBook);
  ok("multi-citation: keeps the right one, flags the wrong one", v.mixed.ok.includes(1) && v.mixed.bad.includes(2), v.mixed);
  // ===== ٢) في الشات: المصدر المؤكد رابط، والمش مؤكد متعلّم، ووسم «من كتابك / من برّه» =====
  const setLLM = replies => page.evaluate(R => { let i = 0; window.__calls = []; window.llm = async o => { window.__calls.push(o); const t = typeof R[i] === "string" ? R[i] : R[R.length - 1]; i++; o.onText?.(t); return t; }; }, replies);
  await page.evaluate(() => { $("book").value = cur.id; });
  await setLLM(["قانون نيوتن التاني: العجلة (acceleration) بتتناسب مع القوة (force) وعكسيًا مع الكتلة (mass) [1]. وكمان النبات بيعمل جلوكوز [2]."]);
  await page.fill("#q", "اشرحلي قانون نيوتن التاني Newton second law force mass acceleration"); await page.click("#send"); await sleep(1800);
  const chat = await page.evaluate(() => { const n = [...document.querySelectorAll("#chat .m.a")].at(-1); return { links: n.querySelectorAll("a.cite").length, unv: n.querySelectorAll(".cite.unv").length, origin: n.querySelector(".origin")?.innerText || "", ctx: window.__calls.at(-1)?.messages.at(-1).content || "" }; });
  const secondLawBlock = /\[1\][^\n]*ص 2/.test(chat.ctx), photoBlock = /\[2\][^\n]*ص 3/.test(chat.ctx);
  ok("chat: verified citation rendered as a page link; unverified one marked «مصدر غير مؤكد»", chat.links >= 1 && (!photoBlock || chat.unv === 1), { chat: { ...chat, ctx: chat.ctx.slice(0, 200) }, secondLawBlock, photoBlock });
  ok("chat: answer labelled «من كتابك» with the count of verified sources", /من كتابك/.test(chat.origin), chat.origin);
  await setLLM(["ده مش في الكتاب المحدد، بس هشرحهولك:\n### 🌐 من خارج الكتاب\nالنسبية الخاصة لأينشتاين بتقول إن سرعة الضوء ثابتة."]);
  await page.fill("#q", "اشرحلي النسبية الخاصة لأينشتاين"); await page.click("#send"); await sleep(1500);
  const out = await page.evaluate(() => { const n = [...document.querySelectorAll("#chat .m.a")].at(-1); return { origin: n.querySelector(".origin")?.innerText || "", cites: n.querySelectorAll("a.cite").length }; });
  ok("outside-curriculum answer is labelled as outside the book and has no book citations", /خارج المنهج/.test(out.origin) && out.cites === 0 && !/من كتابك/.test(out.origin), out);
  // ===== ٣) بيانات منظمة: رد بايظ → إعادة محاولة → نجاح؛ بايظ دايمًا → رسالة مفهومة من غير crash =====
  const good = JSON.stringify({ questions: [{ question: "F = ?", type: "multiple_choice", options: ["m a", "m/a", "a/m", "m+a"], correctAnswer: "m a", explanation: "Newton", source: 1 }, { question: "Unit of force?", type: "short_answer", correctAnswer: "newton", source: 1 }] });
  await setLLM(["مش JSON خالص {{{", good]);
  await page.fill("#q", "اعملي أسئلة من الكتاب"); await page.click("#send"); await sleep(2000);
  const q1 = await page.evaluate(() => ({ calls: window.__calls.length, quiz: document.querySelectorAll("#chat .m.a:last-child .qz").length, retryMsg: /مش صالح/.test(window.__calls[1]?.messages?.at(-1)?.content || "") }));
  ok("structured output: malformed JSON → one safe retry with the validation errors → questions shown", q1.calls === 2 && q1.quiz === 2 && q1.retryMsg, q1);
  await setLLM(['{"questions":[{"question":"x","type":"multiple_choice","options":["a","a"],"correctAnswer":"z"}]}']);
  await page.fill("#q", "اعملي أسئلة اختيار من الكتاب"); await page.click("#send"); await sleep(2000);
  const q2 = await page.evaluate(() => { const n = [...document.querySelectorAll("#chat .m.a")].at(-1); return { txt: n.innerText, retry: !!n.querySelector(".chip") }; });
  ok("structured output: invalid every time → clear error + retry button, no crash, nothing fake shown", /بيانات مش صالحة/.test(q2.txt) && q2.retry, q2);
  // ===== ٤) الـ schema نفسه (unit) =====
  const sv = await page.evaluate(id => {
    const B = [{ id, page: 2, sec: "L2", text: "..." }];
    const r = AI.validateQuestions({ questions: [
      { question: "F=?", type: "mcq", options: ["m a", "m/a"], correctAnswer: "m a", source: 1 },
      { question: "Pick", type: "multiple_choice", options: ["a", "b", "c", "d"], correctAnswer: "c", source: 1 },
      { question: "Bad answer", type: "multiple_choice", options: ["a", "b", "c"], correctAnswer: "z" },
      { question: "Dup", type: "multiple_choice", options: ["a", "a", "b"], correctAnswer: 0 },
      { question: "Force is measured in ____.", type: "fill_blank", correctAnswer: "newtons", source: 9 },
      { q: "legacy key", answer: 1, options: ["x", "y", "z"], src: 1 },
      { question: "", type: "short_answer", correctAnswer: "x" } ] }, { blocks: B });
    return { n: r.value.length, types: r.value.map(x => x.type + ":" + x.answer), errs: r.errors, srcOf5: r.value.find(x => /____/.test(x.q))?.s };
  }, nid);
  ok("schema: valid questions kept + normalized (text answer → option index, 2 options → true/false, legacy keys)", sv.n === 4 && sv.types.includes("tf:0") && sv.types.includes("mcq:2") && sv.types.includes("mcq:1") && sv.types.includes("fill:newtons"), sv);
  ok("schema: answer not among options / duplicate options / empty question rejected with reasons", sv.errs.some(e => /الإجابة الصح/.test(e)) && sv.errs.some(e => /مكررة/.test(e)) && sv.errs.some(e => /من غير نص/.test(e)), sv.errs);
  ok("schema: a source number that isn't one of the sent chunks is never turned into a fake page link", sv.srcOf5 === null && sv.errs.some(e => /المصدر 9/.test(e)), sv);
  // ===== ٥) بوابة الذكاء الموحّدة =====
  const gw = await page.evaluate(async () => {
    const hasAll = ["generate", "stream", "analyzeImage", "structured", "embed"].every(k => typeof AI[k] === "function") && typeof AI.speech.transcribe === "function" && typeof AI.voice.synthesize === "function" && ["extractText", "ocr", "analyzeStructure"].every(k => typeof AI.document[k] === "function");
    let rejected = false; try { AI.vectors.register("broken", { index() {} }); } catch { rejected = true; }
    AI.vectors.register("memory", { index: async () => 1, search: async q => [{ text: "hit:" + q }], delete: async () => 1, update: async () => 1 }); AI.vectors.use("memory");
    const r = await AI.vectors.search("x"); AI.vectors.use("local");
    let noEmbed = ""; try { await AI.embed(["x"]); } catch (e) { noEmbed = e.code; }
    return { hasAll, rejected, swapped: r[0]?.text === "hit:x", stores: AI.vectors.list(), lang: [AI.speech.detectLanguage("اشرحلي الدرس"), AI.speech.detectLanguage("explain this lesson"), AI.speech.detectLanguage("اشرحلي الغشاء الخلوي cell membrane")], noEmbed, text: await AI.document.extractText(cur.id, 2) };
  });
  ok("AI gateway: one interface for text / stream / image / structured / embeddings / speech / voice / documents", gw.hasAll, gw);
  ok("VectorStore is swappable (local default, custom store plugs in; incomplete store rejected)", gw.rejected && gw.swapped && gw.stores.includes("local") && gw.stores.includes("memory"), gw);
  ok("language detection: Arabic / English / mixed", gw.lang.join() === "ar,en,mixed", gw.lang);
  ok("embeddings not configured → clear error code (not a fake vector)", gw.noEmbed === "no_embed", gw.noEmbed);
  ok("document provider extracts real page text", /Second Law/.test(gw.text), gw.text.slice(0, 80));
  // ===== ٦) السياق: «اشرحها تاني» أول رسالة = الصفحة المفتوحة =====
  await page.reload(); await sleep(1500); await page.click("#tabs button[data-t=chat]").catch(() => {}); await page.evaluate(() => $("newChat")?.click()); await sleep(300); await setLLM(["تمام."]);
  await page.evaluate(() => gotoPage(2)); await sleep(500); await page.fill("#q", "اشرحها تاني"); await page.click("#send"); await sleep(1500);
  const c6 = await page.evaluate(() => window.__calls.at(-1)?.messages.at(-1).content || "");
  ok("«اشرحها تاني» with no history uses the open page instead of asking the student to repeat", /Second Law/.test(c6) && /ص 2/.test(c6), c6.slice(0, 300));
  ok("no page errors", !errs.length, errs);
} finally { await b.close(); srv.kill(); }
console.log(`\n${pass} passed, ${fail} failed  (LLM mocked)`);
process.exit(fail ? 1 : 0);

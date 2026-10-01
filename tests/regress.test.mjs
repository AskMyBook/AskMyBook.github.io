// فحص شامل (الموقع كله من البداية للنهاية) + اختبارات للأخطاء اللي اتصلّحت في المراجعة الأخيرة.
// - بيدوس على كل زرار ظاهر في الموقع (كمبيوتر + موبايل) وبيسجّل أي خطأ JavaScript أو Unhandled Rejection أو طلب فشل من الموقع نفسه.
// - الكتب الوهمية («chat1»/«notes») — الذكاء المحلي (localai.js) — مهلة طلبات الذكاء — حد حجم الـ PDF الموحّد.
// ⚠️ خدمات الذكاء الخارجية مقفولة هنا (مفيش نت في الاختبار)، فبنختبر إن الموقع بيتعامل مع فشلها صح — مش جودة إجاباتها.
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), FX = path.join(ROOT, "tests", "fixtures");
let pw; try { pw = await import(process.env.PLAYWRIGHT_PATH || "playwright"); } catch { console.error("❌ FAILED: Playwright مش متسطّب — npm install && npx playwright install chromium"); process.exit(1); }
const { chromium } = pw.default || pw;
let pass = 0, fail = 0;
const ok = (n, c, info = "") => { c ? pass++ : fail++; console.log((c ? "✅ " : "❌ ") + n + (c ? "" : "  → " + JSON.stringify(info).slice(0, 600))); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const port = 19700 + Math.floor(Math.random() * 90);
const srv = spawn(process.execPath, [path.join(ROOT, "server", "node.mjs")], { env: { ...process.env, PORT: String(port), AZURE_SPEECH_KEY: "", OPENAI_API_KEY: "", ANTHROPIC_API_KEY: "", GEMINI_API_KEY: "", PIPER_URL: "", LOG: "off" }, stdio: "pipe" });
for (let i = 0; i < 40; i++) { await sleep(150); try { if ((await fetch(`http://127.0.0.1:${port}/v1/health`)).ok) break; } catch {} }
const FREE_N = 10;   // عدد الخدمات المجانية في FREE_EPS (app.js)
const EXT = /fonts\.(googleapis|gstatic)\.com|huggingface\.co|generativelanguage|llm7|kepler|kilo|js\.puter\.com|cdnjs|jsdelivr|unpkg|anthropic\.com/;
const b = await chromium.launch();
async function open(opts = {}, init) {
  const ctx = await b.newContext(opts);
  await ctx.route(EXT, r => r.fulfill({ status: 404, body: "" }));
  const page = await ctx.newPage(), E = [], st = { step: "load" };
  await page.addInitScript(() => addEventListener("unhandledrejection", e => console.error("UNHANDLED_REJECTION " + (e.reason?.stack || e.reason))));
  if (init) await page.addInitScript(init);
  page.on("pageerror", e => E.push(`[${st.step}] ${e.message}`));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) E.push(`[${st.step}] console: ${m.text().slice(0, 200)}`); });
  page.on("response", r => { if (r.status() >= 400 && !EXT.test(r.url())) E.push(`[${st.step}] HTTP ${r.status()} ${r.url()}`); });
  page.on("dialog", d => d.accept());
  page.on("filechooser", fc => fc.setFiles([]).catch(() => {}));
  await page.goto(`http://127.0.0.1:${port}/`); await sleep(1200);
  return { ctx, page, E, st };
}
async function crawl(page, st, label) {
  const n = await page.evaluate(() => { const v = [...document.querySelectorAll("button, summary, input[type=checkbox], input[type=radio]")].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.height && !e.disabled && !e.closest("[hidden]"); }); v.forEach((e, i) => e.dataset.aud = i); return v.length; });
  let clicked = 0;
  for (let i = 0; i < n; i++) {
    const id = await page.evaluate(i => { const e = document.querySelector(`[data-aud="${i}"]`); if (!e || e.closest("[hidden]") || !e.getBoundingClientRect().width) return null; return e.id || (e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 24) || "?"; }, i);
    if (!id || /^(acDel|acWipe|uiLang)$/.test(id)) continue;   // المسح النهائي وتغيير اللغة (بيعمل reload) ليهم اختبارات لوحدهم
    st.step = `${label} «${id}»`;
    try { await page.click(`[data-aud="${i}"]`, { timeout: 1500 }); clicked++; } catch {}
    await sleep(300); await page.keyboard.press("Escape").catch(() => {});
  }
  return clicked;
}
try {
  // ===== ١) الموقع كله: كل زرار وكل إعداد، كمبيوتر وموبايل =====
  for (const [name, opts] of [["desktop 1366×800", { viewport: { width: 1366, height: 800 } }], ["mobile 390×844", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]]) {
    const { ctx, page, E, st } = await open(opts);
    st.step = "upload"; await page.setInputFiles("#files", [path.join(FX, "newton.pdf"), path.join(FX, "biology.pdf")]); await sleep(3500);
    let clicked = await crawl(page, st, "main");
    for (const t of await page.evaluate(() => [...document.querySelectorAll("#tabs button")].filter(b => b.offsetWidth).map(b => b.dataset.t))) { await page.evaluate(t => showTab(t), t); clicked += await crawl(page, st, "tab " + t); }
    await page.evaluate(() => { $("settings").hidden = false; });
    for (const s of await page.evaluate(() => [...document.querySelectorAll("#settings select")].map(s => ({ id: s.id, v: [...s.options].map(o => o.value) }))))
      for (const v of s.v) { st.step = `select #${s.id}=${v}`; await page.evaluate(([id, v]) => { const el = $(id); el.value = v; el.dispatchEvent(new Event("change", { bubbles: true })); }, [s.id, v]); await sleep(200); }
    await page.evaluate(() => { $("prov").value = "free"; $("prov").dispatchEvent(new Event("change")); });
    clicked += await crawl(page, st, "settings");
    st.step = "study hub"; await page.evaluate(() => STUDY.open()); await sleep(600); clicked += await crawl(page, st, "hub");
    st.step = "delete book"; const before = await page.evaluate(() => LIB.length); await page.evaluate(() => delBook(LIB.find(e => e.name === "biology").id)); await sleep(1200);
    st.step = "reload"; await page.reload(); await sleep(2500);
    const s = await page.evaluate(() => ({ lib: LIB.map(e => e.name), overflow: document.documentElement.scrollWidth - innerWidth, open: !!doc }));
    ok(`${name}: clicked ${clicked} controls + every settings option — no JS errors, no unhandled rejections, no failed site requests`, clicked > 15 && !E.length, E.slice(0, 8));
    ok(`${name}: delete + reload keeps the library consistent (the other book still opens) and no sideways scroll`, before === 2 && s.lib.length === 1 && s.lib[0] === "newton" && s.open && s.overflow <= 1, s);
    await ctx.close();
  }

  // ===== ٢) كتب وهمية: مستخدم جديد استخدم الشات/الملاحظات من غير كتب =====
  { const { ctx, page, E } = await open();
    await page.evaluate(async () => { await idbSet("notes", [{ id: "n1", text: "x" }]); await idbSet("chat1", [{ role: "user", content: "hi" }]); await idbSet("jobs", {}); });
    await page.reload(); await sleep(2000);
    ok("new user with chat/notes but no books: no phantom «chat1»/«notes» books after reload", await page.evaluate(() => LIB.length) === 0, await page.evaluate(() => LIB));
    ok("…and the empty-library screen shows without errors", !E.length, E); await ctx.close(); }

  // ===== ٢ب) إعدادات الناس: الحاجات التقنية/بتاعة صاحب الموقع مخفية، وصاحب الموقع يقدر يظهّرها =====
  { const { ctx, page, E } = await open({ viewport: { width: 1366, height: 800 } });
    await page.evaluate(() => { $("settings").hidden = false; syncSettings(); }); await sleep(400);
    const pub = await page.evaluate(() => { const vis = id => { const e = $(id); return !!e && e.offsetParent !== null; };
      return { provs: [...$("prov").options].map(o => o.value), embmode: vis("embmode"), tone: vis("tone"), tlang: vis("tlang"), tpitch: vis("tpitch"), vnow: vis("vnow"), keyRow: vis("keyRow"), acct: vis("acct"), tprov: vis("tprov"), tvoice: vis("tvoice"), vrate: vis("vrate"), srclock: vis("srclock"), txt: $("settings").innerText };
    });
    ok("public settings: no API-key providers / local AI in the provider list", !pub.provs.some(v => ["gemini", "claude", "local"].includes(v)) && pub.provs.includes("free") && pub.provs.includes("puter"), pub.provs);
    ok("public settings: embeddings mode, voice internals (one-voice, language, pitch, status lines) and API-key field are hidden", !pub.embmode && !pub.tone && !pub.tlang && !pub.tpitch && !pub.vnow && !pub.keyRow, pub);
    ok("public settings: owner-only text («لصاحب الموقع», README, SUPABASE, server) is not shown to students", !/لصاحب الموقع|README|SUPABASE|service_role|سيرفر الموقع \(لو صاحب/.test(pub.txt) && !pub.acct, pub.txt.slice(0, 300));
    ok("public settings: what students need is still there (AI source, voice engine, voice, speed)", pub.srclock && pub.tprov && pub.tvoice && pub.vrate, pub);
    ok("public settings: no JS errors", !E.length, E); await ctx.close(); }
  { const { ctx, page, E } = await open({ viewport: { width: 1366, height: 800 } }, () => localStorage.setItem("dev", "1"));
    await page.evaluate(() => { $("settings").hidden = false; syncSettings(); }); await sleep(400);
    const dev = await page.evaluate(() => { const vis = id => { const e = $(id); return !!e && e.offsetParent !== null; }; return { provs: [...$("prov").options].map(o => o.value), embmode: vis("embmode"), tone: vis("tone"), vnow: vis("vnow"), acct: vis("acct") }; });
    ok("owner view (?dev=1 / devSettings): every advanced setting is back", ["gemini", "claude", "local"].every(v => dev.provs.includes(v)) && dev.embmode && dev.tone && dev.vnow && dev.acct, dev);
    ok("owner view: no JS errors", !E.length, E); await ctx.close(); }
  { const { ctx, page } = await open({}); await page.goto(`http://127.0.0.1:${port}/?dev=1`); await sleep(1000);
    const a = await page.evaluate(() => ({ dev: DEV, ls: localStorage.getItem("dev") })); await page.goto(`http://127.0.0.1:${port}/?dev=0`); await sleep(800);
    const b = await page.evaluate(() => ({ dev: DEV, ls: localStorage.getItem("dev") }));
    ok("?dev=1 turns the owner view on (remembered), ?dev=0 turns it off", a.dev && a.ls === "1" && !b.dev && b.ls === "0", { a, b }); await ctx.close(); }

  // ===== ٣) الذكاء المحلي (localai.js) =====
  { const { ctx, page, E } = await open({}, () => localStorage.setItem("dev", "1"));   // عرض المطوّر
    const has = await page.evaluate(() => [...$("prov").options].some(o => o.value === "local") && !window.LOCAL_AI && !document.querySelector('script[src^="localai.js"]'));
    ok("Local AI is a selectable provider, and localai.js is NOT loaded until someone picks it", has);
    await page.evaluate(() => { $("settings").hidden = false; $("prov").value = "local"; $("prov").dispatchEvent(new Event("change")); }); await sleep(1200);
    const li = await page.evaluate(() => ({ loaded: !!window.LOCAL_AI, row: !$("lRow").hidden, sizes: [...$("lmodel").options].map(o => o.value), stat: $("lstat").textContent }));
    ok("choosing «محلي» loads localai.js and fills the model sizes", li.loaded && li.row && li.sizes.join() === "tiny,light,mid", li);
    await page.evaluate(() => { $("settings").hidden = true; });
    await page.fill("#q", "اشرحلي يعني ايه قوة"); await page.click("#send"); await sleep(3000);
    const last = await page.evaluate(() => [...document.querySelectorAll("#chat .m")].at(-1)?.innerText || "");
    ok("Local AI on a machine without WebGPU → clear message in the chat (no crash, no endless «thinking»)", /WebGPU|كارت شاشة/.test(last) && !(await page.evaluate(() => document.body.classList.contains("gen"))), last.slice(0, 200));
    ok("Local AI flow: no JS errors", !E.length, E); await ctx.close(); }

  // ===== ٤) مهلة طلبات الذكاء: خدمة بتعلّق مابتسيبش الموقع «بيفكر» للأبد =====
  { const { ctx, page, E } = await open({}, () => { window.TUTOR_CONFIG = { aiTimeoutMs: 2000 }; localStorage.setItem("aimig2", "1"); localStorage.setItem("aimig3", "1"); localStorage.setItem("aimig4", "1"); localStorage.setItem("provider", "claude"); localStorage.setItem("key", "sk-ant-test"); });
    await ctx.route(/api\.anthropic\.com/, () => {});   // مابيردش خالص
    const t0 = Date.now(); await page.fill("#q", "hello"); await page.click("#send");
    await page.waitForFunction(() => !document.body.classList.contains("gen") && /اتأخرت/.test(document.querySelector("#chat")?.innerText || ""), null, { timeout: 15000 }).catch(() => {});
    const txt = await page.evaluate(() => document.querySelector("#chat").innerText), dt = Date.now() - t0;
    ok(`a hanging AI provider times out with a clear message (${dt} ms)`, /اتأخرت/.test(txt) && dt < 15000, txt.slice(-200));
    ok("timeout flow: no JS errors / unhandled rejections", !E.length, E); await ctx.close(); }

  // ===== ٤أ) صوت المتصفح هو الافتراضي: العربي بصوت عربي، والإنجليزي بصوت إنجليزي — ومفيش عربي بصوت إنجليزي أبدًا =====
  const fakeVoices = voices => `(${(voices => {
    const V = voices.map(([name, lang]) => ({ name, lang, voiceURI: name, localService: true, default: false }));
    window.__spoken = [];
    window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; this.lang = ""; this.voice = null; } };
    Object.defineProperty(window, "speechSynthesis", { value: { getVoices: () => V, speak: u => { __spoken.push({ t: u.text, v: u.voice?.name || "", l: u.lang }); setTimeout(() => u.onend?.(), 20); }, cancel() {}, pause() {}, resume() {}, speaking: false, pending: false, addEventListener() {} }, configurable: true });
  }).toString()})(${JSON.stringify(voices)})`;
  const MIXED = "القوة بتساوي الكتلة في العجلة. Newton's second law says force equals mass times acceleration. يعني كل ما الكتلة تزيد العجلة تقل.";
  for (const [label, voices] of [["Edge/Android (has an Arabic voice)", [["Microsoft Shakir Online (Natural) - Arabic (Egypt)", "ar-EG"], ["Google US English", "en-US"]]], ["Chrome on Windows without Arabic", [["Google US English", "en-US"], ["Microsoft David - English (United States)", "en-US"]]]]) {
    const { ctx, page, E } = await open({}, fakeVoices(voices));
    const eng = await page.evaluate(() => TTS.current()?.id);
    await page.evaluate(t => { const d = add("a", t); window._b = d._spk; voiceSpeak(t, { btn: _b }); }, MIXED);
    await page.waitForFunction(() => _b.dataset.st === "idle" && __spoken.length, null, { timeout: 20000 }).catch(() => {});
    await sleep(800);
    const sp = await page.evaluate(() => __spoken), toastT = await page.evaluate(() => $("ttoast")?.textContent || "");
    const arWrong = sp.filter(x => /[\u0600-\u06FF]/.test(x.t) && !/Arabic/i.test(x.v));   // عربي من غير صوت عربي محدد = المتصفح بيقراه بصوته الإنجليزي
    if (voices.some(v => /^ar/.test(v[1]))) {
      ok(`${label}: new student → the browser voice is the default engine`, eng === "browser", eng);
      ok(`${label}: Arabic sentences read by the Arabic voice, English by the English voice, nothing skipped`, !arWrong.length && sp.some(x => /Shakir/.test(x.v) && /الكتلة/.test(x.t)) && sp.some(x => /US English/.test(x.v) && /Newton/.test(x.t)) && sp.map(x => x.t).join(" ").includes("العجلة تقل"), sp);
    } else ok(`${label}: Arabic is NEVER read by an English voice (the player moves on to «كريم» and says why)`, !arWrong.length && /مفيش صوت عربي/.test(toastT), { sp, toastT });
    ok(`${label}: no JS errors`, !E.length, E); await ctx.close();
  }

  // ===== ٤أ2) الترتيب التلقائي: سيرفر الموقع ← Puter/ElevenLabs (لو الطالب مسجّل) ← صوت المتصفح ← كريم =====
  { const { ctx, page, E } = await open({}, fakeVoices([["Microsoft Shakir Online (Natural) - Arabic (Egypt)", "ar-EG"], ["Google US English", "en-US"]]));
    const signedOut = await page.evaluate(() => TTS.providers().length && (() => { const c = []; for (const p of TTS.providers()) { try { if (p.available()) c.push(p.id); } catch {} } return c; })());
    await page.evaluate(() => { const pt = TTS.get("puter"); pt.available = () => true; });   // كأن الطالب سجّل دخول Puter
    const order = await page.evaluate(() => ({ chain: TTS.current()?.id, all: (() => { const c = []; let p = TTS.current(); while (p) { c.push(p.id); p = TTS.after(p.id); } return c; })() }));
    ok("auto engine order: signed-in student → Puter (ElevenLabs) first, then the browser voice, then «كريم» last", order.chain === "puter" && order.all.join() === "puter,browser,local", order);
    ok("auto engine order: signed-out student with a browser voice → the browser voice first", signedOut.includes("browser") && !signedOut.includes("puter"), signedOut);
    ok("auto-order flow: no JS errors", !E.length, E); await ctx.close(); }
  // ===== ٤ب) تجهيز الكلام العربي لـ«كريم»: الأرقام كلمات، والإنجليزي بالحروف العربي (متقاس بـ Whisper قبل/بعد) =====
  { const { ctx, page, E } = await open();
    const r = await page.evaluate(() => ["القوة 10 نيوتن والعجلة 2 متر", "في سنة 1952 قامت الثورة", "الـ DNA جوه الـ mitochondria", "الإجابة 2.5 تقريبًا", "Newton's second law says F = ma"].map(t => TTS.arPrep(t)));
    ok("Arabic speech prep: numbers → spoken Egyptian words", r[0].includes("عشرة نيوتن") && r[0].includes("اتنين متر") && r[1].includes("ألف وتسعمية واتنين وخمسين") && r[3].includes("اتنين فاصلة خمسة"), r);
    ok("Arabic speech prep: English terms inside Arabic → Arabic letters (acronyms spelled), English sentences untouched", r[2].includes("دي إن إيه") && r[2].includes("الميتوكوندريا") && !/[A-Za-z]/.test(r[2]) && r[4] === "Newton's second law says F = ma", r);
    ok("speech prep: no JS errors", !E.length, E); await ctx.close(); }

  // ===== ٤ب) الخدمات المجانية كلها مش قادر يوصلها (زي سكرين شوت الطالب) =====
  const FREE = /llm7\.io|kepler\.ai\.cloud\.ovh\.net|kilo\.ai/;
  { const { ctx, page, E } = await open({}, () => { localStorage.setItem("aimig2", "1"); localStorage.setItem("aimig3", "1"); localStorage.setItem("aimig4", "1"); localStorage.setItem("provider", "free"); });
    let hits = 0; await ctx.route(FREE, r => { hits++; r.abort("internetdisconnected"); });
    const t0 = Date.now(); await page.fill("#q", "اشرحلي يعني ايه قوة"); await page.click("#send");
    await page.waitForFunction(() => !document.body.classList.contains("gen") && /⚠️/.test([...document.querySelectorAll("#chat .m")].at(-1)?.innerText || ""), null, { timeout: 60000 }).catch(() => {});
    const last = await page.evaluate(() => [...document.querySelectorAll("#chat .m")].at(-1)?.innerText || "");
    ok(`free services unreachable → retried (${hits} requests), then a message that names which services failed and what to do (${Date.now() - t0} ms)`, hits > FREE_N && /ماردّتش/.test(last) && /LLM7/.test(last) && /Puter|Gemini/.test(last), last.slice(0, 300));
    ok("free-down flow: no JS errors", !E.length, E); await ctx.close(); }
  // ===== ٤ج) لو عند الطالب مفتاح Gemini: الموقع بيحوّل لوحده لما المجاني يقع =====
  { const { ctx, page, E } = await open({}, () => { localStorage.setItem("aimig2", "1"); localStorage.setItem("aimig3", "1"); localStorage.setItem("aimig4", "1"); localStorage.setItem("provider", "free"); localStorage.setItem("gkey", "AIza-test"); localStorage.setItem("gmodel", "gemini-test-flash"); });
    await ctx.route(FREE, r => r.abort("internetdisconnected"));
    await ctx.route(/generativelanguage\.googleapis\.com/, r => r.fulfill({ status: 200, headers: { "content-type": "text/event-stream", "access-control-allow-origin": "*" }, body: 'data: {"candidates":[{"content":{"parts":[{"text":"القوة هي مؤثر بيغيّر حركة الجسم."}]}}]}\n\n' }));
    await page.fill("#q", "اشرحلي يعني ايه قوة"); await page.click("#send");
    await page.waitForFunction(() => !document.body.classList.contains("gen") && /مؤثر بيغيّر حركة/.test(document.querySelector("#chat").innerText), null, { timeout: 60000 }).catch(() => {});
    ok("free services down + the student has a Gemini key → the answer still arrives (automatic fallback)", /مؤثر بيغيّر حركة/.test(await page.evaluate(() => document.querySelector("#chat").innerText)));
    ok("fallback flow: no JS errors", !E.length, E); await ctx.close(); }

  // ===== ٥) حدّين واضحين: حفظ على الجهاز (300) وتزامن مع الحساب (50 = حد Supabase) =====
  { const { ctx, page, E } = await open();
    const sqlMB = +readFileSync(path.join(ROOT, "server", "supabase.sql"), "utf8").match(/false,\s*(\d+),\s*array\['application\/pdf'\]/)[1] / 1048576;
    const cfg = readFileSync(path.join(ROOT, "config.js"), "utf8"), localMB = +cfg.match(/maxPdfMB:\s*(\d+)/)[1], syncMB = +cfg.match(/syncMaxPdfMB:\s*(\d+)/)[1];
    const site = await page.evaluate(() => ({ local: MAX_PDF_MB, sync: SYNC_MAX_MB }));
    ok(`limits agree everywhere: device ${localMB} MB (config = site ${site.local}), cloud sync ${syncMB} MB (config = site ${site.sync} = Supabase bucket ${sqlMB})`, localMB === site.local && syncMB === site.sync && syncMB === sqlMB && localMB >= syncMB, { localMB, syncMB, sqlMB, site });
    // كتاب 51 ميجا (أكبر من حد المزامنة): بيتحفظ على الجهاز + رسالة إنه مش هيتزامن
    const src = readFileSync(path.join(FX, "newton.pdf")), nl = src.indexOf(10) + 1;
    const mid = Buffer.alloc((syncMB + 1) * 1048576, 120); mid[0] = 37; mid[mid.length - 1] = 10;   // سطر تعليق % طويل (صالح جوه PDF)
    const bigPdf = path.join(os.tmpdir(), "big51-" + port + ".pdf"); writeFileSync(bigPdf, Buffer.concat([src.subarray(0, nl), mid, src.subarray(nl)]));
    await page.setInputFiles("#files", bigPdf); await sleep(3500); rmSync(bigPdf, { force: true });
    const r = await page.evaluate(() => ({ lib: LIB.length, size: LIB[0]?.size, msg: $("vmsg").innerText }));
    ok(`a ${syncMB + 1} MB book is accepted on the device, and the student is told it won't sync`, r.lib === 1 && r.size > syncMB * 1048576 && new RegExp("اتحفظ على جهازك بس").test(r.msg) && !/أكبر من \d+ ميجا: /.test(r.msg), r);
    // أكبر من حد الجهاز: يترفض قبل الحفظ ومعاه الرقم
    const huge = path.join(os.tmpdir(), "huge-" + port + ".pdf"); writeFileSync(huge, Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc((localMB + 1) * 1048576, 32)]));
    await page.evaluate(async () => { await delBook(LIB[0].id); }); await sleep(600);
    await page.setInputFiles("#files", huge); await sleep(3000); rmSync(huge, { force: true });
    const h = await page.evaluate(() => ({ lib: LIB.length, msg: $("vmsg").innerText + " " + ($("ttoast")?.textContent || "") }));
    ok(`a book over the device limit (${localMB} MB) is refused before saving, with the limit in the message`, h.lib === 0 && new RegExp(String(localMB)).test(h.msg), h);
    ok("size-limit flow: no JS errors", !E.length, E); await ctx.close(); }
  // ===== ٦) كتب جاهزة مع الموقع (config.seedBooks): بتتحمّل مرة، مبترجعش بعد المسح، والفشل مش بيوقع الموقع =====
  { const { mkdirSync, copyFileSync } = await import("node:fs"), BD = path.join(ROOT, "books"); mkdirSync(BD, { recursive: true });
    copyFileSync(path.join(FX, "newton.pdf"), path.join(BD, "seedtest-a.pdf")); copyFileSync(path.join(FX, "physics.pdf"), path.join(BD, "seedtest-b.pdf"));
    try {
      const seed = list => `window.TUTOR_CONFIG = { seedBooks: ${JSON.stringify(list)} };`;
      const good = [{ file: "كتاب_تجريبي_1.pdf", url: "books/seedtest-a.pdf" }, { file: "Book_B.pdf", url: "books/seedtest-b.pdf" }];
      { const { ctx, page, E } = await open({}, seed(good)); await sleep(5000);
        let r = await page.evaluate(() => ({ names: LIB.map(x => x.name), seeded: JSON.parse(localStorage.getItem("seeded") || "[]"), blobs: 0 }));
        ok("seed books: both load on first visit and show with proper names", r.names.length === 2 && r.names.includes("كتاب تجريبي 1") && r.names.includes("Book B") && r.seeded.length === 2, r);
        await page.evaluate(async () => { await delBook(LIB.find(x => x.file === "Book_B.pdf").id); }); await sleep(800);
        await page.reload(); await sleep(4000);
        r = await page.evaluate(() => LIB.map(x => x.file));
        ok("seed books: a book the student deleted does NOT come back after reload; the other stays", r.length === 1 && r[0] === "كتاب_تجريبي_1.pdf", r);
        ok("seed books: no JS errors", !E.length, E); await ctx.close(); }
      { const { ctx, page } = await open({}, seed([...good.slice(0, 1), { file: "Missing.pdf", url: "books/nope-" + port + ".pdf" }])); await sleep(5000);
        const r = await page.evaluate(() => ({ files: LIB.map(x => x.file), seeded: JSON.parse(localStorage.getItem("seeded") || "[]") }));
        ok("seed books: a missing file fails gracefully — the others still load and the failed one is retried next time (not marked done)", r.files.length === 1 && r.files[0] === "كتاب_تجريبي_1.pdf" && !r.seeded.includes("Missing.pdf"), r);
        await ctx.close(); }
    } finally { rmSync(path.join(BD, "seedtest-a.pdf"), { force: true }); rmSync(path.join(BD, "seedtest-b.pdf"), { force: true }); try { (await import("node:fs")).rmdirSync(BD); } catch {} } }
} finally { await b.close(); srv.kill(); }
console.log(`\n${pass} passed, ${fail} failed  (real browser; external AI services blocked — failure handling tested, not answer quality)`);
process.exit(fail ? 1 : 0);

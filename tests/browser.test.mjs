// اختبارات الموقع في متصفح حقيقي (Chromium عن طريق Playwright) — من غير مفاتيح: السيرفر ومحركات الصوت متقلّدة.
// التشغيل (مرة واحدة): npm i -D playwright && npx playwright install chromium
//          بعد كده:     node tests/browser.test.mjs
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), FX = path.join(ROOT, "tests", "fixtures");
let pw; try { pw = await import(process.env.PLAYWRIGHT_PATH || "playwright"); } catch (e) { console.error("❌ FAILED: Playwright مش متسطّب (" + (e?.message || e).slice(0, 120) + ") — شغّل: npm install && npx playwright install chromium"); process.exit(1); }
const { chromium } = pw.default || pw;
let pass = 0, fail = 0; const errs = [];
const ok = (name, cond, info = "") => { cond ? pass++ : fail++; console.log((cond ? "✅ " : "❌ ") + name + (cond ? "" : "  → " + String(info).slice(0, 300))); };
const file = n => ({ name: n, mimeType: "application/pdf", buffer: readFileSync(path.join(FX, n)) });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const port0 = 19000 + Math.floor(Math.random() * 500), portS = port0 + 600;
const procs = [];
async function server(port, env = {}) {
  const p = spawn(process.execPath, [path.join(ROOT, "server", "node.mjs")], { env: { ...process.env, PORT: String(port), AZURE_SPEECH_KEY: "", OPENAI_API_KEY: "", ANTHROPIC_API_KEY: "", GEMINI_API_KEY: "", PIPER_URL: "", ...env }, stdio: "pipe" }); procs.push(p);
  for (let i = 0; i < 40; i++) { await sleep(150); try { if ((await fetch(`http://127.0.0.1:${port}/v1/health`)).ok) return p; } catch {} } throw new Error("server didn't start");
}
const SITE = `http://127.0.0.1:${port0}/`;
await server(port0);   // بيعرض الموقع بس (من غير مفاتيح)
const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const watch = (page, tag) => { page.on("pageerror", e => errs.push(tag + ": " + e.message)); page.on("dialog", d => d.accept()); };
// الاختبارات دي بتختبر محركات الصوت التانية (سيرفر/كريم) بإعداد «تلقائي» — صوت المتصفح (الافتراضي الجديد) ليه اختبار في regress.test.mjs
const block = ctx => Promise.all([ctx.addInitScript(() => { localStorage.setItem("dev", "1"); }), ctx.route(/fonts\.(googleapis|gstatic)\.com|huggingface\.co|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|generativelanguage/, r => r.fulfill({ status: 404, body: "" }))]);

try {
  // ===== 10) startup without a configured server =====
  { const ctx = await b.newContext(); await block(ctx); const page = await ctx.newPage(); watch(page, "startup");
    await page.goto(SITE); await sleep(800);
    const s = await page.evaluate(() => ({ lib: LIB.length, empty: /مكتبتك فاضية/.test($("vmsg").innerText), px: PX.status(), eng: TTS.current()?.id, hello: !!document.querySelector("#chat .hello") }));
    ok("10. app starts without a server: empty library, welcome screen, no errors", s.lib === 0 && s.empty && s.hello && s.px === "off", JSON.stringify(s));
    ok("10b. without a server the voice uses the in-browser engine (not the browser voice)", s.eng === "local", s.eng);
    // ===== 9) PDF storage and retrieval =====
    await page.setInputFiles("#files", [file("biology.pdf"), file("physics.pdf"), { name: "notes.pdf", mimeType: "application/pdf", buffer: Buffer.from("just text, not a pdf") }]); await sleep(1500);
    const up = await page.evaluate(() => ({ lib: LIB.map(x => x.name), msg: $("vmsg").hidden ? "" : $("vmsg").innerText, page1: !!document.querySelector('#pages .pg[data-n="1"]') }));
    ok("9. multiple PDFs saved; fake PDF rejected with a meaningful reason that stays visible", up.lib.length === 2 && /notes\.pdf/.test(up.msg) && /مش PDF سليم/.test(up.msg) && /اتحفظ 2 كتاب/.test(up.msg), JSON.stringify(up));
    ok("9a. rejection also shown as a notice", /notes\.pdf/.test(await page.evaluate(() => document.getElementById("ttoast")?.textContent || "")));
    await page.click("#openFirst");
    await page.waitForFunction(() => document.querySelector('#pages .pg[data-n="1"] canvas')?.width > 0, null, { timeout: 15000 }).catch(() => {});
    ok("9b. book renders", await page.evaluate(() => document.querySelector('#pages .pg[data-n="1"] canvas').width > 0 && doc.numPages === 3));
    await page.click("#next"); await sleep(300); ok("9c. page navigation", await page.evaluate(() => cur.page === 2));
    // more invalid files: empty, random bytes, corrupted PDF (valid header, cut in the middle)
    const bio = readFileSync(path.join(FX, "biology.pdf"));
    await page.setInputFiles("#files", [{ name: "empty.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(0) }, { name: "random.pdf", mimeType: "application/pdf", buffer: Buffer.from(Array.from({ length: 3000 }, (_, i) => (i * 7919) % 251)) }]); await sleep(800);
    const inv = await page.evaluate(() => ({ msg: $("vmsg").hidden ? "" : $("vmsg").innerText, lib: LIB.length }));
    ok("9g. empty file → «الملف فاضي», random bytes → «مش PDF سليم», nothing saved", /الملف فاضي: empty\.pdf/.test(inv.msg) && /مش PDF سليم: random\.pdf/.test(inv.msg) && /ماتحفظش أي كتاب/.test(inv.msg) && inv.lib === 2, JSON.stringify(inv));
    await page.setInputFiles("#files", [{ name: "cut.pdf", mimeType: "application/pdf", buffer: bio.subarray(0, Math.floor(bio.length / 3)) }]); await sleep(2500);
    const cut = await page.evaluate(() => ({ msg: $("vmsg").hidden ? "" : $("vmsg").innerText, del: !!$("delBad") }));
    ok("9h. corrupted PDF (header OK, file cut) → «تالف» message + delete option (not «missing»)", /تالف/.test(cut.msg) && cut.del && !/مش موجود في متصفحك/.test(cut.msg), JSON.stringify(cut));
    await page.click("#delBad"); await sleep(700);
    // annotations: highlight + note + edit + persistence + navigation
    const bioId = await page.evaluate(() => LIB.find(x => /biology/i.test(x.name))?.id); await page.evaluate(id => openBook(id, 1), bioId);
    await page.waitForFunction(() => document.querySelector('#pages .pg[data-n="1"] canvas')?.width > 0, null, { timeout: 15000 }).catch(() => {}); await sleep(400);
    await page.click('#tools [data-tool="hl"]');
    const bx = await page.$eval('#pages .pg[data-n="1"]', el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    await page.mouse.move(bx.x + bx.w * .2, bx.y + bx.h * .15); await page.mouse.down(); await page.mouse.move(bx.x + bx.w * .6, bx.y + bx.h * .15, { steps: 6 }); await page.mouse.up();
    await page.click('#tools [data-tool="text"]'); await page.mouse.click(bx.x + bx.w * .2, bx.y + bx.h * .3); await page.keyboard.type("ملاحظة"); await page.click("#q"); await sleep(300);
    await page.click('#tools [data-tool="text"]'); await page.mouse.click(bx.x + bx.w * .2 + 4, bx.y + bx.h * .3 + 4); await page.keyboard.type(" مهمة"); await page.click("#q"); await sleep(400);
    await page.click('#tools [data-tool="select"]');
    await page.evaluate(() => gotoPage(3)); await sleep(300); await page.click("#annNext"); await sleep(400);
    ok("9i. annotated-page button jumps back to page 1", await page.evaluate(() => cur.page === 1));
    await page.reload(); await sleep(1500); await page.waitForFunction(id => INK.bookId === id, bioId, { timeout: 10000 }).catch(() => {});
    const an = await page.evaluate(() => (INK.ann[1] || []).map(x => x.t + ":" + (x.v || "")));
    ok("9j. highlight + edited note restored after refresh", an.includes("hl:") && an.includes("text:ملاحظة مهمة") && an.filter(x => x.startsWith("text")).length === 1, JSON.stringify(an));
    await page.setInputFiles("#files", [file("locked.pdf")]); await sleep(2500);
    const lk = await page.evaluate(() => ({ msg: $("vmsg").hidden ? "" : $("vmsg").innerText, del: !!$("delBad") }));
    ok("9d. password-protected PDF → clear message + delete option", /كلمة سر/.test(lk.msg) && lk.del, JSON.stringify(lk));
    await page.click("#delBad"); await sleep(700);
    await page.reload(); await sleep(1500);
    const after = await page.evaluate(async () => ({ lib: LIB.map(x => x.name), keys: (await idbKeys()).length, open: cur.id }));
    ok("9e. books still there after refresh (IndexedDB) and opened again", after.lib.length === 2 && !!after.open, JSON.stringify(after));
    const id = await page.evaluate(() => LIB.find(x => /physics/i.test(x.name))?.id);
    await page.click(`#books button[data-id="${id}"] .bx`); await sleep(800);
    const del = await page.evaluate(async id => ({ lib: LIB.length, keys: (await idbKeys()).filter(k => String(k).includes(id)).length }), id);
    ok("9f. delete book removes file + index + annotations", del.lib === 1 && del.keys === 0, JSON.stringify(del));
    await ctx.close(); }

  // ===== server health: down at start → recovers automatically =====
  { const ctx = await b.newContext(); await block(ctx); const page = await ctx.newPage(); watch(page, "health");
    await page.addInitScript(p => localStorage.setItem("proxy", `http://127.0.0.1:${p}`), portS);
    await page.goto(SITE); await sleep(1500);
    const d = await page.evaluate(() => ({ st: PX.status(), eng: TTS.current()?.id, msg: (fillTTS(), $("vnow").innerText) }));
    ok("health: server down at startup → status 'down', settings say so, voice falls back", d.st === "down" && d.eng === "local" && /مش متاح دلوقتي/.test(d.msg), JSON.stringify(d));
    const sp = await server(portS, { ALLOWED_ORIGINS: SITE.replace(/\/$/, ""), PIPER_URL: "http://127.0.0.1:1" });
    await page.waitForFunction(() => PX.status() === "ok", null, { timeout: 20000 }).catch(() => {});
    const r = await page.evaluate(() => ({ st: PX.status(), eng: TTS.current()?.id, tts: !!PX.cached()?.tts }));
    ok("health: server comes up later → detected automatically (no refresh), server voice available", r.st === "ok" && r.eng === "server" && r.tts, JSON.stringify(r));
    sp.kill(); await sleep(300);
    await page.evaluate(() => PX.post("/api/tts", { text: "x" }).catch(() => {})); await sleep(300);
    ok("health: server goes down → stale status cleared (no longer 'ok')", await page.evaluate(() => PX.status() !== "ok"));
    await ctx.close(); }

  // ===== speed + audio lifecycle (server voice emulated in the browser) =====
  const wav = (sec = 1) => { const n = Math.round(24000 * sec), buf = Buffer.alloc(44 + n * 2); buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVEfmt ", 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(24000, 24); buf.writeUInt32LE(48000, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(n * 2, 40); for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin(i / 20) * 3000), 44 + i * 2); return buf; };
  { const ctx = await b.newContext(); await block(ctx); const page = await ctx.newPage(); watch(page, "audio");
    const reqs = []; let mode = "ok", clampTo = 0, delay = 0;
    await ctx.route("**/v1/health", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, chat: false, tts: { provider: "azure", chain: ["azure"], caps: { pitch: true, mixed: true }, providers: [{ id: "azure", label: "Azure Speech", caps: { pitch: true, mixed: true } }], voices: [{ id: "ar-EG-ShakirNeural", name: "شاكر — مصري", lang: "ar", gender: "m", default: true, provider: "azure" }, { id: "en-US-AndrewMultilingualNeural", name: "Andrew", lang: "en", gender: "m", default: true, provider: "azure" }] }, ttsWarnings: [] }) }));
    await ctx.route("**/api/tts", async r => { const body = JSON.parse(r.request().postData()); reqs.push(body); if (delay) await sleep(delay);
      if (mode === "500") return r.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "azure: boom" }) });
      if (mode === "auth") return r.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "azure: المفتاح غلط أو منتهي (401)", code: "auth" }) });
      const eff = clampTo && body.rate > clampTo ? clampTo : body.rate;
      r.fulfill({ status: 200, headers: { "content-type": "audio/wav", "x-tts-rate": String(eff), "x-tts-provider": "azure", "x-tts-voice": body.voice || "ar-EG-ShakirNeural" }, body: wav(1.2) }); });
    await page.addInitScript(() => { localStorage.setItem("proxy", "/");
      window.__urls = { made: new Set(), freed: 0 }; const c = URL.createObjectURL, v = URL.revokeObjectURL;
      URL.createObjectURL = o => { const u = c(o); if (o?.type?.startsWith("audio")) __urls.made.add(u); return u; }; URL.revokeObjectURL = u => { if (__urls.made.delete(u)) __urls.freed++; return v(u); };
      window.__utt = []; if (window.speechSynthesis) { window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } }; speechSynthesis.getVoices = () => [{ name: "Test Arabic", lang: "ar-EG", voiceURI: "t", localService: true, default: true }]; speechSynthesis.speak = u => { __utt.push({ t: u.text, rate: u.rate }); u._t = setTimeout(() => { if (window.__cur === u) window.__cur = null; u.onend?.(); }, 700); window.__cur = u; }; speechSynthesis.cancel = () => { if (window.__cur) { clearTimeout(__cur._t); const u = __cur; __cur = null; u.onend?.(); } }; Object.defineProperty(speechSynthesis, "speaking", { get: () => !!window.__cur, configurable: true }); } });
    await page.goto(SITE); await page.waitForFunction(() => TTS.current()?.id === "server", null, { timeout: 8000 }).catch(() => {});
    const TEXT = "النهارده هنشرح الخلية. الغشاء الخلوي cell membrane بيحمي الخلية وبيتحكم في اللي داخل وخارج. والنواة مركز التحكم.";
    const speakNew = async () => page.evaluate(t => { const d = add("a", t); window._b = d._spk; d._spk.click(); }, TEXT);
    const idle = () => page.waitForFunction(() => _b.dataset.st === "idle", null, { timeout: 20000 }).catch(() => {});
    for (const rate of [0.75, 1, 1.25, 1.5]) {
      reqs.length = 0; await page.evaluate(r => setRate(r), rate); await speakNew();
      await page.waitForFunction(() => _b.dataset.st === "play", null, { timeout: 8000 }).catch(() => {});
      const pr = await page.evaluate(() => AUD.playbackRate); await idle();
      ok(`speed ${rate}×: sent to the server (rate=${rate}) and played at the right speed (no double speed-up)`, reqs.length > 0 && reqs.every(x => x.rate === rate) && Math.abs(pr - 1) < 0.01, JSON.stringify({ rates: reqs.map(x => x.rate), pr }));
    }
    clampTo = 1.2; reqs.length = 0; await page.evaluate(() => setRate(1.5)); await speakNew(); await page.waitForFunction(() => _b.dataset.st === "play", null, { timeout: 8000 }).catch(() => {});
    const cl = await page.evaluate(() => AUD.playbackRate); await idle(); clampTo = 0;
    ok("engine that caps speed (1.2×): the player makes up the rest → 1.5× total", Math.abs(cl - 1.25) < 0.01, cl);
    await page.evaluate(() => setRate(1)); reqs.length = 0; await speakNew(); await page.waitForFunction(() => _b.dataset.st === "play", null, { timeout: 8000 }).catch(() => {});
    await page.evaluate(() => setRate(1.5)); const mid = await page.evaluate(() => AUD.playbackRate); await idle();
    ok("speed changed during playback: current audio speeds up now, the rest is generated at the new speed", Math.abs(mid - 1.5) < 0.01 && reqs.some(x => x.rate === 1.5), JSON.stringify({ mid, rates: reqs.map(x => x.rate) }));
    await page.evaluate(() => setRate(1));
    // pause / resume / stop / replay
    await speakNew(); await page.waitForFunction(() => _b.dataset.st === "play", null, { timeout: 8000 }).catch(() => {});
    await page.evaluate(() => _b.click()); await sleep(150); const pz = await page.evaluate(() => [_b.dataset.st, AUD.paused]);
    await page.evaluate(() => _b.click()); await sleep(150); const rs = await page.evaluate(() => [_b.dataset.st, AUD.paused]);
    await page.evaluate(() => _b._ctl.stop.click()); await sleep(150); const sp = await page.evaluate(() => [_b.dataset.st, AUD.paused, !!PS]);
    await page.evaluate(() => _b._ctl.replay.click()); await page.waitForFunction(() => _b.dataset.st === "play", null, { timeout: 8000 }).catch(() => {}); const rp = await page.evaluate(() => [_b.dataset.st, PS?.i]); await idle();
    ok("pause → resume → stop → replay", pz.join() === "paused,true" && rs[0] === "play" && rs[1] === false && sp.join() === "idle,true,false" && rp.join() === "play,0", JSON.stringify({ pz, rs, sp, rp }));
    // pause at the exact moment playback starts (browser rejects play() with AbortError) → must not count as a failure
    await page.evaluate(() => { const d = add("a", "جملة للتجربة بتاعة الإيقاف في أول لحظة."); window._b = d._spk; AUD.addEventListener("play", () => pauseSpeak(), { once: true }); d._spk.click(); });
    await sleep(600); const pz0 = await page.evaluate(() => _b.dataset.st); await page.evaluate(() => resumeSpeak()); await idle();
    ok("pause at the very start of playback, then resume → same voice continues (no false fallback)", pz0 === "paused" && await page.evaluate(() => TTS.current()?.id === "server" && !TTS.isDown("server")), pz0);
    // cancel while generating
    delay = 1500; reqs.length = 0; await speakNew(); await sleep(300); const ld = await page.evaluate(() => _b.dataset.st + "|" + (PS?.i ?? "-") + "|" + (PS?.segs.length ?? "-"));
    await page.evaluate(() => _b._ctl.stop.click()); await sleep(2500); delay = 0;
    ok("cancel while the audio is being generated → nothing plays afterwards", /^load/.test(ld) && await page.evaluate(() => _b.dataset.st === "idle" && AUD.paused && !PS), ld);
    // new response stops the old one
    await speakNew(); await page.waitForFunction(() => _b.dataset.st === "play", null, { timeout: 8000 }).catch(() => {}); await page.evaluate(() => { window._old = _b; });
    await speakNew(); await sleep(200);
    ok("starting a new answer stops the old audio", await page.evaluate(() => _old.dataset.st === "idle" && _b.dataset.st !== "idle")); await idle();
    // object URLs released
    await sleep(500); const u = await page.evaluate(() => ({ left: __urls.made.size, freed: __urls.freed }));
    ok("audio memory released (no leaked object URLs)", u.left === 0 && u.freed > 5, JSON.stringify(u));
    // failed request → notice + fallback, player not stuck
    mode = "500"; await speakNew(); await idle(); mode = "ok";
    const f = await page.evaluate(() => ({ st: _b.dataset.st, toast: document.getElementById("ttoast")?.textContent || "" }));
    ok("server voice fails → user is told + another engine continues, player not stuck", f.st === "idle" && /مشتغلش/.test(f.toast), JSON.stringify(f));
    await page.evaluate(() => { TTS.markDown("server", { status: 0 }); }); await sleep(10); await page.evaluate(() => location.reload()); await sleep(1500);
    await page.waitForFunction(() => TTS.current()?.id === "server", null, { timeout: 8000 }).catch(() => {});
    mode = "auth"; await speakNew(); await idle(); mode = "ok";
    ok("wrong API key on the server → the user is told to check the key (not silent)", /مفتاح محرك الصوت على السيرفر غلط/.test(await page.evaluate(() => document.getElementById("ttoast")?.textContent || "")) && await page.evaluate(() => _b.dataset.st === "idle"));
    // browser speech: rate + mid-change re-speak
    await page.evaluate(() => { TTS.markDown("server", { status: 502 }); TTS.markDown("local", { message: "NOSUPPORT" }); setRate(1.25); });
    await page.evaluate(() => { __utt.length = 0; const d = add("a", "جملة أولى للتجربة. وجملة تانية."); window._b = d._spk; d._spk.click(); }); await sleep(300);
    await page.evaluate(() => setRate(0.75)); await idle();
    const ut = await page.evaluate(() => __utt);
    ok("browser voice: speed applied, and changing it mid-sentence restarts that sentence at the new speed", ut[0]?.rate === 1.25 && ut.some((x, i) => i > 0 && x.t === ut[0].t && x.rate === 0.75), JSON.stringify(ut));
    // settings show honest status
    const st = await page.evaluate(() => (fillTTS(), $("vnow").innerText));
    ok("settings show the engine, the voice, and the last playback that actually worked", /المحرك:/.test(st) && /الصوت( \(نفسه للعربي والإنجليزي\))?:/.test(st) && /آخر تشغيل نجح/.test(st), st);
    // exact names: server engine + selected voice + the provider that really answered
    await page.evaluate(() => { location.reload(); }); await sleep(1500); await page.waitForFunction(() => TTS.current()?.id === "server", null, { timeout: 8000 }).catch(() => {});
    await page.evaluate(() => TTS.set({ voice: "ar-EG-ShakirNeural" })); await speakNew(); await idle();
    const st2 = await page.evaluate(() => (fillTTS(), $("vnow").innerText));
    ok("settings: engine = site server → Azure Speech, ONE voice «شاكر — مصري» for Arabic and English, last success = Azure with Shakir", /المحرك: سيرفر الموقع — Azure Speech/.test(st2) && /الصوت \(نفسه للعربي والإنجليزي\): شاكر — مصري/.test(st2) && !/Andrew/.test(st2) && /آخر تشغيل نجح: سيرفر الموقع \(azure\) — شاكر — مصري/.test(st2), st2);
    { const sent = []; const on = r => { if (r.url().endsWith("/api/tts")) try { sent.push(JSON.parse(r.postData()).voice); } catch {} }; page.on("request", on);
      await page.evaluate(() => voiceSpeak("قانون نيوتن التاني Newton's second law بيقول إن F = m a. Can you explain that in English? Sure, acceleration depends on force and mass.", {})); await idle(); page.off("request", on);
      ok("one voice: every /api/tts request for a mixed Arabic/English answer asks for the same voice (Shakir)", sent.length >= 1 && sent.every(v => v === "ar-EG-ShakirNeural"), JSON.stringify(sent)); }
    await page.evaluate(() => { const t = $("tone"); t.value = "0"; t.dispatchEvent(new Event("change")); });
    const st2b = await page.evaluate(() => (fillTTS(), $("vnow").innerText));
    ok("«صوت عربي + صوت إنجليزي» option still available: shows Shakir + English: Andrew", /الصوت: شاكر — مصري/.test(st2b) && /English: Andrew/.test(st2b), st2b);
    await page.evaluate(() => { const t = $("tone"); t.value = "1"; t.dispatchEvent(new Event("change")); });
    await page.selectOption("#tteach", "en").catch(() => page.evaluate(() => TTS.set({ teacher: "en", voice: "" }))); await page.evaluate(() => { fillTTS(); }); 
    await page.evaluate(() => { const v = $("tvoice"); v.value = "en-US-AndrewMultilingualNeural"; v.dispatchEvent(new Event("change")); });
    const st3 = await page.evaluate(() => ({ s: (fillTTS(), $("vnow").innerText), sel: $("tvoice").value, set: TTS.settings().voice }));
    ok("settings: English Teacher + choosing Andrew → saved, selected, and shown", st3.set === "en-US-AndrewMultilingualNeural" && st3.sel === "en-US-AndrewMultilingualNeural" && /الصوت \(نفسه للعربي والإنجليزي\): Andrew/.test(st3.s), JSON.stringify(st3));
    await ctx.close(); }
} finally {
  await b.close(); procs.forEach(p => p.kill());
}
ok("no JavaScript errors in the page", !errs.length, errs.join(" | "));
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

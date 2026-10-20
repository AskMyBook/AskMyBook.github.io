// اختبار النوت بوك (كتابة، تنسيق، حفظ بعد إعادة التحميل، بحث، مسح، تنظيف HTML الخطير) + تشغيل لينك يوتيوب جوه الموقع وحفظه مع الكتاب
// + زرار «ادخل بحساب جوجل» (Supabase متقلّد: بنتأكد إن الموقع بيطلب provider: google ويرجع لنفس الصفحة، ويعرض اسم وصورة الحساب).
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), FX = path.join(ROOT, "tests", "fixtures");
let pw; try { pw = await import(process.env.PLAYWRIGHT_PATH || "playwright"); } catch (e) { console.error("❌ FAILED: Playwright مش متسطّب (" + String(e?.message || e).slice(0, 120) + ")"); process.exit(1); }
const { chromium } = pw.default || pw;
let pass = 0, fail = 0; const errs = [];
const ok = (n, c, info = "") => { c ? pass++ : fail++; console.log((c ? "✅ " : "❌ ") + n + (c ? "" : "  → " + JSON.stringify(info).slice(0, 400))); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const port = 20100 + Math.floor(Math.random() * 90);
const srv = spawn(process.execPath, [path.join(ROOT, "server", "node.mjs")], { env: { ...process.env, PORT: String(port), LOG: "off", ALLOWED_ORIGINS: "*", YOUTUBE_API_KEY: "", AZURE_SPEECH_KEY: "", OPENAI_API_KEY: "", ANTHROPIC_API_KEY: "", GEMINI_API_KEY: "", GROQ_API_KEY: "" }, stdio: "ignore" });
for (let i = 0; i < 60; i++) { await sleep(150); try { if ((await fetch(`http://127.0.0.1:${port}/v1/health`)).ok) break; } catch {} }
const BLOCK = /fonts\.(googleapis|gstatic)\.com|huggingface\.co|cdnjs\.cloudflare\.com|generativelanguage|llm7|kepler|kilo|js\.puter\.com|ytimg\.com|youtube/;
const GSTUB = `(() => { window.supabase = { createClient() {
  let session = JSON.parse(localStorage.getItem("stub.g") || "null"); const subs = [];
  const Q = { select() { return Q; }, eq() { return Q; }, in() { return Q; }, gt() { return Q; }, order() { return Q; }, limit() { return Q; }, maybeSingle() { return Q; }, upsert() { return Q; }, delete() { return Q; }, then(r) { return Promise.resolve({ data: [], error: null }).then(r); } };
  const auth = { async getSession() { return { data: { session } }; }, onAuthStateChange(f) { subs.push(f); return { data: { subscription: { unsubscribe() {} } } }; },
    async signInWithOAuth(o) { window.__oauth = o; session = { access_token: "t", user: { id: "u-google", email: "student@gmail.com", user_metadata: { full_name: "طالب جوجل", avatar_url: "data:image/gif;base64,R0lGODlhAQABAAAAACw=" } } };
      localStorage.setItem("stub.g", JSON.stringify(session)); localStorage.setItem("stub.oauth", JSON.stringify(o)); setTimeout(() => subs.forEach(f => f("SIGNED_IN", session)), 50); return { data: {}, error: null }; },
    async signOut() { session = null; localStorage.removeItem("stub.g"); subs.forEach(f => f("SIGNED_OUT", null)); return { error: null }; } };
  return { auth, from: () => Q, storage: { from: () => ({ async list() { return { data: [], error: null }; }, async upload() { return { data: {}, error: null }; }, async download() { return { data: null, error: { message: "x" } }; }, async remove() { return { data: [], error: null }; } }) } };
} }; })();`;
const b = await chromium.launch();
try {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }), page = await ctx.newPage();
  page.on("pageerror", e => errs.push(e.message)); page.on("dialog", d => d.accept());
  await ctx.route(BLOCK, r => r.fulfill({ status: 404, body: "" }));
  await page.addInitScript(() => localStorage.setItem("proxy", "/"));
  await page.goto(`http://127.0.0.1:${port}/`); await sleep(800);
  await page.setInputFiles("#files", [path.join(FX, "newton.pdf")]); await sleep(3000);

  // ----- النوت بوك -----
  await page.click("#hubBtn"); await sleep(300); await page.click('[data-h="notebook"]'); await sleep(300);
  ok("notebook tab opens with an empty state", await page.locator("#nbFirst").count() === 1);
  await page.click("#nbFirst"); await sleep(400);
  await page.fill("#nbTitle", "قوانين نيوتن");
  await page.click("#nbEd"); await page.keyboard.type("القانون الأول: القصور الذاتي");
  await page.keyboard.press("Shift+Home"); await page.click('[data-nb="bold"]');
  await page.keyboard.press("End"); await page.keyboard.press("Enter"); await page.keyboard.type("F = m × a");
  await page.evaluate(() => { const ed = document.getElementById("nbEd"); ed.focus(); document.execCommand("insertHTML", false, '<img src=x onerror="window.__xss=1"><script>window.__xss=2<\/script><a href="javascript:alert(1)">bad</a>'); });
  await sleep(1200);
  ok("typing autosaves (✓ اتحفظ)", /اتحفظ/.test(await page.textContent("#nbState")));
  await page.reload(); await sleep(1200); await page.click("#hubBtn"); await sleep(300); await page.click('[data-h="notebook"]'); await sleep(500);
  const html = await page.innerHTML("#nbEd");
  ok("page survives reload with title, text and bold formatting", (await page.inputValue("#nbTitle")) === "قوانين نيوتن" && /<b>|<strong>/.test(html) && html.includes("F = m × a"), { html });
  ok("dangerous HTML is stripped (no img/script/javascript: links)", !/<img|<script|javascript:/i.test(html) && !(await page.evaluate(() => window.__xss)), html);
  await page.click("#nbNew"); await sleep(300); await page.fill("#nbTitle", "مسائل"); await page.click("#nbEd"); await page.keyboard.type("مسألة السقوط الحر"); await sleep(1100);
  ok("second page appears in the list", await page.locator(".nbitem").count() === 2);
  await page.fill("#nbQ", "القصور"); await sleep(700);
  ok("search finds pages by their text", await page.locator(".nbitem").count() === 1 && /قوانين/.test(await page.textContent(".nbitem")));
  await page.fill("#nbQ", ""); await sleep(700);
  await page.click('.nbitem:has-text("مسائل")'); await sleep(300); await page.click("#nbDel"); await sleep(500);
  ok("deleting a page removes it (and it stays deleted)", await page.locator(".nbitem").count() === 1);
  const stored = await page.evaluate(async () => (await idbGet("nb")).map(x => !!x.del));
  ok("deleted page is kept as a tombstone so sync won't bring it back", stored.filter(Boolean).length === 1, stored);

  // ----- لينك يوتيوب يشتغل جوه الموقع + حفظه مع الكتاب -----
  await page.click('[data-h="videos"]'); await sleep(600);
  ok("without a YouTube key the tab explains how to paste a link", /الزق/.test(await page.textContent("#vRes")));
  await page.fill("#vUrl", "https://youtu.be/dQw4w9WgXcQ?si=abc"); await page.click("#vLink button[type=submit]"); await sleep(300);
  ok("pasted youtu.be link plays inside the site", /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/.test(await page.locator("#vPlayer iframe").getAttribute("src") || ""));
  await page.click("#vStar"); await sleep(400);
  ok("video saved to this book shows under ⭐", await page.locator("#vSaved .vcard").count() === 1);
  await page.fill("#vUrl", "https://www.youtube.com/watch?v=abcdefghijk&t=30"); await page.click("#vLink button[type=submit]"); await sleep(300);
  ok("watch?v= links work too", /embed\/abcdefghijk/.test(await page.locator("#vPlayer iframe").getAttribute("src") || ""));
  await page.fill("#vUrl", "not a link"); await page.click("#vLink button[type=submit]"); await sleep(300);
  ok("a non-YouTube link doesn't break the player", /embed\/abcdefghijk/.test(await page.locator("#vPlayer iframe").getAttribute("src") || ""));
  await ctx.close();

  // ----- الدخول بجوجل -----
  const c2 = await b.newContext(), p2 = await c2.newPage(); p2.on("pageerror", e => errs.push(e.message));
  await c2.route(BLOCK, r => r.fulfill({ status: 404, body: "" }));
  await c2.route(/supabase-js/, r => r.fulfill({ status: 200, headers: { "content-type": "text/javascript" }, body: GSTUB }));
  await c2.addInitScript(() => { window.TUTOR_CONFIG = { supabaseUrl: "https://demo.supabase.co", supabaseAnonKey: "anon-public-key" }; localStorage.setItem("proxy", "/"); });
  await p2.goto(`http://127.0.0.1:${port}/`); await sleep(1500);
  await p2.click("#acctBtn"); await sleep(300);
  ok("account panel shows «ادخل بحساب جوجل»", await p2.locator("#acGoogle").isVisible());
  await p2.click("#acGoogle"); await sleep(800);
  const o = await p2.evaluate(() => JSON.parse(localStorage.getItem("stub.oauth") || "null"));
  ok("Google sign-in asks Supabase for provider google and returns to this page", o?.provider === "google" && o.options?.redirectTo === `http://127.0.0.1:${port}/`, o);
  ok("after sign-in the panel shows the Google name", /طالب جوجل/.test(await p2.textContent("#acct")), await p2.textContent("#acct"));
  await c2.close();
  ok("no JS errors", !errs.length, errs);
} finally { await b.close(); srv.kill(); }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

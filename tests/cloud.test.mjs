// الحسابات والمزامنة: جهازين بنفس الحساب + حساب تاني مايشوفش حاجة + السيرفر بيطلب دخول لو REQUIRE_AUTH=true.
// ⚠️ Supabase متقلّد هنا (نسخة صغيرة في الذاكرة بتطبّق نفس قواعد RLS اللي في server/supabase.sql: كل مستخدم صفوفه وفولدره بس).
//    ده بيختبر كود الموقع والسيرفر — مش Supabase الحقيقي. القواعد الحقيقية في supabase.sql لازم تتشغّل في مشروعك.
import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import os from "node:os";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), FX = path.join(ROOT, "tests", "fixtures");
let pw; try { pw = await import(process.env.PLAYWRIGHT_PATH || "playwright"); } catch (e) { console.error("❌ FAILED: Playwright مش متسطّب (" + (e?.message || e).slice(0, 120) + ") — شغّل: npm install && npx playwright install chromium"); process.exit(1); }
const { chromium } = pw.default || pw;
let pass = 0, fail = 0; const errs = [];
const ok = (n, c, info = "") => { c ? pass++ : fail++; console.log((c ? "✅ " : "❌ ") + n + (c ? "" : "  → " + JSON.stringify(info).slice(0, 400))); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ----- Supabase متقلّد (بيانات في الذاكرة + RLS) -----
const DBS = { users: new Map(), tokens: new Map(), kv: new Map(), files: new Map(), chunks: [], resets: [] };
const cos = (a, b) => { let d = 0, x = 0, y = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; x += a[i] * a[i]; y += b[i] * b[i]; } return d / (Math.sqrt(x * y) || 1); };
function sb(op, argJson, tok) {
  const a = JSON.parse(argJson), uid = DBS.tokens.get(tok);
  const sess = u => { const t = randomUUID(); DBS.tokens.set(t, u.id); return { access_token: t, user: { id: u.id, email: u.email } }; };
  if (op === "signUp") { if (DBS.users.has(a.email)) return JSON.stringify({ error: "User already registered" }); const u = { id: randomUUID(), email: a.email, password: a.password }; DBS.users.set(a.email, u); return JSON.stringify({ session: sess(u) }); }
  if (op === "signIn") { const u = DBS.users.get(a.email); if (!u || u.password !== a.password) return JSON.stringify({ error: "Invalid login credentials" }); return JSON.stringify({ session: sess(u) }); }
  if (op === "reset") { DBS.resets.push(a.email); return JSON.stringify({ data: {} }); }
  if (!uid) return JSON.stringify({ error: "JWT required" });
  if (op === "db" && a.t === "chunks") {   // جدول الفهرس (نفس قواعد RLS)
    if (a.op === "upsert") { for (const x of a.rows) { if (x.user_id !== uid) return JSON.stringify({ error: "new row violates row-level security policy" }); DBS.chunks = DBS.chunks.filter(c => !(c.user_id === uid && c.book_id === x.book_id && c.chunk_id === x.chunk_id)); DBS.chunks.push(x); } return JSON.stringify({ data: null }); }
    if (a.op === "delete") { DBS.chunks = DBS.chunks.filter(c => !(c.user_id === uid && a.eq.every(([k, v]) => String(c[k]) === String(v)))); return JSON.stringify({ data: null }); }
  }
  if (op === "rpc") { const r = DBS.chunks.filter(c => c.user_id === uid && c.model === a.emb_model && (!a.books || a.books.includes(c.book_id)) && c.embedding.length === a.query.length)
      .map(c => ({ book_id: c.book_id, chunk_id: c.chunk_id, page: c.page, section: c.section, body: c.body, score: cos(c.embedding, a.query) })).sort((x, y) => y.score - x.score).slice(0, a.k || 8); return JSON.stringify({ data: r }); }
  const rows = DBS.kv.get(uid) || new Map(); DBS.kv.set(uid, rows);
  if (op === "db") {
    if (a.op === "select") { let r = [...rows.values()]; for (const [c, v] of a.eq) r = r.filter(x => String(x[c]) === String(v)); if (a.in) r = r.filter(x => a.in[1].includes(x[a.in[0]])); const cols = a.cols.split(","); const out = r.map(x => Object.fromEntries(cols.map(c => [c, x[c]]))); return JSON.stringify({ data: a.single ? out[0] || null : out }); }
    if (a.op === "upsert") { for (const x of a.rows) { if (x.user_id !== uid) return JSON.stringify({ error: "new row violates row-level security policy" }); rows.set(x.k, x); } return JSON.stringify({ data: null }); }
    if (a.op === "delete") { for (const [k, x] of rows) if ((!a.in || a.in[1].includes(x[a.in[0]])) && a.eq.every(([c, v]) => String(x[c]) === String(v))) rows.delete(k); return JSON.stringify({ data: null }); }
  }
  const own = p => p.split("/")[0] === uid;
  if (op === "up") { if (!own(a.path)) return JSON.stringify({ error: "new row violates row-level security policy" }); DBS.files.set(a.path, a.b64); return JSON.stringify({ data: { path: a.path } }); }
  if (op === "down") { if (!own(a.path) || !DBS.files.has(a.path)) return JSON.stringify({ error: "Object not found" }); return JSON.stringify({ data: DBS.files.get(a.path) }); }
  if (op === "list") { if (a.prefix !== uid) return JSON.stringify({ data: [] }); return JSON.stringify({ data: [...DBS.files.keys()].filter(p => p.startsWith(uid + "/")).map(p => ({ name: p.split("/")[1] })) }); }
  if (op === "rm") { for (const p of a.paths) if (own(p)) DBS.files.delete(p); return JSON.stringify({ data: [] }); }
  return JSON.stringify({ error: "bad op" });
}
const STUB = `(() => { window.supabase = { createClient() {
  let session = JSON.parse(localStorage.getItem("stub.sb") || "null"); const subs = [];
  const call = (op, a) => window.__sb(op, JSON.stringify(a), session?.access_token || "").then(JSON.parse);
  const setS = (s, ev) => { session = s; s ? localStorage.setItem("stub.sb", JSON.stringify(s)) : localStorage.removeItem("stub.sb"); subs.forEach(f => f(ev, s)); };
  const auth = { async signUp(c) { const r = await call("signUp", c); if (r.error) return { data: null, error: { message: r.error } }; setS(r.session, "SIGNED_IN"); return { data: { session: r.session, user: r.session.user }, error: null }; },
    async signInWithPassword(c) { const r = await call("signIn", c); if (r.error) return { data: null, error: { message: r.error } }; setS(r.session, "SIGNED_IN"); return { data: { session: r.session }, error: null }; },
    async signOut() { setS(null, "SIGNED_OUT"); return { error: null }; }, async getSession() { return { data: { session } }; },
    async resetPasswordForEmail(email) { const r = await call("reset", { email }); return { data: {}, error: E(r) }; }, async updateUser() { return { data: {}, error: null }; },
    onAuthStateChange(f) { subs.push(f); return { data: { subscription: { unsubscribe() {} } } }; } };
  class Q { constructor(t) { this.q = { t, op: "select", cols: "*", eq: [] }; } select(c) { this.q.op = this.q.op === "delete" ? "delete" : "select"; this.q.cols = c || "*"; return this; }
    eq(c, v) { this.q.eq.push([c, v]); return this; } in(c, v) { this.q.in = [c, v]; return this; } maybeSingle() { this.q.single = true; return this; }
    upsert(rows) { this.q.op = "upsert"; this.q.rows = Array.isArray(rows) ? rows : [rows]; return this; } delete() { this.q.op = "delete"; return this; }
    then(res, rej) { if (!navigator.onLine) return Promise.resolve({ data: null, error: { message: "Failed to fetch (offline)" } }).then(res, rej); return call("db", this.q).then(r => ({ data: r.data ?? null, error: r.error ? { message: r.error } : null })).then(res, rej); } }
  const b64 = async blob => { const u8 = new Uint8Array(await blob.arrayBuffer()); let s = ""; for (let i = 0; i < u8.length; i += 32768) s += String.fromCharCode.apply(null, u8.subarray(i, i + 32768)); return btoa(s); };
  const E = r => r.error ? { message: r.error } : null;
  const storage = { from: () => ({ async upload(p, blob) { const r = await call("up", { path: p, b64: await b64(blob) }); return { data: r.data, error: E(r) }; },
    async download(p) { const r = await call("down", { path: p }); if (r.error) return { data: null, error: E(r) }; const bin = atob(r.data), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return { data: new Blob([u8], { type: "application/pdf" }), error: null }; },
    async list(prefix) { const r = await call("list", { prefix }); return { data: r.data, error: E(r) }; }, async remove(paths) { const r = await call("rm", { paths }); return { data: r.data, error: E(r) }; } }) };
  return { auth, from: t => new Q(t), storage, rpc: async (fn, args) => { const r = await call("rpc", args); return { data: r.data, error: E(r) }; } }; } }; })();`;

// ----- /auth/v1/user متقلّد للسيرفر -----
const ADMIN = [];
const authSrv = http.createServer(async (req, res) => { const t = (req.headers.authorization || "").replace(/^Bearer /, ""), uid = DBS.tokens.get(t);
  if (req.headers.apikey === "service-secret" && t === "service-secret") {   // Admin API متقلّد (للمسح النهائي)
    let body = ""; for await (const c of req) body += c; ADMIN.push(req.method + " " + req.url.split("?")[0]);
    const send = (o, st = 200) => { res.writeHead(st, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
    if (req.url === "/storage/v1/object/list/books") { const pre = JSON.parse(body).prefix; return send([...DBS.files.keys()].filter(p => p.startsWith(pre + "/")).map(p => ({ name: p.split("/")[1] }))); }
    if (req.url === "/storage/v1/object/books" && req.method === "DELETE") { JSON.parse(body).prefixes.forEach(p => DBS.files.delete(p)); return send({}); }
    if (req.url.startsWith("/rest/v1/")) { const id = decodeURIComponent(req.url.split("user_id=eq.")[1] || ""); if (req.url.includes("user_kv")) DBS.kv.delete(id); else DBS.chunks = DBS.chunks.filter(c => c.user_id !== id); return send({}); }
    if (req.url.startsWith("/auth/v1/admin/users/")) { const id = decodeURIComponent(req.url.split("/").pop()); for (const [e, u] of DBS.users) if (u.id === id) DBS.users.delete(e); for (const [k, v] of DBS.tokens) if (v === id) DBS.tokens.delete(k); return send({}); }
    return send({ error: "?" }, 404); }
  if (req.url === "/auth/v1/user" && uid && req.headers.apikey === "anon-public-key") { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ id: uid, email: "x@y.z" })); } else { res.writeHead(401); res.end("{}"); } }).listen(0);
const aport = authSrv.address().port;
const port = 19900 + Math.floor(Math.random() * 90), port2 = port + 1;
const start = (p, env) => spawn(process.execPath, [path.join(ROOT, "server", "node.mjs")], { env: { ...process.env, PORT: String(p), AZURE_SPEECH_KEY: "", OPENAI_API_KEY: "", ANTHROPIC_API_KEY: "", GEMINI_API_KEY: "", PIPER_URL: "", ...env }, stdio: "pipe" });
const port3 = port + 2, srv3 = start(port3, { SUPABASE_URL: `http://127.0.0.1:${aport}`, SUPABASE_ANON_KEY: "anon-public-key", SUPABASE_SERVICE_ROLE_KEY: "service-secret", ALLOWED_ORIGINS: "*" });
const srv = start(port, {}), srv2 = start(port2, { SUPABASE_URL: `http://127.0.0.1:${aport}`, SUPABASE_ANON_KEY: "anon-public-key", REQUIRE_AUTH: "true", ALLOWED_ORIGINS: "*" });
for (const p of [port, port2, port3]) for (let i = 0; i < 40; i++) { await sleep(150); try { if ((await fetch(`http://127.0.0.1:${p}/v1/health`)).ok) break; } catch {} }
const b = await chromium.launch();
async function device(tag, cfg = true) {
  const ctx = await b.newContext(); await ctx.exposeFunction("__sb", sb);
  await ctx.route(/fonts\.(googleapis|gstatic)\.com|huggingface\.co|cdnjs\.cloudflare\.com|generativelanguage|llm7|kepler|kilo|js\.puter\.com/, r => r.fulfill({ status: 404, body: "" }));
  await ctx.route(/supabase-js/, r => r.fulfill({ status: 200, headers: { "content-type": "text/javascript" }, body: STUB }));
  if (cfg) await ctx.addInitScript(() => { window.TUTOR_CONFIG = { supabaseUrl: "https://demo.supabase.co", supabaseAnonKey: "anon-public-key" }; });
  const page = await ctx.newPage(); page.on("pageerror", e => errs.push(tag + ": " + e.message)); page.on("dialog", d => d.accept());
  await page.goto(`http://127.0.0.1:${port}/`); await sleep(900); return { ctx, page };
}
const login = async (page, email, up) => { await page.click("#acctBtn"); await page.fill("#acEmail", email); await page.fill("#acPass", "secret123"); await (up ? page.click("#acUp") : page.click('#acForm button[type=submit]')); await sleep(1500); await page.evaluate(() => { $("settings").hidden = true; }); };
try {
  // من غير إعداد: مفيش زرار دخول وهمي
  { const { page, ctx } = await device("plain", false); await page.click("#settingsBtn"); await sleep(300);
    ok("no accounts configured → no fake login; settings explain data stays on this device", await page.evaluate(() => $("acctBtn").hidden && /مش متفعّلة/.test($("acct").innerText))); await ctx.close(); }

  const A = await device("A");
  ok("accounts configured → account button + sign-in form", await A.page.evaluate(() => !$("acctBtn").hidden));
  await login(A.page, "student@example.com", true);
  const uidA = await A.page.evaluate(() => CLOUD.user?.id);
  ok("sign up → signed in", !!uidA && /داخل باسم/.test(await A.page.evaluate(() => $("acct").innerText)));
  await A.page.setInputFiles("#files", path.join(FX, "newton.pdf")); await sleep(3000);
  const nid = await A.page.evaluate(() => LIB[0].id);
  await A.page.evaluate(() => { setTool("pen"); }); const bb = await A.page.locator("#pages .pg").first().boundingBox();
  await A.page.mouse.move(bb.x + 80, bb.y + 80); await A.page.mouse.down(); await A.page.mouse.move(bb.x + 220, bb.y + 120, { steps: 6 }); await A.page.mouse.up();
  await A.page.evaluate(() => STUDY.addNote({ text: "ملاحظة من الجهاز الأول", book: cur.id, page: 1 })); await sleep(3500);
  const kv = DBS.kv.get(uidA) || new Map();
  ok("device A: book file uploaded into the user's own folder", DBS.files.has(`${uidA}/${nid}.pdf`), [...DBS.files.keys()]);
  ok("device A: library, annotations and notes synced to the account", kv.has("lib") && kv.has("ann_" + nid) && kv.has("notes"), [...kv.keys()]);

  const B = await device("B");
  ok("device B starts with an empty library", await B.page.evaluate(() => LIB.length) === 0);
  await login(B.page, "student@example.com", false); await sleep(3000);
  const bs = await B.page.evaluate(async id => ({ lib: LIB.map(e => e.id), file: !!(await idbGet(id)), ann: Object.values((await idbGet("ann_" + id)) || {}).flat().length, notes: ((await idbGet("notes")) || []).map(n => n.text) }), nid);
  ok("device B (same account): book downloaded, annotations and notes appear", bs.lib.includes(nid) && bs.file && bs.ann >= 1 && bs.notes.includes("ملاحظة من الجهاز الأول"), bs);
  ok("device B: the synced book opens", await B.page.evaluate(() => !!doc && LIB.length === 1));
  await B.page.evaluate(() => STUDY.addNote({ text: "ملاحظة من الجهاز التاني" })); await sleep(2500);
  await A.page.evaluate(() => CLOUD.sync()); await sleep(2000);
  ok("changes flow back: a note added on B shows up on A after sync", (await A.page.evaluate(async () => ((await idbGet("notes")) || []).map(n => n.text))).includes("ملاحظة من الجهاز التاني"));

  // ===== الإعدادات بتتزامن (من غير مفاتيح API) =====
  await A.page.evaluate(() => { localStorage.setItem("theme", "dark"); localStorage.setItem("srclock", "1"); localStorage.setItem("gkey", "AIza-SECRET-should-not-sync"); }); await sleep(2800);
  await B.page.evaluate(() => CLOUD.sync()); await sleep(2000);
  const setB = await B.page.evaluate(() => ({ theme: localStorage.getItem("theme"), lock: localStorage.getItem("srclock"), key: localStorage.getItem("gkey"), applied: document.documentElement.dataset.theme }));
  ok("settings sync: theme + source-lock chosen on A appear on B (and the theme applies right away)", setB.theme === "dark" && setB.lock === "1" && setB.applied === "dark", setB);
  ok("settings sync never uploads API keys (BYOK stays on the device)", !JSON.stringify([...(DBS.kv.get(uidA) || new Map()).values()]).includes("AIza-SECRET") && !setB.key, setB);

  // ===== كتاب اتمسح على جهاز مايرجعش من التاني =====
  await A.page.setInputFiles("#files", path.join(FX, "biology.pdf")); await sleep(3500);
  const bio = await A.page.evaluate(() => LIB.find(e => e.name === "biology").id);
  await B.page.evaluate(() => CLOUD.sync()); await sleep(3000);
  ok("second book reaches B", await B.page.evaluate(id => LIB.some(e => e.id === id), bio));
  await A.page.evaluate(id => delBook(id), bio); await sleep(3000);
  await B.page.evaluate(() => CLOUD.sync()); await sleep(2500); await A.page.evaluate(() => CLOUD.sync()); await sleep(2500);
  const gone = { A: await A.page.evaluate(id => LIB.some(e => e.id === id), bio), B: await B.page.evaluate(async id => LIB.some(e => e.id === id) || !!(await idbGet(id)), bio), dbg: await B.page.evaluate(async id => ({ lib: LIB.map(e => e.id), f: !!(await idbGet(id)), tomb: await idbGet("deleted"), st: CLOUD.state, err: CLOUD.err }), bio), rk: [...(DBS.kv.get(uidA) || new Map()).keys()], file: DBS.files.has(`${uidA}/${bio}.pdf`), kvLib: ((DBS.kv.get(uidA) || new Map()).get("lib")?.v || []).some(e => e.id === bio) };
  ok("a book deleted on A disappears from B too, and doesn't come back on the next sync (tombstone)", !gone.A && !gone.B && !gone.file && !gone.kvLib, gone);

  // ===== مسح وإنت أوفلاين + تحديث الصفحة: المسح مايضيعش =====
  await A.page.evaluate(() => idbSet("plan:zz", { days: 3 })); await sleep(2800);
  ok("plan uploaded", (DBS.kv.get(uidA) || new Map()).has("plan:zz"));
  await A.ctx.setOffline(true); await A.page.evaluate(() => idbDel("plan:zz")); await sleep(300);
  await A.ctx.setOffline(false); await A.page.reload(); await sleep(2500);
  ok("session restore: after a page reload the user is still signed in (no new login)", await A.page.evaluate(() => CLOUD.user?.id) === uidA); await A.page.evaluate(() => CLOUD.sync()); await sleep(2500);
  ok("a deletion made offline survives a page reload and is uploaded later (not resurrected from the cloud)", !(DBS.kv.get(uidA) || new Map()).has("plan:zz") && !(await A.page.evaluate(() => idbGet("plan:zz"))), [...(DBS.kv.get(uidA) || new Map()).keys()]);
  await A.page.evaluate(() => { $("settings").hidden = true; });

  // ===== كتاب أكبر من حد المزامنة (50): بيفضل على الجهاز، ومايترفعش، ومفيش خطأ مزامنة =====
  { const src = readFileSync(path.join(FX, "newton.pdf")), nl = src.indexOf(10) + 1, mid = Buffer.alloc(51 * 1048576, 120); mid[0] = 37; mid[mid.length - 1] = 10;
    const bp = path.join(os.tmpdir(), "bigsync-" + process.pid + ".pdf"); writeFileSync(bp, Buffer.concat([src.subarray(0, nl), mid, src.subarray(nl)]));
    await A.page.setInputFiles("#files", bp); await sleep(4500); rmSync(bp, { force: true });
    const big = await A.page.evaluate(() => { const e = LIB.find(x => x.size > 50 * 1048576); return e ? { id: e.id, st: CLOUD.state, err: CLOUD.err, toast: document.getElementById("ttoast")?.textContent || "" } : null; });
    ok("a book over the 50 MB sync limit stays on the device (not uploaded), sync keeps working, and the user is told", !!big && !DBS.files.has(`${uidA}/${big.id}.pdf`) && big.st !== "error" && /حد المزامنة|مش هيتزامن|الجهاز ده بس/.test(big.toast + (await A.page.evaluate(() => $("vmsg").innerText))), big);
    if (big) { await A.page.evaluate(id => delBook(id), big.id); await sleep(2500); } }

  // ===== أوفلاين + تعارض: الجهازين عدّلوا في نفس الوقت → الاتنين يتحفظوا (مفيش حاجة بتضيع) =====
  await B.page.evaluate(() => { $("settings").hidden = true; });
  await A.ctx.setOffline(true); await B.ctx.setOffline(true);
  await A.page.evaluate(() => STUDY.addNote({ text: "كتبتها على A وأنا أوفلاين" })); await B.page.evaluate(() => STUDY.addNote({ text: "كتبتها على B وأنا أوفلاين" }));
  await sleep(2500); const offErr = await A.page.evaluate(() => CLOUD.state);
  ok("offline: changes stay on the device and sync reports it's waiting (not silently lost)", offErr === "error" && (await A.page.evaluate(async () => ((await idbGet("notes")) || []).length)) >= 3, offErr);
  await A.ctx.setOffline(false); await sleep(3000); await B.ctx.setOffline(false); await sleep(3500); await A.page.evaluate(() => CLOUD.sync()); await sleep(2500);
  const nA = await A.page.evaluate(async () => ((await idbGet("notes")) || []).map(n => n.text)), nB = await B.page.evaluate(async () => ((await idbGet("notes")) || []).map(n => n.text));
  ok("back online: queued changes upload automatically, and a conflict keeps BOTH devices' notes", ["كتبتها على A وأنا أوفلاين", "كتبتها على B وأنا أوفلاين"].every(t => nA.includes(t) && nB.includes(t)), { nA, nB });

  // ===== فهرس البحث بالمعنى في الحساب (pgvector VectorStore) =====
  const vs = await A.page.evaluate(async id => {
    const V = ["newton", "second", "law", "force", "mass", "acceleration", "photosynthesis", "inertia"], vec = t => V.map(w => (t.toLowerCase().match(new RegExp(w, "g")) || []).length);
    RAG.backend = () => ({ model: () => "test-emb", run: async ts => ts.map(vec) });
    AI.vectors.use("supabase"); await AI.vectors.index(id); const r = await AI.vectors.search("second law force and acceleration", { ids: [id], k: 2 }); AI.vectors.use("local");
    return { list: AI.vectors.list(), top: r[0] && { page: r[0].page, sec: r[0].sec } };
  }, nid);
  ok("cloud VectorStore (pgvector): book indexed to the account and semantic search finds the right page", vs.list.includes("supabase") && vs.top?.page === 2, vs);
  ok("cloud index rows belong only to that user", DBS.chunks.length > 0 && DBS.chunks.every(c => c.user_id === uidA));

  // حساب تاني: مايشوفش حاجة
  const C2 = await device("C");
  await login(C2.page, "other@example.com", true); await sleep(2000);
  ok("another account sees none of the first user's books or notes", await C2.page.evaluate(async () => LIB.length === 0 && !((await idbGet("notes")) || []).length));
  const stolen = await C2.page.evaluate(async p => { const r = await CLOUD.sb.storage.from("books").download(p); return { err: r.error?.message || "", got: !!r.data }; }, `${uidA}/${nid}.pdf`);
  ok("another account can't download the first user's PDF even with the exact path (RLS)", !stolen.got && /not found|security/i.test(stolen.err), stolen);
  const forged = await C2.page.evaluate(async uid => (await CLOUD.sb.from("user_kv").upsert({ user_id: uid, k: "notes", v: [] })).error?.message || "", uidA);
  ok("another account can't overwrite the first user's data (RLS)", /row-level security/.test(forged), forged);

  const vs2 = await C2.page.evaluate(async id => { RAG.backend = () => ({ model: () => "test-emb", run: async ts => ts.map(() => [1, 1, 1, 1, 1, 1, 1, 1]) }); AI.vectors.use("supabase"); return (await AI.vectors.search("second law", { ids: [id], k: 5 })).length; }, nid);
  ok("another account's semantic search never returns the first user's chunks", vs2 === 0, vs2);
  // نسيت كلمة السر
  { const { page, ctx } = await device("R"); await page.click("#acctBtn"); await page.fill("#acEmail", "student@example.com"); await page.click("#acForgot"); await sleep(600);
    ok("forgot password → reset email requested", DBS.resets.includes("student@example.com") && /بعتنالك/.test(await page.evaluate(() => $("acMsg").textContent))); await ctx.close(); }

  // الخروج
  await B.page.click("#acctBtn"); await B.page.click("#acOut"); await sleep(600);
  ok("sign out: no token is sent anymore, local data stays", await B.page.evaluate(() => !CLOUD.token() && LIB.length === 1 && /دخول/.test($("acct").innerText)));

  // حساب تاني على نفس الجهاز: بيانات الحساب الأول ماتترفعش للتاني من غير موافقة
  await B.page.evaluate(() => { window.confirm = () => false; });
  await login(B.page, "other@example.com", false); await sleep(2500);
  const uidO = await B.page.evaluate(() => CLOUD.user?.id), kvO = DBS.kv.get(uidO) || new Map();
  ok("switching accounts on one device: the first account's books/notes are NOT uploaded into the second account when the user says no", !!uidO && !((kvO.get("lib")?.v) || []).some(e => e.id === nid) && ![...DBS.files.keys()].some(p => p.startsWith(uidO + "/")), { keys: [...kvO.keys()], files: [...DBS.files.keys()] });
  await B.page.click("#acctBtn"); await B.page.click("#acOut"); await sleep(600);

  // السيرفر: REQUIRE_AUTH
  const chat = (h = {}) => fetch(`http://127.0.0.1:${port2}/v1/chat`, { method: "POST", headers: { "content-type": "application/json", ...h }, body: JSON.stringify({ system: "x", messages: [{ role: "user", content: "hi" }] }) });
  const r1 = await chat(), j1 = await r1.json();
  ok("server REQUIRE_AUTH: request without a login → 401 auth_required", r1.status === 401 && j1.code === "auth_required", [r1.status, j1]);
  const tokA = await A.page.evaluate(() => CLOUD.token()); const r2 = await chat({ authorization: "Bearer " + tokA });
  ok("server REQUIRE_AUTH: signed-in user's token is accepted (verified with the auth server)", r2.status !== 401, r2.status);
  const r3 = await chat({ authorization: "Bearer forged-token-forged-token-123" });
  ok("server REQUIRE_AUTH: forged token rejected", r3.status === 401, r3.status);
  const h = await (await fetch(`http://127.0.0.1:${port2}/v1/health`)).json();
  ok("health exposes only the public auth config (no secrets)", h.auth?.url && h.auth.anonKey === "anon-public-key" && h.auth.required === true && !/service_role/i.test(JSON.stringify(h)), h.auth);
  // امسح بياناتي من السحابة (بصلاحيات المستخدم نفسه)
  await C2.page.evaluate(() => STUDY.addNote({ text: "ملاحظة الحساب التاني" })); await sleep(2500);
  const uidC = await C2.page.evaluate(() => CLOUD.user.id);
  ok("second account's data exists before wiping", (DBS.kv.get(uidC) || new Map()).size > 0);
  await C2.page.evaluate(() => CLOUD.deleteCloudData()); await sleep(2500);
  ok("after «delete my cloud data» the user is signed out, so nothing gets re-uploaded", await C2.page.evaluate(() => !CLOUD.user) && (DBS.kv.get(uidC) || new Map()).size === 0);
  ok("«delete my cloud data» removes that user's rows, files and index — and nothing of other users", (DBS.kv.get(uidC) || new Map()).size === 0 && (DBS.kv.get(uidA) || new Map()).size > 0 && DBS.files.has(`${uidA}/${nid}.pdf`));
  // مسح الحساب نهائيًا (سيرفر عنده service key)
  const del = (p, tok) => fetch(`http://127.0.0.1:${p}/v1/account/delete`, { method: "POST", headers: { "content-type": "application/json", ...(tok ? { authorization: "Bearer " + tok } : {}) }, body: "{}" });
  const tokA2 = await A.page.evaluate(() => CLOUD.token());
  const d1 = await del(port2, tokA2), j1d = await d1.json();
  ok("account deletion without server admin key → clear 501 'no_admin' (not faked)", d1.status === 501 && j1d.code === "no_admin", [d1.status, j1d]);
  const d2 = await del(port3, tokA2), j2d = await d2.json();
  ok("account deletion (server with service key): files, data and the auth user removed", d2.status === 200 && j2d.ok && !DBS.files.has(`${uidA}/${nid}.pdf`) && !DBS.kv.has(uidA) && ![...DBS.users.values()].some(u => u.id === uidA), [d2.status, j2d, ADMIN]);
  const d3 = await del(port3, tokA2); ok("after deletion the old login token no longer works", d3.status === 401, d3.status);
  ok("no page errors", !errs.length, errs);
} finally { await b.close(); srv.kill(); srv2.kill(); srv3.kill(); authSrv.close(); }
console.log(`\n${pass} passed, ${fail} failed  (Supabase mocked with the same RLS rules)`);
process.exit(fail ? 1 : 0);

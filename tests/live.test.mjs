// ⚠️ اختبار حقيقي (مش mock): بيكلّم محركات الصوت الحقيقية بمفاتيحك. بيشتغل بس لو المفاتيح موجودة.
// المفاتيح بتتقري من environment variables أو من server/.env (عمرها ما بتتطبع).
// التشغيل:  AZURE_SPEECH_KEY=... AZURE_SPEECH_REGION=westeurope node tests/live.test.mjs
// النتيجة: ملفات صوت في tests/output/ عشان تسمعها بودنك — جودة النطق مينفعش تتحكم عليها أوتوماتيك.
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), OUT = path.join(ROOT, "tests", "output");
const env = { ...process.env };
const ef = path.join(ROOT, "server", ".env");
if (existsSync(ef)) for (const line of readFileSync(ef, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const { PROVIDERS } = await import(path.join(ROOT, "server", "tts.js"));
const { handle } = await import(path.join(ROOT, "server", "worker.js"));

const CASES = [
  ["msa", "ar", "الخلية هي الوحدة الأساسية لبناء الكائن الحي، وتتكون من غشاء ونواة وسيتوبلازم."],
  ["egyptian", "ar", "بص يا سيدي، الخلية دي زي البيت بالظبط: الغشاء هو الباب اللي بيتحكم مين يدخل ومين يخرج."],
  ["english", "en", "The mitochondria is the powerhouse of the cell. It produces ATP through cellular respiration."],
  ["mixed", "ar", "الغشاء الخلوي cell membrane بيتحكم في دخول المواد، والميتوكوندريا mitochondria بتنتج الطاقة ATP."],
  ["math", "ar", "لو 3x زائد 5 يساوي 20، يبقى x يساوي 5."]
];
let pass = 0, fail = 0; const skipped = [];
const ok = (n, c, i = "") => { c ? pass++ : fail++; console.log((c ? "✅ " : "❌ ") + n + (c ? "" : "  → " + String(i).slice(0, 300))); };
const configured = Object.keys(PROVIDERS).filter(id => PROVIDERS[id].configured(env));
console.log("🔴 REAL provider test — no mocks. Configured engines: " + (configured.join(", ") || "none"));
if (!configured.length) { console.log("⏭️  SKIPPED: مفيش مفاتيح (AZURE_SPEECH_KEY / ELEVENLABS_API_KEY / OPENAI_API_KEY / PIPER_URL / TTS_OAI_URL)"); process.exit(3); }   // 3 = SKIPPED (مش نجاح ومش فشل) — run-all بيعرضها كـ SKIPPED
mkdirSync(OUT, { recursive: true });
const call = (id, body) => handle(new Request("https://live.test/api/tts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), { ...env, TTS_PROVIDER: id, ALLOWED_ORIGINS: "*" });

for (const id of configured) {
  for (const [name, lang, text] of CASES) {
    const r = await call(id, { text, lang, rate: 1 });
    if (r.status !== 200) { const j = await r.json().catch(() => ({})); ok(`${id} / ${name}: real audio`, false, r.status + " " + (j.error || "")); continue; }
    const buf = Buffer.from(await r.arrayBuffer()), ext = /wav/.test(r.headers.get("content-type")) ? "wav" : "mp3";
    writeFileSync(path.join(OUT, `${id}-${name}.${ext}`), buf);
    ok(`${id} / ${name}: real audio (${(buf.length / 1024).toFixed(0)} KB, voice ${r.headers.get("x-tts-voice")}) → tests/output/${id}-${name}.${ext}`, buf.length > 4000 && /^audio\//.test(r.headers.get("content-type")), buf.length);
  }
  // speed: the same sentence at 0.75× must be clearly longer than at 1.5× (compressed audio ≈ proportional to duration)
  const sz = {};
  for (const rate of [0.75, 1.5]) { const r = await call(id, { text: CASES[0][2], lang: "ar", rate }); sz[rate] = r.status === 200 ? (await r.arrayBuffer()).byteLength : 0; }
  ok(`${id}: speed really applied by the engine (0.75× audio ${sz[0.75]} B > 1.5× audio ${sz[1.5]} B × 1.3)`, sz[0.75] > sz[1.5] * 1.3, JSON.stringify(sz));
}
console.log(`\n${pass} passed, ${fail} failed — اسمع الملفات في tests/output/ للحكم على النطق (عربي فصحى / مصري / English / مختلط / معادلة).`);
process.exit(fail ? 1 : 0);

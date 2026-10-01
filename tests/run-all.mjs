// تشغيل كل الاختبارات بالترتيب وطباعة جدول PASSED / FAILED / SKIPPED حقيقي.
// أي suite بيفشل أو مش قادر يشتغل (زي Playwright مش متسطّب) = FAILED والأمر بيطلع بكود خطأ. SKIPPED بس للاختبار الحقيقي من غير مفاتيح.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const only = process.argv.slice(2);
const SUITES = [
  ["lint", "npx", ["eslint", "."]],
  ["server + TTS + API (unit/integration)", "node", ["tests/server.test.mjs"]],
  ["AI provider fallback chain + /admin panel", "node", ["tests/fallback.test.mjs"]],
  ["browser E2E (PDF, library, voice player, errors)", "node", ["tests/browser.test.mjs"]],
  ["tutor conversation + voice interrupt", "node", ["tests/conversation.test.mjs"]],
  ["study tools (exam, weakness, notes, plan, search, annotations, export, images)", "node", ["tests/study.test.mjs"]],
  ["accounts, sync, isolation, server auth", "node", ["tests/cloud.test.mjs"]],
  ["worksheet: explain-the-lesson teaches instead of solving", "node", ["tests/worksheet.test.mjs"]],
  ["security: real Postgres RLS + pgvector (supabase.sql)", "python3", ["tests/rls.test.py"]],
  ["natural voice via Puter", "node", ["tests/puter-voice.test.mjs"]],
  ["quality: citations, structured output, context", "node", ["tests/quality.test.mjs"]],
  ["large PDFs + processing jobs + mobile", "node", ["tests/scale.test.mjs"]],
  ["whole-site crawl (every control, desktop+mobile) + regressions", "node", ["tests/regress.test.mjs"]],
  ["REAL TTS providers (needs keys)", "node", ["tests/live.test.mjs"]]
].filter(s => !only.length || only.some(o => s[0].includes(o) || s[2].join(" ").includes(o)));
const rows = [];
for (const [name, cmd, args] of SUITES) {
  const t0 = Date.now(); let out = "";
  const code = await new Promise(res => { const p = spawn(cmd, args, { cwd: ROOT, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    p.stdout.on("data", d => { out += d; process.stdout.write(d); }); p.stderr.on("data", d => { out += d; process.stderr.write(d); }); p.on("close", res); p.on("error", e => { out += e.message; res(1); }); });
  const m = out.match(/(\d+) passed, (\d+) failed/g)?.at(-1)?.match(/(\d+) passed, (\d+) failed/);
  const status = code === 3 ? "SKIPPED" : code === 0 ? "PASSED" : "FAILED";
  rows.push({ name, status, checks: m ? `${m[1]} ✓ / ${m[2]} ✗` : name === "lint" ? (code ? "errors" : "clean") : "-", sec: Math.round((Date.now() - t0) / 1000) });
}
console.log("\n==================== TEST REPORT ====================");
for (const r of rows) console.log(`${r.status.padEnd(8)} ${r.checks.padEnd(12)} ${String(r.sec + "s").padStart(5)}  ${r.name}`);
const f = rows.filter(r => r.status === "FAILED").length, s = rows.filter(r => r.status === "SKIPPED").length;
console.log(`\nSuites: ${rows.length - f - s} passed, ${f} failed, ${s} skipped (skipped = NOT verified)`);
process.exit(f ? 1 : 0);

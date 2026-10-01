// تشغيل السيرفر الآمن على أي جهاز/استضافة فيها Node 18+ (بيعرض الموقع كمان على نفس الرابط).
//   1) انسخ server/.env.example لـ server/.env وحط مفاتيحك فيه (الملف ده عمره ما بيتعرض للمتصفح).
//   2) node server/node.mjs      ← افتح http://localhost:8787
//   3) في config.js خلي proxyUrl: "/"
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import worker from "./worker.js";

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "..");
const envFile = path.join(HERE, ".env");
if (existsSync(envFile)) for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".pdf": "application/pdf", ".wasm": "application/wasm" };
const PORT = +process.env.PORT || 8787;

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/v1/") || url.pathname.startsWith("/api/") || url.pathname === "/admin" || url.pathname.startsWith("/admin/")) {
      const chunks = []; let size = 0;
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) for await (const c of req) { size += c.length; if (size > 12e6) { res.writeHead(413).end(); return; } chunks.push(c); }
      const headers = new Headers(); for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
      headers.set("x-real-ip", process.env.TRUST_PROXY === "true" ? String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress : req.socket.remoteAddress || "0");
      headers.delete("cf-connecting-ip");
      const r = await worker.fetch(new Request(url, { method: req.method, headers, body: chunks.length ? Buffer.concat(chunks) : undefined }), process.env, {});
      res.writeHead(r.status, Object.fromEntries(r.headers));
      if (r.body) for await (const c of r.body) res.write(c);
      res.end(); return;
    }
    // ملفات الموقع — مع منع فولدر السيرفر والملفات المخفية (.env)
    let p = decodeURIComponent(url.pathname); if (p.endsWith("/")) p += "index.html";
    const file = path.resolve(ROOT, "." + p);
    if (!file.startsWith(ROOT + path.sep) || file.startsWith(HERE + path.sep) || file === HERE || p.split("/").some(s => s.startsWith("."))) { res.writeHead(404).end("not found"); return; }
    const st = await stat(file).catch(() => null); if (!st?.isFile()) { res.writeHead(404).end("not found"); return; }
    res.writeHead(200, { "content-type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", "cache-control": "no-cache" });
    res.end(await readFile(file));
  } catch (e) { try { res.writeHead(500).end("error"); } catch {} }
}).listen(PORT, () => console.log(`مساعد المذاكرة شغال على http://localhost:${PORT}`));

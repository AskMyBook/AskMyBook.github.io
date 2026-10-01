// ===== عميل سيرفر الـ AI الآمن (اختياري) =====
// كل المفاتيح على السيرفر (environment variables). الموقع بيبعت الطلب بس، ومفيش أي مفتاح في كود الواجهة.
// السيرفر مبيخزّنش كتب ولا محادثات: كتب كل مستخدم فاضلة في متصفحه هو بس (IndexedDB).
(() => {
  const raw = () => (localStorage.getItem("proxy") || (window.TUTOR_CONFIG || {}).proxyUrl || "").trim();
  const base = () => { const r = raw(); return r === "/" ? "" : r.replace(/\/+$/, ""); };
  const on = () => !!raw();
  // الحالة: off (مفيش سيرفر) / checking / ok / down — ولو السيرفر مش متاح بنحاول تاني لوحدنا (٥ث، ١٠ث، ٢٠ث… لحد دقيقة)
  let H = null, HP = null, state = on() ? "checking" : "off", fails = 0, retryT = 0, lastErr = "";
  const emit = () => window.dispatchEvent(new Event("proxy-health"));
  const timeout = (ms, signal) => { const ac = new AbortController(), t = setTimeout(() => ac.abort(Object.assign(new Error("timeout"), { name: "TimeoutError" })), ms);
    signal?.addEventListener("abort", () => ac.abort(signal.reason), { once: true }); return { signal: ac.signal, done: () => clearTimeout(t) }; };
  function schedule() { clearTimeout(retryT); retryT = setTimeout(() => health(true), Math.min(60000, 5000 * 2 ** Math.min(fails - 1, 4))); }
  // قدرات السيرفر: chat / embed / tts / stt
  function health(force) {
    if (!on()) { state = "off"; return Promise.resolve(null); }
    if (H && !force) return Promise.resolve(H);
    if (HP) return HP;
    if (!H) state = "checking";
    const to = timeout(8000);
    return HP = fetch(base() + "/v1/health", { signal: to.signal, cache: "no-store" })
      .then(r => r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status)))
      .then(j => { H = j; state = "ok"; fails = 0; lastErr = ""; clearTimeout(retryT); return j; },
            e => { H = null; state = "down"; fails++; lastErr = e?.name === "TimeoutError" ? "السيرفر مردّش خلال ٨ ثواني" : e?.message || "مش متاح"; schedule(); return null; })
      .finally(() => { to.done(); HP = null; emit(); });
  }
  // طلب فشل على مستوى الشبكة (السيرفر وقع أو النت فصل) → الحالة القديمة متتصدّقش، ونعيد الفحص
  function lost() { if (state === "ok") { H = null; state = "down"; fails = Math.max(fails, 1); emit(); } health(true); }
  addEventListener("online", () => { if (on() && state !== "ok") health(true); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && on() && state === "down") health(true); });

  // لو المستخدم مسجّل دخول (cloud.js): توكنه بيتبعت عشان السيرفر يعرفه (REQUIRE_AUTH وحد الطلبات لكل مستخدم)
  const authH = () => { const t = window.CLOUD?.token?.(); return t ? { authorization: "Bearer " + t } : {}; };
  async function post(path, body, { signal, raw: wantRaw, ms = 60000 } = {}) {
    const to = timeout(ms, signal); let r;
    try { r = await fetch(base() + path, { method: "POST", signal: to.signal, headers: { "content-type": "application/json", ...authH() }, body: JSON.stringify(body) }); }
    catch (e) {
      to.done(); if (signal?.aborted) throw e;
      if (e?.name === "TimeoutError" || to.signal.reason?.name === "TimeoutError") throw Object.assign(new Error("السيرفر اتأخر في الرد"), { status: 504, code: "timeout" });
      lost(); throw Object.assign(new Error("مش قادر أوصل لسيرفر الموقع (" + (e?.message || "network") + ")"), { status: 0, code: "network" });
    }
    to.done();
    if (!r.ok) { let m = "HTTP " + r.status, code = "", rid = r.headers.get("x-request-id") || ""; try { const j = await r.json(); m = j.error || m; code = j.code || ""; rid = j.rid || rid; } catch {} const e = new Error(m); e.status = r.status; e.code = code; e.rid = rid; throw e; }
    return wantRaw ? r : r.json();
  }
  // رد الشات بالـ streaming (SSE موحّد من السيرفر: data: {"t":"..."})
  async function chat({ system, messages, images, max, temperature, onText, signal }) {
    const r = await post("/v1/chat", { system, messages, images, max_tokens: max, temperature, stream: true }, { signal, raw: true, ms: 120000 });
    const rd = r.body.getReader(), dec = new TextDecoder(); let buf = "", out = "";
    for (;;) {
      const { done, value } = await rd.read(); if (done) break;
      buf += dec.decode(value, { stream: true }); let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line.startsWith("data:")) continue; const d = line.slice(5).trim(); if (d === "[DONE]") return out;
        let j; try { j = JSON.parse(d); } catch { continue; }
        if (j.error) throw new Error(j.error);
        if (j.t) { out += j.t; onText?.(out); }
      }
    }
    return out;
  }
  window.PX = { on, base, health, post, chat, authH, cached: () => H, status: () => state, error: () => lastErr, lost };
  if (on()) health();
})();

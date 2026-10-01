// ===== صوت المدرّس: مشغّل الصوت + محادثة صوتية بدون إيدين =====
// الملف ده مبيعرفش أي محرك صوت بالاسم: تحويل النص لصوت كله في طبقة TTS المستقلة (tts.js).
// هنا بس: تنضيف النص للقراءة، المشغّل (تشغيل / إيقاف مؤقت / كمّل / إيقاف / إعادة / سرعة)، والمحادثة الصوتية (الميكروفون).
const HAS_TTS = !!window.speechSynthesis;
const VC = { on: false, speaking: false, waiting: false, rec: null, tok: 0, btn: null, hinted: false };
Object.defineProperty(window, "voiceOn", { get: () => VC.on });
window.VOICE_NOTE = "\n\nإنت دلوقتي في مكالمة صوتية مع الطالب، وكلامك هيتقرأ بصوت عالي. اتكلم زي مدرس صاحبه قاعد جنبه بيحكيله:\n- جمل قصيرة بنفس لهجة الطالب الطبيعية (مصري لو بيتكلم مصري، سعودي/خليجي لو بيتكلم خليجي، فصحى بسيطة لو بيتكلم فصحى، إنجليزي لو بيتكلم إنجليزي)، من ٢ لـ ٤ جمل بس في الدور الواحد، وفكرة واحدة كل مرة.\n- ادخل في المفيد على طول، ونوّع بدايات ردودك ومتبدأش كل مرة بـ «أكيد» أو «بالطبع».\n- متسألش في آخر كل رد. اسأل سؤال قصير واحد بس لما يكون مفيد (بعد ما تشرح حاجة جديدة أو صعبة)، والإجابات القصيرة والمتابعات من غير سؤال.\n- لو رد بكلمة قصيرة (أيوه، كمّل، ماشي، تمام، لا، تاني) كمّل الكلام من آخر نقطة وصلتلها في المحادثة بدل ما تبدأ من الأول. ولو قال مش فاهم اشرحها بطريقة تانية ومثال جديد أبسط.\n- اتكلم زي إنسان حقيقي مش زي روبوت: جمل بتتنفس، وعلّق على إحساس الطالب (فرحان، تعبان، مش فاهم) بحس، وابعد عن الجمل الرسمية والمقالية.\n- افتكر اللي اتقال قبل كده في المحادثة وابني عليه.\n- كلام الطالب جاي من التعرف على الصوت فممكن فيه كلمات غلط أو ناقصة: خمّن قصده من سياق المذاكرة وجاوب من غير ما تقوله إن فيه غلط. لو مفهمتش خالص اسأله سؤال واحد قصير.\n- من غير إيموجي ولا قوايم ولا جداول ولا رموز ولا ترقيم ولا ماركداون، وبدون ذكر أرقام الصفحات. الكلمات الإنجليزي سيبها زي ما هي.";
const svg = d => '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
const SPK = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>';
const ICO = { on: svg(SPK + '<path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>'), off: svg(SPK + '<line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>'), stop: svg('<rect x="6" y="6" width="12" height="12" rx="2"/>'), spin: '<span class="dot"></span>',
  pause: svg('<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>'), play: svg('<polygon points="6 4 20 12 6 20 6 4"/>'), replay: svg('<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>') };
const autoSpeak = () => localStorage.getItem("autospeak") === "1";

// حالة المحادثة الصوتية: سامعك / بفكّر / بتكلم — بتظهر فوق مربع الكتابة مع أنيميشن خفيف (CSS بس، مفيش حمل على المعالج)
const VLABEL = { listening: "سامعك… اتكلم", thinking: "بفكّر…", speaking: "بتكلم… دوس الدايرة عشان تقاطعني", paused: "متوقف مؤقتًا — دوس الدايرة عشان أكمّل" };
function setStatus(s) {
  const st = !s ? "" : /سامع/.test(s) ? "listening" : /بفكر|بفكّر/.test(s) ? "thinking" : /بتكلم/.test(s) ? "speaking" : /متوقف/.test(s) ? "paused" : "idle";
  $("vstatus").hidden = !s; $("vstatus").dataset.st = st; document.body.dataset.voice = st; if (s) $("vtext").textContent = VLABEL[st] || s;
}

// ----- تنضيف النص قبل القراءة -----
// النسخة المسموعة من الرد: من غير رموز ماركداون، العناوين جمل، الجداول صفوف مقروءة، والإجابات المخفية متتقريش
function speechify(t) {
  t = String(t).replace(/_⏹[^_]*_/g, "").replace(/\r/g, "");
  t = t.replace(/^\s*#{1,6}\s*(?:[^\s\w\u0600-\u06FF]+\s*)?(الإجابات|الاجابات|الإجابة|الحلول|Answers?|Solutions?)\s*#*\s*$[\s\S]*/m, "");
  t = t.replace(/(?:^\s*\|.*\|\s*$\n?){2,}/gm, blk => {   // جدول → «العمود: القيمة» لكل صف
    const rows = blk.trim().split("\n").filter(r => !/^\s*\|[\s:|-]+\|\s*$/.test(r)).map(r => r.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim()));
    if (rows.length < 2) return rows.map(r => r.join("، ")).join(". ") + ".\n";
    const [hd, ...body] = rows; return body.map(r => (r[0] ? r[0] + ": " : "") + r.slice(1).map((c, i) => (hd[i + 1] ? hd[i + 1] + " " : "") + c).join("، ")).join(".\n") + ".\n";
  });
  return t.replace(/<[^>]+>/g, " ")
    .replace(/^\s*#{1,6}\s*(.+?)\s*#*\s*$/gm, "$1:")                                // عنوان → «العنوان: …»
    .replace(/^\s*\*\*([^*]{2,60}?)\*\*\s*[:：]\s*/gm, "$1: ")
    .replace(/^\s*([0-9٠-٩]{1,2})[.)]\s+/gm, "$1، ")                                  // «1. » → «1، »
    .replace(/\$\$?([^$]+)\$\$?/g, (m, x) => x.replace(/\\(frac)\{([^}]*)\}\{([^}]*)\}/g, "$2 على $3").replace(/\\times/g, " في ").replace(/\\cdot/g, " في ").replace(/\^2\b/g, " تربيع").replace(/\\[a-zA-Z]+/g, " ").replace(/[{}]/g, ""))
    .replace(/\s*(->|→|=>)\s*/g, " يعني ").replace(/💡\s*من عندي:?/g, "ومن عندي: ");
}
// الرموز الرياضية بتتقري كلام بلغة الجملة نفسها (3x + 5 = 20 → «3x زائد 5 يساوي 20»)
const MATH = { ar: { "=": " يساوي ", "+": " زائد ", "-": " ناقص ", "×": " في ", "*": " في ", "÷": " على ", "/": " على ", "%": " في المية", "^2": " تربيع", "^3": " تكعيب", "^": " أس ", "√": "جذر ", "≈": " تقريبًا ", "≠": " لا يساوي ", "≤": " أصغر من أو يساوي ", "≥": " أكبر من أو يساوي ", "<": " أصغر من ", ">": " أكبر من " },
  en: { "=": " equals ", "+": " plus ", "-": " minus ", "×": " times ", "*": " times ", "÷": " divided by ", "/": " over ", "%": " percent", "^2": " squared", "^3": " cubed", "^": " to the power of ", "√": "square root of ", "≈": " approximately ", "≠": " is not equal to ", "≤": " is less than or equal to ", "≥": " is greater than or equal to ", "<": " is less than ", ">": " is greater than " } };
function mathSpeak(t) {
  return t.replace(/\.{3,}|…/g, "، ").split(/(?<=[.!?؟])\s+/).map(sen => {
    const L = MATH[(sen.match(/[A-Za-z]{2,}/g) || []).join("").length > (sen.match(/[؀-ۿ]/g) || []).length ? "en" : "ar"];
    const opd = "(?:[0-9٠-٩]+(?:[.,][0-9٠-٩]+)*[a-zA-Z]?|\\b[a-zA-Z]\\b|\\))";   // رقم، 3x، x، أو قوس
    return sen.replace(/([0-9٠-٩]+(?:[.,][0-9]+)?)\s*%/g, "$1" + L["%"])
      .replace(/√\s*/g, L["√"])
      .replace(/\^\s*2\b/g, L["^2"]).replace(/\^\s*3\b/g, L["^3"]).replace(/\^\s*/g, L["^"])
      .replace(/\s*([=+×÷≈≠≤≥])\s*/g, (m, op) => L[op])                                                  // رموز واضحة: دايمًا
      .replace(new RegExp("(" + opd + ")\\s*([-*/<>])\\s*(?=[0-9٠-٩a-zA-Z(√])", "g"), (m, a, op) => a + L[op]);   // - * / < > بس بين أرقام/متغيرات
  }).join(" ");
}
function cleanForSpeech(t) {
  return mathSpeak(speechify(t)
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, "").replace(/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, ""))   // لينكات وإيميلات مبتتقريش
    .replace(/```[\s\S]*?```/g, "").replace(/\[\[[\s\S]*?\]\]/g, "").replace(/\[\d{1,2}(?:\s*[،,]\s*\d{1,2})*\]/g, "")
    .replace(/\([^)]*(?:صفحة|ص\s?\d|page|p\.)[^)]*\)/gi, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{20E3}]/gu, "")
    .replace(/^\s*[-•]\s+/gm, "").replace(/^\s*---+\s*$/gm, "")
    .replace(/\/[^\/\s][^\/]{1,30}\//g, "")
    .replace(/\(\s*(?:n|v|adj|adv|prep|conj|pron)\b[^)]*\)/gi, "")
    .replace(/\s[-–—]\s/g, "، ").replace(/[«»“”"]/g, "")
    .replace(/[*_`#>|~]/g, "")
    .replace(/\s*\n+\s*/g, ". ").replace(/\.\s*\./g, ".").replace(/\s{2,}/g, " ").replace(/\s+([.،,:])/g, "$1").replace(/([?؟!:])\./g, "$1").trim().replace(/\s{2,}/g, " ").trim();
}
// المتصفحات بتقطع الجمل الطويلة، فبنقسم الكلام لأجزاء صغيرة
function splitChunks(t, max = 170) {
  const parts = t.match(/[^.!?؟…:]+[.!?؟…:]*\s*/g) || [t], out = []; let buf = "";
  const push = s => { s = s.trim(); if (s) out.push(s); };
  for (let p of parts) {
    while (p.length > max) { let i = p.lastIndexOf("،", max); if (i < 40) i = p.lastIndexOf(" ", max); if (i < 40) i = max; if (buf) { push(buf); buf = ""; } push(p.slice(0, i + 1)); p = p.slice(i + 1); }
    if ((buf + p).length > max) { push(buf); buf = p; } else buf += p;
  }
  push(buf); return out;
}

// ----- المشغّل -----
// طابور أجزاء (جمل قصيرة): الجزء الأول بيتولّد ويشتغل على طول والباقي بيتجهّز في الخلفية (chunked).
// لو المحرك فشل في نص الكلام، المشغّل بيكمّل من نفس الجملة بالمحرك اللي بعده — والصفحة عمرها ما بتقع بسبب الصوت.
const AUD = new Audio();
const uRate = () => +TTS.settings().rate || 1;
const sttOK = () => !!(window.PX?.on() && PX.cached()?.stt);
const RATES = TTS.RATES;
function wavFromPCM(pcm, rate = 24000) {
  const h = new DataView(new ArrayBuffer(44)), w = (o, s) => [...s].forEach((c, i) => h.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); h.setUint32(4, 36 + pcm.byteLength, true); w(8, "WAVEfmt "); h.setUint32(16, 16, true); h.setUint16(20, 1, true); h.setUint16(22, 1, true);
  h.setUint32(24, rate, true); h.setUint32(28, rate * 2, true); h.setUint16(32, 2, true); h.setUint16(34, 16, true); w(36, "data"); h.setUint32(40, pcm.byteLength, true);
  return new Blob([h, pcm], { type: "audio/wav" });
}
// genRate = السرعة اللي الصوت اتولّد بيها؛ التشغيل بيكمّل الباقي عشان يطلع بالسرعة المختارة بالظبط
AUD.preservesPitch = AUD.mozPreservesPitch = AUD.webkitPreservesPitch = true;   // التسريع ميغيّرش طبقة الصوت
let AUD_GEN = 1;
const playRate = () => Math.min(4, Math.max(0.25, uRate() / (AUD_GEN || 1)));
function playUrl(url, genRate = 1) {
  return new Promise((res, rej) => {
    AUD_GEN = genRate; AUD.src = url; AUD.defaultPlaybackRate = AUD.playbackRate = playRate();
    let lastT = -1, still = 0; const dog = setInterval(() => {   // حارس: لو الصوت علّق (مش متوقف مؤقتًا ومش بيتحرك) ٨ ثواني → نكمّل
      if (AUD.paused || PS?.paused) { still = 0; return; } if (AUD.currentTime === lastT) { if (++still >= 8) done(new Error("التشغيل علّق")); } else { still = 0; lastT = AUD.currentTime; } }, 1000);
    const done = e => { clearInterval(dog); AUD._stop = null; AUD.onended = AUD.onerror = null; e ? rej(e) : res(); };
    AUD._stop = () => done();
    // الأحداث لازم تبقى تبع الملف ده بالظبط: الملف القديم (اللي اتحرّر لما وقفنا أو بدأنا رد جديد) ممكن يبعت error متأخر
    const mine = () => AUD.src === url;
    AUD.onended = () => { if (mine()) done(); };
    AUD.onerror = () => { if (mine()) done(new Error("الملف الصوتي مشتغلش")); };
    // لو الطالب داس «إيقاف مؤقت» في نفس لحظة بداية الصوت، المتصفح بيرفض play() بـ AbortError — ده مش عطل:
    // الصوت فاضل مستني، و«كمّل» بتشغّله من نفس المكان
    AUD.play().catch(e => { if (e?.name === "AbortError" && PS?.paused) return; done(e); });
  });
}
const revoke = u => { if (typeof u === "string" && u.startsWith("blob:")) try { URL.revokeObjectURL(u); } catch {} };
const dropSeg = sg => sg?.p?.then(r => revoke(r?.url || r), () => {});   // نحرّر الصوت اللي اتولّد ومش هيتشغّل
// رسالة صغيرة مؤقتة (مش في الشات) لأي مشكلة في الصوت
function toast(m) {
  let t = $("ttoast"); if (!t) { t = document.createElement("div"); t.id = "ttoast"; t.setAttribute("role", "status"); t.setAttribute("aria-live", "polite"); document.body.append(t); }
  const keep = t.classList.contains("on") ? (t._msgs || []) : []; t._msgs = [...keep.filter(x => x !== m), m].slice(-3);   // رسايل ورا بعض بتتجمع (مش بتمسح بعض)
  t.textContent = t._msgs.join("\n"); t.classList.add("on"); clearTimeout(t._h); t._h = setTimeout(() => { t.classList.remove("on"); t._msgs = []; }, 7000);
}
let PS = null;
const ST_MSG = { load: "بيولّد الصوت…", paused: "متوقف مؤقتًا", play: "", idle: "" };
function setBtn(b, st, msg) {
  if (!b) return; const c = b._ctl; b.dataset.st = st;
  b.classList.toggle("on", st === "play" || st === "load"); b.classList.toggle("ld", st === "load");
  b.innerHTML = st === "load" ? ICO.spin : st === "play" ? '<span class="bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>' + ICO.pause : st === "paused" ? ICO.play : ICO.on;
  b.title = { load: "بيولّد الصوت…", play: "إيقاف مؤقت", paused: "كمّل", idle: "اسمع الشرح" }[st]; b.setAttribute("aria-label", b.title);
  if (st !== "idle") b._played = true;
  if (c) { const act = st !== "idle"; c.stop.hidden = !act; c.replay.hidden = !b._played; if (c.msg) c.msg.textContent = msg ?? ST_MSG[st]; }
}
function makeSegs(ss, text) {
  const p = ss.prov; if (!p || !text.trim()) return [];
  return TTS.plan(text, p, { first: !ss.segs.length }).map(sg => p.kind === "speech" ? { ...sg, utt: true } : { ...sg, get: () => TTS.synth(p, sg, ss.ac.signal) });
}
const pre = sg => { if (!sg.p) { sg.p = sg.get(); sg.p.catch(() => {}); } return sg.p; };
function watchProgress(ss) {   // أول تشغيل لـ «كريم»: نسبة تحميل الموديل على الزرار
  ss.unprog?.(); ss.unprog = ss.prov?.onProgress?.(pc => { if (ss.btn?.dataset.st === "load") setBtn(ss.btn, "load", "بيحمّل صوت كريم " + Math.round(pc) + "% (أول مرة بس)"); });
}
function begin({ btn = null, onend = null } = {}) {
  stopSpeak();
  const ss = { tok: ++VC.tok, btn, onend, prov: TTS.current(), segs: [], i: 0, closed: false, paused: false, used: 0, text: "", ac: new AbortController() };
  PS = ss; VC.speaking = true; if (btn) { VC.btn = btn; setBtn(btn, "load"); }
  if (VC.on) setStatus("🔊 بتكلم...");
  watchProgress(ss); run(ss); return ss;
}
function feed(ss, clean) { if (ss.tok !== VC.tok || !clean) return; ss.segs.push(...makeSegs(ss, clean)); ss.wake?.(); }
function closeS(ss) { ss.closed = true; ss.wake?.(); }
// نص بيوصل أول بأول (المحادثة الصوتية / القراءة التلقائية اللي الطالب شغّلها بنفسه): بنقرا كل جملة أول ما تكمل
function pushRaw(ss, raw, final) {
  if (ss.tok !== VC.tok) return; raw = String(raw || ""); if (raw.length < ss.used) ss.used = 0;
  const rest = raw.slice(ss.used); if (!rest) return; let cutAt = -1;
  if (final) cutAt = rest.length;
  else {
    const re = /[.!?؟…\n:؛](?=\s)/g; let m; while ((m = re.exec(rest))) cutAt = m.index + 1;
    if (cutAt < 0 && !ss.segs.length && rest.length > 240) { const c = Math.max(rest.lastIndexOf("،", 260), rest.lastIndexOf(",", 260)); if (c > 80) cutAt = c + 1; }
    const minLen = !ss.segs.length ? 25 : ss.prov?.id === "server" ? 350 : 1;   // السيرفر: أجزاء كبيرة = طلبات أقل (حد الطلبات في الدقيقة)
    if (cutAt < minLen) return;
  }
  if (cutAt <= 0) return;
  const piece = rest.slice(0, cutAt); ss.used += cutAt; feed(ss, cleanForSpeech(piece));
}
async function run(ss) {
  if (!ss.prov) { toast("⚠️ مفيش محرك صوت متاح على الجهاز ده. الشرح المكتوب موجود زي ما هو."); ss.closed = true; }
  for (;;) {
    if (ss.tok !== VC.tok) return;
    if (ss.i >= ss.segs.length) { if (ss.closed) break; await new Promise(r => ss.wake = r); ss.wake = null; continue; }
    const sg = ss.segs[ss.i];
    if (!sg.utt) pre(sg);   // الجزء الحالي الأول، وبعدين نجهّز الاتنين اللي بعده
    for (let j = ss.i + 1; j < Math.min(ss.segs.length, ss.i + 3); j++) if (!ss.segs[j].utt) pre(ss.segs[j]);
    let url = null, gen = 1, meta = null;
    if (!sg.utt) { try { meta = await pre(sg); url = meta?.url || meta; gen = meta?.rate || 1; } catch (e) { if (ss.tok !== VC.tok) return;
      if (e?.status === 429 && ss.prov?.id === "server" && (sg.tries = (sg.tries || 0) + 1) <= 3) {   // حد الطلبات: نستنى ونجرّب تاني بنفس الصوت بدل ما نغيّره
        sg.p = null; setBtn(ss.btn, "load", "لحظة… بنستنى حد الطلبات"); await new Promise(r => setTimeout(r, 4000 * sg.tries)); continue; }
      fallback(ss, e); continue; } }
    if (ss.tok !== VC.tok) { revoke(url); return; }
    while (ss.paused) { await new Promise(r => ss.unpause = r); ss.unpause = null; if (ss.tok !== VC.tok) { revoke(url); return; } }
    setBtn(ss.btn, "play"); if (VC.on) bargeIn();
    if (meta?.fallback && !ss.srvWarned) { ss.srvWarned = true; toast("ℹ️ محرك الصوت الأساسي على السيرفر مشتغلش (" + meta.fallback.slice(0, 120) + ") — السيرفر كمّل بـ " + (meta.provider || "محرك تاني") + "."); }
    try { if (url) await playUrl(url, gen); else { ss.respeak = false; await TTS.speakWith(ss.prov, sg); } }
    catch (e) { revoke(url); sg.p = null;   // لو الجزء ده هيتعاد، يتولّد تاني (الملف القديم اتحرّر)
      if (ss.tok !== VC.tok) return; fallback(ss, e); continue; }
    revoke(url);
    if (ss.tok !== VC.tok) return;
    if (!ss.okOnce) { ss.okOnce = true; TTS.played(ss.prov, meta || { voice: TTS.voiceFor(ss.prov, sg.l) }); }
    if ((ss.paused || ss.respeak) && sg.utt) { ss.respeak = false; continue; }   // صوت المتصفح: اتوقف أو السرعة اتغيّرت في نص الجملة → نعيدها من أولها
    ss.i++;
  }
  if (ss.tok !== VC.tok) return;
  stopBI(); ss.unprog?.(); VC.speaking = false; PS = null; if (ss.btn) { setBtn(ss.btn, "idle"); if (VC.btn === ss.btn) VC.btn = null; }
  ss.onend?.();
}
// محرك وقع: نكمّل من نفس الجملة بالمحرك اللي بعده (بدون ما نعيد اللي اتقال)
function fallback(ss, e) {
  if (e?.name === "AbortError") return;
  const bad = ss.prov, why = String(e?.message || e || "خطأ").replace(/^NOSUPPORT:\s*/, "").slice(0, 90);
  console.warn("TTS:", bad?.id, why);
  if (!bad || bad.fallbackOnly) { ss.i++; if (!ss.warned) { ss.warned = true; toast("⚠️ الصوت مشتغلش (" + why + "). الشرح المكتوب موجود زي ما هو."); } return; }
  TTS.markDown(bad.id, e);
  if (e?.code === "auth" || /المفتاح غلط/.test(why)) toast("⚠️ مفتاح محرك الصوت على السيرفر غلط أو منتهي — راجع AZURE_SPEECH_KEY (أو مفتاح المحرك) في إعدادات السيرفر.");
  const next = TTS.after(bad.id);
  if (!next || next === bad) { ss.segs.length = ss.i; ss.closed = true; toast("⚠️ الصوت مشتغلش (" + why + "). الشرح المكتوب موجود زي ما هو."); return; }
  ss.prov = next; watchProgress(ss);
  if (e?.code !== "signin") toast(`ℹ️ ${bad.label} مشتغلش (${why}) — كمّلت بـ ${next.label}.`);
  const rest = ss.segs.slice(ss.i).map(x => x.t).join(" "); ss.segs.slice(ss.i).forEach(dropSeg); ss.segs.length = ss.i; ss.segs.push(...makeSegs(ss, rest)); if (ss.btn && ss.btn.dataset.st !== "paused") setBtn(ss.btn, "load");
}
function stopSpeak() {
  stopBI(); VC.tok++; VC.speaking = false; const ss = PS; PS = null; ss?.ac?.abort(); ss?.unprog?.(); ss?.segs.slice(ss.i).forEach(dropSeg);   // الصوت القديم ميكمّلش ويتحرّر من الذاكرة
  if (ss?.btn) setBtn(ss.btn, "idle"); if (VC.btn) { setBtn(VC.btn, "idle"); VC.btn = null; }
  try { AUD.pause(); } catch {} const st = AUD._stop; AUD._stop = null; st?.();
  if (HAS_TTS) speechSynthesis.cancel();
  ss?.wake?.(); ss?.unpause?.();
}
function pauseSpeak() { const ss = PS; if (!ss || ss.paused) return; ss.paused = true; try { if (!AUD.paused) AUD.pause(); } catch {} if (HAS_TTS && (speechSynthesis.speaking || speechSynthesis.pending)) speechSynthesis.cancel(); setBtn(ss.btn, "paused"); if (VC.on) setStatus("⏸ متوقف مؤقتًا"); }
function resumeSpeak() { const ss = PS; if (!ss || !ss.paused) return; ss.paused = false; setBtn(ss.btn, "play"); if (AUD._stop && AUD.paused && !AUD.ended) { AUD.playbackRate = playRate(); AUD.play().catch(() => {}); } ss.unpause?.(); if (VC.on) { setStatus("🔊 بتكلم..."); bargeIn(); } }
function setRate(r) {
  TTS.set({ rate: r }); try { AUD.playbackRate = playRate(); } catch {}   // اللي شغال دلوقتي بيتظبط على طول، والجاي بيتولّد بالسرعة الجديدة
  if (PS && PS.prov?.kind === "speech" && !PS.paused && HAS_TTS && speechSynthesis.speaking) { PS.respeak = true; speechSynthesis.cancel(); }   // صوت المتصفح: نعيد الجملة بالسرعة الجديدة
  if (PS) PS.segs.slice(PS.i + 1).forEach(sg => { if (sg.p && !sg.utt) { dropSeg(sg); sg.p = null; } });   // الأجزاء اللي لسه متشغّلتش تتولّد تاني بالسرعة الجديدة (نطق طبيعي مش تسريع)
  const sel = $("vrate"); if (sel) sel.value = String(r);
  document.querySelectorAll(".vspd").forEach(b => b.textContent = r + "×");
}
// الصوت مبيبدأش غير لما الطالب يطلبه: زرار «اسمع» تحت الرد، أو القراءة التلقائية / المحادثة الصوتية لو هو اللي شغّلها
function speak(text, { btn, onend } = {}) {
  const clean = cleanForSpeech(text); if (!clean) { stopSpeak(); onend?.(); return; }
  const ss = begin({ btn, onend }); ss.text = text; feed(ss, clean); closeS(ss);
  puterHint(ss);
}

// أول مرة الطالب يسمع بـ«كريم»: نعرّفه (مرة واحدة بس) إن فيه صوت طبيعي أحلى ببلاش لو سجّل دخول Puter
function puterHint(ss) {
  const PT = TTS.get("puter"); if (!PT || ss.prov?.id === "puter" || ss.prov?.id === "server" || PT.state() === true || localStorage.getItem("tts.puter") === "1" || location.protocol === "file:") return;
  try { if (localStorage.getItem("tts.puterHint")) return; localStorage.setItem("tts.puterHint", "1"); } catch { return; }
  toast("💡 عايز صوت أوضح وأطبع (ElevenLabs)؟ سجّل دخول Puter مجانًا — من ⚙️ ← الصوت ← «صوت أوضح».");
}
function stopBtn(b) { setBtn(b, "idle"); if (VC.btn === b) VC.btn = null; }

window.voiceSpeak = (t, o) => speak(t, o);
// أزرار الصوت تحت كل رد: اسمع / إيقاف مؤقت / كمّل — إيقاف — إعادة — السرعة
window.voiceDecorate = (d, text) => {
  if (!text) return;
  let bar = d.querySelector(":scope > .acts"); if (!bar) { bar = document.createElement("div"); bar.className = "acts"; d.append(bar); }
  const wrap = document.createElement("div"); wrap.className = "vctl";
  const mk = (cls, html, title) => { const x = document.createElement("button"); x.type = "button"; x.className = cls; x.innerHTML = html; x.title = title; x.setAttribute("aria-label", title); return x; };
  const b = mk("spk", ICO.on, "اسمع الشرح"), stop = mk("spk x", ICO.stop, "إيقاف"), replay = mk("spk x", ICO.replay, "إعادة من الأول"), spd = mk("spk x vspd", uRate() + "×", "سرعة الكلام (0.75× / 1× / 1.25× / 1.5×)"); spd.dir = "ltr";
  const msg = document.createElement("span"); msg.className = "vmsg"; msg.setAttribute("aria-live", "polite");
  stop.hidden = replay.hidden = true; b._ctl = { wrap, stop, replay, msg }; b._text = text; b.dataset.st = "idle";
  b.onclick = () => { if (PS && PS.btn === b) { if (b.dataset.st === "paused") resumeSpeak(); else pauseSpeak(); } else speak(b._text, { btn: b }); };
  stop.onclick = () => stopSpeak();
  replay.onclick = () => speak(b._text, { btn: b });
  spd.onclick = () => { const r = uRate(), i = RATES.findIndex(x => x >= r - 0.01); setRate(RATES[(i + 1) % RATES.length]); };
  wrap.append(b, stop, replay, spd, msg); bar.append(wrap); d._spk = b; window.addCopy?.(d);
};
// قراءة الرد وهو لسه بيتكتب (المحادثة الصوتية أو القراءة التلقائية): الصوت يبدأ من أول جملة
window.voiceStreamStart = () => {
  if (!(VC.on || autoSpeak())) return null;
  const ss = begin({});
  return {
    push(raw) { pushRaw(ss, raw, false); },
    end(raw, node) {
      const resume = () => { VC.waiting = false; if (VC.on) listen(); };
      if (ss.tok !== VC.tok) { resume(); return; }
      pushRaw(ss, raw, true); ss.text = raw; ss.onend = resume;
      if (!VC.on && node?._spk) { ss.btn = node._spk; ss.btn._text = raw; VC.btn = ss.btn; setBtn(ss.btn, ss.paused ? "paused" : "play"); }
      closeS(ss);
    },
    abort() { if (ss.tok === VC.tok) stopSpeak(); }
  };
};

// ----- بعد ما الرد يجهز -----
window.voiceAfter = (a, node) => {
  const resume = () => { VC.waiting = false; if (VC.on) listen(); };
  if (!a || /^⏹/.test(a)) { resume(); return; }
  if (/^(⚠️|حصل خطأ|خطأ)/.test(a)) { if (VC.on) talkStop(); return; }
  if (VC.on || autoSpeak()) speak(a, { btn: VC.on ? null : node?._spk, onend: resume }); else VC.waiting = false;
};

// ----- محادثة صوتية بدون إيدين -----
// تسجيل صوت وإرساله لسيرفر الموقع (لو المتصفح مفيهوش تعرّف على الكلام، زي Firefox). بيقف لوحده بعد ثانية سكوت.
async function recordOnce({ vad = true, max = 20000, onStart } = {}) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const mr = new MediaRecorder(stream), parts = []; mr.ondataavailable = e => e.data.size && parts.push(e.data);
  const ac = new (window.AudioContext || window.webkitAudioContext)(), an = ac.createAnalyser(); ac.createMediaStreamSource(stream).connect(an); an.fftSize = 1024;
  const buf = new Float32Array(an.fftSize); let spoke = false, quietSince = 0; const t0 = Date.now();
  const done = new Promise(res => { mr.onstop = res; });
  const ctl = { stop: () => { try { if (mr.state !== "inactive") mr.stop(); } catch {} } }; onStart?.(ctl);
  mr.start(250);
  const iv = setInterval(() => {
    an.getFloatTimeDomainData(buf); let e = 0; for (const x of buf) e += x * x; const rms = Math.sqrt(e / buf.length), now = Date.now();
    if (rms > 0.02) { spoke = true; quietSince = 0; } else if (spoke && !quietSince) quietSince = now;
    if ((vad && spoke && quietSince && now - quietSince > 1100) || now - t0 > max || (vad && !spoke && now - t0 > 9000)) ctl.stop();
  }, 100);
  await done; clearInterval(iv); stream.getTracks().forEach(t => t.stop()); ac.close().catch(() => {});
  if (!spoke && vad) return "";
  const blob = new Blob(parts, { type: mr.mimeType || "audio/webm" }); if (blob.size < 1500) return "";
  const r = await fetch(PX.base() + "/v1/stt?lang=" + encodeURIComponent(micLang), { method: "POST", headers: { "content-type": blob.type, ...(PX.authH?.() || {}) }, body: blob });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "HTTP " + r.status); return (j.text || "").trim();
}
function listenServer() {
  VC.rec = { abort: () => {} }; setStatus("🎙️ سامعك... اتكلم");
  recordOnce({ onStart: c => { VC.rec = { abort: c.stop }; } }).then(t => {
    VC.rec = null; if (!VC.on) return;
    if (t) { VC.waiting = true; setStatus("🤔 بفكر..."); $("q").value = t; $("form").requestSubmit(); } else setTimeout(listen, 300);
  }).catch(e => { VC.rec = null; talkStop(); add("a", "⚠️ الميكروفون مشتغلش (" + e.message + ")."); });
}
// ----- المقاطعة وهو بيتكلم: «استنى» توقّف الصوت فورًا، و«كمّل» تكمّل من نفس المكان -----
// مايك تاني صغير شغال بس وقت الكلام، وبيسمع كلمة الوقوف لوحدها (عشان صدى صوت المدرّس نفسه ميوقّفوش)
const VSTOP = /^(استني|استنا|استني شويه|استني لحظه|وقف|وقفي|وقف شويه|بس|بس بس|اسكت|لحظه|ثانيه|ثانيه واحده|كفايه|stop|wait|hold on|pause|one sec|one second)$/;
const VGO = /^(كمل|كملي|كمل كلامك|كمل يلا|يلا كمل|تابع|يلا|ماشي كمل|اه كمل|ايوه كمل|continue|go on|resume|go ahead|keep going)$/;
const vnorm = t => norm(String(t || "")).replace(/[.!؟?،,؛:]+/g, " ").replace(/\s+/g, " ").trim();
window.voiceCtl = { speaking: () => VC.speaking && !!PS, paused: () => !!PS?.paused, pause: () => pauseSpeak(), resume: () => resumeSpeak(), isStop: t => VSTOP.test(vnorm(t)), isGo: t => VGO.test(vnorm(t)) };
let BI = null;
function stopBI() { const r = BI; BI = null; if (r) { r.onend = r.onresult = r.onerror = null; try { r.abort(); } catch {} } }
function bargeIn() {
  if (!SR || !VC.on || BI || VC.rec || !PS || PS.paused) return;
  let r; try { r = new SR(); } catch { return; } BI = r; r.lang = micLang; r.continuous = true; r.interimResults = true;
  r.onresult = e => { const x = e.results[e.results.length - 1]; if (!x || !VSTOP.test(vnorm(x[0].transcript))) return;
    stopBI(); pauseSpeak(); setStatus("⏸ وقفت — قول «كمّل» أو اسأل سؤالك"); VC.waiting = false; listen(); };
  r.onerror = e => { if (e.error === "not-allowed" || e.error === "service-not-allowed") { r.onend = null; BI = null; } };
  r.onend = () => { if (BI !== r) return; BI = null; if (VC.on && PS && !PS.paused && VC.speaking) setTimeout(bargeIn, 250); };
  try { r.start(); } catch { BI = null; }
}
function listen() {
  if (!VC.on || (VC.speaking && !PS?.paused) || VC.waiting || VC.rec) return;
  stopBI();
  if (!SR) { if (sttOK()) listenServer(); return; }
  const r = new SR(); VC.rec = r; r.lang = micLang; r.interimResults = true; r.continuous = false; let fin = "";
  setStatus("🎙️ سامعك... اتكلم");
  r.onresult = e => { let f = "", t = ""; for (const x of e.results) { t += x[0].transcript; if (x.isFinal) f += x[0].transcript; } fin = f; $("q").value = t; };
  r.onerror = e => {
    if (e.error === "not-allowed" || e.error === "service-not-allowed") { talkStop(); add("a", "⚠️ اسمح للمتصفح باستخدام الميكروفون من أيقونة القفل جنب الرابط."); }
  };
  r.onend = () => {
    VC.rec = null; if (!VC.on) return; const t = (fin || $("q").value).trim();
    if (PS?.paused && t) {   // الصوت واقف بـ «استنى»: «كمّل» = كمّل من نفس المكان، وأي سؤال تاني = الشرح القديم يقف والسؤال يتبعت
      $("q").value = "";
      if (VGO.test(vnorm(t))) { resumeSpeak(); return; }
      if (VSTOP.test(vnorm(t))) { setTimeout(listen, 250); return; }
      stopSpeak();
    }
    if (t) { VC.waiting = true; setStatus("🤔 بفكر..."); $("q").value = t; $("form").requestSubmit(); }
    else setTimeout(listen, 250);
  };
  try { r.start(); } catch { VC.rec = null; setTimeout(listen, 500); }
}
function talkStart() {
  if (!SR && !sttOK()) return; stopSpeak(); VC.on = true; VC.waiting = false; $("talk").classList.add("rec"); if (innerWidth <= 800) showTab("chat");
  if (listening) rec?.stop(); listen();
}
function talkStop() {
  stopBI(); VC.on = false; VC.waiting = false; stopSpeak(); try { VC.rec?.abort(); } catch {} VC.rec = null; $("talk").classList.remove("rec"); setStatus("");
}
$("talk").onclick = () => VC.on ? talkStop() : talkStart();
$("vstop").onclick = talkStop;
window.voiceListen = () => listen();
$("vorb").onclick = () => {
  if (PS?.paused) { resumeSpeak(); return; }
  if (VC.speaking) { stopSpeak(); VC.waiting = false; listen(); return; }   // قاطِع المدرّس واتكلم
  if (VC.rec) { try { VC.rec.stop ? VC.rec.stop() : VC.rec.abort(); } catch {} return; }   // خلصت كلامك
  if (!VC.on) talkStart(); else listen();
};
if (!SR) $("talk").hidden = true;

// ----- STT من السيرفر (للمتصفحات اللي مفيهاش تعرّف على الكلام) -----
window.addEventListener("proxy-health", () => {
  fillTTS();
  if (!SR && sttOK()) {
    $("talk").hidden = $("mic").hidden = $("lang").hidden = false;
    let mrec = null;
    $("mic").onclick = () => {
      if (mrec) { mrec.stop(); return; }
      $("mic").classList.add("rec"); const base = $("q").value.trim();
      recordOnce({ vad: false, max: 60000, onStart: c => { mrec = c; } }).then(t => { if (t) $("q").value = (base ? base + " " : "") + t; })
        .catch(e => add("a", "⚠️ الميكروفون مشتغلش (" + e.message + ").")).finally(() => { mrec = null; $("mic").classList.remove("rec"); });
    };
  }
});

// ----- زرار القراءة التلقائية (مقفول افتراضيًا — الطالب هو اللي بيشغّله) -----
const syncSpk = () => { const on = autoSpeak(); $("spk").classList.toggle("on", on); $("spk").innerHTML = on ? ICO.on : ICO.off; $("spk").title = on ? "القراءة التلقائية شغالة (اضغط لإيقافها)" : "شغّل القراءة التلقائية للردود"; };
$("spk").onclick = () => { localStorage.setItem("autospeak", autoSpeak() ? "0" : "1"); if (!autoSpeak()) stopSpeak(); syncSpk(); };

// ----- إعدادات الصوت: المحرك / المدرّس / الصوت / اللغة / السرعة / طبقة الصوت -----
function fillTTS() {
  const s = TTS.settings(), cur = TTS.current(), ps = $("tprov"); if (!ps) return;
  ps.innerHTML = ""; ps.append(new Option("تلقائي — أحسن محرك متاح", "auto"));
  TTS.providers().filter(p => !p.fallbackOnly).forEach(p => { const av = (() => { try { return p.available(); } catch { return false; } })(), o = new Option(p.label + (!av ? (p.id === "puter" ? " — سجّل دخول الأول (الزرار تحت)" : " — مش متاح") : TTS.isDown(p.id) ? " — واقف مؤقتًا" : ""), p.id); o.disabled = !av; ps.append(o); });
  ps.value = [...ps.options].some(o => o.value === s.provider && !o.disabled) ? s.provider : "auto";
  $("tteach").value = s.teacher;
  const p = (s.provider !== "auto" && TTS.get(s.provider)?.available() && TTS.get(s.provider)) || cur, tl = TTS.TEACHERS[s.teacher]?.lang || "ar";
  const vs = (p?.voices() || []).filter(v => v.lang === tl), vsel = $("tvoice");
  vsel.innerHTML = ""; vsel.append(new Option("تلقائي — صوت " + (TTS.TEACHERS[s.teacher]?.name || "المدرّس") + " الافتراضي", ""));
  vs.forEach(v => vsel.append(new Option((v.gender === "m" ? "👨 " : v.gender === "f" ? "👩 " : "") + v.name, v.id)));
  vsel.value = vs.some(v => v.id === s.voice) ? s.voice : "";
  if ($("tone")) $("tone").value = TTS.oneVoice() ? "1" : "0";
  $("tlang").value = s.lang; $("vrate").value = String(s.rate); $("tpitch").value = String(s.pitch); $("tpitchv").textContent = (+s.pitch).toFixed(2) + "×";
  const pitchOK = !!p?.caps().pitch; $("tpitch").disabled = !pitchOK; $("tpitchNote").hidden = pitchOK;
  // حالة صريحة: الاتصال بالسيرفر، المحرك والصوت اللي هيشتغلوا، وآخر تشغيل نجح فعلًا (مش بنقول «شغال» غير لو اشتغل بجد)
  const lines = [], pst = window.PX?.on() ? PX.status() : "off", srv = PX?.cached?.()?.tts, vname = (pr, l) => TTS.shownVoice(pr, l)?.name || "صوت المتصفح الافتراضي";
  if (pst === "checking") lines.push("⏳ بنتصل بسيرفر الموقع…");
  if (pst === "down") lines.push("⚠️ سيرفر الموقع مش متاح دلوقتي (" + (PX.error() || "مش بيرد") + ") — بنحاول نتصل تاني تلقائيًا.");
  (PX?.cached?.()?.ttsWarnings || []).forEach(w => lines.push("⚠️ إعداد السيرفر: " + w));
  if (cur) lines.push("المحرك: " + cur.label + (cur.id === "server" && srv ? " — " + (srv.providers?.[0]?.label || srv.provider) + (srv.chain?.length > 1 ? " (والاحتياطي: " + srv.chain.slice(1).join("، ") + ")" : "") : "") + (cur.fallbackOnly ? " — مفيش محرك أساسي متاح دلوقتي" : ""),
    TTS.oneVoice() ? "الصوت (نفسه للعربي والإنجليزي): " + vname(cur, "ar") : "الصوت: " + vname(cur, "ar") + " · English: " + vname(cur, "en"));
  else lines.push("مفيش محرك صوت متاح على الجهاز ده");
  if (cur?.id === "local") { const tk = cur.tkState?.();
    if (tk?.ok) lines.push("✅ التشكيل التلقائي للعربي شغال (عشان «كريم» ينطق العربي صح)");
    else if (tk && !tk.ok) lines.push("⚠️ التشكيل التلقائي مش شغال (" + tk.msg + ") — ارفع فولدر models مع الموقع، من غيره العربي بيطلع مش مفهوم");
    else if (cur.tkCheck?.() === false) lines.push("⚠️ ملفات التشكيل (فولدر models) مش موجودة على الموقع — ارفعها، من غيرها «كريم» بيقرا العربي مش مفهوم"); }
  if (cur?.id === "local" && !localStorage.getItem("tts.localReady")) lines.push("أول تشغيل بيحمّل الموديل (~60 ميجا) مرة واحدة وبعدين بيشتغل على طول");
  if (cur?.id === "local" && cur.slow && !s.voice) lines.push("جهازك أبطأ شوية فبنستخدم نسخة كريم الأخف عشان مفيش تقطيع");
  const PT = TTS.get("puter"), sgn = $("tsign");
  if (PT && sgn) { const st = PT.state(); sgn.hidden = st === true || location.protocol === "file:";
    if (st === false) lines.push("💡 للصوت الطبيعي (ElevenLabs): دوس «سجّل دخول Puter» — مجاني ومن غير فيزا. لحد ما تسجّل، الصوت شغال بصوت المتصفح (أو «كريم» لو المتصفح مفيهوش صوت عربي).");
    if (st === true && cur?.id === "puter") lines.push("✅ متسجّل في Puter — الصوت الطبيعي شغال من رصيدك المجاني."); }
  const last = TTS.last();
  lines.push(last ? "✅ آخر تشغيل نجح: " + last.label + (last.engine && last.engine !== last.id ? " (" + last.engine + ")" : "") + " — " + (last.voice || "") + " · " + new Date(last.at).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" }) + (cur && last.id !== cur.id ? " — ⚠️ ده كان محرك تاني غير الحالي" : "")
    : "لسه مفيش صوت اشتغل على الجهاز ده — دوس «جرّب» تتأكد.");
  $("vnow").innerHTML = lines.map(esc).join("<br>");
}
$("tprov").onchange = e => { stopSpeak(); TTS.set({ provider: e.target.value, voice: "" }); };
$("tteach").onchange = e => { stopSpeak(); TTS.set({ teacher: e.target.value, voice: "" }); };
$("tvoice").onchange = e => TTS.set({ voice: e.target.value });
if ($("tone")) $("tone").onchange = e => { stopSpeak(); TTS.set({ oneVoice: e.target.value === "1" }); };
$("tlang").onchange = e => TTS.set({ lang: e.target.value });
$("vrate").onchange = e => setRate(+e.target.value);
$("tpitch").oninput = e => { $("tpitchv").textContent = (+e.target.value).toFixed(2) + "×"; };
$("tpitch").onchange = e => TTS.set({ pitch: +e.target.value });
const SAMPLE = { ar: "أهلًا! أنا مدرّسك. هشرحلك الدرس خطوة خطوة، ولو فيه مصطلح زي cell membrane هقوله بالإنجليزي عادي. يلا نبدأ؟", en: "Hi! I'm your teacher. I'll explain every lesson step by step, clearly and calmly. Ready to start?" };
$("vtest").onclick = () => { const b = $("vtest"); if (PS && PS.btn === b) { stopSpeak(); b.innerHTML = "▶ جرّب"; return; } speak(SAMPLE[TTS.TEACHERS[TTS.settings().teacher]?.lang || "ar"], { btn: b, onend: () => { b.innerHTML = "▶ جرّب"; fillTTS(); } }); };
$("settingsBtn").addEventListener("click", () => { fillTTS(); const PT = TTS.get("puter"); if (PT && PT.state() === null && location.protocol !== "file:") PT.check(); });
if ($("tsign")) $("tsign").onclick = async () => { const b = $("tsign"); b.disabled = true; b.textContent = "بفتح تسجيل الدخول…";
  try { const ok = await TTS.get("puter").signIn(); toast(ok ? "✅ تمام! الصوت الطبيعي اشتغل." : "⚠️ التسجيل مكملش."); } catch (e) { toast("⚠️ " + (typeof perr === "function" ? perr(e) : e.message)); }
  b.disabled = false; b.textContent = "سجّل دخول Puter (صوت طبيعي مجاني)"; fillTTS(); };
TTS.onChange(fillTTS);
fillTTS(); syncSpk();
// المتصفحات (خصوصًا iPhone) بتمنع الصوت لحد أول لمسة من المستخدم، فبنفتحه بلمسة أولى
document.addEventListener("pointerdown", () => {
  if (HAS_TTS) { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; speechSynthesis.speak(u); }
  try { AUD.src = URL.createObjectURL(wavFromPCM(new Int16Array(240))); AUD.play().then(() => AUD.pause()).catch(() => {}); } catch {}
}, { once: true });
// تنضيف مفاتيح الإعدادات القديمة للصوت (Gemini وغيره) — مبقتش مستخدمة
["voice", "vmode", "vmix", "nolive", "livecool", "livemodel", "gcool", "ttsmodel", "psigned", "pvoice", "egvoices", "freehint", "gemhint", "malemig1", "voicemig3", "vmig3", "srvvoice2", "vrate"].forEach(k => { try { localStorage.removeItem(k); } catch {} });

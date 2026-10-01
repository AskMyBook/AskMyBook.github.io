const BOOKCTX = `\n- معاك نص الصفحة المفتوحة عند الطالب، وممكن كمان مقاطع من صفحات تانية في نفس الكتاب. الطالب ممكن يسأل عن حاجة في أي مكان في الكتاب: دوّر عليها في كل المقاطع، ولما تلاقيها **اذكر رقم الصفحة** (مثلًا: «ده في صفحة ١٢») وجاوب منها. لو مش في أي مقطع، قول: «مش لاقي المعلومة دي في الكتاب المحدد.»`;
const GEN = `- الكتاب (النص/الصورة اللي معاك) هو المرجع الأساسي: جاوب منه الأول وحافظ على معناه، ومتقولش إن حاجة في الكتاب وهي مش فيه. (قاعدة المصدر بالتفصيل في آخر التعليمات.)
- مسموح: شرح بأسلوبك وتبسيط وتشبيه للتوضيح، ومعنى كلمة أو ترجمة أو نطق لما الطالب يطلب ده.
- لو الطالب قال لك معلومة أو صحّحك: قارنها بالكتاب، لو صح اعترف وعدّل، ولو غلط وضّح له بلطف.
- فكّر في المسألة خطوة خطوة قبل ما تحدد الإجابة النهائية، وراجع إجابتك قبل ما تكتبها. لو مش متأكد قول كده بصراحة.`;
const MCQ = `لو اختيار من متعدد: اكتب «الإجابة: (الحرف) النص»، وبعدها **ليه الاختيار ده صح** بشرح واضح، وبعدين **ليه كل اختيار من الباقيين غلط** (سطر لكل اختيار: الحرف + سبب الغلط)، وفي الآخر لو فيه قاعدة أو نقطة تتحفظ اذكرها في جملة.`;
const MODEL = "claude-sonnet-5-5";
// مفيش كتب على الموقع نفسه: كل واحد بيضيف كتبه (PDF) من جهازه مرة واحدة وبتتحفظ في متصفحه (IndexedDB) وبتلاقيها كل مرة يفتح.
const NAMES = {}; let LIB = [];   // LIB: [{id, name, lang, file}] — قايمة كتب المستخدم
const LEGACY_FILES = { "الاضواء_عربي_1ث.pdf": "arabic", "الامتحان_تاريخ_1ث.pdf": "history", "الامتحان_فلسفه_1ث.pdf": "philosophy", "فائز_تكنولجيا_1ث.pdf": "technology", "المعاصر_انجليزي_1ث.pdf": "english" };
const LEGACY_NAMES = { arabic: "اللغة العربية (الأضواء)", history: "التاريخ (الامتحان)", philosophy: "الفلسفة (الامتحان)", technology: "التكنولوجيا (فائز)", english: "English (المعاصر)" };
const SYSTEM = `أنت مدرّس خصوصي ذكي. هتاخد مقاطع من ملفات الطالب (نص مستخرج آليًا وممكن يكون فيه أخطاء).
- جاوب من المقاطع بس واذكر المصدر: (اسم الكتاب - صفحة X).
- لو السؤال اختيار من متعدد، اذكر الإجابة الصحيحة وبعدين اشرح ليه.
- لو الطالب قال إنه مش فاهم، اشرح بأسلوب بسيط وبأمثلة وخطوة خطوة.
- لو النص مش واضح بسبب الـ OCR قول كده.
${GEN}
- رد بنفس لغة الطالب.`;
const $ = id => document.getElementById(id);
let pages = [], df = {}, avg = 1, history = [];

const norm = s => s.replace(/[\u064B-\u0652\u0640]/g,"").replace(/[إأآٱ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").toLowerCase()
  .replace(/[٠-٩]/g, d => d.charCodeAt(0) - 1632);
const tok = s => norm(s).split(/[^a-z0-9\u0621-\u064A]+/).filter(w => w.length > 1).map(w => w.replace(/^(وال|بال|كال|فال|لل|ال)/,""));

function load() {
  // PAGES_DATA بييجي من data/pages.js اللي متحمّل بـ <script> عادي في index.html،
  // مش بـ fetch()، عشان fetch() بتترفض من المتصفح لو فتحت index.html مباشرة بـ file://
  pages = (typeof PAGES_DATA !== "undefined" ? PAGES_DATA : []);
  pages.forEach(p => { const t = tok(p.text); p.len = t.length; p.tf = {}; t.forEach(w => p.tf[w] = (p.tf[w]||0)+1);
    Object.keys(p.tf).forEach(w => df[w] = (df[w]||0)+1); });
  avg = pages.reduce((a,p) => a+p.len, 0) / (pages.length||1);
  renderLib();
  showTab("book");
  window.showHello ? showHello() : add("a", "أهلًا! 👋 أنا مدرّسك الخاص. ضيف أي ملف PDF واسألني فيه بأي طريقة.");
}

// مكتبة pdf.js محلية في lib/ (مش من CDN) عشان الموقع ميعتمدش على إنترنت خارجي
pdfjsLib.GlobalWorkerOptions.workerSrc = "lib/pdf.worker.min.js";
let doc = null, cur = { id:null, page:1 }, zoom = 1, task = null, renderId = 0;
const docs = {}, docErr = {};   // كاش للكتب اللي اتفتحت + سبب الفشل لو كتاب محفوظ مش راضي يتفتح
function showTab(t) { $("app").className = "show-" + t; document.querySelectorAll("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.t === t)); }

function viewerMsg(html, cls = "") { const v = $("vmsg"); v.className = cls; v.innerHTML = html; v.hidden = false; $("pages").hidden = true; }
// رسالة واضحة لو كتاب محفوظ مش راضي يتفتح (بدل «الكتاب مش موجود»)
function bookErrUI(id, err) {
  const e = LIB.find(x => x.id === id), n = err?.name || "", nm = esc(e?.name || "الكتاب");
  const why = n === "PasswordException" ? `«${nm}» محمي بكلمة سر، والموقع مش بيقدر يفتح ملفات PDF المقفولة. افتحه في برنامج PDF واحفظ نسخة من غير كلمة سر، وضيفها تاني.`
    : n === "InvalidPDFException" || n === "FormatError" ? `ملف «${nm}» تالف أو ناقص (ممكن التحميل ماكملش). ضيف نسخة سليمة من الملف.`
    : `حصلت مشكلة وقت فتح «${nm}»${err?.message ? `:<br><small dir="ltr">${esc(err.message)}</small>` : "."}`;
  viewerMsg(`<div class="big">⚠️</div><p>${why}</p><p style="margin-top:14px"><button id="pickAll">➕ ضيف نسخة تانية</button> <button id="delBad" class="ghost">🗑️ امسحه من المكتبة</button></p>`, "err");
  $("pickAll").onclick = () => $("files").click(); $("delBad").onclick = () => delBook(id);
}

// تخزين الكتب اللي الطالب يختارها من جهازه جوه المتصفح (IndexedDB) عشان تفضل موجودة بعد ما يقفل الموقع
// اتصال واحد بيتعاد استخدامه (قبل كده كل قراية/كتابة كانت بتفتح اتصال جديد ومابتقفلوش — مئات الاتصالات المفتوحة)
let IDBP = null;
const idb = () => IDBP ||= new Promise((res, rej) => { const r = indexedDB.open("books", 1); r.onupgradeneeded = () => r.result.createObjectStore("f");
  r.onsuccess = () => { const db = r.result; db.onclose = () => { IDBP = null; }; db.onversionchange = () => { db.close(); IDBP = null; }; res(db); };
  r.onerror = () => { IDBP = null; rej(r.error); }; r.onblocked = () => { IDBP = null; rej(new Error("IndexedDB blocked")); }; });
const idbTx = async (mode) => { try { return (await idb()).transaction("f", mode); } catch (e) { if (e?.name !== "InvalidStateError") throw e; IDBP = null; return (await idb()).transaction("f", mode); } };   // الاتصال اتقفل (مثلًا المتصفح قفله): افتح تاني
async function idbGet(k) { try { const tx = await idbTx("readonly"); return await new Promise(res => { const q = tx.objectStore("f").get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }); } catch { return null; } }
async function idbSet(k, v) { try { const t = await idbTx("readwrite"); await new Promise((res, rej) => { t.objectStore("f").put(v, k); t.oncomplete = res; t.onerror = t.onabort = () => rej(t.error || new Error("abort")); }); return true; } catch { return false; } }

function progressUI(txt) { viewerMsg(`<div class="spin"></div><p>${txt}<br><small>الكتب كبيرة، أول مرة ممكن تاخد شوية وقت</small></p><progress id="prog" max="1" value="0"></progress>`); }
function withProgress(t) { t.onProgress = p => { const el = $("prog"); if (el && p.total) el.value = p.loaded / p.total; }; return t; }

async function loadDoc(id) {
  if (docs[id]) return docs[id];
  // 1) نسخة محفوظة في المتصفح
  const saved = await idbGet(id);
  if (saved) { try { delete docErr[id]; return docs[id] = await pdfjsLib.getDocument({ data: new Uint8Array(await saved.arrayBuffer()) }).promise; } catch (e) { console.warn("saved copy broken", e); docErr[id] = e; } }
  return null;
}

function pickUI(id) {
  const e = LIB.find(x => x.id === id);
  viewerMsg(`<div class="big">📂</div><p>${e ? `الكتاب <b>${esc(e.name)}</b> مش موجود في متصفحك (ممكن يكون اتمسح). ضيفه تاني وهيتحفظ.` : "اختار كتبك من جهازك وهتتحفظ في المتصفح."}<br><small>الكتب بتتحفظ في متصفحك إنت بس، ومبتترفعش على أي سيرفر.</small></p>
    <p style="margin-top:14px"><button id="pickAll">➕ إضافة كتب (PDF)</button></p>`);
  $("pickAll").onclick = () => $("files").click();
}
function showEmpty() {
  viewerMsg(`<div class="big">📚</div><p>مكتبتك فاضية. اضغط «إضافة كتب» واختار ملفات الـ PDF بتاعتك (تقدر تختار كذا كتاب مع بعض).<br><small>الكتب بتتحفظ في متصفحك إنت بس مرة واحدة، وكل ما تفتح الموقع هتلاقيها. الموقع نفسه مفيهوش أي كتب.</small></p>
    <p style="margin-top:14px"><button id="pickAll">➕ إضافة كتب (PDF)</button></p>`);
  $("pickAll").onclick = () => $("files").click();
}
async function openBook(id, page = 1) {
  showTab("book"); cur.want = id;
  if ([...$("book").options].some(o => o.value === id)) $("book").value = id;   // الكتاب المفتوح = الكتاب المحدد للمدرّس
  document.querySelectorAll("#books button").forEach(b => b.classList.toggle("on", b.dataset.id === id));
  if (cur.id !== id || !doc) {
    const d = await loadDoc(id);
    if (cur.want !== id) return;               // الطالب غيّر الكتاب أثناء التحميل
    if (!d) { doc = null; cur.id = null; docErr[id] ? bookErrUI(id, docErr[id]) : pickUI(id); return; }
    doc = d; cur.id = id;
  }
  if (cur.mounted === id && pgs.length && !$("pages").hidden) gotoPage(page); else await mountDoc(page);
}

let pgs = [], vis = new Set(), io = null, pending = 0, ztimer = 0, stf = 0;
const dprCap = () => Math.min(window.devicePixelRatio || 1, 2);
const pageEl = n => pgs[n - 1];
const fitW = () => Math.max(160, $("wrap").clientWidth - (matchMedia("(max-width:800px)").matches ? 12 : 28)) * zoom;
function sizePages() { const w = fitW(); pgs.forEach(el => { el.style.width = w + "px"; el.style.height = w * el._r + "px"; }); }
async function mountDoc(page = 1) {
  const box = $("pages"); box.innerHTML = ""; box.hidden = false; $("vmsg").hidden = true; clearPin(); io?.disconnect(); vis.clear(); pgs = []; cur.mounted = cur.id;
  const p0 = await doc.getPage(Math.min(2, doc.numPages)), v0 = p0.getViewport({ scale: 1 }), r0 = v0.height / v0.width;
  for (let i = 1; i <= doc.numPages; i++) { const el = document.createElement("div"); el.className = "pg"; el.dataset.n = i; el._r = r0; const cv0 = document.createElement("canvas"); cv0.width = cv0.height = 0; /* 0×0 لحد ما تترسم: الافتراضي 300×150 × مئات الصفحات = ذاكرة على الفاضي */ el.append(cv0); pgs.push(el); box.append(el); }
  sizePages();
  io = new IntersectionObserver(es => es.forEach(en => { const el = en.target; if (en.isIntersecting) { vis.add(el); renderPg(el); } else { vis.delete(el); releasePg(el); } }), { root: $("wrap"), rootMargin: "1500px 0px" });
  pgs.forEach(el => io.observe(el));
  window.inkLoad?.(cur.id);
  $("pt").textContent = "/ " + doc.numPages; $("pn").max = doc.numPages; gotoPage(page); bkInit();
}
function releasePg(el) { window.inkFree?.(el); el._task?.cancel(); el._done = false; const c = el.firstChild; c.width = c.height = 0; }
async function renderPg(el) {
  if (el._done || el._busy) return; el._busy = true; const d = doc, n = +el.dataset.n;
  try {
    const pg = await d.getPage(n); if (!el.isConnected || !vis.has(el) || d !== doc) { el._busy = false; return; }
    const v1 = pg.getViewport({ scale: 1 }); el._r = v1.height / v1.width; el.style.height = el.clientWidth * el._r + "px";
    let sc = el.clientWidth / v1.width * dprCap(); const px = v1.width * sc * v1.height * sc; if (px > 16e6) sc *= Math.sqrt(16e6 / px);
    const cv = el.firstChild, vp = pg.getViewport({ scale: sc }); cv.width = Math.floor(vp.width); cv.height = Math.floor(vp.height);
    el._task = pg.render({ canvasContext: cv.getContext("2d"), viewport: vp }); await el._task.promise; el._done = true; window.inkDraw?.(el);
    if (pending === n) { pending = 0; alignTo(n); }
  } catch {}
  el._busy = false;
}
function alignTo(n) { const w = $("wrap"), wr = w.getBoundingClientRect(), r = pageEl(n).getBoundingClientRect(); w.scrollTop += r.top - wr.top - 6; }
function gotoPage(n) { if (!doc || !pgs.length) return; n = clamp(Math.floor(n) || 1, 1, doc.numPages); pending = n; alignTo(n); cur.page = n; $("pn").value = n; }
function showPage(n) { gotoPage(n); }
function anchor() { const el = pageEl(cur.page); if (!el) return null; const w = $("wrap").getBoundingClientRect(), r = el.getBoundingClientRect(); return { el, f: (w.top - r.top) / (r.height || 1) }; }
function setZoom(z) {
  zoom = clamp(z, .5, 4); if (!pgs.length) return; const a = anchor(); clearPin(); sizePages();
  if (a) { const w = $("wrap"), r = a.el.getBoundingClientRect(); w.scrollTop += r.top - w.getBoundingClientRect().top + a.f * r.height; }
  clearTimeout(ztimer); ztimer = setTimeout(() => { vis.forEach(el => { el._task?.cancel(); el._done = false; }); setTimeout(() => vis.forEach(renderPg), 60); }, 150);
}
$("wrap").addEventListener("scroll", () => { if (stf) return; stf = requestAnimationFrame(() => { stf = 0; if (!doc) return;
  const wr = $("wrap").getBoundingClientRect(), line = wr.top + wr.height * .35; let best = 0;
  for (const el of vis) { const r = el.getBoundingClientRect(); if (r.top <= line && r.bottom > line) { best = +el.dataset.n; break; } }
  if (best && best !== cur.page) { cur.page = best; $("pn").value = best; } }); }, { passive: true });
$("wrap").addEventListener("wheel", e => { if (!e.ctrlKey || !doc) return; e.preventDefault(); setZoom(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1)); }, { passive: false });
["wheel", "touchstart", "pointerdown"].forEach(t => $("wrap").addEventListener(t, () => { pending = 0; }, { passive: true }));
$("prev").onclick = () => showPage(cur.page - 1); $("next").onclick = () => showPage(cur.page + 1);
$("pn").onchange = e => showPage(+e.target.value);
$("zi").onclick = () => setZoom(zoom * 1.25); $("zo").onclick = () => setZoom(zoom / 1.25);
$("file").onchange = e => { importMany([...e.target.files]); e.target.value = ""; };
$("swap").onclick = () => $("files").click();
document.addEventListener("keydown", e => {
  if (!doc || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
  if (e.key === "ArrowLeft") showPage(cur.page + 1); else if (e.key === "ArrowRight") showPage(cur.page - 1);
});
let rz; addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => doc && setZoom(zoom), 200); });
document.querySelectorAll("#tabs button").forEach(b => b.onclick = () => showTab(b.dataset.t));

function search(q, book) {
  const qt = tok(q), n = pages.length;
  return pages.filter(p => !book || p.id === book).map(p => {
    let s = 0;
    for (const w of qt) { const f = p.tf[w]; if (!f) continue; const d = df[w];
      s += Math.log(1 + (n-d+.5)/(d+.5)) * f * 2.2 / (f + 1.2*(.25 + .75*p.len/avg)); }
    return [p,s];
  }).filter(x => x[1] > 0).sort((a,b) => b[1]-a[1]).slice(0,6).map(x => x[0]);
}

// ===== عرض الردود: ماركداون كامل (عناوين كأقسام ملوّنة، قوايم، جداول، اقتباس، كود، معادلات) — وكله متأمّن (escape الأول) =====
const esc0 = t => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const CX = [[/^(الاجابات|الاجابه|الحلول|اجابات|answers?|solutions?)$/, "ans"], [/(اخطاء|غلطات|غلط شائع|خلي بالك من|mistakes|pitfalls)/, "warn"], [/(الفكره|ببساطه|فكره الحل|نظره عامه|key idea|the idea|big idea|in simple|overview)/, "idea"],
  [/(مثال|امثله|examples?)/, "ex"], [/(افتكر|خلي بالك|خد بالك|انتبه|تذكر|مهم|احفظ|remember|important|note|tip|key points?)/, "rem"], [/(الخلاصه|خلاصه|باختصار|ملخص سريع|المراجعه السريعه|recap|summary|takeaway|in short)/, "sum"],
  [/(اختبر نفسك|سؤال للتاكد|اسئله متوقعه|اسئله مراجعه|check yourself|quick check|practice|self.?test)/, "chk"]];
const cxType = t => { const n = norm(String(t)).replace(/[^a-zء-ي0-9 ]+/g, " ").replace(/\s+/g, " ").trim(); const hit = CX.find(([re, k]) => k === "ans" ? re.test(n) : re.test(n) && n.split(" ").length <= 6); return hit ? hit[1] : ""; };
const mdInline = t => t.replace(/`([^`\n]+)`/g, "<code>$1</code>").replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/__(.+?)__/g, "<b>$1</b>")
  .replace(/(^|[\s(«])\*([^*\n]+?)\*(?=[\s).,!?؟،:»]|$)/g, "$1<i>$2</i>").replace(/(^|[\s(«])_([^_\n]+?)_(?=[\s).,!?؟،:»]|$)/g, "$1<i>$2</i>");
function md(text) {
  const codes = [], math = []; let t = String(text ?? "").replace(/\r/g, "");
  t = t.replace(/```[\w-]*\n?([\s\S]*?)(```|$)/g, (m, c) => { codes.push(c.replace(/\n$/, "")); return "\n\u0001C" + (codes.length - 1) + "\u0001\n"; });
  t = t.replace(/\$\$([\s\S]+?)\$\$/g, (m, x) => { math.push([x, 1]); return "\u0001M" + (math.length - 1) + "\u0001"; })
       .replace(/\$(?=\S)([^$\n]{1,200}?\S)\$(?!\d)/g, (m, x) => { if (!/[\\^_=+\-*/<>a-zA-Z(]/.test(x) || /^\d+([.,]\d+)?$/.test(x)) return m; math.push([x, 0]); return "\u0001M" + (math.length - 1) + "\u0001"; })
       .replace(/\\\[([\s\S]+?)\\\]/g, (m, x) => { math.push([x, 1]); return "\u0001M" + (math.length - 1) + "\u0001"; }).replace(/\\\((.+?)\\\)/g, (m, x) => { math.push([x, 0]); return "\u0001M" + (math.length - 1) + "\u0001"; });
  const L = esc0(t).split("\n"); let h = "", para = [], list = null, sec = null;
  const flushP = () => { if (para.length) { h += "<p>" + para.map(mdInline).join("<br>") + "</p>"; para = []; } };
  const flushL = () => { if (list) { h += "</" + list + ">"; list = null; } };
  const closeSec = () => { flushP(); flushL(); if (sec) { h += sec === "ans" ? "</div></details>" : "</section>"; sec = null; } };
  const openSec = (title, lvl) => { closeSec(); const k = cxType(title);
    if (k === "ans") { h += `<details class="cx cx-ans"><summary>${mdInline(title)}</summary><div>`; sec = "ans"; }
    else if (k) { h += `<section class="cx cx-${k}"><h4>${mdInline(title)}</h4>`; sec = k; }
    else h += `<h${lvl <= 2 ? 3 : 4} class="mh">${mdInline(title)}</h${lvl <= 2 ? 3 : 4}>`; };
  for (let i = 0; i < L.length; i++) {
    const l = L[i]; let m;
    if (!l.trim()) { flushP(); flushL(); continue; }
    if ((m = l.trim().match(/^\u0001C(\d+)\u0001$/))) { flushP(); flushL(); h += `<pre><code>${esc0(codes[+m[1]])}</code></pre>`; continue; }
    if ((m = l.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/))) { openSec(m[2], m[1].length); continue; }
    if ((m = l.match(/^\s*\*\*([^*]{2,60}?)\*\*\s*[:：]?\s*$/)) && cxType(m[1])) { openSec(m[1], 4); continue; }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(l)) { flushP(); flushL(); h += "<hr>"; continue; }
    if (/^\s*\|.*\|\s*$/.test(l)) {
      flushP(); flushL(); const rows = []; while (i < L.length && /^\s*\|.*\|\s*$/.test(L[i])) rows.push(L[i++]); i--;
      const body = rows.filter(r => !/^\s*\|[\s:|-]+\|\s*$/.test(r)).map(r => r.trim().replace(/^\||\|$/g, "").split("|").map(c => mdInline(c.trim())));
      h += "<div class='tw'><table class='mdt'>" + body.map((r, j) => "<tr>" + r.map(c => j ? `<td>${c}</td>` : `<th>${c}</th>`).join("") + "</tr>").join("") + "</table></div>"; continue;
    }
    if ((m = l.match(/^\s*&gt;\s?(.*)$/))) { flushP(); flushL(); h += `<blockquote>${mdInline(m[1])}</blockquote>`; continue; }
    if ((m = l.match(/^\s*[-*•]\s+(.*)$/))) { flushP(); if (list !== "ul") { flushL(); h += "<ul>"; list = "ul"; } h += `<li>${mdInline(m[1])}</li>`; continue; }
    if ((m = l.match(/^\s*([0-9٠-٩]{1,3})\s*[.)\-]\s+(.*)$/))) { flushP(); if (list !== "ol") { flushL(); h += `<ol start="${+norm(m[1]) || 1}">`; list = "ol"; } h += `<li>${mdInline(m[2])}</li>`; continue; }
    if (list && /^\s{2,}\S/.test(l)) { h = h.replace(/<\/li>$/, "<br>" + mdInline(l.trim()) + "</li>"); continue; }
    flushL(); para.push(l);
  }
  closeSec();
  return h.replace(/\u0001M(\d+)\u0001/g, (x, j) => `<span class="math${math[+j][1] ? " mb" : ""}" dir="ltr" data-tex="${esc0(math[+j][0])}">${esc0(math[+j][0])}</span>`).replace(/\u0001C\d+\u0001/g, "");
}
// ===== عرض الرد وهو بيتكتب من غير لاج =====
// بدل ما نعيد رسم الرد كله كل شوية (وده بيخلّي المتصفح يعيد ترتيب الصفحة كلها)، الرد بيتقسم لأجزاء:
// عند كل عنوان، وعند كل سطر فاضي برّه الأقسام الملوّنة. الأجزاء اللي خلصت بتفضل زي ما هي، والجزء الأخير بس اللي بيتعاد رسمه.
// التقسيم ده عند الحدود اللي md() نفسه بيقفل عندها، فالنتيجة هي نفسها بالظبط.
function mdUnits(text) {
  const L = String(text ?? "").replace(/\r/g, "").split("\n"), out = []; let cur = [], fence = false, cx = false, disp = false;
  const push = () => { if (cur.length) out.push(cur.join("\n")); cur = []; };
  for (const l of L) {
    if (/^\s*```/.test(l)) fence = !fence;
    else if (!fence && ((l.match(/\$\$/g) || []).length % 2)) disp = !disp;   // معادلة $$ على كذا سطر: متتقسمش
    if (!fence && !disp) {
      const hm = l.match(/^\s*#{1,6}\s+(.+?)\s*#*\s*$/) || (m => m && cxType(m[1]) ? m : null)(l.match(/^\s*\*\*([^*]{2,60}?)\*\*\s*[:：]?\s*$/));
      if (hm) { push(); cx = !!cxType(hm[1]); cur.push(l); continue; }
      if (!l.trim() && !cx) { cur.push(l); push(); continue; }
    }
    cur.push(l);
  }
  push(); return out;
}
function mdLive(node, post = h => h) {
  let units = [], parts = [], started = false;
  return text => {
    if (!started) { started = true; node.textContent = ""; }
    const u = mdUnits(text); let i = 0;
    while (i < u.length && i < units.length && u[i] === units[i] && i < units.length - 1) i++;   // آخر جزء قديم ممكن يكون لسه بيكمل
    for (let j = parts.length - 1; j >= i; j--) parts[j].forEach(n => n.remove());
    parts.length = Math.min(parts.length, i);
    for (let j = i; j < u.length; j++) { const t = document.createElement("template"); t.innerHTML = post(md(u[j])); const ns = [...t.content.childNodes]; node.append(t.content); parts.push(ns); }
    units = u;
  };
}
// المعادلات: مكتبة KaTeX بتتحمّل بس لو الرد فيه معادلة
let katexP = null;
function renderMath(root) {
  const els = [...(root || document).querySelectorAll("span.math:not(.done)")]; if (!els.length) return;
  katexP ||= new Promise((res, rej) => { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"; document.head.append(l);
    const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"; s.onload = res; s.onerror = () => { katexP = null; rej(); }; document.head.append(s); });
  katexP.then(() => els.forEach(e => { try { katex.render(e.dataset.tex, e, { displayMode: e.classList.contains("mb"), throwOnError: false }); e.classList.add("done"); } catch {} })).catch(() => {});
}
// سكرول ذكي: بيتابع آخر الرد بس لو انت أصلًا تحت (لو طلعت تقرا فوق مش بيشدّك)
const nearBottom = () => { const c = $("chat"); return c.scrollHeight - c.scrollTop - c.clientHeight < 140; };
function chatScroll(force) { const c = $("chat"); if (force || nearBottom()) c.scrollTop = c.scrollHeight; }
const esc = esc0;
function add(cls, text, hits, img) {
  const force = cls === "u" || nearBottom();
  const d = document.createElement("div"); d.className = "m " + cls; if (cls === "a") { d.innerHTML = md(text); renderMath(d); } else d.textContent = text;
  if (img) { const i = new Image(); i.src = img; i.className = "thumb"; d.prepend(i); }
  if (hits?.length) { const s = document.createElement("div"); s.className = "src";
    hits.forEach(p => { const a = document.createElement("a"); a.href = "#"; a.onclick = e => { e.preventDefault(); openBook(p.id, p.page); };
      a.textContent = `${p.book} - ص${p.page}`; s.append(a); }); d.append(s); }
  if (cls === "a" && !/^بفكر/.test(text)) window.voiceDecorate?.(d, text);
  $("chat").append(d); chatScroll(force); return d;
}

// واجهة الإعدادات للناس: الحاجات التقنية/بتاعة صاحب الموقع (مفاتيح API، الذكاء المحلي، البحث بالمعنى، تفاصيل الصوت، رسايل الإعداد) مخفية.
// صاحب الموقع يظهّرها بـ devSettings:true في config.js، أو بفتح الموقع بـ ?dev=1 (بيتفتكر في المتصفح ده)، وتتقفل بـ ?dev=0.
const DEV = (() => { try { const m = location.search.match(/[?&]dev=([01])/); if (m) localStorage.setItem("dev", m[1]); return !!window.TUTOR_CONFIG?.devSettings || localStorage.getItem("dev") === "1"; } catch { return !!window.TUTOR_CONFIG?.devSettings; } })();
window.DEV = DEV; document.documentElement.classList.toggle("dev", DEV);
function stripAdvanced() {   // خيارات المزوّد المتقدمة بتتشال من القايمة (المختار حاليًا بيفضل عشان محدش يتكسر عنده)
  if (DEV) return; const sel = $("prov"); if (!sel) return;
  [...sel.options].forEach(o => { if (o.classList.contains("adv") && o.value !== provider()) o.remove(); });
}
if (!localStorage.getItem("aimig2")) { localStorage.setItem("aimig2", "1"); if (localStorage.getItem("provider") !== "claude") localStorage.setItem("provider", "puter"); }
if (!localStorage.getItem("aimig3")) { localStorage.setItem("aimig3", "1"); if (localStorage.getItem("provider") === "local") localStorage.setItem("provider", "puter"); }
if (!localStorage.getItem("aimig4")) { localStorage.setItem("aimig4", "1"); const pv = localStorage.getItem("provider"); if (!pv || pv === "puter" || pv === "local") localStorage.setItem("provider", "free"); }
const provider = () => localStorage.getItem("provider") || "free";
const textOnly = () => provider() === "local" || provider() === "free" || (provider() === "server" && window.PX?.cached() && !PX.cached().vision);
const errMsg = e => { const m0 = errMsg0(e); return e?.rid && !/⏹/.test(m0) ? m0 + ` (رقم الطلب للدعم: ${String(e.rid).slice(0, 12)})` : m0; };
const errMsg0 = e => { if (e?.name === "AbortError") return "⏹ وقّفت الرد."; if (e?.message === "NOKEY") { $("settings").hidden = false; syncSettings(); return "⚠️ ضع مفتاح API في الإعدادات (⚙️) الأول."; } const m = String(e?.message || e || "");
  if (e?.code === "free_down") return "⚠️ " + m + ".\n" + (navigator.onLine === false ? "مفيش إنترنت دلوقتي — اتأكد من الاتصال ودوس «جرّب تاني»." : "ده غالبًا عشان الخدمات المجانية واقفة شوية، أو شبكتك/VPN/مانع الإعلانات بيقفلها. دوس «جرّب تاني» بعد دقيقة — ولو فضلت كده افتح ⚙️ واختار «✨ ذكي» (Puter)، أو Gemini بمفتاح مجاني (والموقع هيستخدمه لوحده لما المجاني يقع).");
  if (/failed to fetch|networkerror|load failed|network request failed|err_internet|ERR_NETWORK/i.test(m) || e?.name === "TypeError" && /fetch/i.test(m)) return navigator.onLine === false ? "⚠️ مفيش إنترنت دلوقتي. اتأكد من الاتصال ودوس «جرّب تاني»." : "⚠️ مقدرتش أوصل لخدمة الذكاء الاصطناعي (ممكن تكون واقفة أو النت ضعيف). دوس «جرّب تاني»، ولو فضلت كده غيّر المزوّد من ⚙️.";
  if (e?.code === "quota") return "⚠️ " + m;
  if (e?.code === "auth_required" || e?.status === 401) return "⚠️ لازم تسجّل دخول الأول (⚙️ ← الحساب).";
  if (e?.code === "malformed_ai") return "⚠️ " + m;
  if (e?.status === 429 || /\b429\b|rate.?limit|too many/i.test(m)) return "⚠️ الخدمة عليها ضغط دلوقتي (حد الطلبات). استنى دقيقة ودوس «جرّب تاني».";
  if (e?.status >= 500) return "⚠️ خدمة الذكاء الاصطناعي رجعت خطأ (" + e.status + "). دوس «جرّب تاني» بعد شوية.";
  return "⚠️ حصل خطأ: " + m; };
// زرار «جرّب تاني» تحت رسالة الخطأ: بيبعت آخر سؤال للطالب تاني
function retryChip(node) {
  if (!node) return; const last = [...document.querySelectorAll("#chat .m.u")].pop()?.textContent?.trim(); if (!last) return;
  const b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.textContent = "🔄 جرّب تاني";
  b.onclick = () => { if (document.body.classList.contains("gen")) return; b.disabled = true; $("q").value = last; $("form").requestSubmit(); };
  node.insertBefore(b, node.querySelector(".acts"));
}

// اختيار موديل Gemini المجاني تلقائيًا (الأخف Flash-Lite أول حاجة) عشان مانعتمدش على اسم ثابت ممكن يتغير
async function geminiModel(key) {
  let m = localStorage.getItem("gmodel"); if (m) return m;
  const r = await timedFetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": key } }, null, 20000), j = await r.json();
  if (!r.ok) throw new Error(r.status === 400 || r.status === 403 ? "المفتاح غلط أو مش شغال. اتأكد إنك نسخته كامل." : (j.error?.message || r.status));
  const ok = (j.models || []).filter(x => x.supportedGenerationMethods?.includes("generateContent")).map(x => x.name.replace("models/", ""));
  const ver = n => +((n.match(/(\d+(?:\.\d+)?)/) || [0, 0])[1]), rank = n => (/preview|exp/.test(n) ? 0 : 100) + ver(n);
  const pick = re => ok.filter(n => re.test(n) && !/image|tts|live|audio|embed|robotics/.test(n)).sort((x, y) => rank(y) - rank(x))[0];
  m = pick(/flash-lite/) || pick(/flash/) || ok[0]; if (!m) throw new Error("مفيش موديل متاح للمفتاح ده");
  localStorage.setItem("gmodel", m); return m;
}
// messages: [{role:"user"|"assistant", content:text}] — img (base64 jpeg) بيتضاف لآخر رسالة
// onText(textSoFar): الرد بيوصل أول بأول (streaming) — noStyle: البرومبت فيه تعليمات اللهجة خلاص
async function readSSE(r, onData) {
  const rd = r.body.getReader(), dec = new TextDecoder(); let buf = "";
  for (;;) { const { done, value } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true }); let i;
    while ((i = buf.indexOf("\n")) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!line.startsWith("data:")) continue; const d = line.slice(5).trim(); if (!d || d === "[DONE]") continue; let j; try { j = JSON.parse(d); } catch { continue; } onData(j); } }
}
// «وقّف»: كل طلب للـ AI ممكن يتوقف (زرار الإيقاف في مربع الكتابة) — جوه «دور» واحد أو من الأزرار
let GENS = { ac: new AbortController(), n: 0, busy: false };
const genUI = () => document.body.classList.toggle("gen", GENS.n > 0 || GENS.busy);
async function genTurn(fn) { GENS.ac = new AbortController(); GENS.busy = true; genUI(); try { return await fn(); } finally { GENS.busy = false; genUI(); } }
const abortErr = () => { const e = new Error("stopped"); e.name = "AbortError"; return e; };
function stopGen() { GENS.ac.abort(); try { stopSpeak(); } catch {} }
async function llm(o) {
  if (!GENS.n && !GENS.busy) GENS.ac = new AbortController();
  const sig = GENS.ac.signal; if (sig.aborted) throw abortErr();
  GENS.n++; genUI();
  try { return await Promise.race([llm0({ ...o, signal: sig }), new Promise((_, rej) => sig.addEventListener("abort", () => rej(abortErr()), { once: true }))]); }
  finally { GENS.n--; genUI(); }
}
// مهلة لحد ما السيرفر يبدأ يرد (من غيرها طلب معلّق كان بيفضل «بيفكر» للأبد)
function timed(signal, ms) { const ac = new AbortController(), t = setTimeout(() => ac.abort(Object.assign(new Error("timeout"), { name: "TimeoutError" })), ms); signal?.addEventListener("abort", () => ac.abort(signal.reason), { once: true }); return { signal: ac.signal, done: () => clearTimeout(t), timedOut: () => ac.signal.reason?.name === "TimeoutError" }; }
async function timedFetch(url, opt, signal, ms = +window.TUTOR_CONFIG?.aiTimeoutMs || 60000) { const T = timed(signal, ms); try { return await fetch(url, { ...opt, signal: T.signal }); } catch (e) { if (T.timedOut()) throw new Error("خدمة الذكاء اتأخرت في الرد (أكتر من " + ms / 1000 + " ثانية). جرّب تاني أو غيّر المزوّد من ⚙️."); throw e; } finally { T.done(); } }
async function llm0(o) {
  if ((o._prov || provider()) === "server") {
    // سيرفر الموقع جرّب كل مزوّداته وكلهم خلصوا/وقعوا، أو السيرفر نفسه مش راد → نكمّل بالخدمات المجانية اللي في المتصفح
    // (مش لو الطالب خلّص حده اليومي اللي صاحب الموقع حاطه، ولا لو السؤال فيه صورة — المجاني مبيشوفش الصور)
    try { return await llm1(o); }
    catch (e) {
      const IM = o.imgs || (o.img ? [o.img] : []);
      if (o.signal?.aborted || e?.name === "AbortError" || IM.length || !["all_limited", "all_failed", "network", "timeout"].includes(e?.code)) throw e;
      setTyping("⏳ سيرفر الموقع مشغول — بكمّل بالخدمة المجانية…");
      try { return await llm1({ ...o, _prov: "free" }); } catch (e2) { if (e2?.name === "AbortError") throw e2; throw e; }
    }
  }
  if ((o._prov || provider()) !== "free") return llm1(o);
  try { return await llm1(o); }
  catch (e) {
    if (e?.code !== "free_down" || o.signal?.aborted) throw e;
    // الخدمات المجانية كلها ماردتش: نجرّب لوحدنا أي مزوّد تاني متاح عند الطالب (من غير ما يغيّر حاجة)
    const alt = window.PX?.on?.() ? "server" : localStorage.getItem("gkey") ? "gemini" : window.puter?.auth?.isSignedIn?.() ? "puter" : "";
    if (!alt) throw e;
    setTyping("⏳ الخدمة المجانية مش ردّة — بجرّب " + ({ server: "سيرفر الموقع", gemini: "Gemini بمفتاحك", puter: "«ذكي» (Puter)" }[alt]) + "…");
    try { return await llm1({ ...o, _prov: alt }); } catch (e2) { if (e2?.name === "AbortError") throw e2; e.message += " — وجرّبت كمان " + alt + ": " + String(e2?.message || e2).slice(0, 80); throw e; }
  }
}
async function llm1({ system, messages, img, imgs, max = 1500, long = false, compact = false, onText, noStyle = false, temperature, signal, tier, _prov }) {
  const IM = imgs || (img ? [img] : []), provider = () => _prov || localStorage.getItem("provider") || "free";
  if (!noStyle && window.TUTOR?.styleNote) system += window.TUTOR.styleNote() + (window.TUTOR.srcNote?.() || "");
  if (provider() === "free") return freeChat({ system, messages, max, onText, signal, tier });
  if (provider() === "puter") return puterChat({ system, messages, imgs: IM, max, onText, tier });
  if (provider() === "local") return localChat({ system, messages, max, compact, onText });
  if (window.voiceOn && !long) { system += window.VOICE_NOTE; max = Math.min(max, 900); }
  const last = messages.length - 1;
  if (provider() === "server") {   // سيرفر الموقع: المفاتيح في environment variables على السيرفر
    if (!window.PX?.on()) throw new Error("سيرفر الـ AI مش متظبط. اختار مزوّد تاني من ⚙️.");
    const out = await PX.chat({ system, messages: messages.map(m => ({ role: m.role, content: String(m.content) })), images: IM, max, temperature, onText, signal });
    return out || "(مفيش رد، جرّب تاني)";
  }
  if (provider() === "claude") {
    const key = localStorage.getItem("key"); if (!key) throw new Error("NOKEY");
    const msgs = messages.map((m, i) => i === last && IM.length ? { role: m.role, content: [...IM.map(d => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: d } })), { type: "text", text: m.content }] } : m);
    const r = await timedFetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" }, body: JSON.stringify({ model: MODEL, max_tokens: max, system, messages: msgs, stream: true, ...(temperature != null ? { temperature } : {}) }) }, signal);
    if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error?.message || r.status); }
    let out = ""; await readSSE(r, j => { if (j.type === "content_block_delta" && j.delta?.text) { out += j.delta.text; onText?.(out); } else if (j.type === "error") throw new Error(j.error?.message || "stream"); });
    return out || "(مفيش رد، جرّب تاني)";
  }
  const key = localStorage.getItem("gkey"); if (!key) throw new Error("NOKEY");
  const model = await geminiModel(key);
  const contents = messages.map((m, i) => ({ role: m.role === "assistant" ? "model" : "user", parts: i === last && IM.length ? [...IM.map(d => ({ inline_data: { mime_type: "image/jpeg", data: d } })), { text: m.content }] : [{ text: m.content }] }));
  const r = await timedFetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`, { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents, generationConfig: { maxOutputTokens: Math.round(max * 2.5), ...(temperature != null ? { temperature } : {}) } }) }, signal);
  if (!r.ok) { const j = await r.json().catch(() => ({})); if (r.status === 404) localStorage.removeItem("gmodel");
    throw new Error(r.status === 429 ? "وصلت للحد المجاني لدلوقتي (طلبات كتير). استنى دقيقة وجرّب تاني، ولو فضلت الرسالة اجرّب بكرة." : (j.error?.message || r.status)); }
  let out = ""; await readSSE(r, j => { const t = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join(""); if (t) { out += t; onText?.(out); } });
  return out || "(مفيش رد، جرّب تاني)";
}

// ===== الذكاء المحلي: دعم النص (مبيشوفش الصور) =====
const PERSONA_LITE = [
  "إنت «ذكي»، مدرّس خصوصي شاطر وظريف وصبور بيساعد أي طالب يذاكر من ملفاته. بتتكلم بنفس لهجة الطالب بشكل طبيعي زي صاحب كبير قاعد جنبه، مش زي كتاب ولا روبوت.",
  "الفهم (ده أهم حاجة):",
  "- اقرا رسالة الطالب كويس وافهم هو عايز إيه فعلًا، مش الكلمات بس. الطالب بيكتب بالعامية وبأخطاء إملائية وأحيانًا بيتكلم صوت، والكلام بيتحوّل لنص فيه كلمات مسموعة غلط أو ناقصة. لو كلمة مش منطقية، خمّن أقرب كلمة مفهومة من سياق المذاكرة واشتغل عليها من غير ما تعلّق على الغلط.",
  "- افهم العامية (المصرية والخليجية وغيرها) والإنجليزي والكلام المخلوط: «مش فاهم/ما فهمت»، «كمّل»، «تاني»، «يعني إيه/وش يعني»، «بسّط»، «هات مثال»، «قصدي». الرد القصير من الطالب بيكمّل على آخر حاجة اتقالت، فكمّل منها.",
  "- لو الطالب صحّحك أو اعترض، فكّر بجد: لو معاه حق اعترف بسرعة وعدّل، ولو غلطان وضّحله بلطف ليه. متوافقش على حاجة غلط عشان تجامله.",
  "- لو السؤال ملوش غير معنى واحد منطقي جاوب على طول. ولو فعلًا فيه معنيين مختلفين خالص اسأل سؤال واحد قصير بس.",
  "الأسلوب:",
  "- ادخل في الإجابة من أول جملة من غير مقدمات ولا مجاملات فاضية، ومتكررش سؤال الطالب. نوّع بدايات ردودك.",
  "- اشرح خطوة خطوة بأمثلة بسيطة من حياة الطالب، وسيب المصطلحات الإنجليزي زي ما هي وشرحها بالعربي.",
  "- اتكلم زي إنسان حقيقي مش قالب جاهز: تفاعل مع إحساس الطالب (لو متضايق أو مش فاهم طمّنه)، واستخدم كلام الناس زي «بص»، «شوف»، «تمام كده؟»، وابعد عن الأسلوب الرسمي والجمل المقالية.",
  "- شجّع الطالب بشكل طبيعي وبجملة قصيرة لما يستاهل، من غير مبالغة.",
  "- لو مش متأكد قول كده بصراحة ومتخترعش معلومة. رد مرتب وواضح ومن غير حشو."
].join("\n");
const PERSONA = window.TEACHER_PERSONA || PERSONA_LITE;   // الشخصية الكاملة من persona.js (المصدر: server/persona.js)
// ===== مجاني بدون تسجيل ولا مفتاح ولا تحميل: خدمات سحابية مفتوحة بتتجرّب بالترتيب =====
// الحد (لو فيه) بيتحسب على IP كل مستخدم، والشغل كله على سيرفراتهم فجهازك مبيتحملش حاجة. بيقرا نص الصفحة مش الصورة.
const FREE_EPS = [
  { name: "LLM7", url: "https://api.llm7.io/v1/chat/completions", model: "fast", auth: "unused" },
  { name: "LLM7", url: "https://api.llm7.io/v1/chat/completions", model: "default", auth: "unused" },
  // الترتيب هنا = ترتيب الاحتياطي: الموديلات اللي مبتفكرش طويل الأول (أسرع)، وبعدين موديلات التفكير
  ...["Meta-Llama-3_3-70B-Instruct", "Mistral-Small-3.2-24B-Instruct", "Mistral-Nemo-Instruct-2407", "gpt-oss-20b", "Qwen3.5-9B", "gpt-oss-120b", "Qwen3-32B"].map(m => ({ name: "OVH " + m, url: "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions", model: m })),   // حد OVH ٢ طلب/دقيقة لكل موديل، فبنلف على أكتر من موديل
  { name: "Kilo", url: "https://api.kilo.ai/api/gateway/chat/completions", model: "kilo-auto/free" }
];
const freeCool = {};
const FREE_LABELS = { auto: "🤖 تلقائي — الأذكى للمسائل والمقارنات، والأسرع للكلام العادي (الافتراضي)", fast: "⚡ متوازن — ذكي وسريع", smart: "🧠 الأذكى (GPT-OSS 120B) — أبطأ شوية", qwen: "Qwen — كويس في العربي" };
// بيقرا الرد بالـ streaming (SSE) وبيعرضه أول بأول في مؤشر الكتابة، وبيرجّع النص الكامل في الآخر.
async function readFreeStream(r, onText, touch) {
  const ct = r.headers.get("content-type") || "";
  if (!/event-stream/i.test(ct) || !r.body) {           // السيرفر رجّع رد عادي مش stream
    const j = await r.json().catch(() => ({})); touch();
    return String(j.choices?.[0]?.message?.content || "");
  }
  const rd = r.body.getReader(), dec = new TextDecoder(); let buf = "", out = "";
  for (;;) {
    const { done, value } = await rd.read(); if (done) break; touch();
    buf += dec.decode(value, { stream: true });
    let i; while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const d = line.slice(5).trim(); if (d === "[DONE]") return out;
      try { const t = JSON.parse(d).choices?.[0]?.delta?.content; if (t) { out += t; onText(out); } } catch {}
    }
  }
  return out;
}
async function freeChat({ system, messages, max, onText, signal, tier }) {
  if (window.voiceOn) { system += window.VOICE_NOTE; max = Math.min(max || 900, 900); }
  const msgs = [{ role: "system", content: PERSONA + "\n" + system }, ...messages.map(m => ({ role: m.role, content: String(m.content) }))], errs = [];
  const K = aiKey(tier), want = { fast: ["Meta-Llama-3_3-70B-Instruct", "Mistral-Small-3.2-24B-Instruct", "fast"], smart: ["gpt-oss-120b", "Meta-Llama-3_3-70B-Instruct"], qwen: ["Qwen3-32B", "Qwen3.5-9B"] }[K] || [];
  const first = want.map(m => FREE_EPS.findIndex(e => e.model === m)).filter(i => i >= 0);
  const order = [...first, ...FREE_EPS.map((_, i) => i).filter(i => !first.includes(i))], now = Date.now();
  const live = order.filter(i => (freeCool[i] || 0) <= now), run = live.length ? live : order;
  const clean = t => t.replace(/<think>[\s\S]*?(<\/think>|$)/g, "").trim();
  const tryOne = async i => {
    const ep = FREE_EPS[i], ac = new AbortController(); signal?.addEventListener("abort", () => ac.abort(), { once: true });
    // لو السيرفر ماردش بأي حاجة خلال ١٠ ثواني نسيبه ونجرّب اللي بعده (بدل ما نستنى ٧٠ ثانية). وبعد أول رد بنديله لحد ٤٥ ثانية فاصل بين كل جزء.
    let to, stalled = false; const arm = ms => { clearTimeout(to); to = setTimeout(() => { stalled = true; ac.abort(); }, ms); };
    let got = false; const touch = () => { got = true; arm(45000); };
    try {
      setTyping((K === "smart" ? "🧠 بيفكر بعمق" : "⏳ بيفكر") + " (" + ep.name + ")..."); arm(10000);
      const body = { model: ep.model, messages: msgs, max_tokens: Math.min(Math.max(max || 900, 900), 2200), temperature: window.voiceOn ? 0.6 : 0.4, stream: true };
      if (/gpt-oss/.test(ep.model)) body.reasoning_effort = pkey() === "smart" ? "high" : "medium";   // التلقائي = تفكير متوسط (أدق من السريع ومن غير انتظار طويل)   // «أذكى» = تفكير أعمق، الباقي متوازن
      const r = await fetch(ep.url, { method: "POST", signal: ac.signal, headers: { "content-type": "application/json", ...(ep.auth ? { authorization: "Bearer " + ep.auth } : {}) }, body: JSON.stringify(body) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error?.message || j.message || "HTTP " + r.status); }
      touch();
      const out = clean(await readFreeStream(r, t => { const c = clean(t); if (c) onText ? onText(c) : setTyping("✍️ " + c.slice(-240)); }, touch));
      if (!out) throw new Error("رد فاضي");
      return out;
    } catch (e) { if (signal?.aborted) throw abortErr(); if (/rate|limit|429|unavailable|quota/i.test(e.message)) freeCool[i] = Date.now() + 60000; if (stalled) freeCool[i] = Date.now() + 30000; errs.push(ep.name.split(" ")[0] + ": " + (stalled ? "اتأخر" : /fetch|network|load failed/i.test(e.message) ? "مش قادر أوصله" : e.message)); return null; }
    finally { clearTimeout(to); }
  };
  for (const i of run) { if (signal?.aborted) throw abortErr(); const out = await tryOne(i); if (out) return out; }
  // كلهم فشلوا: غالبًا قطع نت لحظي — نستنى ثانية ونص ونجرّب أول تلاتة تاني (من غير فترة التهدئة)
  if (!signal?.aborted) { await new Promise(r => setTimeout(r, 1500)); for (const i of order.slice(0, 3)) { if (signal?.aborted) throw abortErr(); const out = await tryOne(i); if (out) return out; } }
  const uniq = [...new Set(errs)].slice(0, 4);
  throw Object.assign(new Error("الخدمات المجانية ماردّتش دلوقتي (" + uniq.join(" | ") + ")"), { code: "free_down" });
}
async function ensurePuter() {
  if (location.protocol === "file:") throw new Error("Puter مبيشتغلش لما تفتح الموقع بالضغط المزدوج (file://). استخدم «مجاني بدون تسجيل» من ⚙️، أو ارفع الموقع على GitHub Pages.");
  if (!window.puter) await loadScript("https://js.puter.com/v2/");
}
// ===== Puter.js: ذكاء سحابي مجاني بدون مفتاح (مفيهوش Gemini) وبيشوف الصور =====
const PM = { auto: ["🤖 تلقائي — الأذكى للمسائل، والأسرع للكلام العادي (الافتراضي)", ["openai/gpt-5.4-nano", "qwen/qwen3.7-plus"]], fast: ["⚡ سريع وخفيف (GPT nano)", ["openai/gpt-5.4-nano", "qwen/qwen3.7-plus"]], smart: ["🧠 أذكى (GPT-5.5)", ["openai/gpt-5.5", "openai/gpt-5.4-nano"]], qwen: ["Qwen — كويس في العربي", ["qwen/qwen3.7-plus", "openai/gpt-5.4-nano"]] };
const pkey = () => PM[localStorage.getItem("pmodel")] ? localStorage.getItem("pmodel") : "auto";
// «تلقائي»: المسائل والحسابات والمقارنات و«ليه» والامتحانات → الموديل الأذكى، والباقي → الأسرع (عشان الرد ميتأخرش)
const aiKey = tier => pkey() === "auto" ? (tier === "smart" ? "smart" : "fast") : pkey();
const ptxt = r => { if (r == null) return ""; if (typeof r === "string") return r; const c = r.message?.content ?? r.text ?? r.content; if (typeof c === "string") return c; if (Array.isArray(c)) return c.map(x => x.text || "").join(""); return String(r); };
const perr = e => e?.error?.message || e?.message || (typeof e === "string" ? e : JSON.stringify(e));
async function puterChat({ system, messages, imgs, max, onText, tier }) {
  await ensurePuter();
  if (!window.puter?.ai) throw new Error("مكتبة Puter مش متحمّلة. اتأكد إن النت شغال وإن الموقع بيحمّل js.puter.com.");
  const sys = PERSONA + "\n" + system, opts = m => ({ model: m, stream: true, max_tokens: Math.max(max || 900, 600), temperature: 0.6 });
  const read = async r => { let out = ""; if (r && typeof r[Symbol.asyncIterator] === "function") { for await (const p of r) { out += p?.text ?? ptxt(p?.message ?? p) ?? ""; onText ? onText(out) : setTyping("✍️ " + out.slice(-240)); } } else out = ptxt(r); return out.trim(); };
  let err;
  for (const m of PM[aiKey(tier)][1]) {
    try {
      let r; const lim = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("Puter اتأخر في الرد")), ms))]);
      if (imgs?.length) {   // بنبعت الصور مع نص المحادثة كله في رسالة واحدة
        const tr = messages.slice(0, -1).map(x => (x.role === "user" ? "الطالب: " : "المدرس: ") + String(x.content).slice(0, 700)).join("\n");
        r = await lim(puter.ai.chat(sys + "\n\n" + (tr ? "المحادثة لحد دلوقتي:\n" + tr + "\n\n" : "") + messages.at(-1).content, imgs.map(d => "data:image/jpeg;base64," + d), opts(m)), 90000);
      } else r = await lim(puter.ai.chat([{ role: "system", content: sys }, ...messages.map(x => ({ role: x.role, content: String(x.content) }))], opts(m)), 90000);
      const out = await lim(read(r), 180000); if (out) return out; err = new Error("الموديل مرجّعش رد");
    } catch (e) {
      err = new Error(perr(e)); if (/auth|sign.?in|login|token|popup|cancel|unauthor/i.test(err.message)) throw new Error("لازم تسجّل دخول Puter (مجاني): افتح ⚙️ واضغط «تسجيل دخول Puter» وبعدين اسأل تاني. (" + err.message + ")");
    }
  }
  throw err;
}
// ===== الذكاء المحلي: برومبت مختصر (الموديل الصغير بيتلخبط مع البرومبتات الطويلة) + فحص إن الكلام فعلًا في الكتاب =====
const LOCAL_SYS = `إنت «ذكي»، مدرّس خصوصي شاطر. بتتكلم بلهجة الطالب نفسه ببساطة وود، وبتجاوب على طول من غير مقدمات.
القواعد:
١) نفّذ أي طلب الطالب يقوله فورًا من عندك: ترجمة، حل سؤال، شرح، تلخيص، إعراب، أمثلة، كتابة، مراجعة. متطلبش منه يفتح صفحة ولا يكتب النص ولا تسأله أسئلة قبل ما تجاوب.
٢) لو الطالب قال الطلب بكلمات ناقصة أو بالعامية أو من الميكروفون، افهم قصده من السياق وشغّله، وعدّل أي كلمة غلط من عندك من غير ما تعلّق.
٣) لو تحت «نص من الكتاب» جاوب منه بس وقول «من الكتاب». لو المعلومة مش فيه قول «مش لاقي المعلومة دي في الكتاب المحدد.»
٤) متألفش رقم صفحة ولا اسم درس ولا معلومة مش قدامك. لو مش متأكد من نقطة قول «مش متأكد» وكمّل باللي تعرفه.
٥) لو رد الطالب كلمة قصيرة زي «كمّل» أو «تاني» أو «مش فاهم» كمّل من آخر رد وبسّطه بمثال.
٦) لو صحّحك وكان صح اعترف وعدّل، ولو غلط وضّحله بلطف.
٧) لو طلب ترجمة اكتب الترجمة مباشرة، ولو طلب حل اكتب الإجابة الأول وبعدها سبب قصير.
اكتب إجابة مرتبة وقصيرة من غير حشو.`;
const LOCAL_VOICE = "\nإنت في مكالمة صوتية: رد في ٢ لـ ٣ جمل قصيرة بلهجة الطالب، من غير قوايم ولا رموز ولا ماركداون.";
const STOPW = new Set(tok("ايه اي هو هي ده دي دا في من علي على عن انا انت لو يعني ممكن اشرح اشرحلي قولي عايز عاوز مش لا ايوه كمل تاني بس كده ليه ازاي امتي فين مين هل ما ماذا كيف اللي الي معني معنى وضح فهمني هات مثال لي لو سمحت ياريت جاوب حل اسال سؤال الصفحه صفحه الكتاب كتاب دلوقتي هنا ازيك ازيكم اهلا اهلين مرحبا سلام صباح مساء الخير النور عامل اخبارك شكرا تسلم تمام ماشي اوكي هاي هلا باي"));
// 0: كلام عادي/رد قصير (مفيهوش كلمات محتوى) — 1: الكلمات موجودة في نص الكتاب — -1: مش موجودة في اللي وصلنا من الكتاب
function bookRel(q, ...texts) {
  const w = tok(q).filter(x => x.length > 2 && !STOPW.has(x));
  if (!w.length) return 0;
  const hay = new Set(tok(texts.join(" ")));
  return w.some(x => hay.has(x)) ? 1 : -1;
}
// هل الطالب بيشاور على الصفحة المفتوحة؟ لو لأ منستناش قراءة الصفحة/OCR (ده اللي بيبطّئ) ونجاوب على طول
const refersPage = q => /(صفحه|الصفح|هنا|دي|ده|دا|هذا|هذه|السؤال|سؤال|التمرين|تمرين|الجمله|الكلمه|الفقره|الجزء|القطعه|النص|فوق|قدامي|اللي مكتوب|الدرس|درس)/.test(norm(q));
const shortReply = q => history.length && q.trim().split(/\s+/).length <= 3 ? "\n(ده رد قصير من الطالب على آخر رد — كمّل من آخر نقطة.)" : "";
const setTyping = t => { const el = document.querySelector("#chat .typing"); if (el) el.textContent = t; };
// localai.js بيتحمّل بس لما حد يختار «محلي» (مش مع فتح الموقع) — والموديل نفسه مبيتحمّلش غير لما تسأل أو تدوس «حمّل الآن»
let localAIP = null;
function ensureLocalAI() {
  if (window.LOCAL_AI) return Promise.resolve(window.LOCAL_AI);
  return localAIP ||= new Promise((res, rej) => { const s = document.createElement("script"); s.src = "localai.js?v=" + (document.querySelector('script[src^="app.js"]')?.src.split("v=")[1] || "1");
    s.onload = () => window.LOCAL_AI ? res(window.LOCAL_AI) : rej(new Error("ملف localai.js اتحمّل بس فيه مشكلة."));
    s.onerror = () => { localAIP = null; rej(new Error("مقدرتش أحمّل localai.js — اتأكد إنه مرفوع مع باقي ملفات الموقع.")); }; document.head.append(s); });
}
async function localChat({ system, messages, max, compact, onText }) {
  await ensureLocalAI();
  if (!LOCAL_AI.supported()) throw new Error("متصفحك مش بيدعم WebGPU، فالذكاء المحلي مش هيشتغل. جرّب Chrome/Edge حديث، أو اختار «مجاني بدون تسجيل» من ⚙️.");
  const cut = (x, n) => x.length > n ? x.slice(0, n) + "…" : x;
  const build = lim => {
    let m = messages.map((x, i) => ({ role: x.role, content: cut(String(x.content), i === messages.length - 1 ? lim : 700) }));
    while (m.length > 1 && m.reduce((a, x) => a + x.content.length, 0) > lim + 1400) m.shift();
    while (m.length > 1 && m[0].role !== "user") m.shift();
    return m;
  };
  const go = lim => LOCAL_AI.chat({ system: compact ? system + (window.voiceOn ? LOCAL_VOICE : "") : cut(PERSONA_LITE + "\n" + system, 1500), temperature: compact ? 0.25 : 0.5, messages: build(lim), max: Math.min(max || 900, window.voiceOn ? 450 : compact ? 650 : 1100),
    onProg: p => setTyping("بحمّل الذكاء المحلي… " + Math.round((p.progress || 0) * 100) + "% (مرة واحدة بس، وبعدها بيشتغل من غير نت)"),
    onToken: t => onText ? onText(t) : setTyping("✍️ " + t.slice(-240)) });
  try { return await go(compact ? 2400 : 3400); }
  catch (e) { if (/context|window|exceed|token/i.test(e.message)) return await go(1500); throw e; }
}
// نص الصفحة: طبقة النص في الـ PDF أولًا، وبعدها OCR لو الصفحة صورة، وبعدها البيانات القديمة
const ptCache = new Map(), ocrW = {};
const okText = t => t.replace(/\s/g, "").length >= 60;
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("مقدرتش أحمّل مكتبة OCR (محتاج إنترنت أول مرة)")); document.head.append(s); }); }
async function ocrPage(id, n, d = null) {
  try {
    setTyping(`بقرا صفحة ${n} بالـ OCR (أول مرة بياخد وقت)...`);
    if (!window.Tesseract) await loadScript("https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js");
    const lang = bookLang(id); ocrW[lang] ||= Tesseract.createWorker(lang);
    const w = await ocrW[lang], r = await w.recognize(await snap(null, n, 2000, d));
    return r.data.text || "";
  } catch (e) { console.warn("OCR", e); return ""; }
}
async function pageText(id, n) {
  const k = id + "|" + n; if (ptCache.has(k)) return ptCache.get(k);
  const b = BK[id]; let t = b?.t?.[n - 1] || "";   // الفهرس المحفوظ الأول (أسرع)
  const d = docs[id] || (cur.id === id ? doc : null) || await loadDoc(id);
  if (!okText(t) && d) { try { const tc = await (await d.getPage(n)).getTextContent(); t = tc.items.map(i => i.str + (i.hasEOL ? "\n" : " ")).join(""); } catch {} }
  if (!okText(t)) { const p = pages.find(x => x.id === id && x.page === n); if (p && p.text) t = p.text; }
  let ocr = false; if (!okText(t) && d) { t = await ocrPage(id, n, d); ocr = true; }
  t = t.normalize("NFKC").replace(/[\u200e\u200f]/g, "").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
  if (okText(t)) { ptCache.set(k, t); if (b && !b.s[n - 1]) { b.t[n - 1] = bkClean(t); b.s[n - 1] = ocr ? 2 : 1; bkIndex(b); bkSave(id, b); } }
  return t;
}

// ===== فهرس الكتاب كله: الذكي يعرف كل صفحات الكتاب المفتوح ويجيب الصفحة المناسبة للسؤال =====
// الخطوات: (١) قراءة سريعة لطبقة النص في الـ PDF لكل الصفحات  (٢) لو الكتاب صور: زرار «ذاكر الكتاب» بيقرا الباقي بالـ OCR في الخلفية
// والنتيجة بتتحفظ في المتصفح (IndexedDB) فمش بتتعاد. (٣) وقت السؤال بندوّر (BM25) في الكتاب كله ونبعت للـ AI أقرب الصفحات.
const BK = {};
const bkClean = t => (t || "").normalize("NFKC").replace(/[\u200e\u200f]/g, "").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
const tick = ms => new Promise(r => setTimeout(r, ms));
function bkIndex(b) {
  b.v = (b.v || 0) + 1;   // نسخة الفهرس: أي تغيير في النص بيعيد بناء المقاطع/الفهرس في rag.js
  b.df = {}; b.pdf = {}; let tot = 0;
  b.P = b.t.map((txt, i) => {
    if (!txt) return null;
    const w0 = tok(txt), w = []; w0.forEach(x => { w.push(x); if (x.length >= 5 && x[0] === "و") w.push(x.slice(1)); }), tf = {}, pf = {};   // «وسقراط» تتفهرس كمان «سقراط»
    w.forEach(x => { tf[x] = (tf[x] || 0) + 1; if (x.length >= 5) { const p = x.slice(0, 4); pf[p] = (pf[p] || 0) + 1; } });   // البادئة (٤ حروف) بتساعد مع أخطاء الـ OCR
    Object.keys(tf).forEach(x => b.df[x] = (b.df[x] || 0) + 1); Object.keys(pf).forEach(x => b.pdf[x] = (b.pdf[x] || 0) + 1);
    tot += w.length; return { page: i + 1, len: w.length, tf, pf };
  });
  b.N = b.P.filter(Boolean).length; b.avg = tot / (b.N || 1);
}
const bkSave = (id, b) => idbSet("idx:" + id, { n: b.n, t: b.t, s: b.s, q: b.q ? 1 : 0, h: b.h || null, hv: b.hv || 0 });
const bkHave = b => b.s.filter(Boolean).length;
const BKSTOP = new Set(["كتاب","صفحه","درس","ايه","مين","هو","هي","في","من","علي","عن","ده","دي","اين","فين","امتي","ازاي","معني","كلمه","اشرح","اشرحلي","قولي","عايز","هل","ما","ماذا","هذا","هذه"]);
function bkHits(q, k = 4, only = null, range = null) {
  if (range) { const r = bkHits(q, k, range.id, { ...range, hard: 1 }); if (r.length) return r; range = null; }
  const qt = [...new Set(tok(q))]; if (!qt.length) return [];
  const out = [];
  for (const id in BK) {
    const b = BK[id]; if (!b?.N || !b.P || (only && id !== only)) continue;
    const nm = tok(NAMES[id] || "").filter(w => w.length >= 3), named = nm.some(w => qt.includes(w)), boost = (id === cur.id && doc ? 1.25 : 1) * (named ? 1.8 : 1);   // الكتاب المفتوح، أو اللي اتذكر اسمه في السؤال، ليه أولوية
    const qb = qt.filter(w => !BKSTOP.has(w) && !(named && nm.includes(w)));   // كلمات عامة واسم الكتاب نفسه مش بتتحسب كمحتوى
    if (!qb.length) continue;
    const idf = d => Math.log(1 + (b.N - d + .5) / (d + .5));
    for (const p of b.P) {
      if (!p) continue; if (range?.hard && (p.page < range.from || p.page > range.to)) continue; let s = 0; const nl = .25 + .75 * p.len / b.avg;
      for (const w of qb) {
        const f = p.tf[w];
        if (f) s += idf(b.df[w]) * f * 2.2 / (f + 1.2 * nl);
        else if (w.length >= 5) { const g = p.pf[w.slice(0, 4)]; if (g) s += .45 * idf(b.pdf[w.slice(0, 4)]) * g * 2.2 / (g + 1.2 * nl); }
      }
      if (s > 0) out.push({ id, book: NAMES[id] || "", page: p.page, text: b.t[p.page - 1], score: s * boost });
    }
  }
  out.sort((x, y) => y.score - x.score);
  if (!out.length || out[0].score < 1) return [];
  return out.slice(0, k).filter(x => x.score >= out[0].score * .4);
}
// أحسن جزء في الصفحة للسؤال (عشان مانبعتش أول الصفحة بس لو الإجابة في آخرها)
function bkWindow(text, q, len) {
  if (text.length <= len) return text;
  const qt = new Set(tok(q)); let best = 0, bs = -1;
  for (let i = 0; i < text.length; i += Math.floor(len / 2)) { const w = tok(text.slice(i, i + len)); let sc = 0; w.forEach(x => { if (qt.has(x)) sc++; }); if (sc > bs) { bs = sc; best = i; } }
  return text.slice(best, best + len);
}
function bookCtx(hits, q, k = 4, len = 1100) {
  if (hits?.unit) { k = Math.max(k, 5); len = Math.max(len, 1300); }
  const oth = (hits || []).filter(h => hits?.unit || !(h.id === cur.id && h.page === cur.page)).slice(0, k), b = BK[cur.id]; let s = hits?.note ? "\n\n(" + hits.note + ")" : "";
  if (oth.length) s += "\n\nمقاطع من صفحات تانية في نفس الكتاب ليها علاقة بالسؤال (مستخرجة آليًا وممكن فيها أخطاء):\n" + oth.map(h => `[${h.id === cur.id ? "" : "كتاب " + h.book + " - "}صفحة ${h.page}]\n${bkWindow(h.text, q, len)}`).join("\n---\n");
  if (b && bkHave(b) < b.n * .9) s += `\n\n(ملحوظة: الفهرس قرا ${bkHave(b)} من ${b.n} صفحة بس، فممكن الإجابة تكون في صفحة لسه متقراتش.)`;
  return s;
}
async function bkLoadFor(id, d) {
  if (BK[id] && BK[id].n === d.numPages) return BK[id];
  const n = d.numPages, sv = await idbGet("idx:" + id);
  const b = BK[id] = sv && sv.n === n && Array.isArray(sv.t) ? { n, t: sv.t, s: sv.s, q: sv.hv === 2 ? sv.q : 0, h: sv.h || [], hv: sv.hv || 0 } : { n, t: Array(n).fill(""), s: Array(n).fill(0), h: [], hv: 2 };
  bkIndex(b); return b;
}
const bkLoad = () => cur.id && doc ? bkLoadFor(cur.id, doc) : null;
async function bkPreload() {   // أول ما الموقع يفتح: حمّل فهارس كل الكتب المحفوظة عشان الذكي يعرفها كلها
  for (const e of LIB) { if (BK[e.id]) continue; const sv = await idbGet("idx:" + e.id); if (sv && Array.isArray(sv.t)) { BK[e.id] = { n: sv.n, t: sv.t, s: sv.s, q: sv.hv === 2 ? sv.q : 0, h: sv.h || [], hv: sv.hv || 0 }; bkIndex(BK[e.id]); } }
  window.RAG?.kick();
}
async function bkBackground(ids) {   // قراءة سريعة لطبقة النص في كتب مش مفتوحة
  for (const id of ids) {
    try { const d = await loadDoc(id); if (!d) continue; const b = await bkLoadFor(id, d); await bkEnsureQuick(id, d, b); } catch (e) { console.warn("bk bg", e); }
    await tick(50);
  }
}
// العناوين من حجم الخط في طبقة النص: السطر اللي خطه أكبر بوضوح من متوسط الصفحة غالبًا عنوان درس/قسم
function pageHeads(tc) {
  const lines = new Map();
  for (const x of tc.items) { if (!x.str || !x.str.trim()) continue; const tr = x.transform || [0, 0, 0, 0, 0, 0], h = Math.hypot(tr[2], tr[3]) || x.height || 0, y = Math.round(tr[5] / 3);
    const L = lines.get(y) || { t: "", h: 0 }; L.t += x.str + " "; L.h = Math.max(L.h, h); lines.set(y, L); }
  const ls = [...lines.values()].map(l => ({ t: l.t.replace(/\s+/g, " ").trim(), h: l.h })).filter(l => l.t);
  const hs = ls.map(l => l.h).sort((a, b) => a - b), med = hs[Math.floor(hs.length / 2)] || 0;
  if (!med) return [];
  return ls.filter(l => l.h >= med * 1.25 && l.t.length >= 3 && l.t.length <= 90 && l.t.split(" ").length <= 12 && /[A-Za-z\u0621-\u064A]/.test(l.t)).slice(0, 4).map(l => ({ t: l.t, s: +(l.h / med).toFixed(2) }));
}
// قراءة النص مرة واحدة بس حتى لو أكتر من حد طلبها في نفس الوقت (فتح الكتاب + شغل المعالجة في الخلفية)
const bkEnsureQuick = (id, d, b) => b.qp ||= (b.q ? Promise.resolve() : (b.q = 1, bkQuick(id, d, b)));
async function bkQuick(id, d, b) {   // قراءة طبقة النص (سريعة) + العناوين
  let ch = false; b.h ||= [];
  const redo = b.hv !== 2; b.hv = 2;   // فهارس قديمة: نقرا العناوين مرة واحدة من غير ما نمسح النص
  for (let i = 1; i <= b.n; i++) {
    if (b.s[i - 1] && !(redo && b.s[i - 1] === 1)) continue;
    try {
      const tc = await (await d.getPage(i)).getTextContent(), t = bkClean(tc.items.map(x => x.str + (x.hasEOL ? "\n" : " ")).join(""));
      if (okText(t)) { b.t[i - 1] = t; b.s[i - 1] = 1; b.h[i - 1] = pageHeads(tc); ch = true; }
      else if (!b.s[i - 1]) { const p = pages.find(x => x.id === id && x.page === i); if (p?.text && okText(p.text)) { b.t[i - 1] = bkClean(p.text); b.s[i - 1] = 1; ch = true; } }
    } catch {}
    if (i % 12 === 0) { window.JOBS?.progress(id, "extracting", i, b.n); await tick(0); }
  }
  const e = LIB.find(x => x.id === id), smp = b.t.filter(Boolean).slice(0, 30).join(" "), lat = (smp.match(/[A-Za-z]/g) || []).length, arb = (smp.match(/[\u0621-\u064A]/g) || []).length;
  if (e && smp.length > 300) { const L = lat > arb * 3 ? "eng" : arb > lat * 3 ? "ara" : "ara+eng"; if (e.lang !== L && !e.langSet) { e.lang = L; libSave(); } }
  if (ch) bkIndex(b); bkSave(id, b); window.RAG?.kick();
}
async function bkOcr(id, d, b, onProg) {   // OCR للصفحات اللي فاضلة (بطيء بس بيشتغل في الخلفية وبيتحفظ)
  if (b.run) return; b.run = true; b.stop = false;
  try {
    if (!window.Tesseract) await loadScript("https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js");
    const lang = bookLang(id); ocrW[lang] ||= Tesseract.createWorker(lang);
    const w = await ocrW[lang], todo = []; for (let i = 0; i < b.n; i++) if (!b.s[i]) todo.push(i + 1);
    let k = 0;
    for (const n of todo) {
      if (b.stop) break;
      let t = ""; try { t = (await w.recognize(await snap(null, n, 1600, d))).data.text || ""; } catch (e) { console.warn("bk OCR", e); }
      b.t[n - 1] = bkClean(t); b.s[n - 1] = 2; k++;
      if (k % 5 === 0) { bkIndex(b); bkSave(id, b); }
      onProg?.(k, todo.length); window.JOBS?.progress(id, "ocr", k, todo.length); await tick(20);
    }
  } finally { b.run = false; bkIndex(b); bkSave(id, b); }
}
let bkNode = null;
function bkRender(b, id) {
  if (!bkNode || bkNode._id !== id) { bkNode = document.createElement("div"); bkNode.className = "m a"; bkNode._id = id; $("chat").append(bkNode); }
  const nd = bkNode, have = bkHave(b), full = have >= b.n * .95, p = document.createElement("div"); nd.textContent = "";
  const btn = (label, fn) => { const x = document.createElement("button"); x.type = "button"; x.className = "bkbtn"; x.textContent = label; x.onclick = fn; return x; };
  if (b.run) {
    p.textContent = `📖 بذاكر الكتاب... ${have} من ${b.n} صفحة. تقدر تكمل تسأل عادي، وكل ما يخلص صفحات أكتر بجاوبك أدق.`; nd.append(p, btn("⏸ وقّف", () => { b.stop = true; }));
  } else if (full) {
    p.textContent = `📚 أنا قريت الكتاب كله (${have} صفحة). اسألني عن أي حاجة فيه وهقولك هي في أنهي صفحة.`; nd.append(p);
  } else {
    p.textContent = have ? `📚 أنا قريت ${have} من ${b.n} صفحة في الكتاب ده، والباقي صور محتاجة قراءة بالـ OCR.` : `📚 الكتاب ده صور (مفيهوش نص)، فمحتاج أقراه بالـ OCR عشان أعرف اللي فيه.`;
    const sm = document.createElement("small"); sm.textContent = " بيشتغل في الخلفية، وممكن ياخد وقت حسب حجم الكتاب (سيب الصفحة مفتوحة)، وبيتحفظ في متصفحك فمش هتعيده.";
    p.append(sm); nd.append(p);
    const e = LIB.find(x => x.id === id), sel = document.createElement("select"); sel.className = "bkbtn"; sel.title = "لغة الكتاب (للقراءة بالـ OCR)";
    [["ara", "الكتاب عربي"], ["eng", "الكتاب إنجليزي"], ["ara+eng", "عربي + إنجليزي (أبطأ)"]].forEach(([v, l]) => sel.append(new Option(l, v))); sel.value = e?.lang || "ara"; sel.onchange = () => { if (e) { e.lang = sel.value; e.langSet = 1; libSave(); } };
    nd.append(sel, btn(have ? "📖 ذاكر الباقي" : "📖 ذاكر الكتاب كله", () => bkStart(b, id)));
    if (LIB.length > 1 && !bkAll.run) nd.append(btn("📚 ذاكر كل كتبي", () => bkStartAll()));
  }
  chatScroll();
}
async function bkStart(b, id) {
  const d = docs[id] || doc; let last = 0;
  bkRender(b, id);
  try { await bkOcr(id, d, b, () => { const t = Date.now(); if (t - last > 1500) { last = t; bkRender(b, id); } }); }
  catch (e) { const m = document.createElement("div"); m.textContent = "⚠️ " + e.message; bkNode?.append(m); }
  bkRender(b, id);
}
const bkAll = { run: false, stop: false, cur: null };
let bkAllNode = null;
function bkAllRender() {
  if (!bkAllNode) { bkAllNode = document.createElement("div"); bkAllNode.className = "m a"; $("chat").append(bkAllNode); }
  const nd = bkAllNode, c = bkAll.cur; nd.textContent = "";
  if (!bkAll.run) { nd.textContent = "✅ خلصت مذاكرة كل كتبك."; return; }
  nd.textContent = c ? `📚 بذاكر كل كتبك... دلوقتي: ${NAMES[c.id] || ""} (${c.i + 1} من ${c.m}) — ${bkHave(c.b)} من ${c.b.n} صفحة.` : "📚 بجهّز مذاكرة كل كتبك...";
  const x = document.createElement("button"); x.type = "button"; x.className = "bkbtn"; x.textContent = "⏸ وقّف"; x.onclick = () => { bkAll.stop = true; if (c) c.b.stop = true; }; nd.append(x);
  chatScroll();
}
async function bkStartAll() {
  if (bkAll.run) return; bkAll.run = true; bkAll.stop = false; bkAll.cur = null; bkAllRender(); let last = 0;
  try {
    const ids = LIB.map(x => x.id);
    for (let i = 0; i < ids.length && !bkAll.stop; i++) {
      const id = ids[i], d = await loadDoc(id); if (!d) continue;
      const b = await bkLoadFor(id, d); await bkEnsureQuick(id, d, b);
      if (bkHave(b) >= b.n * .95 || b.run) continue;
      bkAll.cur = { id, i, m: ids.length, b }; bkAllRender();
      await bkOcr(id, d, b, () => { const t = Date.now(); if (t - last > 1500) { last = t; bkAllRender(); } });
    }
  } catch (e) { console.warn(e); }
  bkAll.run = false; bkAllRender(); const b = BK[cur.id]; if (b && cur.id) bkRender(b, cur.id);
}
async function bkInit() {
  const id = cur.id, d = doc; if (!id || !d) return;
  const b = await bkLoad(); if (!b || d !== doc) return;
  await bkEnsureQuick(id, d, b);
  if (d !== doc || cur.id !== id) return;
  bkRender(b, id);
}

// ===== فهم «يونيت/وحدة/شابتر رقم كذا»: بنحدد صفحات الوحدة من الفهرس ونجاوب من جواها =====
const UNUM = { "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10, "11": 11, "12": 12,
  وان: 1, ون: 1, one: 1, واحد: 1, واحده: 1, الاول: 1, الاولي: 1, اولي: 1, اول: 1, first: 1,
  تو: 2, two: 2, اتنين: 2, اثنين: 2, الثاني: 2, الثانيه: 2, التاني: 2, التانيه: 2, ثانيه: 2, second: 2,
  ثري: 3, تري: 3, three: 3, تلاته: 3, ثلاثه: 3, الثالث: 3, الثالثه: 3, التالت: 3, التالته: 3, ثالثه: 3, third: 3,
  فور: 4, four: 4, اربعه: 4, الرابع: 4, الرابعه: 4, الرابعة: 4, fourth: 4,
  فايف: 5, five: 5, خمسه: 5, الخامس: 5, الخامسه: 5, fifth: 5,
  سيكس: 6, six: 6, سته: 6, السادس: 6, السادسه: 6, sixth: 6,
  سفن: 7, seven: 7, سبعه: 7, السابع: 7, السابعه: 7,
  ايت: 8, eight: 8, تمانيه: 8, ثمانيه: 8, الثامن: 8, الثامنه: 8,
  ناين: 9, nine: 9, تسعه: 9, التاسع: 9, التاسعه: 9,
  تن: 10, ten: 10, عشره: 10, العاشر: 10, العاشره: 10, الحادي: 11, اثني: 12 };
const UNITKW = "(?:ال)?(?:يونيت|يونت|يونيتي|units?|وحده|شابتر|تشابتر|chapter|باب|فصل|ليسون|لسون|lessons?)";
const UNITNUM = "(\\d+|" + Object.keys(UNUM).filter(k => !/^\d+$/.test(k)).join("|") + ")";
const UNIT_RE = new RegExp("(?:^|\\s)(" + UNITKW + ")\\s*(?:رقم\\s*|number\\s*|no\\.?\\s*)?" + UNITNUM + "(?=\\s|$|[.,:؟?!،])");
const UNIT_HEAD = new RegExp("(?:^|[^a-z\\u0621-\\u064A])(" + UNITKW + ")\\s*[:\\-.]?\\s*" + UNITNUM + "(?![a-z0-9\\u0621-\\u064A])", "g");
const UNIT_STOP = new Set(["اشرح", "اشرحلي", "اشرحي", "شرح", "فهمني", "فسر", "لي", "في", "من", "علي", "عن", "يا", "عايز", "عاوز", "ممكن", "لو", "سمحت", "ياريت", "الدرس", "درس", "ده", "دي", "دا", "هو", "هي", "بتاع", "بتاعه", "كده", "اللي", "معايا", "قولي", "الي", "انا", "اوي", "ايه", "ما", "كلمني", "explain", "me", "in", "the", "of", "about", "please", "can", "you", "tell", "what", "is", "and", "و", "ب"]);
const numOf = w => UNUM[w] || (/^\d+$/.test(w) ? +w : 0);
function parseUnit(q) {
  const n = norm(q), m = n.match(UNIT_RE); if (!m) return null;
  const num = numOf(m[2]); if (!num) return null;
  const topic = n.replace(m[0], " ").split(/[\s.,:؟?!،]+/).filter(w => w.length > 1 && !UNIT_STOP.has(w)).join(" ");
  return { n: num, topic, label: `${m[1]} ${num}`.replace(/^ال/, "") };
}
function unitRange(id, n) {   // أول صفحة فيها عنوان الوحدة n لحد قبل عنوان الوحدة اللي بعدها
  const b = BK[id]; if (!b?.N) return null; const heads = [];
  for (let i = 0; i < b.n; i++) {
    const t = b.t[i]; if (!t) continue; const h = norm(t.slice(0, 400)), found = [];
    for (const m of h.matchAll(UNIT_HEAD)) { const k = numOf(m[2]); if (k) found.push(k); }
    if (!found.length || new Set(found).size >= 3) continue;   // صفحة الفهرس بتذكر وحدات كتير: مش بداية وحدة
    heads.push([found[0], i + 1]);
  }
  const st = heads.find(x => x[0] === n); if (!st) return null;
  const nx = heads.find(x => x[1] > st[1] && x[0] > n);
  return { id, from: st[1], to: Math.min(b.n, nx ? nx[1] - 1 : st[1] + 40) };
}
function findUnit(n, q) {
  const ids = doc ? [cur.id] : ($("book").value ? [$("book").value] : LIB.map(x => x.id)), qt = tok(q), found = [];
  for (const id of ids) { const r = unitRange(id, n); if (r) found.push([r, tok(NAMES[id] || "").some(w => w.length >= 3 && qt.includes(w)) ? 1 : 0]); }
  found.sort((a, b) => b[1] - a[1]); return found[0]?.[0] || null;
}
const histN = n => history.slice(window.voiceOn ? -Math.max(n, 10) : -n);   // في المكالمة الصوتية بنفتكر كلام أكتر عشان الحوار يكمّل طبيعي

// ===== فهم أوامر الطالب: عدد الأسئلة، اقرالي (واحدة / كلها)، وشغل على الجزء المحدد لو فيه تحديد =====
const FOLLOW = `\n- نفّذ طلب الطالب بالظبط: لو حدد عدد الأسئلة أو رقم سؤال معين أو قال «كلها» اعمل كده. ولو طلب حل أسئلة من غير ما يحدد عدد، حُلّ سؤال واحد بس (أول واحد) إلا لو قال غير كده.`;
const SYSTEM_I = `أنت مدرّس خصوصي ذكي. الطالب حدد جزءًا من صفحة في كتابه وقال لك طلبه، وهتاخد نص الجزء المحدد (OCR وممكن فيه أخطاء صغيرة).
- نفّذ طلب الطالب **بالظبط**: لو طلب سؤالين حُلّ سؤالين، ولو طلب كذا سؤال أو «كلها» حُلّ العدد ده، ولو طلب سؤال معين بالرقم حُلّه، ولو طلب شرح اشرح، ولو طلب ترجمة ترجم.
- لو الطالب مذكرش عدد ولا نطاق اشتغل على سؤال واحد بس (أول سؤال كامل).
- الجزء المحدد هو محور الشرح، لكن لو الطالب سأل عن كلمة أو فكرة مش مشروحة فيه فاشرحها من معلوماتك.
- ${MCQ}
- لو مش واضح قول كده ومتخترعش إجابة.
${GEN}
- رد بنفس لغة الطالب.`;
const SYSTEM_IV = SYSTEM_I.replace("وهتاخد نص الجزء المحدد (OCR وممكن فيه أخطاء صغيرة)", "وهتاخد صورة الجزء المحدد");
// ===== التحديد بالأصفر (سطر): بنجيب السؤال الكامل اللي حوالين السطر ده (فوقه وتحته) مش السطر لوحده =====
const SYSTEM_B = `أنت مدرّس خصوصي ذكي. الطالب أشّر بالأصفر على سطر واحد جوه سؤال في كتابه، وهتاخد السطر ده مع النص اللي حواليه (OCR وممكن فيه أخطاء صغيرة).
- السطر ده **جزء من سؤال**، والسؤال ممكن يكمل في السطور اللي تحته (الاختيارات a, b, c, d) أو يبدأ في السطور اللي فوقه.
- حُلّ **السؤال الكامل اللي فيه السطر ده** بس (بما فيه اختياراته)، وتجاهل أي سؤال تاني ظاهر في النص.
- ${MCQ}
- لو السطر مش جزء من سؤال (فقرة أو جملة) اشرحه هو بس ببساطة.
- لو مش واضح قول كده ومتخترعش إجابة.
${GEN}
- رد بنفس لغة الطالب.`;
async function ocrData(id, dataUrl) {
  try {
    if (!window.Tesseract) await loadScript("https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js");
    const lang = bookLang(id); ocrW[lang] ||= Tesseract.createWorker(lang);
    const d = (await (await ocrW[lang]).recognize(dataUrl)).data; return { text: d.text || "", lines: d.lines || [] };
  } catch (e) { console.warn("OCR", e); return { text: "", lines: [] }; }
}
async function bandContext(spec, n) {
  const y0 = Math.max(0, spec.y - 0.09), y1 = Math.min(1, spec.y + 0.12), wide = { type: "rect", el: spec.el, n, x0: 0, x1: 1, y0, y1 };
  const img = await snap(wide, n); let t = "", target = "";
  try {
    const pg = await doc.getPage(n), v = pg.getViewport({ scale: 1 }), tc = await pg.getTextContent();
    const mul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
    const all = tc.items.filter(i => i.str && i.str.trim()).map(i => { const m = mul(v.transform, i.transform), fh = Math.hypot(m[2], m[3]) || 8;
      return { i, big: i.str.length > 160 || fh > 0.12 * v.height, cy: (m[5] - fh / 2) / v.height }; });
    const sel = all.filter(o => o.cy >= y0 && o.cy <= y1), total = all.reduce((a, o) => a + o.i.str.length, 0), got = sel.reduce((a, o) => a + o.i.str.length, 0);
    if (!sel.some(o => o.big) && !(total > 0 && got > 0.6 * total) && got > 8) {
      t = sel.map(o => o.i.str + (o.i.hasEOL ? "\n" : " ")).join("");
      target = all.filter(o => Math.abs(o.cy - spec.y) <= BAND * 0.8).map(o => o.i.str).join(" ").trim();
    }
  } catch {}
  if (t.replace(/\s/g, "").length < 8) {
    setTyping("🔎 بقرا السؤال (OCR)...");
    const r = await ocrData(cur.id, img); t = r.text;
    if (r.lines.length) {
      const im = new Image(); im.src = img; try { await im.decode(); } catch {}
      const ty = (spec.y - y0) / (y1 - y0) * (im.naturalHeight || 1); let best = null, bd = 1e9;
      for (const l of r.lines) { const b = l.bbox || {}, d = Math.abs((b.y0 + b.y1) / 2 - ty); if (d < bd && (l.text || "").trim()) { bd = d; best = l; } }
      target = (best?.text || "").trim();
    }
  }
  t = t.normalize("NFKC").replace(/[\u200e\u200f]/g, "").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
  if (t.replace(/\s/g, "").length < 4) throw new Error("مقدرتش أقرا السؤال اللي أشّرت عليه. جرّب تدوس على سطر تاني من السؤال أو حدد مساحة بالسحب.");
  return { t, target: target.normalize("NFKC").replace(/\s+/g, " ") };
}
const bandPrompt = (n, name, c) => `الطالب أشّر بالأصفر على سطر جوه سؤال في صفحة ${n} من ${name}.${c.target ? `\nالسطر اللي أشّر عليه: «${c.target}»` : ""}\n\nالنص اللي حواليه (ممكن فيه أخطاء قراءة بسيطة، وممكن يبان فيه أجزاء من أسئلة تانية):\n${c.t.slice(0, 2000)}\n\nحُلّ السؤال الكامل اللي فيه السطر ده (بما فيه اختياراته) بس، واشرح الإجابة باختصار، وتجاهل أي سؤال تاني.`;
async function askSel(q, sp) {
  const n = sp.n, name = NAMES[cur.id] || "", img = await snap(sp, n); clearPin(); let a;
  if (textOnly()) {
    const bc = sp.type === "band" ? await bandContext(sp, n) : null, t = bc ? "" : await regionText(sp, n, img);
    const body = bc ? `السطر اللي الطالب أشّر عليه: «${bc.target}»\nالنص اللي حواليه (الطالب بيقصد السؤال الكامل اللي فيه السطر ده):\n${bc.t.slice(0, 2000)}` : `الجزء المحدد من صفحة ${n} في ${name}:\n${t.slice(0, 2500)}`;
    a = await llm({ system: SYSTEM_I, messages: [...histN(4), { role: "user", content: `طلب الطالب: ${q}\n\n${body}` }], max: 1500 });
  } else a = await llm({ system: SYSTEM_IV, messages: [...histN(4), { role: "user", content: `طلب الطالب: ${q}\n\n(الصورة دي هي الجزء اللي الطالب حدده من صفحة ${n} في ${name})` }], img: img.split(",")[1], max: 1800 });
  history.push({ role: "user", content: q }, { role: "assistant", content: a }); return a;
}
// «اقرالي كلمات» = كلمة واحدة، «اقرالي كلمتين/٣ كلمات» = العدد ده، «اقراها كلها» = الكل
const NUMW = { واحد: 1, واحده: 1, اتنين: 2, اثنين: 2, تنين: 2, تلات: 3, ثلاث: 3, تلاته: 3, ثلاثه: 3, اربع: 4, اربعه: 4, خمس: 5, خمسه: 5, ست: 6, سته: 6, سبع: 7, سبعه: 7, تمان: 8, ثمان: 8, تمانيه: 8, ثمانيه: 8, تسع: 9, تسعه: 9, عشر: 10, عشره: 10 };
let lastRead = null;
function readIntent(q) {
  const n = norm(q).trim().replace(/[.!؟?]+$/, ""), tk = n.split(/\s+/);
  if (!(tk.some(w => /^(اقر[اليئه]|اسمعني|سمعني|انطق|نطق)/.test(w) || w === "اقر") || /\bread\b/.test(n))) return null;
  if (/(اشرح|شرح|فسر|ترجم|حل\b|حلي|جاوب)/.test(n)) return null;
  let unit = /كلم(ه|ات|تين)|words?\b/.test(n) ? "word" : /جمل|sentence/.test(n) ? "sentence" : /سطر|سطور|فقر|line|paragraph/.test(n) ? "line" : /س[ؤو]ال|اسئل|question/.test(n) ? "question" : "";
  const all = tk.some((w, i) => /^(كله|كلها|كلهم|كلو|الكل|جميع|جميعا|بالكامل|كامل|كامله|كاملا)$/.test(w) || (w === "كل" && tk[i + 1]));
  const dual = /(كلمتين|جملتين|سطرين|فقرتين|س[ؤو]الين|سوالين)/.test(n);
  const num = dual ? 2 : (tk.map(w => /^\d+$/.test(w) ? +w : NUMW[w]).find(x => x) || 1);
  if (!unit) unit = (all || /^(اقراها|اقراهم|اقرالي)$/.test(tk[0])) && lastRead ? lastRead.unit : (/(النص|الصفحه|الجزء|المحدد|الدرس)/.test(n) ? "all" : (lastRead?.unit || "all"));
  return { unit, n: num, all: all || unit === "all" };
}
// كلمات إنجليزي بس من نص OCR مختلط (عربي بيتقري رموز غريبة): الكلمة اللي بعدها (n) أو (v) أو (adj)... وده بيشيل سلاطة العربي
function englishWords(text) {
  const bad = new Set(["n", "v", "adj", "adv", "prep", "conj", "pron", "ed", "ing", "vv", "the", "and"]);
  const ok = w => w.length >= 3 && /[aeiouy]/i.test(w) && !bad.has(w.toLowerCase()) && !/^[A-Z]{2,}$/.test(w) && !/[A-Z]/.test(w.slice(1));
  const seen = new Set(), out = [], push = w => { const k = w.toLowerCase(); if (!seen.has(k) && ok(w)) { seen.add(k); out.push(w); } };
  for (const m of text.matchAll(/([A-Za-z][A-Za-z'’-]{1,24})\s*\(\s*(?:n|v|adj|adv|prep|conj|pron|d|ed|ing|vv|0)\b/gi)) push(m[1].replace(/^[-'’]+|[-'’]+$/g, ""));
  if (out.length >= 3) return out;
  const lat = text.match(/[A-Za-z][A-Za-z'’-]*/g) || [], all = text.split(/\s+/).filter(Boolean);
  if (lat.length >= 3 && lat.length >= all.length * 0.5) { lat.forEach(push); return out; }
  return null;   // الصفحة مش إنجليزي: سيب المعالجة العادية
}
async function doRead(ri, q = "") {
  let wait;
  try {
    const nq = norm(q), pm = nq.match(/(?:^|\s)(?:صفحه|ص|page|p)\s*(\d{1,4})(?=\s|$|[.,:؟?!،])/), un = parseUnit(q), fu = un ? findUnit(un.n, q) : null;
    const bid = doc ? cur.id : ($("book").value || (LIB.length === 1 ? LIB[0].id : ""));
    if (!doc && !bid) throw new Error("اختار الكتاب الأول (من القايمة اللي فوق) أو افتحه، وبعدين قولي اقرالي إيه.");
    wait = add("a", "بفكر...‏"); wait.classList.add("typing");
    let t;
    if (pin) { const sp = pin, img = await snap(sp, sp.n); t = await regionText(sp, sp.n, img); clearPin(); }
    else if (pm) t = await pageText(bid, +pm[1]);   // «انطق كلمات صفحة ٣٠»: الصفحة اللي اتقالت مش الحالية
    else if (fu) { const ts = []; for (let n = fu.from; n <= Math.min(fu.to, fu.from + 14); n++) ts.push(await pageText(fu.id, n)); t = ts.join("\n"); }   // «انطق كلمات ليسون ٣»: كل صفحات الليسون
    else t = await pageText(bid, cur.page);
    const flat = (t || "").replace(/\s+/g, " ").trim(); if (!flat) throw new Error("مقدرتش أقرا نص الصفحة دي.");
    const ew = ri.unit === "word" ? englishWords(flat) : null;
    const parts = ri.unit === "word" ? (ew || flat.split(" ")) : ri.unit === "sentence" ? (flat.match(/[^.!?؟…]+[.!?؟…]*/g) || [flat]).map(x => x.trim()).filter(Boolean)
      : ri.unit === "line" ? t.split(/\n+/).map(x => x.trim()).filter(Boolean) : ri.unit === "question" ? flat.split(/\s(?=\d{1,3}\s?[.)-]\s)/).filter(Boolean) : [flat];
    const out = parts.slice(0, ri.all ? parts.length : Math.min(ri.n, parts.length)).join(ew ? ", " : ri.unit === "word" || ri.unit === "sentence" ? " " : "\n").trim();
    lastRead = { unit: ri.unit === "all" ? lastRead?.unit || "all" : ri.unit };
    wait.remove(); const node = add("a", out);
    if ((typeof VC !== "undefined" && VC.on) || (typeof autoSpeak === "function" && autoSpeak())) window.voiceAfter?.(out, node);
    else if (typeof speak === "function") speak(out, { btn: node?._spk });
  } catch (e) { wait?.remove(); const m = errMsg(e); const nd = add("a", m); if (e?.name !== "AbortError") retryChip(nd); window.voiceAfter?.(m, null); }
}
async function ask(q, hits) {
  try {
    let a;
    if (doc && pin && pin.n) return await askSel(q, pin);   // فيه تحديد: نفّذ طلب الطالب على الجزء المحدد
    if (doc && cur.page && textOnly()) {   // الذكاء المحلي مبيشوفش الصور: بنديله نص الصفحة
      const lc = provider() === "local", refers = refersPage(q);
      const t = hits.unit || !refers ? "" : await pageText(cur.id, cur.page);
      const rel = hits.unit ? 1 : bookRel(q, t || "", ...(hits || []).map(h => h.text));
      const body = (t ? `نص من الكتاب (صفحة ${cur.page} من ${NAMES[cur.id] || ""}، مستخرج آليًا وممكن فيه أخطاء):\n${t.slice(0, lc ? 1800 : 2600)}` : refers && !hits.unit ? "(مفيش نص متاح للصفحة دي، جاوب من معلوماتك بشكل عام.)" : "") + (rel === 1 || t ? bookCtx(hits, q, lc ? 2 : 4, lc ? 700 : 1100) : "");
      a = await llm({ system: lc ? LOCAL_SYS : SYSTEM + FOLLOW + BOOKCTX, compact: lc, messages: [...histN(4), { role: "user", content: `سؤال الطالب: ${q}${shortReply(q)}\n\n${body}` }] });
    } else if (doc && cur.page) {   // الطالب فاتح كتاب: ابعت صورة الصفحة الحالية (أدق من نص الـ OCR)
      const img = (await snap(null, cur.page)).split(",")[1];
      const messages = [...histN(6), { role: "user", content: `الطالب فاتح صفحة ${cur.page} من كتاب ${NAMES[cur.id] || ""} (الصورة). جاوب من الصفحة لو السؤال متعلق بيها. سؤال الطالب: ${q}` + bookCtx(hits, q, 3, 900) }];
      a = await llm({ system: SYSTEM_V + FOLLOW + BOOKCTX, messages, img, max: 2000 });
    } else {
      const lc = provider() === "local", rel = bookRel(q, ...(hits || []).map(h => h.text));
      const ctx = rel !== 1 ? "" : (hits.note ? hits.note + "\n\n" : "") + hits.slice(0, lc ? 3 : 6).map(p => `[${p.book} - صفحة ${p.page}]\n${bkWindow(p.text, q, lc ? 900 : 1800)}`).join("\n\n---\n\n");
      a = await llm({ system: lc ? LOCAL_SYS : SYSTEM, compact: lc, messages: [...histN(6), { role: "user", content: `${ctx ? "نص من الكتاب:\n" + ctx + "\n\n" : ""}سؤال الطالب: ${q}${shortReply(q)}` }] });
    }
    history.push({ role: "user", content: q }, { role: "assistant", content: a }); return a;
  } catch (e) { return errMsg(e); }
}

$("form").onsubmit = async e => {
  e.preventDefault(); const q = $("q").value.trim(); if (!q) return;
  if (GENS.busy || GENS.n) return;   // لسه بيرد: الزرار دلوقتي «وقّف»
  if (typeof VC !== "undefined" && !VC.on && VC.speaking && !window.voiceCtl?.isStop(q) && !window.voiceCtl?.isGo(q)) stopSpeak();   // سؤال جديد وهو بيتكلم: يسكت ويسمعك («استنى»/«كمّل» بيتعاملوا في المدرّس)
  window.autoGrow?.();
  if (window.TUTOR && !(doc && pin && pin.n)) {   // المدرّس الذكي (tutor.js): بيفهم الطلب ويدوّر في كتب المستخدم ويرد
    $("q").value = ""; window.autoGrow?.();
    try { await TUTOR.handle(q); } catch (err) { console.error(err); add("a", "خطأ: " + err.message); window.voiceAfter?.("", null); }
    return;
  }
  let echoed = false;   // لو الطلب اتعرض كرسالة للطالب خلاص
  const un = parseUnit(q);
  unitBlk: if (un && !un.topic && /(اشرح|شرح|فهمن|فسر|explain)/.test(norm(q))) {   // «اشرحلي الوحدة التانية» من غير موضوع: اشرح الوحدة من أولها
    $("q").value = ""; add("u", q); echoed = true;
    const f = findUnit(un.n, q);
    if (!f) break unitBlk;   // مش لاقي الوحدة في الكتب: كمّل واجاوب من الذكي بدل ما ترفض
    await explainLesson({ from: f.from, id: f.id, echo: false }); return;
  }
  const li = un ? "" : lessonIntent(q);
  lessonBlk: if (li) {
    $("q").value = ""; if (!echoed) add("u", q); echoed = true;
    if (li === "cont") { await explainLesson({ from: lessonState.next, id: lessonState.id, cont: true, echo: false }); return; }
    const nm = ((q.match(/(?:درس|الدرس|وحدة|الوحدة|موضوع|الموضوع)\s+(.{3,})$/) || [])[1] || "").replace(/\s*(لو سمحت|ياريت|من فضلك)\s*$/, "").trim();
    if (nm && !/^(ده|دا|دة|هذا|اللي|الي|الحالي|كله|دلوقتي)/.test(nm)) {
      const hit = bkHits(nm, 1, doc ? cur.id : ($("book").value || null))[0];
      if (!hit) break lessonBlk;   // مفيش درس بالاسم ده في الكتب: الذكي يجاوب من عنده
      await explainLesson({ from: Math.max(1, hit.page - 1), id: hit.id, echo: false }); return;
    }
    await explainLesson({ echo: false }); return;
  }
  const ri = readIntent(q);
  if (ri) { $("q").value = ""; add("u", q); await doRead(ri, q); return; }
  $("q").value = ""; if (!echoed) add("u", q); const btn = $("send"); GENS.busy = true; genUI();
  const wait = add("a","بفكر...‏"); wait.classList.add("typing");
  try { let hits;
    if (un) {   // «اشرحلي كذا في يونيت ١»: دوّر على الموضوع جوه صفحات الوحدة دي وجاوب بحوار عادي
      const f = findUnit(un.n, q);
      hits = bkHits(un.topic || q, 5, f ? f.id : (doc ? null : ($("book").value || null)), f);
      hits.unit = true; hits.note = f ? `الطالب بيسأل عن ${un.label} (من صفحة ${f.from} لصفحة ${f.to} في كتاب ${NAMES[f.id] || ""}) والمقاطع دي منها، فجاوب منها مش من الصفحة المفتوحة.` : `الطالب ذكر ${un.label} بس مقدرتش أحدد صفحاتها بالظبط، فدوّر في المقاطع وجاوب عن الموضوع اللي طلبه.`;
    } else hits = bkHits(q.length < 25 ? q + " " + (history.at(-2)?.content || "").slice(0, 200) : q, 5, doc ? null : ($("book").value || null)); const a = await ask(q, hits);
    wait.remove(); const node = add("a", a, hits); window.voiceAfter?.(a, node); }
  catch (err) { wait.remove(); add("a","خطأ: " + err.message); window.voiceAfter?.("", null); }
  GENS.busy = false; genUI();
};
const kname = () => provider() === "claude" ? "key" : "gkey";
// لو صاحب الموقع ظبط سيرفر آمن (config.js)، بيظهر كمزوّد وبيبقى الافتراضي مرة واحدة
// الشات بيتحوّل للسيرفر بس لو السيرفر فعلًا فيه مفتاح ذكاء (ممكن يكون متظبط للصوت بس، زي Azure)
function syncServerOpt() {
  if (window.PX?.on() && !PX.cached()) return;   // لسه مستنيين رد السيرفر
  const has = !!(window.PX?.on() && PX.cached()?.chat), sel = $("prov"), o = sel.querySelector("option[value=server]");
  if (has && !o) sel.prepend(new Option("🔒 سيرفر الموقع — الأذكى، ومفيش مفاتيح على جهازك", "server"));
  if (!has && o) o.remove();
  if (has && !localStorage.getItem("srvmig")) { localStorage.setItem("srvmig", "1"); localStorage.setItem("provider", "server"); }
  if (!has && provider() === "server") localStorage.setItem("provider", "free");
}
syncServerOpt(); window.addEventListener("proxy-health", syncServerOpt);
function syncLocalUI() {
  const loc = provider() === "local", pu = provider() === "puter", fr = provider() === "free", sv = provider() === "server"; $("keyRow").hidden = $("keyNote").hidden = loc || pu || fr || sv; $("lRow").hidden = !loc; $("pRow").hidden = !(pu || fr); $("psign").style.display = $("pstat").style.display = fr ? "none" : ""; const pn = $("pRow").querySelector("small"); if (pn) pn.style.display = fr ? "none" : "";
  if (pu || fr) { const ps = $("pmodel"); ps.innerHTML = ""; Object.entries(fr ? FREE_LABELS : Object.fromEntries(Object.entries(PM).map(([k, v]) => [k, v[0]]))).forEach(([k, v]) => ps.append(new Option(v, k))); ps.value = pkey(); }
  if (!loc) return;
  if (!window.LOCAL_AI) { $("lstat").textContent = "بحمّل إعدادات الذكاء المحلي…"; ensureLocalAI().then(() => provider() === "local" && syncLocalUI(), e => { $("lstat").textContent = "⚠️ " + e.message; }); return; }
  const sel = $("lmodel"); if (!sel.options.length) Object.entries(LOCAL_AI.SIZES).forEach(([k, v]) => sel.append(new Option(v, k)));
  sel.value = LOCAL_AI.size(); $("lstat").textContent = LOCAL_AI.supported() ? "" : "جهازك/متصفحك مش بيدعم WebGPU، فالذكاء المحلي مش هيشتغل. غيّر المزوّد أو جرّب Chrome حديث.";
}
$("pmodel").onchange = e => localStorage.setItem("pmodel", e.target.value);
$("psign").onclick = async () => { const st = $("pstat"); st.textContent = "بفتح تسجيل الدخول..."; try { await ensurePuter(); if (!window.puter?.auth) throw new Error("مكتبة Puter مش متحمّلة (محتاج نت)"); await puter.auth.signIn(); st.textContent = "✅ تم تسجيل الدخول، تقدر تسأل."; } catch (e) { st.textContent = "⚠️ " + perr(e); } };
$("lmodel").onchange = e => { if (!window.LOCAL_AI) return; LOCAL_AI.setSize(e.target.value); $("lstat").textContent = "اتغير الحجم. اضغط «حمّل الآن» أو اسأل سؤال وهيتحمّل."; };
$("lload").onclick = async () => { const st = $("lstat"); try { await ensureLocalAI(); } catch (e) { st.textContent = "⚠️ " + e.message; return; } if (!confirm("هيتحمّل الموديل المحلي (حوالي " + ({ tiny: "٥٠٠ ميجا", light: "١ جيجا", mid: "٢ جيجا" }[LOCAL_AI.size()]) + ") وبيستخدم كارت الشاشة والذاكرة. اقفل التابات التانية الأول. تكمّل؟")) return; st.textContent = "بحمّل..."; try { await LOCAL_AI.load(p => st.textContent = "تحميل " + Math.round((p.progress || 0) * 100) + "% — " + (p.text || "").slice(0, 60)); st.textContent = "✅ الذكاء المحلي جاهز."; } catch (e) { st.textContent = "⚠️ " + e.message; } };
function syncSettings() { syncServerOpt(); stripAdvanced(); $("prov").value = provider(); $("key").value = localStorage.getItem(kname()) || ""; $("key").placeholder = provider() === "claude" ? "sk-ant-..." : "AIza..."; $("gHelp").hidden = provider() !== "gemini"; syncLocalUI(); window.TUTOR?.syncSettings?.(); }
$("prov").onchange = e => { localStorage.setItem("provider", e.target.value); syncSettings(); };
$("settingsBtn").onclick = () => { $("settings").hidden = !$("settings").hidden; syncSettings(); };
$("saveKey").onclick = () => { localStorage.setItem(kname(), $("key").value.trim()); localStorage.removeItem("gmodel"); $("settings").hidden = true; };
$("q").onkeydown = e => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); $("form").requestSubmit(); } };

// ===== اسأل AI من الصفحة (تمرير الماوس / تحديد منطقة / حل الصفحة) =====
const SYSTEM_V = `أنت مدرّس خصوصي ذكي. هتاخد صورة (صفحة أو جزء من صفحة) من كتابهم.
- اقرا الصورة بدقة وحدد الأسئلة.
- لكل سؤال: رقمه، الإجابة الصحيحة بوضوح، وبعدها شرح مبسط بيوضح ليه.
- ${MCQ}
- لو جزء من الصورة مش واضح قول كده ومتخترعش إجابة.
${GEN}
- رد بنفس لغة السؤال.`;
const band = Object.assign(document.createElement("div"), { id: "band", hidden: true }), selBox = Object.assign(document.createElement("div"), { id: "sel", hidden: true }),
  chip = Object.assign(document.createElement("div"), { id: "chip", hidden: true, innerHTML: '<button type="button" data-k="ask">✨ اسأل الـ AI</button><button type="button" data-k="mean">📖 المعنى</button><button type="button" data-k="def">📚 Definition</button><button type="button" data-k="say">🔊 انطق</button><button type="button" data-k="tr">🌐 ترجم</button>' }), BAND = 0.03, P = $("pages");
let pin = null, drag = null, hoverSpec = null, busy = false, host = null;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
function clearPin() { pin = null; drag = null; hoverSpec = null; band.hidden = selBox.hidden = chip.hidden = true; }
function place(spec) {
  const el = spec.el; if (host !== el) { el.append(band, selBox, chip); host = el; }
  const W = el.clientWidth, H = el.clientHeight; hoverSpec = spec; chip.hidden = false;
  if (spec.type === "band") {
    const h = Math.max(26, BAND * H), en = cur.id === "english"; band.hidden = false; selBox.hidden = true;
    band.style.top = (spec.y * H - h / 2) + "px"; band.style.height = h + "px";
    chip.style.top = (spec.y * H - 16) + "px"; chip.style.left = en ? "auto" : "8px"; chip.style.right = en ? "8px" : "auto";
  } else {
    band.hidden = true; selBox.hidden = false;
    Object.assign(selBox.style, { left: spec.x0 * W + "px", top: spec.y0 * H + "px", width: (spec.x1 - spec.x0) * W + "px", height: (spec.y1 - spec.y0) * H + "px" });
    chip.style.right = "auto"; chip.style.left = clamp((spec.x0 + spec.x1) / 2 * W - 150, 4, Math.max(4, W - 330)) + "px"; chip.style.top = (spec.y0 * H >= 42 ? spec.y0 * H - 38 : Math.min(spec.y1 * H + 6, H - 38)) + "px";
  }
}
const pgOf = e => e.target.closest?.(".pg");
const frac = (e, el) => { const r = el.getBoundingClientRect(); return [clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1)]; };
P.addEventListener("pointermove", e => {
  if (drag) { const el = drag.el, [x, y] = frac(e, el), W = el.clientWidth, H = el.clientHeight; drag.x1 = x; drag.y1 = y;
    if (Math.hypot((x - drag.x0) * W, (y - drag.y0) * H) > 12) { drag.on = true; chip.hidden = band.hidden = true; selBox.hidden = false;
      Object.assign(selBox.style, { left: Math.min(drag.x0, x) * W + "px", top: Math.min(drag.y0, y) * H + "px", width: Math.abs(x - drag.x0) * W + "px", height: Math.abs(y - drag.y0) * H + "px" }); }
    return; }
  if (chip.contains(e.target) || pin || e.pointerType !== "mouse") return;
  const el = pgOf(e); if (el) place({ type: "band", y: frac(e, el)[1], el, n: +el.dataset.n });
});
P.addEventListener("pointerdown", e => { if (chip.contains(e.target) || (e.pointerType === "mouse" && e.button !== 0)) return; const el = pgOf(e); if (!el) return; pin = null; const [x, y] = frac(e, el); drag = { el, x0: x, y0: y, x1: x, y1: y, on: false }; P.setPointerCapture?.(e.pointerId); });
P.addEventListener("pointerup", e => {
  if (!drag) return; const d = drag, n = +d.el.dataset.n; drag = null; try { P.releasePointerCapture?.(e.pointerId); } catch {}
  cur.page = n; $("pn").value = n;
  pin = d.on ? { type: "rect", el: d.el, n, x0: Math.min(d.x0, d.x1), y0: Math.min(d.y0, d.y1), x1: Math.max(d.x0, d.x1), y1: Math.max(d.y0, d.y1) } : { type: "band", y: d.y0, el: d.el, n };
  place(pin);
});
P.addEventListener("pointercancel", () => { drag = null; });
P.addEventListener("pointerleave", e => { if (!pin && !drag && e.pointerType === "mouse") band.hidden = chip.hidden = true; });
addEventListener("keydown", e => { if (e.key === "Escape") clearPin(); });
chip.onclick = e => { const b = e.target.closest("button"); if (!b || !hoverSpec) return; const k = b.dataset.k; if (k === "ask") askSpec(hoverSpec); else quickSel(hoverSpec, k); };
$("solve").onclick = () => askSpec(null);

async function snap(spec, n, wide = 1700, dd = null) {
  const pg = await (dd || doc).getPage(n), v0 = pg.getViewport({ scale: 1 }); let sx = 0, sy = 0, w = v0.width, h = v0.height, scale = Math.min(2.4, wide / v0.width);
  if (spec?.type === "rect") { sx = spec.x0 * v0.width; sy = spec.y0 * v0.height; w = (spec.x1 - spec.x0) * v0.width; h = (spec.y1 - spec.y0) * v0.height; scale = clamp(1400 / w, 1, 3.2); }
  const c = document.createElement("canvas"); c.width = Math.ceil(w * scale); c.height = Math.ceil(h * scale);
  const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
  await pg.render({ canvasContext: ctx, viewport: pg.getViewport({ scale, offsetX: -sx * scale, offsetY: -sy * scale }) }).promise;
  if (spec?.type === "band") { const bh = BAND * c.height; ctx.fillStyle = "rgba(255,214,0,.3)"; ctx.fillRect(0, spec.y * c.height - bh / 2, c.width, bh); }
  return c.toDataURL("image/jpeg", .85);
}
// ===== نص الجزء المحدد بس (للمزوّدات النصية): من طبقة نص الـ PDF بالمكان، وإلا OCR للصورة المقصوصة =====
const SYSTEM_R = `أنت مدرّس خصوصي ذكي. الطالب حدد جزءًا واحدًا من صفحة في كتابه وهتاخد نصه (مستخرج بـ OCR وممكن فيه أخطاء صغيرة).
- حُلّ **سؤالًا واحدًا فقط**: أول سؤال كامل موجود في النص المحدد. لو ظهر في الأول أو الآخر بقايا أسئلة تانية مقطوعة أو اختيارات ناقصة تجاهلها تمامًا.
- متحلّش ولا تذكر أي سؤال تاني حتى لو ظهر في النص، إلا لو الطالب طلب.
- ${MCQ}
- لو النص المحدد مش سؤال (فقرة أو جملة) اشرحه هو بس ببساطة.
- لو النص مش واضح أو السؤال ناقص قول كده ومتخترعش إجابة.
${GEN}
- رد بنفس لغة الطالب.`;
const SYSTEM_RV = `أنت مدرّس خصوصي ذكي. هتاخد صورة لجزء واحد حدده الطالب من صفحة في كتابه.
- حُلّ **سؤالًا واحدًا فقط**: أول سؤال كامل ظاهر في الصورة. أي سؤال تاني مقطوع أو ظاهر جزء منه تجاهله تمامًا.
- متحلّش ولا تذكر أي سؤال تاني حتى لو ظهر في الصورة، إلا لو الطالب طلب.
- ${MCQ}
- لو الجزء مش سؤال اشرحه هو بس ببساطة. لو مش واضح قول كده ومتخترعش إجابة.
${GEN}
- رد بنفس لغة السؤال.`;
async function ocrImg(id, dataUrl) {
  try {
    if (!window.Tesseract) await loadScript("https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js");
    const lang = bookLang(id); ocrW[lang] ||= Tesseract.createWorker(lang);
    return ((await (await ocrW[lang]).recognize(dataUrl)).data.text) || "";
  } catch (e) { console.warn("OCR", e); return ""; }
}
async function regionText(spec, n, img) {
  let t = "";
  try {
    const pg = await doc.getPage(n), v = pg.getViewport({ scale: 1 }), tc = await pg.getTextContent();
    const mul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
    const all = tc.items.filter(i => i.str && i.str.trim()).map(i => { const m = mul(v.transform, i.transform), fh = Math.hypot(m[2], m[3]) || 8;
      return { i, big: i.str.length > 160 || fh > 0.12 * v.height, cx: (m[4] + (i.width || 0) / 2) / v.width, cy: (m[5] - fh / 2) / v.height }; });
    const half = BAND * 0.8, inR = o => spec.type === "rect" ? (o.cx >= spec.x0 && o.cx <= spec.x1 && o.cy >= spec.y0 && o.cy <= spec.y1) : Math.abs(o.cy - spec.y) <= half;
    const sel = all.filter(inR), total = all.reduce((a, o) => a + o.i.str.length, 0), got = sel.reduce((a, o) => a + o.i.str.length, 0), area = spec.type === "rect" ? (spec.x1 - spec.x0) * (spec.y1 - spec.y0) : 0.05;
    // لو طبقة النص كبيرة القطع (سطر/فقرة كاملة) أو المحدد أخد معظم الصفحة، مينفعش نقص بالمكان → OCR للصورة المقصوصة
    const coarse = sel.some(o => o.big) || (total > 0 && got > 0.6 * total && area < 0.45);
    if (!coarse) t = sel.map(o => o.i.str + (o.i.hasEOL ? "\n" : " ")).join("");
  } catch {}
  if (t.replace(/\s/g, "").length < 6) { setTyping("🔎 بقرا الجزء المحدد (OCR)..."); t = await ocrImg(cur.id, img); }
  t = t.normalize("NFKC").replace(/[\u200e\u200f]/g, "").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
  if (t.replace(/\s/g, "").length < 4) throw new Error("مقدرتش أقرا النص اللي حددته. جرّب تحدد مساحة أوضح وأكبر شوية.");
  return t;
}
const regionPrompt = (spec, n, name, t) => `الجزء اللي الطالب حدده من صفحة ${n} في ${name} (ممكن فيه أخطاء قراءة بسيطة، وممكن يبان فيه بقايا مقطوعة من أسئلة تانية). ${spec.type === "band" ? "اشرح السطر ده بس." : "حُلّ أول سؤال كامل بس مع شرح قصير."} متتكلمش عن أي سؤال أو حاجة تانية.\n\nالنص المحدد:\n${t.slice(0, 2500)}`;
// ===== أزرار فوق التحديد: المعنى / Definition / نطق / ترجمة (قواميس مجانية سريعة، والـ AI احتياطي) =====
const jget = async (u, ms = 7000) => { const ac = new AbortController(), to = setTimeout(() => ac.abort(), ms); try { const r = await fetch(u, { signal: ac.signal }); if (!r.ok) throw new Error("HTTP " + r.status); return await r.json(); } finally { clearTimeout(to); } };
async function mmTr(text, pair = "en|ar") {   // ترجمة/معنى سريع (MyMemory مجاني من غير مفتاح)
  const j = await jget("https://api.mymemory.translated.net/get?q=" + encodeURIComponent(text.slice(0, 450)) + "&langpair=" + pair), top = j?.responseData?.translatedText || "";
  if (+j?.responseStatus !== 200 || !top || /MYMEMORY WARNING|INVALID|QUERY LENGTH/i.test(top)) throw new Error("ترجمة");
  const alts = (j.matches || []).map(m => (m.translation || "").trim()).filter(x => x && !/[A-Za-z]{4,}/.test(x));
  return [...new Set([top, ...alts])].slice(0, 3);
}
async function dictEn(w) {   // Definition + نطق + تسجيل صوت بشري حقيقي (dictionaryapi.dev)
  const j = await jget("https://api.dictionaryapi.dev/v2/entries/en/" + encodeURIComponent(w.toLowerCase())), e = Array.isArray(j) ? j[0] : null; if (!e) throw new Error("مش لاقي");
  const ph = e.phonetic || (e.phonetics || []).map(p => p.text).find(Boolean) || "", au = (e.phonetics || []).map(p => p.audio).find(Boolean) || "";
  const ms = (e.meanings || []).slice(0, 2).map(m => { const d = m.definitions?.[0] || {}; return { pos: m.partOfSpeech, def: d.definition, ex: d.example }; }).filter(m => m.def);
  if (!ms.length) throw new Error("مش لاقي");
  return { w: e.word || w, ph, audio: au ? au.replace(/^\/\//, "https://") : "", ms };
}
const fmtDef = (d, ar) => `**${d.w}**${d.ph ? "  " + d.ph : ""}${ar?.length ? "  —  " + ar.join("، ") : ""}\n` + d.ms.map(m => `• (${m.pos}) ${m.def}${m.ex ? `\n   مثال: ${m.ex}` : ""}`).join("\n");
const QL = { mean: "📖 المعنى", def: "📚 Definition", say: "🔊 نطق", tr: "🌐 ترجمة" };
async function aiSel(kind, flat, img) {
  const P = { mean: "اكتب معنى كل كلمة مهمة في النص المحدد بالعربي، سطر لكل كلمة بالشكل: الكلمة — معناها.", def: "لكل مصطلح مهم في النص المحدد اكتب: التعريف (definition) بإنجليزي بسيط، وبعده معناه بالعربي، وبعده مثال قصير.", tr: "ترجم النص المحدد كله: لو إنجليزي ترجمه لعربي واضح بلهجة الطالب، ولو عربي ترجمه لإنجليزي بسيط.", say: "اقرا النص المحدد." }[kind], lc = provider() === "local";
  if (textOnly()) return llm({ system: lc ? LOCAL_SYS : SYSTEM_I, compact: lc, messages: [{ role: "user", content: `${P}\n\nالنص المحدد:\n${flat.slice(0, 1500)}` }], max: 900 });
  return llm({ system: SYSTEM_IV, messages: [{ role: "user", content: P }], img: img.split(",")[1], max: 1000 });
}
async function quickSel(spec, kind) {
  if (!doc || busy) return; busy = true; const n = spec.n; let wait;
  try {
    const img = await snap(spec, n); if (innerWidth <= 800) showTab("chat");
    add("u", `${QL[kind]} — صفحة ${n}`, null, img); wait = add("a", "بفكر..."); wait.classList.add("typing"); clearPin();
    let t = ""; if (spec.type === "band") { const bc = await bandContext(spec, n); t = (bc.target || bc.t || "").trim(); } else t = await regionText(spec, n, img);
    const flat = t.replace(/\s+/g, " ").trim(), letters = flat.replace(/[^A-Za-z\u0621-\u064A]/g, ""), share = letters ? (flat.match(/[A-Za-z]/g) || []).length / letters.length : 0;
    const vocab = share > .6 ? englishWords(flat) : null, words = share > .6 ? (vocab || [...new Set(flat.match(/[A-Za-z][A-Za-z'’-]+/g) || [])]).slice(0, 10) : null, sentence = !!words && !vocab && words.length >= 5;
    let out = "", audios = [];
    try {
      if (kind === "say") { out = "🔊 " + (words ? words.join(", ") : flat); }
      else if (words?.length) {
        if (kind === "tr" || (kind === "mean" && sentence)) out = "**الترجمة:** " + (await mmTr(flat))[0];
        else if (kind === "mean") { const rs = await Promise.allSettled(words.map(w => mmTr(w))); out = rs.map((r, i) => r.status === "fulfilled" ? `**${words[i]}** — ${r.value.join("، ")}` : "").filter(Boolean).join("\n"); }
        else {
          const ws = sentence ? words.filter(w => w.length >= 6).slice(0, 5) : words.slice(0, 8);
          const rs = await Promise.allSettled(ws.map(async w => { const [d, a] = await Promise.allSettled([dictEn(w), mmTr(w)]); if (d.status !== "fulfilled") throw new Error("x"); if (d.value.audio) audios.push([d.value.w, d.value.audio]); return fmtDef(d.value, a.status === "fulfilled" ? a.value.slice(0, 2) : null); }));
          out = rs.map(r => r.status === "fulfilled" ? r.value : "").filter(Boolean).join("\n\n");
        }
      } else if (kind === "tr" && flat && share <= .6 && flat.length <= 400) out = "**Translation:** " + (await mmTr(flat, "ar|en"))[0];
    } catch (e) { console.warn("quickSel", e); out = ""; audios = []; }
    if (!out) out = await aiSel(kind, flat, img);
    wait.remove(); const node = add("a", out);
    if (audios.length) { const box = document.createElement("div"); box.className = "src"; audios.forEach(([w, u]) => { const b = document.createElement("a"); b.href = "#"; b.textContent = "🔊 " + w; b.onclick = e => { e.preventDefault(); try { stopSpeak?.(); } catch {} new Audio(u).play().catch(() => {}); }; box.append(b); }); node.append(box); }
    history.push({ role: "user", content: `${QL[kind]}: ${flat.slice(0, 200)}` }, { role: "assistant", content: out });
    if (kind === "say") { let played = false; if (words?.length === 1) { try { const d = await dictEn(words[0]); if (d.audio) { await new Audio(d.audio).play(); played = true; } } catch {} } if (!played && typeof speak === "function") speak(words ? words.join(", ") : flat, { btn: node?._spk }); }
    else window.voiceAfter?.(out, node);
  } catch (err) { wait?.remove(); add("a", errMsg(err)); }
  busy = false;
}
async function askSpec(spec) {
  if (!doc || busy) return;
  busy = true; const n = spec ? spec.n : cur.page, name = NAMES[cur.id] || ""; let prompt, label, max = 1500, wait;
  if (!spec) { label = `✨ حل صفحة ${n} كاملة`; max = 3500; prompt = `دي صفحة ${n} من كتاب ${name}. حل كل الأسئلة اللي فيها، وكل سؤال بإجابته وشرح مختصر. لو الصفحة شرح مش أسئلة، لخّصها ببساطة.`; }
  else if (spec.type === "band") { label = `✨ سؤال من صفحة ${n}`; prompt = `دي صفحة ${n} من كتاب ${name}. السطر المظلل بالأصفر جزء من سؤال. حل السؤال ده كامل (بما فيه اختياراته) واشرح الإجابة.`; }
  else { label = `✨ الجزء المحدد من صفحة ${n}`; prompt = `ده جزء مقصوص من صفحة ${n} في كتاب ${name}. حل الأسئلة الظاهرة فيه واشرح.`; }
  try {
    const img = await snap(spec, n); if (innerWidth <= 800) showTab("chat");
    add("u", label, null, img); wait = add("a", "بفكر..."); wait.classList.add("typing"); clearPin();
    const loc = textOnly(), bc = loc && spec?.type === "band" ? await bandContext(spec, n) : null, t = bc ? bc.t : loc ? (spec ? await regionText(spec, n, img) : await pageText(cur.id, n)) : "";
    const a = loc ? await llm({ system: bc ? SYSTEM_B : spec ? SYSTEM_R : SYSTEM, messages: [{ role: "user", content: bc ? bandPrompt(n, name, bc) : spec ? regionPrompt(spec, n, name, t) : `دي صفحة ${n} من كتاب ${name}. حل الأسئلة الموجودة في النص ده واشرح كل إجابة باختصار، ولو النص شرح مش أسئلة لخّصه ببساطة.\n\nنص الصفحة (مستخرج آليًا وممكن فيه أخطاء):\n${t.slice(0, 2800)}` }], max: Math.min(max, spec ? 800 : 1200) })
      : await llm({ system: spec ? SYSTEM_RV : SYSTEM_V, messages: [{ role: "user", content: prompt }], img: img.split(",")[1], max: spec ? Math.min(max, 900) : max });
    wait.remove(); history.push({ role: "user", content: `${label} (${name})` }, { role: "assistant", content: a }); const node = add("a", a); window.voiceAfter?.(a, node);
  } catch (err) { wait?.remove(); add("a", errMsg(err)); }
  busy = false;
}

// ===== شرح الدرس =====
window.addEventListener("load", syncLocalUI);
const SYSTEM_E = `أنت مدرّس مصري شاطر زي أشهر مدرسين يوتيوب اللي الطلبة بتحبهم: فاهم الدرس كويس، بتشرح بحماس هادي وبأسلوب حكاية، وبتكلم الطالب كأنه قدامك في الحصة («بص يا سيدي»، «ركّز معايا هنا»، «تعالى نفهمها بالراحة»). هتاخد صفحات من الكتاب (صور أو نص).
- ابدأ الدرس بهوك صغير (سؤال أو موقف من الحياة يشدّ الطالب)، وبعدين اشرح كل فكرة بتشبيه من الحياة اليومية المصرية قبل التعريف الرسمي، وبعدها اربطها بكلام الكتاب.
- بعد كل جزء جملة تثبيت («يعني باختصار: …»)، ونبّه على اللي بيجي في الامتحان والغلطات المشهورة، وادّي «تكة» للحفظ لو ينفع. المصطلحات بالإنجليزي جنب العربي.
- اقرا الصفحات بدقة واشرح الدرس اللي فيها بلهجة الطالب بشكل بسيط وودود، زي مدرس قاعد جنبه. الصفحات دي هي المصدر الوحيد: حافظ على معناها بالظبط، ومتضيفش أي تعريف أو قاعدة أو تاريخ أو معلومة مش فيها. التشبيه اللي من عندك للتوضيح (من غير معلومات جديدة) علّمه «💡 تشبيه للتوضيح:».
- الترتيب بعناوين قصيرة: «### نظرة عامة» (اسم الدرس وفكرته في جملتين) ← «### المفاهيم الأساسية» واحدة واحدة بأمثلة بسيطة ← «### 📌 افتكر» (التعريفات/القواعد/القوانين المهمة لو فيه) ← «### ⚠️ أخطاء شائعة» (لو مفيد) ← «### ✅ الخلاصة» ← «### ❓ اختبر نفسك» (سؤالين من غير إجابات، والإجابات تحت «### الإجابات»). الخلاصة والأسئلة بس لو الدرس خلص.
- جمل قصيرة وفقرات صغيرة، و**عريض** للمصطلحات بس، من غير جداول. متذكرش أرقام الصفحات في الكلام.
- لو الصفحات تمارين وأسئلة (ورقة تدريب) مش شرح: متحلّهاش ومتسردش إجاباتها. قول للطالب في جملة إن الصفحة دي تمارين على فكرة كذا، وعلّمه الفكرة أو القاعدة اللي بتختبرها زي مدرّس قاعد قدامه (الفكرة ببساطة، القاعدة، ومثال جديد من عندك مش من التمارين وعلّمه «💡 مثال من عندي:»). والقاعدة نفسها لو مش مكتوبة في الصفحة اشرحها من معلوماتك الأكيدة وعلّمها «🌐 من خارج الكتاب» (ده استثناء من قاعدة «الصفحات هي المصدر الوحيد»). وفي الآخر اقترح تحلّوا أول تمرين سوا وخلّي الطالب يجاوب الأول وانت تدّيه تلميح. حل التمارين بيكون بس لما الطالب يطلب حلها صراحة.
- لو الكتاب إنجليزي (مادة تانية زي science أو math بالإنجليزي) اشرح بلهجة الطالب وسيب المصطلحات الإنجليزي زي ما هي.
- لو ده كتاب **لغة إنجليزي** (English language: فيه Vocabulary / Grammar / Reading / Language / Functions / Writing): الكلمات مش هي الدرس. اهتم بالحاجات اللي محتاجة شرح فعلًا، بالترتيب ده:
  1. **القواعد (Grammar)** هي أهم جزء ومعظم الرد: اسم القاعدة، بنستخدمها إمتى وليه، التكوين (Form) في الإثبات والنفي والسؤال والإجابة المختصرة، الكلمات الدالة (signal words) لو فيه، 3–4 أمثلة إنجليزي بسيطة كل مثال جنبه معناه بالمصري، والغلطات المشهورة اللي الطلبة بتقع فيها في الامتحان، ومقارنة بقاعدة قريبة منها لو بتتلخبط معاها. لو الكتاب كاتب القاعدة باختصار (box صغير) كمّل شرحها من معلوماتك الأكيدة وعلّم الزيادة «🌐 من خارج الكتاب».
  2. **التعبيرات والوظائف اللغوية (Functions / Expressions)** لو موجودة: إمتى تقول الجملة دي، والرد المناسب عليها.
  3. **الـ Reading** بسرعة: فكرة النص في سطرين بالمصري، من غير ما تترجمه جملة جملة.
  4. **الكلمات (Vocabulary)** في الآخر وباختصار: جدول واحد صغير (الكلمة | المعنى) للكلمات الجديدة بس، من غير شرح كل كلمة لوحدها (ده الاستثناء الوحيد من «من غير جداول»). كلمة بس لو ليها استخدام صعب أو بتتلخبط مع كلمة تانية ممكن تقف عندها بجملة.
  5. **الـ Writing / Pronunciation / Spelling** لو موجودين: القاعدة أو الخطوات بشكل عملي.
  ولو الصفحات المبعوتة فيها كلمات بس ومفيهاش قواعد، قول ده في سطر واشرح الكلمات باختصار، وقول للطالب إن القواعد غالبًا في الصفحات اللي بعد كده («كمّل»).
- لو جزء مش واضح (صورة أو OCR ضعيف) قول كده ومتخترعش.`;
let lessonState = null;   // { id, next, done } — عشان «كمّل» يكمّل من آخر صفحة اتشرحت
const LESSON_WIN = 4;     // عدد الصفحات في كل دفعة شرح
const lessonIntent = q => {
  const n = norm(q).trim().replace(/[.!؟?]+$/, "");
  if (lessonState && !lessonState.done && /^(كمل|كملي|كمله|تابع|كمل معايا|كمل الشرح|كمل الدرس)$/.test(n)) return "cont";
  if (/(اشرح|شرح|فهمن|فسر)/.test(n) && /(درس|وحده|موضوع)/.test(n) && !/(سوال|جمله|كلمه|نقطه|بيت|فقره)/.test(n)) return "new";
  return "";
};
async function explainLesson({ from, id, cont = false, echo = true, to = 0, h = null } = {}) {
  if (busy) return; busy = true; let wait;
  const stop = m => { add("a", m); window.voiceAfter?.(m, null); busy = false; };
  try {
    if (id && (id !== cur.id || !doc)) await openBook(id, from || 1); else if (from && doc) gotoPage(from);
    if (!doc) return stop("افتح الكتاب الأول ووقّف على أول صفحة في الدرس، وبعدين قولي «اشرحلي الدرس».");
    const loc = textOnly(), win = loc ? 2 : LESSON_WIN, bid = cur.id, name = NAMES[bid] || "";
    const s0 = clamp(from || cur.page, 1, doc.numPages);
    // حدود الدرس من فهرس الكتاب (rag.js): بنشرح لحد آخر صفحة فيه بالظبط، و«كمّل» بتكمّل من نفس المكان
    if (!h && window.RAG) { const x = RAG.sectionAt(bid, s0); if (x && x.page <= s0 && x.to >= s0) { h = x; if (!to) to = x.to; } }
    const end = to ? Math.min(to, doc.numPages) : doc.numPages, e0 = Math.min(end, s0 + win - 1);
    const lname = h ? h.line : "", pg = n => window.RAG ? RAG.pg(bid, n) : "ص " + n;
    if (innerWidth <= 800) showTab("chat");
    const label = cont ? `🎓 كمّل شرح ${lname ? "«" + lname + "»" : "الدرس"} (من ${pg(s0)})` : `🎓 اشرحلي ${lname ? "«" + lname + "»" : "الدرس"} (من ${pg(s0)})`;
    if (echo) add("u", label);
    wait = add("a", "بفكر..."); wait.classList.add("typing");
    const imgs = [], scope = lname ? `الدرس المطلوب: «${lname}» — من صفحة ${h?.page || s0} لحد صفحة ${end} في الملف. ` : "",
      tail = scope + (cont ? "كنت بشرحله الدرس ده ومكمّلين من الصفحة دي: كمّل من غير ما تعيد اللي اتشرح ومن غير مقدمة. " : "الطالب عايز شرح الدرس ده بالترتيب. ابدأ بذكر اسم الدرس. ") +
      "اشرح بالترتيب من الصفحات دي بس، ولو ظهر درس جديد وقف عنده ومتشرحوش. الخلاصة والأسئلة بس لو الدرس خلص جوه الصفحات دي، ولو لسه مكمّل اقفل بجملة تمهيد بسيطة. " +
      `وفي آخر ردك اكتب سطر لوحده بالشكل ده بالظبط: [[آخر صفحة: رقم | انتهى: نعم أو لا]] — الرقم هو آخر صفحة شرحت منها (من ${s0} إلى ${e0})، و«نعم» لو الدرس خلص جوه الصفحات دي، و«لا» لو لسه بيكمل بعدها.`;
    let prompt;
    if (loc) {
      let txt = ""; for (let n = s0; n <= e0; n++) { setTyping(`بقرا ${pg(n)}...`); txt += `--- صفحة ${n} ---\n` + (await pageText(bid, n)).slice(0, 1300) + "\n"; }
      prompt = `الطالب عايز شرح درس من كتاب ${name}. ` + tail + `\n\nده نص الصفحات من ${s0} لحد ${e0} (مستخرج آليًا وممكن فيه أخطاء):\n${txt}`;
    } else {
      for (let n = s0; n <= e0; n++) imgs.push((await snap(null, n, 1300)).split(",")[1]);
      prompt = `الصور دي ${imgs.length} صفحات متتالية من كتاب ${name}، من صفحة ${s0} لحد صفحة ${e0}. ` + tail;
    }
    const vs = window.voiceStreamStart?.(); let latest = "", raf = 0, live = null;
    const strip = t => t.replace(/\[\[[\s\S]*?(\]\]|$)/g, "").trim();
    const raw = await llm({ system: SYSTEM_E, messages: [{ role: "user", content: prompt }], imgs: loc ? undefined : imgs, max: loc ? 1100 : 3800, long: true,
      onText: t => { const c = strip(t); vs?.push(c); latest = c; if (wait && !raf) raf = requestAnimationFrame(() => { raf = 0; if (!wait) return; const stick = nearBottom(); wait.classList.remove("typing"); (live ||= mdLive(wait))(latest); if (stick) chatScroll(true); }); } });
    const mk = (raw.match(/\[\[[\s\S]*?\]\]/) || [""])[0];
    const last = clamp(+((mk.match(/صفحة\s*:?\s*(\d+)/) || [])[1]) || e0, s0, e0);
    const ended = last >= end || /انتهى\s*:?\s*نعم/.test(mk);
    let a = strip(raw);
    lessonState = { id: bid, next: last + 1, done: ended, to: end, h };
    if (!ended) a += `\n\nلسه فاضل من الدرس ${last + 1 <= end ? `(${pg(last + 1)}${end > last + 1 ? "–" + (window.RAG ? RAG.pgNum(bid, end) : end) : ""})` : ""}. قولّي «كمّل» وأكمّل من هنا.`;
    wait.remove(); wait = null; history.push({ role: "user", content: `${label} (${name})` }, { role: "assistant", content: a });
    const node = add("a", a);
    window.TUTOR?.badge?.(node, { id: bid, from: h ? h.page : s0, to: end, h, kind: "section" });
    if (!ended) { const b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.textContent = "كمّل الشرح ←"; b.onclick = () => { if (!document.body.classList.contains("gen")) explainLesson({ from: lessonState.next, id: lessonState.id, cont: true, to: lessonState.to, h: lessonState.h }); }; node.insertBefore(b, node.querySelector(".acts")); }
    if (vs) vs.end(a, node); else window.voiceAfter?.(a, node);   // الصوت بيشتغل بس لو الطالب طلبه (زرار «اسمع» / القراءة التلقائية / المحادثة الصوتية)
  } catch (err) { wait?.remove(); const nd = add("a", errMsg(err)); if (err?.name !== "AbortError") retryChip(nd); window.voiceAfter?.(/^⏹/.test(errMsg(err)) ? "⏹" : "", null); }
  busy = false;
}
$("explain").onclick = () => explainLesson();

// ===== الميكروفون =====
const SR = window.SpeechRecognition || window.webkitSpeechRecognition; let rec = null, listening = false, micLang = "ar-EG", base = "";
if (!SR) { $("lang").hidden = true; $("mic").classList.add("unsup"); $("mic").title = "الكتابة بالصوت مش مدعومة في المتصفح ده"; }   // الزرار بيفضل ظاهر ويشرح السبب بدل ما يختفي
const micWhy = () => !window.isSecureContext ? "🎙️ الميكروفون بيشتغل بس لما الموقع يتفتح من رابط https (زي GitHub Pages) أو localhost."
  : "🎙️ المتصفح ده مبيدعمش تحويل الكلام لكتابة. استخدم Chrome أو Edge أو Safari، أو اكتب سؤالك عادي.";
const MIC_LANGS = [["ar-EG", "ع", "عربي (مصري)"], ["ar-SA", "خ", "عربي (سعودي/خليجي)"], ["en-US", "EN", "English"]];
function setMicLang(l, manual) { const x = MIC_LANGS.find(m => m[0] === l) || MIC_LANGS[0]; micLang = x[0]; $("lang").textContent = x[1]; $("lang").title = "لغة الميكروفون: " + x[2]; if (manual) localStorage.setItem("miclang", micLang); }
$("lang").onclick = () => { const i = MIC_LANGS.findIndex(m => m[0] === micLang); setMicLang(MIC_LANGS[(i + 1) % MIC_LANGS.length][0], true); };
if (localStorage.getItem("miclang")) setMicLang(localStorage.getItem("miclang"));
$("mic").onclick = () => {
  if (!SR || !window.isSecureContext) { (window.toast || alert)(micWhy()); return; }
  if (listening) { rec.stop(); return; }
  rec = new SR(); rec.lang = micLang; rec.interimResults = true; rec.continuous = true; base = $("q").value.trim(); base = base ? base + " " : "";
  rec.onresult = e => { let t = ""; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; $("q").value = base + t; };
  rec.onend = () => { listening = false; $("mic").classList.remove("rec"); document.body.classList.remove("dictating"); };
  rec.onerror = e => { const m = { "not-allowed": "🎙️ الميكروفون مقفول. اسمح للموقع يستخدمه من أيقونة القفل جنب الرابط وجرّب تاني.", "service-not-allowed": "🎙️ المتصفح مش سامح بالتعرّف على الكلام. جرّب Chrome أو Edge.", "audio-capture": "🎙️ مش لاقي ميكروفون شغال على الجهاز.", network: "🎙️ التعرّف على الكلام محتاج إنترنت. اتأكد من النت وجرّب تاني." }[e.error]; if (m) add("a", m); };
  try { rec.start(); listening = true; $("mic").classList.add("rec"); document.body.classList.add("dictating"); } catch (e) { listening = false; window.toast?.("🎙️ الميكروفون مشتغلش (" + (e?.message || "خطأ") + "). جرّب تاني."); }
};

// ===== الوضع الليلي/النهاري =====
const setTheme = t => { if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; };
setTheme(localStorage.getItem("theme"));
$("themeBtn").onclick = () => { const cs = document.documentElement.dataset.theme, dark = cs ? cs === "dark" : matchMedia("(prefers-color-scheme:dark)").matches; const t = dark ? "light" : "dark"; localStorage.setItem("theme", t); setTheme(t); };


// ===== إضافة كل الكتب مرة واحدة + حفظ + فتح آخر كتاب/صفحة تلقائيًا =====
const hashName = t => { let h = 5381; for (const c of t) h = ((h << 5) + h + c.codePointAt(0)) | 0; return (h >>> 0).toString(36); };
const bookTitle = f => f.replace(/\.pdf$/i, "").replace(/_+/g, " ").replace(/\s+/g, " ").trim();
const guessLang = t => /[\u0600-\u06FF]/.test(t) ? "ara" : "eng";
const bookLang = id => LIB.find(x => x.id === id)?.lang || (id === "english" ? "eng" : "ara");
const syncNames = () => { for (const k in NAMES) delete NAMES[k]; LIB.forEach(e => NAMES[e.id] = e.name); };
const libSave = () => idbSet("lib", LIB);
async function idbDel(k) { try { const t = await idbTx("readwrite"); await new Promise(res => { t.objectStore("f").delete(k); t.oncomplete = res; t.onerror = t.onabort = res; }); } catch {} }
async function idbKeys() { try { const tx = await idbTx("readonly"); return await new Promise(res => { const q = tx.objectStore("f").getAllKeys(); q.onsuccess = () => res(q.result); q.onerror = () => res([]); }); } catch { return []; } }
function renderLib() {
  syncNames();
  $("book").innerHTML = "<option value=''>كل الكتب</option>" + LIB.map(e => `<option value="${esc(e.id)}">${esc(e.name)}</option>`).join("");
  if (cur.want && LIB.some(e => e.id === cur.want)) $("book").value = cur.want;
  const bx = $("books"); bx.textContent = "";
  LIB.forEach(e => { const b = document.createElement("button"); b.dataset.id = e.id; b.dataset.saved = "1"; b.classList.toggle("on", e.id === cur.want); b.append(e.name);
    const x = document.createElement("span"); x.className = "bx"; x.textContent = "✕"; x.title = "مسح الكتاب من متصفحك"; x.dataset.del = e.id; b.append(x); bx.append(b); });
  bx.onclick = ev => { const del = ev.target.dataset?.del; if (del) { ev.stopPropagation(); delBook(del); return; } const id = ev.target.closest("button")?.dataset.id; if (id) openBook(id, 1); };
}
async function delBook(id) {
  const e = LIB.find(x => x.id === id); if (!e || !confirm(`تمسح «${e.name}» من متصفحك؟ (الملف والفهرس والتظليلات بتاعته)`)) return;
  for (const k of [id, "idx:" + id, "ann_" + id, "emb:" + id, "prog:" + id, "thumb:" + id, "weak:" + id, "plan:" + id]) await idbDel(k);
  window.dispatchEvent(new CustomEvent("book-deleted", { detail: { id } }));
  LIB = LIB.filter(x => x.id !== id); delete docs[id]; delete docErr[id]; delete BK[id];
  try { if (JSON.parse(localStorage.getItem("last") || "null")?.id === id) localStorage.removeItem("last"); } catch {}
  if (cur.id === id) { doc = null; cur.id = null; cur.mounted = null; cur.want = null; $("pages").innerHTML = ""; pgs = []; }
  await libSave(); renderLib();
  if (!LIB.length) showEmpty(); else if (!doc) openBook(LIB[0].id, 1);
}
// حدّين واضحين (كل واحد قيمة واحدة في config.js ومستخدمة في كل الموقع):
//  • MAX_PDF_MB (maxPdfMB، 300): أكبر كتاب يتحفظ على جهازك — حماية للمتصفح.
//  • SYNC_MAX_MB (syncMaxPdfMB، 50): أكبر كتاب يتزامن مع حسابك = حد الـ bucket في server/supabase.sql وحد Supabase المجاني. الأكبر منه بيفضل على الجهاز ده بس (بنقولك).
const MAX_PDF_MB = +(window.TUTOR_CONFIG?.maxPdfMB) > 0 ? +window.TUTOR_CONFIG.maxPdfMB : 300, SYNC_MAX_MB = +(window.TUTOR_CONFIG?.syncMaxPdfMB) > 0 ? +window.TUTOR_CONFIG.syncMaxPdfMB : 50;
window.MAX_PDF_MB = MAX_PDF_MB; window.SYNC_MAX_MB = SYNC_MAX_MB;
async function importMany(files) {
  const pdfs = files.filter(f => /\.pdf$/i.test(f.name) || f.type === "application/pdf"), bad = files.filter(f => !pdfs.includes(f)).map(f => "مش PDF: " + f.name);
  let done = 0, first = null; const ids = [], big = [];
  for (const f of pdfs) {
    let head = ""; try { head = new TextDecoder("latin1").decode(await f.slice(0, 1024).arrayBuffer()); } catch {}
    if (f.size > MAX_PDF_MB * 1048576) { bad.push(`الملف أكبر من ${MAX_PDF_MB} ميجا: ` + f.name); continue; }   // حماية الجهاز والمتصفح
    if (!f.size || !head.includes("%PDF-")) { bad.push((f.size ? "الملف ده مش PDF سليم: " : "الملف فاضي: ") + f.name); continue; }   // اسمه .pdf بس مش PDF حقيقي
    const id = LEGACY_FILES[f.name] || LIB.find(x => x.file === f.name)?.id || "b" + hashName(f.name.normalize("NFKC"));
    progressUI(`جاري حفظ ${esc(bookTitle(f.name))}...`);
    if (await idbSet(id, f)) {
      const old = LIB.find(x => x.id === id), e = { id, name: old?.name || LEGACY_NAMES[id] || bookTitle(f.name), lang: old?.lang || (id === "english" ? "eng" : guessLang(f.name)), file: f.name, added: old?.added || Date.now(), size: f.size };
      if (old) Object.assign(old, e); else LIB.push(e);
      delete docs[id]; delete BK[id]; idbDel("idx:" + id); idbDel("emb:" + id); ptCache.clear();   // ممكن يكون ملف مختلف بنفس الاسم: نعيد الفهرسة
      if (cur.id === id) { doc = null; cur.id = null; cur.mounted = null; }
      done++; first = first || id; ids.push(id); if (f.size > SYNC_MAX_MB * 1048576) big.push(`${bookTitle(f.name)} (${Math.round(f.size / 1048576)} ميجا)`);
    } else bad.push("فشل حفظ " + f.name + " (المساحة في المتصفح مش كفاية؟)");
  }
  syncNames(); await libSave(); renderLib(); navigator.storage?.persist?.();
  if (ids.length) window.dispatchEvent(new CustomEvent("books-imported", { detail: { ids } }));   // المزامنة مع الحساب (cloud.js) والمكتبة
  viewerMsg(`<div class="big">${done ? "✅" : "⚠️"}</div><p>${done ? `اتحفظ ${done} كتاب في متصفحك. هيفضلوا موجودين كل مرة تفتح الموقع، والذكي هيقراهم ويعرف اللي فيهم.` : "ماتحفظش أي كتاب."}${bad.length ? "<br><small>" + bad.map(esc).join("<br>") + "</small>" : ""}${big.length ? `<br><small>ℹ️ اتحفظ على جهازك بس (أكبر من حد المزامنة ${SYNC_MAX_MB} ميجا، فمش هيتزامن مع حسابك): ` + big.map(esc).join("، ") + "</small>" : ""}</p>`, done ? "" : "err");
  // لو فيه ملفات اترفضت، الرسالة تفضل ظاهرة (مش بتختفي لما الكتاب يتفتح لوحده) وفيها زرار يفتح الكتاب
  if (bad.length) { window.toast?.("⚠️ " + bad.length + " ملف ماتحفظش: " + bad.join("، ")); if (first) { const btn = document.createElement("button"); btn.id = "openFirst"; btn.textContent = "📖 افتح «" + (LIB.find(x => x.id === first)?.name || "الكتاب") + "»"; btn.onclick = () => openBook(first, 1); const pp = document.createElement("p"); pp.style.marginTop = "14px"; pp.append(btn); $("vmsg").append(pp); } }
  else if (first) setTimeout(() => openBook(first, 1), 900);
  if (ids.length > 1) bkBackground(ids.filter(x => x !== first));
}
$("files").onchange = e => { importMany([...e.target.files]); e.target.value = ""; };
$("addAll").onclick = () => $("files").click(); $("addAll2").onclick = () => $("files").click();
const saveLast = () => { if (cur.id) localStorage.setItem("last", JSON.stringify({ id: cur.id, page: cur.page })); };
setInterval(saveLast, 2000); addEventListener("pagehide", saveLast);
// كتب جاهزة مع الموقع (config.js ← seedBooks: [{file, url}]): بتتحمّل مرة واحدة أول ما الموقع يتفتح وتتحفظ في متصفح المستخدم زي أي كتاب.
// لو المستخدم مسح كتاب منهم مبيرجعش لوحده (العلامة في localStorage "seeded"). لو التحميل فشل (نت ضعيف) بيحاول تاني المرة الجاية.
async function seedBooks() {
  const list = window.TUTOR_CONFIG?.seedBooks; if (!Array.isArray(list) || !list.length) return false;
  let done = []; try { done = JSON.parse(localStorage.getItem("seeded") || "[]"); } catch {}
  const todo = list.filter(b => b?.file && b.url && !done.includes(b.file) && !LIB.some(x => x.file === b.file)), files = [], fails = [];
  if (!todo.length) return false;
  for (const b of todo) {
    try {
      progressUI(`جاري تحميل ${esc(bookTitle(b.file))} (${files.length + 1} من ${todo.length})...`);
      const r = await fetch(b.url); if (!r.ok) throw new Error("HTTP " + r.status);
      files.push(new File([await r.blob()], b.file, { type: "application/pdf" }));
    } catch (e) { fails.push(bookTitle(b.file)); console.warn("seed", b.file, e); }
  }
  if (files.length) await importMany(files);
  const ok = todo.filter(b => LIB.some(x => x.file === b.file)).map(b => b.file);
  if (ok.length) { try { localStorage.setItem("seeded", JSON.stringify([...new Set([...done, ...ok])])); } catch {} }
  if (fails.length) window.toast?.("⚠️ مقدرتش أحمّل: " + fails.join("، ") + " — هحاول تاني المرة الجاية");
  return files.length > 0;
}
async function libInit() {
  let lib = await idbGet("lib");
  if (!Array.isArray(lib)) {   // نسخة قديمة: الكتب المحفوظة بأسمائها القديمة تتحول لمكتبة
    // بس الملفات الحقيقية (PDF) تبقى كتب — مش «chat1» ولا «notes» ولا «jobs» (كانوا بيظهروا ككتب وهمية لمستخدم جديد)
    lib = []; for (const k of await idbKeys()) if (typeof k === "string" && !/[:_]/.test(k) && !/^(lib|notes|exams|jobs|chat\d*|settings|deleted)$/.test(k) && (LEGACY_NAMES[k] || (await idbGet(k)) instanceof Blob)) lib.push({ id: k, name: LEGACY_NAMES[k] || k, lang: k === "english" ? "eng" : "ara" });
    if (lib.length) idbSet("lib", lib);
  }
  LIB = lib; renderLib();
  if (LIB.length) navigator.storage?.persist?.().catch(() => {});   // نطلب من المتصفح ميمسحش الكتب لوحده لو المساحة قلّت
  await bkPreload();
  if (await seedBooks()) return;   // أول مرة: الكتب الجاهزة اتحمّلت واتفتح أولها
  let opened = false;
  try { const l = JSON.parse(localStorage.getItem("last") || "null"); if (l && LIB.find(x => x.id === l.id)) { openBook(l.id, l.page || 1); opened = true; } } catch {}
  if (!opened) { if (!LIB.length) showEmpty(); else openBook(LIB[0].id, 1); }
  setTimeout(() => bkBackground(LIB.map(x => x.id).filter(id => !BK[id]?.q)), 4000);   // فهرسة سريعة للكتب اللي لسه متفهرستش
}
libInit();

addEventListener("DOMContentLoaded", load);   // بعد ما كل الملفات تتحمّل (ui.js فيه شاشة الترحيب)

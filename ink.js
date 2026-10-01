// ===== الكتابة على الكتب: قلم / هايلايتر / نص / ممحاة =====
// كل صفحة ليها طبقة canvas شفافة فوق الـ PDF. الرسم بيتخزن كنسب (0..1) من حجم الصفحة
// عشان يفضل في مكانه مهما اتغير التكبير أو حجم الشاشة، وبيتحفظ في المتصفح (IndexedDB) لكل كتاب.
const INK = { tool: "select", pc: "#e11d48", hc: "#facc15", size: 2, op: 0.4, ann: {}, bookId: null, undo: [], redo: [], editing: null, sel: null };
const SHAPES = ["line", "arrow", "rect", "circle"], STROKES = ["pen", "hl", "pencil"];
const PALETTE = ["#111827", "#e11d48", "#2563eb", "#16a34a", "#facc15", "#fb923c", "#a855f7"];
const PEN_W = [0.0016, 0.003, 0.006], HL_W = [0.012, 0.02, 0.032], TXT_S = [0.016, 0.024, 0.036];
const FONT = s => `600 ${s}px Cairo, Tahoma, Arial, sans-serif`;
const inkColor = () => INK.tool === "hl" ? INK.hc : INK.pc;

async function inkLoad(id) {
  INK.bookId = id; INK.ann = {}; INK.undo = []; INK.redo = []; INK.editing = null; INK.sel = null;
  const data = await idbGet("ann_" + id);
  if (INK.bookId !== id) return;          // الطالب غيّر الكتاب أثناء التحميل
  INK.ann = data || {};
  vis.forEach(inkDraw); annCount();
}
let saveT = 0;
function inkSave() {
  clearTimeout(saveT); const id = INK.bookId, data = INK.ann; if (!id) return;
  saveT = setTimeout(() => { saveT = 0; idbSet("ann_" + id, data); }, 150); annCount();
}
// لو الطالب قفل الصفحة أو عمل تحديث على طول بعد ما رسم: نحفظ فورًا
const inkFlush = () => { if (INK.bookId && saveT) { clearTimeout(saveT); saveT = 0; idbSet("ann_" + INK.bookId, INK.ann); } };
addEventListener("pagehide", () => { finishText(); inkFlush(); if (INK.bookId) idbSet("ann_" + INK.bookId, INK.ann); });
document.addEventListener("visibilitychange", () => { if (document.hidden) { finishText(); inkFlush(); } });
// التنقل بين الصفحات اللي فيها كتابة / تظليل / ملاحظات
const annPages = () => Object.keys(INK.ann).map(Number).filter(n => INK.ann[n]?.length).sort((a, b) => a - b);
function annCount() { const el = $("annN"); if (!el) return; const k = annPages().length; el.hidden = !k; el.textContent = k; $("annNext").title = k ? `فيه كتابة في ${k} صفحة — دوس عشان تروح للي بعدها` : "مفيش كتابة ولا تظليل في الكتاب ده لسه"; }
$("annNext").onclick = () => { finishText(); const ps = annPages(); if (!ps.length) { window.toast?.("مفيش كتابة ولا تظليل في الكتاب ده لسه."); return; } gotoPage(ps.find(n => n > cur.page) || ps[0]); };

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy; let t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function drawItem(ctx, it, W, H) {
  if (it.t === "text") {
    ctx.save(); ctx.fillStyle = it.c; ctx.font = FONT(it.s * W); ctx.textBaseline = "top"; ctx.textAlign = "left";
    it.v.split("\n").forEach((ln, i) => { ctx.direction = /[\u0590-\u08FF]/.test(ln) ? "rtl" : "ltr"; ctx.fillText(ln, it.x * W, it.y * H + i * it.s * W * 1.35); });
    ctx.restore(); return;
  }
  if (SHAPES.includes(it.t)) {   // خط / سهم / مستطيل / دايرة
    const [ax, ay] = [it.a[0] * W, it.a[1] * H], [bx, by] = [it.b[0] * W, it.b[1] * H];
    ctx.save(); ctx.lineCap = ctx.lineJoin = "round"; ctx.strokeStyle = it.c; ctx.lineWidth = it.w * W; ctx.beginPath();
    if (it.t === "rect") ctx.rect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay));
    else if (it.t === "circle") ctx.ellipse((ax + bx) / 2, (ay + by) / 2, Math.max(1, Math.abs(bx - ax) / 2), Math.max(1, Math.abs(by - ay) / 2), 0, 0, Math.PI * 2);
    else { ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
      if (it.t === "arrow") { const an = Math.atan2(by - ay, bx - ax), hl = Math.max(8, it.w * W * 4); ctx.moveTo(bx, by); ctx.lineTo(bx - hl * Math.cos(an - 0.45), by - hl * Math.sin(an - 0.45)); ctx.moveTo(bx, by); ctx.lineTo(bx - hl * Math.cos(an + 0.45), by - hl * Math.sin(an + 0.45)); } }
    ctx.stroke(); ctx.restore(); return;
  }
  const p = it.p; if (!p.length) return;
  ctx.save(); ctx.lineCap = ctx.lineJoin = "round"; ctx.strokeStyle = it.c; ctx.lineWidth = it.w * W;
  if (it.t === "hl") ctx.globalAlpha = it.o ?? 0.4;
  if (it.t === "pencil") { ctx.globalAlpha = 0.75; ctx.lineCap = ctx.lineJoin = "butt"; }
  ctx.beginPath(); ctx.moveTo(p[0][0] * W, p[0][1] * H);
  if (p.length === 1) ctx.lineTo(p[0][0] * W + 0.01, p[0][1] * H);
  for (let i = 1; i < p.length - 1; i++) ctx.quadraticCurveTo(p[i][0] * W, p[i][1] * H, (p[i][0] + p[i + 1][0]) / 2 * W, (p[i][1] + p[i + 1][1]) / 2 * H);
  if (p.length > 1) ctx.lineTo(p.at(-1)[0] * W, p.at(-1)[1] * H);
  ctx.stroke(); ctx.restore();
}
function inkCanvas(el) {
  if (el._ink) return el._ink;
  const c = el._ink = document.createElement("canvas"); c.className = "ink"; el.append(c); bindInk(c, el); return c;
}
function inkDraw(el) {
  if (!el?.isConnected) return; const W = el.clientWidth, H = el.clientHeight; if (!W || !H) return;
  const c = inkCanvas(el), d = Math.min(devicePixelRatio || 1, 2), w = Math.round(W * d), h = Math.round(H * d);
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const ctx = c.getContext("2d"); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, w, h); ctx.scale(d, d);
  (INK.ann[+el.dataset.n] || []).forEach(it => drawItem(ctx, it, W, H));
  const S = INK.sel; if (S && S.n === +el.dataset.n && (INK.ann[S.n] || []).includes(S.it)) {   // العنصر المحدد: إطار + مربع تكبير
    const b = bbox(ctx, S.it, W, H); ctx.save(); ctx.strokeStyle = "#2563eb"; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.2; ctx.strokeRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8);
    ctx.setLineDash([]); ctx.fillStyle = "#2563eb"; ctx.fillRect(b.x + b.w + 4 - 6, b.y + b.h + 4 - 6, 12, 12); ctx.restore(); }
}
// حدود العنصر (بالبكسل) + تحريكه وتكبيره (بالنسب)
function bbox(ctx, it, W, H) {
  if (it.t === "text") { ctx.font = FONT(it.s * W); const ls = it.v.split("\n"), wd = Math.max(...ls.map(l => ctx.measureText(l).width)); return { x: it.x * W, y: it.y * H, w: wd, h: ls.length * it.s * W * 1.35 }; }
  const ps = it.p || [it.a, it.b], xs = ps.map(q => q[0] * W), ys = ps.map(q => q[1] * H), x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
const cloneIt = it => JSON.parse(JSON.stringify(it));
function moveIt(it, dx, dy) { const m = q => [q[0] + dx, q[1] + dy]; if (it.t === "text") { it.x += dx; it.y += dy; } else if (it.p) it.p = it.p.map(m); else { it.a = m(it.a); it.b = m(it.b); } }
function scaleIt(it, ox, oy, sx, sy) { const f = q => [ox + (q[0] - ox) * sx, oy + (q[1] - oy) * sy];
  if (it.t === "text") { it.s = Math.max(0.006, it.s * sx); } else if (it.p) it.p = it.p.map(f); else { it.a = f(it.a); it.b = f(it.b); } }
function inkFree(el) { if (el._ink) el._ink.width = el._ink.height = 0; }
const redraw = el => { if (el._raf) return; el._raf = requestAnimationFrame(() => { el._raf = 0; inkDraw(el); }); };

function hitItem(ctx, it, x, y, W, H, r) {
  if (it.t === "text") {
    ctx.font = FONT(it.s * W); const ls = it.v.split("\n"), wd = Math.max(...ls.map(l => ctx.measureText(l).width)), px = it.x * W, py = it.y * H;
    return x >= px - r && x <= px + wd + r && y >= py - r && y <= py + ls.length * it.s * W * 1.35 + r;
  }
  const rr = r + it.w * W / 2;
  if (SHAPES.includes(it.t)) { const ax = it.a[0] * W, ay = it.a[1] * H, bx = it.b[0] * W, by = it.b[1] * H;
    if (it.t === "rect") { const x0 = Math.min(ax, bx), x1 = Math.max(ax, bx), y0 = Math.min(ay, by), y1 = Math.max(ay, by); return [[x0, y0, x1, y0], [x1, y0, x1, y1], [x1, y1, x0, y1], [x0, y1, x0, y0]].some(s => segDist(x, y, ...s) <= rr); }
    if (it.t === "circle") { const cx = (ax + bx) / 2, cy = (ay + by) / 2, rx = Math.max(1, Math.abs(bx - ax) / 2), ry = Math.max(1, Math.abs(by - ay) / 2); return Math.abs(Math.hypot((x - cx) / rx, (y - cy) / ry) - 1) * Math.min(rx, ry) <= rr; }
    return segDist(x, y, ax, ay, bx, by) <= rr; }
  const p = it.p;
  for (let i = 0; i < p.length; i++) {
    if (Math.hypot(p[i][0] * W - x, p[i][1] * H - y) <= rr) return true;
    if (i && segDist(x, y, p[i - 1][0] * W, p[i - 1][1] * H, p[i][0] * W, p[i][1] * H) <= rr) return true;
  }
  return false;
}
function eraseAt(el, x, y, g) {
  const arr = INK.ann[g.n]; if (!arr?.length) return; const W = el.clientWidth, H = el.clientHeight, ctx = inkCanvas(el).getContext("2d"); let hit = false;
  for (let i = arr.length - 1; i >= 0; i--) if (hitItem(ctx, arr[i], x * W, y * H, W, H, 10)) { g.dels.push({ it: arr[i], i }); arr.splice(i, 1); hit = true; }
  if (hit) redraw(el);
}

function bindInk(c, el) {
  let g = null;
  const pt = e => { const r = c.getBoundingClientRect(); return [clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1)]; };
  c.addEventListener("pointerdown", e => {
    e.stopPropagation(); e.preventDefault(); if (e.pointerType === "mouse" && e.button !== 0) return;
    pending = 0; const n = +el.dataset.n; cur.page = n; $("pn").value = n; const [x, y] = pt(e);
    if (INK.tool === "text") {   // دوسة على ملاحظة موجودة = تعديلها، غير كده ملاحظة جديدة
      const arr = INK.ann[n] || [], W = el.clientWidth, H = el.clientHeight, ctx = c.getContext("2d");
      let i = -1; for (let k = arr.length - 1; k >= 0; k--) if (arr[k].t === "text" && hitItem(ctx, arr[k], x * W, y * H, W, H, 4)) { i = k; break; }
      if (i > -1) { finishText(); const it = arr.splice(i, 1)[0]; INK.undo.push({ type: "del", n, items: [{ it, i }] }); inkDraw(el); startText(el, it.x, it.y, it); return; }
      startText(el, x, y); return; }
    c.setPointerCapture?.(e.pointerId);
    if (INK.tool === "eraser") { g = { n, erase: true, dels: [] }; eraseAt(el, x, y, g); return; }
    if (INK.tool === "move") {   // تحديد عنصر: اسحبه تحرّكه، واسحب المربع الأزرق تكبّره/تصغّره
      const arr = INK.ann[n] || [], W = el.clientWidth, H = el.clientHeight, ctx = c.getContext("2d"), S = INK.sel;
      if (S && S.n === n && arr.includes(S.it)) { const b = bbox(ctx, S.it, W, H); if (Math.abs(x * W - (b.x + b.w + 4)) < 12 && Math.abs(y * H - (b.y + b.h + 4)) < 12) { g = { n, resize: true, it: S.it, before: cloneIt(S.it), b, x, y }; return; } }
      let hit = null; for (let k = arr.length - 1; k >= 0; k--) if (hitItem(ctx, arr[k], x * W, y * H, W, H, 8)) { hit = arr[k]; break; }
      const old = INK.sel; INK.sel = hit ? { n, it: hit } : null; if (old && old.n !== n) inkDraw(pageEl(old.n)); inkDraw(el); syncSel();
      if (hit) g = { n, move: true, it: hit, before: cloneIt(hit), x, y };
      return; }
    INK.redo = [];
    if (SHAPES.includes(INK.tool)) { const it = { t: INK.tool, c: INK.pc, w: PEN_W[INK.size - 1] * 1.2, a: [x, y], b: [x, y] }; (INK.ann[n] ||= []).push(it); g = { n, it, shape: true }; redraw(el); return; }
    const hl = INK.tool === "hl", pc = INK.tool === "pencil", it = { t: hl ? "hl" : pc ? "pencil" : "pen", c: inkColor(), w: (hl ? HL_W : PEN_W)[INK.size - 1] * (pc ? 0.7 : 1), p: [[x, y]] };
    if (hl) it.o = INK.op;
    (INK.ann[n] ||= []).push(it); g = { n, it }; redraw(el);
  });
  c.addEventListener("pointermove", e => {
    e.stopPropagation(); if (!g) return;
    const co = e.getCoalescedEvents?.();
    for (const ev of (co && co.length ? co : [e])) {
      const [x, y] = pt(ev);
      if (g.erase) eraseAt(el, x, y, g);
      else if (g.shape) { let bx = x, by = y; if (ev.shiftKey && g.it.t !== "line" && g.it.t !== "arrow") { const W = el.clientWidth, H = el.clientHeight, d = Math.max(Math.abs(x - g.it.a[0]) * W, Math.abs(y - g.it.a[1]) * H); bx = g.it.a[0] + Math.sign(x - g.it.a[0]) * d / W; by = g.it.a[1] + Math.sign(y - g.it.a[1]) * d / H; } g.it.b = [bx, by]; }
      else if (g.move) { const B = cloneIt(g.before); moveIt(B, x - g.x, y - g.y); Object.assign(g.it, B); }
      else if (g.resize) { const W = el.clientWidth, H = el.clientHeight, ox = g.b.x / W, oy = g.b.y / H, w0 = Math.max(4, g.b.w) / W, h0 = Math.max(4, g.b.h) / H;
        const sx = Math.max(0.1, (x - ox) / w0), sy = g.it.t === "text" ? sx : Math.max(0.1, (y - oy) / h0), B = cloneIt(g.before); scaleIt(B, ox, oy, sx, sy); Object.assign(g.it, B); }
      else { const l = g.it.p.at(-1); if (Math.hypot((x - l[0]) * el.clientWidth, (y - l[1]) * el.clientHeight) > 1.2) g.it.p.push([x, y]); }
    }
    if (!g.erase) redraw(el);
  });
  const end = e => {
    e.stopPropagation(); if (!g) return;
    if (g.erase) { if (g.dels.length) { INK.undo.push({ type: "del", n: g.n, items: g.dels }); INK.redo = []; } }
    else if (g.move || g.resize) { const after = cloneIt(g.it); if (JSON.stringify(after) !== JSON.stringify(g.before)) { INK.undo.push({ type: "edit", n: g.n, it: g.it, before: g.before, after }); INK.redo = []; } }
    else if (g.shape && Math.hypot((g.it.b[0] - g.it.a[0]) * el.clientWidth, (g.it.b[1] - g.it.a[1]) * el.clientHeight) < 4) { const arr = INK.ann[g.n]; arr.splice(arr.indexOf(g.it), 1); redraw(el); }   // ضغطة من غير سحب = مفيش شكل
    else INK.undo.push({ type: "add", n: g.n, it: g.it });
    g = null; inkSave();
  };
  c.addEventListener("pointerup", end); c.addEventListener("pointercancel", end);
}

// ----- نص مكتوب بالكيبورد -----
function startText(el, x, y, old) {
  finishText();
  const W = el.clientWidth, H = el.clientHeight, s = old?.s || TXT_S[INK.size - 1], col = old?.c || INK.pc, t = document.createElement("div");
  t.className = "ink-text"; t.contentEditable = "true"; t.spellcheck = false; t.setAttribute("dir", "auto");
  Object.assign(t.style, { left: x * W + "px", top: y * H + "px", fontSize: s * W + "px", color: col });
  if (old) t.innerText = old.v;
  ["pointerdown", "pointermove", "pointerup"].forEach(ev => t.addEventListener(ev, e => e.stopPropagation()));
  t.onkeydown = e => { if (e.key === "Escape") { t.textContent = ""; t.blur(); } };
  t.onblur = finishText; el.append(t); INK.editing = { el, t, x, y, s, c: col, book: INK.bookId }; t.focus();
  if (old) { const r = document.createRange(); r.selectNodeContents(t); r.collapse(false); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); }   // المؤشر في آخر الملاحظة
}
function finishText() {
  const E = INK.editing; if (!E) return; INK.editing = null;
  const v = E.t.innerText.replace(/\u00a0/g, " ").replace(/\s+$/, ""); E.t.remove();
  if (!v.trim() || E.book !== INK.bookId) { inkSave(); return; }   // ملاحظة اتفضّت = اتمسحت
  const n = +E.el.dataset.n, it = { t: "text", c: E.c, s: E.s, x: E.x, y: E.y, v };
  (INK.ann[n] ||= []).push(it); INK.undo.push({ type: "add", n, it }); INK.redo = []; inkSave(); inkDraw(E.el);
}

// ----- تراجع / مسح الصفحة -----
// كل عملية ليها عكس: تراجع (undo) بيرجّعها، وإعادة (redo) بيعملها تاني
function inkApply(a, back) {
  const arr = INK.ann[a.n] ||= [];
  if (a.type === "add") { if (back) { const i = arr.indexOf(a.it); if (i > -1) arr.splice(i, 1); } else arr.push(a.it); }
  else if (a.type === "del") { if (back) a.items.slice().reverse().forEach(({ it, i }) => arr.splice(Math.min(i, arr.length), 0, it)); else a.items.forEach(({ it }) => { const i = arr.indexOf(it); if (i > -1) arr.splice(i, 1); }); }
  else if (a.type === "clear") INK.ann[a.n] = back ? a.items : [];
  else if (a.type === "edit") { for (const k of Object.keys(a.it)) delete a.it[k]; Object.assign(a.it, cloneIt(back ? a.before : a.after)); }
  inkSave(); if (!vis.has(pageEl(a.n))) gotoPage(a.n); inkDraw(pageEl(a.n));
}
function inkUndo() { finishText(); const a = INK.undo.pop(); if (!a) return; inkApply(a, true); INK.redo.push(a); syncSel(); }
function inkRedo() { finishText(); const a = INK.redo.pop(); if (!a) return; inkApply(a, false); INK.undo.push(a); syncSel(); }
function inkDelSel() {
  const S = INK.sel; if (!S) return; const arr = INK.ann[S.n] || [], i = arr.indexOf(S.it); INK.sel = null; syncSel(); if (i < 0) return;
  arr.splice(i, 1); INK.undo.push({ type: "del", n: S.n, items: [{ it: S.it, i }] }); INK.redo = []; inkSave(); inkDraw(pageEl(S.n));
}
function syncSel() { const b = $("delSel"); if (b) b.hidden = !INK.sel; }
function inkClear() {
  finishText(); const n = cur.page, arr = INK.ann[n]; if (!arr?.length) return;
  if (!confirm("تمسح كل الكتابة اللي على صفحة " + n + "؟")) return;
  INK.undo.push({ type: "clear", n, items: arr }); INK.redo = []; INK.ann[n] = []; inkSave(); inkDraw(pageEl(n));
}

// ----- شريط الأدوات -----
function syncColors() { const c = inkColor(); document.querySelectorAll("#colors .cdot").forEach(d => d.classList.toggle("on", d.dataset.c === c)); }
function setTool(t) {
  finishText(); INK.tool = t; document.body.dataset.tool = t; clearPin();
  if (t !== "move" && INK.sel) { const n = INK.sel.n; INK.sel = null; inkDraw(pageEl(n)); syncSel(); }
  const op = $("hlop"); if (op) op.hidden = t !== "hl";
  document.querySelectorAll("#tools [data-tool]").forEach(b => b.classList.toggle("on", b.dataset.tool === t)); syncColors();
  $("shapeBtn")?.classList.toggle("on", SHAPES.includes(t));
}
$("colors").innerHTML = PALETTE.map(c => `<button type="button" class="cdot" data-c="${c}" style="background:${c}" aria-label="لون"></button>`).join("");
$("colors").onclick = e => {
  const c = e.target.dataset?.c; if (!c) return;
  if (INK.tool === "select" || INK.tool === "eraser") setTool("pen");
  if (INK.tool === "hl") INK.hc = c; else INK.pc = c; syncColors();
};
document.querySelectorAll("#tools [data-tool]").forEach(b => b.onclick = () => setTool(b.dataset.tool));
$("shapeBtn").onclick = e => { e.stopPropagation(); const m = $("shapes"); m.hidden = !m.hidden; if (!m.hidden && innerWidth <= 800) { const r = $("shapeBtn").getBoundingClientRect(); m.style.top = r.bottom + 4 + "px"; m.style.left = Math.max(8, r.left - 60) + "px"; } };
$("shapes").addEventListener("click", () => { $("shapes").hidden = true; });
document.addEventListener("pointerdown", e => { if (!e.target.closest?.(".shapewrap")) $("shapes").hidden = true; });
$("sz").oninput = e => { INK.size = +e.target.value; };
$("undo").onclick = inkUndo; $("clr").onclick = inkClear;
if ($("redo")) $("redo").onclick = inkRedo;
if ($("delSel")) $("delSel").onclick = inkDelSel;
if ($("hlop")) $("hlop").oninput = e => { INK.op = +e.target.value; };
document.addEventListener("keydown", e => {
  if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || document.activeElement.isContentEditable) return;
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === "z" && !e.shiftKey) { e.preventDefault(); inkUndo(); }
  else if ((e.ctrlKey || e.metaKey) && (k === "y" || (k === "z" && e.shiftKey))) { e.preventDefault(); inkRedo(); }
  else if ((k === "delete" || k === "backspace") && INK.sel) { e.preventDefault(); inkDelSel(); }
});
// للتصدير (reader.js): رسم كتابة صفحة على canvas بأي مقاس
window.inkRender = (ctx, n, W, H) => (INK.ann[n] || []).forEach(it => drawItem(ctx, it, W, H));
window.inkPages = () => annPages();
setTool("select");

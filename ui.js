// ===== واجهة المحادثة: الترحيب، نسخ / إعادة الإجابة / تعديل السؤال، زرار الإيقاف، السكرول، مربع الكتابة =====
(() => {
  const I = d => `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const IC = {
    copy: I('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
    ok: I('<polyline points="20 6 9 17 4 12"/>'),
    regen: I('<path d="M21 12a9 9 0 1 1-2.64-6.36"/><polyline points="21 3 21 9 15 9"/>'),
    edit: I('<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
    send: I('<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>'),
    stop: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor"/></svg>',
    down: I('<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>')
  };
  const chat = $("chat");

  // ---------- الترحيب + اقتراحات ----------
  const SUGG = [["📖", "اشرحلي الدرس ده"], ["📝", "لخص الفصل ده"], ["🎯", "اختبرني سؤال سؤال"], ["🃏", "اعمللي Flashcards"], ["⭐", "إيه أهم الحاجات اللي لازم أحفظها؟"], ["🧭", "راجع معايا قبل الامتحان"]];
  window.showHello = () => {
    const d = document.createElement("div"); d.className = "hello";
    d.innerHTML = `<div class="orb" aria-hidden="true"></div><h2>أهلًا 👋 أنا مدرّسك الخاص</h2><p>ضيف كتابك (PDF) واسألني فيه بأي طريقة — بالمصري أو الخليجي أو الفصحى أو English. هشرحلك من كتابك وأقولك الصفحة.</p>
      <div class="chips">${SUGG.map(([e, t]) => `<button type="button" class="chip" data-q="${esc(t)}"><span>${e}</span>${esc(t)}</button>`).join("")}</div>`;
    d.onclick = e => { const c = e.target.closest(".chip"); if (!c) return; $("q").value = c.dataset.q; $("form").requestSubmit(); };
    chat.append(d);
  };

  // ---------- أزرار تحت الرد ----------
  const plain = node => { const c = node.cloneNode(true); c.querySelectorAll(".acts,.src,.uedit,button,.fch").forEach(x => x.remove()); c.querySelectorAll("span.math").forEach(m => m.replaceWith(m.dataset.tex || m.textContent)); return c.innerText.replace(/\n{3,}/g, "\n\n").trim(); };
  function acts(node) {
    let a = node.querySelector(":scope > .acts"); if (a) return a;
    a = document.createElement("div"); a.className = "acts"; node.append(a); return a;
  }
  const iconBtn = (cls, html, title) => { const b = document.createElement("button"); b.type = "button"; b.className = "ab " + cls; b.innerHTML = html; b.title = title; b.setAttribute("aria-label", title); return b; };
  window.addCopy = node => {
    const a = acts(node); if (a.querySelector(".cp")) return;
    const b = iconBtn("cp", IC.copy, "نسخ الرد");
    b.onclick = async () => { const t = node._copy || plain(node); try { await navigator.clipboard.writeText(t); } catch { const x = document.createElement("textarea"); x.value = t; document.body.append(x); x.select(); document.execCommand("copy"); x.remove(); } b.innerHTML = IC.ok; b.classList.add("done"); setTimeout(() => { b.innerHTML = IC.copy; b.classList.remove("done"); }, 1400); };
    a.prepend(b);
  };
  window.markAnswer = (node, turn) => {
    if (!node || node.classList.contains("typing")) return; window.addCopy(node);
    const a = acts(node); if (a.querySelector(".rg")) return;
    const b = iconBtn("rg", IC.regen, "إجابة تانية"); b.onclick = () => { if (!document.body.classList.contains("gen")) TUTOR.redo(turn); };
    a.append(b);
  };
  // ---------- تعديل سؤالك ----------
  window.markUser = (uNode, turn) => {
    if (uNode.querySelector(".uedit")) return;
    const b = iconBtn("uedit", IC.edit, "عدّل السؤال"); uNode.append(b);
    b.onclick = () => {
      if (document.body.classList.contains("gen") || uNode.classList.contains("editing")) return;
      uNode.classList.add("editing"); const old = turn.q; uNode.textContent = "";
      const ta = document.createElement("textarea"); ta.value = old; ta.rows = Math.min(8, old.split("\n").length + 1); ta.dir = "auto";
      const row = document.createElement("div"); row.className = "erow";
      const ok = document.createElement("button"); ok.type = "button"; ok.textContent = "إرسال"; const no = document.createElement("button"); no.type = "button"; no.className = "ghost"; no.textContent = "إلغاء";
      row.append(no, ok); uNode.append(ta, row); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
      const restore = () => { uNode.classList.remove("editing"); uNode.textContent = old; uNode.append(b); };
      no.onclick = restore;
      ok.onclick = () => { const v = ta.value.trim(); if (!v || v === old) return restore(); TUTOR.edit(turn, v); };
      ta.onkeydown = e => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); ok.click(); } else if (e.key === "Escape") restore(); };
    };
  };

  // ---------- زرار الإرسال = إيقاف وقت الرد ----------
  const send = $("send");
  const syncSend = () => { const g = document.body.classList.contains("gen"); send.innerHTML = g ? IC.stop : IC.send; send.title = g ? "وقّف الرد" : "إرسال"; send.setAttribute("aria-label", send.title); send.type = g ? "button" : "submit"; send.classList.toggle("stop", g); };
  new MutationObserver(syncSend).observe(document.body, { attributes: true, attributeFilter: ["class"] }); syncSend();
  send.addEventListener("click", e => { if (!document.body.classList.contains("gen")) return; e.preventDefault(); stopGen(); if (typeof VC !== "undefined" && VC.on) { VC.waiting = false; setTimeout(() => window.voiceListen?.(), 300); } });

  // ---------- مربع الكتابة بيكبر مع الكلام ----------
  const q = $("q");
  window.autoGrow = () => { q.style.height = "auto"; q.style.height = Math.min(q.scrollHeight, innerHeight * 0.32) + "px"; };
  q.addEventListener("input", autoGrow); setTimeout(autoGrow, 0);
  q.addEventListener("input", () => q.dir = /^[\s\d\p{P}]*[A-Za-z]/u.test(q.value) ? "ltr" : "rtl");

  // ---------- انزل لآخر الكلام ----------
  const down = document.createElement("button"); down.type = "button"; down.id = "toBottom"; down.innerHTML = IC.down; down.title = "انزل لآخر الكلام"; down.setAttribute("aria-label", down.title); down.hidden = true;
  $("side").append(down); down.onclick = () => chat.scrollTo({ top: chat.scrollHeight, behavior: "smooth" });
  let raf = 0; chat.addEventListener("scroll", () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; down.hidden = nearBottom(); }); }, { passive: true });
  new MutationObserver(() => { down.hidden = nearBottom(); }).observe(chat, { childList: true });
  if (window.ResizeObserver) new ResizeObserver(() => $("side").style.setProperty("--fh", $("form").offsetHeight + "px")).observe($("form"));

  // ---------- المحادثة بتتحفظ في المتصفح وبترجع بعد التحديث + «محادثة جديدة» ----------
  const KEY = "chat1", MAXM = 60; let st = 0, restored = false;
  const nb = document.createElement("button"); nb.type = "button"; nb.id = "newChat"; nb.className = "newchat"; nb.hidden = true;
  nb.innerHTML = I('<path d="M12 5v14"/><path d="M5 12h14"/>') + "<span>محادثة جديدة</span>"; nb.title = "ابدأ محادثة جديدة (المحادثة الحالية هتتمسح)";
  const head = document.createElement("div"); head.className = "chathead"; head.hidden = true; head.append(nb); chat.before(head);   // صف صغير فوق المحادثة (مش فوق الكلام)
  const hasMsgs = () => !!chat.querySelector(":scope > .m");
  function snapshot() {
    const msgs = [];
    chat.querySelectorAll(":scope > .m").forEach(n => {
      if (n.classList.contains("typing") || n.classList.contains("editing")) return;
      if (n.classList.contains("u")) { const t = n.textContent.trim(); if (t) msgs.push({ c: "u", t }); return; }
      const c = n.cloneNode(true); c.querySelectorAll(".acts, .vctl, .uedit, button, input, textarea, select").forEach(x => x.remove());   // الأزرار التفاعلية مبتتحفظش
      const h = c.innerHTML.trim(); if (h) msgs.push({ c: "a", h, copy: n._copy || "", say: n._spk?._text || "" });
    });
    return { v: 1, t: Date.now(), msgs: msgs.slice(-MAXM), history: history.slice(-40) };
  }
  const save = () => { clearTimeout(st); st = setTimeout(() => { if (!restored || document.body.classList.contains("gen")) return; idbSet(KEY, hasMsgs() ? snapshot() : null); }, 800); };
  new MutationObserver(() => { head.hidden = nb.hidden = !hasMsgs(); save(); }).observe(chat, { childList: true });
  new MutationObserver(save).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  addEventListener("pagehide", () => { if (restored && !document.body.classList.contains("gen")) idbSet(KEY, hasMsgs() ? snapshot() : null); });
  addEventListener("DOMContentLoaded", async () => {
    let s0 = null; try { s0 = await idbGet(KEY); } catch {}
    if (s0?.msgs?.length && !hasMsgs()) {
      chat.querySelector(".hello")?.remove();
      for (const m of s0.msgs) {
        const d = document.createElement("div"); d.className = "m " + m.c;
        if (m.c === "u") d.textContent = m.t;
        else { d.innerHTML = m.h; d._copy = m.copy; chat.append(d); window.renderMath?.(d); if (m.say) window.voiceDecorate?.(d, m.say); else window.addCopy?.(d); continue; }
        chat.append(d);
      }
      if (!history.length && Array.isArray(s0.history)) history.push(...s0.history);
      chat.scrollTop = chat.scrollHeight;
    }
    restored = true; head.hidden = nb.hidden = !hasMsgs();
  });
  nb.onclick = () => {
    if (document.body.classList.contains("gen") || !confirm("تبدأ محادثة جديدة؟ المحادثة الحالية هتتمسح.")) return;
    window.stopSpeak?.(); chat.textContent = ""; history.length = 0; window.TUTOR?.reset?.(); if (typeof lessonState !== "undefined") lessonState = null;
    idbSet(KEY, null); window.showHello?.(); head.hidden = nb.hidden = true;
  };
})();

// ===== مهارات المساعد (skills): حاجات المساعد بيعملها في الموقع نفسه بدل ما يرد بكلام بس =====
//  🎬 «هاتلي فيديوهات يوتيوب عن …»      → أحسن فيديوهات (YouTube Data API على السيرفر)، وكل فيديو يشتغل جوه الموقع مكان الكتاب أو جنب الكراسة
//  🔗 لينك يوتيوب في الشات               → الفيديو يتفتح جوه الموقع
//  📓 «بص على / صحّحلي / اشرحلي الكراسة» → صورة صفحة الكراسة اللي قدامك بتتبعت مع السؤال للمساعد
//  📝 «حط ده في الكراسة»                 → آخر رد من المساعد يتكتب في الكراسة
//  📖 «افتح الكراسة» / «افتح الكتاب»      → ترتيب الشاشة
//  ❓ «تقدر تعمل إيه؟»                    → قايمة المهارات دي
// المهارات بتشتغل قبل الذكاء الاصطناعي (مش محتاجة مزوّد معيّن)، وأي سؤال تاني بيروح للمدرّس عادي.
(() => {
  if (!window.TUTOR?.handle) return;
  const T = s => window.I18N?.t(s) || s;
  const nq = s => String(s || "").toLowerCase().replace(/[إأآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[ً-ْ]/g, "").replace(/\s+/g, " ").trim();
  const RX = {
    video: /(فيديو|فديو|فيدو|يوتيوب|يوتوب|youtube|video)/,
    kurAsk: /(كراسه|كراسة|نوت ?بوك).*(بص|شوف|صحح|صححلي|اشرح|اشرحلي|راجع|اقرا|فهمني|ايه رايك|قيم)|(بص|شوف|صحح|صححلي|اشرح|اشرحلي|راجع|اقرا|قيم).*(كراسه|كراسة|نوت ?بوك)/,
    kurPut: /(حط|اكتب|ضيف|انقل|احفظ|سجل).*(ده|دا|الرد|الكلام|الاجابه|الشرح)?.*(في|ف|على|للكراسه|للكراسة)\s*(ال)?كراس/,
    kurOpen: /^(افتح|اعرض|وريني|ورينى|هات)\s*(لي|ليا)?\s*(ال)?كراس/,
    bookOpen: /^(افتح|اعرض|رجع|ارجع)\s*(لي|ليا)?\s*(ال)?(كتاب|pdf)/,
    help: /^(تقدر تعمل ايه|بتعمل ايه|ايه مهاراتك|مهاراتك|ساعدني ازاي|ايه اللي تقدر تعمله|what can you do|help)\s*\??$/,
  };
  // كلمات الطلب نفسه (مش الموضوع): بتتشال عشان يفضل اسم الدرس بس
  const STOP = new Set("هات هاتلي هاتلى هاتهولي جيب جيبلي جيبلى حيبلي حيب ابعت ابعتلي ابعتلى عايز عاوز عاوزه عايزه عايزين اقترح اقترحلي وريني ورينى فرجني لي ليا لى ممكن لو سمحت من فضلك please get me find show some best احسن افضل اقوي حلوه كويسه فيديو فيديوهات فديو فديوهات فيدو يوتيوب يوتوب youtube video videos علي على من عن في ف شرح بتشرح تشرح يشرح بيشرح explain explaining about on for of the a an".split(" "));
  const add = window.add || (() => null);
  const book = () => (typeof cur !== "undefined" && cur.id) || $("book")?.value || "";
  const bookName = () => { const id = book(); return (window.NAMES?.[id] || (typeof LIB !== "undefined" ? LIB.find(e => e.id === id)?.name : "") || "").replace(/\.pdf$/i, "").replace(/[_\-–—]+/g, " ").trim(); };
  function topicNow() {   // الدرس اللي الطالب فاتحه دلوقتي (من فهرس الكتاب)
    try { const id = book(), p = typeof cur !== "undefined" ? cur.page : 1, ol = window.RAG?.outline?.(id) || [], sec = ol.filter(h => h.page <= p && (h.to || h.page) >= p);
      return ((sec.find(h => h.lv >= 2) || sec[0])?.line || "").slice(0, 70); } catch { return ""; }
  }
  // «الدرس الأول / التاني…» و«الدرس ده» و«الكتاب ده» بيتحوّلوا لاسم الدرس الحقيقي من فهرس الكتاب
  const ORD = { اول: 1, الاول: 1, اولي: 1, تاني: 2, ثاني: 2, التاني: 2, الثاني: 2, تالت: 3, ثالث: 3, التالت: 3, الثالث: 3, رابع: 4, الرابع: 4, خامس: 5, الخامس: 5, سادس: 6, السادس: 6, سابع: 7, السابع: 7, تامن: 8, ثامن: 8, التامن: 8, الثامن: 8, تاسع: 9, التاسع: 9, عاشر: 10, العاشر: 10 };
  function lessons() {
    try { const ol = (window.RAG?.outline?.(book()) || []).filter(h => h.line && h.line.trim().length > 2);
      const ls = ol.filter(h => /(درس|الدرس|lesson)/i.test(h.line)); return ls.length ? ls : ol.filter(h => h.lv <= 2); } catch { return []; }
  }
  const cleanName = s => String(s || "").replace(/(المعاصر|الامتحان|سلاح التلميذ|الاضواء|الأضواء|ترم\s*\d|الترم\s*(الاول|الأول|الثاني|التاني)|\d{4})/g, " ").replace(/\s+/g, " ").trim();
  function videoTopic(q) {
    const n = nq(q); let lesson = "";
    const m = n.match(/(?:الدرس|درس|lesson)\s+(?:رقم\s+)?([^\s]+)/);
    if (m) { const k = ORD[m[1]] || (/^\d+$/.test(m[1]) ? +m[1] : 0); if (k) lesson = (lessons()[k - 1]?.line || "").slice(0, 70); else if (/^(ده|دا|دي|الحالي|اللي)$/.test(m[1])) lesson = topicNow(); }
    let t = q.replace(/https?:\/\/\S+/g, " ").replace(/[؟?!.,،:«»"]+/g, " ")
      .replace(/(ال)?(كتاب|درس|فصل|وحده|وحدة|صفحه|صفحة)\s+(ده|دا|دي|ده\b)/g, " ").replace(/(ال)?درس\s+(رقم\s+)?[^\s]+/g, " ")
      .split(/\s+/).filter(w => w && !STOP.has(nq(w)) && !STOP.has(nq(w).replace(/^(و|ب|ل)/, ""))).join(" ").trim();
    if (lesson) t = (lesson + " " + t).trim();
    if (t.length < 2) t = topicNow();
    const bn = cleanName(bookName());
    if (bn && !t.includes(bn)) t = (t + " " + bn).trim();   // اسم الكتاب (المادة والسنة) بيخلي النتايج أدق
    return t.replace(/\s+/g, " ").slice(0, 110);
  }
  const lang = s => (s.match(/[؀-ۿ]/g) || []).length >= (s.match(/[a-z]/gi) || []).length / 2 ? "ar" : "en";
  const ytLink = (node, href, label) => { if (!node) return; const a = document.createElement("a"); a.className = "ytlink bkbtn"; a.href = href; a.target = "_blank"; a.rel = "noopener"; a.textContent = "▶ " + label; node.insertBefore(a, node.querySelector(".acts")); };
  const say = (txt, cls = "") => { const n = add("a", txt); if (n && cls) n.classList.add(cls); window.voiceAfter?.(txt, n); return n; };

  // ----- 🎬 فيديوهات -----
  function cards(list, node) {
    const g = document.createElement("div"); g.className = "vchat";
    g.innerHTML = list.slice(0, 6).map(v => `<div class="vc" data-v="${esc(v.id)}"><button type="button" class="vct" data-play="main" title="${T("شغّله مكان الكتاب")}"><span class="vth" style="background-image:url('https://i.ytimg.com/vi/${esc(v.id)}/mqdefault.jpg')">${v.seconds ? `<em>${STUDY.vDur(v.seconds)}</em>` : ""}<i class="vpl">▶</i></span></button>
      <div class="vci"><b>${esc(v.title || "")}</b><small>${esc(v.channel || "")}${v.views ? " · " + STUDY.vNum(v.views) + " " + T("مشاهدة") : ""}</small>
      <div class="vcb"><button type="button" data-play="main">▶ ${T("مكان الكتاب")}</button><button type="button" data-play="side">▶ ${T("جنب الكراسة")}</button><button type="button" data-play="save" title="${T("احفظه مع الكتاب")}">⭐</button></div></div></div>`).join("");
    g.onclick = async e => { const b = e.target.closest("[data-play]"); if (!b) return; const id = b.closest("[data-v]").dataset.v, v = list.find(x => x.id === id);
      if (b.dataset.play === "save") { const bk = book(); if (!bk) return toast(T("افتح كتاب الأول")); await STUDY.vSaveToggle(bk, v); b.textContent = "✓"; toast("⭐ " + T("اتحفظ الفيديو مع الكتاب")); return; }
      if (b.dataset.play === "side") { window.LAYOUT?.openVideo(v, "side"); window.LAYOUT?.setMain?.("kur"); } else window.LAYOUT?.openVideo(v, "main"); };
    node.insertBefore(g, node.querySelector(".acts"));
  }
  async function videos(q) {
    const topic = videoTopic(q);
    if (!topic) { say(T("قولّي عايز فيديوهات عن إيه؟ مثلًا: «هاتلي فيديوهات عن قانون نيوتن التاني».")); return; }
    const h = window.PX?.on() ? await PX.health().catch(() => null) : null, link = window.STUDY?.vYT?.(topic) || "https://www.youtube.com/results?search_query=" + encodeURIComponent(topic);
    if (!h?.videos) { ytLink(say(`${T("البحث عن الفيديوهات جوه الموقع لسه مش متفعّل على السيرفر.")} ${T("اختار الفيديو اللي يعجبك من يوتيوب، وانسخ اللينك والزقه هنا في الشات، وهيشتغل جوه الموقع.")}`), link, T("افتح النتايج على يوتيوب")); return; }
    const wait = add("a", T("بدوّر على فيديوهات…")); wait?.classList.add("typing");
    let list = []; try { list = await STUDY.videoSearch(topic, lang(topic)); } catch (e) { wait?.remove(); const bad = /api key|key not valid|API_KEY|forbidden|403|400/i.test(e.message || "");
      ytLink(say("⚠️ " + (bad ? T("مفتاح YouTube اللي على السيرفر مش شغّال لسه (لو لسه عامله استنى ٥ دقايق، أو اتأكد إنه اتنسخ صح في /admin).") : (e.message || T("مقدرتش أجيب الفيديوهات")))), link, T("افتح النتايج على يوتيوب")); return; }
    wait?.remove();
    if (!list.length) { ytLink(say(`${T("ملقتش فيديوهات مناسبة عن")} «${topic}». ${T("جرّب تكتب اسم الدرس بشكل تاني.")}`), link, T("دوّر على يوتيوب")); return; }
    const n = say(`${T("دي أحسن فيديوهات لقيتها عن")} «${topic}» — ${T("دوس على أي فيديو يشتغل مكان الكتاب، أو «جنب الكراسة» عشان تذاكر وتكتب وإنت بتتفرج:")}`);
    if (n) cards(list, n);
  }

  // ----- 📓 الكراسة -----
  async function kurAsk(q) {
    const K = window.KURASA; if (!K) return false;
    window.LAYOUT?.state && (window.LAYOUT.state().SIDE !== "kur" && window.LAYOUT.state().MAIN !== "kur") && window.LAYOUT.setSide("kur");
    await K.show?.(); const c = K._render?.(); if (!c) return false;
    const url = c.toDataURL("image/jpeg", .88); window.TUTOR.attach([{ b64: url.split(",")[1], label: T("صفحة الكراسة") }]);
    return url;
  }
  function lastAnswer() { const ms = [...$("chat").querySelectorAll(".m.a:not(.typing):not(.sys)")]; const m = ms.at(-1); return m ? (m._copy || m.innerText).replace(/📝 احفظ كملاحظة|📓 للكراسة|✅.*$/gm, "").trim() : ""; }

  // ----- التوجيه -----
  const orig = window.TUTOR.handle.bind(window.TUTOR);
  window.TUTOR.handle = async (q, again = null) => {
    const n = nq(q).replace(/[؟?!.،,]+/g, " ").replace(/\s+/g, " ").trim(), yt = window.ytId?.(q);
    if (yt && /youtu/.test(q)) { add("u", q); window.LAYOUT?.openVideo({ id: yt, title: "" }, "main"); say("▶ " + T("فتحتلك الفيديو مكان الكتاب. تقدر تنقله جنب الكراسة من الزرار اللي فوقه.")); return; }
    if (RX.help.test(n)) { add("u", q); say(HELP); return; }
    if (RX.kurOpen.test(n)) { add("u", q); window.LAYOUT?.setSide("kur"); say("📓 " + T("فتحتلك الكراسة.")); return; }
    if (RX.bookOpen.test(n) && !RX.video.test(n)) { add("u", q); window.LAYOUT?.setMain("pdf"); say("📖 " + T("رجّعتلك الكتاب.")); return; }
    if (RX.kurPut.test(n) && !RX.kurAsk.test(n)) { add("u", q); const t = lastAnswer(); if (!t) { say(T("مفيش رد قبل كده أحطه في الكراسة.")); return; } await window.KURASA?.appendText(t); say("📓 " + T("حطيت آخر رد في الكراسة.")); return; }
    if (RX.video.test(n) && !/(اشرح|حل|صحح)\s.*(الفيديو|الفديو)/.test(n)) { add("u", q); try { await videos(q); } catch (e) { say("⚠️ " + e.message); } return; }
    if (RX.kurAsk.test(n)) { const ok = await kurAsk(q).catch(() => false); if (ok) return orig(q + "\n\n(" + T("مرفق صورة صفحة الكراسة اللي الطالب كاتبها بخط إيده أو بالكيبورد — اقراها كويس وجاوب عليها") + ")", again); }
    return orig(q, again);
  };
  const HELP = `${T("أقدر أساعدك في الموقع نفسه كمان:")}
- 🎬 **${T("فيديوهات يوتيوب")}**: ${T("قول «هاتلي فيديوهات عن قانون نيوتن» وأجيبلك أحسن فيديوهات تشتغل مكان الكتاب أو جنب الكراسة. ولو عندك لينك، الزقه هنا.")}
- 📓 **${T("الكراسة")}**: ${T("«بص على الكراسة» أو «صحّحلي اللي في الكراسة» وأشوف الصفحة اللي قدامك. و«حط ده في الكراسة» وأكتب آخر رد فيها.")}
- ✂️ **${T("من الكتاب للكراسة")}**: ${T("علّم على أي جزء في الكتاب بمربع ودوس «📓 للكراسة».")}
- 📖 ${T("«افتح الكراسة» / «افتح الكتاب» عشان أرتّبلك الشاشة.")}
- ✍️ ${T("وأكيد: اشرح، حل، اختبرني، لخّص، وأي سؤال في كتابك.")}`;
  window.SKILLS = { videos, videoTopic, HELP };
})();

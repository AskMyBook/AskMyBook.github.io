// ===== المدرّس الذكي: فهم الطلب + اللهجة + الذاكرة + السياق من ملفات المستخدم + المصادر + الامتحانات =====
// بيشتغل فوق app.js (نفس الـ llm ونفس الواجهة) وrag.js (البحث في كتب المستخدم الحالي بس).
(() => {
  const T = {};
  const nq = s => norm(String(s || "")).replace(/[۰-۹]/g, d => d.charCodeAt(0) - 1776).replace(/[.!؟?،,؛:"«»()]+/g, " ").replace(/\s+/g, " ").trim();
  const has = (n, re) => re.test(n);

  // ================= ١) اللهجة واللغة =================
  const EGW = new Set("ازاي عايز عايزه عاوز عاوزه دلوقتي دلوقت ده دي دا دول مش ايه كده كدا بتاع بتاعه بتاعت اوي خالص ليه فين امتي عشان علشان اديني اديلي اعمللي اعملهولي هات هاتلي برضه برضو شويه لسه ازيك بص حاجه حاجات اشرحلي قولي قوللي مفيش مافيش فهمني مفهمتش مافهمتش ايوه طب بقي كمان ازاي".split(" "));
  const GUW = new Set("وش ايش شلون ابغي ابغا ابي ودي زين كذا وايد حيل يبغي هذي الحين دحين اللحين ترا عطني عطيني لاهنت يعطيك شنو ليش وين هاذا هاذي ياخي سوي سويلي خلني مو مب ماني تكفي ابيك يمديك يمدي".split(" "));   // «طيب» مشتركة بين كل اللهجات فمش علامة خليجي
  const MSW = new Set("ماذا لماذا هل اريد الذي التي الذين هذا هذه ارجو سوف لن لم يرجي اود".split(" "));
  let DIA = localStorage.getItem("dialect") || "eg", AR = localStorage.getItem("dialectAr") || (DIA !== "en" ? DIA : "eg"), MIXED = false;
  function detect(q) {
    const letters = (q.match(/[A-Za-z؀-ۿ]/g) || []).length; if (!letters) return null;
    const lat = (q.match(/[A-Za-z]/g) || []).length / letters;
    if (lat > 0.6) return { d: "en", mixed: /[؀-ۿ]/.test(q) };
    const ws = nq(q).split(" "); let e = 0, g = 0, m = 0;
    ws.forEach(w => { if (EGW.has(w)) e++; if (GUW.has(w)) g++; if (MSW.has(w)) m++; });
    const mixed = (q.match(/[A-Za-z]{2,}/g) || []).length >= 1;
    if (!e && !g && !m) return { d: DIA === "en" ? AR : null, mixed };
    if (e > g && e >= m) return { d: "eg", mixed };
    if (g > e && g >= m) return { d: "gulf", mixed };
    if (m > e && m > g) return { d: "msa", mixed };
    return { d: DIA === "gulf" || DIA === "eg" ? DIA : "eg", mixed };
  }
  // طلب صريح بلغة الرد («in English» / «رجعها بالعربي») بيغلب على لغة الرسالة نفسها
  const TO_EN = /(in english|english please|بالانجليزي|بالانجليزيه|بالانجلش|بالانجلزي|بالانقليزي|بالانكليزي|بالانكلش)/, TO_AR = /(بالعربي|بالعربيه|in arabic|arabic please|عربي بقي|عربي لو سمحت)/;
  const wantLang = n => TO_EN.test(n) ? "en" : TO_AR.test(n) ? "ar" : "";
  T.observe = q => {
    const w = wantLang(nq(q));
    if (w) { const d = w === "en" ? "en" : AR; MIXED = false; if (d !== DIA) { DIA = d; localStorage.setItem("dialect", DIA); } return; }
    const r = detect(q); if (!r) return; MIXED = r.mixed;
    if (r.d && r.d !== DIA) { DIA = r.d; localStorage.setItem("dialect", DIA); }
    if (r.d && r.d !== "en" && r.d !== AR) { AR = r.d; localStorage.setItem("dialectAr", AR); }
    if (!localStorage.getItem("miclang") && typeof setMicLang === "function") setMicLang(DIA === "gulf" ? "ar-SA" : DIA === "en" ? "en-US" : "ar-EG");
  };
  T.dialect = () => DIA;
  const STYLE = {
    eg: "\n\nاللغة: رد بالمصري الطبيعي الودود زي مدرس مصري بيكلم طالبه (زي: «بص»، «يعني»، «كده»)، واكتب المصطلحات العلمية بالإنجليزي جنب العربي أول مرة تيجي (زي: «الخلية (cell)»، «البناء الضوئي (photosynthesis)»)، والجمل الإنجليزي اللي في الكتاب سيبها إنجليزي واشرحها بالمصري. مصري + English بشكل طبيعي، مش ترجمة حرفية.",
    gulf: "\n\nاللغة: الطالب يكتب باللهجة السعودية/الخليجية، فرد باللهجة السعودية البيضاء الطبيعية (مثل: «وش»، «زين»، «الحين»، «يعني»، «كذا»)، بدون مبالغة، مع الحفاظ على دقة المصطلحات العلمية.",
    msa: "\n\nاللغة: الطالب يكتب بالفصحى، فردّ بعربية فصحى بسيطة وواضحة وودودة.",
    en: "\n\nLanguage: the student writes in English — reply in clear, friendly, natural English."
  };
  T.styleNote = () => STYLE[DIA] + (MIXED ? (DIA === "en" ? " The student mixes Arabic and English; that's fine — you may keep Arabic terms they used." : " الطالب بيخلط عربي وإنجليزي: عادي تسيب المصطلحات الإنجليزي زي ما هي وتشرحها.") : "");

  // ================= ٢) فهم الطلب =================
  const ORDW = { اول: 1, الاول: 1, الاولي: 1, اولي: 1, تاني: 2, ثاني: 2, التاني: 2, الثاني: 2, التانيه: 2, الثانيه: 2, تالت: 3, ثالث: 3, التالت: 3, الثالث: 3, التالته: 3, الثالثه: 3, رابع: 4, الرابع: 4, الرابعه: 4, خامس: 5, الخامس: 5, الخامسه: 5, سادس: 6, السادس: 6, السادسه: 6, سابع: 7, السابع: 7, السابعه: 7, تامن: 8, ثامن: 8, التامن: 8, الثامن: 8, الثامنه: 8, تاسع: 9, التاسع: 9, عاشر: 10, العاشر: 10, first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10 };
  const LASTW = /^(اخر|الاخير|الاخيره|last|final)$/;
  const THISW = /^(ده|دي|دا|دول|هذا|هذه|هذي|ذا|ذي|الحالي|الحاليه|this|current)$/;
  const KINDW = w => /^(ال)?(وحده|باب)$|^units?$|^parts?$|^modules?$/.test(w) ? "unit" : /^(ال)?فصل$|^chapters?$/.test(w) ? "chapter" : /^(ال)?درس$|^lessons?$/.test(w) ? "lesson" : "";
  const numW = w => { w = (w || "").replace(/[^\wء-ي]/g, ""); return /^\d{1,3}$/.test(w) ? +w : ORDW[w] || UNUM[w] || 0; };
  function structRefs(n) {
    const ws = n.split(" "), refs = [];
    for (let i = 0; i < ws.length; i++) {
      const k = KINDW(ws[i]); if (!k) continue;
      const prev = ws[i - 1] || "", nx = ws[i + 1] || "", nx2 = ws[i + 2] || "";
      let r = { k, num: 0, ord: "" };
      if (/^(رقم|no|number)$/.test(nx) && numW(nx2)) r.num = numW(nx2);
      else if (numW(nx)) r.num = numW(nx);
      else if (LASTW.test(nx)) r.ord = "last";
      else if (THISW.test(nx) || /^(اللي انا فيه|اللي قدامي)/.test(ws.slice(i + 1, i + 4).join(" "))) r.ord = "this";
      else if (numW(prev) && ORDW[prev]) { r.num = numW(prev); r.pos = true; }   // «أول درس / تاني درس» = بالترتيب في الكتاب
      else if (LASTW.test(prev)) r.ord = "last";
      else if (/^(ال)?(اللي بعده|التالي)$/.test(nx) || (nx === "اللي" && /^بعد/.test(nx2)) || nx === "next" || prev === "next") r.ord = "next";
      else if (THISW.test(prev) || prev === "this") r.ord = "this";
      else r.ord = "bare";
      refs.push(r);
    }
    return refs;
  }
  const RX = {
    outline: /(فهرس|المحتويات|كام درس|كام فصل|كم درس|كم فصل|كام وحده|ايه الدروس|وش الدروس|ايش الدروس|الدروس اللي في|الفصول اللي|table of contents|what (?:chapters|lessons)|list (?:the )?(?:chapters|lessons|units)|how many (?:chapters|lessons))/,
    grade: /(صحح|صححلي|صححيلي|قيم اجابتي|قيملي|شوف اجابتي|اجابتي صح|هل اجابتي|اجابتي كده|(الاجابه|الحل|اجابتي|حلي) (دي|ده|دا|كده|كدا|هذي|هذه)? ?(صح|صحيح|صحيحه)|صح كده|صح كدا|check my answer|correct my (?:answer|solution)|grade my|is my answer|is (?:this|that) (?:answer )?(?:right|correct))/,
    solve: /(^|\s)(حل|حلي|حلها|حله|حللي|حلهالي|حلهولي|جاوب|جاوبلي|اجب|solve|answer)(\s|$)/,
    cards: /(فلاش|flash ?cards?|بطاقات|كروت|كارت|بطاقه)/,
    quizI: /(اختبرني|امتحني|اسالني|سالني|سؤال سؤال|سوال سوال|سؤال ورا سؤال|واحد واحد|واحده واحده|سمعلي|quiz me|test me|ask me|one by one|one at a time)/,
    quiz: /(امتحان|اختبار|كويز|quiz|test|mcq|اختيار من متعدد|اختيارات|صح وغلط|صح و غلط|صح او خطا|صح او غلط|true.?(?:or.?)?false|exam)/,
    qnoun: /(اسئله|سؤال|سوال|سوالات|questions?)/,
    gen: /(اعمل|اعمللي|اعملي|اعملها|سوي|سويلي|حط|حطلي|اكتب|اكتبلي|هات|هاتلي|اديني|اديلي|عطني|عطيني|ابغي|ابي|عايز|عاوز|محتاج|generate|make|create|give|write|prepare|جهز|جهزلي|اراجع|مراجعه|review|practice)/,
    notes: /(ملخص للمذاكره|ملخص مذاكره|ملخص اذاكر|مذكره|study notes|study guide|notes|ورقه مراجعه|شيت مراجعه|cheat ?sheet|revision sheet|نوت)/,
    sum: /(لخص|لخصلي|لخصها|لخصه|لخصهولي|تلخيص|ملخص|اختصر|اختصرلي|summar|tl;?dr|in short)/,
    key: /((اهم|اكتر) (الحاجات|حاجات|النقط|نقط|النقاط|نقاط|المعلومات|الافكار|الاشياء|الاشيا|الحاجه|حاجه|شي|الاشي)|لازم احفظ|احفظ ايه|ايش احفظ|وش احفظ|المهم|key points|important points|main points|what should i (?:memori[sz]e|know)|highlights)/,
    cmp: /(قارن|قارنلي|مقارنه|الفرق بين|ايه الفرق|وش الفرق|ايش الفرق|فرق بين|compare|comparison|difference between|differ)/,
    find: /((^|\s)(فين|وين)(\s|$)|في انهي صفحه|في اي صفحه|انهي صفحه|اي صفحه|ابحث|دور علي|دورلي|دور لي|find|where (?:is|are|does|can)|search|locate|موجود فين|مكتوب فين)/,
    nu: /(مش فاهم|مش فاهمه|مافهمت|ما فهمت|مو فاهم|مب فاهم|ماني فاهم|لم افهم|مفهمتش|مافهمتش|مش واضح|مو واضح|don'?t understand|didn'?t (?:understand|get)|not clear|i'?m (?:still )?confused|confusing)/,
    simple: /(ببساطه|بطريقه بسيطه|بطريقه ابسط|بسطها|بسطهالي|بسطلي|بسط|بشكل ابسط|ابسط|سهلها|بالبلدي|simple|simpler|simplify|eli5|like i'?m (?:5|five))/,
    ex: /(مثال|امثله|example|examples|for instance)/,
    again: /((^|\s)(تاني|ثاني|مره تانيه|مره ثانيه|again|repeat|عيد|اعيد)(\s|$))/,
    next: /^(طب |طيب |و |ok |okay )?(اللي بعدها|اللي بعده|الي بعدها|الي بعده|اللي بعد كده|بعدها|بعده ايه|بعدها ايه|وبعدين|التاليه|التالي|اللي عقبه|اللي عقبها|next|next one|what'?s next|and then)( ايه| وش| ايش)?$/,
    explain: /(اشرح|اشرحلي|اشرحيلي|اشرحها|اشرحه|اشرحهالي|اشرحهولي|شرح|فهمني|فهمنى|فهميني|وضح|وضحلي|فسر|فسرلي|explain|teach|علمني|walk me through)/,
    pageHere: /(الصفحه دي|الصفحه ده|الصفحه الحاليه|الصفحه اللي قدامي|الصفحه اللي انا فيها|هذه الصفحه|هالصفحه|الصفحه هذي|this page|current page|on this page|هنا|قدامي)/,
    whole: /(الكتاب كله|الملف كله|الكتاب بالكامل|الملف بالكامل|كل الكتاب|كل الملف|whole (?:book|file|document|pdf)|entire (?:book|file|document))/,
    deictic: /(^|\s)(ده|دي|دا|دول|هذا|هذه|هذي|ذا|ذي|it|this|that|these|those|فيها|عليها|عليه|فيه|منها|منه|عنها|عنه|اشرحها|اشرحه|وضحها|وضحه|فسرها|فسره|بسطها|بسطه|حلها|حله|فهمها|فهمه|رجعها|رجعه|قولها|قوله|اكتبها|اكتبه|ترجمها|ترجمه|عيدها|عيده)(\s|$)/,   // ضماير صريحة بس (مش أي كلمة آخرها «ه»)
    outside: /(بره الكتاب|برا الكتاب|بره المنهج|برا المنهج|خارج الكتاب|خارج المنهج|معلومات اضافيه|معلومه اضافيه|من معلوماتك|من معلوماتك العامه|outside (?:the |my )?(?:book|textbook|curriculum)|general knowledge|beyond the (?:book|textbook)|extra info)/,
    revise: /(مراجعه|راجع معايا|راجعلي|راجع لي|نراجع|تراجع معايا|قبل الامتحان|ليله الامتحان|revision|revise|review with me|before (?:the |my )?exam)/,
    why: /(^|\s)(ليه|ليش|لماذا|لمذا|why)(\s|$)/,
    // سؤال متابعة على نفس الموضوع: «طب لو الكتلة زادت؟» / «ولو القوة اتضاعفت؟» / «what if…»
    cond: /^(طب|طيب|وطب|وطيب|و|ok|okay|so|and|but)?\s*(لو|ولو|what if|what about|and if|how about)\s(?!سمحت|سمحتي|تسمح|سمحتوا)/,
    toLang: /(in english|english please|in arabic|arabic please|بالانجليزي|بالانجليزيه|بالانجلش|بالانجلزي|بالانقليزي|بالانكليزي|بالانكلش|بالعربي|بالعربيه|عربي بقي)/,
    direct: /(الاجابه فقط|الناتج فقط|النتيجه فقط|الاجابه النهائيه فقط|الاجابه بس|الاجابه النهائيه بس|الناتج بس|النتيجه بس|من غير شرح|بدون شرح|مش عايز شرح|just the answer|final answer only|answer only|no explanation)/,
    hard: /(صعب|صعبه|تقيله|تقيل|متقدمه|عالي|hard|difficult|challenging|advanced|tricky)/,
    easy: /(سهل|سهله|بسيطه|للمبتدئين|easy|basic|simple questions)/,
    beginner: /(كاني|كانني|زي ما اكون|كاني اول مره|اول مره (ادرس|اسمع|اشوف|اعرف)|من الصفر|من الاول خالص|from scratch|beginner|never studied|first time)/,
    part: /((الجزء|الجزئيه|الحته|الكلام|الفقره|السطر|الصفحه) (ده|دي|دا|هذا|هذه|هذي)|this part|this paragraph|this section)/,
    stopQuiz: /^(كفايه|خلاص|وقف|بطل|انهي|نهي الامتحان|وقف الامتحان|stop|end|quit|enough)( الامتحان| الاختبار| كده)?$/,
    skip: /^(مش عارف|معرفش|ما اعرف|مدري|ماادري|لا اعرف|skip|pass|i don'?t know|idk|التالي|الجاي|اللي بعده|next)$/
  };
  function parse(q) {
    const n = nq(q), I = { q, n, kind: "general", mods: [] };
    let m = n.match(/(?:صفحه|صفحات|الصفحه|ص|page|pages|pg|p)\s*(?:رقم\s*|no\s*)?(\d{1,4})(?:\s*(?:ل|لـ|الي|لحد|الى|to|-|–|و)\s*(?:صفحه\s*)?(\d{1,4}))?/);
    if (m) { I.page = +m[1]; if (m[2] && +m[2] > I.page) I.pageTo = +m[2]; }
    m = n.match(/(?:سؤال|السؤال|سوال|السوال|تمرين|التمرين|question|exercise|q)\s*(?:رقم\s*|no\s*|number\s*)?(\d{1,3}|[ء-ي]+)/);
    if (m && numW(m[1])) I.qnum = numW(m[1]);
    I.refs = structRefs(n);
    I.whole = has(n, RX.whole);
    I.here = has(n, RX.pageHere);
    const cnt = n.match(/(\d{1,2})\s*(?:سؤال|سوال|اسئله|mcq|questions?|فلاش|بطاق|كروت|كارت|cards?|نقط|نقاط|points?)/) || n.match(/(?:اعمل|اعمللي|هات|اديني|عطني|سوي|سويلي|make|give|generate)\s*(\d{1,2})/);
    if (cnt) I.count = Math.min(20, Math.max(1, +cnt[1]));
    else { const w = n.match(/(خمس|عشر|تلات|ثلاث|سبع|ست)\s*(اسئله|سؤال|بطاقات|كروت)/); if (w) I.count = { خمس: 5, عشر: 10, تلات: 3, ثلاث: 3, سبع: 7, ست: 6 }[w[1]]; }
    if (has(n, RX.nu)) I.mods.push("nu");
    if (has(n, RX.simple)) I.mods.push("simple");
    if (has(n, RX.ex) && !has(n, RX.qnoun)) I.mods.push("ex");
    if (has(n, RX.again)) I.mods.push("again");
    if (has(n, RX.beginner)) I.mods.push("simple", "begin");
    if (has(n, RX.direct)) I.mods.push("direct");
    if (has(n, RX.why) && !has(n, RX.cmp)) I.mods.push("why");
    I.diff = has(n, RX.hard) ? "hard" : has(n, RX.easy) && !has(n, RX.beginner) ? "easy" : "";
    I.part = has(n, RX.part);
    I.lang = wantLang(n);
    I.outside = has(n, RX.outside);
    // «الدرس اللي بعد الوحدة التانية» / «الفصل اللي قبل الدرس التالت»
    const rel = n.match(/(الدرس|درس|الفصل|فصل|الوحده|وحده|الباب|lesson|chapter|unit)\s+(?:(?:اللي|الي|the)\s+)?(?:(?:يجي|جاي|جه|comes?)\s+)?(بعد|قبل|after|before)\s+(.+)$/);
    if (rel) { const anchor = structRefs(rel[3])[0]; if (anchor && anchor.ord !== "bare" || anchor?.num) { I.rel = { k: KINDW(rel[1]), dir: /^(قبل|before)$/.test(rel[2]) ? -1 : 1, anchor }; I.refs = []; } }
    const quizish = has(n, RX.quizI) || has(n, RX.quiz) || (has(n, RX.qnoun) && has(n, RX.gen));
    if (has(n, RX.outline)) I.kind = "outline";
    else if (has(n, RX.grade)) I.kind = "grade";
    else if (has(n, RX.cards)) I.kind = "cards";
    else if (has(n, RX.solve) && !has(n, RX.gen)) I.kind = "solve";
    else if (quizish) { I.kind = "quiz"; I.interactive = has(n, RX.quizI); I.qtype = /(صح وغلط|صح و غلط|صح او|true.?(?:or.?)?false)/.test(n) ? "tf" : /(مقالي|مقاليه|اسئله قصيره|short answer|essay|اراجع|مراجعه|review)/.test(n) && !/(mcq|اختيار|اختيارات)/.test(n) ? "short" : /(mcq|اختيار|اختيارات)/.test(n) ? "mcq" : "mix"; }
    else if (has(n, RX.revise)) I.kind = "revise";
    else if (has(n, RX.notes)) I.kind = "notes";
    else if (has(n, RX.sum)) I.kind = "sum";
    else if (has(n, RX.key)) I.kind = "key";
    else if (has(n, RX.cmp)) I.kind = "cmp";
    else if (has(n, RX.find)) I.kind = "find";
    else if (has(n, RX.next) || (I.refs.some(r => r.ord === "next") && n.split(" ").length <= 5)) I.kind = "next";
    else if (has(n, RX.explain) || I.mods.some(m => m !== "direct")) I.kind = "explain";
    I.topic = RAG.contentWords(q).filter(w => !numW(w) && !numW("ال" + w) && !/^(احفظ|اذاكر|ذاكر|افهم|اراجع|اديني|اديلي|هاتلي|حطلي|اكتبلي|جهزلي|عطيني|سويلي|اعملها|لخصها|اشرحها|صعب|سهل|كاني|كانني|مره|ادرس|اسمع|الاجابه|اجابه|صح|غلط|راجع|معايا|قبل|امتحان|الامتحان|جزء|جزئيه|كلام|حته|نقطه)/.test(w)).join(" ");
    if (I.kind === "general" && I.refs.length && !I.topic && !I.page) I.kind = "explain";   // «Lesson 3» لوحدها = اشرح الدرس ده
    if (I.mods.includes("direct") && ["general", "explain"].includes(I.kind) && (I.qnum || /(السؤال|السوال|التمرين|سؤال|question)/.test(n))) I.kind = "solve";   // «الإجابة بس في السؤال التاني»
    const nw = n.split(" ").length;
    if (I.lang && I.kind === "general" && nw <= 7) I.kind = "explain";   // «رجعها بالعربي» = نفس الشرح بلغة تانية
    I.follow = !!history.length && (["nu", "simple", "ex", "again", "why", "direct"].some(x => I.mods.includes(x) && !(x === "simple" && I.mods.includes("begin") && I.topic)) || I.kind === "next" || (has(n, RX.deictic) && !I.page && !I.refs.length) || (nw <= 3 && !I.topic)
      || (I.lang && nw <= 7) || (has(n, RX.cond) && nw <= 10 && !I.page && !I.refs.length));
    // آخر رد كان فيه سؤال للطالب، والرسالة دي قصيرة ومش طلب جديد = غالبًا إجابته عليه
    if (history.length && !I.follow && I.kind === "general" && nw <= 8 && !I.page && !I.refs.length && pendingQ()) { I.follow = true; I.answering = true; }
    if (I.lang && I.follow) I.langOnly = true;
    return I;
  }
  T.parse = parse;

  // ================= ٣) الذاكرة (من غير ما نبعت المحادثة كلها) =================
  let F = null;   // آخر حاجة كنا بنتكلم فيها: { id, from, to, label, h, topic, blocks }
  const QZ = { on: false };
  const cut = (s, n) => { s = String(s || ""); return s.length <= n ? s : s.slice(0, Math.round(n * 0.7)) + " … " + s.slice(-Math.round(n * 0.3)); };
  function compactHistory(turns = 3) {
    const h = history.slice(-turns * 2); while (h.length && h[0].role !== "user") h.shift();
    const msgs = h.map(m => ({ role: m.role, content: cut(m.content, m.role === "user" ? 500 : 1100) }));
    const older = history.slice(0, -turns * 2).filter(m => m.role === "user").slice(-8).map(m => "- " + cut(m.content, 90));
    return { msgs, older };
  }
  // سؤال المدرّس المفتوح في آخر رده (لو فيه): عشان «هتقل للنص» تتفهم إنها إجابة عليه
  function pendingQ() {
    const a = history.at(-1); if (a?.role !== "assistant") return "";
    const t = String(a.content).replace(/\s+/g, " ").trim().slice(-260), m = t.match(/([^.!؟?\n]{6,200}[؟?])\s*$/);
    return m ? m[1].trim() : "";
  }
  // حالة المحادثة في كام سطر بدل ما نبعت المحادثة كلها: الموضوع، آخر سؤال، المكان في الكتاب، سؤال مستني إجابة، ومستوى الفهم
  function memoryNote(I) {
    const { older } = compactHistory(); let s = "";
    if (older.length) s += "مواضيع سألها الطالب قبل كده في نفس الجلسة:\n" + older.join("\n") + "\n\n";
    if (!I?.follow) return s + (F?.label ? `آخر حاجة كنا بنذاكرها: ${F.label}\n\n` : "");
    const st = [], lastU = [...history].reverse().find(m => m.role === "user"), pq = pendingQ();
    if (F?.q0 || F?.topic) st.push("الموضوع الحالي: " + cut(F.q0 || F.topic, 140));
    if (lastU && lastU.content !== F?.q0) st.push("آخر سؤال للطالب: " + cut(lastU.content, 140));
    if (F?.label) st.push("المكان في الكتاب: " + F.label);
    if (pq) st.push(`آخر رد ليك انتهى بسؤال للطالب: «${cut(pq, 160)}»`);
    if (LVL > 0) st.push(`الطالب لقى الموضوع ده صعب (قال «مش فاهم» ${LVL} مرة) — خلّي الشرح بسيط.`);
    return s + (st.length ? "حالة المحادثة:\n- " + st.join("\n- ") + "\n\n" : "");
  }

  // ================= ٤) تحديد الكتاب والمكان المقصود =================
  // الكتاب المحدد = اللي مختار في القايمة تحت (وبيتظبط أوتوماتيك على الكتاب المفتوح). مفيش تنقّل صامت لكتاب تاني:
  // كتاب تاني بيتستخدم بس لو الطالب ذكر اسمه صراحة.
  const selectedBook = () => $("book").value || (doc && cur.id) || (LIB.length === 1 ? LIB[0].id : "");
  const namedBook = I => { const qt = tok(I.q); return LIB.find(e => tok(e.name).filter(w => w.length >= 3 && !/^(كتاب|book|pdf|ملف)$/.test(w)).some(w => qt.includes(w)))?.id || ""; };
  const bookFor = I => namedBook(I) || selectedBook();
  const scopeFor = I => { const id = bookFor(I); return id ? [id] : null; };
  async function ensureIndex(id) {
    if (BK[id]?.n && BK[id].q) return BK[id];
    const d = await loadDoc(id); if (!d) return BK[id] || null;
    const b = await bkLoadFor(id, d); if (!b.q) { b.q = 1; setTyping("📖 بقرا الملف لأول مرة..."); await bkQuick(id, d, b); } return b;
  }
  function mapPage(id, N) {   // «صفحة 27»: رقم الصفحة المطبوع في الكتاب ولا رقمها في الملف؟
    const n = BK[id]?.n || 0, pp = RAG.toPdf(id, N);
    if (pp == null || pp === N) return N >= 1 && N <= n ? { p: N } : null;
    if (doc && cur.id === id && cur.page === N) return { p: N };
    return { p: pp, printed: N };
  }
  const KLV = { unit: 1, chapter: 2, lesson: 3 }, KNAME = { unit: "الوحدة", chapter: "الفصل", lesson: "الدرس" };
  function resolve(I, id) {
    const b = BK[id]; if (!b?.n) return null;
    if (I.rel) {
      const a = I.rel.anchor, ah = a.ord === "this" ? RAG.sectionAt(id, doc && cur.id === id ? cur.page : F?.from || 1, KLV[a.k]) : RAG.find(id, { k: a.k, num: a.num, ord: a.ord === "last" ? "last" : "" });
      const aname = `${KNAME[a.k]}${a.num ? " " + a.num : ""}`;
      if (!ah) return { miss: `مالقيتش «${aname}» في فهرس «${NAMES[id] || "الملف"}» عشان أعرف اللي ${I.rel.dir > 0 ? "بعدها" : "قبلها"}. افتح الصفحة المطلوبة وقولي «اشرحلي الدرس ده».` };
      const list = RAG.outline(id).filter(o => o.k === I.rel.k);
      const h = I.rel.dir > 0 ? list.find(o => a.k === I.rel.k ? o.page > ah.page : o.page > ah.to) || null : [...list].reverse().find(o => o.page < ah.page) || null;
      if (!h) return { miss: `مفيش ${KNAME[I.rel.k]} ${I.rel.dir > 0 ? "بعد" : "قبل"} «${ah.line}» في فهرس «${NAMES[id] || "الملف"}».` };
      return { id, from: h.page, to: Math.min(h.to, h.page + 40), kind: "section", h, label: `${NAMES[id] || ""} — ${h.line} (${RAG.pg(id, h.page)}${h.to > h.page ? "–" + RAG.pgNum(id, h.to) : ""})` };
    }
    if (I.page) {
      const a = mapPage(id, I.page); if (!a) return { miss: `صفحة ${I.page} مش موجودة (الملف فيه ${b.n} صفحة)` };
      let to = a.p; if (I.pageTo) { const z = mapPage(id, I.pageTo); to = z ? z.p : Math.min(b.n, a.p + (I.pageTo - I.page)); }
      return { id, from: a.p, to: Math.min(to, a.p + 40), kind: "page", label: `${NAMES[id] || ""} — ${a.printed ? `صفحة ${I.page} في الكتاب (${a.p} في الملف)` : `صفحة ${a.p}`}${to > a.p ? " لـ " + RAG.pgNum(id, to) : ""}` };
    }
    if (I.refs.length) {
      const refs = [...I.refs].sort((x, y) => KLV[x.k] - KLV[y.k]); let within = null, h = null;
      for (const r of refs) {
        if (r.ord === "this" || (r.ord === "bare" && refs.length === 1)) {
          const base = doc && cur.id === id ? cur.page : F?.id === id ? F.from : 0;
          h = base ? RAG.sectionAt(id, base, KLV[r.k]) : null; if (h && h.k !== r.k && r.ord === "bare" && !(doc && cur.id === id)) h = null;
        } else if (r.ord === "next") {   // «الدرس اللي بعده»: بعد الدرس اللي بنشرحه دلوقتي (أو المفتوح)
          const ol = RAG.outline(id).filter(o => o.k === r.k), ls = lessonState?.id === id && lessonState.h?.k === r.k ? lessonState.h : null;
          const ref = ls || (F?.id === id && F?.h && F.h.k === r.k ? F.h : RAG.sectionAt(id, doc && cur.id === id ? cur.page : F?.from || 1, KLV[r.k]));
          h = ref ? ol.find(o => o.page > ref.page || (o.page === ref.page && ol.indexOf(o) > ol.indexOf(ref))) || null : ol[0] || null;
          if (!h) return { miss: `«${ref?.line || KNAME[r.k]}» هو آخر ${KNAME[r.k].replace(/^ال/, "")} في الكتاب المحدد «${NAMES[id] || ""}».` };
        } else {
          const hs = RAG.findExact(id, { k: r.k, num: r.num, ord: r.ord === "last" ? "last" : "", within, pos: r.pos });
          if (hs.length > 1) return { ask: hs, id, k: r.k, num: r.num };
          h = hs[0] || null;
        }
        if (!h) {
          if (r.ord === "this" || r.ord === "bare") { if (doc && cur.id === id) return { id, from: cur.page, to: Math.min(b.n, cur.page + 2), kind: "pages", label: `${NAMES[id] || ""} — من ${RAG.pg(id, cur.page)}`, guess: true }; continue; }
          const kinds = RAG.kinds(id);
          if (!kinds[r.k] && r.num) {   // الكتاب مفيهوش عناوين من النوع ده في الفهرس: كاشف العناوين القديم (بيدوّر على العنوان نفسه مش على الرقم)
            const u = unitRange(id, r.num); if (u) return { id, from: u.from, to: u.to, kind: "section", label: `${NAMES[id] || ""} — ${KNAME[r.k]} ${r.num} (${RAG.pg(id, u.from)}–${RAG.pgNum(id, u.to)})` };
          }
          if (!strict() && !kinds[r.k] && r.k === "lesson") {   // الكتاب مفيهوش «دروس»: فصول/وحدات، أو أول صفحة فيها محتوى
            const alt = RAG.findExact(id, { k: kinds.chapter ? "chapter" : "unit", num: r.num || 1, ord: r.ord === "last" ? "last" : "", pos: r.pos })[0];
            if (alt) return { id, from: alt.page, to: Math.min(alt.to, alt.page + 40), kind: "section", h: alt, label: `${NAMES[id] || ""} — ${alt.line} (${RAG.pg(id, alt.page)}${alt.to > alt.page ? "–" + RAG.pgNum(id, alt.to) : ""})` };
            if ((r.num || 1) === 1) { let p = (b.toc || 0) + 1; while (p < b.n && !okText(b.t[p - 1] || "")) p++; return { id, from: p, to: Math.min(b.n, p + 3), kind: "pages", guess: true, label: `${NAMES[id] || ""} — من أول الكتاب (${RAG.pg(id, p)})` }; }
          }
          const want = `${KNAME[r.k]}${r.num ? " " + r.num : r.ord === "last" ? " الأخير" : ""}`, avail = RAG.outline(id).filter(o => o.lv <= 3).slice(0, 14).map(o => `- ${o.line} (${RAG.pg(id, o.page)})`).join("\n");
          return { miss: `مش لاقي «${want}» في الكتاب المحدد «${NAMES[id] || ""}».` + (avail ? `\n\nاللي موجود في فهرس الكتاب:\n${avail}` : "\n\nمقدرتش أطلّع فهرس دروس للكتاب ده من العناوين. افتح أول صفحة في الدرس وقولي «اشرحلي الدرس ده».") };
        }
        within = h;
      }
      if (h) return { id, from: h.page, to: Math.min(h.to, h.page + 40), kind: "section", h, label: `${NAMES[id] || ""} — ${h.line} (${RAG.pg(id, h.page)}${h.to > h.page ? "–" + RAG.pgNum(id, h.to) : ""})` };
    }
    if (I.whole) return { id, from: 1, to: b.n, kind: "whole", label: `${NAMES[id] || ""} (الملف كله)` };
    if (I.here && doc && cur.id === id) return { id, from: cur.page, to: cur.page, kind: "page", label: `${NAMES[id] || ""} — ${RAG.pg(id, cur.page)}` };
    return null;
  }

  // الكلمات دي فعلًا موجودة في الكتاب؟ (عشان «لخصهالي» ميتحسبش موضوع)
  const topicIn = (ids, I) => I.topic && I.topic.split(" ").some(w => ids.some(id => RAG.chunks(id) && BK[id]?._cix?.df[w]));
  function defaultRange(id) {   // «لخص» / «أهم النقط» من غير ما يحدد: الدرس المفتوح ← آخر حاجة اتكلمنا فيها ← الكتاب كله لو صغير
    const b = BK[id]; if (!b?.n) return null;
    if (doc && cur.id === id) { const h = RAG.sectionAt(id, cur.page); return h ? { id, from: h.page, to: Math.min(h.to, h.page + 20), kind: "section", h, label: `${NAMES[id] || ""} — ${h.line} (${RAG.pg(id, h.page)}${h.to > h.page ? "–" + RAG.pgNum(id, Math.min(h.to, h.page + 20)) : ""})` } : { id, from: cur.page, to: Math.min(b.n, cur.page + 2), kind: "pages", guess: true, label: `${NAMES[id] || ""} — من ${RAG.pg(id, cur.page)}` }; }
    if (F?.id === id && F.from) return { id, from: F.from, to: Math.min(F.to || F.from, F.from + 20), kind: "pages", h: F.h, label: F.label };
    if (b.n <= 30) return { id, from: 1, to: b.n, kind: "whole", label: `${NAMES[id] || ""} (الملف كله)` };
    return null;
  }

  // ================= ٥) بناء السياق =================
  const BUDGET = () => ({ free: 6500, local: 2600, puter: 9000 }[provider()] || 15000);
  const MAXT = k => ({ quiz: 2600, cards: 2200, notes: 2400, revise: 2600, sum: 2000 }[k] || (provider() === "local" ? 900 : 1800));
  async function rangeBlocks(R, budget, q) {
    const out = [], b = BK[R.id]; let ocr = 0, missing = 0;
    for (let p = R.from; p <= R.to; p++) {
      let t = b.t[p - 1];
      if (!okText(t || "")) { if (ocr < 6) { setTyping(`📖 بقرا ${RAG.pg(R.id, p)}...`); t = await pageText(R.id, p); ocr++; } else missing++; }
      if (okText(t || "")) out.push({ page: p, text: t });
    }
    const comp = RAG.compress(out, budget, q);
    const blocks = comp.map(x => ({ id: R.id, page: x.page, sec: RAG.sectionAt(R.id, x.page)?.line || "", text: x.text }));
    blocks.partial = out.reduce((a, x) => a + x.text.length, 0) > budget; blocks.missing = missing; return blocks;
  }
  const fmt = blocks => blocks.map((b, i) => `[${i + 1}] ${NAMES[b.id] || ""} — ${RAG.pg(b.id, b.page)}${b.sec ? " — " + b.sec : ""}\n${b.text}`).join("\n\n");
  function uniqBlocks(arr, k) { const seen = new Set(), out = []; for (const b of arr) { const key = b.id + "|" + b.page + "|" + b.text.slice(0, 40); if (seen.has(key)) continue; seen.add(key); out.push(b); if (out.length >= k) break; } return out; }
  function nextBlocks() {   // «اللي بعدها»: المقاطع اللي بعد آخر مكان اتكلمنا فيه
    if (!F?.id || !BK[F.id]) return []; const last = Math.max(F.to || 0, ...(F.blocks || []).filter(b => b.id === F.id).map(b => b.page)); if (!last) return [];
    return RAG.chunks(F.id).filter(c => c.page >= last && c.page <= last + 1).slice(0, 4).map(c => ({ id: c.id, page: c.page, sec: c.sec, text: c.text }));
  }

  // ================= ٦) التعليمات =================
  const NOTFOUND = "مش لاقي المعلومة دي في الكتاب المحدد.";
  const OUTSIDE_HINT = "لو عايزني أشرحها من برّه الكتاب قولي: «اشرحها من بره الكتاب».";
  const SRC = {
    lock: `الكتاب المحدد هو المصدر الوحيد للمعلومات (قفل المصدر):
- مقاطع الكتاب متعلّمة بأرقام زي [1] و[2]. أي معلومة تقولها من الكتاب حط رقم مقطعها بعد الجملة مباشرة، زي: «الخلية هي وحدة بناء الكائن الحي [2]».
- أي معلومة علمية (تعريف، قاعدة، قانون، معادلة، تاريخ، اسم، رقم، سبب، نتيجة، إجابة سؤال) لازم تكون موجودة في المقاطع دي. ممنوع تجاوب من معلوماتك العامة.
- لو المطلوب مش موجود في المقاطع اكتب بالظبط: «${"مش لاقي المعلومة دي في الكتاب المحدد."}» وبعدها سطر: «${"لو عايزني أشرحها من برّه الكتاب قولي: «اشرحها من بره الكتاب»."}» ومتكمّلش إجابة من عندك.
- مسموح تشرح بأسلوبك: تبسيط، ترتيب خطوات، ربط أفكار الكتاب ببعض، وتشبيه من الحياة — بشرط متضيفش أي معلومة علمية جديدة. التشبيه اللي من عندك علّمه «💡 تشبيه للتوضيح:».
- حافظ على معنى الكتاب بالظبط. متألفش أبدًا أسماء دروس أو أرقام صفحات أو تعريفات أو قوانين أو تواريخ أو أمثلة أو اقتباسات على إنها من الكتاب.
- النص مستخرج آليًا (وأحيانًا OCR): لو جزء مش واضح أو ناقص قول كده بصراحة ومتكمّلوش من خيالك.`,
    outside: `الطالب طلب صراحة معلومات من برّه الكتاب:
- ابدأ باللي في الكتاب (لو موجود في المقاطع) بأرقام المقاطع [1]، وبعدين حط الإضافة من معلوماتك العامة تحت عنوان «### 🌐 من خارج الكتاب» وخليها دقيقة ومختصرة.
- متقولش أبدًا إن حاجة من برّه موجودة في الكتاب، ومتألفش أرقام صفحات.`,
    open: `الكتاب المحدد هو المرجع الأساسي، والشات مفتوح لأي سؤال:
- مقاطع الكتاب متعلّمة بأرقام زي [1] و[2]. لما تستخدم معلومة منها حط رقم المقطع بعد الجملة مباشرة، زي: «الخلية هي وحدة بناء الكائن الحي [2]».
- لو السؤال عن الكتاب/الدرس جاوب من المقاطع الأول وحافظ على معناها بالظبط.
- لو المطلوب مش موجود في المقاطع: قول في سطر واحد «ده مش في الكتاب المحدد، بس هشرحهولك:» وبعدين جاوب من معلوماتك العامة بدقة تحت «### 🌐 من خارج الكتاب». ولو السؤال عادي أو ملوش علاقة بالكتاب جاوب على طول زي أي مساعد ذكي.
- متقولش أبدًا إن معلومة من برّه موجودة في الكتاب، ومتألفش أسماء دروس أو أرقام صفحات أو اقتباسات من الكتاب.
- النص مستخرج آليًا (وأحيانًا OCR): لو جزء مش واضح قول كده ومتكمّلوش من خيالك.`,
    none: `الطالب مضافش أي كتاب لسه: جاوب من معلوماتك العامة بدقة، ولو السؤال عن منهجه قوله إنه لو ضاف كتابه (PDF) هشرحله منه وأقوله الصفحة.`
  };
  const strict = () => localStorage.getItem("srclock") === "1";   // 🔒 الكتاب بس (من الإعدادات) — الافتراضي: شات مفتوح
  const srcMode = I => !LIB.length ? "none" : I?.outside ? "outside" : strict() ? "lock" : "open";
  T.srcNote = () => "\n\n" + (!LIB.length ? SRC.none : strict() ? "قاعدة المصدر: المعلومات العلمية من الكتاب المحدد بس. لو مش فيه اكتب: «مش لاقي المعلومة دي في الكتاب المحدد.»" : "قاعدة المصدر: الكتاب المحدد هو المرجع الأساسي. لو المطلوب مش فيه قول كده في سطر وبعدين جاوب من معلوماتك وعلّمها «🌐 من خارج الكتاب».");
  let sysText; sysText = mode => `إنت مدرّس خصوصي محترف، ذاكرت كتاب الطالب كويس وفاهمه. هادي وواضح وودود وصبور، واثق من غير غرور، وبتشجّع من غير مبالغة. بتشتغل مع أي مادة وأي مرحلة وأي منهج وأي بلد.

${SRC[mode]}

` + SYS_TEACH;
  const SYS_TEACH = `أسلوبك: مدرّس شاطر وهادي وصبور وودود، بيكلّم الطالب كأنه قاعد قدامه — طبيعي، مش شات بوت رسمي ولا قالب جاهز.
- اشرح الفكرة بتشبيه من حياة الطالب لما يفيد، وبعدين اربطها بكلام الكتاب. المصطلحات العلمية بالإنجليزي جنب العربي.
- نبّه على الغلطات اللي الطلبة بتقع فيها واللي بيجي في الامتحان لما يكون ليه لازمة.

طول الرد على قد السؤال (أهم قاعدة):
- سؤال بسيط أو متابعة قصيرة («طب لو…؟»، «يعني إيه X؟») ← إجابة مباشرة في سطر لـ ٤ سطور، من غير عناوين.
- «اشرح» مفهوم ← الفكرة ببساطة، القاعدة/القانون، مثال واحد كويس، وخلاصة سطر. عناوين بس لو الشرح طويل فعلًا.
- درس كامل أو مراجعة ← عناوين ونقط منظمة.
- الطالب طلب الإجابة بس ← الإجابة بس.

متجنّبش:
- متبدأش بـ «بالتأكيد» أو «طبعًا» أو «بكل سرور» أو «سؤال ممتاز» أو تكرار سؤال الطالب، ومتكررش نفس الجمل من رد لرد. ادخل في المفيد من أول جملة.
- متقولش أبدًا «كنموذج ذكاء اصطناعي» أو «As an AI».
- متحطش إيموجي في الكلام العادي (العناوين بس لو استخدمتها).
- متقفلش كل رد بسؤال. اسأل سؤال تأكيد واحد بس لما يكون مفيد فعلًا (بعد شرح مفهوم جديد أو صعب)، مش في الإجابات القصيرة ولا المتابعات.

التدريس:
- افهم قصد الطالب (عامية مصرية أو خليجية أو فصحى أو إنجليزي أو مخلوط، وأخطاء إملائية أو كلام من الميكروفون). الرسالة القصيرة («مش فاهم»، «طب ليه؟»، «هات مثال»، «طب لو الكتلة زادت؟») تكملة لنفس الموضوع اللي في «حالة المحادثة» — متغيّرش الموضوع. متسألش «تقصد إيه؟» إلا لو الكلام فعلًا ملوش غير أكتر من معنى.
- العناوين المتاحة (بس لما تفيد): «### 💡 الفكرة ببساطة»، «### الشرح»، «### مثال»، «### 📌 افتكر»، «### ⚠️ أخطاء شائعة»، «### ✅ الخلاصة»، «### ❓ اختبر نفسك»، «### الإجابات».
- جمل قصيرة وفقرات صغيرة، و**عريض** للمصطلحات المهمة بس. الجداول | للمقارنات. المعادلات بين $...$.
- لو بتسأل الطالب أسئلة يختبر نفسه، متكتبش الإجابات جنبها: حطها كلها في الآخر تحت «### الإجابات».
- متتريقش على الطالب أبدًا.`;
  const INS = {
    general: "",
    explain: "اشرح المطلوب على قد السؤال: الفكرة ببساطة (بتشبيه من الحياة لو بيساعد)، بعدين القاعدة أو القانون زي ما في الكتاب، بعدين مثال واحد واضح، وسطر خلاصة. لو الموضوع كبير (درس كامل) قسّمه بعناوين، ولو صغير متعملش عناوين. سؤال تأكيد في الآخر اختياري — بس لو المفهوم جديد أو صعب.",
    nu1: "الطالب مش فاهم آخر شرح. لو حدد حتة معينة (مصطلح أو خطوة) ركّز عليها هي بس جوه نفس الموضوع. متكررش نفس الكلام ولا نفس الترتيب: اشرحها بزاوية تانية أبسط ومثال جديد من الحياة، وأقصر من الشرح اللي فات.",
    nu2: "الطالب لسه مش فاهم للمرة التانية. لو حدد حتة معينة (مصطلح أو خطوة) ركّز عليها هي بس جوه نفس الموضوع. بسّط أكتر بكتير: جمل قصيرة جدًا، فكرة واحدة بس، وتشبيه من الحياة اليومية (البيت، المدرسة، الموبايل، الكورة)، ومن غير مصطلحات إلا لو هتشرحها. وممكن في الآخر سؤال سهل جدًا يتأكد بيه.",
    nu3: "الطالب لسه متلخبط. لو حدد حتة معينة ركّز عليها هي بس. اشرحها خطوة بخطوة بالتدريج: كل خطوة سطر واحد مرقّم مبني على اللي قبله، ابدأ من أبسط حاجة يعرفها، ومثال واحد ماشي معاك في كل الخطوات. وفي الآخر اسأله: «فهمت لحد خطوة كام؟» عشان تكمّل من عندها.",
    simple: "اشرح بأبسط طريقة ممكنة كأنه أول مرة يدرس الموضوع: ابدأ من الصفر (إيه ده وليه مهم)، كلمات سهلة، جمل قصيرة، تشبيه من الحياة، وبعدين ابني الفكرة خطوة خطوة.",
    why: "الطالب بيسأل «ليه؟» عن إجابة أو معلومة من آخر كلام: وضّح السبب خطوة خطوة ومنين في الكتاب [رقم المقطع]، ولو كانت اختيارات وضّح ليه كل اختيار تاني غلط، وفي الآخر القاعدة اللي يفتكرها.",
    revise: "مراجعة للمذاكرة على الجزء المطلوب بالعناوين دي: ### ✅ الخلاصة (٣–٥ سطور) ### المفاهيم الأساسية ### التعريفات المهمة (بنص الكتاب) ### 📌 افتكر (القواعد/القوانين/التواريخ/الأسماء/الأرقام — لو موجودة بس) ### ⚠️ أخطاء شائعة ### ❓ اختبر نفسك (٤–٥ أسئلة متوقعة في الامتحان من غير إجابات جنبها) ### الإجابات (إجابات مختصرة). كل حاجة من الكتاب بأرقام المقاطع، ومتخترعش حاجة مش فيه.",
    ex: "ادّي مثال واحد أو اتنين واقعيين من الحياة اليومية على النقطة اللي كنا بنتكلم فيها (مش موضوع جديد)، ولو فيه أرقام احسبها خطوة خطوة. لو الكتاب فيه مثال اذكره كمان برقم المقطع. المثال من الحياة للتوضيح بس، ومتقولش إنه من الكتاب لو مش فيه.",
    again: "الطالب عايز الشرح تاني: اشرحه بأسلوب مختلف عن المرة اللي فاتت ومن زاوية جديدة.",
    sum: "لخّص المحتوى المطلوب في ملخص منظم: عنوان، النقط الرئيسية بالترتيب (نقطة لكل فكرة)، والمصطلحات المهمة بتعريف مختصر. حط أرقام المقاطع، ومتضيفش في الملخص معلومات مش في الملف.",
    notes: "اعمل مذكرة مذاكرة للمراجعة بالعناوين دي: ١) الأفكار الرئيسية ٢) التعريفات والمصطلحات ٣) القوانين/القواعد/التواريخ/الأرقام المهمة (لو فيه) ٤) أخطاء شائعة ونصايح للحفظ ٥) ٣ أسئلة مراجعة سريعة بإجاباتها. نقط قصيرة واضحة مع أرقام المقاطع.",
    key: "طلّع أهم النقط اللي لازم الطالب يحفظها ويفهمها (من ٥ لـ ١٠ نقط مرتبة حسب الأهمية)، كل نقطة في سطر مع رقم المقطع، ولو فيه تعريف أو قانون أو تاريخ لازم يتحفظ بالنص اكتبه زي ما هو. وفي الآخر نصيحة قصيرة إزاي يحفظهم.",
    cmp: "قارن بين الحاجتين اللي الطالب قصدهم في جدول ماركداون (أوجه المقارنة في الصفوف)، وبعده سطرين بأهم فرق وأهم تشابه. لو مش واضح بيقارن بين إيه خمّن من المحادثة، ولو مستحيل اسأله سؤال قصير.",
    find: "الطالب بيدوّر على معلومة في ملفه: قوله هي فين بالظبط (اسم الكتاب والصفحة من رأس المقطع) مع رقم المقطع، ولخّص المعلومة في سطرين. لو مش موجودة في المقاطع قول إنك مالقيتهاش في ملفه.",
    solve: "حل المسألة زي مدرّس شاطر، بالترتيب ده ومن غير خطوات ملهاش لازمة: **المطلوب:** (سطر) ← **المعطيات:** (بالوحدات) ← **القانون:** (من الدرس مع رقم المقطع لو موجود) ← **التعويض** ← **الحساب** ← «**الإجابة النهائية:** …» بالوحدة ← سطر واحد يوضح معنى النتيجة. لو الطالب حدد سؤال معين أو عدد نفّذ ده بالظبط، ولو مقالش حُلّ السؤال اللي قصده بس. لو السؤال مش ظاهر أو ناقص قول كده ومتخترعش.\n" + MCQ,
    direct: "الطالب طلب الإجابة بس: اكتب «**الإجابة:** …» (بالوحدة لو فيه) ومتكتبش شرح ولا خطوات — بالكتير نص سطر لو لازم جدًا. وقبل ما تكتب الإجابة النهائية راجع كل خطوة وكل رقم ووحدة في دماغك (عوّض بالإجابة في السؤال لو ينفع)، ولو لقيت غلط صلّحه قبل ما تكتب — ومتكتبش المراجعة دي نفسها.",
    grade: "الطالب كتب إجابته (أو حله) وعايز يعرف هي صح ولا لأ: قوله في أول سطر بوضوح «صح» أو «غلط» أو «ناقصة»، بعدين حدد بالظبط فين الغلط (الخطوة أو الرقم أو الكلمة) وليه، واكتب الصح باختصار، ونصيحة سطر عشان ميقعش فيه تاني. لو إجابته صح قوله كده ومتطوّلش. استند للملف لو فيه الإجابة.",
    outline: "جاوب عن محتويات الملف من «فهرس الملف» اللي معاك بس. متخترعش دروس أو فصول مش فيه، وقول إن الفهرس مستخرج آليًا من العناوين فممكن يكون ناقص.",
    lang: "الطالب عايز نفس آخر شرح بس باللغة اللي طلبها (مش موضوع جديد): اشرح نفس النقطة بنفس المستوى وبشكل طبيعي في اللغة دي، مش ترجمة حرفية، وأقصر شوية لو ينفع. المصطلحات العلمية تفضل زي ما هي.",
    answering: "آخر رد ليك كان فيه سؤال للطالب، والرسالة دي غالبًا إجابته عليه: قوله على طول لو صح أو غلط أو ناقصة، ووضّح الصح في جملة أو اتنين، وكمّل خطوة صغيرة في نفس الموضوع. ولو واضح إنها مش إجابة، جاوب على كلامه عادي.",
    next: "الطالب عايز النقطة/الجزء اللي بعد آخر حاجة اتشرحت في المحادثة. كمّل بالترتيب من المكان اللي وقفت عنده (من المقاطع لو موجودة) ومتعيدش اللي اتقال."
  };

  // ================= ٧) عرض الرد + المصادر =================
  const shortName = id => { const n = NAMES[id] || ""; return n.length > 18 ? n.slice(0, 16) + "…" : n; };
  function citeHTML(text, blocks) { return citeLinks(md(text.replace(/\[\[[\s\S]*?\]\]/g, "")), blocks); }
  const plainCites = (text, blocks) => text.replace(/\[\[[\s\S]*?\]\]/g, "").replace(/\[\?\d{1,2}\]/g, "").replace(/\[(\d{1,2}(?:\s*[،,]\s*\d{1,2})*)\]/g, (m, g) => { const ps = g.split(/[،,]/).map(x => blocks[+x.trim() - 1]).filter(Boolean).map(b => RAG.pg(b.id, b.page)); return ps.length ? "(" + [...new Set(ps)].join("، ") + ")" : ""; });
  const speechText = text => text.replace(/\[\[[\s\S]*?\]\]/g, "").replace(/\[\?\d{1,2}\]/g, "").replace(/\[(\d{1,2}(?:\s*[،,]\s*\d{1,2})*)\]/g, "");
  // ===== التحقق من المصادر: كل [n] لازم يكون مقطع حقيقي من كتاب موجود وصفحة موجودة، والجملة اللي قبله فعلًا من المقطع ده =====
  const stem = w => w.length > 4 ? w.slice(0, 4) : w;
  function citeOK(sentence, b) {
    if (!b || !LIB.some(e => e.id === b.id)) return false;
    const n = BK[b.id]?.n || docs[b.id]?.numPages || (cur.id === b.id ? doc?.numPages : 0) || 0; if (!(b.page >= 1) || (n && b.page > n)) return false;
    const src = new Set(tok(b.text + " " + (b.sec || "")).map(stem)), words = [...new Set(tok(sentence))].filter(w => w.length > 2 && !/^(الي|اللي|ده|دي|كده|يعني|بتاع|عشان|علشان|لما|كان|كانت|هو|هي|the|and|for|that|this|with|from)$/.test(w));
    const nums = (sentence.match(/\d+(?:\.\d+)?/g) || []).filter(x => b.text.includes(x)).length;
    if (!words.length) return nums > 0;
    const hit = words.filter(w => src.has(stem(w))).length;
    return hit + nums >= 2 || hit / words.length >= 0.3;
  }
  function verifyCites(text, blocks) {
    const ok = new Set(), bad = new Set(); let last = 0;
    const out = text.replace(/\[(\d{1,2}(?:\s*[،,]\s*\d{1,2})*)\]/g, (m, g, off) => {
      const before = text.slice(last, off), cut0 = Math.max(before.lastIndexOf("\n"), ...[".", "!", "؟", "?"].map(c => before.lastIndexOf(c, before.length - 2))), sentence = before.slice(cut0 + 1); last = off + m.length;
      const keep = [], drop = [];
      for (const x of g.split(/[،,]/).map(v => +v.trim())) { const b = blocks[x - 1]; if (!b) continue; (citeOK(sentence, b) ? keep : drop).push(x); }
      keep.forEach(x => ok.add(x)); drop.forEach(x => bad.add(x));
      return (keep.length ? `[${keep.join(",")}]` : "") + drop.map(x => `[?${x}]`).join("");
    });
    return { text: out, ok, bad };
  }
  T.verifyCites = verifyCites;
  // مصدر الإجابة: من الكتاب (بمصادر اتأكدنا منها) / من خارج المنهج / استنتاج عام — عمرنا ما بنقول إن حاجة من برّه من الكتاب
  function originTag(node, text, blocks, V) {
    if (!LIB.length) return; const d = document.createElement("div"); d.className = "origin";
    const outside = /من خارج الكتاب|مش في الكتاب|outside (?:the |your )?(?:book|curriculum)/i.test(text), nf = /مش لاقي المعلومة/.test(text);
    const tags = [];
    if (V.ok.size) tags.push(["book", `📖 من كتابك — ${V.ok.size} مصدر متأكد منه`]);
    if (V.bad.size) tags.push(["unv", `⚠︎ ${V.bad.size} مصدر ماتأكدناش منه`]);
    if (outside) tags.push(["out", "🌐 فيه جزء من خارج المنهج"]);
    if (!V.ok.size && !outside && !nf && text.length > 40) tags.push(["gen", blocks.length ? "💭 شرح عام (مش منقول من صفحة معيّنة)" : "💭 من معلومات المدرّس العامة (مش من كتابك)"]);
    if (!tags.length) return; d.innerHTML = tags.map(([k, t]) => `<span class="o-${k}">${esc(t)}</span>`).join(""); node.querySelector(":scope > .scope") ? node.querySelector(":scope > .scope").after(d) : node.prepend(d);
  }
  function sourcesRow(node, text, blocks, R) {
    const used = [...new Set([...text.matchAll(/\[(\d{1,2}(?:\s*[،,]\s*\d{1,2})*)\]/g)].flatMap(m => m[1].split(/[،,]/).map(x => +x.trim())))].filter(i => blocks[i - 1]);
    const box = document.createElement("div"); box.className = "src";
    const link = (label, id, p) => { const a = document.createElement("a"); a.href = "#"; a.dataset.id = id; a.dataset.p = p; a.textContent = label; box.append(a); };
    if (used.length) { const seen = new Set(); used.forEach(i => { const b = blocks[i - 1], k = b.id + "|" + b.page; if (seen.has(k)) return; seen.add(k); link(`📄 ${NAMES[b.id] || ""} — ${RAG.pg(b.id, b.page)}${b.sec ? " — " + cut(b.sec, 40) : ""}`, b.id, b.page); }); }
    else if (R) link(`📄 ${R.label}`, R.id, R.from);
    else if (blocks.length && !/(مش لاقي|مالقيت|ما لقيت|مش موجود|not (?:in|found)|couldn'?t find)/i.test(text)) { const lb = document.createElement("small"); lb.textContent = "🔎 دوّرت في: "; box.append(lb); blocks.slice(0, 3).forEach(b => link(`${NAMES[b.id] || ""} — ${RAG.pg(b.id, b.page)}`, b.id, b.page)); }
    if (box.childElementCount) node.append(box);
  }
  // شارة المصدر فوق الرد: 📖 الكتاب · 📚 الدرس · 📄 الصفحات
  function badge(node, R) {
    if (!node || !R?.id) return; node.querySelector(":scope > .scope")?.remove();
    const h = R.h || (R.kind !== "whole" ? RAG.sectionAt(R.id, R.from) : null), d = document.createElement("div"); d.className = "scope";
    const pages = R.from ? (R.to > R.from ? `${RAG.pg(R.id, R.from)}–${RAG.pgNum(R.id, R.to)}` : RAG.pg(R.id, R.from)) : "";
    d.innerHTML = `<a href="#" data-id="${esc(R.id)}" data-p="${R.from || 1}">📖 ${esc(NAMES[R.id] || "")}</a>` + (h ? `<span>📚 ${esc(h.line)}</span>` : "") + (pages ? `<a href="#" data-id="${esc(R.id)}" data-p="${R.from}">📄 ${esc(pages.replace(/^ص /, "ص "))}</a>` : "");
    node.prepend(d);
  }
  T.badge = badge;
  $("chat").addEventListener("click", e => {
    const a = e.target.closest("a.cite, .src a[data-id], .scope a[data-id]"); if (!a) return; e.preventDefault();
    const id = a.dataset.id, p = +a.dataset.p; if (id && p) openBook(id, p);
  });
  // الرد وهو بيتكتب: رسم مرة واحدة كل فريم بالكتير، والجزء الأخير بس (mdLive) — من غير لاج حتى في الردود الطويلة
  const citeLinks = (html, blocks) => { const multi = new Set(blocks.map(b => b.id)).size > 1;
    html = html.replace(/\[\?(\d{1,2})\]/g, (m, n) => blocks[+n - 1] ? `<span class="cite unv" title="مش متأكد إن المعلومة دي من ${esc(RAG.pg(blocks[+n - 1].id, blocks[+n - 1].page))} — راجعها بنفسك">⚠︎ مصدر غير مؤكد</span>` : "");
    return html.replace(/\[(\d{1,2}(?:\s*[،,]\s*\d{1,2})*)\]/g, (m, g) => g.split(/[،,]/).map(x => +x.trim()).filter(i => blocks[i - 1])
      .map(i => { const b = blocks[i - 1]; return `<a href="#" class="cite" data-id="${esc(b.id)}" data-p="${b.page}">${multi ? esc(shortName(b.id)) + " · " : ""}${esc(RAG.pg(b.id, b.page))}</a>`; }).join("")); };
  function streamer(node, blocks) {
    let txt = "", raf = 0; const chat = $("chat"), live = mdLive(node, h => citeLinks(h, blocks));
    const paint = () => { raf = 0; if (f.done) return; const stick = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 80; node.classList.remove("typing"); live(txt.replace(/\[\[[\s\S]*?(\]\]|$)/g, "")); if (stick) chat.scrollTop = 1e9; };
    const f = t => { if (f.done) return; txt = t; if (!raf) raf = requestAnimationFrame(paint); };
    f.stop = () => { f.done = true; cancelAnimationFrame(raf); raf = 0; }; f.text = () => txt;
    f.final = t => { node.classList.remove("typing"); live(t.replace(/\[\[[\s\S]*?\]\]/g, "")); };   // آخر رسم: نفس الأجزاء، من غير إعادة رسم الرد كله
    return f;
  }

  // ================= ٨) التشغيل =================
  // المهام اللي محتاجة تفكير (حل مسائل، حسابات، مقارنات، «ليه»، تصحيح وامتحانات) بتروح للموديل الأذكى تلقائيًا
  const MATHY = /([0-9٠-٩]\s*[-+×x*/÷^=]\s*[0-9٠-٩a-z(]|[=√∫πΣ∆]|\b(calculate|compute|prove|derive|find the value)\b|(^|\s)(احسب|احسبي|اوجد|أوجد|برهن|اثبت|أثبت|استنتج|عادله|معادله|قانون)(\s|$))/i;
  const tierFor = I => ["solve", "cmp", "grade", "quiz", "cards"].includes(I.kind) || I.mods.includes("why") || I.mods.includes("hard") || MATHY.test(I.q || "") ? "smart" : "fast";
  async function answer(I, { system, userText, blocks = [], imgs = [], R = null, maxT }) {
    const node = add("a", "بفكر...‏"); node.classList.add("typing");
    const vs = window.voiceStreamStart?.(), show = streamer(node, blocks);
    let out;
    try {
      const { msgs } = compactHistory(I.follow ? 3 : 2);
      out = await llm({ system, messages: [...msgs, { role: "user", content: userText }], imgs: imgs.length ? imgs : undefined, max: maxT || MAXT(I.kind), noStyle: true, tier: tierFor(I), onText: t => { show(t); vs?.push(t); } });
    } catch (e) {
      show.stop(); vs?.abort();
      if (e.name !== "AbortError" || !show.text().trim()) { node.remove(); const m = errMsg(e); const nd = add("a", m); if (e.name !== "AbortError") retryChip(nd); window.voiceAfter?.(m, nd); return null; }
      out = show.text().trim() + "\n\n_⏹ وقّفت الرد هنا._"; I.stopped = true;
    }
    show.stop(); out = String(out || "").trim() || "(مفيش رد، جرّب تاني)";
    const V = verifyCites(out, blocks); out = V.text;   // المصادر اللي مش متأكدين منها بتتعلّم ومتتعرضش كمصدر مؤكد
    show.final(out);
    sourcesRow(node, out, blocks, R); originTag(node, out, blocks, V); renderMath(node);
    if (R) badge(node, R); else if (blocks.length && LIB.length) { const ids = [...new Set(blocks.map(b => b.id))]; if (ids.length === 1) badge(node, { id: ids[0], kind: "whole" }); } node._copy = plainCites(out, blocks).replace(/_⏹ وقّفت الرد هنا._/, "").trim();
    const say = speechText(out); window.voiceDecorate?.(node, say);
    if (I.stopped) window.voiceAfter?.("⏹", node); else if (vs) vs.end(out, node); else window.voiceAfter?.(say, node);
    $("chat").scrollTop = 1e9;
    history.push({ role: "user", content: I.q }, { role: "assistant", content: plainCites(out, blocks) });
    const bp = blocks.filter(b => b.id === (R?.id || blocks[0]?.id)).map(b => b.page);
    F = { id: R?.id || blocks[0]?.id || F?.id, from: R?.from || (bp.length ? Math.min(...bp) : F?.from), to: R?.to || (bp.length ? Math.max(...bp) : F?.to), label: R?.label || (blocks[0] ? `${NAMES[blocks[0].id] || ""} — ${RAG.pg(blocks[0].id, blocks[0].page)}` : F?.label || ""), h: R?.h || F?.h, topic: I.follow && F?.topic ? F.topic : (I.topic || I.q), q0: I.follow && F?.q0 ? F.q0 : I.q, rq: I.follow && F?.rq ? F.rq : I.rq || "", blocks: blocks.length ? blocks.slice(0, 6) : F?.blocks || [] };
    return out;
  }
  let LVL = 0;
  // بحث بين لغتين: سؤال عربي والكتاب إنجليزي (أو العكس) → كلمات بحث قصيرة بلغة الكتاب من الموديل السريع (مرة واحدة لكل موضوع)
  const latinShare = t => { const L = (t.match(/[A-Za-z]/g) || []).length, A = (t.match(/[\u0621-\u064A]/g) || []).length; return L + A ? L / (L + A) : 0.5; };
  const XQ = new Map();
  async function crossQ(q, ids) {
    ids = (ids || []).filter(Boolean); if (!ids.length || !String(q).trim() || provider() === "local") return "";
    const bl = latinShare(ids.flatMap(id => RAG.chunks(id).slice(0, 30).map(c => c.text)).join(" ").slice(0, 15000)), ql = latinShare(q);
    if (Math.abs(bl - ql) < 0.5) return "";   // نفس لغة الكتاب: البحث العادي كفاية
    const to = bl > ql ? "English" : "Arabic", k = to + "|" + q; if (XQ.has(k)) return XQ.get(k);
    let out = "";
    try {
      out = await Promise.race([llm({ system: `Turn the student's request into a short search query (4-10 keywords) in ${to}, the language of their textbook. Keep scientific terms and names (e.g. Newton's second law, force, mass, acceleration). Output only the keywords on one line.`,
        messages: [{ role: "user", content: String(q).slice(0, 400) }], max: 60, noStyle: true, long: true, tier: "fast", purpose: "query" }), new Promise(r => setTimeout(() => r(""), 6000))]);
    } catch (e) { if (e?.name === "AbortError") throw e; }
    out = String(out || "").split("\n").find(x => x.trim()) || ""; out = out.replace(/[*"«»`#]/g, "").trim().slice(0, 160);
    XQ.set(k, out); return out;
  }   // كام مرة الطالب قال «مش فاهم» على نفس الموضوع: كل مرة الشرح بيبسط أكتر
  // صفحة تمارين/أسئلة (ورقة تدريب): لو الطالب طلب «اشرحلي الدرس» ومتحدّدش إنه عايز حل، الذكي مفروض يعلّم الفكرة مش يحل الورقة.
  const EXCUE = /(\bchoose\b|\bcircle\b|fill in|\bcomplete\b|\bmatch\b|true or false|\btick\b|answer the|اختر|اختار|أكمل|اكمل|ضع علامة|صل |أجب|اجب|املأ|ضع دائرة|\(\s*[a-d]\s*\)|(^|\n)\s*\d{1,2}\s*[.)-]\s)/gi;
  const exerciseHeavy = bl => { const t = (bl || []).map(b => b.text || "").join("\n"), w = t.split(/\s+/).filter(Boolean).length, c = (t.match(EXCUE) || []).length; return w > 0 && c >= 4 && (c * 100) / w >= 2; };
  const EXNOTE = "ملاحظة مهمة: المقاطع دي أغلبها تمارين وأسئلة (ورقة تدريب) مش شرح، والطالب طلب يفهم. فمتحلّش التمارين ومتسردش إجاباتها. حدّد الفكرة أو المهارة اللي التمارين دي بتختبرها (اسم الدرس) واشرحها زي مدرّس قاعد قدام الطالب: الفكرة ببساطة، القاعدة، ومثال جديد من عندك (مش من التمارين). وبعدين اقترح إنكم تحلوا تمرين من الورقة سوا، وخلّي الطالب يجرّب الأول وانت تساعده بتلميح. حل التمارين بيكون بس لما الطالب يطلب حلها صراحة.";
  const systemFor = (I, extra = "") => {
    const parts = [sysText(srcMode(I)), T.styleNote()];
    const ins = I.langOnly && !I.mods.some(m => m !== "again") ? INS.lang : I.answering ? INS.answering : I.mods.includes("direct") ? INS.direct : I.mods.includes("nu") ? INS["nu" + Math.min(3, Math.max(1, LVL))] : I.mods.includes("why") && I.follow ? INS.why : I.kind === "solve" ? INS.solve : I.mods.includes("simple") && I.kind !== "sum" ? INS.simple + (INS[I.kind] ? "\n" + INS[I.kind] : "") : I.mods.includes("ex") && ["explain", "general"].includes(I.kind) ? INS.ex : I.mods.includes("again") && I.kind === "explain" ? INS.again : INS[I.kind] || "";
    if (ins) parts.push("\n\nالمطلوب دلوقتي:\n" + ins);
    if (extra) parts.push("\n" + extra);
    return parts.join("");
  };
  const imgOK = () => !textOnly() && provider() !== "local";

  let PENDING = null;   // «الدرس 1» موجود في أكتر من وحدة: مستنيين الطالب يختار
  function askChoice(I, A) {
    const ol = RAG.outline(A.id), opts = A.ask.map(h => { const par = [...ol].reverse().find(o => o.lv < h.lv && o.page <= h.page); return { h, par, label: `${h.line}${par ? " — " + par.line : ""} (${RAG.pg(A.id, h.page)})` }; });
    PENDING = { I, id: A.id, opts };
    const node = add("a", `فيه أكتر من «${KNAME[A.k]} ${A.num}» في الكتاب المحدد «${NAMES[A.id] || ""}». تقصد أنهي واحد؟`);
    const box = document.createElement("div"); box.className = "chips pick";
    opts.forEach((o, i) => { const c = document.createElement("button"); c.type = "button"; c.className = "chip"; c.textContent = o.label; c.onclick = () => { if (!document.body.classList.contains("gen")) T.handle(String(i + 1)); }; box.append(c); });
    node.insertBefore(box, node.querySelector(".acts")); window.voiceAfter?.(`فيه أكتر من ${KNAME[A.k]} ${A.num}. تقصد أنهي واحد؟ ` + opts.map((o, i) => `${i + 1}: ${o.label}`).join("، "), node);
  }
  function altChips(I) {   // «فيه كمان …»: الدروس التانية بنفس الرقم كاختيار (من غير ما نوقف الشرح)
    const A = window.__alts; window.__alts = null; if (!A?.hs?.length) return;
    const node = [...$("chat").querySelectorAll(".m.a")].at(-1); if (!node) return; const ol = RAG.outline(A.id);
    const opts = A.hs.map(h => { const par = [...ol].reverse().find(o => o.lv < h.lv && o.page <= h.page); return { h, par, label: `${h.line}${par ? " — " + par.line : ""} (${RAG.pg(A.id, h.page)})` }; });
    PENDING = { I, id: A.id, opts };
    const box = document.createElement("div"); box.className = "chips pick"; const t = document.createElement("small"); t.className = "fch"; t.textContent = "تقصد درس تاني بنفس الرقم؟"; box.append(t);
    opts.forEach((o, i) => { const c = document.createElement("button"); c.type = "button"; c.className = "chip"; c.textContent = o.label; c.onclick = () => { if (!document.body.classList.contains("gen")) T.handle(String(i + 1)); }; box.append(c); });
    node.insertBefore(box, node.querySelector(".acts"));
  }
  function pickPending(q) {
    const P = PENDING; PENDING = null; if (!P) return null; const n = nq(q);
    let i = P.opts.findIndex(o => nq(o.label) === n); if (i < 0) { const w = numW(n.split(" ")[0]) || numW(n.split(" ").at(-1)); if (w && w <= P.opts.length && n.split(" ").length <= 3) i = w - 1; }
    if (i < 0) { const r = structRefs(n).find(x => x.num && x.k !== P.opts[0].h.k); if (r) i = P.opts.findIndex(o => o.par && o.par.k === r.k && o.par.num === r.num); }
    if (i < 0) return null; const h = P.opts[i].h;
    return { I: P.I, R: { id: P.id, from: h.page, to: Math.min(h.to, h.page + 40), kind: "section", h, label: `${NAMES[P.id] || ""} — ${h.line} (${RAG.pg(P.id, h.page)}${h.to > h.page ? "–" + RAG.pgNum(P.id, h.to) : ""})` } };
  }
  async function run(I, forcedR = null) {
    const sub = I.mods.includes("nu") && (I.topic || "").split(" ").some(w => w && w.length > 2 && !/^(فاهم|فاهمه|فهمت|مفهمتش|مافهمتش|واضح|لسه|لسا|برضه|برضو|بردو|برده|خالص|ابدا|كمان|والله|شويه|حاجه|الحته|الكلام|الشرح|understand|clear|confused|get|still|yet|again|anything|all)$/.test(w));   // «مش فاهم الـ acceleration» = حتة جديدة، مش نفس الشرح تاني
    LVL = I.mods.includes("nu") ? (I.follow ? (sub ? Math.max(1, LVL) : LVL + 1) : 1) : I.mods.includes("simple") && I.follow ? Math.max(LVL, 1) : I.follow ? LVL : 0;
    const hasDocs = LIB.length > 0, id = forcedR?.id || (hasDocs ? bookFor(I) : "");
    if (hasDocs && !id && (I.refs.length || I.rel || I.page)) {   // أكتر من كتاب ومفيش كتاب محدد: منخمّنش
      const node = add("a", "اختار الكتاب الأول من القايمة اللي تحت (أو افتحه)، عشان أدوّر فيه هو بس:");
      const box = document.createElement("div"); box.className = "chips pick";
      LIB.forEach(e => { const c = document.createElement("button"); c.type = "button"; c.className = "chip"; c.textContent = "📖 " + e.name; c.onclick = () => { $("book").value = e.id; if (!document.body.classList.contains("gen")) T.handle(I.q); }; box.append(c); });
      node.insertBefore(box, node.querySelector(".acts")); window.voiceAfter?.("اختار الكتاب الأول.", node); return;
    }
    if (id) await ensureIndex(id);
    let R = forcedR || (id ? resolve(I, id) : null);
    if (R?.ask && !strict()) {   // شات مفتوح: خد أول واحد (أو اللي في الوحدة المفتوحة) واعرض الباقيين كاختيار
      const hs = R.ask, here = doc && cur.id === R.id ? hs.find(h => { const par = [...RAG.outline(R.id)].reverse().find(o => o.lv < h.lv && o.page <= h.page); return par && cur.page >= par.page && cur.page <= par.to; }) : null, h = here || hs[0];
      window.__alts = { id: R.id, hs: hs.filter(x => x !== h), q: I.q };
      R = { id: R.id, from: h.page, to: Math.min(h.to, h.page + 40), kind: "section", h, label: `${NAMES[R.id] || ""} — ${h.line} (${RAG.pg(R.id, h.page)}${h.to > h.page ? "–" + RAG.pgNum(R.id, h.to) : ""})` };
    }
    if (R?.ask) return askChoice(I, R);
    if (R?.miss) { const nd = add("a", "⚠️ " + R.miss); badge(nd, { id, kind: "whole" }); window.voiceAfter?.(R.miss.split("\n")[0], nd); return; }

    // «اشرحلي أول درس» / «اشرح الفصل التاني» / «الدرس اللي بعده»: الشارح الموجود (بيشرح الدرس صفحة صفحة ويكمّل بـ «كمّل»)
    const pureExplain = !ATT.length && (I.kind === "explain" || I.kind === "next") && !I.mods.some(m => m !== "again") && (!I.topic || I.topic.split(" ").length <= 1);
    if (pureExplain && R && (R.kind === "section" || (R.kind === "pages" && R.guess))) { F = { ...(F || {}), id: R.id, from: R.from, to: R.to, label: R.label, h: R.h, topic: R.label, q0: I.q, rq: "", blocks: [] }; await explainLesson({ from: R.from, id: R.id, echo: false, to: R.guess ? 0 : R.to, h: R.h }); altChips(I); return; }
    if (I.kind === "explain" && !R && I.topic && id && /(درس|الدرس|lesson|موضوع|الموضوع|فصل|الفصل|chapter|unit|وحده)/.test(I.n)) {
      const h = RAG.findTitle(id, I.topic);
      if (h) { F = { id: h.id, from: h.page, to: h.to, label: `${NAMES[h.id] || ""} — ${h.line}`, h, topic: h.line, blocks: [] }; await explainLesson({ from: h.page, id: h.id, echo: false, to: h.to, h }); return; }
    }
    if (I.kind === "quiz" || I.kind === "cards") return makeQuiz(I, id, R);

    const budget = BUDGET(); let blocks = [], imgs = [], extra = "", ctxNote = "";
    const UP = ATT.splice(0);   // صور رفعها الطالب (سؤال متصوّر / كتابة بخط إيده)
    if (UP.length) {
      if (imgOK()) { imgs.push(...UP.map(u => u.b64)); extra += `\nالطالب رفع ${UP.length > 1 ? UP.length + " صور" : "صورة"} (${UP.map(u => u.label).join("، ")}). اقرا الصورة كويس وافهم السؤال منها وحلّه أو صحّحه خطوة خطوة. لو فيه خط إيد أو جزء مش واضح قول كده بصراحة ومتخمّنش بثقة.`; }
      else { const tx = []; for (const u of UP) { try { tx.push(await ocrImg(cur.id || LIB[0]?.id || "", "data:image/jpeg;base64," + u.b64)); } catch {} }
        ctxNote += `(المزوّد الحالي مبيشوفش الصور، فقريت الصورة بالـ OCR وممكن يكون فيه أخطاء — خصوصًا خط الإيد. لو حاجة مش واضحة قول كده.)\nنص الصورة:\n${tx.join("\n---\n").slice(0, 3000) || "(مقدرتش أقرا نص من الصورة)"}\n\n`; }
    }
    if (!R && id && ["sum", "notes", "key", "revise"].includes(I.kind) && !topicIn([id], I)) {
      R = defaultRange(id);
      if (!R) { const m = `قولي عايز ${I.kind === "sum" ? "ألخص" : "أطلّع أهم النقط من"} أنهي جزء (مثلًا «لخص الفصل الأول» أو «لخص من صفحة 10 لـ 20»)، أو افتح الكتاب على الدرس وقولي «لخص الدرس ده».`; const nd = add("a", m); window.voiceAfter?.(m, nd); return; }
    }
    if (I.kind === "outline" && id) {
      const ot = RAG.outlineText(id);
      ctxNote = ot ? `فهرس الملف «${NAMES[id] || ""}» (مستخرج آليًا من العناوين، والصفحات حسب ترقيم الكتاب):\n${ot}\n\n` : `(مقدرتش أطلّع فهرس واضح لـ «${NAMES[id] || ""}» — العناوين مش واضحة في النص المستخرج.)\n\n`;
    }
    // صفحة/صفحات محددة، أو «حل» وانت فاتح صفحة
    // «اشرحها تاني / اشرح ده» من غير كلام قبلها: المقصود الصفحة المفتوحة (مش نسأل الطالب يعيد)
    if (!R && !UP.length && id && doc && cur.id === id && !F && !history.length && ["explain", "general"].includes(I.kind) && (I.mods.includes("again") || has(I.n, RX.deictic) || I.mods.includes("nu") || I.mods.includes("simple")) && I.topic.split(" ").filter(Boolean).length <= 2)
      R = { id, from: cur.page, to: cur.page, kind: "page", label: `${NAMES[id] || ""} — ${RAG.pg(id, cur.page)}` };
    if (!R && !UP.length && id && I.kind === "solve" && doc && cur.id === id && !I.topic.length) R = { id, from: cur.page, to: cur.page, kind: "page", label: `${NAMES[id] || ""} — ${RAG.pg(id, cur.page)}` };
    if (!R && !UP.length && id && I.kind === "solve" && doc && cur.id === id && (I.qnum || /(السؤال|السوال|التمرين|الاسئله) (ده|دي|دا|اللي)/.test(I.n))) R = { id, from: cur.page, to: cur.page, kind: "page", label: `${NAMES[id] || ""} — ${RAG.pg(id, cur.page)}` };
    if (R) {
      const single = R.to - R.from <= 0, big = ["sum", "notes", "key", "revise", "general", "explain", "cmp", "next", "find"].includes(I.kind);
      blocks = await rangeBlocks(R, single ? Math.min(budget, 7000) : budget, I.q);
      if (!UP.length && imgOK() && (single || R.to - R.from <= 2) && (I.kind === "solve" || !blocks.length || blocks.every(b => b.text.length < 400))) {
        const d = docs[R.id] || await loadDoc(R.id);
        for (let p = R.from; p <= Math.min(R.to, R.from + 2); p++) imgs.push((await snap(null, p, 1500, d)).split(",")[1]);
        extra = `\nمعاك كمان صورة ${imgs.length > 1 ? "الصفحات" : "الصفحة"} (${R.label}) — اعتمد على الصورة لو النص المستخرج ناقص أو فيه أخطاء، ولو استخدمت الصورة اذكر رقم المقطع [1].`;
        if (!blocks.length) blocks = [{ id: R.id, page: R.from, sec: RAG.sectionAt(R.id, R.from)?.line || "", text: "(الصفحة صورة — شوف الصورة المرفقة)" }];
      }
      if (!blocks.length) { const m = `مقدرتش أقرا نص ${R.label}. لو الملف صور، استخدم «ذاكر الكتاب» عشان أقراه بالـ OCR، أو افتح الصفحة واضغط «حل الصفحة».`; const nd = add("a", "⚠️ " + m); window.voiceAfter?.(m, nd); return; }
      if (blocks.partial) ctxNote += `(الجزء المطلوب كبير، فاللي معاك أهم الجمل من كل صفحة فيه مش النص كامل.)\n`;
      if (blocks.missing) ctxNote += `(فيه ${blocks.missing} صفحة لسه متقراتش — ممكن تكون صور محتاجة OCR.)\n`;
      if (I.topic && big && I.kind !== "sum") { const more = await RAG.retrieve(I.q, { ids: [R.id], k: 3, range: R }); blocks = uniqBlocks([...blocks, ...more], 40); }
    } else if (hasDocs && I.kind !== "outline") {
      let cand = [];
      if (I.kind === "next") cand = nextBlocks();
      // المتابعة بتدوّر بالموضوع الأصلي + الجديد، و«رجعها بالعربي» بالموضوع بس. ولو لغة السؤال غير لغة الكتاب: كلمات بحث بلغة الكتاب
      const base = I.follow ? F?.q0 || F?.topic || "" : "";
      if (I.topic || I.follow) try { I.rq = (I.follow && F?.rq) || await crossQ(I.follow ? base + " — " + I.q : I.q, scopeFor(I) || LIB.map(e => e.id)); }
      catch (e) { if (e?.name !== "AbortError") throw e; const nd = add("a", "_⏹ وقّفت الرد هنا._"); window.voiceAfter?.("⏹", nd); return; }   // الطالب داس «وقّف» وإحنا لسه بندوّر
      const q2 = I.langOnly && base ? base : I.follow && base ? I.q + " " + base : I.q;
      const got = I.topic || I.follow ? await RAG.retrieve(q2, { ids: scopeFor(I), k: provider() === "local" ? 3 : 6, extraQ: [I.follow ? F?.topic || "" : "", I.rq || ""].join(" ").trim(), maxLen: provider() === "free" ? 1000 : 1400 }) : [];
      if (I.follow && F?.blocks?.length) cand = [...cand, ...F.blocks.slice(0, 3)];
      else if (I.follow && F?.id && F.from && (!scopeFor(I) || scopeFor(I).includes(F.id))) cand = [...cand, ...(await rangeBlocks({ id: F.id, from: F.from, to: Math.min(F.to || F.from, F.from + 5) }, Math.min(budget, 6000), I.q))];
      const scope = scopeFor(I); if (scope) cand = cand.filter(b => scope.includes(b.id));   // مفيش خلط: سياق المحادثة من الكتاب المحدد بس
      blocks = uniqBlocks([...cand, ...got], provider() === "local" ? 3 : 7);
      if (doc && cur.id && (I.here || I.part)) { /* «الصفحة دي / الجزء ده / الكلام ده» = الصفحة المفتوحة */ const t = await pageText(cur.id, cur.page); if (okText(t)) blocks.unshift({ id: cur.id, page: cur.page, sec: RAG.sectionAt(cur.id, cur.page)?.line || "", text: t.slice(0, 3000) }); }
      let used = 0; blocks = blocks.filter(b => (used += b.text.length) <= budget || b === blocks[0]);
    }
    const smallTalk = I.kind === "general" && !I.topic && !I.follow && !I.refs.length;
    if (strict() && hasDocs && !I.outside && !blocks.length && !ctxNote && !smallTalk) {   // قفل المصدر: مفيش في الكتاب = مفيش إجابة من برّه
      const m = NOTFOUND + "\n\n" + OUTSIDE_HINT, nd = add("a", m); const sid = (scopeFor(I) || [])[0]; if (sid) badge(nd, { id: sid, kind: "whole" });
      history.push({ role: "user", content: I.q }, { role: "assistant", content: NOTFOUND }); window.voiceAfter?.(NOTFOUND, nd); return;
    }
    const ctx = blocks.length ? `مقاطع من الكتاب المحدد (مستخرجة آليًا):\n${fmt(blocks)}\n\n` : hasDocs && !ctxNote ? (strict() ? "(مفيش مقاطع من الكتاب ليها علاقة بالرسالة دي.)\n\n" : "(مفيش مقاطع من الكتاب ليها علاقة بالرسالة دي — جاوب من معلوماتك وقول إنها من برّه الكتاب لو السؤال علمي.)\n\n") : "";
    const where = R ? `المكان المقصود: ${R.label}${R.guess ? " (مالقيتش عنوان واضح، فده من الصفحة المفتوحة)" : ""}\n` : "";
    const userText = memoryNote(I) + ctxNote + ctx + where + (I.follow ? "(الرسالة دي تكملة للمحادثة — افهم «دي/ده/اللي بعدها» من آخر رد.)\n" : "") + "طلب الطالب: " + I.q;
    const teach = !["solve", "grade", "quiz", "cards", "find", "outline"].includes(I.kind) && !I.mods.includes("direct") && !I.answering && exerciseHeavy(blocks);
    await answer(I, { system: systemFor(I, teach ? (extra ? extra + "\n" : "") + EXNOTE : extra), userText, blocks, imgs, R });
  }

  // ================= ٩) امتحانات وفلاش كاردز =================
  const LET_AR = ["أ", "ب", "ج", "د", "هـ", "و"];
  function parseJSON(s) {
    s = String(s || "").replace(/```(?:json)?/g, "").replace(/[“”]/g, '"'); const a = s.indexOf("{"), b = s.lastIndexOf("}"); if (a < 0 || b < a) return null;
    let t = s.slice(a, b + 1); for (let i = 0; i < 2; i++) { try { return JSON.parse(t); } catch { t = t.replace(/,\s*([}\]])/g, "$1").replace(/[\u0000-\u001f]+/g, " "); } } return null;
  }
  async function quizContext(I, id, R) {
    const budget = Math.min(BUDGET(), provider() === "free" ? 6000 : 12000);
    if (R) return { blocks: await rangeBlocks(R, budget, I.q), R };
    if (id && topicIn(scopeFor(I) || LIB.map(e => e.id), I)) { const bl = await RAG.retrieve(I.q, { ids: scopeFor(I), k: 8, maxLen: 1400 }); if (bl.length) return { blocks: bl, R: null }; }
    if (id && I.follow && F?.id) { const fr = { id: F.id, from: F.from || 1, to: Math.min(F.to || F.from || 1, (F.from || 1) + 15), label: F.label, kind: "pages" }; return { blocks: await rangeBlocks(fr, budget, I.q), R: fr }; }
    const r = id ? defaultRange(id) : null; if (r) return { blocks: await rangeBlocks(r, budget, I.q), R: r };
    return { blocks: [], R: null };
  }
  async function makeQuiz(I, id, R) {
    const cards = I.kind === "cards", count = I.count || (cards ? 10 : I.interactive ? 5 : 8);
    const wait = add("a", cards ? "🃏 بجهّز الفلاش كاردز..." : "📝 بجهّز الأسئلة..."); wait.classList.add("typing");
    let ctx; try { ctx = await quizContext(I, id, R); } catch (e) { ctx = { blocks: [], R }; }
    const { blocks } = ctx; R = ctx.R;
    if (!blocks.length && LIB.length && !I.outside && strict()) { wait.remove(); const m = "مش لاقي محتوى في الكتاب المحدد أعمل منه الأسئلة دي. حدد الدرس (مثلًا «اختبرني في الدرس 2») أو افتح الكتاب على الجزء اللي عايزه."; const nd = add("a", m); window.voiceAfter?.(m, nd); return; }
    const typeDesc = { mcq: "اختيار من متعدد (mcq) بس", tf: "صح وغلط (tf) بس", short: "أسئلة إجابتها قصيرة (short) بس", mix: "متنوعة: أغلبها اختيار من متعدد (mcq) وشوية صح وغلط (tf)" }[I.qtype || "mix"];
    const spec = cards
      ? `اعمل ${count} فلاش كارد للمذاكرة${blocks.length ? " من المحتوى اللي في المقاطع بس" : ""}: على الوش مصطلح أو سؤال قصير، وعلى الضهر التعريف أو الإجابة في سطر أو اتنين.\nرجّع JSON بس من غير أي كلام قبله أو بعده بالشكل ده:\n{"cards":[{"front":"...","back":"...","src":1}]}`
      : `اعمل ${count} أسئلة ${typeDesc}${blocks.length ? "، من المحتوى اللي في المقاطع بس (مش من برّه)" : ""}، ${I.diff === "hard" ? "صعبة: أسئلة فهم وتطبيق وتحليل وربط بين الأفكار (مش حفظ مباشر)، والاختيارات الغلط قريبة جدًا من الصح" : I.diff === "easy" ? "سهلة ومباشرة للتأكد من الأساسيات" : "بتغطي أهم الأفكار ومن السهل للأصعب، والاختيارات الغلط تبان منطقية (مش واضحة الغلط)"}.\nرجّع JSON بس من غير أي كلام قبله أو بعده بالشكل ده:\n{"questions":[{"type":"mcq","q":"نص السؤال","options":["...","...","...","..."],"answer":0,"explain":"ليه دي الإجابة الصح وليه الباقي غلط باختصار","src":1}]}\n- mcq: ٤ اختيارات و answer = رقم الاختيار الصح (من 0). tf: options = ["صح","غلط"] (أو ["True","False"] لو الملف إنجليزي). short: من غير options و answer = الإجابة النموذجية كنص.\n- نوّع مكان الإجابة الصح بين الاختيارات.`;
    const userText = (blocks.length ? `مقاطع من ملف الطالب:\n${fmt(blocks)}\n\n` : "(مفيش ملف مرتبط بالطلب ده — اعمل الأسئلة من معلوماتك العامة عن الموضوع اللي الطالب طلبه، وخليها دقيقة.)\n\n") + spec +
      "\n- src = رقم المقطع اللي السؤال/الكارت جاي منه." + "\n- اكتب الأسئلة بنفس لغة المحتوى (لو الملف إنجليزي تبقى إنجليزي)، والشرح (explain) بلهجة الطالب." + "\nطلب الطالب: " + I.q;
    const sysQ = sysText(srcMode(I)) + T.styleNote() + "\n\nإنت دلوقتي بتجهّز أسئلة/كروت مذاكرة. رجّع JSON صحيح بس.", prog = t => setTyping((cards ? "🃏 بجهّز الكروت... " : "📝 بجهّز الأسئلة... ") + Math.min(99, Math.round(t.length / (count * (cards ? 1.6 : 2.6)))) + "%");
    const label = R ? R.label : blocks[0] ? `${NAMES[blocks[0].id] || ""}` : "";
    const srcOf = x => { const b = blocks[(+x.src || 0) - 1]; return b ? { id: b.id, page: b.page, sec: b.sec || RAG.sectionAt(b.id, b.page)?.line || "" } : null; };
    if (cards) {
      let raw = "";
      try { raw = await llm({ tier: "smart", system: sysQ, messages: [{ role: "user", content: userText }], max: MAXT(I.kind), noStyle: true, temperature: 0.5, onText: prog }); }
      catch (e) { wait.remove(); const m = errMsg(e); const nd = add("a", m); window.voiceAfter?.(m, nd); return; }
      wait.remove(); const j = parseJSON(raw);
      const list = (j?.cards || []).filter(c => c && c.front && c.back).slice(0, 30);
      if (!list.length) return fallbackText(I, raw, blocks, R);
      renderCards(list.map(c => ({ ...c, s: srcOf(c) })), label); if (R) badge([...$("chat").querySelectorAll(".m.a")].at(-1), R);
      history.push({ role: "user", content: I.q }, { role: "assistant", content: "فلاش كاردز:\n" + list.map(c => `- ${c.front}: ${c.back}`).join("\n") });
    } else {
      // أسئلة = بيانات منظمة: بتتفحص بالـ schema (الاختيارات، الإجابة الصح، المصدر من المقاطع الحقيقية)، ولو باظت بنعيد مرة، وبعدها رسالة واضحة
      let qs;
      try { const r = await AI.structured({ tier: "smart", system: sysQ, prompt: userText, max: MAXT(I.kind), temperature: 0.5, onText: prog, validate: j => AI.validateQuestions(j, { blocks, max: 25 }) });
        qs = r.value.map(x => ({ ...x, type: x.options ? x.type : "short" })); }
      catch (e) { wait.remove(); const m = e.code === "malformed_ai" ? "⚠️ " + e.message : errMsg(e); const nd = add("a", m); retryChip?.(nd); window.voiceAfter?.(m, nd); return; }
      wait.remove();
      history.push({ role: "user", content: I.q }, { role: "assistant", content: "أسئلة:\n" + qs.map((x, i) => `${i + 1}) ${x.q}${x.options ? " [" + x.options.join(" / ") + "]" : ""}`).join("\n") });
      if (I.interactive) { Object.assign(QZ, { on: true, items: qs, i: 0, score: 0, wrong: [], label }); askNext(); }
      else renderQuiz(qs, label);
      if (R) badge([...$("chat").querySelectorAll(".m.a")].at(-1), R);
    }
    if (R) F = { id: R.id, from: R.from, to: R.to, label: R.label, h: R.h, topic: R.label, blocks: blocks.slice(0, 6) };
  }
  function fallbackText(I, raw, blocks, R) { const node = add("a", ""); node.innerHTML = citeHTML(raw.replace(/```(?:json)?/g, ""), blocks); sourcesRow(node, raw, blocks, R); window.voiceDecorate?.(node, speechText(raw)); window.voiceAfter?.(speechText(raw), node); }
  const srcChip = s => s ? `<a href="#" class="cite" data-id="${esc(s.id)}" data-p="${s.page}">${esc(RAG.pg(s.id, s.page))}</a>` : "";
  function qHTML(x, i, total) {
    const opts = x.type === "short" ? `<details class="qa"><summary>اظهر الإجابة</summary><div>${md(String(x.answer))}${x.explain ? "<br>" + md(x.explain) : ""} ${srcChip(x.s)}</div></details>`
      : `<div class="qo">${x.options.map((o, k) => `<button type="button" class="qopt" data-k="${k}"><b>${LET_AR[k] || k + 1}</b> ${esc(o)}</button>`).join("")}</div><div class="qf" hidden></div>`;
    return `<div class="qz" data-i="${i}"><div class="qh">سؤال ${i + 1}${total ? " من " + total : ""}</div><div class="qq">${md(x.q)}</div>${opts}</div>`;
  }
  const qSpeech = x => x.q + (x.options ? ". " + x.options.map((o, k) => (LET_AR[k] || k + 1) + ": " + o).join(". ") : "");
  // كل إجابة حقيقية بتتسجل لتتبع نقط الضعف (study.js) — من غير أي أرقام وهمية
  const result = (x, ok) => { if (x.s?.id) window.dispatchEvent(new CustomEvent("study-result", { detail: { id: x.s.id, page: x.s.page, topic: x.s.sec || "", ok, q: x.q } })); };
  function mark(box, x, k) {
    result(x, k === x.answer);
    box.querySelectorAll(".qopt").forEach(b => { b.disabled = true; const kk = +b.dataset.k; if (kk === x.answer) b.classList.add("ok"); else if (kk === k) b.classList.add("bad"); });
    const f = box.querySelector(".qf"); f.hidden = false; f.innerHTML = (k === x.answer ? "✅ <b>صح!</b> " : `❌ <b>الإجابة الصح:</b> ${LET_AR[x.answer] || ""} ${esc(x.options[x.answer])}. `) + (x.explain ? md(x.explain) : "") + " " + srcChip(x.s);
    return k === x.answer;
  }
  function renderQuiz(qs, label) {
    const node = add("a", ""); let done = 0, score = 0;
    node.innerHTML = `<b class="h">📝 ${qs.length} سؤال${label ? " — " + esc(label) : ""}</b>` + qs.map((x, i) => qHTML(x, i, qs.length)).join("") + `<div class="qscore" hidden></div>`;
    node.addEventListener("click", e => {
      const b = e.target.closest(".qopt"); if (!b || b.disabled) return; const box = b.closest(".qz"), x = qs[+box.dataset.i];
      if (mark(box, x, +b.dataset.k)) score++; done++;
      const mc = qs.filter(q => q.type !== "short").length, sc = node.querySelector(".qscore"); sc.hidden = false; sc.textContent = `النتيجة لحد دلوقتي: ${score} من ${done}` + (done === mc ? (score === mc ? " 🎉 ممتاز!" : " — راجع الأسئلة اللي غلطت فيها ودوس على رقم الصفحة عشان تفتحها.") : "");
    });
    window.voiceDecorate?.(node, qs.map((x, i) => `سؤال ${i + 1}: ` + qSpeech(x)).join(". "));
    window.voiceAfter?.("جهزتلك " + qs.length + " سؤال. جاوب بالضغط على الاختيار، ولو عايزني أسألك سؤال سؤال قولي «اختبرني».", node);
  }
  function renderCards(list, label) {
    const node = add("a", "");
    node.innerHTML = `<b class="h">🃏 ${list.length} فلاش كارد${label ? " — " + esc(label) : ""}</b><small class="fch">دوس على الكارت عشان تقلبه</small><div class="fcg">` +
      list.map(c => `<button type="button" class="fc"><span class="fr">${md(String(c.front))}</span><span class="bk">${md(String(c.back))}${c.s ? `<small>${esc(RAG.pg(c.s.id, c.s.page))}</small>` : ""}</span></button>`).join("") + "</div>";
    node.addEventListener("click", e => { const c = e.target.closest(".fc"); if (c) c.classList.toggle("flip"); });
    window.voiceDecorate?.(node, list.map(c => c.front + ": " + c.back).join(". "));
    window.voiceAfter?.("جهزتلك " + list.length + " كارت للمذاكرة. دوس على أي كارت عشان تشوف الإجابة.", node);
  }
  function askNext(pre = "") {
    const x = QZ.items[QZ.i], node = add("a", ""); node.innerHTML = qHTML(x, QZ.i, QZ.items.length) + `<small class="fch">${x.type === "short" ? "اكتب أو قول إجابتك" : "اختار، أو اكتب/قول حرف الإجابة"} — «كفاية» عشان ننهي</small>`;
    QZ.node = node; QZ.await = true;
    node.addEventListener("click", e => { const b = e.target.closest(".qopt"); if (!b || b.disabled || !QZ.on || QZ.node !== node) return; add("u", (LET_AR[+b.dataset.k] || "") + ") " + x.options[+b.dataset.k]); gradeMcq(+b.dataset.k); });
    const say = (pre ? pre + " " : "") + `السؤال ${QZ.i + 1}: ` + qSpeech(x);
    window.voiceDecorate?.(node, say); window.voiceAfter?.(say, node);
  }
  function letterIdx(n, x) {
    const t = n.replace(/^(الاجابه|اجابتي|الجواب|جوابي|answer|اختار|اختيار|رقم|هي|حرف)\s*/g, "").trim();
    const map = { ا: 0, "الف": 0, a: 0, "1": 0, ب: 1, "باء": 1, "با": 1, "بي": 1, b: 1, "2": 1, ج: 2, "جيم": 2, c: 2, "سي": 2, "3": 2, د: 3, "دال": 3, d: 3, "4": 3 };
    const w = t.split(" ")[0]; if (w in map && map[w] < x.options.length) return map[w];
    if (x.type === "tf") { if (/^(صح|صحيح|true|t|yes|ايوه|نعم|اه)$/.test(t)) return 0; if (/^(غلط|خطا|خطأ|false|f|no|لا)$/.test(t)) return 1; }
    const o = ORDW[w] || 0; if (o && o <= x.options.length) return o - 1;
    let best = -1, bs = 0; const qt = new Set(tok(t)); x.options.forEach((op, k) => { const ot = tok(op); if (!ot.length) return; const s = ot.filter(z => qt.has(z)).length / ot.length; if (s > bs) { bs = s; best = k; } });
    return bs >= 0.5 ? best : -1;
  }
  function gradeMcq(k) {
    const x = QZ.items[QZ.i]; QZ.await = false; const ok = mark(QZ.node, x, k);
    if (ok) QZ.score++; else QZ.wrong.push(QZ.i);
    const fb = ok ? "صح! 👏 " + (x.explain || "") : `لأ، الإجابة الصح ${LET_AR[x.answer] || ""}: ${x.options[x.answer]}. ${x.explain || ""}`;
    advance(fb);
  }
  async function gradeShort(ans) {
    const x = QZ.items[QZ.i]; QZ.await = false; const wait = add("a", "بصحح..."); wait.classList.add("typing"); let j = null;
    try { j = parseJSON(await llm({ system: sysText(srcMode(null)) + T.styleNote(), noStyle: true, max: 500, messages: [{ role: "user", content: `صحّح إجابة الطالب بلطف وبدقة.\nالسؤال: ${x.q}\nالإجابة النموذجية: ${x.answer}\n${x.explain ? "شرح: " + x.explain + "\n" : ""}إجابة الطالب: ${ans}\nرجّع JSON بس: {"verdict":"correct"|"partial"|"wrong","feedback":"سطرين: إيه الصح وإيه الغلط في إجابته وإيه الناقص"}` }] })); } catch {}
    wait.remove(); const v = j?.verdict || "partial", ok = v === "correct"; result(x, v !== "wrong"); if (ok) QZ.score++; else if (v === "partial") QZ.score += 0.5; else QZ.wrong.push(QZ.i);
    const fb = (ok ? "✅ صح! " : v === "partial" ? "🟡 قريب! " : "❌ مش بالظبط. ") + (j?.feedback || "") + (ok ? "" : ` الإجابة النموذجية: ${x.answer}`);
    const box = QZ.node.querySelector("details"); if (box) box.open = true;
    advance(fb);
  }
  function advance(fb) {
    const x = QZ.items[QZ.i]; QZ.i++;
    const nd = add("a", fb); if (x.s) { const s = document.createElement("div"); s.className = "src"; s.innerHTML = srcChip(x.s); nd.append(s); }
    if (QZ.i < QZ.items.length) setTimeout(() => askNext(fb), 350);
    else finishQuiz(fb);
  }
  function finishQuiz(pre = "") {
    const t = QZ.items.length, s = QZ.score, w = QZ.wrong.map(i => `- ${QZ.items[i].q}${QZ.items[i].s ? " (" + RAG.pg(QZ.items[i].s.id, QZ.items[i].s.page) + ")" : ""}`).join("\n");
    QZ.on = false; QZ.await = false;
    const msg = `🏁 خلصنا! نتيجتك **${s} من ${t}** ${s >= t * 0.8 ? "🎉 ممتاز!" : s >= t * 0.5 ? "👍 كويس، ومحتاج شوية مراجعة." : "💪 ولا يهمك، تعالى نراجع سوا."}` + (w ? `\n\nراجع الأسئلة دي:\n${w}\n\nلو عايز أشرحلك أي واحد فيهم قولي «اشرحلي السؤال ...».` : "");
    history.push({ role: "assistant", content: msg });
    const nd = add("a", msg); window.voiceAfter?.((pre ? pre + " " : "") + msg.replace(/\*\*/g, ""), nd);
  }

  // ================= ١٠) نقطة الدخول =================
  // كل سؤال = «دور»: بنفتكر مكانه في المحادثة عشان «أعد الإجابة» و«عدّل رسالتك»
  const ATT = [];   // صور مرفوعة مستنية تتبعت مع السؤال الجاي
  T.attach = list => { ATT.push(...list); };
  T.reset = () => { F = null; LVL = 0; QZ.on = false; QZ.await = false; PENDING = null; ATT.length = 0; };   // «محادثة جديدة» = ذاكرة جديدة
  T.pending = () => ATT.length;
  T.parseJSON = s => parseJSON(s);
  T.handle = (q, again = null) => window.genTurn ? genTurn(() => handle(q, again)) : handle(q, again);
  T.redo = turn => { stopSpeak?.(); cutAfter(turn, false); return T.handle(turn.q, turn); };
  T.edit = (turn, q2) => { stopSpeak?.(); cutAfter(turn, true); return T.handle(q2); };
  function cutAfter(turn, incl) {
    const nodes = [...$("chat").children], i = nodes.indexOf(turn.uNode); if (i < 0) return;
    nodes.slice(incl ? i : i + 1).forEach(x => x.remove()); history.length = Math.min(history.length, turn.h); QZ.on = false; QZ.await = false;
  }
  async function handle(q, again = null) {
    const uNode = again?.uNode || add("u", q), turn = again || { q, uNode, h: history.length };
    turn.h = history.length; uNode._turn = turn; window.markUser?.(uNode, turn);
    try { await handle1(q); } finally { const nodes = [...$("chat").children], last = nodes.slice(nodes.indexOf(uNode) + 1).filter(x => x.classList.contains("a")).at(-1); if (last) window.markAnswer?.(last, turn); }
  }
  async function handle1(q) {
    const n = nq(q), V = window.voiceCtl;
    // «استنى» والصوت شغال = وقّف الصوت فورًا (من غير ما نسأل الـ AI)، و«كمّل» بعدها = كمّل من نفس المكان
    if (V && V.speaking() && !V.paused() && V.isStop(n)) { V.pause(); const nd = add("a", "⏸ وقفت. قول «كمّل» وأكمّل من نفس المكان، أو اسأل سؤالك."); nd.classList.add("sys"); return; }
    if (V && V.paused() && V.isGo(n)) { V.resume(); const nd = add("a", "▶ بكمّل…"); nd.classList.add("sys"); return; }
    T.observe(q);
    if (QZ.on) {   // امتحان سؤال سؤال شغال
      if (RX.stopQuiz.test(n)) { finishQuiz(); return; }
      const x = QZ.items[QZ.i];
      if (RX.skip.test(n)) { QZ.await = false; if (x.type !== "short") mark(QZ.node, x, -1); QZ.wrong.push(QZ.i); advance(x.type === "short" ? `ولا يهمك. الإجابة: ${x.answer}` : `ولا يهمك. الإجابة الصح ${LET_AR[x.answer] || ""}: ${x.options[x.answer]}. ${x.explain || ""}`); return; }
      const I0 = parse(q), isReq = ["quiz", "cards", "sum", "notes", "outline", "solve", "cmp", "find"].includes(I0.kind) || (I0.kind === "explain" && n.split(" ").length > 3);
      if (QZ.await && !isReq) {
        if (x.type === "short") { await gradeShort(q); return; }
        const k = letterIdx(n, x); if (k >= 0) { gradeMcq(k); return; }
        const m = "اختار حرف الإجابة (" + x.options.map((o, i) => LET_AR[i]).join(" / ") + ")، أو قول «مش عارف» وأقولك الإجابة، أو «كفاية» عشان ننهي."; const nd = add("a", m); window.voiceAfter?.(m, nd); return;
      }
      if (isReq) QZ.on = false;
    }
    if (PENDING) { const p = pickPending(q); if (p) { await run(p.I, p.R); return; } }
    const ri = readIntent(q); if (ri) { await doRead(ri, q); return; }
    if (/^(كمل|كملي|كمله|تابع|كمل الشرح|كمل الدرس|continue|go on)$/.test(n) && lessonState?.done) { const m = `خلصنا ${lessonState.h ? "«" + lessonState.h.line + "»" : "الدرس ده"}. تحب أشرحلك الدرس اللي بعده؟ قولي «اشرح الدرس اللي بعده».`; const nd = add("a", m); window.voiceAfter?.(m, nd); return; }
    if (lessonIntent(q) === "cont" && lessonState && !lessonState.done) { await explainLesson({ from: lessonState.next, id: lessonState.id, cont: true, echo: false, to: lessonState.to, h: lessonState.h }); return; }
    const I = parse(q);
    await run(I);
  }

  // ================= ١١) إعدادات فهم المعنى =================
  T.syncSettings = () => {
    const sel = $("embmode"), st = $("embStat"); if (!sel || !st) return;
    sel.value = localStorage.getItem("embmode") || "auto";
    const be = RAG.backendName(), id = cur.id || LIB[0]?.id, cov = id ? Math.round(RAG.coverage(id) * 100) : 0;
    st.textContent = !be ? "شغال بالبحث بالكلمات بس (BM25 مع تصحيح أخطاء القراءة). عشان بحث بالمعنى: سيرفر الموقع، أو مفتاح Gemini، أو «محلي»."
      : `البحث بالمعنى شغال (${{ server: "سيرفر الموقع", gemini: "مفتاح Gemini بتاعك", local: "موديل محلي في متصفحك" }[be]})` + (RAG.prog ? ` — بفهرس «${NAMES[RAG.prog.id] || ""}»: ${RAG.prog.done}/${RAG.prog.total} مقطع` : id ? ` — «${NAMES[id] || ""}»: ${cov}%` : "") + (RAG.err ? ` ⚠️ ${RAG.err}` : "");
  };
  const sl = $("srclock"); if (sl) { sl.value = strict() ? "1" : "0"; sl.onchange = () => localStorage.setItem("srclock", sl.value); }
  const es = $("embmode"); if (es) es.onchange = () => { localStorage.setItem("embmode", es.value); T.syncSettings(); if (es.value === "local" && !confirm("الموديل المحلي بيتحمّل مرة واحدة (~١٢٠ ميجا) وبيشتغل في الخلفية. تكمّل؟")) { es.value = "auto"; localStorage.setItem("embmode", "auto"); } RAG.kick(); T.syncSettings(); };
  let lastSync = 0; window.addEventListener("rag-progress", () => { const t = Date.now(); if (t - lastSync > 700 && !$("settings").hidden) { lastSync = t; T.syncSettings(); } });
  window.addEventListener("proxy-health", () => { try { syncServerOpt(); syncLocalUI(); } catch {} });
  window.TUTOR = T;
})();

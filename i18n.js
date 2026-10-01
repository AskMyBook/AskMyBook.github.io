// ===== لغة الواجهة: عربي (الافتراضي) / English =====
// بيترجم نصوص الواجهة بس (الأزرار والقوايم والإعدادات ومركز المذاكرة) — مش كلام المدرّس ولا محتوى الكتب ولا ملاحظاتك.
// لغة ردود المدرّس بتمشي مع لغة الطالب تلقائيًا (tutor.js). التبديل بيحفظ الاختيار ويعيد تحميل الصفحة.
(() => {
  const LANG = localStorage.getItem("uiLang") === "en" ? "en" : "ar";
  const D = {
    "مساعد المذاكرة": "Smart Study", "مدرّسك الخاص لأي كتاب": "Your private tutor for any book", "الذكاء الاصطناعي": "AI", "المزوّد": "Provider",
    "🆓 مجاني بدون تسجيل ولا مفتاح ولا تحميل (الافتراضي)": "🆓 Free — no sign-up, no key, no download (default)", "✨ «ذكي» — سحابي مجاني بدون مفتاح (بيشوف الصور، ومبيحملش على جهازك)": "✨ Cloud (Puter) — free, sees images",
    "Gemini من Google (مجاني)": "Gemini by Google (free)", "Claude (مفتاح مدفوع)": "Claude (paid key)", "🎙️ صوت أوضح وأطبع (ElevenLabs) — سجّل دخول Puter مجانًا": "🎙️ Clearer, more natural voice (ElevenLabs) — sign in to Puter for free", "💻 محلي على جهازك (WebGPU — تحميل كبير مرة واحدة، وبعدها من غير نت)": "💻 On your device (WebGPU — one big download, then works offline)", "تسجيل دخول Puter": "Sign in to Puter", "حمّل الآن": "Load now", "حفظ": "Save",
    "المفتاح بيتحفظ في متصفحك بس.": "The key is stored only in your browser.", "مصدر الإجابات": "Answer source",
    "💬 شات مفتوح — الكتاب الأول، وأي سؤال تاني بيتجاوب (زي Gemini)": "💬 Open chat — book first, any other question answered", "🔒 الكتاب المحدد بس — «مش لاقي» لو المعلومة مش فيه": "🔒 Selected book only — says “not found” otherwise",
    "البحث بالمعنى في كتبك (embeddings)": "Semantic search in your books (embeddings)", "تلقائي — سيرفر الموقع أو مفتاح Gemini لو موجود": "Auto — site server or Gemini key if available",
    "محلي في المتصفح (تحميل ~١٢٠ ميجا مرة واحدة)": "Local in the browser (~120 MB, once)", "إيقاف — بحث بالكلمات بس": "Off — keyword search only",
    "الصوت": "Voice", "محرك الصوت": "Voice engine", "تلقائي — أحسن محرك متاح": "Auto — best available engine", "المدرّس": "Teacher", "المدرّس العربي": "Arabic teacher",
    "▶ جرّب": "▶ Try", "صوت المدرّس": "Teacher voice", "صوت واحد للعربي والإنجليزي (موصى بيه)": "One voice for Arabic and English (recommended)", "صوت عربي + صوت إنجليزي منفصل": "Separate Arabic + English voices",
    "اللغة": "Language", "تلقائي (عربي + English كل كلمة بنطقها)": "Auto (Arabic + English, each word in its language)", "عربي بس": "Arabic only", "السرعة": "Speed", "طبقة الصوت": "Pitch",
    "المحرك الحالي مبيدعمش تغيير طبقة الصوت.": "The current engine doesn't support pitch.", "سجّل دخول Puter (صوت طبيعي مجاني)": "Sign in to Puter (free natural voice)",
    "الكتاب": "Book", "المساعد": "Tutor", "🔍 دوّر في الكتاب": "🔍 Search the book", "↔️ ملء العرض": "↔️ Fit width", "🗎 الصفحة كاملة": "🗎 Fit page", "⛶ ملء الشاشة": "⛶ Fullscreen",
    "⬇️ تنزيل الـ PDF الأصلي": "⬇️ Download original PDF", "🖊️ تنزيل الـ PDF بالكتابة": "🖊️ Download annotated PDF", "✍️ صحّحلي اللي كتبته على الصفحة": "✍️ Check my handwritten work", "ℹ️ معلومات الملف": "ℹ️ Document info",
    "حل الصفحة": "Solve page", "حل": "Solve", "➕ إضافة كتب (PDF)": "➕ Add books (PDF)", "اشرح": "Explain", "أدوات الكتابة": "Writing tools", "اشرح الدرس": "Explain lesson", "محادثة جديدة": "New chat", "إنهاء": "End", "كل الكتب": "All books",
    "المدرّس بيعتمد على كتابك، وممكن يغلط — راجع الصفحة من زرار المصدر.": "The tutor relies on your book and can make mistakes — check the source page.",
    "📚 المكتبة": "📚 Library", "📝 الملاحظات": "📝 Notes", "🧪 امتحان": "🧪 Exam", "🎯 نقط الضعف": "🎯 Weak areas", "🗓️ خطة المذاكرة": "🗓️ Study plan", "🔍 بحث": "🔍 Search",
    "مركز المذاكرة: المكتبة، الامتحانات، الملاحظات، نقط الضعف، الخطة": "Study hub: library, exams, notes, weak areas, plan", "مركز المذاكرة": "Study hub",
    "الوضع الليلي/النهاري": "Dark / light mode", "الإعدادات": "Settings", "مفتاح API": "API key", "مسح الكتاب من متصفحك": "Remove book from this browser",
    "الصفحة السابقة": "Previous page", "رقم الصفحة": "Page number", "الصفحة التالية": "Next page", "تصغير": "Zoom out", "تكبير": "Zoom in",
    "إضافة كتب (PDF) من جهازك": "Add books (PDF) from your device", "إضافة كتب": "Add books", "أدوات الكتاب: ملء العرض، ملء الشاشة، تنزيل، بحث…": "Book tools: fit, fullscreen, download, search…", "أدوات الكتاب": "Book tools",
    "حل كل أسئلة الصفحة": "Solve all questions on the page", "شرح الدرس بصوت المدرّس": "Explain the lesson with the teacher's voice", "تحديد / اسأل AI / تمرير": "Select / ask AI / scroll", "تحديد": "Select",
    "قلم": "Pen", "هايلايتر": "Highlighter", "اكتب نص": "Text", "نص": "Text", "ممحاة": "Eraser", "رصاص (خط رفيع)": "Pencil (thin)", "رصاص": "Pencil",
    "أشكال: خط / سهم / مستطيل / دايرة": "Shapes: line / arrow / rectangle / circle", "أشكال": "Shapes", "خط": "Line", "سهم": "Arrow", "مستطيل": "Rectangle", "دايرة": "Circle",
    "حدّد كتابة/شكل: حرّكه، أو كبّره من المربع الأزرق، أو امسحه": "Select an annotation: move it, resize from the blue handle, or delete it", "تحديد وتحريك": "Select & move",
    "لون": "Color", "سُمك القلم / حجم الخط": "Stroke size / font size", "السُمك": "Size", "شفافية الهايلايتر": "Highlight opacity", "الصفحة اللي فيها تعليقات": "Pages with annotations",
    "تراجع (Ctrl+Z)": "Undo (Ctrl+Z)", "تراجع": "Undo", "إعادة (Ctrl+Y)": "Redo (Ctrl+Y)", "إعادة": "Redo", "امسح المحدد (Delete)": "Delete selected (Delete)", "امسح المحدد": "Delete selected",
    "مسح كتابة الصفحة": "Clear page annotations", "مسح": "Clear", "ابدأ محادثة جديدة (المحادثة الحالية هتتمسح)": "Start a new chat (clears this one)", "اتكلم / قاطِع": "Speak / interrupt", "اتكلم": "Speak",
    "اسأل مدرّسك عن أي حاجة في كتابك…": "Ask your tutor anything about your book…", "اكتب سؤالك": "Type your question", "الكتاب اللي بتسأل فيه": "Book to ask about",
    "ارفع صورة سؤال (أو الصق صورة / اسحبها هنا)": "Upload a question image (or paste / drop it here)", "ارفع صورة": "Upload image", "لغة الميكروفون": "Microphone language",
    "شغّل القراءة التلقائية للردود": "Read answers aloud automatically", "قراءة تلقائية": "Auto read", "محادثة صوتية: اتكلم والمدرّس يرد بصوته": "Voice tutor: talk and the teacher answers aloud", "محادثة صوتية": "Voice tutor",
    "اكتب بصوتك (إملاء)": "Dictate", "ميكروفون": "Microphone", "إرسال": "Send", "انزل لآخر الكلام": "Scroll to latest", "قفل": "Close",
    "➕ ضيف كتاب": "➕ Add book", "▶ كمّل": "▶ Continue", "🧑‍🏫 ذاكر مع الـ AI": "🧑‍🏫 Study with AI", "غيّر الاسم": "Rename", "نزّل الـ PDF": "Download PDF", "امسح": "Delete",
    "حفظ الملاحظة": "Save note", "كل الملاحظات": "All notes", "الكتاب ده": "This book", "الصفحة دي": "This page", "اكتب ملاحظة…": "Write a note…", "🔍 دوّر في ملاحظاتك": "🔍 Search your notes",
    "لسه مفيش ملاحظات. اكتب واحدة فوق، أو دوس «📝 احفظ كملاحظة» تحت أي رد من المدرّس.": "No notes yet. Write one above, or press “📝 Save as note” under any tutor answer.",
    "✏️ تعديل": "✏️ Edit", "🗑️ مسح": "🗑️ Delete", "📝 احفظ كملاحظة": "📝 Save as note", "✅ اتحفظت": "✅ Saved", "🤖 من المدرّس": "🤖 From tutor", "✍️ ملاحظتي": "✍️ My note", "إلغاء": "Cancel",
    "🧪 امتحان من كتابك": "🧪 Exam from your book", "الجزء": "Scope", "الكتاب كله": "Whole book", "عدد الأسئلة": "Number of questions", "الصعوبة": "Difficulty", "سهل": "Easy", "متوسط": "Medium", "صعب": "Hard", "صعب جدًا": "Very hard",
    "الوقت (دقايق، 0 = من غير وقت)": "Time (minutes, 0 = untimed)", "نوع الأسئلة": "Question types", "اختيار من متعدد": "Multiple choice", "صح وغلط": "True / False", "أكمل الفراغ": "Fill in the blank",
    "إجابة قصيرة": "Short answer", "مقالي": "Essay", "مسائل": "Problems", "ابدأ الامتحان": "Start exam", "سلّم الامتحان": "Submit exam", "امتحان جديد": "New exam", "🏁 نتيجة الامتحان": "🏁 Exam result",
    "🎯 محتاج تراجع": "🎯 Needs review", "اتدرّب عليها": "Practice this", "اشرحهالي": "Explain it", "اتدرّب": "Practice", "ابدأ": "Start", "افتح": "Open", "اشرحهولي": "Explain it",
    "محسوبة من إجاباتك الحقيقية بس (الأسئلة، «اختبرني»، والامتحانات). نقطة ضعف = ٣ محاولات على الأقل، غلطت في ٢ منهم أو أكتر، ونسبة صحتك أقل من 60%.": "Calculated only from your real answers (questions, “quiz me”, exams). A weak area needs 3+ attempts, 2+ mistakes and under 60% correct.",
    "لسه مفيش بيانات: حل أسئلة أو امتحان من الكتاب ده، وهنا هتظهر المواضيع اللي محتاجة مراجعة.": "No data yet: answer questions or take an exam from this book and topics needing review will appear here.",
    "الموضوع": "Topic", "صح": "Right", "غلط": "Wrong", "النسبة": "Score",
    "ميعاد الامتحان (اختياري)": "Exam date (optional)", "أو عدد الأيام": "or number of days", "دقايق في اليوم": "Minutes per day", "اعمل الخطة": "Create plan", "🔄 حدّث الخطة حسب تقدّمي": "🔄 Update plan from my progress",
    "بتتحسب من فهرس الكتاب، والصفحات اللي قريتها فعلًا، ونقط ضعفك.": "Built from the book's contents, the pages you actually read, and your weak areas.", "راحة / مراجعة خفيفة": "Rest / light review",
    "الكتاب المفتوح": "Open book", "كل كتبي": "All my books", "دوّر": "Search", "كلمة أو جملة…": "Word or phrase…",
    "📋 انسخ النص": "📋 Copy text", "✨ اسأل الـ AI": "✨ Ask AI", "📖 المعنى": "📖 Meaning", "🔊 انطق": "🔊 Pronounce", "🌐 ترجم": "🌐 Translate",
    "مكتبتك فاضية.": "Your library is empty.", "➕ ضيف كتاب (PDF)": "➕ Add a book (PDF)", "ضيف كتاب الأول.": "Add a book first.", "ضيف كتاب الأول عشان أعملك امتحان منه.": "Add a book first to create an exam from it.",
    "امتحاناتك اللي فاتت": "Your previous exams", "لسه مفتحتوش": "Not opened yet", "🎉 مفيش غلطات — ممتاز!": "🎉 No mistakes — excellent!",
    "🌐 اللغة": "🌐 Language", "الحساب": "Account", "👤 الحساب والمزامنة": "👤 Account & sync", "الإيميل": "Email", "كلمة السر (٦ حروف أو أكتر)": "Password (6+ characters)", "دخول": "Sign in", "حساب جديد": "Create account", "خروج": "Sign out",
    "🔄 زامن دلوقتي": "🔄 Sync now", "داخل باسم": "Signed in as", "لحظة…": "One moment…", "سجّل دخول عشان كتبك تتزامن على كل أجهزتك": "Sign in to sync your books across devices",
    "الحسابات مش متفعّلة على الموقع ده، فكل حاجة محفوظة على الجهاز ده بس (ومحدش غيرك يقدر يوصلها). لصاحب الموقع: خطوات التفعيل في README ← «الحسابات».": "Accounts aren't enabled on this site, so everything is stored on this device only (nobody else can access it). Site owner: see README → Accounts.",
    "لما تدخل، كتبك والكتابة عليها وملاحظاتك وتقدّمك بيتزامنوا على كل أجهزتك. كل حساب بيشوف بياناته هو بس.": "When signed in, your books, annotations, notes and progress sync across your devices. Each account sees only its own data.", "English": "English", "العربية": "العربية"
  };
  const RX = [   // نصوص فيها أرقام أو أسماء
    [/^مكتبتي \((\d+)\)$/, "My library ($1)"], [/^ملاحظاتي \((\d+)\)$/, "My notes ($1)"], [/^اتضاف (.+?)( · (\d+) صفحة)?$/, (m, d, x, n) => "Added " + d + (n ? " · " + n + " pages" : "")],
    [/^قريت (\d+)% \((\d+) صفحة\) · آخر صفحة (\d+)$/, "Read $1% ($2 pages) · last page $3"], [/^اتفتح (\d+) من (.+) صفحة$/, "Opened $1 of $2 pages"], [/^\(ص (.+)\)$/, "(p. $1)"],
    [/^اربطها بالصفحة (\d+) في «(.+)»$/, "Link to page $1 of “$2”"], [/^خلّصت (\d+) من (\d+) مهمة$/, "Done $1 of $2 tasks"], [/^اليوم (\d+) · (.+)$/, "Day $1 · $2"], [/^(\d+) صفحة فيها «(.+)»$/, "$1 pages contain “$2”"]
  ];
  function tr(s) {
    const t = s.trim(); if (!t || !/[؀-ۿ]/.test(t)) return null;
    if (D[t]) return s.replace(t, D[t]);
    for (const [re, to] of RX) if (re.test(t)) return s.replace(t, t.replace(re, to));
    return null;
  }
  const SKIP = el => el.closest?.("#chat .m, #pages, script, style, .note .nt, .bin h3, [data-noi18n]");
  function apply(root) {
    if (LANG !== "en" || !root) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) { const p = n.parentElement; if (!p || SKIP(p)) continue; const v = tr(n.textContent); if (v != null && v !== n.textContent) n.textContent = v; }
    (root.querySelectorAll ? [root, ...root.querySelectorAll("[title],[placeholder],[aria-label]")] : []).forEach(e => { if (!e.getAttribute || SKIP(e)) return;
      for (const a of ["title", "placeholder", "aria-label"]) { const v0 = e.getAttribute(a); if (!v0) continue; const v = tr(v0); if (v != null && v !== v0) e.setAttribute(a, v); } });
  }
  // زرار تبديل اللغة في الهيدر
  const b = document.createElement("button"); b.id = "uiLang"; b.className = "icon txt"; b.textContent = LANG === "en" ? "ع" : "EN";
  b.title = LANG === "en" ? "العربية" : "English"; b.setAttribute("aria-label", LANG === "en" ? "Switch interface to Arabic" : "Switch interface to English"); b.dataset.noi18n = "1";
  b.onclick = () => { localStorage.setItem("uiLang", LANG === "en" ? "ar" : "en"); location.reload(); };
  document.querySelector("header .hbtns")?.prepend(b);
  if (LANG === "en") {
    document.documentElement.lang = "en"; document.documentElement.dir = "ltr"; document.title = "Smart Study";
    const q = $("q"); if (q) q.dir = "auto";
    apply(document.body);
    let pend = new Set(), raf = 0;
    new MutationObserver(ms => { ms.forEach(m => { m.addedNodes.forEach(x => pend.add(x.nodeType === 3 ? x.parentElement : x)); if (m.type === "characterData") pend.add(m.target.parentElement); if (m.type === "attributes") pend.add(m.target); });
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; const L = [...pend]; pend = new Set(); L.forEach(x => x && x.isConnected && apply(x)); }); })
      .observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["title", "placeholder", "aria-label"] });
  }
  window.I18N = { lang: LANG, t: s => (LANG === "en" ? tr(s) || s : s) };
})();

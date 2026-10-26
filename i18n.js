// ===== لغة الواجهة: عربي (الافتراضي) / English =====
// بيترجم نصوص الواجهة بس (الأزرار والقوايم والإعدادات ومركز المذاكرة) — مش كلام المدرّس ولا محتوى الكتب ولا ملاحظاتك.
// لغة ردود المدرّس بتمشي مع لغة الطالب تلقائيًا (tutor.js). التبديل بيحفظ الاختيار ويعيد تحميل الصفحة.
(() => {
  const LANG = localStorage.getItem("uiLang") === "en" ? "en" : "ar";
  const D = {
    "مساعد المذاكرة": "AskMyBook", "مدرّسك الخاص لأي كتاب": "Your private tutor for any book", "الذكاء الاصطناعي": "AI", "المزوّد": "Provider",
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
    "📚 المكتبة": "📚 Library", "🎬 فيديوهات": "🎬 Videos", "📓 النوت بوك": "📓 Notebook", "الكراسة": "Notebook", "احفظ الكراسة PDF": "Save notebook as PDF", "الصفحة دي بس (PDF)": "This page only (PDF)", "كل صفحات الكراسة (PDF)": "All notebook pages (PDF)", "لون الورقة": "Paper color", "اختار أي لون": "Pick any color", "طبّقه على كل الصفحات": "Apply to all pages", "اقفل اللوحة الجانبية": "Close side panel", "افتح اللوحة الجانبية (المساعد والكراسة)": "Open side panel (tutor and notebook)", "كتابة بالكيبورد": "Type", "صفحة جديدة": "New page", "صفحة": "Page", "اكتب هنا…": "Write here…", "ادخل بحساب جوجل": "Continue with Google", "أو بالإيميل": "or with email", "🎬 فيديوهات شرح": "🎬 Explainer videos", "📘 الكتاب كله": "📘 Whole book", "📝 الملاحظات": "📝 Notes", "🧪 امتحان": "🧪 Exam", "🎯 نقط الضعف": "🎯 Weak areas", "🗓️ خطة المذاكرة": "🗓️ Study plan", "🔍 بحث": "🔍 Search",
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
  // ===== ترجمات إضافية (عشان لما تقلب English كل الواجهة تبقى إنجليزي) =====
  Object.assign(D, {
    "اتخطّى للسؤال": "Skip to question", "📓 الكراسة": "📓 Notebook", "🤖 المساعد": "🤖 Tutor", "ع": "ع",
    "مكتبتك فاضية. اضغط «إضافة كتب» واختار ملفات الـ PDF بتاعتك (تقدر تختار كذا كتاب مع بعض).": "Your library is empty. Press “Add books” and choose your PDF files (you can pick several at once).",
    "الكتب بتتحفظ في متصفحك إنت بس مرة واحدة، وكل ما تفتح الموقع هتلاقيها. الموقع نفسه مفيهوش أي كتب.": "Books are saved once in your own browser, and you'll find them every time you open the site. The site itself holds no books.",
    "أهلًا 👋 أنا مدرّسك الخاص": "Hi 👋 I'm your private tutor",
    "ضيف كتابك (PDF) واسألني فيه بأي طريقة — بالمصري أو الخليجي أو الفصحى أو English. هشرحلك من كتابك وأقولك الصفحة.": "Add your book (PDF) and ask me anything about it, in English or Arabic. I'll explain from your book and tell you the page.",
    "اشرحلي الدرس ده": "Explain this lesson", "لخص الفصل ده": "Summarize this chapter", "اختبرني سؤال سؤال": "Quiz me one question at a time", "اعمللي Flashcards": "Make me flashcards",
    "إيه أهم الحاجات اللي لازم أحفظها؟": "What are the most important things to memorize?", "راجع معايا قبل الامتحان": "Review with me before the exam",
    "افتح المساعد فوق الشاشة": "Open the tutor on top of the screen", "فاتح / غامق": "Light / dark", "تبديل الوضع الفاتح والغامق": "Toggle light and dark mode",
    "موديل Puter": "Puter model", "الموديل المحلي": "Local model", "افتح الكراسة مكان الكتاب": "Open the notebook in place of the book",
    "أسود": "Black", "أبيض": "White", "أزرق غامق": "Dark blue", "أزرق": "Blue", "أحمر": "Red", "أخضر": "Green", "تلقائي": "Auto", "كريمي": "Cream", "أصفر": "Yellow",
    "أزرق فاتح": "Light blue", "أخضر فاتح": "Light green", "وردي": "Pink", "رمادي غامق": "Dark grey", "رفيع": "Thin", "تخين": "Thick",
    "روح للصفحة اللي بعدها فيها كتابة أو تظليل": "Go to the next page with writing or highlights", "اسحب عشان تكبّر أو تصغّر": "Drag to resize",
    "كبّر على الشاشة كلها": "Full screen", "رجّعه في اللوحة الجانبية": "Back to the side panel", "اقفل": "Close", "اخفي": "Hide",
    "رجّعها جنب الكتاب": "Put it back beside the book", "افتح اللوحة الجانبية": "Open the side panel", "حطه في اللوحة الجانبية": "Move to the side panel", "حطه مكان الكتاب": "Show in place of the book",
    "🤖 تلقائي — الأذكى للمسائل والمقارنات، والأسرع للكلام العادي (الافتراضي)": "🤖 Auto — smartest for problems and comparisons, fastest for chat (default)",
    "⚡ متوازن — ذكي وسريع": "⚡ Balanced — smart and fast", "🧠 الأذكى (GPT-OSS 120B) — أبطأ شوية": "🧠 Smartest (GPT-OSS 120B) — a bit slower", "Qwen — كويس في العربي": "Qwen — good at Arabic",
    "🤖 تلقائي — الأذكى للمسائل، والأسرع للكلام العادي (الافتراضي)": "🤖 Auto — smartest for problems, fastest for chat (default)", "⚡ سريع وخفيف (GPT nano)": "⚡ Fast and light (GPT nano)", "🧠 أذكى (GPT-5.5)": "🧠 Smarter (GPT-5.5)",
    "🔒 سيرفر الموقع — الأذكى، ومفيش مفاتيح على جهازك": "🔒 Site server — smartest, no keys on your device",
    "سيرفر الموقع — مش متاح": "Site server — not available", "«كريم» على جهازك (مجاني بلا حدود)": "“Karim” on your device (free, unlimited)",
    "صوت المتصفح (من جهازك، مجاني) — مش متاح": "Browser voice (on your device, free) — not available",
    "صوت طبيعي (ElevenLabs / OpenAI عن طريق Puter — مجاني بحسابك) — سجّل دخول الأول (الزرار تحت)": "Natural voice (ElevenLabs / OpenAI via Puter — free with your account) — sign in first (button below)",
    "تلقائي — صوت المدرّس العربي الافتراضي": "Auto — default Arabic teacher voice", "👨 كريم — عربي (جودة أعلى)": "👨 Karim — Arabic (higher quality)", "👨 كريم — عربي (أخف وأسرع للموبايل)": "👨 Karim — Arabic (lighter, faster on mobile)",
    "مفيش كتابة ولا تظليل في الكتاب ده لسه": "No writing or highlights in this book yet", "مفيش كتابة ولا تظليل في الكتاب ده لسه.": "No writing or highlights in this book yet.",
    "أحسن فيديوهات شرح للكتاب ده على يوتيوب": "Best YouTube explainer videos for this book",
    "➕ صفحة جديدة": "➕ New page", "لسه مفيش صفحات.": "No pages yet.", "النوت بوك بتاعك فاضي. اعمل صفحة واكتب فيها ملخصاتك وقوانينك وأي حاجة عايز تفتكرها.": "Your notebook is empty. Create a page and write your summaries, formulas and anything you want to remember.",
    "➕ أول صفحة": "➕ First page", "🔍 دوّر في صفحاتك": "🔍 Search your pages", "▶ شغّل": "▶ Play", "دوّر على شرح": "Find an explainer",
    "افتح نتايج البحث على يوتيوب، واختار الفيديو اللي عاجبك، وانسخ اللينك والزقه فوق علشان يشتغل هنا.": "Open the YouTube results, pick a video you like, copy its link and paste it above to play it here.",
    "▶ افتح نتايج البحث على يوتيوب": "▶ Open YouTube results", "الزق لينك فيديو يوتيوب هنا ويشتغل جوه الموقع": "Paste a YouTube link here to play it inside the site", "أو اكتب الدرس اللي عايزه…": "or type the lesson you want…",
    "نسخ الرد": "Copy answer", "إجابة تانية": "Another answer", "عدّل السؤال": "Edit question", "وقّف الرد": "Stop answer", "إلغاء": "Cancel", "محادثة جديدة": "New chat",
    "تبدأ محادثة جديدة؟ المحادثة الحالية هتتمسح.": "Start a new chat? The current one will be cleared.",
    "سامعك… اتكلم": "Listening… speak", "بفكّر…": "Thinking…", "بفكر...": "Thinking...", "بفكر...‏": "Thinking...", "🤔 بفكر...": "🤔 Thinking...", "🎙️ سامعك... اتكلم": "🎙️ Listening... speak",
    "بتكلم… دوس الدايرة عشان تقاطعني": "Speaking… tap the circle to interrupt", "متوقف مؤقتًا — دوس الدايرة عشان أكمّل": "Paused — tap the circle to continue",
    "⏸ متوقف مؤقتًا": "⏸ Paused", "🔊 بتكلم...": "🔊 Speaking...", "اسمع الشرح": "Listen", "إيقاف": "Stop", "إعادة من الأول": "Restart", "إيقاف مؤقت": "Pause", "كمّل": "Resume", "بيولّد الصوت…": "Generating audio…",
    "سرعة الكلام (0.75× / 1× / 1.25× / 1.5×)": "Speech speed (0.75× / 1× / 1.25× / 1.5×)", "⏸ وقفت — قول «كمّل» أو اسأل سؤالك": "⏸ Paused — say “continue” or ask your question",
    "⚠️ اسمح للمتصفح باستخدام الميكروفون من أيقونة القفل جنب الرابط.": "⚠️ Allow the browser to use the microphone from the lock icon next to the address.",
    "القراءة التلقائية شغالة (اضغط لإيقافها)": "Auto read is on (press to turn off)",
    "💡 عايز صوت أوضح وأطبع (ElevenLabs)؟ سجّل دخول Puter مجانًا — من ⚙️ ← الصوت ← «صوت أوضح».": "💡 Want a clearer, more natural voice (ElevenLabs)? Sign in to Puter for free — ⚙️ → Voice → “Clearer voice”.",
    "صوت المتصفح الافتراضي": "Default browser voice", "⏳ بنتصل بسيرفر الموقع…": "⏳ Connecting to the site server…", "مفيش محرك صوت متاح على الجهاز ده": "No voice engine available on this device",
    "لسه مفيش صوت اشتغل على الجهاز ده — دوس «جرّب» تتأكد.": "No voice has played on this device yet — press “Try” to check.",
    "✅ متسجّل في Puter — الصوت الطبيعي شغال من رصيدك المجاني.": "✅ Signed in to Puter — natural voice runs on your free credit.",
    "أهلًا! أنا مدرّسك. هشرحلك الدرس خطوة خطوة، ولو فيه مصطلح زي cell membrane هقوله بالإنجليزي عادي. يلا نبدأ؟": "Hi! I'm your tutor. I'll explain the lesson step by step. Shall we start?",
    "بفتح تسجيل الدخول…": "Opening sign-in…", "بفتح تسجيل الدخول...": "Opening sign-in...", "✅ تمام! الصوت الطبيعي اشتغل.": "✅ Done! The natural voice works.", "⚠️ التسجيل مكملش.": "⚠️ Sign-in wasn't completed.",
    "اتحفظ": "Saved", "بيتحفظ…": "Saving…", "متأكد؟ دوس تاني": "Sure? Press again", "الصورة مش سليمة": "The image is invalid",
    "اتحطت في الكراسة — حرّكها أو كبّرها، وبعدين اختار القلم واكتب عليها": "Added to the notebook — move or resize it, then pick the pen and write on it",
    "بنجهّز الـ PDF…": "Preparing the PDF…", "اتحفظ PDF": "PDF saved", "اتحفظت الكراسة PDF": "Notebook saved as PDF", "بص على صفحة الكراسة دي:": "Look at this notebook page:", "كراسة": "Notebook", "اتحط في الكراسة": "Added to the notebook", "📓 للكراسة": "📓 To notebook",
    "اسم الكتاب الجديد:": "New book name:", "الملف مش موجود على الجهاز ده.": "The file isn't on this device.", "اشرحلي": "Explain", "📖 اشرحلي الصفحة اللي أنا فيها": "📖 Explain the page I'm on",
    "اشرحلي الصفحة دي": "Explain this page", "❓ اختبرني": "❓ Quiz me", "اختبرني": "Quiz me", "🧪 امتحان كامل": "🧪 Full exam", "اربطها بالصفحة": "Link to page",
    "مفيش ملاحظات بالبحث ده.": "No notes match this search.", "تمسح الملاحظة دي؟": "Delete this note?", "📝 ملاحظة": "📝 Note", "📝 اتحفظت في ملاحظاتك (مركز المذاكرة ← الملاحظات).": "📝 Saved to your notes (Study hub → Notes).",
    "صفحات": "pages", "الكتاب لسه متقراش — افتحه الأول.": "The book hasn't been read yet — open it first.", "اختار نوع أسئلة واحد على الأقل.": "Pick at least one question type.",
    "مقدرتش أقرا نص من الجزء ده. لو الكتاب صور، دوس «ذاكر الكتاب كله» الأول عشان يتقري.": "I couldn't read any text from this part. If the book is scanned images, press “Study the whole book” first so it gets read.",
    "سهلة": "Easy", "متوسطة": "Medium", "صعبة": "Hard", "صعبة جدًا": "Very hard", "الموديل مرجّعش أسئلة صالحة. جرّب تاني.": "The model didn't return valid questions. Try again.", "رجوع": "Back",
    "⏱ الوقت خلص — بصحح الامتحان.": "⏱ Time's up — grading the exam.", "تلغي الامتحان؟": "Cancel the exam?", "بصحح إجاباتك…": "Grading your answers…", "مفيش إجابة.": "No answer.",
    "🟡 ناقصة": "🟡 Partial", "صح!": "Correct!", "الإجابة الصح:": "Correct answer:", "ببساطة، أنا بغلط فيها كتير": "Simply, I get this wrong a lot", "امتحان تجريبي على كل المنهج": "Mock exam on the whole syllabus",
    "من غير عنوان": "Untitled", "مفيش صفحات بالبحث ده.": "No pages match this search.", "عنوان الصفحة": "Page title", "تنسيق": "Format", "عريض": "Bold", "مايل": "Italic", "تحته خط": "Underline",
    "عنوان": "Heading", "كلام عادي": "Normal text", "قايمة": "List", "قايمة بأرقام": "Numbered list", "هايلايت": "Highlight", "شيل التنسيق": "Clear formatting",
    "حط لينك للصفحة اللي فاتحها في الكتاب": "Insert a link to the page you have open", "✓ اتحفظ": "✓ Saved", "تمسح الصفحة دي من النوت بوك؟": "Delete this page from the notebook?", "شرح": "Explainer", "محفوظ": "Saved",
    "ضيف كتاب الأول، وأنا أجيبلك أحسن فيديوهات شرح ليه.": "Add a book first, and I'll find the best explainer videos for it.", "افتح على يوتيوب": "Open on YouTube", "✕ اقفل": "✕ Close",
    "✓ محفوظ للكتاب ده": "✓ Saved for this book", "⭐ احفظه للكتاب ده": "⭐ Save for this book", "⭐ اتحفظ الفيديو مع الكتاب": "⭐ Video saved with the book", "اتشال من المحفوظة": "Removed from saved",
    "⚠️ ده مش لينك فيديو يوتيوب": "⚠️ That's not a YouTube video link", "ملقتش فيديوهات مناسبة للبحث ده. جرّب درس تاني أو اكتب اسم الدرس بنفسك.": "No matching videos found. Try another lesson or type the lesson name yourself.",
    "مترتّبين بالمشاهدات والتقييم ومدى قربهم من الدرس.": "Sorted by views, rating and how close they are to the lesson.", "مفيش نتايج": "No results",
    "لسه متقراش — افتحه ودوس «ذاكر الكتاب كله» عشان يدخل في البحث.": "Not read yet — open it and press “Study the whole book” to include it in search.",
    "⚠️ الصورة كبيرة أوي (أكتر من ١٥ ميجا).": "⚠️ The image is too large (over 15 MB).", "صورة": "Image", "⚠️ مقدرتش أفتح الصورة دي.": "⚠️ I couldn't open this image.", "الصورة هتتبعت مع سؤالك": "The image will be sent with your question",
    "حل السؤال اللي في الصورة واشرحلي الخطوات": "Solve the question in the image and explain the steps", "افتح كتاب الأول.": "Open a book first.", "افتح كتاب الأول": "Open a book first",
    "اكتب حلّك على الصفحة بالقلم الأول (أداة القلم فوق)، وبعدين دوس «صحّحلي».": "Write your solution on the page with the pen first (pen tool above), then press “Check my work”.",
    "استنى الصفحة تظهر كاملة وجرّب تاني.": "Wait for the page to load fully and try again.", "بيحفظ…": "Saving…", "الحفظ فشل ⚠️": "Saving failed ⚠️", "اتحفظ ✓": "Saved ✓",
    "⚠️ مقدرتش أحفظ على الجهاز (المساحة خلصت؟). التعديلات لسه قدامك — فضّي مساحة وجرّب تاني.": "⚠️ Couldn't save on this device (out of space?). Your changes are still here — free some space and try again.",
    "المتصفح منع ملء الشاشة.": "The browser blocked full screen.", "الملف الأصلي مش موجود على الجهاز.": "The original file isn't on this device.", "مفيش كتابة على الكتاب ده — نزّلت الأصل.": "No writing on this book — downloaded the original.",
    "بجهّز الـ PDF بالكتابة…": "Preparing the annotated PDF…", "الاسم": "Name", "العنوان": "Title", "المؤلف": "Author", "عدد الصفحات": "Pages", "الحجم": "Size", "ميجا": "MB", "إصدار PDF": "PDF version", "اتعمل بـ": "Made with", "اتضاف": "Added", "الصفحة الحالية": "Current page",
    "⏳ في الطابور": "⏳ Queued", "📄 بيقرا نص الصفحات": "📄 Reading page text", "🔎 بيقرا الصفحات الصور (OCR)": "🔎 Reading scanned pages (OCR)", "🗂️ بيطلّع الفهرس": "🗂️ Building the contents", "🧩 بيقسّم لمقاطع": "🧩 Splitting into passages",
    "🧠 بيجهّز البحث بالمعنى": "🧠 Preparing semantic search", "💾 بيحفظ الفهرس": "💾 Saving the index", "✅ جاهز للمذاكرة": "✅ Ready to study", "الملف مش موجود على الجهاز": "The file isn't on this device", "مقدرتش أقرا أي نص من الكتاب ده": "I couldn't read any text from this book",
    "✅ اتجابت إعداداتك من الحساب (بعضها بيتطبق بالكامل بعد تحديث الصفحة).": "✅ Your settings were loaded from your account (some apply fully after reloading).", "ℹ️ كتاب أكبر من حد المزامنة": "ℹ️ A book is larger than the sync limit", "هيفضل على الجهاز ده بس.": "It will stay on this device only.",
    "سجّل دخول الأول": "Sign in first", "مقدرتش أحمّل مكتبة الحسابات (محتاج نت)": "Couldn't load the accounts library (needs internet)", "اكتب كلمة السر الجديدة (٦ حروف أو أكتر):": "Enter a new password (6+ characters):", "✅ اتغيّرت كلمة السر.": "✅ Password changed.",
    "اكتب إيميل وكلمة سر ٦ حروف أو أكتر.": "Enter an email and a password of 6+ characters.", "✅ اتعمل الحساب — افتح الإيميل وأكّد، وبعدين ادخل.": "✅ Account created — confirm from your email, then sign in.", "الإيميل أو كلمة السر غلط.": "Wrong email or password.",
    "الإيميل ده عنده حساب — دوس «دخول».": "This email already has an account — press “Sign in”.", "لحظة… بنفتح صفحة جوجل": "One moment… opening Google", "اكتب إيميلك الأول.": "Enter your email first.", "✅ بعتنالك لينك تغيير كلمة السر على الإيميل.": "✅ We emailed you a password reset link.",
    "تمسح كل كتبك وملاحظاتك وكتابتك وتقدّمك من السحابة؟ (اللي على الجهاز ده هيفضل، وهتخرج من الحساب)": "Delete all your books, notes, writing and progress from the cloud? (This device keeps its copy, and you'll be signed out)",
    "✅ اتمسحت بياناتك من السحابة وخرجت من الحساب.": "✅ Your cloud data was deleted and you're signed out.", "تمسح حسابك نهائيًا؟ مش هينفع ترجّعه.": "Delete your account permanently? This can't be undone.", "✅ اتمسح الحساب.": "✅ Account deleted.",
    "خرجت من الحساب. البيانات اللي على الجهاز ده فاضلة.": "Signed out. Data on this device is kept.",
    "اتحفظ الفيديو مع الكتاب": "Video saved with the book", "قولّي عايز فيديوهات عن إيه؟ مثلًا: «هاتلي فيديوهات عن قانون نيوتن التاني».": "Tell me what videos you want, e.g. “find videos about Newton's second law”.",
    "افتح النتايج على يوتيوب": "Open the results on YouTube", "بدوّر على فيديوهات…": "Searching for videos…", "مقدرتش أجيب الفيديوهات": "Couldn't get the videos", "دوّر على يوتيوب": "Search YouTube", "صفحة الكراسة": "Notebook page",
    "فتحتلك الفيديو مكان الكتاب. تقدر تنقله جنب الكراسة من الزرار اللي فوقه.": "I opened the video in place of the book. You can move it next to the notebook from the button above it.", "فتحتلك الكراسة.": "Opened the notebook.", "رجّعتلك الكتاب.": "Back to the book.",
    "أهلًا! 👋 أنا مدرّسك الخاص. ضيف أي ملف PDF واسألني فيه بأي طريقة.": "Hi! 👋 I'm your private tutor. Add any PDF and ask me anything about it.",
    "➕ ضيف نسخة تانية": "➕ Add another copy", "🗑️ امسحه من المكتبة": "🗑️ Remove from library", "الكتب كبيرة، أول مرة ممكن تاخد شوية وقت": "Books are large; the first time may take a while", "اختار كتبك من جهازك وهتتحفظ في المتصفح.": "Pick your books from your device and they'll be saved in the browser.",
    "⏹ وقّفت الرد.": "⏹ Stopped.", "⚠️ ضع مفتاح API في الإعدادات (⚙️) الأول.": "⚠️ Put an API key in settings (⚙️) first.", "⚠️ مفيش إنترنت دلوقتي. اتأكد من الاتصال ودوس «جرّب تاني».": "⚠️ No internet right now. Check your connection and press “Try again”.",
    "⚠️ مقدرتش أوصل لخدمة الذكاء الاصطناعي (ممكن تكون واقفة أو النت ضعيف). دوس «جرّب تاني»، ولو فضلت كده غيّر المزوّد من ⚙️.": "⚠️ I couldn't reach the AI service (it may be down or your internet is weak). Press “Try again”, and if it continues change the provider in ⚙️.",
    "⚠️ لازم تسجّل دخول الأول (⚙️ ← الحساب).": "⚠️ You need to sign in first (⚙️ → Account).", "⚠️ الخدمة عليها ضغط دلوقتي (حد الطلبات). استنى دقيقة ودوس «جرّب تاني».": "⚠️ The service is busy right now (rate limit). Wait a minute and press “Try again”.",
    "🔄 جرّب تاني": "🔄 Try again", "المفتاح غلط أو مش شغال. اتأكد إنك نسخته كامل.": "The key is wrong or not working. Make sure you copied all of it.", "⏳ سيرفر الموقع مشغول — بكمّل بالخدمة المجانية…": "⏳ The site server is busy — continuing with the free service…",
    "سيرفر الـ AI مش متظبط. اختار مزوّد تاني من ⚙️.": "The AI server isn't set up. Pick another provider in ⚙️.", "(مفيش رد، جرّب تاني)": "(No answer, try again)", "وصلت للحد المجاني لدلوقتي (طلبات كتير). استنى دقيقة وجرّب تاني، ولو فضلت الرسالة اجرّب بكرة.": "You've hit the free limit for now (too many requests). Wait a minute and try again; if it continues, try tomorrow.",
    "🧠 بيفكر بعمق": "🧠 Thinking deeply", "⏳ بيفكر": "⏳ Thinking", "الموديل مرجّعش رد": "The model returned no answer", "بحمّل الذكاء المحلي…": "Loading local AI…", "مقدرتش أحمّل مكتبة OCR (محتاج إنترنت أول مرة)": "Couldn't load the OCR library (needs internet the first time)",
    "⏸ وقّف": "⏸ Pause", "الكتاب عربي": "Book is Arabic", "الكتاب إنجليزي": "Book is English", "عربي + إنجليزي (أبطأ)": "Arabic + English (slower)", "لغة الكتاب (للقراءة بالـ OCR)": "Book language (for OCR)",
    "📖 ذاكر الباقي": "📖 Study the rest", "📖 ذاكر الكتاب كله": "📖 Study the whole book", "📚 ذاكر كل كتبي": "📚 Study all my books", "✅ خلصت قراءة كل كتبك.": "✅ Finished reading all your books.", "📚 بجهّز مذاكرة كل كتبك...": "📚 Preparing to study all your books...",
    "📚 الكتاب ده صور (مفيهوش نص)، فمحتاج أقراه بالـ OCR عشان أعرف اللي فيه.": "📚 This book is scanned images (no text), so I need to read it with OCR to know what's in it.",
    "بيشتغل في الخلفية، وممكن ياخد وقت حسب حجم الكتاب (سيب الصفحة مفتوحة)، وبيتحفظ في متصفحك فمش هتعيده.": " Runs in the background and may take a while depending on the book size (keep the page open); it's saved in your browser so you won't redo it.",
    "🔎 بقرا السؤال (OCR)...": "🔎 Reading the question (OCR)...", "🔎 بقرا الجزء المحدد (OCR)...": "🔎 Reading the selection (OCR)...", "🔎 بقرا الجزء المحدد…": "🔎 Reading the selection…",
    "مقدرتش أقرا السؤال اللي أشّرت عليه. جرّب تدوس على سطر تاني من السؤال أو حدد مساحة بالسحب.": "I couldn't read the question you marked. Tap another line of it or drag to select an area.",
    "اختار الكتاب الأول (من القايمة اللي فوق) أو افتحه، وبعدين قولي اقرالي إيه.": "Choose the book first (from the list above) or open it, then tell me what to read.", "مقدرتش أقرا نص الصفحة دي.": "I couldn't read this page's text.",
    "✅ تم تسجيل الدخول، تقدر تسأل.": "✅ Signed in, you can ask now.", "✅ الذكاء المحلي جاهز.": "✅ Local AI is ready.", "بحمّل...": "Loading...", "تحميل": "Download", "ترجمة": "Translation", "مش لاقي": "Not found", "🔊 نطق": "🔊 Pronounce", "🌐 ترجمة": "🌐 Translate", "(صورة)": "(image)",
    "مقدرتش أقرا النص اللي حددته. جرّب تحدد مساحة أوضح وأكبر شوية.": "I couldn't read the text you selected. Try a clearer, slightly larger area.",
    "افتح الكتاب الأول ووقّف على أول صفحة في الدرس، وبعدين قولي «اشرحلي الدرس».": "Open the book on the first page of the lesson, then say “Explain the lesson”.", "كمّل الشرح ←": "Continue explaining →",
    "الكتابة بالصوت مش مدعومة في المتصفح ده": "Voice typing isn't supported in this browser", "🎙️ الميكروفون بيشتغل بس لما الموقع يتفتح من رابط https (زي GitHub Pages) أو localhost.": "🎙️ The microphone only works when the site is opened over https (like GitHub Pages) or localhost.",
    "🎙️ المتصفح ده مبيدعمش تحويل الكلام لكتابة. استخدم Chrome أو Edge أو Safari، أو اكتب سؤالك عادي.": "🎙️ This browser doesn't support speech-to-text. Use Chrome, Edge or Safari, or just type your question.",
    "عربي (مصري)": "Arabic (Egyptian)", "عربي (سعودي/خليجي)": "Arabic (Saudi/Gulf)", "لغة الميكروفون:": "Microphone language:",
    "🎙️ الميكروفون مقفول. اسمح للموقع يستخدمه من أيقونة القفل جنب الرابط وجرّب تاني.": "🎙️ The microphone is blocked. Allow the site to use it from the lock icon next to the address and try again.",
    "🎙️ المتصفح مش سامح بالتعرّف على الكلام. جرّب Chrome أو Edge.": "🎙️ The browser doesn't allow speech recognition. Try Chrome or Edge.", "🎙️ مش لاقي ميكروفون شغال على الجهاز.": "🎙️ No working microphone found on this device.",
    "🎙️ التعرّف على الكلام محتاج إنترنت. اتأكد من النت وجرّب تاني.": "🎙️ Speech recognition needs internet. Check your connection and try again.",
    "اللغة العربية (الأضواء)": "Arabic (Al-Adwaa)", "التاريخ (الامتحان)": "History (Al-Emtehan)", "الفلسفة (الامتحان)": "Philosophy (Al-Emtehan)", "التكنولوجيا (فائز)": "Technology (Faez)", "English (المعاصر)": "English (Al-Moasser)",
    "سهل": "Easy", "متوسط": "Medium", "صعب": "Hard", "صعب جدًا": "Very hard", "أكمل الفراغ": "Fill in the blank", "اظهر الإجابة": "Show answer", "سلّم الامتحان": "Submit exam"
  });
  RX.push(
    [/^✅ قريت الكتاب كله \((\d+) صفحة\) — اسألني عن أي حاجة فيه$/, "✅ I've read the whole book ($1 pages) — ask me anything about it"],
    [/^📖 بقرا الكتاب… (\d+) من (\d+) صفحة — تقدر تسأل عادي$/, "📖 Reading the book… $1 of $2 pages — you can ask anyway"],
    [/^📚 أنا قريت (\d+) من (\d+) صفحة في الكتاب ده، والباقي صور محتاجة قراءة بالـ OCR\.$/, "📚 I've read $1 of $2 pages in this book; the rest are images that need OCR."],
    [/^📚 بذاكر كل كتبك\.\.\. دلوقتي: (.*) \((\d+) من (\d+)\) — (\d+) من (\d+) صفحة\.$/, "📚 Studying all your books... now: $1 ($2 of $3) — $4 of $5 pages."],
    [/^بقرا صفحة (\d+) بالـ OCR \(أول مرة بياخد وقت\)\.\.\.$/, "Reading page $1 with OCR (slow the first time)..."],
    [/^✨ حل صفحة (\d+) كاملة$/, "✨ Solve all of page $1"], [/^✨ سؤال من صفحة (\d+)$/, "✨ Question from page $1"], [/^✨ الجزء المحدد من صفحة (\d+)$/, "✨ Selection from page $1"],
    [/^🎓 كمّل شرح (.+) \(من (.+)\)$/, (m, a, b) => "🎓 Continue explaining " + (a === "الدرس" ? "the lesson" : a) + " (from " + b.replace(/^ص\s*/, "p. ") + ")"],
    [/^🎓 اشرحلي (.+) \(من (.+)\)$/, (m, a, b) => "🎓 Explain " + (a === "الدرس" ? "the lesson" : a) + " (from " + b.replace(/^ص\s*/, "p. ") + ")"],
    [/^جاري حفظ (.+)\.\.\.$/, "Saving $1..."], [/^جاري تحميل (.+) \((\d+) من (\d+)\)\.\.\.$/, "Loading $1 ($2 of $3)..."], [/^📖 افتح «(.+)»$/, "📖 Open “$1”"],
    [/^فيه كتابة في (\d+) صفحة — دوس عشان تروح للي بعدها$/, "$1 pages have writing — press to go to the next one"], [/^تمسح كل الكتابة اللي على صفحة (\d+)؟$/, "Clear all writing on page $1?"],
    [/^بنزّل «(.+)»…$/, "Downloading “$1”…"], [/^أنا جاهز أذاكر معاك في «(.+)»\. اختار فصل أو درس، أو ابدأ بسؤالك\.$/, "I'm ready to study “$1” with you. Pick a chapter or lesson, or start with your question."],
    [/^بجهّز الامتحان من «(.+)»…$/, "Preparing the exam from “$1”…"], [/^🧪 امتحان — (.+) \((\d+) سؤال · (.+)\)$/, (m, a, n, d) => "🧪 Exam — " + a + " (" + n + " questions · " + (D[d] || d) + ")"],
    [/^فيه (\d+) سؤال من غير إجابة\. تسلّم برضه؟$/, "$1 questions are unanswered. Submit anyway?"], [/^(.+) — غلطت (\d+)( وجبت (\d+))?$/, (m, a, w, x, r) => a + " — wrong " + w + (r ? ", right " + r : "")],
    [/^افتح ص (\d+)$/, "Open p. $1"], [/^ص (\d+)$/, "p. $1"], [/^(.+) - ص(\d+)$/, "$1 - p.$2"], [/^(.+) — ص (\d+)$/, "$1 — p. $2"], [/^مراجعة نقطة ضعف: (.+)$/, "Weak-spot review: $1"], [/^مراجعة سريعة: (.+)$/, "Quick review: $1"],
    [/^⚠️ بتغلط كتير في$/, "⚠️ You often get wrong:"], [/^\((\d+) غلط من (\d+)\)$/, "($1 wrong of $2)"], [/^بدوّر على: «(.+)»$/, "Searching for: “$1”"], [/^⭐ فيديوهاتي المحفوظة \((\d+)\)$/, "⭐ My saved videos ($1)"],
    [/^(\d+) ملف ماتحفظش: (.+)$/, "$1 files weren't saved: $2"], [/^⚠️ (\d+) ملف ماتحفظش: (.+)$/, "⚠️ $1 files weren't saved: $2"], [/^⚠️ حصل خطأ: (.+)$/, "⚠️ Error: $1"],
    [/^⚠️ خدمة الذكاء الاصطناعي رجعت خطأ \((\d+)\)\. دوس «جرّب تاني» بعد شوية\.$/, "⚠️ The AI service returned an error ($1). Press “Try again” in a bit."],
    [/^تمسح «(.+)» من متصفحك؟ \(الملف والفهرس والتظليلات بتاعته\)$/, "Remove “$1” from your browser? (the file, its index and highlights)"],
    [/^سؤال (\d+) من (\d+)$/, "Question $1 of $2"], [/^سؤال (\d+)$/, "Question $1"], [/^صح! 👏 ?(.*)$/, "Correct! 👏 $1"], [/^لأ، الإجابة الصح (\S+): (.*)$/, "No, the correct answer is $1: $2"],
    [/^اتضاف (.+)$/, "Added $1"], [/^(\d+) سؤال$/, "$1 questions"], [/^(\d+) صفحة$/, "$1 pages"], [/^(\d+) من (\d+)$/, "$1 of $2"]
  );
  function tr(s) {
    const t = s.trim(); if (!t || !/[؀-ۿ]/.test(t)) return null;
    if (D[t]) return s.replace(t, D[t]);
    for (const [re, to] of RX) if (re.test(t)) return s.replace(t, t.replace(re, to));
    return null;
  }
  const SKIP = el => el.closest?.("#pages, script, style, .note .nt, .bin h3, [data-noi18n], .kpaper");
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
  b.onclick = () => { const to = LANG === "en" ? "ar" : "en"; localStorage.setItem("uiLang", to); localStorage.setItem("dialect", to === "en" ? "en" : (localStorage.getItem("dialectAr") || "eg")); location.reload(); };
  document.querySelector("header .hbtns")?.prepend(b);
  if (LANG === "en") {
    document.documentElement.lang = "en"; document.documentElement.dir = "ltr"; document.title = "AskMyBook";
    const q = $("q"); if (q) q.dir = "auto";
    if (!localStorage.getItem("miclang") && typeof setMicLang === "function") try { setMicLang("en-US"); } catch {}
    apply(document.body);
    for (const f of ["alert", "confirm", "prompt"]) { const o = window[f].bind(window); window[f] = (m, ...r) => o(typeof m === "string" ? (tr(m) || m) : m, ...r); }
    let pend = new Set(), raf = 0;
    new MutationObserver(ms => { ms.forEach(m => { m.addedNodes.forEach(x => pend.add(x.nodeType === 3 ? x.parentElement : x)); if (m.type === "characterData") pend.add(m.target.parentElement); if (m.type === "attributes") pend.add(m.target); });
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; const L = [...pend]; pend = new Set(); L.forEach(x => x && x.isConnected && apply(x)); }); })
      .observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["title", "placeholder", "aria-label"] });
  }
  window.I18N = { lang: LANG, t: s => (LANG === "en" ? tr(s) || s : s) };
})();

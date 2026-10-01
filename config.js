// ===== إعدادات صاحب الموقع =====
// proxyUrl: رابط سيرفر الـ AI الآمن (فولدر server/). المفاتيح بتتحط هناك كـ environment variables ومبتظهرش في كود الموقع أبدًا.
//   - سيبه فاضي "" = الموقع بيشتغل زي الأول (مزوّدات مجانية / مفتاح المستخدم نفسه في متصفحه).
//   - "https://study-tutor.<اسمك>.workers.dev" = سيرفر Cloudflare Worker (مثلًا لصوت «شاكر» من Azure — الخطوات في README).
//   - "/" = السيرفر هو نفسه اللي بيعرض الموقع (node server/node.mjs).
// متحطش أي مفتاح API في الملف ده.
// supabaseUrl + supabaseAnonKey (اختياري): الحسابات ومزامنة الكتب بين الأجهزة — الخطوات في README ← «الحسابات».
//   الـ anon key عام بطبيعته والحماية بـ RLS (server/supabase.sql). متحطش service_role key هنا أبدًا.
window.TUTOR_CONFIG = Object.assign({
  proxyUrl: "https://study-tutor.asserzaher210.workers.dev",
  supabaseUrl: "",
  supabaseAnonKey: "",
  // maxPdfMB: أكبر كتاب يتحفظ على الجهاز (بالميجا). syncMaxPdfMB: أكبر كتاب يتزامن مع الحساب — لازم يساوي file_size_limit في
  // server/supabase.sql (50 ميجا، وده حد Supabase المجاني). الكتاب الأكبر من syncMaxPdfMB بيفضل على الجهاز بس ويتقال للمستخدم.
  maxPdfMB: 300,
  syncMaxPdfMB: 50,
  // true = إظهار الإعدادات التقنية للجميع (مفاتيح API، الذكاء المحلي، البحث بالمعنى، تفاصيل الصوت). سيبها false لموقع الطلبة.
  devSettings: false,
  // كتب جاهزة بتتحمّل أول مرة (المثال في README ← «نسخة بكتب جاهزة»): seedBooks: [{ file: "اسم_الكتاب.pdf", url: "books/اسم_الكتاب.pdf" }]
  seedBooks: []
}, window.TUTOR_CONFIG || {});

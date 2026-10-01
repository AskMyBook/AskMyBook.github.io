// صفحة الأدمن (HTML واحدة، من غير أي مكتبات برّه). بتتعرض على /admin من السيرفر نفسه.
export const ADMIN_HTML = String.raw`<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>لوحة التحكم — المدرّس</title>
<style>
:root{--bg:#f6f7fb;--card:#fff;--ink:#1b1f2a;--mute:#667085;--line:#e4e7ec;--pri:#3b5bdb;--ok:#12805c;--warn:#b54708;--bad:#c01048;--chip:#eef2ff}
@media (prefers-color-scheme:dark){:root{--bg:#0f1218;--card:#171b24;--ink:#e8eaf0;--mute:#98a2b3;--line:#283040;--pri:#7c95ff;--ok:#3ccf91;--warn:#f5a524;--bad:#ff6b8b;--chip:#1f2740}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.6 system-ui,"Segoe UI",Tahoma,sans-serif}
.wrap{max-width:900px;margin:0 auto;padding:24px 16px 80px}h1{font-size:22px;margin:0 0 4px}h2{font-size:17px;margin:0 0 12px}
.sub{color:var(--mute);margin:0 0 20px}.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px;margin-bottom:16px}
input,textarea,select{width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--ink);font:inherit}
textarea{min-height:120px;direction:rtl}input.ltr{direction:ltr;text-align:left}
button{font:inherit;border:0;border-radius:10px;padding:9px 16px;cursor:pointer;background:var(--pri);color:#fff}
button.ghost{background:transparent;color:var(--ink);border:1px solid var(--line)}button.sm{padding:5px 10px;font-size:13px}button:disabled{opacity:.5;cursor:default}
.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.grow{flex:1;min-width:180px}
.prov{border:1px solid var(--line);border-radius:12px;padding:14px;margin-bottom:10px}.prov.off{opacity:.55}
.pill{display:inline-block;padding:2px 10px;border-radius:99px;font-size:12px;background:var(--chip)}
.ok{color:var(--ok)}.warn{color:var(--warn)}.bad{color:var(--bad)}.mute{color:var(--mute);font-size:13px}
label{display:block;font-size:13px;color:var(--mute);margin:10px 0 4px}.num{width:28px;height:28px;border-radius:50%;display:inline-grid;place-items:center;background:var(--chip);font-weight:600}
.msg{padding:10px 12px;border-radius:10px;margin:10px 0;background:var(--chip)}.hide{display:none}
.steps li{margin-bottom:6px}code{background:var(--chip);padding:1px 6px;border-radius:6px;direction:ltr;display:inline-block}
.save{position:sticky;bottom:12px;display:flex;justify-content:flex-end}
</style></head><body><div class="wrap">
<h1>🎓 لوحة تحكم المدرّس</h1><p class="sub">المفاتيح بتتحفظ في حسابك على Cloudflare بس، والموقع والطلبة عمرهم ما بيشوفوها.</p>

<div id="login" class="card hide"><h2 id="lt">دخول</h2><p id="ld" class="mute"></p>
<div class="row"><input id="pw" type="password" class="grow ltr" autocomplete="current-password" placeholder="الباسورد"><button id="lb">دخول</button></div><div id="lm"></div></div>

<div id="app" class="hide">
 <div id="warn"></div>
 <div class="card"><h2>المزوّدين (بالترتيب)</h2>
  <p class="mute">السيرفر بيبدأ بالأول، ولو خلص حصته أو وقع بينط للي بعده لوحده. رتّبهم بالأسهم. اللي مفيهوش مفتاح بيتعدّى.</p>
  <div id="provs"></div></div>
 <div class="card"><h2>الموقع المسموح له يكلّم السيرفر</h2>
  <label>رابط موقعك (لو أكتر من واحد افصل بفاصلة)</label><input id="origins" class="ltr" placeholder="https://still-darkness-91d9.asserzaher210.workers.dev">
  <p class="mute" id="orignote"></p></div>
 <div class="card"><h2>الحد اليومي لكل طالب</h2><div class="row">
  <div class="grow"><label>رسايل شات في اليوم</label><input id="qchat" type="number" min="1" class="ltr" placeholder="500"></div>
  <div class="grow"><label>صور في اليوم</label><input id="qimg" type="number" min="0" class="ltr" placeholder="100"></div></div></div>
 <div class="card"><h2>شخصية المدرّس</h2><p class="mute">دي التعليمات اللي بتتبعت مع كل سؤال، لأي مزوّد.</p>
  <textarea id="persona" style="min-height:260px"></textarea>
  <div class="row" style="margin-top:8px"><button class="ghost sm" id="presetp">رجّع الشخصية الأصلية</button><span class="mute" id="pstate"></span></div></div>
 <div class="card"><h2>الاستخدام النهارده</h2><div id="usage" class="mute">—</div>
  <p class="mute">أرقام تقريبية: Cloudflare بيشغّل كذا نسخة من السيرفر وكل نسخة بتعد لوحدها.</p></div>
 <div class="card"><h2>تغيير الباسورد</h2><div class="row"><input id="npw" type="password" class="grow ltr" autocomplete="new-password" placeholder="باسورد جديد (١٠ حروف على الأقل)"><button class="ghost" id="cpw">غيّر</button></div><div id="cpm"></div></div>
 <div class="save"><button id="save">💾 حفظ كل التغييرات</button></div>
</div>
</div>
<script>
(function(){
var $=function(id){return document.getElementById(id)},T=sessionStorage.getItem("admtok")||"",S=null,ORDER=[],DIS=[],PEND={};
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function api(p,b){return fetch("/admin/api/"+p,{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+T},body:JSON.stringify(b||{})}).then(function(r){return r.json().then(function(j){if(r.status===401&&j.code==="auth"){T="";sessionStorage.removeItem("admtok");start();}if(!r.ok)throw new Error(j.error||r.status);return j})})}
function note(el,t,cls){el.innerHTML=t?'<div class="msg '+(cls||"")+'">'+esc(t)+"</div>":""}
function ago(ms){if(!ms)return"";var s=Math.round((Date.now()-ms)/1000);return s<60?"من "+s+" ثانية":s<3600?"من "+Math.round(s/60)+" دقيقة":"من "+Math.round(s/3600)+" ساعة"}
function start(){api("hello").then(function(h){
  if(T){$("login").classList.add("hide");return load()}
  $("login").classList.remove("hide");$("app").classList.add("hide");
  if(h.needSetup){$("lt").textContent="أول مرة: اختار باسورد للوحة التحكم";$("ld").textContent="احفظه كويس. محدش هيقدر يدخل هنا غيرك.";$("pw").autocomplete="new-password";$("lb").textContent="احفظ وادخل";$("lb").onclick=function(){go("setup")};
    if(!h.persistent)note($("lm"),"⚠️ لسه ماربطتش مخزن KV باسم CONFIG — من غيره الإعدادات مش هتتحفظ. ارجع لخطوات الربط.","bad")}
  else{$("lt").textContent="دخول";$("ld").textContent=h.envPassword?"الباسورد هو الـ Secret اللي اسمه ADMIN_PASSWORD.":"";$("lb").onclick=function(){go("login")}}
 }).catch(function(e){note($("lm"),e.message,"bad")})}
function go(kind){$("lb").disabled=true;api(kind,{password:$("pw").value}).then(function(j){T=j.token;sessionStorage.setItem("admtok",T);$("pw").value="";start()}).catch(function(e){note($("lm"),e.message,"bad")}).then(function(){$("lb").disabled=false})}
$("pw").addEventListener("keydown",function(e){if(e.key==="Enter")$("lb").click()});

function load(){return api("state").then(function(s){S=s;ORDER=s.order.slice();DIS=(s.vars.LLM_DISABLED||"").split(",").filter(Boolean);
  $("app").classList.remove("hide");
  var w=[];if(!s.persistent)w.push("⚠️ مخزن KV (CONFIG) مش مربوط، فأي حاجة تحفظها هتضيع. اربطه من Settings ← Bindings.");
  if(!s.chain.length)w.push("⚠️ مفيش ولا مزوّد شغال لحد دلوقتي. حط مفتاح واحد على الأقل تحت (Groq أو Gemini أسهل حاجة).");
  $("warn").innerHTML=w.map(function(x){return'<div class="msg bad">'+esc(x)+"</div>"}).join("");
  $("origins").value=s.vars.ALLOWED_ORIGINS||"";$("origins").placeholder=s.envVars.ALLOWED_ORIGINS||"https://still-darkness-91d9.asserzaher210.workers.dev";
  $("orignote").textContent=s.envVars.ALLOWED_ORIGINS?"متحط في إعدادات Cloudflare: "+s.envVars.ALLOWED_ORIGINS+" — اللي تكتبه هنا بيغلبه.":"لازم تحط رابط موقعك هنا، وإلا الموقع مش هيقدر يكلّم السيرفر.";
  $("qchat").value=s.vars.QUOTA_CHAT_PER_DAY||"";$("qimg").value=s.vars.QUOTA_IMAGES_PER_DAY||"";
  $("persona").value=s.persona.text;PEND={};$("pstate").textContent=s.persona.custom?"دي شخصية متعدّلة منك.":"دي الشخصية الأصلية.";
  var u=s.usage;$("usage").textContent=u?("رسايل شات: "+u.chat+" — صور: "+u.images+" — طلبة/أجهزة مختلفة: "+u.principals):"—";
  draw()})}
function draw(){var byId={};S.providers.forEach(function(p){byId[p.id]=p});
 $("provs").innerHTML=ORDER.map(function(id,i){var p=byId[id],off=DIS.indexOf(id)>=0,st,k=p.key;
  if(off)st='<span class="pill">متوقف منك</span>';else if(!p.configured)st='<span class="pill warn">'+(p.keyName?"مفيش مفتاح":"محتاج ربط AI")+"</span>";
  else if(p.resting)st='<span class="pill warn">في راحة '+Math.ceil(p.resting/60)+" دقيقة</span>";else st='<span class="pill ok">جاهز</span>';
  var keyBox=p.keyName?('<label>المفتاح'+(k.admin?" — محفوظ هنا: "+esc(k.admin):"")+(k.secret?" — متحط كـ Secret: "+esc(k.secret):"")+'</label><div class="row"><input class="grow ltr" type="password" autocomplete="off" data-key="'+p.keyName+'" placeholder="'+(k.admin||k.secret?"سيبه فاضي عشان يفضل زي ما هو":"الزق المفتاح هنا")+'">'+(k.admin?'<button class="ghost sm" data-del="'+p.keyName+'">امسح</button>':"")+"</div>"+'<p class="mute">تجيب المفتاح منين: <a href="'+esc(p.link)+'" target="_blank" rel="noopener">'+esc(p.link)+"</a></p>")
   :'<p class="mute">'+(p.configured?"شغال من غير مفتاح عن طريق ربط Workers AI (حد مجاني يومي).":"عشان يشتغل: Settings ← Bindings ← Add ← Workers AI، والاسم AI.")+"</p>";
  return'<div class="prov'+(off?" off":"")+'"><div class="row"><span class="num">'+(i+1)+'</span><b class="grow">'+esc(p.label)+(p.vision?' <span class="pill">بيشوف صور</span>':"")+"</b>"+st+
   '<button class="ghost sm" data-up="'+i+'" '+(i?"":"disabled")+'>▲</button><button class="ghost sm" data-dn="'+i+'" '+(i<ORDER.length-1?"":"disabled")+'>▼</button><button class="ghost sm" data-tg="'+id+'">'+(off?"شغّل":"وقّف")+"</button></div>"+
   keyBox+'<label>الموديل (سيبه فاضي = '+esc(p.defaultModel)+')</label><input class="ltr" data-model="'+id.toUpperCase()+'_MODEL" value="'+esc((S.vars[id.toUpperCase()+"_MODEL"])||"")+'" placeholder="'+esc(p.defaultModel)+'">'+
   '<div class="row" style="margin-top:10px"><button class="ghost sm" data-test="'+id+'">🔌 اختبر</button>'+(p.resting?'<button class="ghost sm" data-rest="'+id+'">جرّبه دلوقتي</button>':"")+'<span class="mute grow">النهارده: '+p.okToday+" نجح، "+p.failToday+" فشل"+(p.lastError?" — آخر خطأ "+ago(p.lastErrorAt)+": "+esc(p.lastError):"")+'</span></div><div data-out="'+id+'"></div></div>'}).join("");
 document.querySelectorAll("[data-key],[data-model]").forEach(function(x){var k=x.dataset.key||x.dataset.model;if(k in PEND)x.value=PEND[k]})}
$("provs").addEventListener("input",function(e){var x=e.target,k=x.dataset&&(x.dataset.key||x.dataset.model);if(k)PEND[k]=x.value});
$("provs").addEventListener("click",function(e){var b=e.target.closest("button");if(!b)return;var d=b.dataset,i;
 if(d.up){i=+d.up;ORDER.splice(i-1,0,ORDER.splice(i,1)[0]);draw()}else if(d.dn){i=+d.dn;ORDER.splice(i+1,0,ORDER.splice(i,1)[0]);draw()}
 else if(d.tg){i=DIS.indexOf(d.tg);if(i>=0)DIS.splice(i,1);else DIS.push(d.tg);draw()}
 else if(d.del){if(confirm("تمسح المفتاح ده؟"))api("save",{keys:(function(o){o[d.del]="__delete__";return o})({})}).then(load)}
 else if(d.rest){api("reset-rest",{id:d.rest}).then(load)}
 else if(d.test){var out=document.querySelector('[data-out="'+d.test+'"]');out.innerHTML='<div class="msg">بيجرّب… (لو لسه حاطط مفتاح جديد، احفظ الأول)</div>';
  api("test",{id:d.test}).then(function(r){out.innerHTML=r.ok?'<div class="msg ok">✅ شغال ('+r.ms+" ms، "+esc(r.model)+"): "+esc(r.reply)+"</div>":'<div class="msg bad">❌ '+esc(r.error)+"</div>"}).catch(function(x){note(out,x.message,"bad")})}});
$("presetp").onclick=function(){if(confirm("ترجع للشخصية الأصلية؟ التعديلات بتاعتك هتتمسح.")){api("save",{vars:{TEACHER_PERSONA:""}}).then(load)}};
$("save").onclick=function(){var keys={},vars={};
 document.querySelectorAll("[data-key]").forEach(function(x){if(x.value.trim())keys[x.dataset.key]=x.value.trim()});
 document.querySelectorAll("[data-model]").forEach(function(x){vars[x.dataset.model]=x.value.trim()});
 Object.keys(PEND).forEach(function(k){if(/_API_KEY$/.test(k)){if(PEND[k].trim())keys[k]=PEND[k].trim()}else vars[k]=PEND[k].trim()});
 vars.LLM_ORDER=ORDER.join(",");vars.LLM_DISABLED=DIS.join(",");vars.ALLOWED_ORIGINS=$("origins").value.trim();vars.QUOTA_CHAT_PER_DAY=$("qchat").value.trim();vars.QUOTA_IMAGES_PER_DAY=$("qimg").value.trim();
 var pv=$("persona").value;if(pv.trim()!==(S.persona.text||"").trim())vars.TEACHER_PERSONA=pv;
 $("save").disabled=true;api("save",{keys:keys,vars:vars}).then(function(){$("save").textContent="✅ اتحفظ";setTimeout(function(){$("save").textContent="💾 حفظ كل التغييرات"},2000);return load()}).catch(function(e){alert(e.message)}).then(function(){$("save").disabled=false})};
$("cpw").onclick=function(){api("password",{password:$("npw").value}).then(function(j){T=j.token;sessionStorage.setItem("admtok",T);$("npw").value="";note($("cpm"),"✅ اتغيّر","ok")}).catch(function(e){note($("cpm"),e.message,"bad")})};
start();
})();
</script></body></html>`;

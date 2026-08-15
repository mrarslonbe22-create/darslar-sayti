import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc,
  query, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';
import { paymentConfig } from './payment-config.js';

/* ============ FIREBASE INIT ============ */
let db = null;
let configOk = firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY";
if (configOk) {
  try { db = getFirestore(initializeApp(firebaseConfig)); }
  catch (e) { console.error("Firebase init xatosi:", e); configOk = false; }
}

/* ============ DATA ============ */
const SUBJECTS = [
  {key:'matematika', name:'Matematika', icon:'📐', premium:false},
  {key:'ona_tili', name:'Ona tili va adabiyot', icon:'📖', premium:false},
  {key:'tarix', name:'Tarix', icon:'🏛️', premium:false},
  {key:'fizika', name:'Fizika', icon:'⚛️', premium:true},
  {key:'kimyo', name:'Kimyo', icon:'🧪', premium:true},
  {key:'biologiya', name:'Biologiya', icon:'🧬', premium:true},
  {key:'ingliz_tili', name:'Ingliz tili', icon:'🇬🇧', premium:true},
  {key:'geografiya', name:'Geografiya', icon:'🌍', premium:true},
  {key:'informatika', name:'Informatika', icon:'💻', premium:true}
];
function subjObj(key){ return SUBJECTS.find(x=>x.key===key); }
function subjName(key){ const s = subjObj(key); return s? s.name : key; }
const DIFF_LABEL = {easy:'Oson', medium:"O'rta", hard:'Qiyin'};
const WEEK_DAYS = ['Y','D','S','Ch','P','J','Sh'];

/* ============ STATE ============ */
let profile = null;
let view = 'loading';
let ctx = {};
let authTab = 'login';

/* ============ FIRESTORE HELPERS ============ */
async function fsGetUser(phone){ const s = await getDoc(doc(db,'users',phone)); return s.exists()? s.data(): null; }
async function fsCreateUser(p){ await setDoc(doc(db,'users',p.phone), p); }
async function fsUpdateUser(phone, patch){ await updateDoc(doc(db,'users',phone), patch); }
async function fsGetLessons(subject){
  const snap = await getDocs(query(collection(db,'lessons'), where('subject','==',subject)));
  return snap.docs.map(d=>({id:d.id, ...d.data()})).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
}
async function fsAddLesson(obj){ await addDoc(collection(db,'lessons'), obj); }
async function fsGetTests(subject){
  const snap = await getDocs(query(collection(db,'tests'), where('subject','==',subject)));
  return snap.docs.map(d=>({id:d.id, ...d.data()})).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
}
async function fsGetDtmTests(){
  const snap = await getDocs(query(collection(db,'tests'), where('isDtm','==',true)));
  return snap.docs.map(d=>({id:d.id, ...d.data()})).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
}
async function fsGetTestById(testId){ const s = await getDoc(doc(db,'tests',testId)); return s.exists()? {id:s.id, ...s.data()} : null; }
async function fsAddTest(obj){ return await addDoc(collection(db,'tests'), obj); }
async function fsAddResult(obj){ await addDoc(collection(db,'results'), obj); }
async function fsGetResultsByPhone(phone){
  const snap = await getDocs(query(collection(db,'results'), where('phone','==',phone)));
  return snap.docs.map(d=>({id:d.id, ...d.data()}));
}
async function fsGetAllResults(){
  const snap = await getDocs(collection(db,'results'));
  return snap.docs.map(d=>({id:d.id, ...d.data()}));
}
async function fsAddNews(obj){ await addDoc(collection(db,'news'), obj); }
async function fsGetNews(){
  const snap = await getDocs(collection(db,'news'));
  return snap.docs.map(d=>({id:d.id, ...d.data()})).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
}
async function fsAddSubmission(obj){ await addDoc(collection(db,'submissions'), obj); }
async function fsGetSubmissionsByPhone(phone){
  const snap = await getDocs(query(collection(db,'submissions'), where('phone','==',phone)));
  return snap.docs.map(d=>({id:d.id, ...d.data()})).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
}
async function fsGetAllSubmissions(){
  const snap = await getDocs(collection(db,'submissions'));
  return snap.docs.map(d=>({id:d.id, ...d.data()})).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
}
async function fsUpdateSubmission(id, patch){ await updateDoc(doc(db,'submissions',id), patch); }
async function fsAddPayment(obj){ return await addDoc(collection(db,'payments'), obj); }

/* ============ UTIL ============ */
function escapeHtml(str){
  return (str==null?'':String(str)).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function showToast(msg){
  const el = document.createElement('div');
  el.className='toast'; el.textContent=msg;
  document.body.appendChild(el);
  setTimeout(()=>el.remove(), 2600);
}
function normPhone(p){ return p.replace(/[\s\-\(\)]/g,''); }
function isPro(){
  if(!profile) return false;
  if(!profile.isPro) return false;
  if(profile.proUntil && profile.proUntil < Date.now()) return false;
  return true;
}
function daysLeftPro(){
  if(!profile || !profile.proUntil) return 0;
  return Math.max(0, Math.ceil((profile.proUntil - Date.now())/86400000));
}

/* ============ BOOT ============ */
async function boot(){
  if(!configOk){
    document.getElementById('app').innerHTML = `
      <div class="config-warning">
        <strong>⚠️ Firebase sozlanmagan.</strong><br><br>
        Sayt ishlashi uchun <code>firebase-config.js</code> fayliga o'zingizning Firebase loyihangiz
        ma'lumotlarini kiriting. Batafsil yo'riqnoma <code>README.md</code> faylida.
      </div>`;
    return;
  }
  const savedPhone = localStorage.getItem('bilimdon_phone');
  if(savedPhone){
    try{ const u = await fsGetUser(savedPhone); if(u) profile = u; }catch(e){ console.error(e); }
  }
  view = profile ? 'home' : 'auth';
  render();
}

/* ============ BOTTOM NAV ============ */
const BOTTOM_NAV = [
  {v:'home', icon:'🏠', label:'Asosiy'},
  {v:'savolnoma', icon:'📷', label:'Savolnoma'},
  {v:'yangilik', icon:'📰', label:'Yangilik'},
  {v:'koproq', icon:'⊞', label:"Ko'proq"},
  {v:'profil', icon:'👤', label:'Profil'},
];
function topLevelOf(v){
  if(['home'].includes(v)) return 'home';
  if(['savolnoma'].includes(v)) return 'savolnoma';
  if(['yangilik'].includes(v)) return 'yangilik';
  if(['koproq','subjectsHub','lessons','lessonDetail','subjectTests','dtmList','savedTests','archive','lbToday','lbOverall','statsPage','badgesPage','ai','admin','adminLesson','adminTest','adminDtm','adminStats','adminNews','adminSubmissions'].includes(v)) return 'koproq';
  if(['profil','editProfile','premium','about'].includes(v)) return 'profil';
  return 'home';
}
function go(v, data){ ctx = data||{}; view=v; window.scrollTo(0,0); render(); }
window.go = go;

/* ============ RENDER ROOT ============ */
async function renderInner(){
  const app = document.getElementById('app');
  if(view==='loading'){ app.innerHTML = loadingHtml(); return; }
  if(view==='auth'){ app.innerHTML = authScreen(); attachAuthHandlers(); return; }
  if(view==='testTaking'){ app.innerHTML = testTakingScreen(); afterRenderHooks(); return; }

  app.innerHTML = shell();
  const body = document.getElementById('pageBody');
  body.innerHTML = loadingHtml();
  try{
    const html = await bodyFor(view);
    body.innerHTML = html;
    afterRenderHooks();
  }catch(e){
    console.error(e);
    body.innerHTML = `<div class="empty"><div class="big">⚠️</div>Xatolik: ${escapeHtml(e.message||'')}<br><span class="small-note">Firestore xavfsizlik qoidalarini tekshiring.</span></div>`;
  }
}
async function render(){
  await renderInner();
  if(view==='savolnoma') loadSubTabContent();
}
function loadingHtml(){ return '<div style="padding:60px;text-align:center;color:#66708A;">Yuklanmoqda…</div>'; }

function shell(){
  const active = topLevelOf(view);
  return `
  <div class="tg-topbar">
    <div class="tg-topbar-title">🎓 Bilimdon</div>
    <div class="tg-topbar-icons"><span>⌄</span><span>⋮</span></div>
  </div>
  <main style="padding-top:0;"><div id="pageBody"></div></main>
  <button class="fab-ai" onclick="go('ai')" title="AI maslahat">✨</button>
  <div class="bottom-nav">
    ${BOTTOM_NAV.map(n=>`
      <button class="bn-item ${active===n.v?'active':''}" onclick="go('${n.v}')">
        <span class="bn-icon">${n.icon}</span><span>${n.label}</span>
      </button>`).join('')}
  </div>
  `;
}
function doLogout(){ localStorage.removeItem('bilimdon_phone'); profile=null; authTab='login'; view='auth'; render(); }
window.doLogout = doLogout;

/* ============ ROUTER ============ */
async function bodyFor(v){
  switch(v){
    case 'home': return await homeScreen();
    case 'savolnoma': return savolnomaScreen();
    case 'yangilik': return await yangilikScreen();
    case 'koproq': return koproqScreen();
    case 'subjectsHub': return subjectsHubScreen();
    case 'lessons': return await lessonsListScreen();
    case 'lessonDetail': return await lessonDetailScreen();
    case 'dtmList': return await dtmListScreen();
    case 'savedTests': return await savedTestsScreen();
    case 'archive': return await archiveScreen();
    case 'lbToday': return await leaderboardScreen(true);
    case 'lbOverall': return await leaderboardScreen(false);
    case 'statsPage': return await statsPageScreen();
    case 'badgesPage': return await badgesPageScreen();
    case 'ai': return await aiScreen();
    case 'profil': return profilScreen();
    case 'editProfile': return editProfileScreen();
    case 'premium': return premiumScreen();
    case 'about': return aboutScreen();
    case 'admin': return adminScreen();
    case 'adminLesson': return adminLessonFormScreen();
    case 'adminTest': return adminTestFormScreen(false);
    case 'adminDtm': return adminTestFormScreen(true);
    case 'adminStats': return await adminStatsScreen();
    case 'adminNews': return adminNewsFormScreen();
    case 'adminSubmissions': return await adminSubmissionsScreen();
    default: return '<div class="empty">Sahifa topilmadi</div>';
  }
}
function afterRenderHooks(){ if(view==='testTaking' && ctx.test){ startTimer(); } }

/* ============ AUTH ============ */
function authScreen(){
  return `
  <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#6D5DF6,#8B5CF6);padding:20px;">
    <div style="background:#fff;border-radius:20px;padding:38px 34px;max-width:420px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.25);">
      <div class="brand" style="color:var(--navy);margin-bottom:4px;"><div class="mark">🎓</div> Bilimdon</div>
      <p style="color:var(--muted);margin:6px 0 18px;font-size:.92rem;">Bilim va malaka oshirish platformasi</p>
      <div class="auth-tabs">
        <button class="${authTab==='login'?'active':''}" onclick="setAuthTab('login')">Kirish</button>
        <button class="${authTab==='register'?'active':''}" onclick="setAuthTab('register')">Ro'yxatdan o'tish</button>
      </div>
      ${authTab==='login' ? loginFormHtml() : registerFormHtml()}
      <div id="authError"></div>
    </div>
  </div>`;
}
function setAuthTab(t){ authTab=t; render(); }
window.setAuthTab = setAuthTab;
function loginFormHtml(){
  return `<form id="loginForm">
    <label>Telefon raqamingiz</label><input type="tel" id="lgPhone" required placeholder="+998901234567">
    <label>Parol</label><input type="password" id="lgPass" required placeholder="Parolingiz">
    <button class="btn full" type="submit" style="margin-top:20px;">Kirish</button>
  </form>`;
}
function registerFormHtml(){
  return `<form id="registerForm">
    <label>Ismingiz</label><input type="text" id="rFirst" required placeholder="Masalan: Aziz">
    <label>Familyangiz</label><input type="text" id="rLast" required placeholder="Masalan: Karimov">
    <label>Telefon raqamingiz</label><input type="tel" id="rPhone" required placeholder="+998901234567">
    <label>Parol</label><input type="password" id="rPass" required minlength="4" placeholder="Kamida 4 ta belgi">
    <label>Siz kimsiz?</label>
    <div class="radio-row">
      <label><input type="radio" name="rRole" value="student" checked> O'quvchi</label>
      <label><input type="radio" name="rRole" value="teacher"> Ustoz</label>
    </div>
    <button class="btn full" type="submit" style="margin-top:20px;">Ro'yxatdan o'tish</button>
  </form>`;
}
function attachAuthHandlers(){
  const lf = document.getElementById('loginForm'), rf = document.getElementById('registerForm');
  if(lf) lf.onsubmit = async (e)=>{
    e.preventDefault();
    const phone = normPhone(document.getElementById('lgPhone').value.trim());
    const pass = document.getElementById('lgPass').value;
    setAuthError('');
    try{
      const u = await fsGetUser(phone);
      if(!u || u.password !== pass){ setAuthError("Telefon raqami yoki parol noto'g'ri."); return; }
      profile = u; localStorage.setItem('bilimdon_phone', phone); go('home');
    }catch(err){ setAuthError('Xatolik: '+err.message); }
  };
  if(rf) rf.onsubmit = async (e)=>{
    e.preventDefault();
    const firstName = document.getElementById('rFirst').value.trim();
    const lastName = document.getElementById('rLast').value.trim();
    const phone = normPhone(document.getElementById('rPhone').value.trim());
    const password = document.getElementById('rPass').value;
    const role = rf.querySelector('input[name=rRole]:checked').value;
    setAuthError('');
    if(!firstName||!lastName||!phone||password.length<4) return;
    try{
      if(await fsGetUser(phone)){ setAuthError("Bu raqam bilan foydalanuvchi mavjud. Kirish bo'limidan foydalaning."); return; }
      const p = {firstName,lastName,phone,password,role,isPro:false,proUntil:null,notifications:true,savedTests:[],createdAt:Date.now()};
      await fsCreateUser(p);
      profile = p; localStorage.setItem('bilimdon_phone', phone); go('home');
    }catch(err){ setAuthError('Xatolik: '+err.message); }
  };
}
function setAuthError(msg){ const el=document.getElementById('authError'); if(el) el.innerHTML = msg? `<div class="error-text">${escapeHtml(msg)}</div>`:''; }

/* ============ BADGES ============ */
function computeBadges(results){
  const badges = [];
  if(results.length>=1) badges.push({icon:'🥉', label:"Boshlang'ich qadam"});
  if(results.length>=5) badges.push({icon:'🥈', label:"Faol o'quvchi"});
  if(results.length>=15) badges.push({icon:'🥇', label:"Bardoshli o'quvchi"});
  const avg = results.length ? results.reduce((a,r)=>a+(r.score/r.total*100),0)/results.length : 0;
  if(results.length>=3 && avg>=90) badges.push({icon:'🏆', label:"A'lo o'quvchi"});
  if(results.some(r=>r.testType==='dtm' && r.score/r.total>=0.8)) badges.push({icon:'🎯', label:'DTM ustasi'});
  return badges;
}

/* ============ HOME ============ */
async function homeScreen(){
  const myResults = await fsGetResultsByPhone(profile.phone);
  const totalCorrect = myResults.reduce((a,r)=>a+r.score,0);
  const totalQ = myResults.reduce((a,r)=>a+r.total,0);
  const overallPct = totalQ? Math.round(totalCorrect/totalQ*100) : 0;
  const today = new Date();
  const todayStr = today.toISOString().slice(0,10);
  const todayResults = myResults.filter(r=> new Date(r.date).toISOString().slice(0,10)===todayStr);
  const todayPct = todayResults.length ? Math.round(todayResults.reduce((a,r)=>a+r.score/r.total*100,0)/todayResults.length) : null;

  const all = await fsGetAllResults();
  const weekAgo = Date.now()-7*86400000;
  const weekTotals = {};
  all.filter(r=>r.date>=weekAgo).forEach(r=>{
    if(!weekTotals[r.phone]) weekTotals[r.phone]={name:r.name, correct:0,total:0};
    weekTotals[r.phone].correct+=r.score; weekTotals[r.phone].total+=r.total;
  });
  const weekRanked = Object.values(weekTotals).map(u=>({...u,pct:u.total?Math.round(u.correct/u.total*100):0})).sort((a,b)=>b.pct-a.pct);
  const winner = weekRanked[0];

  const initials = ((profile.firstName||' ')[0]+(profile.lastName||' ')[0]).toUpperCase();
  const dayIdx = today.getDay();
  const dayNames = ['Yakshanba','Dushanba','Seshanba','Chorshanba','Payshanba','Juma','Shanba'];

  return `
    <div class="dash-hero">
      <div class="dash-hero-top">
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="dash-avatar">${initials}</div>
          <div>
            <div class="dash-hero-sub">Xush kelibsiz,</div>
            <div class="dash-hero-name">${escapeHtml(profile.firstName)}</div>
          </div>
        </div>
        <button class="icon-btn" onclick="go('profil')">⚙️</button>
      </div>
      <div class="stat-cards">
        <div class="stat-card"><div class="num">${myResults.length}</div><div class="lbl">test yechildi</div></div>
        <div class="stat-card"><div class="num">${totalCorrect}</div><div class="lbl">to'g'ri javob</div></div>
        <div class="stat-card"><div class="num">${overallPct}%</div><div class="lbl">umumiy natija</div></div>
      </div>
    </div>

    <div style="padding:0 4px;">
      ${!isPro() ? `
      <div class="profile-row warn" onclick="go('premium')" style="margin-bottom:18px;">
        <div class="pi">⭐</div>
        <div class="pt"><div class="t">Premium'ga o'ting</div><div class="s">Barcha fanlar, testlar va imkoniyatlarni oching</div></div>
        <div>›</div>
      </div>` : ''}

      <div class="section-heading">Bugungi test</div>
      <div class="stat-cards" style="background:transparent;">
        <div class="card" style="text-align:center;padding:14px 6px;"><div style="font-weight:800;font-size:1.2rem;">${todayResults.length? todayResults.length : '—'}</div><div class="small-note">bugun yechilgan</div></div>
        <div class="card" style="text-align:center;padding:14px 6px;"><div style="font-weight:800;font-size:1.2rem;color:var(--teal-dark);">${todayPct!==null? todayPct+'%':'—'}</div><div class="small-note">bugungi natija</div></div>
        <div class="card" style="text-align:center;padding:14px 6px;"><div style="font-weight:800;font-size:1.2rem;">${myResults.length}</div><div class="small-note">jami testlar</div></div>
      </div>

      <div class="two-col" style="margin-top:16px;">
        <div class="cal-strip">
          <div class="cal-date">${today.getDate()}-${['Yan','Fev','Mar','Apr','May','Iyun','Iyul','Avg','Sen','Okt','Noy','Dek'][today.getMonth()]}</div>
          <div class="cal-days">${WEEK_DAYS.map((d,i)=>`<div class="cal-day ${i===dayIdx?'today':''}">${d}</div>`).join('')}</div>
          <div class="cal-label">${dayNames[dayIdx]}</div>
        </div>
        <div class="winner-card">
          <div class="winner-icon">🏆</div>
          <div class="winner-title">HAFTANING G'OLIBI</div>
          <div class="winner-name">${winner? escapeHtml(winner.name) : "Hali yo'q"}</div>
          <div class="winner-pct">${winner? winner.pct+'%' : "Birinchi bo'ling!"}</div>
        </div>
      </div>

      <div class="section-heading">Fanlar</div>
      <div class="grid grid-3">
        ${SUBJECTS.map(s=>subjectCardHtml(s)).join('')}
      </div>
    </div>
  `;
}
function subjectCardHtml(s){
  const locked = s.premium && !isPro();
  return `
    <div class="card card-hover" style="position:relative;" onclick="openSubject('${s.key}')">
      ${locked? `<div class="lock-badge">🔒</div>` : ''}
      <div class="subj-icon">${s.icon}</div>
      <div style="font-weight:700;">${s.name}</div>
      ${s.premium? `<span class="premium-tag" style="margin-top:6px;">⭐ Premium</span>` : `<div class="small-note">Bepul</div>`}
    </div>`;
}
function openSubject(key){
  const s = subjObj(key);
  if(s.premium && !isPro()){ go('premium'); showToast("Bu fan premium foydalanuvchilar uchun ochiq"); return; }
  go('lessons', {subject:key});
}
window.openSubject = openSubject;

/* ============ KO'PROQ ============ */
function koproqScreen(){
  return `
    <div style="padding:4px 4px 0;">
      <h1 class="page-title">Ko'proq</h1>
      <p class="page-sub">Qo'shimcha bo'limlar</p>

      <div class="hub-group-title">Testlar</div>
      <div class="hub-grid">
        <div class="hub-item" onclick="go('subjectsHub')"><div class="hub-icon" style="background:#6D5DF6;">📚</div><div class="hub-label">Fanlar</div></div>
        <div class="hub-item" onclick="go('savedTests')"><div class="hub-icon" style="background:#F0A93B;">🚩</div><div class="hub-label">Saralangan</div></div>
        <div class="hub-item" onclick="go('archive')"><div class="hub-icon" style="background:#E0A83C;">🕘</div><div class="hub-label">Arxiv</div></div>
      </div>

      <div class="hub-group-title">Reyting</div>
      <div class="hub-grid">
        <div class="hub-item" onclick="go('lbToday')"><div class="hub-icon" style="background:#F0A93B;">🏆</div><div class="hub-label">Bugungi</div></div>
        <div class="hub-item" onclick="go('lbOverall')"><div class="hub-icon" style="background:#6D5DF6;">👑</div><div class="hub-label">Umumiy</div></div>
        <div class="hub-item" onclick="go('statsPage')"><div class="hub-icon" style="background:#1AA88F;">📈</div><div class="hub-label">Statistika</div></div>
        <div class="hub-item" onclick="go('badgesPage')"><div class="hub-icon" style="background:#E85D8A;">🎁</div><div class="hub-label">Yutuqlarim</div></div>
      </div>

      <div class="hub-group-title">Boshqa imkoniyatlar</div>
      <div class="hub-grid">
        <div class="hub-item" onclick="go('ai')"><div class="hub-icon" style="background:#8B5CF6;">✨</div><div class="hub-label">AI maslahat</div></div>
        <div class="hub-item" onclick="go('dtmList')"><div class="hub-icon" style="background:#D64545;">🎯</div><div class="hub-label">DTM testlari</div></div>
        <div class="hub-item" onclick="go('about')"><div class="hub-icon" style="background:#4C5A78;">ℹ️</div><div class="hub-label">Ma'lumotlar</div></div>
        ${profile.role==='teacher'? `<div class="hub-item" onclick="go('admin')"><div class="hub-icon" style="background:#16305C;">🛠️</div><div class="hub-label">Admin panel</div></div>` : ''}
      </div>
    </div>
  `;
}
function subjectsHubScreen(){
  return `
    <h1 class="page-title">Fanlar</h1>
    <p class="page-sub">Fan tanlang va yechishni boshlang.</p>
    <div class="grid grid-3">${SUBJECTS.map(s=>subjectCardHtml(s)).join('')}</div>
  `;
}

/* ============ LESSONS + TESTS (per subject) ============ */
async function lessonsListScreen(){
  const lessons = await fsGetLessons(ctx.subject);
  const tests = await fsGetTests(ctx.subject);
  return `
    <button class="back-link" onclick="go('koproq')">← Ortga</button>
    <h1 class="page-title">${subjName(ctx.subject)}</h1>
    <p class="page-sub">Darsliklar va testlar</p>

    <div class="section-heading" style="margin-top:0;">📚 Darsliklar (${lessons.length})</div>
    ${lessons.length? `
    <div class="grid grid-2">
      ${lessons.map(l=>`
        <div class="card card-hover" onclick="go('lessonDetail',{subject:'${ctx.subject}',lessonId:'${l.id}'})">
          <div class="badge">Darslik</div>
          <div style="font-weight:700;margin-top:8px;">${escapeHtml(l.title)}</div>
        </div>`).join('')}
    </div>` : `<div class="empty"><div class="big">📚</div>Hali darslik qo'shilmagan.</div>`}

    <div class="section-heading">📝 Testlar (${tests.length})</div>
    ${tests.length? `
    <div class="grid grid-2">
      ${tests.map(t=>`
        <div class="card card-hover" onclick="beginTest('${t.id}', false)">
          <div class="badge">${t.questions.length} ta savol</div>
          <span class="badge ${t.difficulty||'medium'}">${DIFF_LABEL[t.difficulty||'medium']}</span>
          <div style="font-weight:700;margin-top:8px;">${escapeHtml(t.title)}</div>
          <div class="small-note" style="margin-top:6px;">⏱ ${t.duration} daqiqa</div>
        </div>`).join('')}
    </div>` : `<div class="empty"><div class="big">📝</div>Hali test qo'shilmagan.</div>`}
  `;
}
async function lessonDetailScreen(){
  const lessons = await fsGetLessons(ctx.subject);
  const l = lessons.find(x=>x.id===ctx.lessonId);
  if(!l) return '<div class="empty">Darslik topilmadi</div>';
  let videoHtml = '';
  if(l.videoUrl){
    const embed = toEmbedUrl(l.videoUrl);
    videoHtml = embed ? `<div class="video-embed"><iframe src="${embed}" allowfullscreen></iframe></div>` : `<p><a href="${escapeHtml(l.videoUrl)}" target="_blank" rel="noopener">🎬 Video darsni ko'rish</a></p>`;
  }
  return `
    <button class="back-link" onclick="go('lessons',{subject:'${ctx.subject}'})">← ${subjName(ctx.subject)} ga qaytish</button>
    <div class="card">
      <div class="badge">${subjName(ctx.subject)}</div>
      <h1 class="page-title" style="margin-top:10px;">${escapeHtml(l.title)}</h1>
      ${l.imageUrl? `<div class="lesson-media"><img src="${escapeHtml(l.imageUrl)}" alt=""></div>` : ''}
      ${videoHtml}
      <div class="lesson-body">${escapeHtml(l.text)}</div>
    </div>
  `;
}
function toEmbedUrl(url){
  try{
    const u = new URL(url);
    if(u.hostname.includes('youtube.com') && u.searchParams.get('v')) return 'https://www.youtube.com/embed/'+u.searchParams.get('v');
    if(u.hostname==='youtu.be') return 'https://www.youtube.com/embed/'+u.pathname.slice(1);
  }catch(e){}
  return null;
}

/* ============ DTM ============ */
async function dtmListScreen(){
  const tests = await fsGetDtmTests();
  return `
    <button class="back-link" onclick="go('koproq')">← Ortga</button>
    <h1 class="page-title">DTM testlari</h1>
    <p class="page-sub">Davlat test markazi uslubidagi umumiy testlar.</p>
    ${tests.length? `
    <div class="grid grid-2">
      ${tests.map(t=>`
        <div class="card card-hover" onclick="beginTest('${t.id}', true)">
          <div class="badge amber">DTM</div>
          <span class="badge ${t.difficulty||'medium'}">${DIFF_LABEL[t.difficulty||'medium']}</span>
          <div style="font-weight:700;margin-top:8px;">${escapeHtml(t.title)}</div>
          <div class="small-note" style="margin-top:6px;">${t.questions.length} ta savol · ⏱ ${t.duration} daqiqa</div>
        </div>`).join('')}
    </div>` : `<div class="empty"><div class="big">🎯</div>Hali DTM testi qo'shilmagan.</div>`}
  `;
}

/* ============ SAVED / ARCHIVE ============ */
async function savedTestsScreen(){
  const saved = profile.savedTests || [];
  const tests = (await Promise.all(saved.map(id=>fsGetTestById(id)))).filter(Boolean);
  return `
    <button class="back-link" onclick="go('koproq')">← Ortga</button>
    <h1 class="page-title">Saralangan testlar</h1>
    ${tests.length? `<div class="grid grid-2">${tests.map(t=>`
      <div class="card card-hover" onclick="beginTest('${t.id}', ${!!t.isDtm})">
        <div class="badge">${t.isDtm? 'DTM' : subjName(t.subject)}</div>
        <div style="font-weight:700;margin-top:8px;">${escapeHtml(t.title)}</div>
      </div>`).join('')}</div>` : `<div class="empty"><div class="big">🚩</div>Hali hech narsa saralanmagan.</div>`}
  `;
}
async function archiveScreen(){
  const results = (await fsGetResultsByPhone(profile.phone)).sort((a,b)=>b.date-a.date);
  return `
    <button class="back-link" onclick="go('koproq')">← Ortga</button>
    <h1 class="page-title">Arxiv</h1>
    <p class="page-sub">Yechgan testlaringiz tarixi</p>
    ${results.length? results.map(r=>`
      <div class="card" style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div class="eyebrow">${r.testType==='dtm'?'DTM':subjName(r.subject)}</div>
          <div style="font-weight:700;">${escapeHtml(r.testTitle)}</div>
          <div class="small-note">${new Date(r.date).toLocaleDateString('uz-UZ')}</div>
        </div>
        <div style="font-weight:800;color:var(--teal-dark);font-size:1.1rem;">${r.score}/${r.total}</div>
      </div>`).join('') : `<div class="empty"><div class="big">🕘</div>Hali test yechilmagan.</div>`}
  `;
}

/* ============ TEST TAKING ============ */
let timerInterval = null;
function startTimer(){
  clearInterval(timerInterval);
  timerInterval = setInterval(()=>{
    if(view!=='testTaking'){ clearInterval(timerInterval); return; }
    ctx.secondsLeft--;
    const bar = document.getElementById('timerBar');
    if(bar) bar.outerHTML = timerBarHtml();
    if(ctx.secondsLeft<=0){ clearInterval(timerInterval); submitTest(); }
  },1000);
}
function timerBarHtml(){
  const m = Math.floor(Math.max(ctx.secondsLeft,0)/60), s = Math.max(ctx.secondsLeft,0)%60;
  const low = ctx.secondsLeft <= 60;
  return `<div class="timer-bar ${low?'low':''}" id="timerBar"><span>⏱ ${m}:${s.toString().padStart(2,'0')}</span><span>${ctx.answers.filter(a=>a!==null).length}/${ctx.test.questions.length} javob</span></div>`;
}
async function beginTest(testId, isDtm){
  const t = await fsGetTestById(testId);
  if(!t) return;
  ctx = {subject:t.subject, test:t, isDtm, answers:new Array(t.questions.length).fill(null), secondsLeft:t.duration*60};
  view='testTaking'; render();
}
window.beginTest = beginTest;
function testTakingScreen(){
  const t = ctx.test;
  const saved = (profile.savedTests||[]).includes(t.id);
  return `
  <div style="max-width:1180px;margin:0 auto;padding:18px 16px 90px;">
    ${timerBarHtml()}
    <div class="flex-between">
      <h1 class="page-title" style="margin:0;">${escapeHtml(t.title)}</h1>
      <button class="btn-sm btn ghost" onclick="toggleSaveTest('${t.id}')">${saved? '🚩 Saralangan':'🏳️ Saralash'}</button>
    </div>
    <p class="page-sub">Har bir savolda 3 ta javobdan bittasini tanlang.</p>
    ${t.questions.map((q,qi)=>`
      <div class="card q-card">
        <div class="q-num">Savol ${qi+1} / ${t.questions.length}</div>
        <div style="font-weight:700;margin-bottom:4px;">${escapeHtml(q.question)}</div>
        ${q.options.map((opt,oi)=>`
          <div class="opt ${ctx.answers[qi]===oi?'selected':''}" onclick="selectAnswer(${qi},${oi})">
            <input type="radio" ${ctx.answers[qi]===oi?'checked':''} readonly><span>${escapeHtml(opt)}</span>
          </div>`).join('')}
      </div>`).join('')}
    <button class="btn" style="margin-top:10px;" onclick="submitTest()">Testni yakunlash</button>
  </div>`;
}
async function toggleSaveTest(testId){
  const saved = profile.savedTests || [];
  const idx = saved.indexOf(testId);
  if(idx>=0) saved.splice(idx,1); else saved.push(testId);
  profile.savedTests = saved;
  try{ await fsUpdateUser(profile.phone, {savedTests:saved}); }catch(e){}
  render();
}
window.toggleSaveTest = toggleSaveTest;
function selectAnswer(qi, oi){ ctx.answers[qi]=oi; render(); }
window.selectAnswer = selectAnswer;
async function submitTest(){
  clearInterval(timerInterval);
  const t = ctx.test;
  let score = 0;
  t.questions.forEach((q,qi)=>{ if(ctx.answers[qi]===q.correct) score++; });
  const result = {
    phone: profile.phone, name: profile.firstName+' '+profile.lastName,
    testId:t.id, testTitle:t.title, subject: ctx.isDtm? 'dtm' : ctx.subject,
    testType: ctx.isDtm?'dtm':'subject', score, total:t.questions.length,
    answers: ctx.answers, date:Date.now()
  };
  try{ await fsAddResult(result); }catch(e){ console.error(e); }
  ctx.result = result; view = 'testResult'; render();
}
window.submitTest = submitTest;
function testResultScreen(){
  const r = ctx.result, t = ctx.test;
  const pct = Math.round(r.score/r.total*100);
  return `
    <div class="card result-box">
      <div class="eyebrow">${escapeHtml(t.title)}</div>
      <div class="result-score">${r.score}/${r.total}</div>
      <p style="color:var(--muted);">Natija: ${pct}%</p>
      <div style="display:flex;gap:10px;justify-content:center;margin-top:18px;flex-wrap:wrap;">
        <button class="btn ghost" onclick="reviewTest()">Javoblarni ko'rish</button>
        <button class="btn" onclick="go('lbOverall')">Reytingni ko'rish</button>
        <button class="btn secondary" onclick="go('home')">Bosh sahifaga</button>
      </div>
    </div>
    <div id="reviewArea"></div>
  `;
}
function reviewTest(){
  const t = ctx.test;
  document.getElementById('reviewArea').innerHTML = t.questions.map((q,qi)=>`
    <div class="card q-card">
      <div class="q-num">Savol ${qi+1}</div>
      <div style="font-weight:700;margin-bottom:4px;">${escapeHtml(q.question)}</div>
      ${q.options.map((opt,oi)=>{
        let cls = oi===q.correct?'correct':(oi===ctx.answers[qi]?'wrong':'');
        return `<div class="opt ${cls}"><span>${oi===q.correct?'✓':(oi===ctx.answers[qi]?'✗':'')} ${escapeHtml(opt)}</span></div>`;
      }).join('')}
    </div>`).join('');
}
window.reviewTest = reviewTest;

/* ============ LEADERBOARD ============ */
async function leaderboardScreen(todayOnly){
  const all = await fsGetAllResults();
  const cutoff = todayOnly ? new Date().setHours(0,0,0,0) : 0;
  const filtered = all.filter(r=>r.date>=cutoff);
  const totals = {};
  filtered.forEach(r=>{
    if(!totals[r.phone]) totals[r.phone] = {name:r.name, correct:0, total:0, tests:0};
    totals[r.phone].correct += r.score; totals[r.phone].total += r.total; totals[r.phone].tests += 1;
  });
  const rows = Object.values(totals).map(u=>({...u, pct: u.total? Math.round(u.correct/u.total*100):0})).sort((a,b)=> b.pct-a.pct || b.tests-a.tests);
  return `
    <button class="back-link" onclick="go('koproq')">← Ortga</button>
    <h1 class="page-title">${todayOnly? "Bugungi reyting" : "Umumiy reyting"}</h1>
    ${rows.length? rows.map((u,i)=>`
      <div class="lb-row">
        <div class="lb-rank ${i===0?'top1':i===1?'top2':i===2?'top3':''}">${i+1}</div>
        <div class="lb-name">${escapeHtml(u.name)} <span class="small-note">· ${u.tests} ta test</span></div>
        <div class="lb-score">${u.pct}%</div>
      </div>`).join('') : `<div class="empty"><div class="big">🏆</div>Hali hech kim test yechmagan.</div>`}
  `;
}

/* ============ STATS / BADGES ============ */
async function statsPageScreen(){
  const results = await fsGetResultsByPhone(profile.phone);
  const bySubj = {};
  results.forEach(r=>{
    const key = r.subject;
    if(!bySubj[key]) bySubj[key] = {correct:0,total:0,count:0};
    bySubj[key].correct += r.score; bySubj[key].total += r.total; bySubj[key].count++;
  });
  const rows = Object.entries(bySubj).map(([k,v])=>({subject:k, pct: Math.round(v.correct/v.total*100), count:v.count}));
  return `
    <button class="back-link" onclick="go('koproq')">← Ortga</button>
    <h1 class="page-title">Statistika</h1>
    ${rows.length? `
    <table class="stat-table">
      <thead><tr><th>Fan</th><th>Testlar</th><th>Natija</th></tr></thead>
      <tbody>${rows.map(r=>`<tr><td>${r.subject==='dtm'?'DTM':subjName(r.subject)}</td><td>${r.count}</td><td>${r.pct}%</td></tr>`).join('')}</tbody>
    </table>` : `<div class="empty"><div class="big">📈</div>Fanlar bo'yicha ko'rsatkichlar siz test yechganingizdan so'ng shu yerda paydo bo'ladi.</div>`}
  `;
}
async function badgesPageScreen(){
  const results = await fsGetResultsByPhone(profile.phone);
  const badges = computeBadges(results);
  return `
    <button class="back-link" onclick="go('koproq')">← Ortga</button>
    <h1 class="page-title">Yutuqlarim</h1>
    ${badges.length? `<div class="grid grid-2">${badges.map(b=>`
      <div class="card" style="text-align:center;padding:24px;">
        <div style="font-size:2.4rem;margin-bottom:8px;">${b.icon}</div>
        <div style="font-weight:700;">${b.label}</div>
      </div>`).join('')}</div>` : `<div class="empty"><div class="big">🎁</div>Testlar yechib, yutuqlar to'plang!</div>`}
  `;
}

/* ============ AI MASLAHAT ============ */
async function aiScreen(){
  const myResults = await fsGetResultsByPhone(profile.phone);
  const summary = myResults.length
    ? myResults.map(r=>`${r.testType==='dtm'?'DTM':subjName(r.subject)}: ${r.score}/${r.total}`).join(', ')
    : "Hali test natijalari yo'q";
  return `
    <button class="back-link" onclick="go('koproq')">← Ortga</button>
    <h1 class="page-title">AI maslahat</h1>
    <p class="page-sub">Shaxsiy o'quv tavsiyalarini oling.</p>
    <div class="card">
      <label>Nima haqida maslahat kerak? (ixtiyoriy)</label>
      <textarea id="aiQuestion" placeholder="Masalan: Matematikadan integral mavzusini tushunmayapman..."></textarea>
      <div class="small-note">Natijalaringiz: ${escapeHtml(summary)}</div>
      <button class="btn" style="margin-top:14px;" onclick="askAI()" id="aiBtn">Maslahat olish</button>
    </div>
    <div id="aiAnswerWrap" style="margin-top:18px;"></div>
  `;
}
async function askAI(){
  const btn = document.getElementById('aiBtn'), wrap = document.getElementById('aiAnswerWrap');
  const question = document.getElementById('aiQuestion').value.trim();
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Tahlil qilinmoqda…'; wrap.innerHTML='';
  const myResults = await fsGetResultsByPhone(profile.phone);
  const resSummary = myResults.length
    ? myResults.map(r=>`${r.testType==='dtm'?'DTM':subjName(r.subject)} testi: ${r.score}/${r.total}`).join('; ')
    : "Foydalanuvchi hali hech qanday test yechmagan.";
  try{
    const response = await fetch("/api/ai-advice", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ firstName: profile.firstName, lastName: profile.lastName, resultsSummary: resSummary, question })
    });
    if(!response.ok) throw new Error('backend sozlanmagan');
    const data = await response.json();
    wrap.innerHTML = `<div class="ai-msg">${escapeHtml(data.text||'')}</div>`;
  }catch(e){
    wrap.innerHTML = `<div class="ai-msg">AI maslahat xizmati hozircha ulanmagan. README.md dagi "AI maslahat" bo'limiga qarang.</div>`;
  }
  btn.disabled = false; btn.textContent = 'Maslahat olish';
}
window.askAI = askAI;

/* ============ PROFIL ============ */
function profilScreen(){
  const initials = ((profile.firstName||' ')[0]+(profile.lastName||' ')[0]).toUpperCase();
  return `
    <div class="profile-hero">
      <div class="profile-avatar-lg">${initials}</div>
      <div style="font-weight:800;font-size:1.2rem;">${escapeHtml(profile.firstName)} ${escapeHtml(profile.lastName)}</div>
      <div style="opacity:.85;font-size:.9rem;">${escapeHtml(profile.phone)}</div>
      ${isPro()? `<div class="premium-tag" style="margin-top:10px;">⭐ Premium · ${daysLeftPro()} kun qoldi</div>` : ''}
    </div>
    <div style="padding:18px 16px 0;">
      ${!isPro() ? `
      <div class="profile-row warn" onclick="go('premium')">
        <div class="pi">⭐</div><div class="pt"><div class="t">Premium'ga o'ting</div><div class="s">Barcha fanlarni oching</div></div><div>›</div>
      </div>` : `
      <div class="profile-row" onclick="go('premium')">
        <div class="pi">💳</div><div class="pt"><div class="t">Obunani boshqarish</div><div class="s">${daysLeftPro()} kun qoldi</div></div><div>›</div>
      </div>`}

      <div class="profile-row" onclick="go('editProfile')">
        <div class="pi">✏️</div><div class="pt"><div class="t">Shaxsiy ma'lumotlar</div><div class="s">Ism va telefon raqamni tahrirlash</div></div><div>›</div>
      </div>
      <div class="profile-row">
        <div class="pi">🔔</div><div class="pt"><div class="t">Bildirishnomalar</div><div class="s">${profile.notifications!==false? 'Yoqilgan':"O'chirilgan"}</div></div>
        <div class="toggle-switch ${profile.notifications!==false?'on':''}" onclick="toggleNotif(event)"><div class="knob"></div></div>
      </div>
      ${profile.role==='teacher'? `
      <div class="profile-row" onclick="go('admin')">
        <div class="pi">🛠️</div><div class="pt"><div class="t">Admin panel</div><div class="s">Darslik, test va yangiliklar</div></div><div>›</div>
      </div>` : ''}
      <div class="profile-row" onclick="go('about')">
        <div class="pi">ℹ️</div><div class="pt"><div class="t">Ilova haqida</div><div class="s">Versiya va aloqa</div></div><div>›</div>
      </div>
      <button class="btn danger full" style="margin-top:20px;" onclick="doLogout()">Chiqish</button>
    </div>
  `;
}
async function toggleNotif(e){
  e.stopPropagation();
  profile.notifications = profile.notifications===false ? true : false;
  try{ await fsUpdateUser(profile.phone, {notifications: profile.notifications}); }catch(err){}
  render();
}
window.toggleNotif = toggleNotif;

function editProfileScreen(){
  return `
    <button class="back-link" onclick="go('profil')">← Ortga</button>
    <h1 class="page-title">Shaxsiy ma'lumotlar</h1>
    <div class="card">
      <form id="editForm">
        <label>Ism</label><input type="text" id="eFirst" value="${escapeHtml(profile.firstName)}" required>
        <label>Familiya</label><input type="text" id="eLast" value="${escapeHtml(profile.lastName)}" required>
        <button class="btn full" type="submit" style="margin-top:20px;">Saqlash</button>
      </form>
    </div>
  `;
}
document.addEventListener('submit', async (e)=>{
  if(e.target && e.target.id==='editForm'){
    e.preventDefault();
    const firstName = document.getElementById('eFirst').value.trim();
    const lastName = document.getElementById('eLast').value.trim();
    if(!firstName||!lastName) return;
    profile.firstName=firstName; profile.lastName=lastName;
    try{ await fsUpdateUser(profile.phone, {firstName, lastName}); showToast('Saqlandi ✅'); }catch(err){ showToast('Xatolik'); }
    go('profil');
  }
});

function aboutScreen(){
  return `
    <button class="back-link" onclick="go('profil')">← Ortga</button>
    <h1 class="page-title">Ilova haqida</h1>
    <div class="card">
      <p><strong>Bilimdon</strong> — bilim va malaka oshirish platformasi.</p>
      <p class="small-note">Versiya 2.0</p>
      <p>Savol yoki takliflar bo'lsa, admin bilan bog'laning.</p>
    </div>
  `;
}

/* ============ PREMIUM / TO'LOV ============ */
function premiumScreen(){
  const plans = paymentConfig.plans;
  return `
    <button class="back-link" onclick="go('profil')">← Ortga</button>
    <h1 class="page-title">Premium obuna</h1>
    <p class="page-sub">Barcha fanlar, testlar va cheklovsiz imkoniyatlarni oching.</p>
    ${isPro()? `<div class="card" style="text-align:center;margin-bottom:20px;background:#EAF6F3;border-color:#bfe8de;">⭐ Sizda faol Premium obuna bor — ${daysLeftPro()} kun qoldi.</div>` : ''}
    <div class="grid grid-2">
      ${plans.map((p,i)=>`
        <div class="plan-card ${i===1?'best':''}" onclick="selectPlan('${p.id}')">
          ${i===1? `<div class="best-tag">Mashhur</div>`:''}
          <div style="font-weight:700;">${p.label}</div>
          <div class="plan-price">${p.price.toLocaleString('ru-RU')} so'm</div>
          <div class="small-note">${p.days} kun amal qiladi</div>
        </div>`).join('')}
    </div>
    <div id="planPayWrap"></div>
    <p class="small-note" style="margin-top:16px;">To'lovdan so'ng obunangiz avtomatik faollashadi (bir necha daqiqa vaqt olishi mumkin).</p>
  `;
}
function selectPlan(planId){
  const plan = paymentConfig.plans.find(p=>p.id===planId);
  const wrap = document.getElementById('planPayWrap');
  wrap.innerHTML = `
    <div class="card" style="margin-top:16px;">
      <div><strong>${plan.label}</strong> — ${plan.price.toLocaleString('ru-RU')} so'm</div>
      <div class="pay-btn-row">
        <button class="pay-btn click" onclick="payWith('click','${plan.id}')">🔵 Click orqali</button>
        <button class="pay-btn payme" onclick="payWith('payme','${plan.id}')">🟢 Payme orqali</button>
      </div>
    </div>
  `;
}
window.selectPlan = selectPlan;
function paymentIsPlaceholder(provider){
  if(provider==='click') return paymentConfig.click.merchantId.startsWith('YOUR_');
  return paymentConfig.payme.merchantId.startsWith('YOUR_');
}
async function payWith(provider, planId){
  const plan = paymentConfig.plans.find(p=>p.id===planId);
  try{
    const paymentRef = await fsAddPayment({
      phone: profile.phone, planId, amount: plan.price, days: plan.days,
      provider, status:'pending', createdAt: Date.now()
    });
    const orderId = paymentRef.id;
    let url = '';
    if(provider==='click'){
      const c = paymentConfig.click;
      url = `https://my.click.uz/services/pay?service_id=${c.serviceId}&merchant_id=${c.merchantId}&amount=${plan.price}&transaction_param=${orderId}&return_url=${encodeURIComponent(c.returnUrl)}`;
    }else{
      const c = paymentConfig.payme;
      const params = `m=${c.merchantId};ac.order_id=${orderId};a=${plan.price*100}`;
      url = `https://checkout.paycom.uz/${btoa(params)}`;
    }
    if(paymentIsPlaceholder(provider)){
      showToast("Bu — demo havola. Merchant ID'larni payment-config.js ga kiriting.");
    }
    window.open(url, '_blank');
  }catch(e){ showToast('Xatolik: '+e.message); }
}
window.payWith = payWith;

/* ============ SAVOLNOMA ============ */
function savolnomaScreen(){
  ctx.subTab = ctx.subTab || 'yuborish';
  return `
    <h1 class="page-title" style="padding:0 4px;">Savolnoma</h1>
    <p class="page-sub" style="padding:0 4px;">Qog'ozga qo'lda yozgan javoblaringizni rasmga olib yuboring — admin tekshirib baholaydi.</p>
    <div class="sub-tabs">
      <button class="${ctx.subTab==='yuborish'?'active':''}" onclick="setSubTab('yuborish')">Yuborish</button>
      <button class="${ctx.subTab==='arxiv'?'active':''}" onclick="setSubTab('arxiv')">Arxiv</button>
    </div>
    <div id="subContent"></div>
  `;
}
function setSubTab(t){ ctx.subTab=t; render(); }
window.setSubTab = setSubTab;
async function loadSubTabContent(){
  const el = document.getElementById('subContent');
  if(!el) return;
  if(ctx.subTab==='yuborish'){
    el.innerHTML = `
      <div class="card">
        <label>Fan</label>
        <select id="sSubject">${SUBJECTS.map(s=>`<option value="${s.key}">${s.name}</option>`).join('')}</select>
        <label>Izoh (ixtiyoriy)</label>
        <input type="text" id="sNote" placeholder="Masalan: 12-dars, 3-mashq">
        <label>Savolnoma rasmi</label>
        <div class="upload-drop" onclick="document.getElementById('sFile').click()">📷 Galereyadan rasm yuklash</div>
        <input type="file" id="sFile" accept="image/*" style="display:none;">
        <img id="sPreview" class="submission-thumb" style="display:none;">
        <button class="btn full" style="margin-top:16px;" id="sSendBtn" onclick="sendSubmission()">✈️ Yuborish</button>
      </div>
    `;
  }else{
    el.innerHTML = loadingHtml();
    const subs = await fsGetSubmissionsByPhone(profile.phone);
    el.innerHTML = subs.length? subs.map(s=>`
      <div class="card" style="margin-bottom:10px;">
        <div class="flex-between" style="margin-bottom:6px;">
          <span class="badge">${subjName(s.subject)}</span>
          <span class="status-pill ${s.status}">${s.status==='pending'?'Tekshirilmoqda':s.status==='approved'?'Qabul qilindi':'Rad etildi'}</span>
        </div>
        ${s.note? `<div class="small-note">${escapeHtml(s.note)}</div>`:''}
        ${s.imageData? `<img src="${s.imageData}" class="submission-thumb">`:''}
        ${s.feedback? `<div class="small-note" style="margin-top:8px;">Admin izohi: ${escapeHtml(s.feedback)}</div>`:''}
      </div>`).join('') : `<div class="empty"><div class="big">📷</div>Hali hech narsa yuborilmagan.</div>`;
  }
}
document.addEventListener('change', (e)=>{
  if(e.target && e.target.id==='sFile'){
    const f = e.target.files[0]; if(!f) return;
    compressImage(f, 900, 0.72).then(dataUrl=>{
      ctx.pendingImage = dataUrl;
      const prev = document.getElementById('sPreview');
      prev.src = dataUrl; prev.style.display='block';
    });
  }
});
function compressImage(file, maxWidth, quality){
  return new Promise((resolve,reject)=>{
    const img = new Image();
    const reader = new FileReader();
    reader.onload = ()=>{
      img.onload = ()=>{
        const scale = Math.min(1, maxWidth/img.width);
        const canvas = document.createElement('canvas');
        canvas.width = img.width*scale; canvas.height = img.height*scale;
        canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
async function sendSubmission(){
  const subject = document.getElementById('sSubject').value;
  const note = document.getElementById('sNote').value.trim();
  if(!ctx.pendingImage){ showToast('Rasm tanlang'); return; }
  const btn = document.getElementById('sSendBtn');
  btn.disabled = true; btn.textContent = 'Yuborilmoqda…';
  try{
    await fsAddSubmission({
      phone: profile.phone, name: profile.firstName+' '+profile.lastName,
      subject, note, imageData: ctx.pendingImage, status:'pending', createdAt: Date.now()
    });
    showToast('Yuborildi ✅ Admin tekshiradi');
    ctx.pendingImage = null; ctx.subTab='arxiv';
    render();
  }catch(e){ showToast('Xatolik: '+e.message); btn.disabled=false; btn.textContent='✈️ Yuborish'; }
}
window.sendSubmission = sendSubmission;

/* ============ YANGILIK ============ */
async function yangilikScreen(){
  const news = await fsGetNews();
  return `
    <h1 class="page-title" style="padding:0 4px;">Yangiliklar</h1>
    <p class="page-sub" style="padding:0 4px;">DTM va ta'lim yangiliklari</p>
    ${news.length? news.map(n=>`
      <div class="news-card">
        <span class="news-cat ${n.category==='elon'?'elon':''}">${n.category==='elon'?"E'lon":'Fanlar'}</span>
        <div class="news-title">${escapeHtml(n.title)}</div>
        <div class="news-body">${escapeHtml(n.body)}</div>
        <div class="news-meta"><span>${new Date(n.createdAt).toLocaleDateString('uz-UZ')}</span><span>👁 ${n.views||0} kishi ko'rdi</span></div>
      </div>`).join('') : `<div class="empty"><div class="big">📰</div>Hali yangilik yo'q.</div>`}
  `;
}

/* ============ ADMIN ============ */
function adminScreen(){
  if(profile.role!=='teacher') return `<div class="empty"><div class="big">🔒</div>Bu bo'lim faqat ustozlar uchun.</div>`;
  return `
    <button class="back-link" onclick="go('koproq')">← Ortga</button>
    <h1 class="page-title">Admin panel</h1>
    <div class="grid grid-3">
      <div class="card card-hover" onclick="go('adminLesson')"><div class="subj-icon">📚</div><div style="font-weight:700;">Darslik qo'shish</div></div>
      <div class="card card-hover" onclick="go('adminTest')"><div class="subj-icon">📝</div><div style="font-weight:700;">Fan testi qo'shish</div></div>
      <div class="card card-hover" onclick="go('adminDtm')"><div class="subj-icon">🎯</div><div style="font-weight:700;">DTM testi qo'shish</div></div>
      <div class="card card-hover" onclick="go('adminNews')"><div class="subj-icon">📰</div><div style="font-weight:700;">Yangilik qo'shish</div></div>
      <div class="card card-hover" onclick="go('adminSubmissions')"><div class="subj-icon">📷</div><div style="font-weight:700;">Savolnomalarni tekshirish</div></div>
      <div class="card card-hover" onclick="go('adminStats')"><div class="subj-icon">📊</div><div style="font-weight:700;">Testlar statistikasi</div></div>
    </div>
  `;
}
function adminLessonFormScreen(){
  return `
    <button class="back-link" onclick="go('admin')">← Ortga</button>
    <h1 class="page-title">Yangi darslik qo'shish</h1>
    <div class="card">
      <form id="lessonForm">
        <label>Fan</label><select id="lFanKey">${SUBJECTS.map(s=>`<option value="${s.key}">${s.name}</option>`).join('')}</select>
        <label>Darslik nomi</label><input type="text" id="lTitle" required>
        <label>Matn</label><textarea id="lText" rows="6"></textarea>
        <label>Video havolasi (YouTube)</label><input type="url" id="lVideo">
        <label>Rasm havolasi</label><input type="url" id="lImageUrl">
        <button class="btn full" type="submit" style="margin-top:20px;">Saqlash</button>
      </form>
    </div>`;
}
function adminTestFormScreen(isDtm){
  if(!ctx.questions || ctx._formIsDtm!==isDtm){ ctx.questions=[emptyQuestion()]; ctx._formIsDtm=isDtm; }
  return `
    <button class="back-link" onclick="go('admin')">← Ortga</button>
    <h1 class="page-title">${isDtm? "Yangi DTM testi" : "Yangi fan testi"}</h1>
    <div class="card">
      ${isDtm? '' : `<label>Fan</label><select id="tFanKey">${SUBJECTS.map(s=>`<option value="${s.key}">${s.name}</option>`).join('')}</select>`}
      <label>Test nomi</label><input type="text" id="tTitle">
      <label>Qiyinlik darajasi</label>
      <select id="tDifficulty"><option value="easy">Oson</option><option value="medium" selected>O'rta</option><option value="hard">Qiyin</option></select>
      <label>Davomiyligi (daqiqa)</label><input type="number" id="tDuration" value="${isDtm?45:30}" min="1">
      <div id="questionsWrap">${ctx.questions.map((q,i)=>questionEditorHtml(q,i)).join('')}</div>
      <button type="button" class="btn ghost full" style="margin-top:10px;" onclick="addQuestion()">+ Savol qo'shish</button>
      <button class="btn full" style="margin-top:16px;" onclick="saveTest(${isDtm})">Testni saqlash</button>
    </div>`;
}
function emptyQuestion(){ return {question:'', options:['','',''], correct:0}; }
function questionEditorHtml(q,i){
  return `<div class="q-editor" data-qi="${i}">
    <div class="flex-between" style="margin-bottom:0;"><strong>Savol ${i+1}</strong>${i>0?`<button type="button" class="btn ghost btn-sm" onclick="removeQuestion(${i})">O'chirish</button>`:''}</div>
    <label>Savol matni</label><input type="text" class="qText" value="${escapeHtml(q.question)}">
    <label>Javob variantlari</label>
    ${[0,1,2].map(oi=>`<div class="radio-row" style="margin-top:8px;">
      <input type="radio" name="correct${i}" value="${oi}" ${q.correct===oi?'checked':''}>
      <input type="text" class="qOpt" data-oi="${oi}" value="${escapeHtml(q.options[oi])}" placeholder="Variant ${oi+1}" style="flex:1;">
    </div>`).join('')}
  </div>`;
}
function addQuestion(){ syncQuestionsFromDom(); ctx.questions.push(emptyQuestion()); render(); }
window.addQuestion = addQuestion;
function removeQuestion(i){ syncQuestionsFromDom(); ctx.questions.splice(i,1); render(); }
window.removeQuestion = removeQuestion;
function syncQuestionsFromDom(){
  document.querySelectorAll('.q-editor').forEach(ed=>{
    const i = parseInt(ed.dataset.qi);
    const qText = ed.querySelector('.qText').value;
    const opts = Array.from(ed.querySelectorAll('.qOpt')).map(inp=>inp.value);
    const ci = ed.querySelector('input[type=radio]:checked');
    ctx.questions[i] = {question:qText, options:opts, correct: ci?parseInt(ci.value):0};
  });
}
async function saveTest(isDtm){
  syncQuestionsFromDom();
  const title = document.getElementById('tTitle').value.trim();
  const duration = parseInt(document.getElementById('tDuration').value) || (isDtm?45:30);
  const difficulty = document.getElementById('tDifficulty').value;
  const subject = isDtm? 'dtm' : document.getElementById('tFanKey').value;
  const questions = ctx.questions.filter(q=>q.question.trim() && q.options.every(o=>o.trim()));
  if(!title || !questions.length){ showToast("Test nomi va kamida bitta to'liq savol kiriting"); return; }
  try{
    await fsAddTest({subject, isDtm:!!isDtm, title, duration, difficulty, questions, createdAt:Date.now(), createdBy:profile.phone});
    showToast('Test saqlandi ✅'); ctx={}; go('admin');
  }catch(e){ showToast('Xatolik: '+e.message); }
}
window.saveTest = saveTest;

function adminNewsFormScreen(){
  return `
    <button class="back-link" onclick="go('admin')">← Ortga</button>
    <h1 class="page-title">Yangilik qo'shish</h1>
    <div class="card">
      <form id="newsForm">
        <label>Turkum</label><select id="nCat"><option value="fanlar">Fanlar</option><option value="elon">E'lon</option></select>
        <label>Sarlavha</label><input type="text" id="nTitle" required>
        <label>Matn</label><textarea id="nBody" rows="5" required></textarea>
        <button class="btn full" type="submit" style="margin-top:20px;">E'lon qilish</button>
      </form>
    </div>`;
}
document.addEventListener('submit', async (e)=>{
  if(e.target && e.target.id==='newsForm'){
    e.preventDefault();
    const category = document.getElementById('nCat').value;
    const title = document.getElementById('nTitle').value.trim();
    const body = document.getElementById('nBody').value.trim();
    if(!title||!body) return;
    try{ await fsAddNews({category,title,body,views:0,createdAt:Date.now(),createdBy:profile.phone}); showToast("E'lon qilindi ✅"); go('admin'); }
    catch(err){ showToast('Xatolik: '+err.message); }
  }
  if(e.target && e.target.id==='lessonForm'){
    e.preventDefault();
    const subject = document.getElementById('lFanKey').value;
    const title = document.getElementById('lTitle').value.trim();
    const text = document.getElementById('lText').value.trim();
    const videoUrl = document.getElementById('lVideo').value.trim();
    const imageUrl = document.getElementById('lImageUrl').value.trim();
    if(!title){ showToast('Darslik nomini kiriting'); return; }
    try{ await fsAddLesson({subject,title,text,videoUrl,imageUrl,createdAt:Date.now(),createdBy:profile.phone}); showToast('Darslik saqlandi ✅'); go('admin'); }
    catch(err){ showToast('Xatolik: '+err.message); }
  }
});

async function adminSubmissionsScreen(){
  const subs = (await fsGetAllSubmissions()).filter(s=>s.status==='pending');
  return `
    <button class="back-link" onclick="go('admin')">← Ortga</button>
    <h1 class="page-title">Savolnomalarni tekshirish</h1>
    <p class="page-sub">${subs.length} ta tekshirilishi kerak</p>
    ${subs.length? subs.map(s=>`
      <div class="card" style="margin-bottom:14px;">
        <div class="flex-between" style="margin-bottom:6px;">
          <strong>${escapeHtml(s.name)}</strong><span class="badge">${subjName(s.subject)}</span>
        </div>
        ${s.note? `<div class="small-note">${escapeHtml(s.note)}</div>`:''}
        <img src="${s.imageData}" class="submission-thumb">
        <div style="display:flex;gap:10px;margin-top:12px;">
          <button class="btn btn-sm" onclick="reviewSubmission('${s.id}','approved')">✅ Qabul qilish</button>
          <button class="btn ghost btn-sm" onclick="reviewSubmission('${s.id}','rejected')">❌ Rad etish</button>
        </div>
      </div>`).join('') : `<div class="empty"><div class="big">✅</div>Hammasi tekshirilgan.</div>`}
  `;
}
async function reviewSubmission(id, status){
  try{ await fsUpdateSubmission(id, {status, reviewedAt:Date.now()}); showToast('Yangilandi'); go('adminSubmissions'); }
  catch(e){ showToast('Xatolik: '+e.message); }
}
window.reviewSubmission = reviewSubmission;

async function adminStatsScreen(){
  if(profile.role!=='teacher') return `<div class="empty">Bu bo'lim faqat ustozlar uchun.</div>`;
  const allResults = await fsGetAllResults();
  const subjTests = await Promise.all(SUBJECTS.map(s=>fsGetTests(s.key)));
  const dtmTests = await fsGetDtmTests();
  const allTests = [...subjTests.flat(), ...dtmTests];
  const bySubject = {};
  allTests.forEach(t=>{
    const rs = allResults.filter(r=>r.testId===t.id);
    if(!rs.length) return;
    const avg = Math.round(rs.reduce((a,r)=>a+(r.score/r.total*100),0)/rs.length);
    bySubject[t.id] = {title:t.title, subject:t.isDtm?'DTM':subjName(t.subject), count:rs.length, avg};
  });
  const rows = Object.values(bySubject).sort((a,b)=>b.count-a.count);
  return `
    <button class="back-link" onclick="go('admin')">← Ortga</button>
    <h1 class="page-title">Testlar statistikasi</h1>
    ${rows.length? `<table class="stat-table"><thead><tr><th>Test</th><th>Fan</th><th>Yechganlar</th><th>O'rtacha</th></tr></thead>
    <tbody>${rows.map(r=>`<tr><td>${escapeHtml(r.title)}</td><td>${escapeHtml(r.subject)}</td><td>${r.count}</td><td>${r.avg}%</td></tr>`).join('')}</tbody></table>`
    : `<div class="empty"><div class="big">📊</div>Hali hech kim test yechmagan.</div>`}
  `;
}

boot();

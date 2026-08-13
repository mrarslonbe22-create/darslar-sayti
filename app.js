import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc,
  query, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

/* ============ FIREBASE INIT ============ */
let db = null;
let configOk = firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY";
if (configOk) {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
  } catch (e) {
    console.error("Firebase init xatosi:", e);
    configOk = false;
  }
}

/* ============ DATA ============ */
const SUBJECTS = [
  {key:'matematika', name:'Matematika', icon:'📐'},
  {key:'fizika', name:'Fizika', icon:'⚛️'},
  {key:'kimyo', name:'Kimyo', icon:'🧪'},
  {key:'biologiya', name:'Biologiya', icon:'🧬'},
  {key:'tarix', name:'Tarix', icon:'🏛️'},
  {key:'ona_tili', name:'Ona tili va adabiyot', icon:'📖'},
  {key:'ingliz_tili', name:'Ingliz tili', icon:'🇬🇧'},
  {key:'geografiya', name:'Geografiya', icon:'🌍'},
  {key:'informatika', name:'Informatika', icon:'💻'}
];
function subjName(key){ const s = SUBJECTS.find(x=>x.key===key); return s? s.name : key; }
const DIFF_LABEL = {easy:'Oson', medium:"O'rta", hard:'Qiyin'};

/* ============ STATE ============ */
let profile = null;
let view = 'loading';
let ctx = {};
let authTab = 'login';

/* ============ FIRESTORE HELPERS ============ */
async function fsGetUser(phone){
  const snap = await getDoc(doc(db,'users',phone));
  return snap.exists() ? snap.data() : null;
}
async function fsCreateUser(p){
  await setDoc(doc(db,'users',p.phone), p);
}
async function fsGetLessons(subject){
  const q = query(collection(db,'lessons'), where('subject','==',subject));
  const snap = await getDocs(q);
  return snap.docs.map(d=>({id:d.id, ...d.data()})).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
}
async function fsAddLesson(obj){ await addDoc(collection(db,'lessons'), obj); }
async function fsGetTests(subject){
  const q = query(collection(db,'tests'), where('subject','==',subject));
  const snap = await getDocs(q);
  return snap.docs.map(d=>({id:d.id, ...d.data()})).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
}
async function fsGetDtmTests(){
  const q = query(collection(db,'tests'), where('isDtm','==',true));
  const snap = await getDocs(q);
  return snap.docs.map(d=>({id:d.id, ...d.data()})).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
}
async function fsGetTestById(testId){
  const snap = await getDoc(doc(db,'tests',testId));
  return snap.exists() ? {id:snap.id, ...snap.data()} : null;
}
async function fsAddTest(obj){ return await addDoc(collection(db,'tests'), obj); }
async function fsAddResult(obj){ await addDoc(collection(db,'results'), obj); }
async function fsGetResultsByPhone(phone){
  const q = query(collection(db,'results'), where('phone','==',phone));
  const snap = await getDocs(q);
  return snap.docs.map(d=>({id:d.id, ...d.data()}));
}
async function fsGetAllResults(){
  const snap = await getDocs(collection(db,'results'));
  return snap.docs.map(d=>({id:d.id, ...d.data()}));
}
async function fsGetResultsByTest(testId){
  const q = query(collection(db,'results'), where('testId','==',testId));
  const snap = await getDocs(q);
  return snap.docs.map(d=>({id:d.id, ...d.data()}));
}

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
    try{
      const u = await fsGetUser(savedPhone);
      if(u){ profile = u; }
    }catch(e){ console.error(e); }
  }
  view = profile ? 'home' : 'auth';
  render();
}

/* ============ NAV ============ */
const NAV_ITEMS = [
  {v:'home', label:'Bosh sahifa'},
  {v:'lessons', label:'Darsliklar'},
  {v:'subjectTests', label:'Fan testlari'},
  {v:'dtmList', label:'DTM testlari'},
  {v:'leaderboard', label:'Reyting'},
  {v:'ai', label:'AI maslahat'},
];
function go(v, data){ ctx = data||{}; view=v; window.scrollTo(0,0); render(); }
window.go = go;

/* ============ RENDER ROOT ============ */
async function render(){
  const app = document.getElementById('app');
  if(view==='loading'){ app.innerHTML = loadingHtml(); return; }
  if(view==='auth'){ app.innerHTML = authScreen(); attachAuthHandlers(); return; }

  app.innerHTML = shell();
  const body = document.getElementById('pageBody');
  body.innerHTML = loadingHtml();
  try{
    const html = await bodyFor(view);
    body.innerHTML = html;
    afterRenderHooks();
  }catch(e){
    console.error(e);
    body.innerHTML = `<div class="empty"><div class="big">⚠️</div>Xatolik yuz berdi: ${escapeHtml(e.message||'')}<br><span class="small-note">Firestore xavfsizlik qoidalarini (rules) tekshiring.</span></div>`;
  }
}
function loadingHtml(){ return '<div style="padding:60px;text-align:center;color:#66708A;">Yuklanmoqda…</div>'; }

function shell(){
  const initials = ((profile.firstName||' ')[0]+(profile.lastName||' ')[0]).toUpperCase();
  const navHtml = NAV_ITEMS.concat(profile.role==='teacher' ? [{v:'admin', label:'Admin panel'}] : [])
    .map(n=>`<button class="${view===n.v?'active':''}" onclick="go('${n.v}')">${n.label}</button>`).join('');
  return `
  <div class="topbar">
    <div class="brand"><div class="mark">🎓</div> Bilimdon</div>
    <div class="topbar-right">
      <div class="profile-chip"><div class="avatar">${initials}</div> ${escapeHtml(profile.firstName)} ${escapeHtml(profile.lastName)} ${profile.role==='teacher'?'<span class="badge amber">Ustoz</span>':''}</div>
      <button class="logout-btn" onclick="doLogout()">Chiqish</button>
    </div>
  </div>
  <div class="navwrap"><div class="nav">${navHtml}</div></div>
  <main><div id="pageBody"></div></main>
  `;
}
function doLogout(){ localStorage.removeItem('bilimdon_phone'); profile=null; authTab='login'; view='auth'; render(); }
window.doLogout = doLogout;

/* ============ ROUTER ============ */
async function bodyFor(v){
  switch(v){
    case 'home': return await homeScreen();
    case 'lessons': return await lessonsListScreen();
    case 'lessonDetail': return await lessonDetailScreen();
    case 'subjectTests': return await subjectTestsScreen();
    case 'testTaking': return testTakingScreen();
    case 'testResult': return testResultScreen();
    case 'dtmList': return await dtmListScreen();
    case 'leaderboard': return await leaderboardScreen();
    case 'ai': return await aiScreen();
    case 'admin': return adminScreen();
    case 'adminLesson': return adminLessonFormScreen();
    case 'adminTest': return adminTestFormScreen(false);
    case 'adminDtm': return adminTestFormScreen(true);
    case 'adminStats': return await adminStatsScreen();
    default: return '<div class="empty">Sahifa topilmadi</div>';
  }
}
function afterRenderHooks(){
  if(view==='testTaking' && ctx.test){ startTimer(); }
}

/* ============ AUTH (Login / Register) ============ */
function authScreen(){
  return `
  <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--navy),var(--navy-2));padding:20px;">
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
  return `
  <form id="loginForm">
    <label>Telefon raqamingiz</label>
    <input type="tel" id="lgPhone" required placeholder="+998901234567">
    <label>Parol</label>
    <input type="password" id="lgPass" required placeholder="Parolingiz">
    <button class="btn full" type="submit" style="margin-top:20px;">Kirish</button>
  </form>`;
}
function registerFormHtml(){
  return `
  <form id="registerForm">
    <label>Ismingiz</label>
    <input type="text" id="rFirst" required placeholder="Masalan: Aziz">
    <label>Familyangiz</label>
    <input type="text" id="rLast" required placeholder="Masalan: Karimov">
    <label>Telefon raqamingiz</label>
    <input type="tel" id="rPhone" required placeholder="+998901234567">
    <label>Parol</label>
    <input type="password" id="rPass" required placeholder="Kamida 4 ta belgi" minlength="4">
    <label>Siz kimsiz?</label>
    <div class="radio-row">
      <label><input type="radio" name="rRole" value="student" checked> O'quvchi</label>
      <label><input type="radio" name="rRole" value="teacher"> Ustoz</label>
    </div>
    <button class="btn full" type="submit" style="margin-top:20px;">Ro'yxatdan o'tish</button>
  </form>`;
}
function attachAuthHandlers(){
  const lf = document.getElementById('loginForm');
  const rf = document.getElementById('registerForm');
  if(lf) lf.onsubmit = async (e)=>{
    e.preventDefault();
    const phone = normPhone(document.getElementById('lgPhone').value.trim());
    const pass = document.getElementById('lgPass').value;
    setAuthError('');
    try{
      const u = await fsGetUser(phone);
      if(!u || u.password !== pass){ setAuthError("Telefon raqami yoki parol noto'g'ri."); return; }
      profile = u;
      localStorage.setItem('bilimdon_phone', phone);
      go('home');
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
      const existing = await fsGetUser(phone);
      if(existing){ setAuthError('Bu telefon raqami bilan foydalanuvchi allaqachon mavjud. Kirish bo\\'limidan foydalaning.'); return; }
      const p = {firstName,lastName,phone,password,role,createdAt:Date.now()};
      await fsCreateUser(p);
      profile = p;
      localStorage.setItem('bilimdon_phone', phone);
      go('home');
    }catch(err){ setAuthError('Xatolik: '+err.message); }
  };
}
function setAuthError(msg){
  const el = document.getElementById('authError');
  if(el) el.innerHTML = msg ? `<div class="error-text">${escapeHtml(msg)}</div>` : '';
}

/* ============ BADGES ============ */
function computeBadges(results){
  const badges = [];
  if(results.length>=1) badges.push({icon:'🥉', label:'Boshlang\\'ich qadam'});
  if(results.length>=5) badges.push({icon:'🥈', label:'Faol o\\'quvchi'});
  if(results.length>=15) badges.push({icon:'🥇', label:'Bardoshli o\\'quvchi'});
  const avg = results.length ? results.reduce((a,r)=>a+(r.score/r.total*100),0)/results.length : 0;
  if(results.length>=3 && avg>=90) badges.push({icon:'🏆', label:'A\\'lo o\\'quvchi'});
  if(results.some(r=>r.testType==='dtm' && r.score/r.total>=0.8)) badges.push({icon:'🎯', label:'DTM ustasi'});
  return badges;
}

/* ============ HOME ============ */
async function homeScreen(){
  const myResults = await fsGetResultsByPhone(profile.phone);
  const avg = myResults.length ? Math.round(myResults.reduce((a,r)=>a+(r.score/r.total*100),0)/myResults.length) : null;
  const badges = computeBadges(myResults);
  return `
    <div class="hero">
      <h1>Xush kelibsiz, ${escapeHtml(profile.firstName)}! 👋</h1>
      <p>Darslarni o'rganing, testlar yeching, DTM'ga tayyorlaning va reytingda o'z o'rningizni egallang.</p>
      <div class="hero-stats">
        <div><div class="stat-num">${myResults.length}</div><div class="stat-label">Yechilgan testlar</div></div>
        <div><div class="stat-num">${avg!==null? avg+'%':'—'}</div><div class="stat-label">O'rtacha natija</div></div>
        <div><div class="stat-num">${SUBJECTS.length}</div><div class="stat-label">Fanlar</div></div>
      </div>
    </div>

    ${badges.length? `
    <div class="section-block">
      <h2 style="margin:0 0 12px;font-size:1.2rem;">Yutuqlaringiz</h2>
      <div class="badge-row">
        ${badges.map(b=>`<div class="pill">${b.icon} ${b.label}</div>`).join('')}
      </div>
    </div>` : ''}

    <div class="section-block">
      <div class="flex-between"><h2 style="margin:0;font-size:1.2rem;">Fanlar</h2></div>
      <div class="grid grid-3">
        ${SUBJECTS.map(s=>`
          <div class="card card-hover" onclick="go('lessons',{subject:'${s.key}'})">
            <div class="subj-icon">${s.icon}</div>
            <div style="font-weight:700;">${s.name}</div>
            <div class="small-note">Darsliklar va testlar</div>
          </div>`).join('')}
      </div>
    </div>

    ${myResults.length? `
    <div class="section-block">
      <h2 style="margin:0 0 14px;font-size:1.2rem;">So'nggi natijalaringiz</h2>
      <div class="grid grid-2">
        ${myResults.slice(-4).reverse().map(r=>`
          <div class="card">
            <div class="eyebrow">${r.testType==='dtm'?'DTM':subjName(r.subject)}</div>
            <div style="font-weight:700;margin-bottom:6px;">${escapeHtml(r.testTitle)}</div>
            <div style="color:var(--teal-dark);font-weight:800;font-size:1.3rem;">${r.score}/${r.total}</div>
          </div>`).join('')}
      </div>
    </div>` : ''}
  `;
}

/* ============ LESSONS ============ */
async function lessonsListScreen(){
  if(!ctx.subject){
    return `
    <h1 class="page-title">Darsliklar</h1>
    <p class="page-sub">Fanni tanlang va darsliklarni o'rganishni boshlang.</p>
    <div class="grid grid-3">
      ${SUBJECTS.map(s=>`
        <div class="card card-hover" onclick="go('lessons',{subject:'${s.key}'})">
          <div class="subj-icon">${s.icon}</div>
          <div style="font-weight:700;">${s.name}</div>
        </div>`).join('')}
    </div>`;
  }
  const lessons = await fsGetLessons(ctx.subject);
  return `
    <button class="back-link" onclick="go('lessons')">← Fanlarga qaytish</button>
    <h1 class="page-title">${subjName(ctx.subject)} — Darsliklar</h1>
    <p class="page-sub">${lessons.length} ta darslik mavjud</p>
    ${lessons.length? `
    <div class="grid grid-2">
      ${lessons.map(l=>`
        <div class="card card-hover" onclick="go('lessonDetail',{subject:'${ctx.subject}',lessonId:'${l.id}'})">
          <div class="badge">Darslik</div>
          <div style="font-weight:700;margin-top:8px;">${escapeHtml(l.title)}</div>
          <div class="small-note" style="margin-top:6px;">${l.videoUrl?'🎬 Video · ':''}${l.imageUrl?'🖼️ Rasm · ':''}${(l.text||'').length>0?'📝 Matn':''}</div>
        </div>`).join('')}
    </div>` : `<div class="empty"><div class="big">📚</div>Bu fan bo'yicha hali darslik qo'shilmagan.${profile.role==='teacher'?' Admin panel orqali qo\\'shishingiz mumkin.':''}</div>`}
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
    <button class="back-link" onclick="go('lessons',{subject:'${ctx.subject}'})">← ${subjName(ctx.subject)} darsliklariga qaytish</button>
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

/* ============ SUBJECT TESTS ============ */
async function subjectTestsScreen(){
  if(!ctx.subject){
    return `
    <h1 class="page-title">Fan testlari</h1>
    <p class="page-sub">Fanni tanlang va bilimingizni sinab ko'ring.</p>
    <div class="grid grid-3">
      ${SUBJECTS.map(s=>`
        <div class="card card-hover" onclick="go('subjectTests',{subject:'${s.key}'})">
          <div class="subj-icon">${s.icon}</div>
          <div style="font-weight:700;">${s.name}</div>
        </div>`).join('')}
    </div>`;
  }
  let tests = await fsGetTests(ctx.subject);
  const activeDiff = ctx.diffFilter || 'all';
  if(activeDiff!=='all') tests = tests.filter(t=>(t.difficulty||'medium')===activeDiff);
  return `
    <button class="back-link" onclick="go('subjectTests')">← Fanlarga qaytish</button>
    <h1 class="page-title">${subjName(ctx.subject)} — Testlar</h1>
    <div class="filter-row">
      <button class="filter-chip ${activeDiff==='all'?'active':''}" onclick="filterDiff('all')">Barchasi</button>
      <button class="filter-chip ${activeDiff==='easy'?'active':''}" onclick="filterDiff('easy')">Oson</button>
      <button class="filter-chip ${activeDiff==='medium'?'active':''}" onclick="filterDiff('medium')">O'rta</button>
      <button class="filter-chip ${activeDiff==='hard'?'active':''}" onclick="filterDiff('hard')">Qiyin</button>
    </div>
    ${tests.length? `
    <div class="grid grid-2">
      ${tests.map(t=>`
        <div class="card card-hover" onclick="beginTest('${t.id}', false)">
          <div class="badge">${t.questions.length} ta savol</div>
          <span class="badge ${t.difficulty||'medium'}">${DIFF_LABEL[t.difficulty||'medium']}</span>
          <div style="font-weight:700;margin-top:8px;">${escapeHtml(t.title)}</div>
          <div class="small-note" style="margin-top:6px;">⏱ ${t.duration} daqiqa</div>
        </div>`).join('')}
    </div>` : `<div class="empty"><div class="big">📝</div>Bu bo'yicha hali test qo'shilmagan.</div>`}
  `;
}
function filterDiff(d){ ctx.diffFilter = d; render(); }
window.filterDiff = filterDiff;

async function beginTest(testId, isDtm){
  const t = await fsGetTestById(testId);
  if(!t) return;
  ctx = {subject:t.subject, test:t, isDtm, answers:new Array(t.questions.length).fill(null), secondsLeft:t.duration*60};
  view='testTaking';
  render();
}
window.beginTest = beginTest;

/* ============ DTM ============ */
async function dtmListScreen(){
  const tests = await fsGetDtmTests();
  return `
    <h1 class="page-title">DTM testlari</h1>
    <p class="page-sub">Davlat test markazi uslubidagi umumiy testlar bilan bilimingizni sinang.</p>
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
  return `<div class="timer-bar ${low?'low':''}" id="timerBar"><span>⏱ Qolgan vaqt: ${m}:${s.toString().padStart(2,'0')}</span><span>${ctx.answers.filter(a=>a!==null).length}/${ctx.test.questions.length} javob berildi</span></div>`;
}
function testTakingScreen(){
  const t = ctx.test;
  return `
    ${timerBarHtml()}
    <h1 class="page-title">${escapeHtml(t.title)}</h1>
    <p class="page-sub">Har bir savolda 3 ta javobdan bittasini tanlang.</p>
    ${t.questions.map((q,qi)=>`
      <div class="card q-card">
        <div class="q-num">Savol ${qi+1} / ${t.questions.length}</div>
        <div style="font-weight:700;margin-bottom:4px;">${escapeHtml(q.question)}</div>
        ${q.options.map((opt,oi)=>`
          <div class="opt ${ctx.answers[qi]===oi?'selected':''}" onclick="selectAnswer(${qi},${oi})">
            <input type="radio" name="q${qi}" ${ctx.answers[qi]===oi?'checked':''} readonly>
            <span>${escapeHtml(opt)}</span>
          </div>`).join('')}
      </div>`).join('')}
    <button class="btn" style="margin-top:10px;" onclick="submitTest()">Testni yakunlash</button>
  `;
}
function selectAnswer(qi, oi){ ctx.answers[qi]=oi; render(); }
window.selectAnswer = selectAnswer;

async function submitTest(){
  clearInterval(timerInterval);
  const t = ctx.test;
  let score = 0;
  t.questions.forEach((q,qi)=>{ if(ctx.answers[qi]===q.correct) score++; });
  const result = {
    phone: profile.phone,
    name: profile.firstName+' '+profile.lastName,
    testId:t.id, testTitle:t.title, subject: ctx.isDtm? 'dtm' : ctx.subject,
    testType: ctx.isDtm?'dtm':'subject', score, total:t.questions.length,
    answers: ctx.answers, date:Date.now()
  };
  try{ await fsAddResult(result); }catch(e){ console.error(e); }
  ctx.result = result;
  view = 'testResult';
  render();
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
        <button class="btn" onclick="go('leaderboard')">Reytingni ko'rish</button>
        <button class="btn secondary" onclick="go('home')">Bosh sahifaga qaytish</button>
      </div>
    </div>
    <div id="reviewArea"></div>
  `;
}
function reviewTest(){
  const t = ctx.test;
  const html = t.questions.map((q,qi)=>`
    <div class="card q-card">
      <div class="q-num">Savol ${qi+1}</div>
      <div style="font-weight:700;margin-bottom:4px;">${escapeHtml(q.question)}</div>
      ${q.options.map((opt,oi)=>{
        let cls='';
        if(oi===q.correct) cls='correct';
        else if(oi===ctx.answers[qi]) cls='wrong';
        return `<div class="opt ${cls}"><span>${oi===q.correct?'✓':(oi===ctx.answers[qi]?'✗':'')} ${escapeHtml(opt)}</span></div>`;
      }).join('')}
    </div>`).join('');
  document.getElementById('reviewArea').innerHTML = html;
}
window.reviewTest = reviewTest;

/* ============ LEADERBOARD ============ */
async function leaderboardScreen(){
  const all = await fsGetAllResults();
  const totals = {};
  all.forEach(r=>{
    if(!totals[r.phone]) totals[r.phone] = {name:r.name, correct:0, total:0, tests:0};
    totals[r.phone].correct += r.score;
    totals[r.phone].total += r.total;
    totals[r.phone].tests += 1;
  });
  const rows = Object.values(totals)
    .map(u=>({...u, pct: u.total? Math.round(u.correct/u.total*100):0}))
    .sort((a,b)=> b.pct-a.pct || b.tests-a.tests);
  return `
    <h1 class="page-title">Umumiy reyting</h1>
    <p class="page-sub">Barcha foydalanuvchilarning test natijalari bo'yicha reyting.</p>
    ${rows.length? rows.map((u,i)=>`
      <div class="lb-row">
        <div class="lb-rank ${i===0?'top1':i===1?'top2':i===2?'top3':''}">${i+1}</div>
        <div class="lb-name">${escapeHtml(u.name)} <span class="small-note">· ${u.tests} ta test</span></div>
        <div class="lb-score">${u.pct}%</div>
      </div>`).join('') : `<div class="empty"><div class="big">🏆</div>Hali hech kim test yechmagan. Birinchi bo'ling!</div>`}
  `;
}

/* ============ AI MASLAHAT ============ */
async function aiScreen(){
  const myResults = await fsGetResultsByPhone(profile.phone);
  const summary = myResults.length
    ? myResults.map(r=>`${r.testType==='dtm'?'DTM':subjName(r.subject)}: ${r.score}/${r.total}`).join(', ')
    : "Hali test natijalari yo'q";
  return `
    <h1 class="page-title">AI maslahat</h1>
    <p class="page-sub">Shaxsiy o'quv tavsiyalarini oling — sun'iy intellekt natijalaringiz asosida maslahat beradi.</p>
    <div class="card">
      <label>Nima haqida maslahat kerak? (ixtiyoriy)</label>
      <textarea id="aiQuestion" placeholder="Masalan: Matematikadan integral mavzusini tushunmayapman, qanday o'rganay?"></textarea>
      <div class="small-note">Natijalaringiz: ${escapeHtml(summary)}</div>
      <button class="btn" style="margin-top:14px;" onclick="askAI()" id="aiBtn">Maslahat olish</button>
    </div>
    <div id="aiAnswerWrap" style="margin-top:18px;"></div>
    <p class="small-note" style="margin-top:10px;">Eslatma: bu funksiya ishlashi uchun serverda Anthropic API kalitiga ega proksi kerak (README'ga qarang).</p>
  `;
}
async function askAI(){
  const btn = document.getElementById('aiBtn');
  const wrap = document.getElementById('aiAnswerWrap');
  const question = document.getElementById('aiQuestion').value.trim();
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Tahlil qilinmoqda…';
  wrap.innerHTML = '';
  const myResults = await fsGetResultsByPhone(profile.phone);
  const resSummary = myResults.length
    ? myResults.map(r=>`${r.testType==='dtm'?'DTM':subjName(r.subject)} testi: ${r.score}/${r.total} to'g'ri`).join('; ')
    : "Foydalanuvchi hali hech qanday test yechmagan.";
  try{
    const response = await fetch("/api/ai-advice", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({
        firstName: profile.firstName, lastName: profile.lastName,
        resultsSummary: resSummary, question
      })
    });
    if(!response.ok) throw new Error('API javob bermadi (backend sozlanmagan bo\\'lishi mumkin)');
    const data = await response.json();
    wrap.innerHTML = `<div class="ai-msg">${escapeHtml(data.text||'')}</div>`;
  }catch(e){
    wrap.innerHTML = `<div class="ai-msg">AI maslahat xizmati hozircha ulanmagan. README.md faylidagi "AI maslahat" bo'limiga qarang — buning uchun kichik backend funksiya (Vercel Serverless Function) kerak bo'ladi.</div>`;
  }
  btn.disabled = false;
  btn.textContent = 'Maslahat olish';
}
window.askAI = askAI;

/* ============ ADMIN (Teacher) ============ */
function adminScreen(){
  if(profile.role!=='teacher') return `<div class="empty"><div class="big">🔒</div>Bu bo'lim faqat ustozlar uchun.</div>`;
  return `
    <h1 class="page-title">Admin panel</h1>
    <p class="page-sub">Darslik va testlar qo'shing — ular barcha foydalanuvchilarga ko'rinadi.</p>
    <div class="grid grid-3">
      <div class="card card-hover" onclick="go('adminLesson')">
        <div class="subj-icon">📚</div>
        <div style="font-weight:700;">Darslik qo'shish</div>
        <div class="small-note">Matn, video havola, rasm havolasi</div>
      </div>
      <div class="card card-hover" onclick="go('adminTest')">
        <div class="subj-icon">📝</div>
        <div style="font-weight:700;">Fan testi qo'shish</div>
        <div class="small-note">Savol, 3 ta javob, to'g'ri javob</div>
      </div>
      <div class="card card-hover" onclick="go('adminDtm')">
        <div class="subj-icon">🎯</div>
        <div style="font-weight:700;">DTM testi qo'shish</div>
        <div class="small-note">Umumiy test, 45 daqiqa</div>
      </div>
      <div class="card card-hover" onclick="go('adminStats')">
        <div class="subj-icon">📊</div>
        <div style="font-weight:700;">Testlar statistikasi</div>
        <div class="small-note">O'quvchilar natijalari tahlili</div>
      </div>
    </div>
  `;
}

function adminLessonFormScreen(){
  return `
    <button class="back-link" onclick="go('admin')">← Admin panelga qaytish</button>
    <h1 class="page-title">Yangi darslik qo'shish</h1>
    <div class="card">
      <form id="lessonForm">
        <label>Fan</label>
        <select id="lFanKey">${SUBJECTS.map(s=>`<option value="${s.key}">${s.name}</option>`).join('')}</select>
        <label>Darslik nomi</label>
        <input type="text" id="lTitle" required placeholder="Masalan: Hujayra tuzilishi">
        <label>Matn (dars mazmuni)</label>
        <textarea id="lText" rows="6" placeholder="Dars matnini shu yerga yozing..."></textarea>
        <label>Video havolasi (ixtiyoriy — YouTube)</label>
        <input type="url" id="lVideo" placeholder="https://youtube.com/watch?v=...">
        <label>Rasm havolasi (ixtiyoriy)</label>
        <input type="url" id="lImageUrl" placeholder="https://.../rasm.jpg">
        <div class="small-note">Rasmni internetga (masalan imgur.com) yuklab, havolasini shu yerga qo'ying.</div>
        <button class="btn" type="submit" style="margin-top:20px;">Darslikni saqlash</button>
      </form>
    </div>
  `;
}

function adminTestFormScreen(isDtm){
  if(!ctx.questions || ctx._formIsDtm!==isDtm){ ctx.questions = [emptyQuestion()]; ctx._formIsDtm = isDtm; }
  return `
    <button class="back-link" onclick="go('admin')">← Admin panelga qaytish</button>
    <h1 class="page-title">${isDtm? "Yangi DTM testi qo'shish" : "Yangi fan testi qo'shish"}</h1>
    <div class="card">
      ${isDtm? '' : `<label>Fan</label><select id="tFanKey">${SUBJECTS.map(s=>`<option value="${s.key}">${s.name}</option>`).join('')}</select>`}
      <label>Test nomi</label>
      <input type="text" id="tTitle" placeholder="${isDtm? "Masalan: 2025-yil DTM sinov testi" : "Masalan: Biologiya — 30 talik test"}">
      <label>Qiyinlik darajasi</label>
      <select id="tDifficulty">
        <option value="easy">Oson</option>
        <option value="medium" selected>O'rta</option>
        <option value="hard">Qiyin</option>
      </select>
      <label>Davomiyligi (daqiqa)</label>
      <input type="number" id="tDuration" value="${isDtm? 45 : 30}" min="1">

      <div id="questionsWrap">
        ${ctx.questions.map((q,i)=>questionEditorHtml(q,i)).join('')}
      </div>
      <button type="button" class="btn ghost" style="margin-top:10px;" onclick="addQuestion(${isDtm})">+ Savol qo'shish</button>
      <div style="margin-top:22px;display:flex;gap:10px;">
        <button class="btn" onclick="saveTest(${isDtm})">Testni saqlash</button>
      </div>
    </div>
  `;
}
function emptyQuestion(){ return {question:'', options:['','',''], correct:0}; }
function questionEditorHtml(q, i){
  return `
    <div class="q-editor" data-qi="${i}">
      <div class="flex-between" style="margin-bottom:0;">
        <strong>Savol ${i+1}</strong>
        ${i>0? `<button type="button" class="btn ghost btn-sm" onclick="removeQuestion(${i})">O'chirish</button>`:''}
      </div>
      <label>Savol matni</label>
      <input type="text" class="qText" value="${escapeHtml(q.question)}" placeholder="Savolni kiriting">
      <label>Javob variantlari (to'g'risini belgilang)</label>
      ${[0,1,2].map(oi=>`
        <div class="radio-row" style="margin-top:8px;">
          <input type="radio" name="correct${i}" value="${oi}" ${q.correct===oi?'checked':''}>
          <input type="text" class="qOpt" data-oi="${oi}" value="${escapeHtml(q.options[oi])}" placeholder="Variant ${oi+1}" style="flex:1;">
        </div>`).join('')}
    </div>
  `;
}
function addQuestion(isDtm){
  syncQuestionsFromDom();
  ctx.questions.push(emptyQuestion());
  render();
}
window.addQuestion = addQuestion;
function removeQuestion(i){
  syncQuestionsFromDom();
  ctx.questions.splice(i,1);
  render();
}
window.removeQuestion = removeQuestion;
function syncQuestionsFromDom(){
  const editors = document.querySelectorAll('.q-editor');
  editors.forEach((ed)=>{
    const i = parseInt(ed.dataset.qi);
    const qText = ed.querySelector('.qText').value;
    const opts = Array.from(ed.querySelectorAll('.qOpt')).map(inp=>inp.value);
    const correctInput = ed.querySelector('input[type=radio]:checked');
    const correct = correctInput ? parseInt(correctInput.value) : 0;
    ctx.questions[i] = {question:qText, options:opts, correct};
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
  const test = {subject, isDtm: !!isDtm, title, duration, difficulty, questions, createdAt:Date.now(), createdBy:profile.phone};
  try{
    await fsAddTest(test);
    showToast('Test muvaffaqiyatli saqlandi ✅');
    ctx = {};
    go('admin');
  }catch(e){ showToast('Xatolik: '+e.message); }
}
window.saveTest = saveTest;

/* ============ ADMIN STATS ============ */
async function adminStatsScreen(){
  if(profile.role!=='teacher') return `<div class="empty">Bu bo'lim faqat ustozlar uchun.</div>`;
  const allResults = await fsGetAllResults();
  const bySubject = {};
  const subjTests = await Promise.all(SUBJECTS.map(s=>fsGetTests(s.key)));
  const dtmTests = await fsGetDtmTests();
  const allTests = [...subjTests.flat(), ...dtmTests];
  allTests.forEach(t=>{
    const rs = allResults.filter(r=>r.testId===t.id);
    if(!rs.length) return;
    const avg = Math.round(rs.reduce((a,r)=>a+(r.score/r.total*100),0)/rs.length);
    bySubject[t.id] = {title:t.title, subject:t.isDtm?'DTM':subjName(t.subject), count:rs.length, avg};
  });
  const rows = Object.values(bySubject).sort((a,b)=>b.count-a.count);
  return `
    <button class="back-link" onclick="go('admin')">← Admin panelga qaytish</button>
    <h1 class="page-title">Testlar statistikasi</h1>
    <p class="page-sub">O'quvchilar qaysi testlarni qanday natija bilan yechganini ko'ring.</p>
    ${rows.length ? `
    <table class="stat-table">
      <thead><tr><th>Test</th><th>Fan</th><th>Yechganlar</th><th>O'rtacha natija</th></tr></thead>
      <tbody>
        ${rows.map(r=>`<tr><td>${escapeHtml(r.title)}</td><td>${escapeHtml(r.subject)}</td><td>${r.count}</td><td>${r.avg}%</td></tr>`).join('')}
      </tbody>
    </table>` : `<div class="empty"><div class="big">📊</div>Hali hech kim test yechmagan.</div>`}
  `;
}

/* attach lesson form submit via delegation */
document.addEventListener('submit', async (e)=>{
  if(e.target && e.target.id==='lessonForm'){
    e.preventDefault();
    const subject = document.getElementById('lFanKey').value;
    const title = document.getElementById('lTitle').value.trim();
    const text = document.getElementById('lText').value.trim();
    const videoUrl = document.getElementById('lVideo').value.trim();
    const imageUrl = document.getElementById('lImageUrl').value.trim();
    if(!title){ showToast('Darslik nomini kiriting'); return; }
    try{
      await fsAddLesson({subject, title, text, videoUrl, imageUrl, createdAt:Date.now(), createdBy:profile.phone});
      showToast('Darslik saqlandi ✅');
      go('admin');
    }catch(err){ showToast('Xatolik: '+err.message); }
  }
});

boot();

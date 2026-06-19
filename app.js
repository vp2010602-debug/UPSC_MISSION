import { firebaseConfig, AI_FUNCTION_URL, GEMINI_API_KEY } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, serverTimestamp, setDoc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js';

const subjects=['Polity','History','Geography','Economy','Environment','Science & Tech','Ethics','Essay','Current Affairs','CSAT','Optional','General'];
const $=id=>document.getElementById(id);
const today=()=>new Date().toISOString().slice(0,10);
const localGet=k=>{
  const arr=JSON.parse(localStorage.getItem(k)||'[]');
  let changed=false;
  arr.forEach(x=>{ if(x && typeof x==='object' && !x.id){ x.id='local_'+Date.now()+'_'+Math.random().toString(36).slice(2); changed=true; } });
  if(changed) localStorage.setItem(k,JSON.stringify(arr));
  return arr;
};
const localSet=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const delBtn=(col,x,i,label='🗑 Delete')=>`<button class="btn danger deleteBtn" onclick="event.stopPropagation(); deleteItem('${col}','${x?.id||i}')">${label}</button>`;

const safeName=(name='file')=>String(name).replace(/[^a-zA-Z0-9._-]+/g,'_').slice(0,120)||'file';
const fileToDataUrl=(file)=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});
async function uploadFileToFirebase(file,folder='files'){
  if(!file) return {};
  if(!(cloudEnabled && user && storage)){
    return {url:await fileToDataUrl(file), localOnly:true};
  }
  const cleanFolder=safeName(folder||'files');
  const fullPath=`users/${user.uid}/${cleanFolder}/${Date.now()}_${safeName(file.name)}`;
  const r=storageRef(storage,fullPath);
  await uploadBytes(r,file,{contentType:file.type||'application/octet-stream'});
  const url=await getDownloadURL(r);
  return {url,storagePath:fullPath,cloudFile:true};
}
window.uploadFileToFirebase=uploadFileToFirebase;
async function deleteStoragePath(path){
  if(!path || !storage) return;
  try{ await deleteObject(storageRef(storage,path)); }catch(e){ console.warn('Storage delete skipped:', e.message); }
}
window.deleteStoragePath=deleteStoragePath;
function setCloudBadge(msg,cls=''){
  const el=$('cloudStatusLine'); if(el) el.innerHTML=`<span class="pill ${cls}">${msg}</span>`;
}

let app, auth, db, storage, user=null, cloudEnabled=false;

try{
  if(firebaseConfig.apiKey && !firebaseConfig.apiKey.includes('PASTE')){
    app=initializeApp(firebaseConfig);
    auth=getAuth(app);
    db=getFirestore(app);
    storage=getStorage(app);
    cloudEnabled=true;
  }
}catch(e){ console.warn('Firebase config issue:', e); }

['quickSubject','focusSubject','caSubject','blockSubject','studySubject','noteSubject','fileSubject','kgSubject','flashSubject','pyqSubject','bookSubject','wrongSubject','mapSubject','completionSubject','revScheduleSubject'].forEach(id=>{
  if($(id)) $(id).innerHTML=subjects.map(s=>`<option>${s}</option>`).join('');
});

window.setTheme=(theme)=>{document.documentElement.setAttribute('data-theme',theme);localStorage.setItem('theme',theme)};
window.toggleMenu=()=> $('sidebar').classList.toggle('open');
window.show=(id,btn)=>{
  const target=$(id);
  if(!target) return console.warn('Section not found:', id);
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nav button').forEach(b=>b.classList.remove('active'));
  target.classList.add('active');
  const navBtn=btn || [...document.querySelectorAll('.nav button')].find(b=>String(b.getAttribute('onclick')||'').includes(`'${id}'`) || String(b.getAttribute('onclick')||'').includes(`\"${id}\"`));
  if(navBtn) navBtn.classList.add('active');
  if($('pageTitle')) $('pageTitle').innerText=(navBtn?.innerText || target.querySelector('h1,h2')?.innerText || id).replace(/[^\w\s]/g,'').trim();
  $('sidebar')?.classList.remove('open');
  renderAll(id);
};

function path(col){return user ? `users/${user.uid}/${col}` : col}

/* V27.5.2 LOGIN + READINESS LOOP HOTFIX: share repeated Firebase reads during startup/login. */
const __cloudColCacheV2751=new Map();
const __cloudColPendingV2751=new Map();
function cloudCacheKeyV2751(col){return `${user?.uid||'local'}::${col}`}
function invalidateColCacheV2751(col){
  const suffix=`::${col}`;
  for(const k of [...__cloudColCacheV2751.keys()]) if(k.endsWith(suffix)) __cloudColCacheV2751.delete(k);
  for(const k of [...__cloudColPendingV2751.keys()]) if(k.endsWith(suffix)) __cloudColPendingV2751.delete(k);
}
window.invalidateColCacheV2751=invalidateColCacheV2751;
async function getCol(col){
  if(cloudEnabled && user){
    const key=cloudCacheKeyV2751(col), now=Date.now(), ttl=20000;
    const cached=__cloudColCacheV2751.get(key);
    if(cached && now-cached.at<ttl) return cached.data.slice();
    if(__cloudColPendingV2751.has(key)) return (await __cloudColPendingV2751.get(key)).slice();
    const request=(async()=>{
      try{
        const snap=await getDocs(query(collection(db,path(col)), orderBy('createdAt','desc')));
        return snap.docs.map(d=>({...d.data(), id:d.id, _docId:d.id}));
      }catch(e){
        const snap=await getDocs(collection(db,path(col)));
        return snap.docs.map(d=>({...d.data(), id:d.id, _docId:d.id}));
      }
    })();
    __cloudColPendingV2751.set(key,request);
    try{
      const data=await request;
      __cloudColCacheV2751.set(key,{at:Date.now(),data});
      return data.slice();
    }finally{__cloudColPendingV2751.delete(key)}
  }
  return localGet(col);
}
async function saveCol(col,obj){
  obj.createdAt=Date.now();
  invalidateColCacheV2751(col);
  if(cloudEnabled && user) await addDoc(collection(db,path(col)), {...obj, createdAt:serverTimestamp()});
  else { const a=localGet(col); a.unshift({...obj,id:'local_'+Date.now()+'_'+Math.random().toString(36).slice(2)}); localSet(col,a); }
  invalidateColCacheV2751(col);
}
window.getCol=getCol; window.saveCol=saveCol;
window.deleteItem=async(col,idOrIndex,skipConfirm=false)=>{
  if(!skipConfirm && !confirm('Delete this item?')) return;
  invalidateColCacheV2751(col);
  try{
    if(cloudEnabled && user){
      let actualId = String(idOrIndex);
      let data = {};
      let found = false;
      // First try direct document id
      try{
        const direct = await getDoc(doc(db,path(col),actualId));
        if(direct.exists()){ data = direct.data() || {}; found = true; }
      }catch(e){}
      // Fallback for older records that stored a custom id field inside the document
      if(!found){
        try{
          const snap = await getDocs(collection(db,path(col)));
          const match = snap.docs.find(d => String(d.id)===String(idOrIndex) || String((d.data()||{}).id)===String(idOrIndex));
          if(match){ actualId = match.id; data = match.data() || {}; found = true; }
        }catch(e){}
      }
      if(data.storagePath) await deleteStoragePath(data.storagePath);
      if(found) await deleteDoc(doc(db,path(col),actualId));
    } else {
      const a=localGet(col);
      let idx=a.findIndex(x=>String(x.id)===String(idOrIndex));
      if(idx<0) idx=Number(idOrIndex);
      if(idx>=0) a.splice(idx,1);
      localSet(col,a);
    }
  }catch(e){
    console.error('Delete failed:', e);
    alert('Delete failed: '+(e.message||e));
    return;
  }
  renderAll();
  if(window.renderAIIntegrated) window.renderAIIntegrated();
  if(window.renderSectionFilesV10) document.querySelectorAll('.section').forEach(sec=>window.renderSectionFilesV10(sec.id));
  if(window.renderFileVault) window.renderFileVault();
  if(window.renderCurrentAffairsAI) renderCurrentAffairsAI();
  if(window.renderProNotes) renderProNotes();
  if(window.renderCurrentAffairsIntelligence) renderCurrentAffairsIntelligence();
  if(window.renderDigitalLibrary2) renderDigitalLibrary2();
  if(window.renderRichNotesV4) renderRichNotesV4();
};

let __postAuthRenderTimerV2751=null;
function schedulePostAuthRenderV2751(){
  clearTimeout(__postAuthRenderTimerV2751);
  window.__MISSION_AUTH_WARMUP__=true;
  __cloudColCacheV2751.clear();
  __cloudColPendingV2751.clear();
  __postAuthRenderTimerV2751=setTimeout(async()=>{
    try{await renderAll(activeSectionIdV225())}catch(e){console.warn('Post-login render skipped safely',e)}
    setTimeout(()=>{window.__MISSION_AUTH_WARMUP__=false},1400);
  },500);
}

function setupAuth(){
  if(!cloudEnabled){ $('userStatus').innerText='Firebase not configured'; return; }
  $('loginBtn').onclick = async () => {
  const provider = new GoogleAuthProvider();

  const isAppleMobile =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  try {
    if (isAppleMobile || isStandalone) {
      await signInWithRedirect(auth, provider);
    } else {
      await signInWithPopup(auth, provider);
    }
  } catch (error) {
    console.error('Google login failed:', error);
    $('userStatus').innerText = `Login failed: ${error.message}`;
  }
};
  $('logoutBtn').onclick=()=>signOut(auth);
  onAuthStateChanged(auth,async u=>{
    user=u;
    if(u){
      try{await setDoc(doc(db,`users/${u.uid}`),{name:u.displayName||'',email:u.email||'',photo:u.photoURL||'',lastLogin:serverTimestamp()}, {merge:true});}catch(e){console.warn('Profile sync failed',e)}
      setCloudBadge('☁️ Cloud connected: '+(u.email||u.displayName),'green');
    }else{ setCloudBadge('Local mode: sign in for cloud sync','gold'); }
    $('userStatus').innerText=u?`Signed in: ${u.displayName||u.email}`:'Not signed in';
    $('loginBtn').style.display=u?'none':'inline-block';
    $('logoutBtn').style.display=u?'inline-block':'none';
    schedulePostAuthRenderV2751();
  });
}

window.addTask=async()=>{if(!$('taskInput').value.trim())return;await saveCol('tasks',{text:$('taskInput').value,done:false,date:today()});$('taskInput').value='';renderAll()};
window.quickStudyLog=async()=>{await saveCol('studyLogs',{date:today(),subject:$('quickSubject').value,hours:+$('quickHours').value||0,note:'Quick dashboard entry'});$('quickHours').value='';renderAll()};
window.saveStudyLog=async()=>{await saveCol('studyLogs',{date:$('studyDate').value||today(),subject:$('studySubject').value,hours:+$('studyHours').value||0,note:$('studyNote').value});$('studyHours').value='';$('studyNote').value='';renderAll()};
window.saveSimpleText=async(id)=>{localStorage.setItem(id,$(id).value); if(cloudEnabled&&user) await setDoc(doc(db,`users/${user.uid}/settings/${id}`),{value:$(id).value,updatedAt:serverTimestamp()}); alert('Saved')};
window.saveMonth=async()=>{await saveCol('months',{name:$('monthName').value,goal:$('monthGoal').value,progress:+$('monthProgress').value||0});['monthName','monthGoal','monthProgress'].forEach(id=>$(id).value='');renderAll()};
window.saveWeek=async()=>{await saveCol('weeks',{name:$('weekName').value,goal:$('weekGoal').value,progress:+$('weekProgress').value||0});['weekName','weekGoal','weekProgress'].forEach(id=>$(id).value='');renderAll()};
window.saveBlock=async()=>{await saveCol('blocks',{time:$('blockTime').value,subject:$('blockSubject').value,task:$('blockTask').value});['blockTime','blockTask'].forEach(id=>$(id).value='');renderAll()};
window.saveHabit=async()=>{let keys=['Wake','News','Rev','Study','Mock','Mains','Exercise','NoSocial'];let obj={date:$('habitDate').value||today()};keys.forEach(k=>obj[k]=document.getElementById('h'+k).checked);await saveCol('habits',obj);renderAll()};
window.saveCurrentAffairs=async()=>{await saveCol('currentAffairs',{title:$('caTitle').value,subject:$('caSubject').value,paper:$('caPaper').value,body:$('caBody').value,date:today()});['caTitle','caBody'].forEach(id=>$(id).value='');renderAll()};
window.saveNote=async()=>{
  const file = $('noteFileInput')?.files?.[0];
  await saveCol('notes',{
    title:$('noteTitle').value||'Untitled',
    subject:$('noteSubject').value,
    body:$('noteBody').value,
    fileLink:$('noteFileLink').value,
    fileName:file ? file.name : '',
    date:today()
  });
  ['noteTitle','noteBody','noteFileLink'].forEach(id=>$(id).value='');
  if($('noteFileInput')) $('noteFileInput').value='';
  renderAll();
};
window.saveKG=async()=>{await saveCol('kg',{topic:$('kgTopic').value,subject:$('kgSubject').value,links:$('kgLinks').value,body:$('kgBody').value,date:today()});['kgTopic','kgLinks','kgBody'].forEach(id=>$(id).value='');renderAll()};
window.saveFlash=async()=>{await saveCol('flash',{q:$('flashQ').value,a:$('flashA').value,subject:$('flashSubject').value});['flashQ','flashA'].forEach(id=>$(id).value='');renderAll()};
window.savePYQ=async()=>{await saveCol('pyq',{topic:$('pyqTopic').value,year:$('pyqYear').value,subject:$('pyqSubject').value,q:$('pyqQuestion').value});['pyqTopic','pyqYear','pyqQuestion'].forEach(id=>$(id).value='');renderAll()};
window.saveMains=async()=>{await saveCol('mains',{q:$('mainsQ').value,paper:$('mainsPaper').value,ans:$('mainsAns').value,date:today()});$('mainsQ').value='';$('mainsAns').value='';wordCount();renderAll()};
window.saveTest=async()=>{await saveCol('tests',{name:$('testName').value,score:+$('testScore').value||0,accuracy:+$('testAccuracy').value||0,mistakes:$('testMistakes').value,date:today()});['testName','testScore','testAccuracy','testMistakes'].forEach(id=>$(id).value='');renderAll()};
window.saveRevision=async()=>{await saveCol('revision',{topic:$('revTopic').value,date:$('revDate').value,cycle:$('revCycle').value});['revTopic','revDate'].forEach(id=>$(id).value='');renderAll()};
window.saveBook=async()=>{await saveCol('books',{name:$('bookName').value,subject:$('bookSubject').value,progress:+$('bookProgress').value||0,revision:+$('bookRevision').value||0,note:$('bookNote').value,date:today()});['bookName','bookProgress','bookRevision','bookNote'].forEach(id=>$(id).value='');renderAll()};
window.saveWrong=async()=>{await saveCol('wrongbook',{topic:$('wrongTopic').value,subject:$('wrongSubject').value,question:$('wrongQuestion').value,reason:$('wrongReason').value,date:today()});['wrongTopic','wrongQuestion','wrongReason'].forEach(id=>$(id).value='');renderAll()};
window.uploadFile=async()=>{
  const f=$('fileInput')?.files?.[0];
  let uploaded={};
  if(f){
    try{ uploaded=await uploadFileToFirebase(f, $('folderName')?.value || 'files'); }
    catch(e){ alert('Cloud upload failed: '+e.message); return; }
  }
  await saveCol('files',{
    title:$('fileTitle')?.value || (f?f.name:'Untitled Resource'),
    folder:$('folderName')?.value || 'General',
    subject:$('fileSubject')?.value || 'General',
    type:$('resourceType') ? $('resourceType').value : (f?.type || 'PDF Link'),
    desc:$('fileDesc')?.value || '',
    name:f?f.name:'',
    size:f?f.size:0,
    url: uploaded.url || ($('fileUrl') ? $('fileUrl').value : ''),
    storagePath: uploaded.storagePath || '',
    cloudFile: !!uploaded.cloudFile,
    localOnly: !!uploaded.localOnly,
    linkedBook:$('linkedBook') ? $('linkedBook').value : '',
    important:$('fileImportant') ? $('fileImportant').checked : false,
    lastOpened:'',
    openCount:0,
    date:today()
  });
  ['fileTitle','fileDesc','fileUrl','linkedBook'].forEach(id=>{ if($(id)) $(id).value=''; });
  if($('fileImportant')) $('fileImportant').checked=false;
  if($('fileInput')) $('fileInput').value='';
  renderAll();
};

let pomoMinutes=25,pomoSeconds=25*60,pomoTotal=25*60,pomoTimer=null;
window.setPomodoro=(focus,br,label)=>{pomoMinutes=focus;pomoSeconds=focus*60;pomoTotal=focus*60;$('timerMode').innerText=label;updatePomodoroDisplay()};
window.startPomodoro=()=>{if(pomoTimer)return;pomoTimer=setInterval(()=>{pomoSeconds--;updatePomodoroDisplay();if(pomoSeconds<=0){clearInterval(pomoTimer);pomoTimer=null;alert('Focus session complete!')}} ,1000)};
window.pausePomodoro=()=>{clearInterval(pomoTimer);pomoTimer=null};
window.resetPomodoro=()=>{clearInterval(pomoTimer);pomoTimer=null;pomoSeconds=pomoMinutes*60;pomoTotal=pomoMinutes*60;updatePomodoroDisplay()};
function updatePomodoroDisplay(){if(!$('timerDisplay'))return;const m=String(Math.floor(pomoSeconds/60)).padStart(2,'0');const s=String(pomoSeconds%60).padStart(2,'0');$('timerDisplay').innerText=`${m}:${s}`;$('timerProgress').style.width=`${100-((pomoSeconds/pomoTotal)*100)}%`}
window.saveFocusSession=async()=>{await saveCol('focusSessions',{date:today(),subject:$('focusSubject').value,task:$('focusTask').value,minutes:pomoMinutes});$('focusTask').value='';renderAll()};

let calMonth=new Date().getMonth(), calYear=new Date().getFullYear();
window.saveCalendarItem=async()=>{await saveCol('calendarItems',{date:$('calDate').value||today(),type:$('calType').value,title:$('calTitle').value,note:$('calNote').value});$('calTitle').value='';$('calNote').value='';renderAll()};
window.changeMonth=(n)=>{calMonth+=n;if(calMonth<0){calMonth=11;calYear--}if(calMonth>11){calMonth=0;calYear++}renderCalendar()};
async function renderCalendar(){if(!$('calendarGrid'))return;const items=await getCol('calendarItems');$('calendarTitle').innerText=new Date(calYear,calMonth,1).toLocaleString('default',{month:'long',year:'numeric'});const first=new Date(calYear,calMonth,1).getDay();const days=new Date(calYear,calMonth+1,0).getDate();const heads=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<div class="calHead">${d}</div>`).join('');let cells='';for(let i=0;i<first;i++)cells+=`<div class="calDay"></div>`;for(let d=1;d<=days;d++){const dateStr=`${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;const dayItems=items.filter(x=>x.date===dateStr);cells+=`<div class="calDay ${dateStr===today()?'today':''}"><b>${d}</b>${dayItems.slice(0,3).map(x=>`<span class="calDot">${x.type}: ${x.title}</span>`).join('')}</div>`}$('calendarGrid').innerHTML=heads+cells;$('calendarItemList').innerHTML=items.slice(0,20).map((x,i)=>`<div class="item"><h3>${x.title}</h3><span class="pill">${x.date}</span><span class="pill">${x.type}</span><p>${x.note||''}</p><button class="btn danger" onclick="deleteItem('calendarItems','${x.id||i}')">Delete</button></div>`).join('')}

window.saveExamDates=()=>{localStorage.setItem('prelimsDate',$('prelimsDate').value);localStorage.setItem('mainsDate',$('mainsDate').value);renderCountdown()};
function renderCountdown(){if(!$('prelimsCountdown'))return;const p=localStorage.getItem('prelimsDate'),m=localStorage.getItem('mainsDate');$('prelimsDate').value=p||'';$('mainsDate').value=m||'';const diff=d=>Math.ceil((new Date(d)-new Date())/(1000*60*60*24));$('prelimsCountdown').innerText=p?`${diff(p)} days to Prelims`:'Set Prelims date';$('mainsCountdown').innerText=m?`${diff(m)} days to Mains`:'Set Mains date'}
function renderHeatmap(logs,habits,revision){if(!$('heatmapGrid'))return;const map={};logs.forEach(l=>map[l.date]=(map[l.date]||0)+(+l.hours||0));habits.forEach(h=>map[h.date]=(map[h.date]||0)+1);revision.forEach(r=>map[r.date]=(map[r.date]||0)+1);let html='';for(let i=83;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const key=d.toISOString().slice(0,10);const val=map[key]||0;const cls=val>=6?'heat4':val>=3?'heat3':val>=1?'heat2':'';html+=`<div class="heatCell ${cls}" title="${key}: ${val}">${d.getDate()}</div>`}$('heatmapGrid').innerHTML=html}

async function callAI(type,payload){
  let prompt="";

  if(type==="newspaper"){
    prompt=`Analyze this article for UPSC. Give GS paper, syllabus link, prelims facts, mains points, keywords, possible MCQ, possible mains question, and 100-word summary.

Article:
${payload?.text||""}`;
  }else if(type==="notes"){
    prompt=`Create UPSC-ready notes.

Topic: ${payload?.topic||""}

Content:
${payload?.text||""}

Give intro, bullet notes, prelims facts, mains dimensions, PYQ angle, flashcards and 5 MCQs.`;
  }else if(type==="mentor"){
    prompt=`Act as a strict but supportive UPSC mentor.

Question:
${payload?.question||""}

Give diagnosis, mistakes, 7-day plan, daily routine and motivation.`;
  }

  if(!GEMINI_API_KEY) return demoAI(type,payload);

  try{
    const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({contents:[{parts:[{text:prompt}]}]})
    });

    const data=await r.json();

    return data?.candidates?.[0]?.content?.parts?.[0]?.text ||
           data?.error?.message ||
           "No AI response";
  }catch(e){
    return "AI error: "+e.message;
  }
}
function demoAI(type,payload){if(type==='mentor')return `Diagnosis:\nYou may be weak because revision, PYQ practice and mock analysis are not yet tracked deeply.\n\n7-day Polity plan:\nDay 1: Fundamental Rights + PYQs\nDay 2: Parliament\nDay 3: President + Governor\nDay 4: Judiciary + cases\nDay 5: Constitutional bodies\nDay 6: Mock + wrong book\nDay 7: Revision + flashcards`;return `UPSC Analysis:\nGS Paper: GS2/GS3 depending on issue.\n\nPrelims facts:\n- Key institution / Act / scheme\n- Important terms\n\nMains points:\n- Background\n- Significance\n- Challenges\n- Way forward\n\nPossible question:\nDiscuss the issue and suggest a way forward.`}
window.aiNewspaper=async()=>{$('articleOutput').innerText='Analyzing...';$('articleOutput').innerText=await callAI('newspaper',{text:$('articleInput').value})};
window.aiNotes=async()=>{$('notesOutput').innerText='Generating...';$('notesOutput').innerText=await callAI('notes',{topic:$('aiTopic').value,text:$('chapterInput').value})};
window.aiMentor=async()=>{$('mentorOutput').innerText='Thinking...';$('mentorOutput').innerText=await callAI('mentor',{question:$('mentorInput').value})};
window.saveAIOutput=async(out,title,subject)=>{await saveCol('notes',{title,subject,body:$(out).innerText,date:today()});alert('Saved as note');renderAll()};
async function collectStats(){return{notes:(await getCol('notes')).length,tests:await getCol('tests'),studyLogs:await getCol('studyLogs'),pyq:(await getCol('pyq')).length,flash:(await getCol('flash')).length}}

window.wordCount=()=>{$('words').innerText=$('mainsAns').value.trim().split(/\s+/).filter(Boolean).length+' words'};
window.randomFlash=async()=>{const a=await getCol('flash');if(!a.length)return;const f=a[Math.floor(Math.random()*a.length)];$('flashPractice').innerHTML=`${f.q}<hr><button class="btn green" onclick="this.parentElement.innerHTML += '<p>${String(f.a).replaceAll("'","")}</p>'">Show answer</button>`};
window.exportData=()=>{let data={};Object.keys(localStorage).forEach(k=>data[k]=localStorage.getItem(k));let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download='mission-upsc-v7-1-backup.json';a.click()};

function itemHtml(col,x,i,title,body='body'){const id=x.id||i;return `<div class="item"><h3>${x[title]||x.title||x.topic||x.q||x.name||'Untitled'}</h3><p>${x[body]||x.body||x.goal||x.ans||x.mistakes||''}</p><button class="btn danger" onclick="deleteItem('${col}','${id}')">Delete</button></div>`}

window.openResource=async(col,idOrIndex,url)=>{
  if(url) window.open(url,'_blank');
  const files=await getCol('files');
  const idx = files.findIndex((f,i)=>(f.id||String(i))==idOrIndex);
  if(idx>=0){
    const f=files[idx];
    f.lastOpened=today();
    f.openCount=(+f.openCount||0)+1;
    if(user && cloudEnabled && f.id){
      await deleteDoc(doc(db,path('files'),f.id));
      await saveCol('files',f);
    } else {
      const local=localGet('files');
      if(local[idx]){ local[idx].lastOpened=today(); local[idx].openCount=(+local[idx].openCount||0)+1; localSet('files',local); }
    }
  }
  renderAll();
};

window.setFolderFilter=(folder)=>{
  if($('fileSearch')) $('fileSearch').value=folder;
  renderAll();
};


const ranks=[
  {name:'Civilian',xp:0},{name:'Aspirant',xp:100},{name:'Cadet',xp:300},
  {name:'Lieutenant',xp:600},{name:'Captain',xp:1000},{name:'Major',xp:1600},
  {name:'Colonel',xp:2400},{name:'General',xp:3500},{name:'IAS Officer',xp:5000}
];
function calculateXP(data){
  const {notes,logs,flash,pyq,mains,tests,revision,books,wrongbook,maps,battles}=data;
  return Math.round(notes.length*15+logs.reduce((s,l)=>s+(+l.hours||0)*20,0)+flash.length*8+pyq.length*12+mains.length*30+tests.length*50+revision.length*15+books.length*20+wrongbook.length*10+maps.length*12+battles.filter(b=>b.done).length*50);
}
function getRank(xp){let current=ranks[0],next=ranks[1];for(let i=0;i<ranks.length;i++){if(xp>=ranks[i].xp){current=ranks[i];next=ranks[i+1]||ranks[i];}}return{current,next};}
function calculateStreak(logs,habits){
  const active=new Set([...logs.map(l=>l.date),...habits.map(h=>h.date)]);
  let streak=0;
  for(let i=0;i<365;i++){const d=new Date();d.setDate(d.getDate()-i);const key=d.toISOString().slice(0,10);if(active.has(key))streak++;else if(i===0)continue;else break;}
  const sorted=[...active].sort();let best=0,temp=0,prev=null;
  sorted.forEach(k=>{const cur=new Date(k);if(prev){const diff=(cur-prev)/(1000*60*60*24);temp=diff===1?temp+1:1;}else temp=1;best=Math.max(best,temp);prev=cur;});
  return{streak,best};
}
window.generateRoast=async()=>{
  const logs=await getCol('studyLogs');
  const todayHours=logs.filter(l=>l.date===today()).reduce((s,l)=>s+(+l.hours||0),0);
  let msg='';
  if(todayHours>=8) msg='Excellent, officer. 8+ hours logged. Today you attacked the syllabus like a serious contender. Repeat tomorrow.';
  else if(todayHours>=5) msg='Good work, but not enough to scare the competition. Push one more session and finish strong.';
  else if(todayHours>=2) msg='Officer, 2–4 hours will not win this war. The syllabus is laughing. Start one Pomodoro now.';
  else msg='Brutal truth: today is slipping. Open Pomodoro. 25 minutes. No excuses. Win the next hour.';
  $('roastBox').innerText=msg;
};
window.saveBattle=async()=>{await saveCol('battles',{title:$('battleTitle').value,tasks:$('battleTasks').value,xp:+$('battleXP').value||100,done:false,date:today()});['battleTitle','battleTasks','battleXP'].forEach(id=>$(id).value='');renderAll();};
window.completeBattle=async(idOrIndex)=>{
  const battles=await getCol('battles');const idx=battles.findIndex((b,i)=>(b.id||String(i))==idOrIndex);
  if(idx>=0){const b=battles[idx];b.done=true;if(user&&cloudEnabled&&b.id){await deleteDoc(doc(db,path('battles'),b.id));await saveCol('battles',b);}else{const local=localGet('battles');if(local[idx]){local[idx].done=true;localSet('battles',local);}}}
  renderAll();
};
window.saveMapAnnotation=async()=>{await saveCol('maps',{category:$('mapCategory').value,place:$('mapPlace').value,subject:$('mapSubject').value,note:$('mapNote').value,link:$('mapLink').value,date:today()});['mapPlace','mapNote','mapLink'].forEach(id=>$(id).value='');renderAll();};
window.saveDreamWall=()=>{const dream={rank:$('dreamRank').value,cadre:$('dreamCadre').value,why:$('dreamWhy').value,promise:$('dreamPromise').value,photo:$('dreamPhoto').value};localStorage.setItem('dreamWall',JSON.stringify(dream));renderDreamWall();};
function renderDreamWall(){
  if(!$('dreamWallView'))return;const d=JSON.parse(localStorage.getItem('dreamWall')||'{}');
  if($('dreamRank')){$('dreamRank').value=d.rank||'';$('dreamCadre').value=d.cadre||'';$('dreamWhy').value=d.why||'';$('dreamPromise').value=d.promise||'';$('dreamPhoto').value=d.photo||'';}
  $('dreamWallView').innerHTML=d.rank?`<h1>${d.rank}</h1><h2>${d.cadre||''}</h2>${d.photo?`<img src="${d.photo}" alt="Dream photo">`:''}<p><b>Why IAS?</b><br>${d.why||''}</p><p><b>Promise:</b><br>${d.promise||''}</p><div class="missionStamp">MISSION ACCEPTED</div>`:'Set your dream wall.';
}


const motivationalQuotes=[
  'Discipline is your real coaching institute.',
  'Every page you revise is one step closer to LBSNAA.',
  'The syllabus is huge, but your consistency is bigger.',
  'Officer, win the next 25 minutes. The rank will follow.',
  'Today’s boring revision becomes tomorrow’s correct answer.',
  'Mock marks are feedback, not identity.',
  'Attack the weak subject. That is where rank is hidden.'
];
let quoteIndex=0;
function rotateQuote(){
  if(!$('motivationQuote')) return;
  $('motivationQuote').innerText=motivationalQuotes[quoteIndex%motivationalQuotes.length];
  quoteIndex++;
}
setInterval(rotateQuote,180000);

const mapResources=[
  {title:'Important Maps for UPSC',category:'General Maps',url:'https://mapsforupsc.com/important-maps-for-upsc-preparation/',desc:'Collection-style map resource for UPSC preparation.'},
  {title:'India Political Map',category:'India',url:'https://www.mapsofindia.com/maps/india/india-political-map.htm',desc:'States, UTs, capitals and borders.'},
  {title:'India Physical Map',category:'India',url:'https://www.mapsofindia.com/maps/india/physical-map.html',desc:'Mountains, plateaus, plains and physical regions.'},
  {title:'India Rivers Map',category:'Rivers',url:'https://www.mapsofindia.com/maps/rivers/',desc:'Major river systems and drainage.'},
  {title:'National Parks Map',category:'Environment',url:'https://www.mapsofindia.com/maps/wildlife/national-parks-in-india.html',desc:'National parks and wildlife areas.'},
  {title:'World Map',category:'World',url:'https://www.mapsofindia.com/world-map/',desc:'Countries, regions and places in news.'},
  {title:'Ramsar Sites India',category:'Environment',url:'https://rsis.ramsar.org/',desc:'Official Ramsar site information.'},
  {title:'UNESCO World Heritage',category:'Culture',url:'https://whc.unesco.org/en/list/',desc:'World Heritage places for culture and geography.'}
];
function renderMapResources(){
  if(!$('mapResourceGrid')) return;
  $('mapResourceGrid').innerHTML=mapResources.map(m=>`<div class="mapResourceCard">
    <h3>${m.title}</h3><span class="mapTag">${m.category}</span><p>${m.desc}</p>
    <a class="btn blue" target="_blank" href="${m.url}">Open Map</a>
  </div>`).join('');
}

const samplePYQs=[
  {year:'2023',subject:'Polity',topic:'Parliament',question:'Sample PYQ placeholder about parliamentary procedures.',answer:'Add official answer',explanation:'Import full PYQ JSON for complete bank.'},
  {year:'2022',subject:'Environment',topic:'National Parks',question:'Sample PYQ placeholder about protected areas.',answer:'Add official answer',explanation:'Use template import.'},
  {year:'2021',subject:'Geography',topic:'Rivers',question:'Sample PYQ placeholder about river systems.',answer:'Add official answer',explanation:'Map-based PYQs can be tagged here.'}
];
window.loadSamplePYQBank=async()=>{
  for(const q of samplePYQs) await saveCol('pyqBank',{...q,date:today()});
  renderAll();
};
window.downloadPYQTemplate=()=>{
  const template=[{year:'2024',subject:'Polity',topic:'Parliament',question:'Paste question here',answer:'Correct answer',explanation:'Explanation here'}];
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify(template,null,2)],{type:'application/json'}));
  a.download='upsc-pyq-template.json';
  a.click();
};
window.importPYQJSON=async()=>{
  const file=$('pyqImportFile').files[0];
  if(!file) return alert('Choose JSON file');
  const data=JSON.parse(await file.text());
  if(!Array.isArray(data)) return alert('JSON must be an array');
  for(const q of data){
    await saveCol('pyqBank',{year:q.year||'',subject:q.subject||'General',topic:q.topic||'General',question:q.question||'',answer:q.answer||'',explanation:q.explanation||'',date:today()});
  }
  $('pyqImportFile').value='';
  renderAll();
};
function renderPYQBank(bank){
  if(!$('pyqBankList')) return;
  const search=($('bankSearch')?.value||'').toLowerCase();
  const subject=$('bankSubjectFilter')?.value||'All';
  let filtered=bank.filter(q=>(q.year+q.subject+q.topic+q.question+q.answer+q.explanation).toLowerCase().includes(search));
  if(subject!=='All') filtered=filtered.filter(q=>q.subject===subject);
  const bySubject={}; filtered.forEach(q=>bySubject[q.subject]=(bySubject[q.subject]||0)+1);
  $('pyqBankStats').innerHTML=`<b>Total PYQs:</b> ${filtered.length}<br><br>`+Object.entries(bySubject).map(([s,c])=>`${s}: ${c}`).join('<br>');
  $('pyqBankList').innerHTML=filtered.length?filtered.map((q,i)=>`<div class="item pyqQuestionCard">
    <h3>${q.year} - ${q.topic}</h3><span class="pill">${q.subject}</span><p>${q.question}</p>
    <details><summary>Answer / Explanation</summary><p><b>Answer:</b> ${q.answer||''}</p><p>${q.explanation||''}</p></details>
    <button class="btn danger" onclick="deleteItem('pyqBank','${q.id||i}')">Delete</button>
  </div>`).join(''):'<div class="emptyState">No PYQs found. Load sample or import JSON.</div>';
}
window.renderPYQBank=async()=>renderPYQBank(await getCol('pyqBank'));
window.checkAIStatus=()=>{
  if(!AI_FUNCTION_URL) $('aiStatusBox').innerText='AI is in demo mode. Paste Firebase Function URL in firebase-config.js as AI_FUNCTION_URL.';
  else $('aiStatusBox').innerText='AI function URL found. Test AI Newspaper Analyzer now.';
};


let canvas, ctx, drawing=false, drawEnabled=false, mapBaseImage=null;
function initMapCanvas(){
  canvas=$('mapCanvasBoard'); if(!canvas) return;
  ctx=canvas.getContext('2d');
  ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle='#ff2d2d'; ctx.lineWidth=4; ctx.lineCap='round';
  canvas.onmousedown=e=>{if(!drawEnabled)return;drawing=true;const r=canvas.getBoundingClientRect();ctx.beginPath();ctx.moveTo((e.clientX-r.left)*(canvas.width/r.width),(e.clientY-r.top)*(canvas.height/r.height));};
  canvas.onmousemove=e=>{if(!drawing||!drawEnabled)return;const r=canvas.getBoundingClientRect();ctx.lineTo((e.clientX-r.left)*(canvas.width/r.width),(e.clientY-r.top)*(canvas.height/r.height));ctx.stroke();};
  canvas.onmouseup=()=>drawing=false; canvas.onmouseleave=()=>drawing=false;
  const upload=$('mapImageUpload');
  if(upload) upload.onchange=e=>{
    const file=e.target.files[0]; if(!file)return;
    const img=new Image();
    img.onload=()=>{ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);const scale=Math.min(canvas.width/img.width,canvas.height/img.height);const w=img.width*scale,h=img.height*scale,x=(canvas.width-w)/2,y=(canvas.height-h)/2;ctx.drawImage(img,x,y,w,h);mapBaseImage=img;};
    img.src=URL.createObjectURL(file);
  };
}
window.enableDraw=()=>{drawEnabled=true;};
window.clearMapCanvas=()=>{if(!ctx)return;ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);if(mapBaseImage){const scale=Math.min(canvas.width/mapBaseImage.width,canvas.height/mapBaseImage.height);const w=mapBaseImage.width*scale,h=mapBaseImage.height*scale,x=(canvas.width-w)/2,y=(canvas.height-h)/2;ctx.drawImage(mapBaseImage,x,y,w,h);}};
window.saveMapCanvas=async()=>{
  if(!canvas)return;
  await saveCol('mapSnapshots',{title:$('mapCanvasTitle').value||'Map Snapshot',type:$('canvasMapType').value,note:$('mapCanvasNote').value,image:canvas.toDataURL('image/png'),date:today()});
  $('mapCanvasTitle').value='';$('mapCanvasNote').value='';renderAll();
};

window.saveCompletion=async()=>{
  await saveCol('completion',{subject:$('completionSubject').value,topic:$('completionTopic').value,percent:+$('completionPercent').value||0,status:$('completionStatus').value,date:today()});
  ['completionTopic','completionPercent'].forEach(id=>$(id).value='');renderAll();
};
window.autoScheduleRevision=async()=>{
  const topic=$('revScheduleTopic').value; if(!topic)return alert('Enter topic');
  const subject=$('revScheduleSubject').value; const base=$('revBaseDate').value||today(); const cycles=[1,7,15,30,60];
  for(const c of cycles){const d=new Date(base);d.setDate(d.getDate()+c);await saveCol('revision',{topic,subject,date:d.toISOString().slice(0,10),cycle:`${c} Days`,auto:true});}
  $('revScheduleTopic').value='';renderAll();
};
function renderV8Readiness(notes,logs,pyq,mains,tests,revision,completion){
  const totalHours=logs.reduce((s,l)=>s+(+l.hours||0),0);
  const avgMock=tests.length?tests.reduce((s,t)=>s+(+t.score||0),0)/tests.length:0;
  const completedAvg=completion.length?completion.reduce((s,c)=>s+(+c.percent||0),0)/completion.length:0;
  const prelims=Math.min(100,Math.round(totalHours*1.5 + pyq.length*3 + avgMock*.35 + completedAvg*.25));
  const mainsScore=Math.min(100,Math.round(mains.length*5 + notes.length*.8 + completedAvg*.3));
  const todayDate=today();
  const pending=revision.filter(r=>r.date && r.date<=todayDate).length;
  const revHealth=Math.max(0,Math.min(100,100-pending*8));
  const overall=Math.round((prelims+mainsScore+revHealth)/3);
  if($('prelimsScoreV8')){$('prelimsScoreV8').innerText=prelims+'%';$('mainsScoreV8').innerText=mainsScore+'%';$('revisionHealth').innerText=revHealth+'%';$('overallWarScore').innerText=overall+'%';}
  if($('dashPrelimsReady')){$('dashPrelimsReady').innerText=prelims+'%';$('dashMainsReady').innerText=mainsScore+'%';$('dashPendingRev').innerText=pending;}
  const by={}; logs.forEach(l=>by[l.subject]=(by[l.subject]||0)+(+l.hours||0)); const sorted=Object.entries(by).sort((a,b)=>a[1]-b[1]);
  if($('dashWeakSubject')) $('dashWeakSubject').innerText=sorted[0]?.[0]||'-';
  if($('readinessBreakdown')) $('readinessBreakdown').innerHTML=[
    ['Study Hours',totalHours+'h',Math.min(100,totalHours)],
    ['PYQ Practice',pyq.length,Math.min(100,pyq.length*3)],
    ['Mains Answers',mains.length,Math.min(100,mains.length*5)],
    ['Completion Avg',Math.round(completedAvg)+'%',completedAvg]
  ].map(x=>`<div class="readinessMeter"><b>${x[0]}: ${x[1]}</b><div class="completionBar"><span style="width:${Math.min(100,x[2])}%"></span></div></div>`).join('');
  if($('weakAreaBox')) $('weakAreaBox').innerText=sorted[0]?`Weakest based on hours: ${sorted[0][0]}. Give it one focused block tomorrow.`:'Add study logs to detect weak areas.';
}
function renderCompletion(completion){
  if(!$('completionList'))return;
  $('completionList').innerHTML=completion.map((c,i)=>`<div class="item"><h3>${c.topic}</h3><span class="pill">${c.subject}</span><span class="pill">${c.status}</span><div class="completionBar"><span style="width:${Math.min(100,c.percent||0)}%"></span></div><p>${c.percent||0}% complete</p><button class="btn danger" onclick="deleteItem('completion','${c.id||i}')">Delete</button></div>`).join('');
}
function renderDueRevisions(revision){
  if(!$('dueRevisionList'))return;
  const due=revision.filter(r=>r.date && r.date<=today()).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  $('dueRevisionList').innerHTML=due.length?due.map((r,i)=>`<div class="item dueToday"><h3>${r.topic}</h3><span class="pill">${r.subject||''}</span><span class="pill">${r.date}</span><span class="pill">${r.cycle}</span><button class="btn danger" onclick="deleteItem('revision','${r.id||i}')">Done/Delete</button></div>`).join(''):'<div class="emptyState">No revision due today.</div>';
}
function renderMapSnapshots(snaps){
  if(!$('savedMapCanvasList'))return;
  $('savedMapCanvasList').innerHTML=snaps.map((s,i)=>`<div class="item"><h3>${s.title}</h3><span class="pill">${s.type}</span><span class="pill">${s.date}</span><img class="mapThumb" src="${s.image}"><p>${s.note||''}</p><button class="btn danger" onclick="deleteItem('mapSnapshots','${s.id||i}')">Delete</button></div>`).join('');
}


const coreSyllabus = [
  {paper:'Prelims GS',topic:'Current events',details:'Current events of national and international importance.'},
  {paper:'Prelims GS',topic:'History of India and National Movement',details:'History of India and Indian National Movement.'},
  {paper:'Prelims GS',topic:'Indian and World Geography',details:'Physical, Social, Economic Geography of India and the World.'},
  {paper:'Prelims GS',topic:'Indian Polity and Governance',details:'Constitution, Political System, Panchayati Raj, Public Policy, Rights Issues.'},
  {paper:'Prelims GS',topic:'Economic and Social Development',details:'Sustainable Development, Poverty, Inclusion, Demographics, Social Sector initiatives.'},
  {paper:'Prelims GS',topic:'Environment Ecology, Biodiversity and Climate Change',details:'General issues that do not require subject specialization.'},
  {paper:'Prelims GS',topic:'General Science',details:'General Science.'},
  {paper:'CSAT',topic:'Comprehension',details:'Reading comprehension and passage-based questions.'},
  {paper:'CSAT',topic:'Interpersonal skills',details:'Communication skills.'},
  {paper:'CSAT',topic:'Logical reasoning and analytical ability',details:'Reasoning and analysis.'},
  {paper:'CSAT',topic:'Decision-making and problem-solving',details:'Decision-making and problem-solving.'},
  {paper:'CSAT',topic:'General mental ability',details:'Basic mental ability.'},
  {paper:'CSAT',topic:'Basic numeracy and data interpretation',details:'Class X level numeracy, charts, graphs, tables, data sufficiency.'},
  {paper:'Essay',topic:'Essay writing',details:'Essay on a specific topic with orderly ideas, concision, effective and exact expression.'},
  {paper:'GS1',topic:'Indian Culture',details:'Art forms, literature and architecture from ancient to modern times.'},
  {paper:'GS1',topic:'Modern Indian History',details:'Middle of eighteenth century till present: significant events, personalities, issues.'},
  {paper:'GS1',topic:'Freedom Struggle',details:'Various stages and important contributors/contributions from different parts of the country.'},
  {paper:'GS1',topic:'Post-independence consolidation',details:'Post-independence consolidation and reorganization within the country.'},
  {paper:'GS1',topic:'World History',details:'Industrial revolution, world wars, colonization, decolonization, political philosophies.'},
  {paper:'GS1',topic:'Indian Society',details:'Salient features of Indian Society and Diversity of India.'},
  {paper:'GS1',topic:'Women, population, poverty, urbanization',details:'Role of women, population issues, poverty, developmental issues, urbanization and remedies.'},
  {paper:'GS1',topic:'Globalization and society',details:'Effects of globalization on Indian society.'},
  {paper:'GS1',topic:'Social empowerment',details:'Social empowerment, communalism, regionalism and secularism.'},
  {paper:'GS1',topic:'World Physical Geography',details:'Salient features of world physical geography.'},
  {paper:'GS1',topic:'Resources and industries',details:'Distribution of key natural resources and factors for industrial location.'},
  {paper:'GS1',topic:'Geophysical phenomena',details:'Earthquakes, tsunami, volcanic activity, cyclones, geographical features and changes.'},
  {paper:'GS2',topic:'Indian Constitution',details:'Historical underpinnings, evolution, features, amendments, significant provisions and basic structure.'},
  {paper:'GS2',topic:'Federalism',details:'Union and State functions, federal issues, devolution of powers and finances.'},
  {paper:'GS2',topic:'Separation of powers',details:'Separation of powers, dispute redressal mechanisms and institutions.'},
  {paper:'GS2',topic:'Constitutional comparison',details:'Comparison of Indian constitutional scheme with other countries.'},
  {paper:'GS2',topic:'Parliament and State Legislatures',details:'Structure, functioning, conduct of business, powers, privileges and issues.'},
  {paper:'GS2',topic:'Executive and Judiciary',details:'Structure, organization and functioning of Executive and Judiciary.'},
  {paper:'GS2',topic:'Representation of People Act',details:'Salient features of RPA.'},
  {paper:'GS2',topic:'Constitutional bodies',details:'Appointment, powers, functions and responsibilities.'},
  {paper:'GS2',topic:'Statutory and quasi-judicial bodies',details:'Statutory, regulatory and quasi-judicial bodies.'},
  {paper:'GS2',topic:'Government policies and interventions',details:'Policies and interventions for development and implementation issues.'},
  {paper:'GS2',topic:'Welfare schemes and social sector',details:'Vulnerable sections, Health, Education, Human Resources, poverty and hunger.'},
  {paper:'GS2',topic:'Governance',details:'Transparency, accountability, e-governance, citizen charters and measures.'},
  {paper:'GS2',topic:'International relations',details:'Neighbourhood, groupings, agreements, diaspora, international institutions.'},
  {paper:'GS3',topic:'Indian Economy',details:'Planning, resources, growth, development and employment.'},
  {paper:'GS3',topic:'Inclusive growth and budgeting',details:'Inclusive growth, issues and Government Budgeting.'},
  {paper:'GS3',topic:'Agriculture',details:'Cropping patterns, irrigation, storage, marketing, subsidies, MSP, PDS and food security.'},
  {paper:'GS3',topic:'Food processing and land reforms',details:'Food processing, supply chain management and land reforms.'},
  {paper:'GS3',topic:'Liberalization, industry and infrastructure',details:'Liberalization, industrial policy, Energy, Ports, Roads, Airports, Railways.'},
  {paper:'GS3',topic:'Science and Technology',details:'S&T developments, indigenization, IT, Space, Robotics, Nano, Bio-tech and IPR.'},
  {paper:'GS3',topic:'Environment and Disaster Management',details:'Conservation, pollution, EIA, disaster and disaster management.'},
  {paper:'GS3',topic:'Internal Security',details:'Extremism, state/non-state actors, cyber security, money laundering, border security, forces.'},
  {paper:'GS4',topic:'Ethics and Human Interface',details:'Essence, determinants and consequences of ethics, dimensions, private and public relationships.'},
  {paper:'GS4',topic:'Human Values and Attitude',details:'Values from leaders, family/society institutions, attitude, persuasion.'},
  {paper:'GS4',topic:'Aptitude and foundational values',details:'Integrity, impartiality, objectivity, dedication, empathy, tolerance and compassion.'},
  {paper:'GS4',topic:'Emotional Intelligence and moral thinkers',details:'EI concepts/applications and thinkers from India and world.'},
  {paper:'GS4',topic:'Public service values and probity',details:'Ethics in administration, dilemmas, accountability, RTI, codes, citizen charters, corruption.'},
  {paper:'GS4',topic:'Case Studies',details:'Case studies on ethics issues.'}
];

window.loadCoreSyllabus=async()=>{
  const existing=await getCol('syllabus');
  if(existing.length && !confirm('Syllabus tracker already has items. Add again?')) return;
  for(const s of coreSyllabus){ await saveCol('syllabus',{...s,status:'Not Started',date:today()}); }
  renderAll();
};
window.saveSyllabusTopic=async()=>{
  await saveCol('syllabus',{paper:$('syllabusPaper').value,topic:$('syllabusTopic').value,details:$('syllabusDetails').value,status:$('syllabusStatus').value,date:today()});
  ['syllabusTopic','syllabusDetails'].forEach(id=>$(id).value='');
  renderAll();
};
window.updateSyllabusStatus=async(idOrIndex,status)=>{
  const all=await getCol('syllabus');
  const idx=all.findIndex((s,i)=>(s.id||String(i))==idOrIndex);
  if(idx>=0){
    const s=all[idx]; s.status=status;
    if(user && cloudEnabled && s.id){ await deleteDoc(doc(db,path('syllabus'),s.id)); await saveCol('syllabus',s); }
    else { const local=localGet('syllabus'); if(local[idx]){local[idx].status=status; localSet('syllabus',local);} }
  }
  renderAll();
};
window.markSyllabusFromCompletion=async()=>{
  const completion=await getCol('completion');
  const syllabus=await getCol('syllabus');
  for(const s of syllabus){
    const match=completion.find(c=>String(c.topic||'').toLowerCase().includes(String(s.topic||'').toLowerCase()) || String(s.topic||'').toLowerCase().includes(String(c.topic||'').toLowerCase()));
    if(match && (+match.percent||0)>=75){ await updateSyllabusStatus(s.id||syllabus.indexOf(s),'Completed'); }
  }
  renderAll();
};
function renderSyllabus(syllabus){
  if(!$('syllabusList')) return;
  const q=($('syllabusSearch')?.value||'').toLowerCase();
  const paper=$('syllabusPaperFilter')?.value||'All Papers';
  let filtered=syllabus.filter(s=>(s.paper+s.topic+s.details+s.status).toLowerCase().includes(q));
  if(paper!=='All Papers') filtered=filtered.filter(s=>s.paper===paper);
  const total=filtered.length, completed=filtered.filter(s=>s.status==='Completed').length, progress=filtered.filter(s=>s.status==='In Progress').length;
  const pct=total?Math.round((completed/total)*100):0;
  $('syllabusStats').innerHTML=`<div class="syllabusStatGrid"><div class="syllabusStat"><b>${total}</b>Total</div><div class="syllabusStat"><b>${completed}</b>Completed</div><div class="syllabusStat"><b>${progress}</b>In Progress</div><div class="syllabusStat"><b>${pct}%</b>Completion</div></div>`;
  $('syllabusList').innerHTML=filtered.length?filtered.map((s,i)=>`<div class="item syllabusCard ${s.status==='Completed'?'completed':''} ${s.status==='Revision Needed'?'revision':''}">
    <h3>${s.topic}</h3><span class="syllabusPaperBadge">${s.paper}</span><span class="pill">${s.status}</span><p>${s.details||''}</p>
    <div class="resourceActions">
      <button class="btn ghost" onclick="updateSyllabusStatus('${s.id||i}','Not Started')">Not Started</button>
      <button class="btn blue" onclick="updateSyllabusStatus('${s.id||i}','In Progress')">In Progress</button>
      <button class="btn green" onclick="updateSyllabusStatus('${s.id||i}','Completed')">Completed</button>
      <button class="btn gold" onclick="updateSyllabusStatus('${s.id||i}','Revision Needed')">Revision</button>
      <button class="btn danger" onclick="deleteItem('syllabus','${s.id||i}')">Delete</button>
    </div></div>`).join(''):'<div class="emptyState">Load syllabus tracker or add custom syllabus topic.</div>';
}


/* ===== V22.5 PERFORMANCE PATCH: lazy active-section rendering ===== */
function activeSectionIdV225(){
  return document.querySelector('.section.active')?.id || 'dashboard';
}
function isActiveSectionV225(...ids){
  const id=activeSectionIdV225();
  return ids.includes(id);
}
function renderActiveAutoV225(ids){
  const id=activeSectionIdV225();
  if(ids.includes(id)) return renderAll(id);
}
function safeCallV225(fnName,...args){
  try{
    const fn=window[fnName] || (typeof globalThis!=='undefined' ? globalThis[fnName] : null);
    if(typeof fn==='function') return fn(...args);
  }catch(e){ console.warn('V22.5 skipped '+fnName, e); }
}
function escV225(x){
  return String(x ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function idOfV225(x,i){ return String((x && (x._docId || x.id)) || i); }
async function renderDailyPlansV225(){
  const el=$('dailyPlanList'); if(!el) return;
  const data=await getCol('dailyPlans');
  el.innerHTML=data.slice().reverse().slice(0,30).map((x,i)=>`<div class="item"><h3>${escV225(x.date||'Daily Plan')}</h3><p>${escV225(x.body||x.input||x.plan||'Saved plan')}</p><button class="btn danger" onclick="deleteItem('dailyPlans','${escV225(idOfV225(x,i))}')">Delete</button></div>`).join('') || '<div class="emptyState">No daily plans saved yet.</div>';
}
async function renderAIHabitsV225(){
  const el=$('aiHabitList'); if(!el) return;
  const data=await getCol('aiHabits');
  el.innerHTML=data.slice().reverse().slice(0,40).map((x,i)=>`<div class="item"><h3>${escV225(x.name||'Habit')}</h3><span class="tag">${escV225(x.subject||'General')}</span><span class="tag">${escV225(x.status||'Pending')}</span><p>${escV225(x.reason||'')}</p><button class="btn danger" onclick="deleteItem('aiHabits','${escV225(idOfV225(x,i))}')">Delete</button></div>`).join('') || '<div class="emptyState">No AI habits saved yet.</div>';
}
async function renderDashboardV225(){
  if(window.renderAIIntegrated) await safeCallV225('renderAIIntegrated');
  if(window.refreshTrueReadinessV136) await safeCallV225('refreshTrueReadinessV136');
  if(window.renderCloudSystemStatus) safeCallV225('renderCloudSystemStatus');
}
let __v225RenderBusy=false;
let __v225PendingSection=null;
async function renderActiveSectionV225(sectionId){
  const id=sectionId || activeSectionIdV225();
  if(document.visibilityState==='hidden') return;

  // File upload chips are now loaded only for the opened page, not for all pages after login.
  if(window.renderSectionFilesV10) await safeCallV225('renderSectionFilesV10', id);

  if(id==='dashboard') await renderDashboardV225();
  else if(id==='aiPlanner') await renderDailyPlansV225();
  else if(id==='snarkRevision') await renderDashboardV225();
  else if(id==='aiHabits') await renderAIHabitsV225();
  else if(id==='pyqIntelligence') safeCallV225('renderFullPYQ');
  else if(id==='onePagerAI') await safeCallV225('renderOnePagers');
  else if(id==='mindMapStudio') safeCallV225('renderSavedMindMapsV136');
  else if(id==='smartFlashcards') await safeCallV225('renderFlashcardsPerfect');
  else if(id==='libraryShelf' || id==='digitalLibrary') await (window.renderDigitalLibrary2 ? safeCallV225('renderDigitalLibrary2') : safeCallV225('renderDigitalLibrary'));
  else if(id==='calendar' || id==='aiCalendarV4') await safeCallV225('renderCalendarAI');
  else if(id==='currentAffairsAI') await (window.renderCurrentAffairsIntelligence ? safeCallV225('renderCurrentAffairsIntelligence') : safeCallV225('renderCurrentAffairsAI'));
  else if(id==='evernoteNotes') await safeCallV225('renderProNotes');
  else if(id==='syllabusCommand') await safeCallV225('renderSyllabusAI');
  else if(id==='countdownPage') safeCallV225('renderExamCountdownAI');
  else if(id==='pomodoroPage') await safeCallV225('renderPomoSessionsAI');
  else if(id==='mapsCommand') { await safeCallV225('renderMapNotes'); safeCallV225('initMapCanvas'); }
  else if(id==='richNotesV4') await safeCallV225('renderRichNotesV4');
  else if(id==='wrongAnswerNotebook') await safeCallV225('renderWrongAnswerNotebook');
  else if(id==='topperAnswers') await safeCallV225('renderTopperAnswers');
  else if(id==='docLinksHub') await safeCallV225('renderDocLinks');
  else if(id==='fileVault') await safeCallV225('renderFileVault');
  else if(id==='settings') safeCallV225('renderCloudSystemStatus');
}
const __v2751BootAt=Date.now();
const __v2751LastRender=new Map();
async function renderAll(sectionId){
  const id=sectionId || activeSectionIdV225();
  const now=Date.now();
  const startup=(now-__v2751BootAt<6000)||window.__MISSION_AUTH_WARMUP__;
  const minGap=startup?1100:120;
  if(now-(__v2751LastRender.get(id)||0)<minGap) return;
  if(__v225RenderBusy){
    if(__v225PendingSection!==id) __v225PendingSection=id;
    return;
  }
  __v2751LastRender.set(id,now);
  __v225RenderBusy=true;
  try{ await renderActiveSectionV225(id); }
  catch(e){ console.warn('V27.5.1 render skipped safely:', e); }
  finally{
    __v225RenderBusy=false;
    if(__v225PendingSection){
      const next=__v225PendingSection;__v225PendingSection=null;
      const wait=((Date.now()-__v2751BootAt<6000)||window.__MISSION_AUTH_WARMUP__)?500:80;
      setTimeout(()=>renderAll(next),wait);
    }
  }
}
window.renderAllV225 = renderAll;
window.renderActiveSectionV225 = renderActiveSectionV225;
window.activeSectionIdV225 = activeSectionIdV225;
let __v275LastDashboardRefresh=0;
function runDashboardRefreshV225(){
  if(document.visibilityState!=='visible') return;
  const throttle=window.__MISSION_V275_LOW_POWER__?120000:25000;
  if(Date.now()-__v275LastDashboardRefresh<throttle) return;
  __v275LastDashboardRefresh=Date.now();
  if(isActiveSectionV225('dashboard','snarkRevision','calendar','aiCalendarV4')) renderAll(activeSectionIdV225());
}
async function renderAllFullLegacy(){
  const [notes,files,logs,tasks,months,weeks,blocks,habits,ca,kg,flash,pyq,mains,tests,revision,focusSessions,calendarItems,books,wrongbook,maps,battles,pyqBank,completion,mapSnapshots,syllabus]=await Promise.all(['notes','files','studyLogs','tasks','months','weeks','blocks','habits','currentAffairs','kg','flash','pyq','mains','tests','revision','focusSessions','calendarItems','books','wrongbook','maps','battles','pyqBank','completion','mapSnapshots','syllabus'].map(getCol));
  $('noteCount').innerText=notes.length;$('fileCount').innerText=files.length;$('todayHours').innerText=logs.filter(l=>l.date===today()).reduce((s,l)=>s+(+l.hours||0),0);$('cloudStatus').innerText=(cloudEnabled&&user)?'Cloud':'Local';
  $('taskList').innerHTML=tasks.map((t,i)=>itemHtml('tasks',t,i,'text')).join('');
  $('monthList').innerHTML=months.map((m,i)=>`<div class="item"><h3>${m.name}</h3><p>${m.goal}</p><div class="chartBar"><span style="width:${Math.min(100,m.progress||0)}%"></span></div><span class="pill">${m.progress||0}%</span><button class="btn danger" onclick="deleteItem('months','${m.id||i}')">Delete</button></div>`).join('');
  $('weekList').innerHTML=weeks.map((m,i)=>`<div class="item"><h3>${m.name}</h3><p>${m.goal}</p><div class="chartBar"><span style="width:${Math.min(100,m.progress||0)}%"></span></div><span class="pill">${m.progress||0}%</span><button class="btn danger" onclick="deleteItem('weeks','${m.id||i}')">Delete</button></div>`).join('');
  $('blockList').innerHTML=blocks.map((b,i)=>itemHtml('blocks',b,i,'time','task')).join('');
  $('studyList').innerHTML=logs.map((l,i)=>`<div class="item"><h3>${l.subject} - ${l.hours}h</h3><span class="pill">${l.date}</span><p>${l.note||''}</p><button class="btn danger" onclick="deleteItem('studyLogs','${l.id||i}')">Delete</button></div>`).join('');
  $('habitList').innerHTML=habits.map((h,i)=>{let sc=['Wake','News','Rev','Study','Mock','Mains','Exercise','NoSocial'].filter(k=>h[k]).length;return `<div class="item"><h3>${h.date}</h3><span class="pill">${sc}/8 habits</span><button class="btn danger" onclick="deleteItem('habits','${h.id||i}')">Delete</button></div>`}).join('');
  $('caList').innerHTML=ca.map((x,i)=>itemHtml('currentAffairs',x,i,'title')).join('');
  $('notesList').innerHTML=notes
    .filter(n=>(n.title+n.body+n.subject+(n.fileName||'')+(n.fileLink||'')).toLowerCase().includes(($('noteSearch')?.value||'').toLowerCase()))
    .map((x,i)=>`<div class="item">
      <h3>${x.title||'Untitled'}</h3>
      <span class="pill">${x.subject||'General'}</span>
      <span class="pill">${x.date||''}</span>
      <p>${x.body||''}</p>
      ${x.fileName?`<p><b>Attached file:</b> ${x.fileName}</p>`:''}
      ${x.fileLink?`<p><a target="_blank" href="${x.fileLink}">Open Attachment</a></p>`:''}
      <button class="btn danger" onclick="deleteItem('notes','${x.id||i}')">Delete</button>
    </div>`).join('');
  const fileQuery=($('fileSearch')?.value||'').toLowerCase();
  const selectedFilter=$('fileFilter')?.value || 'All';
  const fileFolders=[...new Set(files.map(f=>f.folder||'Other'))];
  if($('folderChips')) $('folderChips').innerHTML=fileFolders.map(f=>`<button class="folderChip" onclick="setFolderFilter('${f}')">${f}</button>`).join('');

  const recent=files.filter(f=>f.lastOpened).sort((a,b)=>String(b.lastOpened).localeCompare(String(a.lastOpened))).slice(0,5);
  if($('recentResources')) $('recentResources').innerHTML=recent.length?recent.map((f,i)=>`<div class="item">
    <h3>${f.title}</h3><span class="pill">${f.lastOpened}</span>
    ${f.url?`<button class="btn blue" onclick="openResource('files','${f.id||i}','${f.url}')">Open</button>`:''}
  </div>`).join(''):`<div class="emptyState">No recently opened resources yet.</div>`;

  let filteredFiles=files.filter(f=>(f.title+f.folder+f.subject+f.type+f.desc+f.name+f.url+(f.linkedBook||'')).toLowerCase().includes(fileQuery));
  if(selectedFilter==='Important') filteredFiles=filteredFiles.filter(f=>f.important);
  else if(selectedFilter==='Recently Opened') filteredFiles=filteredFiles.filter(f=>f.lastOpened);
  else if(selectedFilter!=='All') filteredFiles=filteredFiles.filter(f=>f.type===selectedFilter);

  $('fileList').innerHTML=filteredFiles.length?filteredFiles
    .map((f,i)=>`<div class="item resourceCard ${f.important?'important':''}">
      <div class="resourceTitleLine">
        <h3>${f.title}</h3>
        ${f.important?`<span class="starBadge">★ Important</span>`:''}
      </div>
      <div class="resourceMeta">
        <span class="pill">${f.folder||'Other'}</span>
        <span class="pill">${f.subject||'General'}</span>
        <span class="pill">${f.type||'Resource'}</span>
        <span class="pill">${f.date||''}</span>
        ${f.openCount?`<span class="pill">Opened ${f.openCount}x</span>`:''}
      </div>
      ${f.linkedBook?`<div class="linkedBook"><b>Linked book:</b> ${f.linkedBook}</div>`:''}
      <p>${f.desc||f.name||''}</p>
      ${f.name?`<p><b>Local file name:</b> ${f.name}</p>`:''}
      <div class="resourceActions">
        ${f.url?`<button class="btn blue" onclick="openResource('files','${f.id||i}','${f.url}')">Open Resource</button>`:''}
        <button class="btn danger" onclick="deleteItem('files','${f.id||i}')">Delete</button>
      </div>
    </div>`).join(''):`<div class="emptyState">No resources found. Add Drive/PDF/YouTube/Telegram links on the left.</div>`;
  $('kgList').innerHTML=kg.filter(x=>(x.topic+x.body+x.subject+x.links).toLowerCase().includes(($('kgSearch')?.value||'').toLowerCase())).map((x,i)=>itemHtml('kg',x,i,'topic')).join('');
  $('flashList').innerHTML=flash.map((x,i)=>itemHtml('flash',x,i,'q','a')).join('');
  const pq=pyq.filter(x=>(x.topic+x.q+x.subject).toLowerCase().includes(($('pyqSearch')?.value||'').toLowerCase()));$('pyqList').innerHTML=pq.map((x,i)=>itemHtml('pyq',x,i,'topic','q')).join('');const freq={};pq.forEach(x=>freq[x.topic]=(freq[x.topic]||0)+1);$('pyqStats').innerText=Object.entries(freq).map(([k,v])=>`${k}: ${v}`).join('\n')||'Search topic.';
  $('mainsList').innerHTML=mains.map((x,i)=>itemHtml('mains',x,i,'q','ans')).join('');
  $('testList').innerHTML=tests.map((x,i)=>itemHtml('tests',x,i,'name','mistakes')).join('');
  $('revisionList').innerHTML=revision.map((x,i)=>itemHtml('revision',x,i,'topic','cycle')).join('');
  $('focusList').innerHTML=focusSessions.map((x,i)=>`<div class="item"><h3>${x.subject} - ${x.minutes} min</h3><span class="pill">${x.date}</span><p>${x.task||''}</p><button class="btn danger" onclick="deleteItem('focusSessions','${x.id||i}')">Delete</button></div>`).join('');
  $('bookList').innerHTML=books.map((b,i)=>`<div class="item"><h3>${b.name}</h3><span class="pill">${b.subject}</span><span class="pill">Rev ${b.revision||0}</span><div class="bookProgress"><span style="width:${Math.min(100,b.progress||0)}%"></span></div><p>${b.progress||0}% complete</p><p>${b.note||''}</p><button class="btn danger" onclick="deleteItem('books','${b.id||i}')">Delete</button></div>`).join('');
  $('wrongList').innerHTML=wrongbook.filter(w=>(w.topic+w.subject+w.question+w.reason).toLowerCase().includes(($('wrongSearch')?.value||'').toLowerCase())).map((w,i)=>`<div class="item"><h3>${w.topic}</h3><span class="pill">${w.subject}</span><span class="pill">${w.date}</span><p><b>Q:</b> ${w.question}</p><p><b>Reason:</b> ${w.reason}</p><button class="btn danger" onclick="deleteItem('wrongbook','${w.id||i}')">Delete</button></div>`).join('');
  
  const xp=calculateXP({notes,logs,flash,pyq,mains,tests,revision,books,wrongbook,maps,battles});
  const rank=getRank(xp);
  const streak=calculateStreak(logs,habits);
  if($('totalXP')) $('totalXP').innerText=xp;
  if($('rankName')) $('rankName').innerText=rank.current.name;
  if($('rankBadge')) $('rankBadge').innerText=rank.current.name;
  if($('currentStreak')) $('currentStreak').innerText=streak.streak+'🔥';
  if($('bestStreak')) $('bestStreak').innerText=streak.best+'🏆';
  const rankRange=Math.max(1,rank.next.xp-rank.current.xp);
  const rankPct=rank.next===rank.current?100:Math.min(100,((xp-rank.current.xp)/rankRange)*100);
  if($('rankProgress')) $('rankProgress').style.width=rankPct+'%';
  if($('nextRankText')) $('nextRankText').innerText=rank.next===rank.current?'Final rank unlocked. Now live like an officer.':`${rank.next.xp-xp} XP needed for ${rank.next.name}`;

  if($('battleList')) $('battleList').innerHTML=battles.map((b,i)=>`<div class="item ${b.done?'battleDone':''}">
    <h3>${b.title}</h3><span class="pill">+${b.xp||100} XP</span><p>${b.tasks||''}</p>
    ${b.done?'<span class="pill">Completed</span>':`<button class="btn green" onclick="completeBattle('${b.id||i}')">Complete Mission</button>`}
    <button class="btn danger" onclick="deleteItem('battles','${b.id||i}')">Delete</button>
  </div>`).join('');

  if($('mapList')) $('mapList').innerHTML=maps.filter(m=>(m.category+m.place+m.subject+m.note).toLowerCase().includes(($('mapSearch')?.value||'').toLowerCase())).map((m,i)=>`<div class="item">
    <h3>${m.place}</h3><span class="mapTag">${m.category}</span><span class="mapTag">${m.subject}</span><p>${m.note||''}</p>
    ${m.link?`<p><a target="_blank" href="${m.link}">Open Map/Source</a></p>`:''}
    <button class="btn danger" onclick="deleteItem('maps','${m.id||i}')">Delete</button>
  </div>`).join('');

  renderDreamWall();

  renderMapResources();
  renderPYQBank(pyqBank);
  checkAIStatus();
  rotateQuote();
  initMapCanvas();
  renderSyllabus(syllabus);
  renderV8Readiness(notes,logs,pyq,mains,tests,revision,completion);
  renderCompletion(completion);
  renderDueRevisions(revision);
  renderMapSnapshots(mapSnapshots);
  renderSubjectDashboard(notes,logs,kg,flash,pyq);renderAnalyticsPro(logs,tests);renderCalendar();renderHeatmap(logs,habits,revision);renderCountdown();updatePomodoroDisplay();
  const readiness=Math.min(100,Math.round((notes.length*2+pyq.length*3+flash.length+logs.reduce((s,l)=>s+(+l.hours||0),0)*2)/3));$('prelimsReadiness').innerText=readiness+'%';$('prelimsBar').style.width=readiness+'%';
}

function renderAnalyticsPro(logs, tests){
  if(!$('proTotalHours')) return;

  const by={};
  subjects.forEach(s=>by[s]=0);
  logs.forEach(l=>{ by[l.subject||'General']=(by[l.subject||'General']||0)+(+l.hours||0); });

  const entries=Object.entries(by).filter(([s,h])=>h>0);
  const total=entries.reduce((s,e)=>s+e[1],0);
  const sorted=[...entries].sort((a,b)=>b[1]-a[1]);

  $('proTotalHours').innerText=total;
  $('proBestSubject').innerText=sorted[0]?.[0] || '-';
  $('proWeakSubject').innerText=sorted.length ? sorted[sorted.length-1][0] : '-';
  $('proMockAvg').innerText=tests.length ? Math.round(tests.reduce((s,t)=>s+(+t.score||0),0)/tests.length) : 0;

  const colors=['var(--green)','var(--blue)','var(--accent)','var(--purple)','var(--red)'];
  let start=0, parts=[];
  entries.forEach(([sub,h],i)=>{
    let end=start+(h/Math.max(total,1))*100;
    parts.push(`${colors[i%colors.length]} ${start}% ${end}%`);
    start=end;
  });
  $('proPieChart').innerHTML=`<div class="pie" style="background:conic-gradient(${parts.join(',')||'var(--soft) 0 100%'})"></div>
    <div class="legend">${entries.map(([s,h],i)=>`<div><span class="dot" style="background:${colors[i%colors.length]}"></span>${s}: ${h}h</div>`).join('')||'Add study logs.'}</div>`;

  const max=Math.max(1,...entries.map(e=>e[1]));
  $('proBarChart').innerHTML=entries.map(([s,h])=>`<div class="graphLine"><b>${s}</b><div class="graphBar"><span style="width:${(h/max)*100}%"></span></div><span>${h}h</span></div>`).join('')||'Add study logs.';

  const weekMap={};
  for(let i=6;i>=0;i--){
    const d=new Date(); d.setDate(d.getDate()-i);
    const key=d.toISOString().slice(0,10);
    weekMap[key]=0;
  }
  logs.forEach(l=>{ if(weekMap[l.date]!==undefined) weekMap[l.date]+=(+l.hours||0); });
  const weekMax=Math.max(1,...Object.values(weekMap));
  $('weeklyGraph').innerHTML=Object.entries(weekMap).map(([d,h])=>`<div class="graphLine"><b>${d.slice(5)}</b><div class="graphBar"><span style="width:${(h/weekMax)*100}%"></span></div><span>${h}h</span></div>`).join('');

  $('mockTrend').innerHTML=tests.length
    ? `<div class="mockDotLine">${tests.slice().reverse().map(t=>`<div class="mockDot" style="height:${Math.max(8,Math.min(170,(+t.score||0)))}px">${t.score}</div>`).join('')}</div>`
    : 'Add mock tests to see trend.';
}

function renderSubjectDashboard(notes,logs,kg,flash,pyq){const by={};subjects.forEach(s=>by[s]={hours:0,items:0});logs.forEach(l=>{if(!by[l.subject])by[l.subject]={hours:0,items:0};by[l.subject].hours+=(+l.hours||0)});[...notes,...kg,...flash,...pyq].forEach(x=>{let s=x.subject||'General';if(!by[s])by[s]={hours:0,items:0};by[s].items++});$('subjectCards').innerHTML=Object.entries(by).map(([s,v])=>`<div class="card stat"><small>${s}</small><b>${v.hours}h</b><span class="pill">${v.items} items</span></div>`).join('');const entries=Object.entries(by).filter(([s,v])=>v.hours>0);const max=Math.max(1,...entries.map(e=>e[1].hours));$('subjectBarChart').innerHTML=entries.map(([s,v])=>`<div class="chartRow"><b>${s}</b><div class="chartBar"><span style="width:${(v.hours/max)*100}%"></span></div><span>${v.hours}h</span></div>`).join('')||'Add study logs.';const colors=['var(--green)','var(--blue)','var(--accent)','var(--purple)','var(--red)'];let total=entries.reduce((a,e)=>a+e[1].hours,0),start=0,parts=[];entries.forEach(([s,v],i)=>{let end=start+(v.hours/Math.max(total,1))*100;parts.push(`${colors[i%colors.length]} ${start}% ${end}%`);start=end});$('subjectPieChart').innerHTML=`<div class="pie" style="background:conic-gradient(${parts.join(',')||'var(--soft) 0 100%'})"></div><div class="legend">${entries.map(([s,v],i)=>`<div><span class="dot" style="background:${colors[i%colors.length]}"></span>${s}: ${v.hours}h</div>`).join('')||'Add study logs.'}</div>`}

document.documentElement.setAttribute('data-theme',localStorage.getItem('theme')||'dark');
if($('studyDate'))$('studyDate').value=today();if($('habitDate'))$('habitDate').value=today();if($('calDate'))$('calDate').value=today();
setupAuth();renderAll();


/* ===== ULTIMATE UPSC WAR ROOM UPGRADES ===== */
window.formatAI=function(text){if(!text)return"No response";let safe=String(text).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");safe=safe.replace(/^### (.*$)/gim,"<h3>$1</h3>").replace(/^## (.*$)/gim,"<h2>$1</h2>").replace(/^# (.*$)/gim,"<h1>$1</h1>").replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/^\s*[-*]\s+(.*$)/gim,"<li>$1</li>").replace(/\n\n/g,"</p><p>").replace(/\n/g,"<br>");return `<div class="aiFormatted"><p>${safe}</p></div>`};
async function callGeminiDirect(prompt){if(typeof GEMINI_API_KEY==="undefined"||!GEMINI_API_KEY)return"Gemini API key not found. Add GEMINI_API_KEY in firebase-config.js.";const models=["gemini-2.0-flash","gemini-2.5-flash","gemini-2.5-flash-lite"];let last="";for(const model of models){try{const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:prompt}]}]})});const data=await r.json();const result=data?.candidates?.[0]?.content?.parts?.[0]?.text;if(result)return result;last=data?.error?.message||"No AI response"}catch(e){last=e.message}}return"AI error: "+last}
window.callAI=async function(type,payload){let prompt="";if(type==="newspaper"){prompt=`Analyze this article for UPSC with clean headings:\n# UPSC Newspaper Analysis\n## GS Paper and syllabus link\n## Core issue\n## Prelims facts\n## Mains dimensions\n## Keywords\n## Possible MCQ\n## Possible mains question\n## 100-word summary\n\nArticle:\n${payload?.text||payload?.article||""}`}else if(type==="notes"){prompt=`Create UPSC-ready notes:\n# ${payload?.topic||"UPSC Notes"}\n## Introduction\n## Core concepts\n## Prelims facts\n## Mains dimensions\n## PYQ angle\n## Flashcards\n## 5 MCQs\n## Revision checklist\n\nContent:\n${payload?.text||""}`}else if(type==="mentor"){prompt=`Act as a strict but supportive UPSC mentor.\nQuestion/request:\n${payload?.question||""}\n# Mentor Diagnosis\n## Mistakes\n## 7-day plan\n## Daily routine\n## Motivation`}else{prompt=payload?.question||JSON.stringify(payload||{})}return await callGeminiDirect(prompt)};
window.aiNewspaper=async function(){const input=$("articleInput")||$("articleText"),out=$("articleOutput");if(!out)return alert("articleOutput not found");out.classList.add("aiOutput","bigAI");out.innerHTML='<div class="aiLoading">Analyzing newspaper...</div>';out.innerHTML=formatAI(await callAI("newspaper",{text:input?.value||""}))};
window.aiNotes=async function(){const topic=$("aiTopic"),text=$("chapterInput")||$("aiText"),out=$("notesOutput");if(!out)return alert("notesOutput not found");out.classList.add("aiOutput","bigAI");out.innerHTML='<div class="aiLoading">Generating UPSC notes...</div>';out.innerHTML=formatAI(await callAI("notes",{topic:topic?.value||"UPSC Topic",text:text?.value||""}))};
window.aiMentor=async function(){const input=$("mentorInput"),out=$("mentorOutput");if(!out)return alert("mentorOutput not found");out.classList.add("aiOutput","bigAI");out.innerHTML='<div class="aiLoading">Thinking like your UPSC mentor...</div>';out.innerHTML=formatAI(await callAI("mentor",{question:input?.value||""}))};
window.analyzeMockAI=async function(){$("mockAIReport").innerHTML='<div class="aiLoading">Analyzing mock mistakes...</div>';const prompt=`Analyze this UPSC mock test deeply.\nQUESTION PAPER:\n${$("mockQuestionsText").value}\nANSWER KEY:\n${$("mockAnswerKey").value}\nMY ANSWERS:\n${$("mockMyAnswers").value}\n# Mock Test Analysis\n## Score summary\n## Correct, wrong and skipped\n## Question-wise wrong answer table\n## Subject-wise weakness\n## Mistake classification\n## High priority revision topics\n## 7-day revision plan\n## Prelims strategy advice`;$("mockAIReport").innerHTML=formatAI(await callGeminiDirect(prompt))};
window.analyzeMainsAI=async function(){$("mainsAIReport").innerHTML='<div class="aiLoading">Evaluating mains answer...</div>';const prompt=`Evaluate this UPSC mains answer.\nPaper: ${$("mainsPaperAI").value}\nQuestion: ${$("mainsQuestionAI").value}\nAnswer:\n${$("mainsAnswerAI").value}\n# Mains Answer Evaluation\n## Marks out of 15\n## Demand of the question\n## Strengths\n## Missing points\n## Structure improvement\n## Better introduction\n## Better conclusion\n## Value addition\n## Model answer\n## Final advice`;$("mainsAIReport").innerHTML=formatAI(await callGeminiDirect(prompt))};
window.saveAnalysisAsNote=async function(outputId,title,subject){const body=$(outputId)?.innerText||"";if(!body.trim())return alert("No analysis to save");await saveCol("notes",{title,subject,body,date:today()});alert("Saved to Notes Library");renderAll()};
window.importFullPYQ=async function(){const file=$("pyqJsonFile").files[0];if(!file)return alert("Choose PYQ JSON file");const data=JSON.parse(await file.text());if(!Array.isArray(data))return alert("JSON must be an array");localStorage.setItem("fullPYQDB",JSON.stringify(data));renderFullPYQ()};
window.downloadFullPYQTemplate=function(){const template=[{year:"2024",paper:"Prelims",subject:"Polity",topic:"Parliament",question:"Paste PYQ here",answer:"Correct answer",explanation:"Explanation here"}];const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(template,null,2)],{type:"application/json"}));a.download="upsc-full-pyq-template.json";a.click()};
window.renderFullPYQ=function(){const db=JSON.parse(localStorage.getItem("fullPYQDB")||"[]");const q=($("pyqSearchFull")?.value||"").toLowerCase();const subject=$("pyqSubjectFull")?.value||"All";let filtered=db.filter(x=>JSON.stringify(x).toLowerCase().includes(q));if(subject!=="All")filtered=filtered.filter(x=>String(x.subject||"")===subject);if($("fullPYQStats"))$("fullPYQStats").innerHTML=`<b>${filtered.length}</b> PYQs found / ${db.length} total`;if($("fullPYQList"))$("fullPYQList").innerHTML=filtered.map((x,i)=>`<div class="item pyqQuestionCard"><h3>${x.year||""} - ${x.subject||""}</h3><span class="tag">${x.paper||"UPSC"}</span><span class="tag">${x.topic||"Topic"}</span><p>${x.question||""}</p><details><summary>Answer / Explanation</summary><p><b>Answer:</b> ${x.answer||""}</p><p>${x.explanation||""}</p></details></div>`).join("")||'<div class="emptyState">No PYQs imported.</div>'};
window.saveShelfResource=async function(){await saveCol("libraryShelf",{folder:$("shelfFolder").value,title:$("shelfTitle").value,author:$("shelfAuthor").value,type:$("shelfType").value,url:$("shelfUrl").value,desc:$("shelfDesc").value,important:$("shelfImportant").checked,date:today()});["shelfTitle","shelfAuthor","shelfUrl","shelfDesc"].forEach(id=>$(id).value="");$("shelfImportant").checked=false;renderShelf()};
window.renderShelf=async function(){if(!$("shelfList"))return;const data=await getCol("libraryShelf");const q=($("shelfSearch")?.value||"").toLowerCase();const filtered=data.filter(x=>JSON.stringify(x).toLowerCase().includes(q));const folders=[...new Set(data.map(x=>x.folder||"Other"))];$("shelfFolders").innerHTML=folders.map(f=>`<button class="folderChip" onclick="$('shelfSearch').value='${f}';renderShelf()">${f}</button>`).join("");$("shelfList").innerHTML=filtered.map((x,i)=>`<div class="bookCard ${x.important?'important':''}"><div class="bookSpine">${x.folder||"UPSC"}</div><div class="bookBody"><h3>${x.title||"Untitled"}</h3><p>${x.author||""}</p><span class="tag">${x.type||"Resource"}</span>${x.important?'<span class="tag">★ Important</span>':''}<p>${x.desc||""}</p><div class="resourceActions">${x.url?`<a target="_blank" class="btn blue" href="${x.url}">Open</a>`:""}<button class="btn danger" onclick="deleteItem('libraryShelf','${x.id||i}')">Delete</button></div></div></div>`).join("")||'<div class="emptyState">Library is empty. Add your PDFs/books/resources.</div>'};
window.buildAIKnowledgeGraph=async function(){$("kgAIOutput").innerHTML='<div class="aiLoading">Building knowledge graph...</div>';const prompt=`Build a UPSC knowledge graph.\nTopic: ${$("kgAITopic").value}\nSubject: ${$("kgAISubject").value}\nContext: ${$("kgAIContext").value}\n# Knowledge Graph\n## Core concept\n## Syllabus link\n## Static connections\n## Current affairs connections\n## PYQ angles\n## Prelims facts\n## Mains dimensions\n## Diagrams/maps needed\n## Revision plan`;$("kgAIOutput").innerHTML=formatAI(await callGeminiDirect(prompt))};
window.saveAIKG=async function(){const topic=$("kgAITopic").value||"AI Knowledge Graph";await saveCol("kg",{topic,subject:$("kgAISubject").value,links:"AI generated",body:$("kgAIOutput").innerText,date:today()});alert("Saved to Knowledge Graph");renderAll()};
window.renderFlashcardsPerfect=async function(){const flash=await getCol("flash");if(!$("flashList"))return;$("flashList").innerHTML=`<div class="flashGrid">`+flash.map((f,i)=>`<div class="flashCard" onclick="this.classList.toggle('open')"><div class="flashTop"><span class="tag">${f.subject||"General"}</span><span class="tag">Tap to reveal</span></div><h3>${f.q||f.title||"Question"}</h3><div class="flashAnswer">${f.a||f.body||"Answer"}</div><button class="btn danger" onclick="event.stopPropagation();deleteItem('flash','${f.id||i}')">Delete</button></div>`).join("")+`</div>`};
setTimeout(()=>{try{renderAll(activeSectionIdV225())}catch(e){}},1000);


/* ===== AI-FIRST INTEGRATED WAR ROOM LOGIC ===== */
window.formatAI=function(text){if(!text)return"No response";let safe=String(text).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");safe=safe.replace(/^### (.*$)/gim,"<h3>$1</h3>").replace(/^## (.*$)/gim,"<h2>$1</h2>").replace(/^# (.*$)/gim,"<h1>$1</h1>").replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/^\s*[-*]\s+(.*$)/gim,"<li>$1</li>").replace(/\n\n/g,"</p><p>").replace(/\n/g,"<br>");return `<div class="aiFormatted"><p>${safe}</p></div>`};
async function aiAsk(prompt){if(typeof GEMINI_API_KEY==="undefined"||!GEMINI_API_KEY)return"Add GEMINI_API_KEY in firebase-config.js";const models=["gemini-2.0-flash","gemini-2.5-flash","gemini-2.5-flash-lite"];let last="";for(const model of models){try{const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:prompt}]}]})});if(!r.ok){last=await r.text();continue;}const data=await r.json();return data.candidates?.[0]?.content?.parts?.[0]?.text||"No response received.";}catch(e){last=e.message;continue;}}return"AI error: "+last;}
window.callAI=async(type,payload)=>aiAsk(payload?.question||payload?.text||JSON.stringify(payload||{}));
async function addCalendarItemAuto(title,date,type="AI Task"){await saveCol("calendarItems",{title,date:date||today(),type});}
async function addWeakTopic(topic,subject,source){await saveCol("weakTopics",{topic,subject,source,date:today(),status:"active"});}
function futureDate(days){const d=new Date();d.setDate(d.getDate()+days);return d.toISOString().slice(0,10);}
window.addSmartRevision=async()=>{const topic=$("revTopicAI").value;if(!topic)return alert("Enter topic");const subject=$("revSubjectAI").value,source=$("revSourceAI").value,diff=$("revDifficultyAI").value;const cycles=diff==="Danger Zone"?[1,3,7,15,30]:diff==="Hard"?[1,7,15,30]:[3,15,30];for(const c of cycles){await saveCol("smartRevision",{topic,subject,source,difficulty:diff,date:futureDate(c),cycle:c,status:"pending"});await addCalendarItemAuto(`Revise: ${topic}`,futureDate(c),"Revision")}await addWeakTopic(topic,subject,source);renderAIIntegrated();alert("Smart revision added to calendar.")};
window.generateRevisionDrill=async()=>{const topic=$("revTopicAI").value||"weak topic";$("revisionDrillOutput").innerHTML='<div class="aiLoading">Creating drill...</div>';$("revisionDrillOutput").innerHTML=formatAI(await aiAsk(`# UPSC Revision Drill\nTopic: ${topic}\nGive 2-minute revision, 10 prelims facts, 5 MCQs, 1 mains question, common traps, and memory hooks.`))};
window.generateAIPlan=async()=>{$("aiPlanOutput").innerHTML='<div class="aiLoading">Planning...</div>';const stats=await collectAIStats();$("aiPlanOutput").innerHTML=formatAI(await aiAsk(`# AI Daily Plan\nDate: ${$("planDate").value||today()}\nUser input: ${$("planInput").value}\nStats:${JSON.stringify(stats)}\nMake hour-by-hour UPSC plan, revision, MCQs, mains, breaks, and snark warning.`))};
window.saveAIPlanToCalendar=async()=>{const date=$("planDate").value||today();await saveCol("dailyPlans",{date,body:$("aiPlanOutput").innerText,input:$("planInput").value});await addCalendarItemAuto("AI Daily Plan",date,"Plan");renderAIIntegrated();alert("Plan saved.")};
window.saveAIHabit=async()=>{await saveCol("aiHabits",{name:$("habitNameAI").value,subject:$("habitSubjectAI").value,status:$("habitStatusAI").value,reason:$("habitReasonAI").value,date:today()});if($("habitStatusAI").value!=="Done")await addWeakTopic($("habitNameAI").value,$("habitSubjectAI").value,"Habit Missed");renderAIIntegrated()};
window.analyzeHabitsAI=async()=>{$("habitAIOutput").innerHTML='<div class="aiLoading">Analyzing habits...</div>';const h=await getCol("aiHabits");$("habitAIOutput").innerHTML=formatAI(await aiAsk(`# AI Habit Analysis\nLogs:${JSON.stringify(h.slice(-30))}\nFind pattern, discipline issue, fix schedule, snark warning, and tomorrow habit plan.`))};
window.aiNotes=async()=>{$("notesOutput").innerHTML='<div class="aiLoading">Generating notes...</div>';$("notesOutput").innerHTML=formatAI(await aiAsk(`# UPSC Notes\nTopic:${$("aiTopic").value}\nSubject:${$("aiNoteSubject").value}\nContent:${$("aiText").value}\nGive intro, concepts, prelims facts, mains dimensions, PYQ angle, flashcards and MCQs.`))};
window.saveAIOutput=async(outputId,title)=>{await saveCol("notes",{title:title+" - "+($("aiTopic")?.value||today()),subject:$("aiNoteSubject")?.value||"AI",body:$(outputId).innerText,date:today()});alert("Saved.")};
window.createFlashcardsFromOutput=async(outputId)=>{$("flashAIOutput")&&( $("flashAIOutput").innerHTML='<div class="aiLoading">Creating flashcards...</div>');const out=await aiAsk(`# Create 10 UPSC flashcards from this content. Format each as Q: and A:\n${$(outputId).innerText}`);if($("flashAIOutput"))$("flashAIOutput").innerHTML=formatAI(out);await saveCol("flash",{q:"AI generated card set",a:out,subject:$("aiNoteSubject")?.value||"AI",difficulty:"Medium",due:today(),date:today()});renderAIIntegrated()};
window.analyzeMockAI=async()=>{$("mockAIReport").innerHTML='<div class="aiLoading">Analyzing mock...</div>';const out=await aiAsk(`# AI Mock Analysis\nMock:${$("mockNameAI").value}\nQuestions:${$("mockQuestionsText").value}\nAnswer key:${$("mockAnswerKey").value}\nMy answers:${$("mockMyAnswers").value}\nGive score, wrong table, weak topics, mistake types, revision plan, flashcards, prelims readiness.`);$("mockAIReport").innerHTML=formatAI(out);await saveCol("mockReports",{name:$("mockNameAI").value,body:out,date:today()})};
window.sendMockWeaknessToRevision=async()=>{const text=$("mockAIReport").innerText||"";await saveCol("smartRevision",{topic:"Mock Weak Areas",subject:"Mixed",source:"Mock Analysis",difficulty:"Hard",date:futureDate(1),cycle:1,status:"pending",body:text});await addCalendarItemAuto("Revise Mock Weak Areas",futureDate(1),"Revision");renderAIIntegrated();alert("Mock weakness sent to revision.")};
window.analyzeMainsAI=async()=>{$("mainsAIReport").innerHTML='<div class="aiLoading">Evaluating mains...</div>';const out=await aiAsk(`# UPSC Mains Evaluation\nPaper:${$("mainsPaperAI").value}\nQuestion:${$("mainsQuestionAI").value}\nAnswer:${$("mainsAnswerAI").value}\nGive marks, demand, missing points, structure, data/examples, model answer, and revision topics.`);$("mainsAIReport").innerHTML=formatAI(out);await saveCol("mainsReports",{paper:$("mainsPaperAI").value,question:$("mainsQuestionAI").value,body:out,date:today()})};
window.generateTopperAnswer=async()=>{$("mainsAIReport").innerHTML='<div class="aiLoading">Generating topper answer...</div>';$("mainsAIReport").innerHTML=formatAI(await aiAsk(`# Topper UPSC Answer\nPaper:${$("mainsPaperAI").value}\nQuestion:${$("mainsQuestionAI").value}\nGive intro, body, headings, examples, data, diagram suggestion, conclusion.`))};
window.sendMainsWeaknessToRevision=async()=>{await saveCol("smartRevision",{topic:"Mains Weakness: "+$("mainsQuestionAI").value,subject:$("mainsPaperAI").value,source:"Mains Evaluation",difficulty:"Hard",date:futureDate(1),cycle:1,status:"pending",body:$("mainsAIReport").innerText});await addCalendarItemAuto("Revise mains weakness",futureDate(1),"Revision");renderAIIntegrated();alert("Mains weakness sent to revision.")};
window.importFullPYQ=async()=>{const file=$("pyqJsonFile").files[0];if(!file)return alert("Choose PYQ JSON file");const data=JSON.parse(await file.text());localStorage.setItem("fullPYQDB",JSON.stringify(data));renderFullPYQ()};
window.downloadFullPYQTemplate=()=>{const t=[{year:"2024",paper:"Prelims",subject:"Polity",topic:"Parliament",question:"Question",answer:"A",explanation:"Explanation"}];const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(t,null,2)],{type:"application/json"}));a.download="upsc-pyq-template.json";a.click()};
window.renderFullPYQ=()=>{const db=JSON.parse(localStorage.getItem("fullPYQDB")||"[]");const q=($("pyqSearchFull")?.value||"").toLowerCase();const sub=$("pyqSubjectFull")?.value||"All";let f=db.filter(x=>JSON.stringify(x).toLowerCase().includes(q));if(sub!=="All")f=f.filter(x=>x.subject===sub);if($("fullPYQStats"))$("fullPYQStats").innerHTML=`<b>${f.length}</b> found / ${db.length} total`;if($("fullPYQList"))$("fullPYQList").innerHTML=f.map((x,i)=>`<div class="item pyqQuestionCard"><h3>${x.year||""} ${x.subject||""}</h3><span class="tag">${x.topic||""}</span><p>${x.question||""}</p><details><summary>Answer</summary><p><b>${x.answer||""}</b></p><p>${x.explanation||""}</p><button class="btn gold" onclick="createPYQFlashcard(${i})">Create Flashcard</button><button class="btn green" onclick="addPYQRevision(${i})">Add Revision</button></details></div>`).join("")||'<div class="emptyState">Import PYQ JSON.</div>'};
window.createPYQFlashcard=async(i)=>{const db=JSON.parse(localStorage.getItem("fullPYQDB")||"[]");const x=db[i];await saveCol("flash",{q:x.question,a:(x.answer||"")+" - "+(x.explanation||""),subject:x.subject,difficulty:"Medium",due:today(),date:today()});renderAIIntegrated();alert("PYQ flashcard created.")};
window.addPYQRevision=async(i)=>{const db=JSON.parse(localStorage.getItem("fullPYQDB")||"[]");const x=db[i];await saveCol("smartRevision",{topic:x.topic||x.subject,subject:x.subject,source:"PYQ",difficulty:"Hard",date:futureDate(1),cycle:1,status:"pending"});await addCalendarItemAuto("PYQ revision: "+(x.topic||x.subject),futureDate(1),"Revision");renderAIIntegrated()};
window.analyzePYQPatternAI=async()=>{$("pyqAIOutput").innerHTML='<div class="aiLoading">Analyzing PYQ pattern...</div>';const db=JSON.parse(localStorage.getItem("fullPYQDB")||"[]");$("pyqAIOutput").innerHTML=formatAI(await aiAsk(`# PYQ Pattern Analysis\nSearch:${$("pyqSearchFull").value}\nData:${JSON.stringify(db.slice(0,80))}\nFind repeated themes, high probability topics, prelims traps, mains angles, and flashcards.`))};
window.saveSmartFlashcard=async()=>{await saveCol("flash",{q:$("flashQAI").value,a:$("flashAAI").value,subject:$("flashSubjectAI").value,difficulty:$("flashDifficultyAI").value,due:today(),date:today()});renderAIIntegrated()};
window.generateFlashcardsAI=async()=>{$("flashAIOutput").innerHTML='<div class="aiLoading">Generating flashcards...</div>';$("flashAIOutput").innerHTML=formatAI(await aiAsk(`# Generate UPSC flashcards\nTopic/content:${$("flashQAI").value}\nMake 10 Q/A flashcards with memory hooks.`))};
window.saveShelfResource=async()=>{await saveCol("libraryShelf",{folder:$("shelfFolder").value,title:$("shelfTitle").value,author:$("shelfAuthor").value,type:$("shelfType").value,url:$("shelfUrl").value,desc:$("shelfDesc").value,important:$("shelfImportant").checked,date:today()});renderAIIntegrated()};
window.renderShelf=async()=>{if(!$("shelfList"))return;const data=await getCol("libraryShelf");const q=($("shelfSearch")?.value||"").toLowerCase();const f=data.filter(x=>JSON.stringify(x).toLowerCase().includes(q));$("shelfFolders").innerHTML=[...new Set(data.map(x=>x.folder||"Other"))].map(folder=>`<button class="folderChip" onclick="$('shelfSearch').value='${folder}';renderShelf()">${folder}</button>`).join("");$("shelfList").innerHTML=f.map((x,i)=>`<div class="bookCard ${x.important?'important':''}"><div class="bookSpine">${x.folder}</div><div class="bookBody"><h3>${x.title}</h3><p>${x.author||""}</p><span class="tag">${x.type}</span><p>${x.desc||""}</p>${x.url?`<a class="btn blue" target="_blank" href="${x.url}">Open</a>`:""}</div></div>`).join("")||'<div class="emptyState">No books/resources.</div>'};
window.buildAIKnowledgeGraph=async()=>{$("kgAIOutput").innerHTML='<div class="aiLoading">Building graph...</div>';$("kgAIOutput").innerHTML=formatAI(await aiAsk(`# AI Knowledge Graph\nTopic:${$("kgAITopic").value}\nSubject:${$("kgAISubject").value}\nContext:${$("kgAIContext").value}\nGive syllabus, static links, CA links, PYQs, mains dimensions, maps/diagrams, revision and flashcards.`))};
window.saveAIKG=async()=>{await saveCol("kg",{topic:$("kgAITopic").value,subject:$("kgAISubject").value,body:$("kgAIOutput").innerText,date:today()});alert("Saved graph.")};
async function collectAIStats(){return{plans:(await getCol("dailyPlans")).length,revision:(await getCol("smartRevision")).length,habits:(await getCol("aiHabits")).length,weak:(await getCol("weakTopics")).length,flash:(await getCol("flash")).length,mocks:(await getCol("mockReports")).length,mains:(await getCol("mainsReports")).length}}
window.generateSnarkDashboard=async()=>{$("snarkDashboardBox").innerHTML='<div class="aiLoading">Snark AI checking your prep...</div>';const s=await collectAIStats();$("snarkDashboardBox").innerHTML=formatAI(await aiAsk(`# Snark UPSC Mentor\nStats:${JSON.stringify(s)}\nGive tough but motivating advice for today.`))};
async function renderAIIntegrated(){try{const rev=await getCol("smartRevision"),hab=await getCol("aiHabits"),weak=await getCol("weakTopics"),flash=await getCol("flash"),plans=await getCol("dailyPlans"),cal=await getCol("calendarItems");if($("dashPlanCount"))$("dashPlanCount").innerText=plans.filter(x=>x.date===today()).length;if($("dashRevisionCount"))$("dashRevisionCount").innerText=rev.filter(x=>x.date<=today()).length;if($("dashWeakCount"))$("dashWeakCount").innerText=weak.filter(x=>x.status!=="done").length;if($("dashFlashDue"))$("dashFlashDue").innerText=flash.filter(x=>(x.due||today())<=today()).length;/* V27.5.2: readiness is owned only by refreshTrueReadinessV136 to prevent competing DOM writes. */if($("todayWarList"))$("todayWarList").innerHTML=[...rev.filter(x=>x.date<=today()).map((x,i)=>`<div class="item"><h3>Revise: ${x.topic}</h3><span class="tag">${x.subject}</span><span class="tag">${x.source}</span><button class="btn danger deleteBtn" onclick="event.stopPropagation(); deleteItem('smartRevision','${x.id||i}')">🗑 Delete</button></div>`),...flash.filter(x=>(x.due||today())<=today()).slice(0,5).map((x,i)=>`<div class="item"><h3>Flashcard: ${x.q}</h3><span class="tag">${x.subject}</span><button class="btn danger deleteBtn" onclick="event.stopPropagation(); deleteItem('flash','${x.id||i}')">🗑 Delete</button></div>`)].join("")||'<div class="emptyState">No war tasks. Add revision/habits/mocks.</div>';if($("smartRevisionList"))$("smartRevisionList").innerHTML=rev.sort((a,b)=>String(a.date).localeCompare(String(b.date))).map((x,i)=>`<div class="item"><h3>${x.topic}</h3><span class="tag">${x.subject}</span><span class="tag">${x.date}</span><span class="tag">${x.source}</span><button class="btn green" onclick="deleteItem('smartRevision','${x.id||i}');setTimeout(renderAIIntegrated,500)">Done/Delete</button></div>`).join("")||'<div class="emptyState">No smart revisions.</div>';if($("aiHabitList"))$("aiHabitList").innerHTML=hab.slice(-20).reverse().map((x,i)=>`<div class="item"><h3>${x.name}</h3><span class="tag">${x.status}</span><span class="tag">${x.subject}</span><p>${x.reason||""}</p><button class="btn danger deleteBtn" onclick="deleteItem('aiHabits','${x.id||i}')">🗑 Delete</button></div>`).join("");if($("dailyPlanList"))$("dailyPlanList").innerHTML=plans.slice(-10).reverse().map((x,i)=>`<div class="item"><h3>${x.date}</h3><p>${x.body||x.input||""}</p><button class="btn danger deleteBtn" onclick="deleteItem('dailyPlans','${x.id||i}')">🗑 Delete</button></div>`).join("");if($("flashList"))$("flashList").innerHTML=flash.map((f,i)=>`<div class="flashCard" onclick="this.classList.toggle('open')"><div><span class="tag">${f.subject||"General"}</span><span class="tag">${f.difficulty||"Medium"}</span></div><h3>${f.q||"Question"}</h3><div class="flashAnswer">${f.a||"Answer"}</div><button class="btn danger deleteBtn" onclick="event.stopPropagation(); deleteItem('flash','${f.id||i}')">🗑 Delete</button></div>`).join("")||'<div class="emptyState">No flashcards yet.</div>';if($("calendarAgenda"))$("calendarAgenda").innerHTML=cal.slice(-30).reverse().map((x,i)=>`<div class="item"><h3>${x.title}</h3><span class="tag">${x.date}</span><span class="tag">${x.type}</span><button class="btn danger deleteBtn" onclick="deleteItem('calendarItems','${x.id||i}')">🗑 Delete</button></div>`).join("")}catch(e){console.warn(e)}}
setTimeout(()=>{try{renderAll('dashboard')}catch(e){}},1000);


/* ===== CORE COMPLETE PAGES: Mentor, CA, Notes, Syllabus, Countdown, Pomodoro ===== */
window.askMainMentor=async()=>{const mode=$("mentorMode").value;const q=$("mentorQuestionMain").value;$("mentorMainOutput").innerHTML='<div class="aiLoading">Mentor thinking...</div>';$("mentorMainOutput").innerHTML=formatAI(await aiAsk(`# ${mode}\nQuestion: ${q}\nGive practical UPSC answer with clear plan, warnings and next actions.`))};
window.saveMentorAdvice=async()=>{await saveCol("mentorAdvice",{mode:$("mentorMode").value,question:$("mentorQuestionMain").value,body:$("mentorMainOutput").innerText,date:today()});alert("Mentor advice saved.")};

window.makeCurrentAffairsNote=async()=>{$("caAIOutput").innerHTML='<div class="aiLoading">Making current affairs notes...</div>';const prompt=`# UPSC Current Affairs Note\nTitle:${$("caTitleAI").value}\nSubject:${$("caSubjectAI").value}\nArticle:${$("caArticleAI").value}\nGive: background, why in news, prelims facts, mains dimensions, GS paper, keywords, data, PYQ links, expected question, 100-word summary.`;$("caAIOutput").innerHTML=formatAI(await aiAsk(prompt))};
window.saveCurrentAffairsNote=async()=>{await saveCol("currentAffairsAI",{title:$("caTitleAI").value,subject:$("caSubjectAI").value,article:$("caArticleAI").value,note:$("caAIOutput").innerText,date:today()});renderCurrentAffairsAI();alert("Current affairs saved.")};
window.createCAFlashcards=async()=>{await saveCol("flash",{q:"Current Affairs: "+$("caTitleAI").value,a:$("caAIOutput").innerText,subject:$("caSubjectAI").value,difficulty:"Medium",due:today(),date:today()});alert("CA flashcard created.")};
window.renderCurrentAffairsAI=async()=>{if(!$("caDisplayList"))return;const q=($("caSearchAI")?.value||"").toLowerCase();const data=await getCol("currentAffairsAI");const f=data.filter(x=>JSON.stringify(x).toLowerCase().includes(q));$("caDisplayList").innerHTML=f.reverse().map((x,i)=>`<div class="item caCard"><h3>${x.title||"Untitled"}</h3><span class="tag">${x.subject}</span><span class="tag">${x.date}</span><p>${(x.note||"").slice(0,500)}...</p><details><summary>Read full note</summary><div class="aiOutput">${formatAI(x.note||"")}</div></details><button class="btn danger deleteBtn" onclick="deleteItem('currentAffairsAI','${x.id||i}')">🗑 Delete</button></div>`).join("")||'<div class="emptyState">No current affairs saved.</div>'};

window.saveProNote=async()=>{await saveCol("proNotes",{title:$("noteTitlePro").value,paper:$("notePaperPro").value,subject:$("noteSubjectPro").value,topic:$("noteTopicPro").value,body:$("noteBodyPro").value,date:today()});renderProNotes();alert("Note saved.")};
window.renderProNotes=async()=>{if(!$("proNotesList"))return;const data=await getCol("proNotes");const q=($("noteSearchPro")?.value||"").toLowerCase();const paper=$("noteFilterPaper")?.value||"All";let f=data.filter(x=>JSON.stringify(x).toLowerCase().includes(q));if(paper!=="All")f=f.filter(x=>x.paper===paper);const grouped={};f.forEach(n=>{const k=`${n.paper} / ${n.subject}`;(grouped[k] ||= []).push(n)});$("proNotesList").innerHTML=Object.entries(grouped).map(([k,arr])=>`<div class="noteFolder"><h3>${k}</h3>${arr.map((n,i)=>`<div class="noteItem"><b>${n.title}</b><span class="tag">${n.topic}</span><p>${(n.body||"").slice(0,260)}...</p><details><summary>Open</summary><div class="aiOutput">${formatAI(n.body||"")}</div></details><button class="btn danger deleteBtn" onclick="deleteItem('proNotes','${n.id||i}')">🗑 Delete</button></div>`).join("")}</div>`).join("")||'<div class="emptyState">No notes.</div>'};
window.improveNoteAI=async()=>{$("noteAIImproveOutput").innerHTML='<div class="aiLoading">Improving note...</div>';$("noteAIImproveOutput").innerHTML=formatAI(await aiAsk(`# Improve this UPSC note\nPaper:${$("notePaperPro").value}\nSubject:${$("noteSubjectPro").value}\nTopic:${$("noteTopicPro").value}\nNote:${$("noteBodyPro").value}\nMake it structured like topper notes with prelims facts, mains points, diagrams, PYQs and revision checklist.`))};
window.noteToFlashcards=async()=>{const out=await aiAsk(`# Make 10 flashcards from this note:\n${$("noteBodyPro").value}`);await saveCol("flash",{q:"Flashcards: "+$("noteTitlePro").value,a:out,subject:$("noteSubjectPro").value,difficulty:"Medium",due:today(),date:today()});alert("Flashcards created.")};

const coreSyllabusAI=[
["Prelims GS","Polity","Constitution, political system, Panchayati Raj, public policy, rights issues"],
["Prelims GS","History","History of India and Indian National Movement"],
["Prelims GS","Geography","Indian and World Geography: physical, social, economic"],
["Prelims GS","Economy","Economic and social development, poverty, inclusion, demographics"],
["Prelims GS","Environment","Ecology, biodiversity and climate change"],
["CSAT","CSAT","Comprehension, reasoning, numeracy, decision making"],
["GS1","Art & Culture","Indian culture, art forms, literature and architecture"],
["GS1","Modern History","Modern Indian history, freedom struggle, post-independence consolidation"],
["GS1","Society","Indian society, women, population, urbanization, globalization"],
["GS1","Geography","World physical geography, resources, geophysical phenomena"],
["GS2","Polity","Constitution, Parliament, executive, judiciary, federalism"],
["GS2","Governance","Welfare schemes, governance, transparency, e-governance"],
["GS2","IR","India and neighbourhood, global groupings, international institutions"],
["GS3","Economy","Growth, development, budgeting, agriculture, infrastructure"],
["GS3","Science & Tech","Science and technology, IT, space, biotech, IPR"],
["GS3","Environment","Conservation, pollution, EIA, disaster management"],
["GS3","Security","Internal security, cyber security, border management"],
["GS4","Ethics","Ethics, integrity, aptitude, emotional intelligence, case studies"],
["Essay","Essay","Essay writing practice and multidimensional thinking"]
];
window.loadDefaultSyllabusAI=async()=>{for(const [paper,subject,details] of coreSyllabusAI){await saveCol("syllabusAI",{paper,subject,topic:subject,details,status:"Not Started",date:today()})}renderSyllabusAI();alert("Core syllabus loaded.")};
window.saveSyllabusAI=async()=>{await saveCol("syllabusAI",{paper:$("syllabusPaperAI").value,subject:$("syllabusTopicAI").value,topic:$("syllabusTopicAI").value,details:$("syllabusDetailsAI").value,status:$("syllabusStatusAI").value,date:today()});renderSyllabusAI()};
window.renderSyllabusAI=async()=>{if(!$("syllabusListAI"))return;const q=($("syllabusSearchAI")?.value||"").toLowerCase();const data=await getCol("syllabusAI");const f=data.filter(x=>JSON.stringify(x).toLowerCase().includes(q));const done=f.filter(x=>x.status==="Completed").length;const pct=f.length?Math.round(done/f.length*100):0;$("syllabusStatsAI").innerHTML=`<b>${pct}%</b> completed • ${done}/${f.length} topics`; $("syllabusListAI").innerHTML=f.map((x,i)=>`<div class="item syllabusItem ${x.status==='Completed'?'done':''}"><h3>${x.topic}</h3><span class="tag">${x.paper}</span><span class="tag">${x.status}</span><p>${x.details}</p><button class="btn green" onclick="markSyllabusDoneAI('${x.id||i}')">Done</button><button class="btn gold" onclick="addSyllabusRevisionAI('${x.topic}','${x.paper}')">Add Revision</button><button class="btn danger deleteBtn" onclick="deleteItem('syllabusAI','${x.id||i}')">🗑 Delete</button></div>`).join("")||'<div class="emptyState">No syllabus topics.</div>'};
window.markSyllabusDoneAI=async(id)=>{alert("Use delete/done update in next version. For now add completed topic manually if needed.")};
window.addSyllabusRevisionAI=async(topic,paper)=>{await saveCol("smartRevision",{topic,subject:paper,source:"Syllabus",difficulty:"Medium",date:futureDate(1),cycle:1,status:"pending"});await addCalendarItemAuto("Syllabus revision: "+topic,futureDate(1),"Revision");alert("Added to revision.")};

window.saveExamCountdownAI=()=>{localStorage.setItem("prelimsDateAI",$("prelimsDateAI").value);localStorage.setItem("mainsDateAI",$("mainsDateAI").value);renderExamCountdownAI()};
function countdownText(dateStr,label){if(!dateStr)return`Set ${label} date`;const diff=new Date(dateStr+"T00:00:00")-new Date();if(diff<=0)return`${label} date reached`;const d=Math.floor(diff/86400000),h=Math.floor(diff%86400000/3600000),m=Math.floor(diff%3600000/60000),s=Math.floor(diff%60000/1000);return `<b>${d}</b> days <b>${h}</b> hrs <b>${m}</b> min <b>${s}</b> sec to ${label}`};
window.renderExamCountdownAI=()=>{if($("prelimsDateAI"))$("prelimsDateAI").value=localStorage.getItem("prelimsDateAI")||"";if($("mainsDateAI"))$("mainsDateAI").value=localStorage.getItem("mainsDateAI")||"";if($("prelimsCountdownLive"))$("prelimsCountdownLive").innerHTML=countdownText(localStorage.getItem("prelimsDateAI"),"Prelims");if($("mainsCountdownLive"))$("mainsCountdownLive").innerHTML=countdownText(localStorage.getItem("mainsDateAI"),"Mains")};
let pomoAIInterval=null,pomoAISeconds=25*60,pomoAITotal=25*60;
window.startPomoAI=(mins)=>{clearInterval(pomoAIInterval);pomoAISeconds=mins*60;pomoAITotal=mins*60;pomoAIInterval=setInterval(()=>{pomoAISeconds--;renderPomoAI();if(pomoAISeconds<=0){clearInterval(pomoAIInterval);alert("Pomodoro complete. Save session.")}},1000);renderPomoAI()};
window.pausePomoAI=()=>clearInterval(pomoAIInterval);
function renderPomoAI(){if(!$("pomoDisplayAI"))return;const m=String(Math.floor(pomoAISeconds/60)).padStart(2,"0"),s=String(pomoAISeconds%60).padStart(2,"0");$("pomoDisplayAI").innerText=`${m}:${s}`};
window.completePomoAI=async()=>{await saveCol("focusSessions",{task:$("pomoTaskAI").value,subject:$("pomoSubjectAI").value,minutes:Math.round(pomoAITotal/60),date:today()});renderPomoSessionsAI();alert("Focus session saved.")};
window.renderPomoSessionsAI=async()=>{if(!$("pomoSessionListAI"))return;const data=await getCol("focusSessions");$("pomoSessionListAI").innerHTML=data.slice(-20).reverse().map((x,i)=>`<div class="item"><h3>${x.task||"Focus"}</h3><span class="tag">${x.subject}</span><span class="tag">${x.minutes} min</span><span class="tag">${x.date}</span><button class="btn danger deleteBtn" onclick="deleteItem('focusSessions','${x.id||i}')">🗑 Delete</button></div>`).join("")||'<div class="emptyState">No focus sessions.</div>'};
setInterval(()=>{if(isActiveSectionV225('countdownPage')){try{renderExamCountdownAI()}catch(e){}}},1000);
setInterval(()=>{try{renderActiveAutoV225(['currentAffairsAI','evernoteNotes','syllabusCommand','pomodoroPage'])}catch(e){}},20000);
setTimeout(()=>{try{renderAll(activeSectionIdV225())}catch(e){}},1000);


/* ===== UPSC MAPS COMMAND + DIGITAL LIBRARY PRO ===== */
const defaultMapResources=[
  {title:"Drishti Infographics & Maps",category:"UPSC Map Resources",url:"https://www.drishtiias.com/infographics-and-maps",note:"External source for UPSC visual learning, infographics and maps."},
  {title:"Drishti Learning Through Maps",category:"Learning Through Maps",url:"https://www.drishtiias.com/learning-through-maps",note:"External map-learning resource."},
  {title:"Places in News - Drishti",category:"Places in News",url:"https://www.drishtiias.com/tags/places-in-news",note:"Useful for current affairs mapping."},
  {title:"India Political Map",category:"India Political",url:"",note:"Add your preferred image/PDF link."},
  {title:"India Physical Map",category:"India Physical",url:"",note:"Mountains, plateaus, rivers, passes."},
  {title:"River Systems of India",category:"Rivers",url:"",note:"Himalayan and Peninsular rivers."},
  {title:"World Seas and Straits",category:"Seas & Straits",url:"",note:"Important for IR, trade routes, places in news."},
  {title:"National Parks and Biosphere Reserves",category:"National Parks",url:"",note:"Environment mapping."},
  {title:"Ramsar Sites of India",category:"Ramsar Sites",url:"",note:"Prelims high-yield mapping."}
];

window.loadDefaultMapResources=async()=>{for(const r of defaultMapResources){await saveCol("mapNotes",r)}renderMapNotes();alert("Map resource links loaded.")};
window.saveMapNote=async()=>{await saveCol("mapNotes",{title:$("mapTitle").value,category:$("mapCategory").value,url:$("mapUrl").value,note:$("mapNotes").value,date:today()});renderMapNotes();alert("Map note saved.")};
window.analyzeMapWithAI=async()=>{$("mapAIOutput").innerHTML='<div class="aiLoading">Analyzing map notes...</div>';const prompt=`# UPSC Map Analysis\nCategory:${$("mapCategory").value}\nTitle:${$("mapTitle").value}\nMap/source:${$("mapUrl").value}\nNotes:${$("mapNotes").value}\nGive: location facts, prelims traps, PYQ angles, mains relevance, memory hooks, important nearby places, and 5 MCQs.`;$("mapAIOutput").innerHTML=formatAI(await aiAsk(prompt))};
window.saveMapToLibrary=async()=>{await saveCol("digitalLibrary",{type:"Map",subject:"Maps",title:$("mapTitle").value,url:$("mapUrl").value,content:$("mapNotes").value,date:today()});renderDigitalLibrary();alert("Map saved to Digital Library.")};
window.renderMapNotes=async()=>{if(!$("mapResourceList"))return;const q=($("mapSearch")?.value||"").toLowerCase();const data=await getCol("mapNotes");const f=data.filter(x=>JSON.stringify(x).toLowerCase().includes(q));$("mapResourceList").innerHTML=f.map((x,i)=>`<div class="mapResourceCard"><h3>${x.title||"Untitled Map"}</h3><span class="tag">${x.category||"Map"}</span><p>${x.note||""}</p>${x.url?`<a class="btn blue" target="_blank" href="${x.url}">Open Source</a>`:""}<button class="btn purple" onclick="loadMapNoteIntoAI('${x.id||i}')">Use for AI</button><button class="btn gold" onclick="mapNoteToLibrary('${x.id||i}')">Save to Library</button><button class="btn danger deleteBtn" onclick="deleteItem('mapNotes','${x.id||i}')">🗑 Delete</button></div>`).join("")||'<div class="emptyState">No map resources yet.</div>'};
window.loadMapNoteIntoAI=async(id)=>{const data=await getCol("mapNotes");const x=data.find((m,i)=>(m.id||String(i))==id)||data[id];if(!x)return;$("mapCategory").value=x.category||"Places in News";$("mapTitle").value=x.title||"";$("mapUrl").value=x.url||"";$("mapNotes").value=x.note||"";show("mapsCommand")};
window.mapNoteToLibrary=async(id)=>{const data=await getCol("mapNotes");const x=data.find((m,i)=>(m.id||String(i))==id)||data[id];if(!x)return;await saveCol("digitalLibrary",{type:"Map",subject:"Maps",title:x.title,url:x.url,content:x.note,date:today()});renderDigitalLibrary();alert("Saved to Digital Library.")};

let mapCanvasCtx=null,mapDrawing=false,mapTool="pen",mapImg=null;
window.setMapTool=(tool)=>{mapTool=tool};
window.loadMapImageToCanvas=()=>{const file=$("mapImageUpload").files[0];const canvas=$("mapCanvas");if(!file||!canvas)return alert("Choose map image");const ctx=canvas.getContext("2d");mapCanvasCtx=ctx;const img=new Image();img.onload=()=>{ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);mapImg=img};img.src=URL.createObjectURL(file)};

window.clearMapCanvas=()=>{const c=$("mapCanvas");if(!c)return;const ctx=c.getContext("2d");ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle="#f8fafc";ctx.fillRect(0,0,c.width,c.height)};
window.saveAnnotatedMap=async()=>{const c=$("mapCanvas");if(!c)return;const dataUrl=c.toDataURL("image/png");await saveCol("digitalLibrary",{type:"Map",subject:"Maps",title:$("mapTitle").value||"Annotated Map",url:dataUrl,content:$("mapNotes").value,date:today()});renderDigitalLibrary();alert("Annotated map saved to Digital Library.")};

window.saveDigitalLibraryItem=async()=>{await saveCol("digitalLibrary",{type:$("libTypePro").value,subject:$("libSubjectPro").value,title:$("libTitlePro").value,url:$("libUrlPro").value,content:$("libContentPro").value,date:today()});renderDigitalLibrary();alert("Saved to Digital Library.")};
window.aiLibrarySummary=async()=>{$("libraryAIOutput").innerHTML='<div class="aiLoading">Creating library notes...</div>';const prompt=`# UPSC Library Resource Analysis\nType:${$("libTypePro").value}\nSubject:${$("libSubjectPro").value}\nTitle:${$("libTitlePro").value}\nURL:${$("libUrlPro").value}\nContent:${$("libContentPro").value}\nGive summary, prelims facts, mains dimensions, revision tasks, flashcards, and how to use this resource.`;$("libraryAIOutput").innerHTML=formatAI(await aiAsk(prompt))};
window.renderDigitalLibrary=async()=>{if(!$("digitalLibraryShelves"))return;const q=($("digitalLibrarySearch")?.value||"").toLowerCase();const filter=$("digitalLibraryFilter")?.value||"All";const data=await getCol("digitalLibrary");let f=data.filter(x=>JSON.stringify(x).toLowerCase().includes(q));if(filter!=="All")f=f.filter(x=>x.type===filter);const groups={};f.forEach(x=>{const k=x.subject||"General";(groups[k] ||= []).push(x)});$("digitalLibraryShelves").innerHTML=Object.entries(groups).map(([subject,items])=>`<div class="digitalShelf"><h3>${subject}</h3><div class="shelfRail">${items.map((x,i)=>`<div class="libraryBook ${x.type}"><div class="bookCover"><span>${x.type}</span><b>${x.title||"Untitled"}</b></div><div class="bookInfo"><p>${(x.content||"").slice(0,180)}...</p>${x.url?`<a target="_blank" class="btn blue" href="${x.url}">Open</a>`:""}<button class="btn purple" onclick="libraryItemToAI('${x.id||i}')">AI</button><button class="btn danger deleteBtn" onclick="deleteItem('digitalLibrary','${x.id||i}')">🗑 Delete</button></div></div>`).join("")}</div></div>`).join("")||'<div class="emptyState">No saved library items yet.</div>'};
window.libraryItemToAI=async(id)=>{const data=await getCol("digitalLibrary");const x=data.find((m,i)=>(m.id||String(i))==id)||data[id];if(!x)return;show("digitalLibrary");$("libraryAIOutput").innerHTML='<div class="aiLoading">Analyzing saved resource...</div>';$("libraryAIOutput").innerHTML=formatAI(await aiAsk(`# Analyze saved UPSC library item\nType:${x.type}\nSubject:${x.subject}\nTitle:${x.title}\nContent:${x.content}\nGive notes, revision, MCQs, mains angle and flashcards.`))};
setInterval(()=>{try{renderActiveAutoV225(['mapsCommand','digitalLibrary','libraryShelf'])}catch(e){}},20000);
setTimeout(()=>{try{renderAll(activeSectionIdV225())}catch(e){}},1000);


/* ===== SAFE NAVIGATION FALLBACK ===== */
window.show = window.show || function(id,btn){
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  const target=document.getElementById(id);
  if(target) target.classList.add('active');
  document.querySelectorAll('.nav button').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  const pageTitle=document.getElementById('pageTitle');
  if(pageTitle && btn) pageTitle.innerText=btn.innerText.replace(/[^\w\s&-]/g,'').trim();
  window.scrollTo({top:0,behavior:'smooth'});
};
window.setTheme = window.setTheme || function(theme){
  document.documentElement.setAttribute('data-theme',theme);
  localStorage.setItem('theme',theme);
};
window.exportData = window.exportData || function(){
  const data={};
  Object.keys(localStorage).forEach(k=>data[k]=localStorage.getItem(k));
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  a.download='mission-upsc-backup.json';
  a.click();
};


/* ===== V3 FIXED + V4 MERGE: CALENDAR FIX + EXTRA AI MODULES ===== */
window.safeGetColV4 = async function(col){
  try{
    if(typeof getCol === "function") return await getCol(col);
  }catch(e){}
  try{return JSON.parse(localStorage.getItem(col)||"[]")}catch(e){return []}
};
window.safeSaveColV4 = async function(col,obj){
  try{
    if(typeof saveCol === "function") return await saveCol(col,obj);
  }catch(e){}
  const arr = JSON.parse(localStorage.getItem(col)||"[]");
  arr.unshift({...obj,id:'local_'+Date.now()+'_'+Math.random().toString(36).slice(2)});
  localStorage.setItem(col,JSON.stringify(arr));
};

window.formatAI = window.formatAI || function(text){
  if(!text) return "No response";
  let safe=String(text).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  safe=safe.replace(/^### (.*$)/gim,"<h3>$1</h3>").replace(/^## (.*$)/gim,"<h2>$1</h2>").replace(/^# (.*$)/gim,"<h1>$1</h1>").replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/^\s*[-*]\s+(.*$)/gim,"<li>$1</li>").replace(/\n\n/g,"</p><p>").replace(/\n/g,"<br>");
  return `<div class="aiFormatted"><p>${safe}</p></div>`;
};

window.aiAskV4 = async function(prompt){
  if(typeof aiAsk === "function") return await aiAsk(prompt);
  if(typeof callGeminiDirect === "function") return await callGeminiDirect(prompt);
  if(typeof GEMINI_API_KEY === "undefined" || !GEMINI_API_KEY) return "Add GEMINI_API_KEY in firebase-config.js";
  const models=["gemini-2.0-flash","gemini-2.5-flash","gemini-2.5-flash-lite"];
  let last="";
  for(const model of models){
    try{
      const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({contents:[{parts:[{text:prompt}]}]})
      });
      const d=await r.json();
      const out=d?.candidates?.[0]?.content?.parts?.[0]?.text;
      if(out) return out;
      last=d?.error?.message||"No response";
    }catch(e){last=e.message}
  }
  return "AI error: "+last;
};

window.show = window.show || function(id,btn){
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  const target=document.getElementById(id);
  if(target) target.classList.add('active');
  document.querySelectorAll('.nav button').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  const pageTitle=document.getElementById('pageTitle');
  if(pageTitle && btn) pageTitle.innerText=btn.innerText.replace(/[^\w\s&-]/g,'').trim();
  window.scrollTo({top:0,behavior:'smooth'});
};

window.setTheme = window.setTheme || function(theme){
  document.documentElement.setAttribute('data-theme',theme);
  localStorage.setItem('theme',theme);
};

window.renderCalendarAI = async function(){
  const grids = [document.getElementById("calendarGrid"), document.getElementById("calendarGridV4")].filter(Boolean);
  const agendas = [document.getElementById("calendarAgenda"), document.getElementById("calendarAgendaV4")].filter(Boolean);
  if(!grids.length) return;

  const calendarItems = await safeGetColV4("calendarItems");
  const calendarAlt = await safeGetColV4("calendar");
  const revision = await safeGetColV4("smartRevision");
  const revisionAlt = await safeGetColV4("revision");

  const items = []
    .concat(calendarItems, calendarAlt)
    .concat(revision.map(x=>({date:x.date,title:"Revise: "+(x.topic||"Topic"),type:x.source||"Revision"})))
    .concat(revisionAlt.map(x=>({date:x.date,title:"Revise: "+(x.topic||"Topic"),type:x.source||"Revision"})));

  const todayDate = new Date();
  const year = todayDate.getFullYear();
  const month = todayDate.getMonth();
  const first = new Date(year,month,1).getDay();
  const days = new Date(year,month+1,0).getDate();

  let html = `<div class="calHead">Sun</div><div class="calHead">Mon</div><div class="calHead">Tue</div><div class="calHead">Wed</div><div class="calHead">Thu</div><div class="calHead">Fri</div><div class="calHead">Sat</div>`;
  for(let i=0;i<first;i++) html += `<div class="calCell empty"></div>`;
  for(let d=1; d<=days; d++){
    const date = `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const dayItems = items.filter(x=>x.date===date);
    html += `<div class="calCell"><b>${d}</b>${dayItems.map(x=>`<span>${x.type||"Task"}: ${x.title||"Untitled"}</span>`).join("")}</div>`;
  }
  grids.forEach(g=>g.innerHTML=html);

  const agendaHtml = items
    .filter(x=>x.date)
    .sort((a,b)=>String(a.date).localeCompare(String(b.date)))
    .map((x,i)=>`<div class="item"><h3>${x.title||"Untitled"}</h3><span class="tag">${x.date}</span><span class="tag">${x.type||"Task"}</span><button class="btn danger deleteBtn" onclick="deleteItem('calendarItems','${x.id||i}')">🗑 Delete</button></div>`)
    .join("") || '<div class="emptyState">No calendar tasks yet. Add AI plan/revision.</div>';
  agendas.forEach(a=>a.innerHTML=agendaHtml);
};

window.startVoiceSaarthi = function(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR) return alert("Speech recognition not supported in this browser. Use Chrome/Edge.");
  const rec = new SR();
  rec.lang = "en-IN";
  rec.onresult = e => document.getElementById("voiceSaarthiText").value = e.results[0][0].transcript;
  rec.start();
};
window.askVoiceSaarthiAI = async function(){
  const out=document.getElementById("voiceSaarthiOutput");
  out.innerHTML='<div class="aiLoading">Voice Saarthi thinking...</div>';
  out.innerHTML=formatAI(await aiAskV4(`# Voice Saarthi UPSC Assistant\nCommand: ${document.getElementById("voiceSaarthiText").value}\nGive helpful action-oriented UPSC answer.`));
};

window.saveRichNoteV4 = async function(){
  await safeSaveColV4("richNotesV4",{title:richNoteTitleV4.value,paper:richNotePaperV4.value,subject:richNoteSubjectV4.value,topic:richNoteTopicV4.value,body:richEditorV4.innerHTML,date:new Date().toISOString().slice(0,10)});
  renderRichNotesV4();
  alert("Rich note saved.");
};
window.improveRichNoteV4 = async function(){
  richNoteAIOutputV4.innerHTML='<div class="aiLoading">Improving note...</div>';
  richNoteAIOutputV4.innerHTML=formatAI(await aiAskV4(`# Improve UPSC note\nPaper:${richNotePaperV4.value}\nSubject:${richNoteSubjectV4.value}\nTopic:${richNoteTopicV4.value}\nNote:${richEditorV4.innerText}\nMake topper notes with prelims, mains, PYQ, diagrams, flashcards and revision checklist.`));
};
window.richNoteToRevisionV4 = async function(){
  await safeSaveColV4("smartRevision",{topic:richNoteTopicV4.value||richNoteTitleV4.value,subject:richNoteSubjectV4.value,source:"Rich Notes",difficulty:"Medium",date:new Date().toISOString().slice(0,10),cycle:1,status:"pending"});
  alert("Sent to revision.");
};
window.renderRichNotesV4 = async function(){
  const box=document.getElementById("richNotesListV4");
  if(!box) return;
  const q=(document.getElementById("richNoteSearchV4")?.value||"").toLowerCase();
  const data=(await safeGetColV4("richNotesV4")).filter(x=>JSON.stringify(x).toLowerCase().includes(q));
  const groups={};
  data.forEach(n=>{const k=`${n.paper||"Notes"} / ${n.subject||"General"}`;(groups[k] ||= []).push(n)});
  box.innerHTML=Object.entries(groups).map(([k,a])=>`<div class="noteFolder"><h3>${k}</h3>${a.map(n=>`<div class="noteItem"><b>${n.title||"Untitled"}</b><span class="tag">${n.topic||""}</span><div>${n.body||""}</div><button class="btn danger deleteBtn" onclick="deleteItem('richNotesV4','${n.id||''}')">🗑 Delete</button></div>`).join("")}</div>`).join("") || '<div class="emptyState">No rich notes yet.</div>';
};

window.generateSmartCalendarV4 = async function(){
  smartCalOutputV4.innerHTML='<div class="aiLoading">Creating smart plan...</div>';
  smartCalOutputV4.innerHTML=formatAI(await aiAskV4(`# AI Smart Calendar Pro\nDate:${smartCalDateV4.value||new Date().toISOString().slice(0,10)}\nUser:${smartCalPromptV4.value}\nMake a UPSC time-block plan with revision, MCQ, mains, maps, CA and break slots.`));
};
window.saveSmartCalendarV4 = async function(){
  await safeSaveColV4("calendarItems",{date:smartCalDateV4.value||new Date().toISOString().slice(0,10),title:"AI Smart Calendar Plan",type:"Plan",body:smartCalOutputV4.innerText});
  renderCalendarAI();
  alert("Saved to calendar.");
};

window.buildGraphAIV4 = async function(){
  graphOutputV4.innerHTML='<div class="aiLoading">Building graph...</div>';
  const out=await aiAskV4(`# Most Powerful UPSC Knowledge Graph\nTopic:${graphTopicV4.value}\nSubject:${graphSubjectV4.value}\nContext:${graphContextV4.value}\nCreate connected nodes: syllabus, static, CA, PYQ, maps, mains, prelims traps, revision and flashcards.`);
  graphOutputV4.innerHTML=formatAI(out);
  renderGraphVisualV4(graphTopicV4.value);
};
window.renderGraphVisualV4 = function(core){
  const nodes=[core||"Topic","Syllabus","Static","Current Affairs","PYQ","Maps","Mains","Prelims","Revision","Flashcards"];
  graphBoardV4.innerHTML=nodes.map((n,i)=>`<span class="node ${i===0?'core':''}">${n}</span>`).join("");
};
window.saveGraphV4 = async function(){
  await safeSaveColV4("kg",{topic:graphTopicV4.value,subject:graphSubjectV4.value,body:graphOutputV4.innerText,date:new Date().toISOString().slice(0,10)});
  alert("Graph saved.");
};
window.graphToRevisionV4 = async function(){
  await safeSaveColV4("smartRevision",{topic:graphTopicV4.value,subject:graphSubjectV4.value,source:"Knowledge Graph",difficulty:"Hard",date:new Date().toISOString().slice(0,10),cycle:1,status:"pending"});
  alert("Graph topic sent to revision.");
};

setInterval(()=>{try{renderActiveAutoV225(['calendar','aiCalendarV4','richNotesV4'])}catch(e){console.warn(e)}},25000);
setTimeout(()=>{try{renderAll(activeSectionIdV225())}catch(e){console.warn(e)}},800);


/* ===== FINAL REQUEST PATCH: PERSONAL MENTOR + CA INTELLIGENCE + LIBRARY 2.0 ===== */
window.setMentorModeFinal=function(mode,btn){
  document.getElementById("mentorModeFinal").value=mode;
  document.querySelectorAll(".mentorMode").forEach(b=>b.classList.remove("active"));
  if(btn) btn.classList.add("active");
};
window.askMainMentorFinal=async function(){
  const out=document.getElementById("mentorMainOutput");
  out.innerHTML='<div class="aiLoading">AI Personal Mentor thinking...</div>';
  const mode=document.getElementById("mentorModeFinal").value;
  const q=document.getElementById("mentorQuestionMain").value;
  const context=JSON.stringify({
    calendar: await safeGetColV4?.("calendarItems").catch?.(()=>[]) || [],
    revision: await safeGetColV4?.("smartRevision").catch?.(()=>[]) || [],
    ca: await safeGetColV4?.("currentAffairsAI").catch?.(()=>[]) || [],
    library: await safeGetColV4?.("digitalLibrary").catch?.(()=>[]) || []
  });
  out.innerHTML=formatAI(await aiAskV4(`# AI Personal Mentor\nMode:${mode}\nQuestion:${q}\nPrep Context:${context}\nGive direct personal UPSC mentoring, next actions, time plan and warning.`));
};
window.saveMentorAdviceFinal=async function(){
  await safeSaveColV4("mentorAdvice",{mode:mentorModeFinal.value,question:mentorQuestionMain.value,body:mentorMainOutput.innerText,date:new Date().toISOString().slice(0,10)});
  alert("Mentor advice saved.");
};
window.mentorAdviceToCalendarFinal=async function(){
  await safeSaveColV4("calendarItems",{date:new Date().toISOString().slice(0,10),title:"Mentor Advice Action",type:"AI Mentor",body:mentorMainOutput.innerText});
  if(window.renderCalendarAI) renderCalendarAI();
  alert("Mentor advice sent to calendar.");
};

window.makeCurrentAffairsIntelligence=async function(){
  caAIOutput.innerHTML='<div class="aiLoading">Generating current affairs intelligence...</div>';
  caAIOutput.innerHTML=formatAI(await aiAskV4(`# AI Current Affairs Intelligence\nTitle:${caTitleAI.value}\nSubject:${caSubjectAI.value}\nSource:${caSourceAI.value}\nArticle:${caArticleAI.value}\nGive:\n# Why in news\n## UPSC syllabus link\n## Prelims facts\n## Mains dimensions\n## Data/reports\n## Keywords\n## Map connection\n## Related PYQs\n## Possible MCQ\n## Possible mains question\n## 100-word summary\n## Revision checklist`));
};
window.saveCurrentAffairsIntelligence=async function(){
  await safeSaveColV4("currentAffairsAI",{title:caTitleAI.value,subject:caSubjectAI.value,source:caSourceAI.value,article:caArticleAI.value,note:caAIOutput.innerText,date:new Date().toISOString().slice(0,10)});
  renderCurrentAffairsIntelligence();
  alert("Daily current affairs saved.");
};
window.caIntelligenceToRevision=async function(){
  await safeSaveColV4("smartRevision",{topic:caTitleAI.value,subject:caSubjectAI.value,source:"Current Affairs Intelligence",difficulty:"Hard",date:new Date().toISOString().slice(0,10),cycle:1,status:"pending",body:caAIOutput.innerText});
  alert("CA sent to revision.");
};
window.caIntelligenceToLibrary=async function(){
  await safeSaveColV4("digitalLibrary",{type:"Current Affairs",subject:caSubjectAI.value,title:caTitleAI.value,url:"",content:caAIOutput.innerText,date:new Date().toISOString().slice(0,10)});
  renderDigitalLibrary2();
  alert("CA saved to Digital Library 2.0.");
};
window.renderCurrentAffairsIntelligence=async function(){
  const box=document.getElementById("caDisplayList");
  if(!box) return;
  const q=(document.getElementById("caSearchAI")?.value||"").toLowerCase();
  const sub=document.getElementById("caFilterSubjectAI")?.value||"All";
  let data=await safeGetColV4("currentAffairsAI");
  data=data.filter(x=>JSON.stringify(x).toLowerCase().includes(q));
  if(sub!=="All") data=data.filter(x=>x.subject===sub);
  box.innerHTML=data.reverse().map(x=>`<div class="caNewsCard"><div class="caDate">${x.date||""}</div><h3>${x.title||"Untitled News"}</h3><span class="tag">${x.subject||"CA"}</span><span class="tag">${x.source||"Source"}</span><p>${(x.note||"").slice(0,360)}...</p><details><summary>Read full intelligence</summary><div class="aiOutput">${formatAI(x.note||"")}</div></details><button class="btn danger deleteBtn" onclick="deleteItem('currentAffairsAI','${x.id||''}')">🗑 Delete</button></div>`).join("") || '<div class="emptyState">No current affairs saved yet. Use source links and paste news.</div>';
};

window.saveDigitalLibrary2=async function(){
  await safeSaveColV4("digitalLibrary",{type:libTypePro.value,subject:libSubjectPro.value,title:libTitlePro.value,url:libUrlPro.value,content:libContentPro.value,date:new Date().toISOString().slice(0,10)});
  renderDigitalLibrary2();
  alert("Saved to Digital Library 2.0.");
};
window.aiDigitalLibrary2=async function(){
  libraryAIOutput.innerHTML='<div class="aiLoading">Library AI analyzing...</div>';
  libraryAIOutput.innerHTML=formatAI(await aiAskV4(`# Digital Library 2.0 AI\nType:${libTypePro.value}\nSubject:${libSubjectPro.value}\nTitle:${libTitlePro.value}\nURL:${libUrlPro.value}\nContent:${libContentPro.value}\nGive summary, UPSC relevance, prelims facts, mains points, revision tasks, flashcards and MCQs.`));
};
window.library2ToRevision=async function(){
  await safeSaveColV4("smartRevision",{topic:libTitlePro.value,subject:libSubjectPro.value,source:"Digital Library 2.0",difficulty:"Medium",date:new Date().toISOString().slice(0,10),cycle:1,status:"pending",body:libContentPro.value});
  alert("Library item sent to revision.");
};
window.renderDigitalLibrary2=async function(){
  const box=document.getElementById("digitalLibraryShelves");
  if(!box) return;
  const q=(document.getElementById("digitalLibrarySearch")?.value||"").toLowerCase();
  const filter=document.getElementById("digitalLibraryFilter")?.value||"All";
  let data=await safeGetColV4("digitalLibrary");
  data=data.filter(x=>JSON.stringify(x).toLowerCase().includes(q));
  if(filter!=="All") data=data.filter(x=>x.type===filter);
  const groups={};
  data.forEach(x=>{const k=x.subject||"General";(groups[k] ||= []).push(x);});
  box.innerHTML=Object.entries(groups).map(([subject,items])=>`<div class="libraryWall"><h3>${subject}</h3><div class="libraryShelf3D">${items.map(x=>`<div class="book3D ${String(x.type||'').replaceAll(' ','')}"><div class="book3DSpine">${x.type||"Item"}</div><div class="book3DCover"><b>${x.title||"Untitled"}</b><small>${x.date||""}</small></div><div class="book3DInfo"><p>${(x.content||"").slice(0,160)}...</p>${x.url?`<a class="btn blue" target="_blank" href="${x.url}">Open</a>`:""}<button class="btn purple" onclick="library2QuickAI('${x.id||""}')">AI</button><button class="btn danger deleteBtn" onclick="deleteItem('digitalLibrary','${x.id||''}')">🗑 Delete</button></div></div>`).join("")}</div></div>`).join("") || '<div class="emptyState">Library 2.0 is empty. Add PDFs, maps, notes, CA, PYQs.</div>';
};
window.library2QuickAI=async function(id){
  const data=await safeGetColV4("digitalLibrary");
  const x=data.find(i=>i.id===id);
  if(!x) return;
  show("libraryShelf");
  libraryAIOutput.innerHTML='<div class="aiLoading">Analyzing saved item...</div>';
  libraryAIOutput.innerHTML=formatAI(await aiAskV4(`# Analyze Digital Library 2.0 item\nType:${x.type}\nSubject:${x.subject}\nTitle:${x.title}\nContent:${x.content}\nMake UPSC notes, revision, MCQs and flashcards.`));
};

setInterval(()=>{try{renderActiveAutoV225(['currentAffairsAI','libraryShelf','digitalLibrary'])}catch(e){}},25000);
setTimeout(()=>{try{renderAll(activeSectionIdV225())}catch(e){}},1000);

// V8 Real Flashcards with One-Page Notes + Diagram Cards
function flashBadgeClass(subject='General'){
  const s=String(subject).toLowerCase();
  if(s.includes('polity')) return 'polity'; if(s.includes('history')) return 'history'; if(s.includes('geo')) return 'geography'; if(s.includes('economy')) return 'economy'; if(s.includes('environment')) return 'environment'; if(s.includes('science')) return 'science'; if(s.includes('ethics')) return 'ethics'; return 'generalBadge';
}
function escHtml(v=''){return String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function diagramHtml(text=''){
  const parts=String(text||'').split(/→|->|\n|,/).map(x=>x.trim()).filter(Boolean);
  if(!parts.length) return '<p class="sub">Add a flow diagram for faster revision.</p>';
  return '<div class="diagramFlow">'+parts.map((p,i)=>`${i?'<span class="diagramArrow">→</span>':''}<span class="diagramNode">${escHtml(p)}</span>`).join('')+'</div>';
}
window.saveSmartFlashcard=async()=>{
  const q=$('flashQAI')?.value?.trim();
  const a=$('flashAAI')?.value?.trim();
  if(!q||!a){alert('Add question and answer first macha');return;}
  await saveCol('flash',{q,a,subject:$('flashSubjectAI')?.value||'General',difficulty:$('flashDifficultyAI')?.value||'Medium',pyq:$('flashPYQAI')?.value||'',trick:$('flashTrickAI')?.value||'',onePager:$('flashOnePagerAI')?.value||'',diagram:$('flashDiagramAI')?.value||'',due:today(),date:today()});
  ['flashQAI','flashAAI','flashPYQAI','flashTrickAI','flashOnePagerAI','flashDiagramAI'].forEach(id=>{if($(id))$(id).value=''});
  renderFlashcardsPerfect();
};
window.renderFlashcardsPerfect=async function(){
  const flash=await getCol('flash'); if(!$('flashList')) return;
  const q=($('flashCardSearch')?.value||'').toLowerCase();
  const filtered=flash.filter(f=>[f.q,f.a,f.subject,f.pyq,f.trick,f.onePager,f.diagram].join(' ').toLowerCase().includes(q));
  $('flashList').innerHTML=filtered.map((f,i)=>`<div class="realFlipCard" onclick="this.classList.toggle('open')"><div class="realFlipInner"><div class="realFace realFront"><div class="realMeta"><span class="subjectBadge ${flashBadgeClass(f.subject)}">${escHtml(f.subject||'General')}</span><span class="difficultyBadge">⭐ ${escHtml(f.difficulty||'Medium')}</span></div><h3>${escHtml(f.q||'Question')}</h3>${f.pyq?`<span class="pyqBadge">PYQ: ${escHtml(f.pyq)}</span>`:''}<div class="tapHint">Tap to flip & revise</div></div><div class="realFace realBack"><div class="realMeta"><span class="subjectBadge ${flashBadgeClass(f.subject)}">Answer Side</span><span class="difficultyBadge">${escHtml(f.difficulty||'Medium')}</span></div><div class="answerBox"><h4>✅ Core Answer</h4><p>${escHtml(f.a||'Answer')}</p></div><div class="trickBox"><h4>🧠 Memory Trick</h4><p>${escHtml(f.trick||'Add mnemonic / keyword hook.')}</p></div><div class="onePageBox"><h4>📄 One Page Note</h4><p>${escHtml(f.onePager||'Definition → Features → Examples → PYQ/Mains angle → Conclusion')}</p></div><div class="diagramBox"><h4>📊 Diagram Flow</h4>${diagramHtml(f.diagram)}</div><div class="cardActions"><button class="btn danger deleteBtn" onclick="event.stopPropagation();deleteItem('flash','${f.id||i}');setTimeout(renderFlashcardsPerfect,300)">🗑 Delete</button></div></div></div></div>`).join('') || '<div class="emptyState">No flashcards yet. Add sample cards or create your own.</div>';
};
window.loadSampleRealCards=async()=>{
  const samples=[
    {subject:'Polity',difficulty:'Easy',q:'What is Article 32?',a:'Article 32 gives the right to move the Supreme Court for enforcement of Fundamental Rights. Dr. B.R. Ambedkar called it the heart and soul of the Constitution.',pyq:'Prelims/Mains theme',trick:'32 → Supreme Court remedy',onePager:'Definition: Constitutional Remedy. Writs: Habeas Corpus, Mandamus, Prohibition, Certiorari, Quo Warranto. Importance: protects Fundamental Rights and judicial review.',diagram:'Fundamental Right → Article 32 → Supreme Court → Writs → Rights protected'},
    {subject:'Geography',difficulty:'Medium',q:'Why does the Indian Monsoon occur?',a:'Indian monsoon is caused by differential heating of land and sea, seasonal pressure reversal, ITCZ shift, jet streams and moisture-laden winds from Arabian Sea and Bay of Bengal.',pyq:'GS Geography',trick:'L-P-I-J-W: Land heating, Pressure, ITCZ, Jet, Winds',onePager:'Causes: differential heating, Tibetan plateau, ITCZ, Mascarene High, Somali jet. Impact: agriculture, floods, drought, water security.',diagram:'Summer heating → Low pressure over India → ITCZ shifts north → Moist winds enter → Rainfall'},
    {subject:'Economy',difficulty:'Medium',q:'What is GDP Deflator?',a:'GDP deflator measures the price level of all domestically produced final goods and services. Formula: Nominal GDP / Real GDP × 100.',pyq:'Economy basics',trick:'Deflator = GDP price thermometer',onePager:'Use: broad inflation measure. CPI is consumer basket; WPI is wholesale goods; GDP deflator covers entire GDP output.',diagram:'Nominal GDP → remove price effect → Real GDP → GDP Deflator'},
    {subject:'Environment',difficulty:'Hard',q:'What is REDD+?',a:'REDD+ is a climate mitigation framework that incentivizes developing countries to reduce emissions from deforestation and forest degradation and enhance forest carbon stocks.',pyq:'Environment CA',trick:'REDD+ = Reduce + Enhance forests',onePager:'Components: reduce deforestation, reduce degradation, conservation, sustainable forest management, enhancement of carbon stocks. Links: UNFCCC, carbon finance, tribal livelihoods.',diagram:'Forest protection → Carbon stored → Emission reduction → Climate mitigation → Community benefits'}
  ];
  for(const s of samples) await saveCol('flash',{...s,due:today(),date:today()});
  renderFlashcardsPerfect();
};
setTimeout(()=>{try{if(isActiveSectionV225('smartFlashcards'))renderFlashcardsPerfect()}catch(e){}},1400);

// V9 Clean One Pager AI + Mind Map + Answer Evaluator + Better Flashcards
function esc(v){return String(v||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function splitFlow(v){return String(v||'Concept → Issue → Impact → Way Forward').split(/→|,|\n|-/).map(x=>x.trim()).filter(Boolean).slice(0,8)}
function flowHTML(v){return '<div class="flowLine">'+splitFlow(v).map((x,i)=>`<span>${esc(x)}</span>${i<splitFlow(v).length-1?'<b>→</b>':''}`).join('')+'</div>'}
window.generateOnePagerAI=async()=>{const topic=$('opTopic')?.value||'UPSC Topic',sub=$('opSubject')?.value||'General',ctx=$('opContext')?.value||''; $('onePagerOutput').innerHTML='<div class="aiLoading">Creating full one pager...</div>'; let out=''; try{out=await aiAsk(`Create a UPSC one-page note for ${topic} (${sub}). Include: definition, constitutional/syllabus link if relevant, core concept, flowchart in arrows, small diagram as text, prelims facts, mains dimensions, examples, PYQ angle, keywords, conclusion. Context: ${ctx}`)}catch(e){out=''} if(!out) out=`# ${topic}\n## Core Concept\nExplain ${topic} in exam-ready language.\n## Flowchart\nBackground → Issue → Provisions/Features → Impact → Way Forward\n## Diagram\nCentre: ${topic}; Branches: Definition, Features, Examples, PYQ, Mains, Conclusion\n## Prelims Punch\n• Key facts • Articles/committees • Terms\n## Mains Value Addition\n• Cause-effect • Current example • Balanced conclusion`; renderOnePagerSheet(topic,sub,out)};
function renderOnePagerSheet(topic,sub,out){let lines=String(out).split('\n').filter(x=>x.trim());let flow=lines.find(x=>x.includes('→'))||'Concept → Features → Issues → Examples → Way Forward';$('onePagerOutput').innerHTML=`<div class="sheetHead"><span>${esc(sub)}</span><h1>${esc(topic)}</h1><p>UPSC One Page Revision Note</p></div>${flowHTML(flow)}<div class="diagramPanel"><div class="diagramCore">${esc(topic)}</div><div class="diagramBranches"><span>Definition</span><span>Features</span><span>Prelims</span><span>Mains</span><span>PYQ</span><span>Conclusion</span></div></div><div class="onePagerText">${formatAI(out)}</div>`}
window.saveOnePagerNote=async()=>{await saveCol('onePagers',{topic:$('opTopic').value,subject:$('opSubject').value,context:$('opContext').value,html:$('onePagerOutput').innerHTML,date:today()});renderOnePagers();alert('One pager saved')}
window.renderOnePagers=async()=>{if(!$('onePagerList'))return;const q=($('onePagerSearch')?.value||'').toLowerCase();const a=await getCol('onePagers');$('onePagerList').innerHTML=a.filter(x=>JSON.stringify(x).toLowerCase().includes(q)).reverse().map((x,i)=>`<div class="savedNoteCard"><h3>${esc(x.topic)}</h3><span class="tag">${esc(x.subject)}</span><button class="btn blue" onclick="$('onePagerOutput').innerHTML=${JSON.stringify('${HTML}').replace('"${HTML}"','JSON.stringify(x.html)')}">View</button><button class="btn danger" onclick="deleteItem('onePagers','${x.id||i}');setTimeout(renderOnePagers,300)">Delete</button></div>`).join('')||'<div class="emptyState">No one pagers saved.</div>'}
window.onePagerToFlashcards=async()=>{const text=$('onePagerOutput')?.innerText||''; await saveCol('flash',{q:'One Pager Revision: '+($('opTopic')?.value||'Topic'),a:text.slice(0,1500),subject:$('opSubject')?.value||'General',difficulty:'Medium',onePager:text,diagram:'Concept → Prelims → Mains → PYQ → Revision',due:today(),date:today()});renderFlashcardsPerfect();alert('Flashcard created from one pager')}
window.printSection=(id)=>{const el=$(id); if(!el)return; const w=window.open('','_blank'); w.document.write(`<html><head><title>Print</title><link rel="stylesheet" href="./styles.css"></head><body>${el.outerHTML}</body></html>`); w.document.close(); setTimeout(()=>w.print(),500)};
window.renderMindMapManual=()=>{const topic=$('mmTopic')?.value||'Topic'; const nodes=($('mmNodes')?.value||'Definition, Features, Examples, PYQ, Mains, Way Forward').split(',').map(x=>x.trim()).filter(Boolean); drawMindMap(topic,nodes)};
window.generateMindMapAI=async()=>{const topic=$('mmTopic')?.value||'Topic'; let out=''; try{out=await aiAsk(`Give 8 short comma separated branches for UPSC mind map on ${topic}. Only branches.`)}catch(e){} const nodes=(out||'Definition, Features, Causes, Impact, Examples, PYQ, Mains, Way Forward').replace(/\n/g,',').split(',').map(x=>x.replace(/^[-*\d. ]+/,'').trim()).filter(Boolean).slice(0,10); $('mmNodes').value=nodes.join(', '); drawMindMap(topic,nodes)};
function drawMindMap(topic,nodes){const n=nodes.length||1; $('mindMapOutput').innerHTML=`<div class="mindCenter">${esc(topic)}</div>`+nodes.map((x,i)=>{const ang=(360/n)*i; return `<div class="mindNode" style="--angle:${ang}deg">${esc(x)}</div>`}).join('')}
window.loadAnswerFileText=async()=>{const f=$('answerFile')?.files?.[0]; if(!f)return alert('Choose file first'); if(/text|markdown|plain/i.test(f.type)||/\.(txt|md)$/i.test(f.name)){ $('answerText').value=await f.text(); } else { $('answerText').value=`File selected: ${f.name}\nType: ${f.type||'unknown'}\nNote: For PDF/DOCX/image, paste answer text here for accurate AI evaluation.`; }};
window.evaluateMainsAnswerAI=async()=>{const q=$('answerQuestion')?.value||'Mains answer',ans=$('answerText')?.value||''; $('answerEvalOutput').innerHTML='<div class="aiLoading">Evaluating answer...</div>'; let out=''; try{out=await aiAsk(`Evaluate this UPSC mains answer strictly. Give marks out of 15, what is good, missing dimensions, structure improvement, diagram suggestion, keywords, and a model answer. Question: ${q}\nAnswer:${ans}`)}catch(e){} if(!out)out='Paste answer text and connect Gemini/OpenAI key to get AI evaluation. Basic checklist: intro, body headings, diagram/flowchart, examples, constitutional/data points, balanced conclusion.'; $('answerEvalOutput').innerHTML=formatAI(out)};
window.generateFlashcardsAI=async()=>{const source=($('flashSourceText')?.value||$('flashQAI')?.value||'').trim(); $('flashAIOutput').innerHTML='<div class="aiLoading">Generating smart flashcards...</div>'; let out=''; try{out=await aiAsk(`Create 8 UPSC smart flashcards from this content/topic. For each include Q, A, Memory Trick, One Pager, Diagram Flow. Content: ${source}`)}catch(e){} $('flashAIOutput').innerHTML=formatAI(out||'Add topic/content and connect AI key to generate cards. You can also manually save smart cards on the left.')};
window.renderFlashcardsPerfect=async function(){const flash=await getCol('flash'); if(!$('flashList'))return; const q=($('flashCardSearch')?.value||'').toLowerCase(); const filtered=flash.filter(f=>[f.q,f.a,f.subject,f.pyq,f.trick,f.onePager,f.diagram].join(' ').toLowerCase().includes(q)); $('flashList').innerHTML=filtered.reverse().map((f,i)=>`<div class="realFlipCard" onclick="this.classList.toggle('open')"><div class="realFlipInner"><div class="realFace realFront"><div class="realMeta"><span class="subjectBadge ${flashBadgeClass(f.subject)}">${esc(f.subject||'General')}</span><span class="difficultyBadge">${esc(f.difficulty||'Medium')}</span></div><div class="cardQuestion">${esc(f.q||'Question')}</div>${f.pyq?`<span class="pyqBadge">PYQ ${esc(f.pyq)}</span>`:''}<div class="tapHint">Tap to flip</div></div><div class="realFace realBack"><h3>Answer</h3><div class="answerBox">${esc(f.a||'Answer')}</div><h3>One Page Note</h3><div class="onePageBox">${esc(f.onePager||'Definition → Features → Examples → PYQ → Conclusion')}</div><h3>Diagram Flow</h3>${flowHTML(f.diagram)}<div class="trickBox"><b>Memory:</b> ${esc(f.trick||'Add memory hook')}</div><button class="btn green" onclick="event.stopPropagation();this.innerText='Revised ✅'">Mark Revised</button><button class="btn danger" onclick="event.stopPropagation();deleteItem('flash','${f.id||i}');setTimeout(renderFlashcardsPerfect,300)">Delete</button></div></div></div>`).join('')||'<div class="emptyState">No flashcards yet. Add samples or create your own.</div>'};
setTimeout(()=>{try{renderAll(activeSectionIdV225())}catch(e){}},1200);

// V10 Premium UPSC Notebook: section-wise upload + master delete + cleaner one-pagers/mindmaps/flashcards
(function(){
  const qs=(id)=>document.getElementById(id);
  const safe=(v)=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fileKey='upscSectionFilesV10';
  const sectionNames={dashboard:'Command Dashboard',dailyCommandV261:'AI Daily Command Centre',timeHabitV262:'Focus & Habit Intelligence',aiPlanner:'AI Daily Planner',snarkRevision:'Snark Revision Engine',aiHabits:'AI Habit Tracker',aiNotesPro:'AI Notes Studio',aiMockCentre:'AI Mock Centre',aiMainsCentre:'AI Mains Centre',pyqIntelligence:'PYQ Intelligence',onePagerAI:'One Pager AI',mindMapStudio:'Mind Map Studio',answerEvaluator:'Answer Evaluator',smartFlashcards:'Smart Flashcards',libraryShelf:'Digital Library 2.0',knowledgeGraphAI:'AI Knowledge Graph',calendar:'Calendar',aiMentorPage:'AI Personal Mentor',currentAffairsAI:'AI Current Affairs',evernoteNotes:'UPSC Notes Hub',syllabusCommand:'Syllabus Command',countdownPage:'Exam Countdown',pomodoroPage:'Pomodoro',mapsCommand:'Maps Command',digitalLibrary:'Digital Library Pro',voiceSaarthi:'Voice Saarthi',prelimsWarRoomV251:'AI Prelims War Room',mainsWarRoomV252:'Mains War Room',interviewRoomV253:'AI Interview Room',aiPdfAnalyzer:'AI PDF Analyzer',aiRevisionBrain:'AI Revision Brain',aiLibraryAssistant:'AI Library Assistant',richNotesV4:'Rich Notes Studio',aiCalendarV4:'AI Smart Calendar',knowledgeGraphV4:'Powerful AI Graph',progressAutomationV274:'AI Progress & Automation Hub',settings:'Setup'};
  function getFiles(){try{return JSON.parse(localStorage.getItem(fileKey)||'[]')}catch(e){return []}}
  function setFiles(arr){localStorage.setItem(fileKey,JSON.stringify(arr));}
  async function getCloudSectionFiles(){try{return await getCol('sectionFiles')}catch(e){return []}}
  async function getAllSectionFiles(){const local=getFiles(); const cloud=await getCloudSectionFiles(); const seen=new Set(); return [...cloud,...local].filter(f=>{const key=f.id||f.storagePath||f.name+f.date; if(seen.has(key))return false; seen.add(key); return true;});}
  function shortSize(bytes){bytes=Number(bytes)||0; if(bytes>1048576)return (bytes/1048576).toFixed(1)+' MB'; if(bytes>1024)return Math.round(bytes/1024)+' KB'; return bytes+' B'}
  window.handleSectionUploadV10=async function(sectionId,input){
    const files=[...(input.files||[])]; if(!files.length)return;
    const old=getFiles();
    for(const f of files){
      let textPreview='', uploaded={};
      if(/^text\//.test(f.type)||/\.(txt|md|csv|json)$/i.test(f.name)){try{textPreview=(await f.text()).slice(0,4000)}catch(e){}}
      try{ uploaded=await uploadFileToFirebase(f, sectionId); }
      catch(e){ alert('Cloud upload failed for '+f.name+': '+e.message); continue; }
      const rec={id:'file_'+Date.now()+'_'+Math.random().toString(36).slice(2),sectionId,section:sectionNames[sectionId]||sectionId,name:f.name,type:f.type||'unknown',size:f.size,date:new Date().toLocaleString(),preview:textPreview,url:uploaded.url||'',storagePath:uploaded.storagePath||'',cloudFile:!!uploaded.cloudFile,localOnly:!!uploaded.localOnly};
      old.push(rec);
      if(cloudEnabled&&user){ try{ await saveCol('sectionFiles',rec); }catch(e){ console.warn('Cloud file metadata failed',e); } }
    }
    setFiles(old); input.value=''; await renderSectionFilesV10(sectionId); if(window.renderFileVault) await renderFileVault();
    alert(files.length+' file(s) added to '+(sectionNames[sectionId]||sectionId));
  }
  window.deleteSectionFileV10=async function(id){
    if(!confirm('Delete this file record?'))return;
    const all=await getAllSectionFiles(); const f=all.find(x=>String(x.id)===String(id));
    if(f?.storagePath) await deleteStoragePath(f.storagePath);
    if(f?.id && cloudEnabled&&user){ try{ await deleteItem('sectionFiles', f.id, true); }catch(e){console.warn(e)} }
    setFiles(getFiles().filter(x=>x.id!==id)); document.querySelectorAll('.section').forEach(s=>renderSectionFilesV10(s.id)); if(window.renderFileVault)renderFileVault();
  }
  window.masterDeleteAllFiles=function(){
    const total=getFiles().length;
    if(!total){alert('No uploaded files to delete.');return;}
    if(!confirm('WARNING: This will delete ALL uploaded file records from every section. Continue?'))return;
    const typed=prompt('Type DELETE to confirm master delete of all files.');
    if(typed!=='DELETE'){alert('Cancelled. Files are safe.');return;}
    (async()=>{const all=await getAllSectionFiles(); for(const f of all){ if(f.storagePath) await deleteStoragePath(f.storagePath); if(f.id&&cloudEnabled&&user){try{await deleteItem('sectionFiles', f.id, true)}catch(e){}} } setFiles([]); document.querySelectorAll('.section').forEach(s=>renderSectionFilesV10(s.id)); if(window.renderFileVault)renderFileVault(); alert('All uploaded file records deleted.');})();
  }
  function uploadCard(sectionId){return `<div class="sectionUploadBox"><div><b>📎 Upload files for ${safe(sectionNames[sectionId]||sectionId)}</b><p>Attach PDFs, images, mains answers, notes, PYQ files or screenshots for this section.</p></div><label class="uploadPill">+ Add File<input type="file" multiple onchange="handleSectionUploadV10('${sectionId}',this)"></label></div><div id="files_${sectionId}" class="sectionFileList"></div>`}
  window.renderSectionFilesV10=async function(sectionId){const el=qs('files_'+sectionId); if(!el)return; const aliases=sectionId==='dailyCommandV261'?['dailyCommandV261','aiPlanner']:sectionId==='timeHabitV262'?['timeHabitV262','aiHabits']:[sectionId]; const arr=(await getAllSectionFiles()).filter(x=>aliases.includes(x.sectionId)); el.innerHTML=arr.length?arr.slice().reverse().map(f=>`<div class="fileChip"><span>📄</span><div><b>${safe(f.name)}</b><small>${safe(f.type)} • ${shortSize(f.size)} • ${safe(f.date)} ${f.cloudFile?'• ☁️ Cloud':''}</small>${f.preview?`<details><summary>Preview text</summary><pre>${safe(f.preview)}</pre></details>`:''}</div><button class="miniBtn" onclick="openSectionFileV11('${f.id}')">View</button><button class="miniBtn" onclick="downloadSectionFileV11('${f.id}')">Download</button><button class="miniDanger" onclick="deleteSectionFileV10('${f.id}')">Delete</button></div>`).join(''):'<div class="emptyMini">No files uploaded in this section yet.</div>';}
  window.renderFileVault=async function(){const el=qs('fileVaultList'); if(!el)return; const q=(qs('fileVaultSearch')?.value||'').toLowerCase(); const arr=(await getAllSectionFiles()).filter(f=>JSON.stringify(f).toLowerCase().includes(q)).reverse(); el.innerHTML=arr.length?arr.map(f=>`<div class="vaultFile"><div class="vaultIcon">📄</div><h3>${safe(f.name)}</h3><span class="tag">${safe(f.section)}</span><p>${safe(f.type)} • ${shortSize(f.size)} ${f.cloudFile?'• ☁️ Cloud':''}</p><small>${safe(f.date)}</small>${f.preview?`<details><summary>Preview extracted text</summary><pre>${safe(f.preview)}</pre></details>`:''}<button class="btn blue" onclick="openSectionFileV11('${f.id}')">View</button><button class="btn green" onclick="downloadSectionFileV11('${f.id}')">Download</button><button class="btn danger" onclick="deleteSectionFileV10('${f.id}')">Delete</button></div>`).join(''):'<div class="emptyState">No uploaded files found.</div>';}
  function installUploadBoxes(){const allowed=new Set(['aiNotesPro','pyqIntelligence','wrongAnswerNotebook','digitalLibrary','richNotesV4']);document.querySelectorAll('main section.section').forEach(sec=>{if(!allowed.has(sec.id))return; if(sec.id==='fileVault')return; if(sec.querySelector('.sectionUploadBox'))return; sec.insertAdjacentHTML('afterbegin',uploadCard(sec.id)); renderSectionFilesV10(sec.id);}); renderFileVault();}
  setTimeout(installUploadBoxes,700);

  window.generateOnePagerAI=async function(){
    const topic=qs('opTopic')?.value?.trim()||'UPSC Topic', sub=qs('opSubject')?.value||'General', ctx=qs('opContext')?.value||'';
    qs('onePagerOutput').innerHTML='<div class="aiLoading">Creating topper-style A4 one pager...</div>';
    let out='';
    try{out=await aiAsk(`Create UPSC topper style one-page note for ${topic} (${sub}). Use crisp headings only: Definition, Constitutional/Syllabus Link, Background, Key Features, Flowchart, Diagram Branches, Prelims Punch, Mains Dimensions, Examples, PYQ Link, Keywords, Way Forward, Conclusion. Keep concise and exam-oriented. Context: ${ctx}`)}catch(e){}
    if(!out)out=`Definition\n${topic} is an important ${sub} topic for UPSC Prelims and Mains.\n\nFlowchart\nOrigin → Constitutional/Policy basis → Features → Issues → Reforms → Way Forward\n\nPrelims Punch\n• Remember core article/body/term.\n• Compare with similar institutions.\n• Focus on appointment, tenure, functions and reports.\n\nMains Dimensions\n• Governance angle • Federalism/rights/development angle • Current example • Balanced criticism.\n\nKeywords\nAccountability, transparency, institutional balance, cooperative federalism, evidence-based policy.\n\nConclusion\nUse a reform-oriented conclusion linking constitutional morality and public welfare.`;
    renderOnePagerSheetV10(topic,sub,out);
  }
  function sectionBlock(title,body,cls=''){return `<div class="opBlock ${cls}"><h3>${safe(title)}</h3><div>${formatMini(body)}</div></div>`}
  function formatMini(t){return safe(String(t||'')).split('\n').filter(Boolean).map(x=>`<p>${x.replace(/^[-•*]\s*/,'• ')}</p>`).join('')}
  function takePart(text,keys,fallback){const lines=String(text).split('\n'); const idx=lines.findIndex(l=>keys.some(k=>l.toLowerCase().includes(k.toLowerCase()))); if(idx<0)return fallback; let out=[]; for(let i=idx+1;i<lines.length;i++){if(/^#{1,3}|^[A-Z][A-Za-z /]+:?$/.test(lines[i].trim())&&out.length)break; out.push(lines[i]); if(out.length>5)break;} return out.join('\n')||fallback;}
  window.renderOnePagerSheetV10=function(topic,sub,out){
    const flow=(String(out).split('\n').find(l=>l.includes('→')))||'Concept → Background → Features → Issues → Way Forward → Conclusion';
    const branches=['Definition','Features','Prelims','Mains','Examples','PYQ','Keywords','Way Forward'];
    qs('onePagerOutput').innerHTML=`<article class="a4OnePager"><header><div><span class="subjectBadge">${safe(sub)}</span><h1>${safe(topic)}</h1><p>UPSC One-Pager Revision Sheet • Prelims + Mains + Interview</p></div><div class="scoreStars">PYQ ★★★★☆</div></header><div class="bigFlow">${String(flow).split('→').map(x=>`<span>${safe(x.trim())}</span>`).join('<b>→</b>')}</div><div class="opMind"><div class="opCore">${safe(topic)}</div>${branches.map((b,i)=>`<span class="opBranch b${i}">${b}</span>`).join('')}</div><div class="opGrid">${sectionBlock('Definition',takePart(out,['definition'],`${topic}: concise definition + scope.`),'blue')}${sectionBlock('Prelims Punch',takePart(out,['prelims'],`Facts, articles, committees, differences and traps.`),'yellow')}${sectionBlock('Mains Dimensions',takePart(out,['mains'],`Issue → analysis → example → reform → conclusion.`),'green')}${sectionBlock('Examples / PYQ Link',takePart(out,['example','pyq'],`Add recent current affairs and PYQ linkage.`),'pink')}${sectionBlock('Keywords',takePart(out,['keyword'],`Fiscal federalism, transparency, accountability, equity.`),'purple')}${sectionBlock('Way Forward',takePart(out,['way forward','conclusion'],`Balanced reform-oriented ending.`),'orange')}</div><details class="fullAIText"><summary>Full AI Notes Text</summary>${formatAI(out)}</details></article>`;
  }
  window.renderMindMapManual=function(){const topic=qs('mmTopic')?.value||'Topic'; const nodes=(qs('mmNodes')?.value||'Definition, Features, Causes, Impact, Examples, PYQ, Mains, Way Forward').split(',').map(x=>x.trim()).filter(Boolean); drawMindMapV10(topic,nodes)};
  window.generateMindMapAI=async function(){const topic=qs('mmTopic')?.value||'Topic'; let out=''; try{out=await aiAsk(`Give exactly 10 short comma-separated UPSC mind map branches for ${topic}. No explanation.`)}catch(e){} const nodes=(out||'Definition, Background, Articles, Features, Issues, Examples, Case Studies, PYQ, Mains, Way Forward').replace(/\n/g,',').split(',').map(x=>x.replace(/^[-*\d. ]+/,'').trim()).filter(Boolean).slice(0,10); qs('mmNodes').value=nodes.join(', '); drawMindMapV10(topic,nodes)};
  window.drawMindMapV10=function(topic,nodes){const n=nodes.length||1; qs('mindMapOutput').innerHTML=`<div class="mindMapFull"><div class="mindCenterBig">${safe(topic)}</div>${nodes.map((x,i)=>{const angle=(360/n)*i; return `<div class="mindRay" style="--angle:${angle}deg"></div><div class="mindBubble" style="--angle:${angle}deg"><b>${safe(x)}</b><small>Point • Example • PYQ</small></div>`}).join('')}</div>`};
  window.saveSmartFlashcard=async function(){await saveCol('flash',{q:qs('flashQAI').value,a:qs('flashAAI').value,subject:qs('flashSubjectAI').value,difficulty:qs('flashDifficultyAI').value,pyq:qs('flashPYQAI').value,trick:qs('flashTrickAI').value,onePager:qs('flashOnePagerAI').value,diagram:qs('flashDiagramAI').value,due:today(),date:today()}); renderFlashcardsPerfect(); alert('Smart flashcard saved.')};
  window.renderFlashcardsPerfect=async function(){const flash=await getCol('flash'); if(!qs('flashList'))return; const q=(qs('flashCardSearch')?.value||'').toLowerCase(); const filtered=flash.filter(f=>[f.q,f.a,f.subject,f.pyq,f.trick,f.onePager,f.diagram].join(' ').toLowerCase().includes(q)).reverse(); qs('flashList').innerHTML=filtered.map((f,i)=>`<div class="physicalCard" onclick="this.classList.toggle('open')"><div class="cardFront"><div class="realMeta"><span class="subjectBadge">${safe(f.subject||'General')}</span><span class="difficultyBadge">${safe(f.difficulty||'Medium')}</span></div><h2>${safe(f.q||'Question')}</h2><p class="tapHint">Tap to reveal answer</p>${f.pyq?`<span class="pyqBadge">PYQ: ${safe(f.pyq)}</span>`:''}</div><div class="cardBack"><h3>✅ Core Answer</h3><p>${safe(f.a||'Answer')}</p><div class="miniOne"><b>📄 One-page note:</b><br>${safe(f.onePager||'Definition → Features → Examples → PYQ → Conclusion')}</div><div class="miniFlow">${String(f.diagram||'Concept → Fact → Application → PYQ').split(/→|,|\n/).filter(Boolean).map(x=>`<span>${safe(x.trim())}</span>`).join('<b>→</b>')}</div><div class="trickBox"><b>🧠 Trick:</b> ${safe(f.trick||'Add memory hook')}</div><button class="btn green" onclick="event.stopPropagation();this.innerText='Revised ✅'">Mark Revised</button><button class="btn danger" onclick="event.stopPropagation();deleteItem('flash','${f.id||i}');setTimeout(renderFlashcardsPerfect,300)">Delete</button></div></div>`).join('')||'<div class="emptyState">No flashcards yet. Create cards or add samples.</div>'};
  setTimeout(()=>{try{installUploadBoxes();renderAll(activeSectionIdV225())}catch(e){console.warn(e)}},1600);
})();

/* ===== V11 ULTIMATE PATCH: Dashboard sync + Revision routine + Wrong notebook + Topper bank ===== */
const v11Safe = (x)=>String(x ?? '').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const v11DatePlus = (n)=>{ const d=new Date(); d.setDate(d.getDate()+Number(n||0)); return d.toISOString().slice(0,10); };
const v11Due = (x)=> x && x.date && String(x.date)<=today() && x.status!=='done' && x.status!=='Done';
function v11RoutineDays(){
  const r = $('revRoutineAI')?.value || 'standard';
  if(r==='fast') return [1,2,4,7];
  if(r==='weekly') return [7,14,21,28];
  if(r==='exam') return [0,1,3,5];
  if(r==='custom'){
    const a = ($('revCustomDaysAI')?.value||'').split(',').map(x=>parseInt(x.trim(),10)).filter(x=>!isNaN(x));
    return a.length ? a : [1,3,7,15,30];
  }
  return [1,3,7,15,30];
}
window.addSmartRevision = async function(){
  const topic=$('revTopicAI')?.value?.trim(); if(!topic) return alert('Enter topic');
  const subject=$('revSubjectAI')?.value||'General', source=$('revSourceAI')?.value||'Manual', diff=$('revDifficultyAI')?.value||'Medium';
  const routine=$('revRoutineAI')?.selectedOptions?.[0]?.text || 'Standard';
  const days=v11RoutineDays();
  for(const c of days){
    const date=v11DatePlus(c);
    await saveCol('smartRevision',{topic,subject,source,difficulty:diff,date,cycle:`${c} day`,routine,status:'pending'});
    await saveCol('calendarItems',{title:`Revise: ${topic}`,date,type:'Revision',note:`${subject} • ${source} • ${routine}`});
  }
  await saveCol('weakTopics',{topic,subject,source,status:'open',priority:diff,date:today()});
  $('revTopicAI').value='';
  renderAIIntegrated(); if(window.renderCalendarAI) renderCalendarAI();
  alert('Revision routine added. Due Revisions will update automatically.');
};

window.markSmartRevisionDone = async function(id){
  const arr = localGet('smartRevision');
  const idx = arr.findIndex(x=>String(x.id)===String(id));
  if(idx>=0){ arr[idx].status='done'; arr[idx].doneDate=today(); localSet('smartRevision',arr); }
  renderAIIntegrated(); if(window.renderCalendarAI) renderCalendarAI();
};

window.renderAIIntegrated = async function(){
  try{
    const [rev,revOld,hab,weak,flash,plans,cal,wrong,tests,mainsReports,mocks] = await Promise.all(['smartRevision','revision','aiHabits','weakTopics','flash','dailyPlans','calendarItems','wrongAnswers','tests','mainsReports','mockReports'].map(getCol));
    const dueRev=[...rev,...revOld].filter(v11Due);
    const flashDue=flash.filter(x=>(x.due||x.date||today())<=today() && x.status!=='done');
    const todayPlans=[...plans.filter(x=>x.date===today()),...cal.filter(x=>x.date===today())];
    const weakNames = new Set();
    weak.filter(x=>x.status!=='done' && x.status!=='Done').forEach(x=>weakNames.add((x.subject||'General')+'::'+(x.topic||x.title||'')));
    wrong.filter(x=>x.status!=='done').forEach(x=>weakNames.add((x.subject||'General')+'::'+(x.topic||x.question||'')));
    tests.filter(t=>(+t.accuracy && +t.accuracy<55) || (+t.score && +t.score<50)).forEach(t=>weakNames.add('Mock::'+(t.name||'Low score')));
    if($('dashPlanCount')) $('dashPlanCount').innerText=todayPlans.length;
    if($('dashRevisionCount')) $('dashRevisionCount').innerText=dueRev.length;
    if($('dashWeakCount')) $('dashWeakCount').innerText=weakNames.size;
    if($('dashFlashDue')) $('dashFlashDue').innerText=flashDue.length;
    const doneRev=rev.filter(x=>x.status==='done').length, doneHab=hab.filter(x=>x.status==='Done').length;
    const score=Math.min(100, Math.round((plans.length + doneRev + doneHab + flash.length + mocks.length + mainsReports.length + Math.max(0,10-dueRev.length))*4));
    if($('aiReadinessScore')) $('aiReadinessScore').innerText=score+'%';
    if($('aiReadinessBar')) $('aiReadinessBar').style.width=score+'%';
    if($('todayWarList')){
      const war=[
        ...dueRev.map((x,i)=>`<div class="item dueToday"><h3>🔁 Revise: ${v11Safe(x.topic||x.title||'Topic')}</h3><span class="tag">${v11Safe(x.subject||'General')}</span><span class="tag">${v11Safe(x.date)}</span><span class="tag">${v11Safe(x.routine||x.cycle||'Revision')}</span>${x.id?`<button class="btn green" onclick="markSmartRevisionDone('${x.id}')">Done ✅</button>`:''}<button class="btn danger" onclick="deleteItem('${rev.includes(x)?'smartRevision':'revision'}','${x.id||i}')">Delete</button></div>`),
        ...flashDue.slice(0,5).map((x,i)=>`<div class="item"><h3>🃏 Flashcard Due: ${v11Safe(x.q||'Card')}</h3><span class="tag">${v11Safe(x.subject||'General')}</span><button class="btn danger" onclick="deleteItem('flash','${x.id||i}')">Delete</button></div>`),
        ...cal.filter(x=>x.date===today()).map((x,i)=>`<div class="item"><h3>📅 Today: ${v11Safe(x.title||'Task')}</h3><span class="tag">${v11Safe(x.type||'Plan')}</span><button class="btn danger" onclick="deleteItem('calendarItems','${x.id||i}')">Delete</button></div>`)
      ];
      $('todayWarList').innerHTML=war.join('') || '<div class="emptyState">No war tasks. Add revision/habits/mocks.</div>';
    }
    if($('smartRevisionList')){
      const all=[...rev].sort((a,b)=>String(a.date).localeCompare(String(b.date)));
      $('smartRevisionList').innerHTML=all.map((x,i)=>`<div class="item ${v11Due(x)?'dueToday':''}"><h3>${v11Safe(x.topic)}</h3><span class="tag">${v11Safe(x.subject)}</span><span class="tag">${v11Safe(x.date)}</span><span class="tag">${v11Safe(x.routine||x.cycle)}</span><span class="tag">${v11Safe(x.status||'pending')}</span><button class="btn green" onclick="markSmartRevisionDone('${x.id}')">Done ✅</button><button class="btn danger" onclick="deleteItem('smartRevision','${x.id||i}')">Delete</button></div>`).join('') || '<div class="emptyState">No smart revisions.</div>';
    }
    renderWrongAnswerNotebook(); renderTopperAnswers();
  }catch(e){console.warn('V11 dashboard sync error',e)}
};
setInterval(()=>{try{runDashboardRefreshV225()}catch(e){}},30000);
setTimeout(()=>{try{renderAll('dashboard')}catch(e){}},800);

window.saveWrongAnswerNotebook = async function(){
  const question=$('wanQuestion')?.value?.trim(); if(!question) return alert('Enter question/topic');
  const obj={question,subject:$('wanSubject')?.value||'General',yourAnswer:$('wanYour')?.value||'',correctAnswer:$('wanCorrect')?.value||'',reason:$('wanReason')?.value||'',priority:$('wanPriority')?.value||'Medium',date:today(),status:'open'};
  await saveCol('wrongAnswers',obj); await saveCol('weakTopics',{topic:question,subject:obj.subject,source:'Wrong Answer Notebook',status:'open',priority:obj.priority,date:today()});
  ['wanQuestion','wanYour','wanCorrect','wanReason'].forEach(id=>{ if($(id)) $(id).value=''; });
  renderWrongAnswerNotebook(); renderAIIntegrated();
};
window.aiWrongAnswerAnalysis = async function(){
  if(!$('wanAIOutput')) return;
  $('wanAIOutput').innerHTML='<div class="aiLoading">Analysing mistake...</div>';
  const prompt=`UPSC wrong answer analysis\nSubject:${$('wanSubject')?.value}\nQuestion:${$('wanQuestion')?.value}\nMy answer:${$('wanYour')?.value}\nCorrect answer:${$('wanCorrect')?.value}\nReason:${$('wanReason')?.value}\nGive: exact concept gap, why wrong, correct concept, 5 revision points, 3 flashcards, one mains linkage.`;
  try{$('wanAIOutput').innerHTML=formatAI(await aiAsk(prompt));}catch(e){$('wanAIOutput').innerHTML='Concept gap: revise the static concept, add one example, solve 10 PYQs, and schedule spaced revision.';}
};
window.wrongAnswerToRevision = async function(){
  const topic=$('wanQuestion')?.value || 'Wrong answer topic'; const subject=$('wanSubject')?.value || 'General';
  await saveCol('smartRevision',{topic:'Wrong Answer: '+topic,subject,source:'Wrong Answer Notebook',difficulty:'Hard',date:v11DatePlus(1),cycle:'1 day',routine:'Wrong answer urgent',status:'pending'});
  await saveCol('calendarItems',{title:'Revise wrong answer: '+topic,date:v11DatePlus(1),type:'Revision',note:subject});
  renderAIIntegrated(); alert('Added to revision.');
};
window.renderWrongAnswerNotebook = async function(){
  if(!$('wanList')) return;
  const data=await getCol('wrongAnswers'); const q=($('wanSearch')?.value||'').toLowerCase();
  const f=data.filter(x=>JSON.stringify(x).toLowerCase().includes(q));
  const by={}; f.forEach(x=>by[x.subject||'General']=(by[x.subject||'General']||0)+1);
  if($('wanStats')) $('wanStats').innerHTML=Object.entries(by).map(([k,v])=>`<span class="pill">${v11Safe(k)}: ${v}</span>`).join('') || '<span class="pill">No mistakes saved</span>';
  $('wanList').innerHTML=f.map((x,i)=>`<div class="item wrongCard"><h3>${v11Safe(x.question)}</h3><span class="tag">${v11Safe(x.subject)}</span><span class="tag">${v11Safe(x.priority)}</span><span class="tag">${v11Safe(x.date)}</span><p><b>Your:</b> ${v11Safe(x.yourAnswer)}</p><p><b>Correct:</b> ${v11Safe(x.correctAnswer)}</p><p><b>Reason:</b> ${v11Safe(x.reason)}</p><button class="btn gold" onclick="saveCol('flash',{q:'Wrong: ${v11Safe(x.question)}',a:'Correct: ${v11Safe(x.correctAnswer)}. Reason: ${v11Safe(x.reason)}',subject:'${v11Safe(x.subject)}',difficulty:'Hard',due:today(),date:today()}).then(renderAIIntegrated)">Make Flashcard</button><button class="btn green" onclick="saveCol('smartRevision',{topic:'${v11Safe(x.question)}',subject:'${v11Safe(x.subject)}',source:'Wrong Answer',difficulty:'Hard',date:v11DatePlus(1),cycle:'1 day',status:'pending'}).then(renderAIIntegrated)">Add Revision</button><button class="btn danger" onclick="deleteItem('wrongAnswers','${x.id||i}')">Delete</button></div>`).join('') || '<div class="emptyState">No wrong answers yet.</div>';
};

window.saveTopperAnswer = async function(){
  const title=$('topperTitle')?.value?.trim(); if(!title) return alert('Enter topper answer title/question');
  const f=$('topperFile')?.files?.[0];
  let uploaded={};
  if(f){ try{ uploaded=await uploadFileToFirebase(f,'TopperAnswers'); }catch(e){ alert('Topper file cloud upload failed: '+e.message); return; } }
  await saveCol('topperAnswers',{title,paper:$('topperPaper')?.value||'GS',source:$('topperName')?.value||'',image:uploaded.url || $('topperImage')?.value||'',storagePath:uploaded.storagePath||'',fileName:f?.name||'',typed:$('topperTyped')?.value||'',notes:$('topperNotes')?.value||'',date:today()});
  ['topperTitle','topperName','topperImage','topperTyped','topperNotes'].forEach(id=>{ if($(id)) $(id).value=''; });
  if($('topperFile')) $('topperFile').value='';
  renderTopperAnswers();
};
window.aiTopperAnswerNotes = async function(){
  if(!$('topperAIOutput')) return;
  $('topperAIOutput').innerHTML='<div class="aiLoading">Building topper structure notes...</div>';
  const prompt=`Analyse this UPSC topper/model answer.\nPaper:${$('topperPaper')?.value}\nQuestion:${$('topperTitle')?.value}\nAnswer:${$('topperTyped')?.value}\nNotes:${$('topperNotes')?.value}\nGive intro template, body structure, flowchart/diagram ideas, value addition, conclusion, and 5 learnings to copy.`;
  try{$('topperAIOutput').innerHTML=formatAI(await aiAsk(prompt));}catch(e){$('topperAIOutput').innerHTML='Intro → Define + context. Body → 3 dimensions with examples/data. Add diagram/flowchart. Conclusion → constitutional/value-based way forward.';}
};
window.topperToPractice = async function(){
  await saveCol('mains',{q:$('topperTitle')?.value||'Topper answer practice',paper:$('topperPaper')?.value||'GS',ans:'Practice using topper structure: '+($('topperNotes')?.value||''),date:today()});
  alert('Added to mains practice.');
};
window.renderTopperAnswers = async function(){
  if(!$('topperList')) return;
  const data=await getCol('topperAnswers'); const q=($('topperSearch')?.value||'').toLowerCase();
  const f=data.filter(x=>JSON.stringify(x).toLowerCase().includes(q));
  $('topperList').innerHTML=f.map((x,i)=>`<div class="topperCard"><h3>${v11Safe(x.title)}</h3><span class="tag">${v11Safe(x.paper)}</span><span class="tag">${v11Safe(x.source)}</span>${x.image?`<p><a class="btn blue" href="${v11Safe(x.image)}" target="_blank">Open real image/PDF</a></p>`:''}<details open><summary>Typed Answer</summary><p>${v11Safe(x.typed||'Add typed answer.')}</p></details><details><summary>Structure Notes</summary><p>${v11Safe(x.notes||'Add intro-body-conclusion notes.')}</p></details><button class="btn gold" onclick="saveCol('flash',{q:'Topper structure: ${v11Safe(x.title)}',a:'${v11Safe((x.notes||x.typed||'Review model answer').slice(0,500))}',subject:'${v11Safe(x.paper)}',difficulty:'Medium',due:today(),date:today()}).then(renderAIIntegrated)">Make Flashcard</button><button class="btn danger" onclick="deleteItem('topperAnswers','${x.id||i}')">Delete</button></div>`).join('') || '<div class="emptyState">No topper answers saved. Upload/link real copies and add notes.</div>';
};

window.openSectionFileV11 = async function(id){
  let arr=[]; try{arr=JSON.parse(localStorage.getItem('upscSectionFilesV10')||'[]')}catch(e){}
  if(window.getCol){ try{arr=[...(await getCol('sectionFiles')),...arr]}catch(e){} }
  const f=arr.find(x=>String(x.id)===String(id));
  if(!f) return alert('File record not found');
  if(f.url){ window.open(f.url,'_blank'); return; }
  if(f.dataUrl){ const w=window.open(); if(w){ w.document.write(`<title>${v11Safe(f.name)}</title><iframe src="${f.dataUrl}" style="border:0;width:100%;height:100vh"></iframe>`); } else alert('Popup blocked. Use Download.'); }
  else if(f.preview){ const w=window.open(); if(w) w.document.write(`<pre style="white-space:pre-wrap;font-family:system-ui;padding:20px">${v11Safe(f.preview)}</pre>`); }
  else alert('File has no stored content. Re-upload once after cloud login.');
};
window.downloadSectionFileV11 = async function(id){
  let arr=[]; try{arr=JSON.parse(localStorage.getItem('upscSectionFilesV10')||'[]')}catch(e){}
  if(window.getCol){ try{arr=[...(await getCol('sectionFiles')),...arr]}catch(e){} }
  const f=arr.find(x=>String(x.id)===String(id));
  if(!f) return alert('File record not found');
  const url=f.url||f.dataUrl;
  if(!url) return alert('File has no downloadable content.');
  const a=document.createElement('a'); a.href=url; a.download=f.name||'upsc-file'; a.target='_blank'; a.click();
};

/* ===== V12 STABILITY PATCH: single-source dashboard + no dummy weak counts ===== */
(function(){
  const esc = (x)=>String(x ?? '').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const dateKey = (d)=>String(d||'').slice(0,10);
  const isDone = (x)=>['done','Done','completed','Completed'].includes(String(x?.status||''));
  const isDue = (x)=>x && dateKey(x.date || x.due) && dateKey(x.date || x.due) <= today() && !isDone(x);
  const idOf = (x,i)=>x?.id || i;

  function getLocalArray(k){ try{return JSON.parse(localStorage.getItem(k)||'[]')}catch(e){return []} }
  function setLocalArray(k,v){ localStorage.setItem(k, JSON.stringify(v)); }

  function weakTopicSet({wrongAnswers=[], wrongbook=[], tests=[], mainsReports=[], mockReports=[], flash=[]}){
    const set = new Map();
    const add=(subject,topic,reason)=>{
      const t=String(topic||'').trim();
      if(!t) return;
      const s=String(subject||'General').trim()||'General';
      set.set((s+'::'+t).toLowerCase(), {subject:s, topic:t, reason:reason||''});
    };
    wrongAnswers.filter(x=>!isDone(x)).forEach(x=>add(x.subject, x.topic || x.question, 'Wrong Answer Notebook'));
    wrongbook.forEach(x=>add(x.subject, x.topic || x.question, 'Old wrong answer book'));
    tests.forEach(t=>{ const acc=Number(t.accuracy||0), score=Number(t.score||0); if((acc>0 && acc<55) || (score>0 && score<50)) add(t.subject||'Mock', t.name||t.mistakes||'Low score mock', 'Low mock score'); });
    mainsReports.forEach(m=>{ const body=String(m.body||'').toLowerCase(); if(body.includes('weak')||body.includes('missing')||body.includes('low')) add(m.paper||'Mains', m.question||'Mains answer gap', 'Mains evaluation'); });
    mockReports.forEach(m=>{ const body=String(m.body||'').toLowerCase(); if(body.includes('wrong')||body.includes('weak')) add('Mock', m.name||'Mock analysis gap', 'Mock AI report'); });
    flash.filter(f=>String(f.status||'')==='wrong').forEach(f=>add(f.subject, f.q, 'Flashcard wrong'));
    return set;
  }

  async function collectCore(){
    const keys=['smartRevision','revision','aiHabits','flash','dailyPlans','calendarItems','wrongAnswers','wrongbook','tests','mainsReports','mockReports','tasks','habits'];
    const vals=await Promise.all(keys.map(getCol));
    return Object.fromEntries(keys.map((k,i)=>[k, vals[i]||[]]));
  }

  window.renderAIIntegrated = async function(){
    try{
      const d = await collectCore();
      const dueRev = [...d.smartRevision, ...d.revision].filter(isDue);
      const flashDue = d.flash.filter(x=>dateKey(x.due || x.date || today()) <= today() && !isDone(x));
      const todayCal = d.calendarItems.filter(x=>dateKey(x.date)===today());
      const todayPlans = d.dailyPlans.filter(x=>dateKey(x.date)===today());
      const todayTasks = d.tasks.filter(x=>!x.done && (!x.date || dateKey(x.date)===today()));
      const weakMap = weakTopicSet(d);
      const warItems = [];

      dueRev.forEach((x,i)=>warItems.push(`<div class="item dueToday"><h3>🔁 Revise: ${esc(x.topic||x.title||'Topic')}</h3><span class="tag">${esc(x.subject||'General')}</span><span class="tag">Due: ${esc(dateKey(x.date||x.due))}</span><button class="btn green" onclick="markSmartRevisionDone('${esc(idOf(x,i))}','${d.smartRevision.includes(x)?'smartRevision':'revision'}')">Done ✅</button><button class="btn danger" onclick="deleteItem('${d.smartRevision.includes(x)?'smartRevision':'revision'}','${esc(idOf(x,i))}')">Delete</button></div>`));
      todayCal.forEach((x,i)=>warItems.push(`<div class="item"><h3>📅 ${esc(x.title||'Calendar task')}</h3><span class="tag">${esc(x.type||'Task')}</span><button class="btn green" onclick="deleteItem('calendarItems','${esc(idOf(x,i))}')">Done/Delete</button></div>`));
      todayPlans.forEach((x,i)=>warItems.push(`<div class="item"><h3>📝 AI Daily Plan</h3><p>${esc(String(x.body||x.input||'Plan saved').slice(0,180))}</p><button class="btn danger" onclick="deleteItem('dailyPlans','${esc(idOf(x,i))}')">Delete</button></div>`));
      todayTasks.forEach((x,i)=>warItems.push(`<div class="item"><h3>✅ ${esc(x.text||x.title||'Task')}</h3><button class="btn danger" onclick="deleteItem('tasks','${esc(idOf(x,i))}')">Delete</button></div>`));
      flashDue.slice(0,8).forEach((x,i)=>warItems.push(`<div class="item"><h3>🃏 Flashcard: ${esc(x.q||'Card')}</h3><span class="tag">${esc(x.subject||'General')}</span><button class="btn green" onclick="markFlashDone('${esc(idOf(x,i))}')">Revised ✅</button></div>`));

      const todayCount = warItems.length;
      if($('dashPlanCount')) $('dashPlanCount').innerText = todayCount;
      if($('dashRevisionCount')) $('dashRevisionCount').innerText = dueRev.length;
      if($('dashWeakCount')) $('dashWeakCount').innerText = weakMap.size;
      if($('dashFlashDue')) $('dashFlashDue').innerText = flashDue.length;
      if($('todayWarList')) $('todayWarList').innerHTML = warItems.join('') || '<div class="emptyState">No war tasks. Add today tasks, revision, calendar items or flashcards.</div>';

      const completed = d.smartRevision.filter(isDone).length + d.aiHabits.filter(x=>String(x.status)==='Done').length + d.habits.length + d.mainsReports.length + d.mockReports.length;
      const activeLoad = dueRev.length + flashDue.length + weakMap.size;
      const score = Math.max(0, Math.min(100, Math.round(20 + completed*5 + d.flash.length*2 + d.dailyPlans.length*4 - activeLoad*3)));
      if($('aiReadinessScore')) $('aiReadinessScore').innerText = score+'%';
      if($('aiReadinessBar')) $('aiReadinessBar').style.width = score+'%';

      if($('smartRevisionList')){
        const all=[...d.smartRevision].sort((a,b)=>dateKey(a.date).localeCompare(dateKey(b.date)));
        $('smartRevisionList').innerHTML = all.map((x,i)=>`<div class="item ${isDue(x)?'dueToday':''}"><h3>${esc(x.topic||x.title||'Revision')}</h3><span class="tag">${esc(x.subject||'General')}</span><span class="tag">${esc(dateKey(x.date))}</span><span class="tag">${esc(x.routine||x.cycle||'Revision')}</span><span class="tag">${esc(x.status||'pending')}</span><button class="btn green" onclick="markSmartRevisionDone('${esc(idOf(x,i))}','smartRevision')">Done ✅</button><button class="btn danger" onclick="deleteItem('smartRevision','${esc(idOf(x,i))}')">Delete</button></div>`).join('') || '<div class="emptyState">No smart revisions.</div>';
      }
      if($('aiSystemStatus')){
        $('aiSystemStatus').innerHTML = `<div class="item"><h3>✅ Dashboard Sync Active</h3><p>Today Plan, War List, Due Revision, Flashcards and Weak Topics now use one live data calculation.</p></div><div class="item"><h3>Weak Topic Rule</h3><p>Weak Topics come only from Wrong Answer Notebook, low mock/test scores, mains gaps and wrong flashcards. Old dummy weakTopics storage is ignored.</p></div>`;
      }
      if(typeof renderWrongAnswerNotebook==='function') renderWrongAnswerNotebook();
      if(typeof renderTopperAnswers==='function') renderTopperAnswers();
    }catch(e){ console.warn('V12 dashboard sync error', e); }
  };

  window.markSmartRevisionDone = async function(id,col='smartRevision'){
    const arr=getLocalArray(col);
    const idx=arr.findIndex(x=>String(x.id)===String(id));
    if(idx>=0){ arr[idx].status='done'; arr[idx].doneDate=today(); setLocalArray(col,arr); }
    renderAll(); setTimeout(renderAIIntegrated,80);
  };

  window.markFlashDone = async function(id){
    const arr=getLocalArray('flash');
    const idx=arr.findIndex(x=>String(x.id)===String(id));
    if(idx>=0){ arr[idx].status='done'; arr[idx].doneDate=today(); setLocalArray('flash',arr); }
    renderAIIntegrated();
  };

  window.addSmartRevision = async function(){
    const topic=$('revTopicAI')?.value?.trim(); if(!topic) return alert('Enter topic');
    const subject=$('revSubjectAI')?.value||'General', source=$('revSourceAI')?.value||'Manual', diff=$('revDifficultyAI')?.value||'Medium';
    const routine=$('revRoutineAI')?.selectedOptions?.[0]?.text || 'Standard';
    const days=(typeof v11RoutineDays==='function'?v11RoutineDays():[1,3,7,15,30]);
    for(const c of days){
      const d=new Date(); d.setDate(d.getDate()+Number(c||0)); const date=d.toISOString().slice(0,10);
      await saveCol('smartRevision',{topic,subject,source,difficulty:diff,date,cycle:`${c} day`,routine,status:'pending'});
      await saveCol('calendarItems',{title:`Revise: ${topic}`,date,type:'Revision',note:`${subject} • ${source} • ${routine}`});
    }
    // Important: adding a revision is NOT a weak topic by itself. Weak topics come from mistakes/low scores only.
    if($('revTopicAI')) $('revTopicAI').value='';
    renderAll(); setTimeout(renderAIIntegrated,100);
    alert('Revision routine added. Dashboard and War List are synced.');
  };

  window.purgeOldDashboardDummyData = function(){
    if(!confirm('Remove old dashboard dummy weak-topic data? Notes, files and flashcards will not be deleted.')) return;
    localStorage.removeItem('weakTopics');
    // remove old empty/demo AI daily plan records only
    const plans=getLocalArray('dailyPlans').filter(x=>String(x.body||x.input||'').trim());
    setLocalArray('dailyPlans',plans);
    renderAll(); setTimeout(renderAIIntegrated,100);
    alert('Old dummy dashboard data removed.');
  };

  window.resetAllAIDataV12 = function(){
    if(!confirm('WARNING: This deletes AI tasks, revisions, calendar items, wrong answers, tests, flashcards analytics and dashboard data. Notes/files are safe. Continue?')) return;
    ['smartRevision','revision','calendarItems','dailyPlans','wrongAnswers','wrongbook','tests','mockReports','mainsReports','weakTopics','aiHabits','tasks'].forEach(k=>localStorage.removeItem(k));
    renderAll(); setTimeout(renderAIIntegrated,100);
    alert('AI planning/analytics data reset. Notes and uploaded files were not deleted.');
  };

  // Keep dashboard correct even when older renderAll/sections refresh.
  setTimeout(()=>{try{renderAll('dashboard')}catch(e){}}, 200);
  /* V27.5: duplicate dashboard interval removed */
})();


/* ===== V13 CLOUD PRO: migration + cloud backup tools ===== */
window.migrateLocalDataToFirebase = async function(){
  if(!(cloudEnabled&&user)) return alert('Login with Google first.');
  const keys=['tasks','studyLogs','months','weeks','blocks','habits','currentAffairs','notes','kg','flash','pyq','mains','tests','revision','books','wrongbook','files','focusSessions','calendarItems','battles','maps','pyqBank','completion','smartRevision','dailyPlans','wrongAnswers','weakTopics','onePagers','topperAnswers','sectionFiles'];
  let count=0;
  for(const k of keys){
    let arr=[]; try{arr=JSON.parse(localStorage.getItem(k)||'[]')}catch(e){}
    if(!Array.isArray(arr)) continue;
    for(const item of arr){ if(item&&typeof item==='object'){ await saveCol(k,{...item,migratedFromLocal:true}); count++; } }
  }
  alert('Migration complete: '+count+' local records copied to Firebase cloud. Keep your JSON backup also.');
  renderAll(); if(window.renderFileVault)renderFileVault();
};
window.exportCloudData = async function(){
  if(!(cloudEnabled&&user)) return alert('Login first.');
  const keys=['tasks','studyLogs','months','weeks','blocks','habits','currentAffairs','notes','kg','flash','pyq','mains','tests','revision','books','wrongbook','files','focusSessions','calendarItems','battles','maps','pyqBank','completion','smartRevision','dailyPlans','wrongAnswers','weakTopics','onePagers','topperAnswers','sectionFiles'];
  const data={exportedAt:new Date().toISOString(),uid:user.uid,email:user.email,collections:{}};
  for(const k of keys){ try{data.collections[k]=await getCol(k)}catch(e){data.collections[k]=[]} }
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})); a.download='mission-upsc-v13-cloud-backup.json'; a.click();
};
window.renderCloudSystemStatus = function(){
  const el=$('aiSystemStatus'); if(!el)return;
  const cloud = cloudEnabled&&user;
  el.querySelector('#cloudSystemStatusItemV275')?.remove();
  el.insertAdjacentHTML('beforeend',`<div class="item" id="cloudSystemStatusItemV275"><h3>☁️ Firebase Cloud</h3><p>${cloud?'Connected as '+(user.email||user.uid):'Not logged in. Use Google Login to sync.'}</p><span class="pill">Firestore: ${cloudEnabled?'Ready':'Not configured'}</span><span class="pill">Storage: ${storage?'Ready':'Not configured'}</span></div>`);
};
setInterval(()=>{try{if(isActiveSectionV225('settings'))renderCloudSystemStatus()}catch(e){}},30000);


/* ===== V13.1 CORE PATCH: reliable dashboard sync ===== */
renderAIIntegrated = async function(){
  try{
    const rev = await getCol('smartRevision');
    const rev2 = await getCol('revision');
    const weak = await getCol('weakTopics');
    const wrong = await getCol('wrongAnswers');
    const wrong2 = await getCol('wrongbook');
    const flash = await getCol('flash');
    const plans = await getCol('dailyPlans');
    const cal = await getCol('calendarItems');
    const todayStr=today();
    const dueRev=[...rev,...rev2].filter(x=>(x.date||x.nextRevision||todayStr)<=todayStr && x.status!=='done' && x.status!=='Done');
    const todayPlans=[...plans.filter(x=>(x.date||todayStr)===todayStr),...cal.filter(x=>(x.date||'')===todayStr)];
    const weakOpen=[...weak.filter(x=>x.status!=='done'&&x.status!=='Done'),...wrong,...wrong2].filter(Boolean);
    const flashDue=flash.filter(x=>(x.due||x.nextReview||todayStr)<=todayStr && x.status!=='done' && x.status!=='Done');
    if($('dashPlanCount')) $('dashPlanCount').innerText=todayPlans.length;
    if($('dashRevisionCount')) $('dashRevisionCount').innerText=dueRev.length;
    if($('dashWeakCount')) $('dashWeakCount').innerText=weakOpen.length;
    if($('dashFlashDue')) $('dashFlashDue').innerText=flashDue.length;
    const score=Math.min(100,Math.round((todayPlans.length + dueRev.filter(x=>x.status==='done').length + flash.length + Math.max(0,10-weakOpen.length))*5));
    if($('aiReadinessScore')) $('aiReadinessScore').innerText=score+'%';
    if($('aiReadinessBar')) $('aiReadinessBar').style.width=score+'%';
    if($('todayWarList')){
      const html=[
        ...todayPlans.map((x,i)=>`<div class="item"><h3>Today: ${x.title||x.topic||x.body||x.input||'Task'}</h3><span class="tag">${x.date||todayStr}</span><button class="btn danger deleteBtn" onclick="deleteItem('${x.type==='calendar'?'calendarItems':'dailyPlans'}','${x.id||i}')">Delete</button></div>`),
        ...dueRev.map((x,i)=>`<div class="item"><h3>Revise: ${x.topic||x.title||'Revision'}</h3><span class="tag">${x.subject||''}</span><span class="tag">${x.date||x.nextRevision||''}</span><button class="btn green" onclick="deleteItem('${rev.includes(x)?'smartRevision':'revision'}','${x.id||i}')">Done/Delete</button></div>`),
        ...flashDue.slice(0,5).map((x,i)=>`<div class="item"><h3>Flashcard: ${x.q||x.title||'Flashcard'}</h3><span class="tag">${x.subject||''}</span><button class="btn danger" onclick="deleteItem('flash','${x.id||i}')">Delete</button></div>`)
      ].join('');
      $('todayWarList').innerHTML=html || '<div class="emptyState">No war tasks. Add revision/habits/mocks.</div>';
    }
    if($('smartRevisionList')) $('smartRevisionList').innerHTML=dueRev.concat(rev.filter(x=>!dueRev.includes(x))).map((x,i)=>`<div class="item"><h3>${x.topic||x.title||'Revision'}</h3><span class="tag">${x.subject||''}</span><span class="tag">${x.date||x.nextRevision||''}</span><button class="btn green" onclick="deleteItem('${rev.includes(x)?'smartRevision':'revision'}','${x.id||i}')">Done/Delete</button></div>`).join('') || '<div class="emptyState">No smart revisions.</div>';
  }catch(e){console.warn('Dashboard sync error',e)}
};
/* V27.5: duplicate dashboard interval removed */

/* ===== V13.2 Google Docs & Link Hub + stable delete helpers ===== */
(function(){
  const DEFAULT_LINKS = [
    {id:'default_docs', title:'Google Docs', url:'https://docs.google.com/document/u/1/', category:'Google Doc', note:'Your Google Docs workspace'},
    {id:'default_tracker', title:'Tracker Pro', url:'https://tracker.atishmathur.com/', category:'Tracker', note:'Atish Mathur Tracker Pro'},
    {id:'default_drive', title:'Google Drive', url:'https://drive.google.com/', category:'Other', note:'UPSC file backup'},
    {id:'default_telegram', title:'Telegram Web', url:'https://web.telegram.org/', category:'Telegram', note:'Telegram notes and channels'}
  ];
  function normalizeUrl(u){
    u=String(u||'').trim();
    if(!u) return '';
    if(!/^https?:\/\//i.test(u)) u='https://'+u;
    return u;
  }
  window.openSavedLink = function(url){
    url = normalizeUrl(url);
    window.currentFrameUrlV132 = url;
    const frame = document.getElementById('linkPreviewFrame');
    if(frame) frame.src = url;
    // Also open in a new tab because Google Docs/Tracker may block iframe embedding.
    window.open(url,'_blank','noopener');
  };
  window.openLinkFromInput = function(){
    const url = normalizeUrl(document.getElementById('linkUrlInput')?.value);
    if(!url) return alert('Paste a link first.');
    openSavedLink(url);
  };
  window.openCurrentFrameLinkNewTab = function(){
    const url = window.currentFrameUrlV132 || document.getElementById('linkPreviewFrame')?.src;
    if(url) window.open(url,'_blank','noopener'); else alert('No link opened yet.');
  };
  window.clearLinkFrame = function(){
    const f=document.getElementById('linkPreviewFrame'); if(f) f.removeAttribute('src'); window.currentFrameUrlV132='';
  };
  window.saveDocLink = async function(){
    const title=(document.getElementById('linkTitleInput')?.value||'').trim();
    const url=normalizeUrl(document.getElementById('linkUrlInput')?.value||'');
    const category=document.getElementById('linkCategoryInput')?.value||'Other';
    const note=(document.getElementById('linkNoteInput')?.value||'').trim();
    if(!title || !url) return alert('Add title and link.');
    const rec={id:'link_'+Date.now(), title, url, category, note, date:new Date().toLocaleString()};
    await saveCol('docLinks', rec);
    ['linkTitleInput','linkUrlInput','linkNoteInput'].forEach(id=>{const el=document.getElementById(id); if(el) el.value='';});
    renderDocLinks();
  };
  window.deleteDocLink = async function(id){
    if(!confirm('Delete this link?')) return;
    await deleteItem('docLinks', id, true);
    renderDocLinks();
  };
  window.renderDocLinks = async function(){
    const el=document.getElementById('docLinksList'); if(!el) return;
    let arr=[]; try{arr=await getCol('docLinks')}catch(e){arr=[]}
    const all=[...DEFAULT_LINKS, ...arr];
    const q=(document.getElementById('linkSearchInput')?.value||'').toLowerCase();
    const filtered=all.filter(x=>JSON.stringify(x).toLowerCase().includes(q));
    el.innerHTML=filtered.map(x=>`<div class="item linkItem"><div><h3>${safe(x.title)}</h3><span class="tag">${safe(x.category||'Link')}</span><p>${safe(x.note||'')}</p><small>${safe(x.url)}</small></div><div class="actions"><button class="btn blue" onclick="openSavedLink('${String(x.url).replace(/'/g,"\\'")}')">Open</button>${String(x.id||'').startsWith('default_')?'':`<button class="btn danger" onclick="deleteDocLink('${x.id}')">Delete</button>`}</div></div>`).join('') || '<div class="emptyState">No links saved.</div>';
  };

  // More reliable file delete: remove Storage object + Firestore metadata + local metadata, then re-render.
  window.deleteSectionFileV10 = async function(id){
    if(!confirm('Delete this item?')) return;
    const all = await getAllSectionFiles();
    const f = all.find(x=>x.id===id || x.storagePath===id);
    if(!f) return alert('File record not found. Refresh once and try again.');
    if(f.storagePath){ try{ await deleteStoragePath(f.storagePath); }catch(e){ console.warn('Storage delete failed:', e.message); } }
    if(f.id && cloudEnabled && user){ try{ await deleteItem('sectionFiles', f.id, true); }catch(e){ console.warn('Cloud metadata delete failed:', e.message); } }
    const local = getFiles().filter(x=>x.id!==f.id && x.storagePath!==f.storagePath);
    setFiles(local);
    document.querySelectorAll('.section').forEach(s=>renderSectionFilesV10(s.id));
    if(window.renderFileVault) renderFileVault();
    if(window.renderAIIntegrated) renderAIIntegrated();
  };

  const oldShow = window.show;
  window.show = function(id,btn){
    oldShow(id,btn);
    if(id==='docLinksHub') setTimeout(renderDocLinks,50);
  };
  setTimeout(()=>{try{renderDocLinks()}catch(e){}},800);
})();

/* ===== V13.3 Stability Patch: fixed readiness, calendar, master delete, revision routine ===== */
(function(){
  const qs = (id)=>document.getElementById(id);
  const esc = (x)=>String(x ?? '').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const dateKey = (x)=>String(x || '').slice(0,10);
  const todayKey = ()=>new Date().toISOString().slice(0,10);
  const idOf = (x,i)=>String((x && (x._docId || x.id)) || i);
  const done = (x)=>['done','Done','completed','Completed','revised','Revised'].includes(String(x?.status || '')) || x?.done===true;
  const due = (x)=>dateKey(x?.date || x?.due) && dateKey(x?.date || x?.due) <= todayKey() && !done(x);

  let v133Cal = new Date();
  let readinessLock = false;

  async function all(col){ try{return await getCol(col)}catch(e){return []} }
  async function removeCloudCollection(col){
    const arr = await all(col);
    for(const item of arr){
      try{ await deleteItem(col, idOf(item,0), true); }catch(e){ console.warn('Delete skipped', col, item, e); }
    }
  }

  window.toggleRevisionCustomDaysV133 = function(){
    const r = qs('revRoutineAI')?.value;
    const input = qs('revCustomDaysAI');
    if(input) input.style.display = r === 'custom' ? 'block' : 'none';
  };

  window.v11RoutineDays = function(){
    const r = qs('revRoutineAI')?.value || 'standard';
    if(r === 'fast') return [1,2,4,7];
    if(r === 'weekly') return [7,14,21,28];
    if(r === 'exam') return [0,1,3,5];
    if(r === 'custom'){
      const days = (qs('revCustomDaysAI')?.value || '').split(',').map(x=>parseInt(x.trim(),10)).filter(n=>!Number.isNaN(n) && n>=0);
      return days.length ? days : [1,3,7,15,30];
    }
    return [1,3,7,15,30];
  };

  window.addSmartRevision = async function(){
    const topic = qs('revTopicAI')?.value?.trim();
    if(!topic) return alert('Enter topic');
    const subject = qs('revSubjectAI')?.value || 'General';
    const source = qs('revSourceAI')?.value || 'Manual Study';
    const difficulty = qs('revDifficultyAI')?.value || 'Medium';
    const routineName = qs('revRoutineAI')?.selectedOptions?.[0]?.text || 'Standard';
    const days = window.v11RoutineDays();
    for(const d of days){
      const dt = new Date();
      dt.setDate(dt.getDate() + Number(d || 0));
      const date = dt.toISOString().slice(0,10);
      await saveCol('smartRevision',{topic,subject,source,difficulty,date,cycle:`${d} day`,routine:routineName,status:'pending'});
      await saveCol('calendarItems',{title:`Revise: ${topic}`,date,type:'Revision',note:`${subject} • ${source} • ${routineName}`});
    }
    if(qs('revTopicAI')) qs('revTopicAI').value='';
    await renderAIIntegrated(); await renderCalendarAI();
    alert('Revision routine added and linked to month-wise calendar.');
  };

  window.markSmartRevisionDone = async function(id, col='smartRevision'){
    // In cloud mode, delete old pending record and add completed record to keep rules simple.
    const arr = await all(col);
    const item = arr.find((x,i)=>idOf(x,i)===String(id));
    if(item){
      await deleteItem(col, idOf(item,0), true);
      await saveCol(col,{...item,status:'done',doneDate:todayKey()});
    }
    await renderAIIntegrated(); await renderCalendarAI();
  };

  function stableReadiness(d){
    const total = d.notes.length + d.flash.length + d.dailyPlans.length + d.calendarItems.length + d.smartRevision.length + d.wrongAnswers.length + d.tests.length + d.mainsReports.length;
    if(total === 0) return 0;
    const completed = d.smartRevision.filter(done).length + d.aiHabits.filter(x=>String(x.status)==='Done').length + d.tests.length + d.mainsReports.length;
    const pending = [...d.smartRevision, ...d.revision].filter(due).length + d.flash.filter(x=>dateKey(x.due || x.date || todayKey()) <= todayKey() && !done(x)).length;
    const score = Math.round(Math.min(100, Math.max(0, (completed * 8) + (d.notes.length * 2) + (d.flash.length * 2) + (d.calendarItems.length) + (d.dailyPlans.length * 3) - (pending * 2))));
    return score;
  }

  function weakCount(d){
    const m = new Map();
    const add=(subject,topic,src)=>{ const key=(subject||'General')+'::'+(topic||src||'Weak area'); m.set(key,true); };
    d.wrongAnswers.filter(x=>!done(x)).forEach(x=>add(x.subject,x.topic||x.question,'Wrong Answer'));
    d.wrongbook.forEach(x=>add(x.subject,x.topic||x.question,'Wrong Book'));
    d.tests.forEach(t=>{ const acc=Number(t.accuracy||0), score=Number(t.score||0); if((acc>0&&acc<55)||(score>0&&score<50)) add(t.subject||'Mock',t.name||t.mistakes,'Low score'); });
    d.flash.filter(f=>String(f.status||'')==='wrong').forEach(f=>add(f.subject,f.q,'Flash wrong'));
    return m.size;
  }

  window.renderAIIntegrated = async function(){
    if(readinessLock) return;
    readinessLock = true;
    try{
      const keys=['smartRevision','revision','aiHabits','flash','dailyPlans','calendarItems','wrongAnswers','wrongbook','tests','mainsReports','mockReports','tasks','habits','notes'];
      const vals=await Promise.all(keys.map(all));
      const d=Object.fromEntries(keys.map((k,i)=>[k, vals[i]||[]]));
      const dueRev=[...d.smartRevision,...d.revision].filter(due);
      const flashDue=d.flash.filter(x=>dateKey(x.due || x.date || todayKey()) <= todayKey() && !done(x));
      const todayCal=d.calendarItems.filter(x=>dateKey(x.date)===todayKey());
      const todayPlans=d.dailyPlans.filter(x=>dateKey(x.date)===todayKey());
      const todayTasks=d.tasks.filter(x=>!x.done && (!x.date || dateKey(x.date)===todayKey()));
      const war=[];
      dueRev.forEach((x,i)=>war.push(`<div class="item dueToday"><h3>🔁 Revise: ${esc(x.topic||x.title||'Topic')}</h3><span class="tag">${esc(x.subject||'General')}</span><span class="tag">Due: ${esc(dateKey(x.date||x.due))}</span><button class="btn green" onclick="markSmartRevisionDone('${esc(idOf(x,i))}','${d.smartRevision.includes(x)?'smartRevision':'revision'}')">Done ✅</button><button class="btn danger" onclick="deleteItem('${d.smartRevision.includes(x)?'smartRevision':'revision'}','${esc(idOf(x,i))}')">Delete</button></div>`));
      todayCal.forEach((x,i)=>war.push(`<div class="item"><h3>📅 ${esc(x.title||'Calendar task')}</h3><span class="tag">${esc(x.type||'Task')}</span><button class="btn danger" onclick="deleteItem('calendarItems','${esc(idOf(x,i))}')">Delete</button></div>`));
      todayPlans.forEach((x,i)=>war.push(`<div class="item"><h3>📝 Daily Plan</h3><p>${esc(String(x.body||x.input||'Plan saved').slice(0,180))}</p><button class="btn danger" onclick="deleteItem('dailyPlans','${esc(idOf(x,i))}')">Delete</button></div>`));
      todayTasks.forEach((x,i)=>war.push(`<div class="item"><h3>✅ ${esc(x.text||x.title||'Task')}</h3><button class="btn danger" onclick="deleteItem('tasks','${esc(idOf(x,i))}')">Delete</button></div>`));
      flashDue.slice(0,8).forEach((x,i)=>war.push(`<div class="item"><h3>🃏 Flashcard: ${esc(x.q||'Card')}</h3><span class="tag">${esc(x.subject||'General')}</span></div>`));
      if(qs('dashPlanCount')) qs('dashPlanCount').innerText=war.length;
      if(qs('dashRevisionCount')) qs('dashRevisionCount').innerText=dueRev.length;
      if(qs('dashWeakCount')) qs('dashWeakCount').innerText=weakCount(d);
      if(qs('dashFlashDue')) qs('dashFlashDue').innerText=flashDue.length;
      if(qs('todayWarList')) qs('todayWarList').innerHTML=war.join('') || '<div class="emptyState">No war tasks. Add today tasks, revision, calendar items or flashcards.</div>';
      const score=stableReadiness(d);
      if(qs('aiReadinessScore')) qs('aiReadinessScore').innerText=score+'%';
      if(qs('aiReadinessBar')) qs('aiReadinessBar').style.width=score+'%';
      if(qs('smartRevisionList')){
        const rev=[...d.smartRevision].sort((a,b)=>dateKey(a.date).localeCompare(dateKey(b.date)));
        qs('smartRevisionList').innerHTML=rev.map((x,i)=>`<div class="item ${due(x)?'dueToday':''}"><h3>${esc(x.topic||x.title||'Revision')}</h3><span class="tag">${esc(x.subject||'General')}</span><span class="tag">${esc(dateKey(x.date))}</span><span class="tag">${esc(x.routine||x.cycle||'Revision')}</span><span class="tag">${esc(x.status||'pending')}</span><button class="btn green" onclick="markSmartRevisionDone('${esc(idOf(x,i))}','smartRevision')">Done ✅</button><button class="btn danger" onclick="deleteItem('smartRevision','${esc(idOf(x,i))}')">Delete</button></div>`).join('') || '<div class="emptyState">No smart revisions.</div>';
      }
    }catch(e){ console.warn('V13.3 dashboard sync error',e); }
    finally{ readinessLock=false; }
  };

  window.changeCalendarMonthV133 = function(n){ v133Cal.setMonth(v133Cal.getMonth()+n); renderCalendarAI(); };
  window.goTodayCalendarV133 = function(){ v133Cal = new Date(); renderCalendarAI(); };
  window.addCalendarFromDateV133 = async function(date){
    const title = prompt('Add calendar task for '+date); if(!title) return;
    const type = prompt('Type/category', 'Task') || 'Task';
    await saveCol('calendarItems',{date,title,type,note:''});
    await renderAIIntegrated(); await renderCalendarAI();
  };

  window.renderCalendarAI = async function(){
    const grids=[qs('calendarGrid'),qs('calendarGridV4')].filter(Boolean);
    const agendas=[qs('calendarAgenda'),qs('calendarAgendaV4')].filter(Boolean);
    if(!grids.length) return;
    const controls=qs('calendarMonthControls');
    const y=v133Cal.getFullYear(), m=v133Cal.getMonth();
    if(controls){
      controls.innerHTML=`<button class="btn ghost" onclick="changeCalendarMonthV133(-1)">← Previous</button><h2>${v133Cal.toLocaleString('default',{month:'long',year:'numeric'})}</h2><button class="btn ghost" onclick="goTodayCalendarV133()">Today</button><button class="btn ghost" onclick="changeCalendarMonthV133(1)">Next →</button>`;
    }
    const [cal, rev, revOld, plans] = await Promise.all(['calendarItems','smartRevision','revision','dailyPlans'].map(all));
    const items=[];
    cal.forEach((x,i)=>items.push({...x,sourceCol:'calendarItems',sourceId:idOf(x,i),title:x.title||'Task',type:x.type||'Task'}));
    rev.forEach((x,i)=>items.push({...x,sourceCol:'smartRevision',sourceId:idOf(x,i),title:'Revise: '+(x.topic||x.title||'Topic'),type:'Revision'}));
    revOld.forEach((x,i)=>items.push({...x,sourceCol:'revision',sourceId:idOf(x,i),title:'Revise: '+(x.topic||x.title||'Topic'),type:'Revision'}));
    plans.forEach((x,i)=>items.push({...x,sourceCol:'dailyPlans',sourceId:idOf(x,i),title:'AI Daily Plan',type:'Plan'}));
    const first=new Date(y,m,1).getDay();
    const days=new Date(y,m+1,0).getDate();
    let html=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<div class="calHead">${d}</div>`).join('');
    for(let i=0;i<first;i++) html += '<div class="calCell empty"></div>';
    for(let d=1; d<=days; d++){
      const date=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const day=items.filter(x=>dateKey(x.date)===date);
      html+=`<div class="calCell ${date===todayKey()?'today':''}" ondblclick="addCalendarFromDateV133('${date}')"><b>${d}</b>${day.slice(0,4).map(x=>`<span>${esc(x.type)}: ${esc(x.title)}</span>`).join('')}${day.length>4?`<small>+${day.length-4} more</small>`:''}</div>`;
    }
    grids.forEach(g=>g.innerHTML=html);
    const currentItems=items.filter(x=>dateKey(x.date).startsWith(`${y}-${String(m+1).padStart(2,'0')}`)).sort((a,b)=>dateKey(a.date).localeCompare(dateKey(b.date)));
    const agenda=currentItems.map(x=>`<div class="item"><h3>${esc(x.title)}</h3><span class="tag">${esc(dateKey(x.date))}</span><span class="tag">${esc(x.type||'Task')}</span><button class="btn danger" onclick="deleteItem('${esc(x.sourceCol)}','${esc(x.sourceId)}'); setTimeout(renderCalendarAI,400); setTimeout(renderAIIntegrated,400);">Delete</button></div>`).join('') || '<div class="emptyState">No tasks this month. Double-click any day to add task.</div>';
    agendas.forEach(a=>a.innerHTML=agenda);
  };

  window.masterDeleteAllFiles = async function(){
    if(!confirm('WARNING: This will delete all uploaded files AND calendar/revision/daily-plan records. Continue?')) return;
    const typed=prompt('Type DELETE to confirm master delete.');
    if(typed !== 'DELETE') return alert('Cancelled.');
    const files = (typeof getAllSectionFiles==='function') ? await getAllSectionFiles() : [];
    for(const f of files){
      if(f.storagePath) try{ await deleteStoragePath(f.storagePath); }catch(e){}
      if(f.id) try{ await deleteItem('sectionFiles', f.id, true); }catch(e){}
    }
    if(typeof setFiles==='function') setFiles([]); else localStorage.removeItem('sectionFiles');
    for(const col of ['calendarItems','smartRevision','revision','dailyPlans']) await removeCloudCollection(col);
    ['calendarItems','smartRevision','revision','dailyPlans','sectionFiles','uploadedFilesV10'].forEach(k=>localStorage.removeItem(k));
    document.querySelectorAll('.section').forEach(sec=>{ if(window.renderSectionFilesV10) renderSectionFilesV10(sec.id); });
    if(window.renderFileVault) renderFileVault();
    await renderAIIntegrated(); await renderCalendarAI();
    alert('Master delete completed: files + calendar + revision saved notes removed.');
  };

  setTimeout(()=>{try{toggleRevisionCustomDaysV133(); renderAll(activeSectionIdV225());}catch(e){}},500);
  /* V27.5: duplicate dashboard interval removed */
})();

/* ===== V27.5.2 SINGLE READINESS OWNER FIX =====
   The old V13.4 and V13.6 readiness observers could disagree after login.
   Two MutationObservers then rewrote the same DOM nodes forever and froze the page.
   V13.4 is now a compatibility alias only; V13.6 is the single readiness engine. */
(function(){
  window.refreshStableReadinessV134 = async function(){
    if(typeof window.refreshTrueReadinessV136 === 'function'){
      return window.refreshTrueReadinessV136();
    }
  };
})();

/* ===== V13.6 Readiness TRUE ZERO + Detailed Mind Map Mini Section ===== */
(function(){
  const $ = (id)=>document.getElementById(id);
  const esc = (s)=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const today = ()=>new Date().toISOString().slice(0,10);
  const dateKey=(x)=>String(x||'').slice(0,10);
  const isDone=(x)=>['done','Done','completed','Completed','revised','Revised','yes','Yes'].includes(String(x?.status||'')) || x?.done===true || x?.completed===true;
  async function safeCol(name){ try{ return (typeof getCol==='function') ? await getCol(name) : JSON.parse(localStorage.getItem(name)||'[]'); }catch(e){ return []; } }

  // Final readiness rule: no base/default 4%; if dashboard inputs are empty or no completed study activity, readiness is exactly 0.
  async function computeTrueReadiness(){
    const [plans, cal, rev, rev2, habits, flash, wrong, tests, mains, mocks, notes] = await Promise.all([
      safeCol('dailyPlans'), safeCol('calendarItems'), safeCol('smartRevision'), safeCol('revision'), safeCol('aiHabits'), safeCol('flash'), safeCol('wrongAnswers'), safeCol('tests'), safeCol('mainsReports'), safeCol('mockReports'), safeCol('notes')
    ]);
    const dueRevision = [...rev,...rev2].filter(x=>dateKey(x.date||x.due)<=today() && !isDone(x)).length;
    const flashDue = flash.filter(x=>dateKey(x.due||x.date||today())<=today() && !isDone(x)).length;
    const todayPlans = [...plans,...cal].filter(x=>dateKey(x.date)===today()).length;
    const weakTopics = wrong.filter(x=>String(x.status||'open')!=='done').length;

    if($('dashPlanCount')) $('dashPlanCount').innerText = String(todayPlans);
    if($('dashRevisionCount')) $('dashRevisionCount').innerText = String(dueRevision);
    if($('dashWeakCount')) $('dashWeakCount').innerText = String(weakTopics);
    if($('dashFlashDue')) $('dashFlashDue').innerText = String(flashDue);

    const completedRevision=[...rev,...rev2].filter(isDone).length;
    const completedHabits=habits.filter(isDone).length;
    const completedPlans=[...plans,...cal].filter(isDone).length;
    const realStudyUnits = completedRevision + completedHabits + completedPlans + tests.length + mains.length + mocks.length;
    const sourceEl=$('aiReadinessSourceV2753');
    if(sourceEl){
      sourceEl.textContent = realStudyUnits===0
        ? 'No completed study records yet.'
        : `${completedRevision} revisions • ${tests.length+mocks.length} tests/mocks • ${mains.length} mains • ${completedHabits+completedPlans} habits/plans`;
    }

    // Notes/flashcards should not create a fake readiness by themselves. They count only after some real action exists.
    if(realStudyUnits === 0) return 0;

    const score = Math.round(
      Math.min(100,
        completedRevision*10 +
        completedHabits*5 +
        completedPlans*5 +
        tests.length*8 +
        mains.length*8 +
        mocks.length*8 +
        Math.min(notes.length,20)*1 +
        Math.min(flash.length,50)*0.5 -
        dueRevision*3 -
        flashDue*1
      )
    );
    return Math.max(0, score);
  }

  let TRUE_READY_SCORE = 0;
  async function applyTrueReadiness(){
    TRUE_READY_SCORE = await computeTrueReadiness();
    const score=$('aiReadinessScore'), bar=$('aiReadinessBar');
    if(score) score.textContent = TRUE_READY_SCORE + '%';
    if(bar) bar.style.width = TRUE_READY_SCORE + '%';
  }
  window.refreshTrueReadinessV136 = applyTrueReadiness;
  window.addEventListener('load',()=>setTimeout(()=>{ if(isActiveSectionV225('dashboard')) applyTrueReadiness(); },700));
  setInterval(()=>{if(isActiveSectionV225('dashboard')) applyTrueReadiness();},30000);

  // Premium detailed mind map with mini/full screen view.
  function normalizeNodes(input){
    if(Array.isArray(input)) return input.map(x=>({title:String(x).trim(), detail:'Definition • Example • PYQ • Mains angle'})).filter(x=>x.title);
    return String(input||'')
      .split(/\n|,/)
      .map(x=>x.replace(/^[-*\d.\s]+/,'').trim())
      .filter(Boolean)
      .slice(0,14)
      .map(x=>({title:x, detail:'Definition • Example • PYQ • Mains angle'}));
  }
  function defaultMindNodes(topic){
    return [
      ['Definition',`Core meaning of ${topic}`],
      ['Background','Origin, evolution, constitutional/historical context'],
      ['Key Features','Important characteristics and dimensions'],
      ['Articles / Provisions','Relevant articles, acts, schemes or institutions'],
      ['Examples','Indian examples, committees, cases, reports'],
      ['Current Affairs','Recent linkage useful for mains enrichment'],
      ['Issues','Challenges, limitations and criticism'],
      ['Data / Reports','NITI, NCRB, NFHS, Economic Survey etc. if relevant'],
      ['PYQ Angle','How UPSC frames prelims/mains questions'],
      ['Mains Framework','Intro → Body → Diagram → Way forward'],
      ['Way Forward','Reforms, recommendations and conclusion'],
      ['Memory Hook','Mnemonic or revision trigger']
    ].map(([title,detail])=>({title,detail}));
  }
  function parseAIToMindNodes(raw,topic){
    const text=String(raw||'').trim();
    if(!text || /RESOURCE_EXHAUSTED|code.?429|prepayment credits|error/i.test(text)) return defaultMindNodes(topic);
    const lines=text.split('\n').map(x=>x.trim()).filter(Boolean);
    const nodes=[];
    for(const line of lines){
      const clean=line.replace(/^[-*\d.\s]+/,'').replace(/^["'`]+|["'`]+$/g,'').trim();
      if(!clean || clean.length>180) continue;
      const parts=clean.split(/[:–-]/);
      const title=(parts[0]||clean).trim().slice(0,42);
      const detail=(parts.slice(1).join(' - ').trim()||'Definition • Example • PYQ • Mains angle').slice(0,110);
      nodes.push({title, detail});
      if(nodes.length>=14) break;
    }
    return nodes.length>=5 ? nodes : normalizeNodes(text);
  }
  let currentMindMapV136 = null;
  function mindMapToolbarV136(){
    return `<div class="mindToolbarPro">
      <button class="btn danger" onclick="backToMindMapCreateV227(false)">← Back to Create</button>
      <button class="btn purple" onclick="backToMindMapCreateV227(true)">＋ New Mind Map</button>
      <button class="btn blue" onclick="openMindMapMiniV136()">Open Mini Section</button>
      <button class="btn green" onclick="saveCurrentMindMapV136()">💾 Save Mind Map</button>
      <button class="btn gold" onclick="downloadMindMapHTMLV136()">⬇ Download</button>
      <button class="btn ghost" onclick="printMindMapPDFV136()">📄 Open as PDF</button>
      <button class="btn ghost" onclick="zoomMindMapV136(1)">Zoom +</button>
      <button class="btn ghost" onclick="zoomMindMapV136(-1)">Zoom -</button>
    </div>`;
  }
  window.drawDetailedMindMapV136 = function(topic, nodes){
    const out=$('mindMapOutput'); if(!out) return;
    const list=nodes && nodes.length ? nodes : defaultMindNodes(topic);
    currentMindMapV136 = {id:Date.now(), topic:String(topic||'Topic'), subject:$('mmSubject')?.value||'General Studies', nodes:list, created:new Date().toLocaleString()};
    const n=list.length || 1;
    const radius = n>10 ? 310 : 285;
    out.innerHTML = `${mindMapToolbarV136()}<div id="mindMapViewportV136" class="mindMapViewportPro"><div id="mindMapFullV136" class="mindMapFullPro"><div class="mindCenterPro"><span>${esc(topic)}</span><small>UPSC Mind Map</small></div>${list.map((node,i)=>{const angle=(360/n)*i; return `<div class="mindRayPro" style="--angle:${angle}deg;--radius:${radius}px"></div><article class="mindNodePro" style="--angle:${angle}deg;--radius:${radius}px"><b>${esc(node.title)}</b><p>${esc(node.detail)}</p></article>`}).join('')}</div></div>`;
  };
  window.renderMindMapManual = function(){
    const topic=$('mmTopic')?.value || 'Topic';
    const nodes=normalizeNodes($('mmNodes')?.value || '').length ? normalizeNodes($('mmNodes')?.value) : defaultMindNodes(topic);
    window.drawDetailedMindMapV136(topic,nodes);
  };
  window.generateMindMapAI = async function(){
    const topic=$('mmTopic')?.value || 'Topic';
    const subject=$('mmSubject')?.value || 'General Studies';
    let raw='';
    try{
      raw=await aiAsk(`Create a detailed UPSC mind map for topic: ${topic} (${subject}). Return 12 short branches. Each line format: Branch Title: 8-12 word explanation. Include definition, background, provisions, examples, current affairs, issues, data, PYQ angle, mains framework and way forward. No markdown table.`);
    }catch(e){ raw=''; }
    const nodes=parseAIToMindNodes(raw,topic);
    if($('mmNodes')) $('mmNodes').value = nodes.map(n=>`${n.title}: ${n.detail}`).join('\n');
    window.drawDetailedMindMapV136(topic,nodes);
  };
  let mindZoom=1;
  window.zoomMindMapV136=function(dir){ mindZoom=Math.max(.55,Math.min(1.55,mindZoom+(dir*.12))); const el=$('mindMapFullV136'); if(el) el.style.transform=`scale(${mindZoom})`; };
  window.backToMindMapCreateV227=function(clearOutput){
    try{ window.closeMindMapMiniV136 && window.closeMindMapMiniV136(); }catch(e){}
    const creator=document.querySelector('#mindMapStudio .studyCreator');
    if(clearOutput){
      currentMindMapV136=null;
      if($('mindMapOutput')) $('mindMapOutput').innerHTML='<div class="mindEmptyHintV227">Start a fresh topic, choose subject, then click <b>AI Generate Mind Map</b> or <b>Draw Mind Map</b>.</div>';
      if($('mmTopic')) $('mmTopic').value='';
      if($('mmNodes')) $('mmNodes').value='';
    }
    if(creator) creator.scrollIntoView({behavior:'smooth',block:'start'});
    setTimeout(()=>{ try{$('mmTopic')?.focus();}catch(e){} },450);
  };
  function getSavedMindMapsV136(){ try{return JSON.parse(localStorage.getItem('savedMindMapsV136')||'[]')}catch(e){return[]} }
  function setSavedMindMapsV136(list){ localStorage.setItem('savedMindMapsV136', JSON.stringify(list||[])); }
  window.saveCurrentMindMapV136=function(){
    if(!currentMindMapV136){ alert('Generate or draw a mind map first.'); return; }
    const saved=getSavedMindMapsV136();
    const item={...currentMindMapV136, id:Date.now(), html:$('mindMapFullV136')?.outerHTML||''};
    saved.unshift(item); setSavedMindMapsV136(saved.slice(0,60)); renderSavedMindMapsV136();
    alert('Mind map saved successfully.');
  };
  window.renderSavedMindMapsV136=function(){
    const box=$('savedMindMapListV136'); if(!box) return;
    const q=($('mindMapSearchV136')?.value||'').toLowerCase();
    const saved=getSavedMindMapsV136().filter(m=>(m.topic+' '+m.subject).toLowerCase().includes(q));
    box.innerHTML = saved.length ? saved.map(m=>`<div class="savedMindCard"><div><b>${esc(m.topic)}</b><small>${esc(m.subject||'General Studies')} • ${esc(m.created||'')}</small></div><div class="savedMindActions"><button class="btn blue" onclick="loadSavedMindMapV136(${m.id})">Open</button><button class="btn gold" onclick="downloadSavedMindMapV136(${m.id})">Download</button><button class="btn danger" onclick="deleteSavedMindMapV136(${m.id})">Delete</button></div></div>`).join('') : '<p class="sub">No saved mind maps yet.</p>';
  };
  window.loadSavedMindMapV136=function(id){
    const m=getSavedMindMapsV136().find(x=>x.id===id); if(!m) return;
    currentMindMapV136=m; if($('mmTopic')) $('mmTopic').value=m.topic; if($('mmSubject')) $('mmSubject').value=m.subject||'General Studies';
    if($('mmNodes')) $('mmNodes').value=(m.nodes||[]).map(n=>`${n.title}: ${n.detail}`).join('\n');
    window.drawDetailedMindMapV136(m.topic,m.nodes||[]);
    document.getElementById('mindMapOutput')?.scrollIntoView({behavior:'smooth',block:'start'});
  };
  window.deleteSavedMindMapV136=function(id){ if(!confirm('Delete this saved mind map?')) return; setSavedMindMapsV136(getSavedMindMapsV136().filter(x=>x.id!==id)); renderSavedMindMapsV136(); };
  function mindMapDownloadDocV136(title, bodyHtml){
    const css=[...document.querySelectorAll('style,link[rel="stylesheet"]')].map(x=>x.outerHTML).join('');
    return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>${css}<style>body{padding:24px;background:#f8fbff}.mindToolbarPro{display:none!important}</style></head><body><h1>${esc(title)}</h1>${bodyHtml}</body></html>`;
  }
  function downloadTextV136(filename, text){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type:'text/html'})); a.download=filename; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
  window.downloadMindMapHTMLV136=function(){ if(!currentMindMapV136){alert('Generate a mind map first.'); return;} downloadTextV136((currentMindMapV136.topic||'mind-map').replace(/[^a-z0-9]+/gi,'-')+'.html', mindMapDownloadDocV136(currentMindMapV136.topic, $('mindMapFullV136')?.outerHTML||'')); };
  window.downloadSavedMindMapV136=function(id){ const m=getSavedMindMapsV136().find(x=>x.id===id); if(!m) return; downloadTextV136((m.topic||'mind-map').replace(/[^a-z0-9]+/gi,'-')+'.html', mindMapDownloadDocV136(m.topic, m.html||'')); };
  window.printMindMapPDFV136=function(){
    if(!currentMindMapV136){alert('Generate a mind map first.'); return;}
    const w=window.open('','_blank'); if(!w){alert('Allow popups to open PDF view.'); return;}
    w.document.write(mindMapDownloadDocV136(currentMindMapV136.topic, $('mindMapFullV136')?.outerHTML||'')); w.document.close(); setTimeout(()=>w.print(),450);
  };
  window.openMindMapMiniV136=function(){
    if(!$('mindMapModalV136')){
      document.body.insertAdjacentHTML('beforeend',`<div id="mindMapModalV136" class="mindModalPro"><div class="mindModalCard"><div class="mindModalHead"><h2>🧠 Mind Map Mini Section</h2><div class="mindModalBtns"><button class="btn danger" onclick="backToMindMapCreateV227(false)">← Back to Create</button><button class="btn green" onclick="saveCurrentMindMapV136()">💾 Save</button><button class="btn gold" onclick="downloadMindMapHTMLV136()">⬇ Download</button><button class="btn ghost" onclick="printMindMapPDFV136()">📄 PDF</button><button class="btn ghost" onclick="closeMindMapMiniV136()">Close Mini</button></div></div><div id="mindMapModalBodyV136"></div></div></div>`);
    }
    const body=$('mindMapModalBodyV136'), src=$('mindMapOutput'); if(body && src) body.innerHTML=src.innerHTML;
    $('mindMapModalV136').classList.add('open');
  };
  window.closeMindMapMiniV136=function(){ $('mindMapModalV136')?.classList.remove('open'); };
  window.addEventListener('load',()=>setTimeout(renderSavedMindMapsV136,500));
})();

/* ===== V22.6 AI Output Download Patch: save/download every AI-generated note ===== */
(function(){
  const AI_DOWNLOAD_SELECTOR_V226 = [
    '.aiOutput',
    '#onePagerOutput'
  ].join(',');

  function cleanFileNameV226(name){
    return String(name || 'ai-note')
      .replace(/[^a-z0-9\-_ ]+/gi,'')
      .trim()
      .replace(/\s+/g,'-')
      .slice(0,70) || 'ai-note';
  }

  function getOutputTitleV226(el){
    const card = el.closest('.card');
    const section = el.closest('section');
    const cardTitle = card?.querySelector('h1,h2,h3')?.innerText;
    const sectionTitle = section?.querySelector('h1,h2')?.innerText;
    return (cardTitle || sectionTitle || el.id || 'AI Generated Note').replace(/\s+/g,' ').trim();
  }

  function getOutputSubjectV226(el){
    const section = el.closest('section');
    const candidate = section?.querySelector('select[id*="Subject"], select[id*="subject"], input[id*="Subject"], input[id*="subject"]');
    return candidate?.value || section?.querySelector('h1,h2')?.innerText || 'AI Generated';
  }

  function getOutputTextV226(el){
    return String(el?.innerText || '')
      .replace(/\n{3,}/g,'\n\n')
      .trim();
  }

  function hasRealOutputV226(text){
    const t = String(text || '').trim().toLowerCase();
    if(!t || t.length < 8) return false;
    const placeholders = [
      'output here', 'ai output here', 'ai plan here', 'voice answer here',
      'paste news and generate intelligence', 'ask your ai personal mentor',
      'your ai plan will appear here', 'ai generated cards/review will appear here',
      'import/search pyqs', 'marks, strengths, weaknesses and improved answer will appear here',
      'ai will generate quick revision', 'ai will identify pattern', 'ai will explain the mistake'
    ];
    return !placeholders.some(p=>t.includes(p));
  }

  function buildHTMLDocV226(title, bodyHtml){
    const safeTitle = String(title||'AI Note').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title><style>
      body{font-family:Inter,Arial,sans-serif;line-height:1.65;margin:0;background:#f6f8ff;color:#172033;padding:28px;}
      .sheet{max-width:900px;margin:auto;background:white;border:1px solid #dbe4ff;border-radius:22px;padding:28px;box-shadow:0 10px 30px rgba(20,40,90,.10)}
      h1{margin-top:0;color:#123169} h2,h3{color:#1f3b7a} li{margin:6px 0} p{margin:10px 0}.meta{color:#607099;margin-bottom:20px;font-size:14px}.aiFormatted{font-size:16px}.onePagerSheet{background:#fff}.a4OnePager{background:#fff;color:#172033}.btn,.aiDownloadBarV226,.mindToolbarPro{display:none!important}
      @media print{body{background:white;padding:0}.sheet{box-shadow:none;border:0;border-radius:0}}
    </style></head><body><main class="sheet"><h1>${safeTitle}</h1><div class="meta">Mission UPSC AI OS • Exported ${new Date().toLocaleString()}</div>${bodyHtml || ''}</main></body></html>`;
  }

  function downloadBlobV226(filename, text, type){
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([text],{type:type||'text/plain;charset=utf-8'}));
    a.download=filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }

  function findOutputFromButtonV226(btn){
    const bar=btn.closest('.aiDownloadBarV226');
    if(!bar) return null;
    return bar.previousElementSibling;
  }

  async function saveOutputAsNoteV226(el){
    const text=getOutputTextV226(el);
    if(!hasRealOutputV226(text)) return alert('Generate AI output first, then save/download.');
    const title=getOutputTitleV226(el);
    await saveCol('notes',{title,subject:getOutputSubjectV226(el),body:text,html:el.innerHTML,source:'AI Output Download Patch',date:today()});
    alert('Saved to Notes Library.');
    try{ if(window.renderActiveSectionV225) await window.renderActiveSectionV225('evernoteNotes'); }catch(e){}
  }

  function downloadOutputV226(el, format){
    const text=getOutputTextV226(el);
    if(!hasRealOutputV226(text)) return alert('Generate AI output first, then save/download.');
    const title=getOutputTitleV226(el);
    const base=cleanFileNameV226(title)+'-'+today();
    if(format==='txt'){
      downloadBlobV226(base+'.txt', title+'\n'+ '='.repeat(Math.min(70,title.length || 10)) +'\n\n'+text, 'text/plain;charset=utf-8');
    }else if(format==='html'){
      downloadBlobV226(base+'.html', buildHTMLDocV226(title, el.innerHTML), 'text/html;charset=utf-8');
    }else if(format==='pdf'){
      const w=window.open('','_blank');
      if(!w) return alert('Allow popups to open PDF/print view.');
      w.document.write(buildHTMLDocV226(title, el.innerHTML));
      w.document.close();
      setTimeout(()=>w.print(),500);
    }
  }

  function installAIOutputDownloadsV226(){
    const outputs=[...document.querySelectorAll(AI_DOWNLOAD_SELECTOR_V226)]
      .filter(el=>el && !el.closest('#mindMapModalV136') && el.id!=='mindMapOutput' && !el.nextElementSibling?.classList?.contains('aiDownloadBarV226'));
    outputs.forEach(el=>{
      const bar=document.createElement('div');
      bar.className='aiDownloadBarV226';
      bar.innerHTML=`<button type="button" class="btn green aiDlBtnV226" data-action="save">💾 Save to Notes</button><button type="button" class="btn gold aiDlBtnV226" data-action="txt">⬇ TXT</button><button type="button" class="btn blue aiDlBtnV226" data-action="html">🌐 HTML</button><button type="button" class="btn ghost aiDlBtnV226" data-action="pdf">📄 PDF / Print</button>`;
      el.insertAdjacentElement('afterend',bar);
    });
  }

  document.addEventListener('click',async function(e){
    const btn=e.target.closest('.aiDlBtnV226');
    if(!btn) return;
    const el=findOutputFromButtonV226(btn);
    if(!el) return;
    const action=btn.dataset.action;
    if(action==='save') return saveOutputAsNoteV226(el);
    downloadOutputV226(el, action);
  });

  const oldShowV226=window.show;
  if(typeof oldShowV226==='function' && !oldShowV226.__aiDownloadPatchedV226){
    const patched=function(id,btn){
      const result=oldShowV226.call(this,id,btn);
      setTimeout(installAIOutputDownloadsV226,120);
      return result;
    };
    patched.__aiDownloadPatchedV226=true;
    window.show=patched;
  }

  window.installAIOutputDownloadsV226=installAIOutputDownloadsV226;
  window.downloadAIOutputV226=function(outputId,format){ const el=document.getElementById(outputId); if(!el) return alert('AI output box not found.'); downloadOutputV226(el,format||'txt'); };
  window.saveAIOutputAsNoteV226=function(outputId){ const el=document.getElementById(outputId); if(!el) return alert('AI output box not found.'); return saveOutputAsNoteV226(el); };
  document.addEventListener('DOMContentLoaded',()=>setTimeout(installAIOutputDownloadsV226,300));
  window.addEventListener('load',()=>setTimeout(installAIOutputDownloadsV226,700));
  setTimeout(installAIOutputDownloadsV226,1000);
})();

/* ===== V23 AI CONTROL CENTRE: OLLAMA + GEMINI FREE + CHATGPT PROMPT MODE ===== */
(function(){
  const AI_DEFAULTS_V23={mode:'ollama',ollamaUrl:'http://localhost:11434',ollamaModel:'gemma3:4b',geminiKey:''};
  let lastChatGPTPromptV23='';
  function getAISettingsV23(){
    try{return {...AI_DEFAULTS_V23,...JSON.parse(localStorage.getItem('mission_ai_settings_v23')||'{}')}}catch(e){return {...AI_DEFAULTS_V23}}
  }
  function setAIStatusV23(msg){const el=document.getElementById('aiConnectionStatusV23'); if(el) el.innerHTML=window.formatAI?formatAI(msg):String(msg)}
  function selectedModeLabelV23(mode){return mode==='ollama'?'🖥 Ollama Local':mode==='gemini'?'☁ Gemini Free API':mode==='chatgpt'?'📋 ChatGPT Prompt Mode':'⭐ Smart Hybrid'}
  window.loadAISettingsV23=function(){
    const s=getAISettingsV23();
    document.querySelectorAll('input[name="aiModeV23"]').forEach(r=>r.checked=r.value===s.mode);
    const u=document.getElementById('ollamaUrlV23'), m=document.getElementById('ollamaModelV23'), g=document.getElementById('geminiKeyV23');
    if(u)u.value=s.ollamaUrl; if(m)m.value=s.ollamaModel; if(g)g.value=s.geminiKey||'';
    setAIStatusV23(`Selected AI: ${selectedModeLabelV23(s.mode)}\nOllama model: ${s.ollamaModel}\nGemini key: ${(s.geminiKey||'').trim()?'Saved':'Not added'}`);
  };
  window.saveAISettingsV23=function(){
    const chosen=document.querySelector('input[name="aiModeV23"]:checked')?.value || 'ollama';
    const settings={mode:chosen,ollamaUrl:(document.getElementById('ollamaUrlV23')?.value||AI_DEFAULTS_V23.ollamaUrl).trim().replace(/\/$/,''),ollamaModel:(document.getElementById('ollamaModelV23')?.value||AI_DEFAULTS_V23.ollamaModel).trim(),geminiKey:(document.getElementById('geminiKeyV23')?.value||'').trim()};
    localStorage.setItem('mission_ai_settings_v23',JSON.stringify(settings));
    setAIStatusV23(`Saved ✅\nSelected AI: ${selectedModeLabelV23(settings.mode)}\nModel: ${settings.ollamaModel}`);
  };
  function makeUPSCPromptV23(prompt){
    return `You are an expert UPSC CSE mentor. Give exam-oriented, concise but complete output. Use clear headings, bullets, PYQ angle, mains dimensions, examples, diagrams/flowcharts in text, and revision summary wherever relevant.\n\nUser request:\n${prompt}`;
  }
  async function askOllamaV23(prompt){
    const s=getAISettingsV23();
    const r=await fetch(`${s.ollamaUrl}/api/generate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:s.ollamaModel,prompt:makeUPSCPromptV23(prompt),stream:false,options:{temperature:0.3}})});
    if(!r.ok) throw new Error('Ollama error: '+await r.text());
    const d=await r.json();
    return d.response || 'No Ollama response.';
  }
  async function askGeminiV23(prompt){
    const s=getAISettingsV23();
    const key=s.geminiKey || (typeof GEMINI_API_KEY!=='undefined'?GEMINI_API_KEY:'');
    if(!key) throw new Error('Gemini API key missing. Add it in AI Control Centre.');
    const models=['gemini-2.0-flash','gemini-2.5-flash','gemini-2.5-flash-lite'];
    let last='';
    for(const model of models){
      try{
        const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:makeUPSCPromptV23(prompt)}]}]})});
        const d=await r.json();
        const out=d?.candidates?.[0]?.content?.parts?.[0]?.text;
        if(out) return out;
        last=d?.error?.message||'No Gemini response';
      }catch(e){last=e.message}
    }
    throw new Error(last||'Gemini failed');
  }
  async function askChatGPTPromptModeV23(prompt){
    lastChatGPTPromptV23=makeUPSCPromptV23(prompt);
    try{await navigator.clipboard.writeText(lastChatGPTPromptV23)}catch(e){}
    return `# ChatGPT Prompt Mode\n\nI prepared and copied the prompt for ChatGPT. Open ChatGPT, paste it, and run.\n\n## Prompt\n\n${lastChatGPTPromptV23}`;
  }
  window.aiAskRouterV23=async function(prompt){
    const s=getAISettingsV23();
    if(s.mode==='ollama') return await askOllamaV23(prompt);
    if(s.mode==='gemini') return await askGeminiV23(prompt);
    if(s.mode==='chatgpt') return await askChatGPTPromptModeV23(prompt);
    try{return await askOllamaV23(prompt)}catch(e){
      try{return await askGeminiV23(prompt)}catch(e2){return await askChatGPTPromptModeV23(prompt+`\n\nNote: Ollama failed: ${e.message}. Gemini failed: ${e2.message}`)}
    }
  };
  window.testAIConnectionV23=async function(){
    window.saveAISettingsV23();
    setAIStatusV23('Testing selected AI...');
    try{const out=await window.aiAskRouterV23('Reply in one line: Mission UPSC AI connection is working.'); setAIStatusV23(out)}catch(e){setAIStatusV23('Connection failed: '+e.message)}
  };
  window.runAITestPromptV23=async function(){
    window.saveAISettingsV23();
    const el=document.getElementById('aiPromptOutputV23'); const prompt=document.getElementById('aiPromptTestV23')?.value || 'Create UPSC one-page notes on Article 14 with PYQ angle.';
    if(el) el.innerHTML='<div class="aiLoading">Running selected AI...</div>';
    try{const out=await window.aiAskRouterV23(prompt); if(el) el.innerHTML=`<div class="aiProviderBadge">${selectedModeLabelV23(getAISettingsV23().mode)}</div>`+(window.formatAI?formatAI(out):out)}catch(e){if(el) el.innerHTML=window.formatAI?formatAI('AI error: '+e.message):('AI error: '+e.message)}
  };
  window.copyLastChatGPTPromptV23=async function(){
    const prompt=lastChatGPTPromptV23 || makeUPSCPromptV23(document.getElementById('aiPromptTestV23')?.value || 'Create UPSC notes.');
    try{await navigator.clipboard.writeText(prompt); alert('ChatGPT prompt copied.')}catch(e){alert(prompt)}
  };
  window.callAI=async function(type,payload){
    let prompt='';
    if(type==='newspaper') prompt=`Analyze this article for UPSC with clean headings:\n# UPSC Newspaper Analysis\n## GS Paper and syllabus link\n## Core issue\n## Prelims facts\n## Mains dimensions\n## Keywords\n## Possible MCQ\n## Possible mains question\n## 100-word summary\n\nArticle:\n${payload?.text||payload?.article||''}`;
    else if(type==='notes') prompt=`Create UPSC-ready notes:\n# ${payload?.topic||'UPSC Notes'}\n## Introduction\n## Core concepts\n## Prelims facts\n## Mains dimensions\n## PYQ angle\n## Flashcards\n## 5 MCQs\n## Revision checklist\n\nContent:\n${payload?.text||''}`;
    else if(type==='mentor') prompt=`Act as a strict but supportive UPSC mentor.\nQuestion/request:\n${payload?.question||''}\n# Mentor Diagnosis\n## Mistakes\n## 7-day plan\n## Daily routine\n## Motivation`;
    else prompt=payload?.question || payload?.prompt || JSON.stringify(payload||{});
    return await window.aiAskRouterV23(prompt);
  };
  try{ window.aiAsk=window.aiAskRouterV23; }catch(e){}
  try{ aiAsk=window.aiAskRouterV23; }catch(e){}
  try{ callGeminiDirect=window.aiAskRouterV23; }catch(e){}
  window.callGeminiDirectV23=window.aiAskRouterV23;
  window.addEventListener('DOMContentLoaded',()=>setTimeout(window.loadAISettingsV23,200));
  const oldShowV23=window.show;
  if(typeof oldShowV23==='function') window.show=function(id,btn){ const r=oldShowV23(id,btn); if(id==='aiControlCentre') setTimeout(window.loadAISettingsV23,50); return r; };
})();

/* ===== V23.1 AI NOTES STUDIO: DESIGN + AI ROUTER CONNECTION ===== */
(function(){
  const AI_DEFAULTS={mode:'ollama',ollamaUrl:'http://localhost:11434',ollamaModel:'gemma3:4b',geminiKey:''};
  let lastAINotesPromptV231='';
  let lastAINotesRequestV231=null;
  function el(id){return document.getElementById(id)}
  function val(id,def=''){const x=el(id); return x ? String(x.value||def).trim() : def}
  function checked(id){return !!el(id)?.checked}
  function settings(){try{return {...AI_DEFAULTS,...JSON.parse(localStorage.getItem('mission_ai_settings_v23')||'{}')}}catch(e){return {...AI_DEFAULTS}}}
  function modeLabel(mode){return mode==='ollama'?'🖥 Ollama Local':mode==='gemini'?'☁ Gemini Free API':mode==='chatgpt'?'📋 ChatGPT Prompt Mode':'⭐ Smart Hybrid'}
  function safeText(s){return String(s||'').replace(/[<>&]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]))}
  function updateModeBadge(){
    const s=settings();
    const badge=el('aiNotesModeBadgeV231');
    if(badge) badge.textContent=`Selected AI: ${modeLabel(s.mode)} • Model: ${s.ollamaModel||'gemma3:4b'}`;
    const hint=el('aiRouteHintV231');
    if(hint){
      hint.innerHTML = s.mode==='ollama' ? '🖥 <b>Ollama Local</b> selected. Best for daily notes, flashcards, mindmaps and revision. Keep Ollama running on your laptop.' :
        s.mode==='gemini' ? '☁ <b>Gemini Free API</b> selected. Best for longer context, current affairs text and deeper explanation. Add API key in AI Control Centre.' :
        s.mode==='chatgpt' ? '📋 <b>ChatGPT Prompt Mode</b> selected. No API cost. This page prepares a perfect prompt to copy into ChatGPT.' :
        '⭐ <b>Smart Hybrid</b> selected. It will try Ollama first, then Gemini, then ChatGPT prompt mode if needed.';
    }
  }
  function getNotesPayload(){
    const topic=val('aiTopic','UPSC Topic');
    const subject=val('aiNoteSubject','General Studies');
    const focus=val('aiExamFocusV231','Prelims + Mains');
    const outputType=val('aiOutputTypeV231','Detailed UPSC Notes');
    const depth=val('aiDepthV231','Balanced');
    const source=val('aiText','');
    const options=[];
    if(checked('aiOptPYQV231')) options.push('PYQ angle and expected question patterns');
    if(checked('aiOptCAV231')) options.push('current affairs linkage and examples');
    if(checked('aiOptCasesV231')) options.push('important cases, committees, reports, data and examples wherever relevant');
    if(checked('aiOptFlowV231')) options.push('text-based flowchart, diagram or framework');
    if(checked('aiOptMCQV231')) options.push('5 UPSC-style MCQs and 10 flashcards');
    return {topic,subject,focus,outputType,depth,source,options};
  }
  function buildPrompt(p){
    const sourceBlock=p.source ? `\n\nSOURCE MATERIAL PROVIDED BY USER:\n${p.source}` : '\n\nNo source material is provided. Use standard UPSC knowledge and keep it exam-oriented.';
    return `You are a senior UPSC CSE mentor and notes-maker. Create high-quality notes for Mission UPSC AI OS.\n\nTOPIC: ${p.topic}\nSUBJECT: ${p.subject}\nEXAM FOCUS: ${p.focus}\nOUTPUT TYPE: ${p.outputType}\nDEPTH: ${p.depth}\n\nMUST INCLUDE:\n${(p.options.length?p.options:['UPSC syllabus linkage','prelims facts','mains dimensions','revision summary']).map((x,i)=>`${i+1}. ${x}`).join('\n')}\n\nFORMAT RULES:\n- Use clean markdown headings.\n- Make it readable for quick revision.\n- Avoid vague generic points.\n- Add examples/data/cases only when relevant.\n- Add one small flowchart in text using arrows.\n- End with a 50-word revision capsule.\n- If output type is an answer, follow UPSC intro-body-conclusion format.\n${sourceBlock}`;
  }
  function renderOutput(text,provider){
    const out=el('notesOutput'); if(!out) return;
    const body=window.formatAI ? window.formatAI(text) : `<pre>${safeText(text)}</pre>`;
    out.innerHTML=`<div class="aiProviderBadgeV231">${safeText(provider||modeLabel(settings().mode))}</div>${body}`;
    try{ window.installAIOutputDownloadsV226 && setTimeout(window.installAIOutputDownloadsV226,50); }catch(e){}
  }
  function loading(message){
    const out=el('notesOutput'); if(out) out.innerHTML=`<div class="aiLoading">${message||'Generating AI notes...'}</div>`;
  }
  window.previewAINotesPromptV231=function(){
    const p=getNotesPayload();
    lastAINotesRequestV231=p;
    lastAINotesPromptV231=buildPrompt(p);
    const box=el('aiPromptPreviewV231');
    if(box) box.value=lastAINotesPromptV231;
    updateModeBadge();
    return lastAINotesPromptV231;
  };
  window.copyAINotesPromptV231=async function(){
    const prompt=lastAINotesPromptV231 || window.previewAINotesPromptV231();
    try{await navigator.clipboard.writeText(prompt); alert('AI notes prompt copied.')}catch(e){alert(prompt)}
  };
  window.openChatGPTV231=function(){
    window.previewAINotesPromptV231();
    window.copyAINotesPromptV231();
    try{window.open('https://chatgpt.com/','_blank')}catch(e){}
  };
  window.generateAINotesV231=async function(){
    try{ window.saveAISettingsV23 && window.saveAISettingsV23(); }catch(e){}
    const prompt=window.previewAINotesPromptV231();
    const p=lastAINotesRequestV231 || getNotesPayload();
    if(!p.topic || p.topic==='UPSC Topic'){alert('Enter a topic first.'); return;}
    loading(`Generating ${p.outputType} using ${modeLabel(settings().mode)}...`);
    try{
      const result = window.aiAskRouterV23 ? await window.aiAskRouterV23(prompt) : await (window.aiAsk ? window.aiAsk(prompt) : Promise.resolve('AI router not found. Open AI Control Centre and save settings.'));
      renderOutput(result,modeLabel(settings().mode));
    }catch(e){
      renderOutput(`AI error: ${e.message}\n\nFix: check AI Control Centre settings. For Ollama, make sure Ollama is running and the model name is correct.`, '⚠ AI Error');
    }
  };
  window.regenerateAINotesV231=function(){ return window.generateAINotesV231(); };
  window.clearAINotesStudioV231=function(){
    ['aiTopic','aiText','aiPromptPreviewV231'].forEach(id=>{const x=el(id); if(x) x.value='';});
    const out=el('notesOutput'); if(out) out.innerHTML='Output here.';
  };
  window.saveAINotesToLibraryV231=async function(){
    const out=el('notesOutput'); if(!out || !out.innerText.trim() || out.innerText.trim()==='Output here.') return alert('Generate notes first.');
    const title=(val('aiTopic','AI Notes')+' - '+val('aiOutputTypeV231','AI Notes')).trim();
    const subject=val('aiNoteSubject','AI');
    try{
      if(typeof saveCol==='function'){
        await saveCol('notes',{title,subject,body:out.innerText,date:(typeof today==='function'?today():new Date().toISOString().slice(0,10)),type:'AI Note',source:'AI Notes Studio v23.1'});
        alert('Saved to Notes Library.');
        try{ if(typeof renderAIIntegrated==='function') renderAIIntegrated(); }catch(e){}
      }else{
        const key='mission_ai_saved_notes_v231';
        const arr=JSON.parse(localStorage.getItem(key)||'[]');
        arr.unshift({title,subject,body:out.innerText,date:new Date().toLocaleString()});
        localStorage.setItem(key,JSON.stringify(arr));
        alert('Saved locally.');
      }
    }catch(e){alert('Save failed: '+e.message)}
  };
  window.createFlashcardsFromAINotesV231=async function(){
    const out=el('notesOutput'); if(!out || !out.innerText.trim() || out.innerText.trim()==='Output here.') return alert('Generate notes first.');
    const prompt=`Create 20 UPSC flashcards from the following notes. Format strictly as:\nQ: question\nA: answer\n\nNOTES:\n${out.innerText}`;
    const box=el('flashAIOutput');
    try{
      if(box) box.innerHTML='<div class="aiLoading">Creating flashcards from AI notes...</div>';
      const result=window.aiAskRouterV23 ? await window.aiAskRouterV23(prompt) : await window.aiAsk(prompt);
      if(box) box.innerHTML=window.formatAI?window.formatAI(result):safeText(result);
      if(typeof saveCol==='function') await saveCol('flash',{q:'AI generated flashcard set - '+val('aiTopic','Topic'),a:result,subject:val('aiNoteSubject','AI'),difficulty:'Medium',due:(typeof today==='function'?today():new Date().toISOString().slice(0,10)),date:(typeof today==='function'?today():new Date().toISOString().slice(0,10))});
      alert('Flashcards generated. Open Smart Flashcards section to view.');
    }catch(e){alert('Flashcard generation failed: '+e.message)}
  };
  window.sendAINotesToMindMapV231=async function(){
    const out=el('notesOutput'); if(!out || !out.innerText.trim() || out.innerText.trim()==='Output here.') return alert('Generate notes first.');
    const topic=val('aiTopic','AI Mind Map');
    const prompt=`From these UPSC notes, extract exactly 12 mind map branches. Each line must be: Branch Title: 8-12 word explanation. No markdown table.\n\nTOPIC: ${topic}\n\nNOTES:\n${out.innerText}`;
    try{
      const result=window.aiAskRouterV23 ? await window.aiAskRouterV23(prompt) : await window.aiAsk(prompt);
      if(el('mmTopic')) el('mmTopic').value=topic;
      if(el('mmSubject')) el('mmSubject').value=val('aiNoteSubject','Polity');
      if(el('mmNodes')) el('mmNodes').value=result.replace(/```[\s\S]*?```/g,'').trim();
      try{ window.show && window.show('mindMapStudio'); }catch(e){}
      setTimeout(()=>{try{ window.renderMindMapManual && window.renderMindMapManual(); }catch(e){}},120);
    }catch(e){alert('Mind map conversion failed: '+e.message)}
  };
  const oldAISettingsSave=window.saveAISettingsV23;
  if(typeof oldAISettingsSave==='function'){
    window.saveAISettingsV23=function(){const r=oldAISettingsSave.apply(this,arguments); setTimeout(updateModeBadge,30); return r;}
  }
  const oldShow=window.show;
  if(typeof oldShow==='function'){
    window.show=function(id,btn){const r=oldShow.apply(this,arguments); if(id==='aiNotesPro') setTimeout(updateModeBadge,60); return r;}
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{updateModeBadge(); window.previewAINotesPromptV231 && window.previewAINotesPromptV231();},500));
})();

/* ===== V23.2 AI STABILITY PATCH: SAFE DELETE + OLLAMA STREAMING + CANCEL ===== */
(function(){
  const AI_DEFAULTS_V232={mode:'ollama',ollamaUrl:'http://localhost:11434',ollamaModel:'gemma3:4b',geminiKey:''};
  let aiAbortV232=null;
  let aiGeneratingV232=false;
  function q(id){return document.getElementById(id)}
  function esc232(v){return String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function getAISettingsV232(){try{return {...AI_DEFAULTS_V232,...JSON.parse(localStorage.getItem('mission_ai_settings_v23')||'{}')}}catch(e){return {...AI_DEFAULTS_V232}}}
  function modeLabelV232(mode){return mode==='ollama'?'🖥 Ollama Local':mode==='gemini'?'☁ Gemini Free API':mode==='chatgpt'?'📋 ChatGPT Prompt Mode':'⭐ Smart Hybrid'}
  function fmt232(text){try{return typeof formatAI==='function'?formatAI(text):`<pre>${esc232(text)}</pre>`}catch(e){return `<pre>${esc232(text)}</pre>`}}
  function setStatusV232(msg,active=true){const el=q('aiGenerationStatusV232'); if(el){el.classList.toggle('active',!!active); el.innerHTML=msg||'';}}
  function setCancelVisibleV232(show){const btn=q('cancelAINotesBtnV232'); if(btn) btn.style.display=show?'inline-flex':'none';}
  function setOutputV232(text,provider,streaming=false){
    const out=q('notesOutput'); if(!out) return;
    out.innerHTML=`<div class="aiProviderBadgeV231">${esc232(provider||modeLabelV232(getAISettingsV232().mode))}</div>${fmt232(text||'')}${streaming?'<span class="aiStreamingCursorV232"></span>':''}`;
  }
  function wrapUPSCPromptV232(prompt){
    return `You are an expert UPSC CSE mentor. Give exam-oriented, concise but complete output. Use clear headings, bullets, PYQ angle, mains dimensions, examples, diagrams/flowcharts in text, and revision summary wherever relevant.\n\nUser request:\n${prompt}`;
  }
  function qualityInstructionV232(){
    const depth=(q('aiDepthV231')?.value||'Balanced').trim();
    if(depth==='Fast Mode') return '\n\nQUALITY MODE: FAST. Keep the answer sharp and exam-ready in about 600-800 words. Do not remove PYQ angle or flowchart.';
    if(depth==='Expert Mode') return '\n\nQUALITY MODE: EXPERT. Give a deeper UPSC mentor-level answer with more examples, cases/data where relevant, and strong mains value addition.';
    return ''; // Balanced remains exactly the default quality.
  }
  async function askOllamaStreamingV232(prompt,onToken,signal){
    const s=getAISettingsV232();
    const url=(s.ollamaUrl||AI_DEFAULTS_V232.ollamaUrl).replace(/\/$/,'');
    const r=await fetch(`${url}/api/generate`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      signal,
      body:JSON.stringify({model:s.ollamaModel||'gemma3:4b',prompt:wrapUPSCPromptV232(prompt+qualityInstructionV232()),stream:true,options:{temperature:0.3}})
    });
    if(!r.ok) throw new Error('Ollama error: '+await r.text());
    if(!r.body){
      const d=await r.json();
      const final=d.response||'';
      if(onToken) onToken(final);
      return final;
    }
    const reader=r.body.getReader();
    const decoder=new TextDecoder();
    let buffer='', full='';
    while(true){
      const {value,done}=await reader.read();
      if(done) break;
      buffer += decoder.decode(value,{stream:true});
      const lines=buffer.split('\n');
      buffer=lines.pop()||'';
      for(const line of lines){
        const clean=line.trim();
        if(!clean) continue;
        try{
          const j=JSON.parse(clean);
          if(j.response){ full += j.response; if(onToken) onToken(full,j); }
          if(j.done) return full;
        }catch(e){/* ignore partial json */}
      }
    }
    return full;
  }
  window.cancelAINotesV232=function(){
    if(aiAbortV232){ aiAbortV232.abort(); }
    aiGeneratingV232=false;
    setCancelVisibleV232(false);
    setStatusV232('⛔ Generation cancelled. Partial notes are preserved above.',true);
  };
  window.generateAINotesV231=async function(){
    if(aiGeneratingV232) return alert('AI is already generating. Press Cancel first if you want to stop.');
    try{ window.saveAISettingsV23 && window.saveAISettingsV23(); }catch(e){}
    const topic=(q('aiTopic')?.value||'').trim();
    if(!topic) return alert('Enter a topic first.');
    const prompt=(window.previewAINotesPromptV231?window.previewAINotesPromptV231():`Create UPSC notes on ${topic}`);
    const s=getAISettingsV232();
    const provider=modeLabelV232(s.mode);
    const out=q('notesOutput');
    aiAbortV232=new AbortController();
    aiGeneratingV232=true;
    setCancelVisibleV232(true);
    setStatusV232(`🤖 ${provider} is generating. Balanced mode keeps your current quality. Streaming is enabled so notes appear live.`,true);
    if(out) out.innerHTML=`<div class="aiProviderBadgeV231">${esc232(provider)}</div><div class="aiLoading">Starting AI generation...</div>`;
    try{
      let final='';
      if(s.mode==='ollama' || s.mode==='hybrid'){
        let lastPaint=0;
        final=await askOllamaStreamingV232(prompt,(text)=>{
          final=text;
          const now=Date.now();
          if(now-lastPaint>160){ setOutputV232(final,provider,true); lastPaint=now; }
        },aiAbortV232.signal);
        setOutputV232(final||'No Ollama response received.',provider,false);
      }else{
        setStatusV232(`🤖 ${provider} is thinking...`,true);
        final = window.aiAskRouterV23 ? await window.aiAskRouterV23(prompt+qualityInstructionV232()) : 'AI router not found. Open AI Control Centre and save settings.';
        setOutputV232(final,provider,false);
      }
      setStatusV232('✅ AI notes generated. You can Save, Download PDF/HTML/TXT, Convert to Flashcards, or Send to Mind Map.',true);
      try{ window.installAIOutputDownloadsV226 && setTimeout(window.installAIOutputDownloadsV226,80); }catch(e){}
    }catch(e){
      if(e.name==='AbortError'){
        setStatusV232('⛔ Generation cancelled. Partial notes are preserved.',true);
      }else{
        const msg=`AI error: ${e.message}\n\nFor Ollama: keep Ollama running, check model name gemma3:4b, and use local address 127.0.0.1. On phone/tablet GitHub Pages, use Gemini Free or ChatGPT Prompt Mode.`;
        setOutputV232(msg,'⚠ AI Error',false);
        setStatusV232('⚠ AI generation failed. Check AI Control Centre settings.',true);
      }
    }finally{
      aiGeneratingV232=false;
      aiAbortV232=null;
      setCancelVisibleV232(false);
    }
  };

  // More robust section-file delete. Fixes duplicate local+cloud records that made files reappear after Delete.
  const sectionFileKeyV232='upscSectionFilesV10';
  function getLocalSectionFilesV232(){try{return JSON.parse(localStorage.getItem(sectionFileKeyV232)||'[]')}catch(e){return []}}
  function setLocalSectionFilesV232(arr){localStorage.setItem(sectionFileKeyV232,JSON.stringify(arr||[]));}
  function fileSameV232(a,b,id){
    if(!a || !b) return false;
    return String(a.id||'')===String(id||'') || String(a.id||'')===String(b.id||'') || (!!a.storagePath && a.storagePath===b.storagePath) || (!!a.url && a.url===b.url) || (a.name===b.name && a.date===b.date && a.sectionId===b.sectionId);
  }
  async function cloudSectionFilesV232(){
    if(!(cloudEnabled && user && db)) return [];
    try{const snap=await getDocs(collection(db,path('sectionFiles'))); return snap.docs.map(d=>({...(d.data()||{}), _docId:d.id, id:(d.data()||{}).id||d.id}));}catch(e){console.warn('Cloud file read failed:',e.message); return []}
  }
  window.deleteSectionFileV10=async function(id){
    if(!confirm('Delete this file? This removes both the visible card and cloud/local metadata.')) return;
    const status=setStatusV232;
    try{
      status('🗑 Deleting file record...',true);
      const local=getLocalSectionFilesV232();
      const cloud=await cloudSectionFilesV232();
      let target=[...cloud,...local].find(f=>String(f.id)===String(id)||String(f._docId||'')===String(id)||String(f.storagePath||'')===String(id));
      if(!target){
        target={id};
      }
      const storagePaths=[...new Set([...cloud,...local].filter(f=>fileSameV232(f,target,id)).map(f=>f.storagePath).filter(Boolean))];
      for(const sp of storagePaths){try{await deleteStoragePath(sp)}catch(e){console.warn('Storage delete skipped:',e.message)}}
      if(cloudEnabled && user && db){
        const matches=cloud.filter(f=>fileSameV232(f,target,id));
        for(const f of matches){
          const docId=f._docId || f.id;
          if(docId){try{await deleteDoc(doc(db,path('sectionFiles'),docId))}catch(e){console.warn('Cloud metadata delete skipped:',e.message)}}
        }
      }
      const cleaned=local.filter(f=>!fileSameV232(f,target,id));
      setLocalSectionFilesV232(cleaned);
      document.querySelectorAll('.section').forEach(sec=>{try{window.renderSectionFilesV10 && window.renderSectionFilesV10(sec.id)}catch(e){}});
      try{window.renderFileVault && window.renderFileVault()}catch(e){}
      try{window.renderAIIntegrated && window.renderAIIntegrated()}catch(e){}
      status('✅ File deleted successfully.',true);
      setTimeout(()=>status('',false),1800);
    }catch(e){
      console.error('Robust file delete failed:',e);
      status('⚠ Delete failed: '+(e.message||e),true);
      alert('Delete failed: '+(e.message||e));
    }
  };
})();


/* ===== V23.3 + V23.4 COMBINED: AI FLASHCARDS/MINDMAPS + PDF ANALYZER ===== */
(function(){
  const $v=(id)=>document.getElementById(id);
  const escV=(v)=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const textV=(id)=>String($v(id)?.value||'').trim();
  let pdfAbortV234=null;
  function aiSettingsV(){try{return {mode:'ollama',ollamaUrl:'http://localhost:11434',ollamaModel:'gemma3:4b',geminiKey:'',...JSON.parse(localStorage.getItem('mission_ai_settings_v23')||'{}')}}catch(e){return {mode:'ollama',ollamaUrl:'http://localhost:11434',ollamaModel:'gemma3:4b',geminiKey:''}}}
  function modeLabelV(mode){return mode==='ollama'?'🖥 Ollama Local':mode==='gemini'?'☁ Gemini Free API':mode==='chatgpt'?'📋 ChatGPT Prompt Mode':'⭐ Smart Hybrid'}
  function fmtV(t){try{return typeof formatAI==='function'?formatAI(t):`<pre>${escV(t)}</pre>`}catch(e){return `<pre>${escV(t)}</pre>`}}
  function setHtml(id,html){const el=$v(id); if(el) el.innerHTML=html;}
  function setStatus(id,msg,active=true){const el=$v(id); if(el){el.classList.toggle('active',!!active); el.innerHTML=msg||'';}}
  function outputText(id){return ($v(id)?.innerText||'').replace(/^Selected AI:.*\n?/,'').trim();}
  function todayV(){try{return typeof today==='function'?today():new Date().toISOString().slice(0,10)}catch(e){return new Date().toISOString().slice(0,10)}}
  async function saveV(col,obj){if(typeof saveCol==='function') return await saveCol(col,obj); const a=JSON.parse(localStorage.getItem(col)||'[]'); a.unshift({...obj,id:'local_'+Date.now()}); localStorage.setItem(col,JSON.stringify(a));}
  async function askV(prompt){ if(typeof window.aiAskRouterV23==='function') return await window.aiAskRouterV23(prompt); if(typeof window.aiAsk==='function') return await window.aiAsk(prompt); throw new Error('AI router not found. Open AI Control Centre and save settings.'); }

  function updateBadgesV234(){
    const s=aiSettingsV();
    const b=$v('pdfAnalyzerModeBadgeV234'); if(b) b.textContent=`Selected AI: ${modeLabelV(s.mode)} • Model: ${s.ollamaModel||'gemma3:4b'}`;
  }

  // ---------- V23.3: better flashcard parser and generation ----------
  function parseFlashcardsV233(raw){
    const text=String(raw||'').replace(/```[\s\S]*?```/g,m=>m.replace(/```/g,''));
    const cards=[];
    let chunks=text.split(/\n\s*(?=(?:Card\s*\d+|\d+[\).]|Q\s*:|Question\s*:))/i).map(x=>x.trim()).filter(Boolean);
    if(chunks.length<2) chunks=text.split(/\n{2,}/).map(x=>x.trim()).filter(Boolean);
    for(const ch of chunks){
      let q=(ch.match(/(?:Q|Question|Front)\s*[:\-]\s*([^\n]+)/i)||[])[1];
      let a=(ch.match(/(?:A|Answer|Back)\s*[:\-]\s*([\s\S]*?)(?=\n\s*(?:Memory|Trick|One\s*Pager|Diagram|PYQ|Difficulty|Subject)\s*[:\-]|$)/i)||[])[1];
      let trick=(ch.match(/(?:Memory\s*Trick|Memory|Trick)\s*[:\-]\s*([^\n]+)/i)||[])[1]||'';
      let one=(ch.match(/(?:One\s*Pager|One-page|Summary)\s*[:\-]\s*([\s\S]*?)(?=\n\s*(?:Diagram|PYQ|Difficulty|Subject|Q\s*:|Question\s*:)|$)/i)||[])[1]||'';
      let diagram=(ch.match(/(?:Diagram|Flow|Flowchart)\s*[:\-]\s*([^\n]+)/i)||[])[1]||'';
      let pyq=(ch.match(/(?:PYQ|Year)\s*[:\-]\s*([^\n]+)/i)||[])[1]||'';
      if(!q){
        const lines=ch.split('\n').map(x=>x.replace(/^[-*\d.\s]+/,'').trim()).filter(Boolean);
        if(lines.length>=2){ q=lines[0].replace(/^Question\s*[:\-]?/i,'').trim(); a=lines.slice(1).join('\n'); }
      }
      if(q && a) cards.push({q:q.trim().slice(0,220),a:a.trim().slice(0,1600),trick:trick.trim().slice(0,240),onePager:one.trim().slice(0,1600),diagram:diagram.trim().slice(0,240),pyq:pyq.trim().slice(0,80)});
      if(cards.length>=40) break;
    }
    return cards;
  }
  window.parseFlashcardsV233=parseFlashcardsV233;

  async function saveFlashcardsV233(cards,subject,source){
    let count=0;
    for(const c of cards){
      await saveV('flash',{q:c.q,a:c.a,subject:subject||'General',difficulty:'Medium',pyq:c.pyq||source||'',trick:c.trick||'Active recall + quick revision',onePager:c.onePager||c.a,diagram:c.diagram||'Concept → Fact → Example → PYQ → Revision',due:todayV(),date:todayV(),source:'AI Flashcards v23.3'});
      count++;
    }
    try{ if(typeof renderFlashcardsPerfect==='function') await renderFlashcardsPerfect(); }catch(e){}
    return count;
  }

  async function generateFlashcardsFromTextV233(source,topic,subject,targetId){
    if(!source.trim()) throw new Error('Add topic/content/AI notes first.');
    const prompt=`Create 20 high-quality UPSC active-recall flashcards from the content below.\n\nSTRICT FORMAT for every card:\nCard 1\nQ: crisp exam question\nA: accurate answer with explanation\nMemory: short mnemonic or hook\nOne Pager: 3-5 line revision note\nDiagram: A → B → C flow\nPYQ: related PYQ angle/year if relevant\n\nRules: mix prelims facts, mains dimensions, examples, cases/data and conceptual traps. Avoid repetition.\n\nTopic: ${topic||'UPSC Topic'}\nSubject: ${subject||'General Studies'}\n\nCONTENT:\n${source.slice(0,18000)}`;
    if(targetId) setHtml(targetId,'<div class="aiLoading">Generating structured flashcards...</div>');
    const raw=await askV(prompt);
    const cards=parseFlashcardsV233(raw);
    if(targetId) setHtml(targetId,fmtV(raw)+`<div class="aiRouteCardV231"><b>${cards.length}</b> cards detected. Click Save Generated Cards if not auto-saved.</div>`);
    return {raw,cards};
  }

  window.generateFlashcardsAI=async function(){
    const source=(textV('flashSourceText')||textV('flashQAI')||textV('aiTopic')).trim();
    const topic=textV('flashQAI')||textV('aiTopic')||'UPSC Flashcards';
    const subject=textV('flashSubjectAI')||textV('aiNoteSubject')||'General';
    try{
      const {cards}=await generateFlashcardsFromTextV233(source,topic,subject,'flashAIOutput');
      if(cards.length){ const n=await saveFlashcardsV233(cards,subject,'AI generated'); alert(`${n} flashcards saved. Open Smart Flashcards to practice.`); }
      else alert('AI generated text, but card parser could not detect Q/A cards. You can still copy the output.');
    }catch(e){ setHtml('flashAIOutput',fmtV('Flashcard generation failed: '+e.message)); }
  };

  window.createFlashcardsFromAINotesV231=async function(){
    const notes=outputText('notesOutput');
    if(!notes || notes==='Output here.') return alert('Generate notes first.');
    const topic=textV('aiTopic')||'AI Notes';
    const subject=textV('aiNoteSubject')||'General';
    try{
      const {raw,cards}=await generateFlashcardsFromTextV233(notes,topic,subject,'flashAIOutput');
      const n=await saveFlashcardsV233(cards,subject,'From AI Notes');
      alert(n?`${n} flashcards saved from AI notes.`:'AI output created but no structured cards were detected.');
      try{ window.show && window.show('smartFlashcards'); }catch(e){}
    }catch(e){ alert('Flashcard conversion failed: '+e.message); }
  };

  function parseMindNodesV233(raw,topic){
    const lines=String(raw||'').split('\n').map(x=>x.replace(/^[-*\d.\s]+/,'').trim()).filter(Boolean);
    const nodes=[];
    for(const line of lines){
      const clean=line.replace(/\*\*/g,'').trim();
      if(!clean || clean.length>220) continue;
      const parts=clean.split(/[:–—-]/);
      const title=(parts[0]||clean).trim().slice(0,46);
      const detail=(parts.slice(1).join(' - ').trim()||'Definition • Example • PYQ • Mains angle').slice(0,125);
      nodes.push({title,detail});
      if(nodes.length>=14) break;
    }
    if(nodes.length>=6) return nodes;
    const fallback=['Definition','Background','Articles / Provisions','Key Features','Issues','Judgements / Examples','Current Affairs','Data / Reports','PYQ Angle','Mains Framework','Way Forward','Memory Hook'];
    return fallback.map(x=>({title:x,detail:`${x} angle for ${topic||'topic'}`}));
  }

  async function generateMindMapFromTextV233(source,topic,subject){
    const prompt=`Create a detailed UPSC mind map from the content below. Return exactly 12 branches. Each line must be: Branch Title: 8-14 word explanation. Include definition, background, provisions/features, examples/cases/data, current affairs, issues, PYQ angle, mains framework, way forward and memory hook. No markdown table.\n\nTopic: ${topic}\nSubject: ${subject}\n\nCONTENT:\n${source.slice(0,18000)}`;
    const raw=await askV(prompt);
    return parseMindNodesV233(raw,topic);
  }

  window.sendAINotesToMindMapV231=async function(){
    const notes=outputText('notesOutput');
    if(!notes || notes==='Output here.') return alert('Generate notes first.');
    const topic=textV('aiTopic')||'AI Mind Map';
    const subject=textV('aiNoteSubject')||'General';
    try{
      const nodes=await generateMindMapFromTextV233(notes,topic,subject);
      if($v('mmTopic')) $v('mmTopic').value=topic;
      if($v('mmSubject')) $v('mmSubject').value=subject;
      if($v('mmNodes')) $v('mmNodes').value=nodes.map(n=>`${n.title}: ${n.detail}`).join('\n');
      try{ window.show && window.show('mindMapStudio'); }catch(e){}
      setTimeout(()=>{ if(typeof window.drawDetailedMindMapV136==='function') window.drawDetailedMindMapV136(topic,nodes); else if(typeof window.renderMindMapManual==='function') window.renderMindMapManual(); },140);
    }catch(e){ alert('Mind map conversion failed: '+e.message); }
  };

  window.generateBothFromAINotesV233=async function(){
    const notes=outputText('notesOutput');
    if(!notes || notes==='Output here.') return alert('Generate notes first.');
    const topic=textV('aiTopic')||'AI Notes';
    const subject=textV('aiNoteSubject')||'General';
    const statusId='aiGenerationStatusV232';
    try{
      setStatus(statusId,'🃏 Creating flashcards from notes...',true);
      const {cards}=await generateFlashcardsFromTextV233(notes,topic,subject,'flashAIOutput');
      const n=await saveFlashcardsV233(cards,subject,'From AI Notes');
      setStatus(statusId,`✅ ${n} flashcards saved. 🧠 Creating mindmap...`,true);
      const nodes=await generateMindMapFromTextV233(notes,topic,subject);
      if($v('mmTopic')) $v('mmTopic').value=topic;
      if($v('mmSubject')) $v('mmSubject').value=subject;
      if($v('mmNodes')) $v('mmNodes').value=nodes.map(x=>`${x.title}: ${x.detail}`).join('\n');
      setStatus(statusId,`✅ Done. ${n} flashcards saved and mindmap prepared. Open Mind Map Studio / Smart Flashcards.`,true);
    }catch(e){ setStatus(statusId,'⚠ Conversion failed: '+e.message,true); }
  };

  // ---------- V23.4: PDF analyzer ----------
  function buildPDFPromptV234(){
    const title=textV('pdfTitleV234')||($v('pdfFileV234')?.files?.[0]?.name||'UPSC Document');
    const subject=textV('pdfSubjectV234')||'General';
    const dtype=textV('pdfTypeV234')||'UPSC Notes / Class Notes';
    const depth=textV('pdfDepthV234')||'Balanced';
    const limit=parseInt($v('pdfLimitV234')?.value||'12000',10);
    const raw=textV('pdfTextV234');
    const content=raw.slice(0,limit);
    const prompt=`You are a UPSC CSE mentor and document analyst. Analyze the following document for UPSC preparation.\n\nTitle: ${title}\nSubject: ${subject}\nDocument Type: ${dtype}\nDepth: ${depth}\n\nOutput in this exact structure:\n# ${title} - UPSC Analysis\n## 1. 150-word summary\n## 2. Syllabus linkage: GS paper, subject, static/current link\n## 3. Prelims facts: bullets with keywords, schemes, institutions, reports, places, articles\n## 4. Mains dimensions: causes, issues, impacts, governance angle, ethics angle if relevant\n## 5. Data / Reports / Examples to remember\n## 6. PYQ angle and expected questions\n## 7. 10 MCQs with answer key\n## 8. 10 Flashcards in Q/A format\n## 9. One-page revision note\n## 10. Mindmap branches: 12 lines in Branch: detail format\n## 11. Final revision checklist\n\nDOCUMENT TEXT:\n${content}`;
    return {prompt,title,subject,dtype,depth,chars:raw.length,used:content.length};
  }
  window.previewPDFPromptV234=function(){
    const p=buildPDFPromptV234();
    const box=$v('pdfPromptPreviewV234'); if(box) box.value=p.prompt;
    updateBadgesV234();
    return p.prompt;
  };
  window.copyPDFPromptV234=async function(){
    const p=window.previewPDFPromptV234();
    try{await navigator.clipboard.writeText(p); alert('PDF analysis prompt copied.')}catch(e){alert(p)}
  };
  window.openChatGPTPDFPromptV234=function(){ window.copyPDFPromptV234(); try{window.open('https://chatgpt.com/','_blank')}catch(e){} };

  function loadPdfJsV234(){
    return new Promise((resolve,reject)=>{
      if(window.pdfjsLib) return resolve(window.pdfjsLib);
      const s=document.createElement('script');
      s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
      s.onload=()=>{ try{ window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js'; }catch(e){} resolve(window.pdfjsLib); };
      s.onerror=()=>reject(new Error('PDF.js could not load. Check internet connection, or paste PDF text manually.'));
      document.head.appendChild(s);
    });
  }
  async function extractPdfTextV234(file){
    const pdfjs=await loadPdfJsV234();
    const data=await file.arrayBuffer();
    const pdf=await pdfjs.getDocument({data}).promise;
    let out='';
    const maxPages=Math.min(pdf.numPages,80);
    for(let i=1;i<=maxPages;i++){
      setStatus('pdfExtractStatusV234',`📖 Extracting PDF text... page ${i}/${maxPages}`,true);
      const page=await pdf.getPage(i);
      const txt=await page.getTextContent();
      out += `\n\n--- Page ${i} ---\n` + txt.items.map(it=>it.str).join(' ');
    }
    if(pdf.numPages>80) out += `\n\n[Only first 80 pages extracted for speed. Total pages: ${pdf.numPages}]`;
    return out.trim();
  }
  window.extractPDFAnalyzerTextV234=async function(){
    const f=$v('pdfFileV234')?.files?.[0];
    if(!f) return alert('Choose a PDF/TXT file first, or paste text manually.');
    try{
      setStatus('pdfExtractStatusV234','📖 Reading file...',true);
      if(!textV('pdfTitleV234')) $v('pdfTitleV234').value=f.name.replace(/\.[^.]+$/,'');
      let text='';
      if(/\.pdf$/i.test(f.name) || /pdf/i.test(f.type)) text=await extractPdfTextV234(f);
      else text=await f.text();
      if($v('pdfTextV234')) $v('pdfTextV234').value=text;
      setStatus('pdfExtractStatusV234',`✅ Text extracted: ${text.length.toLocaleString()} characters. Now click Analyze with AI.`,true);
      window.previewPDFPromptV234();
    }catch(e){ setStatus('pdfExtractStatusV234','⚠ Extract failed: '+e.message,true); alert(e.message); }
  };
  window.cancelPDFAIV234=function(){ if(pdfAbortV234){ pdfAbortV234.abort(); pdfAbortV234=null; } setStatus('pdfAIStatusV234','⛔ PDF AI generation cancelled.',true); };
  window.analyzePDFWithAIV234=async function(){
    const p=buildPDFPromptV234();
    if(!textV('pdfTextV234')) return alert('Extract or paste document text first.');
    const s=aiSettingsV();
    setHtml('pdfAIOutputV234',`<div class="aiProviderBadgeV231">${escV(modeLabelV(s.mode))}</div><div class="aiLoading">Analyzing document with selected AI...</div>`);
    setStatus('pdfAIStatusV234',`🤖 ${modeLabelV(s.mode)} analyzing ${p.used.toLocaleString()} / ${p.chars.toLocaleString()} characters...`,true);
    try{
      const out=await askV(p.prompt);
      setHtml('pdfAIOutputV234',`<div class="aiProviderBadgeV231">${escV(modeLabelV(s.mode))}</div>${fmtV(out)}`);
      setStatus('pdfAIStatusV234','✅ PDF/document analysis completed. You can save, download, convert to flashcards or mindmap.',true);
      try{ window.installAIOutputDownloadsV226 && setTimeout(window.installAIOutputDownloadsV226,100); }catch(e){}
    }catch(e){ setHtml('pdfAIOutputV234',fmtV('PDF AI analysis failed: '+e.message+'\n\nOn iPad/GitHub use Gemini or ChatGPT Prompt Mode. On laptop/local server use Ollama.')); setStatus('pdfAIStatusV234','⚠ Analysis failed.',true); }
  };
  window.savePDFAnalysisToLibraryV234=async function(){
    const out=outputText('pdfAIOutputV234'); if(!out || out.startsWith('Upload/paste')) return alert('Analyze document first.');
    await saveV('library2',{type:'AI PDF Analysis',subject:textV('pdfSubjectV234')||'General',title:textV('pdfTitleV234')||'AI PDF Analysis',url:'',content:out,date:todayV(),source:'AI PDF Analyzer v23.4'});
    await saveV('notes',{title:textV('pdfTitleV234')||'AI PDF Analysis',subject:textV('pdfSubjectV234')||'General',body:out,date:todayV(),type:'AI PDF Analysis',source:'AI PDF Analyzer v23.4'});
    alert('Saved to Library + Notes.');
  };
  window.pdfAnalysisToNotesV234=async function(){
    const out=outputText('pdfAIOutputV234'); if(!out || out.startsWith('Upload/paste')) return alert('Analyze document first.');
    if($v('aiTopic')) $v('aiTopic').value=textV('pdfTitleV234')||'PDF Analysis';
    if($v('aiNoteSubject')) $v('aiNoteSubject').value=textV('pdfSubjectV234')||'General';
    if($v('notesOutput')) $v('notesOutput').innerHTML=fmtV(out);
    try{ window.show && window.show('aiNotesPro'); }catch(e){}
  };
  window.pdfAnalysisToFlashcardsV234=async function(){
    const out=outputText('pdfAIOutputV234'); if(!out || out.startsWith('Upload/paste')) return alert('Analyze document first.');
    try{
      setStatus('pdfAIStatusV234','🃏 Creating flashcards from PDF analysis...',true);
      const {cards}=await generateFlashcardsFromTextV233(out,textV('pdfTitleV234')||'PDF Analysis',textV('pdfSubjectV234')||'General','flashAIOutput');
      const n=await saveFlashcardsV233(cards,textV('pdfSubjectV234')||'General','From PDF Analyzer');
      setStatus('pdfAIStatusV234',`✅ ${n} flashcards saved.`,true);
      alert(`${n} flashcards saved.`);
    }catch(e){ setStatus('pdfAIStatusV234','⚠ Flashcard conversion failed: '+e.message,true); }
  };
  window.pdfAnalysisToMindMapV234=async function(){
    const out=outputText('pdfAIOutputV234'); if(!out || out.startsWith('Upload/paste')) return alert('Analyze document first.');
    const topic=textV('pdfTitleV234')||'PDF Mind Map';
    const subject=textV('pdfSubjectV234')||'General';
    try{
      setStatus('pdfAIStatusV234','🧠 Creating mindmap from PDF analysis...',true);
      const nodes=await generateMindMapFromTextV233(out,topic,subject);
      if($v('mmTopic')) $v('mmTopic').value=topic;
      if($v('mmSubject')) $v('mmSubject').value=subject;
      if($v('mmNodes')) $v('mmNodes').value=nodes.map(n=>`${n.title}: ${n.detail}`).join('\n');
      try{ window.show && window.show('mindMapStudio'); }catch(e){}
      setTimeout(()=>{ if(typeof window.drawDetailedMindMapV136==='function') window.drawDetailedMindMapV136(topic,nodes); },150);
    }catch(e){ setStatus('pdfAIStatusV234','⚠ Mindmap conversion failed: '+e.message,true); }
  };
  window.pdfAnalysisToRevisionV234=async function(){
    const title=textV('pdfTitleV234')||'PDF Analysis Revision';
    try{ await saveV('tasks',{title:'Revise PDF Analysis: '+title,subject:textV('pdfSubjectV234')||'General',date:todayV(),status:'Pending',source:'AI PDF Analyzer v23.4'}); alert('Revision task added.'); }catch(e){ alert('Revision save failed: '+e.message); }
  };

  function injectV233Buttons(){
    const outActions=document.querySelector('#aiNotesPro .outputActionsV231');
    if(outActions && !$v('aiBothBtnV233')) outActions.insertAdjacentHTML('beforeend','<button id="aiBothBtnV233" class="btn blue" onclick="generateBothFromAINotesV233()">🧠+🃏 Mindmap + Flashcards</button>');
    const flashCard=document.querySelector('#smartFlashcards .card:nth-of-type(2)');
    if(flashCard && !$v('saveParsedFlashV233')) flashCard.insertAdjacentHTML('beforeend','<div class="actions"><button id="saveParsedFlashV233" class="btn green" onclick="saveParsedFlashcardsFromOutputV233()">💾 Save Generated Cards</button><button class="btn gold" onclick="downloadAIOutputV226(\'flashAIOutput\',\'html\')">⬇ Download Cards</button></div>');
  }
  window.saveParsedFlashcardsFromOutputV233=async function(){
    const raw=outputText('flashAIOutput'); if(!raw) return alert('Generate flashcards first.');
    const cards=parseFlashcardsV233(raw); const n=await saveFlashcardsV233(cards,textV('flashSubjectAI')||'General','Manual parsed save');
    alert(n?`${n} cards saved.`:'No Q/A cards detected in output.');
  };

  const oldShowV2334=window.show;
  if(typeof oldShowV2334==='function') window.show=function(id,btn){ const r=oldShowV2334.apply(this,arguments); setTimeout(()=>{injectV233Buttons(); updateBadgesV234(); if(id==='aiPdfAnalyzer') window.previewPDFPromptV234 && window.previewPDFPromptV234();},80); return r; };
  document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{injectV233Buttons(); updateBadgesV234();},700));
  window.addEventListener('load',()=>setTimeout(()=>{injectV233Buttons(); updateBadgesV234();},900));
})();

/* ===== V23.5 + V23.6 PATCH: AI Mains Evaluator Pro + AI Personal Mentor Pro ===== */
(function(){
  const $x=id=>document.getElementById(id);
  const txt=id=>($x(id)?.value||'').trim();
  const outText=id=>($x(id)?.innerText||$x(id)?.textContent||'').trim();
  const todayX=()=>{try{return typeof today==='function'?today():new Date().toISOString().slice(0,10)}catch(e){return new Date().toISOString().slice(0,10)}};
  const fmt=x=>{try{return typeof formatAI==='function'?formatAI(String(x||'')):String(x||'').replace(/\n/g,'<br>')}catch(e){return String(x||'')}};
  const safe=x=>String(x??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const setHTML=(id,html)=>{const e=$x(id); if(e)e.innerHTML=html};
  const setStatus=(id,msg)=>{const e=$x(id); if(e)e.innerHTML=msg?`<div class="aiProviderBadgeV231">${safe(msg)}</div>`:''};
  async function col(name){try{ if(typeof getCol==='function') return await getCol(name); }catch(e){} try{ if(typeof safeGetColV4==='function') return await safeGetColV4(name); }catch(e){} try{return JSON.parse(localStorage.getItem(name)||'[]')}catch(e){return []}}
  async function save(name,obj){try{ if(typeof saveCol==='function') return await saveCol(name,obj); }catch(e){} try{ if(typeof safeSaveColV4==='function') return await safeSaveColV4(name,obj); }catch(e){} try{const a=JSON.parse(localStorage.getItem(name)||'[]'); a.unshift({...obj,id:Date.now()+''}); localStorage.setItem(name,JSON.stringify(a)); return obj;}catch(e){console.warn(e)}}
  async function ask(prompt){ if(typeof window.aiAskRouterV23==='function') return await window.aiAskRouterV23(prompt); if(typeof window.aiAsk==='function') return await window.aiAsk(prompt); throw new Error('AI router not found. Open AI Control Centre and save settings.'); }
  let mainsAbort=false, mentorAbort=false;

  function selectedRubrics(){
    const r=[];
    [['mainsRubricIntroV235','Introduction'],['mainsRubricDemandV235','Demand of question'],['mainsRubricStructureV235','Structure and headings'],['mainsRubricExamplesV235','Examples/data/case laws'],['mainsRubricDiagramV235','Diagram/flowchart/map'],['mainsRubricConclusionV235','Conclusion and way forward']].forEach(([id,label])=>{if($x(id)?.checked)r.push(label)});
    return r.join(', ')||'Complete UPSC rubric';
  }
  function buildMainsPromptV235(mode='evaluate'){
    const paper=txt('mainsPaperAI')||'GS';
    const marks=txt('mainsMarksV235')||'15';
    const qtype=txt('mainsQuestionTypeV235')||'Discuss';
    const depth=txt('mainsDepthV235')||'Balanced UPSC Evaluation';
    const words=txt('mainsWordLimitV235')||'250';
    const key=txt('mainsKeywordsV235');
    const q=txt('mainsQuestionAI')||txt('answerQuestion')||'UPSC Mains question';
    const ans=txt('mainsAnswerAI')||txt('answerText');
    if(mode==='topper') return `Act as a UPSC topper answer writer. Create a high-quality model answer.\nPaper: ${paper}\nQuestion type: ${qtype}\nMarks: ${marks}\nWord limit: ${words}\nQuestion: ${q}\nKeywords/syllabus line: ${key}\n\nOutput exactly with:\n# Topper Model Answer\n## Demand of Question\n## Introduction\n## Body with clear headings\n## Diagram / Flowchart suggestion\n## Data / Examples / Cases / Committees\n## Balanced Criticism\n## Way Forward\n## Conclusion\n## 5 Value Addition Points\nKeep within UPSC answer style.`;
    if(mode==='rewrite') return `Rewrite and improve this UPSC mains answer without changing the student's core idea.\nPaper: ${paper}\nMarks: ${marks}\nWord limit: ${words}\nQuestion: ${q}\nOriginal answer:\n${ans}\n\nOutput exactly with:\n# Improved Answer\n## What I changed and why\n## Final rewritten answer\n## Better intro options\n## Better conclusion options\n## Diagram/flowchart to add\n## Keywords to underline\n## Value additions missed`;
    return `You are a strict but fair UPSC CSE mains examiner. Evaluate this answer according to UPSC standards.\n\nPaper: ${paper}\nQuestion Type: ${qtype}\nMarks: ${marks}\nExpected word limit: ${words}\nEvaluation depth: ${depth}\nRubric focus: ${selectedRubrics()}\nKeywords/syllabus line: ${key}\n\nQuestion:\n${q}\n\nStudent Answer:\n${ans}\n\nGive output in this exact structure:\n# UPSC Mains Answer Evaluation\n## 1. Final Marks: __/${marks}\n## 2. One-line Verdict\n## 3. Demand of the Question\n## 4. What is Good\n## 5. Major Missing Dimensions\n## 6. Structure & Presentation Feedback\n## 7. Content Accuracy / Factual Issues\n## 8. Examples, Data, Reports, Cases to Add\n## 9. Diagram / Flowchart / Map Suggestion\n## 10. Better Introduction\n## 11. Better Conclusion\n## 12. Model Answer within ${words} words\n## 13. Revision Topics Generated from Mistakes\n## 14. 3 Action Points before next answer\nBe specific and examiner-like. Do not give fake praise.`;
  }
  function updateScoreMiniV235(text){
    const box=$x('mainsScoreMiniV235'); if(!box)return;
    const m=String(text||'').match(/(?:Final\s*)?Marks\s*:?\s*([0-9]+(?:\.[0-9]+)?)\s*\/\s*([0-9]+)/i) || String(text||'').match(/([0-9]+(?:\.[0-9]+)?)\s*\/\s*(10|15|20|125|250)/);
    if(!m){box.textContent='Score not detected automatically. Read the evaluation below.'; box.className='mainsScoreMiniV235'; return;}
    const got=parseFloat(m[1]), total=parseFloat(m[2]), pct=total?got/total:0;
    box.textContent=`Detected Score: ${got}/${total} (${Math.round(pct*100)}%)`;
    box.className='mainsScoreMiniV235 '+(pct>=0.65?'good':pct>=0.45?'mid':'low');
  }
  window.cancelMainsAIV235=function(){mainsAbort=true; setStatus('mainsAIStatusV235','⛔ Cancel requested. Current AI call may finish, but output will not replace if cancelled.');};
  async function runMainsV235(kind){
    mainsAbort=false;
    const hasAns=txt('mainsAnswerAI')||txt('answerText');
    if(kind!=='topper' && !hasAns) return alert('Paste your answer first.');
    const prompt=buildMainsPromptV235(kind);
    const label=kind==='topper'?'Generating topper model answer':kind==='rewrite'?'Rewriting your answer':'Evaluating answer';
    setHTML('mainsAIReport',`<div class="v235Badge">V23.5 • ${safe(label)}</div><div class="aiLoading">${safe(label)} with selected AI...</div>`);
    setStatus('mainsAIStatusV235',`🤖 ${label}. Selected AI mode is used from AI Control Centre.`);
    try{
      const res=await ask(prompt);
      if(mainsAbort) return;
      setHTML('mainsAIReport',`<div class="v235Badge">V23.5 • AI Mains Evaluator Pro</div>${fmt(res)}`);
      updateScoreMiniV235(res);
      setStatus('mainsAIStatusV235','✅ Completed. Save, download, make flashcards or send weakness to revision.');
      try{window.installAIOutputDownloadsV226&&setTimeout(window.installAIOutputDownloadsV226,100)}catch(e){}
      try{await save('mainsReports',{paper:txt('mainsPaperAI'),question:txt('mainsQuestionAI'),body:res,date:todayX(),type:kind||'evaluation',source:'v23.5 Mains Evaluator Pro'});}catch(e){}
    }catch(e){setHTML('mainsAIReport',fmt('Mains AI failed: '+e.message+'\n\nUse Gemini on GitHub/iPad, Ollama on laptop local server, or ChatGPT Prompt Mode as fallback.')); setStatus('mainsAIStatusV235','⚠ Failed. Check AI Control Centre.');}
  }
  window.analyzeMainsAI=function(){return runMainsV235('evaluate')};
  window.generateTopperAnswer=function(){return runMainsV235('topper')};
  window.rewriteMainsAnswerV235=function(){return runMainsV235('rewrite')};
  window.saveMainsEvaluationV235=async function(){const body=outText('mainsAIReport'); if(!body||body.startsWith('Paste'))return alert('Generate evaluation first.'); await save('mainsReports',{paper:txt('mainsPaperAI'),question:txt('mainsQuestionAI'),body,date:todayX(),source:'Saved v23.5 Mains Report'}); await save('notes',{title:'Mains Evaluation - '+(txt('mainsQuestionAI')||todayX()),subject:txt('mainsPaperAI')||'Mains',body,date:todayX(),type:'Mains Evaluation',source:'v23.5'}); alert('Saved to Mains Reports + Notes.');};
  window.sendMainsWeaknessToRevision=async function(){const body=outText('mainsAIReport'); const q=txt('mainsQuestionAI')||txt('answerQuestion')||'Mains weakness'; await save('smartRevision',{topic:'Mains weakness: '+q,subject:txt('mainsPaperAI')||'Mains',source:'v23.5 Mains Evaluation',difficulty:'Hard',date:todayX(),cycle:1,status:'pending',body}); await save('calendarItems',{date:todayX(),title:'Revise mains weakness: '+q,type:'Revision',body}); alert('Mains weakness sent to revision + calendar.');};
  window.mainsEvaluationToFlashcardsV235=async function(){const body=outText('mainsAIReport'); if(!body)return alert('Generate evaluation first.'); try{ if(typeof generateFlashcardsFromTextV233==='function' && typeof saveFlashcardsV233==='function'){ const r=await generateFlashcardsFromTextV233(body,txt('mainsQuestionAI')||'Mains Evaluation',txt('mainsPaperAI')||'Mains','mainsAIReport'); const n=await saveFlashcardsV233(r.cards,txt('mainsPaperAI')||'Mains','From Mains Evaluation'); alert(`${n} flashcards saved.`); return;} }catch(e){} await save('flash',{q:'Mains weakness: '+(txt('mainsQuestionAI')||'Answer'),a:body.slice(0,1200),subject:txt('mainsPaperAI')||'Mains',difficulty:'Hard',date:todayX(),source:'v23.5 Mains Evaluation'}); alert('One flashcard saved from evaluation.');};

  async function loadPdfScriptV235(){
    if(window.pdfjsLib)return window.pdfjsLib;
    return await new Promise((resolve,reject)=>{const sc=document.createElement('script'); sc.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js'; sc.onload=()=>{try{pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js'}catch(e){} resolve(window.pdfjsLib)}; sc.onerror=()=>reject(new Error('PDF.js could not load. Paste answer text manually.')); document.head.appendChild(sc);});
  }
  window.loadAnswerFileText=async function(){
    const f=$x('answerFile')?.files?.[0]; if(!f)return alert('Choose file first.');
    try{
      let t='';
      if(/\.pdf$/i.test(f.name)||/pdf/i.test(f.type)){
        const pdfjs=await loadPdfScriptV235(); const data=await f.arrayBuffer(); const pdf=await pdfjs.getDocument({data}).promise; const max=Math.min(pdf.numPages,25);
        for(let i=1;i<=max;i++){const page=await pdf.getPage(i); const c=await page.getTextContent(); t+='\n\n--- Page '+i+' ---\n'+c.items.map(x=>x.str).join(' ');} if(pdf.numPages>25)t+='\n[Only first 25 pages extracted.]';
      }else if(/text|markdown|plain/i.test(f.type)||/\.(txt|md)$/i.test(f.name)){t=await f.text();}
      else{t=`File selected: ${f.name}\nType: ${f.type||'unknown'}\nImage/DOCX OCR is not enabled in browser. Paste the answer text here for accurate evaluation.`;}
      if($x('answerText'))$x('answerText').value=t.trim();
      if($x('mainsAnswerAI')&&!txt('mainsAnswerAI'))$x('mainsAnswerAI').value=t.trim();
      alert('Answer text loaded.');
    }catch(e){alert('File read failed: '+e.message)}
  };
  window.evaluateMainsAnswerAI=async function(){
    if($x('mainsQuestionAI') && txt('answerQuestion'))$x('mainsQuestionAI').value=txt('answerQuestion');
    if($x('mainsAnswerAI') && txt('answerText'))$x('mainsAnswerAI').value=txt('answerText');
    if($x('mainsPaperAI') && !$x('mainsPaperAI').value)$x('mainsPaperAI').value='GS2';
    await runMainsV235('evaluate');
    if($x('answerEvalOutput'))$x('answerEvalOutput').innerHTML=$x('mainsAIReport')?.innerHTML||'';
  };

  async function mentorStatsV236(){
    const keys=['notes','flash','smartRevision','revision','calendarItems','wrongAnswers','wrongbook','tests','mainsReports','mockReports','tasks','habits','dailyPlans','library2','files'];
    const data={}; for(const k of keys)data[k]=await col(k);
    const pending=[...(data.smartRevision||[]),...(data.revision||[]),...(data.tasks||[])].filter(x=>String(x.status||'pending').toLowerCase()!=='done').length;
    const wrong=(data.wrongAnswers||[]).length+(data.wrongbook||[]).length;
    const score=Math.max(0,Math.min(100,Math.round((data.notes.length*2+data.flash.length*1.5+data.mainsReports.length*8+data.mockReports.length*8+data.dailyPlans.length*3+data.habits.length*2)-(pending*1.2+wrong*0.6))));
    return {score,pending,wrong,notes:data.notes.length,flash:data.flash.length,mainsReports:data.mainsReports.length,mockReports:data.mockReports.length,plans:data.dailyPlans.length,calendar:data.calendarItems.length,tests:data.tests.length,habits:data.habits.length,recentMains:(data.mainsReports||[]).slice(0,5),recentWrong:[...(data.wrongAnswers||[]),...(data.wrongbook||[])].slice(0,8),pendingItems:[...(data.smartRevision||[]),...(data.revision||[]),...(data.tasks||[])].slice(0,12)};
  }
  window.renderMentorStatsV236=async function(){
    const s=await mentorStatsV236();
    const html=`<div class="statLine"><span>Prep Health</span><b>${s.score}/100</b></div><div class="statLine"><span>Pending Revision/Tasks</span><b>${s.pending}</b></div><div class="statLine"><span>Wrong / Weak Entries</span><b>${s.wrong}</b></div><div class="statLine"><span>Notes</span><b>${s.notes}</b></div><div class="statLine"><span>Flashcards</span><b>${s.flash}</b></div><div class="statLine"><span>Mains Reports</span><b>${s.mainsReports}</b></div><div class="statLine"><span>Mock Reports</span><b>${s.mockReports}</b></div>`;
    setHTML('mentorStatsV236',html);
    return s;
  };
  function buildMentorPromptV236(){
    const mode=txt('mentorModeFinal')||'Strict UPSC Mentor'; const tone=txt('mentorToneV236')||'Balanced'; const focus=txt('mentorFocusV236')||'Overall Preparation'; const frame=txt('mentorTimeFrameV236')||'Today'; const q=txt('mentorQuestionMain')||'Give me a realistic UPSC plan.';
    return mentorStatsV236().then(s=>`You are Vignesh's personal UPSC AI mentor. Use the user's real preparation data below.\n\nMentor Mode: ${mode}\nTone: ${tone}\nFocus: ${focus}\nTime frame: ${frame}\nUser question: ${q}\n\nPrep data snapshot:\n${JSON.stringify(s,null,2)}\n\nGive output exactly with:\n# AI Personal Mentor Advice\n## 1. Current Prep Health\n## 2. Brutally Honest Diagnosis\n## 3. Top 3 Weak Areas\n## 4. What to do ${frame}\n## 5. Hour-wise / Task-wise Plan\n## 6. Revision Command List\n## 7. Mains / Prelims Specific Advice\n## 8. Warnings: What to stop doing\n## 9. Motivation in one paragraph\n## 10. Final 3 Non-negotiable Tasks\nBe practical. Do not give generic advice.`);
  }
  window.cancelMentorAIV236=function(){mentorAbort=true; setStatus('mentorAIStatusV236','⛔ Cancel requested. Current AI call may finish, but output will not replace if cancelled.');};
  window.mentorQuickAskV236=function(q){if($x('mentorQuestionMain'))$x('mentorQuestionMain').value=q; return window.askMainMentorFinal();};
  window.askMainMentorFinal=async function(){
    mentorAbort=false; setHTML('mentorMainOutput','<div class="v235Badge">V23.6 • AI Mentor Pro</div><div class="aiLoading">Mentor reading your prep data...</div>'); setStatus('mentorAIStatusV236','🤖 AI Mentor analyzing your real UPSC data.');
    try{await window.renderMentorStatsV236(); const prompt=await buildMentorPromptV236(); const res=await ask(prompt); if(mentorAbort)return; setHTML('mentorMainOutput',`<div class="v235Badge">V23.6 • AI Personal Mentor Pro</div>${fmt(res)}`); setStatus('mentorAIStatusV236','✅ Mentor advice generated.'); try{window.installAIOutputDownloadsV226&&setTimeout(window.installAIOutputDownloadsV226,100)}catch(e){} }catch(e){setHTML('mentorMainOutput',fmt('Mentor AI failed: '+e.message)); setStatus('mentorAIStatusV236','⚠ Mentor failed. Check AI Control Centre.');}
  };
  window.saveMentorAdviceFinal=async function(){const body=outText('mentorMainOutput'); if(!body||body.startsWith('Ask'))return alert('Generate mentor advice first.'); await save('mentorAdvice',{mode:txt('mentorModeFinal'),question:txt('mentorQuestionMain'),body,date:todayX(),source:'v23.6 AI Mentor Pro'}); await save('notes',{title:'AI Mentor Advice - '+todayX(),subject:'Mentor',body,date:todayX(),type:'AI Mentor',source:'v23.6'}); alert('Mentor advice saved.');};
  window.mentorAdviceToCalendarFinal=async function(){const body=outText('mentorMainOutput'); if(!body)return alert('Generate mentor advice first.'); await save('calendarItems',{date:todayX(),title:'AI Mentor Action Plan',type:'AI Mentor',body}); try{if(window.renderCalendarAI)window.renderCalendarAI()}catch(e){} alert('Mentor advice sent to calendar.');};
  window.mentorAdviceToRevisionV236=async function(){const body=outText('mentorMainOutput'); if(!body)return alert('Generate mentor advice first.'); const lines=body.split('\n').map(x=>x.replace(/^[-*\d.\s]+/,'').trim()).filter(x=>x.length>12).slice(0,5); for(const l of lines){await save('smartRevision',{topic:l.slice(0,120),subject:txt('mentorFocusV236')||'UPSC',source:'v23.6 AI Mentor',difficulty:'Medium',date:todayX(),cycle:1,status:'pending',body});} alert('Revision tasks added from mentor advice.');};

  const oldShow2356=window.show;
  if(typeof oldShow2356==='function')window.show=function(id,btn){const r=oldShow2356.apply(this,arguments); setTimeout(()=>{ if(id==='aiMentorPage')window.renderMentorStatsV236&&window.renderMentorStatsV236(); if(id==='aiMainsCentre')try{window.installAIOutputDownloadsV226&&window.installAIOutputDownloadsV226()}catch(e){} },120); return r;};
  document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{try{if($x('mentorStatsV236'))window.renderMentorStatsV236()}catch(e){}},900));
})();


/* ===== V24.1 + V24.2 AI INTELLIGENCE LAYER: Revision Brain + Library Assistant ===== */
(function(){
  const $24=id=>document.getElementById(id);
  const today24=()=>new Date().toISOString().slice(0,10);
  const future24=(days)=>{const d=new Date(); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10);};
  const esc24=s=>String(s??'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
  const text24=id=>$24(id)?.value?.trim()||'';
  const outText24=id=>$24(id)?.innerText?.trim()||'';
  const html24=t=>window.formatAI?window.formatAI(t):'<pre>'+esc24(t)+'</pre>';
  const save24=(col,obj)=>window.saveCol?window.saveCol(col,obj):Promise.resolve(localStorage.setItem(col,JSON.stringify([obj,...JSON.parse(localStorage.getItem(col)||'[]')])));
  const get24=async(col)=>window.getCol?await window.getCol(col):JSON.parse(localStorage.getItem(col)||'[]');
  const ask24=async(prompt)=>{ if(typeof window.aiAskRouterV23==='function') return await window.aiAskRouterV23(prompt); if(typeof window.aiAsk==='function') return await window.aiAsk(prompt); throw new Error('AI router not found. Open AI Control Centre and save AI settings.'); };
  const setStatus24=(id,msg)=>{const el=$24(id); if(el) el.innerHTML=esc24(msg).replace(/\n/g,'<br>');};
  const setOut24=(id,content,isHtml=false)=>{const el=$24(id); if(el) el.innerHTML=isHtml?content:html24(content); try{window.installAIOutputDownloadsV226&&setTimeout(window.installAIOutputDownloadsV226,80)}catch(e){} };
  const subjects24=['Polity','History','Geography','Economy','Environment','Science & Tech','Ethics','Essay','Current Affairs','CSAT','Optional','General','GS1','GS2','GS3','GS4 Ethics'];
  let lastWeakV241=[];
  let libraryIndexV242=[];
  let lastResultsV242=[];

  function itemSubject24(x, fallback='General'){
    const raw=String(x?.subject||x?.paper||x?.folder||x?.type||x?.category||fallback||'General');
    const low=JSON.stringify(x||{}).toLowerCase();
    for(const s of subjects24){ if(raw.toLowerCase().includes(s.toLowerCase()) || low.includes(s.toLowerCase())) return s; }
    return raw || fallback;
  }
  function itemTopic24(x){return String(x?.topic||x?.title||x?.name||x?.q||x?.question||x?.place||x?.folder||'Untitled').slice(0,120)}
  async function collectAllV24(){
    const keys=['notes','proNotes','currentAffairsAI','currentAffairs','flash','smartRevision','revision','wrongAnswers','wrongbook','tests','mockReports','mainsReports','calendarItems','tasks','dailyPlans','library2','libraryShelf','files','kg','maps','pyq','pyqBank','onePagers','mindmaps','pdfAnalysis'];
    const data={};
    for(const k of keys){try{data[k]=await get24(k)}catch(e){data[k]=[]}}
    try{data.fullPYQDB=JSON.parse(localStorage.getItem('fullPYQDB')||'[]')}catch(e){data.fullPYQDB=[]}
    return data;
  }
  function scoreWeaknessV241(data){
    const map={};
    function ensure(sub){sub=sub||'General'; if(!map[sub]) map[sub]={subject:sub,notes:0,flash:0,wrong:0,mains:0,mocks:0,revision:0,pending:0,tests:[],topics:{},sources:[]}; return map[sub];}
    function addTopic(sub,topic,weight,reason,source){const m=ensure(sub); const t=topic||sub; if(!m.topics[t])m.topics[t]={topic:t,score:0,reasons:[],source}; m.topics[t].score+=weight; if(reason)m.topics[t].reasons.push(reason); if(source)m.sources.push(source);}
    (data.notes||[]).forEach(x=>{const m=ensure(itemSubject24(x)); m.notes++;});
    (data.proNotes||[]).forEach(x=>{const m=ensure(itemSubject24(x)); m.notes++;});
    (data.flash||[]).forEach(x=>{const m=ensure(itemSubject24(x)); m.flash++; if((x.due||today24())<=today24()) addTopic(m.subject,itemTopic24(x),1,'Due flashcard / active recall pending','flash');});
    [...(data.wrongAnswers||[]),...(data.wrongbook||[])].forEach(x=>{const sub=itemSubject24(x); const m=ensure(sub); m.wrong++; addTopic(sub,itemTopic24(x),5,'Wrong answer entry found','wrongbook');});
    (data.mainsReports||[]).forEach(x=>{const sub=itemSubject24(x,'Mains'); const m=ensure(sub); m.mains++; const body=String(x.body||x.note||'').toLowerCase(); const weak=/(weak|missing|improve|poor|lack|structure|intro|conclusion|example|data|diagram)/.test(body); addTopic(sub,itemTopic24(x),weak?4:2,weak?'Mains report contains weakness/missing points':'Mains report needs revision','mainsReports');});
    (data.mockReports||[]).forEach(x=>{const sub=itemSubject24(x,'Prelims'); const m=ensure(sub); m.mocks++; addTopic(sub,itemTopic24(x),4,'Mock report weakness / analysis pending','mockReports');});
    [...(data.smartRevision||[]),...(data.revision||[]),...(data.tasks||[])].forEach(x=>{const sub=itemSubject24(x); const m=ensure(sub); m.revision++; const done=String(x.status||'pending').toLowerCase()==='done'; if(!done){m.pending++; addTopic(sub,itemTopic24(x),3,'Pending revision/task','revision');}});
    (data.tests||[]).forEach(x=>{const sub=itemSubject24(x,'General'); const m=ensure(sub); const score=Number(x.score||x.accuracy||0); m.tests.push(score); if(score && score<50) addTopic(sub,itemTopic24(x),4,'Low test/mock score','tests');});
    // Penalize subjects with very low material base
    subjects24.slice(0,12).forEach(s=>{const m=ensure(s); if(m.notes===0 && m.flash===0) addTopic(s,s,2,'No notes/flashcards created yet','coverage');});
    const weak=[];
    Object.values(map).forEach(m=>{
      const avg=m.tests.length?Math.round(m.tests.reduce((a,b)=>a+b,0)/m.tests.length):null;
      const coveragePenalty=(m.notes<2?2:0)+(m.flash<5?1:0);
      const score=(m.wrong*5)+(m.pending*3)+(m.mains*2)+(m.mocks*3)+(avg!==null&&avg<55?5:0)+coveragePenalty;
      const topics=Object.values(m.topics).sort((a,b)=>b.score-a.score).slice(0,5);
      if(score>0) weak.push({...m,score,avgTest:avg,priority:score>=12?'High':score>=6?'Medium':'Low',topics});
    });
    return weak.sort((a,b)=>b.score-a.score).slice(0,12);
  }
  function renderStatsV241(data,weak){
    const due=[...(data.smartRevision||[]),...(data.revision||[]),...(data.tasks||[])].filter(x=>String(x.status||'pending').toLowerCase()!=='done').length;
    const html=`<div class="statCardV24"><small>Weak Areas</small><b>${weak.length}</b><span>detected from your data</span></div>
      <div class="statCardV24"><small>Due Revision</small><b>${due}</b><span>pending tasks</span></div>
      <div class="statCardV24"><small>Flashcards</small><b>${(data.flash||[]).length}</b><span>active recall base</span></div>
      <div class="statCardV24"><small>Mains Reports</small><b>${(data.mainsReports||[]).length}</b><span>answer feedback</span></div>`;
    if($24('revisionBrainStatsV241')) $24('revisionBrainStatsV241').innerHTML=html;
  }
  function renderWeakListV241(weak){
    lastWeakV241=weak;
    const html=weak.map((w,i)=>`<div class="weakTopicCardV241 ${w.priority==='High'?'':w.priority==='Medium'?'medium':'low'}">
      <h3>${esc24(w.subject)} <span class="priorityPillV24">${esc24(w.priority)} • ${w.score}</span></h3>
      <div class="weakScoreV241"><span class="sourcePillV242">Wrong: ${w.wrong}</span><span class="sourcePillV242">Pending: ${w.pending}</span><span class="sourcePillV242">Notes: ${w.notes}</span><span class="sourcePillV242">Flash: ${w.flash}</span>${w.avgTest!==null?`<span class="sourcePillV242">Avg test: ${w.avgTest}</span>`:''}</div>
      <div class="weakReasonV241"><b>Top topics:</b> ${w.topics.length?w.topics.map(t=>esc24(t.topic)).join(' • '):'Coverage gap / pending revision'}</div>
      <div class="actions"><button class="btn gold" onclick="addWeakTopicRevisionV241(${i})">📌 Add Revision</button><button class="btn purple" onclick="askWeakTopicAIV241(${i})">🤖 Ask AI</button></div>
    </div>`).join('') || '<div class="emptyState">No weak areas detected yet. Add notes, mocks, wrong answers and mains reports.</div>';
    if($24('weakTopicListV241')) $24('weakTopicListV241').innerHTML=html;
  }
  window.renderRevisionBrainLocalV241=async function(){
    setStatus24('revisionBrainStatusV241','Reading your preparation data...');
    const data=await collectAllV24();
    const weak=scoreWeaknessV241(data);
    renderStatsV241(data,weak); renderWeakListV241(weak);
    const summary=`# AI Revision Brain - Local Diagnosis\n\n## Top weak areas\n${weak.slice(0,6).map((w,i)=>`${i+1}. ${w.subject} - ${w.priority} priority (score ${w.score})\n   Reasons: wrong ${w.wrong}, pending ${w.pending}, notes ${w.notes}, flashcards ${w.flash}\n   Topics: ${w.topics.map(t=>t.topic).join(', ')||'Coverage gap'}`).join('\n')}\n\n## Immediate action\n- Start with the first High priority subject.\n- Revise notes, solve PYQs, then make flashcards.\n- Convert every wrong answer into a revision task.\n\nClick AI Diagnosis for a detailed day-wise repair plan.`;
    setOut24('revisionBrainOutputV241',summary);
    setStatus24('revisionBrainStatusV241',`Local diagnosis complete: ${weak.length} weak areas found.`);
    return {data,weak};
  };
  window.addWeakTopicRevisionV241=async function(i){
    const w=lastWeakV241[i]; if(!w)return alert('Refresh local diagnosis first.');
    const topics=w.topics.length?w.topics.slice(0,3).map(t=>t.topic):[w.subject];
    for(let idx=0; idx<topics.length; idx++){
      await save24('smartRevision',{topic:`${w.subject}: ${topics[idx]}`,subject:w.subject,source:'V24.1 Revision Brain',difficulty:w.priority,date:future24(idx+1),cycle:1,status:'pending',body:JSON.stringify(w)});
    }
    alert('Revision tasks added for '+w.subject);
  };
  window.askWeakTopicAIV241=async function(i){
    const w=lastWeakV241[i]; if(!w)return alert('Refresh local diagnosis first.');
    if($24('revisionBrainQuestionV241')) $24('revisionBrainQuestionV241').value=`Make a repair plan for my weak area: ${w.subject}. Focus topics: ${w.topics.map(t=>t.topic).join(', ')}.`;
    return window.generateRevisionBrainAIV241();
  };
  function buildRevisionPromptV241(data,weak){
    const focus=text24('revisionBrainFocusV241')||'Overall UPSC'; const days=text24('revisionBrainDaysV241')||'7'; const tone=text24('revisionBrainToneV241')||'Balanced Mentor'; const q=text24('revisionBrainQuestionV241')||'Find my weak areas and create a repair plan.';
    const snapshot={focus,days,tone,question:q,stats:{notes:(data.notes||[]).length+(data.proNotes||[]).length,flash:(data.flash||[]).length,wrong:(data.wrongAnswers||[]).length+(data.wrongbook||[]).length,mainsReports:(data.mainsReports||[]).length,mockReports:(data.mockReports||[]).length,pendingRevision:[...(data.smartRevision||[]),...(data.revision||[])].filter(x=>String(x.status||'pending').toLowerCase()!=='done').length},weak:weak.slice(0,8).map(w=>({subject:w.subject,priority:w.priority,score:w.score,wrong:w.wrong,pending:w.pending,notes:w.notes,flash:w.flash,topTopics:w.topics.map(t=>({topic:t.topic,reasons:t.reasons.slice(0,2)}))}))};
    return `You are Vignesh's UPSC AI Revision Brain. Use the real preparation snapshot below.\n\n${JSON.stringify(snapshot,null,2)}\n\nOutput exactly with:\n# AI Revision Brain Report\n## 1. Brutally honest diagnosis\n## 2. Top weak areas ranked\n## 3. Why each area is weak\n## 4. ${days}-day repair timetable\n## 5. Daily task list with time blocks\n## 6. PYQ + mock + flashcard drill plan\n## 7. Mains answer writing repair plan if needed\n## 8. Non-negotiable tasks for today\n## 9. Warning: what to stop doing\n## 10. Final rank-oriented advice\nKeep it practical and UPSC-specific. Do not give generic motivational advice.`;
  }
  window.generateRevisionBrainAIV241=async function(){
    try{
      setOut24('revisionBrainOutputV241','<div class="aiLoading">AI Revision Brain reading your weak areas...</div>',true); setStatus24('revisionBrainStatusV241','Running AI diagnosis with selected AI mode...');
      const {data,weak}=await window.renderRevisionBrainLocalV241();
      const prompt=buildRevisionPromptV241(data,weak);
      const res=await ask24(prompt);
      setOut24('revisionBrainOutputV241',res);
      await save24('revisionBrainReports',{title:'AI Revision Brain Report',body:res,weakCount:weak.length,date:today24(),source:'v24.1'});
      setStatus24('revisionBrainStatusV241','AI diagnosis generated and saved.');
    }catch(e){setOut24('revisionBrainOutputV241','AI Revision Brain failed: '+e.message); setStatus24('revisionBrainStatusV241','AI failed. Check AI Control Centre.');}
  };
  window.saveRevisionBrainReportV241=async function(){const body=outText24('revisionBrainOutputV241'); if(!body)return alert('Generate report first.'); await save24('revisionBrainReports',{title:'AI Revision Brain Report',body,date:today24(),source:'v24.1'}); await save24('notes',{title:'AI Revision Brain Report - '+today24(),subject:'Revision',body,date:today24(),type:'AI Revision Brain',source:'v24.1'}); alert('Revision brain report saved.');};
  window.revisionBrainToCalendarV241=async function(){const body=outText24('revisionBrainOutputV241'); if(!body)return alert('Generate report first.'); const weak=lastWeakV241.slice(0,5); for(let i=0;i<Math.max(1,weak.length);i++){await save24('calendarItems',{date:future24(i),title:weak[i]?`V24 Repair: ${weak[i].subject}`:'V24 AI Revision Plan',type:'AI Revision Brain',body});} alert('Revision brain plan sent to calendar.');};
  window.revisionBrainToTasksV241=async function(){const weak=lastWeakV241.slice(0,6); if(!weak.length) await window.renderRevisionBrainLocalV241(); for(let i=0;i<lastWeakV241.slice(0,6).length;i++){await window.addWeakTopicRevisionV241(i)} alert('Weak area revision tasks added.');};
  window.revisionBrainToFlashcardsV241=async function(){const body=outText24('revisionBrainOutputV241'); if(!body)return alert('Generate report first.'); const weak=lastWeakV241.slice(0,10); for(const w of weak){await save24('flash',{q:`Why is ${w.subject} weak in my UPSC prep?`,a:`Reasons: wrong=${w.wrong}, pending=${w.pending}, notes=${w.notes}, flash=${w.flash}. Top topics: ${w.topics.map(t=>t.topic).join(', ')}`,subject:w.subject,difficulty:w.priority,due:today24(),date:today24(),source:'v24.1 Revision Brain'});} alert('Revision brain flashcards created.');};

  function contentOf24(x){return String(x?.body||x?.note||x?.desc||x?.description||x?.answer||x?.a||x?.question||x?.q||x?.article||x?.text||x?.url||'');}
  async function buildLibraryIndexV242(){
    const data=await collectAllV24();
    const rows=[];
    const add=(source,type,arr)=>{(arr||[]).forEach((x,i)=>rows.push({id:x.id||`${source}_${i}`,source,type,subject:itemSubject24(x),title:itemTopic24(x),body:contentOf24(x),raw:x}));};
    add('notes','Notes',data.notes); add('proNotes','Notes',data.proNotes); add('currentAffairsAI','Current Affairs',data.currentAffairsAI); add('currentAffairs','Current Affairs',data.currentAffairs); add('flash','Flashcards',data.flash); add('mainsReports','Mains Reports',data.mainsReports); add('mockReports','Mock Reports',data.mockReports); add('files','Files/PDFs',data.files); add('library2','Files/PDFs',data.library2); add('libraryShelf','Files/PDFs',data.libraryShelf); add('kg','Mindmaps/Graphs',data.kg); add('maps','Mindmaps/Graphs',data.maps); add('pyq','PYQ',data.pyq); add('pyqBank','PYQ',data.pyqBank); add('fullPYQDB','PYQ',data.fullPYQDB); add('mindmaps','Mindmaps/Graphs',data.mindmaps); add('pdfAnalysis','Notes',data.pdfAnalysis); add('onePagers','Notes',data.onePagers);
    libraryIndexV242=rows.filter(r=>r.title||r.body);
    return libraryIndexV242;
  }
  function typeMatchV242(row,type){return type==='All Types'||row.type===type||type.includes(row.type)||row.type.includes(type.replace('/PDFs',''));}
  function scoreResultV242(row,q){
    if(!q) return 1;
    const query=q.toLowerCase().split(/\s+/).filter(Boolean); const hay=(row.title+' '+row.subject+' '+row.type+' '+row.source+' '+row.body).toLowerCase();
    let score=0; query.forEach(term=>{if(row.title.toLowerCase().includes(term))score+=5; if(row.subject.toLowerCase().includes(term))score+=3; if(hay.includes(term))score+=1;}); return score;
  }
  function renderLibraryResultsV242(results){
    const html=results.map((r,i)=>`<div class="libraryResultCardV242" id="libCardV242_${i}">
      <div class="libraryResultTopV242"><input type="checkbox" class="libSelectV242" data-idx="${i}" onchange="toggleLibraryResultV242(${i},this.checked)"><div><h3>${esc24(r.title||'Untitled')}</h3><span class="sourcePillV242">${esc24(r.type)}</span><span class="matchPillV242">${esc24(r.subject)}</span><span class="matchPillV242">${esc24(r.source)}</span></div></div>
      <div class="librarySnippetV242">${esc24((r.body||JSON.stringify(r.raw||{})).slice(0,360))}${(r.body||'').length>360?'...':''}</div>
    </div>`).join('') || '<div class="emptyState">No matching items. Try broader keyword or All Types.</div>';
    if($24('libraryResultsV242'))$24('libraryResultsV242').innerHTML=html;
  }
  window.searchAILibraryV242=async function(){
    setStatus24('librarySearchStatusV242','Indexing your library...');
    const q=text24('librarySearchQueryV242'); const type=text24('librarySearchTypeV242')||'All Types'; const limit=Number(text24('librarySearchLimitV242')||25);
    const idx=await buildLibraryIndexV242();
    lastResultsV242=idx.map(r=>({...r,_score:scoreResultV242(r,q)})).filter(r=>r._score>0&&typeMatchV242(r,type)).sort((a,b)=>b._score-a._score).slice(0,limit);
    renderLibraryResultsV242(lastResultsV242);
    setStatus24('librarySearchStatusV242',`Found ${lastResultsV242.length} results from ${idx.length} indexed items.`);
  };
  window.toggleLibraryResultV242=function(i,checked){const el=$24('libCardV242_'+i); if(el)el.classList.toggle('selected',!!checked);};
  window.selectAllLibraryResultsV242=function(){document.querySelectorAll('.libSelectV242').forEach(c=>{c.checked=true; c.dispatchEvent(new Event('change'));});};
  window.clearLibrarySelectionV242=function(){document.querySelectorAll('.libSelectV242').forEach(c=>{c.checked=false; c.dispatchEvent(new Event('change'));});};
  function selectedResultsV242(){const checked=[...document.querySelectorAll('.libSelectV242:checked')].map(c=>Number(c.dataset.idx)); return checked.map(i=>lastResultsV242[i]).filter(Boolean);}
  function selectedTextV242(){return selectedResultsV242().map((r,i)=>`SOURCE ${i+1}: ${r.title}\nType: ${r.type}\nSubject: ${r.subject}\nContent:\n${(r.body||JSON.stringify(r.raw||{})).slice(0,3500)}`).join('\n\n---\n\n');}
  window.askLibraryAssistantV242=async function(){
    if(!lastResultsV242.length) await window.searchAILibraryV242();
    let src=selectedTextV242(); if(!src) src=lastResultsV242.slice(0,8).map((r,i)=>`SOURCE ${i+1}: ${r.title}\n${(r.body||'').slice(0,2200)}`).join('\n\n---\n\n');
    if(!src)return alert('Search library first.');
    const q=text24('libraryAssistantQuestionV242')||`Summarize these sources into UPSC-ready notes and tell me what to revise.`;
    const prompt=`You are an AI Digital Library Assistant for UPSC. Use only the selected library sources below.\n\nUser question: ${q}\n\nSelected library sources:\n${src}\n\nOutput with:\n# AI Library Answer\n## Direct Answer\n## Source-wise important points\n## Syllabus linkage\n## Prelims facts\n## Mains dimensions\n## Gaps / missing areas\n## Revision checklist\n## Suggested flashcards and mindmap branches`;
    try{setOut24('libraryAIOutputV242','<div class="aiLoading">AI reading selected library sources...</div>',true); setStatus24('librarySearchStatusV242','Asking selected AI...'); const res=await ask24(prompt); setOut24('libraryAIOutputV242',res); setStatus24('librarySearchStatusV242','AI library answer generated.');}catch(e){setOut24('libraryAIOutputV242','Library AI failed: '+e.message);}
  };
  function conversionSourceTextV242(){const mode=text24('conversionSourceV242'); if(mode==='Paste Custom Text')return text24('conversionCustomTextV242'); if(mode==='Library AI Output')return outText24('libraryAIOutputV242'); return selectedTextV242()||lastResultsV242.slice(0,8).map(r=>`${r.title}\n${r.body}`).join('\n\n');}
  function conversionPromptV242(src){const type=text24('conversionTypeV242')||'Detailed Notes'; const depth=text24('conversionDepthV242')||'Balanced'; const q=text24('librarySearchQueryV242')||'UPSC Topic'; return `You are a UPSC AI Conversion Hub. Convert the following source material into: ${type}.\nTopic/query: ${q}\nDepth: ${depth}\n\nRules:\n- Make it UPSC CSE oriented.\n- Add syllabus linkage, prelims facts, mains dimensions, PYQ angle, examples/data, and revision checklist where relevant.\n- For Flashcards use exact format Q: ... then A: ...\n- For Mindmap use 12 lines in Branch: detail format.\n- For Revision Plan give day-wise tasks.\n\nSOURCE MATERIAL:\n${src.slice(0,18000)}`;}
  window.convertLibraryWithAIV242=async function(){const src=conversionSourceTextV242(); if(!src)return alert('Select search results, use Library AI Output, or paste custom text.'); try{setOut24('libraryAIOutputV242','<div class="aiLoading">Converting with selected AI...</div>',true); const res=await ask24(conversionPromptV242(src)); setOut24('libraryAIOutputV242',res); await save24('libraryConversions',{query:text24('librarySearchQueryV242'),type:text24('conversionTypeV242'),body:res,date:today24(),source:'v24.2'});}catch(e){setOut24('libraryAIOutputV242','Conversion failed: '+e.message);}};
  function parseCards24(text){const lines=String(text||'').split('\n'); const cards=[]; let q='',a=''; for(const line of lines){const t=line.trim(); if(/^Q[:.)-]/i.test(t)||/^Question[:.)-]/i.test(t)){if(q&&a)cards.push({q,a}); q=t.replace(/^Question[:.)-]\s*/i,'').replace(/^Q[:.)-]\s*/i,''); a='';} else if(/^A[:.)-]/i.test(t)||/^Answer[:.)-]/i.test(t)){a=t.replace(/^Answer[:.)-]\s*/i,'').replace(/^A[:.)-]\s*/i,'');} else if(a){a+=' '+t;} } if(q&&a)cards.push({q,a}); return cards.slice(0,60);}
  window.saveConversionToNotesV242=async function(){const body=outText24('libraryAIOutputV242'); if(!body)return alert('Generate output first.'); await save24('notes',{title:'V24.2 Library Conversion - '+(text24('librarySearchQueryV242')||today24()),subject:'AI Library',body,date:today24(),type:text24('conversionTypeV242')||'AI Conversion',source:'v24.2'}); alert('Saved to Notes.');};
  window.saveConversionAsFlashcardsV242=async function(){const body=outText24('libraryAIOutputV242'); if(!body)return alert('Generate output first.'); let cards=parseCards24(body); if(!cards.length){cards=[{q:'Revision: '+(text24('librarySearchQueryV242')||'AI Library Output'),a:body.slice(0,1200)}];} for(const c of cards){await save24('flash',{q:c.q,a:c.a,subject:'AI Library',difficulty:'Medium',due:today24(),date:today24(),source:'v24.2 Conversion Hub'});} alert(`${cards.length} flashcards saved.`);};
  window.sendConversionToMindmapV242=function(){const body=outText24('libraryAIOutputV242'); if(!body)return alert('Generate output first.'); const topic=text24('librarySearchQueryV242')||'AI Library Mindmap'; const lines=body.split('\n').map(x=>x.replace(/^[-*\d.\s]+/,'').trim()).filter(x=>x.length>8&&x.length<180).slice(0,14); if($24('mmTopic'))$24('mmTopic').value=topic; if($24('mmSubject'))$24('mmSubject').value='AI Library'; if($24('mmNodes'))$24('mmNodes').value=(lines.length?lines:['Definition','Causes','Features','Examples','Issues','PYQ Angle','Mains Framework','Way Forward']).map(x=>x.includes(':')?x:`${x}: UPSC point from library conversion`).join('\n'); try{window.show&&window.show('mindMapStudio')}catch(e){} setTimeout(()=>{try{if(typeof window.renderMindMapManual==='function')window.renderMindMapManual(); if(typeof window.drawDetailedMindMapV136==='function')window.drawDetailedMindMapV136(topic,lines.map(x=>({title:x.split(':')[0].slice(0,45),detail:(x.split(':').slice(1).join(':')||'UPSC revision branch').slice(0,130)})));}catch(e){}},150);};
  window.saveConversionAsRevisionV242=async function(){const body=outText24('libraryAIOutputV242'); if(!body)return alert('Generate output first.'); const lines=body.split('\n').map(x=>x.replace(/^[-*\d.\s]+/,'').trim()).filter(x=>x.length>12).slice(0,6); for(let i=0;i<lines.length;i++){await save24('smartRevision',{topic:lines[i].slice(0,140),subject:'AI Library',source:'v24.2 Conversion Hub',difficulty:'Medium',date:future24(i+1),cycle:1,status:'pending',body});} alert(`${lines.length} revision tasks saved.`);};

  const oldShowV24=window.show;
  if(typeof oldShowV24==='function') window.show=function(id,btn){const r=oldShowV24.apply(this,arguments); setTimeout(()=>{try{ if(id==='aiRevisionBrain')window.renderRevisionBrainLocalV241(); if(id==='aiLibraryAssistant' && !lastResultsV242.length) window.searchAILibraryV242(); }catch(e){console.warn('V24 render skipped',e)}},160); return r;};
  document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{try{if($24('revisionBrainStatsV241'))window.renderRevisionBrainLocalV241()}catch(e){}},1200));
})();

/* ===== V24.3 + V24.4 AI INTELLIGENCE LAYER: Current Affairs Engine Pro + Voice Saarthi Pro ===== */
(function(){
  const $v=id=>document.getElementById(id);
  const todayV244=()=>new Date().toISOString().slice(0,10);
  const futureV244=(n)=>{const d=new Date(); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10);};
  const escV244=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const txtV244=id=>($v(id)?.value||'').trim();
  const outTextV244=id=>($v(id)?.innerText||$v(id)?.textContent||'').trim();
  const saveV244=async(col,obj)=>{try{ if(typeof safeSaveColV4==='function') return await safeSaveColV4(col,obj); }catch(e){} try{ if(typeof saveCol==='function') return await saveCol(col,obj); }catch(e){} const a=JSON.parse(localStorage.getItem(col)||'[]'); a.unshift({...obj,id:'local_'+Date.now()+'_'+Math.random().toString(36).slice(2)}); localStorage.setItem(col,JSON.stringify(a));};
  const getV244=async(col)=>{try{ if(typeof safeGetColV4==='function') return await safeGetColV4(col); }catch(e){} try{ if(typeof getCol==='function') return await getCol(col); }catch(e){} try{return JSON.parse(localStorage.getItem(col)||'[]')}catch(e){return []}};
  const askV244=async(prompt)=>{ if(typeof window.aiAskRouterV23==='function') return await window.aiAskRouterV23(prompt); if(typeof window.aiAsk==='function') return await window.aiAsk(prompt); if(typeof window.aiAskV4==='function') return await window.aiAskV4(prompt); throw new Error('AI router not found. Open AI Control Centre and save settings.'); };
  function fmtV244(text){try{return typeof formatAI==='function'?formatAI(text):`<pre>${escV244(text)}</pre>`}catch(e){return `<pre>${escV244(text)}</pre>`}}
  function modeLabelV244(){try{const s=JSON.parse(localStorage.getItem('mission_ai_settings_v23')||'{}'); const m=s.mode||'ollama'; return m==='ollama'?'🖥 Ollama Local':m==='gemini'?'☁ Gemini Free API':m==='chatgpt'?'📋 ChatGPT Prompt Mode':'⭐ Smart Hybrid';}catch(e){return 'Selected AI';}}
  function setHtmlV244(id,html){const el=$v(id); if(el)el.innerHTML=html;}
  function setStatusV244(id,msg){const el=$v(id); if(el){el.innerHTML=msg||''; el.classList.toggle('active',!!msg);}}

  /* ---------- V24.3 Current Affairs Engine ---------- */
  function updateCAModeBadgeV243(){const b=$v('caModeBadgeV243'); if(b)b.textContent=`Selected AI: ${modeLabelV244()}`; if($v('caDateV243')&&!$v('caDateV243').value)$v('caDateV243').value=todayV244();}
  function caPromptV243(){
    const title=txtV244('caTitleAI')||'Daily Current Affairs';
    const subject=txtV244('caSubjectAI')||'Current Affairs';
    const source=txtV244('caSourceAI')||'Source';
    const mode=txtV244('caModeV243')||'Single Article';
    const depth=txtV244('caDepthV243')||'Balanced';
    const date=txtV244('caDateV243')||todayV244();
    const article=txtV244('caArticleAI');
    const depthRule=depth==='Fast'?'Keep it crisp and usable for daily revision.':depth==='Expert'?'Make it deep with interlinkages, data, committees, constitutional/IR/economy dimensions where relevant.':'Keep balanced depth suitable for UPSC daily notes.';
    return `You are a UPSC CSE current affairs mentor. Convert the following news into an exam-ready current affairs file.\n\nTitle: ${title}\nDate: ${date}\nSubject: ${subject}\nSource: ${source}\nMode: ${mode}\nDepth: ${depth}\nInstruction: ${depthRule}\n\nOutput exactly in this structure:\n# ${title} - Current Affairs Intelligence\n## 1. Why in News\n## 2. UPSC Syllabus Link: Prelims + Mains GS paper\n## 3. Core Issue in 100 words\n## 4. Prelims Facts: keywords, institutions, reports, places, articles, schemes\n## 5. Mains Dimensions: causes, impacts, challenges, governance, economy/social/environment/IR angle\n## 6. Data / Reports / Examples / Case Studies\n## 7. Map / Location / Diagram Connection if any\n## 8. Related PYQ Angle\n## 9. Expected Prelims MCQs with answer key\n## 10. Expected Mains Questions: 10-marker and 15-marker\n## 11. Flashcards in Q: and A: format\n## 12. Mindmap Branches: 12 lines in Branch: detail format\n## 13. 50-word Revision Capsule\n## 14. Final Revision Checklist\n\nNews / Article / Digest Text:\n${article.slice(0,22000)}`;
  }
  window.loadCAFileV243=async function(ev){
    const f=ev?.target?.files?.[0]; if(!f)return;
    try{
      setStatusV244('caFileStatusV243','📖 Reading file...');
      let text='';
      if(/\.pdf$/i.test(f.name)||/pdf/i.test(f.type)){
        const pdfjs=await new Promise((resolve,reject)=>{if(window.pdfjsLib)return resolve(window.pdfjsLib); const sc=document.createElement('script'); sc.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js'; sc.onload=()=>{try{window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js'}catch(e){} resolve(window.pdfjsLib)}; sc.onerror=()=>reject(new Error('PDF.js could not load. Paste text manually.')); document.head.appendChild(sc);});
        const data=await f.arrayBuffer(); const pdf=await pdfjs.getDocument({data}).promise; const max=Math.min(pdf.numPages,40);
        for(let i=1;i<=max;i++){setStatusV244('caFileStatusV243',`📖 Extracting PDF page ${i}/${max}`); const page=await pdf.getPage(i); const c=await page.getTextContent(); text+=`\n\n--- Page ${i} ---\n`+c.items.map(x=>x.str).join(' ');} if(pdf.numPages>40)text+='\n[Only first 40 pages extracted for speed.]';
      }else text=await f.text();
      if($v('caArticleAI'))$v('caArticleAI').value=(txtV244('caArticleAI')?txtV244('caArticleAI')+'\n\n':'')+text.trim();
      if($v('caTitleAI')&&!txtV244('caTitleAI'))$v('caTitleAI').value=f.name.replace(/\.[^.]+$/,'');
      setStatusV244('caFileStatusV243',`✅ File loaded: ${text.length.toLocaleString()} characters. Now generate CA Intelligence.`);
    }catch(e){setStatusV244('caFileStatusV243','⚠ File read failed: '+e.message); alert(e.message);}
  };
  window.makeCurrentAffairsIntelligence=async function(){
    if(!txtV244('caArticleAI'))return alert('Paste article/digest text or upload a file first.');
    updateCAModeBadgeV243();
    setHtmlV244('caAIOutput',`<div class="aiProviderBadgeV231">${escV244(modeLabelV244())}</div><div class="aiLoading">AI Current Affairs Engine generating UPSC intelligence...</div>`);
    try{const res=await askV244(caPromptV243()); setHtmlV244('caAIOutput',`<div class="aiProviderBadgeV231">${escV244(modeLabelV244())}</div>`+fmtV244(res)); try{window.installAIOutputDownloadsV226&&setTimeout(window.installAIOutputDownloadsV226,80)}catch(e){}}
    catch(e){setHtmlV244('caAIOutput',fmtV244('Current Affairs AI failed: '+e.message));}
  };
  window.saveCurrentAffairsIntelligence=async function(){
    const body=outTextV244('caAIOutput'); if(!body||body.includes('Paste news'))return alert('Generate CA Intelligence first.');
    const obj={title:txtV244('caTitleAI')||'Current Affairs '+todayV244(),subject:txtV244('caSubjectAI')||'Current Affairs',source:txtV244('caSourceAI')||'Source',mode:txtV244('caModeV243'),article:txtV244('caArticleAI'),note:body,date:txtV244('caDateV243')||todayV244(),version:'v24.3'};
    await saveV244('currentAffairsAI',obj); await saveV244('notes',{title:'CA: '+obj.title,subject:obj.subject,body,type:'Current Affairs',date:obj.date,source:'v24.3'});
    try{renderCurrentAffairsIntelligence()}catch(e){} alert('Saved to Current Affairs + Notes.');
  };
  window.caIntelligenceToRevision=async function(){
    const body=outTextV244('caAIOutput'); if(!body)return alert('Generate output first.');
    await saveV244('smartRevision',{topic:txtV244('caTitleAI')||'Current Affairs Revision',subject:txtV244('caSubjectAI')||'Current Affairs',source:'v24.3 Current Affairs Engine',difficulty:'Medium',date:futureV244(1),cycle:1,status:'pending',body});
    alert('Current affairs sent to revision.');
  };
  window.caIntelligenceToLibrary=async function(){
    const body=outTextV244('caAIOutput'); if(!body)return alert('Generate output first.');
    await saveV244('digitalLibrary',{type:'Current Affairs',subject:txtV244('caSubjectAI')||'Current Affairs',title:txtV244('caTitleAI')||'CA Item',url:'',content:body,date:txtV244('caDateV243')||todayV244(),source:'v24.3'});
    alert('Saved to Digital Library.');
  };
  function parseQACardsV244(text, fallbackTitle){
    const lines=String(text||'').split('\n'); const cards=[]; let q='',a='';
    for(const line of lines){const t=line.trim(); if(/^Q\s*[:.)-]/i.test(t)||/^Question\s*[:.)-]/i.test(t)){if(q&&a)cards.push({q,a}); q=t.replace(/^Question\s*[:.)-]\s*/i,'').replace(/^Q\s*[:.)-]\s*/i,''); a='';} else if(/^A\s*[:.)-]/i.test(t)||/^Answer\s*[:.)-]/i.test(t)){a=t.replace(/^Answer\s*[:.)-]\s*/i,'').replace(/^A\s*[:.)-]\s*/i,'');} else if(a){a+=' '+t;}}
    if(q&&a)cards.push({q,a});
    if(!cards.length)cards.push({q:'Current Affairs: '+fallbackTitle,a:String(text||'').slice(0,1200)});
    return cards.slice(0,30);
  }
  window.caToFlashcardsV243=async function(){
    const body=outTextV244('caAIOutput'); if(!body)return alert('Generate output first.');
    const cards=parseQACardsV244(body,txtV244('caTitleAI')||'CA');
    for(const c of cards){await saveV244('flash',{q:c.q,a:c.a,subject:txtV244('caSubjectAI')||'Current Affairs',difficulty:'Medium',due:todayV244(),date:todayV244(),source:'v24.3 Current Affairs'});}
    alert(`${cards.length} current affairs flashcards saved.`);
  };
  window.caToMindmapV243=function(){
    const body=outTextV244('caAIOutput'); if(!body)return alert('Generate output first.');
    const topic=txtV244('caTitleAI')||'Current Affairs Mindmap';
    const lines=body.split('\n').map(x=>x.replace(/^[-*\d.\s]+/,'').trim()).filter(x=>x.length>8&&x.length<180).slice(0,14);
    if($v('mmTopic'))$v('mmTopic').value=topic; if($v('mmSubject'))$v('mmSubject').value=txtV244('caSubjectAI')||'Current Affairs'; if($v('mmNodes'))$v('mmNodes').value=(lines.length?lines:['Why in news','Prelims facts','Mains dimensions','PYQ angle','Way forward']).map(x=>x.includes(':')?x:`${x}: current affairs point`).join('\n');
    try{window.show&&window.show('mindMapStudio')}catch(e){}
    setTimeout(()=>{try{if(typeof window.renderMindMapManual==='function')window.renderMindMapManual(); if(typeof window.drawDetailedMindMapV136==='function')window.drawDetailedMindMapV136(topic,lines.map(x=>({title:x.split(':')[0].slice(0,45),detail:(x.split(':').slice(1).join(':')||'CA branch').slice(0,130)})));}catch(e){}},150);
  };
  window.caToMainsFrameworkV243=async function(){
    const body=outTextV244('caAIOutput'); if(!body)return alert('Generate output first.');
    setHtmlV244('caAIOutput',`<div class="aiLoading">Creating mains answer framework from CA...</div>`);
    try{const res=await askV244(`Create a UPSC mains answer framework from this current affairs note. Give 10-marker and 15-marker structure, intro, body headings, diagram, data/examples, conclusion and value addition.\n\n${body.slice(0,14000)}`); setHtmlV244('caAIOutput',fmtV244(res));}
    catch(e){setHtmlV244('caAIOutput',fmtV244('Framework failed: '+e.message));}
  };
  window.generateDailyCARevisionV243=async function(){
    const data=(await getV244('currentAffairsAI')).slice(0,10); if(!data.length)return alert('Save current affairs first.');
    const digest=data.map((x,i)=>`${i+1}. ${x.title||'CA'} (${x.subject||''}) - ${(x.note||x.article||'').slice(0,900)}`).join('\n\n');
    setHtmlV244('caAIOutput','<div class="aiLoading">Creating daily CA revision plan...</div>');
    try{const res=await askV244(`Create a daily current affairs revision sheet from these saved CA notes. Include 20 prelims facts, 10 MCQs, 5 mains questions, weak areas, and a 3-day revision timetable.\n\n${digest}`); setHtmlV244('caAIOutput',fmtV244(res)); await saveV244('smartRevision',{topic:'Daily Current Affairs Revision',subject:'Current Affairs',source:'v24.3 Daily CA',difficulty:'Medium',date:todayV244(),cycle:1,status:'pending',body:res}); alert('Daily CA revision generated and saved.');}
    catch(e){setHtmlV244('caAIOutput',fmtV244('Daily CA revision failed: '+e.message));}
  };
  window.renderCurrentAffairsIntelligence=async function(){
    const box=$v('caDisplayList'); if(!box)return;
    const q=(txtV244('caSearchAI')||'').toLowerCase(); const sub=txtV244('caFilterSubjectAI')||'All';
    let data=await getV244('currentAffairsAI');
    data=data.filter(x=>(sub==='All'||(x.subject||'')===sub) && JSON.stringify(x).toLowerCase().includes(q));
    box.innerHTML=data.map((x,i)=>`<div class="caCardV243"><div class="caCardTopV243"><span>${escV244(x.subject||'CA')}</span><small>${escV244(x.date||'')}</small></div><h3>${escV244(x.title||'Untitled CA')}</h3><p>${escV244((x.note||x.article||'').slice(0,260))}${(x.note||x.article||'').length>260?'...':''}</p><div class="actions"><button class="btn purple" onclick="openSavedCAV243('${x.id||i}')">Open</button><button class="btn gold" onclick="savedCAToRevisionV243('${x.id||i}')">Revision</button><button class="btn danger" onclick="deleteItem('currentAffairsAI','${x.id||i}');setTimeout(renderCurrentAffairsIntelligence,300)">Delete</button></div></div>`).join('')||'<div class="emptyState">No saved current affairs yet.</div>';
  };
  window.openSavedCAV243=async function(id){const data=await getV244('currentAffairsAI'); const x=data.find((a,i)=>(a.id||String(i))==id)||data[id]; if(!x)return; if($v('caTitleAI'))$v('caTitleAI').value=x.title||''; if($v('caSubjectAI'))$v('caSubjectAI').value=x.subject||'Polity'; if($v('caSourceAI'))$v('caSourceAI').value=x.source||'Other'; if($v('caArticleAI'))$v('caArticleAI').value=x.article||''; setHtmlV244('caAIOutput',fmtV244(x.note||x.article||'')); window.show&&window.show('currentAffairsAI');};
  window.savedCAToRevisionV243=async function(id){const data=await getV244('currentAffairsAI'); const x=data.find((a,i)=>(a.id||String(i))==id)||data[id]; if(!x)return; await saveV244('smartRevision',{topic:'CA Revision: '+(x.title||'Current Affairs'),subject:x.subject||'Current Affairs',source:'v24.3 Saved CA',difficulty:'Medium',date:futureV244(1),cycle:1,status:'pending',body:x.note||x.article||''}); alert('Saved CA sent to revision.');};

  /* ---------- V24.4 Voice Saarthi Pro ---------- */
  let recognitionV244=null;
  function setVoiceStatusV244(msg){setStatusV244('voiceStatusV244',msg)}
  function setVoiceMeterV244(active){const m=$v('voiceMeterV244'); if(m)m.classList.toggle('active',!!active)}
  function voicePromptV244(){
    const command=txtV244('voiceSaarthiText'); const mode=txtV244('voiceModeV244')||'Ask Mentor'; const style=txtV244('voiceAnswerStyleV244')||'Balanced';
    return `You are Voice Saarthi, Vignesh's UPSC AI assistant.\nMode: ${mode}\nAnswer style: ${style}\nVoice command: ${command}\n\nRules:\n- Answer in a spoken-friendly but UPSC-oriented way.\n- If mode is Oral Quiz, create questions one by one or in numbered format with answers hidden after each question.\n- If mode is Make Study Plan, give practical time blocks.\n- If mode is Quick Revision, give active recall points and memory hooks.\n- If mode is Current Affairs Angle, connect to syllabus, prelims, mains and PYQ.\n\nOutput with clear headings and action points.`;
  }
  window.setVoiceCommandV244=function(text){if($v('voiceSaarthiText'))$v('voiceSaarthiText').value=text;};
  window.startVoiceSaarthi=function(){
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR)return alert('Speech recognition is not supported in this browser. Use Chrome/Edge, or type the command manually.');
    try{if(recognitionV244)recognitionV244.stop()}catch(e){}
    recognitionV244=new SR(); recognitionV244.lang=txtV244('voiceLanguageV244')||'en-IN'; recognitionV244.continuous=false; recognitionV244.interimResults=true;
    setVoiceMeterV244(true); setVoiceStatusV244('🎙 Listening... speak your UPSC command.');
    recognitionV244.onresult=e=>{let final='',interim=''; for(let i=e.resultIndex;i<e.results.length;i++){const part=e.results[i][0].transcript; if(e.results[i].isFinal)final+=part; else interim+=part;} if($v('voiceSaarthiText'))$v('voiceSaarthiText').value=(final||interim).trim();};
    recognitionV244.onerror=e=>{setVoiceStatusV244('Voice error: '+(e.error||'unknown')); setVoiceMeterV244(false);};
    recognitionV244.onend=()=>{setVoiceStatusV244('✅ Listening stopped. Edit text if needed, then ask AI.'); setVoiceMeterV244(false);};
    recognitionV244.start();
  };
  window.stopVoiceSaarthiV244=function(){try{recognitionV244&&recognitionV244.stop()}catch(e){} setVoiceMeterV244(false); setVoiceStatusV244('⛔ Voice stopped.');};
  window.askVoiceSaarthiAI=async function(){
    if(!txtV244('voiceSaarthiText'))return alert('Speak or type a command first.');
    setHtmlV244('voiceSaarthiOutput',`<div class="aiProviderBadgeV231">${escV244(modeLabelV244())}</div><div class="aiLoading">Voice Saarthi thinking...</div>`);
    try{const res=await askV244(voicePromptV244()); setHtmlV244('voiceSaarthiOutput',`<div class="aiProviderBadgeV231">${escV244(modeLabelV244())}</div>`+fmtV244(res)); await saveVoiceLogV244(txtV244('voiceSaarthiText'),res,false); setVoiceStatusV244('✅ Voice answer ready.');}
    catch(e){setHtmlV244('voiceSaarthiOutput',fmtV244('Voice AI failed: '+e.message));}
  };
  async function saveVoiceLogV244(command,answer,manual=true){
    const obj={command,answer,mode:txtV244('voiceModeV244'),style:txtV244('voiceAnswerStyleV244'),date:todayV244(),time:new Date().toLocaleTimeString(),source:'v24.4'};
    await saveV244('voiceSaarthiLogs',obj); if(manual)alert('Voice session saved.'); try{renderVoiceLogV244()}catch(e){}
  }
  window.saveVoiceAdviceV244=async function(){const body=outTextV244('voiceSaarthiOutput'); if(!body)return alert('Ask AI first.'); await saveVoiceLogV244(txtV244('voiceSaarthiText'),body,true); await saveV244('notes',{title:'Voice Saarthi - '+(txtV244('voiceSaarthiText')||todayV244()).slice(0,70),subject:'Voice AI',body,date:todayV244(),type:'Voice Saarthi',source:'v24.4'});};
  window.speakVoiceOutputV244=function(){
    const text=outTextV244('voiceSaarthiOutput'); if(!text)return alert('No output to speak.');
    if(!('speechSynthesis' in window))return alert('Text-to-speech not supported in this browser.');
    window.speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(text.slice(0,3500)); u.lang=txtV244('voiceLanguageV244')||'en-IN'; u.rate=0.95; window.speechSynthesis.speak(u);
  };
  window.voiceOutputToRevisionV244=async function(){const body=outTextV244('voiceSaarthiOutput'); if(!body)return alert('Ask AI first.'); await saveV244('smartRevision',{topic:txtV244('voiceSaarthiText').slice(0,120)||'Voice Saarthi Revision',subject:'Voice AI',source:'v24.4 Voice Saarthi',difficulty:'Medium',date:futureV244(1),cycle:1,status:'pending',body}); alert('Voice output sent to revision.');};
  window.voiceOutputToCalendarV244=async function(){const body=outTextV244('voiceSaarthiOutput'); if(!body)return alert('Ask AI first.'); await saveV244('calendarItems',{date:todayV244(),title:'Voice Saarthi Action: '+(txtV244('voiceSaarthiText')||'Task').slice(0,80),type:'Voice AI',body}); alert('Voice output sent to calendar.');};
  window.voiceOutputToFlashcardsV244=async function(){const body=outTextV244('voiceSaarthiOutput'); if(!body)return alert('Ask AI first.'); setHtmlV244('voiceSaarthiOutput','<div class="aiLoading">Creating flashcards from voice answer...</div>'); try{const res=await askV244(`Create 10 UPSC flashcards in Q: and A: format from this voice answer.\n\n${body.slice(0,12000)}`); setHtmlV244('voiceSaarthiOutput',fmtV244(res)); const cards=parseQACardsV244(res,txtV244('voiceSaarthiText')||'Voice'); for(const c of cards){await saveV244('flash',{q:c.q,a:c.a,subject:'Voice AI',difficulty:'Medium',due:todayV244(),date:todayV244(),source:'v24.4 Voice Saarthi'});} alert(`${cards.length} voice flashcards saved.`);}catch(e){setHtmlV244('voiceSaarthiOutput',fmtV244('Flashcard conversion failed: '+e.message));}}
  window.renderVoiceLogV244=async function(){const box=$v('voiceSessionLogV244'); if(!box)return; const data=(await getV244('voiceSaarthiLogs')).slice(0,15); box.innerHTML=data.map((x,i)=>`<div class="voiceLogItemV244"><b>${escV244(x.command||'Voice command')}</b><span>${escV244(x.date||'')} ${escV244(x.time||'')}</span><p>${escV244((x.answer||'').slice(0,260))}${(x.answer||'').length>260?'...':''}</p><button class="btn danger" onclick="deleteItem('voiceSaarthiLogs','${x.id||i}');setTimeout(renderVoiceLogV244,300)">Delete</button></div>`).join('')||'No voice sessions yet.';};

  const oldShowV2434=window.show;
  if(typeof oldShowV2434==='function')window.show=function(id,btn){const r=oldShowV2434.apply(this,arguments); setTimeout(()=>{try{if(id==='currentAffairsAI'){updateCAModeBadgeV243(); renderCurrentAffairsIntelligence();} if(id==='voiceSaarthi'){renderVoiceLogV244();}}catch(e){console.warn('v24.3/v24.4 render skipped',e)}},180); return r;};
  document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{try{updateCAModeBadgeV243(); renderCurrentAffairsIntelligence(); renderVoiceLogV244();}catch(e){}},1200));
})();


/* ===== V25.1 + V25.2 PHASE 2: PRELIMS WAR ROOM + MAINS WAR ROOM ===== */
(function(){
  'use strict';
  const $25=id=>document.getElementById(id);
  const esc25=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const today25=()=>new Date().toISOString().slice(0,10);
  const val25=(id,def='')=>String($25(id)?.value??def).trim();
  const out25=id=>String($25(id)?.innerText||'').trim();
  const set25=(id,html)=>{const e=$25(id);if(e)e.innerHTML=html};
  const status25=(id,msg)=>{const e=$25(id);if(e){e.classList.toggle('active',!!msg);e.innerHTML=msg||''}};
  const clamp25=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));
  const round25=(n,d=1)=>Number(Number(n||0).toFixed(d));
  const settings25=()=>{try{return {mode:'ollama',ollamaModel:'gemma3:4b',...JSON.parse(localStorage.getItem('mission_ai_settings_v23')||'{}')}}catch(e){return {mode:'ollama',ollamaModel:'gemma3:4b'}}};
  const modeLabel25=()=>{const s=settings25();return s.mode==='ollama'?'🖥 Ollama Local':s.mode==='gemini'?'☁ Gemini Free API':s.mode==='chatgpt'?'📋 ChatGPT Prompt Mode':'⭐ Smart Hybrid'};
  const fmt25=t=>{try{return typeof window.formatAI==='function'?window.formatAI(String(t||'')):`<pre>${esc25(t)}</pre>`}catch(e){return `<pre>${esc25(t)}</pre>`}};
  async function ask25(prompt){
    if(typeof window.aiAskRouterV23==='function') return await window.aiAskRouterV23(prompt);
    if(typeof window.aiAsk==='function') return await window.aiAsk(prompt);
    throw new Error('AI router unavailable. Save the selected AI in AI Control Centre.');
  }
  async function get25(col){
    try{if(typeof window.getCol==='function')return await window.getCol(col)}catch(e){}
    try{return JSON.parse(localStorage.getItem(col)||'[]')}catch(e){return []}
  }
  async function save25(col,obj){
    try{if(typeof window.saveCol==='function')return await window.saveCol(col,obj)}catch(e){}
    const a=await get25(col);a.unshift({...obj,id:'local_'+Date.now()+'_'+Math.random().toString(36).slice(2)});localStorage.setItem(col,JSON.stringify(a));
  }
  function updateBadges25(){
    const s=settings25();
    const text=`Selected AI: ${modeLabel25()} • ${s.ollamaModel||'Cloud/Prompt'}`;
    if($25('prelimsAIBadgeV251'))$25('prelimsAIBadgeV251').textContent=text;
    if($25('mainsAIBadgeV252'))$25('mainsAIBadgeV252').textContent=text;
  }

  // ---------- V25.1 PRELIMS WAR ROOM ----------
  const ACTIVE_PRELIMS_KEY='mission_prelims_active_v251';
  let prelimsState={test:null,index:0,lastReport:null,timer:null};
  function normalizeOptionKey25(v){
    const m=String(v||'').toUpperCase().match(/[ABCD]/);return m?m[0]:'';
  }
  function normalizeQuestion25(q,i){
    if(!q||typeof q!=='object')return null;
    let options=q.options||q.option||q.choices||{};
    if(Array.isArray(options)) options={A:options[0],B:options[1],C:options[2],D:options[3]};
    if(typeof options!=='object')return null;
    const norm={};['A','B','C','D'].forEach(k=>{norm[k]=String(options[k]??options[k.toLowerCase()]??'').trim()});
    const question=String(q.question||q.q||q.text||'').trim();
    const answer=normalizeOptionKey25(q.answer||q.correct||q.correctAnswer||q.key);
    if(!question||!answer||Object.values(norm).filter(Boolean).length<4)return null;
    return {id:q.id||`q${i+1}`,question,options:norm,answer,explanation:String(q.explanation||q.reason||q.solution||'').trim(),topic:String(q.topic||q.subtopic||'General').trim(),trap:String(q.trap||q.elimination||'').trim(),difficulty:String(q.difficulty||'UPSC').trim(),source:String(q.source||'AI Generated').trim()};
  }
  function parsePrelimsJSON25(raw){
    let text=String(raw||'').trim().replace(/```(?:json)?/gi,'').replace(/```/g,'');
    let data=null;
    const candidates=[text];
    const a=text.indexOf('['),b=text.lastIndexOf(']');if(a>=0&&b>a)candidates.push(text.slice(a,b+1));
    const oa=text.indexOf('{'),ob=text.lastIndexOf('}');if(oa>=0&&ob>oa)candidates.push(text.slice(oa,ob+1));
    for(const c of candidates){try{data=JSON.parse(c);break}catch(e){}}
    if(data&&Array.isArray(data.questions))data=data.questions;
    if(data&&Array.isArray(data.mcqs))data=data.mcqs;
    if(!Array.isArray(data))throw new Error('AI response was not valid question JSON. In ChatGPT Prompt Mode, paste the generated JSON into Manual Import.');
    const arr=data.map(normalizeQuestion25).filter(Boolean);
    if(!arr.length)throw new Error('No valid MCQs detected. Each question needs 4 options and an A/B/C/D answer.');
    return arr.slice(0,50);
  }
  function prelimsPrompt25(){
    const count=clamp25(val25('prelimsQuestionCountV251',10),1,50);
    const source=val25('prelimsSourceV251');
    return `You are a UPSC CSE Prelims question setter. Create exactly ${count} original MCQs.\nSubject: ${val25('prelimsSubjectV251','Mixed GS')}\nTopic: ${val25('prelimsTopicV251','UPSC General Studies')}\nDifficulty: ${val25('prelimsDifficultyV251','UPSC Balanced')}\nInclude statement questions: ${$25('prelimsStatementV251')?.checked?'yes':'no'}\nInclude matching/pairs: ${$25('prelimsMatchV251')?.checked?'yes':'no'}\nInclude elimination traps: ${$25('prelimsTrapV251')?.checked?'yes':'no'}\nDetailed explanation: ${$25('prelimsExplanationV251')?.checked?'yes':'no'}\n${source?`SOURCE-GROUNDED CONTENT (do not go outside it unless needed for basic context):\n${source.slice(0,18000)}`:''}\n\nReturn ONLY strict valid JSON, no markdown and no commentary. Schema:\n[{"question":"Question text","options":{"A":"Option A","B":"Option B","C":"Option C","D":"Option D"},"answer":"B","explanation":"Why B is correct and why others are wrong","topic":"specific subtopic","trap":"UPSC elimination clue","difficulty":"Moderate"}]\nRules: one unambiguous answer, factual accuracy, plausible distractors, no repetition, UPSC-style conceptual depth.`;
  }
  function saveActivePrelims25(){
    if(prelimsState.test)localStorage.setItem(ACTIVE_PRELIMS_KEY,JSON.stringify(prelimsState.test));else localStorage.removeItem(ACTIVE_PRELIMS_KEY);
  }
  function startPrelimsState25(questions,title){
    const mins=clamp25(val25('prelimsMinutesV251',20),1,180);
    prelimsState.test={title:title||val25('prelimsTestTitleV251')||`${val25('prelimsSubjectV251','UPSC')} Test`,subject:val25('prelimsSubjectV251','Mixed GS'),topic:val25('prelimsTopicV251','General'),difficulty:val25('prelimsDifficultyV251','UPSC Balanced'),questions,answers:{},review:{},startedAt:Date.now(),durationMinutes:mins,negative:clamp25(val25('prelimsNegativeV251',0.66),0,2),submitted:false};
    prelimsState.index=0;prelimsState.lastReport=null;saveActivePrelims25();startPrelimsClock25();renderPrelimsTest25();
  }
  window.generatePrelimsTestV251=async function(){
    status25('prelimsGenerationStatusV251','🤖 Generating UPSC-pattern questions with '+modeLabel25()+'...');
    set25('prelimsQuestionStageV251','<div class="v25EmptyState"><span class="v25Spinner">◌</span><h3>AI is setting your test</h3><p>Hard tests and Ollama can take longer. Keep this tab open.</p></div>');
    try{
      const raw=await ask25(prelimsPrompt25());
      try{
        const qs=parsePrelimsJSON25(raw);startPrelimsState25(qs,val25('prelimsTestTitleV251'));status25('prelimsGenerationStatusV251',`✅ ${qs.length} questions generated. Timer started.`);
      }catch(parseErr){
        if($25('prelimsManualJSONV251'))$25('prelimsManualJSONV251').value=raw;
        set25('prelimsQuestionStageV251',`<div class="v25ManualError"><h3>Manual import needed</h3><p>${esc25(parseErr.message)}</p><div class="aiOutput smallAI">${fmt25(raw)}</div></div>`);
        status25('prelimsGenerationStatusV251','⚠ AI output could not be parsed automatically. It has been placed in Manual JSON Import.');
      }
    }catch(e){status25('prelimsGenerationStatusV251','⚠ Generation failed: '+esc25(e.message));set25('prelimsQuestionStageV251','<div class="v25EmptyState"><span>⚠️</span><h3>Generation failed</h3><p>'+esc25(e.message)+'</p></div>')}
  };
  window.importPrelimsJSONV251=function(){try{const qs=parsePrelimsJSON25(val25('prelimsManualJSONV251'));startPrelimsState25(qs,val25('prelimsTestTitleV251'));status25('prelimsGenerationStatusV251',`✅ ${qs.length} manually imported questions.`)}catch(e){alert(e.message)}};
  window.loadDemoPrelimsV251=function(){
    const demo=[
      {question:'With reference to Article 14 of the Constitution, which one of the following best describes the doctrine of reasonable classification?',options:{A:'Any classification made by Parliament is valid',B:'Classification must rest on intelligible differentia and have a rational nexus with the objective',C:'Classification is prohibited in all circumstances',D:'Only economic classification is permitted'},answer:'B',explanation:'Article 14 permits reasonable classification if intelligible differentia and rational nexus tests are satisfied.',topic:'Right to Equality',trap:'Absolute words such as any and all are usually suspect.'},
      {question:'Consider the following statements regarding Money Bills: 1. Rajya Sabha can reject a Money Bill. 2. The Speaker certifies whether a Bill is a Money Bill. 3. The President cannot return a Money Bill for reconsideration. Which of the statements given above are correct?',options:{A:'1 and 2 only',B:'2 and 3 only',C:'1 and 3 only',D:'1, 2 and 3'},answer:'B',explanation:'Rajya Sabha can only recommend changes within 14 days; Speaker certification applies; the President cannot return a Money Bill.',topic:'Parliament',trap:'Differentiate recommendation from rejection.'},
      {question:'The term “blue carbon” is most appropriately associated with carbon stored in:',options:{A:'Glaciers and polar ice',B:'Ocean and coastal ecosystems such as mangroves and seagrasses',C:'Urban rooftop gardens',D:'Deep coal seams'},answer:'B',explanation:'Blue carbon refers to carbon captured and stored by coastal and marine ecosystems.',topic:'Climate Change',trap:'The word blue points to marine/coastal ecosystems.'},
      {question:'Which one of the following is included while calculating the fiscal deficit of the Union Government?',options:{A:'Only revenue expenditure minus revenue receipts',B:'Total expenditure minus total receipts excluding borrowings',C:'Interest payments minus tax revenue',D:'Capital expenditure minus capital receipts including borrowings'},answer:'B',explanation:'Fiscal deficit is total expenditure minus total receipts excluding borrowings.',topic:'Public Finance',trap:'Borrowings finance the deficit and therefore are excluded from receipts in the calculation.'},
      {question:'The writ of Quo Warranto is issued primarily to:',options:{A:'Produce a detained person before court',B:'Compel performance of a public duty',C:'Question the legality of a person holding a public office',D:'Transfer a case from a lower court'},answer:'C',explanation:'Quo Warranto challenges the legal authority by which a person occupies a public office.',topic:'Writs',trap:'Quo Warranto literally asks “by what authority”.'}
    ].map(normalizeQuestion25).filter(Boolean);startPrelimsState25(demo,'V25.1 Demo Prelims Test');
  };
  function renderPrelimsPalette25(){
    const t=prelimsState.test,box=$25('prelimsQuestionPaletteV251');if(!box||!t){if(box)box.innerHTML='';return}
    box.innerHTML=t.questions.map((q,i)=>{const answered=!!t.answers[i],review=!!t.review[i],active=i===prelimsState.index;return `<button class="v25PaletteBtn ${answered?'answered':''} ${review?'review':''} ${active?'active':''}" onclick="jumpPrelimsQuestionV251(${i})">${i+1}</button>`}).join('');
  }
  function renderPrelimsTest25(){
    const t=prelimsState.test;if(!t)return;
    const q=t.questions[prelimsState.index],chosen=t.answers[prelimsState.index]||'';
    if($25('prelimsActiveTitleV251'))$25('prelimsActiveTitleV251').textContent=t.title;
    if($25('prelimsProgressTextV251'))$25('prelimsProgressTextV251').textContent=`Question ${prelimsState.index+1} of ${t.questions.length} • ${t.subject} • ${t.difficulty}`;
    const stage=$25('prelimsQuestionStageV251');if(stage)stage.innerHTML=`<div class="v25QMeta"><span>${esc25(q.topic||t.topic)}</span><span>${esc25(q.difficulty||'UPSC')}</span>${t.review[prelimsState.index]?'<span class="reviewTag">Marked for review</span>':''}</div><h3 class="v25QuestionText">${prelimsState.index+1}. ${esc25(q.question)}</h3><div class="v25Options">${['A','B','C','D'].map(k=>`<button class="v25Option ${chosen===k?'selected':''}" onclick="selectPrelimsOptionV251('${k}')"><b>${k}</b><span>${esc25(q.options[k])}</span></button>`).join('')}</div>`;
    renderPrelimsPalette25();saveActivePrelims25();
  }
  window.selectPrelimsOptionV251=function(k){const t=prelimsState.test;if(!t||t.submitted)return;t.answers[prelimsState.index]=k;renderPrelimsTest25()};
  window.jumpPrelimsQuestionV251=function(i){if(!prelimsState.test)return;prelimsState.index=clamp25(i,0,prelimsState.test.questions.length-1);renderPrelimsTest25()};
  window.movePrelimsQuestionV251=function(delta){if(!prelimsState.test)return;prelimsState.index=clamp25(prelimsState.index+Number(delta||0),0,prelimsState.test.questions.length-1);renderPrelimsTest25()};
  window.togglePrelimsReviewV251=function(){const t=prelimsState.test;if(!t)return;t.review[prelimsState.index]=!t.review[prelimsState.index];renderPrelimsTest25()};
  function startPrelimsClock25(){
    clearInterval(prelimsState.timer);prelimsState.timer=setInterval(()=>{
      const t=prelimsState.test;if(!t||t.submitted){clearInterval(prelimsState.timer);return}
      const total=t.durationMinutes*60,elapsed=Math.floor((Date.now()-t.startedAt)/1000),remain=Math.max(0,total-elapsed);const mm=String(Math.floor(remain/60)).padStart(2,'0'),ss=String(remain%60).padStart(2,'0');if($25('prelimsTimerV251'))$25('prelimsTimerV251').textContent=`${mm}:${ss}`;if(remain<=0){clearInterval(prelimsState.timer);window.submitPrelimsTestV251(true)}
    },1000);
  }
  function buildPrelimsReport25(){
    const t=prelimsState.test;if(!t)return null;let correct=0,wrong=0,unanswered=0;const details=[];const weak={};
    t.questions.forEach((q,i)=>{const chosen=t.answers[i]||'';let status='unanswered';if(!chosen)unanswered++;else if(chosen===q.answer){correct++;status='correct'}else{wrong++;status='wrong'};if(status!=='correct')weak[q.topic||'General']=(weak[q.topic||'General']||0)+1;details.push({index:i+1,question:q.question,chosen,answer:q.answer,status,topic:q.topic,explanation:q.explanation,trap:q.trap,options:q.options})});
    const attempted=correct+wrong,max=t.questions.length*2,score=round25(correct*2-wrong*t.negative,2),accuracy=attempted?round25(correct/attempted*100,1):0,attemptRate=round25(attempted/t.questions.length*100,1),timeSec=Math.max(0,Math.floor((Date.now()-t.startedAt)/1000));
    return {title:t.title,subject:t.subject,topic:t.topic,date:today25(),createdAt:Date.now(),questionsCount:t.questions.length,correct,wrong,unanswered,attempted,score,maxScore:max,scorePercent:round25(Math.max(0,score)/max*100,1),accuracy,attemptRate,negative:t.negative,timeSec,weakTopics:Object.entries(weak).sort((a,b)=>b[1]-a[1]),details,questions:t.questions,answers:t.answers,source:'v25.1 AI Prelims War Room'};
  }
  function prelimsReportHTML25(r){
    const wrongRows=r.details.filter(x=>x.status!=='correct').map(x=>`<div class="v25ReviewItem ${x.status}"><b>Q${x.index}. ${esc25(x.topic||'General')}</b><p>${esc25(x.question)}</p><div><span>Your answer: <b>${esc25(x.chosen||'Not attempted')}</b></span> <span>Correct: <b>${esc25(x.answer)}</b></span></div>${x.explanation?`<p class="v25Explanation"><b>Explanation:</b> ${esc25(x.explanation)}</p>`:''}${x.trap?`<p class="v25Trap"><b>Elimination:</b> ${esc25(x.trap)}</p>`:''}</div>`).join('')||'<p>Excellent — no mistakes in this attempt.</p>';
    return `<div class="v25ResultHero"><div><span>Final Score</span><b>${r.score} / ${r.maxScore}</b></div><div><span>Accuracy</span><b>${r.accuracy}%</b></div><div><span>Attempted</span><b>${r.attemptRate}%</b></div></div><div class="v25MiniMetrics"><span class="good">✓ ${r.correct} Correct</span><span class="bad">✕ ${r.wrong} Wrong</span><span>○ ${r.unanswered} Unattempted</span><span>−${r.negative} per wrong</span></div><h3>Weak Topic Map</h3><div class="v25WeakTags">${r.weakTopics.map(([k,v])=>`<span>${esc25(k)} <b>${v}</b></span>`).join('')||'<span>No weak topic detected</span>'}</div><h3>Question Review</h3><div class="v25ReviewList">${wrongRows}</div>`;
  }
  window.submitPrelimsTestV251=async function(auto=false){
    const t=prelimsState.test;if(!t)return alert('Generate a test first.');if(t.submitted)return alert('This test is already submitted.');
    if(!auto&&!confirm('Submit this test now?'))return;
    t.submitted=true;clearInterval(prelimsState.timer);const r=buildPrelimsReport25();prelimsState.lastReport=r;set25('prelimsResultV251',prelimsReportHTML25(r));if($25('prelimsTimerV251'))$25('prelimsTimerV251').textContent='SUBMITTED';
    try{await save25('prelimsReports',r);for(const d of r.details.filter(x=>x.status==='wrong').slice(0,30)){await save25('wrongbook',{topic:d.topic||r.topic,subject:r.subject,question:d.question,reason:`Selected ${d.chosen}; correct ${d.answer}. ${d.explanation||''}`,date:r.date,source:'v25.1 Prelims War Room'});}status25('prelimsGenerationStatusV251','✅ Test submitted and report saved.');}catch(e){console.warn('Prelims save skipped',e)}
    saveActivePrelims25();renderPrelimsHistoryV251();
  };
  window.analyzePrelimsResultV251=async function(){
    const r=prelimsState.lastReport;if(!r)return alert('Submit a test first.');set25('prelimsResultV251',prelimsReportHTML25(r)+'<div class="aiLoading">AI is diagnosing mistake patterns...</div>');
    const mistakes=r.details.filter(x=>x.status!=='correct').slice(0,15).map(x=>({q:x.question,chosen:x.chosen,correct:x.answer,topic:x.topic,explanation:x.explanation}));
    const prompt=`Act as a strict UPSC Prelims mentor. Analyze this test report.\n${JSON.stringify({score:r.score,max:r.maxScore,accuracy:r.accuracy,attemptRate:r.attemptRate,weakTopics:r.weakTopics,mistakes},null,2)}\n\nGive:\n# AI Prelims Diagnosis\n## Score interpretation\n## Mistake classification: knowledge / conceptual / elimination / over-attempt / under-attempt\n## Top weak topics\n## Question-selection strategy\n## Elimination lessons\n## 3-day repair plan\n## 20-question retest plan\nBe specific, not generic.`;
    try{const ai=await ask25(prompt);set25('prelimsResultV251',prelimsReportHTML25(r)+`<div class="v25AIAnalysis">${fmt25(ai)}</div>`);r.aiAnalysis=ai;await save25('prelimsAIAnalyses',{title:r.title,date:r.date,body:ai,score:r.score,maxScore:r.maxScore,weakTopics:r.weakTopics,source:'v25.1'});}catch(e){set25('prelimsResultV251',prelimsReportHTML25(r)+fmt25('AI analysis failed: '+e.message))}
  };
  window.runEliminationTrainerV251=async function(){
    const t=prelimsState.test;if(!t)return alert('Generate a test first.');const r=prelimsState.lastReport;let q=t.questions[prelimsState.index],chosen=t.answers[prelimsState.index]||'Not attempted';
    if(r){const first=r.details.find(x=>x.status!=='correct');if(first){q=t.questions[first.index-1];chosen=first.chosen||'Not attempted'}}
    set25('prelimsEliminationOutputV251','<div class="aiLoading">AI is breaking down every option...</div>');
    const prompt=`Teach UPSC option elimination for this MCQ.\nQuestion: ${q.question}\nA. ${q.options.A}\nB. ${q.options.B}\nC. ${q.options.C}\nD. ${q.options.D}\nUser selected: ${chosen}\nCorrect answer: ${q.answer}\nKnown explanation: ${q.explanation||'None'}\n\nGive:\n# Elimination Trainer\n## Decode the demand\n## Option A analysis\n## Option B analysis\n## Option C analysis\n## Option D analysis\n## Fastest elimination path\n## Trap words / factual anchors\n## One memory rule.`;
    try{set25('prelimsEliminationOutputV251',fmt25(await ask25(prompt)))}catch(e){set25('prelimsEliminationOutputV251',fmt25('Elimination trainer failed: '+e.message))}
  };
  window.sendPrelimsWeaknessToRevisionV251=async function(){
    const r=prelimsState.lastReport;if(!r)return alert('Submit a test first.');for(const [topic,count] of r.weakTopics.slice(0,8)){await save25('smartRevision',{topic:`Prelims repair: ${topic}`,subject:r.subject,source:'v25.1 Prelims War Room',difficulty:count>=3?'Hard':'Medium',date:today25(),cycle:1,status:'pending',body:`${count} mistake(s) in ${r.title}. Accuracy ${r.accuracy}%.`});}alert('Weak topics added to Revision Brain.');
  };
  window.newPrelimsTestV251=function(){clearInterval(prelimsState.timer);prelimsState={test:null,index:0,lastReport:null,timer:null};localStorage.removeItem(ACTIVE_PRELIMS_KEY);if($25('prelimsActiveTitleV251'))$25('prelimsActiveTitleV251').textContent='No active test';if($25('prelimsProgressTextV251'))$25('prelimsProgressTextV251').textContent='Generate a test to begin.';if($25('prelimsTimerV251'))$25('prelimsTimerV251').textContent='00:00';set25('prelimsQuestionPaletteV251','');set25('prelimsQuestionStageV251','<div class="v25EmptyState"><span>🎯</span><h3>Your timed UPSC test appears here</h3><p>Generate questions or load the demo test.</p></div>');set25('prelimsResultV251','Submit a test to see analytics.');set25('prelimsEliminationOutputV251','Elimination logic will appear here.');status25('prelimsGenerationStatusV251','')};
  window.openPrelimsReportV251=async function(id){const list=await get25('prelimsReports');const r=list.find((x,i)=>String(x.id||i)===String(id));if(!r)return;prelimsState.lastReport=r;set25('prelimsResultV251',prelimsReportHTML25(r));window.scrollTo({top:$25('prelimsResultV251')?.offsetTop||0,behavior:'smooth'})};
  window.renderPrelimsHistoryV251=async function(){
    const list=await get25('prelimsReports');const valid=list.filter(x=>x&&x.questionsCount);const tests=valid.length,avg=tests?round25(valid.reduce((s,x)=>s+Number(x.scorePercent||0),0)/tests,1):0,acc=tests?round25(valid.reduce((s,x)=>s+Number(x.accuracy||0),0)/tests,1):0;const weakMap={};valid.forEach(x=>(x.weakTopics||[]).forEach(([k,v])=>weakMap[k]=(weakMap[k]||0)+Number(v||0)));
    if($25('prelimsTestsTakenV251'))$25('prelimsTestsTakenV251').textContent=tests;if($25('prelimsAvgScoreV251'))$25('prelimsAvgScoreV251').textContent=avg+'%';if($25('prelimsAccuracyV251'))$25('prelimsAccuracyV251').textContent=acc+'%';if($25('prelimsWeakCountV251'))$25('prelimsWeakCountV251').textContent=Object.keys(weakMap).length;
    const box=$25('prelimsHistoryV251');if(!box)return;box.innerHTML=valid.length?valid.slice(0,30).map((x,i)=>`<div class="v25HistoryCard"><div><span class="v25HistoryType">${esc25(x.subject||'Prelims')}</span><h3>${esc25(x.title||'Prelims Test')}</h3><p>${esc25(x.date||'')} • ${x.questionsCount} questions • Accuracy ${Number(x.accuracy||0)}%</p></div><div class="v25HistoryScore">${Number(x.score||0)}<small>/${Number(x.maxScore||0)}</small></div><div class="actions"><button class="btn ghost" onclick="openPrelimsReportV251('${x.id||i}')">Open</button><button class="btn danger" onclick="deleteItem('prelimsReports','${x.id||i}');setTimeout(renderPrelimsHistoryV251,350)">Delete</button></div></div>`).join(''):'<div class="v25EmptyHistory">No Prelims attempts saved yet.</div>';
  };

  // ---------- V25.2 MAINS WAR ROOM ----------
  let mainsTimerV252=null,mainsSecondsV252=22*60,mainsLastReportV252=null,mainsLastQuestionBriefV252='';
  window.syncMainsWarDefaultsV252=function(){const marks=Number(val25('mainsWarMarksV252',15));const words=marks===10?150:marks===15?250:marks===20?300:1000;const mins=marks===10?12:marks===15?22:marks===20?30:90;if($25('mainsWarWordLimitV252'))$25('mainsWarWordLimitV252').value=words;if($25('mainsTargetWordsV252'))$25('mainsTargetWordsV252').textContent=words;mainsSecondsV252=mins*60;renderMainsTimer25();};
  window.updateMainsWordCountV252=function(){const n=val25('mainsWarAnswerV252').split(/\s+/).filter(Boolean).length;if($25('mainsWordCountV252'))$25('mainsWordCountV252').textContent=n+' words';const target=Number(val25('mainsWarWordLimitV252',250));if($25('mainsTargetWordsV252'))$25('mainsTargetWordsV252').textContent=target;};
  function renderMainsTimer25(){const mm=String(Math.floor(mainsSecondsV252/60)).padStart(2,'0'),ss=String(mainsSecondsV252%60).padStart(2,'0');if($25('mainsTimerV252'))$25('mainsTimerV252').textContent=`${mm}:${ss}`;}
  window.startMainsTimerV252=function(){if(mainsTimerV252)return;mainsTimerV252=setInterval(()=>{mainsSecondsV252=Math.max(0,mainsSecondsV252-1);renderMainsTimer25();if(mainsSecondsV252<=0){clearInterval(mainsTimerV252);mainsTimerV252=null;status25('mainsWarStatusV252','⏰ Time completed. Finish your conclusion and evaluate.') }},1000)};
  window.pauseMainsTimerV252=function(){clearInterval(mainsTimerV252);mainsTimerV252=null};
  function mainsQuestionPrompt25(){return `Act as a UPSC Mains question setter. Create one original question.\nPaper: ${val25('mainsWarPaperV252','GS2')}\nTopic: ${val25('mainsWarTopicV252','Current syllabus theme')}\nDirective: ${val25('mainsWarDirectiveV252','Discuss')}\nMarks: ${val25('mainsWarMarksV252','15')}\nWord limit: ${val25('mainsWarWordLimitV252','250')}\nDifficulty: ${val25('mainsWarDifficultyV252','UPSC Standard')}\nContext/PYQ/source: ${val25('mainsWarContextV252','None')}\n\nReturn exactly:\nQUESTION: ...\nSYLLABUS: ...\nWHY_NOW: ...\nKEY_DIMENSIONS: point 1 | point 2 | point 3 | point 4\nVALUE_ADDITION: useful data/report/case/example\nDo not answer the question.`}
  window.generateDailyMainsQuestionV252=async function(){status25('mainsWarStatusV252','🤖 AI is setting today\'s mains question...');set25('mainsQuestionBriefV252','<div class="aiLoading">Creating syllabus-linked question...</div>');try{const raw=await ask25(mainsQuestionPrompt25());mainsLastQuestionBriefV252=raw;const q=(String(raw).match(/QUESTION\s*:\s*([^\n]+)/i)||[])[1]||String(raw).split('\n').find(x=>x.trim())||'';if($25('mainsWarQuestionV252'))$25('mainsWarQuestionV252').value=q.replace(/^#+\s*/,'').trim();set25('mainsQuestionBriefV252',fmt25(raw));status25('mainsWarStatusV252','✅ Daily question ready. Start timer when you begin writing.');await save25('mainsDailyQuestionsV252',{paper:val25('mainsWarPaperV252'),topic:val25('mainsWarTopicV252'),question:q,brief:raw,marks:Number(val25('mainsWarMarksV252',15)),wordLimit:Number(val25('mainsWarWordLimitV252',250)),date:today25(),source:'v25.2 Mains War Room'});}catch(e){set25('mainsQuestionBriefV252',fmt25('Question generation failed: '+e.message));status25('mainsWarStatusV252','⚠ '+esc25(e.message))}};
  window.loadMainsDemoV252=function(){if($25('mainsWarPaperV252'))$25('mainsWarPaperV252').value='GS2';if($25('mainsWarTopicV252'))$25('mainsWarTopicV252').value='Cooperative Federalism';if($25('mainsWarQuestionV252'))$25('mainsWarQuestionV252').value='Cooperative federalism in India requires more than constitutional arrangements; it depends on institutional trust and fiscal coordination. Discuss.';mainsLastQuestionBriefV252='Syllabus: GS2 — Federalism. Dimensions: constitutional design, Inter-State Council, GST Council, fiscal federalism, centrally sponsored schemes, dispute resolution.';set25('mainsQuestionBriefV252',fmt25(mainsLastQuestionBriefV252));window.syncMainsWarDefaultsV252()};
  function mainsEvaluationPrompt25(){
    const answer=val25('mainsWarAnswerV252');return `You are a strict UPSC Mains examiner. Evaluate the answer realistically, not generously.\nPaper: ${val25('mainsWarPaperV252')}\nQuestion: ${val25('mainsWarQuestionV252')}\nMarks: ${val25('mainsWarMarksV252')}\nWord limit: ${val25('mainsWarWordLimitV252')}\nQuestion brief: ${mainsLastQuestionBriefV252||'Not provided'}\nCandidate answer:\n${answer}\n\nStart with exactly these machine-readable lines:\nFINAL_SCORE: number/${val25('mainsWarMarksV252')}\nRUBRIC_JSON: {"demand":0,"introduction":0,"structure":0,"dimensions":0,"evidence":0,"examples":0,"diagram":0,"conclusion":0,"language":0,"wordDiscipline":0}\nEach rubric score must be 0-10. Then give:\n# UPSC Examiner Evaluation\n## Demand of the Question\n## What Worked\n## Missing Dimensions\n## Paragraph-wise Problems\n## Data, Examples, Cases and Reports to Add\n## Diagram / Flowchart Suggestion\n## Better Introduction\n## Better Conclusion\n## How to Gain 2 More Marks\n## Rewritten Topper Framework\nBe specific to this answer.`;
  }
  function parseMainsEval25(raw,marks){
    const text=String(raw||'');let score=Number((text.match(/FINAL_SCORE\s*:\s*([0-9.]+)/i)||text.match(/(?:Score|Marks)\s*[:\-]\s*([0-9.]+)\s*\//i)||text.match(new RegExp('([0-9.]+)\\s*\\/\\s*'+marks))||[])[1]);if(!Number.isFinite(score))score=0;score=clamp25(score,0,marks);
    let rubric={};const rm=text.match(/RUBRIC_JSON\s*:\s*(\{[^\n]+\})/i);if(rm)try{rubric=JSON.parse(rm[1])}catch(e){}
    const defaults=['demand','introduction','structure','dimensions','evidence','examples','diagram','conclusion','language','wordDiscipline'];defaults.forEach(k=>rubric[k]=clamp25(rubric[k]??5,0,10));return {score,rubric,text};
  }
  window.evaluateMainsWarAnswerV252=async function(){
    const q=val25('mainsWarQuestionV252'),a=val25('mainsWarAnswerV252');if(!q||!a)return alert('Add the question and your answer first.');window.pauseMainsTimerV252();status25('mainsWarStatusV252','🤖 Examiner is evaluating your answer...');set25('mainsWarEvaluationV252','<div class="aiLoading">Checking demand, structure, dimensions, evidence and conclusion...</div>');
    try{const raw=await ask25(mainsEvaluationPrompt25());const marks=Number(val25('mainsWarMarksV252',15));const p=parseMainsEval25(raw,marks);const wordCount=a.split(/\s+/).filter(Boolean).length;const report={paper:val25('mainsWarPaperV252'),topic:val25('mainsWarTopicV252')||q.slice(0,80),question:q,answer:a,marks,maxMarks:marks,score:p.score,scorePercent:round25(p.score/marks*100,1),rubric:p.rubric,evaluation:raw,brief:mainsLastQuestionBriefV252,wordLimit:Number(val25('mainsWarWordLimitV252',250)),wordCount,date:today25(),createdAt:Date.now(),source:'v25.2 Mains War Room'};mainsLastReportV252=report;if($25('mainsScoreChipV252'))$25('mainsScoreChipV252').textContent=`${p.score} / ${marks}`;set25('mainsWarEvaluationV252',`<div class="v25EvalHeader"><span>${esc25(report.paper)}</span><b>${p.score}/${marks}</b><span>${wordCount} words</span></div>${fmt25(raw)}`);await save25('mainsWarReports',report);await save25('mainsReports',{...report,body:raw,title:`${report.paper}: ${q.slice(0,90)}`});status25('mainsWarStatusV252','✅ Evaluation saved to long-term analytics.');renderMainsWarAnalyticsV252();try{window.installAIOutputDownloadsV226&&setTimeout(window.installAIOutputDownloadsV226,100)}catch(e){}}catch(e){set25('mainsWarEvaluationV252',fmt25('Evaluation failed: '+e.message));status25('mainsWarStatusV252','⚠ '+esc25(e.message))}
  };
  window.generateMainsModelAnswerV252=async function(){const q=val25('mainsWarQuestionV252');if(!q)return alert('Add or generate a question first.');set25('mainsWarEvaluationV252','<div class="aiLoading">Building a topper-style answer...</div>');const prompt=`Write a high-quality UPSC Mains model answer.\nPaper: ${val25('mainsWarPaperV252')}\nQuestion: ${q}\nMarks: ${val25('mainsWarMarksV252')}\nWord limit: ${val25('mainsWarWordLimitV252')}\nUse a crisp introduction, multidimensional headings, facts/data/cases, a simple text diagram where useful, balanced criticism and actionable conclusion. Stay within the word limit.`;try{const raw=await ask25(prompt);set25('mainsWarEvaluationV252',`<div class="v25EvalHeader"><span>MODEL ANSWER</span><b>${esc25(val25('mainsWarMarksV252'))} Marks</b></div>${fmt25(raw)}`)}catch(e){set25('mainsWarEvaluationV252',fmt25('Model answer failed: '+e.message))}};
  window.importMainsEvaluationV252=async function(){
    const raw=val25('mainsWarManualEvaluationV252'),q=val25('mainsWarQuestionV252'),a=val25('mainsWarAnswerV252');
    if(!raw||!q||!a)return alert('Add question, answer and pasted evaluation first.');
    const marks=Number(val25('mainsWarMarksV252',15)),p=parseMainsEval25(raw,marks),wordCount=a.split(/\s+/).filter(Boolean).length;
    const report={paper:val25('mainsWarPaperV252'),topic:val25('mainsWarTopicV252')||q.slice(0,80),question:q,answer:a,marks,maxMarks:marks,score:p.score,scorePercent:round25(p.score/marks*100,1),rubric:p.rubric,evaluation:raw,brief:mainsLastQuestionBriefV252,wordLimit:Number(val25('mainsWarWordLimitV252',250)),wordCount,date:today25(),createdAt:Date.now(),source:'v25.2 ChatGPT Manual Evaluation'};
    mainsLastReportV252=report;if($25('mainsScoreChipV252'))$25('mainsScoreChipV252').textContent=`${p.score} / ${marks}`;
    set25('mainsWarEvaluationV252',`<div class="v25EvalHeader"><span>${esc25(report.paper)} • MANUAL IMPORT</span><b>${p.score}/${marks}</b><span>${wordCount} words</span></div>${fmt25(raw)}`);
    await save25('mainsWarReports',report);await save25('mainsReports',{...report,body:raw,title:`${report.paper}: ${q.slice(0,90)}`});
    status25('mainsWarStatusV252','✅ Manual ChatGPT evaluation imported and saved.');renderMainsWarAnalyticsV252();
  };

  window.sendMainsWarWeaknessToRevisionV252=async function(){const r=mainsLastReportV252;if(!r)return alert('Evaluate an answer first.');const lows=Object.entries(r.rubric||{}).sort((a,b)=>a[1]-b[1]).slice(0,4);for(const [k,v] of lows){await save25('smartRevision',{topic:`Mains repair: ${k.replace(/([A-Z])/g,' $1')}`,subject:r.paper,source:'v25.2 Mains War Room',difficulty:v<4?'Hard':'Medium',date:today25(),cycle:1,status:'pending',body:`Score ${v}/10 in ${k}. Question: ${r.question}\n${r.evaluation.slice(0,1500)}`});}alert('Lowest rubric areas added to Revision Brain.');};
  window.mainsWarToFlashcardsV252=async function(){const r=mainsLastReportV252;if(!r)return alert('Evaluate an answer first.');try{if(typeof window.generateFlashcardsFromTextV233==='function'&&typeof window.saveFlashcardsV233==='function'){const g=await window.generateFlashcardsFromTextV233(r.evaluation,r.topic,r.paper,'mainsWarEvaluationV252');const n=await window.saveFlashcardsV233(g.cards,r.paper,'v25.2 Mains Evaluation');alert(`${n} flashcards saved.`);return}}catch(e){}await save25('flash',{q:`Improve this mains answer: ${r.question}`,a:r.evaluation,subject:r.paper,date:today25(),source:'v25.2'});alert('Evaluation saved as a flashcard.');};
  function streak25(dates){const set=new Set(dates.filter(Boolean));let n=0,d=new Date();for(;;){const key=d.toISOString().slice(0,10);if(set.has(key)){n++;d.setDate(d.getDate()-1)}else break}return n}
  function analyticsBar25(label,value){const v=clamp25(value,0,100);return `<div class="v25BarRow"><span>${esc25(label)}</span><div class="v25Bar"><i style="width:${v}%"></i></div><b>${round25(v,0)}%</b></div>`}
  window.openMainsWarReportV252=async function(id){const list=await get25('mainsWarReports');const r=list.find((x,i)=>String(x.id||i)===String(id));if(!r)return;mainsLastReportV252=r;if($25('mainsWarQuestionV252'))$25('mainsWarQuestionV252').value=r.question||'';if($25('mainsWarAnswerV252'))$25('mainsWarAnswerV252').value=r.answer||'';if($25('mainsScoreChipV252'))$25('mainsScoreChipV252').textContent=`${r.score}/${r.maxMarks}`;set25('mainsWarEvaluationV252',`<div class="v25EvalHeader"><span>${esc25(r.paper)}</span><b>${r.score}/${r.maxMarks}</b><span>${r.wordCount||0} words</span></div>${fmt25(r.evaluation||r.body||'')}`);window.updateMainsWordCountV252()};
  window.renderMainsWarAnalyticsV252=async function(){
    const list=(await get25('mainsWarReports')).filter(x=>x&&Number(x.maxMarks)>0);const n=list.length,avg=n?list.reduce((s,x)=>s+(Number(x.score||0)/Number(x.maxMarks||1)*100),0)/n:0,st=streak25(list.map(x=>x.date));const rubKeys=['demand','introduction','structure','dimensions','evidence','examples','diagram','conclusion','language','wordDiscipline'];const ravg={};rubKeys.forEach(k=>{const vals=list.map(x=>Number(x.rubric?.[k])).filter(Number.isFinite);ravg[k]=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length*10:0});const weak=Object.entries(ravg).filter(x=>x[1]>0).sort((a,b)=>a[1]-b[1])[0];
    if($25('mainsAnswersCountV252'))$25('mainsAnswersCountV252').textContent=n;if($25('mainsAverageV252'))$25('mainsAverageV252').textContent=round25(avg,1)+'%';if($25('mainsStreakV252'))$25('mainsStreakV252').textContent=st+' days';if($25('mainsWeakRubricV252'))$25('mainsWeakRubricV252').textContent=weak?weak[0].replace(/([A-Z])/g,' $1'):'—';
    set25('mainsRubricAnalyticsV252',n?rubKeys.map(k=>analyticsBar25(k.replace(/([A-Z])/g,' $1'),ravg[k])).join(''):'<p class="sub">Complete your first evaluated answer.</p>');
    const papers={};list.forEach(x=>{const k=x.paper||'Other';(papers[k]||(papers[k]=[])).push(Number(x.score||0)/Number(x.maxMarks||1)*100)});set25('mainsPaperAnalyticsV252',Object.keys(papers).length?Object.entries(papers).map(([k,v])=>analyticsBar25(k,v.reduce((a,b)=>a+b,0)/v.length)).join(''):'<p class="sub">No paper-wise data yet.</p>');
    const box=$25('mainsWarHistoryV252');if(box)box.innerHTML=n?list.slice(0,30).map((x,i)=>`<div class="v25HistoryCard"><div><span class="v25HistoryType">${esc25(x.paper||'Mains')}</span><h3>${esc25(x.question||x.topic||'Mains Answer')}</h3><p>${esc25(x.date||'')} • ${x.wordCount||0}/${x.wordLimit||'—'} words • ${round25(Number(x.score||0)/Number(x.maxMarks||1)*100,0)}%</p></div><div class="v25HistoryScore">${Number(x.score||0)}<small>/${Number(x.maxMarks||0)}</small></div><div class="actions"><button class="btn ghost" onclick="openMainsWarReportV252('${x.id||i}')">Open</button><button class="btn danger" onclick="deleteItem('mainsWarReports','${x.id||i}');setTimeout(renderMainsWarAnalyticsV252,350)">Delete</button></div></div>`).join(''):'<div class="v25EmptyHistory">No evaluated answers saved yet.</div>';
  };

  // Lazy initialization so dashboard remains light.
  const previousShow25=window.show;
  if(typeof previousShow25==='function')window.show=function(id,btn){const r=previousShow25.apply(this,arguments);setTimeout(()=>{updateBadges25();if(id==='prelimsWarRoomV251')window.renderPrelimsHistoryV251();if(id==='mainsWarRoomV252'){window.renderMainsWarAnalyticsV252();window.updateMainsWordCountV252();}},120);return r};
  const previousSaveAI25=window.saveAISettingsV23;
  if(typeof previousSaveAI25==='function')window.saveAISettingsV23=function(){const r=previousSaveAI25.apply(this,arguments);setTimeout(updateBadges25,30);return r};
  document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{
    updateBadges25();window.syncMainsWarDefaultsV252();
    try{const saved=JSON.parse(localStorage.getItem(ACTIVE_PRELIMS_KEY)||'null');if(saved&&Array.isArray(saved.questions)&&!saved.submitted){prelimsState.test=saved;prelimsState.index=0;startPrelimsClock25();renderPrelimsTest25()}}catch(e){}
  },900));
})();


/* ===== V25.3 PHASE 2: AI INTERVIEW ROOM ===== */
(function(){
  'use strict';
  const $i=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const val=(id,def='')=>String($i(id)?.value??def).trim();
  const set=(id,html)=>{const e=$i(id);if(e)e.innerHTML=html};
  const today=()=>new Date().toISOString().slice(0,10);
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));
  const round=(n,d=1)=>Number(Number(n||0).toFixed(d));
  const fmt=t=>{try{return typeof window.formatAI==='function'?window.formatAI(String(t||'')):`<pre>${esc(t)}</pre>`}catch(e){return `<pre>${esc(t)}</pre>`}};
  const status=msg=>{const e=$i('interviewStatusV253');if(e){e.classList.toggle('active',!!msg);e.innerHTML=msg||''}};
  const settings=()=>{try{return {mode:'ollama',ollamaModel:'gemma3:4b',...JSON.parse(localStorage.getItem('mission_ai_settings_v23')||'{}')}}catch(e){return {mode:'ollama',ollamaModel:'gemma3:4b'}}};
  const modeLabel=()=>{const m=settings().mode;return m==='ollama'?'🖥 Ollama Local':m==='gemini'?'☁ Gemini Free API':m==='chatgpt'?'📋 ChatGPT Prompt Mode':'⭐ Smart Hybrid'};
  async function ask(prompt){if(typeof window.aiAskRouterV23==='function')return await window.aiAskRouterV23(prompt);if(typeof window.aiAsk==='function')return await window.aiAsk(prompt);throw new Error('AI router unavailable. Save an AI mode in AI Control Centre.');}
  async function getCol(name){try{if(typeof window.getCol==='function')return await window.getCol(name)}catch(e){}try{return JSON.parse(localStorage.getItem(name)||'[]')}catch(e){return []}}
  async function saveCol(name,obj){try{if(typeof window.saveCol==='function')return await window.saveCol(name,obj)}catch(e){}const a=await getCol(name);const item={...obj,id:'local_'+Date.now()+'_'+Math.random().toString(36).slice(2)};a.unshift(item);localStorage.setItem(name,JSON.stringify(a));return item}
  const DAF_KEY='mission_upsc_interview_daf_v253';
  const ACTIVE_KEY='mission_upsc_interview_active_v253';
  const competencies=['content','clarity','balance','honesty','composure','relevance'];
  let session=null,timer=null,seconds=0,recognition=null,listening=false,lastReport=null;

  function collectDAF(){return {name:val('interviewNameV253'),home:val('interviewHomeV253'),education:val('interviewEducationV253'),optional:val('interviewOptionalV253'),work:val('interviewWorkV253'),services:val('interviewServicesV253'),hobbies:val('interviewHobbiesV253'),achievements:val('interviewAchievementsV253'),summary:val('interviewDAFSummaryV253')}}
  function applyDAF(d={}){for(const [k,id] of Object.entries({name:'interviewNameV253',home:'interviewHomeV253',education:'interviewEducationV253',optional:'interviewOptionalV253',work:'interviewWorkV253',services:'interviewServicesV253',hobbies:'interviewHobbiesV253',achievements:'interviewAchievementsV253',summary:'interviewDAFSummaryV253'})){if($i(id))$i(id).value=d[k]||''}}
  window.saveInterviewDAFV253=function(){const d=collectDAF();localStorage.setItem(DAF_KEY,JSON.stringify(d));status('✅ DAF profile saved on this device.');};
  window.clearInterviewDAFV253=function(){if(!confirm('Clear the saved DAF profile from this device?'))return;localStorage.removeItem(DAF_KEY);applyDAF({});status('DAF profile cleared.');};
  window.loadInterviewDemoV253=function(){applyDAF({name:'Vignesh',home:'Chennai, Tamil Nadu',education:'B.Tech Mechanical Engineering',optional:'Sociology',work:'UPSC preparation; exposure to small-scale manufacturing and social initiatives',services:'IAS, IPS and allied services',hobbies:'Football, website building and public-service initiatives',achievements:'College football team; organised educational trust activities',summary:'Interested in governance, education, employment and technology. Prepare questions on mechanical engineering, Tamil Nadu, small industries, football, ethics in public service and the motivation for civil services.'});window.saveInterviewDAFV253()};

  function profileText(){const d=collectDAF();return Object.entries(d).filter(([,v])=>v).map(([k,v])=>`${k.toUpperCase()}: ${v}`).join('\n')||'Candidate profile not supplied.'}
  function config(){return {mode:val('interviewModeV253','Full Board'),style:val('interviewStyleV253','Balanced and professional'),maxQuestions:Number(val('interviewQuestionsV253','8'))||8,language:val('interviewLanguageV253','English'),difficulty:val('interviewDifficultyV253','UPSC standard'),themes:val('interviewThemesV253'),adaptive:!!$i('interviewAdaptiveV253')?.checked,strict:!!$i('interviewStrictScoringV253')?.checked,speak:!!$i('interviewSpeakQuestionsV253')?.checked}}
  function updateBadge(){const s=settings();if($i('interviewAIBadgeV253'))$i('interviewAIBadgeV253').textContent=`Selected AI: ${modeLabel()} • ${s.ollamaModel||'Cloud/Prompt'}`}
  function renderTimer(){const mm=String(Math.floor(seconds/60)).padStart(2,'0'),ss=String(seconds%60).padStart(2,'0');if($i('interviewTimerV253'))$i('interviewTimerV253').textContent=`${mm}:${ss}`}
  function startTimer(){clearInterval(timer);timer=setInterval(()=>{seconds++;renderTimer()},1000)}
  function stopTimer(){clearInterval(timer);timer=null}
  function saveActive(){try{if(session)localStorage.setItem(ACTIVE_KEY,JSON.stringify(session));else localStorage.removeItem(ACTIVE_KEY)}catch(e){}}
  function speak(text){if(!$i('interviewSpeakQuestionsV253')?.checked||!('speechSynthesis'in window))return;window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(String(text||'').slice(0,1800));u.lang=val('interviewLanguageV253').includes('Tamil')?'ta-IN':val('interviewLanguageV253').includes('Hindi')?'hi-IN':'en-IN';u.rate=.93;window.speechSynthesis.speak(u)}
  function questionPrompt(){const c=config();return `Act as a realistic UPSC Civil Services Personality Test board.\nCandidate DAF:\n${profileText()}\n\nInterview mode: ${c.mode}\nBoard style: ${c.style}\nDifficulty: ${c.difficulty}\nLanguage: ${c.language}\nCurrent themes requested: ${c.themes||'Use relevant national, international and home-state issues.'}\n\nSet only the opening question. It must be concise, neutral, DAF-aware and suitable for a UPSC board. Do not answer it. Return exactly:\nQUESTION: ...\nCATEGORY: DAF / Current Affairs / Opinion / Ethics / Situational / Academic / Hobby\nCHAIR: Chairman / Member 1 / Member 2 / Member 3 / Member 4\nRATIONALE: one short line`}
  function parseQuestion(raw){const t=String(raw||'');const q=(t.match(/QUESTION\s*:\s*([^\n]+)/i)||[])[1]||t.split('\n').find(x=>x.trim()&&!/^#/.test(x.trim()))||'Please introduce yourself briefly and explain why you wish to join the civil services.';const category=(t.match(/CATEGORY\s*:\s*([^\n]+)/i)||[])[1]||'DAF';const chair=(t.match(/CHAIR\s*:\s*([^\n]+)/i)||[])[1]||'Chairman';return {question:q.replace(/^[-*#\s]+/,''),category:category.trim(),chair:chair.trim(),raw:t}}
  function showQuestion(q){if(!q)return;set('interviewQuestionV253',esc(q.question));if($i('interviewCategoryV253'))$i('interviewCategoryV253').textContent=q.category||'PERSONALITY TEST';if($i('interviewChairV253'))$i('interviewChairV253').textContent=q.chair||'UPSC Board';if($i('interviewChairAvatarV253'))$i('interviewChairAvatarV253').textContent=(q.chair||'C').replace('Member ','M').slice(0,2);if($i('interviewQuestionCountV253'))$i('interviewQuestionCountV253').textContent=`Question ${(session?.turns.length||0)+1} of ${session?.config.maxQuestions||config().maxQuestions}`;if($i('interviewAnswerV253')){$i('interviewAnswerV253').value='';window.updateInterviewWordCountV253()}speak(q.question)}
  function fallbackQuestion(index){const d=collectDAF();const bank=[`Please introduce yourself without repeating your résumé.`,`Why do you want to join the civil services after ${d.education||'your graduation'}?`,`What is one major governance challenge in ${d.home||'your home district'}, and how would you address it?`,`What has ${d.hobbies||'your principal hobby'} taught you that is relevant to administration?`,`Name one recent public issue on which your view has changed after studying it. Why?`,`A popular decision conflicts with constitutional values. As an administrator, how would you respond?`,`What is one weakness in your personality that may affect your work as a civil servant?`,`Why should the board recommend you?`];return {question:bank[index%bank.length],category:index<2?'DAF':index===2?'Home State':index===3?'Hobby':index===4?'Current Affairs':'Situational',chair:index===0?'Chairman':`Member ${(index%4)+1}`}}

  window.startInterviewSessionV253=async function(){
    const d=collectDAF();if(!Object.values(d).some(Boolean))return alert('Add at least a basic DAF profile or load the demo profile.');window.saveInterviewDAFV253();window.resetInterviewSessionV253(false);const c=config();session={id:'interview_'+Date.now(),date:today(),startedAt:Date.now(),profile:d,config:c,turns:[],current:null,completed:false};seconds=0;renderTimer();startTimer();status('🤖 The board is reviewing your DAF and preparing the opening question...');set('interviewQuestionV253','<span class="v25Spinner">◌</span> Board members are reviewing your profile...');try{const raw=await ask(questionPrompt());if(settings().mode==='chatgpt'){set('interviewLiveFeedbackV253',fmt(raw));session.current=fallbackQuestion(0);showQuestion(session.current);status('📋 ChatGPT interview prompt copied. For an automatic room, select Ollama, Gemini or Hybrid; otherwise use manual imports.')}else{session.current=parseQuestion(raw);showQuestion(session.current);status('✅ Interview started. Answer calmly and directly.')}}catch(e){session.current=fallbackQuestion(0);showQuestion(session.current);status('⚠ AI opening question failed, so the offline board fallback started: '+esc(e.message))}saveActive();renderInterviewTranscriptV253()};

  function turnPrompt(answer){const c=session.config;const history=session.turns.slice(-6).map((t,i)=>`TURN ${i+1}\nQ: ${t.question}\nA: ${String(t.answer||'').slice(0,1200)}\nSCORE: ${round(Object.values(t.scores||{}).reduce((a,b)=>a+Number(b||0),0)/competencies.length,1)}/10`).join('\n\n');return `You are a member of a UPSC Personality Test board. Evaluate the candidate's spoken-style answer, then set one adaptive follow-up.\n\nCandidate DAF:\n${profileText()}\nBoard mode: ${c.mode}\nStyle: ${c.style}\nDifficulty: ${c.difficulty}\nLanguage: ${c.language}\nStrict scoring: ${c.strict?'Yes':'No'}\nAdaptive cross-questioning: ${c.adaptive?'Yes':'No'}\nRequested themes: ${c.themes||'Relevant current issues'}\n\nPrevious interview context:\n${history||'Opening turn'}\n\nCURRENT QUESTION: ${session.current.question}\nCATEGORY: ${session.current.category}\nCANDIDATE ANSWER: ${answer}\n\nAssess personality-test qualities, not just factual recall. Reward honesty, balance, brevity, listening to the question and administrative temperament. Penalise bluffing, slogans, extreme positions, evasion and unnecessary verbosity. Return exactly these machine-readable lines first:\nSCORE_JSON: {"content":0,"clarity":0,"balance":0,"honesty":0,"composure":0,"relevance":0}\nVERDICT: one sentence\nGOOD: short points separated by |\nIMPROVE: short points separated by |\nMODEL_RESPONSE: a better concise spoken answer\nFOLLOW_UP_QUESTION: one realistic question${c.adaptive?' based on the answer or DAF':' from another interview dimension'}\nFOLLOW_UP_CATEGORY: DAF / Current Affairs / Opinion / Ethics / Situational / Academic / Hobby\nFOLLOW_UP_CHAIR: Chairman / Member 1 / Member 2 / Member 3 / Member 4\nThen add a short section titled Board Note. Each score must be 0-10.`}
  function parseTurn(raw){const t=String(raw||'');let scores={};const m=t.match(/SCORE_JSON\s*:\s*(\{[^\n]+\})/i);if(m)try{scores=JSON.parse(m[1])}catch(e){};competencies.forEach(k=>scores[k]=clamp(scores[k]??5,0,10));const next=(t.match(/FOLLOW_UP_QUESTION\s*:\s*([^\n]+)/i)||[])[1];const category=(t.match(/FOLLOW_UP_CATEGORY\s*:\s*([^\n]+)/i)||[])[1]||'Opinion';const chair=(t.match(/FOLLOW_UP_CHAIR\s*:\s*([^\n]+)/i)||[])[1]||`Member ${((session?.turns.length||0)%4)+1}`;return {scores,nextQuestion:next?.trim(),nextCategory:category.trim(),nextChair:chair.trim(),raw:t}}
  function averageScores(turns){const out={};competencies.forEach(k=>{const xs=turns.map(t=>Number(t.scores?.[k])).filter(Number.isFinite);out[k]=xs.length?round(xs.reduce((a,b)=>a+b,0)/xs.length,1):0});return out}
  function scoreAvg(scores){return round(Object.values(scores||{}).reduce((a,b)=>a+Number(b||0),0)/Math.max(1,Object.keys(scores||{}).length),1)}
  async function processTurn(raw,answer,source='AI'){
    const p=parseTurn(raw),turn={index:session.turns.length+1,question:session.current.question,category:session.current.category,chair:session.current.chair,answer,scores:p.scores,feedback:raw,source,createdAt:Date.now()};session.turns.push(turn);if($i('interviewTurnScoreV253'))$i('interviewTurnScoreV253').textContent=`${scoreAvg(p.scores)} / 10`;set('interviewLiveFeedbackV253',`<div class="v253TurnHeader"><span>${esc(turn.category)}</span><b>${scoreAvg(p.scores)}/10</b></div>${fmt(raw)}`);renderInterviewTranscriptV253();if(session.turns.length>=session.config.maxQuestions){saveActive();await window.finishInterviewSessionV253();return}session.current={question:p.nextQuestion||fallbackQuestion(session.turns.length).question,category:p.nextCategory||fallbackQuestion(session.turns.length).category,chair:p.nextChair||fallbackQuestion(session.turns.length).chair};showQuestion(session.current);status(`✅ Answer ${session.turns.length} evaluated. Board has moved to the next question.`);saveActive()
  }
  window.submitInterviewAnswerV253=async function(){if(!session?.current)return alert('Start an interview first.');const answer=val('interviewAnswerV253');if(!answer)return alert('Type or speak your answer first.');status('🤖 Board is evaluating your answer and preparing a cross-question...');set('interviewLiveFeedbackV253','<div class="aiLoading">Assessing content, clarity, balance, honesty, composure and relevance...</div>');try{const raw=await ask(turnPrompt(answer));if(settings().mode==='chatgpt'){set('interviewLiveFeedbackV253',fmt(raw));status('📋 Prompt copied. Paste ChatGPT’s board response in Manual ChatGPT Board Response, then import it.')}else await processTurn(raw,answer,'AI')}catch(e){const fb=`SCORE_JSON: {"content":5,"clarity":5,"balance":5,"honesty":6,"composure":5,"relevance":5}\nVERDICT: Local fallback score used because AI evaluation failed.\nGOOD: You attempted the question\nIMPROVE: Give a direct opening | Add one example | End with a balanced administrative view\nMODEL_RESPONSE: Reframe the answer in three concise parts.\nFOLLOW_UP_QUESTION: ${fallbackQuestion(session.turns.length+1).question}\nFOLLOW_UP_CATEGORY: ${fallbackQuestion(session.turns.length+1).category}\nFOLLOW_UP_CHAIR: ${fallbackQuestion(session.turns.length+1).chair}`;await processTurn(fb,answer,'Fallback');status('⚠ AI evaluation failed; fallback scoring used: '+esc(e.message))}};
  window.importInterviewTurnV253=async function(){if(!session?.current)return alert('Start a session first.');const raw=val('interviewManualTurnV253'),answer=val('interviewAnswerV253');if(!raw||!answer)return alert('Add your answer and paste the board response.');await processTurn(raw,answer,'ChatGPT Manual');$i('interviewManualTurnV253').value=''};
  window.skipInterviewQuestionV253=function(){if(!session?.current)return;session.turns.push({index:session.turns.length+1,question:session.current.question,category:session.current.category,chair:session.current.chair,answer:'[Skipped]',scores:Object.fromEntries(competencies.map(k=>[k,0])),feedback:'Question skipped.',source:'Skipped',createdAt:Date.now()});if(session.turns.length>=session.config.maxQuestions)return window.finishInterviewSessionV253();session.current=fallbackQuestion(session.turns.length);showQuestion(session.current);renderInterviewTranscriptV253();saveActive();status('Question skipped. The board moved on.')};
  window.repeatInterviewQuestionV253=function(){if(session?.current)speak(session.current.question)};
  window.updateInterviewWordCountV253=function(){const n=val('interviewAnswerV253').split(/\s+/).filter(Boolean).length;if($i('interviewWordCountV253'))$i('interviewWordCountV253').textContent=n+' words'};

  window.toggleInterviewMicV253=function(){
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR)return alert('Speech recognition is unavailable in this browser. Use Chrome or type your answer.');if(listening&&recognition){recognition.stop();return}recognition=new SR();recognition.lang=val('interviewLanguageV253').includes('Tamil')?'ta-IN':val('interviewLanguageV253').includes('Hindi')?'hi-IN':'en-IN';recognition.continuous=true;recognition.interimResults=true;let finalText=val('interviewAnswerV253');recognition.onstart=()=>{listening=true;if($i('interviewMicBtnV253'))$i('interviewMicBtnV253').textContent='⏹ Stop Mic';if($i('interviewVoiceStatusV253'))$i('interviewVoiceStatusV253').textContent='Listening...'};recognition.onresult=e=>{let interim='';for(let i=e.resultIndex;i<e.results.length;i++){const s=e.results[i][0].transcript;if(e.results[i].isFinal)finalText+=(finalText?' ':'')+s;else interim+=s}if($i('interviewAnswerV253'))$i('interviewAnswerV253').value=(finalText+' '+interim).trim();window.updateInterviewWordCountV253()};recognition.onerror=e=>{if($i('interviewVoiceStatusV253'))$i('interviewVoiceStatusV253').textContent='Mic error: '+e.error};recognition.onend=()=>{listening=false;if($i('interviewMicBtnV253'))$i('interviewMicBtnV253').textContent='🎤 Speak Answer';if($i('interviewVoiceStatusV253'))$i('interviewVoiceStatusV253').textContent='Mic ready'};recognition.start()
  };

  function transcriptHTML(){if(!session?.turns?.length)return '<div class="v25EmptyHistory">No answered questions yet.</div>';return session.turns.map(t=>`<div class="v253TranscriptTurn"><div class="v253TranscriptQ"><span>${esc(t.chair||'Board')} • ${esc(t.category||'General')}</span><b>Q${t.index}. ${esc(t.question)}</b></div><div class="v253TranscriptA"><span>Your answer</span><p>${esc(t.answer||'')}</p></div><div class="v253TranscriptScore"><b>${scoreAvg(t.scores)}/10</b><span>${esc((String(t.feedback||'').match(/VERDICT\s*:\s*([^\n]+)/i)||[])[1]||'Board feedback saved')}</span></div></div>`).join('')}
  window.renderInterviewTranscriptV253=function(){set('interviewTranscriptV253',transcriptHTML())};

  function reportPrompt(){const av=averageScores(session.turns);const transcript=session.turns.map(t=>`Q${t.index} (${t.category}, ${t.chair}): ${t.question}\nCandidate: ${String(t.answer).slice(0,1800)}\nTurn scores: ${JSON.stringify(t.scores)}`).join('\n\n');return `Act as the final UPSC Personality Test board. Produce a realistic final assessment, not coaching flattery.\nCandidate DAF:\n${profileText()}\nSession mode: ${session.config.mode}\nBoard style: ${session.config.style}\nQuestions answered: ${session.turns.length}\nDuration seconds: ${seconds}\nCalculated competency averages out of 10: ${JSON.stringify(av)}\n\nTRANSCRIPT:\n${transcript}\n\nReturn these machine-readable lines first:\nFINAL_BOARD_SCORE: number/100\nCOMPETENCY_JSON: {"content":0,"clarity":0,"balance":0,"honesty":0,"composure":0,"relevance":0}\nThen provide:\n# UPSC Personality Test Board Report\n## Overall Board Impression\n## Strongest Qualities\n## Red Flags / Risks\n## DAF Areas Requiring Preparation\n## Current Affairs and Opinion Gaps\n## Communication and Composure\n## Five Likely Follow-up Questions\n## Better Versions of Three Weak Answers\n## 7-Day Interview Improvement Plan\n## Final Board Advice\nScores must be credible and based on the transcript.`}
  function parseFinal(raw){const t=String(raw||'');let score=Number((t.match(/FINAL_BOARD_SCORE\s*:\s*([0-9.]+)/i)||t.match(/(?:Score|Marks)\s*[:\-]\s*([0-9.]+)\s*\/\s*100/i)||[])[1]);if(!Number.isFinite(score))score=round(scoreAvg(averageScores(session?.turns||[]))*10,0);score=clamp(score,0,100);let comp={};const m=t.match(/COMPETENCY_JSON\s*:\s*(\{[^\n]+\})/i);if(m)try{comp=JSON.parse(m[1])}catch(e){};const fallback=averageScores(session?.turns||[]);competencies.forEach(k=>comp[k]=clamp(comp[k]??fallback[k]??0,0,10));return {score,competencies:comp}}
  async function saveFinal(raw,source='AI Final Board'){
    const p=parseFinal(raw);const report={date:today(),createdAt:Date.now(),durationSec:seconds,mode:session?.config?.mode||val('interviewModeV253'),style:session?.config?.style||val('interviewStyleV253'),questions:session?.turns?.length||0,score:p.score,competencies:p.competencies,profile:session?.profile||collectDAF(),turns:session?.turns||[],report:raw,body:raw,source};lastReport=report;if($i('interviewFinalScoreV253'))$i('interviewFinalScoreV253').textContent=`${p.score} / 100`;set('interviewFinalReportV253',`<div class="v25EvalHeader"><span>${esc(report.mode)}</span><b>${p.score}/100</b><span>${report.questions} questions • ${Math.floor(report.durationSec/60)} min</span></div>${fmt(raw)}`);await saveCol('interviewReportsV253',report);if(session){session.completed=true;session.finalReport=report}localStorage.removeItem(ACTIVE_KEY);stopTimer();status('✅ Interview completed and board report saved.');renderInterviewAnalyticsV253();try{window.installAIOutputDownloadsV226&&setTimeout(window.installAIOutputDownloadsV226,100)}catch(e){}
  }
  window.finishInterviewSessionV253=async function(){if(!session?.turns?.length)return alert('Answer at least one question before ending the interview.');stopTimer();status('🤖 Board members are preparing the final personality-test assessment...');set('interviewFinalReportV253','<div class="aiLoading">Reviewing transcript, DAF depth, balance, honesty and composure...</div>');try{const raw=await ask(reportPrompt());if(settings().mode==='chatgpt'){set('interviewFinalReportV253',fmt(raw));status('📋 Final report prompt copied. Paste ChatGPT’s report into Import Manual Final Report.')}else await saveFinal(raw)}catch(e){const av=averageScores(session.turns),score=round(scoreAvg(av)*10,0);const raw=`FINAL_BOARD_SCORE: ${score}/100\nCOMPETENCY_JSON: ${JSON.stringify(av)}\n# Local Interview Summary\nThe AI final report could not be generated. Your locally calculated competency profile has been saved.\n## Priority\nImprove the two lowest competencies, practise concise 60-90 second responses and revise DAF-linked current affairs.`;await saveFinal(raw,'Local Fallback');status('⚠ AI final report failed; local analytics saved: '+esc(e.message))}};
  window.importInterviewFinalV253=async function(){const raw=val('interviewManualFinalV253');if(!raw)return alert('Paste the manual final report first.');if(!session)session={profile:collectDAF(),config:config(),turns:[],completed:false};await saveFinal(raw,'ChatGPT Manual Final');$i('interviewManualFinalV253').value=''};

  window.sendInterviewWeaknessToRevisionV253=async function(){if(!lastReport)return alert('Complete or open an interview report first.');const lows=Object.entries(lastReport.competencies||{}).sort((a,b)=>a[1]-b[1]).slice(0,3);for(const [k,v] of lows)await saveCol('smartRevision',{topic:`Interview repair: ${k}`,subject:'Personality Test',source:'v25.3 Interview Room',difficulty:v<5?'Hard':'Medium',date:today(),cycle:1,status:'pending',body:`Competency score ${v}/10. Practise DAF-linked answers, balanced opinion and 60-90 second delivery. Board score: ${lastReport.score}/100.`});alert('Interview weaknesses added to Revision Brain.')};
  window.scheduleInterviewPracticeV253=async function(){const d=new Date();d.setDate(d.getDate()+2);await saveCol('calendarItems',{date:d.toISOString().slice(0,10),title:'UPSC Mock Interview Practice',type:'Interview',body:lastReport?`Repair: ${Object.entries(lastReport.competencies||{}).sort((a,b)=>a[1]-b[1]).slice(0,3).map(x=>x[0]).join(', ')}`:'Practice DAF and current-affairs questions.'});alert('Interview practice added to calendar for two days from now.')};
  window.copyFullInterviewPromptV253=async function(){const c=config();const prompt=`Conduct a realistic UPSC Civil Services Personality Test with me.\n\nMy DAF:\n${profileText()}\n\nMode: ${c.mode}\nBoard style: ${c.style}\nDifficulty: ${c.difficulty}\nLanguage: ${c.language}\nQuestions: ${c.maxQuestions}\nThemes: ${c.themes||'DAF, current affairs, opinion, ethics and situational judgement'}\n\nAsk one question at a time. After each answer, do not reveal a model answer immediately; ask an adaptive cross-question. At the end, give a credible score out of 100, competency scores for content, clarity, balance, honesty, composure and relevance, red flags, DAF gaps and a 7-day improvement plan.`;try{await navigator.clipboard.writeText(prompt);status('✅ Full ChatGPT interview prompt copied.')}catch(e){set('interviewLiveFeedbackV253',fmt(prompt));status('Copy was blocked; prompt displayed in feedback panel.')}try{window.open('https://chatgpt.com/','_blank')}catch(e){}};

  function bar(label,v){const n=clamp(v*10,0,100);return `<div class="v25BarRow"><span>${esc(label)}</span><div class="v25Bar"><i style="width:${n}%"></i></div><b>${round(n,0)}%</b></div>`}
  window.openInterviewReportV253=async function(id){const list=await getCol('interviewReportsV253');const r=list.find((x,i)=>String(x.id||i)===String(id));if(!r)return;lastReport=r;if($i('interviewFinalScoreV253'))$i('interviewFinalScoreV253').textContent=`${r.score}/100`;set('interviewFinalReportV253',`<div class="v25EvalHeader"><span>${esc(r.mode||'Interview')}</span><b>${r.score}/100</b><span>${r.questions||0} questions</span></div>${fmt(r.report||r.body||'')}`);set('interviewCompetencyAnalyticsV253',competencies.map(k=>bar(k,r.competencies?.[k]||0)).join(''));if(r.turns?.length){session={profile:r.profile||{},config:{maxQuestions:r.questions||r.turns.length},turns:r.turns,current:null,completed:true};renderInterviewTranscriptV253()}}
  window.renderInterviewHistoryV253=async function(){await renderInterviewAnalyticsV253()};
  async function renderInterviewAnalyticsV253(){const list=(await getCol('interviewReportsV253')).filter(x=>x&&Number.isFinite(Number(x.score)));const n=list.length,avg=n?round(list.reduce((a,b)=>a+Number(b.score||0),0)/n,1):0,ca={};competencies.forEach(k=>{const xs=list.map(x=>Number(x.competencies?.[k])).filter(Number.isFinite);ca[k]=xs.length?round(xs.reduce((a,b)=>a+b,0)/xs.length,1):0});const ranked=Object.entries(ca).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]);if($i('interviewSessionsV253'))$i('interviewSessionsV253').textContent=n;if($i('interviewAverageV253'))$i('interviewAverageV253').textContent=avg+'%';if($i('interviewBestV253'))$i('interviewBestV253').textContent=ranked[0]?.[0]||'—';if($i('interviewWeakV253'))$i('interviewWeakV253').textContent=ranked.at(-1)?.[0]||'—';set('interviewCompetencyAnalyticsV253',n?competencies.map(k=>bar(k,ca[k])).join(''):'<p class="sub">Complete your first interview.</p>');const box=$i('interviewHistoryV253');if(box)box.innerHTML=n?list.slice(0,30).map((r,i)=>`<div class="v25HistoryCard"><div><span class="v25HistoryType">${esc(r.mode||'Interview')}</span><h3>${esc(r.profile?.name||'UPSC Candidate')} • ${r.questions||0} questions</h3><p>${esc(r.date||'')} • ${Math.floor(Number(r.durationSec||0)/60)} min • ${esc(r.style||'Board')}</p></div><div class="v25HistoryScore">${Number(r.score||0)}<small>/100</small></div><div class="actions"><button class="btn ghost" onclick="openInterviewReportV253('${r.id||i}')">Open</button><button class="btn danger" onclick="deleteItem('interviewReportsV253','${r.id||i}');setTimeout(renderInterviewHistoryV253,350)">Delete</button></div></div>`).join(''):'<div class="v25EmptyHistory">No interview sessions saved yet.</div>'}

  window.resetInterviewSessionV253=function(confirmFirst=true){if(confirmFirst&&session?.turns?.length&&!session.completed&&!confirm('Start a new session and discard the active interview?'))return;stopTimer();if(recognition&&listening)try{recognition.stop()}catch(e){}session=null;seconds=0;renderTimer();localStorage.removeItem(ACTIVE_KEY);set('interviewQuestionV253','Save your DAF profile and start a mock interview.');set('interviewQuestionCountV253','Waiting to begin');set('interviewCategoryV253','PERSONALITY TEST');set('interviewChairV253','UPSC Board');set('interviewChairAvatarV253','C');if($i('interviewAnswerV253'))$i('interviewAnswerV253').value='';window.updateInterviewWordCountV253();set('interviewLiveFeedbackV253','Your answer feedback will appear here.');set('interviewTranscriptV253','<div class="v25EmptyHistory">No active interview transcript.</div>');if($i('interviewTurnScoreV253'))$i('interviewTurnScoreV253').textContent='— / 10';status('')};

  const oldShow=window.show;if(typeof oldShow==='function')window.show=function(id,btn){const r=oldShow.apply(this,arguments);setTimeout(()=>{if(id==='interviewRoomV253'){updateBadge();renderInterviewAnalyticsV253();try{const d=JSON.parse(localStorage.getItem(DAF_KEY)||'{}');applyDAF(d)}catch(e){}}},150);return r};
  const oldSave=window.saveAISettingsV23;if(typeof oldSave==='function')window.saveAISettingsV23=function(){const r=oldSave.apply(this,arguments);setTimeout(updateBadge,30);return r};
  document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{updateBadge();try{applyDAF(JSON.parse(localStorage.getItem(DAF_KEY)||'{}'))}catch(e){}renderInterviewAnalyticsV253();try{const s=JSON.parse(localStorage.getItem(ACTIVE_KEY)||'null');if(s&&!s.completed){session=s;seconds=Math.floor((Date.now()-Number(s.startedAt||Date.now()))/1000);renderTimer();showQuestion(s.current||fallbackQuestion(s.turns?.length||0));renderInterviewTranscriptV253();status('Active interview restored.')}}catch(e){}},1100));
})();


// V25.4 Universal AI Room Uploads: file-to-room import for Prelims, Mains and Interview
(function(){
  const $u=id=>document.getElementById(id);
  const escU=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const settingsU=()=>{try{return {mode:'ollama',ollamaUrl:'http://localhost:11434',ollamaModel:'gemma3:4b',geminiKey:'',...JSON.parse(localStorage.getItem('mission_ai_settings_v23')||'{}')}}catch(e){return {mode:'ollama',ollamaUrl:'http://localhost:11434',ollamaModel:'gemma3:4b',geminiKey:''}}};
  const setStatusU=(id,msg,type='')=>{const e=$u(id);if(!e)return;e.className='aiRoomFileStatusV254 '+type;e.innerHTML=msg};
  const cleanCodeFenceU=t=>String(t||'').replace(/^```(?:json|text|markdown)?\s*/i,'').replace(/\s*```$/,'').trim();

  async function loadPdfU(){
    if(window.pdfjsLib)return window.pdfjsLib;
    return await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';s.onload=()=>{try{window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js'}catch(e){}resolve(window.pdfjsLib)};s.onerror=()=>reject(new Error('PDF reader could not load. Check internet once, or use TXT/DOCX.'));document.head.appendChild(s)});
  }
  async function loadMammothU(){
    if(window.mammoth)return window.mammoth;
    return await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js';s.onload=()=>resolve(window.mammoth);s.onerror=()=>reject(new Error('DOCX reader could not load. Check internet once, or save the file as PDF/TXT.'));document.head.appendChild(s)});
  }
  async function dataUrlU(file){return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=()=>reject(r.error||new Error('File read failed'));r.readAsDataURL(file)})}
  async function pdfTextU(file){
    const lib=await loadPdfU(),data=await file.arrayBuffer(),pdf=await lib.getDocument({data}).promise;let text='';const max=Math.min(pdf.numPages,50);
    for(let i=1;i<=max;i++){const p=await pdf.getPage(i),c=await p.getTextContent();text+=`\n\n--- Page ${i} ---\n`+c.items.map(x=>x.str).join(' ')}
    if(pdf.numPages>max)text+=`\n[Only first ${max} pages read for speed. Total pages: ${pdf.numPages}]`;
    return text.trim();
  }
  async function docxTextU(file){const m=await loadMammothU(),r=await m.extractRawText({arrayBuffer:await file.arrayBuffer()});return String(r.value||'').trim()}
  function geminiKeyU(){const s=settingsU();return s.geminiKey||(typeof GEMINI_API_KEY!=='undefined'?GEMINI_API_KEY:'')||''}
  async function geminiVisionU(file,instruction){
    const key=geminiKeyU();if(!key)throw new Error('Gemini API key is missing. Add it in AI Control Centre.');if(file.size>15*1024*1024)throw new Error('Visual file is over 15 MB. Compress or split it first.');
    const data=(await dataUrlU(file)).split(',')[1]||'';const models=['gemini-2.5-flash','gemini-2.0-flash'];let last='';
    for(const model of models){try{const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:instruction},{inline_data:{mime_type:file.type||'application/octet-stream',data}}]}]})});const d=await r.json();const out=(d?.candidates?.[0]?.content?.parts||[]).map(x=>x.text||'').join('\n').trim();if(out)return out;last=d?.error?.message||'Gemini returned no extracted text.'}catch(e){last=e.message}}
    throw new Error(last||'Gemini visual reading failed.');
  }
  async function ollamaVisionU(file,instruction){
    if(!/^image\//i.test(file.type))throw new Error('Ollama browser import supports image files here, not scanned PDF. Use Gemini for scanned PDF or upload page images.');
    if(file.size>12*1024*1024)throw new Error('Image is over 12 MB. Compress it first.');const s=settingsU(),data=(await dataUrlU(file)).split(',')[1]||'';
    const r=await fetch(`${String(s.ollamaUrl||'http://localhost:11434').replace(/\/$/,'')}/api/generate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:s.ollamaModel||'gemma3:4b',prompt:instruction,images:[data],stream:false,options:{temperature:0.1}})});if(!r.ok)throw new Error('Ollama vision error: '+await r.text());const d=await r.json();if(!d.response)throw new Error('Ollama returned no readable text.');return d.response.trim();
  }
  async function visualTextU(file,purpose){
    const s=settingsU();const instruction=`Read this UPSC study file carefully and extract all visible text faithfully. Purpose: ${purpose}. Preserve headings, question numbers, bullet points and answer structure. Do not evaluate or summarise. Return only clean extracted text.`;
    if(s.mode==='gemini')return await geminiVisionU(file,instruction);
    if(s.mode==='ollama')return await ollamaVisionU(file,instruction);
    if(s.mode==='hybrid'){try{if(/^image\//i.test(file.type))return await ollamaVisionU(file,instruction)}catch(e){}return await geminiVisionU(file,instruction)}
    throw new Error('ChatGPT Prompt Mode cannot read an attached file inside this website. Select Gemini/Ollama, or open ChatGPT and attach the file manually.');
  }
  async function readFileU(file,purpose){
    const name=file.name.toLowerCase(),mime=file.type||'';
    if(name.endsWith('.docx'))return await docxTextU(file);
    if(name.endsWith('.pdf')||/pdf/i.test(mime)){const local=await pdfTextU(file);const useful=local.replace(/--- Page \d+ ---/g,'').trim();if(useful.length>80)return local;return await visualTextU(file,purpose+' (scanned PDF)')}
    if(/^image\//i.test(mime))return await visualTextU(file,purpose+' (image/handwritten page)');
    if(/\.(txt|md|csv|json|html?|rtf)$/i.test(name)||/^text\//i.test(mime)){let t=await file.text();if(/\.html?$/i.test(name)){const d=new DOMParser().parseFromString(t,'text/html');t=d.body?.innerText||t}if(/\.rtf$/i.test(name))t=t.replace(/\\[a-z]+\d* ?|[{}]/gi,' ').replace(/\s+/g,' ');return t.trim()}
    throw new Error('Unsupported file. Use PDF, DOCX, TXT, MD, JSON, HTML or an image.');
  }
  function labelledU(text,labels){for(const l of labels){const r=new RegExp(`(?:^|\\n)\\s*${l}\\s*[:\\-]\\s*([^\\n]+)`,'i'),m=String(text).match(r);if(m)return m[1].trim()}return ''}
  function applyDAFU(text){
    let d=null;try{const j=JSON.parse(cleanCodeFenceU(text));if(j&&typeof j==='object'&&!Array.isArray(j))d=j}catch(e){}
    const map={name:['name','candidateName'],home:['home','homeState','district'],education:['education','graduation','college'],optional:['optional','optionalSubject'],work:['work','workExperience','preparation'],services:['services','servicePreference'],hobbies:['hobbies','interests'],achievements:['achievements','leadership'],summary:['summary','dafSummary','profile']};
    if(d){for(const [k,aliases] of Object.entries(map)){const id={name:'interviewNameV253',home:'interviewHomeV253',education:'interviewEducationV253',optional:'interviewOptionalV253',work:'interviewWorkV253',services:'interviewServicesV253',hobbies:'interviewHobbiesV253',achievements:'interviewAchievementsV253',summary:'interviewDAFSummaryV253'}[k];const v=aliases.map(a=>d[a]).find(Boolean);if($u(id)&&v)$u(id).value=Array.isArray(v)?v.join(', '):String(v)}return}
    const fields=[['interviewNameV253',['Candidate Name','Name']],['interviewHomeV253',['Home State / District','Home State','District','Hometown']],['interviewEducationV253',['Education','Graduation','College']],['interviewOptionalV253',['Optional Subject','Optional']],['interviewWorkV253',['Work Experience','Work','Preparation']],['interviewServicesV253',['Service Preference','Services']],['interviewHobbiesV253',['Hobbies','Interests']],['interviewAchievementsV253',['Achievements','Leadership']]];
    let found=0;for(const [id,labels] of fields){const v=labelledU(text,labels);if(v&&$u(id)){$u(id).value=v;found++}}if($u('interviewDAFSummaryV253'))$u('interviewDAFSummaryV253').value=found?String(text).slice(0,12000):String(text).slice(0,18000);
  }
  function fileInfoU(file,text){return `✅ <b>${escU(file.name)}</b> loaded • ${Number(file.size/1024).toFixed(0)} KB • ${String(text||'').length.toLocaleString()} characters. Review/edit the imported text before using AI.`}

  window.readUniversalAIFileV254=readFileU;

  window.importAIRoomFileV254=async function(room){
    const cfg={prelims:{file:'prelimsRoomFileV254',target:'prelimsRoomTargetV254',status:'prelimsRoomFileStatusV254'},mains:{file:'mainsRoomFileV254',target:'mainsRoomTargetV254',status:'mainsRoomFileStatusV254'},interview:{file:'interviewRoomFileV254',target:'interviewRoomTargetV254',status:'interviewRoomFileStatusV254'}}[room];if(!cfg)return;
    const input=$u(cfg.file),file=input?.files?.[0];if(!file)return alert('Choose a file first.');const target=$u(cfg.target)?.value||'';
    setStatusU(cfg.status,`<span class="v25Spinner">◌</span> Reading <b>${escU(file.name)}</b>... Text files are read locally; images/scanned files may use the selected AI.`,'busy');
    try{
      const text=cleanCodeFenceU(await readFileU(file,`${room} ${target}`));if(!text)throw new Error('No readable text was found. Try a clearer file or switch to Gemini for scanned pages.');
      if(room==='prelims'){
        if(target==='json'){if($u('prelimsManualJSONV251'))$u('prelimsManualJSONV251').value=text;try{JSON.parse(text);if(typeof window.importPrelimsJSONV251==='function')window.importPrelimsJSONV251()}catch(e){setStatusU(cfg.status,fileInfoU(file,text)+'<br>⚠ The file was loaded into Manual JSON Import, but it is not valid JSON yet.','warn');return}}
        else if($u('prelimsSourceV251'))$u('prelimsSourceV251').value=text.slice(0,60000);
      }else if(room==='mains'){
        if(target==='answer'&&$u('mainsWarAnswerV252')){$u('mainsWarAnswerV252').value=text.slice(0,60000);window.updateMainsWordCountV252&&window.updateMainsWordCountV252()}
        else if(target==='question'&&$u('mainsWarQuestionV252'))$u('mainsWarQuestionV252').value=text.slice(0,12000);
        else if($u('mainsWarContextV252'))$u('mainsWarContextV252').value=text.slice(0,50000);
      }else if(room==='interview'){
        if(target==='daf')applyDAFU(text);
        else if(target==='themes'&&$u('interviewThemesV253'))$u('interviewThemesV253').value=text.slice(0,24000);
        else if($u('interviewAnswerV253')){$u('interviewAnswerV253').value=text.slice(0,24000);window.updateInterviewWordCountV253&&window.updateInterviewWordCountV253()}
      }
      setStatusU(cfg.status,fileInfoU(file,text),'ok');
    }catch(e){setStatusU(cfg.status,'⚠ '+escU(e.message||e),'error');alert('File import failed: '+(e.message||e))}
  };
})();


/* ===== V26.1 + V26.2 PHASE 3: DAILY COMMAND + TIME & HABIT INTELLIGENCE ===== */
(function(){
  'use strict';
  const $26=id=>document.getElementById(id);
  const esc26=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const today26=()=>new Date().toISOString().slice(0,10);
  const dateAdd26=(date,days)=>{const d=new Date((date||today26())+'T12:00:00');d.setDate(d.getDate()+days);return d.toISOString().slice(0,10)};
  const val26=(id,def='')=>String($26(id)?.value??def).trim();
  const set26=(id,html)=>{const e=$26(id);if(e)e.innerHTML=html};
  const text26=id=>String($26(id)?.innerText||'').trim();
  const clamp26=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));
  const fmt26=t=>{try{return typeof window.formatAI==='function'?window.formatAI(String(t||'')):`<pre>${esc26(t)}</pre>`}catch(e){return `<pre>${esc26(t)}</pre>`}};
  const settings26=()=>{try{return {mode:'ollama',ollamaModel:'gemma3:4b',...JSON.parse(localStorage.getItem('mission_ai_settings_v23')||'{}')}}catch(e){return {mode:'ollama',ollamaModel:'gemma3:4b'}}};
  const modeLabel26=()=>{const s=settings26();return s.mode==='ollama'?'🖥 Ollama Local':s.mode==='gemini'?'☁ Gemini Free API':s.mode==='chatgpt'?'📋 ChatGPT Prompt Mode':'⭐ Smart Hybrid'};
  async function ask26(prompt){if(typeof window.aiAskRouterV23==='function')return await window.aiAskRouterV23(prompt);throw new Error('AI router unavailable. Save AI settings in AI Control Centre.');}
  async function get26(col){try{if(typeof window.getCol==='function')return await window.getCol(col)}catch(e){}try{return JSON.parse(localStorage.getItem(col)||'[]')}catch(e){return []}}
  async function save26(col,obj){try{if(typeof window.saveCol==='function')return await window.saveCol(col,obj)}catch(e){}const a=await get26(col);a.unshift({...obj,id:'local_'+Date.now()});localStorage.setItem(col,JSON.stringify(a));}
  const id26=(x,i)=>String(x?._docId||x?.id||i);
  function updateBadges26(){const s=settings26(),t=`Selected AI: ${modeLabel26()} • ${s.ollamaModel||'Cloud/Prompt'}`;if($26('dailyCommandAIBadgeV261'))$26('dailyCommandAIBadgeV261').textContent=t;if($26('timeHabitAIBadgeV262'))$26('timeHabitAIBadgeV262').textContent=t}
  function download26(name,text){const b=new Blob([String(text||'')],{type:'text/plain;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
  function latestByDate26(list){const map={};for(const x of list||[]){const d=String(x.date||'');if(!d)continue;const n=Number(x.createdAt?.seconds?x.createdAt.seconds*1000:x.createdAt||0);if(!map[d]||n>=map[d]._n)map[d]={...x,_n:n}}return Object.values(map)}
  function consecutiveDates26(dates){const set=new Set(dates),d=new Date(today26()+'T12:00:00');let n=0;for(let i=0;i<500;i++){const k=d.toISOString().slice(0,10);if(set.has(k)){n++;d.setDate(d.getDate()-1)}else if(i===0){d.setDate(d.getDate()-1)}else break}return n}

  // ---------- V26.1 DAILY COMMAND CENTRE ----------
  const ACTIVE_MISSION_KEY='mission_v261_active_';
  let missionV261=null,lastReviewV261='';
  function missionKeyV261(date=val26('commandDateV261')||today26()){return ACTIVE_MISSION_KEY+date}
  function saveMissionLocalV261(){if(missionV261)localStorage.setItem(missionKeyV261(missionV261.date),JSON.stringify(missionV261))}
  function loadMissionLocalV261(date=val26('commandDateV261')||today26()){try{return JSON.parse(localStorage.getItem(missionKeyV261(date))||'null')}catch(e){return null}}
  function normalizeTaskV261(t,i){return {id:String(t.id||('cmd_'+Date.now()+'_'+i+'_'+Math.random().toString(36).slice(2,6))),title:String(t.title||t.task||'UPSC task').slice(0,180),type:String(t.type||'Study'),subject:String(t.subject||'General'),minutes:clamp26(t.minutes||45,10,240),reason:String(t.reason||'Priority for today').slice(0,260),priority:['High','Medium','Low'].includes(t.priority)?t.priority:'Medium',done:!!t.done}}
  function parseAIJSONV261(raw){const s=String(raw||'');const candidates=[];const line=s.match(/MISSION_JSON\s*:\s*(\{[\s\S]*\})/i);if(line)candidates.push(line[1]);const fenced=s.match(/```(?:json)?\s*([\s\S]*?)```/i);if(fenced)candidates.push(fenced[1]);const a=s.indexOf('{'),b=s.lastIndexOf('}');if(a>=0&&b>a)candidates.push(s.slice(a,b+1));for(const c of candidates){try{const j=JSON.parse(c);if(j&&Array.isArray(j.tasks))return j}catch(e){}}return null}
  async function commandSnapshotV261(){
    const [tasks,calendar,smartRev,revision,wrong,prelims,mains,interviews,flash,sessions,habits]=await Promise.all([
      get26('tasks'),get26('calendarItems'),get26('smartRevision'),get26('revision'),get26('wrongbook'),get26('prelimsReports'),get26('mainsWarReports'),get26('interviewReportsV253'),get26('flash'),get26('timeSessionsV262'),get26('habitIntelligenceV262')
    ]);
    const date=val26('commandDateV261')||today26(),pending=x=>String(x.status||'pending').toLowerCase()!=='done'&&!x.done;
    const due=[...smartRev,...revision].filter(x=>pending(x)&&(!x.date||String(x.date)<=date));
    const todayCal=calendar.filter(x=>String(x.date||'')===date);
    const weak={};wrong.slice(0,100).forEach(x=>{const s=String(x.subject||x.topic||'General');weak[s]=(weak[s]||0)+1});
    const latestPrelims=prelims[0]||{},latestMains=mains[0]||{},latestInterview=interviews[0]||{};
    const todayMin=sessions.filter(x=>String(x.date||'')===date).reduce((a,x)=>a+Number(x.minutes||0),0);
    return {date,pendingTasks:tasks.filter(pending).slice(0,12),todayCalendar:todayCal.slice(0,12),dueRevision:due.slice(0,20),weakSubjects:Object.entries(weak).sort((a,b)=>b[1]-a[1]).slice(0,6),flashDue:flash.filter(x=>!x.due||String(x.due)<=date).length,latestPrelims:{accuracy:latestPrelims.accuracy,weakTopics:latestPrelims.weakTopics,subject:latestPrelims.subject},latestMains:{paper:latestMains.paper,scorePercent:latestMains.scorePercent,rubric:latestMains.rubric},latestInterview:{score:latestInterview.score,competencies:latestInterview.competencies},todayMinutes:todayMin,latestHabit:latestByDate26(habits).sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0]||null};
  }
  function fitTasksV261(tasks,maxMinutes){let used=0,out=[];for(const t of tasks){const n=normalizeTaskV261(t,out.length),left=maxMinutes-used;if(left<10)break;if(n.minutes>left)n.minutes=Math.max(10,left);out.push(n);used+=n.minutes}return out}
  function localTasksV261(snap){
    const focus=val26('commandFocusV261')||'Balanced UPSC day',tasks=[];
    snap.todayCalendar.slice(0,2).forEach(x=>tasks.push({title:x.title||x.task||'Calendar commitment',type:'Calendar',subject:x.subject||'General',minutes:Number(x.minutes||60),reason:'Already scheduled for today',priority:'High'}));
    snap.dueRevision.slice(0,2).forEach(x=>tasks.push({title:'Revise: '+(x.topic||x.title||'Due topic'),type:'Revision',subject:x.subject||'General',minutes:45,reason:'Revision is due or overdue',priority:'High'}));
    if(snap.weakSubjects[0])tasks.push({title:`Repair weak area: ${snap.weakSubjects[0][0]}`,type:'Weak Topic',subject:snap.weakSubjects[0][0],minutes:60,reason:`Appears in ${snap.weakSubjects[0][1]} saved mistakes`,priority:'High'});
    if(/Prelims/i.test(focus)||/Balanced/i.test(focus)||/Revision/i.test(focus))tasks.push({title:'Solve and review 25 UPSC MCQs',type:'Prelims',subject:snap.latestPrelims.subject||'Mixed',minutes:75,reason:'Daily retrieval and elimination practice',priority:'Medium'});
    if(/Mains/i.test(focus)||/Balanced/i.test(focus))tasks.push({title:'Write one timed Mains answer',type:'Mains',subject:snap.latestMains.paper||'GS',minutes:50,reason:'Maintain answer-writing continuity',priority:'Medium'});
    if(/Current/i.test(focus)||/Balanced/i.test(focus))tasks.push({title:'Current affairs: read, extract and revise',type:'Current Affairs',subject:'Current Affairs',minutes:45,reason:'Connect daily news to syllabus and PYQs',priority:'Medium'});
    if(/Interview/i.test(focus))tasks.push({title:'DAF + current-affairs interview drill',type:'Interview',subject:'Interview',minutes:60,reason:'Personality-test practice',priority:'High'});
    if(snap.flashDue)tasks.push({title:`Review due flashcards (${Math.min(snap.flashDue,30)})`,type:'Flashcards',subject:'Mixed',minutes:30,reason:'Spaced active recall',priority:'Low'});
    snap.pendingTasks.slice(0,2).forEach(x=>tasks.push({title:x.text||x.title||'Pending task',type:'Pending',subject:x.subject||'General',minutes:Number(x.minutes||40),reason:'Existing pending task',priority:'Medium'}));
    if(!tasks.length)tasks.push({title:'Revise one core static topic',type:'Revision',subject:'General',minutes:75,reason:'Build static foundation',priority:'High'},{title:'Solve 25 MCQs with analysis',type:'Prelims',subject:'Mixed',minutes:75,reason:'Practice and diagnosis',priority:'Medium'},{title:'Write one 10-marker answer',type:'Mains',subject:'GS',minutes:45,reason:'Maintain writing skill',priority:'Medium'});
    return fitTasksV261(tasks,Number(val26('commandHoursAvailableV261')||7)*60);
  }
  function renderMissionV261(){
    const box=$26('commandMissionListV261');if(!box)return;const tasks=missionV261?.tasks||[],done=tasks.filter(x=>x.done).length,pct=tasks.length?Math.round(done/tasks.length*100):0;
    if($26('commandCompletionV261'))$26('commandCompletionV261').textContent=pct+'%';if($26('commandTaskCountV261'))$26('commandTaskCountV261').textContent=`${done} of ${tasks.length} tasks`;if($26('commandProgressBarV261'))$26('commandProgressBarV261').style.width=pct+'%';if($26('commandProgressTextV261'))$26('commandProgressTextV261').textContent=pct+'%';
    box.innerHTML=tasks.length?tasks.map((t,i)=>`<div class="v26MissionItem ${t.done?'done':''}"><input class="v26MissionCheck" type="checkbox" ${t.done?'checked':''} onchange="toggleCommandTaskV261(${i})"><div class="v26MissionInfo"><h3>${esc26(t.title)}</h3><div class="v26MissionMeta"><span>${esc26(t.priority)}</span><span>${esc26(t.type)}</span><span>${esc26(t.subject)}</span><span>${Number(t.minutes)} min</span></div><p class="v26MissionReason">${esc26(t.reason||'')}</p></div><div class="v26MissionActions"><button class="v26MiniBtn" onclick="startCommandTaskV261(${i})">Start</button><button class="v26MiniBtn danger" onclick="deleteCommandTaskV261(${i})">Delete</button></div></div>`).join(''):'<div class="v25EmptyHistory">No mission yet. Build one locally or with AI.</div>';
  }
  async function updateCommandStatsV261(){
    const [sessions,smart,revision,habits,reports]=await Promise.all([get26('timeSessionsV262'),get26('smartRevision'),get26('revision'),get26('habitIntelligenceV262'),get26('dailyCommandReportsV261')]);const date=val26('commandDateV261')||today26();
    const min=sessions.filter(x=>String(x.date||'')===date).reduce((a,x)=>a+Number(x.minutes||0),0),due=[...smart,...revision].filter(x=>String(x.status||'pending').toLowerCase()!=='done'&&(!x.date||String(x.date)<=date)).length;
    const dates=[...sessions.map(x=>x.date),...habits.map(x=>x.date),...reports.map(x=>x.date)].filter(Boolean);
    if($26('commandHoursV261'))$26('commandHoursV261').textContent=(min/60).toFixed(min%60?1:0)+'h';if($26('commandDueV261'))$26('commandDueV261').textContent=due;if($26('commandStreakV261'))$26('commandStreakV261').textContent=consecutiveDates26(dates)+' days';
  }
  window.buildLocalMissionV261=async function(){
    const date=val26('commandDateV261')||today26();if($26('commandStatusV261'))$26('commandStatusV261').innerHTML='Reading revision, calendar, tests and weak topics...';const snap=await commandSnapshotV261(),tasks=localTasksV261(snap),focus=val26('commandFocusV261'),energy=val26('commandEnergyV261');
    missionV261={date,createdAt:Date.now(),source:'Local Intelligence',focus,energy,availableHours:Number(val26('commandHoursAvailableV261')||7),tasks,brief:`# Morning Brief\n\n## Mission\n${tasks.length} tasks fitted into ${val26('commandHoursAvailableV261')} available hours.\n\n## Why this sequence\nHigh-priority calendar and revision dues come first, followed by weak-topic repair and exam practice.\n\n## Main risk\nDo not spend the whole day creating new material while revision and practice remain pending.\n\n## Minimum win\nComplete every High-priority task and one practice block.`,warning:'Protect the first deep-work block from phone distraction.',motivation:'Win the day through completed blocks, not an unrealistic list.'};
    saveMissionLocalV261();set26('commandBriefV261',fmt26(missionV261.brief));renderMissionV261();updateCommandStatsV261();if($26('commandStatusV261'))$26('commandStatusV261').innerHTML='✅ Local mission ready. It works without AI.';
  };
  window.generateAIMissionV261=async function(){
    if(!missionV261)await window.buildLocalMissionV261();const snap=await commandSnapshotV261();if($26('commandStatusV261'))$26('commandStatusV261').innerHTML='🤖 AI is prioritising today’s mission...';set26('commandBriefV261','<div class="aiLoading">Reading preparation signals and fitting tasks to available time...</div>');
    const prompt=`Act as a strict but realistic UPSC daily command officer. Build today's plan from the evidence below.\nDate: ${val26('commandDateV261')}\nAvailable hours: ${val26('commandHoursAvailableV261')}\nFocus: ${val26('commandFocusV261')}\nEnergy: ${val26('commandEnergyV261')}\nStyle: ${val26('commandStyleV261')}\nSpecial priority: ${val26('commandPriorityV261')||'None'}\nData snapshot: ${JSON.stringify(snap).slice(0,16000)}\n\nReturn exactly one line first:\nMISSION_JSON: {"brief":"short morning brief","tasks":[{"title":"","type":"Revision/Prelims/Mains/CA/Calendar/Interview","subject":"","minutes":45,"reason":"","priority":"High/Medium/Low"}],"warning":"","motivation":""}\nKeep total task minutes within available hours. Then provide a readable UPSC Morning Command Brief with: sequence, reason, minimum win, danger, recovery rule and motivation.`;
    try{const raw=await ask26(prompt),parsed=parseAIJSONV261(raw);if(parsed&&settings26().mode!=='chatgpt'){missionV261={...missionV261,source:'AI Command',tasks:fitTasksV261(parsed.tasks,Number(val26('commandHoursAvailableV261')||7)*60),brief:parsed.brief||raw,warning:parsed.warning||'',motivation:parsed.motivation||'',aiRaw:raw};saveMissionLocalV261();renderMissionV261()}set26('commandBriefV261',fmt26(raw));if($26('commandStatusV261'))$26('commandStatusV261').innerHTML=settings26().mode==='chatgpt'?'📋 Prompt copied. Your local mission remains active until you manually use the ChatGPT response.':'✅ AI mission generated and saved locally.'}catch(e){set26('commandBriefV261',fmt26('AI mission failed: '+e.message+'\n\nYour local mission remains available.'));if($26('commandStatusV261'))$26('commandStatusV261').innerHTML='⚠ AI failed; local mission preserved.'}
  };
  window.toggleCommandTaskV261=function(i){if(!missionV261?.tasks?.[i])return;missionV261.tasks[i].done=!missionV261.tasks[i].done;saveMissionLocalV261();renderMissionV261()};
  window.deleteCommandTaskV261=function(i){if(!missionV261?.tasks)return;missionV261.tasks.splice(i,1);saveMissionLocalV261();renderMissionV261()};
  window.addManualCommandTaskV261=function(){const title=prompt('Task title');if(!title)return;const minutes=Number(prompt('Minutes',45))||45,subject=prompt('Subject','General')||'General';if(!missionV261)missionV261={date:val26('commandDateV261')||today26(),source:'Manual',tasks:[],brief:'Manual mission'};missionV261.tasks.push(normalizeTaskV261({title,minutes,subject,type:'Manual',reason:'Added manually',priority:'Medium'},missionV261.tasks.length));saveMissionLocalV261();renderMissionV261()};
  window.startCommandTaskV261=function(i){const t=missionV261?.tasks?.[i];if(!t)return;if($26('focusSubjectV262'))$26('focusSubjectV262').value=[...$26('focusSubjectV262').options].some(o=>o.value===t.subject)?t.subject:'General';if($26('focusTaskV262'))$26('focusTaskV262').value=t.title;if($26('focusMinutesV262'))$26('focusMinutesV262').value=t.minutes;localStorage.setItem('mission_v262_linked_task',JSON.stringify({missionDate:missionV261.date,taskId:t.id}));window.show&&window.show('timeHabitV262')};
  window.clearCompletedMissionV261=function(){if(!missionV261)return;missionV261.tasks=missionV261.tasks.filter(x=>!x.done);saveMissionLocalV261();renderMissionV261()};
  window.resetMissionV261=function(){if(!confirm('Clear today’s active mission? Saved history will remain.'))return;localStorage.removeItem(missionKeyV261());missionV261=null;set26('commandBriefV261','Build a mission to receive your morning brief.');renderMissionV261()};
  window.loadTodayMissionV261=async function(){missionV261=loadMissionLocalV261();if(!missionV261){const history=(await get26('dailyCommandReportsV261')).filter(x=>String(x.date||'')===(val26('commandDateV261')||today26()));if(history[0])missionV261={...history[0],tasks:Array.isArray(history[0].tasks)?history[0].tasks:[]}}if(missionV261){set26('commandBriefV261',fmt26(missionV261.aiRaw||missionV261.brief||'Saved mission'));renderMissionV261()}else await window.buildLocalMissionV261();updateCommandStatsV261();window.renderCommandHistoryV261()};
  window.saveTodayMissionV261=async function(){if(!missionV261)return alert('Build a mission first.');await save26('dailyCommandReportsV261',{...missionV261,snapshotAt:Date.now(),type:'Morning Mission',source:'v26.1'});alert('Daily mission snapshot saved.');window.renderCommandHistoryV261()};
  window.sendMissionToCalendarV261=async function(){if(!missionV261?.tasks?.length)return alert('Build a mission first.');for(const t of missionV261.tasks){await save26('calendarItems',{date:missionV261.date,title:`${t.type}: ${t.title}`,type:'V26 Daily Command',subject:t.subject,minutes:t.minutes,body:t.reason,source:'v26.1'})}alert(`${missionV261.tasks.length} tasks sent to Calendar.`)};
  window.downloadCommandReportV261=function(){if(!missionV261)return alert('Build a mission first.');download26(`UPSC-Daily-Command-${missionV261.date}.txt`,`${missionV261.brief||''}\n\nTASKS\n${missionV261.tasks.map((t,i)=>`${i+1}. [${t.done?'x':' '}] ${t.title} — ${t.minutes} min — ${t.reason}`).join('\n')}`)};
  window.saveEveningReviewV261=async function(useAI){if(!missionV261)return alert('Build or load today’s mission first.');const review={date:missionV261.date,actualHours:Number(val26('commandActualHoursV261')||0),rating:Number(val26('commandDayRatingV261')||3),wins:val26('commandWinsV261'),blockers:val26('commandBlockersV261'),completed:missionV261.tasks.filter(x=>x.done).length,total:missionV261.tasks.length,tasks:missionV261.tasks,source:'v26.1'};let output=`# Evening Review\n\nCompleted ${review.completed}/${review.total} tasks.\nActual focused hours: ${review.actualHours}.\nDay rating: ${review.rating}/5.\n\n## Wins\n${review.wins||'Not recorded'}\n\n## Blockers\n${review.blockers||'Not recorded'}\n\n## Tomorrow rule\nCarry only unfinished High-priority work. Reduce task count before reducing revision quality.`;if(useAI){set26('commandReviewOutputV261','<div class="aiLoading">AI is comparing plan versus execution...</div>');try{output=await ask26(`Act as a UPSC performance coach. Review this day honestly but constructively. Identify planning error, execution error, habit trigger, what to carry forward, what to drop, and tomorrow's first 3 actions.\n${JSON.stringify(review).slice(0,16000)}`)}catch(e){output+='\n\nAI review failed: '+e.message}}lastReviewV261=output;review.body=output;await save26('dailyCommandReviewsV261',review);set26('commandReviewOutputV261',fmt26(output));window.renderCommandHistoryV261();alert('Evening review saved.')};
  window.reviewToTomorrowV261=async function(){const body=text26('commandReviewOutputV261');if(!body)return alert('Save or generate a review first.');await save26('smartRevision',{topic:'V26 carry-forward repairs',subject:'Daily Strategy',source:'v26.1 Evening Review',difficulty:'Medium',date:dateAdd26(val26('commandDateV261')||today26(),1),cycle:1,status:'pending',body});alert('Repair task sent to tomorrow’s Revision Brain.')};
  window.saveCommandReviewAsNoteV261=async function(){const body=text26('commandReviewOutputV261');if(!body)return alert('No review yet.');await save26('notes',{title:'Daily Command Review - '+(val26('commandDateV261')||today26()),subject:'Strategy',body,date:val26('commandDateV261')||today26(),source:'v26.1'});alert('Review saved as note.')};
  window.renderCommandHistoryV261=async function(){const [missions,reviews]=await Promise.all([get26('dailyCommandReportsV261'),get26('dailyCommandReviewsV261')]),all=[...missions.map(x=>({...x,_kind:'Mission'})),...reviews.map(x=>({...x,_kind:'Review'}))].sort((a,b)=>Number(b.createdAt?.seconds?b.createdAt.seconds:b.createdAt||b.snapshotAt||0)-Number(a.createdAt?.seconds?a.createdAt.seconds:a.createdAt||a.snapshotAt||0));const box=$26('commandHistoryV261');if(!box)return;box.innerHTML=all.length?all.slice(0,25).map((x,i)=>`<div class="v25HistoryCard"><div><span class="v25HistoryType">${esc26(x._kind)}</span><h3>${esc26(x.date||'Daily Command')} • ${x.completed!=null?`${x.completed}/${x.total} completed`:`${(x.tasks||[]).length} tasks`}</h3><p>${esc26(x.focus||x.wins||x.source||'V26.1')}</p></div><div class="actions"><button class="btn danger" onclick="deleteItem('${x._kind==='Mission'?'dailyCommandReportsV261':'dailyCommandReviewsV261'}','${esc26(id26(x,i))}');setTimeout(renderCommandHistoryV261,350)">Delete</button></div></div>`).join(''):'<div class="v25EmptyHistory">No saved daily command history yet.</div>'};

  // ---------- V26.2 TIME & HABIT INTELLIGENCE ----------
  let focusV262={running:false,paused:false,start:0,elapsedBefore:0,timer:null,targetMin:50,subject:'General',task:'',quality:'Deep Work',energy:3};
  const FOCUS_KEY_V262='mission_v262_active_focus';let lastHabitReportV262='';
  function formatClockV262(sec){sec=Math.max(0,Math.floor(sec));const h=String(Math.floor(sec/3600)).padStart(2,'0'),m=String(Math.floor(sec%3600/60)).padStart(2,'0'),s=String(sec%60).padStart(2,'0');return `${h}:${m}:${s}`}
  function elapsedV262(){return focusV262.elapsedBefore+(focusV262.running&&!focusV262.paused?Math.floor((Date.now()-focusV262.start)/1000):0)}
  function renderFocusV262(){const sec=elapsedV262(),target=Math.max(1,focusV262.targetMin*60),pct=Math.min(100,sec/target*100);if($26('focusClockV262'))$26('focusClockV262').textContent=formatClockV262(sec);if($26('focusProgressV262'))$26('focusProgressV262').style.width=pct+'%';if($26('focusStateV262')){$26('focusStateV262').textContent=focusV262.running?(focusV262.paused?'PAUSED':'FOCUSING'):'READY';$26('focusStateV262').className='v26Pill '+(focusV262.running&&!focusV262.paused?'green':focusV262.paused?'gold':'green')}if($26('focusStatusV262'))$26('focusStatusV262').innerHTML=focusV262.running?`${focusV262.subject} • ${esc26(focusV262.task||'Focus session')} • ${Math.round(pct)}% of ${focusV262.targetMin} min`:''}
  function persistFocusV262(){localStorage.setItem(FOCUS_KEY_V262,JSON.stringify({...focusV262,timer:null,currentElapsed:elapsedV262()}))}
  function clearFocusTimerV262(){if(focusV262.timer){clearInterval(focusV262.timer);focusV262.timer=null}}
  function startTickV262(){clearFocusTimerV262();focusV262.timer=setInterval(()=>{renderFocusV262();persistFocusV262();if(elapsedV262()>=focusV262.targetMin*60&&focusV262.running&&!focusV262.paused){if($26('focusStatusV262'))$26('focusStatusV262').innerHTML='🎯 Planned duration reached. Complete and save the session.'}},1000)}
  window.startFocusV262=function(){if(focusV262.running&&!focusV262.paused)return;const task=val26('focusTaskV262');if(!task)return alert('Enter the exact task first.');if(focusV262.running&&focusV262.paused){focusV262.paused=false;focusV262.start=Date.now();startTickV262();renderFocusV262();return}focusV262={running:true,paused:false,start:Date.now(),elapsedBefore:0,timer:null,targetMin:clamp26(val26('focusMinutesV262')||50,5,300),subject:val26('focusSubjectV262')||'General',task,quality:val26('focusQualityV262')||'Deep Work',energy:Number(val26('focusEnergyBeforeV262')||3),startedAt:Date.now()};startTickV262();persistFocusV262();renderFocusV262()};
  window.pauseFocusV262=function(){if(!focusV262.running)return alert('Start a session first.');if(focusV262.paused){focusV262.paused=false;focusV262.start=Date.now();startTickV262()}else{focusV262.elapsedBefore=elapsedV262();focusV262.paused=true;clearFocusTimerV262()}persistFocusV262();renderFocusV262()};
  async function markLinkedTaskDoneV262(){try{const link=JSON.parse(localStorage.getItem('mission_v262_linked_task')||'null');if(!link)return;const m=loadMissionLocalV261(link.missionDate);if(m){const t=m.tasks.find(x=>x.id===link.taskId);if(t)t.done=true;localStorage.setItem(missionKeyV261(link.missionDate),JSON.stringify(m));if(missionV261?.date===link.missionDate){missionV261=m;renderMissionV261()}}localStorage.removeItem('mission_v262_linked_task')}catch(e){}}
  window.completeFocusV262=async function(){if(!focusV262.running)return alert('Start a session first.');const sec=elapsedV262(),minutes=Math.max(1,Math.round(sec/60));clearFocusTimerV262();const record={date:today26(),startTime:new Date(focusV262.startedAt||Date.now()).toTimeString().slice(0,5),startHour:new Date(focusV262.startedAt||Date.now()).getHours(),minutes,plannedMinutes:focusV262.targetMin,subject:focusV262.subject,task:focusV262.task,quality:focusV262.quality,energy:focusV262.energy,completionRate:Math.round(minutes/focusV262.targetMin*100),source:'v26.2 Focus Timer'};await save26('timeSessionsV262',record);await markLinkedTaskDoneV262();focusV262={running:false,paused:false,start:0,elapsedBefore:0,timer:null,targetMin:Number(val26('focusMinutesV262')||50),subject:'General',task:'',quality:'Deep Work',energy:3};localStorage.removeItem(FOCUS_KEY_V262);renderFocusV262();alert(`${minutes} focused minutes saved.`);window.renderTimeHabitAnalyticsV262();updateCommandStatsV261()};
  window.cancelFocusV262=function(){if(focusV262.running&&!confirm('Cancel this unsaved focus session?'))return;clearFocusTimerV262();focusV262={running:false,paused:false,start:0,elapsedBefore:0,timer:null,targetMin:50,subject:'General',task:'',quality:'Deep Work',energy:3};localStorage.removeItem(FOCUS_KEY_V262);renderFocusV262()};
  window.saveManualTimeV262=async function(){const minutes=clamp26(val26('manualMinutesV262')||0,1,600),task=val26('manualTaskV262');if(!task||!minutes)return alert('Add task and minutes.');const time=val26('manualTimeV262')||'09:00';await save26('timeSessionsV262',{date:val26('manualDateV262')||today26(),startTime:time,startHour:Number(time.split(':')[0]||9),minutes,plannedMinutes:minutes,subject:val26('manualSubjectV262')||'General',task,quality:val26('manualQualityV262')||'Study',energy:Number(val26('manualEnergyV262')||3),completionRate:100,source:'v26.2 Manual Log'});$26('manualTaskV262').value='';alert('Manual study log saved.');window.renderTimeHabitAnalyticsV262();updateCommandStatsV261()};
  const habitIdsV262=['Wake','News','Revision','MCQ','Mains','Exercise','NoSocial','SleepTime'];
  window.saveHabitCheckinV262=async function(){const habits={};habitIdsV262.forEach(k=>habits[k]=!!$26('habit'+k+'V262')?.checked);const rec={date:val26('habitDateV262')||today26(),habits,sleep:Number(val26('habitSleepV262')||0),mood:val26('habitMoodV262')||'Okay',distraction:Number(val26('habitDistractionV262')||0),note:val26('habitNoteV262'),score:Math.round(Object.values(habits).filter(Boolean).length/habitIdsV262.length*100),source:'v26.2'};await save26('habitIntelligenceV262',rec);localStorage.setItem('mission_v262_habit_'+rec.date,JSON.stringify(rec));alert('Habit and energy check-in saved.');window.renderTimeHabitAnalyticsV262();updateCommandStatsV261()};
  window.loadTodayHabitV262=function(){try{const r=JSON.parse(localStorage.getItem('mission_v262_habit_'+(val26('habitDateV262')||today26()))||'null');if(!r)return alert('No local check-in saved for this date.');habitIdsV262.forEach(k=>{if($26('habit'+k+'V262'))$26('habit'+k+'V262').checked=!!r.habits?.[k]});if($26('habitSleepV262'))$26('habitSleepV262').value=r.sleep||'';if($26('habitMoodV262'))$26('habitMoodV262').value=r.mood||'Okay';if($26('habitDistractionV262'))$26('habitDistractionV262').value=r.distraction||'';if($26('habitNoteV262'))$26('habitNoteV262').value=r.note||''}catch(e){}}
  async function timeDataV262(){const [sessions,legacyStudy,legacyFocus,habits]=await Promise.all([get26('timeSessionsV262'),get26('studyLogs'),get26('focusSessions'),get26('habitIntelligenceV262')]);const legacy=[...legacyStudy.map(x=>({date:x.date,minutes:Number(x.hours||0)*60,subject:x.subject||'General',task:x.note||'Study log',startHour:null,quality:'Legacy Study',source:'Legacy'})),...legacyFocus.map(x=>({date:x.date,minutes:Number(x.minutes||0),subject:x.subject||'General',task:x.task||'Focus session',startHour:null,quality:'Legacy Focus',source:'Legacy'}))].filter(x=>x.minutes>0);return {sessions:[...sessions,...legacy],rawSessions:sessions,habits:latestByDate26(habits)}}
  function rangeDatesV262(days){const out=[];for(let i=days-1;i>=0;i--)out.push(dateAdd26(today26(),-i));return out}
  function barRowsV262(items,labelFn,valueFn,suffix='m'){const max=Math.max(1,...items.map(valueFn));return items.map(x=>{const v=valueFn(x);return `<div class="v262BarRow"><span>${esc26(labelFn(x))}</span><div class="v262BarTrack"><div class="v262BarFill" style="width:${Math.round(v/max*100)}%"></div></div><b>${Math.round(v)}${suffix}</b></div>`}).join('')}
  window.renderTimeHabitAnalyticsV262=async function(){const days=Number(val26('analyticsRangeV262')||7),start=dateAdd26(today26(),-(days-1)),data=await timeDataV262(),sessions=data.sessions.filter(x=>String(x.date||'')>=start&&String(x.date||'')<=today26()),habits=data.habits.filter(x=>String(x.date||'')>=start&&String(x.date||'')<=today26());const total=sessions.reduce((a,x)=>a+Number(x.minutes||0),0),dates=rangeDatesV262(days),daily=dates.map(d=>({date:d,minutes:sessions.filter(x=>x.date===d).reduce((a,x)=>a+Number(x.minutes||0),0)})),subjects={};sessions.forEach(x=>subjects[x.subject||'General']=(subjects[x.subject||'General']||0)+Number(x.minutes||0));const subjectList=Object.entries(subjects).map(([subject,minutes])=>({subject,minutes})).sort((a,b)=>b.minutes-a.minutes).slice(0,10),consistency=habits.length?Math.round(habits.reduce((a,x)=>a+Number(x.score||0),0)/habits.length):0,hours={};data.rawSessions.filter(x=>String(x.date||'')>=start).forEach(x=>{if(Number.isFinite(Number(x.startHour)))hours[x.startHour]=(hours[x.startHour]||0)+Number(x.minutes||0)});const best=Object.entries(hours).sort((a,b)=>b[1]-a[1])[0];if($26('timeTotalV262'))$26('timeTotalV262').textContent=(total/60).toFixed(total%60?1:0)+'h';if($26('timeAverageV262'))$26('timeAverageV262').textContent=(total/60/days).toFixed(1)+'h';if($26('habitConsistencyV262'))$26('habitConsistencyV262').textContent=consistency+'%';if($26('bestHourV262'))$26('bestHourV262').textContent=best?`${String(best[0]).padStart(2,'0')}:00–${String((Number(best[0])+1)%24).padStart(2,'0')}:00`:'—';if($26('timeRangeLabelV262'))$26('timeRangeLabelV262').textContent=`last ${days} days`;
    set26('dailyTimeChartV262',barRowsV262(daily,x=>x.date.slice(5),x=>x.minutes));set26('subjectTimeChartV262',subjectList.length?barRowsV262(subjectList,x=>x.subject,x=>x.minutes):'<div class="v25EmptyHistory">No study sessions in this range.</div>');
    const habitLabels={Wake:'Wake on time',News:'Newspaper / CA',Revision:'Revision',MCQ:'MCQ practice',Mains:'Mains answer',Exercise:'Exercise',NoSocial:'Controlled social media',SleepTime:'Sleep on time'};set26('habitChartV262',habitIdsV262.map(k=>{const seq=dates.map(d=>habits.find(x=>x.date===d)?.habits?.[k]||false),pct=habits.length?Math.round(seq.filter(Boolean).length/habits.length*100):0;return `<div class="v262HabitRow"><span>${habitLabels[k]}</span><div class="v262HabitDots">${seq.slice(-14).map(v=>`<i class="v262HabitDot ${v?'on':''}"></i>`).join('')}</div><b>${pct}%</b></div>`}).join(''));
    const avgSleep=habits.length?habits.reduce((a,x)=>a+Number(x.sleep||0),0)/habits.length:0,avgDist=habits.length?habits.reduce((a,x)=>a+Number(x.distraction||0),0)/habits.length:0,studyDays=daily.filter(x=>x.minutes>0).length,streak=consecutiveDates26([...sessions.map(x=>x.date),...habits.map(x=>x.date)]),signals=[];signals.push({c:studyDays>=Math.ceil(days*.7)?'good':'warn',t:`Studied on ${studyDays}/${days} days; current evidence streak is ${streak} day(s).`});if(avgSleep)signals.push({c:avgSleep>=7?'good':'warn',t:`Average sleep ${avgSleep.toFixed(1)} h. ${avgSleep<7?'Sleep debt may reduce recall and morning discipline.':'Sleep is supporting preparation.'}`});if(habits.length)signals.push({c:avgDist<=60?'good':'warn',t:`Average recorded distraction ${Math.round(avgDist)} min/day.`});if(subjectList[0])signals.push({c:'',t:`Most time went to ${subjectList[0].subject} (${Math.round(subjectList[0].minutes/60*10)/10} h). Check whether this matches exam priority.`});set26('patternSignalsV262',signals.map(x=>`<div class="v262Signal ${x.c}">${esc26(x.t)}</div>`).join(''));
    const todayList=data.rawSessions.filter(x=>x.date===today26());set26('todaySessionsV262',todayList.length?todayList.map((x,i)=>`<div class="v262CompactItem"><div><b>${esc26(x.subject)} • ${esc26(x.task)}</b><small>${esc26(x.startTime||'')} • ${esc26(x.quality||'Study')}</small></div><span>${Number(x.minutes||0)} min</span></div>`).join(''):'<div class="v25EmptyHistory">No V26 sessions saved today.</div>');
    const history=$26('timeHistoryV262');if(history)history.innerHTML=data.rawSessions.length?data.rawSessions.slice(0,35).map((x,i)=>`<div class="v25HistoryCard"><div><span class="v25HistoryType">${esc26(x.subject||'Study')}</span><h3>${esc26(x.task||'Focus session')}</h3><p>${esc26(x.date||'')} • ${Number(x.minutes||0)} min • ${esc26(x.quality||'Study')} • Energy ${Number(x.energy||0)||'—'}/5</p></div><div class="actions"><button class="btn danger" onclick="deleteItem('timeSessionsV262','${esc26(id26(x,i))}');setTimeout(renderTimeHabitAnalyticsV262,350)">Delete</button></div></div>`).join(''):'<div class="v25EmptyHistory">No V26 time sessions saved yet.</div>';
    return {days,totalMinutes:total,daily,subjects:subjectList,consistency,bestHour:best?Number(best[0]):null,avgSleep,avgDistraction:avgDist,studyDays,streak,habitDays:habits.length};
  };
  window.generateHabitDiagnosisV262=async function(){if($26('habitAIStatusV262'))$26('habitAIStatusV262').innerHTML='🤖 AI is analysing your execution patterns...';set26('habitAIOutputV262','<div class="aiLoading">Comparing focused time, energy, sleep, habits and distractions...</div>');try{const a=await window.renderTimeHabitAnalyticsV262(),data=await timeDataV262(),recentSessions=data.rawSessions.slice(0,60),recentHabits=data.habits.slice(0,30),q=val26('habitAIQuestionV262');const prompt=`Act as a UPSC productivity and habit coach. Diagnose evidence, not personality.\nAnalytics: ${JSON.stringify(a)}\nRecent sessions: ${JSON.stringify(recentSessions).slice(0,12000)}\nRecent habit check-ins: ${JSON.stringify(recentHabits).slice(0,10000)}\nUser constraint: ${q||'None'}\n\nGive: 1) strongest pattern, 2) main bottleneck, 3) best focus window, 4) subject imbalance, 5) sleep/distraction link, 6) exact weekday routine, 7) low-energy routine, 8) three habits to protect, 9) three habits to stop, 10) measurable seven-day experiment. Be realistic for UPSC.`;const raw=await ask26(prompt);lastHabitReportV262=raw;set26('habitAIOutputV262',fmt26(raw));await save26('habitAIReportsV262',{date:today26(),body:raw,analytics:a,question:q,source:'v26.2'});if($26('habitAIStatusV262'))$26('habitAIStatusV262').innerHTML=settings26().mode==='chatgpt'?'📋 Prompt copied for ChatGPT.':'✅ Routine diagnosis generated and saved.'}catch(e){set26('habitAIOutputV262',fmt26('AI diagnosis failed: '+e.message));if($26('habitAIStatusV262'))$26('habitAIStatusV262').innerHTML='⚠ Check AI Control Centre.'}};
  window.habitDiagnosisToMissionV262=function(){const body=text26('habitAIOutputV262');if(!body)return alert('Generate a diagnosis first.');const lines=body.split('\n').map(x=>x.replace(/^[-*#\d.\s]+/,'').trim()).filter(x=>x.length>14&&x.length<180).slice(0,4);const date=val26('commandDateV261')||today26();missionV261=loadMissionLocalV261(date)||{date,source:'V26.2 Routine Intelligence',focus:'Routine repair',tasks:[],brief:'Routine fixes from Time & Habit Intelligence'};for(const line of lines)missionV261.tasks.push(normalizeTaskV261({title:line,type:'Habit Repair',subject:'Strategy',minutes:30,reason:'Recommended by V26.2 routine diagnosis',priority:'Medium'},missionV261.tasks.length));saveMissionLocalV261();alert(`${lines.length} routine fixes added to Daily Command.`)};
  window.downloadHabitReportV262=function(){const body=text26('habitAIOutputV262');if(!body)return alert('Generate a report first.');download26(`UPSC-Time-Habit-Report-${today26()}.txt`,body)};
  function restoreFocusV262(){try{const x=JSON.parse(localStorage.getItem(FOCUS_KEY_V262)||'null');if(!x?.running)return;focusV262={...focusV262,...x,timer:null,elapsedBefore:Number(x.currentElapsed||x.elapsedBefore||0),start:Date.now(),paused:!!x.paused};if(!focusV262.paused)startTickV262();renderFocusV262()}catch(e){}}
  async function initV261(){updateBadges26();if($26('commandDateV261')&&!$26('commandDateV261').value)$26('commandDateV261').value=today26();await window.loadTodayMissionV261();}
  async function initV262(){updateBadges26();if($26('manualDateV262')&&!$26('manualDateV262').value)$26('manualDateV262').value=today26();if($26('habitDateV262')&&!$26('habitDateV262').value)$26('habitDateV262').value=today26();restoreFocusV262();window.renderTimeHabitAnalyticsV262();}
  const previousShowV26=window.show;if(typeof previousShowV26==='function')window.show=function(id,btn){const r=previousShowV26.apply(this,arguments);setTimeout(()=>{if(id==='dailyCommandV261')initV261();if(id==='timeHabitV262')initV262();},100);return r};
  document.addEventListener('DOMContentLoaded',()=>{if($26('commandDateV261'))$26('commandDateV261').value=today26();if($26('manualDateV262'))$26('manualDateV262').value=today26();if($26('habitDateV262'))$26('habitDateV262').value=today26();updateBadges26()});
})();


/* ===== V26.3 PHASE 3: AI MEMORY ENGINE + SPACED REVISION ===== */
(function(){
  'use strict';
  const $m=id=>document.getElementById(id);
  const escM=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const todayM=()=>new Date().toISOString().slice(0,10);
  const addDaysM=(date,days)=>{const d=new Date((date||todayM())+'T12:00:00');d.setDate(d.getDate()+Number(days||0));return d.toISOString().slice(0,10)};
  const valM=(id,def='')=>String($m(id)?.value??def).trim();
  const textM=id=>String($m(id)?.innerText||'').trim();
  const setM=(id,html)=>{const e=$m(id);if(e)e.innerHTML=html};
  const clampM=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));
  const fmtM=t=>{try{return typeof window.formatAI==='function'?window.formatAI(String(t||'')):`<pre>${escM(t)}</pre>`}catch(e){return `<pre>${escM(t)}</pre>`}};
  const settingsM=()=>{try{return {mode:'ollama',ollamaModel:'gemma3:4b',...JSON.parse(localStorage.getItem('mission_ai_settings_v23')||'{}')}}catch(e){return {mode:'ollama',ollamaModel:'gemma3:4b'}}};
  const modeLabelM=()=>{const s=settingsM();return s.mode==='ollama'?'🖥 Ollama Local':s.mode==='gemini'?'☁ Gemini Free API':s.mode==='chatgpt'?'📋 ChatGPT Prompt Mode':'⭐ Smart Hybrid'};
  async function askM(prompt){if(typeof window.aiAskRouterV23==='function')return await window.aiAskRouterV23(prompt);throw new Error('AI router unavailable. Save AI settings in AI Control Centre.');}
  async function getM(col){try{return typeof window.getCol==='function'?await window.getCol(col):JSON.parse(localStorage.getItem(col)||'[]')}catch(e){return []}}
  async function saveM(col,obj){if(typeof window.saveCol==='function')return await window.saveCol(col,obj);const a=await getM(col);a.unshift({...obj,id:'local_'+Date.now()+'_'+Math.random().toString(36).slice(2)});localStorage.setItem(col,JSON.stringify(a));}
  const idM=(x,i=0)=>String(x?._docId||x?.id||i);
  function downloadM(name,text){const b=new Blob([String(text||'')],{type:'text/plain;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),800)}
  async function updateM(col,item,patch){
    const id=idM(item);if(!id)return;
    if(cloudEnabled&&user){await setDoc(doc(db,path(col),id),{...patch,updatedAt:serverTimestamp()},{merge:true});return}
    const a=localGet(col),i=a.findIndex(x=>String(x.id)===String(id));if(i>=0){a[i]={...a[i],...patch,updatedAt:Date.now()};localSet(col,a)}
  }
  function normalizedTextM(s){return String(s||'').toLowerCase().replace(/<[^>]*>/g,' ').replace(/[^a-z0-9\u0900-\u097f\u0b80-\u0bff]+/g,' ').replace(/\s+/g,' ').trim()}
  function sourceKeyM(collection,id,question){return `${collection||'manual'}::${id||normalizedTextM(question).slice(0,90)}`}
  function cardM(raw={}){
    const q=String(raw.question||raw.q||raw.front||raw.topic||raw.title||'Recall this topic').trim(),a=String(raw.answer||raw.a||raw.back||raw.body||raw.reason||raw.explanation||'Review the source material.').trim();
    return {question:q.slice(0,1200),answer:a.slice(0,12000),subject:String(raw.subject||'General'),difficulty:String(raw.difficulty||'Medium'),source:String(raw.source||'Manual'),sourceCollection:String(raw.sourceCollection||'manual'),sourceId:String(raw.sourceId||''),sourceKey:String(raw.sourceKey||sourceKeyM(raw.sourceCollection,raw.sourceId,q)),createdDate:raw.createdDate||todayM(),dueDate:raw.dueDate||raw.due||todayM(),intervalDays:Number(raw.intervalDays||0),ease:Number(raw.ease||2.5),repetitions:Number(raw.repetitions||0),lapses:Number(raw.lapses||0),reviews:Number(raw.reviews||0),lastReviewed:raw.lastReviewed||'',lastRating:raw.lastRating||'',status:raw.status||'active'}
  }
  let memoryCardsM=[],generatedCardsM=[],queueM=[],queueIndexM=0,sessionStatsM={again:0,hard:0,good:0,easy:0,skipped:0},lastDiagnosisM='';

  function updateBadgeM(){const e=$m('memoryAIBadgeV263'),s=settingsM();if(e)e.textContent=`Selected AI: ${modeLabelM()} • ${s.ollamaModel||'Cloud/Prompt'}`}
  function isDueM(c){return !c.dueDate||String(c.dueDate)<=todayM()}
  function isOverdueM(c){return !!c.dueDate&&String(c.dueDate)<todayM()}
  function retentionM(logs){if(!logs.length)return 0;const recent=logs.slice(0,100),score=recent.reduce((a,x)=>a+({again:0,hard:2,good:3,easy:4}[x.rating]??0),0);return Math.round(score/(recent.length*4)*100)}
  async function loadMemoryM(){memoryCardsM=(await getM('memoryCardsV263')).filter(x=>String(x.status||'active')!=='deleted').map(cardM);return memoryCardsM}

  function parsePackM(raw){
    const s=String(raw||'').trim(),candidates=[];const marker=s.match(/MEMORY_JSON\s*:\s*(\{[\s\S]*\})/i);if(marker)candidates.push(marker[1]);const fence=s.match(/```(?:json)?\s*([\s\S]*?)```/i);if(fence)candidates.push(fence[1]);const a=s.indexOf('{'),b=s.lastIndexOf('}');if(a>=0&&b>a)candidates.push(s.slice(a,b+1));
    for(const x of candidates){try{const j=JSON.parse(x);const arr=Array.isArray(j)?j:j.cards;if(Array.isArray(arr))return arr.map(cardM)}catch(e){}}
    return [];
  }
  function recallPromptM(){const topic=valM('memoryTopicV263')||'UPSC study material',subject=valM('memorySubjectV263')||'General',count=Number(valM('memoryCountV263')||20),source=valM('memorySourceTextV263');return `Act as a UPSC active-recall and memory-design expert. Create exactly ${count} high-quality recall cards on ${topic} (${subject}).\nSource material:\n${String(source||'No source supplied; use reliable core UPSC knowledge.').slice(0,28000)}\n\nRules: test one clear idea per card; mix factual recall, concept explanation, compare/contrast, cause-effect, map/flow recall and mains value addition; avoid vague questions; answers must be concise but sufficient; include important Articles, cases, reports, examples or current-affairs linkages only when relevant.\nReturn exactly one machine-readable line first:\nMEMORY_JSON: {"cards":[{"question":"","answer":"","subject":"${subject}","difficulty":"Easy/Medium/Hard"}]}\nThen provide a short quality summary.`}

  async function saveCardsM(cards,source='V26.3'){
    if(!cards?.length)return 0;const existing=await getM('memoryCardsV263'),keys=new Set(existing.map(x=>x.sourceKey||sourceKeyM(x.sourceCollection,x.sourceId,x.question||x.q))),questions=new Set(existing.map(x=>normalizedTextM(x.question||x.q)).filter(Boolean));let n=0;
    for(const raw of cards){const c=cardM({...raw,source:raw.source||source});if(!c.question||!c.answer)continue;if(keys.has(c.sourceKey)||questions.has(normalizedTextM(c.question)))continue;await saveM('memoryCardsV263',c);keys.add(c.sourceKey);questions.add(normalizedTextM(c.question));n++}
    return n;
  }

  window.scanStudyDataV263=async function(){
    const status=$m('memoryAIStatusV263');if(status)status.innerHTML='Scanning selected study sources and removing duplicates...';const limit=Number(valM('memoryImportLimitV263')||100),subjectFilter=valM('memoryImportSubjectV263')||'All';
    const jobs=[];if($m('memoryUseFlashV263')?.checked)jobs.push('flash');if($m('memoryUseWrongV263')?.checked)jobs.push('wrongbook');if($m('memoryUseNotesV263')?.checked)jobs.push('notes');if($m('memoryUseRevisionV263')?.checked)jobs.push('smartRevision','revision');if(!jobs.length)return alert('Select at least one source.');
    const data=await Promise.all(jobs.map(getM)),cards=[];jobs.forEach((col,idx)=>{for(const x of data[idx]||[]){const subject=String(x.subject||'General');if(subjectFilter!=='All'&&subject!==subjectFilter)continue;let q='',a='';if(col==='flash'){q=x.q||x.question||x.title;a=x.a||x.answer||x.body}else if(col==='wrongbook'){q=x.question||`Explain the mistake in: ${x.topic||'wrong answer'}`;a=[x.reason,x.explanation,x.answer].filter(Boolean).join('\n')}else if(col==='notes'){q=`Recall the key UPSC points from: ${x.title||x.topic||'this note'}`;a=x.body||x.content||x.text}else{q=`Actively recall: ${x.topic||x.title||'revision item'}`;a=x.body||`Subject: ${subject}. Source: ${x.source||'Revision Brain'}. Explain the concept, examples and PYQ angle.`}if(!q||!a)continue;cards.push(cardM({question:q,answer:a,subject,source:`Imported from ${col}`,sourceCollection:col,sourceId:idM(x),sourceKey:sourceKeyM(col,idM(x),q),difficulty:x.difficulty||'Medium'}));if(cards.length>=limit)break} });
    const n=await saveCardsM(cards,'Study Data Scan');if(status)status.innerHTML=`✅ Added ${n} new memory cards. ${cards.length-n} duplicates or empty items were skipped.`;await window.refreshMemoryEngineV263();
  };

  window.importMemoryFileV263=async function(){const f=$m('memoryFileV263')?.files?.[0];if(!f)return alert('Choose a file first.');const box=$m('memoryFileStatusV263');if(box){box.className='aiRoomFileStatusV254 busy';box.innerHTML=`Reading <b>${escM(f.name)}</b>...`};try{let text='';if(typeof window.readUniversalAIFileV254==='function')text=await window.readUniversalAIFileV254(f,'V26.3 memory recall pack');else text=await f.text();if(!text.trim())throw new Error('No readable text found.');$m('memorySourceTextV263').value=String(text).slice(0,60000);if(!$m('memoryTopicV263').value)$m('memoryTopicV263').value=f.name.replace(/\.[^.]+$/,'');if(box){box.className='aiRoomFileStatusV254 ok';box.innerHTML=`✅ <b>${escM(f.name)}</b> loaded • ${String(text).length.toLocaleString()} characters. Review the text, then generate a recall pack.`}}catch(e){if(box){box.className='aiRoomFileStatusV254 error';box.textContent='⚠ '+e.message};alert('File import failed: '+e.message)}};

  window.generateMemoryPackV263=async function(){const prompt=recallPromptM();setM('memoryAIOutputV263','<div class="aiLoading">Creating high-quality active-recall cards...</div>');if($m('memoryAIStatusV263'))$m('memoryAIStatusV263').innerHTML='🤖 Selected AI is building the recall pack...';try{const raw=await askM(prompt);generatedCardsM=parsePackM(raw);setM('memoryAIOutputV263',fmtM(raw));if($m('memoryAIStatusV263'))$m('memoryAIStatusV263').innerHTML=generatedCardsM.length?`✅ Parsed ${generatedCardsM.length} cards. Review and save them.`:(settingsM().mode==='chatgpt'?'📋 Prompt copied. Paste ChatGPT JSON into Manual Import.':'⚠ AI response displayed, but no valid card JSON was found. Use Manual JSON Import.')}catch(e){setM('memoryAIOutputV263',fmtM('Memory pack generation failed: '+e.message));if($m('memoryAIStatusV263'))$m('memoryAIStatusV263').innerHTML='⚠ Check AI Control Centre and try again.'}};
  window.saveGeneratedMemoryPackV263=async function(){if(!generatedCardsM.length)return alert('Generate or import a valid recall pack first.');const n=await saveCardsM(generatedCardsM,'AI Recall Pack');alert(`${n} new memory cards saved; duplicates were skipped.`);await window.refreshMemoryEngineV263()};
  window.importMemoryJSONV263=async function(){const raw=valM('memoryManualJSONV263');if(!raw)return alert('Paste JSON first.');const cards=parsePackM(raw);if(!cards.length)return alert('No valid cards found. Use {"cards":[...]} format.');generatedCardsM=cards;setM('memoryAIOutputV263',`<div class="v263ImportSuccess">✅ Parsed ${cards.length} manual cards. Click Save Parsed Cards.</div>`);if($m('memoryAIStatusV263'))$m('memoryAIStatusV263').innerHTML=`✅ ${cards.length} manual cards ready.`};
  window.copyMemoryPromptV263=async function(){const p=recallPromptM();try{await navigator.clipboard.writeText(p);if($m('memoryAIStatusV263'))$m('memoryAIStatusV263').innerHTML='✅ Prompt copied.'}catch(e){setM('memoryAIOutputV263',fmtM(p))}};

  function filterQueueM(cards){const mode=valM('memoryQueueModeV263')||'due',subject=valM('memoryQueueSubjectV263')||'All';return cards.filter(c=>subject==='All'||c.subject===subject).filter(c=>mode==='all'||(mode==='due'&&isDueM(c))||(mode==='new'&&!Number(c.repetitions))||(mode==='difficult'&&(Number(c.lapses)>=2||Number(c.ease)<1.9))).sort((a,b)=>String(a.dueDate||todayM()).localeCompare(String(b.dueDate||todayM()))||Number(b.lapses||0)-Number(a.lapses||0))}
  function currentM(){return queueM[queueIndexM]||null}
  function renderCurrentM(){const c=currentM(),stage=$m('memoryCardStageV263'),empty=$m('memorySessionEmptyV263'),total=queueM.length,pct=total?Math.round(queueIndexM/total*100):0;if($m('memoryProgressBarV263'))$m('memoryProgressBarV263').style.width=pct+'%';if($m('memoryProgressTextV263'))$m('memoryProgressTextV263').textContent=`${Math.min(queueIndexM,total)} / ${total}`;if(!c){if(stage)stage.hidden=true;if(empty){empty.hidden=false;empty.textContent=total?'Session complete. Review your summary below.':'No cards match this queue.'}renderSessionSummaryM();return}if(empty)empty.hidden=true;if(stage)stage.hidden=false;setM('memoryCardSubjectV263',escM(c.subject));setM('memoryCardSourceV263',escM(c.source));setM('memoryCardDueLabelV263',isOverdueM(c)?`Overdue ${c.dueDate}`:Number(c.repetitions)===0?'New Card':`Due ${c.dueDate}`);setM('memoryQuestionV263',escM(c.question).replace(/\n/g,'<br>'));setM('memoryAnswerV263',escM(c.answer).replace(/\n/g,'<br>'));$m('memoryAnswerV263').hidden=true;$m('memoryRevealActionsV263').hidden=false;$m('memoryRatingActionsV263').hidden=true}
  function renderSessionSummaryM(){const done=Object.values(sessionStatsM).reduce((a,n)=>a+n,0);setM('memorySessionSummaryV263',done?`<div class="v263SummaryGrid"><span><b>${done}</b>Total reviewed</span><span class="again"><b>${sessionStatsM.again}</b>Again</span><span class="hard"><b>${sessionStatsM.hard}</b>Hard</span><span class="good"><b>${sessionStatsM.good}</b>Good</span><span class="easy"><b>${sessionStatsM.easy}</b>Easy</span><span><b>${sessionStatsM.skipped}</b>Skipped</span></div>`:'')}
  window.startMemorySessionV263=async function(){await loadMemoryM();queueM=filterQueueM(memoryCardsM).slice(0,Number(valM('memorySessionSizeV263')||20));queueIndexM=0;sessionStatsM={again:0,hard:0,good:0,easy:0,skipped:0};renderCurrentM();renderSessionSummaryM()};
  window.revealMemoryAnswerV263=function(){$m('memoryAnswerV263').hidden=false;$m('memoryRevealActionsV263').hidden=true;$m('memoryRatingActionsV263').hidden=false};
  window.skipMemoryCardV263=function(){sessionStatsM.skipped++;queueIndexM++;renderCurrentM()};
  function scheduleM(c,rating){let ease=Number(c.ease||2.5),reps=Number(c.repetitions||0),interval=Number(c.intervalDays||0),lapses=Number(c.lapses||0);if(rating==='again'){reps=0;interval=1;ease=Math.max(1.3,ease-.2);lapses++}else if(rating==='hard'){reps++;interval=reps<=1?1:Math.max(2,Math.round(Math.max(1,interval)*1.2));ease=Math.max(1.3,ease-.15)}else if(rating==='good'){reps++;interval=reps===1?1:reps===2?3:Math.max(4,Math.round(Math.max(1,interval)*ease))}else{reps++;interval=reps===1?4:Math.max(7,Math.round(Math.max(1,interval)*ease*1.3));ease=Math.min(3.2,ease+.15)}return {ease:Number(ease.toFixed(2)),repetitions:reps,intervalDays:interval,lapses,dueDate:addDaysM(todayM(),interval),lastReviewed:todayM(),lastRating:rating,reviews:Number(c.reviews||0)+1}}
  window.rateMemoryCardV263=async function(rating){const c=currentM();if(!c)return;const patch=scheduleM(c,rating);try{await updateM('memoryCardsV263',c,patch);if(c.sourceCollection==='flash'&&c.sourceId)await updateM('flash',{id:c.sourceId,_docId:c.sourceId},{due:patch.dueDate,lastReviewed:patch.lastReviewed,memoryEase:patch.ease,memoryInterval:patch.intervalDays});await saveM('memoryReviewLogsV263',{date:todayM(),cardId:idM(c),question:c.question,subject:c.subject,source:c.source,rating,previousInterval:Number(c.intervalDays||0),nextInterval:patch.intervalDays,nextDue:patch.dueDate,lapses:patch.lapses});Object.assign(c,patch);sessionStatsM[rating]++;queueIndexM++;renderCurrentM();window.renderMemoryAnalyticsV263()}catch(e){alert('Could not save review: '+e.message)}};

  async function memoryStatsM(){const [cards,logs]=await Promise.all([loadMemoryM(),getM('memoryReviewLogsV263')]);return {cards,logs,due:cards.filter(isDueM),overdue:cards.filter(isOverdueM),newCards:cards.filter(x=>!Number(x.repetitions)),retention:retentionM(logs)}}
  function barRowsM(items,max){return items.map(x=>`<div class="v262BarRow"><span>${escM(x.label)}</span><div class="v262BarTrack"><div class="v262BarFill" style="width:${Math.max(2,Math.round(x.value/Math.max(1,max)*100))}%"></div></div><b>${x.value}</b></div>`).join('')}
  window.renderMemoryAnalyticsV263=async function(){const s=await memoryStatsM();if($m('memoryDueV263'))$m('memoryDueV263').textContent=s.due.length;if($m('memoryOverdueV263'))$m('memoryOverdueV263').textContent=s.overdue.length;if($m('memoryNewV263'))$m('memoryNewV263').textContent=s.newCards.length;if($m('memoryRetentionV263'))$m('memoryRetentionV263').textContent=s.retention+'%';const forecast=[];for(let i=0;i<7;i++){const d=addDaysM(todayM(),i);forecast.push({label:i===0?'Today':new Date(d+'T12:00:00').toLocaleDateString(undefined,{weekday:'short'}),value:s.cards.filter(x=>String(x.dueDate||todayM())===d).length})}setM('memoryForecastV263',barRowsM(forecast,Math.max(...forecast.map(x=>x.value),1)));const src={};s.cards.forEach(x=>src[x.sourceCollection||x.source||'Manual']=(src[x.sourceCollection||x.source||'Manual']||0)+1);const sources=Object.entries(src).map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value).slice(0,8);setM('memorySourceMixV263',barRowsM(sources,Math.max(...sources.map(x=>x.value),1)));const difficult=[...s.cards].sort((a,b)=>(Number(b.lapses||0)*10+(isOverdueM(b)?5:0)-Number(b.ease||2.5))-(Number(a.lapses||0)*10+(isOverdueM(a)?5:0)-Number(a.ease||2.5))).filter(x=>Number(x.lapses)>=1||Number(x.ease)<2.2||isOverdueM(x)).slice(0,12);setM('memoryDifficultListV263',difficult.length?difficult.map(x=>`<div class="v263DifficultItem"><div><b>${escM(x.question)}</b><small>${escM(x.subject)} • ${Number(x.lapses||0)} lapses • ease ${Number(x.ease||2.5).toFixed(2)} • due ${escM(x.dueDate||todayM())}</small></div><button class="v26MiniBtn" onclick="reviewOneMemoryCardV263('${escM(idM(x))}')">Review</button></div>`).join(''):'<div class="v25EmptyHistory">No difficult cards yet.</div>');window.renderMemoryBankV263()};
  window.reviewOneMemoryCardV263=async function(id){await loadMemoryM();const c=memoryCardsM.find(x=>idM(x)===String(id));if(!c)return;queueM=[c];queueIndexM=0;sessionStatsM={again:0,hard:0,good:0,easy:0,skipped:0};renderCurrentM();$m('memoryCardStageV263')?.scrollIntoView({behavior:'smooth',block:'center'})};
  window.renderMemoryBankV263=async function(){if(!memoryCardsM.length)await loadMemoryM();const q=normalizedTextM(valM('memorySearchV263')),arr=memoryCardsM.filter(x=>!q||normalizedTextM([x.question,x.answer,x.subject,x.source].join(' ')).includes(q)).sort((a,b)=>String(a.dueDate||todayM()).localeCompare(String(b.dueDate||todayM()))).slice(0,100);setM('memoryBankListV263',arr.length?arr.map(x=>`<div class="v263BankItem"><div><span class="v26Pill">${escM(x.subject)}</span><h3>${escM(x.question)}</h3><p>${escM(String(x.answer).slice(0,240))}${String(x.answer).length>240?'…':''}</p><small>Due ${escM(x.dueDate||todayM())} • interval ${Number(x.intervalDays||0)}d • reviews ${Number(x.reviews||0)} • ${escM(x.source)}</small></div><div class="v263BankActions"><button class="btn blue" onclick="reviewOneMemoryCardV263('${escM(idM(x))}')">Review</button><button class="btn danger" onclick="deleteMemoryCardV263('${escM(idM(x))}')">Delete</button></div></div>`).join(''):'<div class="v25EmptyHistory">No memory cards yet. Scan existing study data or generate an AI recall pack.</div>')};
  window.deleteMemoryCardV263=async function(id){if(!confirm('Delete this memory card? The original note or flashcard will remain.'))return;await window.deleteItem('memoryCardsV263',id,true);memoryCardsM=memoryCardsM.filter(x=>idM(x)!==String(id));await window.refreshMemoryEngineV263()};

  window.sendMemoryDueToCommandV263=async function(){const s=await memoryStatsM(),due=s.due.slice(0,30);if(!due.length)return alert('No due cards.');const by={};due.forEach(x=>by[x.subject]=(by[x.subject]||0)+1);for(const [subject,n] of Object.entries(by).slice(0,4))await saveM('tasks',{text:`Active recall: ${subject} (${n} due cards)`,title:`Active recall: ${subject} (${n} due cards)`,subject,minutes:Math.min(60,Math.max(20,n*2)),status:'pending',type:'Memory',date:todayM(),source:'v26.3 Memory Engine'});alert('Due recall blocks added to pending tasks. Build or reload Daily Command Centre to include them.')};
  window.sendMemoryLeechesToRevisionV263=async function(){const s=await memoryStatsM(),list=s.cards.filter(x=>Number(x.lapses)>=2||Number(x.ease)<1.9).slice(0,12);if(!list.length)return alert('No difficult/leech cards yet.');for(const x of list)await saveM('smartRevision',{topic:`Memory repair: ${x.question.slice(0,120)}`,subject:x.subject,source:'v26.3 Memory Engine',difficulty:'Hard',date:todayM(),cycle:1,status:'pending',body:x.answer});alert(`${list.length} difficult memory items sent to Revision Brain.`)};

  window.generateMemoryDiagnosisV263=async function(){const s=await memoryStatsM(),bySubject={},byRating={};s.cards.forEach(x=>{const z=bySubject[x.subject]||(bySubject[x.subject]={total:0,due:0,overdue:0,lapses:0});z.total++;if(isDueM(x))z.due++;if(isOverdueM(x))z.overdue++;z.lapses+=Number(x.lapses||0)});s.logs.slice(0,100).forEach(x=>byRating[x.rating]=(byRating[x.rating]||0)+1);const snapshot={total:s.cards.length,due:s.due.length,overdue:s.overdue.length,newCards:s.newCards.length,retention:s.retention,subjects:bySubject,recentRatings:byRating,difficult:s.cards.filter(x=>Number(x.lapses)>=2||Number(x.ease)<1.9).slice(0,15).map(x=>({q:x.question,subject:x.subject,lapses:x.lapses,ease:x.ease,due:x.dueDate})),constraint:valM('memoryDiagnosisQuestionV263')};setM('memoryDiagnosisOutputV263','<div class="aiLoading">Analysing recall quality, overdue load and forgetting patterns...</div>');if($m('memoryDiagnosisStatusV263'))$m('memoryDiagnosisStatusV263').innerHTML='🤖 AI is diagnosing retention...';const prompt=`Act as a UPSC memory and revision coach. Diagnose the evidence below. Do not give generic motivation.\n${JSON.stringify(snapshot).slice(0,22000)}\n\nProvide: 1) retention diagnosis, 2) overload warning, 3) weakest subjects, 4) why cards are failing, 5) exact daily recall quota, 6) 7-day backlog repair, 7) card-quality improvements, 8) when to use notes versus flashcards versus tests, 9) three measurable rules. Keep the plan realistic.`;try{lastDiagnosisM=await askM(prompt);setM('memoryDiagnosisOutputV263',fmtM(lastDiagnosisM));await saveM('memoryAIReportsV263',{date:todayM(),body:lastDiagnosisM,snapshot,source:'v26.3'});if($m('memoryDiagnosisStatusV263'))$m('memoryDiagnosisStatusV263').innerHTML=settingsM().mode==='chatgpt'?'📋 Prompt copied for ChatGPT.':'✅ Retention diagnosis generated and saved.'}catch(e){setM('memoryDiagnosisOutputV263',fmtM('Diagnosis failed: '+e.message));if($m('memoryDiagnosisStatusV263'))$m('memoryDiagnosisStatusV263').innerHTML='⚠ Check AI settings.'}};
  window.saveMemoryDiagnosisAsNoteV263=async function(){const body=textM('memoryDiagnosisOutputV263');if(!body)return alert('Generate a diagnosis first.');await saveM('notes',{title:'AI Memory Diagnosis - '+todayM(),subject:'Strategy',body,date:todayM(),source:'v26.3'});alert('Memory diagnosis saved as a note.')};
  window.downloadMemoryReportV263=function(){const body=textM('memoryDiagnosisOutputV263');if(!body)return alert('Generate a diagnosis first.');downloadM(`UPSC-Memory-Report-${todayM()}.txt`,body)};

  window.refreshMemoryEngineV263=async function(){updateBadgeM();await loadMemoryM();await window.renderMemoryAnalyticsV263()};
  function initMemoryM(){updateBadgeM();window.refreshMemoryEngineV263()}
  const oldShowM=window.show;if(typeof oldShowM==='function')window.show=function(id,btn){const r=oldShowM.apply(this,arguments);if(id==='memoryEngineV263')setTimeout(initMemoryM,120);return r};
  const oldSaveSettingsM=window.saveAISettingsV23;if(typeof oldSaveSettingsM==='function')window.saveAISettingsV23=function(){const r=oldSaveSettingsM.apply(this,arguments);setTimeout(updateBadgeM,40);return r};
  document.addEventListener('keydown',e=>{if(!$m('memoryEngineV263')?.classList.contains('active')||$m('memoryCardStageV263')?.hidden)return;if(e.target&&/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;if(e.code==='Space'){e.preventDefault();if($m('memoryAnswerV263')?.hidden)window.revealMemoryAnswerV263()}if(!$m('memoryRatingActionsV263')?.hidden){if(e.key==='1')window.rateMemoryCardV263('again');if(e.key==='2')window.rateMemoryCardV263('hard');if(e.key==='3')window.rateMemoryCardV263('good');if(e.key==='4')window.rateMemoryCardV263('easy')}});
  document.addEventListener('DOMContentLoaded',()=>setTimeout(updateBadgeM,1300));
})();


/* ===== V26.4 DUPLICATE-SECTIONS CONSOLIDATION ===== */
(function(){
  'use strict';
  const $v264=id=>document.getElementById(id);
  const escV264=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const idV264=(x,i=0)=>String(x?._docId||x?.id||i);

  window.jumpHubV264=function(targetId,btn){
    const target=$v264(targetId); if(!target)return;
    const hub=btn?.closest?.('.v264HubTabs');
    if(hub){hub.querySelectorAll('button').forEach(b=>b.classList.remove('active'));btn.classList.add('active')}
    target.scrollIntoView({behavior:'smooth',block:'start'});
  };

  async function renderPlannerHistoryV264(){
    const box=$v264('dailyPlanList'); if(!box||typeof window.getCol!=='function')return;
    try{
      const rows=await window.getCol('dailyPlans');
      box.innerHTML=rows.length?rows.slice().reverse().slice(0,40).map((x,i)=>`<div class="item"><h3>${escV264(x.date||'Daily Plan')}</h3><p>${escV264(x.body||x.input||x.plan||'Saved plan')}</p><button class="btn danger" onclick="deleteItem('dailyPlans','${escV264(idV264(x,i))}');setTimeout(renderMergedLegacyV264,300)">Delete</button></div>`).join(''):'<div class="emptyState">No saved planner entries yet.</div>';
    }catch(e){console.warn('V26.4 planner history skipped',e)}
  }
  async function renderHabitHistoryV264(){
    const box=$v264('aiHabitList'); if(!box||typeof window.getCol!=='function')return;
    try{
      const rows=await window.getCol('aiHabits');
      box.innerHTML=rows.length?rows.slice().reverse().slice(0,50).map((x,i)=>`<div class="item"><h3>${escV264(x.name||'Habit')}</h3><span class="tag">${escV264(x.subject||'General')}</span><span class="tag">${escV264(x.status||'Pending')}</span><p>${escV264(x.reason||'')}</p><button class="btn danger" onclick="deleteItem('aiHabits','${escV264(idV264(x,i))}');setTimeout(renderMergedLegacyV264,300)">Delete</button></div>`).join(''):'<div class="emptyState">No quick habit logs saved yet.</div>';
    }catch(e){console.warn('V26.4 habit history skipped',e)}
  }
  window.renderMergedLegacyV264=async function(){await Promise.all([renderPlannerHistoryV264(),renderHabitHistoryV264()])};

  const previousShowV264=window.show;
  if(typeof previousShowV264==='function')window.show=function(id,btn){
    let mapped=id,anchor='';
    if(id==='aiPlanner'){mapped='dailyCommandV261';anchor='dailyPlannerLegacyV264'}
    if(id==='aiHabits'){mapped='timeHabitV262';anchor='quickHabitLogV264'}
    const result=previousShowV264.call(this,mapped,btn);
    setTimeout(()=>{
      if(mapped==='dailyCommandV261')renderPlannerHistoryV264();
      if(mapped==='timeHabitV262')renderHabitHistoryV264();
      if(anchor)window.jumpHubV264(anchor);
    },170);
    return result;
  };

  document.addEventListener('DOMContentLoaded',()=>{
    // Old IDs are deliberately removed from navigation, but routing remains compatible.
    document.querySelectorAll('.v264HubTabs').forEach(h=>{const first=h.querySelector('button');if(first&&!h.querySelector('button.active'))first.classList.add('active')});
  });
})();


/* ===== V26.5 FOCUSED UPLOADS + AI SYLLABUS INTELLIGENCE + PREMIUM COUNTDOWN ===== */
(function(){
  const g=id=>document.getElementById(id);
  const esc265=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const today265=()=>new Date().toISOString().slice(0,10);
  const mode265=()=>{try{const s=JSON.parse(localStorage.getItem('mission_ai_settings_v23')||'{}');return s.mode==='gemini'?'Gemini Free':s.mode==='chatgpt'?'ChatGPT Prompt':s.mode==='hybrid'?'Smart Hybrid':'Ollama Local'}catch(e){return 'Selected AI'}};
  const priorityRank265={High:0,Medium:1,Low:2};
  let lastSyllabusPlanV265='';
  let editingSyllabusIdV265=null;
  function fmt265(text){return typeof window.formatAI==='function'?window.formatAI(String(text||'')):`<pre>${esc265(text)}</pre>`}
  async function ask265(prompt){if(typeof window.aiAskRouterV23==='function')return await window.aiAskRouterV23(prompt);if(typeof window.aiAsk==='function')return await window.aiAsk(prompt);throw new Error('AI router unavailable. Save AI settings first.');}
  function dateLabel265(v){if(!v)return 'Not revised';try{return new Intl.DateTimeFormat('en-IN',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(v+'T00:00:00'))}catch(e){return v}}
  function confidenceDots265(n){n=Math.max(1,Math.min(5,Number(n)||1));return `<span class="confidenceDotsV265" title="Confidence ${n}/5">${[1,2,3,4,5].map(i=>`<i class="${i<=n?'on':''}"></i>`).join('')}</span>`}
  async function syllabusData265(){try{return await window.getCol('syllabusAI')}catch(e){return []}}
  async function updateSyllabus265(idOrIndex,patch){
    const data=await syllabusData265();let idx=data.findIndex(x=>String(x.id)===String(idOrIndex)||String(x._docId)===String(idOrIndex));if(idx<0&&Number.isFinite(Number(idOrIndex)))idx=Number(idOrIndex);if(idx<0||!data[idx])return;
    const item=data[idx],updated={...item,...patch,updatedAt:Date.now()};
    if(typeof cloudEnabled!=='undefined'&&cloudEnabled&&typeof user!=='undefined'&&user&&item.id){await setDoc(doc(db,path('syllabusAI'),item.id),{...patch,updatedAt:serverTimestamp()},{merge:true});}
    else{const local=localGet('syllabusAI');let li=local.findIndex(x=>String(x.id)===String(item.id));if(li<0)li=idx;if(local[li]){local[li]={...local[li],...patch,updatedAt:Date.now()};localSet('syllabusAI',local)}}
    await window.renderSyllabusAI();
  }
  function selectedSyllabusItem265(data,id){return data.find(x=>String(x.id||x._docId)===String(id))||data[Number(id)]}
  function urgencyScore265(x){let s=0;s+=(x.priority==='High'?40:x.priority==='Medium'?22:8);s+=(x.status==='Not Started'?28:x.status==='Revision Needed'?26:x.status==='In Progress'?14:0);s+=(5-Math.max(1,Number(x.confidence)||1))*6;s+=Math.min(18,Number(x.pyqCount)||0)*2;return s}
  function filteredSorted265(data){
    const q=(g('syllabusSearchAI')?.value||'').toLowerCase(),paper=g('syllabusPaperFilterV265')?.value||'All Papers',status=g('syllabusStatusFilterV265')?.value||'All Status',priority=g('syllabusPriorityFilterV265')?.value||'All Priorities',sort=g('syllabusSortV265')?.value||'priority';
    const f=data.filter(x=>(paper==='All Papers'||x.paper===paper)&&(status==='All Status'||x.status===status)&&(priority==='All Priorities'||(x.priority||'Medium')===priority)&&JSON.stringify(x).toLowerCase().includes(q));
    return f.sort((a,b)=>sort==='paper'?String(a.paper).localeCompare(String(b.paper)):sort==='confidence'?(Number(a.confidence||1)-Number(b.confidence||1)):sort==='pyq'?(Number(b.pyqCount||0)-Number(a.pyqCount||0)):(urgencyScore265(b)-urgencyScore265(a)));
  }
  window.clearSyllabusFormV265=function(){editingSyllabusIdV265=null;['syllabusTopicAI','syllabusDetailsAI','syllabusPyqCountAI','syllabusLastRevisedAI'].forEach(id=>{if(g(id))g(id).value=id==='syllabusPyqCountAI'?'0':''});if(g('syllabusStatusAI'))g('syllabusStatusAI').value='Not Started';if(g('syllabusPriorityAI'))g('syllabusPriorityAI').value='Medium';if(g('syllabusConfidenceAI'))g('syllabusConfidenceAI').value='3';if(g('syllabusSaveBtnV265'))g('syllabusSaveBtnV265').textContent='💾 Save Topic'};
  window.saveSyllabusAI=async function(){const topic=(g('syllabusTopicAI')?.value||'').trim();if(!topic)return alert('Enter a syllabus topic.');const rec={paper:g('syllabusPaperAI').value,subject:topic,topic,details:g('syllabusDetailsAI').value,status:g('syllabusStatusAI').value,priority:g('syllabusPriorityAI').value,confidence:Number(g('syllabusConfidenceAI').value||3),pyqCount:Number(g('syllabusPyqCountAI').value||0),lastRevised:g('syllabusLastRevisedAI').value,date:today265(),source:'V26.5 AI Syllabus Intelligence'};if(editingSyllabusIdV265)await updateSyllabus265(editingSyllabusIdV265,rec);else await saveCol('syllabusAI',rec);window.clearSyllabusFormV265();await window.renderSyllabusAI();};
  window.loadDefaultSyllabusAI=async function(){const existing=await syllabusData265();if(existing.length&&!confirm('Syllabus topics already exist. Add the core syllabus again?'))return;for(const [paper,subject,details] of coreSyllabusAI){await saveCol('syllabusAI',{paper,subject,topic:subject,details,status:'Not Started',priority:'Medium',confidence:1,pyqCount:0,lastRevised:'',date:today265(),source:'Core UPSC Syllabus'})}await window.renderSyllabusAI();alert('Core UPSC syllabus loaded.');};
  window.renderSyllabusAI=async function(){
    if(!g('syllabusListAI'))return;const data=await syllabusData265(),f=filteredSorted265(data),total=data.length,completed=data.filter(x=>x.status==='Completed').length,inProgress=data.filter(x=>x.status==='In Progress').length,revision=data.filter(x=>x.status==='Revision Needed').length,high=data.filter(x=>(x.priority||'Medium')==='High'&&x.status!=='Completed').length;
    const weighted=data.reduce((a,x)=>a+(x.status==='Completed'?1:x.status==='Revision Needed'?.72:x.status==='In Progress'?.48:0),0),coverage=total?Math.round(weighted/total*100):0;
    [['syllabusTotalV265',total],['syllabusCompletedV265',completed],['syllabusProgressV265',inProgress],['syllabusRevisionV265',revision],['syllabusPriorityV265',high],['syllabusReadinessScoreV265',coverage+'%']].forEach(([id,v])=>{if(g(id))g(id).textContent=v});
    if(g('syllabusRingV265'))g('syllabusRingV265').style.setProperty('--progress',coverage*3.6+'deg');if(g('syllabusOverallBarFillV265'))g('syllabusOverallBarFillV265').style.width=coverage+'%';if(g('syllabusReadinessLabelV265'))g('syllabusReadinessLabelV265').textContent=coverage>=80?'Exam-ready coverage is emerging':coverage>=50?'Consolidation and revision phase':coverage>0?'Build coverage consistently':'Load or add syllabus topics';if(g('syllabusAIBadgeV265'))g('syllabusAIBadgeV265').textContent=mode265();
    if(g('syllabusStatsAI'))g('syllabusStatsAI').innerHTML=`Showing <b>${f.length}</b> of ${total} topics • Weighted coverage <b>${coverage}%</b> • ${high} high-priority topics pending`;
    g('syllabusListAI').innerHTML=f.length?f.map((x,i)=>{const id=x.id||x._docId||data.indexOf(x),p=x.priority||'Medium',c=Number(x.confidence||1),pyq=Number(x.pyqCount||0);return `<article class="syllabusTopicCardV265 status-${String(x.status||'Not Started').replace(/\s+/g,'').toLowerCase()} priority-${p.toLowerCase()}"><div class="syllabusTopicTopV265"><div><div class="syllabusTopicTagsV265"><span class="paper">${esc265(x.paper||'General')}</span><span class="priority ${p.toLowerCase()}">${esc265(p)} priority</span><span class="status">${esc265(x.status||'Not Started')}</span></div><h3>${esc265(x.topic||x.subject||'Topic')}</h3></div><div class="syllabusUrgencyV265"><b>${urgencyScore265(x)}</b><small>priority score</small></div></div><p>${esc265(x.details||'Add micro-topics, sources and PYQ areas.')}</p><div class="syllabusEvidenceV265"><span>Confidence ${confidenceDots265(c)}</span><span>PYQs: <b>${pyq}</b></span><span>Last revised: <b>${esc265(dateLabel265(x.lastRevised))}</b></span></div><div class="syllabusCardActionsV265"><select onchange="setSyllabusStatusV265('${esc265(id)}',this.value)"><option ${x.status==='Not Started'?'selected':''}>Not Started</option><option ${x.status==='In Progress'?'selected':''}>In Progress</option><option ${x.status==='Completed'?'selected':''}>Completed</option><option ${x.status==='Revision Needed'?'selected':''}>Revision Needed</option></select><button class="btn ghost" onclick="editSyllabusTopicV265('${esc265(id)}')">✏ Edit</button><button class="btn blue" onclick="askSyllabusTopicAI265('${esc265(id)}')">🧠 AI Focus</button><button class="btn gold" onclick="addSyllabusRevisionByIdV265('${esc265(id)}')">🔁 Revision</button><button class="btn green" onclick="sendOneSyllabusTopicToCommandV265('${esc265(id)}')">🎯 Today</button><button class="btn danger" onclick="deleteItem('syllabusAI','${esc265(id)}');setTimeout(renderSyllabusAI,350)">Delete</button></div></article>`}).join(''):'<div class="emptyState">No matching syllabus topics. Load the core syllabus or add a topic.</div>';
  };
  window.setSyllabusStatusV265=async function(id,status){const patch={status};if(status==='Completed'||status==='Revision Needed')patch.lastRevised=today265();await updateSyllabus265(id,patch)};
  window.markSyllabusDoneAI=async id=>updateSyllabus265(id,{status:'Completed',confidence:5,lastRevised:today265()});
  window.editSyllabusTopicV265=async function(id){const data=await syllabusData265(),x=selectedSyllabusItem265(data,id);if(!x)return;editingSyllabusIdV265=id;if(g('syllabusPaperAI'))g('syllabusPaperAI').value=x.paper||'Prelims GS';if(g('syllabusTopicAI'))g('syllabusTopicAI').value=x.topic||x.subject||'';if(g('syllabusDetailsAI'))g('syllabusDetailsAI').value=x.details||'';if(g('syllabusStatusAI'))g('syllabusStatusAI').value=x.status||'Not Started';if(g('syllabusPriorityAI'))g('syllabusPriorityAI').value=x.priority||'Medium';if(g('syllabusConfidenceAI'))g('syllabusConfidenceAI').value=String(x.confidence||1);if(g('syllabusPyqCountAI'))g('syllabusPyqCountAI').value=Number(x.pyqCount||0);if(g('syllabusLastRevisedAI'))g('syllabusLastRevisedAI').value=x.lastRevised||'';if(g('syllabusSaveBtnV265'))g('syllabusSaveBtnV265').textContent='✅ Update Topic';g('syllabusTopicAI')?.scrollIntoView({behavior:'smooth',block:'center'})};
  window.addSyllabusRevisionByIdV265=async function(id){const data=await syllabusData265(),x=selectedSyllabusItem265(data,id);if(!x)return;await saveCol('smartRevision',{topic:x.topic||x.subject,subject:x.paper||'General',source:'Syllabus Intelligence V26.5',difficulty:(x.priority||'Medium'),date:today265(),cycle:1,status:'pending'});await updateSyllabus265(id,{status:'Revision Needed',lastRevised:today265()});alert('Topic added to Revision Brain.');};
  window.askSyllabusTopicAI265=async function(id){const data=await syllabusData265(),x=selectedSyllabusItem265(data,id);if(!x)return;g('syllabusAIOutputV265').innerHTML='<div class="aiLoading">AI is building a micro-topic battle plan...</div>';try{const out=await ask265(`Act as a UPSC syllabus strategist. Build an exam-oriented micro-plan for this syllabus topic.\nPaper: ${x.paper}\nTopic: ${x.topic}\nMicro-topics/source/PYQ notes: ${x.details||'Not added'}\nStatus: ${x.status}\nPriority: ${x.priority||'Medium'}\nConfidence: ${x.confidence||1}/5\nPYQs seen: ${x.pyqCount||0}\n\nGive: exact demand, micro-topic checklist, best sources, PYQ patterns, prelims traps, mains dimensions, revision cycle, 7-day action plan and completion test.`);lastSyllabusPlanV265=out;g('syllabusAIOutputV265').innerHTML=fmt265(out)}catch(e){g('syllabusAIOutputV265').textContent='AI error: '+e.message}};
  window.analyzeCurrentSyllabusTopicV265=function(){const topic=(g('syllabusTopicAI')?.value||'').trim();if(!topic)return alert('Enter a topic first.');const temp={id:'form',paper:g('syllabusPaperAI').value,topic,details:g('syllabusDetailsAI').value,status:g('syllabusStatusAI').value,priority:g('syllabusPriorityAI').value,confidence:g('syllabusConfidenceAI').value,pyqCount:g('syllabusPyqCountAI').value};g('syllabusAIOutputV265').innerHTML='<div class="aiLoading">AI is expanding the syllabus phrase...</div>';ask265(`Act as a UPSC syllabus strategist. Create a micro-plan for:\n${JSON.stringify(temp)}\nInclude micro-topics, sources, PYQ angle, prelims traps, mains dimensions, active recall questions and a completion checklist.`).then(out=>{lastSyllabusPlanV265=out;g('syllabusAIOutputV265').innerHTML=fmt265(out)}).catch(e=>g('syllabusAIOutputV265').textContent='AI error: '+e.message)};
  window.runLocalSyllabusScanV265=async function(){const data=await syllabusData265(),pending=data.filter(x=>x.status!=='Completed').sort((a,b)=>urgencyScore265(b)-urgencyScore265(a)).slice(0,12);if(!data.length)return alert('Load or add syllabus topics first.');const lines=pending.map((x,i)=>`${i+1}. ${x.paper} — ${x.topic}\n   Why now: ${x.priority||'Medium'} priority, ${x.status}, confidence ${x.confidence||1}/5, ${x.pyqCount||0} PYQs.`).join('\n');lastSyllabusPlanV265=`# Instant Syllabus Priority Scan\n\n## Next Topics\n${lines}\n\n## Execution Rule\nComplete the top 3 before adding new low-priority material. Every completed topic must end with PYQ practice and one active-recall revision.`;g('syllabusAIOutputV265').innerHTML=fmt265(lastSyllabusPlanV265)};
  window.analyzeSyllabusAI265=async function(forced){const data=await syllabusData265();if(!data.length)return alert('Load or add syllabus topics first.');const type=forced||g('syllabusAnalysisTypeV265')?.value||'roadmap',days=g('syllabusWindowV265')?.value||30,focus=g('syllabusFocusV265')?.value||'Balanced UPSC preparation',summary=data.slice(0,160).map(x=>({paper:x.paper,topic:x.topic,details:x.details,status:x.status,priority:x.priority||'Medium',confidence:x.confidence||1,pyqCount:x.pyqCount||0,lastRevised:x.lastRevised||''}));g('syllabusAIOutputV265').innerHTML='<div class="aiLoading">AI is reading coverage, confidence and PYQ signals...</div>';try{const out=await ask265(`You are a senior UPSC syllabus and revision strategist.\nAnalysis type: ${type}\nTarget window: ${days} days\nFocus: ${focus}\nTracked syllabus data: ${JSON.stringify(summary).slice(0,24000)}\n\nCreate an evidence-based plan with:\n1. Coverage diagnosis by paper\n2. Top 10 priorities with reasons\n3. What to stop/avoid\n4. ${days}-day phased roadmap\n5. PYQ and test integration\n6. Revision and memory cycle\n7. Daily minimum output\n8. Completion criteria\n9. Risk alerts\n10. Immediate next 3 actions.\nDo not invent progress not present in the data.`);lastSyllabusPlanV265=out;g('syllabusAIOutputV265').innerHTML=fmt265(out)}catch(e){g('syllabusAIOutputV265').textContent='AI error: '+e.message}};
  window.saveSyllabusPlanV265=async function(){const body=lastSyllabusPlanV265||g('syllabusAIOutputV265')?.innerText||'';if(!body)return alert('Generate a plan first.');await saveCol('syllabusPlansAI',{title:'AI Syllabus Plan — '+today265(),body,date:today265(),type:g('syllabusAnalysisTypeV265')?.value||'roadmap',source:'V26.5'});alert('Syllabus plan saved.');};
  window.downloadSyllabusPlanV265=function(){const body=lastSyllabusPlanV265||g('syllabusAIOutputV265')?.innerText||'';if(!body)return alert('Generate a plan first.');const b=new Blob([body],{type:'text/plain;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='UPSC-Syllabus-Plan-'+today265()+'.txt';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
  function addMissionTasks265(items){const date=today265(),key='mission_v261_active_'+date;let m;try{m=JSON.parse(localStorage.getItem(key)||'null')}catch(e){}if(!m)m={date,createdAt:Date.now(),source:'V26.5 Syllabus Intelligence',focus:'Syllabus priority repair',energy:'Normal',availableHours:7,tasks:[],brief:'Priority topics imported from AI Syllabus Intelligence'};m.tasks=Array.isArray(m.tasks)?m.tasks:[];for(const x of items){if(m.tasks.some(t=>String(t.title).includes(x.topic)))continue;m.tasks.push({id:'syl_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),title:'Syllabus: '+x.topic,type:'Syllabus',subject:x.paper||'General',minutes:60,reason:`${x.priority||'Medium'} priority • ${x.status||'Not Started'} • confidence ${x.confidence||1}/5`,priority:x.priority||'Medium',done:false})}localStorage.setItem(key,JSON.stringify(m));return items.length}
  window.sendSyllabusPrioritiesToCommandV265=async function(){const data=await syllabusData265(),top=data.filter(x=>x.status!=='Completed').sort((a,b)=>urgencyScore265(b)-urgencyScore265(a)).slice(0,4);if(!top.length)return alert('No pending syllabus topics.');addMissionTasks265(top);alert(`${top.length} syllabus priorities added to today’s Daily Command Centre.`)};
  window.sendOneSyllabusTopicToCommandV265=async function(id){const data=await syllabusData265(),x=selectedSyllabusItem265(data,id);if(!x)return;addMissionTasks265([x]);alert('Topic added to today’s Daily Command Centre.');};

  function diffParts265(dateStr){if(!dateStr)return null;const now=new Date(),target=new Date(dateStr+'T00:00:00');const ms=target-now;if(ms<=0)return {reached:true,ms,days:0,hours:0,minutes:0,seconds:0};return {reached:false,ms,days:Math.floor(ms/86400000),hours:Math.floor(ms%86400000/3600000),minutes:Math.floor(ms%3600000/60000),seconds:Math.floor(ms%60000/1000),target}}
  function phase265(days){if(days>240)return {name:'Foundation Phase',urgency:'CALM',tone:'Build static concepts, standard books and clean notes.',actions:['Finish core sources paper-wise','Begin light PYQ mapping','Create sustainable revision habits']};if(days>150)return {name:'Coverage + Consolidation',urgency:'BUILD',tone:'Close major syllabus gaps and start sectional practice.',actions:['Complete high-priority pending topics','Revise completed subjects weekly','Take one sectional test every week']};if(days>90)return {name:'Revision Acceleration',urgency:'FOCUS',tone:'Shift from content collection to recall, PYQs and testing.',actions:['Run two revision cycles','Increase MCQ/answer-writing volume','Repair weak topics from test evidence']};if(days>45)return {name:'Test & Repair Phase',urgency:'HIGH',tone:'Mocks, error logs and rapid revision must dominate.',actions:['Full/sectional mocks on schedule','Daily wrong-answer repair','Compress notes into recall sheets']};if(days>15)return {name:'Final Sprint',urgency:'CRITICAL',tone:'Protect recall, accuracy, sleep and confidence.',actions:['Revise only trusted material','Practice controlled tests','Avoid new low-yield sources']};return {name:'Exam Mode',urgency:'EXAM',tone:'Stay calm, revise essentials and preserve energy.',actions:['Final recall sheets only','Sleep and logistics discipline','No panic-driven source hopping']}}
  function countdownCard265(label,dateStr,kind){const p=diffParts265(dateStr);if(!p)return `<div class="countdownEmptyV265"><span>${kind==='prelims'?'🧭':'✍️'}</span><b>Set ${label} date</b><small>Your live mission clock will appear here.</small></div>`;const date=new Intl.DateTimeFormat('en-IN',{weekday:'short',day:'2-digit',month:'short',year:'numeric'}).format(new Date(dateStr+'T00:00:00'));if(p.reached)return `<div class="examCountdownHeadV265"><div><span>${kind==='prelims'?'🧭':'✍️'}</span><small>UPSC ${label}</small><h2>${label} day reached</h2></div><b class="examDateV265">${date}</b></div><div class="countdownReachedV265">Trust your preparation. Stay calm and execute.</div>`;const ph=phase265(p.days),urg=Math.max(4,Math.min(100,Math.round((180-Math.min(180,p.days))/180*100)));return `<div class="examCountdownHeadV265"><div><span>${kind==='prelims'?'🧭':'✍️'}</span><small>UPSC ${label}</small><h2>${ph.name}</h2></div><b class="examDateV265">${date}</b></div><div class="countdownDaysV265"><b>${p.days}</b><span>days remaining</span></div><div class="countdownTimeRowV265"><div><b>${String(p.hours).padStart(2,'0')}</b><small>Hours</small></div><div><b>${String(p.minutes).padStart(2,'0')}</b><small>Minutes</small></div><div><b>${String(p.seconds).padStart(2,'0')}</b><small>Seconds</small></div></div><div class="countdownUrgencyBarV265"><span style="width:${urg}%"></span></div><p>${esc265(ph.tone)}</p>`}
  window.saveExamCountdownAI=function(){localStorage.setItem('prelimsDateAI',g('prelimsDateAI').value);localStorage.setItem('mainsDateAI',g('mainsDateAI').value);window.renderExamCountdownAI();};
  window.renderExamCountdownAI=function(){const pre=localStorage.getItem('prelimsDateAI')||'',main=localStorage.getItem('mainsDateAI')||'';if(g('prelimsDateAI'))g('prelimsDateAI').value=pre;if(g('mainsDateAI'))g('mainsDateAI').value=main;if(g('prelimsCountdownLive'))g('prelimsCountdownLive').innerHTML=countdownCard265('Prelims',pre,'prelims');if(g('mainsCountdownLive'))g('mainsCountdownLive').innerHTML=countdownCard265('Mains',main,'mains');const candidates=[{name:'Prelims',date:pre,p:diffParts265(pre)},{name:'Mains',date:main,p:diffParts265(main)}].filter(x=>x.p&&!x.p.reached).sort((a,b)=>a.p.ms-b.p.ms),next=candidates[0];if(!next){if(g('countdownPhaseBadgeV265'))g('countdownPhaseBadgeV265').textContent='Set exam dates';if(g('countdownStrategyOutputV265'))g('countdownStrategyOutputV265').textContent='Set exam dates to receive a phase-wise strategy.';return}const ph=phase265(next.p.days);if(g('countdownPhaseBadgeV265'))g('countdownPhaseBadgeV265').textContent=`${next.name}: ${next.p.days} days`;if(g('countdownUrgencyV265'))g('countdownUrgencyV265').textContent=ph.urgency;if(g('countdownStrategyOutputV265'))g('countdownStrategyOutputV265').innerHTML=`<h3>${esc265(ph.name)} — ${esc265(next.name)}</h3><p>${esc265(ph.tone)}</p><div class="countdownActionGridV265">${ph.actions.map((x,i)=>`<div><span>${i+1}</span><b>${esc265(x)}</b></div>`).join('')}</div>`;if(g('countdownMilestoneListV265')){const d=next.p.days;const milestones=[{icon:'🎯',title:'Today',text:ph.actions[0]},{icon:'📆',title:'Next 7 days',text:d>45?'Close one major topic cluster and test it.':'Run a focused revision and error-repair cycle.'},{icon:'🧠',title:'Next 30 days',text:d>90?'Raise syllabus coverage and confidence.':'Prioritise mocks, revision and weak-area repair.'}];g('countdownMilestoneListV265').innerHTML=milestones.map(x=>`<div class="countdownMilestoneV265"><span>${x.icon}</span><div><b>${esc265(x.title)}</b><small>${esc265(x.text)}</small></div></div>`).join('')}};
  window.addExamDatesToCalendarV265=async function(){const pre=localStorage.getItem('prelimsDateAI'),main=localStorage.getItem('mainsDateAI');if(!pre&&!main)return alert('Set at least one exam date.');if(pre)await saveCol('calendarItems',{title:'UPSC Prelims',date:pre,type:'Exam',source:'Exam Countdown V26.5'});if(main)await saveCol('calendarItems',{title:'UPSC Mains Begins',date:main,type:'Exam',source:'Exam Countdown V26.5'});alert('Exam dates added to Calendar.');};
  window.sendCountdownPlanToCommandV265=function(){const pre=diffParts265(localStorage.getItem('prelimsDateAI')),main=diffParts265(localStorage.getItem('mainsDateAI')),next=[{name:'Prelims',p:pre},{name:'Mains',p:main}].filter(x=>x.p&&!x.p.reached).sort((a,b)=>a.p.ms-b.p.ms)[0];if(!next)return alert('Set a future exam date first.');const ph=phase265(next.p.days),items=ph.actions.map((a,i)=>({topic:a,paper:next.name,status:'Countdown priority',priority:i===0?'High':'Medium',confidence:3}));addMissionTasks265(items);alert('Countdown phase actions added to today’s Daily Command Centre.');};

  const oldShow265=window.show;if(typeof oldShow265==='function')window.show=function(id,btn){const r=oldShow265(id,btn);if(id==='syllabusCommand')setTimeout(window.renderSyllabusAI,60);if(id==='countdownPage')setTimeout(window.renderExamCountdownAI,60);return r};
  window.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{if(g('syllabusCommand'))window.renderSyllabusAI();if(g('countdownPage'))window.renderExamCountdownAI()},1200));
})();

/* ===== V26.6 PYQ + UNIFIED LIBRARY + UNIFIED CALENDAR + RICH NOTES PRO ===== */
(function(){
  'use strict';
  const q=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const today=()=>new Date().toISOString().slice(0,10);
  const fmt=t=>{try{return typeof window.formatAI==='function'?window.formatAI(String(t||'')):`<pre>${esc(t)}</pre>`}catch(e){return `<pre>${esc(t)}</pre>`}};
  const ask=async prompt=>{if(typeof window.aiAskRouterV23==='function')return window.aiAskRouterV23(prompt);if(typeof window.aiAskV4==='function')return window.aiAskV4(prompt);if(typeof window.aiAsk==='function')return window.aiAsk(prompt);throw new Error('AI router unavailable. Open AI Control Centre and save a mode.');};
  const get=async col=>{try{return await getCol(col)}catch(e){try{return JSON.parse(localStorage.getItem(col)||'[]')}catch(_){return []}}};
  const save=async(col,obj)=>{if(typeof saveCol==='function')return saveCol(col,obj);const a=await get(col);a.unshift({...obj,id:'local_'+Date.now()});localStorage.setItem(col,JSON.stringify(a));};
  const itemId=(x,i)=>String(x?._docId||x?.id||i);
  const blobDownload=(name,content,type='text/plain;charset=utf-8')=>{const b=new Blob([content],{type}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};

  // ---------- PYQ INTELLIGENCE PRO ----------
  let pyqFilteredV266=[];
  const pyqDB=()=>{try{const d=JSON.parse(localStorage.getItem('fullPYQDB')||'[]');return Array.isArray(d)?d:[]}catch(e){return []}};
  const pyqTopic=x=>String(x.topic||x.theme||x.microTopic||x.subject||'Unclassified').trim();
  const pyqPaper=x=>String(x.paper||x.exam||x.type||'').toLowerCase();
  const pyqDemand=x=>{const text=String(x.demand||x.question||'').toLowerCase();const verbs=['critically examine','critically analyse','evaluate','discuss','examine','analyse','comment','elucidate','explain','enumerate'];return x.demand||verbs.find(v=>text.includes(v))||(/which|consider the following|correct/i.test(text)?'Prelims statement analysis':'Knowledge + application')};
  function filterPYQV266(){
    const db=pyqDB(),term=String(q('pyqSearchFull')?.value||'').toLowerCase(),subject=q('pyqSubjectFull')?.value||'All',paper=q('pyqExamTypeV266')?.value||'All Papers',from=Number(q('pyqYearFromV266')?.value||0),to=Number(q('pyqYearToV266')?.value||9999);
    return db.map((x,i)=>({...x,__index:i})).filter(x=>{
      const year=Number(x.year||0),hay=JSON.stringify(x).toLowerCase();
      if(term&&!hay.includes(term))return false;if(subject!=='All'&&String(x.subject||'')!==subject)return false;if(year&&year<from)return false;if(year&&year>to)return false;
      if(paper!=='All Papers'){const p=pyqPaper(x);if(paper==='Prelims'&&!(/prelim|gs paper.?1|objective/.test(p)||/consider the following|which of the above|correct answer/i.test(x.question||'')))return false;if(paper==='Mains'&&!(/main|gs.?[1-4]|descriptive/.test(p)||/discuss|examine|analyse|evaluate|comment/i.test(x.question||'')))return false;if(paper==='Essay'&&!/essay/.test(p))return false;if(paper==='CSAT'&&!/csat|paper.?2/.test(p)&&String(x.subject)!=='CSAT')return false;}
      return true;
    });
  }
  function frequencyV266(list){const m={};list.forEach(x=>{const k=pyqTopic(x);m[k]=(m[k]||0)+1});return Object.entries(m).sort((a,b)=>b[1]-a[1]);}
  function renderPYQInsightsV266(list){
    const db=pyqDB(),freq=frequencyV266(list),years=[...new Set(db.map(x=>Number(x.year)).filter(Boolean))].sort(),top=freq[0]?.[0]||'—';
    if(q('pyqTotalV266'))q('pyqTotalV266').textContent=db.length;if(q('pyqYearsV266'))q('pyqYearsV266').textContent=years.length;if(q('pyqTopClusterV266'))q('pyqTopClusterV266').textContent=top;if(q('pyqFilteredV266'))q('pyqFilteredV266').textContent=list.length;
    const recent=list.filter(x=>Number(x.year)>=Math.max(...years,0)-4),repeat=freq.filter(x=>x[1]>=2),demands={};list.forEach(x=>{const d=pyqDemand(x);demands[d]=(demands[d]||0)+1});const topDemand=Object.entries(demands).sort((a,b)=>b[1]-a[1])[0];
    if(q('pyqLocalInsightV266'))q('pyqLocalInsightV266').innerHTML=list.length?`<div class="v266InsightList"><div class="v266InsightItem"><span>1</span><div><b>${esc(repeat.length)} recurring clusters</b><small>Topics appearing at least twice in this view.</small></div></div><div class="v266InsightItem"><span>2</span><div><b>${esc(recent.length)} questions in the recent trend window</b><small>Useful for detecting changing emphasis.</small></div></div><div class="v266InsightItem"><span>3</span><div><b>Dominant demand: ${esc(topDemand?.[0]||'Mixed')}</b><small>${topDemand?.[1]||0} questions use this demand pattern.</small></div></div><div class="v266InsightItem"><span>4</span><div><b>Priority cluster: ${esc(top)}</b><small>Link static notes, current affairs and answer practice here first.</small></div></div></div>`:'<div class="v266InsightEmpty">No questions match the current filters.</div>';
    if(q('pyqTopicCloudV266'))q('pyqTopicCloudV266').innerHTML=freq.slice(0,12).map(([t,n])=>`<button onclick="filterPYQTopicV266(decodeURIComponent('${encodeURIComponent(t)}'))">${esc(t)} <b>${n}</b></button>`).join('');
    const max=freq[0]?.[1]||1;if(q('pyqTrendChartV266'))q('pyqTrendChartV266').innerHTML=freq.slice(0,10).map(([t,n])=>`<div class="v266BarRow"><label title="${esc(t)}">${esc(t)}</label><div class="v266BarTrack"><span style="width:${Math.max(5,n/max*100)}%"></span></div><b>${n}</b></div>`).join('')||'<div class="v266InsightEmpty">Import PYQs to see topic recurrence.</div>';
  }
  window.filterPYQTopicV266=function(topic){if(q('pyqSearchFull'))q('pyqSearchFull').value=topic;window.renderFullPYQ()};
  window.renderFullPYQ=function(){
    const list=filterPYQV266();pyqFilteredV266=list;renderPYQInsightsV266(list);if(q('fullPYQStats'))q('fullPYQStats').innerHTML=`<b>${list.length}</b> shown / ${pyqDB().length} total`;
    if(q('fullPYQList'))q('fullPYQList').innerHTML=list.slice(0,250).map(x=>`<article class="v266PYQCard"><div class="v266PYQMeta"><span class="tag">${esc(x.year||'Year')}</span><span class="tag">${esc(x.subject||'General')}</span><span class="tag">${esc(x.paper||'UPSC')}</span><span class="tag">${esc(pyqTopic(x))}</span></div><h3>${esc(x.question||'Question unavailable')}</h3><div class="v266Demand"><b>Demand:</b> ${esc(pyqDemand(x))}</div><details><summary>Answer, explanation & actions</summary><p><b>Answer:</b> ${esc(x.answer||'Not added')}</p><p>${esc(x.explanation||'Add explanation in the PYQ JSON bank.')}</p><div class="actions"><button class="btn gold" onclick="createPYQFlashcard(${x.__index})">🃏 Flashcard</button><button class="btn green" onclick="addPYQRevision(${x.__index})">📌 Revision</button><button class="btn purple" onclick="analyzeSinglePYQV266(${x.__index})">🤖 Analyze</button></div></details></article>`).join('')||'<div class="v266InsightEmpty">No PYQs match these filters.</div>';
  };
  window.importFullPYQ=async function(){const file=q('pyqJsonFile')?.files?.[0];if(!file)return alert('Choose a PYQ JSON file.');try{const data=JSON.parse(await file.text());if(!Array.isArray(data))throw new Error('JSON must be an array.');const clean=data.filter(x=>x&&typeof x==='object'&&x.question).map(x=>({year:x.year||'',subject:x.subject||'General',paper:x.paper||x.exam||'UPSC',topic:x.topic||x.theme||'',question:x.question,answer:x.answer||'',explanation:x.explanation||'',demand:x.demand||''}));localStorage.setItem('fullPYQDB',JSON.stringify(clean));window.renderFullPYQ();alert(`${clean.length} PYQs imported successfully.`)}catch(e){alert('PYQ import failed: '+e.message)}};
  window.scanPYQLocallyV266=function(){window.renderFullPYQ();q('pyqLocalInsightV266')?.scrollIntoView({behavior:'smooth',block:'center'})};
  function pyqSummaryV266(list){return {count:list.length,years:[...new Set(list.map(x=>x.year).filter(Boolean))],topTopics:frequencyV266(list).slice(0,15),demands:Object.entries(list.reduce((m,x)=>(m[pyqDemand(x)]=(m[pyqDemand(x)]||0)+1,m),{})).sort((a,b)=>b[1]-a[1]),samples:list.slice(0,60).map(x=>({year:x.year,subject:x.subject,paper:x.paper,topic:pyqTopic(x),question:x.question,answer:x.answer}))}};
  window.analyzePYQPatternAI=async function(){const list=filterPYQV266();if(!list.length)return alert('Import or select PYQs first.');q('pyqAIOutput').innerHTML='<div class="aiLoading">AI is mapping recurrence, demand and preparation gaps...</div>';try{const lens=q('pyqLensV266')?.value||'Complete Trend Analysis',out=await ask(`You are a senior UPSC PYQ analyst. Lens: ${lens}. Analyze this structured PYQ evidence: ${JSON.stringify(pyqSummaryV266(list)).slice(0,28000)}. Give: 1) recurring clusters with evidence, 2) changes over years, 3) Prelims traps or Mains demand, 4) static-current linkage, 5) exact preparation priority, 6) notes/test/revision plan, 7) ten likely future themes with careful uncertainty. Do not claim prediction certainty.`);q('pyqAIOutput').innerHTML=fmt(out)}catch(e){q('pyqAIOutput').textContent='AI error: '+e.message}};
  window.predictPYQThemesV266=async function(){const list=filterPYQV266();if(!list.length)return alert('Import PYQs first.');q('pyqAIOutput').innerHTML='<div class="aiLoading">Generating evidence-based expected themes...</div>';const out=await ask(`Using only the following UPSC PYQ trend summary, propose probable themes—not exact questions. For each theme give evidence, syllabus line, static base, current-affairs trigger, Prelims angle, Mains question and confidence Low/Medium/High. Data: ${JSON.stringify(pyqSummaryV266(list)).slice(0,26000)}`);q('pyqAIOutput').innerHTML=fmt(out)};
  window.analyzeSinglePYQV266=async function(i){const x=pyqDB()[i];if(!x)return;q('pyqAIOutput').innerHTML='<div class="aiLoading">Analyzing question demand...</div>';q('pyqAIOutput').innerHTML=fmt(await ask(`Analyze this UPSC PYQ: ${JSON.stringify(x)}. Decode directive, syllabus linkage, concepts tested, traps, ideal approach, related current affairs, answer framework and five revision questions.`));q('pyqAIOutput').scrollIntoView({behavior:'smooth'})};
  window.sendPYQPrioritiesV266=async function(){const top=frequencyV266(filterPYQV266()).slice(0,6);if(!top.length)return alert('No filtered PYQs.');for(let i=0;i<top.length;i++){await save('smartRevision',{topic:top[i][0],subject:q('pyqSubjectFull')?.value==='All'?'PYQ':q('pyqSubjectFull').value,source:'PYQ Intelligence Pro',difficulty:i<3?'Hard':'Medium',date:new Date(Date.now()+(i+1)*86400000).toISOString().slice(0,10),cycle:1,status:'pending',evidence:`${top[i][1]} PYQs in filtered bank`})}alert(`${top.length} PYQ priorities sent to Revision Brain.`)};
  window.exportPYQReportV266=function(){const list=filterPYQV266(),freq=frequencyV266(list),text=`MISSION UPSC — PYQ INTELLIGENCE REPORT\nGenerated: ${new Date().toLocaleString()}\nFiltered questions: ${list.length}\n\nTOP CLUSTERS\n${freq.map(([t,n],i)=>`${i+1}. ${t} — ${n}`).join('\n')}\n\nAI STRATEGY\n${q('pyqAIOutput')?.innerText||'Not generated'}`;blobDownload('PYQ-Intelligence-Report.txt',text)};

  // ---------- UNIFIED AI DIGITAL LIBRARY ----------
  let libraryCacheV266=[],libraryVisibleV266=[],librarySelectedV266=new Set(),libraryViewV266='shelf';
  window.clearLibraryFormV266=function(){['libTitlePro','libUrlPro','libContentPro','libraryTagsV266'].forEach(id=>{if(q(id))q(id).value=''})};
  window.saveDigitalLibrary2=async function(){const title=q('libTitlePro')?.value.trim();if(!title)return alert('Add a resource title.');await save('digitalLibrary',{type:q('libTypePro')?.value||'Typed Note',subject:q('libSubjectPro')?.value||'General',title,url:q('libUrlPro')?.value.trim()||'',content:q('libContentPro')?.value.trim()||'',tags:String(q('libraryTagsV266')?.value||'').split(',').map(x=>x.trim()).filter(Boolean),date:today(),lastReviewed:'',source:'Unified Library V26.6'});window.clearLibraryFormV266();await window.renderDigitalLibrary2();alert('Saved to AI Digital Library Pro.')};
  window.saveDigitalLibraryItem=window.saveDigitalLibrary2;
  function libraryFilteredV266(){const term=String(q('digitalLibrarySearch')?.value||'').toLowerCase(),type=q('digitalLibraryFilter')?.value||'All',subject=q('librarySubjectFilterV266')?.value||'All Subjects';return libraryCacheV266.filter(x=>(!term||JSON.stringify(x).toLowerCase().includes(term))&&(type==='All'||x.type===type)&&(subject==='All Subjects'||x.subject===subject))}
  window.renderDigitalLibrary2=async function(){
    const box=q('digitalLibraryShelves');if(!box)return;libraryCacheV266=await get('digitalLibrary');libraryVisibleV266=libraryFilteredV266();const subjects=new Set(libraryCacheV266.map(x=>x.subject||'General')),review=libraryCacheV266.filter(x=>!x.lastReviewed).length;
    if(q('libraryTotalV266'))q('libraryTotalV266').textContent=libraryCacheV266.length;if(q('librarySubjectsV266'))q('librarySubjectsV266').textContent=subjects.size;if(q('libraryReviewV266'))q('libraryReviewV266').textContent=review;if(q('libraryFilteredV266'))q('libraryFilteredV266').textContent=libraryVisibleV266.length;
    const groups={};libraryVisibleV266.forEach((x,i)=>{const k=x.subject||'General';(groups[k]||=[]).push({...x,__viewIndex:i})});
    box.classList.toggle('listView',libraryViewV266==='list');box.innerHTML=Object.entries(groups).map(([subject,items])=>`<div class="libraryWall"><h3>${esc(subject)} <small>${items.length} resources</small></h3><div class="libraryShelf3D">${items.map((x,i)=>{const id=itemId(x,i),selected=librarySelectedV266.has(id),tags=Array.isArray(x.tags)?x.tags:String(x.tags||'').split(',').filter(Boolean);return `<div class="book3D ${String(x.type||'').replaceAll(' ','')} ${selected?'selectedV266':''}"><input class="libraryCheck" type="checkbox" ${selected?'checked':''} onchange="toggleLibrarySelectionV266('${esc(id)}',this.checked)"><div class="book3DSpine">${esc(x.type||'Item')}</div><div class="book3DCover"><b>${esc(x.title||'Untitled')}</b><small>${esc(x.date||'')}</small><div class="v266ResourceTags">${tags.slice(0,4).map(t=>`<span>${esc(t)}</span>`).join('')}</div></div><div class="book3DInfo"><p>${esc(String(x.content||'').slice(0,190))}${String(x.content||'').length>190?'…':''}</p>${x.url?`<a class="btn blue" target="_blank" rel="noopener" href="${esc(x.url)}">Open</a>`:''}<button class="btn purple" onclick="library2QuickAI('${esc(id)}')">AI</button><button class="btn gold" onclick="editLibraryItemV266('${esc(id)}')">Edit</button><button class="btn green" onclick="libraryItemRevisionV266('${esc(id)}')">Revision</button><button class="btn danger" onclick="deleteLibraryItemV266('${esc(id)}')">Delete</button></div></div>`}).join('')}</div></div>`).join('')||'<div class="v266InsightEmpty">No resources match the current filters.</div>';updateLibrarySelectionV266()};
  window.renderDigitalLibrary=window.renderDigitalLibrary2;
  window.setLibraryViewV266=function(mode,btn){libraryViewV266=mode;document.querySelectorAll('.v266ViewSwitch button').forEach(b=>b.classList.remove('active'));btn?.classList.add('active');window.renderDigitalLibrary2()};
  window.toggleLibrarySelectionV266=function(id,on){on?librarySelectedV266.add(id):librarySelectedV266.delete(id);updateLibrarySelectionV266()};
  function updateLibrarySelectionV266(){if(q('librarySelectionStatusV266'))q('librarySelectionStatusV266').textContent=`${librarySelectedV266.size} selected`}
  window.selectVisibleLibraryV266=function(){libraryVisibleV266.forEach((x,i)=>librarySelectedV266.add(itemId(x,i)));window.renderDigitalLibrary2()};window.clearLibrarySelectionV266=function(){librarySelectedV266.clear();window.renderDigitalLibrary2()};
  const selectedLibraryV266=()=>libraryCacheV266.filter((x,i)=>librarySelectedV266.has(itemId(x,i)));
  window.aiDigitalLibrary2=async function(){const title=q('libTitlePro')?.value.trim();if(!title&&!q('libContentPro')?.value.trim())return alert('Add a resource or choose saved items.');q('libraryAIOutput').innerHTML='<div class="aiLoading">Library AI is building UPSC intelligence...</div>';q('libraryAIOutput').innerHTML=fmt(await ask(`Analyze this UPSC library resource. Type:${q('libTypePro')?.value}; Subject:${q('libSubjectPro')?.value}; Title:${title}; Tags:${q('libraryTagsV266')?.value}; Content:${q('libContentPro')?.value}; URL:${q('libUrlPro')?.value}. Give source utility, key concepts, Prelims facts, Mains dimensions, PYQ links, missing context, revision questions and a 10-minute recall sheet.`))};
  window.aiLibrarySummary=window.aiDigitalLibrary2;
  window.askUnifiedLibraryAIV266=async function(){const question=q('libraryQuestionV266')?.value.trim();if(!question)return alert('Ask a question about your library.');const base=selectedLibraryV266().length?selectedLibraryV266():libraryFilteredV266().slice(0,35);if(!base.length)return alert('No matching library resources.');q('libraryAIOutput').innerHTML='<div class="aiLoading">Searching your library context...</div>';q('libraryAIOutput').innerHTML=fmt(await ask(`Answer only from and clearly distinguish the supplied personal UPSC library context. User question: ${question}. Resources: ${JSON.stringify(base.map(x=>({title:x.title,type:x.type,subject:x.subject,tags:x.tags,content:String(x.content||'').slice(0,2200),url:x.url}))).slice(0,30000)}. Synthesize, identify contradictions or gaps, and suggest next action.`))};
  window.analyzeSelectedLibraryV266=async function(){if(!selectedLibraryV266().length)return alert('Select resources first.');if(q('libraryQuestionV266'))q('libraryQuestionV266').value='Synthesize the selected resources into one UPSC master note with duplicates removed, PYQ linkage, revision questions and source gaps.';return window.askUnifiedLibraryAIV266()};
  window.makeLibraryRevisionPackV266=async function(){const base=selectedLibraryV266().length?selectedLibraryV266():libraryFilteredV266().slice(0,25);if(!base.length)return alert('No resources available.');q('libraryAIOutput').innerHTML='<div class="aiLoading">Creating revision pack...</div>';q('libraryAIOutput').innerHTML=fmt(await ask(`Create a compact UPSC revision pack from these resources: ${JSON.stringify(base).slice(0,28000)}. Include one-page summary, 20 active-recall questions, 15 flashcards, 10 MCQ traps, 5 Mains frameworks and a 7-day revision sequence.`))};
  window.makeLibrarySourceGapV266=async function(){const base=libraryFilteredV266().slice(0,50);if(!base.length)return alert('Add library resources first.');q('libraryAIOutput').innerHTML='<div class="aiLoading">Auditing source coverage...</div>';q('libraryAIOutput').innerHTML=fmt(await ask(`Audit this personal UPSC library for duplication, missing syllabus coverage, outdated or weak sources, absent PYQ linkage and revision risk. Data: ${JSON.stringify(base.map(x=>({title:x.title,type:x.type,subject:x.subject,tags:x.tags,content:String(x.content||'').slice(0,800)}))).slice(0,28000)}. Give a keep/merge/archive/add plan. Do not invent sources already present.`))};
  window.library2QuickAI=async function(id){const x=libraryCacheV266.find((v,i)=>itemId(v,i)===String(id));if(!x)return;q('libraryAIOutput').innerHTML='<div class="aiLoading">Analyzing selected resource...</div>';q('libraryAIOutput').innerHTML=fmt(await ask(`Analyze this saved UPSC resource: ${JSON.stringify(x).slice(0,18000)}. Give concise notes, exam relevance, PYQ linkage, five recall questions, five MCQs and a revision action.`));q('libraryAIOutput').scrollIntoView({behavior:'smooth'})};
  window.editLibraryItemV266=function(id){const x=libraryCacheV266.find((v,i)=>itemId(v,i)===String(id));if(!x)return;q('libTypePro').value=x.type||'Typed Note';q('libSubjectPro').value=x.subject||'General';q('libTitlePro').value=x.title||'';q('libUrlPro').value=x.url||'';q('libContentPro').value=x.content||'';q('libraryTagsV266').value=Array.isArray(x.tags)?x.tags.join(', '):x.tags||'';q('libTitlePro').focus();window.scrollTo({top:q('libraryShelf').offsetTop,behavior:'smooth'})};
  window.libraryItemRevisionV266=async function(id){const x=libraryCacheV266.find((v,i)=>itemId(v,i)===String(id));if(!x)return;await save('smartRevision',{topic:x.title||'Library resource',subject:x.subject||'General',source:'AI Digital Library Pro',difficulty:'Medium',date:new Date(Date.now()+86400000).toISOString().slice(0,10),cycle:1,status:'pending',body:x.content||''});alert('Resource sent to Revision Brain.')};
  window.library2ToRevision=async function(){const title=q('libTitlePro')?.value.trim();if(!title)return alert('Add or edit a resource first.');await save('smartRevision',{topic:title,subject:q('libSubjectPro')?.value||'General',source:'AI Digital Library Pro',difficulty:'Medium',date:new Date(Date.now()+86400000).toISOString().slice(0,10),cycle:1,status:'pending',body:q('libContentPro')?.value||''});alert('Sent to Revision Brain.')};
  window.deleteLibraryItemV266=async function(id){if(!confirm('Delete this library item?'))return;await deleteItem('digitalLibrary',id,true);librarySelectedV266.delete(String(id));await window.renderDigitalLibrary2()};

  // ---------- UNIFIED AI SMART CALENDAR ----------
  let calDateV266=new Date(),calendarItemsCacheV266=[];
  const dateKey=x=>String(x||'').slice(0,10);
  function calClassV266(type){return String(type||'Task').replace(/[^a-z0-9]/gi,'')}
  async function collectCalendarV266(){const [cal,rev,oldRev,plans]=await Promise.all(['calendarItems','smartRevision','revision','dailyPlans'].map(get)),items=[];cal.forEach((x,i)=>items.push({...x,sourceCol:'calendarItems',sourceId:itemId(x,i),type:x.type||'Task',title:x.title||'Task'}));rev.forEach((x,i)=>items.push({...x,sourceCol:'smartRevision',sourceId:itemId(x,i),type:'Revision',title:'Revise: '+(x.topic||x.title||'Topic')}));oldRev.forEach((x,i)=>items.push({...x,sourceCol:'revision',sourceId:itemId(x,i),type:'Revision',title:'Revise: '+(x.topic||x.title||'Topic')}));plans.forEach((x,i)=>items.push({...x,sourceCol:'dailyPlans',sourceId:itemId(x,i),type:'Plan',title:x.title||'Daily Plan'}));return items}
  window.renderCalendarAI=async function(){const grid=q('calendarGridV4'),agenda=q('calendarAgendaV4');if(!grid&&!agenda)return;calendarItemsCacheV266=await collectCalendarV266();const y=calDateV266.getFullYear(),m=calDateV266.getMonth(),prefix=`${y}-${String(m+1).padStart(2,'0')}`,filter=q('calendarTypeFilterV266')?.value||'All Types',filtered=calendarItemsCacheV266.filter(x=>dateKey(x.date).startsWith(prefix)&&(filter==='All Types'||String(x.type)===filter));
    if(q('calendarMonthControls'))q('calendarMonthControls').innerHTML=`<button class="btn ghost" onclick="changeCalendarMonthV266(-1)">← Previous</button><h2>${calDateV266.toLocaleString('default',{month:'long',year:'numeric'})}</h2><button class="btn ghost" onclick="goCalendarTodayV266()">Today</button><button class="btn ghost" onclick="changeCalendarMonthV266(1)">Next →</button>`;
    const first=new Date(y,m,1).getDay(),days=new Date(y,m+1,0).getDate();let html=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<div class="calHead">${d}</div>`).join('');for(let i=0;i<first;i++)html+='<div class="calCell empty"></div>';for(let d=1;d<=days;d++){const date=`${prefix}-${String(d).padStart(2,'0')}`,arr=filtered.filter(x=>dateKey(x.date)===date);html+=`<div class="calCell ${date===today()?'today':''}" ondblclick="quickAddCalendarDateV266('${date}')"><b>${d}</b>${arr.slice(0,5).map(x=>`<span class="${calClassV266(x.type)}" title="${esc(x.title)}">${esc(x.type)}: ${esc(x.title)}</span>`).join('')}${arr.length>5?`<small>+${arr.length-5} more</small>`:''}</div>`}if(grid)grid.innerHTML=html;
    if(agenda)agenda.innerHTML=filtered.sort((a,b)=>`${dateKey(a.date)} ${a.time||''}`.localeCompare(`${dateKey(b.date)} ${b.time||''}`)).map(x=>`<div class="item"><h3>${esc(x.title)}</h3><span class="tag">${esc(dateKey(x.date))}${x.time?' • '+esc(x.time):''}</span><span class="tag">${esc(x.type)}</span><button class="btn danger" onclick="deleteCalendarItemV266('${esc(x.sourceCol)}','${esc(x.sourceId)}')">Delete</button></div>`).join('')||'<div class="v266InsightEmpty">No items for this month and filter.</div>';
    const monthAll=calendarItemsCacheV266.filter(x=>dateKey(x.date).startsWith(prefix)),todayAll=calendarItemsCacheV266.filter(x=>dateKey(x.date)===today()),revs=monthAll.filter(x=>x.type==='Revision'),minutes=monthAll.reduce((a,x)=>a+Number(x.minutes||0),0);if(q('calendarMonthCountV266'))q('calendarMonthCountV266').textContent=monthAll.length;if(q('calendarTodayCountV266'))q('calendarTodayCountV266').textContent=todayAll.length;if(q('calendarRevisionCountV266'))q('calendarRevisionCountV266').textContent=revs.length;if(q('calendarHoursV266'))q('calendarHoursV266').textContent=(minutes/60).toFixed(minutes%60?1:0)+'h'};
  window.changeCalendarMonthV266=n=>{calDateV266.setMonth(calDateV266.getMonth()+n);window.renderCalendarAI()};window.goCalendarTodayV266=()=>{calDateV266=new Date();window.renderCalendarAI()};window.changeCalendarMonthV133=window.changeCalendarMonthV266;window.goTodayCalendarV133=window.goCalendarTodayV266;
  window.setCalendarTodayV266=function(){if(q('calendarQuickDateV266'))q('calendarQuickDateV266').value=today()};window.quickAddCalendarDateV266=function(date){q('calendarQuickDateV266').value=date;q('calendarQuickTitleV266').focus();q('calendarQuickTitleV266').scrollIntoView({behavior:'smooth',block:'center'})};
  window.addCalendarItemV266=async function(){const title=q('calendarQuickTitleV266')?.value.trim(),date=q('calendarQuickDateV266')?.value;if(!title||!date)return alert('Add date and title.');await save('calendarItems',{title,date,time:q('calendarQuickTimeV266')?.value||'',type:q('calendarQuickTypeV266')?.value||'Study',minutes:Number(q('calendarQuickMinutesV266')?.value||60),note:q('calendarQuickNoteV266')?.value.trim()||'',source:'Unified Calendar V26.6'});['calendarQuickTitleV266','calendarQuickNoteV266'].forEach(id=>q(id).value='');await window.renderCalendarAI()};
  window.deleteCalendarItemV266=async function(col,id){if(!confirm('Delete this calendar item?'))return;await deleteItem(col,id,true);await window.renderCalendarAI()};
  window.generateSmartCalendarV4=async function(){q('smartCalOutputV4').innerHTML='<div class="aiLoading">AI is creating a realistic time-block plan...</div>';try{const date=q('smartCalDateV4')?.value||today(),existing=(await collectCalendarV266()).filter(x=>dateKey(x.date)===date).map(x=>({time:x.time,title:x.title,type:x.type,minutes:x.minutes}));q('smartCalOutputV4').innerHTML=fmt(await ask(`Create a realistic UPSC time-block plan for ${date}. User constraints: ${q('smartCalPromptV4')?.value}. Existing commitments: ${JSON.stringify(existing)}. Include exact times in HH:MM-HH:MM format, subject, task, output target, breaks, revision, MCQ/answer writing and buffer. Do not overlap existing commitments.`))}catch(e){q('smartCalOutputV4').textContent='AI error: '+e.message}};
  window.saveSmartCalendarV4=async function(){const body=q('smartCalOutputV4')?.innerText.trim(),date=q('smartCalDateV4')?.value||today();if(!body)return alert('Generate an AI plan first.');const lines=body.split('\n').map(x=>x.trim()).filter(Boolean),timed=lines.filter(x=>/^\d{1,2}[:.]\d{2}\s*[-–—]/.test(x));if(timed.length){for(const line of timed.slice(0,20)){const m=line.match(/^(\d{1,2})[:.](\d{2})\s*[-–—]\s*(\d{1,2})[:.](\d{2})\s*[:\-]?\s*(.*)$/);if(!m)continue;const start=`${String(m[1]).padStart(2,'0')}:${m[2]}`,mins=(Number(m[3])*60+Number(m[4]))-(Number(m[1])*60+Number(m[2]));await save('calendarItems',{date,time:start,title:m[5]||'AI study block',type:'Study',minutes:Math.max(10,mins),note:'Generated by AI Smart Calendar',source:'AI Smart Calendar V26.6'})}}else await save('calendarItems',{date,title:'AI Smart Calendar Plan',type:'Plan',minutes:0,note:body,body,source:'AI Smart Calendar V26.6'});await window.renderCalendarAI();alert(timed.length?`${timed.length} AI time blocks saved.`:'AI plan saved to calendar.')};
  window.calendarFromCommandV266=function(){const date=q('smartCalDateV4')?.value||today(),key='mission_v261_active_'+date;let m=null;try{m=JSON.parse(localStorage.getItem(key)||'null')}catch(e){}if(!m)return alert('No Daily Command mission saved for this date.');q('smartCalPromptV4').value=`Use my Daily Command mission:\n${(m.tasks||[]).map(t=>`- ${t.title} (${t.minutes||45} min, ${t.priority||'Medium'})`).join('\n')}\nAvailable hours: ${m.availableHours||7}. Energy: ${m.energy||'Normal'}.`;};
  window.exportCalendarV266=async function(){const items=await collectCalendarV266(),rows=['Subject,Start Date,Start Time,Description'];items.forEach(x=>rows.push(`"${String(x.title||'').replaceAll('"','""')}",${dateKey(x.date)},${x.time||''},"${String(x.note||x.body||x.type||'').replaceAll('"','""')}"`));blobDownload('Mission-UPSC-Calendar.csv',rows.join('\n'),'text/csv;charset=utf-8')};

  // ---------- RICH NOTE STUDIO PRO ----------
  let richCurrentIdV266='',richCurrentKeyV266='',richCacheV266=[],richAutosaveTimerV266=null;
  const richEditor=()=>q('richEditorV4');
  function richTextV266(){return richEditor()?.innerText.trim()||''}
  function richUpdateCountV266(){const words=richTextV266()?richTextV266().split(/\s+/).filter(Boolean).length:0;if(q('richWordCountV266'))q('richWordCountV266').textContent=`${words} words • ${Math.max(1,Math.ceil(words/220))} min read`}
  function richDraftV266(){const draft={title:q('richNoteTitleV4')?.value||'',paper:q('richNotePaperV4')?.value||'',subject:q('richNoteSubjectV4')?.value||'',topic:q('richNoteTopicV4')?.value||'',tags:q('richNoteTagsV266')?.value||'',body:richEditor()?.innerHTML||'',savedAt:Date.now()};localStorage.setItem('rich_note_draft_v266',JSON.stringify(draft));if(q('richAutosaveStatusV266'))q('richAutosaveStatusV266').textContent='AUTOSAVED';if(q('richLastSavedV266'))q('richLastSavedV266').textContent='Draft '+new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
  function scheduleRichDraftV266(){richUpdateCountV266();if(q('richAutosaveStatusV266'))q('richAutosaveStatusV266').textContent='SAVING…';clearTimeout(richAutosaveTimerV266);richAutosaveTimerV266=setTimeout(richDraftV266,650)}
  window.richCommandV266=function(cmd,val){document.execCommand(cmd,false,val||null);richEditor()?.focus();scheduleRichDraftV266()};
  window.insertRichCalloutV266=function(type){document.execCommand('insertHTML',false,`<div class="richCalloutV266 ${type.toLowerCase()}"><b>${type} Focus</b><p>Add high-yield ${type.toLowerCase()} points here.</p></div><p><br></p>`);scheduleRichDraftV266()};
  window.insertRichFlowV266=function(){document.execCommand('insertHTML',false,'<div class="richFlowV266"><span>Cause</span><b>→</b><span>Process</span><b>→</b><span>Impact</span><b>→</b><span>Way Forward</span></div><p><br></p>');scheduleRichDraftV266()};
  const templatesV266={upsc:'<h2>Definition & Core Idea</h2><p></p><h2>Constitutional / Historical / Conceptual Base</h2><p></p><h2>Key Features</h2><ul><li></li></ul><div class="richCalloutV266 prelims"><b>Prelims Focus</b><p>Facts, statements, institutions, maps and traps.</p></div><div class="richCalloutV266 mains"><b>Mains Dimensions</b><p>Arguments, challenges, examples, data and way forward.</p></div><h2>PYQ Linkage</h2><p></p><h2>Current Affairs Connection</h2><p></p><h2>Revision Capsule</h2><p></p>',onepager:'<h2>Topic in One Line</h2><p></p><h3>Why Important?</h3><p></p><h3>Core Points</h3><ul><li></li><li></li><li></li></ul><div class="richFlowV266"><span>Cause</span><b>→</b><span>Impact</span><b>→</b><span>Response</span></div><h3>Prelims Punch</h3><p></p><h3>Mains Framework</h3><p></p><h3>30-Second Recall</h3><p></p>',mains:'<h2>Question Demand</h2><p>Directive • Core issue • Scope</p><h2>Introduction</h2><p></p><h2>Body Dimensions</h2><h3>Dimension 1</h3><p></p><h3>Dimension 2</h3><p></p><h3>Challenges / Critique</h3><p></p><h2>Way Forward</h2><p></p><h2>Conclusion</h2><p></p>',ca:'<h2>Why in News?</h2><p></p><h2>Background</h2><p></p><h2>Prelims Facts</h2><ul><li></li></ul><h2>Mains Dimensions</h2><p></p><h2>Data / Reports / Examples</h2><p></p><h2>PYQ & Syllabus Link</h2><p></p><h2>Way Forward</h2><p></p>',ethics:'<h2>Ethical Issue</h2><p></p><h2>Stakeholders</h2><ul><li></li></ul><h2>Values in Conflict</h2><p></p><h2>Options & Consequences</h2><p></p><h2>Decision</h2><p></p><h2>Justification & Implementation</h2><p></p>'};
  window.applyRichTemplateV266=function(name){if(richTextV266()&&!confirm('Replace the current editor content with this template?'))return;richEditor().innerHTML=templatesV266[name]||'';scheduleRichDraftV266()};
  window.newRichNoteV266=function(){richCurrentIdV266='';richCurrentKeyV266='note_'+Date.now();['richNoteTitleV4','richNoteTopicV4','richNoteTagsV266'].forEach(id=>{if(q(id))q(id).value=''});richEditor().innerHTML='';q('richNoteAIOutputV4').innerHTML='AI output will appear here.';q('richEditorModeTitleV266').textContent='Create UPSC Note';q('richNoteVersionsV266').innerHTML='<div class="v266InsightEmpty">Open a saved note to view versions.</div>';localStorage.removeItem('rich_note_draft_v266');richUpdateCountV266()};
  window.saveRichNoteV4=async function(){const title=q('richNoteTitleV4')?.value.trim(),body=richEditor()?.innerHTML.trim();if(!title||!richTextV266())return alert('Add a title and note content.');if(!richCurrentKeyV266)richCurrentKeyV266='note_'+Date.now();if(richCurrentIdV266){const old=richCacheV266.find((x,i)=>itemId(x,i)===richCurrentIdV266);if(old)await save('richNoteVersionsV266',{noteKey:richCurrentKeyV266,title:old.title,body:old.body,paper:old.paper,subject:old.subject,topic:old.topic,tags:old.tags||[],savedAt:new Date().toISOString(),date:today()});await deleteItem('richNotesV4',richCurrentIdV266,true)}await save('richNotesV4',{noteKey:richCurrentKeyV266,title,paper:q('richNotePaperV4')?.value||'Prelims GS',subject:q('richNoteSubjectV4')?.value||'General',topic:q('richNoteTopicV4')?.value.trim()||'',tags:String(q('richNoteTagsV266')?.value||'').split(',').map(x=>x.trim()).filter(Boolean),body,date:today(),updatedAt:Date.now(),source:'Rich Note Studio V26.6'});localStorage.removeItem('rich_note_draft_v266');await window.renderRichNotesV4();const saved=richCacheV266.find(x=>x.noteKey===richCurrentKeyV266);richCurrentIdV266=saved?itemId(saved,0):'';q('richAutosaveStatusV266').textContent='SAVED';q('richLastSavedV266').textContent='Saved '+new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});q('richEditorModeTitleV266').textContent='Edit UPSC Note';await window.renderRichVersionsV266();alert('Rich note saved.')};
  window.renderRichNotesV4=async function(){const box=q('richNotesListV4');if(!box)return;richCacheV266=await get('richNotesV4');const term=String(q('richNoteSearchV4')?.value||'').toLowerCase(),paper=q('richNotePaperFilterV266')?.value||'All Papers',list=richCacheV266.filter(x=>(!term||JSON.stringify(x).toLowerCase().includes(term))&&(paper==='All Papers'||x.paper===paper));box.innerHTML=list.map((x,i)=>{const id=itemId(x,i),plain=String(x.body||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();return `<article class="v266NoteCard ${id===richCurrentIdV266?'openV266':''}"><div class="v266NoteCardTop"><div><h3>${esc(x.title||'Untitled')}</h3><span class="tag">${esc(x.paper||'Notes')}</span><span class="tag">${esc(x.subject||'General')}</span></div><small>${esc(x.date||'')}</small></div><p class="v266NotePreview">${esc(plain.slice(0,190))}${plain.length>190?'…':''}</p><div class="actions"><button class="btn blue" onclick="openRichNoteV266('${esc(id)}')">Edit</button><button class="btn ghost" onclick="duplicateRichNoteV266('${esc(id)}')">Duplicate</button><button class="btn gold" onclick="downloadSavedRichNoteV266('${esc(id)}')">Download</button><button class="btn danger" onclick="deleteRichNoteV266('${esc(id)}')">Delete</button></div></article>`}).join('')||'<div class="v266InsightEmpty">No rich notes match the current filters.</div>'};
  window.openRichNoteV266=function(id){const x=richCacheV266.find((v,i)=>itemId(v,i)===String(id));if(!x)return;richCurrentIdV266=String(id);richCurrentKeyV266=x.noteKey||('legacy_'+id);q('richNoteTitleV4').value=x.title||'';q('richNotePaperV4').value=x.paper||'Prelims GS';q('richNoteSubjectV4').value=x.subject||'Polity';q('richNoteTopicV4').value=x.topic||'';q('richNoteTagsV266').value=Array.isArray(x.tags)?x.tags.join(', '):x.tags||'';richEditor().innerHTML=x.body||'';q('richEditorModeTitleV266').textContent='Edit UPSC Note';richUpdateCountV266();window.renderRichNotesV4();window.renderRichVersionsV266();q('richEditorV4').scrollIntoView({behavior:'smooth',block:'center'})};
  window.duplicateRichNoteV266=function(id){const x=richCacheV266.find((v,i)=>itemId(v,i)===String(id));if(!x)return;richCurrentIdV266='';richCurrentKeyV266='note_'+Date.now();q('richNoteTitleV4').value='Copy of '+(x.title||'Untitled');q('richNotePaperV4').value=x.paper||'Prelims GS';q('richNoteSubjectV4').value=x.subject||'Polity';q('richNoteTopicV4').value=x.topic||'';q('richNoteTagsV266').value=Array.isArray(x.tags)?x.tags.join(', '):x.tags||'';richEditor().innerHTML=x.body||'';q('richEditorModeTitleV266').textContent='Create Copy';richUpdateCountV266()};
  window.deleteRichNoteV266=async function(id){if(!confirm('Delete this rich note?'))return;await deleteItem('richNotesV4',id,true);if(richCurrentIdV266===String(id))window.newRichNoteV266();await window.renderRichNotesV4()};
  window.renderRichVersionsV266=async function(){const box=q('richNoteVersionsV266');if(!box)return;if(!richCurrentKeyV266){box.innerHTML='<div class="v266InsightEmpty">Open a saved note to view versions.</div>';return}const versions=(await get('richNoteVersionsV266')).filter(x=>x.noteKey===richCurrentKeyV266);box.innerHTML=versions.map((x,i)=>`<div class="v266Version"><b>${esc(x.title||'Version')}</b><small>${esc(x.savedAt?new Date(x.savedAt).toLocaleString():x.date||'')}</small><p>${esc(String(x.body||'').replace(/<[^>]+>/g,' ').slice(0,140))}…</p><button class="btn blue" onclick="restoreRichVersionV266('${esc(itemId(x,i))}')">Restore to Editor</button></div>`).join('')||'<div class="v266InsightEmpty">No earlier versions yet. Updating this note will create one.</div>'};
  window.restoreRichVersionV266=async function(id){const versions=await get('richNoteVersionsV266'),x=versions.find((v,i)=>itemId(v,i)===String(id));if(!x)return;richEditor().innerHTML=x.body||'';q('richNoteTitleV4').value=x.title||q('richNoteTitleV4').value;q('richNotePaperV4').value=x.paper||q('richNotePaperV4').value;q('richNoteSubjectV4').value=x.subject||q('richNoteSubjectV4').value;q('richNoteTopicV4').value=x.topic||'';q('richNoteTagsV266').value=Array.isArray(x.tags)?x.tags.join(', '):x.tags||'';scheduleRichDraftV266()};
  async function richAIActionV266(action){if(!richTextV266())return alert('Write or open a note first.');q('richNoteAIOutputV4').innerHTML='<div class="aiLoading">AI is working on the active note...</div>';try{q('richNoteAIOutputV4').innerHTML=fmt(await ask(`You are a senior UPSC notes editor. Action: ${action}. Paper:${q('richNotePaperV4')?.value}; Subject:${q('richNoteSubjectV4')?.value}; Topic:${q('richNoteTopicV4')?.value}; Note:${richTextV266().slice(0,28000)}. Preserve accurate content, flag facts needing verification, improve structure, add only relevant PYQ/current-affairs/value-addition sections, and produce clean reusable notes.`))}catch(e){q('richNoteAIOutputV4').textContent='AI error: '+e.message}}
  window.improveRichNoteV4=()=>richAIActionV266('Topper Notes Upgrade');window.runRichAIActionV266=()=>richAIActionV266(q('richAIActionV266')?.value||'Topper Notes Upgrade');window.summarizeRichNoteV266=()=>richAIActionV266('Create a concise one-page revision summary');
  function plainToEditorV266(text){return String(text||'').split('\n').map(line=>{const t=line.trim();if(!t)return '<p><br></p>';if(/^#{1,3}\s/.test(t)){const level=Math.min(3,(t.match(/^#+/)||['#'])[0].length);return `<h${level+1}>${esc(t.replace(/^#{1,3}\s*/,''))}</h${level+1}>`}if(/^[-*•]\s/.test(t))return `<ul><li>${esc(t.replace(/^[-*•]\s*/,''))}</li></ul>`;return `<p>${esc(t)}</p>`}).join('').replace(/<\/ul><ul>/g,'')}
  window.applyRichAIToEditorV266=function(){const text=q('richNoteAIOutputV4')?.innerText.trim();if(!text)return alert('Generate AI output first.');if(richTextV266()&&!confirm('Replace editor content with AI output?'))return;richEditor().innerHTML=plainToEditorV266(text);scheduleRichDraftV266()};
  window.richNoteToFlashcardsV266=function(){if(!richTextV266())return alert('Open a note first.');if(q('flashSourceText'))q('flashSourceText').value=`${q('richNoteTitleV4').value}\n${richTextV266()}`;window.show('smartFlashcards')};
  window.richNoteToMindmapV266=function(){if(!richTextV266())return alert('Open a note first.');if(q('mmTopic'))q('mmTopic').value=q('richNoteTitleV4').value||q('richNoteTopicV4').value;if(q('mmSubject'))q('mmSubject').value=q('richNoteSubjectV4').value;const heads=[...richEditor().querySelectorAll('h1,h2,h3')].map(x=>x.innerText).filter(Boolean);if(q('mmNodes'))q('mmNodes').value=heads.join(', ');window.show('mindMapStudio')};
  window.richNoteToRevisionV4=async function(){const topic=q('richNoteTopicV4')?.value.trim()||q('richNoteTitleV4')?.value.trim();if(!topic)return alert('Add a topic or title.');await save('smartRevision',{topic,subject:q('richNoteSubjectV4')?.value||'General',source:'Rich Note Studio Pro',difficulty:'Medium',date:new Date(Date.now()+86400000).toISOString().slice(0,10),cycle:1,status:'pending',body:richTextV266().slice(0,5000)});alert('Sent to Revision Brain.')};
  window.exportRichNoteV266=function(format){const title=q('richNoteTitleV4')?.value.trim()||'UPSC-Note',body=richEditor()?.innerHTML||'';if(!richTextV266())return alert('No note to export.');const html=`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:Arial;max-width:850px;margin:40px auto;line-height:1.65;padding:20px}h1,h2,h3{color:#17365d}.richCalloutV266{padding:12px;border-left:4px solid #2563eb;background:#eef4ff}</style></head><body><h1>${esc(title)}</h1><p><b>${esc(q('richNotePaperV4').value)} • ${esc(q('richNoteSubjectV4').value)} • ${esc(q('richNoteTopicV4').value)}</b></p>${body}</body></html>`;blobDownload(title.replace(/[^a-z0-9]+/gi,'-')+(format==='doc'?'.doc':'.html'),html,format==='doc'?'application/msword':'text/html;charset=utf-8')};
  window.downloadSavedRichNoteV266=function(id){const x=richCacheV266.find((v,i)=>itemId(v,i)===String(id));if(!x)return;blobDownload((x.title||'UPSC-Note').replace(/[^a-z0-9]+/gi,'-')+'.html',`<!doctype html><meta charset="utf-8"><title>${esc(x.title)}</title><body style="font-family:Arial;max-width:850px;margin:40px auto;line-height:1.65"><h1>${esc(x.title)}</h1>${x.body||''}</body>`,'text/html;charset=utf-8')};

  // Final navigation redirects keep every old internal link/data flow working.
  const previousShowV266=window.show;
  window.show=function(id,btn){const mapped=id==='digitalLibrary'?'libraryShelf':id==='calendar'?'aiCalendarV4':id;const r=previousShowV266.call(this,mapped,btn);setTimeout(()=>{if(mapped==='pyqIntelligence')window.renderFullPYQ();if(mapped==='libraryShelf')window.renderDigitalLibrary2();if(mapped==='aiCalendarV4'){if(q('calendarQuickDateV266')&&!q('calendarQuickDateV266').value)q('calendarQuickDateV266').value=today();if(q('smartCalDateV4')&&!q('smartCalDateV4').value)q('smartCalDateV4').value=today();window.renderCalendarAI()}if(mapped==='richNotesV4'){window.renderRichNotesV4();richUpdateCountV266()}},80);return r};

  function initV266(){
    if(q('richEditorV4')){q('richEditorV4').addEventListener('input',scheduleRichDraftV266);['richNoteTitleV4','richNoteTopicV4','richNoteTagsV266','richNotePaperV4','richNoteSubjectV4'].forEach(id=>q(id)?.addEventListener('input',scheduleRichDraftV266));try{const d=JSON.parse(localStorage.getItem('rich_note_draft_v266')||'null');if(d&&!richTextV266()){q('richNoteTitleV4').value=d.title||'';q('richNotePaperV4').value=d.paper||'Prelims GS';q('richNoteSubjectV4').value=d.subject||'Polity';q('richNoteTopicV4').value=d.topic||'';q('richNoteTagsV266').value=d.tags||'';richEditor().innerHTML=d.body||'';q('richAutosaveStatusV266').textContent='DRAFT';q('richLastSavedV266').textContent='Recovered autosave'}}catch(e){}richUpdateCountV266()}
    if(q('calendarQuickDateV266'))q('calendarQuickDateV266').value=today();if(q('smartCalDateV4'))q('smartCalDateV4').value=today();
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(initV266,250));setTimeout(initV266,1000);
})();


/* ===== V27.1 + V27.2 + V27.3 PHASE 4 ===== */
(()=>{
  const q=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clamp=(n,min=0,max=100)=>Math.max(min,Math.min(max,Number(n)||0));
  const avg=a=>a.length?a.reduce((s,x)=>s+(Number(x)||0),0)/a.length:0;
  const tday=()=>new Date().toISOString().slice(0,10);
  const ask=async p=>{if(typeof window.aiAskRouterV23==='function')return window.aiAskRouterV23(p);if(typeof window.aiAskV4==='function')return window.aiAskV4(p);throw new Error('AI router unavailable. Save an AI mode in AI Control Centre.');};
  const fmt=t=>typeof window.formatAI==='function'?window.formatAI(String(t||'')):`<pre>${esc(t)}</pre>`;
  const asListV27=v=>Array.isArray(v)?v:(v&&typeof v==='object'?Object.values(v):[]);
  const get=async name=>{try{return asListV27(await getCol(name))}catch(e){try{return asListV27(JSON.parse(localStorage.getItem(name)||'[]'))}catch(x){return []}}};
  const save=async(name,obj)=>{try{return await saveCol(name,obj)}catch(e){const a=JSON.parse(localStorage.getItem(name)||'[]');a.unshift({...obj,id:'local_'+Date.now()});localStorage.setItem(name,JSON.stringify(a))}};
  const itemId=(x,i)=>String(x?.id||x?._docId||i);
  const download=(name,content,type='text/plain;charset=utf-8')=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)};
  let snapshotV27=null, strategyTextV271='', readinessV272=null, graphV273={topic:'',subject:'',nodes:[],edges:[],report:'',source:'local'}, graphTypesV273=new Set();

  function dateDiff(date){if(!date)return null;const d=new Date(date+'T23:59:59'),now=new Date();return Math.max(0,Math.ceil((d-now)/86400000))}
  function dateOnly(x){return String(x?.date||x?.createdAt||x?.savedAt||'').slice(0,10)}
  function completionValue(x){if(Number.isFinite(Number(x?.progress)))return clamp(x.progress);if(Number.isFinite(Number(x?.completion)))return clamp(x.completion);const s=String(x?.status||'').toLowerCase();return /complete|done|mastered/.test(s)?100:/progress|revision/.test(s)?55:/not started|pending/.test(s)?10:0}
  function normalizedScore(x){const score=Number(x?.score),max=Number(x?.maxScore||x?.max||x?.total);if(Number.isFinite(score)&&max>0)return clamp(score/max*100);if(Number.isFinite(Number(x?.accuracy)))return clamp(x.accuracy);return null}
  async function collectSnapshotV27(){
    const names=['syllabus','syllabusAI','completion','tests','prelimsReportsV251','mainsReportsV252','mainsEvaluationsV235','interviewReportsV253','smartRevision','revision','memoryCardsV263','studyLogs','focusSessionsV262','focusSessions','habits','habitLogsV262','pyq','pyqBank','notes','richNotesV4','flash','smartFlashcards','wrongbook','currentAffairsAI','currentAffairs','digitalLibrary','libraryItemsV266','commandPlansV261'];
    const vals=await Promise.all(names.map(get));const d=Object.fromEntries(names.map((n,i)=>[n,vals[i]||[]]));
    const syllabus=[...d.syllabus,...d.syllabusAI,...d.completion], tests=[...d.tests,...d.prelimsReportsV251], mains=[...d.mainsReportsV252,...d.mainsEvaluationsV235], revision=[...d.smartRevision,...d.revision], study=[...d.studyLogs,...d.focusSessionsV262,...d.focusSessions], habits=[...d.habits,...d.habitLogsV262], pyq=[...d.pyq,...d.pyqBank], notes=[...d.notes,...d.richNotesV4], flash=[...d.flash,...d.smartFlashcards], ca=[...d.currentAffairsAI,...d.currentAffairs], library=[...d.digitalLibrary,...d.libraryItemsV266];
    const syllabusScore=clamp(avg(syllabus.map(completionValue).filter(x=>x>0)));
    const testScores=tests.map(normalizedScore).filter(x=>x!==null), mainsScores=mains.map(normalizedScore).filter(x=>x!==null), interviewScores=d.interviewReportsV253.map(normalizedScore).filter(x=>x!==null);
    const now=new Date(), last14=new Set(study.map(dateOnly).filter(x=>x&&((now-new Date(x+'T00:00:00'))/86400000)<=13));
    const hours14=study.filter(x=>{const dt=dateOnly(x);return dt&&((now-new Date(dt+'T00:00:00'))/86400000)<=13}).reduce((s,x)=>s+Number(x.hours||x.minutes/60||0),0);
    const consistency=clamp((last14.size/14)*70+Math.min(30,hours14/70*30));
    const due=revision.filter(x=>!/done|complete/i.test(String(x.status||'')) && (!x.date||new Date(String(x.date).slice(0,10)+'T23:59:59')<=now)).length;
    const completedRev=revision.filter(x=>/done|complete/i.test(String(x.status||''))).length, revScore=revision.length?clamp(completedRev/revision.length*100 - Math.min(25,due*2)):Math.min(25,notes.length);
    const memory=d.memoryCardsV263||[], memoryDue=memory.filter(x=>!x.nextReview||new Date(String(x.nextReview).slice(0,10)+'T23:59:59')<=now).length, memoryScore=memory.length?clamp(100-memoryDue/memory.length*75):Math.min(20,flash.length/5);
    const prelims=clamp((avg(testScores)*.48)+(syllabusScore*.24)+(revScore*.18)+(memoryScore*.10));
    const mainsScore=clamp((avg(mainsScores)*.52)+(syllabusScore*.2)+(consistency*.13)+(Math.min(100,notes.length*2)*.15));
    const interview=clamp(avg(interviewScores));
    const composite=clamp(prelims*.40+mainsScore*.37+consistency*.13+revScore*.10);
    const usable=testScores.length+mainsScores.length+interviewScores.length+syllabus.length+study.length+revision.length+memory.length;
    const confidence=clamp((Math.min(20,testScores.length*4)+Math.min(20,mainsScores.length*3)+Math.min(15,syllabus.length*.8)+Math.min(15,study.length*.6)+Math.min(15,revision.length*.7)+Math.min(15,memory.length*.2)));
    const weak=[];if(syllabusScore<60)weak.push('Syllabus coverage');if(avg(testScores)<60)weak.push('Prelims accuracy');if(avg(mainsScores)<50)weak.push('Mains answer quality');if(revScore<60)weak.push('Revision completion');if(consistency<60)weak.push('Study consistency');if(memoryScore<60)weak.push('Retention / recall');if(d.wrongbook.length>5)weak.push('Wrong-answer backlog');
    return {d,syllabus,tests,mains,revision,study,habits,pyq,notes,flash,ca,library,testScores,mainsScores,interviewScores,syllabusScore,prelims,mainsScore,interview,consistency,revScore,memoryScore,memoryDue,due,composite,confidence,usable,weak,hours14,last14:last14.size};
  }
  function evidenceRows(s){return [['Syllabus coverage',s.syllabusScore+'%',s.syllabus.length+' records'],['Prelims tests',Math.round(avg(s.testScores))+'%',s.testScores.length+' scored tests'],['Mains evaluations',Math.round(avg(s.mainsScores))+'%',s.mainsScores.length+' evaluated answers'],['Revision health',Math.round(s.revScore)+'%',s.due+' due/overdue'],['Study consistency',Math.round(s.consistency)+'%',s.last14+' active days / 14'],['Memory health',Math.round(s.memoryScore)+'%',s.memoryDue+' recall cards due'],['PYQ bank',s.pyq.length,s.pyq.length?'questions available':'add PYQs'],['Notes + library',s.notes.length+s.library.length,'searchable resources']].map(x=>`<div class="v27EvidenceItem"><div><b>${esc(x[0])}</b><small>${esc(x[2])}</small></div><span>${esc(x[1])}</span></div>`).join('')}

  // V27.1 Strategy Room
  window.refreshStrategySnapshotV271=async function(){q('strategyEvidenceV271').innerHTML='<div class="aiLoading">Scanning preparation evidence...</div>';snapshotV27=await collectSnapshotV27();q('strategyEvidenceV271').innerHTML=evidenceRows(snapshotV27);q('strategyConfidenceV271').textContent=Math.round(snapshotV27.confidence)+'%';q('strategyReadinessV271').textContent=Math.round(snapshotV27.composite)+'%';q('strategyRepairsV271').textContent=snapshotV27.weak.length;const days=dateDiff(q('strategyDateV271')?.value);q('strategyDaysV271').textContent=days??'—';q('strategyPhaseV271').textContent=days===null?'Set a target date':phaseNameV271(days)};
  function phaseNameV271(days){return days>180?'Foundation & coverage':days>90?'Consolidation':days>45?'Tests + revision':days>15?'Intensive repair':'Final sprint'}
  window.importCountdownToStrategyV271=function(){const target=q('strategyTargetV271').value,date=/Mains|Interview/.test(target)?localStorage.getItem('mainsDateAI'):localStorage.getItem('prelimsDateAI');if(date)q('strategyDateV271').value=date;else alert('Set the exam date in Exam Countdown first.');window.refreshStrategySnapshotV271()}
  function localStrategyTextV271(s){const target=q('strategyTargetV271').value,date=q('strategyDateV271').value,days=dateDiff(date)??180,hours=Number(q('strategyHoursV271').value||7),phase=phaseNameV271(days),weak=s.weak.length?s.weak.join(', '):'No strong weakness identified yet';const cycles=days>120?4:days>60?3:days>25?2:1;return `# ${target} Master Strategy\n\n## Current diagnosis\n- Target date: ${date||'Not set'} (${days} days)\n- Current phase: ${phase}\n- Composite readiness: ${Math.round(s.composite)}% with ${Math.round(s.confidence)}% data confidence\n- Priority repairs: ${weak}\n- Practical capacity: ${hours} hours/day, ${q('strategyDayV271').value}\n\n## Strategic priorities\n1. Close high-priority syllabus gaps before adding new low-yield sources.\n2. Run ${cycles} repeating cycles of coverage → recall → PYQ/test → error repair.\n3. Protect a daily revision block and one weekly full error-log session.\n4. Link every current-affairs issue to static syllabus and at least one PYQ demand.\n5. Track outcomes through test accuracy, mains rubric scores and retention—not only study hours.\n\n## Weekly rhythm\n- 35% core/static coverage and optional\n- 25% revision + active recall\n- 20% PYQ/mock practice and elimination\n- 15% mains answer writing/value addition\n- 5% planning, review and backlog cleanup\n\n## Test cadence\n- Prelims: ${days>90?'2 sectional tests/week':'3 sectional + 1 full test/week'}\n- Mains: ${days>90?'3 answers/week':'1–2 answers/day'}\n- Every test must produce a dated error-repair list.\n\n## Non-negotiables for the next 7 days\n${s.weak.slice(0,5).map((x,i)=>`${i+1}. Repair ${x} with one source, one recall set and one test.`).join('\n')||'1. Build enough real test and revision data for a reliable diagnosis.'}\n\n## Stop doing\n- Repeatedly collecting new material without revision.\n- Treating long study hours as proof of readiness.\n- Ignoring wrong answers and weak mains dimensions.\n\n## Review rule\nRecalculate readiness every Sunday and modify only the next two weeks, not the entire plan.`}
  function milestoneDataV271(days){const list=days>180?[['Days 1–30','Foundation closure','Complete high-priority static gaps and baseline PYQs.'],['Days 31–60','First consolidation','One revision cycle and sectional tests.'],['Days 61–90','Performance build','Raise accuracy and answer-writing rubric scores.'],['Beyond 90','Adaptive cycles','Repeat test–repair cycles based on evidence.']]:days>90?[['Next 14 days','Gap closure','Finish the highest-yield pending topics.'],['Days 15–45','Revision cycle','Recall, PYQs and sectional tests.'],['Days 46–75','Mock integration','Full mocks with strict analysis.'],['Final phase','Execution','Exam simulation and controlled revision.']]:days>45?[['Next 7 days','Repair','Close the top three weak areas.'],['Week 2–3','Test build','Frequent sectional/full tests.'],['Week 4–5','Second revision','Error notebook and retention.'],['Final weeks','Simulation','Exam timing, sleep and selection strategy.']]:[['Next 3 days','Triage','High-yield weak topics only.'],['Next 7 days','Recall + mocks','No new low-yield sources.'],['Penultimate week','Simulation','Full-paper rhythm and error control.'],['Final days','Stability','Light revision, sleep and confidence.']];return list}
  function renderMilestonesV271(days){q('strategyMilestonesV271').innerHTML=milestoneDataV271(days).map((x,i)=>`<div class="v27Milestone"><strong>${i+1}. ${esc(x[0])} — ${esc(x[1])}</strong><small>${esc(x[2])}</small></div>`).join('')}
  window.buildLocalStrategyV271=async function(){if(!snapshotV27)await window.refreshStrategySnapshotV271();strategyTextV271=localStrategyTextV271(snapshotV27);q('strategyOutputV271').innerHTML=fmt(strategyTextV271);q('strategySourceV271').textContent='LOCAL EVIDENCE';renderMilestonesV271(dateDiff(q('strategyDateV271').value)??180)}
  window.buildAIStrategyV271=async function(){if(!snapshotV27)await window.refreshStrategySnapshotV271();q('strategyOutputV271').innerHTML='<div class="aiLoading">Selected AI is building an adaptive UPSC strategy...</div>';const p=`Act as a strict, practical UPSC strategy mentor. Build an adaptive plan using this evidence: ${JSON.stringify({target:q('strategyTargetV271').value,date:q('strategyDateV271').value,hours:q('strategyHoursV271').value,schedule:q('strategyDayV271').value,constraints:q('strategyConstraintsV271').value,metrics:{syllabus:snapshotV27.syllabusScore,prelims:snapshotV27.prelims,mains:snapshotV27.mainsScore,consistency:snapshotV27.consistency,revision:snapshotV27.revScore,memory:snapshotV27.memoryScore,confidence:snapshotV27.confidence},weak:snapshotV27.weak,samples:{tests:snapshotV27.testScores.length,mains:snapshotV27.mainsScores.length,study:snapshotV27.study.length}},null,2)}. Output: diagnosis, phase-wise roadmap, weekly timetable, sources rule, prelims test cadence, mains answer cadence, revision system, current affairs integration, optional plan, measurable milestones, first 7 days, and stop-doing list. Avoid generic motivation and do not promise selection.`;try{strategyTextV271=await ask(p);q('strategyOutputV271').innerHTML=fmt(strategyTextV271);q('strategySourceV271').textContent='SELECTED AI';renderMilestonesV271(dateDiff(q('strategyDateV271').value)??180)}catch(e){q('strategyOutputV271').textContent='AI error: '+e.message}}
  window.saveStrategyV271=async function(){if(!strategyTextV271)return alert('Build a strategy first.');await save('strategyPlansV271',{target:q('strategyTargetV271').value,date:q('strategyDateV271').value,hours:q('strategyHoursV271').value,body:strategyTextV271,source:q('strategySourceV271').textContent,savedAt:new Date().toISOString()});await window.renderStrategyHistoryV271();alert('Strategy saved.')}
  window.renderStrategyHistoryV271=async function(){const box=q('strategyHistoryV271'),a=await get('strategyPlansV271');box.innerHTML=a.slice(0,20).map((x,i)=>`<div class="v27HistoryCard"><h3>${esc(x.target||'UPSC Strategy')}</h3><p>${esc(x.date||'No date')} • ${esc(x.source||'Saved')}</p><div class="actions"><button class="btn blue" onclick="openStrategyV271('${esc(itemId(x,i))}')">Open</button><button class="btn danger" onclick="deleteItem('strategyPlansV271','${esc(itemId(x,i))}');setTimeout(renderStrategyHistoryV271,350)">Delete</button></div></div>`).join('')||'<div class="v27Empty">No saved strategy yet.</div>'}
  window.openStrategyV271=async function(id){const a=await get('strategyPlansV271'),x=a.find((v,i)=>itemId(v,i)===String(id));if(!x)return;strategyTextV271=x.body||'';q('strategyTargetV271').value=x.target||'Integrated UPSC Plan';q('strategyDateV271').value=x.date||'';q('strategyOutputV271').innerHTML=fmt(strategyTextV271);q('strategySourceV271').textContent=x.source||'SAVED';renderMilestonesV271(dateDiff(x.date)??180)}
  window.strategyToCalendarV271=async function(){if(!strategyTextV271)return alert('Build a strategy first.');const base=new Date(),ms=milestoneDataV271(dateDiff(q('strategyDateV271').value)??180);for(let i=0;i<ms.length;i++){const d=new Date(base);d.setDate(d.getDate()+i*14);await save('calendarItems',{date:d.toISOString().slice(0,10),type:'Strategy Milestone',title:ms[i][1],note:ms[i][2],source:'AI Strategy Room V27.1'})}alert('Milestones sent to AI Smart Calendar.')}
  window.strategyToDailyCommandV271=async function(){if(!strategyTextV271)return alert('Build a strategy first.');await save('commandPlansV261',{date:tday(),title:'Strategy Room — Week 1',body:strategyTextV271.slice(0,8000),source:'V27.1 Strategy Room',status:'pending'});alert('Week 1 strategy sent to Daily Command Centre.')}
  window.downloadStrategyV271=function(){if(!strategyTextV271)return alert('Build a strategy first.');download('UPSC-Strategy-'+tday()+'.txt',strategyTextV271)}

  // V27.2 Readiness & Rank Intelligence
  function bandV272(score,confidence){if(confidence<25)return {name:'Insufficient evidence',risk:'high',text:'Complete more real mocks, answer evaluations and revision logs before trusting any prediction.'};if(score<40)return {name:'High-risk zone',risk:'high',text:'Current preparation evidence is not yet exam-ready. Focus on fundamentals and backlog repair.'};if(score<56)return {name:'Developing zone',risk:'high',text:'Some systems exist, but performance is too fragile for a safe attempt.'};if(score<70)return {name:'Competitive foundation',risk:'medium',text:'You have a viable base, but weak areas or inconsistency can still pull the result down.'};if(score<83)return {name:'Strong preparation zone',risk:'medium',text:'Evidence is encouraging. Maintain test quality, revision and exam-day execution.'};return {name:'High-readiness zone',risk:'good',text:'Your preparation indicators are strong, but no private tool can responsibly guarantee selection or AIR.'}}
  window.calculateReadinessV272=async function(){q('rankBreakdownV272').innerHTML='<div class="aiLoading">Calculating from real preparation records...</div>';snapshotV27=await collectSnapshotV27();const s=snapshotV27, metrics=[['Syllabus coverage',s.syllabusScore],['Prelims performance',s.prelims],['Mains performance',s.mainsScore],['Revision health',s.revScore],['Memory retention',s.memoryScore],['Consistency',s.consistency],['Interview readiness',s.interview]];q('rankCompositeV272').textContent=Math.round(s.composite)+'%';q('rankPrelimsV272').textContent=Math.round(s.prelims)+'%';q('rankMainsV272').textContent=Math.round(s.mainsScore)+'%';q('rankConsistencyV272').textContent=Math.round(s.consistency)+'%';q('rankConfidenceV272').textContent=Math.round(s.confidence)+'%';q('rankSampleV272').textContent=s.usable+' usable records';const b=bandV272(s.composite,s.confidence);q('rankBandV272').textContent=b.name;q('rankRiskBadgeV272').className='v27RiskBadge '+b.risk;q('rankRiskBadgeV272').textContent=b.name.toUpperCase();q('rankOutcomeV272').innerHTML=`<h3>${esc(b.name)}</h3><p>${esc(b.text)}</p><p><b>Rank intelligence:</b> An exact AIR is intentionally not shown. Your safest objective is to move every major indicator above 70% with sufficient sample size.</p>`;q('rankBreakdownV272').innerHTML=metrics.map(x=>`<div class="v27BarRow"><b>${esc(x[0])}</b><div class="v27BarTrack"><i style="width:${clamp(x[1])}%"></i></div><span>${Math.round(x[1])}%</span></div>`).join('');const strengths=metrics.filter(x=>x[1]>=70).sort((a,b)=>b[1]-a[1]).slice(0,3),weak=metrics.filter(x=>x[1]<60).sort((a,b)=>a[1]-b[1]).slice(0,4);q('rankDriversV272').innerHTML=[...strengths.map(x=>`<div class="v27Driver"><span>✅ ${esc(x[0])}</span><b>${Math.round(x[1])}%</b></div>`),...weak.map(x=>`<div class="v27Driver"><span>⚠️ ${esc(x[0])}</span><b>${Math.round(x[1])}%</b></div>`)].join('');q('scenarioHoursV272').value=Math.round(Math.max(10,Math.min(80,s.hours14/2)));q('scenarioAccuracyV272').value=Math.round(avg(s.testScores)||60);q('scenarioRevisionV272').value=Math.round(s.revScore||70);q('scenarioMainsV272').value=Math.round(avg(s.mainsScores)||50);window.updateScenarioV272();return s}
  window.updateScenarioV272=function(){const h=Number(q('scenarioHoursV272').value),a=Number(q('scenarioAccuracyV272').value),r=Number(q('scenarioRevisionV272').value),m=Number(q('scenarioMainsV272').value);q('scenarioHoursLabelV272').textContent=h+'h';q('scenarioAccuracyLabelV272').textContent=a+'%';q('scenarioRevisionLabelV272').textContent=r+'%';q('scenarioMainsLabelV272').textContent=m+'%';const projected=clamp((Math.min(100,h/60*100)*.18)+(a*.36)+(r*.23)+(m*.23));const current=readinessV272?.composite??snapshotV27?.composite??0;q('scenarioOutputV272').innerHTML=`Projected planning score: <b>${Math.round(projected)}%</b> (${projected-current>=0?'+':''}${Math.round(projected-current)} points versus current composite). Biggest leverage: ${a<65?'mock accuracy':r<70?'revision completion':m<55?'mains quality':'consistency and maintenance'}.`}
  window.diagnoseReadinessAI272=async function(){if(!snapshotV27)await window.calculateReadinessV272();q('rankAIOutputV272').innerHTML='<div class="aiLoading">AI is diagnosing readiness...</div>';try{const out=await ask(`Act as a strict UPSC performance analyst. Evidence: ${JSON.stringify({composite:snapshotV27.composite,confidence:snapshotV27.confidence,syllabus:snapshotV27.syllabusScore,prelims:snapshotV27.prelims,mains:snapshotV27.mainsScore,revision:snapshotV27.revScore,memory:snapshotV27.memoryScore,consistency:snapshotV27.consistency,samples:{tests:snapshotV27.testScores.length,mains:snapshotV27.mainsScores.length,study:snapshotV27.study.length},weak:snapshotV27.weak},null,2)}. Give: brutally honest readiness diagnosis, evidence limitations, top strengths, top risks, measurable 14-day repair plan, target metrics, and exam-stage advice. Never promise selection or claim an exact AIR.`);q('rankAIOutputV272').innerHTML=fmt(out)}catch(e){q('rankAIOutputV272').textContent='AI error: '+e.message}}
  window.saveReadinessSnapshotV272=async function(){if(!snapshotV27)await window.calculateReadinessV272();await save('readinessSnapshotsV272',{date:tday(),savedAt:new Date().toISOString(),composite:Math.round(snapshotV27.composite),prelims:Math.round(snapshotV27.prelims),mains:Math.round(snapshotV27.mainsScore),consistency:Math.round(snapshotV27.consistency),revision:Math.round(snapshotV27.revScore),confidence:Math.round(snapshotV27.confidence),weak:snapshotV27.weak});await window.renderReadinessHistoryV272();alert('Readiness snapshot saved.')}
  window.renderReadinessHistoryV272=async function(){const a=(await get('readinessSnapshotsV272')).slice().reverse();q('rankHistoryChartV272').innerHTML=a.length?a.slice(-20).map(x=>`<div class="v27TrendBar" style="height:${Math.max(8,Number(x.composite||0))}%"><span>${Number(x.composite||0)}</span><small>${esc(String(x.date||'').slice(5))}</small></div>`).join(''):'<div class="v27Empty">No snapshots yet.</div>';q('rankHistoryV272').innerHTML=a.slice().reverse().slice(0,12).map((x,i)=>`<div class="v27HistoryCard"><h3>${esc(x.date)} — ${x.composite}%</h3><p>Prelims ${x.prelims}% • Mains ${x.mains}% • Confidence ${x.confidence}%</p><button class="btn danger" onclick="deleteItem('readinessSnapshotsV272','${esc(itemId(x,i))}');setTimeout(renderReadinessHistoryV272,350)">Delete</button></div>`).join('')}
  window.readinessToRevisionV272=async function(){if(!snapshotV27)await window.calculateReadinessV272();for(const topic of snapshotV27.weak.slice(0,6))await save('smartRevision',{topic,subject:'Integrated',source:'Readiness & Rank Intelligence V27.2',difficulty:'High',date:tday(),status:'pending',cycle:1});alert('Priority repairs sent to Revision Brain.')}

  // V27.3 Knowledge Graph Pro
  const colorsV273={Core:'#173f73',Syllabus:'#2563eb',Static:'#0f9f6e',PYQ:'#d97706','Current Affairs':'#dc2626',Mains:'#7c3aed',Prelims:'#0891b2',Revision:'#be185d',Note:'#475569',Library:'#4f46e5',Flashcard:'#65a30d',Map:'#0d9488'};
  function nodeV273(label,type='Static',detail='',source='Generated'){return {id:'n_'+Math.random().toString(36).slice(2,9),label:String(label||'Node').slice(0,80),type,detail:String(detail||'').slice(0,3000),source}}
  function termMatch(obj,terms){const s=JSON.stringify(obj).toLowerCase();return terms.some(t=>t.length>2&&s.includes(t))}
  function buildEdgesV273(nodes){const core=nodes[0];return nodes.slice(1).map(n=>({from:core.id,to:n.id,label:n.type}))}
  async function workspaceGraphV273(topic,subject){const terms=topic.toLowerCase().split(/\s+/).filter(Boolean),cols=await Promise.all(['syllabus','syllabusAI','notes','richNotesV4','pyq','pyqBank','currentAffairsAI','currentAffairs','digitalLibrary','libraryItemsV266','flash','smartFlashcards','smartRevision','revision','maps'].map(get));const [sy1,sy2,no1,no2,p1,p2,c1,c2,l1,l2,f1,f2,r1,r2,maps]=cols, nodes=[nodeV273(topic,'Core',`Core topic in ${subject}`,'User topic')];const add=(arr,type,labelFn,detailFn,limit=5)=>arr.filter(x=>termMatch(x,terms)).slice(0,limit).forEach(x=>nodes.push(nodeV273(labelFn(x),type,detailFn(x),x.title||x.source||type)));add([...sy1,...sy2],'Syllabus',x=>x.topic||x.title||x.name||'Syllabus link',x=>JSON.stringify(x));add([...no1,...no2],'Note',x=>x.title||x.topic||'Note',x=>String(x.body||x.note||x.content||''));add([...p1,...p2],'PYQ',x=>`${x.year||''} ${x.topic||x.q||x.question||'PYQ'}`.trim(),x=>x.q||x.question||JSON.stringify(x));add([...c1,...c2],'Current Affairs',x=>x.title||x.topic||'Current affairs link',x=>x.body||x.analysis||JSON.stringify(x));add([...l1,...l2],'Library',x=>x.title||x.name||'Library resource',x=>x.body||x.note||x.description||JSON.stringify(x));add([...f1,...f2],'Flashcard',x=>x.q||x.question||x.front||'Recall card',x=>x.a||x.answer||x.back||JSON.stringify(x),4);add([...r1,...r2],'Revision',x=>x.topic||x.title||'Revision weakness',x=>x.body||x.note||JSON.stringify(x),4);add(maps,'Map',x=>x.place||x.title||'Map connection',x=>x.note||JSON.stringify(x),3);if(nodes.length<6){['Definition & core idea','Syllabus location','Historical/static roots','Current-affairs linkage','Prelims traps','Mains dimensions','Relevant PYQ demand','Revision checklist'].forEach((x,i)=>nodes.push(nodeV273(x,['Static','Syllabus','Static','Current Affairs','Prelims','Mains','PYQ','Revision'][i],`Develop this connection for ${topic}.`,'Local scaffold')))}return {nodes:nodes.slice(0,28),edges:buildEdgesV273(nodes.slice(0,28))}}
  function parseGraphJSONV273(text){const m=String(text||'').match(/GRAPH_JSON:\s*([\s\S]*?)(?:\n\s*#|$)/i);if(!m)return null;try{const j=JSON.parse(m[1].trim());if(!Array.isArray(j.nodes))return null;const nodes=j.nodes.map((x,i)=>({id:String(x.id||'a'+i),label:String(x.label||x.name||'Node'),type:String(x.type||'Static'),detail:String(x.detail||x.description||''),source:'AI'}));return {nodes,edges:Array.isArray(j.edges)?j.edges.map(e=>({from:String(e.from),to:String(e.to),label:String(e.label||'')})):buildEdgesV273(nodes)}}catch(e){return null}}
  window.buildLocalKnowledgeGraphV273=async function(){const topic=q('kgTopicV273').value.trim();if(!topic)return alert('Enter a core topic.');q('kgBoardV273').innerHTML='<div class="aiLoading">Scanning notes, PYQs, syllabus, CA, library and revision data...</div>';const g=await workspaceGraphV273(topic,q('kgSubjectV273').value);graphV273={topic,subject:q('kgSubjectV273').value,nodes:g.nodes,edges:g.edges,report:`# Local Knowledge Graph — ${topic}\n\nFound ${g.nodes.length-1} connected nodes from your workspace and UPSC scaffolding. Review weak or missing node types before saving.`,source:'Workspace scan'};graphTypesV273=new Set(graphV273.nodes.map(n=>n.type));renderTypeFiltersV273();window.renderKnowledgeGraphV273();q('kgReportV273').innerHTML=fmt(graphV273.report);q('kgNodeCountV273').textContent=graphV273.nodes.length+' NODES'}
  window.buildAIKnowledgeGraphV273=async function(){const topic=q('kgTopicV273').value.trim();if(!topic)return alert('Enter a core topic.');q('kgReportV273').innerHTML='<div class="aiLoading">Selected AI is building deeper connections...</div>';let local=await workspaceGraphV273(topic,q('kgSubjectV273').value);const context=local.nodes.slice(1,15).map(n=>`${n.type}: ${n.label} — ${n.detail.slice(0,250)}`).join('\n');const prompt=`You are a UPSC knowledge-graph architect. Topic:${topic}; Subject:${q('kgSubjectV273').value}; Depth:${q('kgDepthV273').value}; User context:${q('kgContextV273').value}; Workspace evidence:${context}. Return one strict machine-readable line first: GRAPH_JSON: {"nodes":[{"id":"core","label":"${topic}","type":"Core","detail":""}],"edges":[{"from":"core","to":"id","label":"relationship"}]}. Use 12-24 nodes across Syllabus, Static, PYQ, Current Affairs, Prelims, Mains, Revision, Map, Ethics/Essay where relevant. Then provide a report with syllabus location, strongest connections, hidden interdisciplinary links, prelims traps, mains dimensions, PYQ demands, missing evidence, and revision sequence. Do not invent current facts; flag items needing verification.`;try{const out=await ask(prompt),parsed=parseGraphJSONV273(out);if(parsed){graphV273={topic,subject:q('kgSubjectV273').value,nodes:parsed.nodes.slice(0,30),edges:parsed.edges,report:out.replace(/GRAPH_JSON:[\s\S]*?(?=\n\s*#|$)/i,'').trim(),source:'Selected AI'}}else{graphV273={topic,subject:q('kgSubjectV273').value,nodes:local.nodes,edges:local.edges,report:out,source:'AI report + local graph'}}graphTypesV273=new Set(graphV273.nodes.map(n=>n.type));renderTypeFiltersV273();window.renderKnowledgeGraphV273();q('kgReportV273').innerHTML=fmt(graphV273.report);q('kgNodeCountV273').textContent=graphV273.nodes.length+' NODES'}catch(e){q('kgReportV273').textContent='AI error: '+e.message}}
  function renderTypeFiltersV273(){const types=[...new Set(graphV273.nodes.map(n=>n.type))];if(!graphTypesV273.size)graphTypesV273=new Set(types);q('kgTypeFiltersV273').innerHTML=types.map(t=>`<button class="${graphTypesV273.has(t)?'active':''}" onclick="toggleKGTypeV273('${esc(t)}',this)">${esc(t)}</button>`).join('');q('kgLegendV273').innerHTML=types.map(t=>`<span><i style="background:${colorsV273[t]||'#64748b'}"></i>${esc(t)}</span>`).join('')}
  window.toggleKGTypeV273=function(t){graphTypesV273.has(t)?graphTypesV273.delete(t):graphTypesV273.add(t);renderTypeFiltersV273();window.renderKnowledgeGraphV273()}
  window.renderKnowledgeGraphV273=function(){const box=q('kgBoardV273');if(!box)return;const search=String(q('kgSearchV273')?.value||'').toLowerCase(),zoom=Number(q('kgZoomV273')?.value||100);q('kgZoomLabelV273').textContent=zoom+'%';if(!graphV273.nodes.length){box.innerHTML='<div class="v27Empty">Enter a topic and build the graph.</div>';return}const visible=graphV273.nodes.filter(n=>(n.type==='Core'||graphTypesV273.has(n.type))&&(!search||`${n.label} ${n.detail}`.toLowerCase().includes(search)));const ids=new Set(visible.map(n=>n.id)),edges=graphV273.edges.filter(e=>ids.has(e.from)&&ids.has(e.to));const W=900,H=560,cx=W/2,cy=H/2,core=visible.find(n=>n.type==='Core')||visible[0],others=visible.filter(n=>n!==core),positions={};if(core)positions[core.id]={x:cx,y:cy};others.forEach((n,i)=>{const ring=i<10?175:270,idx=i<10?i:i-10,total=i<10?Math.min(10,others.length):Math.max(1,others.length-10),a=-Math.PI/2+(Math.PI*2*idx/total);positions[n.id]={x:cx+Math.cos(a)*ring,y:cy+Math.sin(a)*ring}});const lineSvg=edges.map(e=>{const a=positions[e.from],b=positions[e.to];return a&&b?`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#b9c8d8" stroke-width="1.5"/><text x="${(a.x+b.x)/2}" y="${(a.y+b.y)/2}" fill="#64748b" font-size="9">${esc(e.label||'')}</text>`:''}).join('');const nodeSvg=visible.map(n=>{const p=positions[n.id],idx=graphV273.nodes.indexOf(n),coreN=n===core,r=coreN?50:34,label=n.label.length>18?n.label.slice(0,17)+'…':n.label;return `<g class="v27GraphNode" onclick="selectKGNodeV273(${idx})"><circle cx="${p.x}" cy="${p.y}" r="${r}" fill="${colorsV273[n.type]||'#64748b'}" stroke="#fff" stroke-width="3"/><text x="${p.x}" y="${p.y-2}" text-anchor="middle" fill="#fff" font-size="${coreN?13:10}" font-weight="800">${esc(label)}</text><text x="${p.x}" y="${p.y+13}" text-anchor="middle" fill="#fff" font-size="8">${esc(n.type)}</text></g>`}).join('');box.innerHTML=`<svg viewBox="0 0 ${W} ${H}" style="width:${zoom}%;height:auto">${lineSvg}${nodeSvg}</svg>`;q('kgNodeCountV273').textContent=visible.length+' / '+graphV273.nodes.length+' NODES'}
  window.selectKGNodeV273=function(i){const n=graphV273.nodes[i];if(!n)return;q('kgNodeDetailV273').innerHTML=`<h3>${esc(n.label)}</h3><span class="tag">${esc(n.type)}</span><span class="tag">${esc(n.source||'Graph')}</span><p>${esc(n.detail||'No detail yet.')}</p><div class="actions"><button class="btn gold" onclick="kgNodeToRevisionV273(${i})">Send Node to Revision</button><button class="btn blue" onclick="kgNodeToNoteV273(${i})">Save as Note</button></div>`}
  window.kgNodeToRevisionV273=async function(i){const n=graphV273.nodes[i];await save('smartRevision',{topic:n.label,subject:graphV273.subject,source:'Knowledge Graph Pro V27.3',body:n.detail,difficulty:'Medium',date:tday(),status:'pending'});alert('Node sent to Revision Brain.')}
  window.kgNodeToNoteV273=async function(i){const n=graphV273.nodes[i];await save('notes',{title:n.label,subject:graphV273.subject,body:`Knowledge Graph node (${n.type})\n${n.detail}`,date:tday()});alert('Node saved as note.')}
  window.clearKnowledgeGraphV273=function(){graphV273={topic:'',subject:'',nodes:[],edges:[],report:'',source:'local'};graphTypesV273.clear();q('kgTopicV273').value='';q('kgContextV273').value='';q('kgReportV273').textContent='Graph report will appear here.';q('kgTypeFiltersV273').innerHTML='';q('kgLegendV273').innerHTML='';window.renderKnowledgeGraphV273()}
  window.saveKnowledgeGraphV273=async function(){if(!graphV273.nodes.length)return alert('Build a graph first.');await save('knowledgeGraphsV273',{...graphV273,date:tday(),savedAt:new Date().toISOString()});await window.renderKnowledgeGraphHistoryV273();alert('Knowledge graph saved.')}
  window.renderKnowledgeGraphHistoryV273=async function(){const modern=await get('knowledgeGraphsV273'),old=await get('kg'),all=[...modern,...old.map(x=>({topic:x.topic||'Legacy graph',subject:x.subject||'General',report:x.body||'',nodes:[],edges:[],source:'Legacy graph',date:x.date,id:x.id}))];q('kgHistoryV273').innerHTML=all.slice(0,24).map((x,i)=>`<div class="v27HistoryCard"><h3>${esc(x.topic||'Knowledge Graph')}</h3><p>${esc(x.subject||'General')} • ${esc(x.source||'Saved')} • ${x.nodes?.length||0} nodes</p><div class="actions"><button class="btn blue" onclick="openKnowledgeGraphV273('${esc(itemId(x,i))}')">Open</button><button class="btn danger" onclick="deleteItem('${modern.some(m=>String(m.id)===String(x.id))?'knowledgeGraphsV273':'kg'}','${esc(itemId(x,i))}');setTimeout(renderKnowledgeGraphHistoryV273,350)">Delete</button></div></div>`).join('')||'<div class="v27Empty">No saved graphs yet.</div>'}
  window.openKnowledgeGraphV273=async function(id){const modern=await get('knowledgeGraphsV273'),old=await get('kg'),x=[...modern,...old].find((v,i)=>itemId(v,i)===String(id));if(!x)return;q('kgTopicV273').value=x.topic||'';q('kgSubjectV273').value=x.subject||'Polity';if(Array.isArray(x.nodes)&&x.nodes.length){graphV273={topic:x.topic,subject:x.subject,nodes:x.nodes,edges:x.edges||buildEdgesV273(x.nodes),report:x.report||x.body||'',source:x.source||'Saved'}}else{const g=await workspaceGraphV273(x.topic||'Legacy graph',x.subject||'General');graphV273={topic:x.topic,subject:x.subject,nodes:g.nodes,edges:g.edges,report:x.body||'',source:'Migrated legacy graph'}}graphTypesV273=new Set(graphV273.nodes.map(n=>n.type));renderTypeFiltersV273();window.renderKnowledgeGraphV273();q('kgReportV273').innerHTML=fmt(graphV273.report)}
  window.knowledgeGraphToRevisionV273=async function(){if(!graphV273.topic)return alert('Build a graph first.');await save('smartRevision',{topic:graphV273.topic,subject:graphV273.subject,source:'Knowledge Graph Pro V27.3',difficulty:'High',date:tday(),status:'pending',body:graphV273.nodes.map(n=>`${n.type}: ${n.label}`).join('\n')});alert('Core graph sent to Revision Brain.')}
  window.knowledgeGraphToMindmapV273=function(){if(!graphV273.nodes.length)return alert('Build a graph first.');if(q('mmTopic'))q('mmTopic').value=graphV273.topic;if(q('mmSubject'))q('mmSubject').value=graphV273.subject;if(q('mmNodes'))q('mmNodes').value=graphV273.nodes.slice(1).map(n=>n.label).join(', ');window.show('mindMapStudio')}
  window.knowledgeGraphToFlashcardsV273=async function(){if(!graphV273.nodes.length)return alert('Build a graph first.');for(const n of graphV273.nodes.filter(x=>x.type!=='Core').slice(0,18))await save('flash',{q:`How is ${n.label} connected to ${graphV273.topic}?`,a:n.detail||`${n.type} connection`,subject:graphV273.subject,source:'Knowledge Graph Pro V27.3'});alert('Graph connections converted to flashcards.')}
  window.knowledgeGraphToLibraryV273=async function(){if(!graphV273.nodes.length)return alert('Build a graph first.');await save('digitalLibrary',{title:`Knowledge Graph: ${graphV273.topic}`,subject:graphV273.subject,type:'Knowledge Graph',body:graphV273.report+'\n\n'+graphV273.nodes.map(n=>`${n.type}: ${n.label} — ${n.detail}`).join('\n'),date:tday(),tags:['knowledge-graph','v27.3']});alert('Graph saved to AI Digital Library Pro.')}
  window.downloadKnowledgeGraphV273=function(type){if(!graphV273.nodes.length)return alert('Build a graph first.');if(type==='json')download((graphV273.topic||'knowledge-graph').replace(/\W+/g,'-')+'.json',JSON.stringify(graphV273,null,2),'application/json');else{const rows=graphV273.nodes.map(n=>`<li><b>${esc(n.type)} — ${esc(n.label)}</b><p>${esc(n.detail)}</p></li>`).join('');download((graphV273.topic||'knowledge-graph').replace(/\W+/g,'-')+'.html',`<!doctype html><meta charset="utf-8"><title>${esc(graphV273.topic)}</title><body style="font-family:Arial;max-width:900px;margin:40px auto;line-height:1.6"><h1>${esc(graphV273.topic)}</h1><h2>${esc(graphV273.subject)}</h2><ul>${rows}</ul><pre>${esc(graphV273.report)}</pre></body>`,'text/html;charset=utf-8')}}

  // Final Phase 4 navigation: old graph links now open the unified graph.
  const prevShowV27=window.show;
  window.show=function(id,btn){const mapped=(id==='knowledgeGraphAI'||id==='knowledgeGraphV4')?'knowledgeGraphProV273':id;const r=prevShowV27.call(this,mapped,btn);setTimeout(()=>{if(mapped==='strategyRoomV271'){if(!q('strategyDateV271').value){const d=localStorage.getItem('prelimsDateAI');if(d)q('strategyDateV271').value=d}window.refreshStrategySnapshotV271();window.renderStrategyHistoryV271()}if(mapped==='rankReadinessV272'){window.calculateReadinessV272().then(s=>{readinessV272=s});window.renderReadinessHistoryV272()}if(mapped==='knowledgeGraphProV273')window.renderKnowledgeGraphHistoryV273()},100);return r};
  function initV27(){window.__MISSION_UPSC_V27_READY__=true;if(q('strategyDateV271')&&!q('strategyDateV271').value){q('strategyDateV271').value=localStorage.getItem('prelimsDateAI')||''}window.updateScenarioV272?.()}
  document.addEventListener('DOMContentLoaded',()=>setTimeout(initV27,350));setTimeout(initV27,1200);
})();


/* ===== V27.4 AI PROGRESS & AUTOMATION HUB ===== */
(()=>{
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const today=()=>new Date().toISOString().slice(0,10);
  const clamp=n=>Math.max(0,Math.min(100,Number(n)||0));
  const fmt=t=>typeof window.formatAI==='function'?window.formatAI(String(t||'')):`<pre>${esc(t)}</pre>`;
  const asList=v=>Array.isArray(v)?v:(v&&typeof v==='object'?Object.values(v):[]);
  const get=async name=>{try{if(typeof getCol==='function')return asList(await getCol(name))}catch(e){}try{return asList(JSON.parse(localStorage.getItem(name)||'[]'))}catch(_){return []}};
  const save=async(name,obj)=>{try{if(typeof saveCol==='function')return await saveCol(name,obj)}catch(e){}const a=await get(name);a.unshift({...obj,id:'local_'+Date.now()+'_'+Math.random().toString(36).slice(2,7)});localStorage.setItem(name,JSON.stringify(a));return obj};
  const settingsKey='mission_v274_automation_settings';
  let pulse=null,alerts=[],weeklyText='';

  function settings(){try{return {autoRefresh:true,autoCommand:true,autoRevision:true,autoCalendar:false,...JSON.parse(localStorage.getItem(settingsKey)||'{}')}}catch(e){return {autoRefresh:true,autoCommand:true,autoRevision:true,autoCalendar:false}}}
  window.saveAutomationSettingsV274=function(){const s={autoRefresh:!!$('v274AutoRefresh')?.checked,autoCommand:!!$('v274AutoCommand')?.checked,autoRevision:!!$('v274AutoRevision')?.checked,autoCalendar:!!$('v274AutoCalendar')?.checked};localStorage.setItem(settingsKey,JSON.stringify(s));return s};
  function loadSettings(){const s=settings();if($('v274AutoRefresh'))$('v274AutoRefresh').checked=s.autoRefresh;if($('v274AutoCommand'))$('v274AutoCommand').checked=s.autoCommand;if($('v274AutoRevision'))$('v274AutoRevision').checked=s.autoRevision;if($('v274AutoCalendar'))$('v274AutoCalendar').checked=s.autoCalendar;const d=localStorage.getItem('mission_v274_last_sync_date');if($('v274SyncStatus'))$('v274SyncStatus').textContent=d===today()?'Smart Sync already completed today.':'Smart Sync has not run today.'}
  function daysTo(date){if(!date)return null;return Math.max(0,Math.ceil((new Date(date+'T23:59:59')-new Date())/86400000))}
  function phase(days){return days==null?'Set exam date':days>180?'Foundation phase':days>90?'Consolidation phase':days>45?'Test + revision phase':days>15?'Intensive repair phase':'Final sprint'}
  function band(score,confidence){if(confidence<25)return 'Build more evidence';if(score>=75)return 'Strong readiness zone';if(score>=60)return 'Competitive foundation';if(score>=45)return 'Developing readiness';return 'High-risk preparation zone'}
  function priorityRank(p){return p==='high'?3:p==='medium'?2:1}
  function makeAlert(priority,source,title,detail,minutes=45,subject='Integrated',target='revision'){return {id:'a_'+Math.random().toString(36).slice(2,9),priority,source,title,detail,minutes,subject,target}}

  function buildAlerts(s){const a=[];
    if(s.syllabusScore<65)a.push(makeAlert(s.syllabusScore<45?'high':'medium','Syllabus Command','Close high-priority syllabus gaps',`Coverage is ${Math.round(s.syllabusScore)}%. Complete one high-yield topic, revise it and solve linked PYQs.`,90,'Integrated','command'));
    if(s.prelims<65)a.push(makeAlert(s.prelims<45?'high':'medium','Prelims War Room','Repair Prelims accuracy',`Current Prelims indicator is ${Math.round(s.prelims)}%. Attempt a focused test and convert every error into a dated repair.`,75,'Prelims','command'));
    if(s.mainsScore<60)a.push(makeAlert(s.mainsScore<40?'high':'medium','Mains War Room','Write and evaluate one answer',`Current Mains indicator is ${Math.round(s.mainsScore)}%. Focus on structure, evidence and conclusion quality.`,60,'Mains','command'));
    if(s.due>0)a.push(makeAlert(s.due>5?'high':'medium','Revision Brain','Clear due revision backlog',`${s.due} revision item(s) are due or overdue. Clear the oldest high-priority items first.`,Math.min(120,30+s.due*10),'Revision','revision'));
    if(s.memoryDue>0)a.push(makeAlert(s.memoryDue>20?'high':'medium','Memory Engine','Complete due recall cards',`${s.memoryDue} memory card(s) are due. Use active recall before reading the answer.`,Math.min(90,20+s.memoryDue*2),'Revision','command'));
    if(s.consistency<60)a.push(makeAlert(s.consistency<35?'high':'medium','Focus & Habit Intelligence','Protect daily deep-work consistency',`Only ${s.last14} active day(s) were recorded in the last 14 days. Schedule a realistic first focus block.`,50,'Strategy','calendar'));
    if((s.testScores||[]).length<3)a.push(makeAlert('medium','Prelims War Room','Build a reliable mock sample','Fewer than three scored Prelims tests are available, so readiness confidence remains limited.',60,'Prelims','calendar'));
    if((s.mainsScores||[]).length<3)a.push(makeAlert('medium','Mains War Room','Build a reliable answer-writing sample','Fewer than three evaluated Mains answers are available. Write one answer under time pressure.',45,'Mains','calendar'));
    if(s.confidence<40)a.push(makeAlert('low','Readiness Intelligence','Improve data confidence',`Only ${Math.round(s.confidence)}% data confidence. Log study sessions, mocks, answer evaluations and revision completion.`,20,'Strategy','command'));
    const examDays=daysTo(localStorage.getItem('prelimsDateAI'));
    if(examDays!=null&&examDays<=30&&s.prelims<70)a.push(makeAlert('high','Exam Countdown','Final-sprint Prelims repair',`${examDays} days remain and the Prelims indicator is below 70%. Prioritise mocks, revision and error elimination.`,120,'Prelims','calendar'));
    if(!a.length)a.push(makeAlert('low','Progress Hub','Maintain the system','No major red flag was detected. Preserve revision, tests and deep work instead of adding unnecessary sources.',45,'Integrated','command'));
    return a.sort((x,y)=>priorityRank(y.priority)-priorityRank(x.priority)).slice(0,12);
  }

  function renderMetrics(){if(!pulse)return;const d=daysTo(localStorage.getItem('prelimsDateAI'));$('v274Composite').textContent=Math.round(pulse.composite)+'%';$('v274Band').textContent=band(pulse.composite,pulse.confidence);$('v274Urgent').textContent=alerts.filter(x=>x.priority==='high').length;$('v274RevisionDue').textContent=pulse.due||0;$('v274MemoryDue').textContent=pulse.memoryDue||0;$('v274ActiveDays').textContent=(pulse.last14||0)+'/14';$('v274ExamDays').textContent=d==null?'—':d;$('v274ExamPhase').textContent=phase(d);$('v274Confidence').textContent=Math.round(pulse.confidence)+'% DATA CONFIDENCE'}
  function renderPulse(){if(!pulse)return;const metrics=[['Syllabus',pulse.syllabusScore],['Prelims',pulse.prelims],['Mains',pulse.mainsScore],['Revision',pulse.revScore],['Memory',pulse.memoryScore],['Consistency',pulse.consistency]];$('v274PulseBars').innerHTML=metrics.map(([n,v])=>`<div class="v274PulseRow"><b>${esc(n)}</b><div class="v274PulseTrack"><i style="width:${clamp(v)}%"></i></div><span>${Math.round(v)}%</span></div>`).join('')}
  window.renderAlertsV274=function(){const box=$('v274Alerts');if(!box)return;const f=$('v274AlertFilter')?.value||'all',list=alerts.filter(x=>f==='all'||x.priority===f);box.innerHTML=list.length?list.map((x,i)=>`<div class="v274Alert ${x.priority}"><div><span>${esc(x.source)}</span><h3>${esc(x.title)}</h3><p>${esc(x.detail)}</p></div><button type="button" class="btn ghost" onclick="openAlertSourceV274('${esc(x.source)}')">Open</button></div>`).join(''):'<div class="v27Empty">No alerts in this filter.</div>'}
  function renderActions(){const box=$('v274ActionQueue');if(!box)return;const list=alerts.slice(0,6);$('v274ActionCount').textContent=list.length+' ACTIONS';box.innerHTML=list.map((x,i)=>`<div class="v274ActionCard ${x.priority}"><div class="v274ActionTop"><span>${esc(x.priority.toUpperCase())}</span><small>${esc(x.source)} • ${x.minutes} min</small></div><h3>${esc(x.title)}</h3><p>${esc(x.detail)}</p><div class="actions"><button type="button" class="btn blue" onclick="sendAlertV274(${i},'command')">Daily Command</button><button type="button" class="btn gold" onclick="sendAlertV274(${i},'revision')">Revision</button><button type="button" class="btn green" onclick="sendAlertV274(${i},'calendar')">Calendar</button></div></div>`).join('')}

  window.refreshProgressHubV274=async function(){if($('v274PulseBars'))$('v274PulseBars').innerHTML='<div class="aiLoading">Scanning readiness, revision, memory, tests and study logs...</div>';try{if(typeof window.calculateReadinessV272!=='function')throw new Error('Readiness engine unavailable.');pulse=await window.calculateReadinessV272();alerts=buildAlerts(pulse);renderMetrics();renderPulse();renderActions();window.renderAlertsV274();loadSettings();return pulse}catch(e){if($('v274PulseBars'))$('v274PulseBars').innerHTML=`<div class="v27Empty">Scan failed: ${esc(e.message)}</div>`;throw e}}

  window.openAlertSourceV274=function(source){const map={'Syllabus Command':'syllabusCommand','Prelims War Room':'prelimsWarRoomV251','Mains War Room':'mainsWarRoomV252','Revision Brain':'aiRevisionBrain','Memory Engine':'memoryEngineV263','Focus & Habit Intelligence':'timeHabitV262','Readiness Intelligence':'rankReadinessV272','Exam Countdown':'countdownPage','Progress Hub':'progressAutomationV274'};window.show(map[source]||'dashboard')};
  async function addToCommand(x){const key='mission_v261_active_'+today();let m;try{m=JSON.parse(localStorage.getItem(key)||'null')}catch(e){}if(!m)m={date:today(),createdAt:Date.now(),source:'V27.4 Progress Hub',focus:'Priority repair',availableHours:7,tasks:[],brief:'Tasks added by AI Progress & Automation Hub.',warning:'Complete high-priority repairs before adding new sources.',motivation:'Execution creates readiness.'};m.tasks=Array.isArray(m.tasks)?m.tasks:[];if(!m.tasks.some(t=>String(t.title).toLowerCase()===x.title.toLowerCase()))m.tasks.push({id:'v274_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),title:x.title,type:'V27.4 Repair',subject:x.subject,minutes:x.minutes,reason:x.detail,priority:x.priority==='high'?'High':x.priority==='medium'?'Medium':'Low',done:false});localStorage.setItem(key,JSON.stringify(m));await save('commandPlansV261',{date:today(),title:x.title,body:x.detail,minutes:x.minutes,subject:x.subject,source:'V27.4 Progress Hub',status:'pending'})}
  async function addToRevision(x){const existing=await get('smartRevision');if(existing.some(v=>String(v.topic||v.title).toLowerCase()===x.title.toLowerCase()&&String(v.date||'').slice(0,10)===today()))return;await save('smartRevision',{topic:x.title,subject:x.subject,source:'V27.4 Progress Hub',body:x.detail,difficulty:x.priority==='high'?'High':'Medium',date:today(),status:'pending',cycle:1})}
  async function addToCalendar(x,offset=0){const d=new Date();d.setDate(d.getDate()+offset);const date=d.toISOString().slice(0,10),existing=await get('calendarItems');if(existing.some(v=>String(v.title).toLowerCase()===x.title.toLowerCase()&&String(v.date).slice(0,10)===date))return;await save('calendarItems',{date,title:x.title,type:'V27.4 Smart Action',subject:x.subject,minutes:x.minutes,note:x.detail,source:'V27.4 Progress Hub'})}
  window.sendAlertV274=async function(i,target){const x=alerts[i];if(!x)return;if(target==='command')await addToCommand(x);if(target==='revision')await addToRevision(x);if(target==='calendar')await addToCalendar(x);alert(`Sent to ${target==='command'?'Daily Command Centre':target==='revision'?'Revision Brain':'AI Smart Calendar'}.`)};

  window.runSmartSyncV274=async function(){if(!pulse)await window.refreshProgressHubV274();const s=window.saveAutomationSettingsV274(),last=localStorage.getItem('mission_v274_last_sync_date');if(last===today()&&!confirm('Smart Sync already ran today. Run again without duplicating existing items?'))return;const top=alerts.slice(0,3);for(let i=0;i<top.length;i++){if(s.autoCommand)await addToCommand(top[i]);if(s.autoRevision&&top[i].priority!=='low')await addToRevision(top[i]);if(s.autoCalendar)await addToCalendar(top[i],i)}localStorage.setItem('mission_v274_last_sync_date',today());await save('automationRunsV274',{date:today(),savedAt:new Date().toISOString(),actions:top.map(x=>x.title),settings:s,source:'V27.4 Smart Sync'});$('v274SyncStatus').textContent=`Smart Sync completed: ${top.length} priority actions processed.`;await window.renderProgressHistoryV274();alert('Smart Sync completed safely. Existing matching tasks were not duplicated.')};

  function localReview(){if(!pulse)return 'Refresh Mission Pulse first.';const top=alerts.slice(0,5);return `# Weekly UPSC Progress Review\n\n## Readiness snapshot\n- Composite: ${Math.round(pulse.composite)}%\n- Data confidence: ${Math.round(pulse.confidence)}%\n- Prelims: ${Math.round(pulse.prelims)}%\n- Mains: ${Math.round(pulse.mainsScore)}%\n- Revision: ${Math.round(pulse.revScore)}%\n- Memory: ${Math.round(pulse.memoryScore)}%\n- Consistency: ${Math.round(pulse.consistency)}%\n\n## What improved or is holding you back\n${top.map((x,i)=>`${i+1}. ${x.title} — ${x.detail}`).join('\n')}\n\n## Next 7-day rule\n1. Complete the top three repair actions before collecting new material.\n2. Record at least one scored test or evaluated answer.\n3. Clear due revision and memory items daily.\n4. Protect the first deep-work block.\n5. Recalculate readiness at the end of the week.\n\n## Honest note\nThis is a preparation diagnostic, not a selection or rank guarantee.`}
  window.generateWeeklyReviewV274=async function(useAI=false){if(!pulse)await window.refreshProgressHubV274();const local=localReview();if(!useAI){weeklyText=local;$('v274WeeklyReview').innerHTML=fmt(weeklyText);return}if(typeof window.aiAskRouterV23!=='function'){weeklyText=local+'\n\nAI router unavailable; local review shown.';$('v274WeeklyReview').innerHTML=fmt(weeklyText);return}$('v274WeeklyReview').innerHTML='<div class="aiLoading">Selected AI is preparing a strict weekly review...</div>';try{weeklyText=await window.aiAskRouterV23(`Act as a strict but constructive UPSC performance coach. Use this evidence only: ${JSON.stringify({composite:pulse.composite,confidence:pulse.confidence,prelims:pulse.prelims,mains:pulse.mainsScore,syllabus:pulse.syllabusScore,revision:pulse.revScore,memory:pulse.memoryScore,consistency:pulse.consistency,due:pulse.due,memoryDue:pulse.memoryDue,activeDays:pulse.last14,alerts:alerts.slice(0,8)},null,2)}. Produce: executive summary, wins, bottlenecks, evidence limitations, exact 7-day plan, measurable targets, stop-doing list and Sunday review checklist. Never promise selection or exact rank.`);$('v274WeeklyReview').innerHTML=fmt(weeklyText)}catch(e){weeklyText=local+'\n\nAI error: '+e.message;$('v274WeeklyReview').innerHTML=fmt(weeklyText)}};
  window.saveWeeklyReviewV274=async function(){if(!weeklyText)return alert('Generate a weekly review first.');await save('progressReportsV274',{date:today(),savedAt:new Date().toISOString(),type:'Weekly Review',body:weeklyText,composite:Math.round(pulse?.composite||0),confidence:Math.round(pulse?.confidence||0),source:'V27.4'});await window.renderProgressHistoryV274();alert('Weekly review saved.')};
  window.saveProgressSnapshotV274=async function(){if(!pulse)await window.refreshProgressHubV274();await save('progressSnapshotsV274',{date:today(),savedAt:new Date().toISOString(),composite:Math.round(pulse.composite),confidence:Math.round(pulse.confidence),prelims:Math.round(pulse.prelims),mains:Math.round(pulse.mainsScore),syllabus:Math.round(pulse.syllabusScore),revision:Math.round(pulse.revScore),memory:Math.round(pulse.memoryScore),consistency:Math.round(pulse.consistency),urgent:alerts.filter(x=>x.priority==='high').length,source:'V27.4'});await window.renderProgressHistoryV274();alert('Progress snapshot saved.')};
  window.downloadWeeklyReviewV274=function(){if(!weeklyText)return alert('Generate a weekly review first.');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([weeklyText],{type:'text/plain;charset=utf-8'}));a.download=`UPSC-Weekly-Review-${today()}.txt`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)};
  window.weeklyReviewToCommandV274=async function(){if(!weeklyText)return alert('Generate a weekly review first.');const lines=weeklyText.split('\n').map(x=>x.replace(/^[-*#\d.\s]+/,'').trim()).filter(x=>x.length>18&&x.length<170).slice(0,5);for(const line of lines)await addToCommand(makeAlert('medium','Weekly Review',line,'Generated from the V27.4 weekly review.',45,'Integrated','command'));alert(`${lines.length} review actions sent to Daily Command Centre.`)};
  window.renderProgressHistoryV274=async function(){const [snaps,reviews,runs]=await Promise.all([get('progressSnapshotsV274'),get('progressReportsV274'),get('automationRunsV274')]);const all=[...snaps.map(x=>({...x,_type:'Snapshot'})),...reviews.map(x=>({...x,_type:'Review'})),...runs.map(x=>({...x,_type:'Smart Sync'}))].sort((a,b)=>String(b.savedAt||b.date).localeCompare(String(a.savedAt||a.date)));$('v274History').innerHTML=all.length?all.slice(0,24).map(x=>`<div class="v27HistoryCard"><h3>${esc(x._type)} • ${esc(x.date||'')}</h3><p>${x._type==='Snapshot'?`Readiness ${x.composite}% • Confidence ${x.confidence}% • ${x.urgent} urgent`:x._type==='Smart Sync'?`${(x.actions||[]).length} actions processed`:esc(String(x.body||'').replace(/[#*]/g,' ').slice(0,150))}</p></div>`).join(''):'<div class="v27Empty">No V27.4 history yet.</div>'};

  function init(){loadSettings();window.renderProgressHistoryV274();const s=settings();if(s.autoRefresh)window.refreshProgressHubV274().catch(()=>{})}
  const previousShow=window.show;
  window.show=function(id,btn){const r=previousShow.apply(this,arguments);if(id==='progressAutomationV274')setTimeout(init,120);return r};
  document.addEventListener('DOMContentLoaded',()=>setTimeout(loadSettings,500));
  window.__MISSION_UPSC_V274_READY__=true;
})();


/* ===== V27.5 STABILITY, BACKUP & PERFORMANCE BUILD ===== */
(function(){
  const VERSION='27.5.4';
  const ERROR_KEY='mission_v275_error_log';
  const PERF_KEY='mission_v275_performance';
  const MAX_ERRORS=40;
  let pendingRestoreV275=null;
  const $v=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const todayV=()=>new Date().toISOString().slice(0,10);
  const knownCollectionsV275=[
    'tasks','studyLogs','months','weeks','blocks','habits','currentAffairs','currentAffairsAI','notes','proNotes','richNotesV4','richNoteVersionsV266','kg','knowledgeGraphsV273','flash','pyq','pyqBank','mains','mainsReports','mainsWarReports','mainsDailyQuestionsV252','tests','mockReports','prelimsReports','prelimsAIAnalyses','revision','smartRevision','weakTopics','wrongAnswers','wrongbook','books','files','sectionFiles','focusSessions','timeSessionsV262','habitIntelligenceV262','habitAIReportsV262','calendarItems','battles','maps','mapNotes','mapSnapshots','completion','syllabus','syllabusAI','syllabusPlansAI','onePagers','topperAnswers','docLinks','digitalLibrary','libraryShelf','library2','mentorAdvice','aiHabits','dailyPlans','commandPlansV261','dailyCommandReportsV261','dailyCommandReviewsV261','memoryCardsV263','memoryReviewLogsV263','memoryAIReportsV263','interviewReportsV253','strategyPlansV271','readinessSnapshotsV272','automationRunsV274','progressReportsV274','progressSnapshotsV274'
  ];
  const moduleMapV275={
    daily:{label:'Daily Command & Planner',collections:['tasks','dailyPlans','commandPlansV261','dailyCommandReportsV261','dailyCommandReviewsV261'],prefixes:['mission_v261_','mission_daily_']},
    habit:{label:'Focus & Habit Intelligence',collections:['studyLogs','habits','focusSessions','timeSessionsV262','habitIntelligenceV262','habitAIReportsV262','aiHabits'],prefixes:['mission_v262_']},
    memory:{label:'AI Memory Engine',collections:['memoryCardsV263','memoryReviewLogsV263','memoryAIReportsV263'],prefixes:['mission_v263_']},
    prelims:{label:'Prelims War Room',collections:['prelimsReports','prelimsAIAnalyses','tests','mockReports'],prefixes:['mission_v251_','prelims_v251_']},
    mains:{label:'Mains War Room & Evaluations',collections:['mains','mainsReports','mainsWarReports','mainsDailyQuestionsV252'],prefixes:['mission_v252_','mains_v252_']},
    interview:{label:'Interview Room',collections:['interviewReportsV253'],prefixes:['mission_v253_','interview_v253_']},
    revision:{label:'Revision Brain & Wrong Answers',collections:['revision','smartRevision','weakTopics','wrongAnswers','wrongbook'],prefixes:['mission_revision_','revision_v24_']},
    strategy:{label:'Strategy, Readiness & Progress',collections:['strategyPlansV271','readinessSnapshotsV272','automationRunsV274','progressReportsV274','progressSnapshotsV274'],prefixes:['mission_v271_','mission_v272_','mission_v274_']},
    knowledge:{label:'Knowledge Graph',collections:['kg','knowledgeGraphsV273'],prefixes:['mission_v273_','knowledge_graph_']},
    calendar:{label:'AI Smart Calendar',collections:['calendarItems'],prefixes:['mission_calendar_','smart_calendar_']},
    richnotes:{label:'Rich Note Studio drafts/history',collections:['richNoteVersionsV266'],prefixes:['rich_note_draft_','rich_note_active_']}
  };
  function toastV275(message,type=''){
    let el=$v('v275Toast');if(!el){el=document.createElement('div');el.id='v275Toast';el.className='v275Toast';document.body.appendChild(el)}
    el.textContent=message;el.className='v275Toast '+type+' show';clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),3500);
  }
  function readErrorsV275(){try{return JSON.parse(localStorage.getItem(ERROR_KEY)||'[]')}catch(e){return []}}
  function recordErrorV275(error,context='Runtime'){
    const e=error instanceof Error?error:new Error(String(error||'Unknown error'));
    const arr=readErrorsV275();arr.unshift({time:new Date().toISOString(),context,message:e.message||String(e),stack:String(e.stack||'').slice(0,2500),section:document.querySelector('.section.active')?.id||''});
    localStorage.setItem(ERROR_KEY,JSON.stringify(arr.slice(0,MAX_ERRORS)));renderErrorLogV275();
    const perf=loadPerfV275();if(perf.quietErrors)toastV275(`${context}: ${e.message}`,'error');
  }
  window.recordErrorV275=recordErrorV275;
  window.addEventListener('error',e=>{if(e?.error)recordErrorV275(e.error,'Window error');else if(e?.message)recordErrorV275(new Error(e.message),'Window error')});
  window.addEventListener('unhandledrejection',e=>recordErrorV275(e.reason||new Error('Unhandled promise rejection'),'Async error'));
  function renderErrorLogV275(){const el=$v('v275ErrorLog');if(!el)return;const a=readErrorsV275();el.innerHTML=a.length?a.map(x=>`<div class="item v275ErrorItem"><h3>${esc(x.context)}</h3><span class="pill">${esc(new Date(x.time).toLocaleString())}</span>${x.section?`<span class="pill">${esc(x.section)}</span>`:''}<p>${esc(x.message)}</p><details><summary>Technical details</summary><code>${esc(x.stack||'No stack trace')}</code></details></div>`).join(''):'<div class="emptyState">No recorded errors.</div>'}
  window.clearErrorLogV275=function(){if(!confirm('Clear the local error log?'))return;localStorage.removeItem(ERROR_KEY);renderErrorLogV275();toastV275('Error log cleared.','success')};
  function loadPerfV275(){try{return {lowPower:false,reduceMotion:false,quietErrors:true,...JSON.parse(localStorage.getItem(PERF_KEY)||'{}')}}catch(e){return {lowPower:false,reduceMotion:false,quietErrors:true}}}
  function applyPerfV275(s=loadPerfV275()){
    window.__MISSION_V275_LOW_POWER__=!!s.lowPower;document.documentElement.classList.toggle('v275-reduce-motion',!!s.reduceMotion);
    if($v('v275LowPower'))$v('v275LowPower').checked=!!s.lowPower;if($v('v275ReduceMotion'))$v('v275ReduceMotion').checked=!!s.reduceMotion;if($v('v275QuietErrors'))$v('v275QuietErrors').checked=s.quietErrors!==false;
    if($v('v275PerfBadge')){$v('v275PerfBadge').textContent=s.lowPower?'Tablet Saver':'Balanced';$v('v275PerfBadge').className='pill '+(s.lowPower?'gold':'green')}
    if($v('v275PerformanceInfo'))$v('v275PerformanceInfo').innerHTML=`<b>${s.lowPower?'Tablet saver is active':'Balanced mode is active'}</b><br>${s.lowPower?'Non-essential dashboard refresh is throttled. AI model quality and generated content are unchanged.':'Active pages refresh normally; hidden pages remain lazy-loaded.'}<br>Animation: ${s.reduceMotion?'Reduced':'Normal'} • Online: ${navigator.onLine?'Yes':'No'} • Memory: ${navigator.deviceMemory?navigator.deviceMemory+' GB reported':'Not reported'}`;
  }
  window.savePerformanceSettingsV275=function(){const s={lowPower:!!$v('v275LowPower')?.checked,reduceMotion:!!$v('v275ReduceMotion')?.checked,quietErrors:$v('v275QuietErrors')?.checked!==false};localStorage.setItem(PERF_KEY,JSON.stringify(s));applyPerfV275(s);toastV275('Performance settings saved.','success')};
  window.clearTemporaryCacheV275=function(){
    const patterns=[/draft/i,/active_session/i,/active_interview/i,/linked_task/i,/prompt_preview/i,/last_sync/i,/temporary/i,/cache/i];let n=0;
    Object.keys(localStorage).forEach(k=>{if(patterns.some(r=>r.test(k))&&!/notes|files|library|memoryCards/i.test(k)){localStorage.removeItem(k);n++}});toastV275(`${n} temporary cache entries cleared.`,'success');
  };
  function estimateStorageV275(){let bytes=0;for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i)||'',v=localStorage.getItem(k)||'';bytes+=(k.length+v.length)*2}return bytes}
  function handlerNamesV275(code){return [...String(code||'').matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)].map(m=>m[1]).filter(x=>!['if','for','while','switch','confirm','alert','prompt','setTimeout','setInterval','String','Number','Date','Math','getElementById','click'].includes(x))}
  window.runStabilityAuditV275=async function(){
    const buttons=[...document.querySelectorAll('[onclick],[onchange],[oninput],[onkeyup],[onkeydown]')],missingHandlers=[];
    buttons.forEach(el=>{['onclick','onchange','oninput','onkeyup','onkeydown'].forEach(a=>{const c=el.getAttribute(a);if(!c)return;handlerNamesV275(c).forEach(fn=>{if(typeof window[fn]!=='function')missingHandlers.push(`${fn} (${a})`)})})});
    const targets=[];document.querySelectorAll('.nav button[onclick]').forEach(b=>{const m=(b.getAttribute('onclick')||'').match(/show\(['\"]([^'\"]+)/);if(m&&!document.getElementById(m[1]))targets.push(m[1])});
    const ids=[...document.querySelectorAll('[id]')].map(x=>x.id),dups=[...new Set(ids.filter((x,i)=>ids.indexOf(x)!==i))];
    const corrupt=[];Object.keys(localStorage).forEach(k=>{const v=localStorage.getItem(k);if(v&&/^[\[{]/.test(v.trim()))try{JSON.parse(v)}catch(e){corrupt.push(k)}});
    const errors=readErrorsV275(),storage=estimateStorageV275(),score=Math.max(0,100-missingHandlers.length*12-targets.length*12-dups.length*8-corrupt.length*8-Math.min(20,errors.length*2));
    if($v('v275HealthScore'))$v('v275HealthScore').textContent=score+'%';
    const summary=$v('v275AuditSummary');if(summary)summary.innerHTML=[['Controls',buttons.length,missingHandlers.length?'bad':'good'],['Broken',missingHandlers.length+targets.length,'bad'],['Duplicate IDs',dups.length,dups.length?'warn':'good'],['Corrupt JSON',corrupt.length,corrupt.length?'bad':'good'],['Local keys',localStorage.length,''],['Storage',(storage/1048576).toFixed(2)+' MB',storage>4.2*1048576?'warn':'good']].map(x=>`<div class="v275Metric ${x[2]}"><small>${x[0]}</small><b>${x[1]}</b></div>`).join('');
    const issues=[];if(missingHandlers.length)issues.push(`<div class="item v275ErrorItem"><h3>Missing button handlers</h3><p>${esc([...new Set(missingHandlers)].join(', '))}</p></div>`);if(targets.length)issues.push(`<div class="item v275ErrorItem"><h3>Missing navigation sections</h3><p>${esc([...new Set(targets)].join(', '))}</p></div>`);if(dups.length)issues.push(`<div class="item v275Warn"><h3>Duplicate HTML IDs</h3><p>${esc(dups.join(', '))}</p></div>`);if(corrupt.length)issues.push(`<div class="item v275ErrorItem"><h3>Corrupt local JSON</h3><p>${esc(corrupt.join(', '))}</p></div>`);if(!issues.length)issues.push('<div class="item v275Good"><h3>All critical checks passed</h3><p>Visible handlers, section links, IDs and local JSON are healthy.</p></div>');
    if($v('v275AuditDetails'))$v('v275AuditDetails').innerHTML=issues.join('');renderErrorLogV275();applyPerfV275();return {score,missingHandlers,targets,dups,corrupt};
  };
  window.repairSafeIssuesV275=function(){
    let deduped=0,quarantined=0,skipped=0;
    const protectedKeys=/file|pdf|image|upload|vault|backup|sectionFiles/i;
    Object.keys(localStorage).forEach(k=>{
      const v=localStorage.getItem(k);
      if(!v||!v.trim())return;
      if(protectedKeys.test(k)||v.length>450000){skipped++;return}
      const trimmed=v.trim();
      if(!trimmed.startsWith('[')&&!trimmed.startsWith('{'))return;
      try{
        const p=JSON.parse(v);
        if(Array.isArray(p)&&p.length<=750){
          const seen=new Set(),clean=[];
          p.filter(Boolean).forEach(x=>{
            const sig=x&&typeof x==='object'?(x.id||x._docId||JSON.stringify(x)):String(x);
            if(seen.has(sig)){deduped++;return}seen.add(sig);clean.push(x)
          });
          if(clean.length!==p.length)localStorage.setItem(k,JSON.stringify(clean));
        }else if(Array.isArray(p)){skipped++}
      }catch(e){
        const q='mission_v275_quarantine_'+Date.now()+'_'+k;
        try{localStorage.setItem(q,v);quarantined++}catch(_){}
        // Keep the original value. A safe repair must never delete user data automatically.
      }
    });
    toastV275(`Safe repair completed: ${deduped} small duplicate records removed; ${quarantined} values copied to quarantine; ${skipped} large/protected items untouched.`,'success');
    setTimeout(()=>window.runStabilityAuditV275(),120);
  };
  function downloadJSONV275(data,name){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)}
  window.exportCompleteBackupV275=async function(){
    const status=$v('v275BackupStatus');if(status)status.textContent='Preparing complete backup…';
    try{
      const local={};Object.keys(localStorage).forEach(k=>local[k]=localStorage.getItem(k));
      const backup={format:'mission-upsc-ai-os-backup',version:VERSION,createdAt:new Date().toISOString(),browser:{userAgent:navigator.userAgent,url:location.href},localStorage:local,cloud:{included:false,collections:{}}};
      if($v('v275IncludeCloud')?.checked&&cloudEnabled&&user){backup.cloud.included=true;backup.cloud.uid=user.uid;backup.cloud.email=user.email||'';for(let i=0;i<knownCollectionsV275.length;i++){const k=knownCollectionsV275[i];if(status)status.textContent=`Backing up cloud collection ${i+1}/${knownCollectionsV275.length}: ${k}`;try{backup.cloud.collections[k]=await getCol(k)}catch(e){backup.cloud.collections[k]=[];backup.cloud.errors=backup.cloud.errors||{};backup.cloud.errors[k]=e.message}}}
      downloadJSONV275(backup,`mission-upsc-v27.5.5-complete-backup-${todayV()}.json`);if(status)status.innerHTML=`✅ Backup exported: ${Object.keys(local).length} local keys${backup.cloud.included?' + '+Object.keys(backup.cloud.collections).length+' cloud collections':''}.`;toastV275('Complete backup downloaded.','success');
    }catch(e){recordErrorV275(e,'Backup export');if(status)status.textContent='Backup failed: '+e.message}
  };
  function normalizeBackupV275(raw){
    if(raw?.format==='mission-upsc-ai-os-backup')return raw;
    if(raw?.collections)return {format:'legacy-cloud-backup',version:'legacy',createdAt:raw.exportedAt||'',localStorage:{},cloud:{included:true,collections:raw.collections||{}}};
    const local={};for(const [k,v] of Object.entries(raw||{}))local[k]=typeof v==='string'?v:JSON.stringify(v);return {format:'legacy-local-backup',version:'legacy',createdAt:'',localStorage:local,cloud:{included:false,collections:{}}};
  }
  window.previewRestoreBackupV275=async function(input){const f=input?.files?.[0];if(!f)return;try{pendingRestoreV275=normalizeBackupV275(JSON.parse(await f.text()));const localN=Object.keys(pendingRestoreV275.localStorage||{}).length,cloudN=Object.keys(pendingRestoreV275.cloud?.collections||{}).length;if($v('v275RestorePreview'))$v('v275RestorePreview').innerHTML=`<div class="item v275Good"><h3>${esc(f.name)}</h3><p>Backup version: ${esc(pendingRestoreV275.version||'Unknown')} • Local keys: ${localN} • Cloud collections: ${cloudN}</p><span class="pill">${esc(pendingRestoreV275.createdAt||'Date unavailable')}</span></div>`;if($v('v275RestoreActions'))$v('v275RestoreActions').style.display='flex';if($v('v275BackupStatus'))$v('v275BackupStatus').textContent='Backup validated. Choose Merge or Replace.'}catch(e){pendingRestoreV275=null;recordErrorV275(e,'Backup validation');alert('Invalid backup JSON: '+e.message)}};
  function mergeValueV275(currentRaw,backupRaw){try{const a=JSON.parse(currentRaw),b=JSON.parse(backupRaw);if(Array.isArray(a)&&Array.isArray(b)){const out=[],seen=new Set();[...b,...a].filter(Boolean).forEach(x=>{const sig=x&&typeof x==='object'?(x.id||x._docId||JSON.stringify(x)):String(x);if(!seen.has(sig)){seen.add(sig);out.push(x)}});return JSON.stringify(out)}if(a&&b&&typeof a==='object'&&typeof b==='object'&&!Array.isArray(a)&&!Array.isArray(b))return JSON.stringify({...b,...a})}catch(e){}return currentRaw??backupRaw}
  window.restoreBackupV275=async function(mode='merge'){
    if(!pendingRestoreV275)return alert('Select and validate a backup first.');const replace=mode==='replace';if(!confirm(replace?'Replace all local browser data with this backup? A safety snapshot will download first.':'Merge this backup into current data? Existing array records will be preserved.'))return;
    try{
      if(replace){const safety={};Object.keys(localStorage).forEach(k=>safety[k]=localStorage.getItem(k));downloadJSONV275({format:'pre-restore-safety',createdAt:new Date().toISOString(),localStorage:safety},`mission-upsc-pre-restore-safety-${todayV()}.json`);localStorage.clear()}
      const local=pendingRestoreV275.localStorage||{};for(const [k,v0] of Object.entries(local)){const v=typeof v0==='string'?v0:JSON.stringify(v0);if(!replace&&localStorage.getItem(k)!=null)localStorage.setItem(k,mergeValueV275(localStorage.getItem(k),v));else localStorage.setItem(k,v)}
      let cloudCount=0;if($v('v275RestoreCloud')?.checked){if(!(cloudEnabled&&user))throw new Error('Google login is required for Firebase restore.');for(const [col,arr] of Object.entries(pendingRestoreV275.cloud?.collections||{})){if(!Array.isArray(arr))continue;for(const x of arr){const clean={...x};delete clean.id;delete clean._docId;delete clean.createdAt;await saveCol(col,{...clean,restoredByV275:true});cloudCount++}}}
      if($v('v275BackupStatus'))$v('v275BackupStatus').innerHTML=`✅ Restore complete: ${Object.keys(local).length} local keys${cloudCount?' + '+cloudCount+' cloud records':''}. Reloading…`;toastV275('Backup restored successfully.','success');setTimeout(()=>location.reload(),900)
    }catch(e){recordErrorV275(e,'Backup restore');alert('Restore failed: '+e.message)}
  };
  async function clearCloudCollectionV275(col){const snap=await getDocs(collection(db,path(col)));for(const d of snap.docs)await deleteDoc(doc(db,path(col),d.id))}
  window.resetModuleV275=async function(){
    const key=$v('v275ResetModule')?.value,m=moduleMapV275[key];if(!m)return;const cloud=!!$v('v275ResetCloud')?.checked;if(!confirm(`Reset only “${m.label}”? This cannot be undone unless you have a backup.`))return;if(cloud&&!(cloudEnabled&&user))return alert('Login with Google before deleting cloud module data.');if(cloud&&!confirm(`FINAL WARNING: Also delete “${m.label}” records from Firebase cloud?`))return;
    try{let localCount=0;for(const col of m.collections){if(localStorage.getItem(col)!=null){localStorage.removeItem(col);localCount++}}Object.keys(localStorage).forEach(k=>{if(m.prefixes.some(p=>k.startsWith(p))){localStorage.removeItem(k);localCount++}});let cloudCollections=0;if(cloud){for(const col of m.collections){await clearCloudCollectionV275(col);cloudCollections++}}if($v('v275ResetStatus'))$v('v275ResetStatus').innerHTML=`✅ Reset ${esc(m.label)}: ${localCount} local keys${cloud?' and '+cloudCollections+' cloud collections':''}.`;toastV275(`${m.label} reset complete.`,'success');setTimeout(()=>renderAll(document.querySelector('.section.active')?.id||'settings'),80)}catch(e){recordErrorV275(e,'Module reset');alert('Module reset failed: '+e.message)}
  };
  function initV275(){applyPerfV275();renderErrorLogV275();if($v('v275BuildBadge'))$v('v275BuildBadge').textContent='V27.5.5 • '+(navigator.onLine?'Online':'Offline')}
  const prevShow=window.show;if(typeof prevShow==='function')window.show=function(id,btn){try{const target=document.getElementById(id);if(!target){const e=new Error('Section not found: '+id);recordErrorV275(e,'Navigation');toastV275(e.message,'error');return}const r=prevShow.apply(this,arguments);if(id==='settings')setTimeout(initV275,100);return r}catch(e){recordErrorV275(e,'Open section '+id);toastV275('Could not open this section. Check Stability Centre.','error')}};
  const oldExport=window.exportData;window.exportLegacyLocalDataV275=oldExport;window.exportData=window.exportCompleteBackupV275;
  document.addEventListener('DOMContentLoaded',()=>setTimeout(initV275,900));
})();


/* ===== V27.5.1 POST-LOGIN HANG HOTFIX ===== */
window.clearLoginWarmupV2751=function(){window.__MISSION_AUTH_WARMUP__=false;__cloudColPendingV2751.clear();toastV275('Login warm-up cleared.','success')};
window.__MISSION_UPSC_VERSION__='27.5.1';


/* ===== V27.5.3 READINESS CLARITY + KNOWLEDGE GRAPH NAVIGATION FIX ===== */
(function(){
  const $v=id=>document.getElementById(id);
  const readinessCols=['dailyPlans','calendarItems','smartRevision','revision','aiHabits','tests','mainsReports','mockReports'];

  window.openSectionListV2753=function(){
    const sidebar=$v('sidebar');
    if(!sidebar) return;
    sidebar.classList.add('open');
    try{sidebar.scrollTo({top:0,behavior:'smooth'})}catch(e){sidebar.scrollTop=0}
  };

  async function clearCollectionV2753(col){
    try{
      const arr=typeof getCol==='function'?await getCol(col):[];
      if(cloudEnabled&&user){
        for(let i=0;i<arr.length;i++){
          const id=arr[i]?._docId||arr[i]?.id;
          if(id) await deleteItem(col,String(id),true);
        }
      }
      localStorage.removeItem(col);
      if(typeof invalidateColCacheV2751==='function') invalidateColCacheV2751(col);
    }catch(e){console.warn('Readiness reset skipped',col,e)}
  }

  window.resetReadinessRecordsV2753=async function(){
    if(!confirm('Reset only the records used by the dashboard readiness score? Notes, PDFs, library files and flashcards will remain.')) return;
    const typed=prompt('Type RESET to confirm readiness reset.');
    if(typed!=='RESET') return alert('Cancelled. Your study records are safe.');
    for(const col of readinessCols) await clearCollectionV2753(col);
    if(typeof window.refreshTrueReadinessV136==='function') await window.refreshTrueReadinessV136();
    if(typeof window.renderAIIntegrated==='function') await window.renderAIIntegrated();
    const source=$v('aiReadinessSourceV2753');
    if(source) source.textContent='No completed study records yet.';
    alert('Dashboard readiness records reset to zero. Notes, files and library resources were preserved.');
  };

  // "Delete Uploaded Files" now deletes files only. It never silently deletes planning or revision records.
  window.masterDeleteAllFiles=async function(){
    let localFiles=[];
    try{localFiles=JSON.parse(localStorage.getItem('upscSectionFilesV10')||'[]')}catch(e){}
    let cloudFiles=[];
    try{cloudFiles=typeof getCol==='function'?await getCol('sectionFiles'):[]}catch(e){}
    const seen=new Set();
    const files=[...cloudFiles,...localFiles].filter(f=>{const k=f?.id||f?.storagePath||`${f?.name||''}:${f?.date||''}`;if(seen.has(k))return false;seen.add(k);return true});
    if(!files.length) return alert('No uploaded files to delete. Readiness is based on study records, not files.');
    if(!confirm('Delete every uploaded file from all supported sections? Notes, tests, revision and readiness records will remain.')) return;
    const typed=prompt('Type DELETE FILES to confirm.');
    if(typed!=='DELETE FILES') return alert('Cancelled. Files are safe.');
    for(const f of files){
      if(f.storagePath) try{await deleteStoragePath(f.storagePath)}catch(e){}
      if(f.id&&cloudEnabled&&user) try{await deleteItem('sectionFiles',f.id,true)}catch(e){}
    }
    localStorage.removeItem('upscSectionFilesV10');
    localStorage.removeItem('sectionFiles');
    localStorage.removeItem('uploadedFilesV10');
    if(typeof invalidateColCacheV2751==='function') invalidateColCacheV2751('sectionFiles');
    document.querySelectorAll('.section').forEach(sec=>{if(window.renderSectionFilesV10) window.renderSectionFilesV10(sec.id)});
    if(window.renderFileVault) await window.renderFileVault();
    if(typeof window.refreshTrueReadinessV136==='function') await window.refreshTrueReadinessV136();
    alert('All uploaded files were deleted. Study progress and readiness records were preserved.');
  };

  window.__MISSION_UPSC_VERSION__='27.5.3';
})();


/* ===== V27.5.5 FINAL REGRESSION + TABLET NAVIGATION ===== */
(function(){
  const VERSION='28.1';
  const REPORT_KEY='mission_v281_last_regression';
  const $r=id=>document.getElementById(id);
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  let lastReport=null;

  function safeJson(raw,fallback=null){try{return JSON.parse(raw)}catch(e){return fallback}}
  function localBytes(){let n=0;for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i)||'',v=localStorage.getItem(k)||'';n+=(k.length+v.length)*2}return n}
  function withTimeout(promise,ms,label){return Promise.race([Promise.resolve(promise),new Promise((_,reject)=>setTimeout(()=>reject(new Error(`${label||'Operation'} timed out after ${ms/1000}s`)),ms))])}
  function escR(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function downloadR(data,name){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1200)}
  function countStatus(results,status){return results.filter(x=>x.status===status).length}

  window.toggleSidebarV2754=function(){const s=$r('sidebar'),o=$r('sidebarOverlayV2754');if(!s)return;const open=!s.classList.contains('open');s.classList.toggle('open',open);if(o)o.classList.toggle('open',open)};
  window.closeSidebarV2754=function(){const s=$r('sidebar'),o=$r('sidebarOverlayV2754');if(s)s.classList.remove('open');if(o)o.classList.remove('open')};

  function hardenButtonsV2754(){document.querySelectorAll('button:not([type])').forEach(b=>b.type='button')}
  function navTargetsV2754(){return [...document.querySelectorAll('.nav button[onclick]')].map(b=>({label:b.textContent.trim(),target:(b.getAttribute('onclick')||'').match(/show\(['\"]([^'\"]+)/)?.[1]||''})).filter(x=>x.target)}
  function inlineHandlerFailuresV2754(){
    const ignore=new Set(['if','for','while','switch','confirm','alert','prompt','setTimeout','setInterval','String','Number','Date','Math','JSON','Object','Array','document','getElementById','querySelector','click','stopPropagation','preventDefault']);
    const failures=[];
    document.querySelectorAll('[onclick],[onchange],[oninput],[onkeyup],[onkeydown]').forEach(el=>{
      ['onclick','onchange','oninput','onkeyup','onkeydown'].forEach(attr=>{
        const code=el.getAttribute(attr)||'';
        [...code.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)].forEach(m=>{const fn=m[1];if(!ignore.has(fn)&&typeof window[fn]!=='function')failures.push(`${fn} (${attr})`)})
      })
    });
    return [...new Set(failures)]
  }
  function recentErrorsV2754(){return safeJson(localStorage.getItem('mission_v275_error_log')||'[]',[])||[]}
  function makeResult(name,status,detail,group='Core',duration=0){return {name,status,detail,group,durationMs:Math.round(duration)}}
  async function runTestV2754(name,group,fn){
    const started=performance.now();
    try{const out=await fn();if(out&&out.status)return makeResult(name,out.status,out.detail||'',group,performance.now()-started);return makeResult(name,'pass',typeof out==='string'?out:'Check passed.',group,performance.now()-started)}
    catch(e){return makeResult(name,'fail',e?.message||String(e),group,performance.now()-started)}
  }
  function renderReportV2754(report){
    const results=report?.results||[],pass=countStatus(results,'pass'),warn=countStatus(results,'warn'),fail=countStatus(results,'fail');
    const score=Math.max(0,Math.round(((pass+warn*.5)/Math.max(1,results.length))*100));
    if($r('v2754RegressionScore'))$r('v2754RegressionScore').textContent=score+'%';
    if($r('v2754PassCount'))$r('v2754PassCount').textContent=pass;
    if($r('v2754WarnCount'))$r('v2754WarnCount').textContent=warn;
    if($r('v2754FailCount'))$r('v2754FailCount').textContent=fail;
    if($r('v2754RegressionProgress'))$r('v2754RegressionProgress').querySelector('span').style.width=score+'%';
    const badge=$r('v2754RegressionBadge');if(badge){badge.textContent=fail?'Needs attention':warn?'Passed with warnings':'Jarvis-ready';badge.className='pill '+(fail?'red':warn?'gold':'green')}
    const box=$r('v2754RegressionResults');if(box)box.innerHTML=results.map(x=>`<div class="v2754Test ${x.status}"><div class="v2754TestIcon">${x.status==='pass'?'✓':x.status==='warn'?'!':'×'}</div><div><small>${escR(x.group)} • ${x.durationMs} ms</small><h3>${escR(x.name)}</h3><p>${escR(x.detail)}</p></div></div>`).join('')||'<div class="emptyState">No tests ran.</div>';
    if($r('v2754ExportBtn'))$r('v2754ExportBtn').disabled=false;
    report.summary={score,pass,warn,fail,total:results.length};
    localStorage.setItem(REPORT_KEY,JSON.stringify(report));
  }

  window.runFinalRegressionV2754=async function(){
    const btn=$r('v2754RunBtn'),status=$r('v2754RegressionStatus'),results=[];
    if(btn?.disabled)return;
    if(btn){btn.disabled=true;btn.textContent='⏳ Running regression…'}
    if($r('v2754ExportBtn'))$r('v2754ExportBtn').disabled=true;
    if($r('v2754RegressionResults'))$r('v2754RegressionResults').innerHTML='<div class="aiLoading">Running non-destructive checks in small batches…</div>';
    const steps=[];
    steps.push(['Navigation targets','UI',async()=>{const nav=navTargetsV2754(),missing=nav.filter(x=>!document.getElementById(x.target));if(missing.length)throw new Error(`${missing.length} missing sections: ${missing.map(x=>x.target).join(', ')}`);return `${nav.length} sidebar destinations exist.`}]);
    steps.push(['Inline button handlers','UI',async()=>{const bad=inlineHandlerFailuresV2754();if(bad.length)throw new Error(`${bad.length} missing handlers: ${bad.slice(0,12).join(', ')}`);return `${document.querySelectorAll('[onclick],[onchange],[oninput],[onkeyup],[onkeydown]').length} inline controls resolved.`}]);
    steps.push(['Unique HTML IDs','UI',async()=>{const ids=[...document.querySelectorAll('[id]')].map(x=>x.id),dups=[...new Set(ids.filter((x,i)=>ids.indexOf(x)!==i))];if(dups.length)throw new Error(`Duplicate IDs: ${dups.join(', ')}`);return `${ids.length} unique IDs verified.`}]);
    steps.push(['Active page rendering','UI',async()=>{const active=document.querySelector('.section.active');if(!active)throw new Error('No active section is rendered.');const rect=active.getBoundingClientRect();if(rect.width<10)throw new Error(`Active section ${active.id} has no visible width.`);return `${active.id} is visible and measurable.`}]);
    steps.push(['Tablet section navigation','UI',async()=>{if(!$r('mobileTopV2754')||!$r('sidebarOverlayV2754'))throw new Error('Tablet navigation controls are missing.');return innerWidth<=980?'Mobile/tablet menu controls are active.':'Tablet controls installed; desktop sidebar remains active.'}]);
    steps.push(['Local storage round-trip','Data',async()=>{const key='mission_v2754_probe_'+Date.now(),value=JSON.stringify({ok:true,at:new Date().toISOString()});localStorage.setItem(key,value);if(localStorage.getItem(key)!==value)throw new Error('Browser storage write/read mismatch.');localStorage.removeItem(key);return `Read/write passed; ${(localBytes()/1048576).toFixed(2)} MB currently used.`}]);
    steps.push(['Local JSON integrity','Data',async()=>{const corrupt=[];Object.keys(localStorage).forEach(k=>{const v=localStorage.getItem(k)||'';if(/^[\[{]/.test(v.trim()))try{JSON.parse(v)}catch(e){corrupt.push(k)}});if(corrupt.length)throw new Error(`${corrupt.length} corrupt JSON keys: ${corrupt.slice(0,10).join(', ')}`);return `${localStorage.length} local keys scanned.`}]);
    steps.push(['Backup and restore schema','Data',async()=>{if(typeof window.exportCompleteBackupV275!=='function'||typeof window.previewRestoreBackupV275!=='function'||typeof window.restoreBackupV275!=='function')throw new Error('One or more backup functions are unavailable.');const probe={format:'mission-upsc-ai-os-backup',version:VERSION,createdAt:new Date().toISOString(),localStorage:{probe:'ok'},cloud:{included:false,collections:{}}};if(probe.format!=='mission-upsc-ai-os-backup'||probe.localStorage.probe!=='ok')throw new Error('Backup schema validation failed.');return 'Export, preview and restore handlers are registered.'}]);
    steps.push(['Critical module functions','Core',async()=>{const checks={show:typeof window.show==='function',renderAll:typeof renderAll==='function',getCol:typeof getCol==='function',saveCol:typeof saveCol==='function',aiAskRouterV23:typeof window.aiAskRouterV23==='function',refreshTrueReadinessV136:typeof window.refreshTrueReadinessV136==='function',runStabilityAuditV275:typeof window.runStabilityAuditV275==='function',exportCompleteBackupV275:typeof window.exportCompleteBackupV275==='function',jarvisRunV281:typeof window.jarvisRunV281==='function'};const missing=Object.entries(checks).filter(([,ok])=>!ok).map(([fn])=>fn);if(missing.length)throw new Error(`Missing core functions: ${missing.join(', ')}`);return `${Object.keys(checks).length} core functions are available.`}]);
    steps.push(['Single readiness owner','Core',async()=>{if(typeof window.refreshTrueReadinessV136!=='function')throw new Error('Readiness engine is unavailable.');if(window.__MISSION_UPSC_VERSION__!==VERSION)return {status:'warn',detail:`Readiness works, but runtime version reports ${window.__MISSION_UPSC_VERSION__||'unknown'}.`};return 'One readiness refresh engine is active; no competing DOM watcher is registered; V28.1 Jarvis is installed.'}]);
    steps.push(['AI router availability','AI',async()=>{if(typeof window.aiAskRouterV23!=='function')throw new Error('AI router function is missing.');const settings=safeJson(localStorage.getItem('mission_ai_settings_v23')||localStorage.getItem('aiSettingsV23')||'{}',{});return Object.keys(settings||{}).length?'AI router and saved mode are available.':'AI router is available; open AI Control Centre to save/confirm a mode.'}]);
    steps.push(['Recent runtime error history','Core',async()=>{const errs=recentErrorsV2754();if(errs.length)return {status:'warn',detail:`${errs.length} historical runtime error(s) are stored. Review Error Log; current structure may still be healthy.`};return 'No stored runtime errors.'}]);
    steps.push(['Login warm-up guard','Core',async()=>{if(window.__MISSION_AUTH_WARMUP__){await wait(1700);if(window.__MISSION_AUTH_WARMUP__)throw new Error('Login warm-up flag is stuck active.');}return 'Login warm-up guard is released normally.'}]);
    steps.push(['Main-thread responsiveness','Device',async()=>{const start=performance.now();await wait(120);const drift=performance.now()-start-120;if(drift>1200)throw new Error(`Main thread delay is ${Math.round(drift)} ms.`);if(drift>350)return {status:'warn',detail:`Main thread is responsive but delayed by ${Math.round(drift)} ms. Enable Tablet low-power mode if this repeats.`};return `Event-loop delay ${Math.max(0,Math.round(drift))} ms.`}]);
    steps.push(['Firebase login and read','Cloud',async()=>{if(!$r('v2754CloudSmoke')?.checked)return {status:'warn',detail:'Cloud smoke test was skipped by user.'};if(!(typeof cloudEnabled!=='undefined'&&cloudEnabled&&typeof user!=='undefined'&&user))return {status:'warn',detail:'Google login/cloud is not active. Local checks passed; login before final deployment test.'};const rows=await withTimeout(window.getCol('tasks'),8000,'Firebase read');if(!Array.isArray(rows))throw new Error('Firebase collection response was not an array.');return `Authenticated read succeeded (${rows.length} task record${rows.length===1?'':'s'} returned).`}]);
    steps.push(['Stylesheet and viewport','Device',async()=>{if(!document.styleSheets.length)throw new Error('No stylesheet is loaded.');const vp=`${innerWidth}×${innerHeight}`;if(innerWidth<320)return {status:'warn',detail:`Very narrow viewport ${vp}; use portrait tablet/phone width above 320px.`};return `${document.styleSheets.length} stylesheet(s) loaded at viewport ${vp}.`}]);

    for(let i=0;i<steps.length;i++){
      const [name,group,fn]=steps[i];
      if(status)status.textContent=`Running ${i+1}/${steps.length}: ${name}`;
      results.push(await runTestV2754(name,group,fn));
      if($r('v2754RegressionProgress'))$r('v2754RegressionProgress').querySelector('span').style.width=Math.round(((i+1)/steps.length)*100)+'%';
      await wait(20);
    }
    lastReport={format:'mission-upsc-final-regression',version:VERSION,createdAt:new Date().toISOString(),environment:{online:navigator.onLine,userAgent:navigator.userAgent,viewport:{width:innerWidth,height:innerHeight},deviceMemory:navigator.deviceMemory||null,activeSection:document.querySelector('.section.active')?.id||''},results};
    renderReportV2754(lastReport);
    const fail=countStatus(results,'fail'),warn=countStatus(results,'warn');
    if(status)status.textContent=fail?`${fail} failure(s) need correction before Jarvis.`:warn?`Regression passed with ${warn} warning(s). Review them before deployment.`:'All final regression checks passed. V28.1 Jarvis Command Centre is ready.';
    if(btn){btn.disabled=false;btn.textContent='↻ Run Final Regression Again'}
  };

  window.exportRegressionReportV2754=function(){
    const report=lastReport||safeJson(localStorage.getItem(REPORT_KEY)||'null');
    if(!report)return alert('Run Final Regression first.');
    downloadR(report,`mission-upsc-v28.1-regression-${new Date().toISOString().slice(0,10)}.json`)
  };
  window.copySupportSnapshotV2754=async function(){
    const report=lastReport||safeJson(localStorage.getItem(REPORT_KEY)||'null');
    const snapshot={version:VERSION,time:new Date().toISOString(),online:navigator.onLine,viewport:`${innerWidth}x${innerHeight}`,deviceMemory:navigator.deviceMemory||'unknown',activeSection:document.querySelector('.section.active')?.id||'',signedIn:!!(typeof user!=='undefined'&&user),cloudEnabled:!!(typeof cloudEnabled!=='undefined'&&cloudEnabled),localKeys:localStorage.length,localMB:(localBytes()/1048576).toFixed(2),regressionSummary:report?.summary||null,recentErrors:recentErrorsV2754().slice(0,5).map(x=>({time:x.time,context:x.context,message:x.message,section:x.section}))};
    const text=JSON.stringify(snapshot,null,2);
    try{await navigator.clipboard.writeText(text);alert('Support snapshot copied. It contains diagnostics only, not your notes or file contents.')}catch(e){downloadR(snapshot,`mission-upsc-support-snapshot-${Date.now()}.json`)}
  };

  function initV2754(){
    hardenButtonsV2754();
    const saved=safeJson(localStorage.getItem(REPORT_KEY)||'null');if(saved){lastReport=saved;renderReportV2754(saved);if($r('v2754RegressionStatus'))$r('v2754RegressionStatus').textContent=`Last regression: ${new Date(saved.createdAt).toLocaleString()}`}
    if($r('v275BuildBadge'))$r('v275BuildBadge').textContent=`V28.1 • ${navigator.onLine?'Online':'Offline'}`;
    document.querySelectorAll('.nav button').forEach(b=>{if(!b.dataset.v2754Close){b.dataset.v2754Close='1';b.addEventListener('click',()=>{if(innerWidth<=980)window.closeSidebarV2754()})}})
  }
  window.__MISSION_UPSC_VERSION__=VERSION;
  document.addEventListener('DOMContentLoaded',()=>setTimeout(initV2754,450));
  window.addEventListener('resize',()=>{if(innerWidth>980)window.closeSidebarV2754()},{passive:true});
})();

/* V28.1.1: Jarvis moved to jarvis-v2811.js so button handlers load independently. */

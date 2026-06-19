/* Mission UPSC AI OS V28.5 — Jarvis Pro responsive enhancements */
(() => {
  'use strict';
  const VERSION='28.5';
  const DRAFT_KEY='mission_jarvis_draft_v285';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const SUBJECTS=['Polity','History','Geography','Economy','Environment','Science & Tech','Ethics','Essay','Current Affairs','CSAT','Optional'];
  let baseRun=null,installed=false,draftTimer=null;

  function deviceClass(){
    const w=window.innerWidth;
    document.body.classList.toggle('v285Mobile',w<641);
    document.body.classList.toggle('v285Tablet',w>=641&&w<=1100);
    document.body.classList.toggle('v285Desktop',w>1100);
  }
  function taskType(text){
    const t=text.toLowerCase();
    if(/mcq|prelims test|quiz/.test(t))return ['Prelims test','prelimsWarRoomV251'];
    if(/mains|essay|answer evaluat|model answer/.test(t))return ['Mains','mainsWarRoomV252'];
    if(/mind\s?map|knowledge graph/.test(t))return ['Visual map','mindMapStudio'];
    if(/flashcard|recall card/.test(t))return ['Flashcards','smartFlashcards'];
    if(/note|one.?pager|summary/.test(t))return ['Notes','aiNotesStudioV231'];
    if(/plan|schedule|calendar|today/.test(t))return ['Planning','dailyCommandV261'];
    if(/revise|revision|weak/.test(t))return ['Revision','aiRevisionBrain'];
    if(/interview|daf/.test(t))return ['Interview','interviewRoomV253'];
    if(/focus|pomodoro|study session/.test(t))return ['Focus','timeHabitV262'];
    if(/find|search|library/.test(t))return ['Search','aiDigitalLibraryPro'];
    return ['General command','jarvisCommandV281'];
  }
  function subject(text){
    const low=text.toLowerCase();
    return SUBJECTS.find(s=>low.includes(s.toLowerCase()))||(/article\s+\d+|constitution|fundamental right/.test(low)?'Polity':'General');
  }
  function analyse(text){
    const clean=String(text||'').trim();
    const [task,destination]=taskType(clean);
    const subj=subject(clean);
    const count=(clean.match(/\b(\d{1,3})\s*(?:mcq|question|flashcard|card)s?\b/i)||[])[1]||'—';
    const mins=(clean.match(/\b(\d{1,3})\s*(?:minute|min|m)\b/i)||[])[1]||'—';
    const steps=clean?clean.split(/\s+(?:and\s+then|then|after\s+that|next)\s+/i).filter(Boolean).length:0;
    const cloud=/evaluate|essay|current affairs|latest|deep analysis|pdf|report/i.test(clean);
    return {task,destination,subject:subj,count,mins,steps,route:cloud?'Smart quality route':'Free-first smart route'};
  }
  function renderIntent(text){
    const host=$('jarvisLiveIntentV285');if(!host)return;
    const a=analyse(text);
    if(!String(text||'').trim()){
      host.innerHTML='<span class="v285IntentLabel">Live understanding</span><span class="v285IntentChip">Type a command</span><span id="jarvisDraftStateV285" class="v285DraftState">Draft ready</span>';
      return;
    }
    host.innerHTML=`<span class="v285IntentLabel">Live understanding</span>
      <span class="v285IntentChip">🎯 ${esc(a.task)}</span>
      <span class="v285IntentChip">📚 ${esc(a.subject)}</span>
      ${a.count!=='—'?`<span class="v285IntentChip"># ${esc(a.count)}</span>`:''}
      ${a.mins!=='—'?`<span class="v285IntentChip">⏱ ${esc(a.mins)} min</span>`:''}
      ${a.steps>1?`<span class="v285IntentChip step">🔗 ${a.steps} steps</span>`:''}
      <span class="v285IntentChip route">⚡ ${esc(a.route)}</span>
      <span id="jarvisDraftStateV285" class="v285DraftState">Draft saved locally</span>`;
  }
  function autoSize(el){if(!el)return;el.style.height='auto';el.style.height=Math.min(Math.max(el.scrollHeight,118),310)+'px'}
  function saveDraft(){const input=$('jarvisCommandInputV281');if(!input)return;localStorage.setItem(DRAFT_KEY,input.value);const s=$('jarvisDraftStateV285');if(s)s.textContent=input.value.trim()?'Draft saved locally':'Draft cleared'}
  function clearDraft(){localStorage.removeItem(DRAFT_KEY);const input=$('jarvisCommandInputV281');if(input){input.value='';autoSize(input);input.focus()}renderIntent('')}
  function currentWeakTopic(){
    try{
      const keys=['mission_revision_weak_topics','mission_weak_topics_v241','mission_wrong_answers','mission_revision_tasks'];
      for(const k of keys){const a=JSON.parse(localStorage.getItem(k)||'[]');if(Array.isArray(a)&&a.length){const x=a[0];return x.topic||x.subject||x.title||x.question||'my weakest topic'}}
    }catch(e){}
    return 'my weakest topic';
  }
  function insertTool(type){
    const input=$('jarvisCommandInputV281');if(!input)return;
    const map={
      weak:`Diagnose ${currentWeakTopic()} and create a 3-day repair plan`,
      today:'Brief me for today using due revisions, calendar, memory cards and weak topics',
      revise:`Start a 50 minute focus session on ${currentWeakTopic()}`,
      test:`Generate 15 UPSC-level MCQs on ${currentWeakTopic()} and analyze mistakes`,
      chain:`Plan my day, then start a 50 minute focus session on ${currentWeakTopic()}, then generate 10 MCQs on the same topic`,
      clear:''
    };
    input.value=map[type]??input.value;autoSize(input);renderIntent(input.value);saveDraft();input.focus();
  }
  window.jarvisToolV285=insertTool;
  window.clearJarvisDraftV285=clearDraft;

  function normalizeCommand(raw){
    let t=String(raw||'').trim();
    let m;
    if(/^today$/i.test(t))return 'Brief me for today using due revisions, calendar, memory cards and weak topics';
    if(/^weakest$/i.test(t))return `Diagnose ${currentWeakTopic()} and create a 7 day revision plan`;
    if((m=t.match(/^(\d{1,3})\s+mcqs?\s+(.+)/i)))return `Generate ${m[1]} UPSC-level MCQs on ${m[2]}`;
    if((m=t.match(/^mcqs?\s+(\d{1,3})\s+(.+)/i)))return `Generate ${m[1]} UPSC-level MCQs on ${m[2]}`;
    if((m=t.match(/^(?:notes?|note on)\s+(.+)/i)))return `Create detailed UPSC notes on ${m[1]} with PYQ angle, current affairs linkage and revision capsule`;
    if((m=t.match(/^(?:map|mindmap|mind map)\s+(.+)/i)))return `Create a detailed UPSC mindmap on ${m[1]}`;
    if((m=t.match(/^focus\s+(\d{1,3})\s+(.+)/i)))return `Start a ${m[1]} minute focus session on ${m[2]}`;
    if((m=t.match(/^revise\s+(.+?)(?:\s+(\d{1,3})m)?$/i)))return `Start a ${m[2]||50} minute focus session on ${m[1]} revision`;
    if((m=t.match(/^find\s+(.+)/i)))return `Find my ${m[1]} notes and library resources`;
    return t;
  }
  function installRunWrapper(){
    if(installed||typeof window.jarvisRunV281!=='function')return false;
    if(window.jarvisRunV281.__v285){installed=true;return true}
    baseRun=window.jarvisRunV281;
    const enhanced=async function(){
      const input=$('jarvisCommandInputV281');
      if(input){input.value=normalizeCommand(input.value);autoSize(input);renderIntent(input.value);saveDraft()}
      const status=$('jarvisStatusV281');if(status){status.textContent='Understanding…';status.className='pill gold'}
      try{return await baseRun.apply(this,arguments)}
      finally{if(status){status.textContent='Ready';status.className='pill green'}}
    };
    enhanced.__v285=true;window.jarvisRunV281=enhanced;installed=true;return true;
  }
  function injectUI(){
    const input=$('jarvisCommandInputV281');if(!input||$('jarvisLiveIntentV285'))return;
    const intent=document.createElement('div');intent.id='jarvisLiveIntentV285';intent.className='v285IntentBar';
    input.insertAdjacentElement('afterend',intent);
    const tools=document.createElement('div');tools.className='v285ComposerTools';tools.innerHTML=`
      <button type="button" onclick="jarvisToolV285('today')">☀ Today brief</button>
      <button type="button" onclick="jarvisToolV285('weak')">⚠ Weakest topic</button>
      <button type="button" onclick="jarvisToolV285('revise')">⏱ Start focus</button>
      <button type="button" onclick="jarvisToolV285('test')">🎯 Quick test</button>
      <button type="button" onclick="jarvisToolV285('chain')">🔗 Build study chain</button>
      <button type="button" onclick="clearJarvisDraftV285()">✕ Clear draft</button>`;
    intent.insertAdjacentElement('afterend',tools);
    const hint=document.createElement('div');hint.className='v285KeyboardHint';hint.textContent='Tip: press Ctrl/⌘ + Enter to run. Short commands such as “10 mcq economy”, “notes Article 14” and “focus 50 polity” are understood.';
    tools.insertAdjacentElement('afterend',hint);
    const restored=localStorage.getItem(DRAFT_KEY)||'';
    if(!input.value&&restored)input.value=restored;
    autoSize(input);renderIntent(input.value);
    input.addEventListener('input',()=>{autoSize(input);renderIntent(input.value);clearTimeout(draftTimer);draftTimer=setTimeout(saveDraft,280)});
    input.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();window.jarvisRunV281?.()}});
    window.addEventListener('online',renderHealth);window.addEventListener('offline',renderHealth);
  }
  function renderHealth(){
    const head=document.querySelector('#jarvisCommandV281 .v281Console .v281CardHead');if(!head)return;
    let d=$('jarvisHealthV285');
    if(!d){d=document.createElement('div');d.id='jarvisHealthV285';head.appendChild(d)}
    d.className='v285JarvisHealth'+(navigator.onLine?'':' offline');
    d.innerHTML='<i></i><span>'+(navigator.onLine?'Online • Smart Router ready':'Offline • Local workspace mode')+'</span>';
  }
  function updateVersion(){
    window.__MISSION_UPSC_VERSION__=VERSION;
    document.title='Mission UPSC AI OS V28.5 — Responsive Jarvis Pro';
    document.querySelectorAll('.versionBadge').forEach(x=>x.textContent='V28.5 • Jarvis Pro');
    const eyebrow=document.querySelector('#jarvisCommandV281 .v281Eyebrow');if(eyebrow)eyebrow.textContent='V28.5 • RESPONSIVE JARVIS PRO • SMART ROUTER • PERSONAL MEMORY';
    const release=[...document.querySelectorAll('.v275ReleaseList div b')].find(x=>/Mission UPSC AI OS V28\.4/.test(x.textContent));if(release)release.textContent='Mission UPSC AI OS V28.5 Responsive Jarvis Pro';
  }
  function init(){deviceClass();updateVersion();injectUI();renderHealth();let n=0;const timer=setInterval(()=>{n++;installRunWrapper();injectUI();if(installed||n>80)clearInterval(timer)},100);window.addEventListener('resize',deviceClass,{passive:true})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,260),{once:true});else setTimeout(init,100);
})();

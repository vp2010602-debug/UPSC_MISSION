/* Mission UPSC AI OS V30.8.0 — Refined Current Affairs, Countdown, YouTube Hindi & Progress Intelligence */
(function(){
  'use strict';
  const VERSION='30.8.0';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const read=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k)||'');return v??f}catch(_){return f}};
  const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const today=()=>new Date().toISOString().slice(0,10);
  const addDays=(s,n)=>{const d=parseDate(s)||new Date();d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)};
  const uid=(p='x')=>`${p}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  const CA_FETCH_KEY='mission_easy_ca_fetch_v306';
  const CA_TOPICS_KEY='mission_ca_topics_v305';
  const TASK_KEY='mission_unified_tasks_v307';
  let progressSnapshot=null;
  let ytSpeech=null;

  function toast(msg,type='info'){
    if(typeof window.showToast==='function')return window.showToast(msg,type);
    const e=document.createElement('div');e.className='v308Toast';e.dataset.type=type;e.textContent=msg;document.body.appendChild(e);setTimeout(()=>e.remove(),3600);
  }
  function parseDate(s){
    const m=String(s||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!m)return null;
    const d=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),23,59,59,999);
    return Number.isNaN(d.getTime())?null:d;
  }
  function fmtDate(s,opts={day:'numeric',month:'short',year:'numeric'}){const d=parseDate(s);return d?d.toLocaleDateString('en-IN',opts):'Not set'}
  function dateOf(x){
    const candidates=[x?.date,x?.due,x?.dueDate,x?.completedDate,x?.savedAt,x?.createdAt,x?.updatedAt,x?.timestamp];
    for(const v of candidates){
      if(!v)continue;
      if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}/.test(v))return v.slice(0,10);
      const n=typeof v==='object'&&v.seconds?v.seconds*1000:Number(v);
      if(Number.isFinite(n)&&n>1000000000)return new Date(n).toISOString().slice(0,10);
    }
    return '';
  }
  async function getCol(name){
    try{if(typeof window.getCol==='function'){const a=await window.getCol(name);if(Array.isArray(a))return a}}catch(_){ }
    try{if(typeof window.safeGetColV4==='function'){const a=await window.safeGetColV4(name);if(Array.isArray(a))return a}}catch(_){ }
    const direct=read(name,null);if(Array.isArray(direct))return direct;
    return read('mission_local_collection_'+name,[]);
  }
  function htmlToText(v){const d=document.createElement('div');d.innerHTML=String(v||'');return (d.textContent||'').trim()}
  function words(v){return String(v||'').trim().split(/\s+/).filter(Boolean).length}
  function downloadBlob(name,type,content){const b=new Blob([content],{type});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}

  /* ---------------- Refined Daily Current Affairs ---------------- */
  function caHtml(){return `
    <div class="v308CAHero">
      <div><span>TODAY'S UPSC BRIEF • YOU CONTROL GEMINI</span><h1>Daily Current Affairs</h1><p>Fetch trusted headlines free, review only important issues, then use one Gemini call to create exam-ready notes.</p></div>
      <div class="v308HeroIcon">📰</div>
    </div>
    <div class="v308CAControl card">
      <div class="v308CAControlMain">
        <label class="v308DateControl"><span>Brief date</span><input id="v307CADate" type="date" value="${today()}"></label>
        <button class="v308Primary" onclick="fetchHeadlinesV307()">↻ Get Today’s Headlines</button>
        <button class="v308Secondary" onclick="selectTopHeadlinesV307()">✓ Select Top 8</button>
      </div>
      <div class="v308CAStats"><span><b id="v308HeadlineCount">0</b> headlines</span><span><b id="v308SelectedCount">0</b> selected</span><span><b id="v308GeneratedCount">0</b> saved topics</span></div>
      <div id="v307HeadlineStatus" class="v307Status v308CAStatus">Ready. Fetching headlines uses zero Gemini tokens.</div>
    </div>
    <div class="v308CAGrid">
      <section class="v308Inbox card">
        <div class="v308SectionHead"><div><h2>Review Today’s Headlines</h2><p>Keep only topics that matter for UPSC. Open the source whenever you need the full article.</p></div><span class="v308TokenBadge">0 TOKENS</span></div>
        <div id="v307HeadlineList" class="v307HeadlineList v308HeadlineList"><div class="v308Empty"><span>🗞️</span><b>No headlines fetched yet</b><p>Press “Get Today’s Headlines” above.</p></div></div>
        <div class="v308GenerateBar"><div><b id="v308GenerateLabel">Select useful headlines</b><small>Gemini runs only after your confirmation.</small></div><button class="v308Generate" onclick="generateSelectedCAV307()">✨ Generate Selected UPSC Notes</button><button class="v308Clear" onclick="clearHeadlineSelectionV307()">Clear</button></div>
      </section>
      <aside class="v308QuickPanel card">
        <details open><summary>Quick Article / Newspaper Upload</summary>
          <p>Paste an editorial or upload PDF, image or TXT. JARVIS will extract UPSC-relevant issues.</p>
          <input id="v307CAUploadTitle" placeholder="Article / newspaper title">
          <select id="v307CAUploadSource"><option>The Hindu</option><option>Indian Express</option><option>PIB</option><option>PRS</option><option>RBI</option><option>NITI Aayog</option><option>Other</option></select>
          <textarea id="v307CAUploadText" placeholder="Paste article, editorial, PIB release or daily digest here…"></textarea>
          <label class="v308FilePick">📎 Choose PDF / image / TXT<input id="v307CAUploadFile" type="file" accept="application/pdf,image/*,.txt,.md" hidden></label>
          <div class="v308QuickActions"><button onclick="prepareUploadedCAV307()">Add to Today</button><button class="v308Generate" onclick="generateUploadedCAV307()">✨ Generate Now</button></div>
          <div id="v307CAUploadStatus" class="v307Status">No file selected.</div>
        </details>
        <div class="v308CAHelp"><b>Daily routine</b><ol><li>Fetch headlines</li><li>Keep 5–8 issues</li><li>Generate once</li><li>Read, save and revise</li></ol></div>
      </aside>
    </div>
    <section class="v308Archive card">
      <div class="v308SectionHead"><div><h2>Your Generated Current Affairs</h2><p>Search the archive, open a topic and use copy, PYQ, notes, revision, Mains and Prelims actions.</p></div><button id="v308ArchiveToggle" class="v308Secondary" onclick="toggleCAArchiveV308()">Show archive</button></div>
      <div id="v308ArchiveBody" class="v308ArchiveBody">
        <aside><input id="v307CASearch" placeholder="Search topic, tag or subject" oninput="renderCATopicsV307()"><select id="v307CASubject" onchange="renderCATopicsV307()"><option>All</option><option>Polity</option><option>Economy</option><option>Environment</option><option>Science & Tech</option><option>IR</option><option>Security</option><option>Social Issues</option><option>Geography</option><option>Governance</option><option>History</option><option>Other</option></select><div id="v307CATopicList"></div></aside>
        <main id="v307CATopicDetail"><div class="v308Empty"><span>📚</span><b>No topic selected</b><p>Generate notes or open a saved topic from the archive.</p></div></main>
      </div>
    </section>`}

  function rebuildCA(){
    if(window.__JARVIS_TRACKER_V32_ACTIVE__)return;
    const desk=$('v307CADesk');if(!desk||desk.dataset.v308==='1')return;
    desk.dataset.v308='1';desk.innerHTML=caHtml();
    const file=$('v307CAUploadFile');if(file)file.addEventListener('change',()=>{$('v307CAUploadStatus').textContent=file.files?.[0]?`Selected: ${file.files[0].name}`:'No file selected.'});
    const obs=new MutationObserver(refreshCAStats);['v307HeadlineList','v307CATopicList'].forEach(id=>{const e=$(id);if(e)obs.observe(e,{childList:true,subtree:true,attributes:true})});
    setTimeout(()=>{try{window.renderCATopicsV307?.()}catch(_){ }refreshCAStats();},100);
  }
  function refreshCAStats(){
    const state=read(CA_FETCH_KEY,{items:[]}),items=Array.isArray(state.items)?state.items:[],topics=read(CA_TOPICS_KEY,[]),selected=items.filter(x=>x.selected).length;
    if($('v308HeadlineCount'))$('v308HeadlineCount').textContent=items.length;
    if($('v308SelectedCount'))$('v308SelectedCount').textContent=selected;
    if($('v308GeneratedCount'))$('v308GeneratedCount').textContent=Array.isArray(topics)?topics.length:0;
    if($('v308GenerateLabel'))$('v308GenerateLabel').textContent=selected?`${selected} headline${selected===1?'':'s'} ready for Gemini`:'Select useful headlines';
    const body=$('v308ArchiveBody'),btn=$('v308ArchiveToggle');
    if(body&&btn&&Array.isArray(topics)&&topics.length&&!body.dataset.userToggled){body.classList.add('open');btn.textContent='Hide archive'}
  }
  window.toggleCAArchiveV308=function(){const b=$('v308ArchiveBody'),btn=$('v308ArchiveToggle');if(!b)return;b.dataset.userToggled='1';b.classList.toggle('open');if(btn)btn.textContent=b.classList.contains('open')?'Hide archive':'Show archive'};

  /* ---------------- Reliable Exam Countdown ---------------- */
  function countdownParts(value){
    const target=parseDate(value);if(!target)return null;
    const ms=target.getTime()-Date.now();
    if(ms<=0)return {days:0,hours:0,minutes:0,seconds:0,reached:true};
    return {days:Math.floor(ms/86400000),hours:Math.floor(ms%86400000/3600000),minutes:Math.floor(ms%3600000/60000),seconds:Math.floor(ms%60000/1000),reached:false};
  }
  function countdownCard(label,value,kind){
    const p=countdownParts(value);
    if(!p)return `<div class="v308CountdownEmpty"><span>${kind==='prelims'?'🧭':'✍️'}</span><h2>Set ${label} date</h2><p>Choose a date above. It will save automatically.</p></div>`;
    if(p.reached)return `<div class="v308CountdownReached"><span>🏁</span><h2>${label}</h2><b>${fmtDate(value)}</b><p>The saved date has arrived or passed.</p></div>`;
    return `<div class="v308CountdownCard ${kind}"><span>${kind==='prelims'?'🧭':'✍️'}</span><h2>${label}</h2><div class="v308Clock"><b>${p.days}</b><small>days</small><b>${p.hours}</b><small>hours</small><b>${p.minutes}</b><small>min</small><b>${p.seconds}</b><small>sec</small></div><p>${fmtDate(value,{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p></div>`;
  }
  function phaseInfo(days){
    if(days>240)return {name:'Foundation & Coverage',urgency:'CALM',text:'Build conceptual clarity, finish core sources and make first-layer notes.',tasks:['Complete syllabus blocks','Start daily PYQs','Weekly revision cycle']};
    if(days>150)return {name:'Coverage + Consolidation',urgency:'STEADY',text:'Complete remaining sources while strengthening PYQs, answer writing and revision.',tasks:['Close major syllabus gaps','Two tests per month','One Mains answer most days']};
    if(days>90)return {name:'Consolidation',urgency:'FOCUSED',text:'Reduce new sources. Prioritise revision, PYQs, current affairs and sectional tests.',tasks:['Two revision cycles','Timed sectional tests','Mistake notebook']};
    if(days>45)return {name:'Revision & Testing',urgency:'URGENT',text:'Use most study time for revision, mocks and error correction.',tasks:['Full revision calendar','Frequent mocks','Daily weak-area repair']};
    if(days>15)return {name:'Final Lap',urgency:'HIGH',text:'Protect sleep, revise high-yield material and avoid unnecessary new sources.',tasks:['Rapid revision','Exam simulation','Stable routine']};
    return {name:'Exam Window',urgency:'CRITICAL',text:'Keep the plan light, predictable and confidence-focused.',tasks:['Final recall','Sleep discipline','Logistics check']};
  }
  function renderCountdownV308(){
    const pre=localStorage.getItem('prelimsDateAI')||localStorage.getItem('prelimsDate')||'';
    const main=localStorage.getItem('mainsDateAI')||localStorage.getItem('mainsDate')||'';
    const preInput=$('prelimsDateAI'),mainInput=$('mainsDateAI');
    if(preInput&&document.activeElement!==preInput&&preInput.value!==pre)preInput.value=pre;
    if(mainInput&&document.activeElement!==mainInput&&mainInput.value!==main)mainInput.value=main;
    if($('prelimsCountdownLive'))$('prelimsCountdownLive').innerHTML=countdownCard('Prelims',pre,'prelims');
    if($('mainsCountdownLive'))$('mainsCountdownLive').innerHTML=countdownCard('Mains',main,'mains');
    const next=[{name:'Prelims',date:pre,p:countdownParts(pre)},{name:'Mains',date:main,p:countdownParts(main)}].filter(x=>x.p&&!x.p.reached).sort((a,b)=>a.p.days-b.p.days)[0];
    if($('countdownPhaseBadgeV265'))$('countdownPhaseBadgeV265').textContent=next?`${next.name}: ${next.p.days} days`:'Set exam dates';
    const phase=next?phaseInfo(next.p.days):null;
    if($('countdownUrgencyV265'))$('countdownUrgencyV265').textContent=phase?.urgency||'CALM';
    if($('countdownStrategyOutputV265'))$('countdownStrategyOutputV265').innerHTML=phase?`<h3>${phase.name}</h3><p>${phase.text}</p><ul>${phase.tasks.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'Set exam dates to receive a phase-wise strategy.';
    if($('countdownMilestoneListV265'))$('countdownMilestoneListV265').innerHTML=phase?phase.tasks.map((x,i)=>`<div class="countdownMilestoneV265"><span>${['📘','🧪','🔁'][i]||'📌'}</span><div><b>${esc(x)}</b><small>${next.name} preparation milestone</small></div></div>`).join(''):'<div class="countdownMilestoneV265"><span>📌</span><div><b>Set your dates</b><small>The clock will create preparation milestones.</small></div></div>';
  }
  window.renderExamCountdownAI=renderCountdownV308;
  window.saveExamCountdownAI=function(){
    const pre=$('prelimsDateAI')?.value||'',main=$('mainsDateAI')?.value||'';
    if(!pre&&!main)return toast('Choose at least one exam date.','warn');
    if(pre){localStorage.setItem('prelimsDateAI',pre);localStorage.setItem('prelimsDate',pre)}else{localStorage.removeItem('prelimsDateAI')}
    if(main){localStorage.setItem('mainsDateAI',main);localStorage.setItem('mainsDate',main)}else{localStorage.removeItem('mainsDateAI')}
    renderCountdownV308();
    let s=$('countdownSaveStatusV308');if(!s){s=document.createElement('span');s.id='countdownSaveStatusV308';s.className='v308SaveStatus';document.querySelector('.countdownSetupActionsV265')?.appendChild(s)}s.textContent='✓ Dates saved';setTimeout(()=>{if(s)s.textContent=''},2500);
    toast('Exam countdown saved.','success');
  };
  function installCountdownV308(){
    const sec=$('countdownPage');if(!sec||sec.dataset.v308==='1')return;sec.dataset.v308='1';
    ['prelimsDateAI','mainsDateAI'].forEach(id=>{const input=$(id);if(!input)return;input.addEventListener('change',()=>window.saveExamCountdownAI());const shell=input.closest('.countdownDateFieldV265');shell?.addEventListener('click',e=>{if(e.target.closest('button'))return;try{input.showPicker?.()}catch(_){input.focus()}})});
    const save=[...sec.querySelectorAll('button')].find(b=>(b.getAttribute('onclick')||'').includes('saveExamCountdownAI'));if(save){save.onclick=window.saveExamCountdownAI}
    renderCountdownV308();setInterval(()=>{if(sec.classList.contains('active'))renderCountdownV308()},1000);
  }

  /* ---------------- YouTube Hindi + Advanced Tools ---------------- */
  function languageRule(value){
    const v=String(value||'English');
    if(v.includes('Hinglish'))return 'Write primarily in simple Hinglish using Roman script. Keep constitutional Articles, institutions, schemes, judgments and technical UPSC keywords in English. Add short Hindi explanations where useful.';
    if(v.includes('Hindi')&&!v.includes('English'))return 'Write the complete output in clear formal Hindi using Devanagari. Keep official names, Article numbers, Acts, schemes, reports and essential UPSC terminology in English inside brackets when useful.';
    if(v.includes('Bilingual'))return 'Use bilingual presentation: each major heading and key explanation in English followed by concise Hindi. Avoid repeating minor details twice.';
    if(v.includes('Hindi keywords'))return 'Write in simple English and add important Hindi keywords in brackets.';
    return `Write in ${v}. Use clear exam-oriented language.`;
  }
  function ytPromptV308(){
    const url=$('youtubeUrlV302')?.value.trim()||'Not supplied',title=$('youtubeTitleV302')?.value.trim()||'YouTube UPSC Lecture',subject=$('youtubeSubjectV302')?.value||'General Studies',mode=$('youtubeModeV302')?.value||'integrated',language=$('youtubeLanguageV302')?.value||'English',depth=$('youtubeDepthV308')?.value||'Detailed',transcript=String($('youtubeTranscriptV302')?.value||'').trim();
    const modeRule={integrated:'Integrate Prelims and Mains preparation.',prelims:'Prioritise factual clarity, provisions, dates, institutions, maps, traps and elimination cues.',mains:'Prioritise analytical dimensions, arguments, examples, judgments/reports, challenges and way forward.',lecture:'Create detailed chronological lecture notes while removing filler.',revision:'Create a compact one-page revision capsule.'}[mode]||'Create integrated UPSC notes.';
    return `Act as a senior UPSC CSE faculty member and multilingual notes editor. Convert the supplied lecture transcript into accurate, readable, exam-oriented notes.\n\nTitle: ${title}\nVideo: ${url}\nSubject: ${subject}\nDepth: ${depth}\nMode: ${modeRule}\nLanguage rule: ${languageRule(language)}\n\nMandatory structure:\n# ${title}\n## 60-Second Lecture Summary\n## Syllabus Linkage\n## Chapter-wise Lecture Map\n- create logical chapters and mention timestamps only when present in the transcript\n## Core Concepts and Definitions\n## Detailed Topic Notes\n## Prelims Focus\n- facts, provisions, institutions, dates, maps/locations and statement traps\n## Mains Focus\n- dimensions, arguments, examples and analytical linkages\n## Constitutional / Legal / Policy Provisions\n## Reports, Data, Judgments and Examples\n- include only defensible items; mark uncertain claims as Needs verification\n## Related PYQ Themes\n- never invent an exact PYQ year or wording\n## Possible 10-Marker and 15-Marker\n## Text Flowchart / Mind Map\n## 15 Active-Recall Flashcards\n## One-Page Revision Capsule\n## 30-Second Recall\n\nRules:\n- Remove greetings, promotions, repetition and filler.\n- Preserve the teacher's useful explanations and examples.\n- Separate transcript claims from verified static knowledge.\n- Never fabricate facts, sources, judgments, reports or PYQs.\n- Use clean Markdown.\n\nTRANSCRIPT:\n${transcript.slice(0,65000)}`;
  }
  async function askAI(prompt,task='youtube-notes'){
    if(typeof window.aiAskRouterV23==='function')return await window.aiAskRouterV23(prompt);
    if(typeof window.missionAskAI==='function')return await window.missionAskAI(prompt,{task});
    throw new Error('AI router unavailable. Save a mode in AI Control Centre.');
  }
  function ytStatus(text,type='info'){const e=$('youtubeOutputStatusV302');if(e){e.textContent=text;e.dataset.state=type}}
  window.generateYouTubeNotesV302=async function(){
    const transcript=String($('youtubeTranscriptV302')?.value||'').trim();if(words(transcript)<40)return ytStatus('Paste or upload a meaningful transcript first.','error');
    const out=$('youtubeNotesOutputV302');if(out)out.value='Generating multilingual UPSC notes…';ytStatus('AI is structuring the lecture. Keep this page open.');if($('youtubeAIStateV302'))$('youtubeAIStateV302').textContent='Working';
    try{const result=await askAI(ytPromptV308());if(out)out.value=result;if($('youtubeAIStateV302'))$('youtubeAIStateV302').textContent='Complete';ytStatus('Notes generated. Edit, translate, quiz, save or print.','ok');out?.dispatchEvent(new Event('input',{bubbles:true}))}
    catch(e){if(out)out.value='';if($('youtubeAIStateV302'))$('youtubeAIStateV302').textContent='Failed';ytStatus('Generation failed: '+e.message,'error')}
  };
  window.translateYouTubeTranscriptV308=async function(){
    const box=$('youtubeTranscriptV302'),text=box?.value.trim()||'';if(words(text)<20)return toast('Add a transcript first.','warn');const lang=$('youtubeLanguageV302')?.value||'Hindi';
    if(!confirm(`Use one AI call to clean and convert the transcript for ${lang}?`))return;
    const old=box.value;box.value='AI is cleaning and translating the transcript…';
    try{box.value=await askAI(`Clean this lecture transcript by removing timestamps, duplicate lines, promotions and filler. Preserve all meaningful content. ${languageRule(lang)} Do not summarise or add new facts. Return only the cleaned transcript.\n\n${old.slice(0,65000)}`,'youtube-translate');box.dispatchEvent(new Event('input',{bubbles:true}));toast('Transcript cleaned and converted.','success')}
    catch(e){box.value=old;toast(e.message,'error')}
  };
  window.generateYouTubeAddonV308=async function(kind){
    const transcript=$('youtubeTranscriptV302')?.value.trim()||'',notes=$('youtubeNotesOutputV302')?.value.trim()||'',source=notes||transcript;if(words(source)<40)return toast('Generate notes or add a transcript first.','warn');
    const lang=$('youtubeLanguageV302')?.value||'English',requests={chapters:'Create a concise chapter-wise outline with logical sections and timestamps only if they appear in the source.',mcq:'Create 10 high-quality UPSC Prelims MCQs with four options, answer and one-line explanation. Avoid invented facts.',mains:'Create three UPSC Mains questions (one 10-marker and two 15-markers) with demand breakdown and brief answer frameworks.',revision:'Create a one-page high-yield revision sheet with keywords, provisions, data, examples and a text flowchart.'};
    const out=$('youtubeNotesOutputV302');ytStatus(`Generating ${kind}…`);try{const result=await askAI(`${requests[kind]||requests.revision}\n${languageRule(lang)}\nUse only defensible content from the source.\n\nSOURCE:\n${source.slice(0,60000)}`,'youtube-'+kind);out.value=(notes?notes+'\n\n---\n\n':'')+result;out.dispatchEvent(new Event('input',{bubbles:true}));ytStatus(`${kind} added to notes.`, 'ok')}
    catch(e){ytStatus(e.message,'error')}
  };
  window.readYouTubeNotesV308=function(){
    const text=$('youtubeNotesOutputV302')?.value.trim()||'';if(!text)return toast('Generate notes first.','warn');speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text.slice(0,15000)),lang=$('youtubeLanguageV302')?.value||'English';u.lang=lang.includes('Hindi')||lang.includes('Hinglish')?'hi-IN':'en-IN';u.rate=.95;ytSpeech=u;speechSynthesis.speak(u);toast('Reading notes aloud.','success')
  };
  window.stopYouTubeSpeechV308=function(){speechSynthesis.cancel();ytSpeech=null};
  window.downloadYouTubeWordV308=function(){const title=$('youtubeTitleV302')?.value.trim()||'YouTube UPSC Notes',body=$('youtubeNotesOutputV302')?.value.trim()||'';if(!body)return toast('Generate notes first.','warn');const html=`<html><head><meta charset="utf-8"><title>${esc(title)}</title></head><body><h1>${esc(title)}</h1><pre style="white-space:pre-wrap;font-family:Arial;line-height:1.5">${esc(body)}</pre></body></html>`;downloadBlob(title.replace(/[^a-z0-9]+/gi,'-')+'.doc','application/msword',html)};
  function upgradeYouTube(){
    const sec=$('youtubeNotesV302'),lang=$('youtubeLanguageV302');if(!sec||!lang||sec.dataset.v308==='1')return;sec.dataset.v308='1';
    const options=['Hindi (Devanagari)','Hinglish (Roman Hindi)','Bilingual English + Hindi','English + Hindi keywords'];for(const value of options){if(![...lang.options].some(o=>o.value===value||o.text===value)){const o=document.createElement('option');o.value=o.textContent=value;lang.appendChild(o)}}
    const grid=sec.querySelector('.v302MetaGrid');if(grid&&!$('youtubeDepthV308')){const label=document.createElement('label');label.innerHTML='<span>Detail level</span><select id="youtubeDepthV308"><option>Quick</option><option selected>Detailed</option><option>Full Lecture</option></select>';grid.appendChild(label)}
    const sourceActions=sec.querySelector('.v302SourceActions');if(sourceActions&&!$('youtubeLanguageToolsV308')){const tools=document.createElement('div');tools.id='youtubeLanguageToolsV308';tools.className='v308YTTools';tools.innerHTML='<button type="button" onclick="translateYouTubeTranscriptV308()">🌐 Clean + Translate Transcript</button><span>Supports English, Hindi, Hinglish and bilingual notes.</span>';sourceActions.insertAdjacentElement('afterend',tools)}
    const outputActions=sec.querySelector('.v302OutputActions');if(outputActions&&!$('youtubeAddonToolsV308')){const tools=document.createElement('div');tools.id='youtubeAddonToolsV308';tools.className='v308YTAddon';tools.innerHTML='<button onclick="generateYouTubeAddonV308(\'chapters\')">🧭 Chapters</button><button onclick="generateYouTubeAddonV308(\'mcq\')">🧪 10 MCQs</button><button onclick="generateYouTubeAddonV308(\'mains\')">✍️ Mains Questions</button><button onclick="generateYouTubeAddonV308(\'revision\')">⚡ Revision Sheet</button><button onclick="readYouTubeNotesV308()">🔊 Read Notes</button><button onclick="stopYouTubeSpeechV308()">⏹ Stop Voice</button><button onclick="downloadYouTubeWordV308()">📄 Word</button>';outputActions.insertAdjacentElement('beforebegin',tools)}
  }

  /* ---------------- Progress Intelligence ---------------- */
  function progressHtml(){return `
    <div class="v308ProgressHero"><div><span>REAL SAVED DATA • CLEAR ACTIONS</span><h1>Progress & Improvement</h1><p>See consistency, subject progress, practice quality, revision load and the next actions—without a confusing dashboard.</p></div><div>📊</div></div>
    <div class="v308ProgressToolbar card"><label>Report period<select id="v308ProgressRange" onchange="refreshProgressV308()"><option value="7">Last 7 days</option><option value="30" selected>Last 30 days</option><option value="90">Last 90 days</option></select></label><button class="v308Primary" onclick="refreshProgressV308()">↻ Refresh</button><button onclick="aiImproveProgressV307()">✨ AI Coach Report</button><button onclick="printSimpleProgressV307()">🖨 Print / PDF</button></div>
    <div id="v307ProgressMetrics" class="v308MetricGrid"></div>
    <div class="v308ProgressGrid">
      <section class="card"><div class="v308SectionHead"><div><h2>Subject Progress</h2><p>Completion and focused work by subject.</p></div></div><div id="v308SubjectProgress" class="v308SubjectBars"></div></section>
      <section class="card"><div class="v308SectionHead"><div><h2>Consistency</h2><p>Daily study activity for the selected period.</p></div><span id="v308StreakBadge" class="v308Badge"></span></div><div id="v308Heatmap" class="v308Heatmap"></div><div id="v307WeeklySummary"></div></section>
      <section class="card"><div class="v308SectionHead"><div><h2>Practice & Tests</h2><p>Mains, MCQs and test performance.</p></div></div><div id="v308PracticeReport"></div></section>
      <section class="card"><div class="v308SectionHead"><div><h2>Backlog & Revision</h2><p>What needs immediate attention.</p></div></div><div id="v307Improvements"></div></section>
      <section class="card v308Full"><div class="v308SectionHead"><div><h2>Compared with Previous Period</h2><p>Understand whether your preparation is improving.</p></div></div><div id="v308Comparison" class="v308Comparison"></div></section>
      <section class="card v308Full"><div class="v308SectionHead"><div><h2>Next 7 Days</h2><p>Highest-impact actions from your real data.</p></div></div><div id="v307NextActions"></div></section>
      <section class="card v308Full"><div class="v308SectionHead"><div><h2>AI Coach Report</h2><p>Optional Gemini review. Run it only when you need deeper guidance.</p></div></div><div id="v307ProgressAI" class="v307ReportOutput">Press AI Coach Report for a detailed diagnosis.</div></section>
    </div>
    <details class="v307Advanced"><summary>Open older detailed analytics</summary><div class="v307Actions"><button onclick="show('rankReadinessV272')">Readiness Dashboard</button><button onclick="show('progressAutomationV274')">Automation Hub</button><button onclick="show('strategyRoomV271')">Strategy Room</button></div></details>`}
  function within(d,start,end){return d&&d>=start&&d<=end}
  function pct(n,d){return d?Math.round(n/d*100):0}
  function minutesOf(x){return Number(x.durationMin||x.minutes||x.duration||0)+(Number(x.seconds||0)/60)}
  async function collectProgress(days){
    const end=today(),start=addDays(end,-days+1),prevEnd=addDays(start,-1),prevStart=addDays(prevEnd,-days+1);
    const tasks=read(TASK_KEY,[]),focus=[...(await getCol('focusSessionsV262')),...(await getCol('focusSessions'))],mains=[...(await getCol('mainsReportsV252')),...(await getCol('mainsEvaluationsV235')),...(await getCol('mainsPracticeQueue'))],tests=[...(await getCol('prelimsReportsV251')),...(await getCol('tests')),...(await getCol('saarathiTests'))],revision=[...(await getCol('smartRevision')),...(await getCol('revision'))],ca=read(CA_TOPICS_KEY,[]),notes=[...(await getCol('notes')),...(await getCol('richNotesV4'))];
    const current=x=>within(dateOf(x),start,end),previous=x=>within(dateOf(x),prevStart,prevEnd);
    const curTasks=tasks.filter(current),prevTasks=tasks.filter(previous),done=x=>String(x.status||'').toLowerCase()==='done'||String(x.status||'').toLowerCase()==='completed';
    const focusMin=focus.filter(current).reduce((n,x)=>n+minutesOf(x),0),prevFocus=focus.filter(previous).reduce((n,x)=>n+minutesOf(x),0);
    const taskMin=curTasks.filter(done).reduce((n,x)=>n+Number(x.minutes||0),0),prevTaskMin=prevTasks.filter(done).reduce((n,x)=>n+Number(x.minutes||0),0);
    const activity={};for(const x of [...focus.filter(current),...curTasks.filter(done),...mains.filter(current),...tests.filter(current)]){const d=dateOf(x);if(d)activity[d]=(activity[d]||0)+Math.max(1,minutesOf(x)||20)}
    const activityDays=Object.keys(activity).length;
    let streak=0;for(let i=0;i<days;i++){const d=addDays(end,-i);if(activity[d])streak++;else if(i===0)continue;else break}
    const scored=tests.filter(current).filter(x=>Number(x.maxMarks||x.total||x.outOf)>0),prevScored=tests.filter(previous).filter(x=>Number(x.maxMarks||x.total||x.outOf)>0);
    const avg=a=>a.length?Math.round(a.reduce((n,x)=>n+Number(x.score||x.marks||0)/Number(x.maxMarks||x.total||x.outOf)*100,0)/a.length):null;
    const testAvg=avg(scored),prevAvg=avg(prevScored);
    const mainsCount=mains.filter(current).length,prevMains=mains.filter(previous).length;
    const mcqCount=curTasks.filter(x=>/prelim|mcq/i.test(String(x.type||x.title))).length+tests.filter(current).filter(x=>/prelim|mcq/i.test(String(x.type||x.title||x.testType))).length;
    const revDue=revision.filter(x=>!done(x)&&String(x.date||x.due||'9999-12-31').slice(0,10)<=end).length;
    const missed=curTasks.filter(x=>!done(x)&&String(x.date||'9999-12-31')<end).length;
    const caCount=ca.filter(current).length,noteCount=notes.filter(current).length;
    const subjects={};for(const x of curTasks){const s=x.subject||'General';subjects[s]??={planned:0,done:0,minutes:0};subjects[s].planned++;if(done(x)){subjects[s].done++;subjects[s].minutes+=Number(x.minutes||0)}}for(const x of focus.filter(current)){const s=x.subject||'General';subjects[s]??={planned:0,done:0,minutes:0};subjects[s].minutes+=minutesOf(x)}
    const completion=pct(curTasks.filter(done).length,curTasks.length),prevCompletion=pct(prevTasks.filter(done).length,prevTasks.length),consistency=pct(activityDays,days),plannedMin=curTasks.reduce((n,x)=>n+Number(x.minutes||0),0),actualMin=Math.max(focusMin,taskMin);
    const health=Math.round(completion*.28+Math.min(100,actualMin/Math.max(1,days*60)*100)*.22+Math.min(100,mainsCount/Math.max(1,Math.ceil(days*.6))*100)*.14+((testAvg??50)*.14)+Math.min(100,caCount/Math.max(1,Math.ceil(days*.7))*100)*.10+Math.max(0,100-Math.min(100,revDue*8))*.12);
    return {days,start,end,prevStart,prevEnd,curTasks,prevTasks,completion,prevCompletion,focusMin,prevFocus:Math.max(prevFocus,prevTaskMin),actualMin,plannedMin,activity,activityDays,streak,testAvg,prevAvg,mainsCount,prevMains,mcqCount,revDue,missed,caCount,noteCount,subjects,health,tests:scored.length};
  }
  function metric(label,value,note,tone=''){return `<div class="${tone}"><span>${esc(label)}</span><b>${esc(value)}</b><small>${esc(note)}</small></div>`}
  function diffBadge(cur,prev,suffix=''){const d=(cur||0)-(prev||0);return `<span class="${d>0?'up':d<0?'down':'flat'}">${d>0?'▲':d<0?'▼':'•'} ${Math.abs(d).toFixed(suffix==='h'?1:0)}${suffix}</span>`}
  window.refreshProgressV308=async function(){
    const days=Number($('v308ProgressRange')?.value||30),d=await collectProgress(days);progressSnapshot=d;
    if($('v307ProgressMetrics'))$('v307ProgressMetrics').innerHTML=[metric('Preparation health',d.health+'%','balanced index','good'),metric('Task completion',d.completion+'%',`${d.curTasks.filter(x=>/done|completed/i.test(x.status||'')).length}/${d.curTasks.length} tasks`),metric('Focused study',(d.actualMin/60).toFixed(1)+'h',`planned ${(d.plannedMin/60).toFixed(1)}h`),metric('Active days',`${d.activityDays}/${d.days}`,`${d.streak}-day current streak`),metric('Mains practice',d.mainsCount,'answers/evaluations'),metric('Test average',d.testAvg==null?'—':d.testAvg+'%',`${d.tests} scored tests`),metric('Revision due',d.revDue,'pending items',d.revDue>8?'warn':''),metric('Current affairs',d.caCount,'generated topics')].join('');
    const subjectEntries=Object.entries(d.subjects).sort((a,b)=>(b[1].done-b[1].planned)-(a[1].done-a[1].planned)||b[1].minutes-a[1].minutes);
    $('v308SubjectProgress').innerHTML=subjectEntries.length?subjectEntries.map(([s,x])=>{const p=x.planned?pct(x.done,x.planned):Math.min(100,Math.round(x.minutes/60*20));return `<div><div><b>${esc(s)}</b><span>${x.done}/${x.planned} tasks • ${(x.minutes/60).toFixed(1)}h</span></div><div class="v308Bar"><i style="width:${p}%"></i></div><small>${p}%</small></div>`}).join(''):'<div class="v308Empty">No subject activity saved for this period.</div>';
    const heat=[];for(let i=d.days-1;i>=0;i--){const day=addDays(d.end,-i),m=d.activity[day]||0,level=m>=120?4:m>=60?3:m>=30?2:m>0?1:0;heat.push(`<span data-level="${level}" title="${fmtDate(day)} • ${Math.round(m)} minutes"></span>`)}$('v308Heatmap').innerHTML=heat.join('');$('v308StreakBadge').textContent=`🔥 ${d.streak}-day streak`;
    $('v307WeeklySummary').innerHTML=`<div class="v308MiniStats"><span><b>${d.activityDays}</b> active days</span><span><b>${Math.round(d.actualMin/d.days)}</b> avg min/day</span><span><b>${d.noteCount}</b> notes saved</span><span><b>${d.caCount}</b> CA topics</span></div>`;
    $('v308PracticeReport').innerHTML=`<div class="v308PracticeGrid"><div><b>${d.mainsCount}</b><span>Mains records</span></div><div><b>${d.mcqCount}</b><span>MCQ/test actions</span></div><div><b>${d.tests}</b><span>Scored tests</span></div><div><b>${d.testAvg==null?'—':d.testAvg+'%'}</b><span>Average score</span></div></div><p class="v308Insight">${d.testAvg==null?'Add marks after tests to unlock performance trends.':d.testAvg<55?'Prioritise mistake analysis before the next test.':d.testAvg<70?'Performance is improving; strengthen weak themes.':'Good test quality—maintain timed practice and error review.'}</p>`;
    const gaps=[];if(d.completion<70)gaps.push(`${100-d.completion}% of planned work remains incomplete.`);if(d.missed)gaps.push(`${d.missed} scheduled tasks are overdue.`);if(d.revDue)gaps.push(`${d.revDue} revision items are due.`);if(d.mainsCount<Math.ceil(d.days*.4))gaps.push('Mains answer-writing frequency is below target.');if(d.actualMin<d.days*45)gaps.push('Focused study time is below a sustainable daily baseline.');if(d.testAvg!=null&&d.testAvg<55)gaps.push('Test accuracy needs systematic mistake analysis.');if(!gaps.length)gaps.push('No major red flag. Increase test quality gradually without over-planning.');$('v307Improvements').innerHTML=`<ul class="v308GapList">${gaps.slice(0,5).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;
    $('v308Comparison').innerHTML=`<div><span>Task completion</span><b>${d.completion}%</b>${diffBadge(d.completion,d.prevCompletion,'%')}</div><div><span>Focused study</span><b>${(d.actualMin/60).toFixed(1)}h</b>${diffBadge(d.actualMin/60,d.prevFocus/60,'h')}</div><div><span>Mains practice</span><b>${d.mainsCount}</b>${diffBadge(d.mainsCount,d.prevMains)}</div><div><span>Test average</span><b>${d.testAvg==null?'—':d.testAvg+'%'}</b>${d.testAvg==null||d.prevAvg==null?'<span class="flat">No comparison</span>':diffBadge(d.testAvg,d.prevAvg,'%')}</div>`;
    const actions=[];if(d.revDue)actions.push('Clear two oldest revision items.');if(d.missed)actions.push('Reschedule the highest-priority overdue task.');if(d.mainsCount<5)actions.push('Write one 10-marker answer today.');if(d.tests<1)actions.push('Schedule one timed subject test.');if(d.caCount<Math.max(3,Math.ceil(d.days/7*4)))actions.push('Complete today’s current-affairs brief.');actions.push('Finish one focused 50-minute session on the weakest subject.');$('v307NextActions').innerHTML=`<div class="v307ActionPlan">${actions.slice(0,5).map((x,i)=>`<div><b>${i+1}</b><span>${esc(x)}</span><button onclick="prefillMissionActionV307('${esc(x)}')">Add to Mission</button></div>`).join('')}</div>`;
    return d;
  };
  window.refreshSimpleProgressV307=async function(){upgradeProgress();return await window.refreshProgressV308()};
  window.aiImproveProgressV307=async function(){try{const d=progressSnapshot||await window.refreshProgressV308();$('v307ProgressAI').textContent='Generating a strict, practical review…';const compact={period:`${d.days} days`,health:d.health,completion:d.completion,studyHours:Number((d.actualMin/60).toFixed(1)),activeDays:d.activityDays,streak:d.streak,mains:d.mainsCount,testAverage:d.testAvg,revisionDue:d.revDue,overdueTasks:d.missed,currentAffairs:d.caCount,subjects:d.subjects};const result=await askAI(`Act as a strict UPSC mentor. Based only on the saved preparation metrics below, provide: 1) honest diagnosis, 2) strongest area, 3) weakest area, 4) three measurable corrections, 5) seven-day plan, 6) one warning against over-planning. Keep it practical and concise.\n\n${JSON.stringify(compact)}`,'progress-report');$('v307ProgressAI').innerHTML=typeof window.formatAI==='function'?window.formatAI(result):`<pre>${esc(result)}</pre>`}catch(e){$('v307ProgressAI').textContent=e.message}};
  window.printSimpleProgressV307=function(){const sec=$('simpleProgressV307');if(!sec)return;const w=open('','_blank','width=1100,height=900');w.document.write(`<html><head><title>JARVIS Progress Report</title><style>body{font-family:Arial;padding:28px;color:#17324c;line-height:1.5}button,select{display:none}.v308MetricGrid,.v308Comparison,.v308PracticeGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.card,.v308MetricGrid>div,.v308Comparison>div,.v308PracticeGrid>div{border:1px solid #ccd8e2;border-radius:10px;padding:12px;margin:10px 0}.v308Heatmap{display:flex;gap:3px;flex-wrap:wrap}.v308Heatmap span{width:12px;height:12px;background:#cfe3db}.v308Bar{height:8px;background:#e6edf3}.v308Bar i{display:block;height:100%;background:#1b8f75}</style></head><body>${sec.innerHTML}<script>onload=()=>print()<\/script></body></html>`);w.document.close()};
  function upgradeProgress(){const sec=$('simpleProgressV307');if(!sec||sec.dataset.v308==='1')return;sec.dataset.v308='1';sec.innerHTML=progressHtml();setTimeout(window.refreshProgressV308,100)}

  /* ---------------- navigation and bootstrap ---------------- */
  function upgradeVersion(){if(window.__JARVIS_TRACKER_V32_ACTIVE__)return;document.title='Jarvis UPSC V30.8.0 — Final Refinement';const b=document.querySelector('.versionBadge');if(b)b.textContent='V30.8.0 • Refined Daily System'}
  function wrapShow(){const old=window.show;if(typeof old!=='function'||old.__v308)return;const fn=function(id,btn){const r=old.apply(this,arguments);setTimeout(()=>{if(id==='currentAffairsAI'){rebuildCA();refreshCAStats();try{window.renderCATopicsV307?.()}catch(_){}}if(id==='countdownPage'){installCountdownV308();renderCountdownV308()}if(id==='youtubeNotesV302')upgradeYouTube();if(id==='simpleProgressV307'){upgradeProgress();window.refreshProgressV308()}},100);return r};fn.__v308=true;window.show=fn}
  function init(){upgradeVersion();wrapShow();rebuildCA();installCountdownV308();upgradeYouTube();upgradeProgress();refreshCAStats();console.info('Mission UPSC V30.8.0 refinement loaded')}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{setTimeout(init,300);setTimeout(init,900)});else{setTimeout(init,300);setTimeout(init,900)}
  window.addEventListener('load',()=>setTimeout(init,1600),{once:true});
})();

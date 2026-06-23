/* Mission UPSC AI OS V30.5.0 — Voice reliability + manual Daily CA Tracker */
(function(){
  'use strict';
  const VERSION='30.5.0';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const read=(k,f)=>{try{const x=JSON.parse(localStorage.getItem(k)||'');return x??f}catch(_){return f}};
  const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const today=()=>new Date().toISOString().slice(0,10);
  const QUEUE_KEY='mission_ca_queue_v305';
  const TOPICS_KEY='mission_ca_topics_v305';
  const RUNS_KEY='mission_ca_runs_v305';
  const MIC_KEY='mission_mic_state_v305';
  const LOCAL_COLLECTION_PREFIX='mission_local_collection_';
  let recognition=null,micError=false,selectedTopicId='',sourceCategory='Core Daily';

  function toast(msg,type='info'){
    if(typeof window.showToast==='function')return window.showToast(msg,type);
    const e=document.createElement('div');e.textContent=msg;e.style.cssText='position:fixed;right:18px;bottom:18px;z-index:99999;background:#082a4e;color:white;padding:12px 15px;border-radius:12px;box-shadow:0 12px 30px #0003;max-width:330px';document.body.appendChild(e);setTimeout(()=>e.remove(),3300);
  }
  function words(v){return (String(v||'').trim().match(/\S+/g)||[]).length}
  function textArray(v){if(Array.isArray(v))return v.filter(Boolean).map(String);if(v==null||v==='')return[];return String(v).split(/\n|•|;(?=\s)/).map(x=>x.replace(/^[-*\d.)\s]+/,'').trim()).filter(Boolean)}
  function cleanJson(raw){let s=String(raw||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');const a=s.indexOf('{'),b=s.lastIndexOf('}');if(a>=0&&b>a)s=s.slice(a,b+1);return JSON.parse(s)}
  function uid(prefix='ca'){return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`}
  async function saveCollection(name,obj){
    if(typeof window.saveCol==='function'){try{return await window.saveCol(name,obj)}catch(_){} }
    if(typeof window.safeSaveColV4==='function'){try{return await window.safeSaveColV4(name,obj)}catch(_){} }
    const k=LOCAL_COLLECTION_PREFIX+name,a=read(k,[]);a.push({...obj,id:obj.id||uid(name)});write(k,a);return obj;
  }
  async function getCollection(name){
    if(typeof window.getCol==='function'){try{const a=await window.getCol(name);if(Array.isArray(a))return a}catch(_){} }
    if(typeof window.safeGetColV4==='function'){try{const a=await window.safeGetColV4(name);if(Array.isArray(a))return a}catch(_){} }
    return read(LOCAL_COLLECTION_PREFIX+name,[]);
  }
  async function askGemini(prompt){
    if(typeof window.missionAskGeminiV304==='function')return await window.missionAskGeminiV304(prompt);
    if(typeof window.missionAskAI==='function')return await window.missionAskAI(prompt,{task:'current-affairs',forceProvider:'gemini'});
    if(typeof window.aiAskRouterV23==='function')return await window.aiAskRouterV23(prompt,{task:'current-affairs'});
    throw new Error('Secure Gemini router is not ready. Test Gemini in AI Control Centre.');
  }

  /* ---------------- Voice Saarthi reliable permission flow ---------------- */
  function micPanel(){return $('v305MicPanel')}
  function setMicPanel(state,title,detail){
    const p=micPanel();if(!p)return;p.dataset.state=state;
    const badge=$('v305MicBadge'),h=$('v305MicTitle'),d=$('v305MicDetail');
    if(badge)badge.textContent=({granted:'MIC READY',denied:'MIC BLOCKED',unsupported:'TEXT MODE',prompt:'PERMISSION NEEDED',checking:'CHECKING',idle:'OPTIONAL'}[state]||state.toUpperCase());
    if(h)h.textContent=title;if(d)d.textContent=detail;
  }
  function voiceStatus(msg){const e=$('voiceStatusV244');if(e)e.textContent=msg||''}
  function voiceUI(active){$('voiceMeterV244')?.classList.toggle('active',!!active);$('voiceSaarthi')?.classList.toggle('is-listening',!!active)}
  async function permissionState(){
    if(!navigator.permissions?.query)return 'unknown';
    try{return (await navigator.permissions.query({name:'microphone'})).state}catch(_){return 'unknown'}
  }
  function speechSupport(){return window.SpeechRecognition||window.webkitSpeechRecognition}
  function setTextMode(on=true){$('voiceSaarthi')?.classList.toggle('v305TextMode',on);if(on){setMicPanel('unsupported','Text mode is active','Type your command below and press Ask AI. Voice is optional; Saarthi AI still works normally.');$('voiceSaarthiText')?.focus()}else $('voiceSaarthi')?.classList.remove('v305TextMode')}
  async function refreshMicState(){
    if(!window.isSecureContext){setMicPanel('denied','Secure connection required','Open the deployed HTTPS website, not a local file. Text mode remains available.');return 'denied'}
    if(!speechSupport()){setMicPanel('unsupported','Browser voice recognition unavailable','Use text mode, or open the HTTPS site in a current Chrome/Edge browser.');return 'unsupported'}
    setMicPanel('checking','Checking microphone','No permission request is made until you press Enable / Test Mic.');
    const state=await permissionState();
    if(state==='granted'){write(MIC_KEY,{state:'granted'});setMicPanel('granted','Microphone is ready','Press Start Listening once, speak, then review the captured text.');}
    else if(state==='denied'){write(MIC_KEY,{state:'denied'});setMicPanel('denied','Microphone permission is blocked','Allow microphone access for this site in browser settings, then press Recheck. No repeated pop-ups will be shown.');}
    else setMicPanel('prompt','Microphone has not been enabled','Press Enable / Test Mic when you are ready. You can always use text mode.');
    return state;
  }
  async function enableMicV305(){
    if(!window.isSecureContext){await refreshMicState();return}
    if(!navigator.mediaDevices?.getUserMedia){setMicPanel('unsupported','Microphone test unavailable','Use text mode or a current browser.');return}
    setMicPanel('checking','Waiting for browser permission','Choose Allow once. JARVIS does not record or upload audio; speech recognition only fills the text box.');
    try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});stream.getTracks().forEach(t=>t.stop());write(MIC_KEY,{state:'granted'});setTextMode(false);setMicPanel('granted','Microphone enabled','Press Start Listening and speak your UPSC command.');voiceStatus('✅ Microphone permission granted.');}
    catch(e){write(MIC_KEY,{state:'denied',error:e.name});setMicPanel('denied','Microphone permission was not granted','Use text mode now, or allow the microphone for this site and press Recheck.');voiceStatus('Microphone is blocked. Text input remains fully available.');}
  }
  function installVoicePanel(){
    const section=$('voiceSaarthi'),panel=section?.querySelector('.v24Panel');if(!section||!panel||$('v305MicPanel'))return;
    const box=document.createElement('div');box.id='v305MicPanel';box.className='v305MicPanel';box.dataset.state='idle';box.innerHTML=`<div class="v305MicPanelHead"><div><h3 id="v305MicTitle">Voice is optional</h3><p id="v305MicDetail">Saarthi works with typed commands even when browser speech recognition is unavailable.</p></div><span id="v305MicBadge" class="v305MicBadge">OPTIONAL</span></div><div class="v305MicActions"><button class="primary" type="button" onclick="enableMicV305()">🎙 Enable / Test Mic</button><button type="button" onclick="refreshMicStateV305()">↻ Recheck</button><button class="textMode" type="button" onclick="useVoiceTextModeV305()">⌨ Use Text Mode</button></div><div class="v305VoiceHint">Microphone permission is requested only after you press Enable / Test Mic. Permission errors stay inside this panel instead of appearing repeatedly.</div>`;
    const meter=panel.querySelector('.voiceMeterV244');(meter||panel.firstElementChild)?.insertAdjacentElement(meter?'beforebegin':'afterend',box);refreshMicState();
  }
  window.enableMicV305=enableMicV305;window.refreshMicStateV305=refreshMicState;window.useVoiceTextModeV305=()=>setTextMode(true);
  window.startVoiceSaarthi=async function(){
    if(recognition){try{recognition.stop()}catch(_){}return}
    if(!speechSupport()){setTextMode(true);voiceStatus('Voice recognition is unavailable. Type your command and press Ask AI.');return}
    const p=await permissionState();
    if(p==='denied'||read(MIC_KEY,{}).state==='denied'){setMicPanel('denied','Microphone permission is blocked','Allow it in browser site settings and press Recheck, or continue in text mode.');voiceStatus('Microphone blocked — text mode is ready.');return}
    const SR=speechSupport(),field=$('voiceSaarthiText');micError=false;let finalText='';
    recognition=new SR();recognition.lang=$('voiceLanguageV244')?.value||'en-IN';recognition.continuous=false;recognition.interimResults=true;
    recognition.onstart=()=>{setTextMode(false);voiceUI(true);setMicPanel('granted','Listening now','Speak clearly. Audio is not stored by JARVIS.');voiceStatus('🎙 Listening…')};
    recognition.onresult=e=>{let interim='';for(let i=e.resultIndex;i<e.results.length;i++){const t=e.results[i][0].transcript;if(e.results[i].isFinal)finalText+=t+' ';else interim+=t}if(field){field.value=(finalText+interim).trim();field.dispatchEvent(new Event('input',{bubbles:true}))}};
    recognition.onerror=e=>{micError=true;const err=e.error||'unknown';voiceUI(false);
      if(err==='not-allowed'||err==='service-not-allowed'){write(MIC_KEY,{state:'denied',error:err});setMicPanel('denied','Microphone permission is blocked','Allow microphone access for this site, then press Recheck. Text mode is ready.');voiceStatus('Microphone blocked — no repeated permission alert will be shown.');}
      else if(err==='no-speech'){setMicPanel('granted','No speech detected','Try once more, move closer to the microphone, or type the command.');voiceStatus('No speech detected.');}
      else if(err==='audio-capture'){setMicPanel('denied','No microphone was detected','Check your device input or use text mode.');voiceStatus('No microphone input available.');}
      else if(err==='network'){setMicPanel('unsupported','Browser speech service unavailable','Your internet/browser speech service could not respond. Type the command instead.');voiceStatus('Speech service unavailable — text mode works.');}
      else{setMicPanel('prompt','Voice could not start',`Error: ${err}. Type your command or press Recheck.`);voiceStatus(`Voice error: ${err}`)}
    };
    recognition.onend=()=>{recognition=null;voiceUI(false);if(!micError){const heard=field?.value.trim();setMicPanel('granted',heard?'Voice captured':'Ready to listen',heard?'Review the text, then press Ask AI.':'Press Start Listening or type your command.');voiceStatus(heard?'✅ Voice captured. Press Ask AI.':'Ready.')}};
    try{recognition.start()}catch(e){recognition=null;voiceUI(false);setMicPanel('prompt','Microphone could not start','Wait a moment and retry, or use text mode.');voiceStatus('Microphone could not start.');}
  };
  window.stopVoiceSaarthiV244=function(){try{recognition?.stop()}catch(_){}recognition=null;voiceUI(false);try{speechSynthesis?.cancel()}catch(_){}voiceStatus('Stopped. Type or speak another command.');};

  /* ---------------- Daily CA Tracker ---------------- */
  const SOURCES=[
    {cat:'Core Daily',name:'The Hindu',icon:'📰',note:'News & editorials',url:'https://www.thehindu.com/'},
    {cat:'Core Daily',name:'Indian Express',icon:'🗞️',note:'Explained & editorials',url:'https://indianexpress.com/'},
    {cat:'Core Daily',name:'PIB',icon:'🏛️',note:'Official releases',url:'https://pib.gov.in/'},
    {cat:'Core Daily',name:'PRS India',icon:'⚖️',note:'Bills & Parliament',url:'https://prsindia.org/'},
    {cat:'Economy',name:'RBI',icon:'🏦',note:'Monetary & banking',url:'https://www.rbi.org.in/'},
    {cat:'Economy',name:'Economic Survey',icon:'📊',note:'Official data & analysis',url:'https://www.indiabudget.gov.in/economicsurvey/'},
    {cat:'Economy',name:'Union Budget',icon:'💼',note:'Budget documents',url:'https://www.indiabudget.gov.in/'},
    {cat:'Economy',name:'Finance Ministry',icon:'₹',note:'Policy releases',url:'https://finmin.gov.in/'},
    {cat:'Economy',name:'MoSPI',icon:'📈',note:'Official statistics',url:'https://www.mospi.gov.in/'},
    {cat:'Government',name:'NITI Aayog',icon:'🧭',note:'Policy reports',url:'https://www.niti.gov.in/'},
    {cat:'Government',name:'Sansad',icon:'🏛️',note:'Parliament business',url:'https://sansad.in/'},
    {cat:'Government',name:'India Code',icon:'📜',note:'Central laws',url:'https://www.indiacode.nic.in/'},
    {cat:'Government',name:'e-Gazette',icon:'📃',note:'Official notifications',url:'https://egazette.nic.in/'},
    {cat:'Government',name:'Supreme Court',icon:'⚖️',note:'Judgments & updates',url:'https://www.sci.gov.in/'},
    {cat:'IR & Security',name:'MEA',icon:'🌐',note:'Foreign policy',url:'https://www.mea.gov.in/'},
    {cat:'IR & Security',name:'MHA',icon:'🛡️',note:'Internal security',url:'https://www.mha.gov.in/'},
    {cat:'Environment & S&T',name:'MoEFCC',icon:'🌿',note:'Environment policy',url:'https://moef.gov.in/'},
    {cat:'Environment & S&T',name:'Down To Earth',icon:'🌍',note:'Environment reporting',url:'https://www.downtoearth.org.in/'},
    {cat:'Environment & S&T',name:'ISRO',icon:'🚀',note:'Space & science',url:'https://www.isro.gov.in/'},
    {cat:'Reports',name:'World Bank India',icon:'🌎',note:'Development reports',url:'https://www.worldbank.org/en/country/india'},
    {cat:'Reports',name:'UN India',icon:'🇺🇳',note:'UN reports & SDGs',url:'https://india.un.org/'},
    {cat:'Reports',name:'WHO India',icon:'⚕️',note:'Health reports',url:'https://www.who.int/india'},
    {cat:'Magazines',name:'Publications Division',icon:'📚',note:'Yojana & Kurukshetra',url:'https://publicationsdivision.nic.in/'},
    {cat:'Magazines',name:'AIR News',icon:'📻',note:'Official news bulletins',url:'https://www.newsonair.gov.in/'},
    {cat:'Supplementary',name:'Business Standard',icon:'📉',note:'Economy & policy',url:'https://www.business-standard.com/'},
    {cat:'Supplementary',name:'Mint',icon:'💹',note:'Economy explainers',url:'https://www.livemint.com/'}
  ];
  function queue(){const q=read(QUEUE_KEY,[]);return Array.isArray(q)?q:[]}
  function topics(){const q=read(TOPICS_KEY,[]);return Array.isArray(q)?q:[]}
  function runs(){const q=read(RUNS_KEY,[]);return Array.isArray(q)?q:[]}
  function setCAStatus(msg,type=''){const e=$('v305CAStatus');if(!e)return;e.className='v305CAStatus'+(type?' '+type:'');e.textContent=msg}
  function selectedQueue(){return queue().filter(x=>x.selected!==false)}
  function sourceByName(name){return SOURCES.find(s=>s.name===name)||{name:name||'Other',url:'',cat:'Other'} }
  function setSource(name,url=''){
    if($('v305CASource'))$('v305CASource').value=name||'Other';if($('v305CAUrl')&&!$('v305CAUrl').value)$('v305CAUrl').value=url||'';$('v305CATitle')?.focus();
  }
  window.useCASourceV305=(name,url)=>setSource(name,url);
  function renderSources(){
    const tabs=$('v305CASourceTabs'),box=$('v305CASources');if(!tabs||!box)return;
    const cats=['Core Daily',...new Set(SOURCES.map(s=>s.cat).filter(c=>c!=='Core Daily'))];
    tabs.innerHTML=cats.map(c=>`<button type="button" class="${c===sourceCategory?'active':''}" onclick="filterCASourcesV305('${esc(c)}')">${esc(c)}</button>`).join('');
    box.innerHTML=SOURCES.filter(s=>s.cat===sourceCategory).map(s=>`<div class="v305CASource"><i>${s.icon}</i><div><b>${esc(s.name)}</b><small>${esc(s.note)}</small></div><a href="${esc(s.url)}" target="_blank" rel="noopener">Open ↗</a><button type="button" onclick="useCASourceV305('${esc(s.name)}','${esc(s.url)}')">＋ Use in queue</button></div>`).join('');
  }
  window.filterCASourcesV305=cat=>{sourceCategory=cat;renderSources()};
  function addQueueItem(){
    const title=$('v305CATitle')?.value.trim(),excerpt=$('v305CAExcerpt')?.value.trim();if(!title&&!excerpt)return toast('Add a headline or source excerpt first.','warn');
    const item={id:uid('lead'),date:$('v305CADate')?.value||today(),title:title||excerpt.slice(0,90),source:$('v305CASource')?.value||'Other',url:$('v305CAUrl')?.value.trim()||'',excerpt,selected:true,addedAt:new Date().toISOString()};
    const q=queue();q.unshift(item);write(QUEUE_KEY,q.slice(0,80));['v305CATitle','v305CAUrl','v305CAExcerpt'].forEach(id=>{if($(id))$(id).value=''});renderQueue();setCAStatus('Source item added without using AI tokens. Add more items or generate when ready.','success');
  }
  window.addCAQueueV305=addQueueItem;
  window.removeCAQueueV305=id=>{write(QUEUE_KEY,queue().filter(x=>x.id!==id));renderQueue()};
  window.toggleCAQueueV305=(id,checked)=>{write(QUEUE_KEY,queue().map(x=>x.id===id?{...x,selected:checked}:x));updateCABudget()};
  window.clearCAQueueV305=()=>{if(confirm('Clear all unprocessed source items?')){write(QUEUE_KEY,[]);renderQueue()}};
  function renderQueue(){
    const box=$('v305CAQueue');if(!box)return;const q=queue();
    box.innerHTML=q.length?q.map(x=>`<div class="v305CAQueueItem"><input type="checkbox" ${x.selected!==false?'checked':''} onchange="toggleCAQueueV305('${x.id}',this.checked)"><div><h4>${esc(x.title)}</h4><p>${esc((x.excerpt||'No excerpt pasted').slice(0,190))}${(x.excerpt||'').length>190?'…':''}</p><div class="meta"><span>${esc(x.source)}</span><span>${esc(x.date)}</span><span>${words(x.excerpt)} words</span></div></div><button type="button" title="Remove" onclick="removeCAQueueV305('${x.id}')">✕</button></div>`).join(''):'<div class="v305CAEmpty">No source items queued. Open a source, paste the relevant excerpt, and add it here. No AI tokens are used until you press Generate.</div>';
    updateCABudget();
  }
  function updateCABudget(){
    const q=selectedQueue(),inWords=q.reduce((n,x)=>n+words(x.title+' '+x.excerpt),0),depth=$('v305CADepth')?.value||'Balanced',requested=Number($('v305CAMaxTopics')?.value||8),max=depth==='Deep'?Math.min(requested,5):depth==='Balanced'?Math.min(requested,8):Math.min(requested,12),chosen=q.slice(0,max),outPer={Quick:350,Balanced:700,Deep:1150}[depth]||700,approxIn=Math.ceil(inWords*1.35),approxOut=chosen.length*outPer,total=approxIn+approxOut;
    if($('v305CAQueuedCount'))$('v305CAQueuedCount').textContent=q.length;if($('v305CATokenEstimate'))$('v305CATokenEstimate').textContent=`≈ ${total.toLocaleString()} tokens`;if($('v305CABudgetText'))$('v305CABudgetText').textContent=`${chosen.length} topic${chosen.length===1?'':'s'} • ${depth} depth • one manual Gemini call`;const b=$('v305GenerateBtn');if(b)b.disabled=!chosen.length;
  }
  window.updateCABudgetV305=updateCABudget;
  function importDigest(){
    const raw=$('v305CADigestImport')?.value.trim();if(!raw)return toast('Paste your daily digest first.','warn');
    const blocks=raw.split(/\n\s*\n(?=(?:\d+[.)]|[-•*]|[A-Z][^\n]{4,100}\n))/).map(x=>x.trim()).filter(Boolean);const date=$('v305CADate')?.value||today(),source=$('v305CASource')?.value||'Mixed Sources';const add=blocks.slice(0,30).map((b,i)=>{const lines=b.split('\n').map(x=>x.trim()).filter(Boolean),title=(lines.shift()||`Daily item ${i+1}`).replace(/^(?:\d+[.)]|[-•*])\s*/,'');return{id:uid('lead'),date,title:title.slice(0,180),source,url:'',excerpt:lines.join('\n')||b,selected:true,addedAt:new Date().toISOString()}});write(QUEUE_KEY,[...add,...queue()].slice(0,100));$('v305CADigestImport').value='';renderQueue();setCAStatus(`${add.length} digest item(s) added without using AI tokens.`,'success');
  }
  window.importCADigestV305=importDigest;
  function promptForCA(items,depth,date){
    const rules=depth==='Quick'?'Keep every topic compact: about 250-350 words plus questions.':depth==='Deep'?'Provide deep issue analysis, but stay source-conscious and avoid padding.':'Provide balanced exam-ready analysis with concise sections.';
    const payload=items.map((x,i)=>`SOURCE ITEM ${i+1}\nTitle: ${x.title}\nSource: ${x.source}\nDate: ${x.date||date}\nURL (metadata only): ${x.url||'Not supplied'}\nSource excerpt:\n${x.excerpt||'[Only headline supplied — clearly flag facts needing verification]'}`).join('\n\n---\n\n');
    return `Act as a senior UPSC Daily Current Affairs editor. Transform ONLY the supplied source items into a Tracker-style exam database. ${rules}\n\nReturn ONLY valid JSON with no markdown fences using this schema:\n{"date":"YYYY-MM-DD","dailySummary":"2-4 sentence overview","topics":[{"id":"short-stable-id","title":"","source":"","sourceUrl":"","subject":"Polity|Economy|Environment|Science & Tech|IR|Security|Social Issues|Geography|Ethics|Culture|Governance|History|Other","gsPapers":["Prelims","GS1","GS2","GS3","GS4","Essay"],"syllabusLinks":["exact syllabus phrase or concise mapping"],"importance":"High|Medium|Low","relevance":["Prelims","Mains","Essay","Interview"],"tags":[""],"whyInNews":"","simpleExplanation":"","background":[""],"prelimsFacts":[""],"prelimsTraps":[""],"mainsDimensions":[{"heading":"","points":[""]}],"lawsInstitutions":[""],"dataReports":[""],"opportunities":[""],"challenges":[""],"wayForward":[""],"pyqThemes":["Genuine PYQ theme; write Needs verification if exact year/question is uncertain"],"probableQuestions":{"prelims":"","mains10":"","mains15":""},"revisionCapsule":[""],"mindMap":"node -> node -> node"}]}\n\nStrict rules:\n- Do not invent facts, data, reports, judgments, schemes, dates or PYQs.\n- Treat URLs as metadata; analyse the pasted excerpt, not unseen webpage content.\n- Clearly state Needs verification wherever source text is insufficient.\n- Remove duplicate/noise topics and merge only genuinely overlapping items.\n- Prioritise UPSC relevance over general news.\n- Preserve source attribution for each topic.\n- Date for this digest: ${date}.\n\n${payload}`;
  }
  function normalizeTopic(t,date){return{id:t.id||uid('topic'),date,createdAt:new Date().toISOString(),title:String(t.title||'Untitled Current Affair'),source:String(t.source||'Other'),sourceUrl:String(t.sourceUrl||''),subject:String(t.subject||'Other'),gsPapers:textArray(t.gsPapers),syllabusLinks:textArray(t.syllabusLinks),importance:['High','Medium','Low'].includes(t.importance)?t.importance:'Medium',relevance:textArray(t.relevance),tags:textArray(t.tags),whyInNews:String(t.whyInNews||''),simpleExplanation:String(t.simpleExplanation||''),background:textArray(t.background),prelimsFacts:textArray(t.prelimsFacts),prelimsTraps:textArray(t.prelimsTraps),mainsDimensions:Array.isArray(t.mainsDimensions)?t.mainsDimensions:[],lawsInstitutions:textArray(t.lawsInstitutions),dataReports:textArray(t.dataReports),opportunities:textArray(t.opportunities),challenges:textArray(t.challenges),wayForward:textArray(t.wayForward),pyqThemes:textArray(t.pyqThemes),probableQuestions:t.probableQuestions||{},revisionCapsule:textArray(t.revisionCapsule),mindMap:String(t.mindMap||''),studied:false,saved:false,version:'v30.5'} }
  async function generateCA(){
    const all=selectedQueue(),depth=$('v305CADepth')?.value||'Balanced',requested=Math.max(1,Number($('v305CAMaxTopics')?.value||8)),max=depth==='Deep'?Math.min(requested,5):depth==='Balanced'?Math.min(requested,8):Math.min(requested,12),items=all.slice(0,max);if(!items.length)return;
    const date=$('v305CADate')?.value||today(),estimate=$('v305CATokenEstimate')?.textContent||'';
    const oldRun=runs().find(r=>r.date===date);if(oldRun&&!confirm(`A current-affairs generation was already recorded for ${date}. Generate again and consume more Gemini tokens?`))return;
    if(!confirm(`Generate ${items.length} selected topic(s) in one Gemini call?\nEstimated usage: ${estimate}\nDepth: ${depth}\n\nAI will run only after you confirm.`))return;
    const btn=$('v305GenerateBtn');if(btn){btn.disabled=true;btn.textContent='⏳ Gemini is generating…'}setCAStatus('Secure Gemini is analysing only the selected queue items. Keep this page open.');
    try{
      const started=Date.now(),raw=await askGemini(promptForCA(items,depth,date)),json=cleanJson(raw),newTopics=(json.topics||[]).map(t=>normalizeTopic(t,json.date||date));if(!newTopics.length)throw new Error('Gemini returned no topic cards.');
      const existing=topics(),seen=new Set();const merged=[...newTopics,...existing].filter(t=>{const k=(t.date+'|'+t.title).toLowerCase();if(seen.has(k))return false;seen.add(k);return true});write(TOPICS_KEY,merged.slice(0,500));
      const usedIds=new Set(items.map(x=>x.id));write(QUEUE_KEY,queue().filter(x=>!usedIds.has(x.id)));
      const log={id:uid('run'),date,createdAt:new Date().toISOString(),topics:newTopics.length,depth,estimatedTokens:estimate,ms:Date.now()-started,summary:json.dailySummary||''};write(RUNS_KEY,[log,...runs()].slice(0,100));
      for(const t of newTopics){await saveCollection('currentAffairsAI',{id:t.id,title:t.title,subject:t.subject,source:t.source,date:t.date,article:items.find(i=>i.title===t.title)?.excerpt||'',note:topicText(t),analysis:t,version:'v30.5'}).catch(()=>{})}
      selectedTopicId=newTopics[0].id;renderAllCA();setCAStatus(`${newTopics.length} UPSC-relevant topic card(s) generated and saved. Queue items used in this run were cleared.`,'success');
    }catch(e){setCAStatus(`Generation failed: ${e.message}. Your source queue is preserved; no item was deleted.`,'error');}
    finally{if(btn){btn.textContent='✨ Generate Today’s CA with Gemini';updateCABudget()}}
  }
  window.generateDailyCAV305=generateCA;
  function topicText(t){
    const list=(title,a)=>a?.length?`\n${title}\n${a.map(x=>'• '+(typeof x==='string'?x:(x.heading+': '+textArray(x.points).join('; ')))).join('\n')}`:'';
    return `${t.title}\nSource: ${t.source} | Date: ${t.date}\nSubject: ${t.subject} | Importance: ${t.importance}\nGS: ${t.gsPapers.join(', ')}\n\nWHY IN NEWS\n${t.whyInNews}\n\nSIMPLE EXPLANATION\n${t.simpleExplanation}${list('BACKGROUND',t.background)}${list('PRELIMS FACTS',t.prelimsFacts)}${list('PRELIMS TRAPS',t.prelimsTraps)}${list('MAINS DIMENSIONS',t.mainsDimensions)}${list('LAWS / INSTITUTIONS',t.lawsInstitutions)}${list('DATA / REPORTS',t.dataReports)}${list('OPPORTUNITIES',t.opportunities)}${list('CHALLENGES',t.challenges)}${list('WAY FORWARD',t.wayForward)}${list('PYQ THEMES',t.pyqThemes)}\n\nPROBABLE QUESTIONS\nPrelims: ${t.probableQuestions.prelims||''}\n10 marker: ${t.probableQuestions.mains10||''}\n15 marker: ${t.probableQuestions.mains15||''}${list('REVISION CAPSULE',t.revisionCapsule)}\n\nMIND MAP\n${t.mindMap}`;
  }
  function renderStats(){const ts=topics(),day=$('v305CADate')?.value||today(),daily=ts.filter(x=>x.date===day),due=daily.filter(x=>!x.studied).length,high=daily.filter(x=>x.importance==='High').length,run=runs().find(x=>x.date===day);const vals={v305StatTopics:daily.length,v305StatHigh:high,v305StatPending:due,v305StatQueue:queue().length,v305StatRun:run?'Generated':'Not run'};Object.entries(vals).forEach(([id,v])=>{if($(id))$(id).textContent=v})}
  function filteredTopics(){const q=($('v305CASearch')?.value||'').toLowerCase(),date=$('v305CAFilterDate')?.value||'',subject=$('v305CAFilterSubject')?.value||'All',importance=$('v305CAFilterImportance')?.value||'All';return topics().filter(t=>(!date||t.date===date)&&(subject==='All'||t.subject===subject)&&(importance==='All'||t.importance===importance)&&(!q||JSON.stringify(t).toLowerCase().includes(q)))}
  function renderTopicRail(){const box=$('v305CATopicList');if(!box)return;const a=filteredTopics();if(!selectedTopicId&&a[0])selectedTopicId=a[0].id;if(selectedTopicId&&!a.some(x=>x.id===selectedTopicId)&&a[0])selectedTopicId=a[0].id;box.innerHTML=a.length?a.map(t=>`<button type="button" class="v305CATopicBtn ${t.id===selectedTopicId?'active':''}" onclick="openCATopicV305('${t.id}')"><h4>${esc(t.title)}</h4><div class="row"><small>${esc(t.source)} • ${esc(t.subject)}</small><span class="v305CAPill ${t.importance==='High'?'red':t.importance==='Low'?'green':'gold'}">${esc(t.importance)}</span></div></button>`).join(''):'<div class="v305CAEmpty">No generated topic matches these filters.</div>';renderTopicDetail()}
  window.filterCATopicsV305=renderTopicRail;window.openCATopicV305=id=>{selectedTopicId=id;renderTopicRail()};
  function arrHtml(a){return textArray(a).length?`<ul>${textArray(a).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<p>Not added / needs verification.</p>'}
  function dimsHtml(a){return Array.isArray(a)&&a.length?`<ul>${a.map(x=>`<li><b>${esc(x.heading||'Dimension')}:</b> ${esc(textArray(x.points).join('; '))}</li>`).join('')}</ul>`:'<p>Not added / needs verification.</p>'}
  function section(title,body,full=false){return `<div class="v305CASection ${full?'full':''}"><h3>${title}</h3>${body}</div>`}
  function renderTopicDetail(){
    const box=$('v305CADetail');if(!box)return;const t=topics().find(x=>x.id===selectedTopicId);if(!t){box.innerHTML='<div class="v305CAEmpty"><b>No generated current affair selected.</b><br>Add source items and press the manual Generate button.</div>';return}
    const q=t.probableQuestions||{};box.innerHTML=`<div class="v305CADetailHero"><div class="v305CATags"><span>${esc(t.date)}</span><span>${esc(t.source)}</span><span>${esc(t.subject)}</span><span>${esc(t.importance)} priority</span>${t.gsPapers.map(x=>`<span>${esc(x)}</span>`).join('')}</div><h2>${esc(t.title)}</h2><p>${esc(t.simpleExplanation||t.whyInNews)}</p><div class="v305CAActions"><button class="green" onclick="toggleStudiedCAV305('${t.id}')">${t.studied?'✓ Studied':'Mark Studied'}</button><button onclick="saveCAToNotesV305('${t.id}')">📝 Notes</button><button onclick="saveCAToRevisionV305('${t.id}')">🔁 Revision</button><button onclick="saveCAToFlashcardsV305('${t.id}')">🃏 Flashcards</button><button onclick="sendCAToMainsV305('${t.id}')">✍️ Mains</button><button onclick="sendCAToPrelimsV305('${t.id}')">🧪 Prelims</button><button onclick="sendCAToSaarthiV305('${t.id}')">🧑‍🏫 Saarthi</button><button onclick="printCATopicV305('${t.id}')">📄 Print</button></div></div><div class="v305CADetailGrid">${section('Why in News',`<p>${esc(t.whyInNews||'Needs verification')}</p>`)}${section('Syllabus Link',arrHtml(t.syllabusLinks))}${section('Background',arrHtml(t.background))}${section('Prelims Facts',arrHtml(t.prelimsFacts))}${section('Prelims Traps',arrHtml(t.prelimsTraps))}${section('Mains Dimensions',dimsHtml(t.mainsDimensions),true)}${section('Laws & Institutions',arrHtml(t.lawsInstitutions))}${section('Data & Reports',arrHtml(t.dataReports))}${section('Opportunities',arrHtml(t.opportunities))}${section('Challenges',arrHtml(t.challenges))}${section('Way Forward',arrHtml(t.wayForward),true)}${section('PYQ Themes',arrHtml(t.pyqThemes),true)}${section('Probable Questions',`<ul><li><b>Prelims:</b> ${esc(q.prelims||'')}</li><li><b>10 marker:</b> ${esc(q.mains10||'')}</li><li><b>15 marker:</b> ${esc(q.mains15||'')}</li></ul>`,true)}${section('Revision Capsule',arrHtml(t.revisionCapsule),true)}${section('Mind Map',`<p>${esc(t.mindMap||'')}</p>`,true)}</div>`;
  }
  function updateTopic(id,patch){write(TOPICS_KEY,topics().map(t=>t.id===id?{...t,...patch}:t));renderAllCA()}
  window.toggleStudiedCAV305=id=>{const t=topics().find(x=>x.id===id);if(t)updateTopic(id,{studied:!t.studied})};
  function getTopic(id){return topics().find(x=>x.id===id)}
  window.saveCAToNotesV305=async id=>{const t=getTopic(id);if(!t)return;await saveCollection('notes',{title:t.title,subject:t.subject,paper:t.gsPapers.join(', '),body:topicText(t),date:t.date,type:'Current Affairs',source:t.source});updateTopic(id,{saved:true});toast('Saved to Notes.','success')};
  window.saveCAToRevisionV305=async id=>{const t=getTopic(id);if(!t)return;await saveCollection('smartRevision',{topic:t.title,subject:t.subject,source:'Daily CA Tracker',difficulty:t.importance==='High'?'Hard':'Medium',date:new Date(Date.now()+86400000).toISOString().slice(0,10),cycle:1,status:'pending',body:topicText(t)});toast('Added to Revision Planner.','success')};
  window.saveCAToFlashcardsV305=async id=>{const t=getTopic(id);if(!t)return;const cards=[...t.prelimsFacts,...t.prelimsTraps,...t.revisionCapsule].slice(0,12);for(const [i,x] of cards.entries())await saveCollection('flash',{q:`${t.title} — Recall ${i+1}`,a:x,subject:t.subject,difficulty:'Medium',due:today(),date:today(),source:'Daily CA Tracker'});toast(`${cards.length} flashcards saved.`,'success')};
  window.sendCAToMainsV305=async id=>{const t=getTopic(id);if(!t)return;await saveCollection('mainsPracticeQueue',{title:t.title,subject:t.subject,question:t.probableQuestions.mains15||t.probableQuestions.mains10||`Analyse ${t.title}.`,context:topicText(t),date:today(),source:'Daily CA Tracker'});toast('Mains question and context queued.','success');if(confirm('Open Mains Answer Writing Centre now?'))window.show?.('mainsAnswerCentreV291')};
  window.sendCAToPrelimsV305=async id=>{const t=getTopic(id);if(!t)return;await saveCollection('prelimsQuestionQueue',{title:t.title,subject:t.subject,question:t.probableQuestions.prelims||`Create a UPSC Prelims question on ${t.title}.`,facts:t.prelimsFacts,traps:t.prelimsTraps,date:today(),source:'Daily CA Tracker'});toast('Prelims practice item queued.','success');if(confirm('Open Prelims Test Centre now?'))window.show?.('prelimsTestCentreV291')};
  window.sendCAToSaarthiV305=async id=>{const t=getTopic(id);if(!t)return;await saveCollection('saarathiTasks',{title:`Revise CA: ${t.title}`,subject:t.subject,type:'Current Affairs',dueDate:new Date(Date.now()+86400000).toISOString().slice(0,10),frequency:'One-time',priority:t.importance,details:t.revisionCapsule.join('; '),status:'assigned',source:'Daily CA Tracker'});toast('Added to Saarthi weekly targets.','success')};
  window.printCATopicV305=id=>{const t=getTopic(id);if(!t)return;const w=open('','_blank','width=900,height=800');w.document.write(`<html><head><title>${esc(t.title)}</title><style>body{font-family:Arial;line-height:1.55;padding:30px;color:#183047}pre{white-space:pre-wrap;font-family:Arial}</style></head><body><pre>${esc(topicText(t))}</pre><script>onload=()=>print()<\/script></body></html>`);w.document.close()};
  window.printDailyCAV305=()=>{const date=$('v305CAFilterDate')?.value||$('v305CADate')?.value||today(),a=topics().filter(t=>t.date===date);if(!a.length)return toast('No generated topics for this date.','warn');const w=open('','_blank','width=950,height=900');w.document.write(`<html><head><title>Daily Current Affairs ${date}</title><style>body{font-family:Arial;line-height:1.5;padding:30px;color:#183047}article{page-break-after:always}pre{white-space:pre-wrap;font-family:Arial}</style></head><body><h1>JARVIS Daily Current Affairs — ${date}</h1>${a.map(t=>`<article><pre>${esc(topicText(t))}</pre></article>`).join('')}<script>onload=()=>print()<\/script></body></html>`);w.document.close()};
  function renderAllCA(){renderQueue();renderStats();renderTopicRail()}
  window.renderDailyCATrackerV305=renderAllCA;
  function buildCA(){
    if(window.__JARVIS_TRACKER_V322_ACTIVE__)return;
    const s=$('currentAffairsAI');if(!s||s.dataset.v305==='1')return;s.dataset.v305='1';s.classList.add('v305CA');
    const cats=[...new Set(SOURCES.map(x=>x.cat))],sourceOptions=SOURCES.map(x=>`<option>${esc(x.name)}</option>`).join('')+'<option>Other</option>';
    s.innerHTML=`<div class="v305CAHero"><div><span class="eyebrow">V30.5 • MANUAL TOKEN CONTROL • TRACKER-STYLE WORKFLOW</span><h1>JARVIS Daily Current Affairs Tracker</h1><p>Open trusted sources, queue only UPSC-relevant items, preview token demand, and press Generate yourself. Nothing is generated automatically, so your paid Gemini credits remain under your control.</p></div><div class="v305CAHeroIcon">📰</div></div>
    <div class="v305CATopStats"><div class="v305CAStat"><span>Topics on date</span><b id="v305StatTopics">0</b></div><div class="v305CAStat"><span>High priority</span><b id="v305StatHigh">0</b></div><div class="v305CAStat"><span>Pending study</span><b id="v305StatPending">0</b></div><div class="v305CAStat"><span>Source queue</span><b id="v305StatQueue">0</b></div><div class="v305CAStat"><span>Daily generation</span><b id="v305StatRun">Not run</b></div></div>
    <div class="v305CAGrid"><div class="v305CACard"><div class="v305CACardHead"><div><h2>1. Daily Generation Control</h2><p>One secure Gemini call for the selected queue. No call runs on page load.</p></div><span class="v305CAPill green">Manual only</span></div><div class="v305CAControls"><label>Date<input id="v305CADate" type="date" value="${today()}" onchange="renderDailyCATrackerV305()"></label><label>Analysis depth<select id="v305CADepth" onchange="updateCABudgetV305()"><option>Quick</option><option selected>Balanced</option><option>Deep</option></select></label><label>Maximum topics<select id="v305CAMaxTopics" onchange="updateCABudgetV305()"><option>3</option><option>5</option><option selected>8</option><option>10</option><option>12</option></select></label></div><div class="v305CABudget"><div><strong id="v305CABudgetText">0 topics • Balanced depth</strong><br><span>Headline-only items will be flagged for verification.</span></div><span id="v305CATokenEstimate" class="v305CAPill gold">≈ 0 tokens</span></div><button id="v305GenerateBtn" class="v305CAGenerate" type="button" onclick="generateDailyCAV305()" disabled>✨ Generate Today’s CA with Gemini</button><p class="v305CAFine">You receive a confirmation with the estimate before every call. A second run on the same date requires another confirmation.</p><div id="v305CAStatus" class="v305CAStatus">Add source items below. Reading links and building the queue uses zero AI tokens.</div></div>
    <div class="v305CACard"><div class="v305CACardHead"><div><h2>2. UPSC Source Desk</h2><p>Newspapers, official releases, institutions, reports and magazines.</p></div><span class="v305CAPill">${SOURCES.length} sources</span></div><div id="v305CASourceTabs" class="v305CASourceTabs"></div><div id="v305CASources" class="v305CASources"></div></div></div>
    <div class="v305CAGrid" style="margin-top:16px"><div class="v305CACard"><div class="v305CACardHead"><div><h2>3. Add Relevant News to Queue</h2><p>Paste only the useful excerpt or your own summary. URL is metadata; Gemini does not pretend to read an unseen page.</p></div><span class="v305CAPill green">0 tokens</span></div><div class="v305CAComposer"><input id="v305CATitle" placeholder="Headline / issue title"><select id="v305CASource">${sourceOptions}</select><input id="v305CAUrl" class="full" placeholder="Source URL (optional)"><textarea id="v305CAExcerpt" placeholder="Paste relevant paragraphs, PIB release points, editorial summary or notes…"></textarea></div><div class="v305CAActions"><button class="primary" type="button" onclick="addCAQueueV305()">＋ Add to Today’s Queue</button><button type="button" onclick="document.getElementById('v305CADigestWrap').open=true">Paste Daily Digest</button></div><details id="v305CADigestWrap" style="margin-top:12px"><summary><b>Bulk import multiple items</b></summary><div class="v305CAImportBox" style="margin-top:9px"><textarea id="v305CADigestImport" placeholder="Paste multiple headlines and summaries separated by blank lines…"></textarea></div><div class="v305CAActions"><button class="primary" onclick="importCADigestV305()">Import Digest to Queue</button></div></details></div>
    <div class="v305CACard"><div class="v305CACardHead"><div><h2>4. Today’s Source Queue</h2><p>Select exactly what Gemini should process.</p></div><div><span class="v305CAPill"><b id="v305CAQueuedCount">0</b>&nbsp; selected</span></div></div><div id="v305CAQueue" class="v305CAQueue"></div><div class="v305CAActions"><button class="danger" type="button" onclick="clearCAQueueV305()">Clear Queue</button></div></div></div>
    <div class="v305CAWorkspace"><aside class="v305CATopicRail"><div class="v305CACardHead"><div><h3>Daily Topic List</h3><p>Tracker-style archive</p></div></div><div class="v305CAFilterBar"><input id="v305CASearch" placeholder="Search topics/tags" oninput="filterCATopicsV305()"><input id="v305CAFilterDate" type="date" value="${today()}" onchange="filterCATopicsV305()"><select id="v305CAFilterSubject" onchange="filterCATopicsV305()"><option>All</option><option>Polity</option><option>Economy</option><option>Environment</option><option>Science & Tech</option><option>IR</option><option>Security</option><option>Social Issues</option><option>Geography</option><option>Ethics</option><option>Culture</option><option>Governance</option><option>History</option><option>Other</option></select><select id="v305CAFilterImportance" onchange="filterCATopicsV305()"><option>All</option><option>High</option><option>Medium</option><option>Low</option></select></div><div class="v305CAActions"><button onclick="printDailyCAV305()">📄 Daily PDF / Print</button></div><div id="v305CATopicList" class="v305CATopicList"></div></aside><main id="v305CADetail" class="v305CADetail"></main></div>`;
    renderSources();renderAllCA();
  }

  function updateVersion(){if(window.__JARVIS_TRACKER_V322_ACTIVE__)return;document.title='Jarvis UPSC V30.5.0 — Final Daily CA';document.querySelectorAll('.versionBadge').forEach(x=>x.textContent='V30.5.0 • Voice + Daily CA');window.__MISSION_UPSC_VERSION__=VERSION;const rel=[...document.querySelectorAll('.v275ReleaseList div')].find(x=>x.querySelector('span')?.textContent==='Version');if(rel?.querySelector('b'))rel.querySelector('b').textContent='Mission UPSC AI OS V30.5.0 Final Daily CA';}
  function init(){installVoicePanel();buildCA();updateVersion();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,80),{once:true});else setTimeout(init,80);
  window.addEventListener('load',()=>setTimeout(init,150),{once:true});
})();

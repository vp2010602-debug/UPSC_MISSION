/* ===== V28.2 SMART AI ROUTER + V28.3 PERSONAL WORKSPACE MEMORY ===== */
(function(){
  'use strict';
  const VERSION='28.3';
  const ROUTER_KEY='mission_smart_router_v282';
  const ROUTER_LOG_KEY='mission_smart_router_log_v282';
  const MEMORY_KEY='mission_jarvis_memory_v283';
  const ROUTINES_KEY='mission_jarvis_routines_v283';
  const QUEUE_KEY='mission_jarvis_queue_v283';
  const $=id=>document.getElementById(id);
  const today=()=>new Date().toISOString().slice(0,10);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeJSON=(key,fallback)=>{try{const v=JSON.parse(localStorage.getItem(key)||'null');return v??fallback}catch(e){return fallback}};
  const saveJSON=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));
  const dayMs=86400000;
  const itemTime=x=>Number(x?.createdAt?.seconds?x.createdAt.seconds*1000:x?.createdAt||x?.savedAt||x?.date?Date.parse(x.date)||0:0);
  const scoreOf=x=>{const p=Number(x?.scorePercent??x?.accuracy??x?.percentage);if(Number.isFinite(p))return clamp(p,0,100);const s=Number(x?.score),m=Number(x?.maxMarks||x?.total);return Number.isFinite(s)&&m>0?clamp(s/m*100,0,100):null};
  const subjectOf=x=>String(x?.subject||x?.paper||x?.gsPaper||'General').trim()||'General';
  const textOf=x=>[x?.title,x?.topic,x?.question,x?.q,x?.text,x?.body,x?.note,x?.content,x?.answer].filter(Boolean).join(' ');

  let legacyRouter=null,routerInstalled=false,ollamaState={ok:null,at:0,message:'Not tested'},lastEnhancedCommand='',enhancedQueue=safeJSON(QUEUE_KEY,[]),enhancedQueueIndex=0;

  function baseAI(){try{return {mode:'ollama',ollamaUrl:'http://localhost:11434',ollamaModel:'gemma3:4b',geminiKey:'',...JSON.parse(localStorage.getItem('mission_ai_settings_v23')||'{}')}}catch(e){return {mode:'ollama',ollamaUrl:'http://localhost:11434',ollamaModel:'gemma3:4b',geminiKey:''}}}
  function routerSettings(){return {enabled:true,policy:'auto',cloudCap:150,allowMemoryCloud:false,showRoute:true,preferLocal:true,...safeJSON(ROUTER_KEY,{})}}
  function routerLogs(){const x=safeJSON(ROUTER_LOG_KEY,[]);return Array.isArray(x)?x:[]}
  function monthKey(){return new Date().toISOString().slice(0,7)}
  function cloudCallsThisMonth(){return routerLogs().filter(x=>x.provider==='gemini'&&String(x.time||'').slice(0,7)===monthKey()&&x.ok).length}
  function isTablet(){return /iPad|iPhone|Android|Mobile/i.test(navigator.userAgent)||Math.min(screen.width,screen.height)<900}
  function isLocalPage(){return ['localhost','127.0.0.1',''].includes(location.hostname)}
  function wrapPrompt(prompt){return `You are the Mission UPSC AI OS expert. Give exam-oriented, factual and well-structured output. Distinguish facts from suggestions. Never claim access to current news unless source text is supplied. Use headings, UPSC syllabus linkage, PYQ angle, examples, and a revision capsule when relevant.\n\nUser request:\n${prompt}`}
  function classifyPrompt(prompt){
    const t=String(prompt||'').toLowerCase(),len=String(prompt||'').length;
    let task='general',complexity=2;
    if(/evaluate|examiner|essay|mains answer|ethics case|interview feedback|model answer/.test(t)){task='evaluation';complexity=5}
    else if(/current affairs|newspaper|today|latest|recent|editorial|government report/.test(t)){task='current-affairs';complexity=4}
    else if(len>11000||/pdf|document|report|source material|chapter/.test(t)){task='long-document';complexity=4}
    else if(/strategy|mentor|diagnos|weak area|roadmap|rank|readiness|deep analysis/.test(t)){task='strategy';complexity=4}
    else if(/flashcard|mindmap|mind map|one.page|revision question|summary|explain|notes|mcq/.test(t)){task='generation';complexity=2}
    const privateContext=/my workspace|my notes|my preparation|my weak|my score|personal memory|daf|my profile/.test(t);
    return {task,complexity,len,privateContext};
  }
  function usageSummary(){const logs=routerLogs(),ok=logs.filter(x=>x.ok),avg=ok.length?Math.round(ok.reduce((a,x)=>a+Number(x.ms||0),0)/ok.length/100)/10:null,last=logs[0];return {cloud:cloudCallsThisMonth(),avg,last}}
  function logRoute(entry){const logs=routerLogs();logs.unshift({time:new Date().toISOString(),...entry});saveJSON(ROUTER_LOG_KEY,logs.slice(0,250));renderRouterUsage()}
  function renderRouterUsage(){
    const s=routerSettings(),u=usageSummary(),ai=baseAI();
    if($('smartRouterEnabledV282'))$('smartRouterEnabledV282').checked=!!s.enabled;
    if($('smartRouterPolicyV282'))$('smartRouterPolicyV282').value=s.policy;
    if($('smartRouterCloudCapV282'))$('smartRouterCloudCapV282').value=s.cloudCap;
    if($('smartRouterAllowMemoryCloudV282'))$('smartRouterAllowMemoryCloudV282').checked=!!s.allowMemoryCloud;
    if($('smartRouterShowRouteV282'))$('smartRouterShowRouteV282').checked=!!s.showRoute;
    if($('smartRouterPreferLocalV282'))$('smartRouterPreferLocalV282').checked=!!s.preferLocal;
    if($('smartRouterStateV282'))$('smartRouterStateV282').textContent=s.enabled?'Smart Auto ON':'Manual mode';
    if($('routerOllamaStateV282'))$('routerOllamaStateV282').textContent=ollamaState.ok===true?'Connected':ollamaState.ok===false?'Unavailable':'Not tested';
    if($('routerGeminiStateV282'))$('routerGeminiStateV282').textContent=ai.geminiKey?'Key saved':'Key missing';
    if($('routerChatGPTStateV282'))$('routerChatGPTStateV282').textContent='Ready';
    if($('routerCallsMonthV282'))$('routerCallsMonthV282').textContent=`${u.cloud}/${s.cloudCap} cloud calls`;
    if($('routerLastProviderV282'))$('routerLastProviderV282').textContent=u.last?`${u.last.provider}${u.last.ok?'':' failed'}`:'—';
    if($('routerAvgTimeV282'))$('routerAvgTimeV282').textContent=u.avg==null?'—':`${u.avg}s`;
    if($('jarvisRouteMetricV282'))$('jarvisRouteMetricV282').textContent=u.last?.provider||'Auto';
    if($('jarvisSmartRouteBadgeV282'))$('jarvisSmartRouteBadgeV282').textContent=s.enabled?`Smart route: ${u.last?.provider||'ready'}`:'Smart route: manual';
  }
  function routeToast(provider,reason){const s=routerSettings();if(!s.showRoute)return;document.querySelector('.v283RouteToast')?.remove();const d=document.createElement('div');d.className='v283RouteToast';d.innerHTML=`<b>AI route: ${esc(provider)}</b><small>${esc(reason)}</small>`;document.body.appendChild(d);setTimeout(()=>d.remove(),4200)}
  async function fetchTimeout(url,options={},ms=120000){const c=new AbortController(),timer=setTimeout(()=>c.abort(),ms);try{return await fetch(url,{...options,signal:c.signal})}finally{clearTimeout(timer)}}
  async function testOllama(force=false){
    if(!force&&Date.now()-ollamaState.at<60000&&ollamaState.ok!==null)return ollamaState.ok;
    if(isTablet()&&!isLocalPage()){ollamaState={ok:false,at:Date.now(),message:'Skipped on mobile/tablet'};return false}
    const ai=baseAI(),url=String(ai.ollamaUrl||'http://localhost:11434').replace(/\/$/,'');
    try{const r=await fetchTimeout(url+'/api/tags',{method:'GET'},2600);if(!r.ok)throw new Error('HTTP '+r.status);ollamaState={ok:true,at:Date.now(),message:'Connected'};return true}catch(e){ollamaState={ok:false,at:Date.now(),message:e.name==='AbortError'?'Timed out':e.message};return false}finally{renderRouterUsage()}
  }
  async function askOllama(prompt){const ai=baseAI(),url=String(ai.ollamaUrl||'http://localhost:11434').replace(/\/$/,'');const r=await fetchTimeout(url+'/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:ai.ollamaModel||'gemma3:4b',prompt:wrapPrompt(prompt),stream:false,options:{temperature:.3}})},180000);if(!r.ok)throw new Error('Ollama error: '+await r.text());const d=await r.json();if(!d.response)throw new Error('Ollama returned no response.');return d.response}
  async function askGemini(prompt){const ai=baseAI(),key=String(ai.geminiKey||'').trim();if(!key)throw new Error('Gemini API key missing.');const models=['gemini-2.0-flash','gemini-2.5-flash','gemini-2.5-flash-lite'];let last='Gemini unavailable';for(const model of models){try{const r=await fetchTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:wrapPrompt(prompt)}]}],generationConfig:{temperature:.3}})},150000);const d=await r.json();const out=d?.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join('\n').trim();if(out)return out;last=d?.error?.message||`No response from ${model}`}catch(e){last=e.message}}throw new Error(last)}
  async function chatGPTPrompt(prompt){const full=wrapPrompt(prompt);try{await navigator.clipboard.writeText(full)}catch(e){}return `# ChatGPT Prompt Mode\n\nThe prompt has been prepared${navigator.clipboard?' and copied':''}. Open ChatGPT and paste it.\n\n## Prompt\n\n${full}`}
  async function decideRoute(prompt,meta={}){
    const rs=routerSettings(),ai=baseAI(),c=classifyPrompt(prompt),cloudAllowed=cloudCallsThisMonth()<Number(rs.cloudCap||150),hasGemini=!!String(ai.geminiKey||'').trim();
    if(!rs.enabled||rs.policy==='manual')return {provider:ai.mode==='hybrid'?'auto':ai.mode,reason:'Manual AI policy selected',classification:c};
    const localPossible=rs.preferLocal&&await testOllama(false);
    if(c.privateContext&&!rs.allowMemoryCloud&&localPossible)return {provider:'ollama',reason:'Private workspace context stays local',classification:c};
    if(rs.policy==='free'){
      if(localPossible)return {provider:'ollama',reason:'Free/local-first policy and Ollama is available',classification:c};
      if(hasGemini&&cloudAllowed)return {provider:'gemini',reason:'Local AI unavailable; using configured Gemini allowance',classification:c};
      return {provider:'chatgpt',reason:'Free manual fallback',classification:c};
    }
    if(rs.policy==='quality'){
      if(hasGemini&&cloudAllowed)return {provider:'gemini',reason:'Quality-first policy for stronger cloud reasoning',classification:c};
      if(localPossible)return {provider:'ollama',reason:'Gemini unavailable or guard reached; using local model',classification:c};
      return {provider:'chatgpt',reason:'No direct provider available',classification:c};
    }
    if(isTablet()){
      if(hasGemini&&cloudAllowed)return {provider:'gemini',reason:'Tablet/cloud usage detected',classification:c};
      return {provider:'chatgpt',reason:'Tablet detected but Gemini is unavailable or guarded',classification:c};
    }
    if(['evaluation','current-affairs','long-document','strategy'].includes(c.task)&&hasGemini&&cloudAllowed)return {provider:'gemini',reason:`${c.task} benefits from stronger cloud reasoning`,classification:c};
    if(localPossible)return {provider:'ollama',reason:'Daily UPSC generation routed to free local AI',classification:c};
    if(hasGemini&&cloudAllowed)return {provider:'gemini',reason:'Ollama unavailable; using Gemini fallback',classification:c};
    return {provider:'chatgpt',reason:'No direct AI available; preparing a manual prompt',classification:c};
  }
  async function smartAsk(prompt,meta={}){
    if(!routerSettings().enabled&&legacyRouter)return legacyRouter(prompt);
    let d=await decideRoute(prompt,meta);if(d.provider==='auto'){const ai=baseAI();d.provider=ai.mode==='hybrid'?(await testOllama()?'ollama':(ai.geminiKey?'gemini':'chatgpt')):ai.mode}
    const order=[d.provider,...(['ollama','gemini','chatgpt'].filter(x=>x!==d.provider))],started=Date.now();let lastErr='';
    for(const provider of order){
      if(provider==='gemini'&&(!baseAI().geminiKey||cloudCallsThisMonth()>=routerSettings().cloudCap))continue;
      if(provider==='ollama'&&!(await testOllama(false)))continue;
      try{routeToast(provider,d.reason);const out=provider==='ollama'?await askOllama(prompt):provider==='gemini'?await askGemini(prompt):await chatGPTPrompt(prompt);logRoute({provider,task:d.classification.task,reason:d.reason,ok:true,ms:Date.now()-started,promptChars:String(prompt).length});window.__lastAIRouteV282={provider,reason:d.reason,time:new Date().toISOString()};document.dispatchEvent(new CustomEvent('mission-ai-route',{detail:window.__lastAIRouteV282}));return out}catch(e){lastErr=e.message;logRoute({provider,task:d.classification.task,reason:d.reason,ok:false,ms:Date.now()-started,error:e.message,promptChars:String(prompt).length})}
    }
    throw new Error(lastErr||'No AI provider is available. Open AI Control Centre.');
  }
  smartAsk.__v282=true;

  window.saveSmartRouterV282=function(){const s={enabled:$('smartRouterEnabledV282')?.checked!==false,policy:$('smartRouterPolicyV282')?.value||'auto',cloudCap:clamp($('smartRouterCloudCapV282')?.value||150,1,5000),allowMemoryCloud:!!$('smartRouterAllowMemoryCloudV282')?.checked,showRoute:$('smartRouterShowRouteV282')?.checked!==false,preferLocal:$('smartRouterPreferLocalV282')?.checked!==false};saveJSON(ROUTER_KEY,s);renderRouterUsage();if($('smartRouterStatusV282'))$('smartRouterStatusV282').textContent='Smart Router settings saved.'};
  window.testSmartRouterV282=async function(){window.saveSmartRouterV282();const box=$('smartRouterStatusV282');if(box)box.textContent='Testing Ollama and checking cloud settings…';const local=await testOllama(true),ai=baseAI(),d=await decideRoute('Create 10 UPSC flashcards on Fundamental Rights');if(box)box.innerHTML=`<b>Ollama:</b> ${local?'Connected':'Unavailable — '+esc(ollamaState.message)}<br><b>Gemini:</b> ${ai.geminiKey?'Key saved':'Key missing'}<br><b>ChatGPT Prompt:</b> Ready<br><b>Example route:</b> ${esc(d.provider)} — ${esc(d.reason)}`;renderRouterUsage()};
  window.clearRouterUsageV282=function(){if(!confirm('Clear the local AI routing usage log? This does not remove API keys or study data.'))return;localStorage.removeItem(ROUTER_LOG_KEY);renderRouterUsage();if($('smartRouterStatusV282'))$('smartRouterStatusV282').textContent='Routing usage log cleared.'};
  window.smartAIRouteDecisionV282=decideRoute;

  function defaultMemory(){return {profile:{name:'',optional:'',dailyHours:7,stage:'Integrated',language:'English'},facts:[],goals:[],insights:{lastScan:null,stats:{},weakTopics:[],coverage:[],productiveWindow:'—'},includeInAI:true}}
  function memory(){const m=safeJSON(MEMORY_KEY,defaultMemory());return {...defaultMemory(),...m,profile:{...defaultMemory().profile,...(m.profile||{})},insights:{...defaultMemory().insights,...(m.insights||{})},facts:Array.isArray(m.facts)?m.facts:[],goals:Array.isArray(m.goals)?m.goals:[]}}
  function saveMemory(m){saveJSON(MEMORY_KEY,m);renderMemory()}
  function memoryContext(sanitized=false){const m=memory(),i=m.insights||{},base={profile:{dailyHours:m.profile.dailyHours,stage:m.profile.stage,optional:m.profile.optional||'Not set',language:m.profile.language},goals:m.goals.slice(0,8),weakTopics:(i.weakTopics||[]).slice(0,6),stats:i.stats||{},productiveWindow:i.productiveWindow||'—'};if(!sanitized)base.facts=m.facts.slice(0,15).map(x=>x.text);return base}
  window.getJarvisMemoryContextV283=memoryContext;
  function renderMemory(){
    const m=memory(),p=m.profile,i=m.insights||{},stats=i.stats||{};
    if($('jarvisProfileNameV283'))$('jarvisProfileNameV283').value=p.name||'';if($('jarvisProfileOptionalV283'))$('jarvisProfileOptionalV283').value=p.optional||'';if($('jarvisProfileHoursV283'))$('jarvisProfileHoursV283').value=p.dailyHours||7;if($('jarvisProfileStageV283'))$('jarvisProfileStageV283').value=p.stage||'Integrated';if($('jarvisProfileLanguageV283'))$('jarvisProfileLanguageV283').value=p.language||'English';if($('jarvisMemoryAIEnabledV283'))$('jarvisMemoryAIEnabledV283').checked=m.includeInAI!==false;
    if($('jarvisMemoryFactsV283'))$('jarvisMemoryFactsV283').textContent=m.facts.length;
    if($('jarvisMemoryStateV283'))$('jarvisMemoryStateV283').textContent=routerSettings().allowMemoryCloud?'Cloud allowed':'Local only';
    const statRows=[['Notes',stats.notes||0],['Tests',stats.tests||0],['Due revision',stats.dueRevision||0],['Study 14d',`${Math.round((stats.minutes14||0)/60*10)/10}h`],['Latest Prelims',stats.latestPrelims==null?'—':Math.round(stats.latestPrelims)+'%'],['Latest Mains',stats.latestMains==null?'—':Math.round(stats.latestMains)+'%'],['Recall due',stats.recallDue||0],['Best window',i.productiveWindow||'—']];
    if($('jarvisMemoryStatsV283'))$('jarvisMemoryStatsV283').innerHTML=statRows.map(x=>`<div><span>${esc(x[0])}</span><b>${esc(x[1])}</b></div>`).join('');
    if($('jarvisMemoryFactsListV283'))$('jarvisMemoryFactsListV283').innerHTML=m.facts.length?m.facts.map(x=>`<div class="v283FactItem"><div><b>${esc(x.text)}</b><small>${esc(x.category||'Preference')} • ${new Date(x.createdAt).toLocaleDateString()}</small></div><button type="button" class="miniBtn" onclick="deleteJarvisMemoryFactV283('${esc(x.id)}')">Remove</button></div>`).join(''):'<div class="emptyState">No saved personal facts yet.</div>';
  }
  window.saveJarvisProfileV283=function(){const m=memory();m.profile={name:$('jarvisProfileNameV283')?.value.trim()||'',optional:$('jarvisProfileOptionalV283')?.value.trim()||'',dailyHours:clamp($('jarvisProfileHoursV283')?.value||7,1,18),stage:$('jarvisProfileStageV283')?.value||'Integrated',language:$('jarvisProfileLanguageV283')?.value||'English'};m.includeInAI=$('jarvisMemoryAIEnabledV283')?.checked!==false;saveMemory(m);if($('jarvisMemoryBriefV283'))$('jarvisMemoryBriefV283').textContent='Profile saved locally. Scan Workspace to refresh evidence-based preparation memory.'};
  window.addJarvisMemoryFactV283=function(text){const input=$('jarvisMemoryFactInputV283'),value=String(text||input?.value||'').trim();if(!value)return alert('Enter something Jarvis should remember.');const m=memory();m.facts.unshift({id:'mf_'+Date.now(),text:value,category:'User preference',createdAt:new Date().toISOString()});m.facts=m.facts.slice(0,60);saveMemory(m);if(input)input.value=''};
  window.deleteJarvisMemoryFactV283=function(id){const m=memory();m.facts=m.facts.filter(x=>x.id!==id);saveMemory(m)};
  window.forgetJarvisMemoryV283=function(){if(!confirm('Forget Jarvis profile, saved facts and scanned insights on this browser? Study records will not be deleted.'))return;localStorage.removeItem(MEMORY_KEY);renderMemory();if($('jarvisMemoryBriefV283'))$('jarvisMemoryBriefV283').textContent='Personal Jarvis memory cleared. Your notes, tests and cloud data remain untouched.'};
  async function getCollections(names){const get=window.getCol||(async()=>[]);const rows=await Promise.all(names.map(n=>get(n).catch(()=>[])));return Object.fromEntries(names.map((n,i)=>[n,Array.isArray(rows[i])?rows[i]:[]]))}
  function topCounts(items,keyFn,limit=5){const m={};items.forEach(x=>{const k=String(keyFn(x)||'').trim();if(k)m[k]=(m[k]||0)+1});return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,limit).map(([name,count])=>({name,count}))}
  window.scanJarvisWorkspaceV283=async function(force=false){
    const box=$('jarvisMemoryBriefV283');if(box)box.innerHTML='<div class="aiLoading">Scanning preparation evidence…</div>';
    try{
      const names=['notes','richNotesV4','digitalLibrary','libraryShelf','flash','smartRevision','revision','wrongbook','wrongAnswers','prelimsReports','tests','mainsWarReports','mainsReports','studyLogs','focusSessions','timeSessionsV262','memoryCardsV263','tasks','calendarItems','syllabus','completion'];const d=await getCollections(names),now=Date.now(),cut=now-14*dayMs;
      const revisions=[...d.smartRevision,...d.revision],wrong=[...d.wrongbook,...d.wrongAnswers],pre=[...d.prelimsReports,...d.tests].sort((a,b)=>itemTime(b)-itemTime(a)),mains=[...d.mainsWarReports,...d.mainsReports].sort((a,b)=>itemTime(b)-itemTime(a));
      const sessions=[...d.studyLogs.map(x=>({...x,minutes:Number(x.minutes||0)+Number(x.hours||0)*60})),...d.focusSessions,...d.timeSessionsV262].filter(x=>(Date.parse(x.date)||itemTime(x))>=cut),hours={};sessions.forEach(x=>{const h=Number(x.startHour??String(x.startTime||'').split(':')[0]);if(Number.isFinite(h))hours[h]=(hours[h]||0)+Number(x.minutes||0)});const best=Object.entries(hours).sort((a,b)=>b[1]-a[1])[0];
      const weakItems=[...wrong,...revisions.filter(x=>!x.done&&!['done','completed'].includes(String(x.status||'').toLowerCase()))],weak=topCounts(weakItems,x=>x.topic||x.subject||x.title||String(x.question||x.q||'').slice(0,55),6),coverage=topCounts([...d.notes,...d.richNotesV4,...d.flash],x=>subjectOf(x),6);
      const m=memory();m.insights={lastScan:new Date().toISOString(),weakTopics:weak,coverage,productiveWindow:best?`${String(best[0]).padStart(2,'0')}:00–${String((Number(best[0])+1)%24).padStart(2,'0')}:00`:'—',stats:{notes:d.notes.length+d.richNotesV4.length,library:d.digitalLibrary.length+d.libraryShelf.length,flash:d.flash.length,tests:pre.length,dueRevision:revisions.filter(x=>!x.done&&(!x.date||String(x.date)<=today())).length,recallDue:d.memoryCardsV263.filter(x=>!x.nextReview||String(x.nextReview)<=today()).length,minutes14:sessions.reduce((a,x)=>a+Number(x.minutes||0),0),latestPrelims:pre.length?scoreOf(pre[0]):null,latestMains:mains.length?scoreOf(mains[0]):null,openTasks:d.tasks.filter(x=>!x.done&&!['done','completed'].includes(String(x.status||'').toLowerCase())).length,calendarToday:d.calendarItems.filter(x=>String(x.date||'')===today()).length,syllabusItems:d.syllabus.length+d.completion.length}};saveMemory(m);window.generateJarvisMemoryBriefV283(false);return m
    }catch(e){if(box)box.textContent='Memory scan stopped safely: '+e.message;throw e}
  };
  function localBrief(){const m=memory(),p=m.profile,i=m.insights||{},s=i.stats||{},name=p.name?` ${p.name}`:'';const weak=(i.weakTopics||[]).slice(0,3).map(x=>x.name).join(', ')||'No repeated weak topic detected yet';let next='Build a daily plan';if(s.dueRevision>0)next=`Clear ${s.dueRevision} due revision item${s.dueRevision===1?'':'s'}`;else if(s.recallDue>0)next=`Complete ${Math.min(s.recallDue,20)} due recall cards`;else if(s.openTasks>0)next='Finish the highest-priority open task';else if(s.latestPrelims!=null&&s.latestPrelims<60)next='Run a focused Prelims repair test';return `# Jarvis Preparation Brief${name}\n\n**Stage:** ${p.stage}  \n**Daily target:** ${p.dailyHours} hours  \n**Optional:** ${p.optional||'Not set'}  \n\n## Current evidence\n- Due revision: ${s.dueRevision||0}\n- Recall due: ${s.recallDue||0}\n- Open tasks: ${s.openTasks||0}\n- Study in last 14 days: ${Math.round((s.minutes14||0)/60*10)/10} hours\n- Latest Prelims: ${s.latestPrelims==null?'No score':Math.round(s.latestPrelims)+'%'}\n- Latest Mains: ${s.latestMains==null?'No score':Math.round(s.latestMains)+'%'}\n- Best focus window: ${i.productiveWindow||'Not enough evidence'}\n\n## Weakness signal\n${weak}\n\n## Next best action\n${next}.`}
  function setJarvisResponse(text){const box=$('jarvisResponseV281');if(box)box.innerHTML=typeof window.formatAI==='function'?window.formatAI(text):`<pre style="white-space:pre-wrap">${esc(text)}</pre>`;if($('jarvisStatusV281'))$('jarvisStatusV281').textContent='Completed'}
  window.generateJarvisMemoryBriefV283=function(showInJarvis=true){const text=localBrief();if($('jarvisMemoryBriefV283'))$('jarvisMemoryBriefV283').innerHTML=typeof window.formatAI==='function'?window.formatAI(text):`<pre>${esc(text)}</pre>`;if(showInJarvis)setJarvisResponse(text);refreshSuggestions(lastEnhancedCommand||'brief me');return text};

  function routines(){const x=safeJSON(ROUTINES_KEY,[]);return Array.isArray(x)?x:[]}
  function renderRoutines(){const box=$('jarvisRoutinesV283'),a=routines();if(!box)return;box.innerHTML=a.length?a.map(r=>`<div class="v283RoutineItem"><div><b>${esc(r.name)}</b><small>${r.commands.length} commands • ${new Date(r.createdAt).toLocaleDateString()}</small></div><div class="actions"><button type="button" class="btn green" onclick="runJarvisRoutineV283('${esc(r.id)}')">Run</button><button type="button" class="btn ghost" onclick="loadJarvisRoutineV283('${esc(r.id)}')">Edit</button><button type="button" class="btn danger" onclick="deleteJarvisRoutineV283('${esc(r.id)}')">Delete</button></div></div>`).join(''):'<div class="emptyState">No routines saved yet.</div>'}
  window.saveJarvisRoutineV283=function(){const name=$('jarvisRoutineNameV283')?.value.trim(),commands=String($('jarvisRoutineCommandsV283')?.value||'').split(/\n+/).map(x=>x.trim()).filter(Boolean);if(!name||!commands.length)return alert('Add a routine name and at least one command.');const a=routines(),existing=a.find(x=>x.name.toLowerCase()===name.toLowerCase());if(existing){existing.commands=commands;existing.updatedAt=new Date().toISOString()}else a.unshift({id:'jr_'+Date.now(),name,commands,createdAt:new Date().toISOString()});saveJSON(ROUTINES_KEY,a.slice(0,30));renderRoutines();alert('Jarvis routine saved.')};
  window.useCurrentCommandInRoutineV283=function(){const cmd=$('jarvisCommandInputV281')?.value.trim();if(!cmd)return alert('Enter a Jarvis command first.');const area=$('jarvisRoutineCommandsV283');if(area)area.value=[area.value.trim(),cmd].filter(Boolean).join('\n')};
  window.loadJarvisRoutineV283=function(id){const r=routines().find(x=>x.id===id);if(!r)return;if($('jarvisRoutineNameV283'))$('jarvisRoutineNameV283').value=r.name;if($('jarvisRoutineCommandsV283'))$('jarvisRoutineCommandsV283').value=r.commands.join('\n')};
  window.deleteJarvisRoutineV283=function(id){if(!confirm('Delete this saved Jarvis routine?'))return;saveJSON(ROUTINES_KEY,routines().filter(x=>x.id!==id));renderRoutines()};
  window.runJarvisRoutineV283=function(id){const r=routines().find(x=>x.id===id);if(!r)return;enhancedQueue=r.commands.map((command,i)=>({id:'qs_'+Date.now()+'_'+i,command,status:'pending'}));enhancedQueueIndex=0;saveJSON(QUEUE_KEY,enhancedQueue);renderQueue();setJarvisResponse(`Routine **${r.name}** loaded with ${r.commands.length} steps. Press **Run Next** to execute each step safely.`)};

  function splitSteps(command){return String(command||'').split(/\s+(?:and\s+then|then|after\s+that|next)\s+/i).map(x=>x.trim()).filter(Boolean)}
  function renderQueue(){const box=$('jarvisQueueV283');if(!box)return;box.innerHTML=enhancedQueue.length?enhancedQueue.map((x,i)=>`<div class="v283QueueItem ${x.status==='done'?'done':i===enhancedQueueIndex?'active':''}"><span class="v283QueueIndex">${i+1}</span><button type="button" onclick="runJarvisQueueStepV283(${i})">${esc(x.command)}</button><small>${esc(x.status||'pending')}</small></div>`).join(''):'<div class="emptyState">No queued steps.</div>'}
  window.clearJarvisQueueV283=function(){enhancedQueue=[];enhancedQueueIndex=0;saveJSON(QUEUE_KEY,[]);renderQueue()};
  window.runJarvisQueueStepV283=async function(i){if(!enhancedQueue[i])return;enhancedQueueIndex=i;if($('jarvisCommandInputV281'))$('jarvisCommandInputV281').value=enhancedQueue[i].command;renderQueue();await runBaseJarvis();enhancedQueue[i].status='prepared';saveJSON(QUEUE_KEY,enhancedQueue);renderQueue()};
  window.runNextJarvisStepV283=async function(){if(!enhancedQueue.length)return alert('No queued steps. Use “then” in a command or run a saved routine.');let i=enhancedQueue.findIndex(x=>x.status==='pending');if(i<0)i=enhancedQueue.findIndex(x=>x.status==='prepared');if(i<0)return alert('All queue steps have been prepared.');await window.runJarvisQueueStepV283(i);if(enhancedQueue[i])enhancedQueue[i].status='done';enhancedQueueIndex=Math.min(i+1,enhancedQueue.length-1);saveJSON(QUEUE_KEY,enhancedQueue);renderQueue()};

  function suggestionCommands(command){const t=String(command||'').toLowerCase();if(/mcq|prelims/.test(t))return ['Analyze my weakest MCQ topics','Schedule revision for the mistakes tomorrow','Create 10 flashcards from my wrong answers'];if(/notes|mindmap|flashcard/.test(t))return ['Convert this topic into a mindmap','Create 15 flashcards on the same topic','Schedule this topic for revision tomorrow'];if(/mains|essay|answer/.test(t))return ['Generate a model answer framework','Add my weaknesses to Revision Brain','Create a 7-day Mains improvement plan'];if(/plan|brief|today/.test(t))return ['Start a 50 minute focus session on my highest priority','Show my due revisions','Generate 10 MCQs on my weakest topic'];if(/weak|revision/.test(t))return ['Brief me for today','Start a 50 minute focus session on my weakest topic','Recalculate my readiness'];return ['Brief me for today','What should I study now?','Show my preparation memory','Plan my day for 7 hours']}
  function refreshSuggestions(command=''){const box=$('jarvisSuggestionsV283');if(!box)return;box.innerHTML=suggestionCommands(command).map(x=>`<div class="v283Suggestion"><button type="button" onclick="jarvisSetCommandV281('${esc(x).replace(/'/g,'&#39;')}',true)">${esc(x)}</button><span>›</span></div>`).join('')}
  window.refreshJarvisSuggestionsV283=()=>refreshSuggestions(lastEnhancedCommand);

  async function handleEnhanced(command){
    const t=String(command||'').trim(),low=t.toLowerCase();lastEnhancedCommand=t;
    const parts=splitSteps(t);if(parts.length>1){enhancedQueue=parts.map((command,i)=>({id:'qs_'+Date.now()+'_'+i,command,status:'pending'}));enhancedQueueIndex=0;saveJSON(QUEUE_KEY,enhancedQueue);renderQueue();setJarvisResponse(`I split your request into **${parts.length} safe steps**. Review the Action Queue and press **Run Next**.`);refreshSuggestions(t);return true}
    let m=t.match(/^remember(?: that)?\s+(.+)/i);if(m){if(!confirm(`Allow Jarvis to remember this locally?\n\n${m[1]}`))return true;window.addJarvisMemoryFactV283(m[1]);setJarvisResponse(`Remembered locally: **${m[1]}**`);return true}
    m=t.match(/^forget(?: that| about)?\s+(.+)/i);if(m){const mem=memory(),needle=m[1].toLowerCase(),before=mem.facts.length;mem.facts=mem.facts.filter(x=>!x.text.toLowerCase().includes(needle));saveMemory(mem);setJarvisResponse(before===mem.facts.length?'I could not find a matching saved fact.':`Removed matching memory about **${m[1]}**.`);return true}
    if(/what do you know about my preparation|show my (preparation )?memory|my preparation profile/.test(low)){if(!memory().insights.lastScan)await window.scanJarvisWorkspaceV283(true);window.generateJarvisMemoryBriefV283(true);return true}
    if(/brief me|daily brief|morning brief|what should i (study|do) now|next best action/.test(low)){if(!memory().insights.lastScan||Date.now()-Date.parse(memory().insights.lastScan)>3600000)await window.scanJarvisWorkspaceV283(true);window.generateJarvisMemoryBriefV283(true);return true}
    const focus=t.match(/(?:start|begin)\s+(?:a\s+)?(\d{1,3})\s*(?:minute|min)\s+(?:focus|study)\s+(?:session\s+)?(?:on|for)?\s*(.*)/i);if(focus){const minutes=clamp(focus[1],5,300),task=focus[2]||'Highest-priority UPSC task',sub=Object.keys({Polity:1,History:1,Geography:1,Economy:1,Environment:1,Ethics:1,Essay:1,CSAT:1}).find(x=>task.toLowerCase().includes(x.toLowerCase()))||'General';if($('focusMinutesV262'))$('focusMinutesV262').value=minutes;if($('focusTaskV262'))$('focusTaskV262').value=task;if($('focusSubjectV262'))$('focusSubjectV262').value=[...$('focusSubjectV262').options].some(o=>o.value===sub)?sub:'General';if(typeof window.show==='function')window.show('timeHabitV262');if(typeof window.startFocusV262==='function')window.startFocusV262();setJarvisResponse(`Started a **${minutes}-minute focus session** for **${task}** in Focus & Habit Intelligence.`);return true}
    if(/continue (my )?(last|previous) (plan|task|command)/.test(low)){const h=safeJSON('mission_jarvis_history_v281',[]),last=h.find(x=>x.command&&x.command!==t);if(!last){setJarvisResponse('No previous Jarvis command is available.');return true}if($('jarvisCommandInputV281'))$('jarvisCommandInputV281').value=last.command;return false}
    if(/^run routine\s+(.+)/i.test(t)){const name=t.replace(/^run routine\s+/i,'').trim().toLowerCase(),r=routines().find(x=>x.name.toLowerCase().includes(name));if(!r){setJarvisResponse(`No routine matched **${name}**.`);return true}window.runJarvisRoutineV283(r.id);return true}
    return false
  }

  let baseRun=null,baseExecute=null,baseClear=null;
  async function runBaseJarvis(){if(!baseRun)throw new Error('Base Jarvis is still loading.');await baseRun();refreshSuggestions($('jarvisCommandInputV281')?.value||'')}
  function installJarvisEnhancements(){if(window.jarvisRunV281?.__v283)return true;if(typeof window.jarvisRunV281!=='function')return false;baseRun=window.jarvisRunV281;baseExecute=window.jarvisExecutePlanV281;baseClear=window.jarvisClearV281;const enhanced=async function(){try{const cmd=$('jarvisCommandInputV281')?.value.trim()||'';if(await handleEnhanced(cmd)){refreshSuggestions(cmd);return}await baseRun();refreshSuggestions(cmd)}catch(e){setJarvisResponse('Smart Jarvis stopped safely: '+(e?.message||e));console.error(e)}};enhanced.__v283=true;window.jarvisRunV281=enhanced;window.jarvisExecutePlanV281=async function(){await baseExecute();refreshSuggestions($('jarvisCommandInputV281')?.value||'')};window.jarvisClearV281=function(){baseClear();refreshSuggestions('');window.clearJarvisQueueV283()};return true}

  function installRouter(){if(routerInstalled)return true;if(typeof window.aiAskRouterV23!=='function')return false;if(window.aiAskRouterV23.__v301){routerInstalled=true;return true}if(!window.aiAskRouterV23.__v282){legacyRouter=window.aiAskRouterV23;window.aiAskRouterLegacyV23=legacyRouter;window.aiAskRouterV23=smartAsk;window.aiAsk=smartAsk;window.callGeminiDirectV23=smartAsk;routerInstalled=true}return true}
  function observeShow(){const old=window.show;if(typeof old!=='function'||old.__v283)return;const wrapped=function(id,btn){const r=old.apply(this,arguments);if(id==='jarvisCommandV281')setTimeout(()=>{renderMemory();renderRoutines();renderQueue();renderRouterUsage();refreshSuggestions(lastEnhancedCommand);if(!memory().insights.lastScan)window.scanJarvisWorkspaceV283(false).catch(()=>{})},100);if(id==='aiControlCentre')setTimeout(renderRouterUsage,80);return r};wrapped.__v283=true;window.show=wrapped}
  function init(){
    window.__MISSION_UPSC_VERSION__=VERSION;const badge=document.querySelector('.versionBadge');if(badge)badge.textContent='V28.3 • Smart Jarvis';if($('v275BuildBadge'))$('v275BuildBadge').textContent=`V28.3 • ${navigator.onLine?'Online':'Offline'}`;
    renderRouterUsage();renderMemory();renderRoutines();renderQueue();refreshSuggestions('');observeShow();
    document.addEventListener('mission-ai-route',e=>{const d=e.detail||{};if($('jarvisRouteMetricV282'))$('jarvisRouteMetricV282').textContent=d.provider||'Auto';if($('jarvisSmartRouteBadgeV282'))$('jarvisSmartRouteBadgeV282').textContent=`Smart route: ${d.provider||'ready'}`});
    let attempts=0;const timer=setInterval(()=>{attempts++;const a=installRouter(),b=installJarvisEnhancements();observeShow();if((a&&b)||attempts>80)clearInterval(timer)},100);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,220),{once:true});else setTimeout(init,80);
})();

/* ===== V28.1 JARVIS COMMAND CENTRE ===== */
(function(){
  const VERSION='28.1.1', HISTORY_KEY='mission_jarvis_history_v281';
  const $j=id=>document.getElementById(id);
  const day=()=>new Date().toISOString().slice(0,10);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=v=>typeof window.formatAI==='function'?window.formatAI(String(v||'')):`<pre style="white-space:pre-wrap">${esc(v)}</pre>`;
  let snapshot=null,snapshotAt=0,lastPlan=null,lastResponse='',voiceRecognition=null;

  function aiSettings(){try{return {mode:'ollama',ollamaModel:'gemma3:4b',...JSON.parse(localStorage.getItem('mission_ai_settings_v23')||'{}')}}catch(e){return {mode:'ollama',ollamaModel:'gemma3:4b'}}}
  function modeLabel(){const s=aiSettings();return s.mode==='ollama'?`Ollama • ${s.ollamaModel||'local'}`:s.mode==='gemini'?'Gemini cloud':s.mode==='chatgpt'?'ChatGPT prompt':'Smart Hybrid'}
  function history(){try{return JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]')}catch(e){return []}}
  function setHistory(a){localStorage.setItem(HISTORY_KEY,JSON.stringify((a||[]).slice(0,50)))}
  function itemTime(x){return Number(x?.createdAt?.seconds?x.createdAt.seconds*1000:x?.createdAt||x?.savedAt||0)}
  function datePlus(n){const d=new Date();d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)}
  function textOf(x){return [x?.title,x?.topic,x?.text,x?.q,x?.question,x?.subject,x?.body,x?.note,x?.content].filter(Boolean).join(' ')}
  function pending(x){return !x?.done&&!['done','complete','completed'].includes(String(x?.status||'').toLowerCase())}
  function due(x){return pending(x)&&(!x?.date||String(x.date)<=day())}

  const modules=[
    {id:'dashboard',label:'Command Dashboard',keys:['dashboard','home','command dashboard']},
    {id:'dailyCommandV261',label:'AI Daily Command Centre',keys:['daily planner','daily command','today plan','day plan','mission']},
    {id:'timeHabitV262',label:'Focus & Habit Intelligence',keys:['habit','focus','study log','time intelligence','timer']},
    {id:'memoryEngineV263',label:'AI Memory Engine',keys:['memory','spaced revision','recall']},
    {id:'aiControlCentre',label:'AI Control Centre',keys:['ai settings','ollama','gemini','chatgpt mode']},
    {id:'aiMentorPage',label:'AI Personal Mentor',keys:['mentor','personal mentor']},
    {id:'aiRevisionBrain',label:'AI Revision Brain',keys:['revision brain','weakness','weak topic']},
    {id:'aiLibraryAssistant',label:'AI Library Assistant',keys:['library assistant','search my notes','find notes']},
    {id:'currentAffairsAI',label:'AI Current Affairs Engine',keys:['current affairs','newspaper','the hindu']},
    {id:'evernoteNotes',label:'UPSC Notes Hub',keys:['notes hub','my notes']},
    {id:'syllabusCommand',label:'Syllabus Command',keys:['syllabus']},
    {id:'countdownPage',label:'Exam Countdown',keys:['countdown','exam date']},
    {id:'strategyRoomV271',label:'AI Strategy Room',keys:['strategy','long term plan']},
    {id:'rankReadinessV272',label:'Readiness & Rank Intelligence',keys:['readiness','rank intelligence']},
    {id:'progressAutomationV274',label:'AI Progress & Automation Hub',keys:['progress','automation','weekly review']},
    {id:'pomodoroPage',label:'Pomodoro',keys:['pomodoro']},
    {id:'aiNotesPro',label:'AI Notes Studio',keys:['ai notes','create notes','generate notes']},
    {id:'aiPdfAnalyzer',label:'AI PDF Analyzer',keys:['pdf analyzer','analyze pdf']},
    {id:'prelimsWarRoomV251',label:'AI Prelims War Room',keys:['prelims','mcq','mock test']},
    {id:'mainsWarRoomV252',label:'Mains War Room',keys:['mains war room','answer writing','mains question']},
    {id:'interviewRoomV253',label:'AI Interview Room',keys:['interview','personality test','daf']},
    {id:'pyqIntelligence',label:'PYQ Intelligence Pro',keys:['pyq','previous year']},
    {id:'onePagerAI',label:'One Pager AI',keys:['one pager']},
    {id:'mindMapStudio',label:'Mind Map Studio',keys:['mindmap','mind map']},
    {id:'answerEvaluator',label:'Answer Evaluator',keys:['answer evaluator','evaluate answer']},
    {id:'smartFlashcards',label:'Smart Flashcards',keys:['flashcards','flashcard']},
    {id:'wrongAnswerNotebook',label:'Wrong Answer Notebook',keys:['wrong answer','mistake notebook']},
    {id:'topperAnswers',label:'Topper Answer Bank',keys:['topper answer']},
    {id:'fileVault',label:'File Vault',keys:['file vault','files']},
    {id:'libraryShelf',label:'AI Digital Library Pro',keys:['digital library','library pro']},
    {id:'mapsCommand',label:'UPSC Maps Command',keys:['maps','map command']},
    {id:'voiceSaarthi',label:'AI Voice Saarthi',keys:['voice saarthi','voice assistant']},
    {id:'richNotesV4',label:'Rich Note Studio Pro',keys:['rich note','note studio']},
    {id:'aiCalendarV4',label:'AI Smart Calendar',keys:['calendar','smart calendar']},
    {id:'knowledgeGraphProV273',label:'Knowledge Graph Pro',keys:['knowledge graph','graph']},
    {id:'settings',label:'Setup',keys:['setup','backup','settings']}
  ];
  const subjectMap={polity:'Polity',history:'History',geography:'Geography',economy:'Economy',environment:'Environment','science and tech':'Science & Tech','science & tech':'Science & Tech',science:'Science & Tech',ethics:'Ethics',essay:'Essay','current affairs':'Current Affairs',csat:'CSAT',optional:'Optional'};
  function subjectFrom(s){const t=String(s||'').toLowerCase();for(const [k,v] of Object.entries(subjectMap))if(t.includes(k))return v;return 'Mixed GS'}
  function routeFrom(s){const t=String(s||'').toLowerCase();return modules.find(m=>m.keys.some(k=>t.includes(k)))||null}
  function topicFrom(s){let t=String(s||'').trim();const m=t.match(/(?:\bon\b|\babout\b|\bfor\b|\bof\b)\s+(.+)$/i);if(m)t=m[1];t=t.replace(/\b(?:please|now|today|tomorrow|using my weak topics|using my notes|with pyq angle|for upsc|upsc)\b/gi,' ').replace(/\s+/g,' ').trim();return t||'UPSC topic'}
  function selectedDate(s){const t=String(s||'').toLowerCase();if(t.includes('tomorrow'))return datePlus(1);const iso=t.match(/\b(20\d{2}-\d{2}-\d{2})\b/);return iso?iso[1]:day()}
  function plan(intent,title,destination,summary,data={},requiresConfirm=false,confidence=92,steps=[]){return {intent,title,destination,summary,data,requiresConfirm,confidence,steps:steps.length?steps:[`Open ${modules.find(x=>x.id===destination)?.label||destination}`,summary]}}

  function parseCommand(command){
    const raw=String(command||'').trim(),t=raw.toLowerCase(),sub=subjectFrom(t),topic=topicFrom(raw),ai=/\b(ai|intelligent|best|deep)\b/i.test(raw);
    if(!raw)return plan('empty','Waiting for command','jarvisCommandV281','Enter a command first.',{},false,0,[]);
    if(/^(help|what can you do|commands)/i.test(t))return plan('help','Show Jarvis capabilities','jarvisCommandV281','Display supported command examples.',{},false,100,['Show command guide']);
    if(/\b(open|go to|show me|take me to)\b/i.test(t)){const r=routeFrom(t);if(r)return plan('open_module',`Open ${r.label}`,r.id,`Navigate to ${r.label}.`,{label:r.label},false,99,[`Open ${r.label}`])}
    if(/\b(plan|schedule)\b.*\b(day|today)\b|\bplan my day\b/i.test(t)){const h=Number((t.match(/(\d+(?:\.\d+)?)\s*hours?/)||[])[1]||7);return plan('daily_plan','Build today’s UPSC mission','dailyCommandV261',`${ai?'Use selected AI':'Use local preparation evidence'} to build a realistic ${h}-hour mission.`,{hours:h,ai,priority:raw},false,96,['Load due revision, weak areas, calendar and pending tasks',`Fit priorities into ${h} hours`,ai?'Generate the mission with selected AI':'Build the mission locally'])}
    if(/\b(mcq|mcqs|questions|prelims test|mock test)\b/i.test(t)&&!/mains/i.test(t)){const n=Number((t.match(/\b(\d{1,3})\s*(?:mcq|mcqs|questions)/)||[])[1]||25);return plan('generate_mcq',`Generate ${n} ${sub} MCQs`,'prelimsWarRoomV251',`Prepare a UPSC-pattern test on ${topic}.`,{count:Math.min(100,Math.max(5,n)),subject:sub,topic},false,96,['Fill Prelims War Room settings',`Generate ${n} questions with the selected AI`,'Open the timed test'])}
    if(/\b(create|make|generate|prepare)\b.*\b(notes?|study note)\b|\bnotes? on\b/i.test(t)){return plan('generate_notes',`Create UPSC notes: ${topic}`,'aiNotesPro',`Generate structured ${sub} notes with PYQ, examples and revision capsule.`,{topic,subject:sub},false,95,['Fill AI Notes Studio',`Generate notes using ${modeLabel()}`])}
    if(/\b(mind\s*map|mindmap)\b/i.test(t)){return plan('generate_mindmap',`Build mindmap: ${topic}`,'mindMapStudio',`Generate a detailed UPSC mindmap on ${topic}.`,{topic,subject:sub},false,96,['Open Mind Map Studio','Generate AI branches','Render the map'])}
    if(/\bflashcards?\b/i.test(t)){const n=Number((t.match(/\b(\d{1,3})\s*flashcards?/)||[])[1]||10);return plan('generate_flashcards',`Create ${n} flashcards: ${topic}`,'smartFlashcards',`Generate active-recall cards for ${topic}.`,{topic,subject:sub,count:n},true,94,['Open Smart Flashcards',`Generate and save about ${n} cards`])}
    if(/\b(weakest|weak areas?|weak topics?|diagnose.*weak|revision plan)\b/i.test(t)){return plan('weakness_repair','Diagnose weak areas','aiRevisionBrain','Run local diagnosis and prepare the Revision Brain for a repair plan.',{ai},false,94,['Scan wrong answers, due revisions and performance','Open AI Revision Brain','Run local diagnosis'])}
    if(/\b(add|schedule|remind|revise)\b.*\b(revision|revise|topic)\b/i.test(t)){return plan('add_revision',`Schedule revision: ${topic}`,'aiRevisionBrain',`Add ${topic} to Revision Brain for ${selectedDate(t)}.`,{topic,subject:sub,date:selectedDate(t)},true,91,['Create a pending revision task','Open AI Revision Brain'])}
    if(/\b(add|schedule|remind)\b.*\b(calendar|tomorrow|today|at\s+\d)\b/i.test(t)){return plan('calendar_item','Add calendar block','aiCalendarV4',`Schedule “${topic}” on ${selectedDate(t)}.`,{title:topic,date:selectedDate(t),subject:sub},true,90,['Create calendar event','Open AI Smart Calendar'])}
    if(/\b(add|create)\b.*\btask\b/i.test(t)){return plan('add_task','Add UPSC task','dailyCommandV261',`Add “${topic}” to the task queue.`,{title:topic,subject:sub},true,90,['Create pending task','Open Daily Command Centre'])}
    if(/\b(mains|10 marker|15 marker|20 marker)\b/i.test(t)&&/\b(question|practice|write)\b/i.test(t)){const marks=Number((t.match(/\b(10|15|20)\s*(?:marker|marks?)/)||[])[1]||15);return plan('mains_question',`Prepare ${marks}-mark Mains practice`,'mainsWarRoomV252',`Generate a ${marks}-mark ${sub} question on ${topic}.`,{topic,subject:sub,marks},false,93,['Fill Mains War Room settings','Generate a syllabus-linked question'])}
    if(/\b(evaluate|check|review)\b.*\b(answer|mains|essay)\b/i.test(t)){return plan('mains_evaluate','Open Mains evaluation workspace','mainsWarRoomV252','Open the evaluator and prepare the question field. Paste or upload your answer there.',{topic,subject:sub},false,92,['Open Mains War Room','Paste/upload the answer','Run evaluation'])}
    if(/\b(find|search|locate)\b.*\b(note|notes|library|resource|pdf|file)\b/i.test(t)){const query=raw.replace(/^.*?\b(?:find|search|locate)\b/i,'').replace(/\b(?:my|the|notes?|library|resources?|pdfs?|files?|and)\b/gi,' ').replace(/\s+/g,' ').trim()||topic;return plan('library_search',`Search workspace: ${query}`,'aiLibraryAssistant',`Search personal notes, files, library, flashcards and reports for ${query}.`,{query},false,97,['Open AI Library Assistant','Search all connected study collections'])}
    if(/\b(interview|personality test|mock interview)\b/i.test(t)){return plan('interview','Open AI Interview Room','interviewRoomV253','Open the DAF-based interview workspace. Jarvis will not start until a DAF is available.',{},false,91,['Open AI Interview Room','Load/save DAF and start when ready'])}
    if(/\b(readiness|am i ready|rank probability)\b/i.test(t)){return plan('readiness','Recalculate preparation readiness','rankReadinessV272','Use actual preparation records to refresh readiness intelligence.',{},false,95,['Open Readiness Intelligence','Recalculate from saved evidence'])}
    if(/\b(strategy|days for prelims|months for prelims|long term plan)\b/i.test(t)){return plan('strategy','Open AI Strategy Room','strategyRoomV271','Open the evidence-based strategy builder.',{command:raw},false,91,['Open Strategy Room','Use command as the main constraint'])}
    const r=routeFrom(t);if(r)return plan('open_module',`Open ${r.label}`,r.id,`Navigate to ${r.label}.`,{label:r.label},false,82,[`Open ${r.label}`]);
    return plan('ai_guidance','Ask Jarvis AI','jarvisCommandV281','Use the selected AI to answer the request using a compact preparation snapshot.',{command:raw},false,70,['Build a privacy-limited preparation snapshot',`Ask ${modeLabel()}`,'Return guidance inside Jarvis']);
  }

  async function collectSnapshot(force=false){
    if(!force&&snapshot&&Date.now()-snapshotAt<60000)return snapshot;
    const get=window.getCol||(async()=>[]);
    const cols=['tasks','calendarItems','smartRevision','revision','wrongbook','prelimsReports','mainsWarReports','flash','memoryCardsV263','notes','richNotesV4','digitalLibrary'];
    const rows=await Promise.all(cols.map(c=>get(c).catch(()=>[])));const data=Object.fromEntries(cols.map((c,i)=>[c,rows[i]||[]]));
    const revisions=[...data.smartRevision,...data.revision],memDue=data.memoryCardsV263.filter(x=>!x.nextReview||String(x.nextReview)<=day()).length;
    const prelims=[...data.prelimsReports].sort((a,b)=>itemTime(b)-itemTime(a))[0]||{},mains=[...data.mainsWarReports].sort((a,b)=>itemTime(b)-itemTime(a))[0]||{};
    snapshot={openTasks:data.tasks.filter(pending).length,dueRevision:revisions.filter(due).length,recallDue:memDue,todayEvents:data.calendarItems.filter(x=>String(x.date||'')===day()).length,workspace:data.notes.length+data.richNotesV4.length+data.digitalLibrary.length+data.flash.length,wrong:data.wrongbook.length,latestPrelims:prelims.scorePercent??prelims.accuracy??null,latestMains:mains.scorePercent??(mains.score&&mains.maxMarks?Math.round(mains.score/mains.maxMarks*100):null),collections:data};snapshotAt=Date.now();return snapshot
  }

  function renderContext(){if(!snapshot)return;const rows=[['📌','Open task queue',snapshot.openTasks,'pending actions'],['🔁','Revision backlog',snapshot.dueRevision,'due or overdue'],['🧠','Active recall',snapshot.recallDue,'cards due'],['🗓️','Today calendar',snapshot.todayEvents,'scheduled blocks'],['📚','Study workspace',snapshot.workspace,'notes, library and cards'],['❌','Mistake evidence',snapshot.wrong,'wrong-answer records'],['🎯','Latest Prelims',snapshot.latestPrelims==null?'—':Math.round(snapshot.latestPrelims)+'%','available score'],['✍️','Latest Mains',snapshot.latestMains==null?'—':Math.round(snapshot.latestMains)+'%','available score']];const box=$j('jarvisContextV281');if(box)box.innerHTML=rows.map(x=>`<div class="v281ContextRow"><span>${x[0]}</span><div><b>${esc(x[1])}</b><small>${esc(x[3])}</small></div><strong>${esc(x[2])}</strong></div>`).join('');[['jarvisOpenTasksV281',snapshot.openTasks],['jarvisDueRevisionV281',snapshot.dueRevision],['jarvisRecallDueV281',snapshot.recallDue],['jarvisTodayEventsV281',snapshot.todayEvents],['jarvisWorkspaceV281',snapshot.workspace]].forEach(([id,v])=>{if($j(id))$j(id).textContent=v})}
  window.refreshJarvisContextV281=async function(force=false){const box=$j('jarvisContextV281');if(box)box.innerHTML='<div class="aiLoading">Reading preparation signals…</div>';try{await collectSnapshot(force);renderContext();if($j('jarvisStatusV281'))$j('jarvisStatusV281').textContent='Context ready'}catch(e){if(box)box.textContent='Context scan failed safely: '+e.message}}

  function renderPlan(p){lastPlan=p;const dest=modules.find(x=>x.id===p.destination)?.label||'Jarvis';if($j('jarvisConfidenceV281'))$j('jarvisConfidenceV281').textContent=p.confidence+'% confidence';const box=$j('jarvisPlanV281');if(box)box.innerHTML=`<div class="v281PlanGrid"><div class="v281PlanFact"><span>Intent</span><b>${esc(p.title)}</b></div><div class="v281PlanFact"><span>Destination</span><b>${esc(dest)}</b></div><div class="v281PlanFact"><span>AI route</span><b>${esc(modeLabel())}</b></div><div class="v281PlanFact"><span>Safety</span><b>${p.requiresConfirm?'Confirmation required':'Safe to run'}</b></div></div><ol class="v281PlanSteps">${p.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol><div class="v281Safety ${p.requiresConfirm?'confirm':'safe'}">${p.requiresConfirm?'This action saves or changes data. Review it, then press Execute Planned Action.':'This action is non-destructive and can run immediately.'}</div>`;const b=$j('jarvisExecuteBtnV281');if(b)b.disabled=false}
  function setResponse(text,loading=false){lastResponse=String(text||'');const box=$j('jarvisResponseV281');if(box)box.innerHTML=loading?'<div class="aiLoading">Jarvis is working…</div>':fmt(lastResponse)}
  function addHistory(command,p,status='completed'){const a=history();a.unshift({id:'j_'+Date.now(),command,intent:p?.intent||'',title:p?.title||'',destination:p?.destination||'',status,time:new Date().toISOString()});setHistory(a);renderHistory()}
  function renderHistory(){const box=$j('jarvisHistoryV281');if(!box)return;const a=history();box.innerHTML=a.length?a.map(x=>`<div class="v281HistoryItem"><button type="button" onclick="jarvisReplayV281('${esc(x.id)}')"><b>${esc(x.command)}</b><span>${esc(new Date(x.time).toLocaleString())}</span><small>${esc(x.title||x.intent)}</small></button></div>`).join(''):'<div class="emptyState">No Jarvis commands yet.</div>'}

  async function execute(p,command){
    const auto=$j('jarvisAutoOpenV281')?.checked!==false,show=id=>{if(auto&&typeof window.show==='function')window.show(id)};
    if($j('jarvisStatusV281'))$j('jarvisStatusV281').textContent='Working';
    try{
      switch(p.intent){
        case 'help': setResponse('# Jarvis command examples\n\n- Plan my day for 7 hours\n- Generate 25 Economy MCQs on inflation\n- Create detailed notes on Article 14\n- Make a mindmap on cooperative federalism\n- Create 15 flashcards on biodiversity\n- Find my climate-change notes\n- Diagnose my weakest areas\n- Schedule revision on monetary policy tomorrow\n- Generate a 15-mark GS2 Mains question on federalism\n- Open Interview Room');break;
        case 'open_module': show(p.destination);setResponse(`Opened **${p.data.label||modules.find(x=>x.id===p.destination)?.label}**.`);break;
        case 'daily_plan':
          if($j('commandDateV261'))$j('commandDateV261').value=day();if($j('commandHoursAvailableV261')){const sel=$j('commandHoursAvailableV261'),v=String(p.data.hours);if(![...sel.options].some(o=>o.value===v))sel.add(new Option(`${v} hours`,v));sel.value=v}if($j('commandPriorityV261'))$j('commandPriorityV261').value=p.data.priority||'';show('dailyCommandV261');setResponse(`Building a ${p.data.hours}-hour mission from your preparation evidence…`,true);if(p.data.ai&&typeof window.generateAIMissionV261==='function')await window.generateAIMissionV261();else if(typeof window.buildLocalMissionV261==='function')await window.buildLocalMissionV261();setResponse(`Today’s ${p.data.hours}-hour mission is ready in **AI Daily Command Centre**.`);break;
        case 'generate_mcq':
          [['prelimsSubjectV251',p.data.subject],['prelimsTopicV251',p.data.topic],['prelimsTestTitleV251',`${p.data.subject} — ${p.data.topic}`]].forEach(([id,v])=>{if($j(id))$j(id).value=v});if($j('prelimsQuestionCountV251')){const sel=$j('prelimsQuestionCountV251'),v=String(p.data.count);if(![...sel.options].some(o=>o.value===v))sel.add(new Option(`${v} Questions`,v));sel.value=v}show('prelimsWarRoomV251');setResponse(`Generating ${p.data.count} UPSC MCQs on ${p.data.topic}…`,true);if(typeof window.generatePrelimsTestV251==='function')await window.generatePrelimsTestV251();setResponse(`The ${p.data.count}-question test has been sent to **AI Prelims War Room**. In ChatGPT Prompt Mode, import the returned JSON there.`);break;
        case 'generate_notes':
          if($j('aiTopic'))$j('aiTopic').value=p.data.topic;if($j('aiNoteSubject'))$j('aiNoteSubject').value=p.data.subject==='Mixed GS'?'Polity':p.data.subject;show('aiNotesPro');setResponse(`Generating UPSC notes on ${p.data.topic}…`,true);if(typeof window.generateAINotesV231==='function')await window.generateAINotesV231();setResponse(`Notes generation started in **AI Notes Studio** using ${modeLabel()}.`);break;
        case 'generate_mindmap':
          if($j('mmTopic'))$j('mmTopic').value=p.data.topic;if($j('mmSubject'))$j('mmSubject').value=p.data.subject;show('mindMapStudio');setResponse(`Generating a mindmap on ${p.data.topic}…`,true);if(typeof window.generateMindMapAI==='function')await window.generateMindMapAI();setResponse(`Mindmap created in **Mind Map Studio**.`);break;
        case 'generate_flashcards':
          if($j('flashSourceText'))$j('flashSourceText').value=`Create ${p.data.count} UPSC flashcards on ${p.data.topic}`;if($j('flashQAI'))$j('flashQAI').value=p.data.topic;if($j('flashSubjectAI'))$j('flashSubjectAI').value=p.data.subject==='Mixed GS'?'Polity':p.data.subject;show('smartFlashcards');setResponse(`Generating flashcards on ${p.data.topic}…`,true);if(typeof window.generateFlashcardsAI==='function')await window.generateFlashcardsAI();setResponse(`Flashcards were generated in **Smart Flashcards**. Review the saved cards there.`);break;
        case 'weakness_repair':
          show('aiRevisionBrain');setResponse('Running local weak-area diagnosis…',true);if(typeof window.renderRevisionBrainLocalV241==='function')await window.renderRevisionBrainLocalV241();if(p.data.ai&&typeof window.generateRevisionBrainAIV241==='function')await window.generateRevisionBrainAIV241();setResponse('Weak-area diagnosis is ready in **AI Revision Brain**.');break;
        case 'add_revision':
          await window.saveCol('smartRevision',{topic:p.data.topic,subject:p.data.subject,source:'Jarvis V28.1.1.1',difficulty:'Medium',date:p.data.date,cycle:1,status:'pending',body:`Added from Jarvis command: ${command}`});show('aiRevisionBrain');setResponse(`Revision task **${p.data.topic}** was scheduled for ${p.data.date}.`);break;
        case 'calendar_item':
          await window.saveCol('calendarItems',{title:p.data.title,date:p.data.date,time:'',type:'Study',minutes:60,note:`Jarvis command: ${command}`,source:'Jarvis V28.1.1.1'});show('aiCalendarV4');if(typeof window.renderCalendarAI==='function')await window.renderCalendarAI();setResponse(`Added **${p.data.title}** to AI Smart Calendar for ${p.data.date}.`);break;
        case 'add_task':
          await window.saveCol('tasks',{text:p.data.title,title:p.data.title,subject:p.data.subject,done:false,date:day(),source:'Jarvis V28.1.1.1'});show('dailyCommandV261');setResponse(`Added **${p.data.title}** to your task queue.`);break;
        case 'mains_question':
          if($j('mainsWarTopicV252'))$j('mainsWarTopicV252').value=p.data.topic;if($j('mainsWarMarksV252')){$j('mainsWarMarksV252').value=String(p.data.marks);if(typeof window.syncMainsWarDefaultsV252==='function')window.syncMainsWarDefaultsV252()}const paper=p.data.subject==='Ethics'?'GS4':p.data.subject==='History'||p.data.subject==='Geography'?'GS1':p.data.subject==='Polity'?'GS2':p.data.subject==='Economy'||p.data.subject==='Environment'||p.data.subject==='Science & Tech'?'GS3':'GS2';if($j('mainsWarPaperV252'))$j('mainsWarPaperV252').value=paper;show('mainsWarRoomV252');setResponse('Generating a Mains practice question…',true);if(typeof window.generateDailyMainsQuestionV252==='function')await window.generateDailyMainsQuestionV252();setResponse(`A ${p.data.marks}-mark question is ready in **Mains War Room**.`);break;
        case 'mains_evaluate':
          if($j('mainsWarTopicV252'))$j('mainsWarTopicV252').value=p.data.topic==='UPSC topic'?'':p.data.topic;show('mainsWarRoomV252');setResponse('Opened **Mains War Room**. Paste or upload the question and answer, then press Evaluate Answer. Jarvis does not invent an answer file.');break;
        case 'library_search':
          if($j('librarySearchQueryV242'))$j('librarySearchQueryV242').value=p.data.query;show('aiLibraryAssistant');setResponse(`Searching your workspace for ${p.data.query}…`,true);if(typeof window.searchAILibraryV242==='function')await window.searchAILibraryV242();setResponse(`Search results for **${p.data.query}** are ready in AI Library Assistant.`);break;
        case 'interview': show('interviewRoomV253');setResponse('Opened **AI Interview Room**. Save or load your DAF, then start the mock interview.');break;
        case 'readiness': show('rankReadinessV272');setResponse('Recalculating readiness from actual records…',true);if(typeof window.calculateReadinessV272==='function')await window.calculateReadinessV272();setResponse('Readiness intelligence has been recalculated.');break;
        case 'strategy': if($j('strategyConstraintsV271'))$j('strategyConstraintsV271').value=p.data.command||'';show('strategyRoomV271');setResponse('Opened **AI Strategy Room** with your command added as a planning constraint.');break;
        case 'ai_guidance':
          if(!$j('jarvisUseAIV281')?.checked){setResponse('I could not map this command confidently. Rephrase it or choose a quick command.');break}await collectSnapshot();setResponse('Asking the selected AI with a limited preparation snapshot…',true);const context={openTasks:snapshot.openTasks,dueRevision:snapshot.dueRevision,recallDue:snapshot.recallDue,todayEvents:snapshot.todayEvents,wrongAnswers:snapshot.wrong,latestPrelims:snapshot.latestPrelims,latestMains:snapshot.latestMains};const prompt=`You are Jarvis inside Mission UPSC AI OS. Answer the user request practically and concisely. Do not claim to execute an action unless it is supported by the website. User request: ${p.data.command}. Limited preparation context: ${JSON.stringify(context)}. Give the best next action and name the relevant Mission UPSC module.`;const out=await window.aiAskRouterV23(prompt);setResponse(out);break;
        default:setResponse('Jarvis understood the command but no executor is registered yet. Open the suggested module manually.');
      }
      if($j('jarvisStatusV281'))$j('jarvisStatusV281').textContent='Completed';addHistory(command,p,'completed');await window.refreshJarvisContextV281(true);
    }catch(e){setResponse(`Jarvis stopped safely: ${e.message}`);if($j('jarvisStatusV281'))$j('jarvisStatusV281').textContent='Needs attention';addHistory(command,p,'failed');throw e}
  }

  window.jarvisRunV281=async function(){try{const command=$j('jarvisCommandInputV281')?.value.trim()||'';const p=parseCommand(command);renderPlan(p);if(!command)return setResponse('Type or speak a command first.');const safe=$j('jarvisSafeModeV281')?.checked!==false;if(p.requiresConfirm&&safe){setResponse(`I understood the request and prepared a safe action plan. Review it above, then press **Execute Planned Action**.`);return}await execute(p,command)}catch(e){setResponse('Jarvis stopped safely: '+(e?.message||e));console.error('Jarvis run failed',e)}};
  window.jarvisExecutePlanV281=async function(){try{if(!lastPlan)return alert('Run a command first.');const command=$j('jarvisCommandInputV281')?.value.trim()||lastPlan.summary;if(lastPlan.requiresConfirm&&!confirm(`Execute this Jarvis action?\n\n${lastPlan.summary}`))return;await execute(lastPlan,command)}catch(e){setResponse('Jarvis action stopped safely: '+(e?.message||e));console.error('Jarvis execute failed',e)}};
  window.jarvisSetCommandV281=function(text,run=false){if($j('jarvisCommandInputV281'))$j('jarvisCommandInputV281').value=text;if(run)window.jarvisRunV281()};
  window.jarvisClearV281=function(){if($j('jarvisCommandInputV281'))$j('jarvisCommandInputV281').value='';if($j('jarvisPlanV281'))$j('jarvisPlanV281').innerHTML='Enter a command. Jarvis will show exactly what it intends to do.';if($j('jarvisConfidenceV281'))$j('jarvisConfidenceV281').textContent='Waiting';if($j('jarvisExecuteBtnV281'))$j('jarvisExecuteBtnV281').disabled=true;lastPlan=null;setResponse('Jarvis is ready. Try one of the quick commands.')};
  window.jarvisCopyResponseV281=async function(){const text=$j('jarvisResponseV281')?.innerText.trim();if(!text)return;try{await navigator.clipboard.writeText(text);alert('Jarvis response copied.')}catch(e){alert(text)}};
  window.jarvisSaveResponseV281=async function(){const text=$j('jarvisResponseV281')?.innerText.trim();if(!text||text.startsWith('Jarvis is ready'))return alert('Run a command first.');const title=(lastPlan?.title||'Jarvis Response').slice(0,120);await window.saveCol('notes',{title,subject:'Jarvis',body:text,date:day(),type:'Jarvis Command',source:'V28.1.1'});alert('Jarvis response saved to Notes.')};
  window.jarvisClearHistoryV281=function(){if(!confirm('Clear Jarvis command history from this browser?'))return;setHistory([]);renderHistory()};
  window.jarvisReplayV281=function(id){const x=history().find(v=>v.id===id);if(!x)return;if($j('jarvisCommandInputV281'))$j('jarvisCommandInputV281').value=x.command;window.jarvisRunV281()};
  window.jarvisVoiceV281=function(){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR)return alert('Voice recognition is unavailable. Use Chrome or type the command.');if(voiceRecognition){try{voiceRecognition.stop()}catch(e){}voiceRecognition=null;return}voiceRecognition=new SR();voiceRecognition.lang='en-IN';voiceRecognition.interimResults=true;voiceRecognition.continuous=false;let final='';voiceRecognition.onstart=()=>{if($j('jarvisMicBtnV281'))$j('jarvisMicBtnV281').textContent='⏹ Stop';if($j('jarvisVoiceStatusV281'))$j('jarvisVoiceStatusV281').textContent='Listening…'};voiceRecognition.onresult=e=>{let interim='';for(let i=e.resultIndex;i<e.results.length;i++){if(e.results[i].isFinal)final+=e.results[i][0].transcript;else interim+=e.results[i][0].transcript}if($j('jarvisCommandInputV281'))$j('jarvisCommandInputV281').value=(final+' '+interim).trim()};voiceRecognition.onerror=e=>{if($j('jarvisVoiceStatusV281'))$j('jarvisVoiceStatusV281').textContent='Mic error: '+e.error};voiceRecognition.onend=()=>{voiceRecognition=null;if($j('jarvisMicBtnV281'))$j('jarvisMicBtnV281').textContent='🎤 Speak';if($j('jarvisVoiceStatusV281'))$j('jarvisVoiceStatusV281').textContent='Voice captured. Press Understand & Run.'};voiceRecognition.start()};

  function init(){if($j('jarvisAIModeV281'))$j('jarvisAIModeV281').textContent='AI mode: '+modeLabel();renderHistory();const prev=window.show;if(typeof prev==='function'&&!prev.__v281){const wrapped=function(id,btn){const r=prev.apply(this,arguments);if(id==='jarvisCommandV281')setTimeout(()=>{if($j('jarvisAIModeV281'))$j('jarvisAIModeV281').textContent='AI mode: '+modeLabel();window.refreshJarvisContextV281(false);renderHistory()},90);return r};wrapped.__v281=true;window.show=wrapped}window.__MISSION_UPSC_VERSION__=VERSION;const badge=document.querySelector('.versionBadge');if(badge)badge.textContent='V28.1.1 • Jarvis Command Centre';if($j('v275BuildBadge'))$j('v275BuildBadge').textContent=`V28.1.1 • ${navigator.onLine?'Online':'Offline'}`}
  window.openJarvisV2811=function(btn){
    try{
      if(typeof window.show==='function') return window.show('jarvisCommandV281',btn);
      document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
      const target=$j('jarvisCommandV281');if(target)target.classList.add('active');
      document.querySelectorAll('.nav button').forEach(b=>b.classList.remove('active'));
      if(btn)btn.classList.add('active');
      $j('sidebar')?.classList.remove('open');
      setTimeout(()=>window.refreshJarvisContextV281(false),60);
    }catch(e){alert('Jarvis could not open: '+e.message)}
  };
  function bootV2811(){
    try{init();}
    catch(e){
      const box=$j('jarvisResponseV281');
      if(box)box.textContent='Jarvis initialization stopped safely: '+e.message;
      console.error('Jarvis V28.1.1 init',e);
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(bootV2811,180),{once:true});
  else setTimeout(bootV2811,50);
})();

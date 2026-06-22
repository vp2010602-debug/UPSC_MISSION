/* Mission UPSC AI OS V30.4.0 — final polish and unified secure AI bridge */
(function(){
  'use strict';
  const VERSION='30.4.0';
  const SETTINGS_KEY='mission_ai_settings_v23';
  const HISTORY_KEY='mission_chatgpt_history_v304';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'')||fallback}catch(_){return fallback}};
  const write=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
  const words=v=>(String(v||'').trim().match(/\S+/g)||[]).length;
  const today=()=>new Date().toISOString().slice(0,10);
  const slug=v=>String(v||'upsc-response').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,72)||'upsc-response';
  let companion=null;
  let lastGeminiAnswer='';

  function settings(){const v={mode:'gemini',geminiModel:'gemini-2.5-flash',geminiProxyUrl:'https://upscai-6p5eaebvfa-uc.a.run.app',temperature:.2,maxOutputTokens:8192,...read(SETTINGS_KEY,{}),geminiTransport:'proxy',geminiKey:''};v.geminiProxyUrl=String(v.geminiProxyUrl||'https://upscai-6p5eaebvfa-uc.a.run.app').trim().replace(/\/$/,'');return v;}
  async function secureGemini(prompt){
    const s=settings(),url=String(s.geminiProxyUrl||'').trim().replace(/\/$/,'');
    if(!url)throw new Error('Secure Gemini proxy URL is missing. Save it in AI Control Centre.');
    if(typeof window.getFirebaseIdTokenV301!=='function')throw new Error('Google sign-in bridge is unavailable. Refresh and sign in again.');
    const call=async force=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${await window.getFirebaseIdTokenV301(force)}`},body:JSON.stringify({prompt:String(prompt||''),model:s.geminiModel||'gemini-2.5-flash',temperature:Number(s.temperature??.2),maxOutputTokens:Number(s.maxOutputTokens||8192)})});
    let r=await call(false);if(r.status===401)r=await call(true);
    const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||d.message||`Gemini proxy HTTP ${r.status}`);
    const out=String(d.result||d.text||'').trim();if(!out)throw new Error('Gemini returned an empty response.');return out;
  }
  async function unifiedAI(prompt,meta={}){
    const clean=String(prompt||'').trim();if(!clean)throw new Error('Enter a topic, question or source text first.');
    if(typeof window.ensureSecureAIRouterV3015==='function')window.ensureSecureAIRouterV3015();
    const start=Date.now();while(typeof window.aiAskRouterV23!=='function'&&Date.now()-start<8000)await new Promise(r=>setTimeout(r,100));
    if(typeof window.aiAskRouterV23!=='function')throw new Error('Unified AI router is unavailable. Save AI settings and refresh once.');
    return await window.aiAskRouterV23(clean,meta);
  }
  unifiedAI.__v301=true;unifiedAI.__v3015=true;unifiedAI.__v304=true;
  window.missionAskAI=unifiedAI;
  window.missionAskGeminiV304=secureGemini;

  function installUnifiedAliases(){
    if(typeof window.ensureSecureAIRouterV3015==='function')window.ensureSecureAIRouterV3015();
    window.aiAskV4=unifiedAI;
    window.callAI=async function(type,payload={}){
      const prompts={
        newspaper:`Analyse this article for UPSC with exact syllabus linkage, background, Prelims facts/traps, Mains dimensions, data/reports only when defensible, PYQ themes, one MCQ, one Mains question and a revision capsule.\n\n${payload.text||payload.article||''}`,
        notes:`Create complete UPSC notes on ${payload.topic||'the topic'}. Include core concept, syllabus link, Prelims, Mains, examples, PYQ themes, flowchart, flashcards, MCQs and revision checklist.\n\n${payload.text||''}`,
        mentor:`Act as a strict UPSC mentor. Diagnose and create a measurable plan without inventing evidence.\n\n${payload.question||''}`
      };
      return await unifiedAI(prompts[type]||payload.question||payload.text||JSON.stringify(payload),{task:type});
    };
    document.documentElement.dataset.aiBridge='v304-secure';
  }

  function promptState(){return {
    task:$('chatgptTaskV301')?.value||'notes',marks:Number($('chatgptMarksV301')?.value||10),paper:$('chatgptPaperV301')?.value||'',question:$('chatgptQuestionV301')?.value||'',answer:$('chatgptAnswerV301')?.value||'',source:$('chatgptSourceV301')?.value||'',prompt:$('chatgptPromptV301')?.value||'',response:$('chatgptResponseV301')?.value||''
  }}
  function setStatus(text){const e=$('chatgptWorkspaceStatusV301');if(e)e.textContent=text;}
  function promptHealth(){
    const s=promptState();let score=15;
    if(s.task)score+=10;if(s.question.trim())score+=25;if(s.paper.trim())score+=10;if(s.prompt.trim())score+=25;
    if(['mains-evaluator','ethics'].includes(s.task)&&s.answer.trim())score+=15;else if(!['mains-evaluator','ethics'].includes(s.task)&&s.source.trim())score+=10;
    score=Math.min(100,score);
    const set=(id,val)=>{const e=$(id);if(e)e.textContent=val};
    set('v304HealthScore',score+'%');set('v304PromptWords',words(s.prompt)+' words');set('v304ResponseWords',words(s.response)+' words');set('v304TaskHealth',s.question.trim()?'Ready':'Question needed');
    const bar=$('v304HealthBar');if(bar)bar.style.width=score+'%';
  }
  function setPreset(task,question,paper=''){
    if($('chatgptTaskV301'))$('chatgptTaskV301').value=task;
    if($('chatgptQuestionV301'))$('chatgptQuestionV301').value=question;
    if($('chatgptPaperV301')&&paper)$('chatgptPaperV301').value=paper;
    if(typeof window.updateChatGPTTemplateV301==='function')window.updateChatGPTTemplateV301();
    promptHealth();$('chatgptQuestionV301')?.focus();
  }
  window.usePromptPresetV304=(name)=>{
    const presets={
      article14:['notes','Explain Article 14 separately for UPSC Prelims and Mains, including doctrines, exceptions, landmark judgments, PYQ themes and a revision capsule.','GS2 • Polity'],
      evaluate:['mains-evaluator','Paste the exact Mains question here.','General Studies'],
      topper10:['topper-answer','Write a strict 10-marker answer to this question.','General Studies'],
      ca:['current-affairs','Analyse today’s UPSC-relevant issue using the supplied source text.','Current Affairs'],
      mentor:['saarathi','Extract this mentor instruction into a weekly plan, daily targets, tests, revision and reporting tasks.','Saarthi Mentorship']
    };const p=presets[name];if(p)setPreset(...p);
  };

  function addPromptEnhancements(){
    const workspace=document.querySelector('#chatgptPromptHubV302 .v301PromptWorkspace');if(!workspace)return false;
    if(!workspace.querySelector('.v304PromptSteps')){
      const head=workspace.querySelector('.v301WorkspaceHead');
      const steps=document.createElement('div');steps.className='v304PromptSteps';steps.innerHTML='<div class="v304PromptStep"><b>1</b><span>Choose UPSC task</span></div><div class="v304PromptStep"><b>2</b><span>Generate & copy prompt</span></div><div class="v304PromptStep"><b>3</b><span>Use ChatGPT companion</span></div><div class="v304PromptStep"><b>4</b><span>Paste, compare & save</span></div>';head?.insertAdjacentElement('afterend',steps);
      const tools=document.createElement('div');tools.className='v304PromptTools';tools.innerHTML='<div class="v304PresetCard"><h3>Quick UPSC presets</h3><div class="v304PresetRow"><button class="v304PresetChip" onclick="usePromptPresetV304(\'article14\')">Article explanation</button><button class="v304PresetChip" onclick="usePromptPresetV304(\'evaluate\')">Strict evaluator</button><button class="v304PresetChip" onclick="usePromptPresetV304(\'topper10\')">10-marker model</button><button class="v304PresetChip" onclick="usePromptPresetV304(\'ca\')">Current affairs</button><button class="v304PresetChip" onclick="usePromptPresetV304(\'mentor\')">Mentor plan</button></div></div><div class="v304HealthCard"><h3>Prompt readiness</h3><div class="v304HealthGrid"><div class="v304HealthMetric"><span>Health</span><b id="v304HealthScore">0%</b></div><div class="v304HealthMetric"><span>Task</span><b id="v304TaskHealth">Question needed</b></div><div class="v304HealthMetric"><span>Prompt</span><b id="v304PromptWords">0 words</b></div><div class="v304HealthMetric"><span>Response</span><b id="v304ResponseWords">0 words</b></div></div><div class="v304HealthBar"><i id="v304HealthBar"></i></div></div>';steps.insertAdjacentElement('afterend',tools);
    }
    const promptActions=workspace.querySelector('#chatgptPromptV301')?.nextElementSibling;
    if(promptActions&&!$('v304ImprovePrompt')){
      promptActions.insertAdjacentHTML('beforeend','<button id="v304ImprovePrompt" class="btn purple" type="button" onclick="improvePromptWithGeminiV304()">✨ Gemini Improve</button><button class="btn green" type="button" onclick="runPromptWithGeminiV304()">☁ Run with Gemini</button><button class="btn ghost" type="button" onclick="togglePromptFocusV304()">⛶ Focus</button>');
    }
    const responseActions=$('chatgptResponseV301')?.nextElementSibling;
    if(responseActions&&!$('v304WordBtn'))responseActions.insertAdjacentHTML('beforeend','<button id="v304WordBtn" class="btn gold" type="button" onclick="downloadChatGPTWordV304()">📄 Save Word</button><button class="btn ghost" type="button" onclick="copyChatGPTResponseV304()">📋 Copy Response</button><button class="btn ghost" type="button" onclick="previewChatGPTResponseV304()">👁 Preview</button>');
    if(!$('v304CompanionBar')){
      const launch=document.querySelector('#chatgptPromptHubV302 .v302MiniLaunchCard');
      launch?.insertAdjacentHTML('beforeend','<div id="v304CompanionBar" class="v304CompanionBar"><div><strong>Integrated manual workflow</strong><small>Your prompt and response stay in this section. ChatGPT opens beside JARVIS because its signed-in website cannot be placed inside another site.</small></div><div id="v304CompanionState" class="v304CompanionState" data-open="false"><i class="v304CompanionDot"></i><span>Companion closed</span></div></div>');
    }
    if(!$('v304ComparePanel')){
      const grid=workspace.querySelector('.v301WorkspaceGrid');
      grid?.insertAdjacentHTML('afterend','<div id="v304ResponsePreview" class="v304ResponsePreview"></div><div id="v304ComparePanel" class="v304ComparePanel"><div class="v304CompareHead"><div><h3>Gemini × ChatGPT Comparison</h3><p class="sub">Run the same prepared prompt with secure Gemini, paste ChatGPT’s answer, then compare or merge the strongest parts.</p></div><div class="actions"><button class="btn blue" onclick="compareAnswersV304()">Compare</button><button class="btn purple" onclick="mergeBestAnswersV304()">✨ Merge Best</button></div></div><div class="v304CompareGrid"><div class="v304CompareBox"><header><span>Gemini answer</span><small id="v304GeminiCount">0 words</small></header><div id="v304GeminiAnswer" class="v304CompareBody"><span class="v304CompareEmpty">Use “Run with Gemini” above.</span></div></div><div class="v304CompareBox"><header><span>ChatGPT answer</span><small id="v304ChatGPTCount">0 words</small></header><div id="v304ChatGPTAnswer" class="v304CompareBody"><span class="v304CompareEmpty">Paste ChatGPT’s response above.</span></div></div></div><div id="v304ComparisonSummary" class="v301WorkspaceStatus" style="margin-top:12px">Comparison is ready when both answers are available.</div></div>');
      workspace.insertAdjacentHTML('afterend','<div class="card v304PromptHistory"><div class="v302CardHead"><div><h2>Recent Prompt Sessions</h2><p class="sub">Reopen the last ten prompts and pasted answers stored on this device.</p></div><button class="btn ghost" onclick="renderPromptHistoryV304()">Refresh</button></div><div id="v304HistoryList" class="v304HistoryList"><div class="emptyState">No prompt sessions saved yet.</div></div></div>');
    }
    ['chatgptTaskV301','chatgptMarksV301','chatgptPaperV301','chatgptQuestionV301','chatgptAnswerV301','chatgptSourceV301','chatgptPromptV301','chatgptResponseV301'].forEach(id=>{const e=$(id);if(e&&!e.dataset.v304Bound){e.dataset.v304Bound='1';e.addEventListener('input',()=>{promptHealth();syncComparison()})}});
    promptHealth();syncComparison();renderPromptHistoryV304();return true;
  }

  window.improvePromptWithGeminiV304=async function(){
    const box=$('chatgptPromptV301');if(!box)return;let prompt=box.value.trim();if(!prompt&&typeof window.generateChatGPTPromptV301==='function'){window.generateChatGPTPromptV301();prompt=box.value.trim()}
    if(!prompt)return alert('Enter the question and generate a prompt first.');
    const old=box.value;box.value='Improving prompt with secure Gemini…';setStatus('Gemini is checking demand coverage, constraints and source safety.');
    try{box.value=await secureGemini(`Improve the UPSC prompt below without answering it. Preserve every strict word-limit, marking, subpart and evaluation rule. Remove ambiguity, prevent fabricated sources, and make the expected output easier to follow. Return only the improved prompt.\n\nPROMPT:\n${old}`);setStatus('Prompt improved with secure Gemini. Review it before copying.');promptHealth()}
    catch(e){box.value=old;setStatus('Prompt improvement failed: '+e.message)}
  };
  window.runPromptWithGeminiV304=async function(){
    const prompt=$('chatgptPromptV301')?.value.trim();if(!prompt)return alert('Generate the prompt first.');
    const box=$('v304GeminiAnswer');if(box)box.innerHTML='<div class="aiLoading">Secure Gemini is answering the same prompt…</div>';setStatus('Running prepared prompt through secure Gemini.');
    try{lastGeminiAnswer=await secureGemini(prompt);if(box)box.innerHTML=window.formatAI?window.formatAI(lastGeminiAnswer):`<pre>${esc(lastGeminiAnswer)}</pre>`;if($('v304GeminiCount'))$('v304GeminiCount').textContent=words(lastGeminiAnswer)+' words';setStatus('Gemini answer ready. Paste ChatGPT’s answer to compare.');compareAnswersV304()}
    catch(e){if(box)box.textContent='Gemini failed: '+e.message;setStatus('Gemini comparison failed: '+e.message)}
  };
  function syncComparison(){const r=$('chatgptResponseV301')?.value||'';const box=$('v304ChatGPTAnswer');if(box)box.innerHTML=r.trim()?(window.formatAI?window.formatAI(r):`<pre>${esc(r)}</pre>`):'<span class="v304CompareEmpty">Paste ChatGPT’s response above.</span>';if($('v304ChatGPTCount'))$('v304ChatGPTCount').textContent=words(r)+' words'}
  window.compareAnswersV304=function(){syncComparison();const c=$('chatgptResponseV301')?.value.trim()||'',g=lastGeminiAnswer.trim(),out=$('v304ComparisonSummary');if(!out)return;if(!g||!c){out.textContent='Run Gemini and paste the ChatGPT response before comparison.';return}const gw=words(g),cw=words(c);out.innerHTML=`<b>Comparison snapshot:</b> Gemini ${gw} words • ChatGPT ${cw} words. Check demand coverage, factual defensibility, structure, examples and word-limit compliance before merging.`};
  window.mergeBestAnswersV304=async function(){const c=$('chatgptResponseV301')?.value.trim()||'',g=lastGeminiAnswer.trim(),prompt=$('chatgptPromptV301')?.value.trim()||'';if(!g||!c)return alert('Run Gemini and paste the ChatGPT answer first.');setStatus('Gemini is merging the strongest defensible parts without inventing facts.');try{const merged=await secureGemini(`Using the original UPSC prompt and two candidate answers, produce one superior final answer. Follow the original format and word limit exactly. Retain only defensible facts; do not invent sources.\n\nORIGINAL PROMPT:\n${prompt}\n\nGEMINI DRAFT:\n${g}\n\nCHATGPT DRAFT:\n${c}`);$('chatgptResponseV301').value=merged;syncComparison();promptHealth();setStatus('Merged answer placed in the response editor. Review before saving.') }catch(e){setStatus('Merge failed: '+e.message)}};

  window.previewChatGPTResponseV304=function(){const body=$('chatgptResponseV301')?.value.trim();if(!body)return alert('Paste a response first.');const p=$('v304ResponsePreview');if(!p)return;p.innerHTML=window.formatAI?window.formatAI(body):`<pre>${esc(body)}</pre>`;p.classList.toggle('active');p.scrollIntoView({behavior:'smooth',block:'nearest'})};
  window.copyChatGPTResponseV304=async function(){const body=$('chatgptResponseV301')?.value.trim();if(!body)return alert('Paste a response first.');try{await navigator.clipboard.writeText(body);setStatus('Response copied.')}catch(_){$('chatgptResponseV301')?.select();setStatus('Clipboard blocked. Response selected for manual copy.')}};
  window.downloadChatGPTWordV304=function(){const s=promptState(),body=s.response.trim();if(!body)return alert('Paste a response first.');const html=`<!doctype html><html><head><meta charset="utf-8"><title>${esc(s.question||'UPSC Response')}</title><style>body{font-family:Arial,sans-serif;line-height:1.55;margin:42px;color:#17243a}h1{font-size:22px;border-bottom:2px solid #d8e2ef;padding-bottom:10px}pre{font-family:Arial,sans-serif;white-space:pre-wrap}</style></head><body><h1>${esc(s.question||'UPSC Response')}</h1><pre>${esc(body)}</pre></body></html>`;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([html],{type:'application/msword'}));a.download=`${slug(s.question)}-${today()}.doc`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
  window.togglePromptFocusV304=function(){const section=$('chatgptPromptHubV302');if(!section)return;section.classList.toggle('v304FocusMode');document.body.style.overflow=section.classList.contains('v304FocusMode')?'hidden':''};

  function updateCompanionState(){const e=$('v304CompanionState');if(!e)return;const open=!!(companion&&!companion.closed);e.dataset.open=String(open);e.querySelector('span').textContent=open?'Companion open':'Companion closed'}
  window.openChatGPTV301=async function(){
    try{if(typeof window.copyChatGPTPromptV301==='function')await window.copyChatGPTPromptV301()}catch(_){ }
    const width=Math.min(680,Math.max(440,Math.round(screen.availWidth*.42))),height=Math.min(900,Math.max(650,Math.round(screen.availHeight*.92))),left=Math.max(0,screen.availWidth-width-14),top=Math.max(0,Math.round((screen.availHeight-height)/2));
    companion=window.open('https://chatgpt.com/','MissionUPSCChatGPTCompanion',`popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`);
    updateCompanionState();setStatus(companion?'Prompt copied. ChatGPT companion opened beside JARVIS. Paste the response back here.':'Popup blocked. Allow pop-ups, then try again.');
  };
  setInterval(updateCompanionState,1800);

  function saveHistory(){const s=promptState();if(!s.prompt.trim()&&!s.response.trim())return;const list=read(HISTORY_KEY,[]),item={id:'ph_'+Date.now(),time:new Date().toISOString(),...s};list.unshift(item);write(HISTORY_KEY,list.slice(0,10));renderPromptHistoryV304()}
  window.renderPromptHistoryV304=function(){const box=$('v304HistoryList');if(!box)return;const list=read(HISTORY_KEY,[]);box.innerHTML=list.length?list.map(x=>`<div class="v304HistoryItem"><div><h4>${esc((x.question||x.task||'UPSC prompt').slice(0,100))}</h4><p>${esc(x.task)} • ${new Date(x.time).toLocaleString()} • ${words(x.response)} response words</p></div><div class="actions"><button class="btn ghost" onclick="loadPromptHistoryV304('${esc(x.id)}')">Open</button><button class="btn danger" onclick="deletePromptHistoryV304('${esc(x.id)}')">Delete</button></div></div>`).join(''):'<div class="emptyState">No prompt sessions saved yet.</div>'};
  window.loadPromptHistoryV304=function(id){const x=read(HISTORY_KEY,[]).find(i=>i.id===id);if(!x)return;[['chatgptTaskV301','task'],['chatgptMarksV301','marks'],['chatgptPaperV301','paper'],['chatgptQuestionV301','question'],['chatgptAnswerV301','answer'],['chatgptSourceV301','source'],['chatgptPromptV301','prompt'],['chatgptResponseV301','response']].forEach(([id,k])=>{if($(id))$(id).value=x[k]??''});promptHealth();syncComparison();setStatus('Prompt session restored from local history.');window.show?.('chatgptPromptHubV302')};
  window.deletePromptHistoryV304=function(id){write(HISTORY_KEY,read(HISTORY_KEY,[]).filter(x=>x.id!==id));renderPromptHistoryV304()};

  function wrapSave(){const old=window.saveChatGPTResponseV301;if(typeof old!=='function'||old.__v304)return;const fn=async function(){const r=await old.apply(this,arguments);saveHistory();return r};fn.__v304=true;window.saveChatGPTResponseV301=fn}
  function wrapGenerate(){const old=window.generateChatGPTPromptV301;if(typeof old!=='function'||old.__v304)return;const fn=function(){const r=old.apply(this,arguments);setTimeout(promptHealth,0);return r};fn.__v304=true;window.generateChatGPTPromptV301=fn}

  function addAICoverageCard(){const section=$('aiControlCentre');if(!section||$('v304AICoverage'))return;const card=document.createElement('div');card.id='v304AICoverage';card.className='card';card.innerHTML='<div class="v302CardHead"><div><h2>Unified AI Coverage Audit</h2><p class="sub">Confirms that legacy modules, Jarvis, notes, current affairs, mentorship, tests, PDF text and visual file reading use the selected secure router.</p></div><span class="pill green">V30.4 bridge</span></div><div class="v304HealthGrid"><div class="v304HealthMetric"><span>Text AI route</span><b>Unified router</b></div><div class="v304HealthMetric"><span>Gemini production</span><b>Firebase proxy</b></div><div class="v304HealthMetric"><span>Visual files</span><b>Secure proxy*</b></div><div class="v304HealthMetric"><span>ChatGPT</span><b>Manual companion</b></div></div><div class="actions" style="margin-top:14px"><button class="btn green" onclick="runAICoverageAuditV304()">Run AI Audit</button><button class="btn ghost" onclick="show(\'chatgptPromptHubV302\')">Open Prompt Hub</button></div><div id="v304AIAuditResult" class="v301WorkspaceStatus" style="margin-top:12px">*Visual image/scanned-PDF support requires redeploying the included V30.4 Firebase function once.</div>';section.appendChild(card)}
  window.runAICoverageAuditV304=function(){const s=settings(),checks=[['Secure router',typeof window.aiAskRouterV23==='function'],['Firebase proxy URL',!!s.geminiProxyUrl],['Google auth bridge',typeof window.getFirebaseIdTokenV301==='function'],['Prompt Hub',!!$('chatgptPromptHubV302')],['YouTube Notes',typeof window.generateYouTubeNotesV302==='function'],['Saarthi AI',typeof window.saarthiExtractPlanV303==='function']];const box=$('v304AIAuditResult');if(box)box.innerHTML=checks.map(([n,ok])=>`${ok?'✅':'⚠️'} ${esc(n)}`).join('<br>')};



  let academicLockUntilV304=0;
  function explicitTestCommandV304(text){
    const t=String(text||'').toLowerCase();
    return /\b(open|show|go to|take me to|start|launch|create|generate|make|attempt|conduct)\b[\s\S]{0,45}\b(prelims test|test centre|mcq|mcqs|quiz|mock test|practice test)\b/.test(t)
      || /\b(\d+|ten|twenty|fifty)\s+(mcq|mcqs|questions)\b/.test(t);
  }
  function academicQuestionV304(text){
    const t=String(text||'').trim().toLowerCase();
    if(!t||explicitTestCommandV304(t))return false;
    return /\b(explain|analyse|analyze|discuss|examine|critically|elaborate|describe|compare|differentiate|what is|why is|how does|give notes|make notes|simplify|teach me|for prelims|for mains|prelims and mains|mains and prelims|article\s+\d+[a-z]?)\b/.test(t);
  }
  function jarvisAnswerV304(text,loading=false){
    const box=$('jarvisResponseV281');if(!box)return;
    box.innerHTML=loading?'<div class="aiLoading">Jarvis is preparing the UPSC explanation…</div>':(window.formatAI?window.formatAI(String(text||'')):`<pre>${esc(text)}</pre>`);
  }
  async function runAcademicJarvisV304(command){
    academicLockUntilV304=Date.now()+20000;
    if($('jarvisStatusV281'))$('jarvisStatusV281').textContent='Working';
    if($('jarvisConfidenceV281'))$('jarvisConfidenceV281').textContent='Direct academic answer';
    const plan=$('jarvisPlanV281');if(plan)plan.innerHTML='<div class="v281PlanGrid"><div class="v281PlanFact"><span>Intent</span><b>Academic explanation</b></div><div class="v281PlanFact"><span>Output</span><b>Inside Jarvis</b></div><div class="v281PlanFact"><span>Test navigation</span><b>Blocked</b></div></div>';
    jarvisAnswerV304('',true);
    try{
      const prompt=`You are JARVIS, a rigorous UPSC mentor. Answer the request directly in this response panel. If Prelims and Mains are mentioned, provide separate clearly labelled sections. Include syllabus linkage, core concept, exam traps, Mains dimensions, relevant constitutional/legal provisions, defensible examples or judgments, PYQ themes without inventing years, and a short revision capsule. Do not generate a test unless explicitly asked.\n\nUSER REQUEST:\n${command}`;
      const out=await unifiedAI(prompt,{task:'jarvis-academic'});jarvisAnswerV304(out);if($('jarvisStatusV281'))$('jarvisStatusV281').textContent='Completed';
    }catch(e){jarvisAnswerV304('Jarvis could not complete the explanation: '+e.message);if($('jarvisStatusV281'))$('jarvisStatusV281').textContent='Needs attention'}
  }
  function installJarvisIntentGuardV304(){
    const current=window.jarvisRunV281;
    if(typeof current==='function'&&!current.__v304Academic){
      const guarded=async function(){const command=$('jarvisCommandInputV281')?.value.trim()||'';if(academicQuestionV304(command))return await runAcademicJarvisV304(command);return await current.apply(this,arguments)};
      guarded.__v304Academic=true;window.jarvisRunV281=guarded;
    }
    const currentShow=window.show;
    if(typeof currentShow==='function'&&!currentShow.__v304Academic){
      const guardedShow=function(id,btn){if(Date.now()<academicLockUntilV304&&['prelimsTestCentreV291','prelimsWarRoomV251','aiMockCentre'].includes(id)){console.info('V30.4 blocked unintended test-centre navigation.');return false}return currentShow.apply(this,arguments)};
      guardedShow.__v304Academic=true;window.show=guardedShow;
    }
  }

  function enforceSecureSettings(){
    const s=settings();
    const clean={...s,geminiTransport:'proxy',geminiKey:''};
    localStorage.setItem(SETTINGS_KEY,JSON.stringify(clean));
    if($('geminiTransportV301'))$('geminiTransportV301').value='proxy';
    if($('geminiProxyFieldsV301'))$('geminiProxyFieldsV301').hidden=false;
    if($('routerGeminiStateV282'))$('routerGeminiStateV282').textContent=clean.geminiProxyUrl?'Secure proxy ready':'Proxy URL missing';
    return clean;
  }
  window.testSmartRouterV282=async function(){
    const box=$('smartRouterStatusV282'),s=enforceSecureSettings();
    if(box)box.innerHTML='<div class="aiLoading">Testing secure Gemini, Ollama availability and ChatGPT companion…</div>';
    let gemini='Not configured',ollama='Not tested';
    if(s.geminiProxyUrl){try{await secureGemini('Reply exactly: Secure Gemini router is working.');gemini='Connected'}catch(e){gemini='Error: '+e.message}}
    try{if(typeof window.testOllamaV301==='function'){const url=String(s.ollamaUrl||'http://localhost:11434').replace(/\/$/,'');const r=await fetch(url+'/api/tags');ollama=r.ok?'Connected':'Unavailable'}}catch(e){ollama='Unavailable'}
    if(box)box.innerHTML=`<b>Gemini:</b> ${esc(gemini)}<br><b>Ollama:</b> ${esc(ollama)}<br><b>ChatGPT Companion:</b> Ready<br><b>Production route:</b> Firebase secure proxy`;
  };

  function version(){window.__MISSION_UPSC_VERSION__=VERSION;document.title='Jarvis UPSC V30.4.0 — Final Polish';document.querySelectorAll('.versionBadge').forEach(e=>e.textContent='V30.4.0 • Final Polish');if($('v275BuildBadge'))$('v275BuildBadge').textContent=`V30.4.0 • ${navigator.onLine?'Online':'Offline'}`}
  function keyboard(e){if(!$('chatgptPromptHubV302')?.classList.contains('active'))return;if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();window.generateChatGPTPromptV301?.()}if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==='o'){e.preventDefault();window.openChatGPTV301?.()}if(e.key==='Escape'&&$('chatgptPromptHubV302')?.classList.contains('v304FocusMode'))window.togglePromptFocusV304()}

  function init(){version();enforceSecureSettings();installUnifiedAliases();installJarvisIntentGuardV304();addAICoverageCard();addPromptEnhancements();wrapSave();wrapGenerate();document.addEventListener('keydown',keyboard);[400,900,1600,3000,6000,9000].forEach(ms=>setTimeout(()=>{version();enforceSecureSettings();installUnifiedAliases();installJarvisIntentGuardV304();addPromptEnhancements();wrapSave();wrapGenerate()},ms))}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,650),{once:true});else setTimeout(init,250);
})();

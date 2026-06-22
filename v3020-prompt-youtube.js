/* Mission UPSC AI OS V30.2.0 — Prompt Hub, YouTube Notes and Jarvis academic-intent guard */
(function(){
  'use strict';
  const VERSION='30.2.0';
  const $=id=>document.getElementById(id);
  const today=()=>new Date().toISOString().slice(0,10);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const slug=v=>String(v||'youtube-upsc-notes').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70)||'youtube-upsc-notes';
  let youtubeHistory=[];
  let academicLockUntil=0;

  function textWordCount(value){return (String(value||'').trim().match(/\S+/g)||[]).length}
  function setText(id,text){const el=$(id);if(el)el.textContent=text}
  function setStatus(id,text,type='info'){
    const el=$(id);if(!el)return;el.textContent=text;el.dataset.state=type;
  }
  function downloadText(filename,text){
    const blob=new Blob([String(text||'')],{type:'text/plain;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1200);
  }
  function printText(title,text){
    const w=window.open('','_blank','noopener,noreferrer,width=900,height=760');
    if(!w)return alert('Pop-up blocked. Allow pop-ups and try again.');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:Arial,sans-serif;max-width:850px;margin:34px auto;padding:0 24px;color:#142238;line-height:1.58}h1{font-size:24px;border-bottom:2px solid #d7e3f2;padding-bottom:12px}pre{font-family:Arial,sans-serif;white-space:pre-wrap;word-break:break-word;font-size:14px}</style></head><body><h1>${esc(title)}</h1><pre>${esc(text)}</pre><script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`);
    w.document.close();
  }

  /* ---------- Separate ChatGPT Prompt Hub ---------- */
  function mountPromptHub(){
    const mount=$('chatgptPromptMountV302');
    const workspace=document.querySelector('.v301PromptWorkspace');
    if(mount&&workspace&&workspace.parentElement!==mount)mount.appendChild(workspace);
    if(workspace){
      const responseActions=[...workspace.querySelectorAll('.v301WorkspaceActions')].at(-1);
      if(responseActions&&!$('chatgptPrintBtnV302')){
        const print=document.createElement('button');print.id='chatgptPrintBtnV302';print.type='button';print.className='btn blue';print.textContent='🖨 Print / PDF';print.onclick=window.printChatGPTResponseV302;
        const txt=document.createElement('button');txt.id='chatgptTxtBtnV302';txt.type='button';txt.className='btn gold';txt.textContent='⬇ Save TXT';txt.onclick=window.downloadChatGPTResponseV302;
        responseActions.append(print,txt);
      }
    }
  }
  window.openChatGPTV301=async function(){
    try{if(typeof window.copyChatGPTPromptV301==='function')await window.copyChatGPTPromptV301()}catch(_){ }
    const width=Math.min(620,Math.max(420,Math.round(screen.availWidth*.42)));
    const height=Math.min(880,Math.max(650,Math.round(screen.availHeight*.9)));
    const left=Math.max(0,screen.availWidth-width-20),top=Math.max(0,Math.round((screen.availHeight-height)/2));
    const features=`popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`;
    const opened=window.open('https://chatgpt.com/','MissionUPSCChatGPTMini',features);
    setStatus('chatgptMiniStatusV302',opened?'ChatGPT opened in a compact window. Paste the copied prompt, then bring the answer back here.':'Pop-up blocked. Allow pop-ups or use Open Full ChatGPT.','info');
    const status=$('chatgptWorkspaceStatusV301');if(status)status.textContent=opened?'Prompt copied and ChatGPT mini window opened.':'Pop-up blocked. Allow pop-ups and try again.';
  };
  window.openChatGPTFullV302=function(){window.open('https://chatgpt.com/','_blank','noopener,noreferrer')};
  window.printChatGPTResponseV302=function(){
    const body=$('chatgptResponseV301')?.value.trim();if(!body)return alert('Paste the ChatGPT response first.');
    const title=$('chatgptQuestionV301')?.value.trim()||'ChatGPT UPSC Response';printText(title,body);
  };
  window.downloadChatGPTResponseV302=function(){
    const body=$('chatgptResponseV301')?.value.trim();if(!body)return alert('Paste the ChatGPT response first.');
    const title=$('chatgptQuestionV301')?.value.trim()||'ChatGPT UPSC Response';downloadText(`${slug(title)}-${today()}.txt`,body);
  };

  /* ---------- YouTube Video to Notes ---------- */
  function youtubeId(url){
    const raw=String(url||'').trim();if(!raw)return '';
    try{
      const u=new URL(raw);
      if(u.hostname.includes('youtu.be'))return u.pathname.split('/').filter(Boolean)[0]||'';
      if(u.searchParams.get('v'))return u.searchParams.get('v');
      const parts=u.pathname.split('/').filter(Boolean),i=parts.findIndex(x=>['shorts','embed','live'].includes(x));
      if(i>=0&&parts[i+1])return parts[i+1];
    }catch(_){const m=raw.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{6,})/);return m?m[1]:''}
    return '';
  }
  function updateYouTubeCounts(){
    setText('youtubeTranscriptCountV302',`${textWordCount($('youtubeTranscriptV302')?.value)} words`);
    setText('youtubeOutputCountV302',`${textWordCount($('youtubeNotesOutputV302')?.value)} words`);
  }
  function cleanTranscript(raw){
    const lines=String(raw||'').replace(/\r/g,'').split('\n');
    const out=[];let last='';
    for(let line of lines){
      line=line.trim();
      if(!line||/^WEBVTT$/i.test(line)||/^NOTE\b/i.test(line)||/^\d+$/.test(line))continue;
      if(/^\d{1,2}:\d{2}(?::\d{2})?[.,]\d{3}\s*-->/.test(line)||/^\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->/.test(line))continue;
      line=line.replace(/<[^>]+>/g,'').replace(/\[[^\]]*(music|applause|laughter)[^\]]*\]/ig,'').replace(/\s+/g,' ').trim();
      if(!line||line===last)continue;out.push(line);last=line;
    }
    return out.join('\n');
  }
  window.loadYouTubeVideoV302=async function(){
    const url=$('youtubeUrlV302')?.value.trim(),id=youtubeId(url),wrap=$('youtubePlayerWrapV302');
    if(!id){setStatus('youtubeInputStatusV302','Enter a valid YouTube video link.','error');setText('youtubeVideoStateV302','Invalid link');return}
    if(wrap)wrap.innerHTML=`<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}" title="YouTube lecture" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
    setText('youtubeVideoStateV302','Video loaded');setStatus('youtubeInputStatusV302','Video loaded. Paste or upload the transcript/captions for accurate AI notes.','ok');
    if(!$('youtubeTitleV302')?.value.trim())$('youtubeTitleV302').value=`YouTube Lecture ${id}`;
    try{
      const response=await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
      if(response.ok){const meta=await response.json();if(meta?.title)$('youtubeTitleV302').value=meta.title}
    }catch(_){ }
    saveYouTubeDraft();
  };
  window.openYouTubeSourceV302=function(){const url=$('youtubeUrlV302')?.value.trim();if(!url)return alert('Paste the YouTube URL first.');window.open(url,'_blank','noopener,noreferrer')};
  window.readYouTubeTranscriptFileV302=async function(input){
    const file=input?.files?.[0];if(!file)return;
    try{const raw=await file.text();$('youtubeTranscriptV302').value=cleanTranscript(raw);updateYouTubeCounts();setStatus('youtubeInputStatusV302',`${file.name} loaded and caption timestamps cleaned.`,'ok');saveYouTubeDraft()}catch(e){setStatus('youtubeInputStatusV302','Could not read transcript file: '+e.message,'error')}
    finally{if(input)input.value=''}
  };
  window.pasteYouTubeTranscriptV302=async function(){
    const box=$('youtubeTranscriptV302');if(!box)return;
    try{const text=await navigator.clipboard.readText();if(!text.trim())throw new Error('Clipboard is empty');box.value=cleanTranscript(text);updateYouTubeCounts();setStatus('youtubeInputStatusV302','Transcript pasted and cleaned.','ok');saveYouTubeDraft()}
    catch(e){box.focus();setStatus('youtubeInputStatusV302',`Automatic paste unavailable (${e.message}). Paste manually in the transcript box.`,'error')}
  };
  window.cleanYouTubeTranscriptV302=function(){const box=$('youtubeTranscriptV302');if(!box)return;box.value=cleanTranscript(box.value);updateYouTubeCounts();setStatus('youtubeInputStatusV302','Caption timestamps and duplicate lines cleaned.','ok');saveYouTubeDraft()};
  function youtubePrompt(){
    const url=$('youtubeUrlV302')?.value.trim()||'Not supplied';
    const title=$('youtubeTitleV302')?.value.trim()||'YouTube UPSC Lecture';
    const subject=$('youtubeSubjectV302')?.value||'General Studies';
    const mode=$('youtubeModeV302')?.value||'integrated';
    const language=$('youtubeLanguageV302')?.value||'English';
    const transcript=cleanTranscript($('youtubeTranscriptV302')?.value||'');
    const modeRule={
      integrated:'Create integrated Prelims and Mains notes.',
      prelims:'Prioritise precise factual statements, constitutional/legal provisions, institutions, dates, maps/locations, common traps and elimination cues.',
      mains:'Prioritise question demand, dimensions, arguments, examples, judgments/reports, challenges and balanced way forward.',
      lecture:'Create detailed chronological lecture notes while removing repetition and filler.',
      revision:'Compress the lecture into a high-yield one-page revision capsule.'
    }[mode];
    return `You are a senior UPSC CSE faculty member and notes editor. Convert the supplied YouTube lecture transcript into accurate, exam-oriented notes.\n\nVideo title: ${title}\nVideo URL: ${url}\nSubject: ${subject}\nOutput language: ${language}\nMode: ${modeRule}\n\nMandatory output structure:\n# ${title}\n## Lecture in 100 Words\n## Syllabus Linkage\n## Core Concepts and Definitions\n## Topic-wise Detailed Explanation\n## Prelims Focus\n- provisions, facts, institutions, dates, locations and statement traps\n## Mains Focus\n- relevant dimensions, arguments, examples and analytical linkages\n## Constitutional / Legal / Policy Provisions\n## Reports, Data, Judgments and Examples\n- include only what is present in the transcript or confidently defensible; mark items needing verification\n## Related PYQ Themes\n- never invent an exact PYQ year or wording\n## Possible 10-Marker and 15-Marker\n## Text Flowchart / Mind Map\n## 15 Flashcards\n## One-Page Revision Capsule\n## 30-Second Recall\n\nRules:\n- Remove greetings, promotions, repetition and lecture filler.\n- Preserve meaningful explanations and examples.\n- Distinguish transcript claims from verified static knowledge.\n- Never fabricate facts, data, sources, judgments or PYQs.\n- Use clean Markdown and readable headings.\n\nLECTURE TRANSCRIPT:\n${transcript.slice(0,52000)}`;
  }
  window.generateYouTubeNotesV302=async function(){
    const transcript=cleanTranscript($('youtubeTranscriptV302')?.value||'');
    if(textWordCount(transcript)<40)return setStatus('youtubeOutputStatusV302','Paste or upload a meaningful transcript first. A YouTube link alone cannot provide the lecture content to this text-based setup.','error');
    $('youtubeTranscriptV302').value=transcript;updateYouTubeCounts();
    const out=$('youtubeNotesOutputV302');if(out)out.value='Generating UPSC notes with the selected AI…';
    setText('youtubeAIStateV302','Working');setStatus('youtubeOutputStatusV302','AI is structuring the lecture. Keep this page open.','info');
    try{
      if(typeof window.aiAskRouterV23!=='function')throw new Error('AI router unavailable. Save a mode in AI Control Centre.');
      const result=await window.aiAskRouterV23(youtubePrompt());
      if(out)out.value=result;updateYouTubeCounts();
      const route=window.__lastAIRouteV301||window.__lastAIRouteV282;setText('youtubeRouteV302',route?.provider?`Route: ${route.provider}`:'Selected AI completed');
      setText('youtubeAIStateV302','Complete');setStatus('youtubeOutputStatusV302','Notes generated. Edit them if needed, then save, print or download.','ok');saveYouTubeDraft();
    }catch(e){if(out)out.value='';setText('youtubeAIStateV302','Failed');setStatus('youtubeOutputStatusV302','Generation failed: '+e.message,'error')}
  };
  window.sendYouTubeToPromptHubV302=function(){
    const transcript=cleanTranscript($('youtubeTranscriptV302')?.value||'');if(textWordCount(transcript)<40)return alert('Paste or upload the transcript first.');
    if($('chatgptTaskV301'))$('chatgptTaskV301').value='notes';
    if($('chatgptQuestionV301'))$('chatgptQuestionV301').value=$('youtubeTitleV302')?.value.trim()||'YouTube UPSC Lecture Notes';
    if($('chatgptPaperV301'))$('chatgptPaperV301').value=$('youtubeSubjectV302')?.value||'General Studies';
    if($('chatgptSourceV301'))$('chatgptSourceV301').value=`Video: ${$('youtubeUrlV302')?.value.trim()||''}\n\nTranscript:\n${transcript}`;
    if(typeof window.updateChatGPTTemplateV301==='function')window.updateChatGPTTemplateV301(false);
    if(typeof window.generateChatGPTPromptV301==='function')window.generateChatGPTPromptV301();
    if(typeof window.show==='function')window.show('chatgptPromptHubV302');
    setTimeout(()=>$('chatgptPromptV301')?.scrollIntoView({behavior:'smooth',block:'center'}),180);
  };
  window.saveYouTubeNotesV302=async function(){
    const body=$('youtubeNotesOutputV302')?.value.trim();if(!body)return alert('Generate or paste notes first.');
    const title=$('youtubeTitleV302')?.value.trim()||'YouTube UPSC Notes',subject=$('youtubeSubjectV302')?.value||'General Studies',url=$('youtubeUrlV302')?.value.trim()||'';
    const item={title,subject,body,date:today(),type:'YouTube Video Notes',source:url||'YouTube Notes Maker V30.2',videoUrl:url,createdAt:Date.now()};
    try{if(typeof window.saveCol==='function')await window.saveCol('notes',item);else{const list=JSON.parse(localStorage.getItem('notes')||'[]');list.unshift({id:'yt_'+Date.now(),...item});localStorage.setItem('notes',JSON.stringify(list))}setStatus('youtubeOutputStatusV302','Saved to JARVIS Notes.','ok');await window.renderYouTubeNotesHistoryV302();alert('YouTube notes saved.')}
    catch(e){setStatus('youtubeOutputStatusV302','Could not save notes: '+e.message,'error')}
  };
  window.printYouTubeNotesV302=function(){const body=$('youtubeNotesOutputV302')?.value.trim();if(!body)return alert('Generate or paste notes first.');printText($('youtubeTitleV302')?.value.trim()||'YouTube UPSC Notes',body)};
  window.downloadYouTubeNotesV302=function(){const body=$('youtubeNotesOutputV302')?.value.trim();if(!body)return alert('Generate or paste notes first.');downloadText(`${slug($('youtubeTitleV302')?.value)}-${today()}.txt`,body)};
  window.copyYouTubeNotesV302=async function(){const body=$('youtubeNotesOutputV302')?.value.trim();if(!body)return alert('Generate or paste notes first.');try{await navigator.clipboard.writeText(body);setStatus('youtubeOutputStatusV302','Notes copied to clipboard.','ok')}catch(_){$('youtubeNotesOutputV302')?.select();setStatus('youtubeOutputStatusV302','Clipboard blocked. Notes selected for manual copy.','error')}};
  window.clearYouTubeNotesV302=function(){if(!confirm('Clear this YouTube notes workspace on this device?'))return;['youtubeUrlV302','youtubeTitleV302','youtubeTranscriptV302','youtubeNotesOutputV302'].forEach(id=>{if($(id))$(id).value=''});const wrap=$('youtubePlayerWrapV302');if(wrap)wrap.innerHTML='<div class="v302PlayerEmpty"><span>▶️</span><b>Paste a YouTube link</b><small>The lecture player will appear here.</small></div>';localStorage.removeItem('mission_youtube_notes_draft_v302');updateYouTubeCounts();setText('youtubeVideoStateV302','Waiting');setText('youtubeAIStateV302','AI ready');setStatus('youtubeInputStatusV302','Workspace cleared.','info');setStatus('youtubeOutputStatusV302','Generated notes remain editable before saving or printing.','info')};
  function saveYouTubeDraft(){
    const state={url:$('youtubeUrlV302')?.value||'',title:$('youtubeTitleV302')?.value||'',subject:$('youtubeSubjectV302')?.value||'General Studies',mode:$('youtubeModeV302')?.value||'integrated',language:$('youtubeLanguageV302')?.value||'English',transcript:$('youtubeTranscriptV302')?.value||'',output:$('youtubeNotesOutputV302')?.value||'',updatedAt:new Date().toISOString()};
    localStorage.setItem('mission_youtube_notes_draft_v302',JSON.stringify(state));
  }
  function loadYouTubeDraft(){
    try{const s=JSON.parse(localStorage.getItem('mission_youtube_notes_draft_v302')||'{}');if(!s||!Object.keys(s).length)return;[['youtubeUrlV302','url'],['youtubeTitleV302','title'],['youtubeSubjectV302','subject'],['youtubeModeV302','mode'],['youtubeLanguageV302','language'],['youtubeTranscriptV302','transcript'],['youtubeNotesOutputV302','output']].forEach(([id,key])=>{if($(id)&&s[key]!=null)$(id).value=s[key]});if(s.url)window.loadYouTubeVideoV302();updateYouTubeCounts()}catch(_){ }
  }
  window.renderYouTubeNotesHistoryV302=async function(){
    const box=$('youtubeNotesHistoryV302');if(!box)return;
    try{const all=typeof window.getCol==='function'?await window.getCol('notes'):JSON.parse(localStorage.getItem('notes')||'[]');youtubeHistory=(Array.isArray(all)?all:[]).filter(x=>x.type==='YouTube Video Notes'||/youtube/i.test(String(x.source||''))).sort((a,b)=>Number(b.createdAt?.seconds?b.createdAt.seconds*1000:b.createdAt||b.savedAt||0)-Number(a.createdAt?.seconds?a.createdAt.seconds*1000:a.createdAt||a.savedAt||0)).slice(0,20);box.innerHTML=youtubeHistory.length?youtubeHistory.map((x,i)=>`<div class="v302HistoryItem"><div><h3>${esc(x.title||'YouTube UPSC Notes')}</h3><p>${esc(x.subject||'General Studies')} • ${esc(x.date||'')} • ${textWordCount(x.body)} words</p></div><div class="actions"><button type="button" class="btn blue" onclick="openYouTubeHistoryV302(${i})">Open</button>${x.videoUrl?`<button type="button" class="btn ghost" onclick="openYouTubeHistoryVideoV302(${i})">Video</button>`:''}</div></div>`).join(''):'<div class="emptyState">No YouTube notes saved yet.</div>'}
    catch(e){box.innerHTML=`<div class="emptyState">Could not load saved notes: ${esc(e.message)}</div>`}
  };
  window.openYouTubeHistoryVideoV302=function(index){const item=youtubeHistory[index];if(item?.videoUrl)window.open(item.videoUrl,'_blank','noopener,noreferrer')};
  window.openYouTubeHistoryV302=function(index){const item=youtubeHistory[index];if(!item)return;if($('youtubeTitleV302'))$('youtubeTitleV302').value=item.title||'';if($('youtubeSubjectV302'))$('youtubeSubjectV302').value=item.subject||'General Studies';if($('youtubeUrlV302'))$('youtubeUrlV302').value=item.videoUrl||item.source||'';if($('youtubeNotesOutputV302'))$('youtubeNotesOutputV302').value=item.body||'';updateYouTubeCounts();if(item.videoUrl)window.loadYouTubeVideoV302();$('youtubeNotesOutputV302')?.scrollIntoView({behavior:'smooth',block:'center'})};

  /* ---------- Final Jarvis academic intent guard ---------- */
  function isExplanation(command){
    const t=String(command||'').trim().toLowerCase();
    return /\b(explain|describe|discuss|analyse|analyze|elaborate|clarify|teach|summari[sz]e|compare|differentiate|meaning|significance|features|provisions)\b/.test(t)||/^(what|why|how)\b/.test(t);
  }
  function explicitTestAction(command){
    const t=String(command||'').trim().toLowerCase();
    return /\b(open|go to|take me to|launch|start|begin)\b.*\b(prelims test|test centre|test center|war room|mock test|quiz)\b/.test(t)||/\b(generate|create|make|prepare|set)\b.*\b(mcq|mcqs|quiz|mock test|prelims test|questions)\b/.test(t);
  }
  function directAcademicPrompt(command){
    const both=/\bprelims?\b/.test(command.toLowerCase())&&/\bmains?\b/.test(command.toLowerCase());
    const prelims=/\bprelims?\b/.test(command.toLowerCase()),mains=/\bmains?\b/.test(command.toLowerCase());
    const orientation=both?'Use separate sections for Prelims and Mains. Include exact facts/provisions and traps for Prelims; analytical dimensions, judgments/examples, challenges and way forward for Mains.':prelims?'Prioritise UPSC Prelims facts, provisions, exceptions, traps and elimination cues.':mains?'Prioritise UPSC Mains demand, dimensions, arguments, examples, judgments/reports and balanced way forward.':'Give an integrated UPSC explanation with syllabus linkage, facts, analysis, examples, PYQ themes and revision points.';
    return `You are JARVIS, a senior UPSC CSE mentor. Answer the academic request directly inside the Jarvis response panel. Never navigate to or recommend the Prelims Test Centre merely because the request mentions Prelims. Only create a test when the user explicitly asks for MCQs, a quiz, mock test or test centre.\n\n${orientation}\n\nUser request: ${command}\n\nUse clean headings and defensible facts. Do not fabricate PYQs, data, judgments or sources.`;
  }
  function setJarvisOutput(text,loading=false){const box=$('jarvisResponseV281');if(box)box.innerHTML=loading?'<div class="aiLoading">Jarvis is preparing the UPSC explanation…</div>':(typeof window.formatAI==='function'?window.formatAI(String(text||'')):`<pre style="white-space:pre-wrap">${esc(text)}</pre>`)}
  function renderAcademicPlan(command){
    const plan=$('jarvisPlanV281');if(plan)plan.innerHTML='<div class="v281PlanGrid"><div class="v281PlanFact"><span>Intent</span><b>Academic explanation</b></div><div class="v281PlanFact"><span>Destination</span><b>Jarvis response</b></div><div class="v281PlanFact"><span>Exam orientation</span><b>Prelims / Mains as requested</b></div><div class="v281PlanFact"><span>Navigation</span><b>No test centre</b></div></div><ol class="v281PlanSteps"><li>Understand the concept and question demand</li><li>Use the selected AI securely</li><li>Return the explanation inside Jarvis</li></ol>';
    setText('jarvisConfidenceV281','100% confidence');const execute=$('jarvisExecuteBtnV281');if(execute)execute.disabled=true;
  }
  function saveJarvisAcademicHistory(command){
    try{const key='mission_jarvis_history_v281',list=JSON.parse(localStorage.getItem(key)||'[]');list.unshift({id:'j_'+Date.now(),command,intent:'explain_topic',title:'Academic explanation',destination:'jarvisCommandV281',status:'completed',time:new Date().toISOString()});localStorage.setItem(key,JSON.stringify(list.slice(0,50)))}catch(_){ }
  }
  async function runAcademicExplanation(command){
    academicLockUntil=Date.now()+12000;renderAcademicPlan(command);setText('jarvisStatusV281','Working');setJarvisOutput('',true);
    try{if(typeof window.ensureSecureAIRouterV3015==='function')window.ensureSecureAIRouterV3015();if(typeof window.aiAskRouterV23!=='function')throw new Error('AI router unavailable. Save Gemini/Hybrid in AI Control Centre.');const result=await window.aiAskRouterV23(directAcademicPrompt(command));setJarvisOutput(result);setText('jarvisStatusV281','Completed');saveJarvisAcademicHistory(command)}
    catch(e){setJarvisOutput('Jarvis could not complete the explanation: '+e.message);setText('jarvisStatusV281','Needs attention')}
  }
  function installShowGuard(){
    const current=window.show;if(typeof current!=='function'||current.__v302AcademicShowGuard)return;
    const guarded=function(id,btn){
      if(Date.now()<academicLockUntil&&['prelimsWarRoomV251','prelimsTestCentreV291'].includes(id)){console.info('V30.2 blocked unintended Prelims navigation during academic explanation');return false}
      const result=current.apply(this,arguments);
      if(id==='chatgptPromptHubV302')setTimeout(()=>{mountPromptHub();if(typeof window.loadAISettingsV23==='function')window.loadAISettingsV23()},80);
      if(id==='youtubeNotesV302')setTimeout(window.renderYouTubeNotesHistoryV302,80);
      return result;
    };
    guarded.__v302AcademicShowGuard=true;window.show=guarded;
  }
  function installJarvisGuard(){
    const current=window.jarvisRunV281;if(typeof current!=='function'||current.__v302AcademicGuard)return;
    const guarded=async function(){
      const command=$('jarvisCommandInputV281')?.value.trim()||'';
      const low=command.toLowerCase();
      if(/\b(open|show|go to|take me to)\b.*\b(chatgpt prompt hub|prompt hub)\b/.test(low)){window.show?.('chatgptPromptHubV302');setJarvisOutput('Opened **ChatGPT Prompt Hub**.');return}
      if(/\b(open|show|go to|take me to)\b.*\b(youtube|video notes|video to notes)\b/.test(low)){window.show?.('youtubeNotesV302');setJarvisOutput('Opened **YouTube Video → Notes Maker**.');return}
      if(command&&isExplanation(command)&&!explicitTestAction(command))return await runAcademicExplanation(command);
      return await current.apply(this,arguments);
    };
    guarded.__v302AcademicGuard=true;window.jarvisRunV281=guarded;
  }
  function keepIntentDisplayCorrect(){
    const input=$('jarvisCommandInputV281');if(!input||input.__v302IntentListener)return;input.__v302IntentListener=true;
    input.addEventListener('input',()=>setTimeout(()=>{const command=input.value.trim();if(!command||!isExplanation(command)||explicitTestAction(command))return;const host=$('jarvisLiveIntentV285');if(host)host.innerHTML='<span class="v285IntentLabel">Live understanding</span><span class="v285IntentChip">📖 Academic explanation</span><span class="v285IntentChip">🎯 Answer inside Jarvis</span><span class="v285IntentChip route">🚫 No test navigation</span><span id="jarvisDraftStateV285" class="v285DraftState">Draft saved locally</span>'},0));
  }

  function updateVersion(){
    window.__MISSION_UPSC_VERSION__=VERSION;document.title='Jarvis UPSC V30.2.0 — Prompt Hub & YouTube Notes';
    document.querySelectorAll('.versionBadge').forEach(x=>x.textContent='V30.2.0 • Prompt Hub + YouTube Notes');
    if($('v275BuildBadge'))$('v275BuildBadge').textContent=`V30.2.0 • ${navigator.onLine?'Online':'Offline'}`;
  }
  function bindDrafts(){
    ['youtubeUrlV302','youtubeTitleV302','youtubeSubjectV302','youtubeModeV302','youtubeLanguageV302','youtubeTranscriptV302','youtubeNotesOutputV302'].forEach(id=>$(id)?.addEventListener('input',()=>{updateYouTubeCounts();saveYouTubeDraft()}));
  }
  function init(){
    updateVersion();mountPromptHub();loadYouTubeDraft();bindDrafts();updateYouTubeCounts();keepIntentDisplayCorrect();installShowGuard();installJarvisGuard();
    [600,1400,2600,4800,7600].forEach(ms=>setTimeout(()=>{installShowGuard();installJarvisGuard();keepIntentDisplayCorrect();mountPromptHub()},ms));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,650),{once:true});else setTimeout(init,250);
})();

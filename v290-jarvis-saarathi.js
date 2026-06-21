/* ===== Mission UPSC AI OS V29.0 — Simple Jarvis + Voice Saarathi ===== */
(function(){
  'use strict';
  const VERSION='29.0';
  const $=id=>document.getElementById(id);
  const qs=(s,r=document)=>r.querySelector(s);
  const qsa=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let jarvisRecognition=null;
  let voiceRecognition=null;
  let speechUtterance=null;
  let baseVoiceAsk=null;
  let jarvisReady=false;
  let voiceReady=false;
  let voiceAskWrapped=false;

  function greeting(){
    const h=new Date().getHours();
    return h<12?'Good morning':h<17?'Good afternoon':'Good evening';
  }
  function profileName(){
    const input=$('jarvisProfileNameV283');
    if(input?.value.trim())return input.value.trim().split(/\s+/)[0];
    try{
      const raw=JSON.parse(localStorage.getItem('mission_jarvis_memory_v283')||'{}');
      const n=raw?.profile?.name||raw?.name;
      if(n)return String(n).trim().split(/\s+/)[0];
    }catch(e){}
    return 'Vignesh';
  }
  function todayLabel(){
    return new Intl.DateTimeFormat('en-IN',{weekday:'long',day:'numeric',month:'long'}).format(new Date());
  }
  function dispatchInput(el){
    if(!el)return;
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function toast(message,type='ok'){
    let el=$('v290Toast');
    if(!el){el=document.createElement('div');el.id='v290Toast';el.className='v290Toast';document.body.appendChild(el)}
    el.className=`v290Toast ${type} show`;
    el.textContent=message;
    clearTimeout(el._timer);
    el._timer=setTimeout(()=>el.classList.remove('show'),2600);
  }

  function updateVersion(){
    window.__MISSION_UPSC_VERSION__=VERSION;
    document.title='Jarvis UPSC V29.0 — Jarvis Saarathi';
    qsa('.versionBadge').forEach(x=>x.textContent='V29.0 • Jarvis Saarathi');
    const build=$('v275BuildBadge');if(build)build.textContent=`V29.0 • ${navigator.onLine?'Online':'Offline'}`;
    const release=qsa('.v275ReleaseList>div').find(x=>/^Version$/i.test(qs('span',x)?.textContent||''));
    if(release?.querySelector('b'))release.querySelector('b').textContent='Mission UPSC AI OS V29.0 Jarvis Saarathi';
    const buildDate=qsa('.v275ReleaseList>div').find(x=>/^Build date$/i.test(qs('span',x)?.textContent||''));
    if(buildDate?.querySelector('b'))buildDate.querySelector('b').textContent='20 June 2026';
    const nav=qsa('.nav button').find(b=>/AI Voice Saarthi/i.test(b.textContent));
    if(nav)nav.innerHTML='🎙️ AI Voice Saarathi';
  }

  function metricValue(id,fallback='0'){
    const t=$(id)?.textContent?.trim();
    return t&&t!=='—'?t:fallback;
  }
  function syncJarvisSummary(){
    const map=[
      ['v290TodayValue','jarvisTodayEventsV281'],
      ['v290RevisionValue','jarvisDueRevisionV281'],
      ['v290WorkspaceValue','jarvisWorkspaceV281']
    ];
    map.forEach(([to,from])=>{if($(to))$(to).textContent=metricValue(from)});
    const hi=$('v290Greeting');if(hi)hi.textContent=`${greeting()}, ${profileName()}`;
    const date=$('v290Date');if(date)date.textContent=todayLabel();
  }

  function makeJarvisHero(){
    const hero=document.createElement('div');
    hero.className='v290JarvisHero';
    hero.innerHTML=`
      <div class="v290JarvisHeroCopy">
        <div class="v290HeroKicker"><span class="v290PulseDot"></span> V29.0 • PERSONAL UPSC SAARATHI</div>
        <h1 id="v290Greeting">${esc(greeting())}, ${esc(profileName())}</h1>
        <p>Ask once. Jarvis understands the task, chooses the right workspace and helps you move forward.</p>
        <div class="v290HeroActions">
          <button type="button" class="v290HeroPrimary" onclick="v290FocusJarvis()">✨ Ask Jarvis</button>
          <button type="button" class="v290HeroSecondary" onclick="show('voiceSaarthi')">🎙 Talk to Saarathi</button>
        </div>
      </div>
      <div class="v290JarvisVisual" aria-hidden="true">
        <div class="v290Orbit one"></div><div class="v290Orbit two"></div>
        <div class="v290Core"><img src="./assets/jarvis-emblem.png" alt=""></div>
        <span class="v290Online">● Ready</span>
      </div>`;
    return hero;
  }

  function makeMissionStrip(){
    const el=document.createElement('div');
    el.className='v290MissionStrip';
    el.innerHTML=`
      <div class="v290DateBlock"><span>Today</span><b id="v290Date">${esc(todayLabel())}</b></div>
      <button type="button" onclick="show('aiCalendarV4')"><span>🗓️ Calendar</span><b id="v290TodayValue">0</b><small>blocks today</small></button>
      <button type="button" onclick="show('aiRevisionBrain')"><span>🔁 Revision</span><b id="v290RevisionValue">0</b><small>due items</small></button>
      <button type="button" onclick="show('richNotesV4')"><span>📚 Workspace</span><b id="v290WorkspaceValue">0</b><small>study items</small></button>`;
    return el;
  }

  function responseToolbar(){
    const bar=document.createElement('div');
    bar.className='v290ResponseToolbar';
    bar.innerHTML=`
      <button type="button" onclick="jarvisCopyResponseV281()">📋 Copy</button>
      <button type="button" onclick="jarvisSaveResponseV281()">💾 Save to Notes</button>
      <button type="button" onclick="v290SpeakJarvisResponse()">🔊 Read Aloud</button>
      <button type="button" onclick="printSection('jarvisResponseV281')">📄 PDF / Print</button>`;
    return bar;
  }

  function setupJarvis(){
    const section=$('jarvisCommandV281');
    const consoleCard=qs('.v281Console',section);
    const response=$('jarvisResponseV281')?.closest('.card');
    if(!section||!consoleCard||!response||section.dataset.v290Ready)return false;
    section.dataset.v290Ready='1';section.classList.add('v290Jarvis');

    const oldHero=qs(':scope > .v281Hero',section);
    const metrics=qs(':scope > .v281Metrics',section);
    const mainGrid=qs(':scope > .v281MainGrid',section);
    const context=qs('.v281ContextCard',mainGrid||section);
    const plan=qs(':scope > .v281PlanCard',section);
    const assist=qs(':scope > .v283AssistGrid',section);
    const memory=qs(':scope > .v283MemoryGrid',section);
    const bottom=qs(':scope > .v281BottomGrid',section);
    const history=$('jarvisHistoryV281')?.closest('.card');
    const capability=qs(':scope > .v281CapabilityCard',section);

    section.insertBefore(makeJarvisHero(),oldHero||section.firstChild);
    const mission=makeMissionStrip();
    if(oldHero)oldHero.insertAdjacentElement('afterend',mission);else section.prepend(mission);

    const simple=document.createElement('div');simple.className='v290JarvisSimpleGrid';
    mission.insertAdjacentElement('afterend',simple);
    simple.append(consoleCard,response);

    const advanced=document.createElement('details');advanced.id='jarvisAdvancedWorkspaceV290';advanced.className='v290AdvancedWorkspace';
    advanced.innerHTML=`<summary><span>⚙️ Advanced Jarvis Workspace</span><small>Memory, routes, routines, history and multi-step controls</small></summary><div class="v290AdvancedBody"></div>`;
    simple.insertAdjacentElement('afterend',advanced);
    const advBody=qs('.v290AdvancedBody',advanced);
    [metrics,context,plan,assist,memory,history,capability].filter(Boolean).forEach(x=>advBody.appendChild(x));
    if(mainGrid&&!mainGrid.children.length)mainGrid.remove();
    if(bottom&&!bottom.children.length)bottom.remove();

    oldHero?.classList.add('v290LegacyHero');

    const head=qs('.v281CardHead',consoleCard);
    const h2=qs('h2',head);if(h2)h2.textContent='What can I help you with?';
    const sub=qs('.sub',head);if(sub)sub.textContent='Type naturally, or tap the microphone and speak. Jarvis will choose the right tool automatically.';
    const input=$('jarvisCommandInputV281');
    if(input)input.placeholder='Ask Jarvis…  e.g. Plan my day, explain inflation, create MCQs, or find my notes';
    const mic=$('jarvisMicBtnV281');if(mic)mic.innerHTML='🎙 Talk';
    const run=qs('.v281RunActions .btn.purple',consoleCard);if(run)run.innerHTML='✨ Ask Jarvis';
    const execute=$('jarvisExecuteBtnV281');if(execute)execute.innerHTML='✓ Confirm & Continue';
    const clear=qs('.v281RunActions .btn.ghost',consoleCard);if(clear)clear.textContent='Clear';

    const quick=qs('.v281QuickCommands',consoleCard);
    if(quick)quick.innerHTML=`
      <button type="button" onclick="jarvisSetCommandV281('Plan my day for 7 hours using my weak topics and due revisions',true)"><span>📅</span> Plan Today</button>
      <button type="button" onclick="jarvisSetCommandV281('Explain a UPSC topic in simple language with Prelims and Mains relevance',false)"><span>📖</span> Learn</button>
      <button type="button" onclick="jarvisSetCommandV281('Create detailed UPSC notes on Article 14',true)"><span>📝</span> Make Notes</button>
      <button type="button" onclick="jarvisSetCommandV281('Generate 15 UPSC MCQs on my weakest topic',true)"><span>🎯</span> Practice</button>
      <button type="button" onclick="jarvisSetCommandV281('Make a mindmap on cooperative federalism',true)"><span>🧠</span> Mind Map</button>
      <button type="button" onclick="jarvisSetCommandV281('Find my climate change notes and library resources',true)"><span>🔎</span> Search Library</button>`;

    const auto=document.createElement('label');auto.className='v290AutoRun';auto.innerHTML='<input id="jarvisAutoRunV290" type="checkbox" checked><span>Run automatically after voice capture</span>';
    const status=$('jarvisVoiceStatusV281');if(status)status.insertAdjacentElement('beforebegin',auto);

    const responseHead=qs('.v281CardHead',response);
    const rh=qs('h2',responseHead);if(rh)rh.textContent='Jarvis Answer';
    const rs=qs('.sub',responseHead);if(rs)rs.textContent='Your result appears here. Save it, hear it or print it.';
    const oldActions=qs('.actions',responseHead);if(oldActions)oldActions.classList.add('v290OldResponseActions');
    $('jarvisResponseV281')?.insertAdjacentElement('afterend',responseToolbar());

    advanced.addEventListener('toggle',()=>{if(advanced.open){window.refreshJarvisContextV281?.(false);window.scanJarvisWorkspaceV283?.(false).catch?.(()=>{})}});
    syncJarvisSummary();
    const watch=new MutationObserver(syncJarvisSummary);
    ['jarvisTodayEventsV281','jarvisDueRevisionV281','jarvisWorkspaceV281'].forEach(id=>{if($(id))watch.observe($(id),{childList:true,characterData:true,subtree:true})});
    jarvisReady=true;
    return true;
  }

  window.v290FocusJarvis=function(){
    if(typeof window.show==='function')window.show('jarvisCommandV281');
    setTimeout(()=>{const input=$('jarvisCommandInputV281');input?.focus();input?.scrollIntoView({behavior:'smooth',block:'center'})},140);
  };

  window.jarvisVoiceV281=function(){
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR)return alert('Voice recognition is unavailable in this browser. Use Chrome or Edge, or type your command.');
    const mic=$('jarvisMicBtnV281'),status=$('jarvisVoiceStatusV281'),input=$('jarvisCommandInputV281');
    if(jarvisRecognition){try{jarvisRecognition.stop()}catch(e){}return}
    let finalText='';
    jarvisRecognition=new SR();
    const pref=$('jarvisProfileLanguageV283')?.value||'English';
    jarvisRecognition.lang=/Tamil/i.test(pref)?'ta-IN':/Hindi/i.test(pref)?'hi-IN':'en-IN';
    jarvisRecognition.continuous=false;jarvisRecognition.interimResults=true;
    jarvisRecognition.onstart=()=>{document.body.classList.add('v290JarvisListening');if(mic)mic.innerHTML='⏹ Stop';if(status)status.textContent='Listening… speak naturally.'};
    jarvisRecognition.onresult=e=>{
      let interim='';
      for(let i=e.resultIndex;i<e.results.length;i++){
        const t=e.results[i][0].transcript;
        if(e.results[i].isFinal)finalText+=t+' ';else interim+=t;
      }
      if(input){input.value=(finalText+interim).trim();dispatchInput(input)}
    };
    jarvisRecognition.onerror=e=>{if(status)status.textContent='Microphone error: '+(e.error||'unknown');toast('Microphone needs attention','warn')};
    jarvisRecognition.onend=()=>{
      jarvisRecognition=null;document.body.classList.remove('v290JarvisListening');if(mic)mic.innerHTML='🎙 Talk';
      const heard=input?.value.trim()||'';
      if(status)status.textContent=heard?'Voice captured. Jarvis is ready.':'No speech captured. Try again.';
      if(heard&&$('jarvisAutoRunV290')?.checked)setTimeout(()=>window.jarvisRunV281?.(),420);
    };
    try{jarvisRecognition.start()}catch(e){jarvisRecognition=null;toast('Could not start microphone','warn')}
  };

  window.v290SpeakJarvisResponse=function(){
    const text=$('jarvisResponseV281')?.innerText.trim();
    if(!text)return toast('No Jarvis answer to read','warn');
    speakText(text,$('jarvisProfileLanguageV283')?.value||'English');
  };

  function setVoiceMode(mode){
    const select=$('voiceModeV244');if(select){select.value=mode;dispatchInput(select)}
    qsa('.v290ModePill').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
  }
  window.v290SetVoiceMode=setVoiceMode;

  function populateVoices(){
    const select=$('v290SpeechVoice');if(!select||!('speechSynthesis' in window))return;
    const voices=window.speechSynthesis.getVoices();
    const current=select.value;
    select.innerHTML='<option value="">Automatic voice</option>'+voices.map((v,i)=>`<option value="${i}">${esc(v.name)} — ${esc(v.lang)}</option>`).join('');
    if(current)select.value=current;
  }

  function makeVoiceDock(){
    const dock=document.createElement('div');dock.className='v290VoiceDock';
    dock.innerHTML=`
      <div class="v290VoiceOrbWrap">
        <button id="v290VoiceOrb" class="v290VoiceOrb" type="button" onclick="startVoiceSaarthi()" aria-label="Start voice conversation">
          <span class="v290MicIcon">🎙️</span><i></i><i></i>
        </button>
        <b>Tap and speak</b><small id="v290VoiceState">Saarathi is ready</small>
      </div>
      <div class="v290VoiceWelcome">
        <span class="v290VoiceKicker">VOICE-FIRST UPSC MENTOR</span>
        <h2>Talk naturally. Saarathi will listen, answer and guide your next step.</h2>
        <div class="v290ModePills">
          <button type="button" class="v290ModePill active" data-mode="Ask Mentor" onclick="v290SetVoiceMode('Ask Mentor')">👨‍🏫 Mentor</button>
          <button type="button" class="v290ModePill" data-mode="Quick Revision" onclick="v290SetVoiceMode('Quick Revision')">⚡ Revision</button>
          <button type="button" class="v290ModePill" data-mode="Oral Quiz" onclick="v290SetVoiceMode('Oral Quiz')">🎯 Oral Quiz</button>
          <button type="button" class="v290ModePill" data-mode="Make Study Plan" onclick="v290SetVoiceMode('Make Study Plan')">📅 Study Plan</button>
        </div>
        <div class="v290HandsFreeRow">
          <label><input id="v290AutoAsk" type="checkbox" checked> Ask automatically after I finish</label>
          <label><input id="v290AutoSpeak" type="checkbox" checked> Read the answer aloud</label>
          <label><input id="v290HandsFree" type="checkbox"> Continue hands-free</label>
        </div>
      </div>`;
    return dock;
  }

  function setupVoice(){
    const section=$('voiceSaarthi');
    const panels=section? qsa(':scope > .two > .card',section):[];
    if(!section||panels.length<2||section.dataset.v290Ready)return false;
    section.dataset.v290Ready='1';section.classList.add('v290Voice');
    const hero=qs(':scope > .cleanHero',section);
    const eyebrow=qs('.eyebrow',hero);if(eyebrow)eyebrow.textContent='V29.0 • AI VOICE SAARATHI';
    const h1=qs('h1',hero);if(h1)h1.textContent='AI Voice Saarathi';
    const p=qs('.sub',hero);if(p)p.textContent='Your natural voice companion for learning, revision, oral quizzes, planning and UPSC mentorship.';
    const icon=qs('.heroIcon',hero);if(icon)icon.innerHTML='<img src="./assets/jarvis-emblem.png" alt="Jarvis">';
    hero.insertAdjacentElement('afterend',makeVoiceDock());

    const commandPanel=panels[0],outputPanel=panels[1];
    commandPanel.classList.add('v290VoiceCommandPanel');outputPanel.classList.add('v290VoiceOutputPanel');
    const ch=qs('h2',commandPanel);if(ch)ch.textContent='Your Voice Command';
    const oh=qs('h2',outputPanel);if(oh)oh.textContent='Saarathi Response';
    const meter=$('voiceMeterV244');if(meter)$('v290VoiceOrb')?.appendChild(meter);

    const selects=qs('.threeInput',commandPanel);
    if(selects){
      const details=document.createElement('details');details.className='v290VoiceSettings';
      details.innerHTML='<summary>⚙️ Voice & answer settings</summary><div class="v290VoiceSettingsBody"></div>';
      selects.parentNode.insertBefore(details,selects);
      qs('.v290VoiceSettingsBody',details).appendChild(selects);
      const speech=document.createElement('div');speech.className='v290SpeechControls';speech.innerHTML=`
        <label>Speaking voice<select id="v290SpeechVoice"><option value="">Automatic voice</option></select></label>
        <label>Speaking speed <input id="v290SpeechRate" type="range" min="0.7" max="1.25" step="0.05" value="0.95"><output id="v290SpeechRateValue">0.95×</output></label>`;
      qs('.v290VoiceSettingsBody',details).appendChild(speech);
      $('v290SpeechRate')?.addEventListener('input',e=>{if($('v290SpeechRateValue'))$('v290SpeechRateValue').value=Number(e.target.value).toFixed(2)+'×'});
    }

    const action=qs('.actions',commandPanel);
    const buttons=action?qsa('button',action):[];
    if(buttons[0]){buttons[0].innerHTML='🎙 Start Listening';buttons[0].className='btn purple v290StartVoice'}
    if(buttons[1]){buttons[1].innerHTML='■ Stop';buttons[1].className='btn ghost v290StopVoice'}
    if(buttons[2]){buttons[2].innerHTML='✨ Ask Saarathi';buttons[2].className='btn green v290AskVoice'}
    if(buttons[3]){buttons[3].innerHTML='🔊 Read Answer';buttons[3].className='btn gold v290ReadVoice'}
    if(action){
      const pause=document.createElement('button');pause.type='button';pause.className='btn ghost';pause.textContent='⏯ Pause Voice';pause.onclick=()=>window.v290PauseSpeech();action.appendChild(pause);
    }
    const text=$('voiceSaarthiText');if(text)text.placeholder='Speak or type naturally… e.g. “Explain inflation simply, then test me with five questions.”';
    const chips=qs('.voiceChipsV244',commandPanel);
    if(chips)chips.innerHTML=`
      <button onclick="setVoiceCommandV244('Brief me for today and tell me what to study first')">☀ Morning Brief</button>
      <button onclick="setVoiceCommandV244('Explain Fundamental Rights simply with examples and ask me 5 oral questions')">🏛 Learn Polity</button>
      <button onclick="setVoiceCommandV244('Give me a quick revision of inflation with memory tricks')">⚡ Quick Revision</button>
      <button onclick="setVoiceCommandV244('Make a realistic 5 hour study plan using my weak areas')">📅 Plan My Day</button>`;
    const status=$('voiceStatusV244');if(status)status.textContent='Ready — tap the microphone or type below.';

    const logCard=$('voiceSessionLogV244')?.closest('.card');
    if(logCard){
      const details=document.createElement('details');details.className='v290VoiceLogDetails';details.innerHTML='<summary>🕘 Previous voice sessions</summary><div class="v290VoiceLogBody"></div>';
      logCard.insertAdjacentElement('beforebegin',details);qs('.v290VoiceLogBody',details).appendChild(logCard);
    }

    installVoiceOverrides();ensureVoiceAskWrapper();populateVoices();
    if('speechSynthesis' in window)window.speechSynthesis.onvoiceschanged=populateVoices;
    voiceReady=true;
    return true;
  }

  function setVoiceUI(state,message){
    const section=$('voiceSaarthi'),orb=$('v290VoiceOrb'),meter=$('voiceMeterV244'),label=$('v290VoiceState'),status=$('voiceStatusV244');
    section?.classList.toggle('is-listening',state==='listening');
    section?.classList.toggle('is-thinking',state==='thinking');
    section?.classList.toggle('is-speaking',state==='speaking');
    orb?.classList.toggle('active',state==='listening');meter?.classList.toggle('active',state==='listening');
    if(label)label.textContent=message||({listening:'Listening…',thinking:'Thinking…',speaking:'Speaking…',ready:'Saarathi is ready'}[state]||'Saarathi is ready');
    if(status)status.textContent=message||'';
  }

  function installVoiceOverrides(){
    window.startVoiceSaarthi=function(){
      const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
      if(!SR)return alert('Speech recognition is not supported here. Use Chrome or Edge, or type your command.');
      if(voiceRecognition){try{voiceRecognition.stop()}catch(e){}return}
      const field=$('voiceSaarthiText');let finalText='';
      voiceRecognition=new SR();voiceRecognition.lang=$('voiceLanguageV244')?.value||'en-IN';voiceRecognition.continuous=false;voiceRecognition.interimResults=true;
      voiceRecognition.onstart=()=>setVoiceUI('listening','Listening… speak your UPSC question.');
      voiceRecognition.onresult=e=>{
        let interim='';
        for(let i=e.resultIndex;i<e.results.length;i++){
          const part=e.results[i][0].transcript;
          if(e.results[i].isFinal)finalText+=part+' ';else interim+=part;
        }
        if(field){field.value=(finalText+interim).trim();dispatchInput(field)}
      };
      voiceRecognition.onerror=e=>{setVoiceUI('ready','Microphone error: '+(e.error||'unknown'));toast('Check microphone permission','warn')};
      voiceRecognition.onend=()=>{
        voiceRecognition=null;
        const heard=field?.value.trim()||'';
        setVoiceUI('ready',heard?'Voice captured.':'No speech captured. Tap and try again.');
        if(heard&&$('v290AutoAsk')?.checked)setTimeout(()=>window.askVoiceSaarthiAI?.(),360);
      };
      try{voiceRecognition.start()}catch(e){voiceRecognition=null;setVoiceUI('ready','Microphone could not start.')}
    };
    window.stopVoiceSaarthiV244=function(){
      try{voiceRecognition?.stop()}catch(e){}voiceRecognition=null;
      try{window.speechSynthesis?.cancel()}catch(e){}
      setVoiceUI('ready','Stopped. Saarathi is ready.');
    };
    window.speakVoiceOutputV244=function(){
      const text=$('voiceSaarthiOutput')?.innerText.trim();
      if(!text)return toast('No answer to read yet','warn');
      const lang=$('voiceLanguageV244')?.value||'en-IN';
      speakText(text,lang,true);
    };
  }


  function ensureVoiceAskWrapper(){
    const current=window.askVoiceSaarthiAI;
    if(typeof current!=='function')return false;
    if(current.__v290VoiceAsk){voiceAskWrapped=true;return true}
    baseVoiceAsk=current;
    const wrapped=async function(){
      const command=$('voiceSaarthiText')?.value.trim();
      if(!command)return toast('Speak or type a command first','warn');
      setVoiceUI('thinking','Saarathi is preparing your answer…');
      try{
        await baseVoiceAsk.apply(this,arguments);
        setVoiceUI('ready','Answer ready.');
        if($('v290AutoSpeak')?.checked)setTimeout(()=>window.speakVoiceOutputV244?.(),220);
      }catch(e){setVoiceUI('ready','Saarathi needs attention.');throw e}
    };
    wrapped.__v290VoiceAsk=true;
    window.askVoiceSaarthiAI=wrapped;
    voiceAskWrapped=true;
    return true;
  }

  function speakText(text,language,handsFree=false){
    if(!('speechSynthesis' in window))return alert('Text-to-speech is not supported in this browser.');
    window.speechSynthesis.cancel();
    speechUtterance=new SpeechSynthesisUtterance(String(text).replace(/\s+/g,' ').slice(0,9000));
    const lang=/Tamil/i.test(language)?'ta-IN':/Hindi/i.test(language)?'hi-IN':language.includes?.('-')?language:'en-IN';
    speechUtterance.lang=lang;
    speechUtterance.rate=Number($('v290SpeechRate')?.value||0.95);
    const voices=window.speechSynthesis.getVoices();
    const chosen=$('v290SpeechVoice')?.value;
    if(chosen!==undefined&&chosen!==''&&voices[Number(chosen)])speechUtterance.voice=voices[Number(chosen)];
    else speechUtterance.voice=voices.find(v=>v.lang===lang)||voices.find(v=>v.lang.startsWith(lang.split('-')[0]))||null;
    speechUtterance.onstart=()=>setVoiceUI('speaking','Saarathi is speaking…');
    speechUtterance.onend=()=>{
      setVoiceUI('ready','Conversation ready.');
      if(handsFree&&$('v290HandsFree')?.checked)setTimeout(()=>window.startVoiceSaarthi?.(),700);
    };
    speechUtterance.onerror=()=>setVoiceUI('ready','Voice playback stopped.');
    window.speechSynthesis.speak(speechUtterance);
  }
  window.v290PauseSpeech=function(){
    if(!('speechSynthesis' in window))return;
    if(window.speechSynthesis.speaking&&!window.speechSynthesis.paused){window.speechSynthesis.pause();setVoiceUI('ready','Voice paused. Tap again to resume.');}
    else if(window.speechSynthesis.paused){window.speechSynthesis.resume();setVoiceUI('speaking','Saarathi is speaking…');}
  };

  function patchShow(){
    if(typeof window.show!=='function'||window.show.__v290)return;
    const previous=window.show;
    const wrapped=function(id,btn){
      const r=previous.apply(this,arguments);
      if(id==='jarvisCommandV281')setTimeout(()=>{syncJarvisSummary();$('jarvisCommandInputV281')?.focus()},140);
      if(id==='voiceSaarthi')setTimeout(()=>{populateVoices();setVoiceUI('ready','Saarathi is ready.')},140);
      return r;
    };
    wrapped.__v290=true;window.show=wrapped;
  }

  function init(){
    updateVersion();patchShow();setupJarvis();setupVoice();
    let tries=0;
    const timer=setInterval(()=>{
      tries++;updateVersion();patchShow();if(!jarvisReady)setupJarvis();if(!voiceReady)setupVoice();ensureVoiceAskWrapper();
      if((jarvisReady&&voiceReady&&tries>14)||tries>30)clearInterval(timer);
    },300);
    window.addEventListener('online',()=>{updateVersion();toast('Back online')});
    window.addEventListener('offline',()=>{updateVersion();toast('Offline mode active','warn')});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,500),{once:true});else setTimeout(init,300);
})();

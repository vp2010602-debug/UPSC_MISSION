/* Mission UPSC AI OS V30.6.1 — Simplified Daily CA + Simplified Saarthi */
(function(){
  'use strict';
  const VERSION='30.6.1';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const read=(key,fallback)=>{try{const value=JSON.parse(localStorage.getItem(key)||'');return value??fallback}catch(_){return fallback}};
  const write=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
  const today=()=>new Date().toISOString().slice(0,10);
  const FETCH_KEY='mission_easy_ca_fetch_v306';
  const QUEUE_KEY='mission_ca_queue_v305';
  const FEEDS=[
    ['hindu-national','📰','The Hindu National'],
    ['hindu-editorial','✍️','The Hindu Editorial'],
    ['ie-explained','🔎','Indian Express Explained'],
    ['ie-editorials','🗞️','Indian Express Editorials'],
    ['ie-economy','₹','Indian Express Economy'],
    ['ie-climate','🌿','Indian Express Climate'],
    ['ie-scitech','🔬','Indian Express Science & Tech'],
    ['pib-releases','🏛️','PIB Releases'],
    ['rbi-press','🏦','RBI Releases'],
    ['rbi-notifications','📜','RBI Notifications'],
    ['niti-updates','🧭','NITI Aayog']
  ];

  function toast(message,type='info'){
    if(typeof window.showToast==='function') return window.showToast(message,type);
    const el=document.createElement('div');el.className='v3061Toast';el.textContent=message;document.body.appendChild(el);setTimeout(()=>el.remove(),3500);
  }

  function state(){
    const data=read(FETCH_KEY,{items:[],statuses:[],fetchedAt:''});
    data.items=Array.isArray(data.items)?data.items:[];
    return data;
  }

  function selectedCount(){return Number($('v3061TopicCount')?.value||8)}

  function sourceSettingsHtml(){
    return FEEDS.map(([id,icon,name],i)=>`<label class="v3061SourceChip"><input type="checkbox" value="${id}" ${i<8?'checked':''}><span class="v3061SourceText">${icon} ${esc(name)}</span></label>`).join('');
  }

  function installSimpleCA(){
    if(window.__JARVIS_TRACKER_V322_ACTIVE__)return true;
    const section=$('currentAffairsAI');
    if(!section||$('v3061SimpleCA')) return false;
    const legacy=$('v306EasyCA');
    if(legacy) legacy.classList.add('v3061LegacyHidden');
    const oldGrids=[...section.querySelectorAll(':scope > .v305CAGrid')];
    oldGrids.slice(0,2).forEach(x=>x.classList.add('v3061LegacyHidden'));

    const hero=section.querySelector('.v305CAHero');
    if(hero){
      const eyebrow=hero.querySelector('.eyebrow'); if(eyebrow) eyebrow.textContent='V30.6.1 • ONE-CLICK HEADLINES • MANUAL GEMINI CONTROL';
      const h1=hero.querySelector('h1'); if(h1) h1.textContent="Today’s UPSC Current Affairs";
      const p=hero.querySelector('p'); if(p) p.textContent='Press one button to collect today’s headlines for free. Review the selected stories, then press Generate only when you want Gemini to create UPSC notes.';
    }

    const box=document.createElement('div');
    box.id='v3061SimpleCA';
    box.className='v3061SimpleCA';
    box.innerHTML=`
      <div class="v3061MainCard">
        <div class="v3061MainHead">
          <div><span class="v3061Step">STEP 1</span><h2>Get Today’s Important Headlines</h2><p>Headline collection uses <b>zero Gemini tokens</b>.</p></div>
          <span class="v3061FreeBadge">FREE</span>
        </div>
        <div class="v3061QuickRow">
          <label><span>Date</span><input id="v3061CADate" type="date" value="${today()}"></label>
          <label><span>How many topics?</span><select id="v3061TopicCount"><option>5</option><option selected>8</option><option>10</option></select></label>
          <button id="v3061FetchBtn" class="v3061BigButton" type="button">↻ Get Today’s UPSC Headlines</button>
        </div>
        <details class="v3061Details"><summary>Choose sources</summary><div id="v3061Sources" class="v3061Sources">${sourceSettingsHtml()}</div></details>
        <div id="v3061CAStatus" class="v3061Status">Ready. Press the button once.</div>
      </div>

      <div id="v3061ReviewCard" class="v3061MainCard v3061ReviewCard">
        <div class="v3061MainHead">
          <div><span class="v3061Step">STEP 2</span><h2>Review Selected Headlines</h2><p>JARVIS automatically selects the most UPSC-relevant items. Untick anything you do not need.</p></div>
          <span id="v3061SelectedBadge" class="v3061SelectedBadge">0 selected</span>
        </div>
        <div id="v3061HeadlineList" class="v3061HeadlineList"><div class="v3061Empty">No headlines fetched yet.</div></div>
        <div class="v3061GenerateRow">
          <button id="v3061GenerateBtn" class="v3061GenerateButton" type="button" disabled>✨ Generate Selected UPSC Notes with Gemini</button>
          <button id="v3061RefreshSelection" class="v3061SecondaryButton" type="button">Re-select Top Topics</button>
        </div>
        <details class="v3061Details"><summary>Source fetch not working? Paste a daily digest instead</summary><textarea id="v3061Digest" placeholder="Paste headlines or a current-affairs digest. Separate topics with blank lines."></textarea><button id="v3061DigestBtn" class="v3061SecondaryButton" type="button">Add Digest Headlines</button></details>
      </div>`;

    const stats=section.querySelector('.v305CATopStats');
    if(stats) stats.insertAdjacentElement('afterend',box); else section.prepend(box);

    $('v3061FetchBtn').addEventListener('click',fetchSimpleCA);
    $('v3061GenerateBtn').addEventListener('click',generateSimpleCA);
    $('v3061RefreshSelection').addEventListener('click',reselectSimpleCA);
    $('v3061DigestBtn').addEventListener('click',importDigestSimpleCA);
    $('v3061CADate').addEventListener('change',syncCADate);
    renderSimpleCA();
    return true;
  }

  function syncCADate(){
    const value=$('v3061CADate')?.value||today();
    if($('v306FeedDate')) $('v306FeedDate').value=value;
    if($('v305CADate')) $('v305CADate').value=value;
    if($('v305CAFilterDate')) $('v305CAFilterDate').value=value;
  }

  function syncSourcesToLegacy(){
    const selected=new Set([...document.querySelectorAll('#v3061Sources input:checked')].map(x=>x.value));
    document.querySelectorAll('#v306FeedChoices input').forEach(x=>x.checked=selected.has(x.value));
    if($('v306AutoCount')) $('v306AutoCount').value=String(selectedCount()===8?10:selectedCount());
    syncCADate();
  }

  async function fetchSimpleCA(){
    const checked=[...document.querySelectorAll('#v3061Sources input:checked')];
    if(!checked.length) return toast('Choose at least one source.','warn');
    if(typeof window.fetchEasyCAV306!=='function') return toast('Current-affairs fetch engine is not loaded. Refresh once.','error');
    const btn=$('v3061FetchBtn'),status=$('v3061CAStatus');
    btn.disabled=true;btn.textContent='⏳ Collecting headlines…';
    status.textContent='Collecting headlines from the selected sources. No Gemini tokens are being used.';
    try{
      syncSourcesToLegacy();
      await window.fetchEasyCAV306();
      const data=state();
      const legacyStatus=$('v306FetchStatus')?.textContent||'';
      if(!data.items.length){
        status.textContent=legacyStatus||'No headlines were returned. Confirm the V30.6 Firebase function was deployed, then retry.';
      }else{
        trimSelection();
        status.textContent=`✅ ${data.items.length} headlines collected. Review the selected topics below. Gemini has not run yet.`;
      }
      renderSimpleCA();
    }catch(error){status.textContent=`Could not collect headlines: ${error.message}`;}
    finally{btn.disabled=false;btn.textContent='↻ Get Today’s UPSC Headlines';}
  }

  function trimSelection(){
    const data=state();
    const count=selectedCount();
    const sorted=[...data.items].sort((a,b)=>(b.score||0)-(a.score||0)||String(b.publishedAt||'').localeCompare(String(a.publishedAt||'')));
    const ids=new Set(sorted.slice(0,count).map(x=>x.id));
    data.items=data.items.map(x=>({...x,selected:ids.has(x.id)}));
    write(FETCH_KEY,data);
  }

  function reselectSimpleCA(){trimSelection();renderSimpleCA();toast('Top UPSC-relevant headlines selected.','success')}

  function toggleSimpleHeadline(id,on){
    const data=state();data.items=data.items.map(x=>x.id===id?{...x,selected:on}:x);write(FETCH_KEY,data);renderSimpleCA();
  }

  function renderSimpleCA(){
    const list=$('v3061HeadlineList'); if(!list) return;
    const data=state();
    const items=[...data.items].sort((a,b)=>(b.selected-a.selected)||(b.score||0)-(a.score||0)).slice(0,30);
    const selected=data.items.filter(x=>x.selected).length;
    if($('v3061SelectedBadge')) $('v3061SelectedBadge').textContent=`${selected} selected`;
    if($('v3061GenerateBtn')) $('v3061GenerateBtn').disabled=!selected;
    list.innerHTML=items.length?items.map(x=>`<div class="v3061Headline ${x.selected?'selected':''}" data-id="${esc(x.id)}"><input type="checkbox" ${x.selected?'checked':''} aria-label="Select headline"><div><h3>${esc(x.title)}</h3><p>${esc((x.excerpt||'Open the source to read the complete item.').slice(0,220))}</p><div class="v3061Meta"><span>${esc(x.source||'Source')}</span><span>UPSC score ${Number(x.score||0)}</span></div></div><a href="${esc(x.url||'#')}" target="_blank" rel="noopener">Open ↗</a></div>`).join(''):'<div class="v3061Empty">Press “Get Today’s UPSC Headlines” to begin.</div>';
    list.querySelectorAll('.v3061Headline').forEach(row=>{
      row.querySelector('input')?.addEventListener('change',e=>toggleSimpleHeadline(row.dataset.id,e.target.checked));
    });
  }

  function addSelectedToQueue(){
    const data=state(),selected=data.items.filter(x=>x.selected),date=$('v3061CADate')?.value||today();
    if(!selected.length) return 0;
    const old=read(QUEUE_KEY,[]),seen=new Set(old.map(x=>`${x.title}|${x.url}`.toLowerCase()));
    const incoming=[];
    selected.forEach(x=>{
      const key=`${x.title}|${x.url}`.toLowerCase(); if(seen.has(key)) return;seen.add(key);
      incoming.push({id:`lead_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,date,title:x.title,source:x.source,url:x.url,excerpt:x.excerpt||`Headline: ${x.title}\nOpen the original source to verify details.`,selected:true,addedAt:new Date().toISOString()});
    });
    write(QUEUE_KEY,[...incoming,...old].slice(0,120));
    if(typeof window.renderDailyCATrackerV305==='function') window.renderDailyCATrackerV305();
    return incoming.length;
  }

  async function generateSimpleCA(){
    const selected=state().items.filter(x=>x.selected).length;
    if(!selected) return toast('Select at least one headline.','warn');
    syncCADate();
    const added=addSelectedToQueue();
    if($('v305CADepth')) $('v305CADepth').value='Balanced';
    if($('v305CAMaxTopics')) $('v305CAMaxTopics').value=String(Math.min(10,Math.max(5,selectedCount())));
    if(typeof window.updateCABudgetV305==='function') window.updateCABudgetV305();
    const status=$('v3061CAStatus');status.textContent=`${added} new headline(s) prepared. Confirm the Gemini call in the next popup.`;
    if(typeof window.generateDailyCAV305!=='function') return toast('Gemini generation engine is not loaded. Refresh once.','error');
    await window.generateDailyCAV305();
    const result=$('v305CAStatus')?.textContent||'';
    status.textContent=result||'Gemini generation finished. View the Tracker below.';
    renderSimpleCA();
    sectionScrollToTracker();
  }

  function sectionScrollToTracker(){
    document.querySelector('#currentAffairsAI .v305CAWorkspace')?.scrollIntoView({behavior:'smooth',block:'start'});
  }

  function importDigestSimpleCA(){
    const raw=$('v3061Digest')?.value.trim();if(!raw)return toast('Paste a digest first.','warn');
    const blocks=raw.split(/\n\s*\n+/).map(x=>x.trim()).filter(Boolean).slice(0,20),data=state();
    const items=blocks.map((block,i)=>{
      const lines=block.split('\n').map(x=>x.trim()).filter(Boolean),title=(lines.shift()||`Digest item ${i+1}`).replace(/^(?:\d+[.)]|[-•*])\s*/,''),excerpt=lines.join(' ');
      return{id:`digest_${Date.now()}_${i}`,feedId:'digest',source:'Pasted Daily Digest',category:'Digest',title,url:'',excerpt,publishedAt:new Date().toISOString(),score:5,selected:true};
    });
    write(FETCH_KEY,{items:[...items,...data.items].slice(0,120),statuses:data.statuses||[],fetchedAt:new Date().toISOString()});
    $('v3061Digest').value='';renderSimpleCA();$('v3061CAStatus').textContent=`✅ ${items.length} digest item(s) added. Review and generate when ready.`;
  }

  /* ---------------- Simplified Saarthi ---------------- */
  function installSimpleMentor(){
    const hub=$('saarthiMentorHubV303'); if(!hub||$('v3061MentorNav')) return false;
    hub.classList.add('v3061SimpleMentor');
    const hero=hub.querySelector('.s303Hero');
    if(hero){
      const h1=hero.querySelector('h1');if(h1)h1.textContent='Saarthi Mentorship';
      const p=hero.querySelector('p.sub');if(p)p.textContent='Add the mentor plan, follow this week’s tasks, track tests, and prepare a simple progress report.';
      const actions=hero.querySelector('.s303HeroActions');if(actions)actions.innerHTML='<button class="btn gold" onclick="saarthiTabV303(\'plan\')">＋ Add Mentor Plan</button><button class="btn green" onclick="saarthiTabV303(\'targets\')">✓ This Week</button><button class="btn blue" onclick="saarthiTabV303(\'tests\')">🧪 Tests</button><button class="btn ghost" onclick="saarthiTabV303(\'report\')">📊 Progress</button>';
      hero.querySelector('.s303Timeline')?.classList.add('v3061LegacyHidden');
    }

    const oldTabs=hub.querySelector('.s303Tabs');if(oldTabs)oldTabs.classList.add('v3061LegacyHidden');
    const nav=document.createElement('div');nav.id='v3061MentorNav';nav.className='v3061MentorNav';
    nav.innerHTML=`<button class="v3061MentorTab active" data-panel="overview">Home</button><button class="v3061MentorTab" data-panel="plan">Add Plan</button><button class="v3061MentorTab" data-panel="targets">This Week</button><button class="v3061MentorTab" data-panel="tests">Tests</button><button class="v3061MentorTab" data-panel="materials">Notes</button><button class="v3061MentorTab" data-panel="report">Progress</button><details class="v3061More"><summary>More</summary><div><button data-panel="daily">Daily Check-in</button><button data-panel="sessions">Doubts & Sessions</button><button data-panel="micro">Microtopic Planner</button></div></details>`;
    (oldTabs||hero).insertAdjacentElement('afterend',nav);
    nav.querySelectorAll('[data-panel]').forEach(btn=>btn.addEventListener('click',()=>window.saarthiTabV303?.(btn.dataset.panel)));

    const oldTabFn=window.saarthiTabV303;
    if(typeof oldTabFn==='function'&&!oldTabFn.__v3061Wrapped){
      const wrapped=function(name,btn){oldTabFn(name,btn);document.querySelectorAll('#v3061MentorNav .v3061MentorTab').forEach(x=>x.classList.toggle('active',x.dataset.panel===name));};
      wrapped.__v3061Wrapped=true;window.saarthiTabV303=wrapped;
    }

    simplifyPlanPanel(hub);
    simplifyTargetsPanel(hub);
    simplifyTestsPanel(hub);
    return true;
  }

  function simplifyPlanPanel(hub){
    const panel=hub.querySelector('.s303Panel[data-panel="plan"]');if(!panel)return;
    panel.classList.add('v3061PlanPanel');
    const title=panel.querySelector('h2');if(title)title.textContent='Add This Week’s Mentor Plan';
    const desc=panel.querySelector('p.sub');if(desc)desc.textContent='Paste the weekly target or upload the mentor PDF. Gemini will split broad subjects into clear daily tasks.';
    const mentorInput=$('s303MentorName');mentorInput?.closest('label')?.classList.add('v3061OptionalField');
    const actions=panel.querySelectorAll('.s303Actions button');
    actions.forEach(button=>{
      const text=button.textContent||'';
      if(/Read File/i.test(text))button.textContent='1. Read Upload';
      else if(/Segregate/i.test(text))button.textContent='2. AI Make Weekly Plan';
      else if(/Save Raw|ChatGPT/i.test(text))button.classList.add('v3061LegacyHidden');
    });
    const approve=[...panel.querySelectorAll('button')].find(x=>/Approve/i.test(x.textContent||''));if(approve)approve.textContent='3. Approve & Add Everywhere';
  }

  function simplifyTargetsPanel(hub){
    const panel=hub.querySelector('.s303Panel[data-panel="targets"]');if(!panel)return;
    const formCard=panel.querySelector('.s303Card');if(!formCard)return;
    formCard.classList.add('v3061CollapsibleCard','collapsed');
    const toggle=document.createElement('button');toggle.className='v3061SmallToggle';toggle.type='button';toggle.textContent='＋ Add a target manually';toggle.onclick=()=>formCard.classList.toggle('collapsed');
    panel.insertBefore(toggle,formCard);
    $('s303TaskFrequency')?.closest('label')?.classList.add('v3061AdvancedField');
    $('s303TaskStatus')?.closest('label')?.classList.add('v3061AdvancedField');
    const createDaily=[...formCard.querySelectorAll('button')].find(x=>/7 Daily Mains/i.test(x.textContent||''));createDaily?.classList.add('v3061AdvancedField');
  }

  function simplifyTestsPanel(hub){
    const panel=hub.querySelector('.s303Panel[data-panel="tests"]');if(!panel)return;
    const cards=panel.querySelectorAll(':scope > .s303Grid2 > .s303Card');const formCard=cards[0];
    if(formCard){
      formCard.classList.add('v3061CollapsibleCard','collapsed');
      const toggle=document.createElement('button');toggle.className='v3061SmallToggle';toggle.type='button';toggle.textContent='＋ Add / update a test';toggle.onclick=()=>formCard.classList.toggle('collapsed');panel.insertBefore(toggle,panel.firstChild);
      ['s303TestFrequency','s303TestGap','s303TestRemarks'].forEach(id=>$(id)?.closest('label')?.classList.add('v3061AdvancedField'));
      const importBtn=[...formCard.querySelectorAll('button')].find(x=>/Import Nitya/i.test(x.textContent||''));importBtn?.classList.add('v3061AdvancedField');
      formCard.querySelector('.s303Alert')?.classList.add('v3061AdvancedField');
    }
  }

  function updateVersion(){
    if(window.__JARVIS_TRACKER_V322_ACTIVE__)return;
    document.title='Jarvis UPSC V30.6.1 — Simple CA + Simple Mentor';
    document.querySelectorAll('.versionBadge').forEach(x=>x.textContent='V30.6.1 • Simple CA + Mentor');
    window.__MISSION_UPSC_VERSION__=VERSION;
    const release=[...document.querySelectorAll('.v275ReleaseList div')].find(x=>x.querySelector('span')?.textContent==='Version');
    if(release?.querySelector('b'))release.querySelector('b').textContent='Mission UPSC AI OS V30.6.1 Simple Daily CA + Simplified Mentorship';
  }

  function init(){
    let tries=0;const timer=setInterval(()=>{
      const ca=installSimpleCA()||$('v3061SimpleCA');
      const mentor=installSimpleMentor()||$('v3061MentorNav');
      if((ca&&mentor)||++tries>60){clearInterval(timer);renderSimpleCA();updateVersion();}
    },150);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

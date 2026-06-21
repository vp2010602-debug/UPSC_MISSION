/* Mission UPSC AI OS V29.1 — Clean Consolidated
   Additive consolidation layer. Existing V29.0 modules, storage keys and functions remain intact. */
(function(){
  'use strict';

  const TITLES = {
    revisionPlannerV291: 'Weak Topics & Revision Planner',
    upscNotesHubV291: 'UPSC Notes Hub',
    prelimsTestCentreV291: 'AI Prelims Test Centre',
    mainsAnswerCentreV291: 'AI Mains Answer Writing Centre',
    memoryEngineV263: 'Smart Recall & Spaced Revision',
    aiLibraryAssistant: 'Smart Library Assistant',
    rankReadinessV272: 'UPSC Readiness Dashboard',
    timeHabitV262: 'Focus & Habit Intelligence',
    dailyCommandV261: 'AI Daily Command Centre'
  };

  const ROUTES = {
    aiRevisionBrain: ['revisionPlannerV291','aiRevisionBrain'],
    snarkRevision: ['revisionPlannerV291','snarkRevision'],
    evernoteNotes: ['upscNotesHubV291','evernoteNotes'],
    richNotesV4: ['upscNotesHubV291','richNotesV4'],
    aiNotesPro: ['upscNotesHubV291','richNotesV4'],
    aiMockCentre: ['prelimsTestCentreV291','aiMockCentre'],
    prelimsWarRoomV251: ['prelimsTestCentreV291','prelimsWarRoomV251'],
    aiMainsCentre: ['mainsAnswerCentreV291','aiMainsCentre'],
    mainsWarRoomV252: ['mainsAnswerCentreV291','mainsWarRoomV252'],
    answerEvaluator: ['mainsAnswerCentreV291','answerEvaluator']
  };

  let baseShow = null;

  function esc(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  function updatePageTitle(id){
    const title = TITLES[id];
    const node = document.getElementById('pageTitle');
    if(title && node){
      node.innerHTML = `${esc(title)} <span class="versionBadge">V29.1 • Clean Consolidated</span>`;
    }
  }

  function makeUnifiedSection(config){
    const sources = config.panels.map(p => document.getElementById(p.id)).filter(Boolean);
    if(!sources.length || document.getElementById(config.id)) return;

    const wrapper = document.createElement('section');
    wrapper.id = config.id;
    wrapper.className = 'section lightStudySection v291UnifiedSection';
    wrapper.innerHTML = `
      <div class="cleanHero v291UnifiedHero">
        <div>
          <span class="eyebrow blueEye">${esc(config.eyebrow || 'V29.1 • CLEAN CONSOLIDATED WORKSPACE')}</span>
          <h1>${esc(config.title)}</h1>
          <p class="sub">${esc(config.description)}</p>
        </div>
        <div class="heroIcon">${config.icon || '✨'}</div>
      </div>
      <div class="v291ModuleTabs" role="tablist" aria-label="${esc(config.title)} modes"></div>
      <div class="v291PanelHost"></div>`;

    sources[0].parentNode.insertBefore(wrapper, sources[0]);
    const tabs = wrapper.querySelector('.v291ModuleTabs');
    const host = wrapper.querySelector('.v291PanelHost');

    config.panels.forEach((panel, index) => {
      const source = document.getElementById(panel.id);
      if(!source) return;
      source.classList.remove('section','active');
      source.classList.add('v291UnifiedPanel');
      source.dataset.v291Parent = config.id;
      source.style.display = index === 0 ? 'block' : 'none';
      host.appendChild(source);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = index === 0 ? 'active' : '';
      button.dataset.v291Panel = panel.id;
      button.setAttribute('role','tab');
      button.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
      button.innerHTML = `${panel.icon || ''} ${esc(panel.label)}`.trim();
      button.addEventListener('click', () => window.openUnifiedV291(config.id, panel.id));
      tabs.appendChild(button);
    });
  }

  function activatePanel(wrapperId, panelId){
    const wrapper = document.getElementById(wrapperId);
    if(!wrapper) return;
    wrapper.querySelectorAll('.v291UnifiedPanel').forEach(panel => {
      panel.style.display = panel.id === panelId ? 'block' : 'none';
      panel.classList.toggle('v291PanelActive', panel.id === panelId);
    });
    wrapper.querySelectorAll('.v291ModuleTabs button').forEach(button => {
      const active = button.dataset.v291Panel === panelId;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    wrapper.dataset.activePanel = panelId;
    window.scrollTo({top:0,behavior:'smooth'});
  }

  window.openUnifiedV291 = function(wrapperId, panelId, button){
    if(typeof baseShow === 'function') baseShow(wrapperId, button);
    activatePanel(wrapperId, panelId);
    updatePageTitle(wrapperId);
  };

  function improveSectionLabels(){
    const replacements = [
      ['#snarkRevision h1, #snarkRevision h2','Rapid Revision Mode'],
      ['#aiMockCentre h1','Quick Practice & Mock Builder'],
      ['#prelimsWarRoomV251 h1','Full Prelims Exam & Analysis'],
      ['#aiMainsCentre h1','Mains Answer Practice Lab'],
      ['#mainsWarRoomV252 h1','Timed Mains War Room'],
      ['#answerEvaluator h1','AI Mains Answer Evaluation']
    ];
    replacements.forEach(([selector,text]) => {
      const node = document.querySelector(selector);
      if(node) node.textContent = text;
    });

    const revisionCopy = document.querySelector('#aiRevisionBrain .revisionHeroV241 .sub');
    if(revisionCopy) revisionCopy.textContent = 'Detect weak areas from your notes, wrong answers, tests and mains feedback, then build a realistic repair plan.';
    const recallCopy = document.querySelector('#memoryEngineV263 .v263MemoryHero .sub');
    if(recallCopy) recallCopy.textContent = 'Turn flashcards, mistakes, notes and revision items into a daily active-recall queue with spaced revision.';
  }

  function enhanceNotesQuickMode(){
    const quick = document.getElementById('evernoteNotes');
    if(!quick || quick.querySelector('.v291NotesIntro')) return;
    const intro = document.createElement('div');
    intro.className = 'v291NotesIntro';
    intro.innerHTML = '<b>Quick Note</b><span>Capture a clean UPSC note fast. Use the Pro Editor tab for rich formatting, images, templates, AI rewriting and exports.</span>';
    quick.insertBefore(intro, quick.firstChild);
  }

  function enhanceRevision(){
    const brain = document.getElementById('aiRevisionBrain');
    if(!brain || brain.querySelector('.v291RevisionGuide')) return;
    const guide = document.createElement('div');
    guide.className = 'v291RevisionGuide';
    guide.innerHTML = `
      <div><b>Diagnosis mode</b><span>Find what is weak and schedule a repair plan.</span></div>
      <button type="button" class="btn gold" onclick="openUnifiedV291('revisionPlannerV291','snarkRevision')">🔥 Start Rapid Revision</button>`;
    const hero = brain.querySelector('.cleanHero');
    if(hero) hero.insertAdjacentElement('afterend',guide); else brain.prepend(guide);
  }

  function enhanceFocus(){
    const focus = document.getElementById('timeHabitV262');
    if(!focus || focus.querySelector('.v291FocusNotice')) return;
    const notice = document.createElement('div');
    notice.className = 'v291FocusNotice';
    notice.innerHTML = '<b>Pomodoro is now built in here.</b><span>Choose 25, 50 or any duration in Deep Work Session—no separate Pomodoro page is needed.</span>';
    const tabs = focus.querySelector('.v264HubTabs');
    if(tabs) tabs.insertAdjacentElement('afterend',notice);
  }

  window.openFocusSessionV291 = function(task, subject, minutes){
    if(typeof window.show === 'function') window.show('timeHabitV262');
    const taskEl = document.getElementById('focusTaskV262');
    const subjectEl = document.getElementById('focusSubjectV262');
    const minsEl = document.getElementById('focusMinutesV262');
    if(taskEl && task) taskEl.value = task;
    if(subjectEl && subject && [...subjectEl.options].some(o => o.value === subject || o.text === subject)) subjectEl.value = subject;
    if(minsEl && minutes) minsEl.value = minutes;
    setTimeout(() => document.getElementById('focusTimerV264')?.scrollIntoView({behavior:'smooth',block:'start'}),80);
  };

  function enhanceAnswerEvaluator(){
    const section = document.getElementById('answerEvaluator');
    const creator = section?.querySelector('.studyCreator');
    const outputCard = document.getElementById('answerEvalOutput')?.closest('.card');
    if(!creator || creator.querySelector('#answerPaperV291')) return;

    const controls = document.createElement('div');
    controls.className = 'v291EvalControls';
    controls.innerHTML = `
      <label>Paper<select id="answerPaperV291"><option>GS1</option><option selected>GS2</option><option>GS3</option><option>GS4</option><option>Essay</option><option>Sociology Optional</option></select></label>
      <label>Question marks<select id="answerMarksV291"><option value="10">10 marks</option><option value="15" selected>15 marks</option><option value="20">20 marks</option><option value="250">Essay / 250 marks</option></select></label>
      <label>Directive<select id="answerDirectiveV291"><option>Auto-detect</option><option>Discuss</option><option>Analyse</option><option>Critically analyse</option><option>Examine</option><option>Critically examine</option><option>Evaluate</option><option>Comment</option><option>Elucidate</option></select></label>
      <label>Target words<select id="answerWordLimitV291"><option value="150">150 words</option><option value="250" selected>250 words</option><option value="1000">Essay length</option></select></label>`;
    const heading = creator.querySelector('h2');
    heading?.insertAdjacentElement('afterend',controls);

    const question = document.getElementById('answerQuestion');
    question?.setAttribute('placeholder','Paste the exact UPSC question / topic');
    const text = document.getElementById('answerText');
    text?.setAttribute('placeholder','Paste your typed or extracted answer here. PDF text can be loaded. For handwritten images, paste the text for reliable evaluation.');
    const meter = document.createElement('div');
    meter.id = 'answerWordCountV291';
    meter.className = 'v291WordMeter';
    meter.textContent = '0 words';
    text?.insertAdjacentElement('afterend',meter);
    text?.addEventListener('input',updateAnswerWordCountV291);

    const evalButton = [...creator.querySelectorAll('button')].find(b => /Evaluate Answer/i.test(b.textContent));
    if(evalButton){
      evalButton.setAttribute('onclick','evaluateMainsAnswerV291()');
      evalButton.textContent = '🤖 Evaluate Answer';
    }

    if(outputCard && !outputCard.querySelector('.v291EvalActions')){
      const actions = document.createElement('div');
      actions.className = 'actions v291EvalActions';
      actions.innerHTML = `
        <button type="button" class="btn green" onclick="saveMainsEvaluationV235()">💾 Save Report</button>
        <button type="button" class="btn gold" onclick="sendMainsWeaknessToRevision()">📌 Send Weakness to Revision</button>
        <button type="button" class="btn blue" onclick="downloadAIOutputV226('answerEvalOutput','html')">⬇ Download</button>
        <button type="button" class="btn ghost" onclick="printSection('answerEvalOutput')">📄 PDF / Print</button>`;
      outputCard.appendChild(actions);
    }
    updateAnswerWordCountV291();
  }

  function updateAnswerWordCountV291(){
    const words = (document.getElementById('answerText')?.value || '').trim().split(/\s+/).filter(Boolean).length;
    const limit = Number(document.getElementById('answerWordLimitV291')?.value || 250);
    const meter = document.getElementById('answerWordCountV291');
    if(meter){
      meter.textContent = `${words} words • target ${limit}`;
      meter.classList.toggle('over', words > limit * 1.1);
      meter.classList.toggle('good', words > limit * 0.75 && words <= limit * 1.1);
    }
  }

  window.evaluateMainsAnswerV291 = async function(){
    const question = document.getElementById('answerQuestion')?.value.trim() || '';
    const answer = document.getElementById('answerText')?.value.trim() || '';
    const paper = document.getElementById('answerPaperV291')?.value || 'GS2';
    const marks = Number(document.getElementById('answerMarksV291')?.value || 15);
    const directive = document.getElementById('answerDirectiveV291')?.value || 'Auto-detect';
    const wordLimit = Number(document.getElementById('answerWordLimitV291')?.value || 250);
    const output = document.getElementById('answerEvalOutput');
    if(!question) return alert('Enter the exact question or topic.');
    if(!answer) return alert('Paste or load your answer text first.');

    updateAnswerWordCountV291();
    const wordCount = answer.split(/\s+/).filter(Boolean).length;
    if(output) output.innerHTML = '<div class="aiLoading">Evaluating question demand, structure, content, presentation and value addition…</div>';

    const prompt = `You are a strict but constructive UPSC mains evaluator. Evaluate the answer like a serious mentor, not a generic chatbot.\n\nPaper: ${paper}\nQuestion marks: ${marks}\nDirective selected: ${directive}\nTarget word limit: ${wordLimit}\nActual word count: ${wordCount}\nQuestion: ${question}\n\nCandidate answer:\n${answer}\n\nReturn exactly these headings:\n# UPSC Mains Evaluation\n## 1. Question Demand & Directive\nState what the question actually demands and whether the answer addressed it.\n## 2. Score\nGive one realistic score out of ${marks}, followed by a one-line justification. Do not inflate marks.\n## 3. Dimension-wise Scorecard\nUse a compact table for relevance, introduction, structure, content depth, examples/data, balance, presentation, and conclusion.\n## 4. What Worked\nSpecific strengths from the submitted answer.\n## 5. Critical Gaps\nMissing dimensions, factual weaknesses, repetition, vague claims and irrelevant portions.\n## 6. Value Addition Missing\nRelevant constitutional articles, judgments, committees, reports, data, examples, case studies, thinkers or current examples. Mention only defensible items.\n## 7. Diagram / Flowchart Opportunity\nSuggest a simple diagram only where useful.\n## 8. Better Answer Framework\nGive a sharper introduction-body-conclusion structure with headings.\n## 9. Improved Introduction\nWrite a concise improved introduction.\n## 10. Improved Conclusion\nWrite a balanced, forward-looking conclusion.\n## 11. Model Answer\nWrite a model answer near the target word limit, with clear subheadings and balanced analysis.\n## 12. Next Practice Task\nGive one targeted follow-up question based on the biggest weakness.\n\nBe specific to the candidate answer. Never claim handwriting or presentation features that are not visible in the pasted text.`;

    try{
      const ask = window.aiAskRouterV23 || window.aiAsk;
      if(typeof ask !== 'function') throw new Error('AI router is not available. Open AI Control Centre and save a provider.');
      const response = await ask(prompt);
      const formatted = window.formatAI ? window.formatAI(response) : `<pre>${esc(response)}</pre>`;
      if(output) output.innerHTML = `<div class="v291EvalSummary"><b>${wordCount} words</b><span>${paper} • ${marks} marks • ${esc(directive)}</span></div>${formatted}`;

      const mainsQuestion = document.getElementById('mainsQuestionAI');
      const mainsAnswer = document.getElementById('mainsAnswerAI');
      const mainsPaper = document.getElementById('mainsPaperAI');
      const mainsReport = document.getElementById('mainsAIReport');
      if(mainsQuestion) mainsQuestion.value = question;
      if(mainsAnswer) mainsAnswer.value = answer;
      if(mainsPaper){
        const match = [...mainsPaper.options].find(o => o.value === paper || o.text === paper);
        if(match) mainsPaper.value = match.value;
      }
      if(mainsReport) mainsReport.innerHTML = output?.innerHTML || formatted;
    }catch(error){
      if(output) output.innerHTML = `<div class="v291LocalFallback"><h3>Evaluation could not run</h3><p>${esc(error.message)}</p><p><b>Local check:</b> ${wordCount} words against a ${wordLimit}-word target. Check directive compliance, clear introduction, multidimensional body, evidence/examples, balance and a forward-looking conclusion.</p></div>`;
    }
  };

  function installUnifiedWorkspaces(){
    makeUnifiedSection({
      id:'revisionPlannerV291', title:'Weak Topics & Revision Planner', icon:'🧠',
      eyebrow:'V29.1 • DIAGNOSE → REPAIR → RAPID REVISE',
      description:'One revision workspace to detect weak topics, create repair plans and run fast high-yield revision without duplicate sections.',
      panels:[
        {id:'aiRevisionBrain',label:'Weak Topic Diagnosis',icon:'🩺'},
        {id:'snarkRevision',label:'Rapid Revision',icon:'🔥'}
      ]
    });
    makeUnifiedSection({
      id:'upscNotesHubV291', title:'UPSC Notes Hub', icon:'📒',
      eyebrow:'V29.1 • QUICK NOTE + PRO EDITOR + LIBRARY',
      description:'Create, edit, organise and revise every UPSC note in one place. Quick Note and Pro Editor now share one clear home.',
      panels:[
        {id:'evernoteNotes',label:'Quick Note & Library',icon:'✍️'},
        {id:'richNotesV4',label:'Pro Editor',icon:'📝'}
      ]
    });
    makeUnifiedSection({
      id:'prelimsTestCentreV291', title:'AI Prelims Test Centre', icon:'🧪',
      eyebrow:'V29.1 • PRACTICE + MOCKS + EXAM ANALYSIS',
      description:'Quick quizzes, topic tests, full mocks, PYQ practice, negative marking and weak-area analysis now live in one test centre.',
      panels:[
        {id:'aiMockCentre',label:'Quick Practice & Mocks',icon:'⚡'},
        {id:'prelimsWarRoomV251',label:'Full Exam & Analysis',icon:'🎯'}
      ]
    });
    makeUnifiedSection({
      id:'mainsAnswerCentreV291', title:'AI Mains Answer Writing Centre', icon:'✍️',
      eyebrow:'V29.1 • PRACTICE + TIMED TEST + EVALUATION',
      description:'Daily answer writing, timed mains simulation and upgraded AI evaluation are now organised inside one complete Mains centre.',
      panels:[
        {id:'aiMainsCentre',label:'Answer Practice Lab',icon:'📝'},
        {id:'mainsWarRoomV252',label:'Timed War Room',icon:'⏱️'},
        {id:'answerEvaluator',label:'Answer Evaluation',icon:'📤'}
      ]
    });
  }

  function installShowRouter(){
    baseShow = window.show;
    if(typeof baseShow !== 'function') return;
    window.show = function(id, button){
      if(id === 'pomodoroPage'){
        const result = baseShow('timeHabitV262',button);
        updatePageTitle('timeHabitV262');
        setTimeout(() => document.getElementById('focusTimerV264')?.scrollIntoView({behavior:'smooth',block:'start'}),80);
        return result;
      }
      if(ROUTES[id]){
        const [wrapper,panel] = ROUTES[id];
        return window.openUnifiedV291(wrapper,panel,button);
      }
      const result = baseShow(id,button);
      if(TITLES[id]) updatePageTitle(id);
      return result;
    };
  }

  function updateVersionText(){
    document.querySelectorAll('.versionBadge').forEach(node => node.textContent = 'V29.1 • Clean Consolidated');
    const release = [...document.querySelectorAll('.v275ReleaseList b')].find(node => /Mission UPSC AI OS V29\.0/i.test(node.textContent));
    if(release) release.textContent = 'Mission UPSC AI OS V29.1 Clean Consolidated';
  }

  function init(){
    installUnifiedWorkspaces();
    improveSectionLabels();
    enhanceNotesQuickMode();
    enhanceRevision();
    enhanceFocus();
    enhanceAnswerEvaluator();
    installShowRouter();
    updateVersionText();

    // Old route compatibility while keeping the cleaned sidebar.
    window.openRevisionBrainV291 = () => window.openUnifiedV291('revisionPlannerV291','aiRevisionBrain');
    window.openRapidRevisionV291 = () => window.openUnifiedV291('revisionPlannerV291','snarkRevision');
    window.openNotesProV291 = () => window.openUnifiedV291('upscNotesHubV291','richNotesV4');
    window.openPrelimsWarRoomV291 = () => window.openUnifiedV291('prelimsTestCentreV291','prelimsWarRoomV251');
    window.openMainsEvaluatorV291 = () => window.openUnifiedV291('mainsAnswerCentreV291','answerEvaluator');
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();

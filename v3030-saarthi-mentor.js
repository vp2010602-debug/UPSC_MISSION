/* Mission UPSC AI OS V30.3.0 — Saarthi Mentorship Hub */
(function(){
  'use strict';
  const VERSION='V30.3.0';
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const today=()=>new Date().toISOString().slice(0,10);
  const val=id=>($(id)?.value||'').trim();
  const checked=id=>Boolean($(id)?.checked);
  const fmtDate=d=>{if(!d)return 'No date';const x=new Date(d+'T00:00:00');return Number.isNaN(x.getTime())?d:x.toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'});};
  const uid=()=>`s303_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  let pendingPlan=null;
  let accountRating=3;

  async function getCol(name){
    try{if(typeof window.getCol==='function')return await window.getCol(name);}catch(e){console.warn(e)}
    try{return JSON.parse(localStorage.getItem(name)||'[]')}catch(e){return []}
  }
  async function saveCol(name,obj){
    try{if(typeof window.saveCol==='function'){await window.saveCol(name,obj);return obj;}}catch(e){console.warn(e)}
    const a=await getCol(name);const item={...obj,id:obj.id||uid(),createdAt:Date.now()};a.unshift(item);localStorage.setItem(name,JSON.stringify(a));return item;
  }
  async function replaceItem(name,item,patch){
    const next={...item,...patch,updatedAt:Date.now()};
    try{if(typeof window.deleteItem==='function')await window.deleteItem(name,item.id||item._docId,true);}catch(e){console.warn(e)}
    await saveCol(name,next);
    return next;
  }
  async function removeItem(name,id){
    if(!confirm('Delete this item?'))return;
    if(typeof window.deleteItem==='function')await window.deleteItem(name,id,true);
    else{const a=await getCol(name);localStorage.setItem(name,JSON.stringify(a.filter(x=>String(x.id)!==String(id))))}
    await renderAllMentorV303();
  }
  function toast(msg){
    if(typeof window.alert==='function')alert(msg);
  }
  function setStatus(id,msg,kind=''){
    const e=$(id);if(!e)return;e.className='s303Status'+(kind?` ${kind}`:'');e.innerHTML=msg;
  }
  function modeLabel(){
    try{const s=JSON.parse(localStorage.getItem('mission_ai_settings_v23')||'{}');return s.mode==='gemini'?'Gemini API':s.mode==='ollama'?'Ollama Local':s.mode==='chatgpt'?'ChatGPT Prompt Mode':'Smart Hybrid';}catch(e){return 'Selected AI'}
  }
  async function askAI(prompt){
    if(typeof window.aiAskRouterV23==='function')return await window.aiAskRouterV23(prompt);
    if(typeof window.aiAsk==='function')return await window.aiAsk(prompt);
    throw new Error('AI router not found. Save your AI settings first.');
  }
  function cleanJson(raw){
    let s=String(raw||'').trim();
    const fence=s.match(/```(?:json)?\s*([\s\S]*?)```/i);if(fence)s=fence[1].trim();
    const first=s.indexOf('{'),last=s.lastIndexOf('}');if(first>=0&&last>first)s=s.slice(first,last+1);
    return s;
  }
  function mondayOf(dateStr=today()){
    const d=new Date(dateStr+'T00:00:00');const day=d.getDay()||7;d.setDate(d.getDate()-day+1);return d.toISOString().slice(0,10);
  }
  function addDays(dateStr,n){const d=new Date(dateStr+'T00:00:00');d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)}
  function endOfWeek(dateStr=today()){return addDays(mondayOf(dateStr),6)}
  function isBetween(d,a,b){return d&&d>=a&&d<=b}
  function normalizedType(t='Task'){
    const x=String(t).toLowerCase();
    if(x.includes('mains')||x.includes('answer'))return 'Mains Answer';
    if(x.includes('prelim')||x.includes('mcq'))return 'Prelims';
    if(x.includes('revision')||x.includes('revise'))return 'Revision';
    if(x.includes('current')||x==='ca')return 'Current Affairs';
    if(x.includes('note')||x.includes('read'))return 'Study / Notes';
    if(x.includes('test')||x.includes('mock'))return 'Test';
    return t||'Task';
  }
  function linkedSection(type=''){
    const x=String(type).toLowerCase();
    if(x.includes('mains')||x.includes('answer'))return 'mainsAnswerCentreV291';
    if(x.includes('prelim')||x.includes('mcq'))return 'prelimsTestCentreV291';
    if(x.includes('revision'))return 'revisionPlannerV291';
    if(x.includes('current'))return 'currentAffairsAI';
    if(x.includes('note')||x.includes('study'))return 'upscNotesHubV291';
    if(x.includes('test'))return 'aiCalendarV4';
    return 'dailyCommandV261';
  }
  function goLinked(type){if(typeof window.show==='function')window.show(linkedSection(type));}
  window.saarthiOpenLinkedV303=goLinked;

  function ensureNav(){
    const nav=document.querySelector('.nav');if(!nav||$('saarthiNavV303'))return;
    const b=document.createElement('button');b.id='saarthiNavV303';b.innerHTML='🧑‍🏫 Saarthi Mentorship Hub';b.onclick=()=>window.show&&window.show('saarthiMentorHubV303',b);
    const mentor=[...nav.querySelectorAll('button')].find(x=>(x.getAttribute('onclick')||'').includes('aiMentorPage'));
    if(mentor)mentor.insertAdjacentElement('afterend',b);else nav.appendChild(b);
  }
  function sectionHtml(){
    return `<section id="saarthiMentorHubV303" class="section lightStudySection">
      <div class="cleanHero s303Hero">
        <div>
          <span class="eyebrow">NITYA PRAGATI • 1:1 MENTORSHIP WORKSPACE</span>
          <h1>Saarthi Mentorship Hub</h1>
          <p class="sub">Convert mentor notes, PDFs and weekly instructions into daily targets, tests, revision, calendar actions and a progress report for your next 1:1 session.</p>
          <div class="s303HeroActions">
            <button class="btn gold" onclick="saarthiTabV303('plan')">✨ Import Mentor Plan</button>
            <button class="btn green" onclick="saarthiTabV303('targets')">🎯 Weekly Targets</button>
            <button class="btn blue" onclick="saarthiTabV303('tests')">🧪 Tests</button>
            <button class="btn ghost" onclick="saarthiGenerateMeetingBriefV303()">📄 Prepare Mentor Brief</button>
          </div>
          <div class="s303Timeline">
            <div class="s303Phase"><span>Phase 1 • Jun–Dec 2026</span><b>Mains Ready</b></div>
            <div class="s303Phase"><span>Phase 2 • Jan–May 2027</span><b>Prelims Ready</b></div>
            <div class="s303Phase"><span>Phase 3 • May onward</span><b>Final Lap</b></div>
          </div>
        </div><div class="heroIcon">🧭</div>
      </div>
      <div class="s303Tabs" role="tablist">
        <button class="s303Tab active" data-tab="overview" onclick="saarthiTabV303('overview',this)">Overview</button>
        <button class="s303Tab" data-tab="plan" onclick="saarthiTabV303('plan',this)">AI Plan Extractor</button>
        <button class="s303Tab" data-tab="targets" onclick="saarthiTabV303('targets',this)">Weekly Targets</button>
        <button class="s303Tab" data-tab="daily" onclick="saarthiTabV303('daily',this)">Daily Accountability</button>
        <button class="s303Tab" data-tab="tests" onclick="saarthiTabV303('tests',this)">Daily & Weekly Tests</button>
        <button class="s303Tab" data-tab="materials" onclick="saarthiTabV303('materials',this)">Notes & Materials</button>
        <button class="s303Tab" data-tab="sessions" onclick="saarthiTabV303('sessions',this)">Sessions & Doubts</button>
        <button class="s303Tab" data-tab="report" onclick="saarthiTabV303('report',this)">Weekly Report</button>
      </div>

      <div class="s303Panel active" data-panel="overview">
        <div class="s303Stats">
          <div class="s303Stat"><span>Weekly completion</span><b id="s303Completion">0%</b></div>
          <div class="s303Stat"><span>Daily answer streak</span><b id="s303Streak">0 days</b></div>
          <div class="s303Stat"><span>Pending mentor targets</span><b id="s303Pending">0</b></div>
          <div class="s303Stat"><span>Next scheduled test</span><b id="s303NextTest">—</b></div>
        </div>
        <div class="s303Grid2">
          <div class="card s303Card"><div class="s303CardHead"><div><h2>Today’s Mentor Mission</h2><p class="sub">Targets assigned for today and overdue work needing attention.</p></div><button class="btn green" onclick="saarthiTabV303('targets')">Open Board</button></div><div id="s303TodayList" class="s303List"></div></div>
          <div class="card s303Card"><div class="s303CardHead"><div><h2>Upcoming Tests</h2><p class="sub">Daily, weekly and official mentorship tests.</p></div><button class="btn blue" onclick="saarthiTabV303('tests')">Test Tracker</button></div><div id="s303UpcomingTests" class="s303List"></div></div>
        </div>
        <div class="s303Grid3" style="margin-top:18px">
          <div class="card s303Card"><h3>Weekly 1:1 Workflow</h3><p class="sub">Diagnosis → weekly study plan → implementation → question practice → progress review.</p><button class="btn ghost" onclick="saarthiTabV303('sessions')">Add Session Notes</button></div>
          <div class="card s303Card"><h3>Accountability System</h3><p class="sub">Track hours, answer writing, MCQs, revision, current affairs and day rating.</p><button class="btn ghost" onclick="saarthiTabV303('daily')">Fill Today Sheet</button></div>
          <div class="card s303Card"><h3>Progress Report</h3><p class="sub">Prepare completion, consistency, tests, gaps and questions before meeting your mentor.</p><button class="btn ghost" onclick="saarthiTabV303('report')">Generate Report</button></div>
        </div>
      </div>

      <div class="s303Panel" data-panel="plan">
        <div class="s303Grid2">
          <div class="card s303Card">
            <div class="s303CardHead"><div><h2>Mentor Plan Inbox</h2><p class="sub">Type instructions, paste WhatsApp text or read a PDF/TXT file. Gemini/Hybrid can segregate the plan into actionable targets.</p></div><span class="pill blue" id="s303AIMode">Selected AI</span></div>
            <div class="s303FormGrid">
              <label><span>Week starts</span><input id="s303WeekStart" type="date"></label>
              <label><span>Week ends</span><input id="s303WeekEnd" type="date"></label>
              <label><span>Mentor name</span><input id="s303MentorName" placeholder="Mentor name"></label>
              <label><span>Upload mentor PDF/TXT</span><input id="s303PlanFile" type="file" accept=".pdf,.txt,.md,.csv"></label>
              <label class="s303Full"><span>Mentor instructions / weekly target</span><textarea id="s303PlanText" placeholder="Example: Complete Fundamental Rights and DPSP this week. Write one GS2 answer daily. Attempt Polity Test 1 on Friday. Revise current affairs on Sunday."></textarea></label>
            </div>
            <div class="s303Actions"><button class="btn ghost" onclick="saarthiReadPlanFileV303()">📖 Read File</button><button class="btn purple" onclick="saarthiExtractPlanV303()">✨ AI Segregate Plan</button><button class="btn blue" onclick="saarthiSaveRawPlanV303()">💾 Save Raw Plan</button><button class="btn ghost" onclick="show('chatgptPromptHubV302')">📋 Use ChatGPT Hub</button></div>
            <div id="s303PlanStatus" class="s303Status">Paste or upload the latest instructions from your mentor.</div>
          </div>
          <div class="card s303Card">
            <div class="s303CardHead"><div><h2>Extracted Plan Preview</h2><p class="sub">Review before integrating it with Calendar, Revision, Notes, Mains and Prelims tools.</p></div><button class="btn green" onclick="saarthiApprovePlanV303()">✓ Approve & Integrate</button></div>
            <div id="s303PlanSummary" class="s303PlanPreview s303Status">No AI plan extracted yet.</div>
            <div id="s303ExtractedTasks" class="s303TaskPreview"></div>
          </div>
        </div>
      </div>

      <div class="s303Panel" data-panel="targets">
        <div class="card s303Card">
          <div class="s303CardHead"><div><h2>Add Weekly Target</h2><p class="sub">Manually add any study, revision, answer-writing or test target.</p></div><span class="pill green">Interlinked</span></div>
          <div class="s303FormGrid three">
            <label class="s303Full"><span>Target</span><input id="s303TaskTitle" placeholder="Finish Fundamental Rights + solve PYQs"></label>
            <label><span>Subject</span><select id="s303TaskSubject"><option>Polity</option><option>History</option><option>Geography</option><option>Economy</option><option>Environment</option><option>Science & Tech</option><option>Ethics</option><option>Essay</option><option>Current Affairs</option><option>CSAT</option><option>Optional</option><option>General</option></select></label>
            <label><span>Type</span><select id="s303TaskType"><option>Study / Notes</option><option>Revision</option><option>Mains Answer</option><option>Prelims</option><option>Current Affairs</option><option>Test</option><option>Mentor Task</option></select></label>
            <label><span>Due date</span><input id="s303TaskDate" type="date"></label>
            <label><span>Priority</span><select id="s303TaskPriority"><option>High</option><option selected>Medium</option><option>Low</option></select></label>
            <label><span>Frequency</span><select id="s303TaskFrequency"><option>One-time</option><option>Daily</option><option>Weekly</option></select></label>
            <label><span>Initial status</span><select id="s303TaskStatus"><option>Assigned</option><option>In Progress</option><option>Done</option><option>Backlog</option></select></label>
          </div>
          <div class="s303Actions"><button class="btn green" onclick="saarthiAddTaskV303()">Add & Integrate</button><button class="btn ghost" onclick="saarthiCreateDailyMainsWeekV303()">Create 7 Daily Mains Tasks</button></div>
        </div>
        <div id="s303Board" class="s303Board" style="margin-top:18px"></div>
      </div>

      <div class="s303Panel" data-panel="daily">
        <div class="s303Grid2">
          <div class="card s303Card">
            <div class="s303CardHead"><div><h2>Daily Accountability Sheet</h2><p class="sub">Based on the program’s daily accountability and productivity workflow.</p></div><span class="pill gold">Daily</span></div>
            <div class="s303FormGrid three">
              <label><span>Date</span><input id="s303DailyDate" type="date"></label>
              <label><span>Focused study hours</span><input id="s303DailyHours" type="number" min="0" max="18" step="0.25" value="0"></label>
              <label><span>MCQs attempted</span><input id="s303DailyMcq" type="number" min="0" value="0"></label>
              <label><span>Mains answers written</span><input id="s303DailyMains" type="number" min="0" value="0"></label>
              <label><span>Revision minutes</span><input id="s303DailyRevision" type="number" min="0" value="0"></label>
              <label><span>Mood</span><select id="s303DailyMood"><option>Excellent</option><option>Good</option><option selected>Okay</option><option>Low</option><option>Stressed</option></select></label>
            </div>
            <div class="s303AccountRow" style="margin-top:14px"><label class="s303Check"><input id="s303DailyCA" type="checkbox"> Current Affairs</label><label class="s303Check"><input id="s303DailyPYQ" type="checkbox"> PYQ Practice</label><label class="s303Check"><input id="s303DailyOneLiner" type="checkbox"> Active Recall</label><label class="s303Check"><input id="s303DailyWater" type="checkbox"> Water target</label><label class="s303Check"><input id="s303DailyPlan" type="checkbox"> Followed plan</label><label class="s303Check"><input id="s303DailyTest" type="checkbox"> Test/quiz done</label></div>
            <label style="margin-top:14px"><span>What worked / what was missed</span><textarea id="s303DailyNotes" placeholder="Short review of the day"></textarea></label>
            <div style="margin-top:13px"><b>Rate your day</b><div id="s303Rating" class="s303Rating" style="margin-top:8px"></div></div>
            <div class="s303Actions"><button class="btn green" onclick="saarthiSaveDailyV303()">Save Daily Sheet</button><button class="btn ghost" onclick="saarthiLoadTodayV303()">Load Today</button></div>
          </div>
          <div class="card s303Card"><div class="s303CardHead"><div><h2>Recent Accountability</h2><p class="sub">Your latest seven entries and answer-writing consistency.</p></div></div><div id="s303DailyHistory" class="s303List"></div></div>
        </div>
      </div>

      <div class="s303Panel" data-panel="tests">
        <div class="s303Grid2">
          <div class="card s303Card">
            <div class="s303CardHead"><div><h2>Add Daily / Weekly Test</h2><p class="sub">Track mentor tests, daily answer sessions, sectional mocks and evaluated scores.</p></div><span class="pill blue">Test series</span></div>
            <div class="s303FormGrid three">
              <label class="s303Full"><span>Test title</span><input id="s303TestTitle" placeholder="Polity Test 1 / Daily GS2 Answer"></label>
              <label><span>Date</span><input id="s303TestDate" type="date"></label>
              <label><span>Stage</span><select id="s303TestStage"><option>Prelims</option><option>Mains</option><option>Essay</option><option>CSAT</option><option>Daily Answer</option></select></label>
              <label><span>Paper / subject</span><input id="s303TestSubject" placeholder="GS2 • Polity"></label>
              <label><span>Frequency</span><select id="s303TestFrequency"><option>Daily</option><option selected>Weekly</option><option>Sectional</option><option>Full Length</option></select></label>
              <label><span>Status</span><select id="s303TestStatus"><option>Scheduled</option><option>Attempted</option><option>Evaluated</option><option>Missed</option></select></label>
              <label><span>Score</span><input id="s303TestScore" type="number" min="0" placeholder="Optional"></label>
              <label><span>Maximum</span><input id="s303TestMax" type="number" min="0" placeholder="Optional"></label>
              <label><span>Main gap</span><select id="s303TestGap"><option>Not analysed</option><option>Interpretation / Silly Mistake</option><option>Awareness Gap</option><option>Conceptual Gap</option><option>Revision Gap</option><option>Factual Gap</option><option>Guesswork / Intuition</option><option>Time Management</option><option>Wrong Reading / Printing Error</option><option>Answer Structure</option><option>Examples / Value Addition</option></select></label>
              <label class="s303Full"><span>Mentor remarks / improvement</span><textarea id="s303TestRemarks" placeholder="Feedback and repair task"></textarea></label>
            </div>
            <div class="s303Actions"><button class="btn green" onclick="saarthiAddTestV303()">Save Test</button><button class="btn gold" onclick="saarthiImportNityaScheduleV303()">Import Nitya Pragati Calendar</button></div>
            <div class="s303Alert">The brochure contains a few year/order inconsistencies. Imported dates are normalised by the published phase sequence; confirm final dates on the mentor portal.</div>
          </div>
          <div class="card s303Card"><div class="s303CardHead"><div><h2>Test Actions</h2><p class="sub">Open the right JARVIS workspace for practice and evaluation.</p></div></div><div class="s303Actions"><button class="btn blue" onclick="show('prelimsTestCentreV291')">Open Prelims Centre</button><button class="btn purple" onclick="show('mainsAnswerCentreV291')">Open Mains Centre</button><button class="btn ghost" onclick="show('chatgptPromptHubV302')">Strict ChatGPT Evaluator</button><button class="btn green" onclick="show('aiCalendarV4')">Open Calendar</button></div><div id="s303TestSummary" class="s303Status">No test summary yet.</div></div>
        </div>
        <div class="card s303Card" style="margin-top:18px"><div class="s303CardHead"><div><h2>Mentorship Test Calendar</h2><p class="sub">Upcoming and completed daily, weekly, sectional and full-length tests.</p></div></div><div id="s303TestsList" class="s303List"></div></div>
      </div>

      <div class="s303Panel" data-panel="materials">
        <div class="s303Grid2">
          <div class="card s303Card">
            <div class="s303CardHead"><div><h2>Mentor Notes & Material Vault</h2><p class="sub">Store class notes, one-pagers, test papers, PYQ workbooks and mentor documents.</p></div><span class="pill green">Library linked</span></div>
            <div class="s303FormGrid">
              <label class="s303Full"><span>Title</span><input id="s303MaterialTitle" placeholder="Polity Week 1 Notes"></label>
              <label><span>Subject</span><select id="s303MaterialSubject"><option>Polity</option><option>History</option><option>Geography</option><option>Economy</option><option>Environment</option><option>Science & Tech</option><option>Ethics</option><option>Essay</option><option>Current Affairs</option><option>CSAT</option><option>Optional</option><option>General</option></select></label>
              <label><span>Material type</span><select id="s303MaterialType"><option>Class Notes</option><option>One Pager</option><option>Test Paper</option><option>Evaluation</option><option>PYQ Workbook</option><option>NCERT / Book</option><option>Mentor Plan</option><option>Other</option></select></label>
              <label class="s303Full"><span>Choose file</span><input id="s303MaterialFile" type="file" accept=".pdf,.txt,.md,.doc,.docx,.png,.jpg,.jpeg"></label>
              <label class="s303Full"><span>Description</span><textarea id="s303MaterialDescription" placeholder="What this material covers and when to revise it"></textarea></label>
            </div>
            <div class="s303Actions"><button class="btn green" onclick="saarthiSaveMaterialV303()">Upload & Save</button><button class="btn blue" onclick="show('aiPdfAnalyzer')">Open AI PDF Analyzer</button><button class="btn ghost" onclick="show('libraryShelf')">Open Digital Library</button></div>
            <div id="s303MaterialStatus" class="s303Status">Google sign-in is recommended for large PDF storage and cross-device access.</div>
          </div>
          <div class="card s303Card"><div class="s303CardHead"><div><h2>Saved Mentorship Materials</h2><p class="sub">Open, analyse or remove mentor resources.</p></div></div><div id="s303MaterialsList" class="s303List"></div></div>
        </div>
      </div>

      <div class="s303Panel" data-panel="sessions">
        <div class="s303Grid2">
          <div class="card s303Card">
            <div class="s303CardHead"><div><h2>1:1 Mentor Session Notes</h2><p class="sub">Capture advice, preparation audit, weak areas, next targets and meeting date.</p></div><span class="pill gold">Weekly</span></div>
            <div class="s303FormGrid">
              <label><span>Session date</span><input id="s303SessionDate" type="date"></label>
              <label><span>Mentor name</span><input id="s303SessionMentor" placeholder="Mentor name"></label>
              <label class="s303Full"><span>Preparation audit / discussion</span><textarea id="s303SessionAudit" placeholder="What was reviewed"></textarea></label>
              <label class="s303Full"><span>Advice and action points</span><textarea id="s303SessionAdvice" placeholder="Mentor advice and assigned targets"></textarea></label>
              <label class="s303Full"><span>Weak areas / conceptual gaps</span><textarea id="s303SessionWeak" placeholder="Weak areas identified"></textarea></label>
              <label><span>Next meeting</span><input id="s303NextMeeting" type="datetime-local"></label>
              <label><span>Session number</span><input id="s303SessionNo" type="number" min="1" value="1"></label>
            </div>
            <div class="s303Actions"><button class="btn green" onclick="saarthiSaveSessionV303()">Save Session</button><button class="btn purple" onclick="saarthiSessionToPlanV303()">AI Convert Advice to Plan</button></div>
          </div>
          <div class="card s303Card">
            <div class="s303CardHead"><div><h2>Doubt Bank</h2><p class="sub">Keep doubts ready for the next mentorship call.</p></div></div>
            <div class="s303FormGrid"><label class="s303Full"><span>Doubt / question</span><input id="s303DoubtText" placeholder="Ask mentor about..." ></label><label><span>Subject</span><input id="s303DoubtSubject" placeholder="Polity"></label><label><span>Route</span><select id="s303DoubtRoute"><option>Ask Mentor</option><option>Ask Jarvis</option><option>Discuss in Test Review</option></select></label></div>
            <div class="s303Actions"><button class="btn blue" onclick="saarthiAddDoubtV303()">Add Doubt</button><button class="btn ghost" onclick="saarthiAskJarvisDoubtV303()">Ask Jarvis Now</button></div>
            <div id="s303DoubtsList" class="s303List" style="margin-top:14px"></div>
          </div>
        </div>
        <div class="card s303Card" style="margin-top:18px"><div class="s303CardHead"><div><h2>Mentor Advice Timeline</h2><p class="sub">Date-wise history of sessions, targets and next meetings.</p></div></div><div id="s303SessionsList" class="s303List"></div></div>
      </div>

      <div class="s303Panel" data-panel="report">
        <div class="s303Grid2">
          <div class="card s303Card"><div class="s303CardHead"><div><h2>Weekly Progress Report</h2><p class="sub">Generate a mentor-ready report with target completion, tests, consistency, weak areas and doubts.</p></div><span class="pill blue">Printable</span></div><div class="s303FormGrid"><label><span>Week starts</span><input id="s303ReportStart" type="date"></label><label><span>Week ends</span><input id="s303ReportEnd" type="date"></label></div><div class="s303Actions"><button class="btn green" onclick="saarthiGenerateReportV303(false)">Generate Report</button><button class="btn purple" onclick="saarthiGenerateReportV303(true)">Improve with AI</button><button class="btn blue" onclick="saarthiPrintReportV303()">PDF / Print</button><button class="btn ghost" onclick="saarthiDownloadReportV303()">Download TXT</button></div></div>
          <div class="card s303Card"><div class="s303CardHead"><div><h2>Next Meeting Preparation</h2><p class="sub">A concise agenda: completed, missed, repeated gaps, test results and questions to ask.</p></div></div><div class="s303Actions"><button class="btn purple" onclick="saarthiGenerateMeetingBriefV303()">Generate AI Meeting Brief</button><button class="btn green" onclick="saarthiSaveMeetingBriefV303()">Save as Note</button></div><div id="s303MeetingBrief" class="s303Status">Generate a brief after recording your weekly work.</div></div>
        </div>
        <div class="card s303Card" style="margin-top:18px"><div id="s303ReportOutput" class="s303Report"><div class="s303Empty">Choose a week and generate the report.</div></div></div>
      </div>
    </section>`;
  }
  function ensureSection(){
    if($('saarthiMentorHubV303'))return;
    const main=document.querySelector('main');if(!main)return;
    const wrap=document.createElement('div');wrap.innerHTML=sectionHtml().trim();
    const sec=wrap.firstElementChild;
    const app=$('appOfflineV284');if(app)main.insertBefore(sec,app);else main.appendChild(sec);
  }
  function ensureDashboardWidget(){
    const dash=$('dashboard');if(!dash||$('s303DashWidget'))return;
    const w=document.createElement('div');w.id='s303DashWidget';w.className='card s303DashWidget';
    w.innerHTML='<div class="s303CardHead"><div><h2>🧑‍🏫 Saarthi Mentor Mission</h2><p class="sub">Today’s mentorship targets and next test.</p></div><button class="btn blue" onclick="show(\'saarthiMentorHubV303\')">Open Hub</button></div><div id="s303DashTasks" class="s303DashTasks"></div>';
    const stats=dash.querySelector('.grid');if(stats)stats.insertAdjacentElement('afterend',w);else dash.appendChild(w);
  }
  window.saarthiTabV303=function(name,btn){
    document.querySelectorAll('#saarthiMentorHubV303 .s303Panel').forEach(x=>x.classList.toggle('active',x.dataset.panel===name));
    document.querySelectorAll('#saarthiMentorHubV303 .s303Tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===name));
    if(btn)btn.classList.add('active');
    if(name==='report'&&!val('s303ReportStart')){ $('s303ReportStart').value=mondayOf();$('s303ReportEnd').value=endOfWeek(); }
    renderAllMentorV303();
    $('saarthiMentorHubV303')?.scrollIntoView({behavior:'smooth',block:'start'});
  };

  async function readPdf(file){
    const pdfjs=await new Promise((resolve,reject)=>{
      if(window.pdfjsLib)return resolve(window.pdfjsLib);
      const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
      s.onload=()=>{try{window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js'}catch(e){}resolve(window.pdfjsLib)};
      s.onerror=()=>reject(new Error('PDF reader could not load. Check internet once, or paste the plan text.'));document.head.appendChild(s);
    });
    const data=await file.arrayBuffer(),pdf=await pdfjs.getDocument({data}).promise;let text='';const max=Math.min(pdf.numPages,50);
    for(let i=1;i<=max;i++){setStatus('s303PlanStatus',`Reading PDF page ${i}/${max}…`);const p=await pdf.getPage(i);const c=await p.getTextContent();text+=`\n--- Page ${i} ---\n${c.items.map(x=>x.str).join(' ')}`;}
    return text.trim();
  }
  window.saarthiReadPlanFileV303=async function(){
    const f=$('s303PlanFile')?.files?.[0];if(!f)return toast('Choose a PDF or text file first.');
    try{let text;if(/pdf/i.test(f.type)||/\.pdf$/i.test(f.name))text=await readPdf(f);else text=await f.text();$('s303PlanText').value=text;setStatus('s303PlanStatus',`✅ Read ${text.length.toLocaleString()} characters from ${esc(f.name)}.`,'s303Good');}catch(e){setStatus('s303PlanStatus',`⚠ ${esc(e.message)}`,'s303Danger')}
  };
  function planPrompt(){
    const start=val('s303WeekStart')||mondayOf(),end=val('s303WeekEnd')||endOfWeek(start),raw=val('s303PlanText');
    return `You are the planning engine for a UPSC 1:1 mentorship dashboard. Convert the mentor instruction into a realistic weekly plan from ${start} to ${end}. Return ONLY valid JSON, without markdown or commentary.\n\nSchema:\n{"summary":"short summary","mentorMessage":"one practical sentence","tasks":[{"title":"actionable target","subject":"Polity/History/Geography/Economy/Environment/Science & Tech/Ethics/Essay/Current Affairs/CSAT/Optional/General","type":"Study / Notes|Revision|Mains Answer|Prelims|Current Affairs|Test|Mentor Task","dueDate":"YYYY-MM-DD","frequency":"One-time|Daily|Weekly","priority":"High|Medium|Low","details":"specific chapter/question/resource","integrations":["calendar","revision","notes","mains","prelims"]}]}\n\nRules:\n- Break broad targets into manageable actions.\n- Daily mains answer instructions must create one task per date.\n- Daily MCQ instructions must create one task per date.\n- Keep dates inside the selected week unless an explicit test date is given.\n- Include revision and test-analysis tasks when mentioned.\n- Do not invent books, questions, marks or deadlines.\n- Maximum 25 tasks.\n\nMENTOR INSTRUCTION:\n${raw.slice(0,24000)}`;
  }
  window.saarthiExtractPlanV303=async function(){
    const raw=val('s303PlanText');if(!raw)return toast('Paste or upload the mentor plan first.');
    setStatus('s303PlanStatus',`🤖 ${modeLabel()} is segregating the plan…`);
    $('s303PlanSummary').textContent='Analysing mentor instructions…';$('s303ExtractedTasks').innerHTML='';
    try{
      const res=await askAI(planPrompt());
      let parsed;try{parsed=JSON.parse(cleanJson(res));}catch(e){$('s303PlanSummary').textContent=String(res);setStatus('s303PlanStatus','AI returned text instead of structured JSON. Copy it to ChatGPT Prompt Hub or try Gemini/Hybrid.','s303Danger');return;}
      parsed.tasks=Array.isArray(parsed.tasks)?parsed.tasks.slice(0,25):[];pendingPlan={...parsed,raw,weekStart:val('s303WeekStart'),weekEnd:val('s303WeekEnd'),mentor:val('s303MentorName')};
      $('s303PlanSummary').innerHTML=`<b>${esc(parsed.summary||'Mentor plan extracted')}</b><br>${esc(parsed.mentorMessage||'Review the tasks before approving.')}`;
      $('s303ExtractedTasks').innerHTML=parsed.tasks.length?parsed.tasks.map((t,i)=>`<div class="s303TaskRow"><div><b>${i+1}. ${esc(t.title)}</b><div class="s303TaskMeta"><span class="s303MiniPill">${esc(t.subject||'General')}</span><span class="s303MiniPill green">${esc(normalizedType(t.type))}</span><span class="s303MiniPill gold">${esc(t.dueDate||'No date')}</span><span class="s303MiniPill ${String(t.priority).toLowerCase()==='high'?'red':''}">${esc(t.priority||'Medium')}</span></div><small>${esc(t.details||'')}</small></div></div>`).join(''):'<div class="s303Empty">No actionable tasks detected.</div>';
      setStatus('s303PlanStatus',`✅ Extracted ${parsed.tasks.length} tasks. Review and approve.`,'s303Good');
    }catch(e){setStatus('s303PlanStatus',`⚠ Plan extraction failed: ${esc(e.message)}`,'s303Danger');$('s303PlanSummary').textContent=e.message;}
  };
  async function integrateTask(task,source='Saarthi Mentor'){
    const item={id:uid(),title:task.title||'Mentor target',subject:task.subject||'General',type:normalizedType(task.type),dueDate:task.dueDate||today(),frequency:task.frequency||'One-time',priority:task.priority||'Medium',status:task.status||'Assigned',details:task.details||'',source,weekStart:task.weekStart||mondayOf(task.dueDate||today()),createdAt:Date.now()};
    await saveCol('saarathiTasks',item);
    await saveCol('calendarItems',{date:item.dueDate,title:`Saarthi: ${item.title}`,type:item.type,subject:item.subject,body:item.details,source:'Saarthi Mentorship Hub'});
    if(item.type==='Revision')await saveCol('smartRevision',{topic:item.title,subject:item.subject,source:'Saarthi Mentor',difficulty:item.priority==='High'?'Hard':'Medium',date:item.dueDate,cycle:1,status:'pending',body:item.details});
    return item;
  }
  window.saarthiApprovePlanV303=async function(){
    if(!pendingPlan?.tasks?.length)return toast('Extract a mentor plan first.');
    setStatus('s303PlanStatus','Integrating tasks with JARVIS sections…');
    await saveCol('saarathiPlans',{title:`Mentor Plan ${pendingPlan.weekStart||today()}`,mentor:pendingPlan.mentor||'Mentor',weekStart:pendingPlan.weekStart||mondayOf(),weekEnd:pendingPlan.weekEnd||endOfWeek(),summary:pendingPlan.summary||'',raw:pendingPlan.raw,taskCount:pendingPlan.tasks.length,status:'Active'});
    for(const t of pendingPlan.tasks)await integrateTask({...t,weekStart:pendingPlan.weekStart});
    setStatus('s303PlanStatus',`✅ ${pendingPlan.tasks.length} targets integrated with Saarthi Board, Smart Calendar and relevant revision workflows.`,'s303Good');pendingPlan=null;await renderAllMentorV303();
  };
  window.saarthiSaveRawPlanV303=async function(){
    const raw=val('s303PlanText');if(!raw)return toast('Add mentor instructions first.');
    await saveCol('saarathiPlans',{title:`Raw Mentor Plan ${val('s303WeekStart')||today()}`,mentor:val('s303MentorName')||'Mentor',weekStart:val('s303WeekStart')||mondayOf(),weekEnd:val('s303WeekEnd')||endOfWeek(),raw,summary:'Saved without AI extraction',status:'Inbox'});toast('Raw mentor plan saved.');
  };

  window.saarthiAddTaskV303=async function(){
    const title=val('s303TaskTitle');if(!title)return toast('Enter a target.');
    await integrateTask({title,subject:val('s303TaskSubject'),type:val('s303TaskType'),dueDate:val('s303TaskDate')||today(),priority:val('s303TaskPriority'),frequency:val('s303TaskFrequency'),status:val('s303TaskStatus'),details:'Manual mentor target'});
    $('s303TaskTitle').value='';await renderAllMentorV303();
  };
  window.saarthiCreateDailyMainsWeekV303=async function(){
    const start=val('s303TaskDate')||mondayOf();const subject=val('s303TaskSubject')||'General';
    if(!confirm(`Create one Mains answer task daily from ${fmtDate(start)} for 7 days?`))return;
    for(let i=0;i<7;i++)await integrateTask({title:`Write one ${subject} Mains answer`,subject,type:'Mains Answer',dueDate:addDays(start,i),priority:'High',frequency:'Daily',details:'Daily answer-writing target assigned through mentorship.'});
    await renderAllMentorV303();
  };
  window.saarthiTaskStatusV303=async function(id,status){const all=await getCol('saarathiTasks'),item=all.find(x=>String(x.id||x._docId)===String(id));if(item){await replaceItem('saarathiTasks',item,{status});await renderAllMentorV303();}};
  window.saarthiDeleteV303=removeItem;

  function renderRating(){const box=$('s303Rating');if(!box)return;box.innerHTML=[1,2,3,4,5].map(n=>`<button type="button" class="${n===accountRating?'active':''}" onclick="saarthiSetRatingV303(${n})">${'★'.repeat(n)}</button>`).join('')}
  window.saarthiSetRatingV303=n=>{accountRating=n;renderRating()};
  window.saarthiSaveDailyV303=async function(){
    const date=val('s303DailyDate')||today();const existing=(await getCol('saarathiDaily')).find(x=>x.date===date);
    const item={id:existing?.id||uid(),date,hours:Number(val('s303DailyHours')||0),mcqs:Number(val('s303DailyMcq')||0),mains:Number(val('s303DailyMains')||0),revision:Number(val('s303DailyRevision')||0),mood:val('s303DailyMood'),ca:checked('s303DailyCA'),pyq:checked('s303DailyPYQ'),recall:checked('s303DailyOneLiner'),water:checked('s303DailyWater'),followedPlan:checked('s303DailyPlan'),testDone:checked('s303DailyTest'),notes:val('s303DailyNotes'),rating:accountRating};
    if(existing)await replaceItem('saarathiDaily',existing,item);else await saveCol('saarathiDaily',item);toast('Daily accountability saved.');await renderAllMentorV303();
  };
  window.saarthiLoadTodayV303=async function(){
    const d=val('s303DailyDate')||today(),x=(await getCol('saarathiDaily')).find(i=>i.date===d);if(!x)return toast('No entry saved for this date.');
    $('s303DailyHours').value=x.hours||0;$('s303DailyMcq').value=x.mcqs||0;$('s303DailyMains').value=x.mains||0;$('s303DailyRevision').value=x.revision||0;$('s303DailyMood').value=x.mood||'Okay';$('s303DailyCA').checked=!!x.ca;$('s303DailyPYQ').checked=!!x.pyq;$('s303DailyOneLiner').checked=!!x.recall;$('s303DailyWater').checked=!!x.water;$('s303DailyPlan').checked=!!x.followedPlan;$('s303DailyTest').checked=!!x.testDone;$('s303DailyNotes').value=x.notes||'';accountRating=x.rating||3;renderRating();
  };

  const schedule=[
    ['2026-07-03','Prelims','Polity Test 1','Polity','Sectional'],['2026-07-17','Prelims','Polity Test 2','Polity','Sectional'],['2026-07-31','Prelims','Geography Test 1','Geography','Sectional'],['2026-08-14','Prelims','Geography Test 2','Geography','Sectional'],['2026-08-28','Prelims','Economics Test 1','Economy','Sectional'],['2026-09-11','Prelims','Economics Test 2','Economy','Sectional'],['2026-09-25','Prelims','Modern History Test 1','History','Sectional'],['2026-10-09','Prelims','Modern History Test 2','History','Sectional'],['2026-10-23','Prelims','Ancient, Medieval & Art and Culture Test 1','History','Sectional'],['2026-11-06','Prelims','Ancient, Medieval & Art and Culture Test 2','History','Sectional'],['2026-11-20','Prelims','Environment & Ecology Test 1','Environment','Sectional'],['2026-12-04','Prelims','Environment & Ecology Test 2','Environment','Sectional'],['2026-12-18','Prelims','Science & Technology Test 1','Science & Tech','Sectional'],['2027-01-08','Prelims','Science & Technology Test 2','Science & Tech','Sectional'],['2027-01-22','Prelims','International Relations Test 1','International Relations','Sectional'],['2027-02-05','Prelims','International Relations Test 2','International Relations','Sectional'],['2027-02-19','Prelims','Full Length Test 1','General','Full Length'],['2027-03-05','Prelims','Full Length Test 2','General','Full Length'],['2027-03-19','Prelims','Full Length Test 3','General','Full Length'],['2027-04-02','Prelims','Full Length Test 4','General','Full Length'],
    ['2026-07-12','Mains','GS2 Polity & Constitution','GS2 • Polity','Sectional'],['2026-08-05','Mains','GS1 Geography','GS1 • Geography','Sectional'],['2026-08-23','Mains','GS3 Economy','GS3 • Economy','Sectional'],['2026-09-13','Mains','GS1 Art and Culture','GS1 • Art & Culture','Sectional'],['2026-10-04','Mains','GS1 Modern History & World History','GS1 • History','Sectional'],['2026-10-20','Mains','GS2 Polity & Constitution','GS2 • Polity','Sectional'],['2026-11-04','Mains','GS1 Geography','GS1 • Geography','Sectional'],['2026-11-20','Mains','GS3 Economy','GS3 • Economy','Sectional'],['2026-12-03','Mains','GS1 Art and Culture','GS1 • Art & Culture','Sectional'],['2026-12-19','Mains','GS1 Modern History & World History','GS1 • History','Sectional'],['2027-01-03','Mains','GS4 Ethics Section A — Chapters 1, 2, 3','GS4 • Ethics','Sectional'],['2027-01-14','Mains','GS4 Ethics Section A — Chapters 4, 6, 7','GS4 • Ethics','Sectional'],['2027-01-21','Mains','GS4 Case Studies','GS4 • Ethics','Sectional'],['2027-02-03','Mains','GS2 Governance & Social Justice','GS2 • Governance','Sectional'],['2027-02-19','Mains','GS3 Science, Technology & Internal Security','GS3','Sectional'],['2027-03-02','Mains','Society & International Relations','GS1 & GS2','Sectional'],['2027-03-15','Mains','Environment, Disaster Management & Agriculture','GS3','Sectional'],['2027-06-14','Mains','Full Length Test 1','GS1','Full Length'],['2027-06-16','Mains','Full Length Test 2','GS2','Full Length'],['2027-06-23','Mains','Full Length Test 3','GS3','Full Length'],['2027-06-30','Mains','Full Length Test 4','GS4','Full Length'],['2027-07-10','Mains','Full Length Test 5','GS1','Full Length'],['2027-07-17','Mains','Full Length Test 6','GS2','Full Length'],['2027-07-24','Mains','Full Length Test 7','GS3','Full Length'],['2027-07-31','Mains','Full Length Test 8','GS4','Full Length']
  ];
  window.saarthiAddTestV303=async function(){
    const title=val('s303TestTitle');if(!title)return toast('Enter the test title.');const date=val('s303TestDate')||today();
    await saveCol('saarathiTests',{id:uid(),title,date,stage:val('s303TestStage'),subject:val('s303TestSubject'),frequency:val('s303TestFrequency'),status:val('s303TestStatus'),score:val('s303TestScore'),max:val('s303TestMax'),gap:val('s303TestGap'),remarks:val('s303TestRemarks'),source:'Manual / Mentor'});
    await saveCol('calendarItems',{date,title:`Saarthi Test: ${title}`,type:`${val('s303TestStage')} Test`,subject:val('s303TestSubject'),body:val('s303TestRemarks'),source:'Saarthi Mentorship Hub'});$('s303TestTitle').value='';await renderAllMentorV303();
  };
  window.saarthiImportNityaScheduleV303=async function(){
    const existing=await getCol('saarathiTests');let count=0;
    for(const [date,stage,title,subject,frequency] of schedule){const scheduleId=`nitya_${date}_${title}`.replace(/\W+/g,'_');if(existing.some(x=>x.scheduleId===scheduleId))continue;await saveCol('saarathiTests',{id:uid(),scheduleId,date,stage,title,subject,frequency,status:'Scheduled',source:'Nitya Pragati Batch 5 brochure',remarks:'Confirm final date on mentor portal.'});await saveCol('calendarItems',{date,title:`Nitya Pragati: ${title}`,type:`${stage} Test`,subject,source:'Saarthi Mentorship Hub'});count++;}
    toast(count?`${count} scheduled tests imported and added to Smart Calendar.`:'Schedule was already imported.');await renderAllMentorV303();
  };
  window.saarthiTestStatusV303=async function(id,status){const all=await getCol('saarathiTests'),item=all.find(x=>String(x.id||x._docId)===String(id));if(item){await replaceItem('saarathiTests',item,{status});await renderAllMentorV303();}};

  window.saarthiSaveMaterialV303=async function(){
    const f=$('s303MaterialFile')?.files?.[0],title=val('s303MaterialTitle')||(f?.name||'Mentor Material');if(!f)return toast('Choose a file.');
    setStatus('s303MaterialStatus','Uploading material…');
    try{
      const uploaded=typeof window.uploadFileToFirebase==='function'?await window.uploadFileToFirebase(f,'saarathi-materials'):{url:'',localOnly:true};
      if(uploaded.localOnly&&f.size>900000)uploaded.url='';
      const item={id:uid(),title,subject:val('s303MaterialSubject'),type:val('s303MaterialType'),description:val('s303MaterialDescription'),filename:f.name,mime:f.type,size:f.size,url:uploaded.url||'',storagePath:uploaded.storagePath||'',localOnly:!!uploaded.localOnly,date:today(),source:'Saarthi Mentorship Hub'};
      await saveCol('saarathiMaterials',item);await saveCol('digitalLibrary',{title:item.title,subject:item.subject,type:item.type,url:item.url,storagePath:item.storagePath,description:item.description,date:item.date,source:'Saarthi Mentorship Hub'});
      setStatus('s303MaterialStatus',uploaded.localOnly&&f.size>900000?'✅ Material metadata saved. Sign in with Google and upload again for the large file itself.':'✅ Material saved and linked to Digital Library.','s303Good');$('s303MaterialTitle').value='';$('s303MaterialDescription').value='';$('s303MaterialFile').value='';await renderAllMentorV303();
    }catch(e){setStatus('s303MaterialStatus',`⚠ Upload failed: ${esc(e.message)}`,'s303Danger')}
  };
  window.saarthiOpenMaterialV303=async function(id){const x=(await getCol('saarathiMaterials')).find(i=>String(i.id||i._docId)===String(id));if(!x)return;if(x.url)window.open(x.url,'_blank','noopener');else toast('This file has no openable URL. Sign in and upload again for cloud access.');};

  window.saarthiSaveSessionV303=async function(){
    const date=val('s303SessionDate')||today(),advice=val('s303SessionAdvice');if(!advice&&!val('s303SessionAudit'))return toast('Add the session discussion or advice.');
    await saveCol('saarathiSessions',{id:uid(),date,mentor:val('s303SessionMentor')||'Mentor',sessionNo:val('s303SessionNo'),audit:val('s303SessionAudit'),advice,weak:val('s303SessionWeak'),nextMeeting:val('s303NextMeeting'),source:'1:1 Mentorship'});
    await saveCol('mentorAdvice',{mode:'Saarthi 1:1',question:val('s303SessionAudit'),body:advice,date,source:'Saarthi Mentorship Hub'});
    if(val('s303NextMeeting'))await saveCol('calendarItems',{date:val('s303NextMeeting').slice(0,10),time:val('s303NextMeeting').slice(11,16),title:'Saarthi Mentor Meeting',type:'Mentorship',body:'Prepare weekly progress report and doubts.'});toast('Mentor session saved.');await renderAllMentorV303();
  };
  window.saarthiSessionToPlanV303=function(){const text=[val('s303SessionAudit'),val('s303SessionAdvice'),val('s303SessionWeak')].filter(Boolean).join('\n\n');if(!text)return toast('Add session advice first.');$('s303PlanText').value=text;$('s303MentorName').value=val('s303SessionMentor');window.saarthiTabV303('plan');};
  window.saarthiAddDoubtV303=async function(){const text=val('s303DoubtText');if(!text)return toast('Enter a doubt.');await saveCol('saarathiDoubts',{id:uid(),text,subject:val('s303DoubtSubject')||'General',route:val('s303DoubtRoute'),status:'Open',date:today()});$('s303DoubtText').value='';await renderAllMentorV303();};
  window.saarthiResolveDoubtV303=async function(id){const all=await getCol('saarathiDoubts'),item=all.find(x=>String(x.id||x._docId)===String(id));if(item){await replaceItem('saarathiDoubts',item,{status:'Resolved'});await renderAllMentorV303();}};
  window.saarthiAskJarvisDoubtV303=function(){const q=val('s303DoubtText');if(!q)return toast('Enter a doubt first.');if(typeof window.openJarvisV2811==='function')window.openJarvisV2811();setTimeout(()=>{const e=$('jarvisCommandInputV281')||$('jarvisInputV281');if(e)e.value=`Explain this UPSC doubt: ${q}`;},250)};

  async function weeklyData(start,end){
    const [tasks,daily,tests,sessions,doubts]=await Promise.all(['saarathiTasks','saarathiDaily','saarathiTests','saarathiSessions','saarathiDoubts'].map(getCol));
    return {tasks:tasks.filter(x=>isBetween(x.dueDate,start,end)),daily:daily.filter(x=>isBetween(x.date,start,end)),tests:tests.filter(x=>isBetween(x.date,start,end)),sessions:sessions.filter(x=>isBetween(x.date,start,end)),doubts:doubts.filter(x=>x.status!=='Resolved')};
  }
  function reportHtml(data,start,end){
    const done=data.tasks.filter(x=>x.status==='Done').length,total=data.tasks.length,completion=total?Math.round(done/total*100):0;const hours=data.daily.reduce((a,x)=>a+Number(x.hours||0),0),mains=data.daily.reduce((a,x)=>a+Number(x.mains||0),0),mcqs=data.daily.reduce((a,x)=>a+Number(x.mcqs||0),0),revision=data.daily.reduce((a,x)=>a+Number(x.revision||0),0);const avg=data.daily.length?(data.daily.reduce((a,x)=>a+Number(x.rating||0),0)/data.daily.length).toFixed(1):'—';
    const missed=data.tasks.filter(x=>x.status!=='Done').map(x=>x.title).slice(0,8);const gaps=[...new Set(data.tests.map(x=>x.gap).filter(x=>x&&x!=='Not analysed'))];
    return `<h2>Saarthi Weekly Progress Report</h2><p><b>Week:</b> ${fmtDate(start)} – ${fmtDate(end)}</p><table><tr><th>Target completion</th><td>${done}/${total} (${completion}%)</td><th>Study hours</th><td>${hours.toFixed(1)}</td></tr><tr><th>Mains answers</th><td>${mains}</td><th>MCQs attempted</th><td>${mcqs}</td></tr><tr><th>Revision</th><td>${revision} minutes</td><th>Average day rating</th><td>${avg}/5</td></tr></table><h3>Completed Targets</h3><ul>${data.tasks.filter(x=>x.status==='Done').map(x=>`<li>${esc(x.title)} — ${esc(x.subject)}</li>`).join('')||'<li>No completed targets recorded.</li>'}</ul><h3>Pending / Missed Targets</h3><ul>${missed.map(x=>`<li>${esc(x)}</li>`).join('')||'<li>None recorded.</li>'}</ul><h3>Tests and Performance</h3><ul>${data.tests.map(x=>`<li>${fmtDate(x.date)} — ${esc(x.title)} (${esc(x.status)})${x.score?` — ${esc(x.score)}/${esc(x.max||'')}`:''}</li>`).join('')||'<li>No tests recorded.</li>'}</ul><h3>Repeated Gaps</h3><p>${gaps.map(esc).join(', ')||'No analysed gaps recorded.'}</p><h3>Open Doubts for Mentor</h3><ul>${data.doubts.map(x=>`<li>${esc(x.subject)}: ${esc(x.text)}</li>`).join('')||'<li>No open doubts.</li>'}</ul><h3>Next Week Focus</h3><p>Carry forward unfinished high-priority targets, repair repeated test gaps, and maintain daily answer-writing/revision consistency.</p>`;
  }
  window.saarthiGenerateReportV303=async function(useAI=false){
    const start=val('s303ReportStart')||mondayOf(),end=val('s303ReportEnd')||endOfWeek(start),data=await weeklyData(start,end),html=reportHtml(data,start,end);$('s303ReportOutput').innerHTML=html;
    if(useAI){$('s303ReportOutput').innerHTML='<div class="aiLoading">AI is preparing a mentor-ready progress report…</div>';try{const prompt=`Act as a strict UPSC mentorship progress analyst. Improve this weekly report without inventing facts. Output clear headings: Executive Summary, Target Compliance, Daily Accountability, Test Performance, Repeated Gaps, Missed Commitments, Questions for Mentor, Next Week Priorities, Red Flags.\n\nDATA:\n${JSON.stringify(data).slice(0,22000)}`;const res=await askAI(prompt);$('s303ReportOutput').innerHTML=typeof window.formatAI==='function'?window.formatAI(res):`<pre>${esc(res)}</pre>`;}catch(e){$('s303ReportOutput').innerHTML=html+`<div class="s303Alert s303Danger">AI improvement failed: ${esc(e.message)}</div>`}}
  };
  window.saarthiPrintReportV303=function(){if(typeof window.printSection==='function')window.printSection('s303ReportOutput');else window.print()};
  window.saarthiDownloadReportV303=function(){const text=$('s303ReportOutput')?.innerText||'';if(!text)return toast('Generate the report first.');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/plain'}));a.download=`Saarthi-Weekly-Report-${val('s303ReportStart')||today()}.txt`;a.click();URL.revokeObjectURL(a.href)};
  window.saarthiGenerateMeetingBriefV303=async function(){
    const start=mondayOf(),end=endOfWeek(),data=await weeklyData(start,end);$('s303MeetingBrief').innerHTML='<div class="aiLoading">Preparing next mentor meeting brief…</div>';window.saarthiTabV303('report');
    try{const prompt=`Prepare a concise agenda for my next UPSC 1:1 mentorship meeting using only this evidence. Include: 1) completed work, 2) missed targets, 3) answer-writing and MCQ consistency, 4) test scores and repeated mistakes, 5) weak topics, 6) exact questions to ask mentor, 7) proposed next-week plan. Be brutally practical and do not invent data.\n\n${JSON.stringify(data).slice(0,22000)}`;const res=await askAI(prompt);$('s303MeetingBrief').innerHTML=typeof window.formatAI==='function'?window.formatAI(res):`<pre>${esc(res)}</pre>`;}catch(e){$('s303MeetingBrief').textContent='Could not generate brief: '+e.message;}
  };
  window.saarthiSaveMeetingBriefV303=async function(){const body=$('s303MeetingBrief')?.innerText||'';if(!body||body.includes('Generate a brief'))return toast('Generate a meeting brief first.');await saveCol('notes',{title:`Saarthi Mentor Meeting Brief — ${today()}`,subject:'Mentorship',body,type:'Mentor Report',date:today(),source:'Saarthi Mentorship Hub'});toast('Meeting brief saved to Notes.');};

  async function renderTasks(){
    const tasks=await getCol('saarathiTasks');const statuses=['Assigned','In Progress','Done','Backlog'];const box=$('s303Board');if(box)box.innerHTML=statuses.map(status=>{const items=tasks.filter(x=>(x.status||'Assigned')===status);return `<div class="s303Column"><h3>${status}<span class="s303ColumnCount">${items.length}</span></h3>${items.map(x=>`<div class="s303BoardItem"><h4>${esc(x.title)}</h4><small>${esc(x.subject||'General')} • ${fmtDate(x.dueDate)} • ${esc(x.priority||'Medium')}</small>${x.details?`<small>${esc(x.details)}</small>`:''}<div class="s303ItemBtns">${status!=='In Progress'?`<button onclick="saarthiTaskStatusV303('${esc(x.id||x._docId)}','In Progress')">Start</button>`:''}${status!=='Done'?`<button class="done" onclick="saarthiTaskStatusV303('${esc(x.id||x._docId)}','Done')">Done</button>`:''}${status!=='Backlog'?`<button onclick="saarthiTaskStatusV303('${esc(x.id||x._docId)}','Backlog')">Backlog</button>`:''}<button onclick="saarthiOpenLinkedV303('${esc(x.type)}')">Open tool</button><button class="danger" onclick="saarthiDeleteV303('saarathiTasks','${esc(x.id||x._docId)}')">Delete</button></div></div>`).join('')||'<div class="s303Empty">No tasks</div>'}</div>`}).join('');
    return tasks;
  }
  function mainsStreak(logs){const set=new Set(logs.filter(x=>Number(x.mains)>0).map(x=>x.date));let streak=0,d=new Date();for(;;){const k=d.toISOString().slice(0,10);if(set.has(k)){streak++;d.setDate(d.getDate()-1)}else break;}return streak}
  async function renderOverview(tasks,daily,tests){
    const start=mondayOf(),end=endOfWeek(),week=tasks.filter(x=>isBetween(x.dueDate,start,end)),done=week.filter(x=>x.status==='Done').length,completion=week.length?Math.round(done/week.length*100):0,pending=tasks.filter(x=>x.status!=='Done').length;const upcoming=tests.filter(x=>x.date>=today()&&x.status!=='Evaluated').sort((a,b)=>a.date.localeCompare(b.date));
    if($('s303Completion'))$('s303Completion').textContent=completion+'%';if($('s303Streak'))$('s303Streak').textContent=mainsStreak(daily)+' days';if($('s303Pending'))$('s303Pending').textContent=pending;if($('s303NextTest'))$('s303NextTest').textContent=upcoming[0]?fmtDate(upcoming[0].date):'—';
    const todayTasks=tasks.filter(x=>x.status!=='Done'&&(x.dueDate<=today()||x.frequency==='Daily')).slice(0,8);if($('s303TodayList'))$('s303TodayList').innerHTML=todayTasks.map(x=>`<div class="s303ListItem"><div><h4>${esc(x.title)}</h4><small>${esc(x.subject)} • ${fmtDate(x.dueDate)} • ${esc(x.status)}</small></div><button class="btn green" onclick="saarthiTaskStatusV303('${esc(x.id||x._docId)}','Done')">Done</button></div>`).join('')||'<div class="s303Empty">No mentor task due today.</div>';
    if($('s303UpcomingTests'))$('s303UpcomingTests').innerHTML=upcoming.slice(0,6).map(x=>`<div class="s303ListItem"><div><h4>${esc(x.title)}</h4><small>${fmtDate(x.date)} • ${esc(x.stage)} • ${esc(x.subject)}</small></div><button class="btn ghost" onclick="saarthiOpenLinkedV303('${esc(x.stage)}')">Prepare</button></div>`).join('')||'<div class="s303Empty">No upcoming test. Add or import the mentorship calendar.</div>';
    const dash=$('s303DashTasks');if(dash)dash.innerHTML=todayTasks.slice(0,4).map(x=>`<div class="s303DashTask"><span>${esc(x.title)}</span><b>${fmtDate(x.dueDate)}</b></div>`).join('')+(upcoming[0]?`<div class="s303DashTask"><span>Next test: ${esc(upcoming[0].title)}</span><b>${fmtDate(upcoming[0].date)}</b></div>`:'')||'<div class="s303Empty">No mentor targets yet.</div>';
  }
  async function renderDaily(daily){if($('s303DailyHistory'))$('s303DailyHistory').innerHTML=daily.sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,7).map(x=>`<div class="s303ListItem"><div><h4>${fmtDate(x.date)} • ${'★'.repeat(Number(x.rating||0))}</h4><small>${Number(x.hours||0)}h • ${Number(x.mains||0)} mains • ${Number(x.mcqs||0)} MCQs • ${Number(x.revision||0)} min revision</small><small>${esc(x.notes||'No review note')}</small></div><button class="btn ghost" onclick="document.getElementById('s303DailyDate').value='${esc(x.date)}';saarthiLoadTodayV303()">Load</button></div>`).join('')||'<div class="s303Empty">No daily accountability entries.</div>'}
  async function renderTests(tests){
    const sorted=tests.sort((a,b)=>(a.date||'').localeCompare(b.date||''));if($('s303TestsList'))$('s303TestsList').innerHTML=sorted.map(x=>`<div class="s303ListItem"><div><h4>${esc(x.title)}</h4><small>${fmtDate(x.date)} • ${esc(x.stage)} • ${esc(x.subject||'')} • ${esc(x.frequency||'')}</small><small>Status: ${esc(x.status||'Scheduled')}${x.score?` • Score ${esc(x.score)}/${esc(x.max||'')}`:''}${x.gap&&x.gap!=='Not analysed'?` • Gap: ${esc(x.gap)}`:''}</small>${x.remarks?`<small>${esc(x.remarks)}</small>`:''}</div><div class="s303Actions"><button class="btn green" onclick="saarthiTestStatusV303('${esc(x.id||x._docId)}','Attempted')">Attempted</button><button class="btn blue" onclick="saarthiOpenLinkedV303('${esc(x.stage)}')">Open</button><button class="btn danger" onclick="saarthiDeleteV303('saarathiTests','${esc(x.id||x._docId)}')">Delete</button></div></div>`).join('')||'<div class="s303Empty">No tests saved.</div>';
    const completed=tests.filter(x=>['Attempted','Evaluated'].includes(x.status)).length,missed=tests.filter(x=>x.status==='Missed').length;if($('s303TestSummary'))$('s303TestSummary').innerHTML=`<b>${tests.length}</b> tests tracked • <b>${completed}</b> attempted/evaluated • <b>${missed}</b> missed.`;
  }
  async function renderMaterials(materials){if($('s303MaterialsList'))$('s303MaterialsList').innerHTML=materials.map(x=>`<div class="s303ListItem"><div><h4>${esc(x.title)}</h4><small>${esc(x.subject)} • ${esc(x.type)} • ${esc(x.filename||'')}</small><small>${esc(x.description||'')}</small></div><div class="s303Actions"><button class="btn blue" onclick="saarthiOpenMaterialV303('${esc(x.id||x._docId)}')">Open</button><button class="btn ghost" onclick="show('aiPdfAnalyzer')">Analyse</button><button class="btn danger" onclick="saarthiDeleteV303('saarathiMaterials','${esc(x.id||x._docId)}')">Delete</button></div></div>`).join('')||'<div class="s303Empty">No mentor materials uploaded.</div>'}
  async function renderSessions(sessions,doubts){
    if($('s303SessionsList'))$('s303SessionsList').innerHTML=sessions.sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(x=>`<div class="s303ListItem"><div><h4>Session ${esc(x.sessionNo||'')} • ${fmtDate(x.date)}</h4><small>${esc(x.mentor||'Mentor')}${x.nextMeeting?` • Next: ${esc(x.nextMeeting.replace('T',' '))}`:''}</small><small><b>Advice:</b> ${esc(x.advice||'')}</small><small><b>Weak areas:</b> ${esc(x.weak||'')}</small></div><button class="btn danger" onclick="saarthiDeleteV303('saarathiSessions','${esc(x.id||x._docId)}')">Delete</button></div>`).join('')||'<div class="s303Empty">No mentor sessions saved.</div>';
    if($('s303DoubtsList'))$('s303DoubtsList').innerHTML=doubts.map(x=>`<div class="s303ListItem"><div><h4>${esc(x.text)}</h4><small>${esc(x.subject)} • ${esc(x.route)} • ${esc(x.status)}</small></div><div class="s303Actions">${x.status!=='Resolved'?`<button class="btn green" onclick="saarthiResolveDoubtV303('${esc(x.id||x._docId)}')">Resolved</button>`:''}<button class="btn danger" onclick="saarthiDeleteV303('saarathiDoubts','${esc(x.id||x._docId)}')">Delete</button></div></div>`).join('')||'<div class="s303Empty">No doubts saved.</div>';
  }
  async function renderAllMentorV303(){
    if(!$('saarthiMentorHubV303'))return;const [tasks,daily,tests,materials,sessions,doubts]=await Promise.all(['saarathiTasks','saarathiDaily','saarathiTests','saarathiMaterials','saarathiSessions','saarathiDoubts'].map(getCol));
    await renderTasks();await renderOverview(tasks,daily,tests);await renderDaily(daily);await renderTests(tests);await renderMaterials(materials);await renderSessions(sessions,doubts);if($('s303AIMode'))$('s303AIMode').textContent=modeLabel();
  }
  window.renderAllMentorV303=renderAllMentorV303;

  function initDates(){const start=mondayOf();['s303WeekStart','s303TaskDate','s303DailyDate','s303TestDate','s303SessionDate','s303ReportStart'].forEach(id=>{if($(id)&&!$(id).value)$(id).value=id==='s303TaskDate'||id==='s303DailyDate'||id==='s303TestDate'||id==='s303SessionDate'?today():start});if($('s303WeekEnd'))$('s303WeekEnd').value=endOfWeek(start);if($('s303ReportEnd'))$('s303ReportEnd').value=endOfWeek(start)}
  function updateVersion(){document.title='Jarvis UPSC V30.3.0 — Saarthi Mentor Hub';document.querySelectorAll('.versionBadge').forEach(x=>x.textContent='V30.3.0 • Saarthi Mentor Hub');const b=$('v275BuildBadge');if(b)b.textContent=`V30.3.0 • ${navigator.onLine?'Online':'Offline'}`;const rel=document.querySelector('.v275ReleaseList div:first-child b');if(rel)rel.textContent='Mission UPSC AI OS V30.3.0 Saarthi Mentor Hub';}
  function installShowHook(){const old=window.show;if(typeof old!=='function'||old.__s303)return;const wrapped=function(id,btn){const r=old.apply(this,arguments);if(id==='saarthiMentorHubV303'||id==='dashboard')setTimeout(renderAllMentorV303,100);return r};wrapped.__s303=true;window.show=wrapped}
  function init(){ensureNav();ensureSection();ensureDashboardWidget();initDates();renderRating();updateVersion();installShowHook();renderAllMentorV303();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,80));else setTimeout(init,80);
})();

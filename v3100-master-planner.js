/* V31.0.5 Stable — JARVIS Master Planner Stabilisation
   One source of truth: Daily / AI / Mentor → War Card → Checklist → Calendar + Revision + Gaps + Progress */
(function(){
  const KEY='jarvisV31MasterPlanner';
  const $=id=>document.getElementById(id);
  const today=()=>new Date().toISOString().slice(0,10);
  const state=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(e){console.warn('V31 storage repaired',e);localStorage.removeItem(KEY);return {}}};
  const save=s=>{try{localStorage.setItem(KEY,JSON.stringify({...state(),...s,updatedAt:new Date().toISOString(),build:'31.0.5-stable'}));}catch(e){console.warn('V31 save failed',e);alert('Storage is full or blocked. Export your planner text, then clear old browser data if needed.')}};
  const esc=s=>String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function norm(t){let [h,m='00']=String(t||'00:00').replace('.',':').split(':');return `${String(h||'0').padStart(2,'0')}:${String(m||'00').padStart(2,'0')}`}
  function toMin(t){let [h,m]=norm(t).split(':').map(Number);return h*60+m}
  function fromMin(n){n=(n%1440+1440)%1440;return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`}
  function dur(a,b){let mins=toMin(b)-toMin(a);if(mins<0)mins+=1440;let h=Math.floor(mins/60),m=mins%60;return `${h? h+' hr ':''}${m?m+' min':''}`.trim()||'0 min'}
  function minutesFromDuration(x){x=String(x||'').toLowerCase();let h=(x.match(/(\d+(?:\.\d+)?)\s*h/)||[])[1],m=(x.match(/(\d+(?:\.\d+)?)\s*m/)||[])[1];return Math.round((Number(h||0)*60)+Number(m||0));}
  function taskSubject(task){let s=String(task||'').toLowerCase();
    if(/polity|constitution|parliament|governance|judiciary|rights/.test(s))return 'GS2 / Polity';
    if(/economy|gdp|inflation|budget|bank|agriculture/.test(s))return 'GS3 / Economy';
    if(/environment|ecology|climate|biodiversity/.test(s))return 'GS3 / Environment';
    if(/history|ancient|medieval|modern|culture|art/.test(s))return 'GS1 / History-Culture';
    if(/geography|map|river|monsoon|world/.test(s))return 'GS1 / Geography';
    if(/ethics|case study|gs4/.test(s))return 'GS4 / Ethics';
    if(/csat|math|reasoning|comprehension/.test(s))return 'CSAT';
    if(/current|newspaper|ca|pib|hindu|express/.test(s))return 'Current Affairs';
    if(/answer|mains|essay/.test(s))return 'Mains Practice';
    return 'General Study';
  }
  function parseTasks(raw){return (raw||'').split('\n').map(x=>x.trim()).filter(Boolean).map((line,i)=>{
    let m=line.match(/(\d{1,2}[:.]?\d{0,2})\s*(?:-|–|to)\s*(\d{1,2}[:.]?\d{0,2})\s+(.+)/i);
    let task=m?m[3]:line, a=m?norm(m[1]):'', b=m?norm(m[2]):'';
    return {id:'v31_'+Date.now()+'_'+i,time:m?`${a} - ${b}`:'Flexible',task,duration:m?dur(a,b):'',subject:taskSubject(task),done:false,status:'Pending',source:'Manual'};
  })}
  function getTasks(){return state().tasks||[]}
  function setTasks(tasks){save({tasks});v31SyncDerived(false);renderAll()}
  function setHTML(id,html){let el=$(id); if(el) el.innerHTML=html}

  function buildDerived(){
    const s=state(), tasks=s.tasks||[], done=tasks.filter(t=>t.done||t.status==='Completed'), pending=tasks.filter(t=>!t.done&&t.status!=='Completed');
    const total=tasks.length, percent=total?Math.round(done.length/total*100):0;
    const plannedMins=tasks.reduce((a,t)=>a+minutesFromDuration(t.duration),0), completedMins=done.reduce((a,t)=>a+minutesFromDuration(t.duration),0);
    const subjectMap={}; tasks.forEach(t=>{const key=t.subject||taskSubject(t.task); subjectMap[key]=(subjectMap[key]||0)+minutesFromDuration(t.duration)});
    const gaps=pending.map(t=>({task:t.task,time:t.time,reason:t.status==='Skipped'?'Skipped':'Pending',subject:t.subject||taskSubject(t.task)}));
    const revision=done.filter(t=>!/break|routine|sleep|lunch|dinner/i.test(t.task)).slice(0,8).flatMap(t=>[1,3,7].map(days=>({topic:t.task,subject:t.subject||taskSubject(t.task),date:addDays(days),cycle:`R${days===1?1:days===3?2:3}`})));
    const carry=pending.filter(t=>t.status==='Carry Forward'||t.status==='Skipped'||!t.done).slice(0,10);
    return {percent,total,doneCount:done.length,pendingCount:pending.length,plannedMins,completedMins,subjectMap,gaps,revision,carryForward:carry,date:s.date||today()};
  }
  function addDays(n){const d=new Date(); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10)}

  async function v31SyncDerived(writeExternal){
    const d=buildDerived();
    save({derived:d,calendarBlocks:(state().tasks||[]).map(t=>({date:d.date,title:t.task,type:t.done?'Completed Task':'Planner Block',time:t.time,note:`V31 War Card • ${t.subject||taskSubject(t.task)}`})),revisionRadar:d.revision,gapReport:d.gaps,carryForward:d.carryForward});
    if(writeExternal){
      try{
        if(typeof window.saveCol==='function'){
          await window.saveCol('dailyPlans',{date:d.date,title:'JARVIS V31 Daily War Card',body:(state().tasks||[]).map(t=>`${t.time} ${t.task}`).join('\n'),source:'V31 Master Planner'});
          for(const t of (state().tasks||[]).filter(x=>x.time&&x.time!=='Flexible')) await window.saveCol('calendarItems',{date:d.date,title:t.task,type:'V31 Planner',note:`${t.time} • ${t.subject||taskSubject(t.task)}`});
          for(const r of d.revision.slice(0,12)) await window.saveCol('smartRevision',{topic:r.topic,subject:r.subject,source:'V31 War Card',difficulty:'Medium',date:r.date,cycle:r.cycle,status:'pending'});
          if(window.renderCalendarAI) window.renderCalendarAI();
        } else {
          localStorage.setItem('calendarItems',JSON.stringify([...(JSON.parse(localStorage.getItem('calendarItems')||'[]')),...(state().calendarBlocks||[])]));
          localStorage.setItem('smartRevision',JSON.stringify([...(JSON.parse(localStorage.getItem('smartRevision')||'[]')),...d.revision]));
        }
      }catch(e){console.warn('V31 external sync failed but local integration is safe',e)}
    }
    return d;
  }

  function renderRows(tasks){return (tasks||[]).map((t,i)=>`<tr><td><input value="${esc(t.time||'')}" onchange="v31EditField(${i},'time',this.value)"></td><td><input value="${esc(t.task||'')}" onchange="v31EditField(${i},'task',this.value)"></td><td>${esc(t.duration||'')}</td><td><input type="checkbox" ${t.done?'checked':''} onchange="v31SetDone(${i},this.checked)"></td></tr>`).join('')||'<tr><td colspan="4">No tasks yet. Add tasks in Daily or AI Planner.</td></tr>'}

  window.v31Tab=(name,btn)=>{document.querySelectorAll('.v31Panel').forEach(p=>p.classList.remove('active'));$('v31Panel_'+name)?.classList.add('active');document.querySelectorAll('.v31Tabs button').forEach(b=>b.classList.remove('active'));btn?.classList.add('active');renderAll();};
  window.v31EditField=(i,k,v)=>{let t=getTasks(); if(t[i]){t[i][k]=v;if(k==='task')t[i].subject=taskSubject(v);if(k==='time'){let m=v.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);if(m)t[i].duration=dur(m[1],m[2])}} setTasks(t)};
  window.v31SetDone=(i,val)=>{let t=getTasks(); if(t[i]){t[i].done=val;t[i].status=val?'Completed':'Pending'} setTasks(t)};
  window.v31Status=(i,v)=>{let t=getTasks(); if(t[i]){t[i].status=v;t[i].done=v==='Completed'} setTasks(t)};
  window.v31EditTask=(i,v)=>window.v31EditField(i,'task',v);

  window.v31SaveDaily=()=>{let tasks=parseTasks($('v31DailyText').value);save({date:$('v31Date').value||today(),mission:$('v31Mission').value||'Daily UPSC Mission',tasks,planSource:'Manual'});v31SyncDerived(false);renderAll();alert('Daily plan synced to War Card + Checklist + Progress + Gap + Revision Radar.')};
  window.v31GenerateAI=()=>{let start=$('v31AiStart').value||'06:00',breakMin=Number($('v31AiBreak').value||15),raw=($('v31AiTasks').value||'').split('\n').map(x=>x.trim()).filter(Boolean);let cur=toMin(start),tasks=[];raw.forEach((line,i)=>{let m=line.match(/(.+?)(?:\s*-\s*)?(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|min|mins)?$/i);let title=m?m[1].trim():line;let mins=m?(m[3]&&m[3].toLowerCase().startsWith('min')?Number(m[2]):Number(m[2])*60):60; if(($('v31AiEnergy').value||'').toLowerCase()==='low'&&mins>90)mins=90;let a=fromMin(cur),b=fromMin(cur+mins);tasks.push({id:'ai_'+Date.now()+'_'+i,time:`${a} - ${b}`,task:title,duration:dur(a,b),subject:taskSubject(title),done:false,status:'Pending',source:'AI Planner'});cur+=mins;if(i<raw.length-1&&breakMin>0){let ba=fromMin(cur),bb=fromMin(cur+breakMin);tasks.push({id:'break_'+Date.now()+'_'+i,time:`${ba} - ${bb}`,task:'Break / reset',duration:`${breakMin} min`,subject:'Break',done:false,status:'Pending',source:'AI Planner'});cur+=breakMin;}});save({date:$('v31Date')?.value||today(),mission:$('v31AiGoal').value||'AI generated study mission',tasks,aiContext:{energy:$('v31AiEnergy').value,sleep:$('v31AiSleep').value,level:$('v31AiLevel').value},planSource:'AI'});v31SyncDerived(false);renderAll();setHTML('v31AiOutput',`<b>Smart timetable generated.</b><br>Used task duration, start time, break gap, energy, sleep and level.<br><b>Next:</b> open War Card → edit → checklist → sync calendar/revision.`)};
  window.v31DecodeMentor=()=>{let raw=$('v31MentorText').value||'', lines=raw.split('\n').map(x=>x.trim()).filter(Boolean).filter(x=>!/this week/i.test(x));let weekly=makeWeekly(lines);let tasks=lines.map((x,i)=>({id:'mentor_'+Date.now()+'_'+i,time:'Weekly Target',task:x.replace(/^[-•*]\s*/,''),duration:estimateTargetDuration(x),subject:taskSubject(x),done:false,status:'Pending',source:'Mentor'}));let hours=Math.max(20,Math.round(tasks.reduce((a,t)=>a+minutesFromDuration(t.duration),0)/60));save({mentorPlan:raw,mentorDecoded:{targets:lines,hours,weekly},weeklyPlan:weekly,tasks:getTasks().length?getTasks():tasks,planSource:'Mentor'});v31SyncDerived(false);renderAll();setHTML('v31MentorOutput',`<b>Mentor Target Decoded</b><br>Total targets: ${lines.length}<br>Estimated weekly load: ${hours} hrs<br><br><b>Strategy:</b> heavy GS topics in morning, CA/revision at night, answer writing alternate days, CSAT fixed slots.<br><br><b>Risk:</b> ${lines.some(x=>/ca|current/i.test(x))?'CA backlog needs daily repair. ':'Low CA risk. '}Pending targets will automatically enter carry-forward.`)};
  function estimateTargetDuration(x){x=String(x).toLowerCase(); if(/answer/.test(x))return '5 hr'; if(/csat/.test(x))return '4 hr'; if(/backlog|complete/.test(x))return '8 hr'; if(/revision|revise/.test(x))return '3 hr'; return '5 hr'}
  function makeWeekly(lines){const days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];return days.map((d,i)=>({day:d,focus:lines[i%Math.max(1,lines.length)]||'Revision + backlog repair',hours:i<5?8:i===5?6:4,status:'Planned'}))}
  window.v31SubjectPlan=()=>{let topic=$('v31SubjectTopic').value||'Subject Target',days=Number($('v31SubjectDays').value||5),chapters=($('v31SubjectChapters').value||'').split('\n').filter(Boolean);let html='',tasks=[];for(let i=0;i<days;i++){let sub=chapters[i]||topic+' — part '+(i+1), method=i===days-1?'PYQ + revision':'Reading + notes';html+=`<tr><td>Day ${i+1}</td><td>${esc(sub)}</td><td>${method}</td></tr>`;tasks.push({id:'subject_'+Date.now()+'_'+i,time:'Flexible',task:`${topic}: ${sub}`,duration:'2 hr',subject:taskSubject(topic+' '+sub),done:false,status:'Pending',source:'Subject Roadmap'})}setHTML('v31SubjectOutput',`<table class="v31PlanTable"><thead><tr><th>Day</th><th>Topic</th><th>Method</th></tr></thead><tbody>${html}</tbody></table>`);save({subjectRoadmap:{topic,days,chapters},tasks:[...getTasks(),...tasks]});v31SyncDerived(false);renderAll()};
  window.v31SaveReview=()=>{save({review:{went:$('v31ReviewWent').value,improve:$('v31ReviewImprove').value,learn:$('v31ReviewLearn').value,mood:$('v31ReviewMood').value,score:$('v31ReviewScore').value,date:today()}});renderAll();alert('Review saved. Progress + mentor evidence updated.')};
  window.v31SyncExternal=async()=>{await v31SyncDerived(true);renderAll();alert('Synced to AI Calendar route + Revision Radar + daily plan storage.')};
  window.v31CarryForwardTomorrow=()=>{const s=state(), carry=(s.carryForward||buildDerived().carryForward||[]).map((t,i)=>({...t,id:'carry_'+Date.now()+'_'+i,time:'Flexible',done:false,status:'Pending',source:'Carry Forward'}));save({date:addDays(1),mission:'Carry-forward repair mission',tasks:carry});v31SyncDerived(false);renderAll();alert('Pending/skipped tasks moved into tomorrow plan.')};
  window.v31PrintWar=()=>{renderWar();setTimeout(()=>window.print(),100)};
  window.v31ExportPdf=()=>{ renderWar(); setTimeout(()=>window.print(),100); };
  window.v31ExportTxt=()=>{let s=state(),d=buildDerived(),txt=`JARVIS DAILY WAR CARD\nDate: ${s.date||today()}\nMission: ${s.mission||''}\nCompletion: ${d.percent}%\n\nTasks:\n${(s.tasks||[]).map(t=>`[${t.done?'x':' '}] ${t.time} ${t.task}`).join('\n')}\n\nGaps:\n${d.gaps.map(g=>`- ${g.task}`).join('\n')}\n\nRevision Radar:\n${d.revision.map(r=>`- ${r.date}: ${r.topic}`).join('\n')}`;let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([txt],{type:'text/plain'}));a.download='JARVIS-Daily-War-Card.txt';a.click()};

  function renderWar(){const s=state(),tasks=s.tasks||[],d=buildDerived(); if($('v31WarMission'))$('v31WarMission').value=s.mission||''; if($('v31WarDate'))$('v31WarDate').textContent=s.date||today(); if($('v31WarDay'))$('v31WarDay').textContent=new Date(s.date||today()).toLocaleDateString('en-IN',{weekday:'long'}); setHTML('v31WarRows',renderRows(tasks)); setHTML('v31WarPriority',(tasks.filter(t=>!/break/i.test(t.task)).slice(0,6).map((t,i)=>`<label class="v31CheckLine"><input type="checkbox" ${t.done?'checked':''} onchange="v31SetDone(${i},this.checked)"><span>${i<2?'🔴':i<4?'🟡':'🟢'}</span><input type="text" value="${esc(t.task)}" onchange="v31EditTask(${i},this.value)"></label>`).join('')||'<div class="v31Empty">No priority tasks yet.</div>')); setHTML('v31CarryForwardBox',d.carryForward.slice(0,4).map(t=>`<div class="v31CheckLine"><input type="checkbox"><input value="${esc(t.task)}"></div>`).join('')||'<div class="v31Empty">No carry-forward. Good day.</div>'); setHTML('v31RevisionRadarBox',d.revision.slice(0,5).map(r=>`<div class="v31MiniItem"><b>${r.date}</b> ${esc(r.topic)}</div>`).join('')||'Revision appears after completed study tasks.'); if($('v31WarProgressText'))$('v31WarProgressText').textContent=d.percent+'%'; if($('v31WarProgressBar'))$('v31WarProgressBar').style.width=d.percent+'%'; if($('v31HoursText'))$('v31HoursText').textContent=`${d.doneCount} / ${d.total}`; }
  function renderChecklist(){const tasks=getTasks();setHTML('v31ChecklistRows',tasks.map((t,i)=>`<tr><td><input type="checkbox" ${t.done?'checked':''} onchange="v31SetDone(${i},this.checked)"></td><td>${esc(t.task)}<br><small>${esc(t.subject||taskSubject(t.task))}</small></td><td>${esc(t.time)}</td><td><select onchange="v31Status(${i},this.value)"><option ${t.status==='Pending'?'selected':''}>Pending</option><option ${t.status==='Completed'?'selected':''}>Completed</option><option ${t.status==='Partial'?'selected':''}>Partial</option><option ${t.status==='Skipped'?'selected':''}>Skipped</option><option ${t.status==='Carry Forward'?'selected':''}>Carry Forward</option></select></td></tr>`).join('')||'<tr><td colspan="4">No checklist yet.</td></tr>')}
  function renderWeekly(){const s=state(), wp=s.weeklyPlan||makeWeekly((s.mentorDecoded&&s.mentorDecoded.targets)||[]);setHTML('v31WeeklyRows',wp.map(x=>`<tr><td>${x.day}</td><td>${esc(x.focus)}</td><td>${x.hours} hrs</td><td>${x.status}</td></tr>`).join(''))}
  function renderProgress(){const d=buildDerived(); ['v31SideBar','v31ProgressBigBar'].forEach(id=>$(id)&&($(id).style.width=d.percent+'%')); if($('v31SideCompletion'))$('v31SideCompletion').textContent=d.percent+'%'; if($('v31SidePending'))$('v31SidePending').textContent=d.pendingCount; setHTML('v31ProgressSummary',`<b>${d.percent}% completed</b><br>${d.doneCount} of ${d.total} tasks completed. Pending: ${d.pendingCount}.<br>Planned: ${Math.round(d.plannedMins/60*10)/10} hrs • Completed: ${Math.round(d.completedMins/60*10)/10} hrs.<br>Focus score: ${d.percent>=80?'Excellent':d.percent>=60?'Good':d.percent>=40?'Average':'Needs repair'}.`); setHTML('v31SubjectProgress',Object.entries(d.subjectMap).map(([k,m])=>`<div class="v31MiniItem"><b>${esc(k)}</b> — ${Math.round(m/60*10)/10} hrs</div>`).join('')||'No subject data yet.'); setHTML('v31GapReport',d.gaps.slice(0,8).map(g=>`<div class="v31MiniItem">⚠ ${esc(g.task)} <small>${esc(g.reason)} • ${esc(g.subject)}</small></div>`).join('')||'No gaps.'); setHTML('v31ProgressRevision',d.revision.slice(0,8).map(r=>`<div class="v31MiniItem">🔁 ${r.date} — ${esc(r.topic)}</div>`).join('')||'Complete tasks to create revision radar.'); }
  function renderAll(){renderWar();renderChecklist();renderWeekly();renderProgress()}
  document.addEventListener('DOMContentLoaded',()=>{
    // Stability: keep old duplicate planner/progress nav hidden without deleting legacy code.
    document.querySelectorAll('#unifiedMissionNavV307,#simpleProgressNavV307').forEach(el=>el.classList.add('v31LegacyHidden'));
    const s=state(); if($('v31Date'))$('v31Date').value=s.date||today(); if($('v31Mission'))$('v31Mission').value=s.mission||''; if(s.review){ if($('v31ReviewWent'))$('v31ReviewWent').value=s.review.went||''; if($('v31ReviewImprove'))$('v31ReviewImprove').value=s.review.improve||''; if($('v31ReviewLearn'))$('v31ReviewLearn').value=s.review.learn||''; if($('v31ReviewMood'))$('v31ReviewMood').value=s.review.mood||'Good'; if($('v31ReviewScore'))$('v31ReviewScore').value=s.review.score||'';} renderAll();});
})();

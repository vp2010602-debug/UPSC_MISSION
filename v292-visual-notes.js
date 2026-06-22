/* Mission UPSC AI OS V29.2 — Visual + Notes Hub upgrade
   Additive layer. Existing V29.1 data, routes, Firebase and storage keys remain unchanged. */
(function(){
  'use strict';

  const VERSION = 'V29.2 • Visual + Notes Upgrade';

  function q(id){ return document.getElementById(id); }
  function esc(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  function words(text){ return String(text || '').trim().split(/\s+/).filter(Boolean).length; }
  function todayLabel(){
    try{return new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'});}catch(_){return new Date().toISOString().slice(0,10);}
  }
  function selectedText(id){
    const el=q(id); return el?.options?.[el.selectedIndex]?.text || el?.value || '';
  }
  function setStatus(id,message,type){
    const el=q(id); if(!el)return;
    el.textContent=message || '';
    el.className='v292NoteStatus'+(type?' '+type:'');
  }
  function getAI(){
    return window.aiAskRouterV23 || window.aiAskV4 || window.aiAsk;
  }
  function formatOutput(text){
    if(typeof window.formatAI === 'function') return window.formatAI(text);
    return `<pre>${esc(text)}</pre>`;
  }
  function stripCodeFence(text){
    return String(text || '').replace(/^```(?:markdown|md|text|html)?\s*/i,'').replace(/\s*```$/,'').trim();
  }

  const MODE_GUIDES = {
    integrated: 'Create an integrated Prelims + Mains UPSC note.',
    onepage: 'Create a compact one-page revision note. Be selective and high-yield.',
    prelims: 'Create a Prelims-focused note with factual statements, institutions, maps/locations where relevant, common traps and elimination cues.',
    mains: 'Create a Mains-focused note with dimensions, arguments, examples, data, challenges, reforms and way forward.',
    detailed: 'Create a detailed concept note that teaches the topic from basics to advanced UPSC application.',
    current: 'Create a current-affairs issue note linking background, stakeholders, constitutional/policy context, impacts, challenges and way forward.'
  };

  function buildNotePrompt(data){
    const modeGuide = MODE_GUIDES[data.mode] || MODE_GUIDES.integrated;
    const source = String(data.source || '').trim();
    return `You are a senior UPSC notes editor. ${modeGuide}\n\nPaper: ${data.paper || 'Prelims GS'}\nSubject: ${data.subject || 'General'}\nTopic: ${data.topic || data.title || 'UPSC topic'}\nTitle: ${data.title || data.topic || 'UPSC Note'}\n${source ? `User material / draft to use carefully:\n${source.slice(0,26000)}\n` : ''}\nCreate accurate, exam-oriented notes in clean Markdown. Use only relevant sections. Include:\n# ${data.title || data.topic || 'UPSC Note'}\n## Definition & Core Idea\n## Background / Constitutional / Historical / Conceptual Base\n## Key Features / Components\n## Prelims Focus\n- facts, institutions, provisions, maps or statement traps where relevant\n## Mains Dimensions\n- arguments, issues, stakeholders, examples, data and analytical dimensions\n## PYQ Linkage\n- explain likely UPSC demand; do not invent exact PYQs if unsure\n## Current Affairs Connection\n## Challenges / Criticism\n## Government / Institutional Response\n## Way Forward\n## Revision Capsule\n- 5 to 8 high-yield bullets\n## 30-Second Recall\n- a compact memory framework\n\nRules: Keep facts defensible. Explicitly label anything needing verification. Avoid filler, motivational language and fabricated statistics. Make the output directly reusable as UPSC notes.`;
  }

  async function askNoteAI(data,statusId){
    const ask=getAI();
    if(typeof ask!=='function') throw new Error('AI router is not available. Open AI Control Centre and save an AI mode first.');
    setStatus(statusId,'Generating structured UPSC notes…','busy');
    const result=await ask(buildNotePrompt(data));
    const text=stripCodeFence(result);
    if(!text) throw new Error('AI returned an empty response.');
    setStatus(statusId,`Generated ${words(text)} words. Review facts before saving.`,'ok');
    return text;
  }

  function quickData(){
    return {
      title:q('noteTitlePro')?.value.trim() || '',
      paper:q('notePaperPro')?.value || 'Prelims GS',
      subject:q('noteSubjectPro')?.value || 'Polity',
      topic:q('noteTopicPro')?.value.trim() || '',
      source:q('noteBodyPro')?.value || '',
      mode:q('quickNoteModeV292')?.value || 'integrated'
    };
  }

  window.generateQuickAINoteV292 = async function(){
    const data=quickData();
    if(!data.topic && !data.title) return alert('Add a note title or syllabus topic first.');
    const button=q('generateQuickAINoteBtnV292');
    if(button) button.disabled=true;
    try{
      const text=await askNoteAI(data,'quickNoteStatusV292');
      if(!q('noteTitlePro').value.trim()) q('noteTitlePro').value=data.topic || 'UPSC Note';
      q('noteBodyPro').value=text;
      q('noteBodyPro').dispatchEvent(new Event('input',{bubbles:true}));
      const output=q('noteAIImproveOutput');
      if(output) output.innerHTML=formatOutput(text);
      q('noteBodyPro').scrollIntoView({behavior:'smooth',block:'center'});
    }catch(error){
      setStatus('quickNoteStatusV292',error.message,'error');
      alert(error.message);
    }finally{ if(button) button.disabled=false; }
  };

  function markdownToPrintHtml(text){
    const lines=String(text || '').replace(/\r/g,'').split('\n');
    let html='',list=null;
    function closeList(){ if(list){html+=`</${list}>`;list=null;} }
    for(const raw of lines){
      const line=raw.trim();
      if(!line){closeList();html+='<div class="spacer"></div>';continue;}
      let m;
      if((m=line.match(/^###\s+(.+)/))){closeList();html+=`<h3>${esc(m[1])}</h3>`;continue;}
      if((m=line.match(/^##\s+(.+)/))){closeList();html+=`<h2>${esc(m[1])}</h2>`;continue;}
      if((m=line.match(/^#\s+(.+)/))){closeList();html+=`<h1>${esc(m[1])}</h1>`;continue;}
      if((m=line.match(/^[-*•]\s+(.+)/))){if(list!=='ul'){closeList();list='ul';html+='<ul>';}html+=`<li>${esc(m[1])}</li>`;continue;}
      if((m=line.match(/^\d+[.)]\s+(.+)/))){if(list!=='ol'){closeList();list='ol';html+='<ol>';}html+=`<li>${esc(m[1])}</li>`;continue;}
      closeList();
      html+=`<p>${esc(line).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')}</p>`;
    }
    closeList();
    return html;
  }

  function noteDocument(data,bodyHtml){
    const title=data.title || data.topic || 'UPSC Note';
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>
      @page{size:A4;margin:16mm 15mm 18mm}
      *{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#172033;line-height:1.55;margin:0;background:#fff;font-size:11.5pt}
      .head{border-bottom:3px solid #173b63;padding-bottom:12px;margin-bottom:20px}.head h1{font-size:24pt;color:#102a43;margin:0 0 7px}.meta{display:flex;gap:8px;flex-wrap:wrap;color:#506176;font-size:9.5pt}.pill{border:1px solid #ccd8e5;border-radius:999px;padding:4px 8px}
      h1{font-size:21pt;color:#102a43;margin:20px 0 10px}h2{font-size:15pt;color:#173b63;margin:18px 0 7px;border-bottom:1px solid #dce5ee;padding-bottom:4px}h3{font-size:12.5pt;color:#22577a;margin:14px 0 5px}p{margin:5px 0}ul,ol{margin:6px 0 8px 22px;padding:0}li{margin:3px 0}.spacer{height:5px}.footer{margin-top:26px;border-top:1px solid #dce5ee;padding-top:8px;color:#6b7788;font-size:8.5pt}
      .editor-body .richCalloutV266{padding:10px 12px;border-left:4px solid #2563eb;background:#eef4ff;margin:10px 0;border-radius:6px}.editor-body table{width:100%;border-collapse:collapse}.editor-body td,.editor-body th{border:1px solid #ccd8e5;padding:6px}
      @media print{button{display:none!important}a{color:inherit;text-decoration:none}}
    </style></head><body><header class="head"><h1>${esc(title)}</h1><div class="meta"><span class="pill">${esc(data.paper || 'UPSC')}</span><span class="pill">${esc(data.subject || 'General')}</span>${data.topic?`<span class="pill">${esc(data.topic)}</span>`:''}<span class="pill">${esc(todayLabel())}</span></div></header><main class="editor-body">${bodyHtml}</main><footer class="footer">Jarvis UPSC • Generated/edited study note • Verify dynamic facts before examination use.</footer><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250));<\/script></body></html>`;
  }

  function openPrintDocument(html){
    const win=window.open('','_blank','width=960,height=1100');
    if(!win) return alert('Popup was blocked. Allow popups for this website and try again.');
    win.document.open();win.document.write(html);win.document.close();
  }

  window.printQuickNoteV292 = function(){
    const data=quickData();
    if(!data.source.trim()) return alert('Write or generate a note first.');
    openPrintDocument(noteDocument(data,markdownToPrintHtml(data.source)));
  };

  window.copyQuickNoteV292 = async function(){
    const data=quickData();
    if(!data.source.trim()) return alert('No note content to copy.');
    const text=`${data.title || data.topic || 'UPSC Note'}\n${data.paper} • ${data.subject}${data.topic?' • '+data.topic:''}\n\n${data.source}`;
    try{await navigator.clipboard.writeText(text);setStatus('quickNoteStatusV292','Note copied to clipboard.','ok');}
    catch(_){const t=document.createElement('textarea');t.value=text;document.body.appendChild(t);t.select();document.execCommand('copy');t.remove();setStatus('quickNoteStatusV292','Note copied to clipboard.','ok');}
  };

  window.downloadQuickNoteWordV292 = function(){
    const data=quickData();
    if(!data.source.trim()) return alert('Write or generate a note first.');
    const html=noteDocument(data,markdownToPrintHtml(data.source)).replace(/<script>[\s\S]*?<\/script>/i,'');
    const blob=new Blob([html],{type:'application/msword'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(data.title||data.topic||'UPSC-Note').replace(/[^a-z0-9]+/gi,'-')+'.doc';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  };

  function richData(){
    return {
      title:q('richNoteTitleV4')?.value.trim() || '',
      paper:q('richNotePaperV4')?.value || 'Prelims GS',
      subject:q('richNoteSubjectV4')?.value || 'Polity',
      topic:q('richNoteTopicV4')?.value.trim() || '',
      source:q('richEditorV4')?.innerText || '',
      mode:q('richNoteModeV292')?.value || 'integrated'
    };
  }

  function markdownToEditorHtml(text){
    return markdownToPrintHtml(text).replace(/<div class="spacer"><\/div>/g,'<p><br></p>');
  }

  window.generateRichAINoteV292 = async function(){
    const data=richData();
    if(!data.topic && !data.title) return alert('Add a note title or syllabus topic first.');
    const button=q('generateRichAINoteBtnV292');
    if(button) button.disabled=true;
    try{
      const text=await askNoteAI(data,'richNoteStatusV292');
      const output=q('richNoteAIOutputV4');
      if(output) output.innerHTML=formatOutput(text);
      const editor=q('richEditorV4');
      const hasText=Boolean(editor?.innerText.trim());
      const shouldInsert=!hasText || confirm('Replace the current editor content with the generated AI note? Press Cancel to keep it only in the AI output panel.');
      if(shouldInsert && editor){
        editor.innerHTML=markdownToEditorHtml(text);
        editor.dispatchEvent(new Event('input',{bubbles:true}));
        if(!q('richNoteTitleV4').value.trim()) q('richNoteTitleV4').value=data.topic || 'UPSC Note';
        editor.scrollIntoView({behavior:'smooth',block:'center'});
      }
    }catch(error){
      setStatus('richNoteStatusV292',error.message,'error');
      alert(error.message);
    }finally{if(button) button.disabled=false;}
  };

  window.printRichNoteV292 = function(){
    const data=richData();
    const editor=q('richEditorV4');
    if(!editor?.innerText.trim()) return alert('Write or generate a note first.');
    openPrintDocument(noteDocument(data,editor.innerHTML));
  };

  function installQuickNotesUpgrade(){
    const section=q('evernoteNotes');
    const card=section?.querySelector('.two > .card:first-child');
    if(!card || q('quickNoteModeV292')) return;
    card.classList.add('v292QuickNoteCard');
    const heading=card.querySelector('h2');
    if(heading) heading.textContent='Quick Note & AI Generator';

    const generator=document.createElement('div');
    generator.className='v292NotesGenerator';
    generator.innerHTML=`
      <div class="v292NotesGeneratorHead"><div><b>Generate complete UPSC notes</b><span>Select the note style. Jarvis uses the paper, subject, topic and any draft already entered below.</span></div><span class="v266Pill">V29.2</span></div>
      <div class="v292NotesGeneratorControls">
        <select id="quickNoteModeV292" aria-label="AI note type">
          <option value="integrated">Integrated Prelims + Mains</option>
          <option value="onepage">One-page Revision Note</option>
          <option value="prelims">Prelims Focus</option>
          <option value="mains">Mains Framework</option>
          <option value="detailed">Detailed Topic Note</option>
          <option value="current">Current Affairs Issue Note</option>
        </select>
        <button id="generateQuickAINoteBtnV292" type="button" class="btn purple" onclick="generateQuickAINoteV292()">✨ Generate AI Notes</button>
      </div>
      <div id="quickNoteStatusV292" class="v292NoteStatus">Add a title or syllabus topic, then generate.</div>`;
    heading?.insertAdjacentElement('afterend',generator);

    const existingActions=[...card.querySelectorAll(':scope > button')];
    const actionBar=document.createElement('div');
    actionBar.className='v292QuickActions';
    actionBar.innerHTML=`
      <button type="button" class="btn green" onclick="saveProNote()">💾 Save Note</button>
      <button type="button" class="btn purple" onclick="improveNoteAI()">🪄 Improve Existing</button>
      <button type="button" class="btn ghost" onclick="copyQuickNoteV292()">📋 Copy</button>
      <button type="button" class="btn blue" onclick="printQuickNoteV292()">📄 PDF / Print</button>
      <button type="button" class="btn ghost" onclick="downloadQuickNoteWordV292()">⬇ Word</button>
      <button type="button" class="btn gold" onclick="noteToFlashcards()">🃏 Flashcards</button>`;
    existingActions.forEach(btn=>btn.style.display='none');
    card.appendChild(actionBar);
  }

  function installRichNotesUpgrade(){
    const panel=q('richNotesV4')?.querySelector('.v266EditorPanel');
    if(!panel || q('richNoteModeV292')) return;
    const toolbar=document.createElement('div');
    toolbar.className='v292RichGenerateRow';
    toolbar.innerHTML=`
      <select id="richNoteModeV292" aria-label="AI note type">
        <option value="integrated">Integrated Prelims + Mains</option>
        <option value="onepage">One-page Revision Note</option>
        <option value="prelims">Prelims Focus</option>
        <option value="mains">Mains Framework</option>
        <option value="detailed">Detailed Topic Note</option>
        <option value="current">Current Affairs Issue Note</option>
      </select>
      <button id="generateRichAINoteBtnV292" type="button" class="btn purple" onclick="generateRichAINoteV292()">✨ Generate AI Notes</button>
      <button type="button" class="btn blue" onclick="printRichNoteV292()">📄 PDF / Print</button>
      <div id="richNoteStatusV292" class="v292NoteStatus">Generate from the title/topic or use your draft as source material.</div>`;
    const templateRow=panel.querySelector('.v266TemplateRow');
    templateRow?.insertAdjacentElement('afterend',toolbar);

    // Make the existing PDF action use the clean A4 print view.
    const oldPdf=[...q('richNotesV4').querySelectorAll('button')].find(btn=>/^PDF$/i.test(btn.textContent.trim()));
    if(oldPdf){oldPdf.textContent='PDF / Print';oldPdf.setAttribute('onclick','printRichNoteV292()');}
  }

  function fixHeroAccessibility(){
    const hero=q('jarvisV281')?.querySelector('.v290JarvisHero') || document.querySelector('.v290JarvisHero');
    if(hero){
      hero.querySelectorAll('h1,p,.v290HeroKicker').forEach(el=>{el.style.opacity='1';el.style.visibility='visible';});
    }
    const syllabus=q('syllabusCommand');
    syllabus?.querySelectorAll('.syllabusHeroV265 h1,.syllabusHeroV265 p,.syllabusHeroV265 .eyebrow').forEach(el=>{el.style.opacity='1';el.style.visibility='visible';});
  }

  function updateVersion(){
    document.title='Jarvis UPSC V29.2 — Visual + Notes Upgrade';
    document.querySelectorAll('.versionBadge').forEach(el=>el.textContent=VERSION);
    const kicker=document.querySelector('.v290HeroKicker');
    if(kicker) kicker.innerHTML='<span class="v290PulseDot"></span> V29.2 • PERSONAL UPSC SAARATHI';
    const release=[...document.querySelectorAll('.v275ReleaseList b')].find(el=>/Mission UPSC AI OS V29\./i.test(el.textContent));
    if(release) release.textContent='Mission UPSC AI OS V29.2 Visual + Notes Upgrade';
  }

  function init(){
    installQuickNotesUpgrade();
    installRichNotesUpgrade();
    fixHeroAccessibility();
    updateVersion();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();

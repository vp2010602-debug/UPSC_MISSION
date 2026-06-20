
(function(){
  'use strict';
  const VERSION='28.9';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const today=()=>new Date().toISOString().slice(0,10);

  function setLibraryStatus(message,type=''){
    const el=$('libraryUploadStatusV287');
    if(!el)return;
    el.className='libraryUploadStatusV287 '+type;
    el.innerHTML=message;
  }
  async function readableText(file){
    if(typeof window.readUniversalAIFileV254==='function'){
      try{return await window.readUniversalAIFileV254(file,'AI Digital Library resource import')}
      catch(e){
        if(/^image\//i.test(file.type)||/\.pdf$/i.test(file.name)) throw e;
      }
    }
    if(/^text\//i.test(file.type)||/\.(txt|md|csv|json|html?|rtf)$/i.test(file.name)) return await file.text();
    return '';
  }
  function fileType(file){
    const n=String(file.name||'').toLowerCase();
    if(n.endsWith('.pdf'))return 'PDF';
    if(/\.(png|jpg|jpeg|webp)$/i.test(n))return 'Map';
    if(n.endsWith('.docx'))return 'Book';
    return 'Typed Note';
  }
  window.importLibraryFilesV287=async function(input){
    const files=[...(input?.files||[])];
    if(!files.length)return;
    setLibraryStatus(`Reading ${files.length} file(s)…`,'busy');
    let saved=0,partial=0,errors=[];
    for(const file of files){
      try{
        let uploaded={};
        try{uploaded=typeof window.uploadFileToFirebase==='function'?await window.uploadFileToFirebase(file,'libraryShelf'):{};}catch(e){errors.push(`${file.name}: cloud upload skipped (${e.message})`)}
        let text='';
        try{text=await readableText(file)}catch(e){partial++;errors.push(`${file.name}: text extraction needs Gemini/Ollama (${e.message})`)}
        const title=String(file.name||'UPSC resource').replace(/\.[^.]+$/,'');
        const record={
          id:'libfile_'+Date.now()+'_'+Math.random().toString(36).slice(2),
          sectionId:'libraryShelf',section:'AI Digital Library Pro',name:file.name,type:file.type||'unknown',size:file.size,date:new Date().toLocaleString(),
          preview:String(text||'').slice(0,4000),url:uploaded.url||'',storagePath:uploaded.storagePath||'',cloudFile:!!uploaded.cloudFile,localOnly:!!uploaded.localOnly
        };
        if(typeof window.saveCol==='function') await window.saveCol('sectionFiles',record);
        if(typeof window.saveCol==='function') await window.saveCol('digitalLibrary',{
          type:fileType(file),subject:$('libSubjectPro')?.value||'General',title,url:uploaded.url||'',content:String(text||'').slice(0,60000)||`Uploaded file: ${file.name}. Open it from File Vault or the resource link.`,
          tags:['uploaded',String(file.name||'').split('.').pop()?.toLowerCase()].filter(Boolean),date:today(),lastReviewed:'',source:'AI Digital Library Pro V28.9',fileId:record.id,storagePath:record.storagePath||''
        });
        saved++;
      }catch(e){errors.push(`${file.name}: ${e.message}`)}
    }
    input.value='';
    try{await window.renderDigitalLibrary2?.()}catch(e){}
    try{await window.renderFileVault?.()}catch(e){}
    try{await window.renderSectionFilesV10?.('libraryShelf')}catch(e){}
    const detail=errors.length?`<br><small>${esc(errors.slice(0,4).join(' • '))}${errors.length>4?' • …':''}</small>`:'';
    setLibraryStatus(`✅ ${saved} resource(s) added to AI Digital Library Pro and File Vault${partial?` • ${partial} stored without extracted text`:''}.${detail}`,saved?'ok':'error');
  };

  function ensureRequiredUploadCoverage(){
    // These sections need sources/answers/documents; other sections stay clean.
    const required=['pyqIntelligence','wrongAnswerNotebook','richNotesV4'];
    const labels={pyqIntelligence:'PYQ Intelligence Pro',wrongAnswerNotebook:'Wrong Answer Notebook',richNotesV4:'AI Notes Studio Pro'};
    required.forEach(id=>{
      const sec=$(id);if(!sec||sec.querySelector('.sectionUploadBox')||sec.querySelector('input[type="file"]'))return;
      const card=document.createElement('div');
      card.className='sectionUploadBox';
      card.innerHTML=`<div><b>📎 Add source files for ${esc(labels[id]||id)}</b><p>Attach PDFs, images, notes or screenshots only where source material is useful.</p></div><label class="uploadPill">+ Add File<input type="file" multiple onchange="handleSectionUploadV10('${id}',this)"></label><div id="files_${id}" class="sectionFileList"></div>`;
      sec.insertAdjacentElement('afterbegin',card);
      try{window.renderSectionFilesV10?.(id)}catch(e){}
    });
  }

  function resetSectionScroll(){
    const main=document.querySelector('main');
    const active=document.querySelector('.section.active');
    try{window.scrollTo({top:0,left:0,behavior:'auto'})}catch(e){window.scrollTo(0,0)}
    if(document.scrollingElement)document.scrollingElement.scrollTop=0;
    document.documentElement.scrollTop=0;document.body.scrollTop=0;
    if(main){main.scrollTop=0;main.scrollLeft=0}
    if(active){active.scrollTop=0;active.scrollLeft=0}
  }
  function patchNavigation(){
    if(window.__V287_SHOW_PATCHED__||typeof window.show!=='function')return;
    const previous=window.show;
    window.show=function(){
      const r=previous.apply(this,arguments);
      resetSectionScroll();
      requestAnimationFrame(()=>{resetSectionScroll();setTimeout(resetSectionScroll,40)});
      return r;
    };
    window.__V287_SHOW_PATCHED__=true;
  }
  function improveSidebar(){
    const sidebar=$('sidebar');if(!sidebar)return;
    sidebar.setAttribute('aria-label','Mission UPSC section list');
    const setupBtn=[...sidebar.querySelectorAll('.nav button')].find(b=>/Setup/i.test(b.textContent||''));
    if(setupBtn)setupBtn.dataset.finalSection='true';
  }
  function updateVersion(){
    const badge=document.querySelector('#pageTitle .versionBadge');if(badge)badge.textContent='V28.9 • Workspace Fix';
    const release=[...document.querySelectorAll('.v275ReleaseList>div')].find(x=>/^Version$/i.test(x.querySelector('span')?.textContent||''));
    if(release?.querySelector('b'))release.querySelector('b').textContent='Mission UPSC AI OS V28.9 Workspace & Vault Fix';
  }
  function init(){
    patchNavigation();ensureRequiredUploadCoverage();improveSidebar();updateVersion();resetSectionScroll();
    window.addEventListener('hashchange',resetSectionScroll,{passive:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,50));else setTimeout(init,50);
  window.addEventListener('load',()=>{patchNavigation();ensureRequiredUploadCoverage();setTimeout(resetSectionScroll,60)});
})();

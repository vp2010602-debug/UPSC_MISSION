(function(){
  'use strict';
  const VERSION='28.9';
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const safeJson=(raw,fallback=[])=>{try{const v=JSON.parse(raw);return Array.isArray(v)?v:fallback}catch(e){return fallback}};
  const bytes=n=>{
    n=Number(n)||0;
    if(n>=1073741824)return (n/1073741824).toFixed(1)+' GB';
    if(n>=1048576)return (n/1048576).toFixed(1)+' MB';
    if(n>=1024)return Math.round(n/1024)+' KB';
    return n+' B';
  };
  const idOf=(x,i)=>String(x?._docId||x?.id||`index_${i}`);
  const dateValue=x=>{
    const raw=x?.createdAt?.toDate?.()||x?.createdAt||x?.updatedAt||x?.date||0;
    const n=typeof raw==='number'?raw:Date.parse(raw);
    return Number.isFinite(n)?n:0;
  };
  const normalizeUrl=url=>{
    const raw=String(url||'').trim();
    if(!raw)return '';
    if(/^(https?:|data:|blob:)/i.test(raw))return raw;
    return /^www\./i.test(raw)?'https://'+raw:raw;
  };
  const extensionOf=(name,url)=>{
    const source=(String(name||'')+' '+String(url||'').split(/[?#]/)[0]).toLowerCase();
    const m=source.match(/\.([a-z0-9]{1,8})(?:\s|$|\/)/g);
    if(!m?.length)return '';
    return m[m.length-1].replace(/[^a-z0-9]/g,'');
  };
  function categoryOf(record){
    const type=String(record?.type||record?.mime||'').toLowerCase();
    const ext=extensionOf(record?.name||record?.title,record?.url);
    if(type.includes('pdf')||ext==='pdf')return 'pdf';
    if(type.startsWith('image/')||['png','jpg','jpeg','webp','gif','svg','bmp','heic'].includes(ext)||/\bmap\b/.test(type))return 'image';
    if(['doc','docx','odt','rtf','txt','md','csv','json','html','htm','xls','xlsx','ppt','pptx'].includes(ext)||/document|word|sheet|presentation|book/.test(type))return 'document';
    if(/typed note|ai note|current affairs|mock report|mains answer|pyq/.test(type)&&!record?.url)return 'note';
    if(record?.url)return 'link';
    if(record?.preview||record?.content)return 'note';
    return 'other';
  }
  function iconOf(category){return ({pdf:'📕',document:'📘',image:'🖼️',link:'🔗',note:'📝',other:'📦'})[category]||'📄'}
  function labelOf(category){return ({pdf:'PDF',document:'DOCUMENT',image:'IMAGE',link:'LINK',note:'NOTE',other:'OTHER'})[category]||'FILE'}
  async function getCollection(name){
    try{return typeof window.getCol==='function'?await window.getCol(name):safeJson(localStorage.getItem(name)||'[]')}
    catch(e){return safeJson(localStorage.getItem(name)||'[]')}
  }

  let vaultCache=[];
  let activeCategory='all';

  async function collectVaultRecords(){
    const localFiles=safeJson(localStorage.getItem('upscSectionFilesV10')||'[]');
    const [cloudFiles,library]=await Promise.all([getCollection('sectionFiles'),getCollection('digitalLibrary')]);
    const seen=new Set();
    const uploads=[];
    [...cloudFiles,...localFiles].forEach((x,i)=>{
      if(!x||typeof x!=='object')return;
      const sourceId=idOf(x,i);
      const dedupe=String(x.storagePath||x.id||x.url||`${x.name||''}|${x.date||''}`);
      if(seen.has(dedupe))return;
      seen.add(dedupe);
      const record={
        key:`upload:${sourceId}`,
        sourceKind:'upload',sourceId,
        name:x.name||x.title||'Uploaded file',title:x.name||x.title||'Uploaded file',
        type:x.type||'File',mime:x.type||'',size:Number(x.size)||0,date:x.date||'',createdAt:dateValue(x),
        section:x.section||x.sectionId||'Uploaded Files',subject:x.subject||'',
        url:normalizeUrl(x.url||x.dataUrl||''),preview:x.preview||'',content:x.preview||'',
        storagePath:x.storagePath||'',cloudFile:!!x.cloudFile,localOnly:!!x.localOnly
      };
      record.category=categoryOf(record);
      uploads.push(record);
    });
    const uploadedIds=new Set(uploads.flatMap(x=>[x.sourceId,x.storagePath,x.url].filter(Boolean).map(String)));
    const resources=[];
    library.forEach((x,i)=>{
      if(!x||typeof x!=='object')return;
      const sourceId=idOf(x,i);
      if(x.fileId&&uploadedIds.has(String(x.fileId)))return;
      if(x.storagePath&&uploadedIds.has(String(x.storagePath)))return;
      const record={
        key:`library:${sourceId}`,
        sourceKind:'library',sourceId,
        name:x.title||x.name||'Library resource',title:x.title||x.name||'Library resource',
        type:x.type||'Library Resource',mime:x.mime||'',size:Number(x.size)||0,
        date:x.date||'',createdAt:dateValue(x),section:'AI Digital Library Pro',subject:x.subject||'General',
        url:normalizeUrl(x.url||''),preview:String(x.content||x.body||x.note||'').slice(0,1200),
        content:String(x.content||x.body||x.note||''),tags:Array.isArray(x.tags)?x.tags:String(x.tags||'').split(',').filter(Boolean),
        storagePath:x.storagePath||'',cloudFile:!!x.cloudFile,localOnly:!x.cloudFile
      };
      record.category=categoryOf(record);
      resources.push(record);
    });
    return [...uploads,...resources];
  }

  function setText(id,value){const el=$(id);if(el)el.textContent=String(value)}
  function updateCounts(records){
    const counts={all:records.length,pdf:0,document:0,image:0,link:0,note:0,other:0};
    records.forEach(x=>counts[x.category]=(counts[x.category]||0)+1);
    setText('vaultTotalV289',counts.all);
    setText('vaultPdfV289',counts.pdf);
    setText('vaultLinksV289',records.filter(x=>x.sourceKind==='library'&&x.url).length);
    setText('vaultStorageV289',bytes(records.filter(x=>x.sourceKind==='upload').reduce((sum,x)=>sum+(Number(x.size)||0),0)));
    Object.entries(counts).forEach(([k,v])=>setText('vaultCount'+k.charAt(0).toUpperCase()+k.slice(1)+'V289',v));
  }
  function cardHtml(record){
    const encoded=encodeURIComponent(record.key);
    const meta=(record.sourceKind==='library'?[record.subject,record.size?bytes(record.size):'',record.date||'']:[record.size?bytes(record.size):'',record.date||'']).filter(Boolean);
    const sourceTag=record.sourceKind==='library'?'AI Digital Library Pro':record.section;
    const openLabel=record.sourceKind==='library'?(record.url?(record.category==='pdf'?'Open PDF':'Open Link'):'View Note'):'View';
    const preview=String(record.preview||'').replace(/\s+/g,' ').trim();
    const secondAction=record.sourceKind==='upload'
      ?`<button class="btn green" onclick="downloadVaultItemV289('${encoded}')">Download</button>`
      :(record.url?`<button class="btn ghost" onclick="copyVaultLinkV289('${encoded}')">Copy Link</button>`:`<button class="btn green" onclick="downloadVaultItemV289('${encoded}')">Download Note</button>`);
    return `<article class="vaultFile v289VaultCard" data-category="${esc(record.category)}">
      <div class="v289VaultCardHead"><div class="vaultIcon">${iconOf(record.category)}</div><span class="v289VaultTypeBadge">${labelOf(record.category)}</span></div>
      <h3>${esc(record.title)}</h3>
      <div class="v289VaultMeta"><span>${esc(sourceTag)}</span>${meta.map(x=>`<span>${esc(x)}</span>`).join('')}</div>
      <p class="v289VaultPreview">${esc(preview?preview.slice(0,170)+(preview.length>170?'…':''):(record.url?record.url:'No preview available.'))}</p>
      <div class="actions"><button class="btn blue" onclick="openVaultItemV289('${encoded}')">${openLabel}</button>${secondAction}<button class="btn danger" onclick="deleteVaultItemV289('${encoded}')">Delete</button></div>
    </article>`;
  }

  window.setFileVaultCategoryV289=function(category,button){
    activeCategory=category||'all';
    document.querySelectorAll('#fileVaultTabsV289 button').forEach(x=>x.classList.toggle('active',x===button||x.dataset.category===activeCategory));
    window.renderFileVault?.();
  };

  window.renderFileVault=async function(){
    const box=$('fileVaultList');
    if(!box)return;
    box.innerHTML='<div class="v289VaultEmpty">Loading your files and Library resources…</div>';
    const records=await collectVaultRecords();
    vaultCache=records;
    updateCounts(records);
    const term=String($('fileVaultSearch')?.value||'').trim().toLowerCase();
    const source=$('fileVaultSourceFilterV289')?.value||'all';
    const sort=$('fileVaultSortV289')?.value||'newest';
    let filtered=records.filter(x=>{
      if(activeCategory!=='all'&&x.category!==activeCategory)return false;
      if(source!=='all'&&x.sourceKind!==source)return false;
      if(term&&!JSON.stringify(x).toLowerCase().includes(term))return false;
      return true;
    });
    filtered.sort((a,b)=>{
      if(sort==='oldest')return a.createdAt-b.createdAt;
      if(sort==='name')return String(a.title).localeCompare(String(b.title));
      if(sort==='size')return (b.size||0)-(a.size||0);
      return b.createdAt-a.createdAt;
    });
    box.innerHTML=filtered.length?filtered.map(cardHtml).join(''):`<div class="v289VaultEmpty">No ${activeCategory==='all'?'items':activeCategory+' items'} match the current filters.</div>`;
  };

  function recordByEncoded(encoded){
    let key='';try{key=decodeURIComponent(encoded)}catch(e){key=encoded}
    return vaultCache.find(x=>x.key===key);
  }
  window.openVaultItemV289=async function(encoded){
    const record=recordByEncoded(encoded);if(!record)return alert('This vault item could not be found. Refresh the File Vault.');
    if(record.sourceKind==='upload'&&typeof window.openSectionFileV11==='function')return window.openSectionFileV11(record.sourceId);
    if(record.url){window.open(record.url,'_blank','noopener');return;}
    const body=record.content||record.preview||'No note content available.';
    const w=window.open('','_blank');
    if(!w)return alert('Popup blocked. Use Download Note instead.');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(record.title)}</title><style>body{font-family:Inter,Arial,sans-serif;max-width:900px;margin:40px auto;padding:20px;line-height:1.65;color:#172033}pre{white-space:pre-wrap;font:inherit}</style></head><body><h1>${esc(record.title)}</h1><p><b>${esc(record.type)}</b> • ${esc(record.subject||record.section)}</p><pre>${esc(body)}</pre></body></html>`);
    w.document.close();
  };
  window.downloadVaultItemV289=async function(encoded){
    const record=recordByEncoded(encoded);if(!record)return alert('This vault item could not be found.');
    if(record.sourceKind==='upload'&&typeof window.downloadSectionFileV11==='function')return window.downloadSectionFileV11(record.sourceId);
    if(record.url){const a=document.createElement('a');a.href=record.url;a.target='_blank';a.rel='noopener';a.download=record.title||'UPSC-resource';a.click();return;}
    const blob=new Blob([record.content||record.preview||''],{type:'text/plain;charset=utf-8'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(record.title||'UPSC-note').replace(/[^a-z0-9._-]+/gi,'-')+'.txt';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  };
  window.copyVaultLinkV289=async function(encoded){
    const record=recordByEncoded(encoded);if(!record?.url)return alert('No link is stored for this item.');
    try{await navigator.clipboard.writeText(record.url);alert('Link copied.')}catch(e){prompt('Copy this link:',record.url)}
  };
  window.deleteVaultItemV289=async function(encoded){
    const record=recordByEncoded(encoded);if(!record)return alert('This vault item could not be found.');
    if(record.sourceKind==='upload'){
      if(typeof window.deleteSectionFileV10==='function')await window.deleteSectionFileV10(record.sourceId);
    }else{
      if(!confirm(`Delete “${record.title}” from AI Digital Library Pro and the File Vault?`))return;
      if(typeof window.deleteItem==='function')await window.deleteItem('digitalLibrary',record.sourceId,true);
      try{await window.renderDigitalLibrary2?.()}catch(e){}
    }
    setTimeout(()=>window.renderFileVault?.(),120);
  };

  function plainToHtml(text){return esc(String(text||'')).replace(/\r?\n/g,'<br>')}
  let migrationRunning=false;
  async function migrateLegacyNotes(){
    if(migrationRunning||typeof window.saveCol!=='function')return;
    migrationRunning=true;
    try{
      const [legacy,rich]=await Promise.all([getCollection('notes'),getCollection('richNotesV4')]);
      const migrated=new Set(rich.map(x=>String(x.legacySourceId||'')).filter(Boolean));
      let count=0;
      for(let i=0;i<legacy.length&&i<200;i++){
        const note=legacy[i]||{};
        const legacyId=idOf(note,i);
        if(migrated.has(legacyId))continue;
        const body=note.body||note.content||note.note||note.text||note.output||'';
        const title=note.title||note.topic||`AI Note ${i+1}`;
        if(!String(body).trim()&&!String(title).trim())continue;
        await window.saveCol('richNotesV4',{
          legacySourceId:legacyId,title:String(title),paper:note.paper||'Prelims GS',subject:note.subject||'General',topic:note.topic||String(title),
          tags:['AI Notes','Merged V28.9'],body:plainToHtml(body),date:note.date||new Date().toISOString().slice(0,10),updatedAt:Date.now(),source:'Merged from AI Notes Studio V28.9'
        });
        count++;
      }
      if(count){
        try{await window.renderRichNotesV4?.()}catch(e){}
        const status=$('richLastSavedV266');if(status)status.textContent=`${count} legacy AI note${count===1?'':'s'} merged`;
      }
    }catch(e){console.warn('V28.9 notes merge skipped safely:',e)}
    finally{migrationRunning=false}
  }

  function patchUnifiedNotesNavigation(){
    if(window.__V289_NOTES_NAV_PATCHED__||typeof window.show!=='function')return;
    const previous=window.show;
    window.show=function(id,button){
      const mapped=id==='aiNotesPro'?'richNotesV4':id;
      const result=previous.call(this,mapped,button);
      if(mapped==='richNotesV4')setTimeout(migrateLegacyNotes,120);
      if(mapped==='fileVault')setTimeout(()=>window.renderFileVault?.(),80);
      return result;
    };
    window.__V289_NOTES_NAV_PATCHED__=true;
  }

  function restoreNaturalScroll(){
    document.documentElement.style.overflowY='auto';
    document.body.style.overflowY='auto';
    const main=document.querySelector('main');
    if(main){main.style.overflow='visible';main.style.height='auto';main.style.maxHeight='none'}
  }
  function updateVersion(){
    const badge=document.querySelector('#pageTitle .versionBadge');if(badge)badge.textContent='V28.9 • Workspace Fix';
    const release=[...document.querySelectorAll('.v275ReleaseList>div')].find(x=>/^Version$/i.test(x.querySelector('span')?.textContent||''));
    if(release?.querySelector('b'))release.querySelector('b').textContent='Mission UPSC AI OS V28.9 Workspace & Vault Fix';
  }
  function install(){
    restoreNaturalScroll();
    patchUnifiedNotesNavigation();
    updateVersion();
    if($('fileVaultList'))window.renderFileVault?.();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,120));else setTimeout(install,120);
  window.addEventListener('load',()=>{setTimeout(install,180);setTimeout(install,900)});
  window.addEventListener('resize',restoreNaturalScroll,{passive:true});
  let retries=0;const timer=setInterval(()=>{install();if(++retries>12)clearInterval(timer)},300);
  window.__MISSION_UPSC_VERSION__=VERSION;
})();

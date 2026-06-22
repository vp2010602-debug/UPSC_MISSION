/* Mission UPSC AI OS V30.0.7 — centred temporal labels + unified section hamburger */
(function(){
  'use strict';

  const TEMPORAL='input[type="date"],input[type="time"],input[type="datetime-local"],input[type="month"],input[type="week"]';
  const SIDEBAR_KEY='mission_upsc_sidebar_collapsed_v3007';

  function pad2(value){ return String(value).padStart(2,'0'); }
  function safeDate(parts){
    const y=Number(parts[0]),m=Number(parts[1]),d=Number(parts[2]||1);
    if(!y||!m) return null;
    return new Date(y,m-1,d,12,0,0,0);
  }
  function formatTemporal(input){
    const value=input.value;
    if(!value){
      return input.getAttribute('data-empty-label') || input.getAttribute('placeholder') || ({
        date:'Select date',time:'Select time','datetime-local':'Select date and time',month:'Select month',week:'Select week'
      }[input.type] || 'Select');
    }
    try{
      if(input.type==='date'){
        const dt=safeDate(value.split('-'));
        return dt ? new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric'}).format(dt) : value;
      }
      if(input.type==='time'){
        const match=value.match(/^(\d{1,2}):(\d{2})/);
        if(!match) return value;
        const dt=new Date(2000,0,1,Number(match[1]),Number(match[2]));
        return new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit',hour12:true}).format(dt);
      }
      if(input.type==='datetime-local'){
        const parts=value.split('T');
        const dt=safeDate((parts[0]||'').split('-'));
        const tm=(parts[1]||'').match(/^(\d{1,2}):(\d{2})/);
        if(!dt||!tm) return value.replace('T',' ');
        dt.setHours(Number(tm[1]),Number(tm[2]),0,0);
        return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'numeric',minute:'2-digit',hour12:true}).format(dt);
      }
      if(input.type==='month'){
        const dt=safeDate(value.split('-'));
        return dt ? new Intl.DateTimeFormat('en-GB',{month:'long',year:'numeric'}).format(dt) : value;
      }
      if(input.type==='week'){
        const m=value.match(/^(\d{4})-W(\d{2})$/);
        return m ? `Week ${Number(m[2])}, ${m[1]}` : value;
      }
    }catch(error){}
    return value;
  }

  function syncTemporal(input){
    const shell=input.closest('.v3007TemporalShell');
    if(!shell) return;
    const display=shell.querySelector('.v3007TemporalValue');
    if(!display) return;
    display.textContent=formatTemporal(input);
    display.classList.toggle('is-placeholder',!input.value);
  }

  function installTemporal(input){
    if(!input || input.dataset.v3007Temporal==='1') return;
    input.dataset.v3007Temporal='1';

    let shell=input.closest('.v3006TemporalShell');
    if(!shell){
      shell=document.createElement('span');
      shell.className='v3006TemporalShell';
      shell.dataset.temporalKind=input.type||'date';
      input.parentNode.insertBefore(shell,input);
      shell.appendChild(input);
    }
    shell.classList.add('v3007TemporalShell');
    shell.dataset.temporalKind=input.type||'date';

    let display=shell.querySelector('.v3007TemporalValue');
    if(!display){
      display=document.createElement('span');
      display.className='v3007TemporalValue';
      display.setAttribute('aria-hidden','true');
      shell.appendChild(display);
    }

    ['input','change','blur','focus'].forEach(name=>input.addEventListener(name,()=>syncTemporal(input)));
    shell.addEventListener('click',event=>{
      if(event.target!==input){
        try{input.focus({preventScroll:true})}catch(error){input.focus()}
        try{if(typeof input.showPicker==='function') input.showPicker()}catch(error){}
      }
    });
    syncTemporal(input);
  }

  function installAllTemporal(root){
    (root||document).querySelectorAll(TEMPORAL).forEach(installTemporal);
  }

  function sidebarButton(){ return document.querySelector('#mobileTopV2754 .v2754MenuBtn'); }
  function setButtonState(expanded){
    const btn=sidebarButton();
    if(!btn) return;
    btn.textContent='☰';
    btn.setAttribute('aria-expanded',expanded?'true':'false');
    btn.setAttribute('aria-label',expanded?'Hide section list':'Show section list');
    btn.title=expanded?'Hide sections':'Show sections';
  }

  function desktopExpanded(){ return !document.body.classList.contains('v3007SidebarCollapsed'); }
  function setDesktopSidebar(expanded,persist){
    document.body.classList.toggle('v3007SidebarCollapsed',!expanded);
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebarOverlayV2754')?.classList.remove('open');
    setButtonState(expanded);
    if(persist){
      try{localStorage.setItem(SIDEBAR_KEY,expanded?'1':'0')}catch(error){}
    }
  }

  function mobileExpanded(){ return Boolean(document.getElementById('sidebar')?.classList.contains('open')); }
  function setMobileSidebar(expanded){
    document.getElementById('sidebar')?.classList.toggle('open',expanded);
    document.getElementById('sidebarOverlayV2754')?.classList.toggle('open',expanded);
    setButtonState(expanded);
  }

  window.toggleSidebarV2754=function(){
    if(window.innerWidth<=980) setMobileSidebar(!mobileExpanded());
    else setDesktopSidebar(!desktopExpanded(),true);
  };

  window.closeSidebarV2754=function(){
    if(window.innerWidth<=980) setMobileSidebar(false);
  };

  function restoreSidebar(){
    document.getElementById('sidebarToggleV3004')?.remove();
    if(window.innerWidth<=980){
      document.body.classList.remove('v3007SidebarCollapsed');
      setMobileSidebar(false);
      return;
    }
    let expanded=true;
    try{expanded=localStorage.getItem(SIDEBAR_KEY)!=='0'}catch(error){}
    setDesktopSidebar(expanded,false);
  }

  function install(){
    installAllTemporal(document);
    restoreSidebar();

    const observer=new MutationObserver(records=>{
      records.forEach(record=>record.addedNodes.forEach(node=>{
        if(!(node instanceof Element)) return;
        if(node.matches?.(TEMPORAL)) installTemporal(node);
        installAllTemporal(node);
      }));
      document.getElementById('sidebarToggleV3004')?.remove();
    });
    observer.observe(document.body,{childList:true,subtree:true});

    window.addEventListener('resize',restoreSidebar,{passive:true});
    window.setInterval(()=>document.querySelectorAll(TEMPORAL).forEach(syncTemporal),1000);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();

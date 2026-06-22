/* Mission UPSC AI OS V30.0.6 — temporal input shells + one section-menu control */
(function(){
  'use strict';

  const TEMPORAL_SELECTOR='input[type="date"],input[type="time"],input[type="datetime-local"],input[type="month"],input[type="week"]';

  function wrapTemporalInput(input){
    if(!input || input.closest('.v3006TemporalShell')) return;
    const shell=document.createElement('span');
    shell.className='v3006TemporalShell';
    shell.dataset.temporalKind=input.type || 'date';
    input.parentNode.insertBefore(shell,input);
    shell.appendChild(input);
    shell.addEventListener('click',function(event){
      if(event.target===input) return;
      try{ input.focus({preventScroll:true}); }catch(e){ input.focus(); }
      try{ if(typeof input.showPicker==='function') input.showPicker(); }catch(e){}
    });
  }

  function installTemporalShells(root){
    (root||document).querySelectorAll(TEMPORAL_SELECTOR).forEach(wrapTemporalInput);
  }

  function useTopBarSectionButtonOnly(){
    document.getElementById('sidebarToggleV3004')?.remove();
    document.body.classList.remove('v3004SidebarHidden');
    try{ localStorage.removeItem('mission_upsc_sidebar_hidden_v3004'); }catch(e){}

    const menu=document.querySelector('#mobileTopV2754 .v2754MenuBtn');
    if(menu){
      menu.setAttribute('aria-label','Open or close sections');
      menu.title='Open or close sections';
    }
  }

  function install(){
    installTemporalShells(document);
    useTopBarSectionButtonOnly();

    /* Future dynamically inserted date/time fields receive the same safe shell. */
    const observer=new MutationObserver(records=>{
      for(const record of records){
        for(const node of record.addedNodes){
          if(!(node instanceof Element)) continue;
          if(node.matches?.(TEMPORAL_SELECTOR)) wrapTemporalInput(node);
          installTemporalShells(node);
        }
      }
      document.getElementById('sidebarToggleV3004')?.remove();
    });
    observer.observe(document.body,{childList:true,subtree:true});
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();

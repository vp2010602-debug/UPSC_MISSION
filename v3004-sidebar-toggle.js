/* Mission UPSC AI OS V30.0.4 — optional desktop/tablet sidebar toggle */
(function(){
  'use strict';
  const KEY='mission_upsc_sidebar_hidden_v3004';

  function button(){ return document.getElementById('sidebarToggleV3004'); }
  function isHidden(){ return document.body.classList.contains('v3004SidebarHidden'); }

  function apply(hidden,persist){
    document.body.classList.toggle('v3004SidebarHidden',Boolean(hidden));
    const btn=button();
    if(btn){
      btn.textContent=hidden?'☰ Show Sections':'⇤ Hide Sections';
      btn.setAttribute('aria-pressed',hidden?'true':'false');
      btn.title=hidden?'Show the section sidebar':'Hide the section sidebar for a wider workspace';
    }
    if(persist){
      try{ localStorage.setItem(KEY,hidden?'1':'0'); }catch(e){}
    }
  }

  window.toggleSectionsSidebarV3004=function(){
    apply(!isHidden(),true);
  };

  function install(){
    if(button()) return;
    const host=document.getElementById('topActionsV286') || document.querySelector('.topActions');
    if(!host) return;
    const btn=document.createElement('button');
    btn.id='sidebarToggleV3004';
    btn.type='button';
    btn.className='btn ghost v3004SidebarToggle';
    btn.onclick=window.toggleSectionsSidebarV3004;
    host.insertBefore(btn,host.firstChild);
    let hidden=false;
    try{ hidden=localStorage.getItem(KEY)==='1'; }catch(e){}
    apply(hidden,false);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();

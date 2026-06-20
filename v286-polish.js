(function(){
  const KEY='mission_top_tools_hidden_v286';
  window.toggleTopToolsV286=function(){
    const box=document.getElementById('topActionsV286');
    if(!box)return;
    const hidden=box.classList.toggle('mobileCollapsedV286');
    localStorage.setItem(KEY,hidden?'1':'0');
  };
  function init(){
    const box=document.getElementById('topActionsV286');
    if(box && (localStorage.getItem(KEY)==='1' || window.innerWidth<821)) box.classList.add('mobileCollapsedV286');
    const title=document.querySelector('.mobileBrandV286 b');
    if(title) title.textContent='Jarvis UPSC';
    const pageTitle=document.getElementById('pageTitle');
    if(pageTitle){ const badge=pageTitle.querySelector('.versionBadge'); if(badge) badge.textContent='V28.6 • Jarvis UPSC'; }
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();

/* Mission UPSC AI OS V30.1.2 — date/time picker activation hotfix */
(function(){
  'use strict';

  const TEMPORAL='input[type="date"],input[type="time"],input[type="datetime-local"],input[type="month"],input[type="week"]';
  const lastOpen=new WeakMap();

  function requestPicker(input){
    if(!input || input.disabled || input.readOnly) return;
    try{ input.focus({preventScroll:true}); }catch(error){ try{ input.focus(); }catch(ignore){} }

    /* Chromium/Edge need showPicker() after the centred overlay treatment.
       Safari has no showPicker() in some versions; its normal trusted tap remains
       untouched and opens the native wheel/calendar because we never preventDefault. */
    if(typeof input.showPicker==='function'){
      const now=Date.now();
      if(now-(lastOpen.get(input)||0)<450) return;
      lastOpen.set(input,now);
      try{ input.showPicker(); }catch(error){}
    }
  }

  function bind(input){
    if(!input || input.dataset.v3012Picker==='1') return;
    input.dataset.v3012Picker='1';

    input.addEventListener('click',function(){ requestPicker(input); },{passive:true});
    input.addEventListener('touchend',function(){ requestPicker(input); },{passive:true});
    input.addEventListener('keydown',function(event){
      if(event.key==='Enter' || event.key===' '){ requestPicker(input); }
    });
  }

  function bindAll(root){
    (root||document).querySelectorAll(TEMPORAL).forEach(bind);
  }

  function install(){
    bindAll(document);

    /* Capture shell/input clicks before older shell handlers. This is the key fix
       for inputs that fill the whole shell and previously bypassed showPicker(). */
    document.addEventListener('click',function(event){
      const target=event.target instanceof Element ? event.target : null;
      if(!target) return;
      const input=target.matches(TEMPORAL)
        ? target
        : target.closest('.v3006TemporalShell,.v3007TemporalShell')?.querySelector(TEMPORAL);
      if(input) requestPicker(input);
    },true);

    const observer=new MutationObserver(records=>{
      for(const record of records){
        for(const node of record.addedNodes){
          if(!(node instanceof Element)) continue;
          if(node.matches?.(TEMPORAL)) bind(node);
          bindAll(node);
        }
      }
    });
    observer.observe(document.body,{childList:true,subtree:true});
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();

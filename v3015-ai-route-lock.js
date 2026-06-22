/* ===== V30.1.5 SECURE AI ROUTE LOCK =====
   Keeps every module on the V30.1 secure-proxy-aware router.
   Older legacy routers may still load for compatibility, but they can no
   longer replace Gemini/Firebase routing or force ChatGPT Prompt fallback.
*/
(function(){
  'use strict';

  const VERSION='30.1.5';
  const ROUTE_NAMES=['aiAskRouterV23','aiAsk','callGeminiDirectV23'];
  let secureRouter=null;
  let locked=false;

  function isSecureRouter(fn){
    return typeof fn==='function' && (
      fn===window.__missionV301Router ||
      fn.__v301===true ||
      fn.__v3015===true
    );
  }

  function findSecureRouter(){
    if(isSecureRouter(window.__missionV301Router)) return window.__missionV301Router;
    if(isSecureRouter(window.aiAskRouterV23)) return window.aiAskRouterV23;
    if(isSecureRouter(window.aiAsk)) return window.aiAsk;
    return null;
  }

  function defineLockedRoute(name){
    try{
      const descriptor=Object.getOwnPropertyDescriptor(window,name);
      if(descriptor && descriptor.configurable===false){
        try{ window[name]=secureRouter; }catch(_){ }
        return;
      }
      Object.defineProperty(window,name,{
        configurable:true,
        enumerable:true,
        get(){ return secureRouter; },
        set(candidate){
          // Accept only the current secure V30.1 router. Legacy V23/V28
          // assignments are intentionally ignored and retained for debugging.
          if(isSecureRouter(candidate)){
            secureRouter=candidate;
            secureRouter.__v301=true;
            secureRouter.__v282=true;
            secureRouter.__v3015=true;
            window.__missionV301Router=secureRouter;
          }else if(typeof candidate==='function'){
            window.__blockedLegacyAIRouterV3015=candidate;
          }
        }
      });
    }catch(_){
      try{ window[name]=secureRouter; }catch(__){ }
    }
  }

  function updateVersionBadges(){
    window.__MISSION_UPSC_VERSION__=VERSION;
    const badge=document.querySelector('.versionBadge');
    if(badge) badge.textContent='V30.1.5 • Secure AI Route Lock';
    const build=document.getElementById('v275BuildBadge');
    if(build) build.textContent=`V30.1.5 • ${navigator.onLine?'Online':'Offline'}`;
  }

  function lockSecureRouter(){
    const candidate=findSecureRouter();
    if(!candidate) return false;
    secureRouter=candidate;
    secureRouter.__v301=true;
    secureRouter.__v282=true;
    secureRouter.__v3015=true;
    window.__missionV301Router=secureRouter;
    ROUTE_NAMES.forEach(defineLockedRoute);
    locked=true;
    updateVersionBadges();
    document.dispatchEvent(new CustomEvent('mission-ai-router-locked',{
      detail:{version:VERSION,mode:'secure-v301'}
    }));
    return true;
  }

  function ensureRoute(){
    if(!locked) return lockSecureRouter();
    // Accessor properties stop later legacy overwrites. Re-assert the canonical
    // reference as an additional safeguard for modules that read it directly.
    window.__missionV301Router=secureRouter;
    updateVersionBadges();
    return true;
  }

  window.ensureSecureAIRouterV3015=ensureRoute;

  // Run after each possible legacy/module initialization window.
  [0,60,150,300,600,1000,1800,3000,5000,8000].forEach(delay=>{
    setTimeout(ensureRoute,delay);
  });

  document.addEventListener('DOMContentLoaded',()=>setTimeout(ensureRoute,50),{once:true});
  window.addEventListener('load',()=>setTimeout(ensureRoute,50),{once:true});
  document.addEventListener('mission-ai-settings-changed',ensureRoute);
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden) ensureRoute(); });

  // Guarantee the lock immediately before a Jarvis command executes.
  function patchJarvisEntryPoints(){
    ['jarvisRunV281','jarvisExecutePlanV281'].forEach(name=>{
      const original=window[name];
      if(typeof original!=='function' || original.__v3015RouteGuard) return;
      const guarded=async function(){
        ensureRoute();
        return await original.apply(this,arguments);
      };
      guarded.__v3015RouteGuard=true;
      window[name]=guarded;
    });
  }
  [400,900,1600,3000,6000].forEach(delay=>setTimeout(()=>{
    ensureRoute();
    patchJarvisEntryPoints();
  },delay));
})();

/* ===== V30.1 COMPLETE AI SETUP: GEMINI + OLLAMA + CHATGPT PROMPT + HYBRID ===== */
(function(){
  'use strict';

  const VERSION = '30.1.5';
  const SETTINGS_KEY = 'mission_ai_settings_v23';
  const ROUTER_KEY = 'mission_smart_router_v282';
  const ROUTER_LOG_KEY = 'mission_smart_router_log_v282';
  const CHATGPT_KEY = 'mission_chatgpt_workspace_v301';
  const LAST_PROMPT_KEY = 'mission_last_chatgpt_prompt_v301';
  const LAST_RESPONSE_KEY = 'mission_last_chatgpt_response_v301';
  const DEFAULTS = {
    mode: 'gemini',
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'gemma3:4b',
    geminiKey: '',
    geminiModel: 'gemini-2.5-flash',
    geminiTransport: 'proxy',
    geminiProxyUrl: '',
    hybridPriority: 'smart',
    hybridFallbackChatGPT: true,
    temperature: 0.2,
    maxOutputTokens: 8192
  };

  const $ = id => document.getElementById(id);
  const safeJSON = (raw, fallback) => { try { return JSON.parse(raw); } catch (_) { return fallback; } };
  const readJSON = (key, fallback) => safeJSON(localStorage.getItem(key) || '', fallback);
  const saveJSON = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const today = () => new Date().toISOString().slice(0,10);
  const timeoutFetch = async (url, options={}, ms=150000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try { return await fetch(url, {...options, signal: controller.signal}); }
    finally { clearTimeout(timer); }
  };

  let legacySave = window.saveAISettingsV23;
  let legacyLoad = window.loadAISettingsV23;
  let lastOllamaTest = {ok:null, at:0, message:'Not tested', models:[]};
  let lastProvider = '';

  function settings(){
    return {...DEFAULTS, ...readJSON(SETTINGS_KEY,{})};
  }

  function routerSettings(){
    return {enabled:true, policy:'auto', cloudCap:500, allowMemoryCloud:false, showRoute:true, preferLocal:true, ...readJSON(ROUTER_KEY,{})};
  }

  function modeLabel(mode){
    return mode==='gemini' ? '☁ Gemini API' : mode==='ollama' ? '🖥 Ollama Local' : mode==='chatgpt' ? '📋 ChatGPT Prompt Mode' : '⭐ Smart Hybrid';
  }

  function setStatus(message, type='info'){
    const el = $('aiConnectionStatusV23');
    if(!el) return;
    el.classList.remove('v301Ok','v301Warn','v301Error');
    if(type==='ok') el.classList.add('v301Ok');
    if(type==='warn') el.classList.add('v301Warn');
    if(type==='error') el.classList.add('v301Error');
    el.innerHTML = window.formatAI ? window.formatAI(String(message)) : `<pre>${esc(message)}</pre>`;
  }

  function updateModeVisibility(){
    const mode = document.querySelector('input[name="aiModeV23"]:checked')?.value || settings().mode;
    document.querySelectorAll('[data-v301-mode]').forEach(el => {
      const accepted = String(el.dataset.v301Mode||'').split(',');
      el.hidden = !accepted.includes(mode);
    });
    if($('smartRouterStateV282')) $('smartRouterStateV282').textContent = mode==='hybrid' ? 'Hybrid active' : `${modeLabel(mode)} selected`;
  }

  function updateBadges(provider, reason=''){
    const s = settings();
    const label = modeLabel(s.mode);
    document.querySelectorAll('#aiNotesModeBadgeV231,#pdfAnalyzerModeBadgeV234,#prelimsAIBadgeV251,#mainsAIBadgeV252,#interviewAIBadgeV253,#syllabusAIBadgeV265').forEach(el => {
      if(el) el.textContent = `Selected AI: ${label}`;
    });
    if($('routerGeminiStateV282')) $('routerGeminiStateV282').textContent = s.geminiTransport==='proxy' ? (s.geminiProxyUrl ? 'Proxy ready' : 'Proxy URL missing') : (s.geminiKey ? 'Key saved locally' : 'Key missing');
    if($('routerOllamaStateV282')) $('routerOllamaStateV282').textContent = lastOllamaTest.ok===true ? 'Connected' : lastOllamaTest.ok===false ? 'Unavailable' : 'Not tested';
    if($('routerChatGPTStateV282')) $('routerChatGPTStateV282').textContent = 'Ready';
    if(provider && $('routerLastProviderV282')) $('routerLastProviderV282').textContent = provider;
    if(provider && $('smartRouterStatusV282')) $('smartRouterStatusV282').innerHTML = `<b>Last route:</b> ${esc(provider)}${reason?`<br><small>${esc(reason)}</small>`:''}`;
    if($('jarvisAIModeV281')) $('jarvisAIModeV281').textContent = `AI mode: ${label.replace(/^[^A-Za-z]+/,'')}`;
  }

  function currentSettingsFromUI(){
    const old = settings();
    return {
      ...old,
      mode: document.querySelector('input[name="aiModeV23"]:checked')?.value || old.mode,
      ollamaUrl: ($('ollamaUrlV23')?.value || old.ollamaUrl || DEFAULTS.ollamaUrl).trim().replace(/\/$/,''),
      ollamaModel: ($('ollamaModelV23')?.value || old.ollamaModel || DEFAULTS.ollamaModel).trim(),
      geminiKey: ($('geminiKeyV23')?.value || old.geminiKey || '').trim(),
      geminiModel: ($('geminiModelV301')?.value || old.geminiModel || DEFAULTS.geminiModel).trim(),
      geminiTransport: $('geminiTransportV301')?.value || old.geminiTransport || 'direct',
      geminiProxyUrl: ($('geminiProxyUrlV301')?.value || old.geminiProxyUrl || '').trim().replace(/\/$/,''),
      hybridPriority: $('hybridPriorityV301')?.value || old.hybridPriority || 'smart',
      hybridFallbackChatGPT: $('hybridFallbackChatGPTV301') ? $('hybridFallbackChatGPTV301').checked : old.hybridFallbackChatGPT,
      temperature: Math.max(0,Math.min(1,Number($('aiTemperatureV301')?.value ?? old.temperature ?? .2))),
      maxOutputTokens: Math.max(512,Math.min(65536,Number($('aiMaxTokensV301')?.value ?? old.maxOutputTokens ?? 8192)))
    };
  }

  window.saveAISettingsV23 = function(){
    try { if(typeof legacySave==='function') legacySave.apply(this, arguments); } catch (_) {}
    const s = currentSettingsFromUI();
    saveJSON(SETTINGS_KEY,s);
    updateModeVisibility();
    updateBadges();
    setStatus(`Saved ✅\nSelected mode: ${modeLabel(s.mode)}\nGemini model: ${s.geminiModel}\nOllama model: ${s.ollamaModel}\nHybrid policy: ${s.hybridPriority}`,'ok');
    document.dispatchEvent(new CustomEvent('mission-ai-settings-changed',{detail:{...s,geminiKey:s.geminiKey?'saved':''}}));
    return s;
  };

  window.loadAISettingsV23 = function(){
    try { if(typeof legacyLoad==='function') legacyLoad.apply(this, arguments); } catch (_) {}
    const s = settings();
    document.querySelectorAll('input[name="aiModeV23"]').forEach(r => r.checked = r.value===s.mode);
    if($('ollamaUrlV23')) $('ollamaUrlV23').value = s.ollamaUrl;
    if($('ollamaModelV23')) $('ollamaModelV23').value = s.ollamaModel;
    if($('geminiKeyV23')) $('geminiKeyV23').value = s.geminiKey || '';
    if($('geminiModelV301')) $('geminiModelV301').value = s.geminiModel;
    if($('geminiTransportV301')) $('geminiTransportV301').value = s.geminiTransport;
    if($('geminiProxyUrlV301')) $('geminiProxyUrlV301').value = s.geminiProxyUrl || '';
    if($('hybridPriorityV301')) $('hybridPriorityV301').value = s.hybridPriority;
    if($('hybridFallbackChatGPTV301')) $('hybridFallbackChatGPTV301').checked = s.hybridFallbackChatGPT!==false;
    if($('aiTemperatureV301')) $('aiTemperatureV301').value = s.temperature;
    if($('aiMaxTokensV301')) $('aiMaxTokensV301').value = s.maxOutputTokens;
    updateModeVisibility();
    updateTransportVisibilityV301();
    updateBadges();
    setStatus(`Selected AI: ${modeLabel(s.mode)}\nGemini: ${s.geminiTransport==='proxy'?(s.geminiProxyUrl?'Secure proxy configured':'Proxy URL not added'):(s.geminiKey?'API key saved on this device':'API key not added')}\nOllama: ${s.ollamaModel}`);
    loadChatGPTWorkspace();
  };

  window.toggleGeminiKeyV301 = function(){
    const input = $('geminiKeyV23');
    if(!input) return;
    input.type = input.type==='password' ? 'text' : 'password';
    const btn = $('toggleGeminiKeyBtnV301');
    if(btn) btn.textContent = input.type==='password' ? 'Show' : 'Hide';
  };

  window.updateTransportVisibilityV301 = function(){
    const transport = $('geminiTransportV301')?.value || settings().geminiTransport;
    const direct = $('geminiDirectFieldsV301');
    const proxy = $('geminiProxyFieldsV301');
    if(direct) direct.hidden = transport!=='direct';
    if(proxy) proxy.hidden = transport!=='proxy';
  };

  function classify(prompt){
    const text = String(prompt||'').toLowerCase();
    const length = text.length;
    if(/evaluate|evaluator|marks|mains answer|ethics case|model answer|answer writing/.test(text)) return {task:'evaluation',complexity:5};
    if(/current affairs|newspaper|editorial|pib|daily ca|latest issue/.test(text)) return {task:'current-affairs',complexity:5};
    if(/mentor|weekly plan|strategy|readiness|diagnos|roadmap|saarathi/.test(text)) return {task:'strategy',complexity:4};
    if(length>12000 || /pdf|long document|chapter|report text/.test(text)) return {task:'long-document',complexity:4};
    if(/flashcard|quick summary|rewrite|format|short note/.test(text)) return {task:'quick',complexity:2};
    return {task:'general',complexity:3};
  }

  function examEnvelope(prompt){
    const p = String(prompt||'').trim();
    return `You are JARVIS, a rigorous UPSC Civil Services Examination assistant. Follow the user's requested format exactly. Be exam-oriented, factual, source-conscious and concise. Never invent a report, judgment, data point, PYQ or constitutional provision. Clearly say when a fact needs verification. Use Indian English and UPSC terminology.\n\nUSER TASK:\n${p}`;
  }

  function monthKey(){ return new Date().toISOString().slice(0,7); }
  function logs(){ const value=readJSON(ROUTER_LOG_KEY,[]); return Array.isArray(value)?value:[]; }
  function cloudCallsThisMonth(){ return logs().filter(x => x.provider==='gemini' && x.ok && String(x.time||'').slice(0,7)===monthKey()).length; }
  function logRoute(entry){
    const list = logs();
    list.unshift({time:new Date().toISOString(),...entry});
    saveJSON(ROUTER_LOG_KEY,list.slice(0,300));
    const r = routerSettings();
    if($('routerCallsMonthV282')) $('routerCallsMonthV282').textContent = `${cloudCallsThisMonth()}/${r.cloudCap} Gemini calls`;
    if($('routerAvgTimeV282')){
      const ok=list.filter(x=>x.ok&&Number.isFinite(Number(x.ms))).slice(0,50);
      $('routerAvgTimeV282').textContent = ok.length ? `${(ok.reduce((a,x)=>a+Number(x.ms),0)/ok.length/1000).toFixed(1)}s` : '—';
    }
  }

  async function testOllama(force=false){
    if(!force && Date.now()-lastOllamaTest.at<45000 && lastOllamaTest.ok!==null) return lastOllamaTest;
    const s=settings();
    try{
      const response=await timeoutFetch(`${s.ollamaUrl}/api/tags`,{method:'GET'},5000);
      if(!response.ok) throw new Error(`HTTP ${response.status}`);
      const data=await response.json();
      const models=(data.models||[]).map(x=>x.name||x.model).filter(Boolean);
      lastOllamaTest={ok:true,at:Date.now(),message:'Connected',models};
      const list=$('ollamaModelsV301');
      if(list) list.innerHTML=models.map(name=>`<option value="${esc(name)}"></option>`).join('');
      if(models.length && !models.includes(s.ollamaModel) && $('ollamaModelV23')) $('ollamaModelV23').value=models[0];
      updateBadges();
      return lastOllamaTest;
    }catch(error){
      lastOllamaTest={ok:false,at:Date.now(),message:error.name==='AbortError'?'Connection timed out':error.message,models:[]};
      updateBadges();
      return lastOllamaTest;
    }
  }

  window.detectOllamaModelsV301 = async function(){
    setStatus('Checking Ollama and reading installed models...');
    const result=await testOllama(true);
    if(result.ok){
      setStatus(`Ollama connected ✅\nInstalled models: ${result.models.length?result.models.join(', '):'No models returned'}\nSelected model: ${$('ollamaModelV23')?.value||settings().ollamaModel}`,'ok');
    }else setStatus(`Ollama connection failed: ${result.message}\nRun Ollama on this laptop and keep the URL as http://localhost:11434.`,`error`);
  };

  async function askOllama(prompt){
    const s=settings();
    const response=await timeoutFetch(`${s.ollamaUrl}/api/generate`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({model:s.ollamaModel,prompt:examEnvelope(prompt),stream:false,options:{temperature:s.temperature,num_predict:s.maxOutputTokens}})
    },240000);
    if(!response.ok) throw new Error(`Ollama ${response.status}: ${await response.text()}`);
    const data=await response.json();
    if(!data.response) throw new Error('Ollama returned an empty response.');
    return data.response;
  }

  function geminiModels(s){
    const list=[s.geminiModel,'gemini-2.5-flash','gemini-2.5-flash-lite'];
    return [...new Set(list.filter(Boolean))];
  }

  async function askGeminiDirect(prompt, model){
    const s=settings();
    if(!s.geminiKey) throw new Error('Gemini API key missing. Paste it in AI Control Centre.');
    const response=await timeoutFetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{
      method:'POST',
      headers:{'Content-Type':'application/json','x-goog-api-key':s.geminiKey},
      body:JSON.stringify({
        system_instruction:{parts:[{text:'You are JARVIS, a rigorous UPSC CSE assistant. Follow requested formats exactly and never invent facts, sources, reports, judgments or PYQs.'}]},
        contents:[{role:'user',parts:[{text:String(prompt||'')}]}],
        generationConfig:{temperature:s.temperature,maxOutputTokens:s.maxOutputTokens}
      })
    },210000);
    const data=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(data?.error?.message || `Gemini HTTP ${response.status}`);
    const out=data?.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join('\n').trim();
    if(!out){
      const reason=data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason || 'Empty response';
      throw new Error(`Gemini returned no text: ${reason}`);
    }
    return out;
  }

  async function askGeminiProxy(prompt, model){
    const s=settings();
    if(!s.geminiProxyUrl) throw new Error('Firebase Gemini proxy URL missing.');
    if(typeof window.getFirebaseIdTokenV301!=='function') throw new Error('Firebase login bridge is unavailable. Refresh the page and sign in.');

    const callProxy=async(forceRefresh=false)=>{
      const idToken=await window.getFirebaseIdTokenV301(forceRefresh);
      return await timeoutFetch(s.geminiProxyUrl,{
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'Authorization':`Bearer ${idToken}`
        },
        body:JSON.stringify({prompt:String(prompt||''),model,temperature:s.temperature,maxOutputTokens:s.maxOutputTokens})
      },210000);
    };

    let response=await callProxy(false);
    if(response.status===401) response=await callProxy(true);
    const data=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(data?.error || data?.message || `Proxy HTTP ${response.status}`);
    const out=data?.result || data?.text;
    if(!out) throw new Error('Gemini proxy returned no text.');
    return out;
  }

  async function askGemini(prompt){
    const s=settings();
    let lastError='Gemini unavailable';
    for(const model of geminiModels(s)){
      try{
        const out=s.geminiTransport==='proxy' ? await askGeminiProxy(examEnvelope(prompt),model) : await askGeminiDirect(examEnvelope(prompt),model);
        return out;
      }catch(error){ lastError=`${model}: ${error.message}`; }
    }
    throw new Error(lastError);
  }

  function saveLastPrompt(prompt, task='general'){
    localStorage.setItem(LAST_PROMPT_KEY,prompt);
    const state=readJSON(CHATGPT_KEY,{});
    const validTasks=['mains-evaluator','topper-answer','current-affairs','prelims','ethics','essay','saarathi','notes'];
    const nextTask=validTasks.includes(task)?task:(validTasks.includes(state.task)?state.task:'notes');
    saveJSON(CHATGPT_KEY,{...state,prompt,task:nextTask,sourceTask:task,updatedAt:new Date().toISOString()});
    if($('chatgptPromptV301')) $('chatgptPromptV301').value=prompt;
  }

  async function prepareChatGPT(prompt, task='general'){
    const full=examEnvelope(prompt);
    saveLastPrompt(full,task);
    try{await navigator.clipboard.writeText(full);}catch(_){ }
    return `# ChatGPT Prompt Mode\n\nYour UPSC prompt is ready and has been placed in the ChatGPT Prompt Workspace.\n\n1. Open ChatGPT.\n2. Paste the prompt.\n3. Run it.\n4. Copy the response back into the Paste Response box.\n\n## Prepared prompt\n\n${full}`;
  }

  function routeOrder(prompt){
    const s=settings();
    const r=routerSettings();
    const type=classify(prompt);
    if(r.policy==='quality') return ['gemini','ollama'];
    if(r.policy==='free') return ['ollama','gemini'];
    if(s.hybridPriority==='gemini-first') return ['gemini','ollama'];
    if(s.hybridPriority==='ollama-first') return ['ollama','gemini'];
    const privateRequest=/my personal|my profile|my notes|my score|private|confidential/i.test(String(prompt||''));
    const geminiPreferred=['evaluation','current-affairs','strategy','long-document'].includes(type.task);
    if(privateRequest && r.preferLocal) return ['ollama','gemini'];
    if(geminiPreferred) return ['gemini','ollama'];
    return r.preferLocal ? ['ollama','gemini'] : ['gemini','ollama'];
  }

  async function runProvider(provider,prompt){
    const started=Date.now();
    try{
      const result=provider==='gemini' ? await askGemini(prompt) : provider==='ollama' ? await askOllama(prompt) : await prepareChatGPT(prompt,classify(prompt).task);
      logRoute({provider,task:classify(prompt).task,ok:true,ms:Date.now()-started,promptChars:String(prompt||'').length});
      lastProvider=provider;
      updateBadges(provider,`${classify(prompt).task} request`);
      document.dispatchEvent(new CustomEvent('mission-ai-route',{detail:{provider,reason:`${classify(prompt).task} request`,time:new Date().toISOString()}}));
      return result;
    }catch(error){
      logRoute({provider,task:classify(prompt).task,ok:false,ms:Date.now()-started,error:error.message,promptChars:String(prompt||'').length});
      throw error;
    }
  }

  async function smartAsk(prompt){
    const s=settings();
    if(!String(prompt||'').trim()) throw new Error('Enter a prompt first.');
    if(s.mode!=='hybrid') return runProvider(s.mode,prompt);

    const r=routerSettings();
    const order=routeOrder(prompt);
    const errors=[];
    for(const provider of order){
      if(provider==='gemini' && cloudCallsThisMonth()>=Number(r.cloudCap||500)){
        errors.push(`Gemini skipped: monthly request guard ${r.cloudCap} reached`);
        continue;
      }
      if(provider==='ollama'){
        const state=await testOllama(false);
        if(!state.ok){errors.push(`Ollama unavailable: ${state.message}`);continue;}
      }
      try{return await runProvider(provider,prompt);}catch(error){errors.push(`${provider}: ${error.message}`);}
    }
    if(s.hybridFallbackChatGPT!==false){
      return runProvider('chatgpt',`${prompt}\n\nHYBRID FALLBACK NOTE: ${errors.join(' | ')}`);
    }
    throw new Error(errors.join(' | ') || 'No AI provider is available.');
  }
  smartAsk.__v301=true;
  // Compatibility flag: prevents the older V28.2 router from wrapping and
  // replacing this secure-proxy-aware V30.1 router after page load.
  smartAsk.__v282=true;

  function installV301Router(){
    window.aiAskRouterV23=smartAsk;
    window.aiAsk=smartAsk;
    window.callGeminiDirectV23=smartAsk;
    window.__missionV301Router=smartAsk;
  }
  installV301Router();

  window.testGeminiV301 = async function(){
    window.saveAISettingsV23();
    setStatus('Testing Gemini API...');
    try{
      const out=await runProvider('gemini','Reply exactly: Gemini connection is working for Mission UPSC.');
      setStatus(`Gemini connected ✅\n${out}`,'ok');
    }catch(error){
      setStatus(`Gemini test failed ❌\n${error.message}\n\nCheck the key, billing/project, API restriction and selected model.`,'error');
    }
  };

  window.testOllamaV301 = async function(){
    window.saveAISettingsV23();
    const state=await testOllama(true);
    if(!state.ok){setStatus(`Ollama test failed ❌\n${state.message}`,'error');return;}
    setStatus('Ollama server found. Testing generation...');
    try{
      const out=await runProvider('ollama','Reply exactly: Ollama connection is working for Mission UPSC.');
      setStatus(`Ollama connected ✅\n${out}`,'ok');
    }catch(error){setStatus(`Ollama model test failed ❌\n${error.message}`,'error');}
  };

  window.testAIConnectionV23 = async function(){
    const s=window.saveAISettingsV23();
    if(s.mode==='gemini') return window.testGeminiV301();
    if(s.mode==='ollama') return window.testOllamaV301();
    if(s.mode==='chatgpt'){
      setStatus('ChatGPT Prompt Mode is ready ✅\nGenerate a prompt below, copy it, open ChatGPT, then paste the response back here.','ok');
      return;
    }
    setStatus('Testing Hybrid Mode: Gemini, Ollama and ChatGPT fallback...');
    const geminiReady=s.geminiTransport==='proxy' ? !!s.geminiProxyUrl : !!s.geminiKey;
    const ollama=await testOllama(true);
    setStatus(`Hybrid Mode ready ✅\nPriority: ${s.hybridPriority}\nGemini: ${geminiReady?'Configured':'Not configured'}\nOllama: ${ollama.ok?'Connected':`Unavailable (${ollama.message})`}\nChatGPT fallback: ${s.hybridFallbackChatGPT?'Enabled':'Disabled'}`,'ok');
  };

  window.runAITestPromptV23 = async function(){
    window.saveAISettingsV23();
    const box=$('aiPromptOutputV23');
    const prompt=($('aiPromptTestV23')?.value||'Create UPSC one-page notes on Article 14 with PYQ angle.').trim();
    if(box) box.innerHTML='<div class="aiLoading">Running selected AI...</div>';
    try{
      const result=await smartAsk(prompt);
      if(box) box.innerHTML=`<div class="aiProviderBadge">${esc(modeLabel(settings().mode))}${lastProvider?` • Used ${esc(lastProvider)}`:''}</div>${window.formatAI?window.formatAI(result):`<pre>${esc(result)}</pre>`}`;
    }catch(error){ if(box) box.innerHTML=`<div class="v301ErrorText">AI error: ${esc(error.message)}</div>`; }
  };

  window.copyLastChatGPTPromptV23 = async function(){
    const prompt=localStorage.getItem(LAST_PROMPT_KEY) || $('chatgptPromptV301')?.value || examEnvelope($('aiPromptTestV23')?.value||'Create UPSC notes.');
    saveLastPrompt(prompt);
    try{await navigator.clipboard.writeText(prompt);alert('ChatGPT prompt copied.');}
    catch(_){alert('Clipboard permission was blocked. Select the prompt and copy it manually.');}
  };

  function evaluatorPrompt({question,answer,marks,paper}){
    const wordLimit=marks===15?250:150;
    return `Act as a Senior UPSC CSE Mains Evaluator with 15+ years of experience.\n\nEvaluate my answer strictly according to UPSC standards, not school or coaching-level generosity.\n\nQuestion:\n${question||'[Paste Question]'}\n\nPaper:\n${paper||'General Studies'}\n\nMarks:\n${marks}\n\nWord Limit:\n${wordLimit}\n\nMy Answer:\n${answer||'[Paste Answer]'}\n\nEvaluate using the following structure:\n\n1. Question Demand Analysis\n- Identify directive (Discuss, Examine, Analyse, Critically Examine, Evaluate, Comment etc.)\n- Decode the exact UPSC demand.\n- Break the question into sub-parts.\n\nProvide a Demand Coverage Matrix:\nDemand Component | Status\nPart 1 | ✓ / △ / ✗\nPart 2 | ✓ / △ / ✗\nPart 3 | ✓ / △ / ✗\n\n2. Expected Answer Framework\nProvide UPSC ideal structure: Introduction, Main Body, expected subheadings, Conclusion.\n\n3. Strengths\nMention 5 specific strengths.\n\n4. Weaknesses\nMention 5 specific weaknesses.\n\n5. Important Keywords\nSeparate into Wrote ✓ and Missed ✗.\n\n6. Ideal Subheadings\nProvide UPSC-friendly subheadings that should have been used.\n\n7. Committees / Commissions / Reports\nSeparate into Wrote ✓ and Missed ✗. Mention only relevant committees, commissions, NITI Aayog, government and international reports.\n\n8. Constitutional / Legal / Institutional Provisions\nSeparate into Wrote ✓ and Missed ✗. Include relevant Articles, amendments, Acts, policies, conventions, treaties and institutions.\n\n9. Value Addition Tracker\nSeparate into Wrote ✓ and Missed ✗. Check facts/data, examples, case studies, judgments, schemes, reports, diagrams, flowcharts and maps.\n\n10. Missing Dimensions\nMention only genuinely missing dimensions among historical, social, economic, political, constitutional, administrative, ethical, environmental, technological, international, security and gender.\n\n11. Line-by-Line Improvement\nQuote weak lines from my answer, rewrite them in UPSC style, and explain why the rewrite scores higher.\n\n12. Suggested Value Additions\nProvide 2 facts/data, 2 examples, 1 committee/report, 1 Supreme Court judgment if applicable, 1 government initiative, 1 case study and 1 diagram/flowchart. Do not fabricate.\n\n13. Model Introduction\n20–30 words.\n\n14. Model Conclusion\n20–30 words.\n\n15. Marks Evaluation\nDemand Fulfilment: __/10\nContent Quality: __/10\nStructure & Presentation: __/5\nValue Addition: __/5\nLanguage & Expression: __/5\nTotal Score: __/${marks}\n\n16. Final Verdict\nClassify Poor (<40%), Average (40–55%), Good (55–65%), Very Good (65–75%), or Topper Level (75%+).\n\n17. Highest Mark-Losing Mistake\nIdentify the single biggest reason marks were lost.\n\n18. Fastest Improvement Area\nMention the one improvement that will produce the highest score gain.\n\n19. Examiner's Final Comment\nWrite a realistic UPSC evaluator comment in 50 words.\n\nImportant: Be brutally honest. Do not inflate marks. Evaluate exactly as a serious UPSC Mains evaluator would.`;
  }

  function topperAnswerPrompt({question,marks,paper,source}){
    const maxWords=marks===15?280:170;
    const subparts=marks===15?3:2;
    return `Act as an expert UPSC CSE Mains answer writer. Write the final answer to the question below.\n\nQuestion:\n${question||'[Paste Question]'}\n\nPaper / Subject:\n${paper||'General Studies'}\n\nMarks:\n${marks}\n\nMaximum answer length:\n${maxWords} words. Do not exceed this limit.\n\nSource material, if any:\n${source||'Use only reliable and defensible knowledge. Do not fabricate data or sources.'}\n\nMandatory rules:\n1. For a 10-marker, identify exactly 2 subparts. For a 15-marker, identify exactly 3 subparts. If the question does not naturally yield the required number, frame the remaining subparts as challenges or opportunities according to the tone.\n2. Write a 15–20 word introduction based on a fact, quote or data point, with the source named in the same sentence.\n3. Create one bold subheading for each subpart. Every subheading must be 5–7 words, crisp, and visibly map to the demand.\n4. Under each subheading, write exactly 5 numbered points. Every point must be 7–9 words, syllabus-oriented and keyword-rich.\n5. Immediately below every numbered point, add one supporting example beginning with “e.g.-”. The example must not exceed 7 words, followed by a 2–3 word source in square brackets. Prioritise verified numbers, figures, case studies and real events.\n6. Keep a line break after every point. The example line must not be numbered.\n7. Add the bold subheading “Way Forward” only. Under it, write exactly 3 forward-looking points, each no more than 8 words, naming relevant schemes, best practices, initiatives or case studies.\n8. End with a 10–15 word optimistic conclusion referring, where relevant, to SDGs, Viksit Bharat, constitutional values or a defensible Economic Survey/government vision phrase.\n9. Do not invent a source, data point, scheme, judgment or case study. Omit unverifiable value additions.\n10. Total final answer must remain within ${maxWords} words.\n\nBefore the final answer, show a one-line demand split containing exactly ${subparts} subparts. Then provide only the finished answer.`;
  }

  function currentAffairsPrompt({question,source,paper}){
    return `Act as a senior UPSC Current Affairs analyst. Analyse the supplied issue in a Tracker-style, exam-oriented format.\n\nTopic / Question:\n${question||'[Enter current affairs topic]'}\n\nSource text:\n${source||'[Paste article/editorial/PIB text]'}\n\nPreferred paper:\n${paper||'Auto-detect'}\n\nReturn these sections:\n1. Topic title and date/source\n2. 80-word simple explanation\n3. What happened and why now\n4. Background and timeline\n5. UPSC syllabus mapping: GS paper, exact syllabus phrase, Prelims/Mains/Essay/Ethics relevance\n6. Tags and importance rating\n7. Stakeholders\n8. Prelims facts and likely traps\n9. Mains dimensions: constitutional, political, social, economic, administrative, environmental, technological, security, ethical and international—only where relevant\n10. Opportunities, challenges and criticisms\n11. Government initiatives, laws, institutions, reports and data\n12. Related PYQs—cite only genuine PYQs; otherwise state “Needs verification”\n13. One probable Prelims MCQ with explanation\n14. One 10-marker and one 15-marker Mains question\n15. 250-word model answer\n16. Text mind map\n17. Ten flashcards\n18. One-page revision capsule\n\nDo not invent facts or sources. Distinguish source facts from analysis.`;
  }

  function prelimsPrompt({question,source,paper}){
    return `Act as a UPSC Prelims question analyst.\n\nQuestion / Topic:\n${question||'[Paste question or topic]'}\n\nSource material:\n${source||'[Optional source notes]'}\n\nSubject:\n${paper||'Auto-detect'}\n\nProvide: concept tested, statement-wise truth analysis, elimination clues, common traps, linked static concepts, current-affairs linkage, why each option is right/wrong, final answer, five similar UPSC-standard MCQs, and a ten-line revision capsule. Never fabricate a PYQ year or source.`;
  }

  function ethicsPrompt({question,answer,source}){
    return `Act as a strict UPSC GS4 Ethics mentor.\n\nCase / Question:\n${question||'[Paste case study]'}\n\nMy answer, if evaluating:\n${answer||'[Optional answer]'}\n\nReference material:\n${source||'[Optional]'}\n\nIdentify stakeholders, ethical issues, values, conflicts, options with merits/demerits, constitutional and civil-service values, best course of action, implementation safeguards, concise conclusion, useful thinkers/quotes, and a realistic marks assessment if an answer is supplied. Avoid generic moralising.`;
  }

  function essayPrompt({question,source}){
    return `Act as a UPSC Essay mentor. Build a multidimensional, original essay plan for:\n${question||'[Paste essay topic]'}\n\nSource material:\n${source||'[Optional]'}\n\nGive: interpretation of topic, central thesis, engaging anecdotal/data introduction, 10–12 dimensions, Indian and global examples, counter-view, smooth transitions, constitutional/philosophical anchors, conclusion, quote bank, and a 1200-word writing blueprint. Do not invent quotations.`;
  }

  function saarathiPrompt({question,source}){
    return `Act as JARVIS Saarathi Plan Extractor. Convert the mentor's weekly plan into an actionable UPSC system.\n\nMentor instruction / context:\n${question||''}\n${source||''}\n\nExtract and return valid JSON first, followed by a readable plan. JSON schema:\n{"weekTitle":"","startDate":"","endDate":"","subjects":[{"subject":"","topics":[],"resources":[],"priority":"High|Medium|Low"}],"dailyTasks":[{"day":"","date":"","task":"","subject":"","type":"Study|Revision|Mains Answer|Prelims Test|Mock|Current Affairs","durationMinutes":0,"deadline":"","priority":"High|Medium|Low"}],"mainsTargets":[{"questionOrTopic":"","paper":"","marks":10,"day":""}],"revisionTasks":[],"tests":[],"doubts":[],"mentorFollowups":[]}\n\nRules: preserve every target, infer dates only when logically possible, mark uncertain items clearly, balance workload without deleting mentor instructions, and produce a daily checklist plus Sunday review.`;
  }

  function generalNotesPrompt({question,source,paper}){
    return `Act as a senior UPSC mentor. Create exam-ready notes on:\n${question||'[Enter topic]'}\n\nPaper / Subject:\n${paper||'Auto-detect'}\n\nSource material:\n${source||'[Optional]'}\n\nInclude definition, background, syllabus mapping, core concepts, Prelims facts, Mains dimensions, constitutional/legal provisions, data/reports, examples, challenges, way forward, genuine PYQ linkage, model 10-marker framework, mind map, flashcards and revision capsule. Do not fabricate sources.`;
  }

  function workspaceValues(){
    const marks=Number($('chatgptMarksV301')?.value||10)===15?15:10;
    return {
      task:$('chatgptTaskV301')?.value||'mains-evaluator',
      marks,
      paper:($('chatgptPaperV301')?.value||'').trim(),
      question:($('chatgptQuestionV301')?.value||'').trim(),
      answer:($('chatgptAnswerV301')?.value||'').trim(),
      source:($('chatgptSourceV301')?.value||'').trim()
    };
  }

  function buildWorkspacePrompt(values=workspaceValues()){
    switch(values.task){
      case 'mains-evaluator': return evaluatorPrompt(values);
      case 'topper-answer': return topperAnswerPrompt(values);
      case 'current-affairs': return currentAffairsPrompt(values);
      case 'prelims': return prelimsPrompt(values);
      case 'ethics': return ethicsPrompt(values);
      case 'essay': return essayPrompt(values);
      case 'saarathi': return saarathiPrompt(values);
      default: return generalNotesPrompt(values);
    }
  }

  function saveWorkspace(){
    const values=workspaceValues();
    const state={...values,prompt:$('chatgptPromptV301')?.value||'',response:$('chatgptResponseV301')?.value||'',updatedAt:new Date().toISOString()};
    saveJSON(CHATGPT_KEY,state);
    if(state.prompt) localStorage.setItem(LAST_PROMPT_KEY,state.prompt);
    if(state.response) localStorage.setItem(LAST_RESPONSE_KEY,state.response);
    return state;
  }

  function loadChatGPTWorkspace(){
    const state=readJSON(CHATGPT_KEY,{});
    if($('chatgptTaskV301') && state.task) $('chatgptTaskV301').value=state.task;
    if($('chatgptMarksV301') && state.marks) $('chatgptMarksV301').value=String(state.marks);
    if($('chatgptPaperV301')) $('chatgptPaperV301').value=state.paper||'';
    if($('chatgptQuestionV301')) $('chatgptQuestionV301').value=state.question||'';
    if($('chatgptAnswerV301')) $('chatgptAnswerV301').value=state.answer||'';
    if($('chatgptSourceV301')) $('chatgptSourceV301').value=state.source||'';
    if($('chatgptPromptV301')) $('chatgptPromptV301').value=state.prompt||localStorage.getItem(LAST_PROMPT_KEY)||'';
    if($('chatgptResponseV301')) $('chatgptResponseV301').value=state.response||localStorage.getItem(LAST_RESPONSE_KEY)||'';
    window.updateChatGPTTemplateV301(false);
  }

  window.updateChatGPTTemplateV301 = function(regenerate=true){
    const task=$('chatgptTaskV301')?.value||'mains-evaluator';
    const marks=$('chatgptMarksV301');
    const answerWrap=$('chatgptAnswerWrapV301');
    const sourceLabel=$('chatgptSourceLabelV301');
    if(marks) marks.disabled=!['mains-evaluator','topper-answer'].includes(task);
    if(answerWrap) answerWrap.hidden=!['mains-evaluator','ethics'].includes(task);
    if(sourceLabel) sourceLabel.textContent=task==='saarathi'?'Mentor plan / PDF extracted text':task==='current-affairs'?'Article / editorial / PIB text':'Source material / notes (optional)';
    if(regenerate) window.generateChatGPTPromptV301();
  };

  window.generateChatGPTPromptV301 = function(){
    const prompt=buildWorkspacePrompt();
    if($('chatgptPromptV301')) $('chatgptPromptV301').value=prompt;
    saveLastPrompt(prompt,workspaceValues().task);
    saveWorkspace();
    const status=$('chatgptWorkspaceStatusV301');
    if(status) status.textContent='Exam-oriented prompt generated. Copy it or open ChatGPT.';
    return prompt;
  };

  window.copyChatGPTPromptV301 = async function(){
    const prompt=$('chatgptPromptV301')?.value.trim() || window.generateChatGPTPromptV301();
    saveLastPrompt(prompt,workspaceValues().task);
    try{await navigator.clipboard.writeText(prompt);$('chatgptWorkspaceStatusV301').textContent='Prompt copied. Open ChatGPT and paste it.';}
    catch(_){$('chatgptWorkspaceStatusV301').textContent='Clipboard permission blocked. Select the prompt and copy manually.';}
  };

  window.openChatGPTV301 = async function(){
    const opened=window.open('https://chatgpt.com/','_blank');
    await window.copyChatGPTPromptV301();
    if(!opened) $('chatgptWorkspaceStatusV301').textContent='Pop-up blocked. Allow pop-ups, then press Open ChatGPT again.';
  };

  window.pasteChatGPTResponseV301 = async function(){
    const box=$('chatgptResponseV301');
    if(!box) return;
    try{
      const text=await navigator.clipboard.readText();
      if(!text.trim()) throw new Error('Clipboard is empty');
      box.value=text;
      saveWorkspace();
      $('chatgptWorkspaceStatusV301').textContent='ChatGPT response pasted. Save it or send it to the relevant module.';
    }catch(error){
      box.focus();
      $('chatgptWorkspaceStatusV301').textContent=`Automatic paste unavailable (${error.message}). Long-press/right-click and paste manually.`;
    }
  };

  window.saveChatGPTResponseV301 = async function(){
    const state=saveWorkspace();
    const body=String(state.response||'').trim();
    if(!body) return alert('Paste the ChatGPT response first.');
    const titleMap={
      'mains-evaluator':'ChatGPT Mains Evaluation',
      'topper-answer':'ChatGPT Topper Model Answer',
      'current-affairs':'ChatGPT Current Affairs Analysis',
      'prelims':'ChatGPT Prelims Analysis',
      'ethics':'ChatGPT Ethics Analysis',
      'essay':'ChatGPT Essay Framework',
      'saarathi':'ChatGPT Saarathi Plan',
      'notes':'ChatGPT UPSC Notes'
    };
    const title=`${titleMap[state.task]||'ChatGPT UPSC Output'} - ${(state.question||today()).slice(0,80)}`;
    if(typeof window.saveCol==='function'){
      await window.saveCol('notes',{title,subject:state.paper||'AI',body,date:today(),type:'ChatGPT Prompt Output',source:'AI Control Centre v30.1'});
      if(state.task==='mains-evaluator') await window.saveCol('mainsReports',{paper:state.paper||'Mains',question:state.question,body,marks:state.marks,date:today(),source:'ChatGPT Prompt Mode v30.1'});
      if(state.task==='current-affairs') await window.saveCol('currentAffairsAI',{title:state.question||'Current Affairs',subject:state.paper||'Current Affairs',body,date:today(),source:'ChatGPT Prompt Mode v30.1'});
      if(state.task==='saarathi') await window.saveCol('mentorAdvice',{question:state.question||'Saarathi weekly plan',body,date:today(),source:'ChatGPT Prompt Mode v30.1'});
    }else{
      const notes=readJSON('notes',[]);notes.unshift({id:`local_${Date.now()}`,title,subject:state.paper||'AI',body,date:today()});saveJSON('notes',notes);
    }
    $('chatgptWorkspaceStatusV301').textContent='Response saved to JARVIS Notes and the relevant tracker.';
    alert('ChatGPT response saved.');
  };

  window.sendChatGPTResponseToModuleV301 = function(){
    const state=saveWorkspace();
    const body=String(state.response||'').trim();
    if(!body) return alert('Paste the ChatGPT response first.');
    const targets={
      'mains-evaluator':['mainsWarManualEvaluationV252','mainsWarEvaluationV252','mainsAIReport','answerEvalOutput'],
      'current-affairs':['caAIOutput'],
      'prelims':['prelimsEliminationOutputV251'],
      'ethics':['mainsWarEvaluationV252','mainsAIReport'],
      'essay':['topperAIOutput'],
      'saarathi':['mentorMainOutput'],
      'notes':['notesOutput'],
      'topper-answer':['topperAIOutput','notesOutput']
    };
    const ids=targets[state.task]||['notesOutput'];
    let target=null;
    for(const id of ids){if($(id)){target=$(id);break;}}
    if(!target) return alert('Relevant module output box was not found. Use Save Response instead.');
    if('value' in target) target.value=body; else target.innerHTML=window.formatAI?window.formatAI(body):`<pre>${esc(body)}</pre>`;
    $('chatgptWorkspaceStatusV301').textContent=`Response sent to ${target.id}.`;
    alert('Response inserted into the relevant JARVIS module.');
  };

  window.clearChatGPTWorkspaceV301 = function(){
    if(!confirm('Clear the ChatGPT prompt workspace on this device?')) return;
    [CHATGPT_KEY,LAST_PROMPT_KEY,LAST_RESPONSE_KEY].forEach(k=>localStorage.removeItem(k));
    ['chatgptQuestionV301','chatgptAnswerV301','chatgptSourceV301','chatgptPromptV301','chatgptResponseV301','chatgptPaperV301'].forEach(id=>{if($(id))$(id).value='';});
    $('chatgptWorkspaceStatusV301').textContent='Workspace cleared.';
  };


  function installShowHook(){
    const old=window.show;
    if(typeof old!=='function' || old.__v301) return;
    const wrapped=function(id,btn){
      const result=old.apply(this,arguments);
      if(id==='aiControlCentre') setTimeout(window.loadAISettingsV23,60);
      return result;
    };
    wrapped.__v301=true;
    window.show=wrapped;
  }

  function init(){
    installV301Router();
    // Re-assert once after all deferred legacy initialisers have finished.
    setTimeout(installV301Router,900);
    window.__MISSION_UPSC_VERSION__=VERSION;
    const badge=document.querySelector('.versionBadge');
    if(badge) badge.textContent='V30.1.3 • Secure AI Router Fix';
    if($('v275BuildBadge')) $('v275BuildBadge').textContent='V30.1.3 • AI Ready';
    installShowHook();
    window.loadAISettingsV23();
    const r=routerSettings();
    if($('routerCallsMonthV282')) $('routerCallsMonthV282').textContent=`${cloudCallsThisMonth()}/${r.cloudCap} Gemini calls`;
    document.querySelectorAll('input[name="aiModeV23"]').forEach(radio=>radio.addEventListener('change',updateModeVisibility));
    ['chatgptTaskV301','chatgptMarksV301','chatgptPaperV301','chatgptQuestionV301','chatgptAnswerV301','chatgptSourceV301','chatgptPromptV301','chatgptResponseV301'].forEach(id=>$(id)?.addEventListener('input',saveWorkspace));
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(init,500),{once:true});
  else setTimeout(init,200);
})();

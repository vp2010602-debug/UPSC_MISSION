/* Mission UPSC AI OS V28.4 — PWA controller */
(() => {
  'use strict';
  const VERSION = '28.5';
  const REMINDER_KEY = 'mupsc_pwa_reminders_v284';
  const READY_KEY = 'mupsc_pwa_offline_ready_v284';
  let deferredInstallPrompt = null;
  let swRegistration = null;
  let wakeLock = null;
  let updateRequested = false;

  const $ = id => document.getElementById(id);
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = () => /android/i.test(navigator.userAgent);
  const secureEnough = () => window.isSecureContext || ['localhost','127.0.0.1'].includes(location.hostname);
  const safeJSON = (value, fallback) => { try { return JSON.parse(value); } catch { return fallback; } };
  const readReminders = () => safeJSON(localStorage.getItem(REMINDER_KEY) || '[]', []);
  const writeReminders = rows => localStorage.setItem(REMINDER_KEY, JSON.stringify(rows));
  const fmtDate = value => {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? 'Invalid time' : d.toLocaleString([], {dateStyle:'medium', timeStyle:'short'});
  };
  const escapeHTML = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));

  function toast(message) {
    let el = $('pwaToastV284');
    if (!el) {
      el = document.createElement('div');
      el.id = 'pwaToastV284';
      el.className = 'pwaToastV284';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), 2800);
  }
  window.pwaToastV284 = toast;

  function applyStandaloneState() {
    const standalone = isStandalone();
    document.body.classList.toggle('pwaStandaloneV284', standalone);
    const installBtn = $('pwaInstallBtnV284');
    if (installBtn) {
      installBtn.disabled = standalone;
      installBtn.textContent = standalone ? '✓ App Installed' : '📲 Install App';
    }
  }

  function deviceLabel() {
    if (isIOS()) return 'iPad / iPhone';
    if (isAndroid()) return 'Android';
    return 'Desktop / laptop';
  }

  function platformInstructions() {
    if (isStandalone()) return 'Mission UPSC is already running as an installed app. Use the app icon from your home screen for the fastest experience.';
    if (isIOS()) return 'On iPad/iPhone: open this website in Safari → tap Share → choose Add to Home Screen → tap Add. Apple does not provide a programmatic install button.';
    if (isAndroid()) return 'On Android Chrome: tap Install App below. If the prompt is unavailable, open Chrome menu → Add to Home screen / Install app.';
    return 'On Chrome or Edge: use Install App below or click the install icon in the address bar. Installation requires HTTPS or localhost.';
  }

  function storageBytes() {
    let bytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) || '';
      const value = localStorage.getItem(key) || '';
      bytes += (key.length + value.length) * 2;
    }
    return bytes;
  }

  async function renderStatus() {
    applyStandaloneState();
    const online = navigator.onLine;
    const controller = !!navigator.serviceWorker?.controller;
    const readyAt = Number(localStorage.getItem(READY_KEY) || 0);
    const notif = 'Notification' in window ? Notification.permission : 'unsupported';
    const onlinePill = $('pwaOnlinePillV284');
    if (onlinePill) {
      onlinePill.classList.toggle('offline', !online);
      onlinePill.innerHTML = online ? '● Online' : '● Offline — local mode';
    }
    if ($('pwaInstallStateV284')) $('pwaInstallStateV284').textContent = isStandalone() ? 'Installed' : (deferredInstallPrompt ? 'Ready to install' : 'Browser dependent');
    if ($('pwaOfflineStateV284')) $('pwaOfflineStateV284').textContent = controller ? (readyAt ? 'Prepared' : 'Shell cached') : 'Not controlled yet';
    if ($('pwaNetworkStateV284')) $('pwaNetworkStateV284').textContent = online ? 'Online' : 'Offline';
    if ($('pwaNotificationStateV284')) $('pwaNotificationStateV284').textContent = notif === 'granted' ? 'Enabled' : notif === 'denied' ? 'Blocked' : notif === 'unsupported' ? 'Unsupported' : 'Not enabled';
    if ($('pwaPlatformV284')) $('pwaPlatformV284').textContent = deviceLabel();
    if ($('pwaInstallInstructionV284')) $('pwaInstallInstructionV284').textContent = platformInstructions();
    if ($('pwaCachePreparedV284')) $('pwaCachePreparedV284').textContent = readyAt ? fmtDate(readyAt) : 'Not prepared manually';
    if ($('pwaLocalUsageV284')) $('pwaLocalUsageV284').textContent = `${(storageBytes()/1024/1024).toFixed(2)} MB`;
    if ($('pwaReminderCountV284')) $('pwaReminderCountV284').textContent = String(readReminders().filter(r => !r.done).length);
    if ($('pwaSwVersionV284')) $('pwaSwVersionV284').textContent = controller ? `Active • V${VERSION}` : 'Waiting for reload';
    const badge = $('pwaInstallBadgeV284');
    if (badge) {
      badge.className = 'pwaInstallBadgeV284 ' + (isStandalone() ? 'ready' : secureEnough() ? 'warn' : 'offline');
      badge.textContent = isStandalone() ? 'Installed app' : secureEnough() ? 'Installable build' : 'HTTPS required';
    }
    renderReminders();
  }
  window.renderPwaStatusV284 = renderStatus;

  window.openAppOfflineV284 = function(btn) {
    if (typeof window.show === 'function') window.show('appOfflineV284', btn);
    setTimeout(renderStatus, 60);
  };

  window.installMissionUpscV284 = async function() {
    if (isStandalone()) return toast('Mission UPSC is already installed.');
    if (!secureEnough()) return toast('Install requires HTTPS or localhost. Deploy to GitHub Pages first.');
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice.catch(() => null);
      deferredInstallPrompt = null;
      toast(choice?.outcome === 'accepted' ? 'Installation accepted.' : 'Installation dismissed.');
      renderStatus();
      return;
    }
    if (isIOS()) return toast('Use Safari Share → Add to Home Screen.');
    toast('Install prompt is not available yet. Use the browser menu → Install app / Add to Home screen.');
  };

  window.prepareOfflineV284 = async function() {
    const status = $('pwaOfflineActionStatusV284');
    if (status) status.textContent = 'Preparing app shell for offline use…';
    try {
      if (!swRegistration) swRegistration = await navigator.serviceWorker?.ready;
      const worker = swRegistration?.active || navigator.serviceWorker?.controller;
      if (!worker) throw new Error('Service worker is not active yet. Reload once and try again.');
      worker.postMessage({type:'CACHE_APP_SHELL'});
      if (navigator.storage?.persist) await navigator.storage.persist().catch(() => false);
      localStorage.setItem(READY_KEY, String(Date.now()));
      if (status) status.textContent = 'Offline app shell prepared. Locally saved notes and study records remain available without internet.';
      toast('Offline mode prepared.');
      renderStatus();
    } catch (error) {
      if (status) status.textContent = `Could not prepare offline mode: ${error.message}`;
      toast('Offline preparation failed.');
    }
  };

  window.updateMissionUpscV284 = async function() {
    const status = $('pwaOfflineActionStatusV284');
    try {
      if (!swRegistration) swRegistration = await navigator.serviceWorker?.getRegistration();
      if (!swRegistration) throw new Error('Service worker is not registered.');
      if (status) status.textContent = 'Checking for a newer app version…';
      await swRegistration.update();
      if (swRegistration.waiting) {
        updateRequested = true;
        swRegistration.waiting.postMessage({type:'SKIP_WAITING'});
        if (status) status.textContent = 'Update found. Reloading the app…';
      } else {
        if (status) status.textContent = 'You already have the latest cached app version.';
        toast('App is up to date.');
      }
    } catch (error) {
      if (status) status.textContent = `Update check failed: ${error.message}`;
    }
  };

  window.clearPwaRuntimeCacheV284 = async function() {
    try {
      const worker = swRegistration?.active || navigator.serviceWorker?.controller;
      if (!worker) throw new Error('Service worker is not active.');
      worker.postMessage({type:'CLEAR_RUNTIME_CACHE'});
      toast('Temporary offline cache clear requested.');
    } catch (error) { toast(error.message); }
  };

  window.requestNotificationsV284 = async function() {
    if (!('Notification' in window)) return toast('Notifications are not supported in this browser.');
    const permission = await Notification.requestPermission();
    toast(permission === 'granted' ? 'Local reminders enabled.' : 'Notification permission was not granted.');
    renderStatus();
  };

  async function showNotification(title, body, data={}) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return false;
    try {
      const registration = swRegistration || await navigator.serviceWorker?.ready;
      if (registration?.showNotification) {
        await registration.showNotification(title, {
          body,
          icon:'./assets/icons/jarvis-icon-192-v287.png',
          badge:'./assets/icons/jarvis-favicon-v287.png',
          tag:data.tag || `mupsc-${Date.now()}`,
          renotify:false,
          data:{url:data.url || './?section=dailyCommandV261'}
        });
      } else {
        new Notification(title, {body, icon:'./assets/icons/jarvis-icon-192-v287.png'});
      }
      return true;
    } catch { return false; }
  }

  window.testNotificationV284 = async function() {
    if (!('Notification' in window)) return toast('Notifications are unavailable in this browser.');
    if (Notification.permission !== 'granted') await window.requestNotificationsV284();
    const ok = await showNotification('Mission UPSC reminder', 'Your app notifications are working.', {tag:'mupsc-test'});
    toast(ok ? 'Test notification sent.' : 'Enable notifications first.');
  };

  window.scheduleReminderV284 = function() {
    const title = ($('pwaReminderTitleV284')?.value || '').trim();
    const at = $('pwaReminderTimeV284')?.value || '';
    const type = $('pwaReminderTypeV284')?.value || 'Study';
    if (!title) return toast('Enter a reminder title.');
    const time = new Date(at).getTime();
    if (!at || Number.isNaN(time) || time <= Date.now()) return toast('Choose a future reminder time.');
    const rows = readReminders();
    rows.unshift({id:`rem_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, title, at:new Date(time).toISOString(), type, done:false, notified:false, createdAt:Date.now()});
    writeReminders(rows.slice(0,100));
    if ($('pwaReminderTitleV284')) $('pwaReminderTitleV284').value = '';
    setDefaultReminderTime();
    renderReminders();
    renderStatus();
    toast('Reminder scheduled. Keep the installed app open for local notification checks.');
  };

  window.deleteReminderV284 = function(id) {
    writeReminders(readReminders().filter(r => r.id !== id));
    renderReminders();
    renderStatus();
  };

  function renderReminders() {
    const host = $('pwaReminderListV284');
    if (!host) return;
    const rows = readReminders().sort((a,b) => new Date(a.at) - new Date(b.at));
    host.innerHTML = rows.length ? rows.map(r => `
      <div class="pwaReminderItemV284 ${r.done ? 'done' : ''}">
        <div><b>${escapeHTML(r.title)}</b><small>${escapeHTML(r.type)} • ${escapeHTML(fmtDate(r.at))}${r.done ? ' • completed' : ''}</small></div>
        <button type="button" class="btn danger" onclick="deleteReminderV284('${escapeHTML(r.id)}')">Delete</button>
      </div>`).join('') : '<div class="emptyState">No local app reminders scheduled.</div>';
  }

  async function checkReminders() {
    const rows = readReminders();
    let changed = false;
    for (const r of rows) {
      if (!r.done && !r.notified && new Date(r.at).getTime() <= Date.now()) {
        r.notified = true;
        r.done = true;
        changed = true;
        await showNotification(`Mission UPSC • ${r.type}`, r.title, {tag:r.id, url:'./?section=dailyCommandV261'});
      }
    }
    if (changed) { writeReminders(rows); renderReminders(); renderStatus(); }
  }

  window.toggleWakeLockV284 = async function() {
    const state = $('pwaWakeStateTextV284');
    if (!('wakeLock' in navigator)) {
      if (state) state.textContent = 'Wake Lock is not supported in this browser.';
      return toast('Keep-screen-awake is unsupported here.');
    }
    try {
      if (wakeLock) {
        await wakeLock.release();
        wakeLock = null;
      } else {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; updateWakeState(); });
      }
      updateWakeState();
    } catch (error) {
      if (state) state.textContent = `Could not change Wake Lock: ${error.message}`;
    }
  };

  function updateWakeState() {
    const dot = $('pwaWakeDotV284');
    const text = $('pwaWakeStateTextV284');
    dot?.classList.toggle('on', !!wakeLock);
    if (text) text.textContent = wakeLock ? 'Screen will stay awake while this app remains visible.' : 'Screen-awake mode is off.';
    const btn = $('pwaWakeBtnV284');
    if (btn) btn.textContent = wakeLock ? 'Turn Off Screen Awake' : 'Keep Screen Awake';
  }

  window.shareMissionUpscV284 = async function() {
    const data = {title:'Mission UPSC AI OS', text:'Open my Mission UPSC AI OS workspace.', url:location.href.split('?')[0].split('#')[0]};
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(data.url); toast('Website link copied.'); }
    } catch (error) { if (error.name !== 'AbortError') toast('Could not share the app.'); }
  };

  window.runPwaAuditV284 = async function() {
    const tests = [];
    const add = (name, ok, detail, level='pass') => tests.push({name,ok,detail,level:ok?'pass':level});
    add('Secure context', secureEnough(), secureEnough() ? 'HTTPS or localhost is active.' : 'Deploy through HTTPS before installation.', 'fail');
    add('Web app manifest', !!document.querySelector('link[rel="manifest"]'), 'Manifest link found.', 'fail');
    add('Service worker support', 'serviceWorker' in navigator, 'Browser service-worker capability.', 'fail');
    add('Service worker control', !!navigator.serviceWorker?.controller, navigator.serviceWorker?.controller ? 'App shell is controlled.' : 'Reload once after first registration.', 'warn');
    add('Standalone installation', isStandalone(), isStandalone() ? 'Running as installed app.' : 'Still running in a browser tab.', 'warn');
    add('Local storage', (()=>{try{localStorage.setItem('__pwa_test','1');localStorage.removeItem('__pwa_test');return true}catch{return false}})(), 'Workspace local storage is writable.', 'fail');
    add('Notification support', 'Notification' in window, 'Notification API availability.', 'warn');
    add('Notification permission', 'Notification' in window && Notification.permission === 'granted', 'Current permission: '+(('Notification' in window && Notification.permission)||'unsupported'), 'warn');
    let persistent = false;
    if (navigator.storage?.persisted) persistent = await navigator.storage.persisted().catch(()=>false);
    add('Persistent storage', persistent, persistent ? 'Browser granted persistent storage.' : 'Browser may clear cached data under storage pressure.', 'warn');
    add('Network state', navigator.onLine, navigator.onLine ? 'Online now.' : 'Currently offline; local mode is active.', 'warn');
    const host = $('pwaAuditResultsV284');
    if (host) host.innerHTML = tests.map(t => `<div class="pwaAuditItemV284 ${t.level}"><b>${t.ok?'✓':'!'} ${escapeHTML(t.name)}</b><small>${escapeHTML(t.detail)}</small></div>`).join('');
    const passed = tests.filter(t=>t.ok).length;
    if ($('pwaAuditScoreV284')) $('pwaAuditScoreV284').textContent = `${passed}/${tests.length} checks ready`;
    toast('App audit complete.');
  };

  function setDefaultReminderTime() {
    const input = $('pwaReminderTimeV284');
    if (!input || input.value) return;
    const d = new Date(Date.now() + 60*60*1000);
    d.setMinutes(Math.ceil(d.getMinutes()/5)*5,0,0);
    const local = new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,16);
    input.value = local;
  }

  function routeShortcut() {
    const section = new URLSearchParams(location.search).get('section');
    if (!section) return;
    setTimeout(() => {
      if (section === 'jarvis') {
        if (typeof window.openJarvisV2811 === 'function') window.openJarvisV2811();
        else if (typeof window.show === 'function') window.show('jarvisCommandV281');
      } else if (typeof window.show === 'function' && $(section)) window.show(section);
    }, 650);
  }

  function installBottomDock() {
    if ($('pwaBottomDockV284')) return;
    const dock = document.createElement('nav');
    dock.id = 'pwaBottomDockV284';
    dock.className = 'pwaBottomDockV284';
    dock.setAttribute('aria-label','App quick navigation');
    dock.innerHTML = `
      <button type="button" onclick="show('dashboard')"><span>🏛️</span>Home</button>
      <button type="button" onclick="openJarvisV2811()"><span>✨</span>Jarvis</button>
      <button type="button" onclick="show('dailyCommandV261')"><span>☀️</span>Today</button>
      <button type="button" onclick="show('memoryEngineV263')"><span>🧠</span>Recall</button>
      <button type="button" onclick="toggleSidebarV2754()"><span>☰</span>Sections</button>`;
    document.body.appendChild(dock);
  }

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || !secureEnough()) return;
    try {
      swRegistration = await navigator.serviceWorker.register('./service-worker.js', {scope:'./'});
      swRegistration.addEventListener('updatefound', () => {
        const worker = swRegistration.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            const status = $('pwaOfflineActionStatusV284');
            if (status) status.textContent = 'A newer app build is ready. Press Update App to apply it.';
          }
        });
      });
      navigator.serviceWorker.addEventListener('message', event => {
        if (event.data?.type === 'CACHE_COMPLETE') {
          const status = $('pwaOfflineActionStatusV284');
          if (status) status.textContent = 'Offline app shell cached successfully.';
        }
        if (event.data?.type === 'RUNTIME_CACHE_CLEARED') toast('Temporary runtime cache cleared.');
      });
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (updateRequested) location.reload();
        else renderStatus();
      });
    } catch (error) {
      const status = $('pwaOfflineActionStatusV284');
      if (status) status.textContent = `Service worker registration failed: ${error.message}`;
    }
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    renderStatus();
  });
  window.addEventListener('appinstalled', () => { deferredInstallPrompt = null; applyStandaloneState(); renderStatus(); toast('Mission UPSC installed successfully.'); });
  window.addEventListener('online', renderStatus);
  window.addEventListener('offline', renderStatus);
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && wakeLock) {
      try { wakeLock = await navigator.wakeLock.request('screen'); } catch {}
      updateWakeState();
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    installBottomDock();
    setDefaultReminderTime();
    renderReminders();
    applyStandaloneState();
    renderStatus();
    registerServiceWorker();
    routeShortcut();
    setInterval(checkReminders, 30000);
    setTimeout(checkReminders, 1800);
  });
})();

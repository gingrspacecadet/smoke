// frontend/notifications.js
(function () {
  // container
  let container = document.getElementById('in-app-notifications');
  if (!container) {
    container = document.createElement('div');
    container.id = 'in-app-notifications';
    document.body.appendChild(container);
  }

  // sound preference
  const SOUND_KEY = 'smoke.toast.sound';
  const soundEnabled = () => (localStorage.getItem(SOUND_KEY) !== '0');

  // small synthesized sound (short 'pop' via WebAudio)
  function playBeep() {
    if (!soundEnabled()) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 880;
      g.gain.value = 0;
      o.connect(g);
      g.connect(ctx.destination);

      const now = ctx.currentTime;
      // short envelope
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
      o.start(now);
      o.stop(now + 0.28);

      // close context to avoid resource leak
      setTimeout(() => {
        try { ctx.close(); } catch (e) {/*ignore*/ }
      }, 500);
    } catch (e) {
      // fallback: try HTMLAudio if you provided a sound URL later
    }
  }

  // show toast
  function showInAppNotification(opts = {}) {
    // opts: { title, body, icon, timeoutMs, actions: [{ label, type, payload }] , silent }
    const {
      title = '',
      body = '',
      icon = null,
      timeoutMs = 6000,
      actions = [],
      silent = false
    } = opts;

    const toast = document.createElement('div');
    toast.className = 'inapp-toast';

    // icon
    const iconEl = document.createElement('div');
    iconEl.className = 'icon';
    if (icon) {
      const img = document.createElement('img');
      img.src = icon;
      img.alt = title || '';
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      iconEl.appendChild(img);
    } else {
      iconEl.textContent = title ? title[0].toUpperCase() : '!';
    }

    // content
    const content = document.createElement('div');
    content.className = 'content';
    const t = document.createElement('div');
    t.className = 'title';
    t.textContent = title;
    const b = document.createElement('div');
    b.className = 'body';
    b.textContent = body;
    content.appendChild(t);
    content.appendChild(b);

    // actions container
    const actionsWrap = document.createElement('div');
    actionsWrap.className = 'actions';
    actionsWrap.style.display = actions.length ? 'flex' : 'none';
    actionsWrap.style.gap = '8px';
    actionsWrap.style.marginLeft = '8px';

    // close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close';
    closeBtn.innerHTML = '&#10005;';
    closeBtn.addEventListener('click', dismiss);

    toast.appendChild(iconEl);
    toast.appendChild(content);
    toast.appendChild(actionsWrap);
    toast.appendChild(closeBtn);
    container.appendChild(toast);

    // build action buttons
    actions.forEach(act => {
      const btn = document.createElement('button');
      btn.className = 'inapp-action';
      btn.textContent = act.label || '...';
      btn.style.padding = '6px 8px';
      btn.style.borderRadius = '6px';
      btn.style.border = 'none';
      btn.style.cursor = 'pointer';
      btn.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        // action types: 'play', 'open-folder', 'open-url', 'custom'
        try {
          if (act.type === 'play' && act.payload && act.payload.name && window.electronAPI?.runGame) {
            await window.electronAPI.runGame(act.payload.name).catch(()=>{});
          } else if (act.type === 'open-folder' && act.payload && act.payload.name && window.electronAPI?.openAppFolder) {
            await window.electronAPI.openAppFolder(act.payload.name).catch(()=>{});
          } else if (act.type === 'open-url' && act.payload && act.payload.url) {
            window.open(act.payload.url, '_blank');
          } else if (act.type === 'custom' && typeof act.onClick === 'function') {
            act.onClick();
          }
        } catch (e) {
          console.error('action click failed', e);
        }
        // dismiss after action
        dismiss();
      });
      actionsWrap.appendChild(btn);
    });

    // show
    requestAnimationFrame(() => toast.classList.add('show'));

    // play sound unless silent
    if (!silent) playBeep();

    // auto dismiss
    let timer = null;
    if (timeoutMs && timeoutMs > 0) {
      timer = setTimeout(dismiss, timeoutMs);
    }

    function dismiss() {
      if (timer) { clearTimeout(timer); timer = null; }
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 280);
    }

    return { dismiss };
  }

  // expose helper globally in case pages want to use directly
  window.showInAppNotification = showInAppNotification;

  // hook up preload queued events
  if (window.electronAPI && typeof window.electronAPI.onInAppNotification === 'function') {
    window.electronAPI.onInAppNotification((opts) => {
      try { showInAppNotification(opts); } catch (e) { console.error(e); }
    });
  }

  // handy toggle function to wire to a small "settings" UI
  window.toggleToastSound = (enabled) => {
    if (enabled) localStorage.setItem(SOUND_KEY, '1');
    else localStorage.setItem(SOUND_KEY, '0');
  };

})();

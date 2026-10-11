(async function () {
  const map = { ArrowUp:-1, ArrowDown:-2, ArrowLeft:-3, ArrowRight:-4, Enter:-5, ' ':-1, Escape:-7, a:-3, A:-3, d:-4, D:-4, w:-1, W:-1, z:-6, Z:-6, x:-7, X:-7, '*':42, '#':35 };
  for(let i = 0; i < 10; i++) map[String(i)] = 48 + i;

  const settings = document.getElementById('settings');
  const phone = document.getElementById('phone');
  const stage = document.getElementById('stage');
  const app = document.getElementById('app');
  const screen = document.getElementById('screen');
  const status = document.getElementById('status');
  const sound = document.getElementById('sound');
  const fullscreen = document.getElementById('fullscreen');
  const scale = document.getElementById('scale');
  const themeToggle = document.getElementById('theme-toggle');
  const themeSelect = document.getElementById('theme-select');
  const coverSelect = document.getElementById('cover-select');
  const filterSelect = document.getElementById('screen-filter-select');
  const layoutSelect = document.getElementById('control-layout-select');
  const switchLayoutBtn = document.getElementById('switch-layout-btn');
  const hapticsCheckbox = document.getElementById('haptics-checkbox');
  const volumeRange = document.getElementById('volume-range');
  const volumeVal = document.getElementById('volume-val');
  const keytonesCheckbox = document.getElementById('keytones-checkbox');
  const gamepadStatus = document.getElementById('gamepad-status');
  const settingsFeedback = document.getElementById('settings-feedback');
  const saveStatus = document.getElementById('save-status');
  const jarDialog = document.getElementById('jar-dialog');
  const jarInput = document.getElementById('jar-input');
  const jarChoose = document.getElementById('jar-choose');
  const jarFeedback = document.getElementById('jar-feedback');
  const jarRemember = document.getElementById('jar-remember');
  let gameJar = null;
  let loadingJar = false;
  let replacingSave = false;
  let settingsWasPlaying = false;
  let windowFocused = true;
  let feedbackTimer;

  function notify(message, error = false) {
    clearTimeout(feedbackTimer);
    const target = settings.open ? settingsFeedback : document.getElementById('toast');
    target.textContent = message;
    target.dataset.error = String(error);
    target.hidden = false;
    feedbackTimer = setTimeout(() => { target.hidden = true; }, 4500);
  }

  // Preferences
  let hapticsEnabled = localStorage.getItem('bounce:haptics') !== 'off';
  if (hapticsCheckbox) hapticsCheckbox.checked = hapticsEnabled;

  const themeColors = {
    arcade: '#ffd64b',
    dark: '#110f1e',
    navy: '#080e1a',
    cyber: '#020c09'
  };
  function applyTheme(theme) {
    if (!Object.hasOwn(themeColors, theme)) theme = 'arcade';
    app.dataset.theme = theme;
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('bounce:theme', theme);
    if (themeSelect) themeSelect.value = theme;
    const dark = theme !== 'arcade';
    themeToggle.setAttribute('aria-pressed', String(dark));
    themeToggle.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    themeToggle.title = dark ? 'Switch to light theme' : 'Switch to dark theme';
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme && themeColors[theme]) {
      metaTheme.setAttribute('content', themeColors[theme]);
    }
  }
  const savedTheme = localStorage.getItem('bounce:theme') || 'arcade';
  applyTheme(savedTheme);

  function applyCover(cover) {
    if (!['violet', 'navy', 'cyber', 'coral'].includes(cover)) cover = 'violet';
    phone.dataset.cover = cover;
    localStorage.setItem('bounce:cover', cover);
    if (coverSelect) coverSelect.value = cover;
  }
  const savedCover = localStorage.getItem('bounce:cover') || 'violet';
  applyCover(savedCover);

  function applyFilter(filter) {
    if (!['crisp', 'lcd', 'scanlines'].includes(filter)) filter = 'crisp';
    phone.dataset.filter = filter;
    localStorage.setItem('bounce:filter', filter);
    if (filterSelect) filterSelect.value = filter;
  }
  const savedFilter = localStorage.getItem('bounce:filter') || 'crisp';
  applyFilter(savedFilter);

  function applyControls(mode) {
    if (!['keypad', 'arcade'].includes(mode)) mode = 'keypad';
    phone.dataset.controls = mode;
    localStorage.setItem('bounce:controls', mode);
    if (layoutSelect) layoutSelect.value = mode;
    if (switchLayoutBtn) {
      const span = switchLayoutBtn.querySelector('span');
      if (span) span.textContent = mode === 'arcade' ? 'Keypad' : 'Arcade';
      const label = mode === 'arcade' ? 'Switch to keypad layout' : 'Switch to arcade touch layout';
      switchLayoutBtn.setAttribute('aria-label', label);
      switchLayoutBtn.title = label;
    }
  }
  const savedControls = localStorage.getItem('bounce:controls') || 'keypad';
  applyControls(savedControls);

  // Key tones & Pressed feedback
  function showPressedKeys() {
    const keys = [...held.values()];
    document.querySelectorAll('[data-key]').forEach(button => button.classList.toggle('pressed', keys.includes(Number(button.dataset.key))));
    document.getElementById('choice')?.classList.toggle('pressed', keys.includes(-6));
    document.getElementById('back')?.classList.toggle('pressed', keys.includes(-7));
    document.getElementById('arcade-choice')?.classList.toggle('pressed', keys.includes(-6));
    document.getElementById('arcade-back')?.classList.toggle('pressed', keys.includes(-7));
  }

  function playKeyTone(key) {
    if (!BounceAudio.keyTones || !BounceAudio.beep) return;
    const toneMap = {
      49: 697, 50: 770, 51: 852, 52: 697, 53: 770, 54: 852, 55: 697, 56: 770, 57: 852, 48: 941,
      42: 697, 35: 852, '-1': 880, '-2': 660, '-3': 700, '-4': 750, '-5': 900, '-6': 800, '-7': 600
    };
    BounceAudio.beep(toneMap[key] || 750, 0.03);
  }

  function triggerHaptics() {
    if (hapticsEnabled && navigator.vibrate) {
      try { navigator.vibrate(10); } catch {}
    }
  }

  const input = BounceInput({
    key: (code, pressed) => BouncePlatform.key(code, pressed),
    feedback: code => { BounceAudio.unlock(); triggerHaptics(); playKeyTone(code); },
    changed: showPressedKeys
  });
  const { held, down, up, tap, release } = input;

  document.addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (jarDialog.open || !gameJar || settings.open || e.target.closest('select, input, summary, [contenteditable]')) return;
    if (e.target.closest('button') && (e.key === 'Enter' || e.key === ' ')) return;
    if (map[e.key] != null) { e.preventDefault(); down('key:' + e.code, map[e.key]); }
  });

  document.addEventListener('keyup', e => {
    if (map[e.key] != null && held.has('key:' + e.code)) {
      e.preventDefault();
      up('key:' + e.code);
    }
  });

  // Attach pointer handlers to all data-key elements (phone numpad + thumb arcade deck)
  function bindKeyButtons() {
    document.querySelectorAll('[data-key]').forEach(button => {
      button.addEventListener('pointerdown', e => {
        if (e.button !== 0 || settings.open) return;
        e.preventDefault();
        button.setPointerCapture(e.pointerId);
        button.classList.add('pressed');
        down('pointer:' + e.pointerId, Number(button.dataset.key));
      });
      for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
        button.addEventListener(name, e => {
          button.classList.remove('pressed');
          up('pointer:' + e.pointerId);
        });
      }
      button.addEventListener('click', e => {
        if (e.detail === 0) tap(Number(button.dataset.key));
      });
    });
  }
  bindKeyButtons();



  // Pause state sync
  function updatePauseState(isPaused) {
    phone.classList.toggle('is-paused', isPaused);
  }

  function pauseGame() {
    release();
    if (BouncePlatform.display?.current?.isCanvas) {
      BouncePlatform.key(-7, true);
      BouncePlatform.key(-7, false);
      save();
    }
  }

  window.addEventListener('blur', () => { windowFocused = false; pauseGame(); });
  window.addEventListener('focus', () => { windowFocused = true; });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      pauseGame();
      save();
    }
  });

  // Sound toggle & Master volume
  function updateSound() {
    const label = BounceAudio.enabled ? 'Sound on' : 'Sound off';
    sound.setAttribute('aria-label', label);
    sound.title = label;
    sound.setAttribute('aria-pressed', String(BounceAudio.enabled));
    document.getElementById('sound-checkbox').checked = BounceAudio.enabled;
  }
  updateSound();

  function toggleSound() {
    BounceAudio.enabled = !BounceAudio.enabled;
    localStorage.setItem('bounce:sound', BounceAudio.enabled ? 'on' : 'off');
    if (!BounceAudio.enabled) BounceAudio.context?.suspend(); else BounceAudio.unlock();
    updateSound();
  }
  sound.addEventListener('click', toggleSound);
  document.getElementById('sound-checkbox').addEventListener('change', toggleSound);

  if (volumeRange && volumeVal) {
    const volPercent = Math.round((BounceAudio.volume ?? 1) * 100);
    volumeRange.value = volPercent;
    volumeVal.textContent = volPercent + '%';
    volumeRange.addEventListener('input', () => {
      const vol = Number(volumeRange.value) / 100;
      BounceAudio.setVolume(vol);
      volumeVal.textContent = volumeRange.value + '%';
      if (!BounceAudio.enabled && vol > 0) {
        BounceAudio.enabled = true;
        localStorage.setItem('bounce:sound', 'on');
        BounceAudio.unlock();
        updateSound();
      }
    });
  }

  if (keytonesCheckbox) {
    keytonesCheckbox.checked = Boolean(BounceAudio.keyTones);
    keytonesCheckbox.addEventListener('change', () => {
      BounceAudio.setKeyTones(keytonesCheckbox.checked);
      if (keytonesCheckbox.checked) { BounceAudio.unlock(); playKeyTone(50); }
    });
  }

  if (hapticsCheckbox) {
    hapticsCheckbox.addEventListener('change', () => {
      hapticsEnabled = hapticsCheckbox.checked;
      localStorage.setItem('bounce:haptics', hapticsEnabled ? 'on' : 'off');
      if (hapticsEnabled) triggerHaptics();
    });
  }

  // Fullscreen
  fullscreen.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (app.requestFullscreen) await app.requestFullscreen();
      else notify('Fullscreen is unavailable in this browser.', true);
    } catch {
      notify('Fullscreen is unavailable in this browser.', true);
    }
  });

  document.addEventListener('fullscreenchange', () => {
    const label = document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen';
    fullscreen.setAttribute('aria-label', label);
    fullscreen.title = label;
    scheduleFit();
  });

  // Settings modal
  document.getElementById('help').addEventListener('click', () => {
    settingsWasPlaying = Boolean(BouncePlatform.display?.current?.isCanvas);
    document.getElementById('return-to-game').textContent = settingsWasPlaying ? 'Resume game' : 'Back to player';
    settingsFeedback.hidden = true;
    document.getElementById('toast').hidden = true;
    pauseGame();
    updatePauseState(settingsWasPlaying);
    settings.showModal();
  });

  document.getElementById('close-settings').addEventListener('click', () => settings.close());
  document.getElementById('return-to-game').addEventListener('click', () => settings.close());

  settings.addEventListener('click', e => {
    if (e.target !== settings) return;
    const r = settings.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) settings.close();
  });

  async function resumeGame() {
    const item = BouncePlatform.display?.current;
    const index = item?.isList ? item.items.findIndex(entry => entry.stringPart.text === 'Continue') : -1;
    if (index >= 0) { item.selectedItem = index; tap(-5); }
    for (let attempt = 0; attempt < 60; attempt++) {
      if (BouncePlatform.display?.current?.isCanvas) return true;
      if (settings.open || replacingSave || document.hidden || !windowFocused) return false;
      await new Promise(resolve => setTimeout(resolve, 16));
    }
    return false;
  }

  let resumePending = Promise.resolve(false);
  settings.addEventListener('close', () => {
    updatePauseState(false);
    release();
    resumePending = settingsWasPlaying && !replacingSave ? resumeGame() : Promise.resolve(false);
    settingsWasPlaying = false;
    screen.focus({ preventScroll: true });
  });

  const tabs = [...document.querySelectorAll('[role="tab"]')];
  function selectTab(tab, focus = false) {
    for (const item of tabs) {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
      document.getElementById(item.getAttribute('aria-controls')).hidden = !selected;
    }
    document.querySelector('.dialog-body').scrollTop = 0;
    if (focus) tab.focus();
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', e => {
      let next;
      if (e.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (e.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
      if (e.key === 'Home') next = 0;
      if (e.key === 'End') next = tabs.length - 1;
      if (next !== undefined) { e.preventDefault(); selectTab(tabs[next], true); }
    });
  });

  // Theme toolbar toggle
  themeToggle?.addEventListener('click', () => {
    const current = app.dataset.theme || 'arcade';
    const next = current === 'arcade' ? 'dark' : 'arcade';
    applyTheme(next);
  });

  themeSelect?.addEventListener('change', () => applyTheme(themeSelect.value));
  coverSelect?.addEventListener('change', () => applyCover(coverSelect.value));
  filterSelect?.addEventListener('change', () => applyFilter(filterSelect.value));
  layoutSelect?.addEventListener('change', () => { release(); applyControls(layoutSelect.value); scheduleFit(); });
  switchLayoutBtn?.addEventListener('click', () => {
    const next = (phone.dataset.controls === 'arcade') ? 'keypad' : 'arcade';
    applyControls(next);
    scheduleFit();
  });

  // Gamepad API integration
  function updateGamepadStatusText() {
    if (!gamepadStatus) return;
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    if (pads.length > 0) {
      const name = pads[0].id.split('(')[0].trim() || 'Controller';
      gamepadStatus.textContent = name;
      gamepadStatus.classList.add('is-active');
    } else {
      gamepadStatus.textContent = 'Disconnected';
      gamepadStatus.classList.remove('is-active');
    }
  }

  window.addEventListener('gamepadconnected', e => {
    updateGamepadStatusText();
    notify('Controller connected: ' + e.gamepad.id.split('(')[0].trim());
  });

  window.addEventListener('gamepaddisconnected', () => {
    release('gp:');
    updateGamepadStatusText();
  });
  updateGamepadStatusText();
  function pollGamepad() {
    input.poll(navigator.getGamepads?.(), {
      blocked: !gameJar || jarDialog.open || settings.open || document.hidden || !windowFocused,
      menu: !BouncePlatform.display?.current?.isCanvas
    });
    requestAnimationFrame(pollGamepad);
  }
  requestAnimationFrame(pollGamepad);

  // Save Management (Export, Import, Reset)
  document.getElementById('export-save-btn')?.addEventListener('click', () => {
    BouncePlatform.save(() => {
      const json = BouncePlatform.exportSave();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nokia-bounce-save-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      notify('Backup downloaded.');
    });
  });

  const importFileInput = document.getElementById('import-save-input');
  document.getElementById('import-save-btn').addEventListener('click', () => importFileInput.click());
  importFileInput?.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 1024 * 1024) throw new Error('Choose a Bounce backup smaller than 1 MB.');
      const text = await file.text();
      replacingSave = true;
      const success = BouncePlatform.importSave(text);
      if (success) {
        notify('Backup restored. Restarting player…');
        // Keep autosave and pagehide from overwriting the imported records.
        location.reload();
      } else {
        replacingSave = false;
        notify(BouncePlatform.importError || 'Choose a valid Nokia Bounce backup.', true);
      }
    } catch (error) {
      replacingSave = false;
      notify(error.message || 'Could not read the backup file.', true);
    }
    importFileInput.value = '';
  });

  document.getElementById('reset-save-btn')?.addEventListener('click', () => {
    if (confirm('Reset all progress and high scores? This will return the game to factory state.')) {
      try {
        replacingSave = true;
        BouncePlatform.resetSave();
        location.reload();
      } catch {
        replacingSave = false;
        notify('Progress could not be reset. Please try again.', true);
      }
    }
  });

  // Authentic Cheats
  document.querySelectorAll('[data-code]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const code = btn.dataset.code;
      if (!settingsWasPlaying) {
        notify('Start or continue a level first to use a cheat.', true);
        return;
      }
      const closed = new Promise(resolve => settings.addEventListener('close', resolve, { once: true }));
      settings.close();
      await closed;
      if (!await resumePending) { notify('Continue a level before using a cheat.', true); return; }
      release();
      const activated = BouncePlatform.triggerCheat(code, completed => notify(completed ? (code === '787898' ? 'Invincibility code entered.' : 'Warp & moon jump code entered.') : 'Code entry interrupted. Try again during a level.', !completed));
      if (!activated) notify('Could not enter the code. Continue a level and try again.', true);
    });
  });

  // Fit against both dimensions, including mobile browser chrome and safe areas.
  scale.value = localStorage.getItem('bounce:display') || 'auto';
  if (!scale.value) scale.value = 'auto';

  function fit() {
    const css = getComputedStyle(stage);
    const width = stage.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight);
    const height = stage.clientHeight - parseFloat(css.paddingTop) - parseFloat(css.paddingBottom);
    if (width <= 0 || height <= 0) return;
    const landscape = width / height > 1.35 && window.innerHeight <= 540;
    const compact = !landscape && (height < 700 || width < 420 || window.innerHeight < 760 || scale.value === '1');
    phone.dataset.layout = landscape ? 'landscape' : 'portrait';
    phone.dataset.density = compact ? 'compact' : 'regular';
    const hardwareWidth = landscape ? 280 : compact ? 56 : 76;
    // In landscape the keypad sits beside the display, so only the bezel and
    // case padding add to its height. The separate limit below fits the keys.
    const hardwareHeight = landscape ? 56 : compact ? 316 : 420;
    const minimum = landscape ? .60 : compact ? .65 : .82;
    const requested = scale.value === 'auto' ? (document.fullscreenElement ? 4 : 3) : Number(scale.value);
    let pixels = 128, unit = .7;
    for (let multiplier = requested; multiplier >= 1; multiplier--) {
      const candidate = 128 * multiplier;
      const available = Math.min(
        candidate === 128 && !landscape ? .68 : 1.12,
        (width - candidate) / hardwareWidth,
        (height - candidate) / hardwareHeight,
        landscape ? (height - 30) / 270 : Infinity
      );
      if (available >= minimum || multiplier === 1) {
        pixels = candidate;
        unit = Math.max(.2, available);
        break;
      }
    }
    document.documentElement.style.setProperty('--screen-size', pixels + 'px');
    document.documentElement.style.setProperty('--u', unit + 'px');
    const measured = phone.getBoundingClientRect();
    if (measured.height > height || measured.width > width) {
      const correction = Math.max((measured.height - height) / hardwareHeight, (measured.width - width) / hardwareWidth, 0);
      document.documentElement.style.setProperty('--u', Math.max(.2, unit - correction - .01) + 'px');
    }
    phone.dataset.viewport = window.innerWidth + 'x' + window.innerHeight;
    document.getElementById('display-size').textContent = '128 × 128 · ' + pixels / 128 + '×';
  }

  let fitFrame;
  function scheduleFit() { cancelAnimationFrame(fitFrame); fitFrame = requestAnimationFrame(fit); }
  scale.addEventListener('change', () => { localStorage.setItem('bounce:display', scale.value); scheduleFit(); });
  new ResizeObserver(scheduleFit).observe(stage);
  window.addEventListener('resize', scheduleFit);
  window.visualViewport?.addEventListener('resize', scheduleFit);
  scheduleFit();
  document.fonts.ready.then(scheduleFit);

  new MutationObserver(() => status.classList.toggle('is-ready', /^(Original game running|Ready to play)$/.test(status.textContent))).observe(status, { childList: true, characterData: true, subtree: true });

  for (const id of ['choice', 'back']) {
    const button = document.getElementById(id);
    if (!button) continue;
    const updateLabel = () => {
      button.setAttribute('aria-label', (id === 'choice' ? 'Left' : 'Right') + ' soft key: ' + button.textContent);
      button.title = button.textContent;
      const arcadeBtn = document.getElementById(id === 'choice' ? 'arcade-choice' : 'arcade-back');
      if (arcadeBtn) arcadeBtn.textContent = button.textContent;
    };
    new MutationObserver(updateLabel).observe(button, { childList: true, characterData: true, subtree: true });
    updateLabel();
  }

  document.getElementById('restart').addEventListener('click', () => BouncePlatform.save(() => location.reload()));
  document.getElementById('change-jar').addEventListener('click', async () => {
    try {
      await BounceJar.forget();
      BouncePlatform.save(() => location.reload());
    } catch { notify('Could not forget the JAR. Clear this site’s browser data to remove it.', true); }
  });

  function updateSaveStatus() {
    const time = Number(localStorage.getItem('bounce:last-save'));
    saveStatus.textContent = time ? 'Last saved at ' + new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Saves automatically during play';
  }
  function save() {
    if (replacingSave) return;
    BouncePlatform.save(saved => {
      if (!saved) return;
      localStorage.setItem('bounce:last-save', String(Date.now()));
      updateSaveStatus();
    });
  }
  updateSaveStatus();
  setInterval(save, 5000);
  window.addEventListener('pagehide', save);

  function jarMessage(message, error = false) {
    jarFeedback.hidden = !message;
    jarFeedback.dataset.error = String(error);
    jarFeedback.textContent = message;
  }
  function jarBusy(busy) {
    loadingJar = busy;
    jarChoose.disabled = busy;
    jarRemember.disabled = busy;
    if (busy) jarDialog.setAttribute('aria-busy', 'true');
    else jarDialog.removeAttribute('aria-busy');
  }
  async function launchGame(blob, name, remembered) {
    BouncePlatform.fonts = window.BounceFonts;
    gameJar = blob;
    document.getElementById('jar-name').textContent = name;
    document.getElementById('jar-persistence').textContent = remembered ? 'Remembered in this browser.' : 'Session only.';
    BounceAudio.unlock();
    jarDialog.close();
    screen.querySelector('.loading').textContent = 'Loading game…';
    status.textContent = 'Loading game…';
    js2me.launchJAR(gameJar);
    screen.focus({ preventScroll: true });
  }
  jarChoose.addEventListener('click', () => jarInput.click());
  jarDialog.addEventListener('cancel', event => event.preventDefault());
  jarInput.addEventListener('change', async () => {
    const file = jarInput.files?.[0];
    if (!file || loadingJar) return;
    jarBusy(true);
    jarMessage('Checking JAR…');
    try {
      const verified = await BounceJar.validate(file);
      let remembered = false;
      if (jarRemember.checked) {
        try { await BounceJar.remember(file.name, verified); remembered = true; }
        catch { /* Storage can be disabled or full; the selected file can still play. */ }
      } else await BounceJar.forget();
      await launchGame(verified, file.name, remembered);
      if (jarRemember.checked && !remembered) notify('Browser storage is unavailable. Select your JAR again after refreshing.', true);
    } catch (error) {
      jarMessage(error.message || 'Could not read that file. Choose another JAR.', true);
    } finally { jarBusy(false); jarInput.value = ''; }
  });
  jarDialog.showModal();
  jarBusy(true);
  let remembered;
  try { remembered = await BounceJar.load(); }
  catch {
    await BounceJar.forget().catch(() => {});
    jarMessage('Could not restore the JAR. Select it again.', true);
  }
  if (remembered) {
    jarMessage('Loading saved JAR…');
    try { await launchGame(remembered.blob, remembered.name, true); }
    catch (error) { jarMessage(error.message, true); }
  }
  jarBusy(false);
})();

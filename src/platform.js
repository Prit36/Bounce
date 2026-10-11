/* MIDP / Nokia handset compatibility. The game bytecode is never rewritten. */
(function () {
  const screen = () => document.getElementById('screen');
  const run = fn => { js2me.currentVM = 1; js2me.launchThread(fn); };
  const lcdui = () => javaRoot.$javax.$microedition.$lcdui;
  const proto = name => lcdui()[`$${name}`].prototype;
  const commandAction = '$commandAction$Ljavax_microedition_lcdui_Command_Ljavax_microedition_lcdui_Displayable_$V';
  const platform = window.BouncePlatform = {
    display: null, fonts: null,
    setGameIcon(id) {
      const path = js2me.manifest['midlet-' + id]?.split(',')[1]?.trim();
      const link = document.querySelector('link[rel="icon"]');
      if (!path || !link) return;
      // Use the original bytes from the verified local JAR, never a bundled image.
      js2me.loadResource(path, bytes => {
        if (!bytes?.length) return;
        const previous = this.iconURL;
        this.iconURL = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
        link.type = 'image/png';
        link.href = this.iconURL;
        if (previous) URL.revokeObjectURL(previous);
      });
    },
    text(ctx, text, x, y, color = '#000', face = 'small') {
      const font = this.fonts?.[face === 'mono' ? 'small' : face];
      if (!font) { ctx.font = '10px monospace'; ctx.textBaseline = 'top'; ctx.fillStyle = color; ctx.fillText(text, x, y); return; }
      ctx.fillStyle = color;
      for (const ch of String(text)) {
        const glyph = font.glyphs[ch] || this.fonts.small.glyphs[ch] || this.fonts.small.glyphs['?'];
        for (let row = 0; row < glyph.rows.length; row++) {
          const bits = glyph.rows[row];
          for (let col = 0; col < glyph.width; col++) if (bits & (1 << (glyph.width - col - 1))) ctx.fillRect(x + col, y + row, 1, 1);
        }
        x += face === 'mono' ? 6 : glyph.advance;
      }
    },
    width(text, face = 'small') { if(face === 'mono') return [...text].length * 6; const f = this.fonts?.[face]; return [...text].reduce((n, ch) => n + (f?.glyphs[ch]?.advance || this.fonts?.small.glyphs[ch]?.advance || 5), 0); },
    controller() { const m = this.midlet; return m?.['$' + m.$aLcom_nokia_mid_appl_boun_a_]; },
    save(callback) {
      const controller = this.controller();
      if (!controller?.$a$I$V) { callback?.(false); return; }
      run(() => controller.$a$I$V(3, () => callback?.(Boolean(localStorage.getItem('Nokia/Bounce/bounceRMS/3')))));
    },
    exportSave() {
      const data = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('Nokia/Bounce/') || k.startsWith('bounce:') || k === 'freeSpace')) {
          data[k] = localStorage.getItem(k);
        }
      }
      return JSON.stringify({ version: 1, app: 'original-nokia-bounce', exportedAt: new Date().toISOString(), data }, null, 2);
    },
    importSave(jsonString) {
      this.importError = '';
      try {
        if (typeof jsonString === 'string' && jsonString.length > 1024 * 1024) throw new Error('Choose a Bounce backup smaller than 1 MB.');
        const parsed = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
        if (parsed?.version !== 1 || parsed?.app !== 'original-nokia-bounce' || !parsed.data || typeof parsed.data !== 'object' || Array.isArray(parsed.data)) throw new Error('Choose a version 1 Nokia Bounce backup.');
        const preferences = {
          'bounce:theme': ['arcade', 'dark', 'navy', 'cyber'],
          'bounce:cover': ['violet', 'navy', 'cyber', 'coral'],
          'bounce:filter': ['crisp', 'lcd', 'scanlines'],
          'bounce:controls': ['keypad', 'arcade'],
          'bounce:display': ['auto', '1', '2', '3', '4'],
          'bounce:scale': ['auto', '1', '2', '3', '4'],
          'bounce:sound': ['on', 'off'], 'bounce:keytones': ['on', 'off'], 'bounce:haptics': ['on', 'off']
        };
        const entries = Object.entries(parsed.data);
        let records = 0;
        for (const [k, v] of entries) {
          if (typeof v !== 'string' || v.length > 65536) throw new Error('The backup contains invalid data.');
          if (k.startsWith('Nokia/Bounce/')) {
            if (!/^Nokia\/Bounce\/bounceRMS\/(?:[123]|size|version|lastModified)?$/.test(k) || !/^-?\d+(?:,-?\d+)*$/.test(v)) throw new Error('The backup contains invalid game records.');
            if (/\/\d+$/.test(k)) {
              if (v.split(',').some(byte => Number(byte) < -128 || Number(byte) > 255)) throw new Error('The backup contains invalid game bytes.');
              records++;
            } else if (!/^\d+$/.test(v) || !Number.isSafeInteger(Number(v))) throw new Error('The backup contains invalid save metadata.');
          } else if (Object.hasOwn(preferences, k)) {
            if (!preferences[k].includes(v)) throw new Error('The backup contains invalid preferences.');
          } else if (k === 'bounce:volume') {
            if (!v.trim() || !Number.isFinite(Number(v)) || Number(v) < 0 || Number(v) > 1) throw new Error('The backup contains an invalid volume.');
          } else if (k === 'bounce:last-save' || k === 'freeSpace') {
            if (!/^\d+$/.test(v) || !Number.isSafeInteger(Number(v))) throw new Error('The backup contains invalid save metadata.');
          } else throw new Error('This file contains data that does not belong to Bounce.');
        }
        if (!records) throw new Error('This backup does not contain game progress.');
        const prefix = 'Nokia/Bounce/bounceRMS/';
        const bytes = id => parsed.data[prefix + id]?.split(',').map(byte => Number(byte) & 255);
        const unlocked = bytes(1), score = bytes(2), progress = bytes(3);
        if (parsed.data[prefix] !== '0' || parsed.data[prefix + 'size'] !== '3' || unlocked?.length !== 1 || unlocked[0] > 11 || score?.length !== 4 || !progress) throw new Error('The backup is missing complete Bounce save records.');
        const factorySave = progress.length === 255 && progress.every(byte => byte === 0);
        if (!factorySave) {
          const count = progress[69], hazardsOffset = 70 + count * 5;
          const expectedSize = hazardsOffset + 1 + progress[hazardsOffset] * 8 + 8;
          const marker = [255, 255, 255, 255, 222, 173, 190, 239];
          if (progress.length < 79 || count > 50 || progress[hazardsOffset] > 127 || progress.length !== expectedSize || progress[8] > 2 || (progress[8] > 0 && (progress[11] < 1 || progress[11] > 11)) || !marker.every((byte, i) => byte === progress[progress.length - 8 + i])) throw new Error('The backup contains incomplete or damaged progress.');
        }
        // Validate everything before writing; replace only this player's records.
        // Preserve global runtime freeSpace, which can belong to another MIDlet.
        const before = new Map();
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k?.startsWith('Nokia/Bounce/')) before.set(k, localStorage.getItem(k));
        }
        const changes = entries.filter(([k]) => k !== 'freeSpace');
        for (const [k] of changes) if (!before.has(k)) before.set(k, localStorage.getItem(k));
        try {
          for (const [k, v] of changes) localStorage.setItem(k, v);
          const incoming = new Set(changes.map(([k]) => k));
          for (const [k] of before) if (k.startsWith('Nokia/Bounce/') && !incoming.has(k)) localStorage.removeItem(k);
        } catch (error) {
          for (const [k, v] of before) {
            try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch {}
          }
          throw new Error('Could not restore the backup. Browser storage may be full.');
        }
        return true;
      } catch (e) {
        this.importError = e instanceof SyntaxError ? 'This file is not valid JSON. Choose an exported Bounce backup.' : e.message;
        return false;
      }
    },
    resetSave() {
      const toRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('Nokia/Bounce/') || k === 'freeSpace')) toRemove.push(k);
      }
      for (const k of toRemove) localStorage.removeItem(k);
    },
    triggerCheat(code, callback) {
      const item = this.display?.current;
      if (!item?.isCanvas || !['787898', '787899'].includes(String(code))) return false;
      const digits = String(code).split('').map(Number);
      let idx = 0;
      const step = () => {
        if (this.display?.current !== item) { callback?.(false); return; }
        if (idx >= digits.length) { callback?.(true); return; }
        const digit = digits[idx++];
        const key = 48 + digit;
        if (window.BounceAudio?.beep) BounceAudio.beep(850, 0.025);
        this.key(key, true);
        setTimeout(() => {
          this.key(key, false);
          setTimeout(step, 45);
        }, 45);
      };
      step();
      return true;
    },
    renderMenu() {
      const item = this.display?.current;
      if (!item || item.isCanvas) return;
      const c = item.menuCanvas ||= document.createElement('canvas');
      c.width = 128; c.height = 128;
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = '#d9e5f1'; ctx.fillRect(0, 0, 128, 17);
      this.text(ctx, item.title?.text || '', 3, 3, '#000', 'menu');
      ctx.fillStyle = '#75889f'; ctx.fillRect(0, 17, 128, 1);
      if (item.items && item.isList) {
        const selected = item.selectedItem || 0;
        item.scroll = Math.max(0, Math.min(item.scroll || 0, selected));
        if (selected >= item.scroll + 5) item.scroll = selected - 4;
        for (let i = item.scroll; i < Math.min(item.items.length, item.scroll + 5); i++) {
          const y = 22 + (i - item.scroll) * 17;
          if (i === selected) { ctx.fillStyle = '#264b78'; ctx.fillRect(2, y - 1, 122, 16); }
          this.text(ctx, item.items[i].stringPart.text, 5, y + 2, i === selected ? '#fff' : '#000', 'menu');
        }
        if (item.items.length > 5) { ctx.fillStyle = '#b1bcc9'; ctx.fillRect(126, 21, 2, 84); ctx.fillStyle = '#264b78'; ctx.fillRect(126, 21 + (selected / (item.items.length - 1)) * 70, 2, 14); }
      } else {
        const lines = this.wrap((item.formText || []).join(''), 120);
        item.maxScroll = Math.max(0, lines.length - 9);
        for (let i = item.scroll || 0; i < Math.min(lines.length, (item.scroll || 0) + 9); i++) this.text(ctx, lines[i], 3, 22 + (i - (item.scroll || 0)) * 10);
      }
      ctx.fillStyle = '#d9e5f1'; ctx.fillRect(0, 113, 128, 15);
      const left = item.isList ? 'Select' : item.choiceCommands[0]?.label.text || '';
      const right = item.backCommands[0]?.label.text || '';
      this.text(ctx, left, 3, 116); this.text(ctx, right, 125 - this.width(right), 116);
      if (c.parentNode !== screen()) screen().replaceChildren(c);
      screen().setAttribute('aria-label', 'Bounce: ' + (item.title?.text || '') + '. ' + (item.isList ? item.items.map((entry, i) => (i === (item.selectedItem || 0) ? 'Selected: ' : '') + entry.stringPart.text).join('. ') : (item.formText || []).join('')));
      document.getElementById('choice').textContent = left || '—';
      document.getElementById('back').textContent = right || '—';
    },
    wrap(text, width) {
      const lines = [];
      for (const paragraph of text.split('\n')) {
        let line = '';
        for (const word of paragraph.split(' ')) {
          if (line && this.width(line + ' ' + word) > width) { lines.push(line); line = word; }
          else line += (line ? ' ' : '') + word;
        }
        lines.push(line);
      }
      return lines;
    },
    key(key, pressed) {
      const item = this.display?.current;
      if (!item) return;
      if (item.isCanvas) { (pressed ? js2me.sendKeyPressEvent : js2me.sendKeyReleasedEvent).call(js2me, key); return; }
      if (!pressed) return;
      if (key === -1 || key === 50) {
        if (item.isList) item.selectedItem = Math.max(0, (item.selectedItem || 0) - 1);
        else item.scroll = Math.max(0, (item.scroll || 0) - 1);
        this.renderMenu();
      } else if (key === -2 || key === 56) {
        if (item.isList) item.selectedItem = Math.min(item.items.length - 1, (item.selectedItem || 0) + 1);
        else item.scroll = Math.min(item.maxScroll || 0, (item.scroll || 0) + 1);
        this.renderMenu();
      } else if (key === -5 || key === -6 || key === 53) {
        const command = item.isList ? js2me.statics.$bounceSelect : item.choiceCommands[0];
        if (command && item.commandListener) run(() => item.commandListener[commandAction](command, item));
      } else if (key === -7) {
        const command = item.backCommands[0];
        if (command && item.commandListener) run(() => item.commandListener[commandAction](command, item));
      }
    }
  };
  js2me.libraryPath = 'vendor/js2me/js/me';
  js2me.engine = 'vendor/js2me/js/program_zazu.js';
  js2me.launchMidlet = function(id) {
    platform.setGameIcon(id);
    const mainClassName = 'javaRoot.$' + js2me.manifest['midlet-' + id].split(',')[2].trim().replace(/\./g, '.$');
    js2me['statics' + id] = {}; js2me.currentVM = id;
    const thread = new javaRoot.$java.$lang.$Thread(function() {
      js2me.loadClass(mainClassName, function(Main) {
        const midlet = new Main();
        midlet._init$$V(function() { platform.bootComplete = true; midlet.$startApp$$V(); });
      });
    });
    setTimeout(() => { js2me.currentVM = id; thread.$start$$V(); }, 0);
  };
  Object.assign(js2me.config, { width: 128, height: 128, fullHeight: 128, workers: false, app: true });
  js2me.setFullscreen = () => {};
  js2me.showError = message => {
    console.error(message);
    document.querySelector('#alert .message').textContent = 'The player encountered a compatibility error: ' + message;
    document.getElementById('alert').hidden = false;
    document.getElementById('status').textContent = 'Player needs attention';
  };
  const originalLoad = js2me.loadScript;
  js2me.loadScript = function (filename, success, failure) {
    originalLoad(filename, () => {
      const p = js2me.classBucket?.prototype;
      if (p) patch(filename.split('/').pop(), p);
      success();
    }, failure || (() => js2me.showError('Could not load ' + filename)));
  };
  function patch(file, p) {
    if (file === 'BufferStream.js') p.$reset$$V = function() { this.stream.index = this.$markI || 0; };
    if (file === 'Image.js') {
      const create = p.$createImage$II$Ljavax_microedition_lcdui_Image_;
      p.$createImage$II$Ljavax_microedition_lcdui_Image_ = function(width, height) {
        const image = create.call(this, width, height), ctx = image.element.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height);
        return image;
      };
    }
    if (file === 'DirectUtils.js') {
      p.$createImage$III$Ljavax_microedition_lcdui_Image_ = function(width, height, color) {
        const image = proto('Image').$createImage$II$Ljavax_microedition_lcdui_Image_(width, height);
        const c = color >>> 0, ctx = image.element.getContext('2d');
        ctx.clearRect(0,0,width,height);
        ctx.fillStyle = `rgba(${c >>> 16 & 255},${c >>> 8 & 255},${c & 255},${(c >>> 24) / 255})`;
        ctx.fillRect(0,0,width,height); return image;
      };
    }
    if (file === 'Timer.js') {
      p._init$$V = function() {
        this.threadId = js2me.threads.length;
        js2me.threads.push(this); this.timers = [];
        js2me.VMMapping[this.threadId] = js2me.currentVM;
        js2me.restoreStack[this.threadId] = [];
      };
      p.$schedule$Ljava_util_TimerTask_JJ$V = function(task, delay, interval) {
        const timer = this; task.executing = true;
        const tick = () => {
          if (!platform.bootComplete || !task.executing || js2me.restoreStack[timer.threadId]?.length) return;
          js2me.switchVM(timer.threadId);
          try { task.$run$$V(); } catch(error) { task.executing = false; clearInterval(task.timer); js2me.showError(error.stack || error.message); }
        };
        task.timer = setInterval(tick, interval.lo); this.timers.push(task.timer);
      };
      p.$cancel$$V = function() { this.timers.forEach(clearInterval); this.timers = []; };
    }
    if (file === 'DirectGraphics.js') {
      p.$setARGBColor$I$V = function(color) { const c = color >>> 0; this.graphics.alpha = c >>> 24; this.graphics.color = `rgba(${c >>> 16 & 255},${c >>> 8 & 255},${c & 255},${(c >>> 24) / 255})`; };
      p.$drawImage$Ljavax_microedition_lcdui_Image_IIII$V = function(image, x, y, anchor, manipulation) {
        const ctx = this.graphics.context, w = image.element.width, h = image.element.height;
        const angle = manipulation & 4095, sideways = angle === 90 || angle === 270;
        const dw = sideways ? h : w, dh = sideways ? w : h;
        if (anchor & 1) x -= dw >> 1; else if (anchor & 8) x -= dw;
        if (anchor & 2) y -= dh >> 1; else if (anchor & 32) y -= dh;
        ctx.save(); ctx.imageSmoothingEnabled = false; ctx.translate(x + dw / 2, y + dh / 2);
        ctx.rotate(-angle * Math.PI / 180);
        ctx.scale(manipulation & 8192 ? -1 : 1, manipulation & 16384 ? -1 : 1);
        ctx.drawImage(image.element, -w / 2, -h / 2); ctx.restore();
      };
    }
    if (file === 'Canvas.js') {
      const init = p._init$$V;
      p._init$$V = function() { init.call(this); this.isCanvas = true; this.element.getContext('2d').imageSmoothingEnabled = false; };
      p.$getKeyName$I$Ljava_lang_String_ = function(key) { const names = { '-1': 'Up', '-2': 'Down', '-3': 'Left', '-4': 'Right', '-5': 'Select', 50: '2', 52: '4', 54: '6' }; return new javaRoot.$java.$lang.$String(names[key] || String.fromCharCode(key)); };
      p.$repaint$$V = function() {
        if (!this.active) return;
        const level = this['$'+this.$acI];
        if (level > 0) {
          const score = this['$'+this.$fI], lives = this['$'+this.$hI], rings = this['$'+this.$UI], total = this['$'+this.$aoI];
          const label = `Bounce. Level ${level}. Score ${score}. Lives ${lives}. Rings ${rings} of ${total}. Arrow keys to move and jump. Escape for menu.`;
          if(screen().getAttribute('aria-label') !== label) screen().setAttribute('aria-label',label);
        }
        const graphics = new (lcdui().$Graphics)(this.element); run(() => this.$paint$Ljavax_microedition_lcdui_Graphics_$V(graphics));
      };
    }
    if (file === 'Display.js') {
      p.$getDisplay$Ljavax_microedition_midlet_MIDlet_$Ljavax_microedition_lcdui_Display_ = function(midlet) {
        if (!midlet.display) { midlet.display = new (lcdui().$Display)(); platform.display = midlet.display; platform.midlet = midlet; }
        return midlet.display;
      };
      p.$setCurrent$Ljavax_microedition_lcdui_Displayable_$V = function(item) {
        const old = this.current;
        if (old) {
          old.active = false;
          if (old.isCanvas) { js2me.removeEventListener('keypress', old.keyPressListener); js2me.removeEventListener('keyreleased', old.keyReleasedListener); if (old !== item) run(() => old.$hideNotify$$V()); }
        }
        this.current = item; platform.display = this;
        if (!item) { screen().innerHTML = '<div class="loading">Game closed. Restart to play.</div>'; return; }
        item.display = this; item.active = true; item.refreshCommands();
        if (item.isCanvas) {
          screen().replaceChildren(item.element);
          screen().setAttribute('aria-label', 'Bounce game screen. Arrow keys to move and jump. Enter to select. Escape for menu.');
          js2me.addEventListener('keypress', item.keyPressListener); js2me.addEventListener('keyreleased', item.keyReleasedListener);
          document.getElementById('choice').textContent = 'Menu'; document.getElementById('back').textContent = 'Menu';
          run(() => { item.$showNotify$$V(); item.$repaint$$V(); });
        } else { platform.renderMenu(); platform.save(); }
        document.getElementById('status').textContent = item.isCanvas ? 'Original game running' : 'Ready to play';
      };
    }
    if (file === 'Displayable.js') {
      const refresh = p.refreshCommands;
      p.refreshCommands = function() { refresh.call(this); if (this.active && !this.isCanvas) platform.renderMenu(); };
    }
    if (file === 'List.js') {
      const construct = p.construct;
      p.construct = function() { construct.call(this); this.isList = true; this.selectedItem = 0; };
      p.require = ['javaRoot.$javax.$microedition.$lcdui.$Command'];
      p.$SELECT_COMMANDLjavax_microedition_lcdui_Command_ = 'bounceSelect';
      p._clinit$$V = function(callback) {
        const cmd = new (lcdui().$Command)(); cmd._init$Ljava_lang_String_II$V(new javaRoot.$java.$lang.$String('Select'), 1, 0);
        js2me.statics.$bounceSelect = cmd; callback();
      };
      p._init$Ljava_lang_String_I_Ljava_lang_String__Ljavax_microedition_lcdui_Image_$V = function(title, type, strings, images) {
        this._init$Ljava_lang_String_I$V(title, type);
        strings.forEach((str, i) => this.$append$Ljava_lang_String_Ljavax_microedition_lcdui_Image_$I(str, images?.[i] || null));
      };
    }
    if (file === 'Form.js') {
      p.$append$Ljava_lang_String_$I = function(str) { this.formText ||= []; this.formText.push(str.text); return this.formText.length - 1; };
    }
    if (file === 'Graphics.js') {
      const construct = p.construct;
      p.construct = function(canvas) { construct.call(this, canvas); this.context.imageSmoothingEnabled = false; };
      p.$fillRect$IIII$V = function(x, y, width, height) { if(width <= 0 || height <= 0) return; this.loadContext(); this.context.fillRect(x, y, width, height); this.context.restore(); };
      p.$drawString$Ljava_lang_String_III$V = function(str, x, y, anchor) {
        const face = this.font?.javaFace === 32 ? 'mono' : 'small', width = platform.width(str.text, face);
        if (anchor & 1) x -= width >> 1; else if (anchor & 8) x -= width;
        if (anchor & 32) y -= 10; else if (anchor & 64) y -= 8;
        platform.text(this.context, str.text, x, y, this.color, face);
      };
    }
    if (file === 'Font.js') {
      const get = p.$getFont$III$Ljavax_microedition_lcdui_Font_;
      p.$getFont$III$Ljavax_microedition_lcdui_Font_ = function(...args) { const f = get.apply(this,args); f.height = 10; return f; };
      p.$stringWidth$Ljava_lang_String_$I = function(str) { return platform.width(str.text, this.javaFace === 32 ? 'mono' : 'small'); };
      p.$getBaselinePosition$$I = () => 8;
    }
    if (file === 'Sound.js') {
      p._init$_BI$V = function(data) { this.notes = BounceAudio.decode(data); this.state = 1; this.gain = 1; };
      p._init$IJ$V = function(hz, duration) { this.notes = [{frequency: hz, duration: duration.lo / 1000}]; this.state = 1; };
      p.$play$I$V = function(repeat) { BounceAudio.play(this, repeat); };
      p.$stop$$V = function() { BounceAudio.stop(this); };
      p.$getState$$I = function() { return this.endsAt > (BounceAudio.context?.currentTime || 0) ? 0 : 1; };
      p.$setGain$I$V = function(gain) { this.gain = Math.max(0, Math.min(1, gain / 100)); };
    }
    if (file === 'MIDlet.js') p.$notifyDestroyed$$V = function() { document.getElementById('status').textContent = 'Game closed · use Restart player to return'; };
  }
})();

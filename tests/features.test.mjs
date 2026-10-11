import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('BounceAudio volume control, keytones, and settings persistence', () => {
  const storage = new Map();
  const mockLocalStorage = {
    getItem: k => storage.get(k) ?? null,
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: k => storage.delete(k)
  };
  const context = { window: {}, localStorage: mockLocalStorage };
  vm.runInNewContext(readFileSync(new URL('../src/audio.js', import.meta.url), 'utf8'), context);
  const audio = context.window.BounceAudio;

  assert.equal(audio.volume, 1);
  audio.setVolume(0.5);
  assert.equal(audio.volume, 0.5);
  assert.equal(mockLocalStorage.getItem('bounce:volume'), '0.5');

  // Test clamping
  audio.setVolume(1.8);
  assert.equal(audio.volume, 1);
  audio.setVolume(-0.3);
  assert.equal(audio.volume, 0);

  // Key tones toggle
  assert.equal(audio.keyTones, false);
  audio.setKeyTones(true);
  assert.equal(audio.keyTones, true);
  assert.equal(mockLocalStorage.getItem('bounce:keytones'), 'on');
});

test('BouncePlatform exportSave, importSave, and resetSave', () => {
  const storage = new Map([
    ['Nokia/Bounce/bounceRMS/', '0'],
    ['Nokia/Bounce/bounceRMS/1', '0'],
    ['Nokia/Bounce/bounceRMS/2', '1,0,0,10'],
    ['Nokia/Bounce/bounceRMS/3', Array(255).fill(0).join(',')],
    ['Nokia/Bounce/bounceRMS/size', '3'],
    ['bounce:sound', 'on'],
    ['bounce:theme', 'dark'],
    ['other_unrelated_key', 'ignore_me']
  ]);
  const mockLocalStorage = {
    getItem: k => storage.get(k) ?? null,
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: k => storage.delete(k),
    key: i => [...storage.keys()][i],
    get length() { return storage.size; }
  };

  const context = {
    window: {},
    document: { getElementById: () => null },
    localStorage: mockLocalStorage,
    setTimeout: (fn) => fn(),
    javaRoot: { $javax: { $microedition: { $lcdui: {} } } },
    js2me: { config: {}, manifest: {} }
  };

  vm.runInNewContext(readFileSync(new URL('../src/platform.js', import.meta.url), 'utf8'), context);
  const platform = context.window.BouncePlatform;

  // Export
  const jsonStr = platform.exportSave();
  const exported = JSON.parse(jsonStr);
  assert.equal(exported.version, 1);
  assert.equal(exported.app, 'original-nokia-bounce');
  assert.equal(exported.data['Nokia/Bounce/bounceRMS/2'], '1,0,0,10');
  assert.equal(exported.data['bounce:theme'], 'dark');
  assert.equal(exported.data['other_unrelated_key'], undefined);

  // Reset
  platform.resetSave();
  assert.equal(mockLocalStorage.getItem('Nokia/Bounce/bounceRMS/2'), null);
  assert.equal(mockLocalStorage.getItem('bounce:theme'), 'dark'); // preferences kept

  // Import
  const importedSuccess = platform.importSave(jsonStr);
  assert.equal(importedSuccess, true);
  assert.equal(mockLocalStorage.getItem('Nokia/Bounce/bounceRMS/2'), '1,0,0,10');

  // Import invalid data
  assert.equal(platform.importSave('invalid-json'), false);
  assert.equal(platform.importSave({}), false);
});

test('BouncePlatform authentic cheat code sequence trigger', async () => {
  const sentKeys = [];
  const context = {
    window: {},
    document: { getElementById: () => null },
    localStorage: { getItem: () => null, setItem: () => {} },
    setTimeout: (fn) => fn(),
    javaRoot: { $javax: { $microedition: { $lcdui: {} } } },
    js2me: { config: {}, manifest: {} }
  };

  vm.runInNewContext(readFileSync(new URL('../src/platform.js', import.meta.url), 'utf8'), context);
  const platform = context.window.BouncePlatform;

  // Mock active canvas item
  platform.display = {
    current: {
      isCanvas: true
    }
  };
  platform.key = (k, pressed) => {
    if (pressed) sentKeys.push(k);
  };

  await new Promise(resolve => {
    platform.triggerCheat('787898', () => {
      resolve();
    });
  });

  // 7 = 55, 8 = 56, 9 = 57
  assert.deepEqual(sentKeys, [55, 56, 55, 56, 57, 56]);
});

test('index.html contains all enhanced UI/UX components', () => {
  const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');

  // Masthead theme toggle
  assert.ok(html.includes('id="theme-toggle"'));

  // Bezel filter & pause badge
  assert.ok(html.includes('class="screen-filter"'));
  assert.ok(html.includes('class="pause-badge"'));

  // Thumb Arcade controls
  assert.ok(html.includes('class="arcade-deck"'));
  assert.ok(html.includes('class="arcade-btn dpad-left"'));
  assert.ok(html.includes('class="arcade-btn action-jump"'));

  // Settings & features
  assert.ok(html.includes('id="theme-select"'));
  assert.ok(html.includes('id="cover-select"'));
  assert.ok(html.includes('id="screen-filter-select"'));
  assert.ok(html.includes('id="control-layout-select"'));
  assert.ok(html.includes('id="volume-range"'));
  assert.ok(html.includes('id="keytones-checkbox"'));
  assert.ok(html.includes('id="export-save-btn"'));
  assert.ok(html.includes('id="import-save-input"'));
  assert.ok(html.includes('id="reset-save-btn"'));
  assert.ok(html.includes('data-code="787898"'));
  assert.ok(html.includes('id="gamepad-status"'));
});

test('style.css contains dark mode optimization, custom scrollbars, and arcade layout', () => {
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');

  // Custom scrollbar
  assert.ok(css.includes('scrollbar-width: thin;'));
  assert.ok(css.includes('.settings-dialog::-webkit-scrollbar'));
  assert.ok(css.includes('.settings-dialog::-webkit-scrollbar-thumb'));

  // Dark themes & theme-aware variables
  assert.ok(css.includes('[data-theme="dark"]'));
  assert.ok(css.includes('[data-theme="navy"]'));
  assert.ok(css.includes('[data-theme="cyber"]'));
  assert.ok(css.includes('--scrollbar-thumb'));
  assert.ok(css.includes('--phone-shadow'));

  // Thumb Arcade controls layout
  assert.ok(css.includes('.arcade-row.row-main'));
  assert.ok(css.includes('.arcade-row.row-meta'));
  assert.ok(css.includes('.arcade-btn.action-jump'));

  // Ensure no duplicate legacy .settings-dialog block overriding dark mode
  assert.ok(!css.includes('width: min(372px'));
  assert.ok(css.includes('background: var(--dialog-bg);'));
});


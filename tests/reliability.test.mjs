import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function inputHarness() {
  const context = { window: {} }, events = [];
  vm.runInNewContext(readFileSync(new URL('../src/input.js', import.meta.url), 'utf8'), context);
  return { input: context.window.BounceInput({ key: (...event) => events.push(event) }), events };
}
function pad(pressed = [], index = 0) {
  return { connected: true, index, buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: pressed.includes(i) })), axes: [0, 0] };
}

test('overlapping keyboard, pointer and taps hold a key until its last owner releases', () => {
  const { input, events } = inputHarness();
  input.down('key:ArrowUp', -1);
  input.down('key:ArrowUp', -1);
  input.down('pointer:2', -1);
  input.tap(-1);
  input.up('pointer:2');
  assert.deepEqual(events, [[-1, true]]);
  input.release();
  assert.deepEqual(events, [[-1, true], [-1, false]]);
  assert.equal(input.held.size, 0);
});

test('controllers are blocked in settings and must return to neutral before resuming', () => {
  const { input, events } = inputHarness();
  input.poll([pad()]);
  input.poll([pad([15])]);
  input.poll([pad([15])], { blocked: true });
  input.poll([pad([0, 15])], { blocked: true });
  input.poll([pad([0, 15])]);
  assert.deepEqual(events, [[-4, true], [-4, false]]);
  input.poll([pad()]);
  input.poll([pad([0])], { menu: true });
  assert.deepEqual(events.at(-1), [-5, true]);
});

test('disconnect and controller replacement release held input without releasing keyboard owners', () => {
  const { input, events } = inputHarness();
  input.poll([pad()]);
  input.down('key:ArrowLeft', -3);
  input.poll([pad([14])]);
  input.poll([]);
  assert.deepEqual(events, [[-3, true]]);
  input.up('key:ArrowLeft');
  assert.deepEqual(events.at(-1), [-3, false]);
  input.poll([pad()]);
  input.poll([pad([15])]);
  input.poll([pad([], 1)]);
  assert.deepEqual(events.slice(-2), [[-4, true], [-4, false]]);
});

test('a held A button cannot change from jump to menu selection during a display transition', () => {
  const { input, events } = inputHarness();
  input.poll([pad()]);
  input.poll([pad([0])]);
  input.poll([pad([0])], { menu: true });
  input.poll([pad()], { menu: true });
  assert.deepEqual(events, [[-1, true], [-1, false]]);
  input.poll([pad([0])], { menu: true });
  assert.deepEqual(events.at(-1), [-5, true]);
});

const prefix = 'Nokia/Bounce/bounceRMS/';
function backup() {
  const progress = Array(97).fill(0);
  progress[8] = 1; progress[9] = 3; progress[11] = 3;
  progress[69] = 2; // Two five-byte tile records.
  progress[80] = 1; // One eight-byte moving hazard.
  progress.splice(-8, 8, 255, 255, 255, 255, 222, 173, 190, 239);
  return { version: 1, app: 'original-nokia-bounce', data: {
    [prefix]: '0', [prefix + 'size']: '3', [prefix + '1']: '3',
    [prefix + '2']: '0,0,3,20', [prefix + '3']: progress.join(','),
    'bounce:theme': 'navy', 'bounce:volume': '0.5', 'bounce:scale': '3'
  } };
}
function platformHarness() {
  const storage = new Map([[prefix, '0'], [prefix + '1', '1'], [prefix + '99', 'stale'], ['unrelated', 'keep'], ['freeSpace', '12345']]);
  let failKey;
  const context = {
    window: {}, document: { getElementById: () => null },
    localStorage: {
      getItem: k => storage.get(k) ?? null,
      setItem: (k, v) => { if (k === failKey) { failKey = undefined; throw new Error('Quota exceeded'); } storage.set(k, String(v)); },
      removeItem: k => storage.delete(k), key: i => [...storage.keys()][i], get length() { return storage.size; }
    },
    javaRoot: { $javax: { $microedition: { $lcdui: {} } } }, js2me: { config: {}, manifest: {} }
  };
  vm.runInNewContext(readFileSync(new URL('../src/platform.js', import.meta.url), 'utf8'), context);
  return { platform: context.window.BouncePlatform, storage, failOnce: key => { failKey = key; } };
}

test('complete original RMS backups restore progress, clear stale records and preserve unrelated storage', () => {
  const { platform, storage } = platformHarness();
  const data = backup();
  data.data.freeSpace = '999'; // Legacy exports included this shared runtime key.
  assert.equal(platform.importSave(JSON.stringify(data)), true);
  assert.equal(storage.get(prefix + '1'), '3');
  assert.equal(storage.has(prefix + '99'), false);
  assert.equal(storage.get('unrelated'), 'keep');
  assert.equal(storage.get('freeSpace'), '12345');
  assert.equal(storage.get('bounce:theme'), 'navy');
});

test('invalid identity, partial records, corrupt bytes and unrelated keys are rejected before any write', () => {
  const cases = [
    b => { b.app = 'other-app'; }, b => { b.version = 2; },
    b => { b.data.unrelated = 'overwrite'; }, b => { b.data['bounce:volume'] = 'NaN'; },
    b => { b.data['bounce:theme'] = 'unknown'; }, b => { b.data[prefix + '1'] = '99'; },
    b => { delete b.data[prefix + '2']; }, b => { b.data[prefix + '3'] = '1,2,3'; },
    b => { b.data[prefix + '3'] = b.data[prefix + '3'].replace(/239$/, '300'); },
    b => { b.data[prefix + '3'] = b.data[prefix + '3'].replace(/239$/, '0'); },
    b => { b.data = []; }
  ];
  for (const corrupt of cases) {
    const { platform, storage } = platformHarness(), before = [...storage];
    const data = backup(); corrupt(data);
    assert.equal(platform.importSave(JSON.stringify(data)), false);
    assert.deepEqual([...storage], before);
    assert.ok(platform.importError);
  }
});

test('a storage write failure rolls back progress and preferences', () => {
  const { platform, storage, failOnce } = platformHarness(), before = new Map(storage);
  failOnce(prefix + '2');
  assert.equal(platform.importSave(backup()), false);
  assert.deepEqual(storage, before);
});

test('cheat entry cancels if the original game leaves the level during the sequence', () => {
  const callbacks = [], keys = [], completed = [];
  const context = {
    window: {}, document: { getElementById: () => null }, js2me: { config: {}, manifest: {} },
    javaRoot: { $javax: { $microedition: { $lcdui: {} } } }, setTimeout: fn => callbacks.push(fn)
  };
  vm.runInNewContext(readFileSync(new URL('../src/platform.js', import.meta.url), 'utf8'), context);
  const platform = context.window.BouncePlatform;
  platform.display = { current: { isCanvas: true } };
  platform.key = (...args) => keys.push(args);
  assert.equal(platform.triggerCheat('invalid'), false);
  assert.equal(platform.triggerCheat('787898', result => completed.push(result)), true);
  callbacks.shift()();
  platform.display.current = { isList: true };
  callbacks.shift()();
  assert.deepEqual(keys, [[55, true], [55, false]]);
  assert.deepEqual(completed, [false]);
});

test('muted audio never resumes on game input, and master volume controls already connected sounds', () => {
  const gains = [], resumed = [];
  class AudioContext {
    state = 'suspended'; currentTime = 12; destination = {};
    resume() { resumed.push(true); this.state = 'running'; }
    createGain() {
      const node = { values: [], gain: { setValueAtTime: (value, time) => node.values.push([value, time]) }, connect: target => { node.target = target; return target; } };
      gains.push(node); return node;
    }
    createOscillator() { return { frequency: {}, connect: target => target, start() {}, stop() {} }; }
  }
  const context = { window: { AudioContext }, localStorage: { getItem: k => k === 'bounce:volume' ? 'invalid' : null, setItem() {} } };
  vm.runInNewContext(readFileSync(new URL('../src/audio.js', import.meta.url), 'utf8'), context);
  const audio = context.window.BounceAudio;
  assert.equal(audio.volume, 1);
  audio.enabled = false; audio.unlock();
  assert.equal(audio.context, null);
  audio.enabled = true; audio.unlock();
  assert.equal(resumed.length, 1);
  audio.play({ notes: [{ frequency: 1046.502, duration: .24, gate: 1, volume: 1 }] });
  assert.equal(gains[1].target, audio.master);
  audio.setVolume(.25);
  assert.deepEqual(gains[0].values.at(-1), [.25, 12]);
  audio.setVolume(NaN);
  assert.equal(audio.volume, .25);
  audio.enabled = false; audio.context.state = 'suspended'; audio.unlock();
  assert.equal(resumed.length, 1);
});

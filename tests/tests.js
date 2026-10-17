/* Open tests/index.html in a browser; no build or test runtime to install. */
(async function () {
  const results = document.getElementById('results');
  let passed = 0, failed = 0;
  function assert(condition, message = 'Assertion failed') { if (!condition) throw new Error(message); }
  function equal(actual, expected) { assert(JSON.stringify(actual) === JSON.stringify(expected), `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }
  async function rejects(operation, message) {
    try { await operation(); } catch (error) { assert(message.test(error.message), error.message); return; }
    throw new Error('Invalid input was accepted');
  }
  async function test(name, operation) {
    const item = document.createElement('li');
    try { await operation(); passed++; item.className = 'pass'; item.textContent = `PASS: ${name}`; }
    catch (error) { failed++; item.className = 'fail'; item.textContent = `FAIL: ${name}: ${error.message}`; console.error(error); }
    results.append(item);
  }
  const encode = text => new TextEncoder().encode(text).buffer;
  await test('SHA-256 known reference vectors', () => {
    equal(BounceSHA256(encode('')), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    equal(BounceSHA256(encode('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    equal(BounceSHA256(encode('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')), '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
    equal(BounceSHA256(encode('a'.repeat(1000000))), 'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0');
  });
  await test('SHA-256 agrees with Web Crypto at padding boundaries', async () => {
    if (!crypto.subtle) return; // Known vectors above also cover insecure contexts.
    for (const size of [1, 55, 56, 63, 64, 65, 119, 120, 128, 1024 * 1024]) {
      const bytes = new Uint8Array(size);
      for (let offset = 0; offset < size; offset += 65536) crypto.getRandomValues(bytes.subarray(offset, offset + 65536));
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      equal(BounceSHA256(bytes.buffer), Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join(''));
    }
  });
  await test('Invalid JARs fail before launch', async () => {
    await rejects(() => BounceJar.validate(null), /Choose a .jar/);
    await rejects(() => BounceJar.validate(new File(['wrong'], 'game.txt')), /Choose a .jar/);
    await rejects(() => BounceJar.validate(new File([], 'empty.jar')), /non-empty/);
    await rejects(() => BounceJar.validate(new File([new Uint8Array(1024 * 1024 + 1)], 'large.jar')), /smaller than 1 MB/);
    await rejects(() => BounceJar.validate(new File(['wrong'], 'game.jar')), /not the supported/);
  });
  await test('Handset glyph data preserves the original player font', () => {
    equal(BounceSHA256(encode(JSON.stringify(BounceFonts))), '971cdf82159f3574965c8f70134e9fc204c365719b0a21c762297a6af8db991c');
  });
  function inputHarness() {
    const events = [];
    return { input: BounceInput({ key: (...event) => events.push(event) }), events };
  }
  const pad = (pressed = []) => ({ connected: true, index: 0, buttons: Array.from({ length: 16 }, (_, index) => ({ pressed: pressed.includes(index) })), axes: [0, 0] });
  await test('Overlapping keyboard and touch owners release keys correctly', () => {
    const { input, events } = inputHarness();
    input.down('key:up', -1); input.down('pointer:2', -1); input.tap(-1); input.up('pointer:2');
    equal(events, [[-1, true]]);
    input.release(); equal(events, [[-1, true], [-1, false]]); equal(input.held.size, 0);
  });
  await test('Gamepads wait for neutral after settings or disconnect', () => {
    const { input, events } = inputHarness();
    input.poll([pad()]); input.poll([pad([15])]); input.poll([pad([15])], { blocked: true });
    input.poll([pad([0, 15])]); equal(events, [[-4, true], [-4, false]]);
    input.poll([pad()]); input.poll([pad([0])], { menu: true }); equal(events.at(-1), [-5, true]);
    input.poll([]); equal(events.at(-1), [-5, false]);
  });
  const prefix = 'Nokia/Bounce/bounceRMS/';
  function backup() {
    const progress = Array(97).fill(0);
    progress[8] = 1; progress[9] = 3; progress[11] = 3; progress[69] = 2; progress[80] = 1;
    progress.splice(-8, 8, 255, 255, 255, 255, 222, 173, 190, 239);
    return { version: 1, app: 'original-nokia-bounce', data: {
      [prefix]: '0', [prefix + 'size']: '3', [prefix + '1']: '3', [prefix + '2']: '0,0,3,20', [prefix + '3']: progress.join(','),
      'bounce:theme': 'navy', 'bounce:volume': '0.5', 'bounce:last-backup': '1790000000000'
    } };
  }
  await test('Save import/export preserves progress and unrelated data', () => {
    testRecords.clear(); testRecords.set('unrelated', 'keep'); testRecords.set(prefix + '99', 'stale');
    assert(BouncePlatform.importSave(backup()), BouncePlatform.importError);
    equal(localStorage.getItem('unrelated'), 'keep'); equal(localStorage.getItem(prefix + '99'), null);
    equal(localStorage.getItem('bounce:last-backup'), '1790000000000');
    equal(JSON.parse(BouncePlatform.exportSave()).data[prefix + '1'], '3');
    BouncePlatform.resetSave(); equal(localStorage.getItem(prefix + '1'), null); equal(localStorage.getItem('bounce:theme'), 'navy');
  });
  await test('Corrupt and partial save backups leave storage unchanged', () => {
    for (const corrupt of [
      b => { b.app = 'other'; }, b => { b.version = 2; }, b => { delete b.data[prefix + '2']; },
      b => { b.data[prefix + '3'] = '1,2,3'; }, b => { b.data['bounce:volume'] = 'NaN'; }, b => { b.data.unrelated = 'overwrite'; },
      b => { b.data['bounce:last-backup'] = 'yesterday'; }
    ]) {
      const data = backup(); corrupt(data); const before = [...testRecords];
      equal(BouncePlatform.importSave(data), false); equal([...testRecords], before);
    }
  });
  await test('Failed save writes roll back the transaction', () => {
    const before = [...testRecords], original = testStorage.setItem;
    let fail = true;
    testStorage.setItem = (key, value) => { if (fail && key === prefix + '2') { fail = false; throw new Error('Quota exceeded'); } original(key, value); };
    try { equal(BouncePlatform.importSave(backup()), false); equal([...testRecords].sort(), before.sort()); }
    finally { testStorage.setItem = original; }
  });
  await test('Volume and keypad tones use browser preference storage', () => {
    BounceAudio.setVolume(.25); equal(BounceAudio.volume, .25); equal(localStorage.getItem('bounce:volume'), '0.25');
    BounceAudio.setVolume(NaN); equal(BounceAudio.volume, .25);
    BounceAudio.setKeyTones(true); equal(localStorage.getItem('bounce:keytones'), 'on');
  });
  document.getElementById('summary').textContent = `${passed} passed, ${failed} failed`;
  document.documentElement.dataset.tests = failed ? 'failed' : 'passed';
  document.getElementById('jar-fixture').addEventListener('change', async event => {
    const result = document.getElementById('jar-result'), file = event.target.files[0];
    if (!file) return;
    try {
      const verified = await BounceJar.validate(file);
      equal(BounceSHA256(await verified.arrayBuffer()), BounceJar.SHA256);
      equal(verified.size, file.size);
      result.textContent = 'PASS: original JAR verified; byte snapshot preserved. Nothing was stored or uploaded.';
    } catch (error) { result.textContent = 'FAIL: ' + error.message; }
  });
})();

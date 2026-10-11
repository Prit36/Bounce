import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createHash, webcrypto } from 'node:crypto';
import vm from 'node:vm';
import { auditPublicFiles, resetGeneratedDirectory } from '../scripts/release-files.mjs';

const source = await readFile(new URL('../src/jar.js', import.meta.url), 'utf8');
function harness(crypto = webcrypto, indexedDB) {
  const context = { window: {}, crypto, indexedDB, Blob, Uint8Array, fetch: () => assert.fail('JAR verification must not make network requests') };
  vm.runInNewContext(source, context);
  return context.window.BounceJar;
}
const file = (name, bytes) => ({ name, size: bytes.byteLength, arrayBuffer: async () => bytes });

// Minimal asynchronous storage double. Writes become visible only on commit;
// a failed transaction must never be reported as a remembered file.
function memoryIndexedDB() {
  const records = new Map();
  return {
    failNextWrite: false,
    open() {
      const request = {};
      queueMicrotask(() => {
        request.result = {
          close() {},
          transaction: (_name, mode) => {
            const transaction = {};
            transaction.objectStore = () => {
              const operation = (action, result) => {
                const item = {};
                queueMicrotask(() => {
                  if (mode === 'readwrite' && this.failNextWrite) {
                    this.failNextWrite = false;
                    transaction.onabort();
                  } else {
                    action();
                    item.result = result();
                    transaction.oncomplete();
                  }
                });
                return item;
              };
              return {
                put: (value, key) => operation(() => records.set(key, structuredClone(value)), () => key),
                get: key => operation(() => {}, () => records.has(key) ? structuredClone(records.get(key)) : undefined),
                delete: key => operation(() => records.delete(key), () => undefined)
              };
            };
            return transaction;
          }
        };
        request.onsuccess();
      });
      return request;
    }
  };
}

function fixtureCrypto() {
  const fingerprint = Uint8Array.from(harness().SHA256.match(/../g), pair => parseInt(pair, 16)).buffer;
  return { subtle: { digest: async (algorithm, bytes) => new Uint8Array(bytes).join() === '80,75,3,4,10' ? fingerprint : webcrypto.subtle.digest(algorithm, bytes) } };
}

test('wrong files are rejected before reading or launching anything', async () => {
  const jar = harness();
  await assert.rejects(jar.validate(null), /Choose a .jar/);
  await assert.rejects(jar.validate({ name: 'game.txt', size: 20 }), /Choose a .jar/);
  await assert.rejects(jar.validate({ name: 'game.jar', size: 0 }), /non-empty/);
  await assert.rejects(jar.validate({ name: 'game.jar', size: 1024 * 1024 + 1 }), /smaller than 1 MB/);
  await assert.rejects(jar.validate(file('renamed.jar', new TextEncoder().encode('not a game').buffer)), /not the supported/);
  await assert.rejects(harness({}).validate(file('game.jar', new ArrayBuffer(2))), /HTTPS or localhost/);
});

test('the verified byte snapshot is passed to the VM unchanged', async () => {
  const bytes = new Uint8Array([80, 75, 3, 4, 10]).buffer;
  const expected = harness().SHA256;
  let checked;
  const jar = harness({ subtle: { digest: async (algorithm, data) => {
    assert.equal(algorithm, 'SHA-256');
    checked = data;
    return Uint8Array.from(expected.match(/../g), pair => parseInt(pair, 16)).buffer;
  } } });
  const accepted = await jar.validate(file('MY-BOUNCE.JAR', bytes));
  assert.equal(checked, bytes);
  assert.deepEqual(new Uint8Array(await accepted.arrayBuffer()), new Uint8Array(bytes));
  assert.equal(accepted.type, 'application/java-archive');
});

test('a remembered JAR survives a fresh player and Forget JAR deletes it', async () => {
  const database = memoryIndexedDB(), crypto = fixtureCrypto();
  const first = harness(crypto, database);
  assert.equal(await first.load(), null);
  const original = await first.validate(file('bounce.jar', new Uint8Array([80, 75, 3, 4, 10]).buffer));
  await first.remember('bounce.jar', original);
  const next = harness(crypto, database);
  const restored = await next.load();
  assert.equal(restored.name, 'bounce.jar');
  assert.deepEqual(new Uint8Array(await restored.blob.arrayBuffer()), new Uint8Array(await original.arrayBuffer()));
  await next.forget();
  assert.equal(await harness(crypto, database).load(), null);
});

test('stored JAR bytes and names are checked again before being returned for launch', async () => {
  const database = memoryIndexedDB(), crypto = fixtureCrypto();
  await harness(crypto, database).remember('bounce.jar', new Blob(['tampered content']));
  await assert.rejects(harness(crypto, database).load(), /not the supported/);
  await harness(crypto, database).remember('wrong.txt', new Blob([new Uint8Array([80, 75, 3, 4, 10])]));
  await assert.rejects(harness(crypto, database).load(), /Choose a .jar/);
});

test('failed storage commits reject and do not claim persistence or deletion', async () => {
  const database = memoryIndexedDB(), jar = harness(fixtureCrypto(), database);
  const blob = new Blob([new Uint8Array([80, 75, 3, 4, 10])]);
  database.failNextWrite = true;
  await assert.rejects(jar.remember('bounce.jar', blob), /remembered JAR/);
  assert.equal(await jar.load(), null);
  await jar.remember('bounce.jar', blob);
  database.failNextWrite = true;
  await assert.rejects(jar.forget(), /remembered JAR/);
  assert.equal((await jar.load()).name, 'bounce.jar');
  await assert.rejects(harness().remember('bounce.jar', blob), /storage is unavailable/);
  await harness().forget();
});

test('release audit rejects game content, private material, and disguised binaries', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'bounce-release-test-'));
  try {
    await writeFile(resolve(root, 'player.js'), '// wrapper');
    assert.deepEqual(await auditPublicFiles(root), ['player.js']);
    for (const name of ['game.jar', 'Game.class', 'sound.ott', 'screenshot.png', '.env', 'private.key']) {
      await writeFile(resolve(root, name), 'fixture');
      await assert.rejects(auditPublicFiles(root), /Private or game/);
      await rm(resolve(root, name));
    }
    await writeFile(resolve(root, 'renamed.bin'), Buffer.from([80, 75, 3, 4]));
    await assert.rejects(auditPublicFiles(root), /disguised/);
    await rm(resolve(root, 'renamed.bin'));
    await mkdir(resolve(root, '.private'));
    await assert.rejects(auditPublicFiles(root), /Private or game/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('rebuilding generated output clears old bundled content and protects private files', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'bounce-build-test-'));
  try {
    await mkdir(resolve(root, 'dist/game'), { recursive: true });
    await writeFile(resolve(root, 'dist/game/old.jar'), 'private fixture');
    await writeFile(resolve(root, 'original.jar'), 'keep original');
    await resetGeneratedDirectory(root, 'dist');
    assert.deepEqual(await auditPublicFiles(resolve(root, 'dist')), []);
    assert.equal(await readFile(resolve(root, 'original.jar'), 'utf8'), 'keep original');
    await assert.rejects(resetGeneratedDirectory(root, '../'), /Unexpected/);
    await assert.rejects(resetGeneratedDirectory(root, '.private'), /Unexpected/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('player has no bundled JAR request, upload API, or game download link', async () => {
  const app = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
  const html = await readFile(new URL('../src/index.html', import.meta.url), 'utf8');
  assert.ok(!app.includes("fetch('game/"));
  assert.ok(!html.includes('href="game/'));
  assert.ok(!/FormData|sendBeacon|XMLHttpRequest/.test(app + source));
  assert.ok(html.includes('id="jar-input"'));
  assert.ok(app.includes('BounceJar.validate(file)'));
});

test('licensed handset glyphs exactly preserve the earlier player font', async () => {
  const fonts = JSON.parse(await readFile(new URL('../src/fonts.json', import.meta.url), 'utf8'));
  assert.equal(createHash('sha256').update(JSON.stringify(fonts)).digest('hex'), '971cdf82159f3574965c8f70134e9fc204c365719b0a21c762297a6af8db991c');
  const notice = await readFile(new URL('../vendor/nokia-font/LICENSE.txt', import.meta.url), 'utf8');
  assert.ok(notice.includes('Copyright (c) 2013, Přemysl Eric Janouch'));
  assert.ok(notice.includes('Permission to use, copy, modify, and/or distribute'));
});

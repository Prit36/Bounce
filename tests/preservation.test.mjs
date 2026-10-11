import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import vm from 'node:vm';

// Optional private fixture: never required for a clean public checkout or CI.
const path = process.env.BOUNCE_TEST_JAR || new URL('../nokiabounc_jdifc8jb.jar', import.meta.url);
const available = existsSync(path);
const jar = available ? readFileSync(path) : null;

test('private original JAR remains unchanged and contains the original classes and levels', { skip: !available }, () => {
  assert.equal(createHash('sha256').update(jar).digest('hex'), '77a24bf1de10ad8a1c440fc96aa1ed2e4b29f2102771f268eaa93ff910b55ee8');
  const files = new Map();
  let offset = 0;
  while (jar.readUInt32LE(offset) === 0x04034b50) {
    const compression = jar.readUInt16LE(offset + 8), size = jar.readUInt32LE(offset + 18);
    const nameLength = jar.readUInt16LE(offset + 26), extra = jar.readUInt16LE(offset + 28);
    const name = jar.toString('utf8', offset + 30, offset + 30 + nameLength), start = offset + 30 + nameLength + extra;
    const data = jar.subarray(start, start + size);
    files.set(name, compression === 8 ? inflateRawSync(data) : data);
    offset = start + size;
  }
  assert.equal([...files.keys()].filter(name => name.endsWith('.class')).length, 8);
  assert.equal([...files.keys()].filter(name => /^levels\/J2MElvl\.\d+$/.test(name)).length, 11);
  const context = { window: {}, localStorage: { getItem: () => null } };
  vm.runInNewContext(readFileSync(new URL('../src/audio.js', import.meta.url), 'utf8'), context);
  for (const [name, bytes] of files) {
    if (name.endsWith('.ott')) assert.ok(context.window.BounceAudio.decode(bytes).length > 0);
  }
});

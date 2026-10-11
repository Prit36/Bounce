import { copyFile, cp } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildFonts } from './fonts.mjs';
import { resetGeneratedDirectory, auditPublicFiles } from './release-files.mjs';
const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
await resetGeneratedDirectory(root, 'dist');
await buildFonts(root);
for (const file of ['index.html', 'style.css', 'app.js', 'input.js', 'jar.js', 'platform.js', 'audio.js', 'fonts.json', 'favicon.svg']) {
  await copyFile(resolve(root, 'src', file), resolve(dist, file));
}
await cp(resolve(root, 'vendor/js2me'), resolve(dist, 'vendor/js2me'), { recursive: true });
await cp(resolve(root, 'src/ui-fonts'), resolve(dist, 'ui-fonts'), { recursive: true });
await cp(resolve(root, 'vendor/nokia-font'), resolve(dist, 'vendor/nokia-font'), { recursive: true });
await copyFile(resolve(root, 'THIRD_PARTY_NOTICES.md'), resolve(dist, 'THIRD_PARTY_NOTICES.md'));
await copyFile(resolve(root, 'LICENSE'), resolve(dist, 'LICENSE'));
await auditPublicFiles(dist);
console.log('Built static player in dist/. No game JAR or game assets included.');

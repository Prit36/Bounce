import { copyFile, cp, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { auditPublicFiles, resetGeneratedDirectory } from './release-files.mjs';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'release/github-source');
await resetGeneratedDirectory(root, 'release/github-source');
// Explicit allowlist: no .git history, personal analysis, credentials, or game files.
for (const file of ['.gitignore', '.gitattributes', 'package.json', 'LICENSE', 'README.md', 'RELEASING.md', 'THIRD_PARTY_NOTICES.md', 'PLAY-BOUNCE.cmd']) {
  await copyFile(resolve(root, file), resolve(output, file));
}
for (const folder of ['vendor', 'tests', '.github']) {
  await cp(resolve(root, folder), resolve(output, folder), { recursive: true });
}
for (const file of ['index.html', 'style.css', 'app.js', 'input.js', 'jar.js', 'platform.js', 'audio.js', 'fonts.json', 'favicon.svg']) {
  await cp(resolve(root, 'src', file), resolve(output, 'src', file));
}
for (const file of ['Outfit.ttf', 'OFL.txt']) await cp(resolve(root, 'src/ui-fonts', file), resolve(output, 'src/ui-fonts', file));
await cp(resolve(root, 'scripts'), resolve(output, 'scripts'), {
  recursive: true,
  filter: source => source === resolve(root, 'scripts') || ['build.mjs', 'serve.mjs', 'fonts.mjs', 'release-files.mjs', 'release.mjs'].some(file => source === resolve(root, 'scripts', file))
});
const files = await auditPublicFiles(output);
await writeFile(resolve(root, 'release/manifest.json'), JSON.stringify({ files, gameFilesIncluded: false, gitHistoryIncluded: false }, null, 2) + '\n');
console.log(`Prepared ${files.length} audited files in release/github-source/. Start a fresh Git repository there; do not publish this checkout's old history.`);

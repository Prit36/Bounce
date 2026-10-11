import { lstat, readdir, readFile, rm, mkdir } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';

// Only these directories are generated; never accept an arbitrary delete target.
export async function resetGeneratedDirectory(root, name) {
  if (!['dist', 'release/github-source'].includes(name)) throw new Error('Unexpected generated directory');
  const absoluteRoot = resolve(root), target = resolve(root, name);
  if (!target.startsWith(absoluteRoot + sep) || relative(absoluteRoot, target).split(sep).join('/') !== name) throw new Error('Generated directory escapes project');
  // Refuse links in any component of the generated path before recursively deleting.
  let component = absoluteRoot;
  for (const part of name.split('/')) {
    component = resolve(component, part);
    const stat = await lstat(component).catch(error => { if (error.code !== 'ENOENT') throw error; });
    if (stat?.isSymbolicLink()) throw new Error('Generated directory cannot be a symbolic link');
  }
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
}

export async function auditPublicFiles(directory) {
  const files = [];
  async function visit(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const path = resolve(folder, entry.name);
      const name = relative(directory, path).split(sep).join('/');
      if (entry.isSymbolicLink()) throw new Error('Public files cannot contain symlinks: ' + name);
      if (/(^|\/)(?:\.git|\.private|\.openai|analysis|tools|jars|levels|sounds|decompiled|\.env(?:\.[^/]*)?)(\/|$)/i.test(name)
          || /^game(?:\/|$)/i.test(name)
          || /\.(?:jar|jad|class|ott|bdf|zip|tar|gz|png|jpe?g|webp)$/i.test(name)
          || /\.(?:pem|key|p12|pfx)$/i.test(name)
          || /(?:bouncesplash|objects_nm|bytecode)/i.test(name)) throw new Error('Private or game material in public files: ' + name);
      if (entry.isDirectory()) await visit(path);
      else {
        const bytes = await readFile(path);
        if (bytes.length >= 4 && (bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 3, 4])) || bytes.subarray(0, 4).equals(Buffer.from([0xca, 0xfe, 0xba, 0xbe])))) throw new Error('Archive or Java class disguised as a public file: ' + name);
        files.push(name);
      }
    }
  }
  await visit(directory);
  return files.sort();
}

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function buildFonts(root) {
  const source = await readFile(resolve(root, 'vendor/nokia-font/nokia-fonts.c'), 'utf8');
  const array = name => {
    const content = source.match(new RegExp('nokia_' + name + '_data\\[\\]\\s*=\\s*\\{([\\s\\S]*?)\\n\\};'))?.[1];
    if (!content) throw new Error('Missing licensed handset font: ' + name);
    return content;
  };
  const record = /\{\s*(\d+),\s*(\d+),\s*\{([^}]+)\}\s*\}/g;
  function glyph(width, advance, hex, small) {
    const rows = hex.match(/0x[0-9a-f]+/gi).map(value => Number(value) >>> (8 - Number(width)));
    return { width: Number(width), advance: Number(advance), rows: small ? [0, ...rows, 0] : rows };
  }
  const small = { height: 10, glyphs: {} }, menu = { height: 12, glyphs: {} };
  for (const [face, name, start, expected] of [[small, 'small', 32, 95], [menu, 'menu', 45, 13]]) {
    const records = [...array(name).matchAll(record)];
    if (records.length !== expected) throw new Error('Invalid handset glyph count');
    records.forEach((match, index) => { face.glyphs[String.fromCharCode(start + index)] = glyph(match[1], match[2], match[3], name === 'small'); });
  }
  for (const match of array('small_wide').matchAll(/L'([^']+)'\s*,\s*\{\s*(\d+),\s*(\d+),\s*\{([^}]+)\}/g)) {
    small.glyphs[match[1]] = glyph(match[2], match[3], match[4], true);
  }
  await writeFile(resolve(root, 'src/fonts.json'), JSON.stringify({ small, menu }) + '\n');
}

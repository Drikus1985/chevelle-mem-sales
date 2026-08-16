/* Catalogue integrity: the invariants the browser suite can't see, because they are about
   the files on disk rather than the running page. Every product code must have a thumbnail,
   and every thumbnail must belong to a product code — a build that drops or duplicates one
   would otherwise ship a plate that renders with a broken image.
   Run: node test/_catalogue.mjs */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const html = readFileSync(join(root, 'site/index.html'), 'utf8');
const match = html.match(/const CATS = (\[[\s\S]*?\]);\n/);
if (!match) {
  console.error('FAIL: could not find CATS in site/index.html');
  process.exit(1);
}

const cats  = JSON.parse(match[1]);
const codes = cats.flatMap(c => c.items.map(i => i.c));
const files = new Set(
  readdirSync(join(root, 'site/img'))
    .filter(f => f.endsWith('.webp'))
    .map(f => f.replace(/\.webp$/, ''))
);

const unique  = new Set(codes);
const missing = codes.filter(c => !files.has(c));
const orphans = [...files].filter(f => !unique.has(f));

console.log(`${cats.length} categories, ${codes.length} codes, ${unique.size} unique, ${files.size} thumbnails`);

const fail = [];
if (unique.size !== codes.length) fail.push(`${codes.length - unique.size} duplicate code(s)`);
if (missing.length) fail.push(`${missing.length} code(s) with no image: ${missing.slice(0, 5).join(', ')}`);
if (orphans.length) fail.push(`${orphans.length} image(s) with no code: ${orphans.slice(0, 5).join(', ')}`);

if (fail.length) {
  console.error('FAIL: ' + fail.join('; '));
  process.exit(1);
}
console.log('OK: every code has an image and every image has a code');

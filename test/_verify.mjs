/* Verifies the behaviour changed in this branch, plus the documented behaviour it
   must not have broken. Run: node test/_verify.mjs   (serves site/ on :8099) */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const ROOT = new URL('../site/', import.meta.url).pathname;
const TYPES = { '.html':'text/html', '.webp':'image/webp' };
const srv = createServer(async (rq, rs) => {
  const p = join(ROOT, rq.url === '/' ? 'index.html' : decodeURIComponent(rq.url.split('?')[0]));
  try {
    const b = await readFile(p);
    rs.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' });
    rs.end(b);
  } catch { rs.writeHead(404); rs.end('nope'); }
});
await new Promise(r => srv.listen(8099, r));

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
// Block Google Fonts: the app must render without it.
await page.route('**://fonts.*/**', r => r.abort());
const dialogs = [];
page.on('dialog', d => { dialogs.push(d.message()); d.dismiss(); });
await page.goto('http://127.0.0.1:8099/', { waitUntil: 'domcontentloaded' });

let pass = 0, fail = 0;
const ok = (name, cond, extra='') => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  <- ' + extra : '')); }
};
const add = (code, q) => page.evaluate(([c,n]) => setQty(c,n), [code,q]);
const T   = () => page.evaluate(() => totals());
const REF = () => page.evaluate(() => ref());

console.log('\nReference');
const r1 = await REF();
ok('format CHEV-YYMMDD-HHMM-XXX', /^CHEV-\d{6}-\d{4}-[ACDEFGHJKLMNPQRTUVWXY34789]{3}$/.test(r1), r1);
ok('stable within a session', r1 === await REF());
const salts = await page.evaluate(() => {
  const s = new Set();
  for (let i=0;i<400;i++){ currentRef = null; s.add(ref().split('-')[3]); }
  currentRef = null; return s.size;
});
ok('salt varies across orders (>100 distinct in 400)', salts > 100, 'got ' + salts);

console.log('\nTotals (documented behaviour, must not regress)');
await add('CC-CAR-001', 2);
let t = await T();
ok('2 in-stock plates = R198 + R99 delivery = R297', t.sub===198 && t.del===99 && t.v===297, JSON.stringify(t));
await page.evaluate(() => { BRAND.soldOut = ['CC-CAR-002']; });
await add('CC-CAR-002', 1);
t = await T();
ok('mixed basket: pre-order excluded from payable', t.v===297 && t.pre===99 && t.nPre===1, JSON.stringify(t));
await add('CC-CAR-001', 0);
t = await T();
ok('pre-order-only basket carries no delivery fee', t.del===0 && t.v===0, JSON.stringify(t));
ok('card button disabled on pre-order-only', await page.$eval('#bYoco', b=>b.disabled));
ok('card copy link withheld on pre-order-only', await page.$eval('#payYoco', n=>n.dataset.full)==='');

console.log('\nYoco link');
await add('CC-CAR-002', 0); await add('CC-CAR-001', 3);
const url = await page.evaluate(() => yocoURL());
const u = new URL(url);
ok('amount matches panel total', u.searchParams.get('amount')==='396.00', url);
ok('reference matches panel reference', u.searchParams.get('reference')=== await REF());

console.log('\nNew guards');
await page.fill('#cNote', '');
await page.click('#bWa');
ok('WhatsApp blocked with no delivery address', (await page.evaluate(()=>orderSent))===false);
// Regression: the panel is only a drawer below 960px. Prompting for the address on
// desktop must not switch on the full-screen scrim, which would block the whole page.
ok('desktop: no scrim after address prompt', !(await page.$eval('#scrim', n=>n.classList.contains('on'))));
// Same guard on the real mobile flow: open the drawer from the mobile bar, then try to send.
await page.setViewportSize({ width: 390, height: 844 });
await page.click('#mOpen');
await page.waitForTimeout(400);
await page.click('#bWa');
ok('mobile: send still blocked without an address', (await page.evaluate(()=>orderSent))===false);
ok('mobile: drawer stays open on the address field', await page.$eval('#pan', n=>n.classList.contains('open')));
await page.evaluate(()=>closePan());
await page.setViewportSize({ width: 1280, height: 720 });
await page.fill('#cNote', '12 Test Road, Bedfordview');
dialogs.length = 0;
await page.click('#bYoco');
ok('card warns when order not yet sent', dialogs.length===1 && /WhatsApp first/.test(dialogs[0]||''), JSON.stringify(dialogs));

console.log('\nCatalogue');
ok('558 plates loaded', await page.evaluate(()=>ALL.length)===558);
ok('renders without Google Fonts', (await page.$$('.p')).length > 0);
const imgOk = await page.evaluate(async () => {
  const r = await fetch('img/CC-CAR-001.webp'); return r.ok;
});
ok('thumbnails served', imgOk);

console.log(`\n${pass} passed, ${fail} failed\n`);
await browser.close(); srv.close();
process.exit(fail ? 1 : 0);

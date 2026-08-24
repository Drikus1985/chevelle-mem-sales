/* Verifies the behaviour changed in this branch, plus the documented behaviour it
   must not have broken. Run: node test/_verify.mjs   (serves site/ on :8099) */
import { chromium } from 'playwright';
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

const browser = await chromium.launch();
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

console.log('\nStock cap');
ok('default cap is 3 per plate', await page.evaluate(() => maxQty('CC-CAR-001')) === 3);
await add('CC-CAR-001', 5);
ok('basket clamps to what is on hand', await page.evaluate(() => cart.get('CC-CAR-001')) === 3);
ok('the refusal is explained, not silent',
  /only 3 in stock/i.test(await page.$eval('#tst', n => n.textContent)));
// 1, not 3 — an override equal to the default would pass without testing anything.
await page.evaluate(() => { BRAND.stock = { 'CC-CAR-003': 1 }; });
await add('CC-CAR-003', 9);
ok('per-code stock override is honoured', await page.evaluate(() => cart.get('CC-CAR-003')) === 1);
await page.evaluate(() => { BRAND.stock = { 'CC-CAR-004': 0 }; });
ok('stock 0 counts as sold out', await page.evaluate(() => isSold('CC-CAR-004')));
ok('a sold-out plate can still be pre-ordered', await page.evaluate(() => {
  setQty('CC-CAR-004', 1); return cart.get('CC-CAR-004'); }) === 1);
await page.evaluate(() => { cart.clear(); BRAND.stock = {}; currentRef = null; sync(); });

console.log('\nVolume pricing');
await page.evaluate(() => { cart.clear(); BRAND.stock = { 'CC-CAR-001': 99 }; currentRef = null; sync(); });
ok('1-4 plates bill at R99',  await page.evaluate(()=>unitPrice(4))===99);
ok('5 plates unlock R89',     await page.evaluate(()=>unitPrice(5))===89);
ok('10 plates unlock R79',    await page.evaluate(()=>unitPrice(10))===79);
ok('20 plates hit the R75 floor', await page.evaluate(()=>unitPrice(20))===75);
ok('nothing prices below R75', await page.evaluate(()=>unitPrice(5000))===75);
await add('CC-CAR-001', 10);
let vt = await T();
ok('10 plates = R790 + R99 = R889', vt.unit===79 && vt.sub===790 && vt.v===889, JSON.stringify(vt));
ok('saving reported correctly', vt.saved===200, 'saved=' + vt.saved);
ok('panel names the rate', /R79/.test(await page.$eval('#panTier', n=>n.textContent)));
await add('CC-CAR-001', 8);
ok('nudge names the next tier and the gap', await page.$eval('#panTierNote', n =>
  !n.hidden && /add 2 more/i.test(n.textContent) && /R79/.test(n.textContent)),
  await page.$eval('#panTierNote', n=>n.textContent));
await add('CC-CAR-001', 20);
ok('top tier says best price reached', /best price reached/i.test(await page.$eval('#panTierNote', n=>n.textContent)));
ok('WhatsApp message states the volume rate',
  /Volume price: R75 a plate on 20 plates/.test(await page.evaluate(()=>orderText())));
// the tier counts pre-orders too: the order ships complete, so it is priced as one order
await page.evaluate(() => { cart.clear(); BRAND.soldOut = ['CC-CAR-002']; BRAND.stock = { 'CC-CAR-001': 99, 'CC-CAR-002': 99 }; sync(); });
await add('CC-CAR-001', 3); await add('CC-CAR-002', 2);
vt = await T();
ok('pre-orders count toward the tier', vt.n===5 && vt.unit===89, JSON.stringify(vt));
// The customer-facing copy must be generated, so editing tiers cannot leave a stale price.
const foot = await page.$eval('#panNote', n => n.textContent);
ok('footnote lists the tiers, not a flat price',
  /R99 each, R89 from 5, R79 from 10 and R75 from 20/.test(foot) && !/Every plate is R99/.test(foot), foot.slice(0,90));
ok('masthead advertises the floor price',
  /from R75/.test(await page.$eval('#pill', n => n.textContent)));
await page.evaluate(() => { cart.clear(); BRAND.soldOut = []; BRAND.stock = {}; currentRef = null; sync(); });

console.log('\nTotals (documented behaviour, must not regress)');
// These assert the money, not the cap, so give the test plates headroom.
await page.evaluate(() => { BRAND.stock = { 'CC-CAR-001': 9, 'CC-CAR-002': 9 }; });
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

console.log('\nMixed-basket shipping (one fee, held and shipped complete)');
await page.evaluate(() => { cart.clear(); currentRef = null; orderSent = false; recordedRef = null; });
await page.evaluate(() => { BRAND.soldOut = ['CC-CAR-002']; });
await add('CC-CAR-001', 2); await add('CC-CAR-002', 1);
t = await T();
ok('mixed basket charges one delivery fee', t.del===99 && t.v===297, JSON.stringify(t));
ok('panel explains the order is held', await page.$eval('#panShip', n =>
  !n.hidden && /hold the whole/i.test(n.textContent) && /one R99 delivery/i.test(n.textContent)));
ok('WhatsApp message states one delivery', /one R99 delivery/i.test(await page.evaluate(()=>orderText())));
await add('CC-CAR-001', 0);
ok('pre-order-only shows its own note', await page.$eval('#panShip', n =>
  !n.hidden && /nothing ships or gets charged yet/i.test(n.textContent)));
await add('CC-CAR-002', 0);
ok('note hidden with no pre-orders', await page.$eval('#panShip', n => n.hidden));

console.log('\nOrder capture');
const posts = [];
await page.route('**/', route => {
  const rq = route.request();
  if (rq.method() === 'POST') { posts.push(rq.postData() || ''); return route.fulfill({ status: 200, body: 'ok' }); }
  route.continue();
});
await page.evaluate(() => { cart.clear(); currentRef = null; orderSent = false; recordedRef = null; BRAND.soldOut = []; });
await add('CC-CAR-001', 2);
await page.fill('#cName', 'Test Buyer');
await page.fill('#cTel', '0821234567');
await page.fill('#cNote', '12 Test Road, Bedfordview');
await page.click('#bCopy');
await page.waitForTimeout(300);
ok('order posted to the Netlify form', posts.length===1, 'posts=' + posts.length);
const post = new URLSearchParams(posts[0] || '');
ok('posts to form-name=orders', post.get('form-name')==='orders');
ok('carries the reference', post.get('ref')=== await REF());
ok('carries address and total', post.get('address')==='12 Test Road, Bedfordview' && post.get('total')==='297');
ok('carries the full order text', /CC-CAR-001/.test(post.get('order')||''));
ok('records shipping state', post.get('ships')==='ships now', post.get('ships'));
await page.click('#bCopy');
await page.waitForTimeout(300);
ok('same reference is not posted twice', posts.length===1, 'posts=' + posts.length);
await page.evaluate(() => { BRAND.captureOrders = false; currentRef = null; recordedRef = null; });
await page.click('#bCopy');
await page.waitForTimeout(300);
ok('captureOrders:false switches capture off', posts.length===1, 'posts=' + posts.length);
await page.evaluate(() => { BRAND.captureOrders = true; });

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

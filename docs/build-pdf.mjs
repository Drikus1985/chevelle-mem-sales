/* Regenerates Club_Chevelle_README.pdf from docs/readme-print.html.
   Run: node docs/build-pdf.mjs
   Keep docs/readme-print.html in step with Club_Chevelle_README.md when either changes. */
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('file://' + join(here, 'readme-print.html'), { waitUntil: 'networkidle' });
await page.pdf({
  path: join(here, '..', 'Club_Chevelle_README.pdf'),
  format: 'A4', printBackground: true, preferCSSPageSize: true
});
await browser.close();
console.log('wrote Club_Chevelle_README.pdf');

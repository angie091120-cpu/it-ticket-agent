// Browser check for the pages (spec A3): no horizontal scroll at 390px, and the
// approve button writes approved_by. Usage: node scripts/check-pages.mjs http://localhost:8787
import { chromium } from 'playwright';

const base = (process.argv[2] || 'http://localhost:8787').replace(/\/$/, '');
const failures = [];
const check = (ok, msg) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!ok) failures.push(msg);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

for (const path of ['/', '/tickets', '/stats']) {
  await page.goto(base + path);
  const { scroll, width } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: window.innerWidth,
  }));
  check(scroll <= width, `${path} at 390px: scrollWidth ${scroll} <= ${width}`);
}

// Create a fresh ticket so the button is guaranteed to be there.
const created = await (
  await fetch(`${base}/api/tickets`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'device', requester: '頁面檢查', item: '測試用滑鼠', reason: 'check-pages 自動建立' }),
  })
).json();

const approver = `檢查員-${Date.now()}`;
await page.goto(`${base}/tickets?status=new`);
await page.fill('#approver', approver);
await page.click(`#ticket-${created.id} button.approve`);
await page.waitForSelector(`#ticket-${created.id} .approval .ok`);
const after = await (await fetch(`${base}/api/tickets/${created.id}`)).json();
check(after.approved_by === approver, `approve button on #${created.id} wrote approved_by = ${after.approved_by}`);

await browser.close();
if (failures.length) {
  console.error(`${failures.length} check(s) failed`);
  process.exit(1);
}

import { chromium } from '@playwright/test';
const b = await chromium.launch();
const ctx = await b.newContext();
const page = await ctx.newPage();
await page.addInitScript(() => {
  const a = { userId: 'e2e:admin', role: 'Administrator' };
  const t = setInterval(() => { if (window.__lovableE2E) { window.__lovableE2E.injectActor(a); clearInterval(t); } }, 10);
});
await page.goto('http://127.0.0.1:4173/');
await page.waitForSelector('main');
await page.waitForTimeout(1500);
const info = await page.evaluate(() => {
  const el = document.querySelector('.tracking-\\[0\\.22em\\]');
  if (!el) return null;
  const cs = getComputedStyle(el);
  return { color: cs.color, cls: el.className, tag: el.tagName };
});
console.log(JSON.stringify(info, null, 2));
await b.close();

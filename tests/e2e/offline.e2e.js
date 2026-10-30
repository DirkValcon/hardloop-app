// Browsertest: na één bezoek werkt de app ook zonder internet.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { startServer } from '../server.js';

const { chromium } = createRequire(import.meta.url)('playwright');
const server = await startServer();
// Via localhost (niet 127.0.0.1) zodat de app de service worker registreert.
const url = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(url);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  assert.match(await page.textContent('h1'), /5 km-tijd/);
  console.log('✓ offline: de app laadt zonder internet');
} finally {
  await browser.close();
  server.close();
}

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
  // Ingelogd met een al verlopen sessie: offline kan die niet ververst worden, maar je blijft ingelogd.
  await context.addInitScript(() => localStorage.setItem('sb-hbuwnroujfuzjqanpubj-auth-token', JSON.stringify({
    access_token: 'oud', refresh_token: 'oud', token_type: 'bearer', expires_in: 3600, expires_at: 1000,
    user: { id: '00000000-0000-4000-8000-000000000001', email: 'dirk@example.com' },
  })));
  // Verzoeken naar Supabase falen hier altijd, alsof er geen internet is.
  await context.route('https://hbuwnroujfuzjqanpubj.supabase.co/**', (r) => r.abort('internetdisconnected'));
  const page = await context.newPage();
  await page.goto(url);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.evaluate(() => navigator.serviceWorker.ready);
  // Een nieuwe versie online komt meteen door, niet pas na een keer extra openen.
  await context.route(/\/(index\.html)?$/, async (r) => {
    const antwoord = await r.fetch();
    await r.fulfill({ response: antwoord, body: (await antwoord.text()).replace('<title>Loopschema</title>', '<title>Loopschema nieuw</title>') });
  });
  await page.reload();
  assert.equal(await page.title(), 'Loopschema nieuw');
  await context.unroute(/\/(index\.html)?$/);
  await context.setOffline(true);
  await page.reload();
  assert.match(await page.textContent('h1'), /Wat loop je nu/);
  console.log('✓ offline: de app laadt zonder internet en toont online direct de nieuwste versie');
} finally {
  await browser.close();
  server.close();
}

// Gedeelde opzet voor de browsertests: server, iPhone-context en vaste datum.
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { startServer } from '../server.js';

// Playwright is globaal geïnstalleerd; via require vinden we hem ook buiten node_modules.
const { chromium, devices } = createRequire(import.meta.url)('playwright');

export const SCREENSHOTS = process.env.SCREENSHOTS ?? 'tests/e2e/screenshots';

export async function opzet({ vandaag = '2026-10-30', profiel = null, klokLoopt = false, ingelogd = true } = {}) {
  await mkdir(SCREENSHOTS, { recursive: true });
  const server = await startServer();
  const url = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  const context = await browser.newContext({ ...devices['iPhone 13'], colorScheme: 'dark' });
  const page = await context.newPage();
  // Vaste datum; met klokLoopt kan de test de tijd zelf vooruitzetten (clock.runFor).
  if (klokLoopt) await page.clock.install({ time: new Date(`${vandaag}T12:00:00`) });
  else await page.clock.setFixedTime(new Date(`${vandaag}T12:00:00`));
  await nepSupabase(context, { ingelogd });
  if (profiel) {
    // Alleen bij de eerste keer laden, zodat wijzigingen een herlaadbeurt overleven.
    await page.addInitScript((p) => {
      if (!localStorage.getItem('hardloop-app.profiel.v1')) localStorage.setItem('hardloop-app.profiel.v1', JSON.stringify(p));
    }, profiel);
  }
  const fouten = [];
  page.on('pageerror', (e) => fouten.push(e.message));
  return {
    page, url, fouten,
    shot: (naam) => page.screenshot({ path: `${SCREENSHOTS}/${naam}.png`, fullPage: true }),
    async sluit() { await browser.close(); server.close(); },
  };
}

export const DIRK = {
  vijfKmSeconden: 2100, doelAfstand: 10, doelSeconden: 4200, doelDatum: '2027-01-15',
  extraWeken: 0, extraWekenKeuze: null, trainingsdagen: ['di', 'do', 'zo'], gewicht: 80, helling: 1,
  aangemaaktOp: '2026-10-30',
};

export const TESTGEBRUIKER = { id: '00000000-0000-4000-8000-000000000001', email: 'dirk@example.com' };

// Supabase zonder internet: testconfiguratie, geen echte netwerkverkeer en eventueel een bewaarde sessie.
export async function nepSupabase(context, { ingelogd = true } = {}) {
  await context.route('**/js/config.js', (r) => r.fulfill({
    contentType: 'text/javascript',
    body: "export const SUPABASE_URL = 'https://test.supabase.co'; export const SUPABASE_KEY = 'test-key';",
  }));
  const verzoeken = [];
  await context.route('https://test.supabase.co/**', (r) => { verzoeken.push(r.request()); return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); });
  if (ingelogd) {
    await context.addInitScript((gebruiker) => {
      if (localStorage.getItem('test-uitgelogd')) return;
      localStorage.setItem('sb-test-auth-token', JSON.stringify({
        access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600,
        expires_at: 4102444800, user: { ...gebruiker, aud: 'authenticated', role: 'authenticated' },
      }));
    }, TESTGEBRUIKER);
  }
  return verzoeken;
}

// Gedeelde opzet voor de browsertests: server, iPhone-context en vaste datum.
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { startServer } from '../server.js';

// Playwright is globaal geïnstalleerd; via require vinden we hem ook buiten node_modules.
const { chromium, devices } = createRequire(import.meta.url)('playwright');

export const SCREENSHOTS = process.env.SCREENSHOTS ?? 'tests/e2e/screenshots';

export async function opzet({ vandaag = '2026-10-30', profiel = null, klokLoopt = false } = {}) {
  await mkdir(SCREENSHOTS, { recursive: true });
  const server = await startServer();
  const url = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  const context = await browser.newContext({ ...devices['iPhone 13'], colorScheme: 'dark' });
  const page = await context.newPage();
  // Vaste datum; met klokLoopt kan de test de tijd zelf vooruitzetten (clock.runFor).
  if (klokLoopt) await page.clock.install({ time: new Date(`${vandaag}T12:00:00`) });
  else await page.clock.setFixedTime(new Date(`${vandaag}T12:00:00`));
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

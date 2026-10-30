// Browsertest story 1: onboarding op een iPhone-formaat scherm.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { startServer } from '../server.js';

// Playwright is globaal geïnstalleerd; via require vinden we hem ook buiten node_modules.
const { chromium, devices } = createRequire(import.meta.url)('playwright');

const SCREENSHOTS = process.env.SCREENSHOTS ?? 'tests/e2e/screenshots';
await mkdir(SCREENSHOTS, { recursive: true });

const server = await startServer();
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();
const context = await browser.newContext({ ...devices['iPhone 13'], colorScheme: 'dark' });
const page = await context.newPage();
await page.clock.setFixedTime(new Date('2026-10-30T12:00:00'));
const fouten = [];
page.on('pageerror', (e) => fouten.push(e.message));

const volgende = () => page.getByRole('button', { name: /Volgende|Klaar/ }).click();
const foutmelding = () => page.locator('.foutmelding').first().textContent();
const shot = (naam) => page.screenshot({ path: `${SCREENSHOTS}/${naam}.png` });

try {
  await page.goto(url);
  assert.match(await page.textContent('h1'), /5 km-tijd/);

  // Stap 1: ongeldig, dan geldig (alleen cijfers).
  await volgende();
  assert.match(await foutmelding(), /mm:ss/);
  await page.fill('#vijfKmTijd', '35:99');
  await volgende();
  assert.match(await foutmelding(), /mm:ss/);
  await shot('1-fout-5km');
  await page.fill('#vijfKmTijd', '3500');
  await volgende();

  // Stap 2: doeltijd.
  assert.match(await page.textContent('h1'), /doel/);
  await page.fill('#doelTijd', '70');
  await volgende();
  assert.match(await foutmelding(), /doeltijd/);
  await page.fill('#doelTijd', '70:00');
  await shot('2-doel');
  await volgende();

  // Stap 3: te vroege datum, dan een ver weg gelegen datum met keuze.
  await page.fill('#doelDatum', '2027-01-10');
  await page.locator('#doelDatum').dispatchEvent('change');
  await volgende();
  assert.match(await foutmelding(), /11 weken/);
  await page.fill('#doelDatum', '2027-03-05');
  await page.locator('#doelDatum').dispatchEvent('change');
  assert.match(await page.textContent('legend'), /7 weken meer/);
  await volgende();
  assert.match(await foutmelding(), /extra weken/);
  await page.getByText('Basisweken ervoor').click();
  await shot('3-doeldatum-keuze');
  await volgende();

  // Stap 4: dagen.
  await page.getByLabel('dinsdag').check({ force: true });
  await page.getByLabel('donderdag').check({ force: true });
  await volgende();
  assert.match(await foutmelding(), /3, 4 of 5/);
  await page.getByLabel('zondag').check({ force: true });
  assert.equal(await page.textContent('[data-test=aantal-dagen]'), '3 gekozen');
  await shot('4-dagen');
  await volgende();

  // Terug en weer vooruit: gegevens blijven staan.
  await page.getByRole('button', { name: 'Terug' }).click();
  assert.equal(await page.getByLabel('zondag').isChecked(), true);
  await volgende();

  // Stap 5: gewicht en helling.
  await volgende();
  assert.match(await foutmelding(), /gewicht/);
  assert.equal(await page.inputValue('#helling'), '1');
  await page.fill('#gewicht', '80');
  await shot('5-gewicht');
  await volgende();

  // Samenvatting, ook na herladen.
  const controleer = async () => {
    const tekst = await page.textContent('[data-test=samenvatting]');
    for (const verwacht of ['35:00', '10 km in 1:10:00', '5 maart 2027', '7 weken basisweken ervoor', 'di, do, zo', '80 kg', '1%']) {
      assert.ok(tekst.includes(verwacht), `samenvatting mist "${verwacht}": ${tekst}`);
    }
  };
  await controleer();
  await page.reload();
  await controleer();
  await shot('6-samenvatting');

  assert.deepEqual(fouten, [], 'JavaScript-fouten op de pagina');
  console.log('✓ story 1 onboarding: alle browserchecks geslaagd');
} finally {
  await browser.close();
  server.close();
}

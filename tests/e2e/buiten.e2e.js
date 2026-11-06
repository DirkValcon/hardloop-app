// Browsertest buiten lopen: binnen/buiten kiezen, tempo uit GPS, seintjes en afstandsblokken op GPS-afstand.
import assert from 'node:assert/strict';
import { opzet, DIRK } from './helpers.js';

// Donderdag 5 november: 6 × 400 m.
const { page, url, fouten, shot, sluit } = await opzet({ vandaag: '2026-11-05', profiel: { ...DIRK, doelDatum: '2027-01-17' }, klokLoopt: true });
const lees = async (veld) => (await page.textContent(`[data-test=${veld}]`)).trim();
const gezegd = () => page.evaluate(() => window.__gezegd);
const context = page.context();
const M_PER_GRAAD = 111_195;
let meters = 0;
const zet = () => context.setGeolocation({ latitude: 52 + meters / M_PER_GRAAD, longitude: 5, accuracy: 6 });
// Lopen op `kmh`: elke seconde een nieuwe positie.
async function loop(kmh, sec) {
  for (let i = 0; i < sec; i++) {
    meters += kmh / 3.6;
    await page.clock.runFor(1000);
    await zet();
  }
}

try {
  await page.addInitScript(() => {
    window.__gezegd = [];
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { speak: (u) => { if (u.text.trim()) window.__gezegd.push(u.text); }, cancel() {} },
    });
  });
  await context.grantPermissions(['geolocation']);
  await zet();
  await page.goto(url);
  await page.getByRole('button', { name: 'Start training' }).click();

  // Standaard binnen, zoals altijd.
  assert.equal(await page.getByRole('radio', { name: /Binnen/ }).getAttribute('aria-checked'), 'true');
  assert.match(await page.textContent('main'), /Zet de loopband op/);
  await page.getByRole('radio', { name: /Buiten/ }).click();
  assert.equal(await page.getByRole('radio', { name: /Buiten/ }).getAttribute('aria-checked'), 'true');
  assert.match(await page.textContent('main'), /Begin langzaam op \d:\d\d \/km/);
  await page.waitForFunction(() => document.querySelector('[data-test=gps-status]')?.textContent.includes('GPS ✓'));
  assert.match(await lees('gps-uitleg'), /scherm aan/);
  await shot('buiten-start');

  // De keuze wordt onthouden.
  await page.reload();
  await page.waitForSelector('[data-test=waar]');
  assert.equal(await page.getByRole('radio', { name: /Buiten/ }).getAttribute('aria-checked'), 'true');

  await page.getByRole('button', { name: 'Start', exact: true }).click();
  assert.match((await gezegd()).at(-1), /^Start\. Warming-up 1 van 3: 4 minuten, langzaam, tempo \d+ minuten( \d+)? per kilometer$/);
  assert.equal(await page.locator('[data-test=snelheid]').count(), 0, 'geen loopbandsnelheid buiten');
  assert.equal(await page.locator('[data-actie=sneller]').count(), 0, 'geen + en − buiten');

  // Warming-up veel te snel: 12 km/u. Tempo nu ± 5:00, te snel, en na een halve minuut een seintje.
  await loop(12, 60);
  assert.match(await lees('tempo-nu'), /^(4:5\d|5:0\d)$/);
  assert.equal(await page.getAttribute('[data-test=tempo-vak]', 'data-oordeel'), 'te-snel');
  assert.equal(await lees('oordeel'), 'te snel');
  assert.match(await lees('afstand'), /^0,(19|20) km$/);
  assert.match(await lees('totaal'), /^1:0\d gelopen$/);
  assert.match(await lees('timer'), /^3:0\d$/);
  const seintje = (await gezegd()).find((z) => z.startsWith('Iets rustiger'));
  assert.ok(seintje, JSON.stringify(await gezegd()));
  assert.match(seintje, /je doel is \d+ minuten/);
  await shot('buiten-lopend');

  // Naar de eerste interval: 400 m, op GPS-afstand.
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Volgend blok' }).click();
  assert.match(await lees('bloktitel'), /400|5 km|Interval|tempo/i);
  const doel = await lees('doeltempo');
  assert.match(await lees('timer'), /^400 m$/);
  await loop(12, 60);
  assert.match(await lees('timer'), /^(19\d|20\d) m$/);
  const titel = await lees('bloktitel');
  // 400 m op 12 km/u is na 120 s klaar (op de loopbandsnelheid zou het langer duren).
  await loop(12, 62);
  assert.notEqual(await lees('bloktitel'), titel, 'blok klaar na 400 m');
  assert.ok(doel);

  // Pauze: de weg tijdens de pauze telt niet.
  const voor = await lees('afstand');
  await page.getByRole('button', { name: 'Pauze' }).click();
  await loop(5, 30);
  await page.getByRole('button', { name: 'Hervat' }).click();
  await page.clock.runFor(500);
  assert.equal(await lees('afstand'), voor);

  // Herladen midden in de training: buiten en de afstand blijven.
  await page.reload();
  await page.waitForSelector('[data-test=tempo-nu]');
  assert.equal(await lees('afstand'), voor);

  // Afronden met de GPS-afstand, opgeslagen als buiten.
  await page.getByRole('button', { name: 'Pauze' }).click();
  await page.evaluate(() => { window.confirm = () => true; });
  await page.locator('[data-actie=stop]').focus();
  await page.keyboard.press('Enter');
  assert.equal(await lees('sam-afstand'), voor.replace(/(\d+),(\d)\d km/, '$1,$2'));
  assert.match(await page.textContent('form.afronden'), /Gemeten met de GPS/);
  await page.getByRole('button', { name: 'Opslaan als gedaan' }).click();
  const r = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('hardloop-app.resultaten.v1'))));
  assert.equal(r[0].waar, 'buiten');
  await page.goto(`${url}#voortgang`);
  assert.match(await page.textContent('[data-test=gelopen]'), /buiten/);

  assert.deepEqual(fouten, []);
  console.log('buiten: ok');
} finally {
  await sluit();
}

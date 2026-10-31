// Browsertest verbeteringen 2 en 3: gesproken kilometertijden en aankondigingen, snelheid aanpassen.
import assert from 'node:assert/strict';
import { opzet, DIRK, houdStopIngedrukt } from './helpers.js';

// Dinsdag 3 november: rustige duurloop 4 km.
const { page, url, fouten, shot, sluit } = await opzet({ vandaag: '2026-11-03', profiel: { ...DIRK, doelDatum: '2027-01-17' }, klokLoopt: true });
const lees = async (veld) => (await page.textContent(`[data-test=${veld}]`)).trim();
const gezegd = () => page.evaluate(() => window.__gezegd);
try {
  // Spraak opvangen in plaats van afspelen.
  await page.addInitScript(() => {
    window.__gezegd = [];
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { speak: (u) => { if (u.text.trim()) window.__gezegd.push(u.text); }, cancel() {} },
    });
  });
  await page.goto(url);
  await page.getByRole('button', { name: 'Start op loopband' }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  assert.match((await gezegd())[0], /^Start\. Warming-up 1 van 3: 4 minuten op 6 komma 1 kilometer per uur, helling 1 procent$/);

  // 10 seconden voor blok 2.
  await page.clock.runFor(230_500);
  assert.equal((await gezegd()).at(-1), 'Over 10 seconden: Warming-up 2 van 3: 3 minuten op 6 komma 5 kilometer per uur, helling 1 procent');

  // Eerste kilometer valt in de warming-up (6,1 en 6,5 km/u): ongeveer na 9:30.
  await page.clock.runFor(370_000);
  const kmZin = (await gezegd()).find((z) => z.startsWith('Kilometer 1.'));
  assert.ok(kmZin, JSON.stringify(await gezegd()));
  assert.match(kmZin, /^Kilometer 1\. 9 minuten \d+ seconden\.$/);
  assert.match(await lees('laatste-km'), /^km 1: 9:\d\d$/);

  // In de rustige duurloop: snelheid naar 8,5 km/u (schema 7,1).
  assert.equal(await lees('bloktitel'), 'Rustig');
  assert.equal(await lees('snelheid'), '7,1');
  for (let i = 0; i < 14; i++) await page.getByRole('button', { name: 'Sneller' }).click();
  assert.equal(await lees('snelheid'), '8,5');
  assert.match(await lees('tempo'), /7:04 \/km · 4 km · schema 7,1/);
  await page.getByRole('button', { name: 'Langzamer' }).click();
  await page.getByRole('button', { name: 'Sneller' }).click();
  assert.equal(await lees('snelheid'), '8,5');
  const afstandVoor = parseFloat((await lees('afstand')).replace(',', '.'));
  await page.clock.runFor(60_000);
  const afstandNa = parseFloat((await lees('afstand')).replace(',', '.'));
  assert.ok(Math.abs(afstandNa - afstandVoor - 8.5 / 60) < 0.011, `${afstandVoor} → ${afstandNa}`);
  await shot('verbetering-snelheid');

  // Pauze: afstand en tijd staan stil.
  await page.getByRole('button', { name: 'Pauze' }).click();
  const stil = await lees('afstand');
  await page.clock.runFor(30_000);
  assert.equal(await lees('afstand'), stil);
  await page.getByRole('button', { name: 'Hervat' }).click();

  // Na herladen blijft de aangepaste snelheid staan, zonder dubbele aankondigingen.
  const aantal = (await gezegd()).length;
  await page.reload();
  await page.waitForSelector('[data-test=snelheid]');
  assert.equal(await lees('snelheid'), '8,5');
  assert.equal((await gezegd()).length, 0); // nieuwe pagina, niets opnieuw gezegd
  assert.ok(aantal > 2);

  // Stoppen: afstand en duur uit de app komen in het formulier.
  await houdStopIngedrukt(page);
  await page.waitForSelector('[data-test=afronden]');
  const opgeslagen = parseFloat((await page.inputValue('#afstandKm')).replace(',', '.'));
  assert.ok(Math.abs(opgeslagen - afstandNa) < 0.15, `${opgeslagen} vs ${afstandNa}`);
  assert.deepEqual(fouten, []);
  console.log('✓ verbeteringen 2 en 3: spraak per km, aankondiging, snelheid aanpassen');
} finally { await sluit(); }

// Browsertest story 9: instellingen wijzigen midden in het schema.
import assert from 'node:assert/strict';
import { opzet, DIRK } from './helpers.js';

const resultaten = { 'w1-rustig': { status: 'gedaan', afstandKm: 5.6, duurSec: 2940, kcal: 450, datum: '2026-11-03', gepland: '2026-11-03', type: 'rustig' } };
// Woensdag 11 november, week 2.
const { page, url, fouten, shot, sluit } = await opzet({ vandaag: '2026-11-11', profiel: { ...DIRK, doelDatum: '2027-01-17' } });
const tekst = async (sel) => (await page.textContent(sel)).replace(/\s+/g, ' ').trim();
try {
  await page.addInitScript((r) => {
    if (!localStorage.getItem('hardloop-app.resultaten.v1')) localStorage.setItem('hardloop-app.resultaten.v1', JSON.stringify(r));
  }, resultaten);
  await page.goto(url + '#profiel');
  // Story 22: elk deel van Profiel wijzig je apart.
  await page.getByRole('button', { name: 'Schema wijzigen' }).click();
  await page.waitForSelector('[data-test=instellingen]');
  assert.equal(await page.inputValue('#vijfKmTijd'), '35:00');
  assert.equal(await page.locator('#gewicht').isVisible(), false, 'alleen de velden van dit deel');
  await page.fill('#vijfKmTijd', '33:00');
  await page.getByRole('button', { name: 'Opslaan' }).click();
  await page.waitForSelector('[data-test=samenvatting]');
  await page.getByRole('button', { name: 'Instellingen wijzigen' }).click();
  await page.waitForSelector('[data-test=instellingen]');
  assert.equal(await page.locator('#vijfKmTijd').isVisible(), false);

  // Ongeldig: twee dagen.
  await page.getByLabel('dinsdag').uncheck({ force: true });
  await page.getByRole('button', { name: 'Opslaan' }).click();
  assert.match(await tekst('.foutmelding'), /3, 4 of 5/);

  // Nieuwe dagen (ma, wo, vr, zo), snellere 5 km en 2% helling.
  await page.getByLabel('maandag').check({ force: true });
  await page.getByLabel('donderdag').uncheck({ force: true });
  await page.getByLabel('woensdag').check({ force: true });
  await page.getByLabel('vrijdag').check({ force: true });
  await page.fill('#helling', '2');
  await shot('story9-wijzigen');
  await page.getByRole('button', { name: 'Opslaan' }).click();
  await page.waitForSelector('[data-test=samenvatting]');
  const samenvatting = await tekst('[data-test=samenvatting]');
  assert.match(samenvatting, /33:00/);
  assert.match(samenvatting, /di, do, zo/);   // deze week nog de oude dagen
  assert.match(samenvatting, /2%/);
  assert.match(await tekst('[data-test=komend]'), /Vanaf maandag 16 nov: trainingsdagen ma, wo, vr, zo/);
  await shot('story9-profiel');

  // Schema: week 1 en 2 ongewijzigd qua dagen, week 1 nog afgevinkt; week 3 op de nieuwe dagen.
  await page.getByRole('link', { name: 'Schema' }).click();
  await page.waitForSelector('#week-1');
  const dagen = async (n) => (await page.locator(`#week-${n} .training .dag`).allTextContents()).map((d) => d.slice(0, 2));
  assert.deepEqual(await dagen(1), ['Di', 'Do', 'Zo']);
  assert.deepEqual(await dagen(2), ['Di', 'Do', 'Zo']);
  assert.deepEqual(await dagen(3), ['Ma', 'Wo', 'Vr', 'Zo']);
  assert.match(await tekst('[data-training=w1-rustig] summary'), /✓ gedaan/);
  // Week 1 houdt de oude snelheid en helling, week 2 krijgt de nieuwe.
  await page.locator('#week-1 .week-inhoud > summary').click(); // vorige week is ingeklapt (story 21)
  await page.locator('[data-training=w1-rustig] summary').click();
  assert.match(await tekst('[data-training=w1-rustig] .blok-rustig'), /7,1 km\/u ?1% helling/);
  await page.locator('[data-training=w2-rustig] summary').click();
  assert.match(await tekst('[data-training=w2-rustig] .blok-rustig'), /7,6 km\/u ?2% helling/);

  // Na herladen alles nog zo.
  await page.reload();
  await page.waitForSelector('#week-3');
  assert.deepEqual(await dagen(3), ['Ma', 'Wo', 'Vr', 'Zo']);

  assert.deepEqual(fouten, []);
  console.log('✓ story 9 instellingen: alle browserchecks geslaagd');
} finally { await sluit(); }

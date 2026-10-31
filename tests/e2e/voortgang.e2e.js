// Browsertest story 8: voortgang met totalen die kloppen met de afgevinkte trainingen.
import assert from 'node:assert/strict';
import { opzet, DIRK } from './helpers.js';

const resultaten = {
  'w1-rustig': { status: 'gedaan', afstandKm: 5.6, duurSec: 2940, kcal: 450, datum: '2026-11-03' },
  'w1-kwaliteit': { status: 'overgeslagen', datum: '2026-11-05' },
  'w1-lang': { status: 'gedaan', afstandKm: 6.8, duurSec: 3500, kcal: 560, datum: '2026-11-08' },
  'w2-rustig': { status: 'gedaan', afstandKm: 6.1, duurSec: 3200, kcal: 500, datum: '2026-11-10' },
};
const { page, url, fouten, shot, sluit } = await opzet({ vandaag: '2026-11-11', profiel: { ...DIRK, doelDatum: '2027-01-17' } });
try {
  await page.addInitScript((r) => localStorage.setItem('hardloop-app.resultaten.v1', JSON.stringify(r)), resultaten);
  await page.goto(url + '#voortgang');
  const lees = async (v) => (await page.textContent(`[data-test=${v}]`)).replace(/\s+/g, ' ').trim();
  assert.equal(await lees('totaal-km'), '18,5');
  assert.equal(await lees('totaal-kcal'), '1510');
  assert.equal(await lees('trainingen'), '3/33');
  assert.equal(await lees('weken'), '10');
  assert.match(await lees('langste'), /^6,8 km/);
  assert.match(await lees('voorspeld'), /1:12:58 · doel 1:10:00/);
  assert.equal(await page.locator('.staaf').count(), 11);
  await page.locator('.staaf').first().click();
  assert.match(await lees('grafiek-detail'), /Week 1 · 12,4 van [\d,]+ km · 1010 kcal · 2\/3 trainingen/);
  // Statistieken.
  assert.equal(await lees('km-week'), '6,1');
  assert.equal(await lees('km-maand'), '18,5');
  // Story 23: deze week bovenaan, geen dubbele cijfers, korte titel.
  assert.equal(await page.textContent('h1'), 'Voortgang');
  assert.match(await lees('deze-week'), /Deze week · Week 2 6,1 van [\d,]+ km .*1 van 3 trainingen gedaan/);
  assert.equal(await page.locator('[data-test=km-totaal]').count(), 0);
  const eerste = await page.evaluate(() => document.querySelector('h1 ~ * [data-test]').dataset.test);
  assert.equal(eerste, 'deze-week');
  assert.match(await lees('tempo'), /^8:41$/);
  const maand = await page.locator('[data-test=per-maand] tbody tr').first().locator('th, td').allTextContents();
  assert.deepEqual(maand, ['november 2026', '18,5', '3', '1510']);
  const gelopen = await page.locator('[data-test=gelopen] li').allTextContents();
  assert.equal(gelopen.length, 3);
  assert.match(gelopen[0].replace(/\s+/g, ' '), /Rustige duurloop 4,5 km ?10 nov · 53 min · 500 kcal ?6,1 km ?8:45 \/km/);
  await shot('story8-voortgang');
  assert.deepEqual(fouten, []);
  console.log('✓ story 8 voortgang: alle browserchecks geslaagd');
} finally { await sluit(); }

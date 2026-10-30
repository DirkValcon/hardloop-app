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
  await shot('story8-voortgang');
  assert.deepEqual(fouten, []);
  console.log('✓ story 8 voortgang: alle browserchecks geslaagd');
} finally { await sluit(); }

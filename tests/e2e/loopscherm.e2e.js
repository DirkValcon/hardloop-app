// Browsertest story 6: trainingsscherm op de loopband.
import assert from 'node:assert/strict';
import { opzet, DIRK } from './helpers.js';

// Donderdag 5 november: 6 × 400 m.
const { page, url, fouten, shot, sluit } = await opzet({ vandaag: '2026-11-05', profiel: { ...DIRK, doelDatum: '2027-01-17' }, klokLoopt: true });
const lees = async (veld) => (await page.textContent(`[data-test=${veld}]`)).trim();
const tijd = async (ms) => page.clock.runFor(ms);

try {
  await page.goto(url);
  await page.getByRole('button', { name: 'Start op loopband' }).click();
  await page.waitForSelector('[data-test=loopscherm]');
  assert.equal(await page.locator('nav.tabs').count(), 0, 'tabs verborgen tijdens het lopen');
  assert.match(await page.textContent('main'), /6,1 km\/u.*1%/s);
  await page.getByRole('button', { name: 'Start' }).click();

  // Blok 1: warming-up 4 min op 6,1 km/u, 1% helling.
  assert.equal(await lees('bloktitel'), 'Warming-up 1 van 3');
  assert.equal(await lees('snelheid'), '6,1');
  assert.equal(await lees('helling'), '1');
  assert.equal(await lees('timer'), '4:00');
  assert.match(await lees('tempo'), /9:50 \/km/);
  assert.match(await lees('volgende'), /^Hierna: Warming-up 2 van 3, 6,5 km\/u$/);

  // Aftellen.
  await tijd(60_000);
  assert.equal(await lees('timer'), '3:00');

  // 10 s voor het eind: aankondiging.
  await tijd(170_000);
  assert.match(await lees('volgende'), /^Over 10 s: Warming-up 2 van 3, 6,5 km\/u$/);
  assert.equal(await page.locator('.loop-volgende.is-aankondiging').count(), 1);

  // Volgend blok.
  await tijd(11_000);
  assert.equal(await lees('bloktitel'), 'Warming-up 2 van 3');
  assert.equal(await lees('snelheid'), '6,5');

  // Pauze houdt de timer vast.
  await page.getByRole('button', { name: 'Pauze' }).click();
  const gepauzeerd = await lees('timer');
  await tijd(30_000);
  assert.equal(await lees('timer'), gepauzeerd);
  await page.getByRole('button', { name: 'Hervat' }).click();
  await tijd(2_000);
  assert.notEqual(await lees('timer'), gepauzeerd);

  // Overslaan naar het eerste interval.
  await page.getByRole('button', { name: 'Volgend blok' }).click();
  await page.getByRole('button', { name: 'Volgend blok' }).click();
  assert.equal(await lees('bloktitel'), '5 km-tempo 1 van 6');
  assert.equal(await lees('snelheid'), '8,9');
  assert.match(await lees('tempo'), /400 m/);
  assert.match(await lees('volgende'), /Hierna: Herstel 1, 6,9 km\/u|Hierna: Herstel, 6,9 km\/u/);
  await shot('story6-interval');

  // Herladen tijdens de training: hij loopt door bij hetzelfde blok.
  await page.reload();
  await page.waitForSelector('[data-test=bloktitel]');
  assert.equal(await lees('bloktitel'), '5 km-tempo 1 van 6');

  // Door naar het einde: uitwandelen op 0%, daarna Klaar.
  for (let i = 0; i < 12; i++) await page.getByRole('button', { name: 'Volgend blok' }).click();
  assert.equal(await lees('bloktitel'), 'Uitwandelen');
  assert.equal(await lees('helling'), '0');
  assert.equal(await lees('volgende'), 'Laatste blok');
  await shot('story6-uitwandelen');
  await tijd(121_000);
  assert.match(await lees('klaar'), /6 × 400 m op 5 km-tempo zit erop/);
  await page.waitForSelector('[data-test=afronden]');
  await page.getByRole('button', { name: 'Opslaan als gedaan' }).click();
  await page.waitForSelector('[data-test=vandaag-gedaan]');

  assert.deepEqual(fouten, []);
  console.log('✓ story 6 loopscherm: alle browserchecks geslaagd');
} finally { await sluit(); }

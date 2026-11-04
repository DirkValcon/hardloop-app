// Browsertest verbetering 3b: eigen snelheden per zone instellen onder Profiel.
import assert from 'node:assert/strict';
import { opzet, DIRK } from './helpers.js';

const { page, url, fouten, shot, sluit } = await opzet({ vandaag: '2026-11-03', profiel: { ...DIRK, doelDatum: '2027-01-17' } });
const tekst = async (sel) => (await page.textContent(sel)).replace(/\s+/g, ' ').trim();
try {
  await page.goto(url + '#profiel');
  await page.getByRole('button', { name: 'Snelheden aanpassen' }).click();
  assert.equal(await page.getAttribute('#eigen-normaal', 'placeholder'), '6,9');
  await page.fill('#eigen-normaal', '85');
  await page.getByRole('button', { name: 'Opslaan' }).click();
  assert.match(await tekst('.eigen-rij .foutmelding'), /tussen 3 en 25/);
  await page.fill('#eigen-normaal', '8,5');
  await page.fill('#eigen-langzaam', '7');
  await page.fill('#eigen-hard', '10');
  await shot('verbetering-eigen-snelheden');
  await page.getByRole('button', { name: 'Opslaan' }).click();
  await page.waitForSelector('[data-test=samenvatting]');
  assert.match(await tekst('[data-zone=normaal]'), /Normaal eigen.*herstel.*8,5 km\/u 7:04 \/km/);
  assert.match(await tekst('[data-zone=hard]'), /Hard eigen.*10,0 km\/u 6:00 \/km/);
  assert.match(await tekst('[data-zone=langzaam]'), /Langzaam eigen.*7,0 km\/u/);
  assert.doesNotMatch(await tekst('[data-zone=wandelen]'), /eigen/);

  // Vandaag (dinsdag, week 1) gebruikt de eigen rustige snelheid.
  await page.getByRole('link', { name: 'Vandaag' }).click();
  await page.waitForSelector('[data-test=vandaag]');
  assert.match(await tekst('[data-test=vandaag]'), /Rustige duurloop 4 km ?28 min ?8,5 km\/u/);

  // Wijzigen opnieuw openen: de eigen waarden staan erin.
  await page.getByRole('link', { name: 'Profiel' }).click();
  await page.getByRole('button', { name: 'Snelheden aanpassen' }).click();
  assert.equal(await page.inputValue('#eigen-normaal'), '8,5');
  assert.equal(await page.inputValue('#eigen-hard'), '10,0');
  assert.deepEqual(fouten, []);
  console.log('✓ verbetering 3b: eigen snelheden per zone');
} finally { await sluit(); }

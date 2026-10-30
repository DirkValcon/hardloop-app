// Browsertest verbetering 1: elke training op elk moment starten; hij telt voor de dag van lopen.
import assert from 'node:assert/strict';
import { opzet, DIRK } from './helpers.js';

// Woensdag 4 november (rustdag); we lopen de lange duurloop van zondag 8 november alvast.
const { page, url, fouten, shot, sluit } = await opzet({ vandaag: '2026-11-04', profiel: { ...DIRK, doelDatum: '2027-01-17' }, klokLoopt: true });
const tekst = async (sel) => (await page.textContent(sel)).replace(/\s+/g, ' ').trim();
try {
  await page.goto(url + '#schema');
  await page.locator('[data-training=w1-lang] summary').click();
  await page.locator('[data-training=w1-lang] [data-test=start]').click();
  await page.waitForSelector('[data-test=loopscherm]');
  assert.match(await tekst('main'), /Lange duurloop 5 km/);
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  for (let i = 0; i < 6; i++) await page.getByRole('button', { name: 'Volgend blok' }).click();
  await page.waitForSelector('[data-test=afronden]');
  // Alles overgeslagen, dus de app telt 0 km; de afstand van de loopband vul je zelf in.
  await page.fill('#afstandKm', '6,6');
  await page.fill('#duurMin', '57');
  await page.getByRole('button', { name: 'Opslaan als gedaan' }).click();

  // Vandaag: gedaan op woensdag, en de volgende training is de kwaliteitstraining van donderdag.
  await page.waitForSelector('[data-test=vandaag-gedaan]');
  assert.match(await tekst('[data-test=vandaag-gedaan]'), /Vandaag gedaan Lange duurloop 5 km/);
  assert.match(await tekst('[data-test=vandaag]'), /Morgen.*6 × 400 m/);

  // Schema: gedaan op 4 nov.
  await page.getByRole('link', { name: 'Schema' }).click();
  await page.waitForSelector('#week-1');
  await page.locator('[data-training=w1-lang] summary').click();
  assert.match(await tekst('[data-training=w1-lang] .status'), /✓ Gedaan op 4 nov/);
  await shot('verbetering1-schema');
  assert.deepEqual(fouten, []);
  console.log('✓ verbetering 1: training op elk moment starten');
} finally { await sluit(); }

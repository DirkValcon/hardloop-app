// Browsertest story 14: vanuit Profiel een nieuw schema maken voor een andere doelafstand.
import assert from 'node:assert/strict';
import { opzet, DIRK } from './helpers.js';

const { page, url, fouten, shot, sluit } = await opzet({ vandaag: '2026-11-02', profiel: { ...DIRK, doelDatum: '2027-01-17' } });
const volgende = () => page.getByRole('button', { name: /Volgende|Schema vervangen/ }).click();

try {
  // Eerst een training van het oude schema afvinken.
  await page.goto(url);
  await page.waitForSelector('[data-test=vandaag]');
  await page.evaluate(() => { location.hash = '#afvinken/w1-rustig'; });
  await page.getByRole('button', { name: /Opslaan|Afvinken|Gedaan/ }).first().click();
  await page.evaluate(() => { location.hash = '#profiel'; });
  await page.getByRole('button', { name: 'Nieuw schema maken' }).click();
  assert.match(await page.textContent('[data-test=vervang-waarschuwing]'), /vervangt je huidige schema/);

  // Annuleren brengt je terug naar Profiel, zonder iets te veranderen.
  await page.getByRole('button', { name: 'Annuleren' }).click();
  await page.waitForSelector('[data-test=samenvatting]');
  assert.match(await page.textContent('[data-test=samenvatting]'), /5 km-tijd/);

  await page.getByRole('button', { name: 'Nieuw schema maken' }).click();
  await page.fill('#maxKm', '10');
  await page.fill('#kmh', '8,5');
  assert.equal(await page.inputValue('#tempo'), '7:04');
  await shot('story14-niveau');
  await volgende();
  await page.getByText('Halve marathon').click();
  assert.match(await page.textContent('[data-test=haalbaarheid]'), /uitlopen/);
  await shot('story14-doel');
  await volgende();
  assert.match(await page.textContent('[data-test=advies]'), /Advies: 12 weken/);
  await page.fill('#doelDatum', '2027-01-24'); // week 1 = deze week
  await page.locator('#doelDatum').dispatchEvent('change');
  await shot('story14-weken');
  await volgende();
  // Dagen, gewicht en helling zijn overgenomen.
  assert.equal(await page.getByLabel('zondag').isChecked(), true);
  await volgende();
  assert.equal(await page.inputValue('#gewicht'), '80');
  page.once('dialog', (d) => { assert.match(d.message(), /vervangen/); d.accept(); });
  await volgende();

  await page.waitForSelector('[data-test=tot-doel]');
  assert.match(await page.textContent('[data-test=tot-doel]'), /tot je Halve marathon op .*24 januari 2027/i);

  await page.getByRole('link', { name: 'Schema' }).click();
  await page.waitForSelector('.week');
  assert.equal(await page.locator('.week').count(), 12);
  assert.equal(await page.locator('.label-gedaan, .is-gedaan').count(), 0, 'oude afgevinkte training niet op het nieuwe schema');
  await shot('story14-schema');

  // De gelopen training van het oude schema staat nog in de statistieken.
  await page.getByRole('link', { name: 'Voortgang' }).click();
  await page.waitForSelector('[data-test=gelopen]');
  assert.match(await page.textContent('[data-test=gelopen]'), /Rustige duurloop 4 km/);
  assert.match(await page.textContent('[data-test=voorspeld]'), /:/);
  assert.match(await page.textContent('main, #app'), /Voorspelde Halve marathon/);
  await shot('story14-voortgang');

  await page.getByRole('link', { name: 'Profiel' }).click();
  assert.match(await page.textContent('[data-test=samenvatting]'), /Halve marathon in 12 weken.*10 km in 7:04 \/km.*Uitlopen/s);
  await shot('story14-profiel');

  assert.deepEqual(fouten, [], 'JavaScript-fouten op de pagina');
  console.log('✓ story 14 nieuw schema: alle browserchecks geslaagd');
} finally {
  await sluit();
}

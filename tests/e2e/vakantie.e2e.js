// Browsertest vakantiemodus: periode kiezen, dagen aantikken waarop je toch traint, schema schuift door.
import assert from 'node:assert/strict';
import { opzet, DIRK } from './helpers.js';

const { page, url, fouten, shot, sluit } = await opzet({ vandaag: '2026-11-13', profiel: { ...DIRK, doelDatum: '2027-01-17' } });
try {
  await page.goto(url + '#schema');
  await page.locator('[data-test=vakantie] > summary').click();
  await page.fill('input[name=vakantie-van]', '2026-11-16');
  await page.locator('input[name=vakantie-van]').dispatchEvent('change');
  // Einddatum staat vanzelf een week later; zeven dagknoppen.
  assert.equal(await page.inputValue('input[name=vakantie-tot]'), '2026-11-22');
  assert.equal(await page.locator('[data-vakantie-dag]').count(), 7);
  await page.click('[data-vakantie-dag="2026-11-17"]');
  await page.click('[data-vakantie-dag="2026-11-19"]');
  assert.equal(await page.getAttribute('[data-vakantie-dag="2026-11-17"]', 'aria-pressed'), 'true');
  await shot('vakantie-kiezen');
  await page.click('[data-actie=vakantie-opslaan]');
  assert.match(await page.textContent('[data-test=melding]'), /doelloop schuift 3 dagen op naar 20 januari 2027/);
  assert.match(await page.textContent('[data-test=vakantie-rij]'), /16 nov – 22 nov.*di 17 nov, do 19 nov.*doelloop 3 dagen later/s);

  // Week 3 heeft nog 2 trainingen, de lange loop staat nu op di 24 nov; er is een week 12 met de doelloop.
  assert.match(await page.textContent('#week-3 [data-test=week-samenvatting]'), /^2 trainingen/);
  assert.match(await page.locator('#week-4 .training summary').first().textContent(), /Di\s*24 nov.*Lange duurloop/s);
  assert.equal(await page.locator('section.week').count(), 12);
  await page.locator('#week-4 .week-inhoud > summary').click();
  await shot('vakantie-schema');

  // Profiel toont de nieuwe doeldatum.
  await page.goto(url + '#profiel');
  assert.match(await page.textContent('[data-test=doel-vakantie]'), /3 dagen later door vakantie/);

  // Weghalen zet alles terug.
  await page.goto(url + '#schema');
  await page.locator('[data-test=vakantie] > summary').click();
  await page.click('[data-vakantie-weg="2026-11-16"]');
  assert.equal(await page.locator('section.week').count(), 11);
  assert.match(await page.textContent('#week-3 [data-test=week-samenvatting]'), /^3 trainingen/);
  assert.deepEqual(fouten, []);
  console.log('vakantie: ok');
} finally {
  await sluit();
}

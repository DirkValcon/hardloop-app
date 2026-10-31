// Browsertest story 1: onboarding op een iPhone-formaat scherm.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { opzet } from './helpers.js';

const { page, url, fouten, shot, sluit } = await opzet();
const volgende = () => page.getByRole('button', { name: /Volgende|Klaar/ }).click();
const foutmelding = () => page.locator('.foutmelding').first().textContent();

try {
  await page.goto(url);
  assert.match(await page.textContent('h1'), /Wat loop je nu/);

  // Stap 1: huidig niveau. Leeg geeft fouten; tempo en km/u rekenen elkaar uit.
  await volgende();
  assert.match(await foutmelding(), /maximaal/);
  await page.fill('#maxKm', '5');
  await page.fill('#tempo', '7:00');
  assert.equal(await page.inputValue('#kmh'), '8,6');
  await page.fill('#tempo', '');
  await page.fill('#kmh', '8');
  assert.equal(await page.inputValue('#tempo'), '7:30');
  await page.fill('#tempo', '700'); // alleen cijfers mag ook
  await shot('1-niveau');
  await volgende();

  // Stap 2: doelafstand en doeltijd.
  assert.match(await page.textContent('h1'), /doel/);
  await volgende();
  assert.match(await foutmelding(), /Kies een doel/);
  await page.getByText('Halve marathon').click();
  assert.match(await page.textContent('[data-test=haalbaarheid]'), /Halve marathon uitlopen/);
  await page.getByText('10 km', { exact: true }).click();
  await page.fill('#doelTijd', '70');
  await volgende();
  assert.match(await foutmelding(), /doeltijd/);
  await page.fill('#doelTijd', '70:00');
  assert.match(await page.textContent('[data-test=haalbaarheid]'), /Haalbaar|Ambitieus/);
  await shot('2-doel');
  await volgende();

  // Stap 3: weken met advies; minder weken geeft een blessurewaarschuwing.
  assert.match(await page.textContent('[data-test=advies]'), /Advies: 15 weken/);
  assert.equal(await page.inputValue('#weken'), '15');
  assert.equal(await page.locator('[data-test=blessurewaarschuwing]').count(), 0);
  await page.fill('#weken', '11');
  await page.locator('#weken').dispatchEvent('change');
  assert.match(await page.textContent('[data-test=blessurewaarschuwing]'), /blessures/);
  await shot('3-weken-waarschuwing');
  await page.fill('#doelDatum', '2027-01-10');
  await page.locator('#doelDatum').dispatchEvent('change');
  await volgende();
  assert.match(await foutmelding(), /11 weken/);
  await page.fill('#doelDatum', '2027-03-05');
  await page.locator('#doelDatum').dispatchEvent('change');
  assert.match(await page.textContent('legend'), /7 weken meer/);
  await volgende();
  assert.match(await foutmelding(), /extra weken/);
  await page.getByText('Basisweken ervoor').click();
  await shot('3-doeldatum-keuze');
  await volgende();

  // Stap 4: dagen.
  await page.getByLabel('dinsdag').check({ force: true });
  await page.getByLabel('donderdag').check({ force: true });
  await volgende();
  assert.match(await foutmelding(), /3, 4 of 5/);
  await page.getByLabel('zondag').check({ force: true });
  assert.equal(await page.textContent('[data-test=aantal-dagen]'), '3 gekozen');
  await shot('4-dagen');
  await volgende();

  // Terug en weer vooruit: gegevens blijven staan.
  await page.getByRole('button', { name: 'Terug' }).click();
  assert.equal(await page.getByLabel('zondag').isChecked(), true);
  await volgende();

  // Stap 5: gewicht en helling.
  await volgende();
  assert.match(await foutmelding(), /gewicht/);
  assert.equal(await page.inputValue('#helling'), '1');
  await page.fill('#gewicht', '80');
  await shot('5-gewicht');
  await volgende();

  // Na de onboarding verschijnt Vandaag; het profiel staat onder de tab Profiel, ook na herladen.
  await page.waitForSelector('h1:text-is("Vandaag")');
  await page.getByRole('link', { name: 'Profiel' }).click();
  const controleer = async () => {
    const tekst = await page.textContent('[data-test=samenvatting]');
    for (const verwacht of ['10 km in 11 weken', '5 km in 7:00 /km', '10 km in 1:10:00', '5 maart 2027', '7 basisweken vooraf', 'di, do, zo', '80 kg', '1%']) {
      assert.ok(tekst.includes(verwacht), `samenvatting mist "${verwacht}": ${tekst}`);
    }
  };
  await controleer();
  await page.reload();
  await controleer();
  await shot('6-samenvatting');

  // Het schema heeft 7 basisweken + 11 weken en eindigt met de 10 km.
  await page.getByRole('link', { name: 'Schema' }).click();
  await page.waitForSelector('.week');
  assert.equal(await page.locator('.week').count(), 18);

  assert.deepEqual(fouten, [], 'JavaScript-fouten op de pagina');
  console.log('✓ story 1 onboarding: alle browserchecks geslaagd');
} finally {
  await sluit();
}

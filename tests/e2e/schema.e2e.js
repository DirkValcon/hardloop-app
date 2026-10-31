// Browsertest story 3: het schema van 11 weken in de app.
import assert from 'node:assert/strict';
import { opzet, DIRK } from './helpers.js';

const { page, url, fouten, shot, sluit } = await opzet({ profiel: { ...DIRK, doelDatum: '2027-01-17' } });
try {
  await page.goto(url + '#schema');
  assert.equal(await page.textContent('h1'), 'Schema');
  assert.match(await page.textContent('main'), /Je schema start op maandag 2 nov/);
  assert.equal(await page.locator('section.week').count(), 11);
  assert.equal(await page.locator('section.week .training').count(), 3 * 10 + 3);
  assert.equal(await page.locator('#week-4 .badge').textContent(), 'Herstelweek');
  assert.equal(await page.locator('#week-11 .badge').textContent(), 'Laatste week');

  // Week 1: di rustig, do kwaliteit, zo lang.
  const w1 = page.locator('#week-1 .training .wat');
  assert.match(await w1.nth(0).textContent(), /Rustige duurloop 4 km/);
  assert.match(await w1.nth(1).textContent(), /6 × 400 m op 5 km-tempo/);
  assert.match(await w1.nth(2).textContent(), /Lange duurloop 5 km/);
  assert.match(await page.locator('#week-11 .training').last().textContent(), /Zo.*17 jan.*10 km op doeltijd/s);

  // Kwaliteitstraining openklappen: warming-up, 6 intervallen op 8,9 km/u, cooling-down.
  await page.locator('#week-1 .training').nth(1).locator('summary').click();
  const blokken = page.locator('#week-1 .training[open] .blok');
  assert.equal(await blokken.count(), 3 + 6 + 5 + 2);
  assert.match(await blokken.first().textContent(), /Warming-up 1\/3.*4 min.*6,1 km\/u/s);
  assert.match(await blokken.nth(3).textContent(), /5 km-tempo 1\/6.*400 m.*8,9 km\/u.*1% helling/s);
  assert.match(await blokken.nth(-2).textContent(), /Uitjoggen.*3 min.*6,1/s);
  assert.match(await blokken.last().textContent(), /Uitwandelen.*2 min.*5,5.*0% helling/s);
  await shot('story3-schema');

  // Story 21: alleen week 1 (de eerste, het schema moet nog beginnen) staat open, de rest is ingeklapt met een samenvatting.
  assert.deepEqual(await page.locator('.week-inhoud').evaluateAll((d) => d.map((x) => x.open)), [true, ...Array(10).fill(false)]);
  assert.match(await page.textContent('#week-2 [data-test=week-samenvatting]'), /^3 trainingen · ca\. [\d,]+ km$/);
  assert.equal(await page.locator('#week-2 .training').first().isVisible(), false);
  await page.locator('#week-2 .week-inhoud > summary').click();
  assert.equal(await page.locator('#week-2 .training').first().isVisible(), true);
  // Week aanpassen: verplaatsen en vrije dagen op één plek.
  await page.locator('#week-1 .week-aanpassen summary').click();
  assert.equal(await page.locator('#week-1 .week-aanpassen .verplaats-rij').count(), 3);
  await page.getByRole('button', { name: 'Verplaats Rustige duurloop 4 km naar ma 2 nov' }).click();
  assert.match(await page.locator('#week-1 .training summary').first().textContent(), /Ma\s*2 nov.*verplaatst/s);
  assert.equal(await page.locator('#week-1 .week-aanpassen').getAttribute('open'), '');
  await shot('story21-schema');

  // Tabs werken.
  await page.getByRole('link', { name: 'Profiel' }).click();
  await page.waitForSelector('h1:text-is("Profiel")');
  await page.getByRole('link', { name: 'Schema' }).click();
  await page.waitForSelector('h1:text-is("Schema")');

  assert.deepEqual(fouten, []);
  console.log('✓ story 3 schema: alle browserchecks geslaagd');
} finally { await sluit(); }

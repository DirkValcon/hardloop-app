// Browsertest story 5: trainingen verschuiven en dagen vrij zetten per week.
import assert from 'node:assert/strict';
import { opzet, DIRK } from './helpers.js';

const { page, url, fouten, shot, sluit } = await opzet({ vandaag: '2026-11-02', profiel: { ...DIRK, doelDatum: '2027-01-17' } });
const week1 = () => page.locator('#week-1');
const rij = async () => (await week1().locator('.training summary').allTextContents()).map((t) => t.replace(/\s+/g, ' ').trim());

try {
  await page.goto(url + '#schema');
  assert.equal(await week1().locator('[data-test=waarschuwing]').count(), 0);

  // Kwaliteitstraining van donderdag naar zaterdag: waarschuwing over twee zware dagen achter elkaar.
  await week1().locator('[data-training=w1-kwaliteit] summary').click();
  await page.getByRole('button', { name: 'Verplaats naar za 7 nov' }).click();
  const r1 = await rij();
  assert.match(r1[1], /^Za ?7 nov Kwaliteit · verplaatst ?6 × 400 m/);
  assert.match(await week1().locator('[data-test=waarschuwing]').textContent(), /Twee zware trainingen achter elkaar/);
  // Vandaag (maandag) mag nog; de eigen dag niet.
  assert.equal(await page.getByRole('button', { name: 'Verplaats naar ma 2 nov' }).isEnabled(), true);
  assert.equal(await page.getByRole('button', { name: 'Verplaats naar za 7 nov' }).isDisabled(), true);
  await shot('story5-waarschuwing');

  // Week 2 is niet veranderd.
  assert.equal(await page.locator('#week-2 .label', { hasText: 'verplaatst' }).count(), 0);

  // Zondag vrij: de lange loop schuift naar dinsdag, de rustige duurloop vervalt.
  await week1().locator('.week-aanpassen summary').click();
  await page.getByRole('button', { name: 'zo 8 nov vrij' }).click();
  const r2 = await rij();
  assert.equal(r2.length, 2);
  assert.match(r2[0], /^Di ?3 nov Lang · verplaatst ?Lange duurloop 5 km/);
  assert.match(await week1().locator('[data-test=vervallen]').textContent(), /Rustige duurloop 4 km/);
  await shot('story5-vrij');

  // Na herladen staan de aanpassingen er nog, en Vandaag toont de verplaatste lange loop.
  await page.reload();
  assert.deepEqual(await rij(), r2);
  await page.getByRole('link', { name: 'Vandaag' }).click();
  await page.waitForSelector('[data-test=vandaag]');
  assert.match(await page.textContent('[data-test=vandaag]'), /Morgen.*Lange duurloop 5 km/s);

  // Vrije dag weer aan: rustige loop terug.
  await page.getByRole('link', { name: 'Schema' }).click();
  await page.waitForSelector('#week-1');
  await week1().locator('.week-aanpassen summary').click();
  await page.getByRole('button', { name: 'zo 8 nov vrij' }).click();
  assert.equal((await rij()).length, 3);

  assert.deepEqual(fouten, []);
  console.log('✓ story 5 aanpassen: alle browserchecks geslaagd');
} finally { await sluit(); }

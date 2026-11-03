// Browsertest: al eerder begonnen. Startweek terugzetten naar vorige week en het aantal weken wijzigen.
import assert from 'node:assert/strict';
import { opzet, DIRK } from './helpers.js';

// Maandag 2 november. Eigen 10 km-schema van 11 weken, week 1 = 2 nov (doeldatum zo 17 jan).
const profiel = { ...DIRK, doelDatum: '2027-01-17', schema: { id: 'sx', doelKm: 10, maxKm: 5, tempoSecPerKm: 420, weken: 11 } };
const { page, url, fouten, shot, sluit } = await opzet({ vandaag: '2026-11-02', profiel });
const tekst = async (sel) => (await page.textContent(sel)).replace(/\s+/g, ' ').trim();
try {
  await page.goto(url + '#profiel');
  assert.equal(await tekst('[data-test=startweek]'), 'week van 2 nov (deze week)');

  await page.getByRole('button', { name: 'Schema wijzigen' }).click();
  await page.waitForSelector('[data-test=startweek-keuze]');
  const opties = await page.locator('#startweek option').allTextContents();
  assert.ok(opties.includes('week van 26 okt (vorige week)'), 'vorige week is te kiezen');

  // Een week eerder begonnen: doeldatum schuift mee naar zo 10 jan, je zit nu in week 2.
  await page.selectOption('#startweek', '2026-10-26');
  assert.equal(await page.inputValue('#doelDatum'), '2027-01-10');
  assert.equal(await tekst('[data-test=nu-in-week]'), 'Je zit dan nu in week 2.');

  // En een week langer: week 1 blijft 26 okt, doeldatum weer zo 17 jan.
  await page.fill('#weken', '12');
  await page.locator('#weken').dispatchEvent('change');
  assert.equal(await page.inputValue('#startweek'), '2026-10-26');
  assert.equal(await page.inputValue('#doelDatum'), '2027-01-17');
  await shot('eerder-begonnen');
  await page.getByRole('button', { name: 'Opslaan' }).click();
  await page.waitForSelector('[data-test=samenvatting]');
  assert.equal(await tekst('[data-test=startweek]'), 'week van 26 okt (vorige week)');
  assert.match(await tekst('[data-test=samenvatting]'), /10 km in 12 weken/);
  const opgeslagen = await page.evaluate(() => JSON.parse(localStorage.getItem('hardloop-app.profiel.v1')));
  assert.equal(opgeslagen.doelDatum, '2027-01-17');
  assert.equal(opgeslagen.schema.weken, 12);
  assert.equal(opgeslagen.schema.id, 'sx');

  // Te kort: blessurewaarschuwing, maar opslaan mag.
  await page.getByRole('button', { name: 'Schema wijzigen' }).click();
  await page.fill('#weken', '5');
  await page.locator('#weken').dispatchEvent('change');
  await page.waitForSelector('[data-test=blessurewaarschuwing]');

  // Doeldatum in het verleden mag niet.
  await page.fill('#doelDatum', '2026-11-01');
  await page.locator('#doelDatum').dispatchEvent('change');
  await page.getByRole('button', { name: 'Opslaan' }).click();
  assert.match(await tekst('.foutmelding'), /verleden/);
  await page.getByRole('button', { name: 'Annuleren' }).click();

  // Schema-tab: week 1 is vorige week, deze week is week 2.
  await page.goto(url + '#schema');
  await page.waitForSelector('text=Week 1');
  assert.match(await tekst('main'), /26 okt/);
  assert.deepEqual(fouten, []);
  console.log('✓ eerder begonnen: startweek terug en aantal weken wijzigen');
} finally { await sluit(); }

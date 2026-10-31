// Browsertest: startweek zelf kiezen onder Profiel, en de knop Test geluid op het loopscherm.
import assert from 'node:assert/strict';
import { opzet, DIRK } from './helpers.js';

// Zaterdag 31 oktober. Schema met doeldatum zo 24 jan: week 1 = 9 november (een week te laat).
const { page, url, fouten, shot, sluit } = await opzet({ vandaag: '2026-10-31', profiel: { ...DIRK, doelDatum: '2027-01-24', extraWeken: 1, extraWekenKeuze: 'later' } });
const tekst = async (sel) => (await page.textContent(sel)).replace(/\s+/g, ' ').trim();
try {
  await page.addInitScript(() => {
    window.__gezegd = [];
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { speak: (u) => { if (u.text.trim()) window.__gezegd.push(u.text); }, cancel() {} },
    });
  });
  await page.goto(url + '#profiel');
  assert.equal(await tekst('[data-test=startweek]'), 'week van 9 nov');

  await page.getByRole('button', { name: 'Schema wijzigen' }).click();
  await page.waitForSelector('[data-test=startweek-keuze]');
  assert.equal(await page.inputValue('#startweek'), '2026-11-09');
  const opties = await page.locator('#startweek option').allTextContents();
  assert.equal(opties[0], 'week van 26 okt (deze week)');
  assert.equal(opties[1], 'week van 2 nov (volgende week)');

  // Een week eerder: de doeldatum schuift mee naar zo 17 jan.
  await page.selectOption('#startweek', '2026-11-02');
  assert.equal(await page.inputValue('#doelDatum'), '2027-01-17');
  await shot('startweek-kiezen');
  await page.getByRole('button', { name: 'Opslaan' }).click();
  await page.waitForSelector('[data-test=samenvatting]');
  assert.equal(await tekst('[data-test=startweek]'), 'week van 2 nov (volgende week)');
  const opgeslagen = await page.evaluate(() => JSON.parse(localStorage.getItem('hardloop-app.profiel.v1')));
  assert.equal(opgeslagen.doelDatum, '2027-01-17');
  assert.equal(opgeslagen.extraWeken, 1);

  // Deze week beginnen kan ook.
  await page.getByRole('button', { name: 'Schema wijzigen' }).click();
  await page.selectOption('#startweek', '2026-10-26');
  assert.equal(await page.inputValue('#doelDatum'), '2027-01-10');
  await page.getByRole('button', { name: 'Opslaan' }).click();
  await page.waitForSelector('[data-test=samenvatting]');
  assert.equal(await tekst('[data-test=startweek]'), 'week van 26 okt (deze week)');

  // Schema-tab: week 1 is nu deze week.
  await page.goto(url + '#schema');
  await page.waitForSelector('text=Week 1');
  assert.match(await tekst('main'), /26 okt/);

  // Test geluid op het loopscherm.
  await page.goto(url);
  await page.getByRole('button', { name: /Start op loopband|Nu al starten/ }).first().click();
  await page.getByRole('button', { name: 'Test geluid' }).click();
  assert.deepEqual(await page.evaluate(() => window.__gezegd), ['Geluid werkt. Zo klinkt een aankondiging.']);
  assert.deepEqual(fouten, []);
  console.log('✓ startweek kiezen en geluid testen');
} finally { await sluit(); }

// Browsertest story 18: op een kleine iPhone (SE) past het loopscherm met alle knoppen zonder scrollen,
// en Stop vasthouden stopt de training.
import assert from 'node:assert/strict';
import { opzet, DIRK, houdStopIngedrukt } from './helpers.js';

const { page, url, fouten, shot, sluit } = await opzet({ vandaag: '2026-11-05', profiel: { ...DIRK, doelDatum: '2027-01-17' }, klokLoopt: true });
try {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(url);
  await page.getByRole('button', { name: 'Start training' }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.waitForSelector('[data-test=bloktitel]');
  for (const naam of ['Stop', 'Pauze', 'Volgend blok', 'Sneller']) {
    const vak = await page.getByRole('button', { name: naam }).boundingBox();
    assert.ok(vak.y >= 0 && vak.y + vak.height <= 667, `${naam} past op het scherm (${vak.y + vak.height})`);
  }
  assert.equal(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), true, 'niet scrollen');
  // Pauze is de grootste knop.
  const pauze = await page.getByRole('button', { name: 'Pauze' }).boundingBox();
  const stop = await page.getByRole('button', { name: 'Stop' }).boundingBox();
  assert.ok(pauze.width > stop.width);
  await shot('story18-loopscherm-se');

  // + en − vasthouden telt door; kort tikken is precies één stap.
  const snelheid = async () => Number((await page.textContent('[data-test=snelheid]')).replace(',', '.'));
  const begin = await snelheid();
  const plus = await page.getByRole('button', { name: 'Sneller' }).boundingBox();
  await page.mouse.move(plus.x + plus.width / 2, plus.y + plus.height / 2);
  await page.mouse.down();
  await page.clock.runFor(1500);
  await page.mouse.up();
  const naHouden = await snelheid();
  assert.ok(naHouden - begin >= 0.9, `vasthouden telt door (${begin} → ${naHouden})`);
  await page.clock.runFor(1000);
  assert.equal(await snelheid(), naHouden, 'stopt na loslaten');
  await page.getByRole('button', { name: 'Langzamer' }).click();
  assert.equal(await snelheid(), Math.round((naHouden - 0.1) * 10) / 10, 'kort tikken is één stap');
  await page.getByRole('button', { name: 'Langzamer' }).focus();
  await page.keyboard.press('Enter');
  assert.equal(await snelheid(), Math.round((naHouden - 0.2) * 10) / 10, 'toetsenbord werkt ook');

  await page.clock.runFor(5 * 60_000);
  await houdStopIngedrukt(page);
  await page.waitForSelector('[data-test=afronden]');
  assert.match(await page.textContent('[data-test=klaar]'), /gestopt na 5 min/);
  assert.deepEqual(fouten, []);
  console.log('✓ story 18 loopscherm: alles in beeld op een iPhone SE, Stop vasthouden stopt, + en − vasthouden telt door');
} finally { await sluit(); }

// Browsertest story 25: op een laptopscherm staat de navigatie links en gebruiken Schema en Voortgang de breedte.
import assert from 'node:assert/strict';
import { opzet, DIRK } from './helpers.js';

const { page, url, fouten, shot, sluit } = await opzet({ vandaag: '2026-11-11', profiel: { ...DIRK, doelDatum: '2027-01-17' } });
try {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(url + '#schema');
  await page.waitForSelector('#week-1');
  const nav = await page.locator('nav.tabs').boundingBox();
  assert.ok(nav.x < 40 && nav.width < 260 && nav.height > 500, `zijbalk links: ${JSON.stringify(nav)}`);
  const main = await page.locator('main').boundingBox();
  assert.ok(main.x > nav.x + nav.width, 'inhoud naast de zijbalk');
  const w1 = await page.locator('#week-1').boundingBox();
  const w2 = await page.locator('#week-2').boundingBox();
  assert.ok(Math.abs(w1.y - w2.y) < 2 && w2.x > w1.x + 100, 'weken in twee kolommen');
  await shot('story25-laptop-schema');

  await page.getByRole('link', { name: 'Voortgang' }).click();
  await page.waitForSelector('[data-test=deze-week]');
  const week = await page.locator('[data-test=deze-week]').boundingBox();
  const grafiek = await page.locator('.grafiek').boundingBox();
  assert.ok(grafiek.x > week.x + week.width, 'grafiek naast deze week');
  await shot('story25-laptop-voortgang');

  // Op de iPhone blijft de tabbalk onderin.
  await page.setViewportSize({ width: 390, height: 664 });
  const onder = await page.locator('nav.tabs').boundingBox();
  assert.ok(onder.y > 500 && onder.width > 300, 'iPhone: tabbalk onderin');
  assert.deepEqual(fouten, []);
  console.log('✓ story 25 laptop: zijbalk, schema in twee kolommen, voortgang naast elkaar');
} finally { await sluit(); }

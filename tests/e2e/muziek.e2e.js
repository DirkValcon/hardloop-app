// Muziek (Spotify) mag na een gesproken aanwijzing weer verder: het geluidskanaal wordt alleen
// geclaimd ('playback') zolang er iets klinkt en daarna weer losgelaten ('auto').
import assert from 'node:assert/strict';
import { opzet, DIRK, houdStopIngedrukt } from './helpers.js';

const { page, url, fouten, sluit } = await opzet({ vandaag: '2026-11-03', profiel: { ...DIRK, doelDatum: '2027-01-17' }, klokLoopt: true });
const modus = () => page.evaluate(() => window.__modi.at(-1));
try {
  await page.addInitScript(() => {
    window.__modi = [];
    let type = 'auto';
    Object.defineProperty(navigator, 'audioSession', {
      configurable: true,
      value: { get type() { return type; }, set type(v) { type = v; window.__modi.push(v); } },
    });
    window.__gezegd = [];
    // Nepspraak: elke uitspraak duurt 2 seconden en meldt dan 'klaar'.
    let bezig = 0;
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        get speaking() { return bezig > 0; }, pending: false, paused: false, cancel() {}, resume() {}, getVoices: () => [],
        speak(u) {
          if (u.text.trim()) window.__gezegd.push(u.text);
          bezig++;
          setTimeout(() => { bezig--; u.onend?.(); }, 2000);
        },
      },
    });
  });
  await page.goto(url);
  await page.getByRole('button', { name: 'Start op loopband' }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();

  // Tijdens de startaankondiging is het kanaal geclaimd.
  await page.clock.runFor(500);
  assert.equal(await modus(), 'playback');
  // Na afloop weer losgelaten, zodat Spotify verder kan.
  await page.clock.runFor(3_000);
  assert.equal(await modus(), 'auto');

  // Een tik op het scherm (pauze) claimt even en laat daarna ook weer los.
  await page.getByRole('button', { name: 'Pauze' }).click();
  await page.clock.runFor(3_000);
  assert.equal(await modus(), 'auto');
  await page.getByRole('button', { name: 'Hervat' }).click();
  await page.clock.runFor(3_000);
  assert.equal(await modus(), 'auto');

  // 10 seconden voor blok 2: piep + aankondiging, daarna weer vrij.
  const voor = (await page.evaluate(() => window.__modi.length));
  await page.clock.runFor(240_000);
  const modi = await page.evaluate((n) => window.__modi.slice(n), voor);
  assert.ok(modi.includes('playback'), JSON.stringify(modi));
  assert.equal(modi.at(-1), 'auto');
  assert.ok((await page.evaluate(() => window.__gezegd)).some((z) => z.startsWith('Over 10 seconden')));

  await houdStopIngedrukt(page);
  assert.deepEqual(fouten, []);
  console.log('Muziek-test geslaagd');
} finally {
  await sluit();
}

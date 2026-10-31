// Browsertest story 24: je ziet dat iets is opgeslagen en of het al in je account staat.
import assert from 'node:assert/strict';
import { opzet, DIRK } from './helpers.js';

const ctx = await opzet({ vandaag: '2026-11-03', profiel: { ...DIRK, doelDatum: '2027-01-17' } });
const { page, url, fouten, shot, sluit } = ctx;
const stand = () => page.getAttribute('[data-test=syncstatus]', 'data-stand');
try {
  await page.goto(url + '#profiel');
  await page.waitForFunction(() => document.querySelector('[data-test=syncstatus]')?.dataset.stand === 'bijgewerkt');
  assert.match(await page.textContent('[data-test=syncstatus]'), /Alles is bewaard in je account/);

  // Zonder internet iets wijzigen: melding Opgeslagen, en de status zegt dat het later meegaat.
  await page.context().setOffline(true);
  const geenNet = (r) => r.abort('internetdisconnected');
  await page.route('https://test.supabase.co/**', geenNet);
  await page.getByRole('button', { name: 'Instellingen wijzigen' }).click();
  await page.fill('#gewicht', '79');
  await page.getByRole('button', { name: 'Opslaan' }).click();
  assert.match(await page.textContent('[data-test=melding]'), /Opgeslagen/);
  await page.waitForFunction(() => document.querySelector('[data-test=syncstatus]')?.dataset.stand === 'offline');
  assert.match(await page.textContent('[data-test=syncstatus]'), /Geen internet/);
  await shot('story24-offline');

  // Weer online: de wijziging gaat naar het account en de status wordt groen.
  await page.unroute('https://test.supabase.co/**', geenNet);
  await page.context().setOffline(false);
  await page.evaluate(() => dispatchEvent(new Event('online')));
  await page.waitForFunction(() => document.querySelector('[data-test=syncstatus]')?.dataset.stand === 'bijgewerkt', null, { timeout: 10000 });
  assert.equal(JSON.parse(ctx.tabel.profiel.waarde).gewicht, 79);
  assert.equal(await stand(), 'bijgewerkt');
  assert.deepEqual(fouten, []);
  console.log('✓ story 24: melding Opgeslagen en zichtbare synchronisatie (ook offline)');
} finally { await sluit(); }

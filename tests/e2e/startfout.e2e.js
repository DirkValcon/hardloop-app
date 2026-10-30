// Browsertest: start de app niet, dan geen leeg zwart scherm maar een melding met een herstelknop.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { opzet, DIRK } from './helpers.js';

// Na een update een oud bestand uit de cache, waar een nieuw onderdeel nog niet in zit.
{
  const t = await opzet({ profiel: DIRK });
  try {
    const nieuw = await readFile(new URL('../../js/opmaak.js', import.meta.url), 'utf8');
    const oud = nieuw.replace('export const minuten', 'const minuten');
    await t.page.route('**/js/opmaak.js', (r) => r.fulfill({ contentType: 'text/javascript', body: oud }));
    await t.page.goto(t.url + '#vandaag');
    await t.page.getByRole('heading', { name: 'De app start niet' }).waitFor();
    assert.match(await t.page.textContent('[data-test=fouttekst]'), /minuten/);
    await t.shot('startfout');

    await t.page.unroute('**/js/opmaak.js');
    await t.page.getByRole('button', { name: 'Herstellen' }).click();
    await t.page.locator('nav.tabs').waitFor();
    console.log('✓ startfout: melding met herstelknop in plaats van een zwart scherm');
  } finally { await t.sluit(); }
}

// Verlopen sessie en het verversen blijft hangen: de app start toch met de bewaarde sessie.
{
  const t = await opzet({ profiel: DIRK, ingelogd: false });
  try {
    await t.page.addInitScript(() => localStorage.setItem('sb-test-auth-token', JSON.stringify({
      access_token: 'oud', refresh_token: 'oud', token_type: 'bearer', expires_in: 3600, expires_at: 1000,
      user: { id: '00000000-0000-4000-8000-000000000001', email: 'dirk@example.com' },
    })));
    await t.page.route('https://test.supabase.co/auth/**', () => { /* nooit antwoord */ });
    await t.page.goto(t.url + '#vandaag');
    await t.page.locator('nav.tabs').waitFor({ timeout: 10000 });
    console.log('✓ startfout: hangende sessiecontrole blokkeert de app niet');
  } finally { await t.sluit(); }
}

// Browsertest story 12: inloggen met Google is verplicht; uitloggen kan onder Profiel.
import assert from 'node:assert/strict';
import { opzet, DIRK, TESTGEBRUIKER } from './helpers.js';

// Niet ingelogd: alleen het inlogscherm, zonder tabbalk.
{
  const t = await opzet({ ingelogd: false, profiel: DIRK });
  try {
    await t.page.goto(t.url + '#vandaag');
    await t.page.getByRole('button', { name: 'Inloggen met Google' }).waitFor();
    assert.equal(await t.page.locator('nav.tabs').count(), 0, 'geen tabbalk voor het inloggen');
    await t.shot('story12-inlogscherm');

    // De knop stuurt door naar Google via Supabase en komt terug op de app.
    const [verzoek] = await Promise.all([
      t.page.waitForRequest((r) => r.url().includes('/auth/v1/authorize')),
      t.page.getByRole('button', { name: 'Inloggen met Google' }).click(),
    ]);
    const adres = new URL(verzoek.url());
    assert.equal(adres.searchParams.get('provider'), 'google');
    assert.equal(adres.searchParams.get('redirect_to'), t.url);
    assert.ok(adres.searchParams.get('code_challenge'), 'PKCE-flow, zodat de #-navigatie heel blijft');
    assert.deepEqual(t.fouten, []);
    console.log('✓ story 12: zonder inloggen alleen het inlogscherm, knop gaat naar Google');
  } finally { await t.sluit(); }
}

// Ingelogd: app werkt zoals voorheen, Profiel toont het account en uitloggen werkt.
{
  const t = await opzet({ profiel: DIRK });
  try {
    await t.page.goto(t.url + '#profiel');
    await t.page.locator('[data-test=account]').waitFor();
    assert.match(await t.page.textContent('[data-test=account]'), new RegExp(TESTGEBRUIKER.email));
    await t.shot('story12-account');
    await t.page.evaluate(() => localStorage.setItem('test-uitgelogd', '1'));
    await t.page.getByRole('button', { name: 'Uitloggen' }).click();
    await t.page.getByRole('button', { name: 'Inloggen met Google' }).waitFor();
    await t.page.reload();
    await t.page.getByRole('button', { name: 'Inloggen met Google' }).waitFor();
    assert.deepEqual(t.fouten, []);
    console.log('✓ story 12: ingelogd zie je je account onder Profiel, uitloggen brengt je terug naar inloggen');
  } finally { await t.sluit(); }
}

// Browsertest story 7: training afvinken, afstand van de loopband invullen, overslaan en gemiste trainingen.
import assert from 'node:assert/strict';
import { opzet, DIRK, houdStopIngedrukt } from './helpers.js';

const profiel = { ...DIRK, doelDatum: '2027-01-17' };
const tekst = async (page, sel) => (await page.textContent(sel)).replace(/\s+/g, ' ').trim();

// Deel 1: dinsdag 3 nov, rustige duurloop op de loopband, halverwege stoppen en de loopbandafstand invullen.
{
  const { page, url, fouten, shot, sluit } = await opzet({ vandaag: '2026-11-03', profiel, klokLoopt: true });
  try {
    await page.goto(url);
    await page.getByRole('button', { name: 'Start op loopband' }).click();
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await page.clock.runFor(20 * 60_000);
    await houdStopIngedrukt(page);
    await page.waitForSelector('[data-test=afronden]');
    assert.match(await tekst(page, '[data-test=klaar]'), /gestopt na 20 min/);
    assert.equal(await page.inputValue('#duurMin'), '20');
    const geschat = Number(await page.inputValue('#kcal'));
    assert.ok(geschat > 100 && geschat < 250, String(geschat));

    // Ongeldige afstand wordt geweigerd.
    await page.fill('#afstandKm', '0');
    await page.getByRole('button', { name: 'Opslaan als gedaan' }).click();
    assert.match(await tekst(page, '.foutmelding'), /afstand/);

    // Afstand van de loopband: 2,5 km. Calorieën schuiven mee.
    await page.fill('#afstandKm', '2,5');
    const nieuw = Number(await page.inputValue('#kcal'));
    assert.ok(nieuw > 150 && nieuw < 300, String(nieuw));
    await shot('story7-afronden');
    await page.getByRole('button', { name: 'Opslaan als gedaan' }).click();
    await page.waitForSelector('[data-test=vandaag-gedaan]');
    assert.match(await tekst(page, '[data-test=vandaag-gedaan]'), /Vandaag gedaan Rustige duurloop 4 km ?2,5 km · 20 min · \d+ kcal/);
    // De volgende training is nu die van donderdag.
    assert.match(await tekst(page, '[data-test=vandaag]'), /6 × 400 m/);
    await shot('story7-vandaag-gedaan');

    // In het schema staat hij als gedaan, ook na herladen; ongedaan maken kan.
    await page.reload();
    await page.getByRole('link', { name: 'Schema' }).click();
    await page.waitForSelector('#week-1');
    assert.match(await tekst(page, '[data-training=w1-rustig] summary'), /✓ gedaan/);
    await page.locator('[data-training=w1-rustig] summary').click();
    await page.getByRole('button', { name: 'Ongedaan maken' }).click();
    assert.doesNotMatch(await tekst(page, '[data-training=w1-rustig] summary'), /gedaan/);
    assert.deepEqual(fouten, []);
  } finally { await sluit(); }
}

// Deel 2: vrijdag 6 nov. Donderdag gemist: verplaatsen naar zaterdag. Dinsdag handmatig afvinken.
{
  const { page, url, fouten, shot, sluit } = await opzet({ vandaag: '2026-11-06', profiel });
  try {
    await page.goto(url);
    const gemist = page.locator('[data-test=gemist]');
    assert.equal(await gemist.count(), 2); // di en do
    await shot('story7-gemist');

    // Dinsdag: toch gedaan, met de standaardwaarden.
    await gemist.first().getByRole('link', { name: 'Toch gedaan' }).click();
    await page.waitForSelector('[data-test=afronden]');
    assert.equal(await page.inputValue('#afstandKm'), '5,6');
    await page.getByRole('button', { name: 'Opslaan als gedaan' }).click();
    await page.waitForSelector('[data-test=vandaag]');
    assert.equal(await gemist.count(), 1);

    // Donderdag: verplaatsen naar zaterdag 7 nov.
    const knoppen = await gemist.first().locator('[data-verplaats]').allTextContents();
    assert.deepEqual(knoppen.map((k) => k.replace(/\s+/g, '')), ['vr6nov', 'za7nov']); // vandaag en zaterdag zijn vrij
    await gemist.first().locator('[data-naar="2026-11-07"]').click();
    assert.equal(await gemist.count(), 0);
    assert.match(await tekst(page, '[data-test=vandaag]'), /Morgen.*6 × 400 m/);

    assert.deepEqual(fouten, []);
  } finally { await sluit(); }
}

// Deel 3: zaterdag 7 nov, de verplaatste kwaliteitstraining overslaan.
{
  const { page, url, fouten, sluit } = await opzet({ vandaag: '2026-11-07', profiel });
  try {
    await page.addInitScript(() => localStorage.setItem('hardloop-app.aanpassingen.v1',
      JSON.stringify({ verplaatst: { 'w1-kwaliteit': '2026-11-07' }, vrij: [] })));
    await page.goto(url);
    assert.match(await tekst(page, '[data-test=vandaag]'), /Vandaag.*6 × 400 m/);
    await page.getByRole('button', { name: 'Overslaan' }).last().click();
    assert.match(await tekst(page, '[data-test=vandaag]'), /Morgen.*Lange duurloop 5 km/);
    await page.getByRole('link', { name: 'Schema' }).click();
    await page.waitForSelector('#week-1');
    assert.match(await tekst(page, '[data-training=w1-kwaliteit] summary'), /overgeslagen/);
    assert.deepEqual(fouten, []);
    console.log('✓ story 7 afvinken: alle browserchecks geslaagd');
  } finally { await sluit(); }
}

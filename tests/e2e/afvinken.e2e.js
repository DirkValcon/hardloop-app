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

    // Story 19: eerst een samenvatting, de velden zitten achter Aanpassen.
    assert.equal(await tekst(page, '[data-test=sam-duur]'), '20 min');
    assert.match(await tekst(page, '[data-test=volgnummer]'), /Training 1 van 33/);
    assert.equal(await page.locator('#afstandKm').isVisible(), false);
    // Niet opslaan vraagt eerst of je het zeker weet.
    await page.getByRole('button', { name: 'Niet opslaan' }).click();
    assert.equal(await tekst(page, '[data-actie=annuleer]'), 'Echt weggooien?');
    assert.equal(await page.locator('[data-test=afronden]').count(), 1, 'nog niet weggegooid');
    await shot('story19-afronden');
    await page.getByText('Afstand, tijd of kcal aanpassen').click();

    // Ongeldige afstand wordt geweigerd.
    await page.fill('#afstandKm', '0');
    await page.getByRole('button', { name: 'Opslaan als gedaan' }).click();
    assert.match(await tekst(page, '.foutmelding'), /afstand/);

    // Afstand van de loopband: 2,5 km. Calorieën schuiven mee.
    await page.fill('#afstandKm', '2,5');
    assert.equal(await tekst(page, '[data-test=sam-afstand]'), '2,5');
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
    // Story 16: de training van vandaag staat bovenaan, de gemiste trainingen compact eronder.
    const volgorde = await page.evaluate(() => [...document.querySelectorAll('[data-test=vandaag], [data-test=gemist]')].map((e) => e.dataset.test));
    assert.deepEqual(volgorde, ['vandaag', 'gemist', 'gemist']);
    const start = await page.locator('[data-actie=start]').boundingBox();
    assert.ok(start.y + start.height <= page.viewportSize().height - 90, 'Start zichtbaar zonder scrollen, boven de tabbalk');
    await gemist.first().locator('summary').click();
    await gemist.nth(1).locator('summary').click();
    await shot('story7-gemist');

    // Dinsdag: toch gedaan, met de standaardwaarden.
    await gemist.first().getByRole('link', { name: 'Toch gedaan' }).click();
    await page.waitForSelector('[data-test=afronden]');
    assert.equal(await page.inputValue('#afstandKm'), '5,6');
    await page.getByRole('button', { name: 'Opslaan als gedaan' }).click();
    await page.waitForSelector('[data-test=vandaag]');
    assert.equal(await gemist.count(), 1);

    // Donderdag: verplaatsen naar zaterdag 7 nov.
    await gemist.first().locator('summary').click();
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

// Browsertest story 4: scherm Vandaag op een trainingsdag, een rustdag en vóór de start.
import assert from 'node:assert/strict';
import { opzet, DIRK } from './helpers.js';

const profiel = { ...DIRK, doelDatum: '2027-01-17' };

async function bekijk(vandaag, naam) {
  const ctx = await opzet({ vandaag, profiel });
  await ctx.page.goto(ctx.url);
  await ctx.page.waitForSelector('[data-test=vandaag]');
  const r = {
    kaart: (await ctx.page.textContent('[data-test=vandaag]')).replace(/\s+/g, ' '),
    rustdag: await ctx.page.locator('[data-test=rustdag]').textContent().catch(() => null),
    start: (await ctx.page.textContent('[data-actie=start]')).trim(),
    kcal: Number(await ctx.page.textContent('[data-test=kcal]')),
    totDoel: await ctx.page.textContent('[data-test=tot-doel]'),
  };
  if (naam) await ctx.shot(naam);
  assert.deepEqual(ctx.fouten, []);
  await ctx.sluit();
  return r;
}

// Trainingsdag: dinsdag 3 november, rustige duurloop 4 km.
const di = await bekijk('2026-11-03', 'story4-vandaag');
assert.equal(di.rustdag, null);
assert.match(di.kaart, /Vandaag · Week 1/);
assert.match(di.kaart, /Rustige duurloop 4 km/);
assert.match(di.kaart, /49 min/);
assert.match(di.kaart, /Warming-up ?10 min ?6,1–6,9 km\/u/);
assert.match(di.kaart, /Uitjoggen \+ uitwandelen ?5 min ?5,5–6,1 km\/u/);
assert.ok(di.kcal > 350 && di.kcal < 550, String(di.kcal));
assert.equal(di.start, 'Start op loopband');
assert.match(di.totDoel, /Nog 75 dagen tot je 10 km op 17 januari 2027/);

// Rustdag: woensdag 4 november, volgende is de kwaliteitstraining op donderdag.
const wo = await bekijk('2026-11-04', 'story4-rustdag');
assert.match(wo.rustdag, /Vandaag is een rustdag/);
assert.match(wo.kaart, /Morgen · Week 1/);
assert.match(wo.kaart, /6 × 400 m op 5 km-tempo/);
assert.match(wo.kaart, /8,9 km\/u/);
assert.equal(wo.start, 'Nu al starten'); // ook op een rustdag kun je starten

// Vóór de start van het schema.
const voor = await bekijk('2026-10-30');
assert.match(voor.rustdag, /Je schema start op 2 november 2026/);
assert.match(voor.kaart, /Dinsdag 3 nov/);

console.log('✓ story 4 vandaag: alle browserchecks geslaagd');

// Story 17: weekstrook en datumkop. Donderdag 12 nov, week 2: di gemist, do vandaag, zo gepland; week 1 had gedaan.
{
  const ctx = await opzet({ vandaag: '2026-11-12', profiel });
  const { page } = ctx;
  try {
    await page.addInitScript(() => localStorage.setItem('hardloop-app.resultaten.v1', JSON.stringify({
      'w2-rustig': { status: 'gedaan', afstandKm: 6, duurSec: 3100, kcal: 480, datum: '2026-11-10' },
    })));
    await page.goto(ctx.url);
    await page.waitForSelector('[data-test=weekstrook]');
    assert.equal((await page.textContent('[data-test=datumkop]')).trim(), 'Donderdag 12 november · week 2 van 11');
    const dagen = await page.locator('[data-test=weekstrook] > *').evaluateAll((els) => els.map((e) => e.dataset.status ?? 'rust'));
    assert.deepEqual(dagen, ['rust', 'gedaan', 'rust', 'gepland', 'rust', 'rust', 'gepland']);
    assert.equal(await page.locator('.weekdag.is-vandaag b').textContent(), '12');
    // Tik op dinsdag: die training (gedaan) verschijnt, zonder Start.
    await page.locator('.weekdag[data-status=gedaan]').click();
    assert.match((await page.textContent('[data-test=vandaag]')).replace(/\s+/g, ' '), /Dinsdag 10 nov · Week 2.*✓ Gedaan: 6 km/);
    assert.equal(await page.locator('[data-test=vandaag] [data-actie=start]').count(), 0);
    await ctx.shot('story17-weekstrook');
    // Terug naar de training van vandaag.
    await page.getByRole('button', { name: 'Terug naar je volgende training' }).click();
    assert.match(await page.textContent('[data-test=vandaag]'), /Vandaag · Week 2/);
    assert.deepEqual(ctx.fouten, []);
  } finally { await ctx.sluit(); }
  console.log('✓ story 17 weekstrook: alle browserchecks geslaagd');
}

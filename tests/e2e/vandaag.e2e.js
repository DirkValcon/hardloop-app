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
    start: await ctx.page.getByRole('button', { name: 'Start op loopband' }).isEnabled(),
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
assert.equal(di.start, true);
assert.match(di.totDoel, /Nog 75 dagen tot je 10 km op 17 januari 2027/);

// Rustdag: woensdag 4 november, volgende is de kwaliteitstraining op donderdag.
const wo = await bekijk('2026-11-04', 'story4-rustdag');
assert.match(wo.rustdag, /Vandaag is een rustdag/);
assert.match(wo.kaart, /Morgen · Week 1/);
assert.match(wo.kaart, /6 × 400 m op 5 km-tempo/);
assert.match(wo.kaart, /8,9 km\/u/);
assert.equal(wo.start, false);

// Vóór de start van het schema.
const voor = await bekijk('2026-10-30');
assert.match(voor.rustdag, /Je schema start op 2 november 2026/);
assert.match(voor.kaart, /Dinsdag 3 nov/);

console.log('✓ story 4 vandaag: alle browserchecks geslaagd');

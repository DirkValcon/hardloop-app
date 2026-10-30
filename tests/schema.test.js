import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maakPlan, verdeelDagen, maandagVan, SJABLOON_5_10 } from '../js/schema.js';
import { DIRK_PROFIEL as DIRK } from './fixtures.js';

const VANDAAG = '2026-10-30';
const DAGSETS = {
  3: ['di', 'do', 'zo'],
  4: ['ma', 'wo', 'vr', 'zo'],
  5: ['ma', 'di', 'do', 'za', 'zo'],
};
const alleTrainingen = (plan) => plan.weken.flatMap((w) => w.trainingen);
const somDuur = (week) => week.trainingen.reduce((s, t) => s + t.duurSec, 0);

test('verdeelDagen: lange loop als laatste, kwaliteit niet ernaast', () => {
  assert.deepEqual(verdeelDagen(['zo', 'di', 'do']), { di: 'rustig', do: 'kwaliteit', zo: 'lang' });
  const v = verdeelDagen(['ma', 'di', 'do', 'za', 'zo']);
  assert.equal(v.zo, 'lang');
  assert.equal(v.do, 'kwaliteit');
});

test('maandagVan', () => {
  assert.equal(maandagVan('2026-10-30'), '2026-10-26'); // vrijdag
  assert.equal(maandagVan('2026-10-26'), '2026-10-26'); // maandag
  assert.equal(maandagVan('2027-01-17'), '2027-01-11'); // zondag
});

for (const [n, dagen] of Object.entries(DAGSETS)) {
  test(`schema met ${n} dagen voldoet aan alle regels`, () => {
    const profiel = { ...DIRK, trainingsdagen: dagen, doelDatum: '2027-01-17' }; // zondag
    const plan = maakPlan(profiel, { vandaag: VANDAAG });
    assert.equal(plan.weken.length, 11);

    // Week 11 eindigt op de doeldatum met de 10 km.
    const w11 = plan.weken[10];
    const laatste = w11.trainingen.at(-1);
    assert.equal(laatste.datum, '2027-01-17');
    assert.equal(laatste.type, 'doel');
    assert.ok(alleTrainingen(plan).every((t) => t.datum <= '2027-01-17'));
    assert.ok(alleTrainingen(plan).every((t) => t.datum > VANDAAG), 'niets in het verleden');

    // Weken 1-10 hebben precies het gekozen aantal trainingen, op de gekozen dagen.
    for (const w of plan.weken.slice(0, 10)) {
      assert.equal(w.trainingen.length, Number(n), `week ${w.nummer}`);
      assert.deepEqual(w.trainingen.map((t) => t.dag), dagen);
      assert.equal(w.trainingen.filter((t) => t.type === 'kwaliteit').length, 1);
      assert.equal(w.trainingen.filter((t) => t.type === 'lang').length, 1);
    }

    // Elke training: 10 min warming-up vooraf, uitjoggen + uitwandelen achteraf.
    for (const t of alleTrainingen(plan)) {
      const warmup = t.blokken.filter((b) => b.soort === 'warmup');
      assert.equal(warmup.reduce((s, b) => s + b.duurSec, 0), 600, t.id);
      assert.ok(t.blokken.slice(0, 3).every((b) => b.soort === 'warmup'), t.id);
      assert.deepEqual(t.blokken.slice(-2).map((b) => b.soort), ['uitjoggen', 'uitwandelen'], t.id);
      // Warming-up loopt op in snelheid.
      assert.ok(warmup[0].kmh <= warmup[1].kmh && warmup[1].kmh <= warmup[2].kmh, t.id);
      assert.ok(t.blokken.at(-1).kmh < t.blokken.at(-2).kmh, 'uitwandelen langzamer dan uitjoggen');
    }

    // Herstelweken 4 en 8 zijn lichter dan de week ervoor.
    for (const w of [4, 8]) {
      assert.equal(plan.weken[w - 1].soort, 'herstel');
      assert.ok(somDuur(plan.weken[w - 1]) < somDuur(plan.weken[w - 2]), `week ${w}`);
    }

    // Lange loop bouwt op tot 10 km in week 10.
    const lang = plan.weken.slice(0, 10).map((w) => w.trainingen.find((t) => t.type === 'lang'));
    assert.match(lang[0].naam, /5 km/);
    assert.match(lang[9].naam, /10 km/);
  });
}

test('afwisseling: geen twee weken dezelfde kwaliteitstraining, en niet twee keer dezelfde vorm achter elkaar', () => {
  const plan = maakPlan(DIRK, { vandaag: VANDAAG });
  const kwal = plan.weken.map((w) => w.trainingen.find((t) => t.type === 'kwaliteit'));
  assert.equal(new Set(kwal.map((t) => t.naam)).size, 11);
  for (let i = 1; i < kwal.length; i++) assert.notEqual(kwal[i].vorm, kwal[i - 1].vorm, `week ${i + 1}`);
  assert.equal(new Set(kwal.map((t) => t.vorm)).size, 6);
});

test('intervallen: 6 × 400 m in week 1 met herstel ertussen op de juiste snelheden', () => {
  const plan = maakPlan(DIRK, { vandaag: VANDAAG });
  const t = plan.weken[0].trainingen.find((x) => x.type === 'kwaliteit');
  const intervallen = t.blokken.filter((b) => b.soort === 'interval');
  assert.equal(intervallen.length, 6);
  assert.ok(intervallen.every((b) => b.afstandM === 400 && b.kmh === 8.9));
  assert.equal(t.blokken.filter((b) => b.soort === 'herstel').length, 5);
  assert.ok(t.blokken.every((b) => b.helling === (b.soort === 'uitwandelen' ? 0 : 1)));
});

test('doeldatum midden in de week: trainingen erna vervallen, geen kwaliteit op de dag ervoor', () => {
  // Doeldatum vrijdag 15 januari 2027, dagen di/do/zo: de lange loop op zondag vervalt.
  const plan = maakPlan({ ...DIRK, doelDatum: '2027-01-15' }, { vandaag: VANDAAG });
  const w11 = plan.weken[10].trainingen;
  assert.deepEqual(w11.map((t) => [t.datum, t.type]), [
    ['2027-01-12', 'kwaliteit'], ['2027-01-14', 'rustig'], ['2027-01-15', 'doel'],
  ]);
});

test('basisweken worden vóór het schema gezet; bij later starten niet', () => {
  const ver = { ...DIRK, doelDatum: '2027-03-07', extraWeken: 7 };
  const basis = maakPlan({ ...ver, extraWekenKeuze: 'basis' }, { vandaag: VANDAAG });
  const later = maakPlan({ ...ver, extraWekenKeuze: 'later' }, { vandaag: VANDAAG });
  assert.equal(later.weken.length, 11);
  assert.equal(later.start, '2026-12-21');
  const basisweken = basis.weken.filter((w) => w.soort === 'basis');
  assert.equal(basisweken.length, 7); // 2 nov t/m 20 dec
  assert.equal(basis.start, '2026-11-02');
  assert.equal(basis.weken.length, 18);
  assert.ok(basisweken.every((w) => w.trainingen.every((t) => t.type === 'rustig' || t.type === 'lang')));
  // Opeenvolgende weken zonder gat.
  for (let i = 1; i < basis.weken.length; i++) {
    assert.equal((new Date(basis.weken[i].maandag) - new Date(basis.weken[i - 1].maandag)) / 86400000, 7);
  }
});

test('sjabloon is compleet voor 11 weken', () => {
  for (const k of ['rustig', 'lang', 'extraRustig', 'kwaliteit']) assert.equal(SJABLOON_5_10[k].length, 11, k);
});

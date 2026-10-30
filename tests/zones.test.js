import { test } from 'node:test';
import assert from 'node:assert/strict';
import { berekenZones, beoordeelDoeltijd, voorspelTijd, tempoPerKm } from '../js/zones.js';

const opId = (zones) => Object.fromEntries(zones.map((z) => [z.id, z]));
const bijna = (a, b, marge = 0.1) => assert.ok(Math.abs(a - b) <= marge + 1e-9, `${a} ≠ ${b}`);

test('zones bij 28:30 zonder doeltijd komen overeen met het ontwerp', () => {
  const z = opId(berekenZones(28 * 60 + 30));
  bijna(z.warmup.van, 7.5); bijna(z.warmup.tot, 8.4);
  bijna(z.rustig.van, 8.4); bijna(z.rustig.tot, 9.0);
  bijna(z.tempo10.van, 10.1);
  bijna(z.tempo5.van, 10.5);
  bijna(z.snel.van, 10.9);
  bijna(z.uitjoggen.van, 7.5);
  assert.ok(z.uitwandelen.van <= 5.5);
});

test('Riegel: 28:30 voorspelt ongeveer 59:25 op 10 km', () => {
  bijna(voorspelTijd(1710, 5, 10), 59 * 60 + 25, 2);
});

test('Dirk: 35:00 en doel 70:00 is ambitieus maar haalbaar', () => {
  const b = beoordeelDoeltijd(2100, 4200);
  assert.equal(b.niveau, 'ambitieus');
  bijna(b.voorspeld, 72 * 60 + 59, 2);
  const z = opId(berekenZones(2100, 4200));
  bijna(z.tempo10.van, 8.6);   // 70:00 op 10 km
  bijna(z.tempo5.van, 8.9);    // bijbehorende 5 km ≈ 33:35
  bijna(z.rustig.van, 6.9); bijna(z.rustig.tot, 7.3);
  assert.ok(z.uitwandelen.van < z.uitjoggen.van);
});

test('doeltijd langzamer dan voorspeld is haalbaar, veel sneller is te snel', () => {
  assert.equal(beoordeelDoeltijd(2100, 75 * 60).niveau, 'haalbaar');
  assert.equal(beoordeelDoeltijd(2100, 65 * 60).niveau, 'te-snel');
});

test('bij een te snel doel worden de snelheden begrensd op 5%', () => {
  const begrensd = opId(berekenZones(2100, 60 * 60));
  const maximaal = opId(berekenZones(2100, voorspelTijd(2100, 5, 10) * 0.95));
  assert.equal(begrensd.tempo10.van, maximaal.tempo10.van);
});

test('zonder doeltijd stelt de app een tijd voor', () => {
  const b = beoordeelDoeltijd(2100, null);
  assert.equal(b.niveau, 'geen');
  assert.equal(b.voorstel % 30, 0);
  assert.ok(b.voorstel < b.voorspeld && b.voorstel > b.voorspeld * 0.95);
});

test('elke zone heeft een oplopende of gelijke snelheid en tempo klopt', () => {
  for (const z of berekenZones(2100, 4200)) {
    assert.ok(z.tot >= z.van, z.id);
    bijna(tempoPerKm(z.van) * z.van, 3600, 1e-6);
  }
});

test('eigen snelheden gaan voor de berekende', () => {
  const z = opId(berekenZones(2100, 4200, { rustig: 8.5, tempo5: 9.2 }));
  assert.equal(z.rustig.van, 8.5); assert.equal(z.rustig.tot, 8.5); assert.equal(z.rustig.eigen, true);
  assert.equal(z.tempo5.van, 9.2);
  assert.equal(z.tempo10.van, 8.6); // niet ingevuld: berekend
  assert.equal(z.tempo10.eigen, undefined);
});

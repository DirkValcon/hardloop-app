import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maakSpeler, start, pauzeer, hervat, overslaan, toestand } from '../js/speler.js';

const blokken = [
  { soort: 'warmup', duurSec: 60 },
  { soort: 'interval', duurSec: 30 },
  { soort: 'herstel', duurSec: 20 },
];
const T0 = 1_000_000;
const sec = (s) => T0 + s * 1000;

test('blokken volgen elkaar op met de juiste resttijd', () => {
  const s = start(maakSpeler(blokken), T0);
  assert.equal(toestand(s, sec(0)).index, 0);
  assert.equal(toestand(s, sec(15)).restBlokMs, 45000);
  assert.equal(toestand(s, sec(60)).index, 1);
  assert.equal(toestand(s, sec(95)).index, 2);
  assert.equal(toestand(s, sec(95)).restTotaalMs, 15000);
  assert.equal(toestand(s, sec(110)).klaar, true);
  assert.equal(toestand(s, sec(500)).klaar, true);
});

test('vooraankondiging in de laatste 10 seconden, niet bij het laatste blok', () => {
  const s = start(maakSpeler(blokken), T0);
  assert.equal(toestand(s, sec(49)).aankondigen, false);
  assert.equal(toestand(s, sec(50)).aankondigen, true);
  assert.equal(toestand(s, sec(50)).volgende.soort, 'interval');
  assert.equal(toestand(s, sec(105)).aankondigen, false);
});

test('pauze houdt de tijd vast', () => {
  let s = start(maakSpeler(blokken), T0);
  s = pauzeer(s, sec(10));
  assert.equal(toestand(s, sec(300)).verstrekenMs, 10000);
  assert.equal(toestand(s, sec(300)).gepauzeerd, true);
  s = hervat(s, sec(300));
  assert.equal(toestand(s, sec(305)).verstrekenMs, 15000);
  assert.equal(toestand(s, sec(305)).gepauzeerd, false);
});

test('overslaan springt naar het begin van het volgende blok', () => {
  let s = start(maakSpeler(blokken), T0);
  s = overslaan(s, sec(5));
  const t = toestand(s, sec(5));
  assert.equal(t.index, 1);
  assert.equal(t.restBlokMs, 30000);
  s = overslaan(s, sec(5));
  s = overslaan(s, sec(5));
  assert.equal(toestand(s, sec(5)).klaar, true);
});

test('afstand: snelheid maal tijd, per blok', async () => {
  const { afstand } = await import('../js/speler.js');
  const s = start(maakSpeler([{ soort: 'rustig', kmh: 9, duurSec: 400 }, { soort: 'interval', kmh: 12, duurSec: 60 }]), T0);
  assert.ok(Math.abs(afstand(s, 400_000) - 1) < 1e-9);          // 9 km/u × 400 s = 1 km
  assert.ok(Math.abs(toestand(s, sec(460)).afstandKm - 1.2) < 1e-9);
});

test('snelheid aanpassen: telt vanaf dat moment, en geldt voor alle blokken van die soort', async () => {
  const { pasSnelheidAan } = await import('../js/speler.js');
  const bl = [
    { soort: 'interval', kmh: 9, duurSec: 60 }, { soort: 'herstel', kmh: 7, duurSec: 60 }, { soort: 'interval', kmh: 9, duurSec: 60 },
  ];
  let s = start(maakSpeler(bl), T0);
  for (let i = 0; i < 3; i++) s = pasSnelheidAan(s, sec(30), 0.1);  // 9,0 → 9,3 halverwege blok 1
  assert.equal(toestand(s, sec(31)).kmh, 9.3);
  assert.equal(toestand(s, sec(70)).kmh, 7);                          // herstel ongemoeid
  assert.equal(toestand(s, sec(50)).volgendeKmh, 7);
  assert.equal(toestand(s, sec(130)).kmh, 9.3);                       // volgende interval ook
  // Afstand blok 1: 30 s op 9,0 + 30 s op 9,3.
  const verwacht = (9 / 3.6 * 30 + 9.3 / 3.6 * 30) / 1000;
  assert.ok(Math.abs(toestand(s, sec(60)).afstandKm - verwacht) < 1e-9);
  s = pasSnelheidAan(s, sec(70), -10);
  assert.equal(toestand(s, sec(71)).kmh, 1);                          // ondergrens
});

test('overgeslagen stuk telt niet mee voor de afstand; echte tijd loopt gewoon door', () => {
  let s = start(maakSpeler([{ soort: 'rustig', kmh: 9, duurSec: 400 }, { soort: 'rustig2', kmh: 9, duurSec: 400 }]), T0);
  s = overslaan(s, sec(100));
  const t = toestand(s, sec(200));
  assert.equal(t.index, 1);
  assert.equal(t.echtMs, 200_000);
  assert.ok(Math.abs(t.afstandKm - (9 / 3.6 * 200) / 1000) < 1e-9);
});

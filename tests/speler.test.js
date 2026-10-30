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

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { laadResultaten, markeerGedaan, markeerOvergeslagen, maakOngedaan, valideerResultaat, schatKcal } from '../js/resultaten.js';
import { kcalTraining, kcalTotVerstreken, afstandTotVerstreken } from '../js/calorieen.js';
import { maakPlan } from '../js/schema.js';
import { DIRK_PROFIEL } from './fixtures.js';

const opslag = () => ({ d: {}, getItem(k) { return this.d[k] ?? null; }, setItem(k, v) { this.d[k] = v; } });
const t = maakPlan(DIRK_PROFIEL, { vandaag: '2026-10-30' }).weken[0].trainingen[0];

test('gedaan opslaan en weer laden', () => {
  const o = opslag();
  markeerGedaan(o, t, { afstandKm: 5.62, duurMin: 49, kcal: 450 }, '2026-11-03');
  assert.deepEqual(laadResultaten(o)[t.id], {
    status: 'gedaan', datum: '2026-11-03', gepland: '2026-11-03', type: 'rustig', afstandKm: 5.62, duurSec: 2940, kcal: 450,
  });
});

test('overslaan en ongedaan maken', () => {
  const o = opslag();
  markeerOvergeslagen(o, t, '2026-11-04');
  assert.equal(laadResultaten(o)[t.id].status, 'overgeslagen');
  maakOngedaan(o, t.id);
  assert.equal(laadResultaten(o)[t.id], undefined);
});

test('validatie van afstand, duur en calorieën', () => {
  assert.deepEqual(valideerResultaat({ afstandKm: 5.6, duurMin: 49, kcal: 450 }), {});
  assert.deepEqual(Object.keys(valideerResultaat({ afstandKm: 0, duurMin: NaN, kcal: -1 })).sort(), ['afstandKm', 'duurMin', 'kcal']);
});

test('calorieschatting schaalt met de gelopen afstand', () => {
  const vol = kcalTraining(t, 80);
  assert.ok(Math.abs(schatKcal(t, t.afstandKm, 80) - vol) <= 1);
  assert.ok(schatKcal(t, t.afstandKm / 2, 80) < vol * 0.55);
});

test('deels gelopen: calorieën en afstand tot het stoppunt', () => {
  assert.equal(kcalTotVerstreken(t, 0, 80), 0);
  assert.ok(Math.abs(kcalTotVerstreken(t, t.duurSec, 80) - kcalTraining(t, 80)) <= 1);
  const half = kcalTotVerstreken(t, t.duurSec / 2, 80);
  assert.ok(half > 0 && half < kcalTraining(t, 80));
  assert.ok(Math.abs(afstandTotVerstreken(t, t.duurSec) - t.afstandKm) < 0.06);
});

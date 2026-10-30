import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vo2Netto, kcalBlok, kcalTraining } from '../js/calorieen.js';
import { maakPlan } from '../js/schema.js';
import { DIRK_PROFIEL } from './fixtures.js';

test('ACSM lopen: 10 km/u vlak ≈ 33,3 ml/kg/min netto', () => {
  assert.ok(Math.abs(vo2Netto(10, 0) - 33.33) < 0.01);
});

test('helling verhoogt het verbruik, wandelen telt de helling zwaarder', () => {
  assert.ok(vo2Netto(8, 4) > vo2Netto(8, 1));
  assert.ok(Math.abs(vo2Netto(5.5, 0, true) - 9.17) < 0.01);
});

test('ruwe vuistregel: hardlopen kost ongeveer 1 kcal per kg per km', () => {
  const kcal = kcalBlok({ soort: 'rustig', kmh: 10, helling: 0, duurSec: 3600 }, 80);
  assert.ok(kcal > 0.9 * 800 && kcal < 1.1 * 800, String(kcal));
});

test('zwaarder lichaam en meer helling geven meer calorieën voor dezelfde training', () => {
  const plan = maakPlan(DIRK_PROFIEL, { vandaag: '2026-10-30' });
  const t = plan.weken[0].trainingen[0];
  const basis = kcalTraining(t, 80);
  assert.ok(basis > 350 && basis < 550, String(basis));
  assert.ok(kcalTraining(t, 90) > basis);
  const steil = { ...t, blokken: t.blokken.map((b) => ({ ...b, helling: 4 })) };
  assert.ok(kcalTraining(steil, 80) > basis);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { berekenVoortgang } from '../js/voortgang.js';
import { maakPlan } from '../js/schema.js';
import { DIRK_PROFIEL as DIRK } from './fixtures.js';

const plan = maakPlan(DIRK, { vandaag: '2026-10-30' });
const resultaten = {
  'w1-rustig': { status: 'gedaan', afstandKm: 5.6, duurSec: 2940, kcal: 450, datum: '2026-11-03' },
  'w1-kwaliteit': { status: 'overgeslagen', datum: '2026-11-05' },
  'w1-lang': { status: 'gedaan', afstandKm: 6.8, duurSec: 3500, kcal: 560, datum: '2026-11-08' },
  'w2-rustig': { status: 'gedaan', afstandKm: 6.1, duurSec: 3200, kcal: 500, datum: '2026-11-10' },
};

test('totalen per week kloppen met de afgevinkte trainingen', () => {
  const v = berekenVoortgang(plan, resultaten, DIRK, '2026-11-11');
  assert.deepEqual(v.perWeek[0], { label: 'W1', maandag: '2026-11-02', km: 12.4, kcal: 1010, geplandKm: v.perWeek[0].geplandKm, gedaan: 2, aantal: 3 });
  assert.equal(v.perWeek[1].km, 6.1);
  assert.equal(v.perWeek[2].km, 0);
  assert.equal(v.totaalKm, 18.5);
  assert.equal(v.totaalKcal, 1510);
  assert.equal(v.gedaan, 3);
  assert.equal(v.overgeslagen, 1);
  assert.equal(v.totaal, 33);
});

test('langste loop, voorspelling en weken tot de doeldatum', () => {
  const v = berekenVoortgang(plan, resultaten, DIRK, '2026-11-11');
  assert.deepEqual(v.langste, { naam: 'Lange duurloop 5 km', afstandKm: 6.8, datum: '2026-11-08' });
  assert.ok(Math.abs(v.voorspeld10km - 4378) < 3);
  assert.equal(v.dagenTotDoel, 67);
  assert.equal(v.wekenTotDoel, 10);
});

test('zonder resultaten is alles nul', () => {
  const v = berekenVoortgang(plan, {}, DIRK, '2026-10-30');
  assert.equal(v.totaalKm, 0);
  assert.equal(v.langste, null);
});

test('statistieken: per maand, deze week, deze maand en gemiddeld tempo op de echte loopdag', () => {
  const r = {
    ...resultaten,
    'w4-lang': { status: 'gedaan', afstandKm: 5.4, duurSec: 2520, kcal: 430, datum: '2026-10-31' }, // eerder gelopen
  };
  const v = berekenVoortgang(plan, r, DIRK, '2026-11-11');
  assert.deepEqual(v.perMaand.map((m) => [m.label, m.km, m.aantal]), [['oktober 2026', 5.4, 1], ['november 2026', 18.5, 3]]);
  assert.equal(v.kmDezeWeek, 6.1);   // week van 9 nov
  assert.equal(v.kmDezeMaand, 18.5);
  assert.deepEqual(v.gelopen.map((g) => g.datum), ['2026-11-10', '2026-11-08', '2026-11-03', '2026-10-31']);
  assert.equal(v.gelopen[0].naam, 'Rustige duurloop 4,5 km');
  assert.ok(Math.abs(v.gemiddeldTempo - (2940 + 3500 + 3200 + 2520) / 23.9) < 1e-6);
  assert.equal(berekenVoortgang(plan, {}, DIRK, '2026-11-11').gemiddeldTempo, null);
});

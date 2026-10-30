import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wijzigProfiel, valideerWijziging, effectiefProfiel } from '../js/instellingen.js';
import { maakPlan } from '../js/schema.js';
import { DIRK_PROFIEL as DIRK } from './fixtures.js';

const invoer = (over = {}) => ({
  vijfKmTijd: '35:00', doelTijd: '70:00', doelDatum: DIRK.doelDatum, extraWekenKeuze: null,
  trainingsdagen: ['di', 'do', 'zo'], gewicht: '80', helling: '1', ...over,
});
const VANDAAG = '2026-11-11'; // woensdag in week 2 (week 1 = 2 nov)
const week = (p, n) => p.weken[n - 1];

test('niets gewijzigd: schema blijft precies gelijk', () => {
  const p = wijzigProfiel(DIRK, invoer(), VANDAAG);
  assert.deepEqual(maakPlan(p, { vandaag: VANDAAG }).weken, maakPlan(DIRK, { vandaag: VANDAAG }).weken);
});

test('nieuwe standaarddagen gelden pas vanaf volgende week', () => {
  const p = wijzigProfiel(DIRK, invoer({ trainingsdagen: ['ma', 'wo', 'vr', 'zo'] }), VANDAAG);
  const oud = maakPlan(DIRK, { vandaag: VANDAAG });
  const nieuw = maakPlan(p, { vandaag: VANDAAG });
  assert.deepEqual(week(nieuw, 1).trainingen, week(oud, 1).trainingen);
  assert.deepEqual(week(nieuw, 2).trainingen, week(oud, 2).trainingen);
  assert.deepEqual(week(nieuw, 3).trainingen.map((t) => t.dag), ['ma', 'wo', 'vr', 'zo']);
  assert.deepEqual(effectiefProfiel(p, VANDAAG).trainingsdagen, ['di', 'do', 'zo']);
});

test('nieuwe 5 km-tijd geldt vanaf deze week; eerdere weken houden hun snelheden', () => {
  const p = wijzigProfiel(DIRK, invoer({ vijfKmTijd: '33:00' }), VANDAAG);
  const oud = maakPlan(DIRK, { vandaag: VANDAAG });
  const nieuw = maakPlan(p, { vandaag: VANDAAG });
  assert.deepEqual(week(nieuw, 1).trainingen, week(oud, 1).trainingen);
  const rustig = (pl, n) => week(pl, n).trainingen[0].blokken.find((b) => b.soort === 'rustig').kmh;
  assert.ok(rustig(nieuw, 2) > rustig(oud, 2));
  assert.equal(effectiefProfiel(p, VANDAAG).vijfKmSeconden, 1980);
});

test('trainingen houden hun id, dus afgevinkte resultaten blijven gekoppeld', () => {
  const p = wijzigProfiel(DIRK, invoer({ vijfKmTijd: '33:00', helling: '2' }), VANDAAG);
  const ids = (pl) => pl.weken.slice(0, 2).flatMap((w) => w.trainingen.map((t) => t.id));
  assert.deepEqual(ids(maakPlan(p, { vandaag: VANDAAG })), ids(maakPlan(DIRK, { vandaag: VANDAAG })));
});

test('twee keer wijzigen in dezelfde week overschrijft de eerste wijziging', () => {
  let p = wijzigProfiel(DIRK, invoer({ helling: '2' }), VANDAAG);
  p = wijzigProfiel(p, invoer({ helling: '1.5' }), VANDAAG);
  assert.equal(p.historie.length, 1);
  assert.equal(effectiefProfiel(p, VANDAAG).helling, 1.5);
});

test('vóór de start van het schema gaat alles direct in het profiel', () => {
  const p = wijzigProfiel(DIRK, invoer({ trainingsdagen: ['ma', 'wo', 'za'] }), '2026-10-30');
  assert.deepEqual(p.historie, []);
  assert.deepEqual(p.trainingsdagen, ['ma', 'wo', 'za']);
});

test('gewicht geldt meteen; doeldatum alleen gecontroleerd als hij verandert', () => {
  const p = wijzigProfiel(DIRK, invoer({ gewicht: '78' }), VANDAAG);
  assert.equal(p.gewicht, 78);
  assert.deepEqual(valideerWijziging(DIRK, invoer(), VANDAAG), {}); // doeldatum < 11 weken, maar ongewijzigd
  assert.ok(valideerWijziging(DIRK, invoer({ doelDatum: '2027-01-24' }), VANDAAG).doelDatum);
  assert.ok(valideerWijziging(DIRK, invoer({ trainingsdagen: ['ma'] }), VANDAAG).trainingsdagen);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { valideerProfiel, valideerStap, laadProfiel, bewaarProfiel, extraWeken, vroegsteDoeldatum } from '../js/profiel.js';

const VANDAAG = '2026-10-30';
const geldig = {
  vijfKmTijd: '35:00', doelAfstand: 10, doelTijd: '70:00', doelDatum: '2027-01-15',
  extraWekenKeuze: null, trainingsdagen: ['zo', 'di', 'do'], gewicht: '80', helling: '1',
};

class GeheugenOpslag {
  #data = new Map();
  getItem(k) { return this.#data.has(k) ? this.#data.get(k) : null; }
  setItem(k, v) { this.#data.set(k, String(v)); }
}

test('geldig profiel van Dirk wordt geaccepteerd en genormaliseerd', () => {
  const r = valideerProfiel(geldig, VANDAAG);
  assert.equal(r.ok, true, JSON.stringify(r.fouten));
  assert.equal(r.profiel.vijfKmSeconden, 2100);
  assert.equal(r.profiel.doelSeconden, 4200);
  assert.deepEqual(r.profiel.trainingsdagen, ['di', 'do', 'zo']); // in weekvolgorde
  assert.equal(r.profiel.gewicht, 80);
  assert.equal(r.profiel.helling, 1);
});

test('doeltijd is optioneel', () => {
  const r = valideerProfiel({ ...geldig, doelTijd: '' }, VANDAAG);
  assert.equal(r.ok, true);
  assert.equal(r.profiel.doelSeconden, null);
});

test('5 km-tijd moet mm:ss zijn en realistisch', () => {
  for (const t of ['', '35', 'snel', '35:99', '9:00', '75:00']) {
    assert.ok(valideerStap(0, { ...geldig, vijfKmTijd: t }, VANDAAG).vijfKmTijd, t);
  }
});

test('minder dan 3 of meer dan 5 dagen wordt geweigerd', () => {
  assert.ok(valideerStap(3, { ...geldig, trainingsdagen: ['ma', 'wo'] }, VANDAAG).trainingsdagen);
  assert.ok(valideerStap(3, { ...geldig, trainingsdagen: ['ma', 'di', 'wo', 'do', 'vr', 'za'] }, VANDAAG).trainingsdagen);
  for (const n of [3, 4, 5]) {
    const dagen = ['ma', 'di', 'wo', 'do', 'vr'].slice(0, n);
    assert.deepEqual(valideerStap(3, { ...geldig, trainingsdagen: dagen }, VANDAAG), {});
  }
});

test('doeldatum moet minstens 11 weken vooruit liggen', () => {
  assert.equal(vroegsteDoeldatum(VANDAAG), '2027-01-15');
  assert.ok(valideerStap(2, { ...geldig, doelDatum: '2027-01-14' }, VANDAAG).doelDatum);
  assert.deepEqual(valideerStap(2, { ...geldig, doelDatum: '2027-01-15' }, VANDAAG), {});
  assert.ok(valideerStap(2, { ...geldig, doelDatum: '' }, VANDAAG).doelDatum);
});

test('bij extra weken moet je kiezen tussen later starten en basisweken', () => {
  assert.equal(extraWeken(VANDAAG, '2027-01-21'), 0);
  assert.equal(extraWeken(VANDAAG, '2027-01-22'), 1);
  assert.equal(extraWeken(VANDAAG, '2027-03-05'), 7);
  const ver = { ...geldig, doelDatum: '2027-03-05' };
  assert.ok(valideerStap(2, ver, VANDAAG).extraWekenKeuze);
  const r = valideerProfiel({ ...ver, extraWekenKeuze: 'basis' }, VANDAAG);
  assert.equal(r.ok, true);
  assert.equal(r.profiel.extraWeken, 7);
  assert.equal(r.profiel.extraWekenKeuze, 'basis');
});

test('gewicht en helling binnen grenzen', () => {
  assert.ok(valideerStap(4, { ...geldig, gewicht: '' }, VANDAAG).gewicht);
  assert.ok(valideerStap(4, { ...geldig, gewicht: '20' }, VANDAAG).gewicht);
  assert.ok(valideerStap(4, { ...geldig, helling: '-1' }, VANDAAG).helling);
  assert.ok(valideerStap(4, { ...geldig, helling: '16' }, VANDAAG).helling);
  assert.deepEqual(valideerStap(4, { ...geldig, helling: '0' }, VANDAAG), {});
});

test('profiel blijft bewaard na opslaan en laden', () => {
  const opslag = new GeheugenOpslag();
  assert.equal(laadProfiel(opslag), null);
  const { profiel } = valideerProfiel(geldig, VANDAAG);
  bewaarProfiel(opslag, profiel);
  assert.deepEqual(laadProfiel(opslag), profiel);
});

test('kapotte opslag geeft geen crash', () => {
  const opslag = new GeheugenOpslag();
  opslag.setItem('hardloop-app.profiel.v1', '{kapot');
  assert.equal(laadProfiel(opslag), null);
});

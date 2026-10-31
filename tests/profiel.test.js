import { test } from 'node:test';
import assert from 'node:assert/strict';
import { valideerProfiel, valideerStap, laadProfiel, bewaarProfiel, extraWeken, vroegsteDoeldatum } from '../js/profiel.js';

const VANDAAG = '2026-10-30';
const geldig = {
  maxKm: '5', tempo: '7:00', doelAfstand: 10, doelTijd: '70:00', weken: '11', doelDatum: '2027-01-08',
  extraWekenKeuze: null, trainingsdagen: ['zo', 'di', 'do'], gewicht: '80', helling: '1',
};

class GeheugenOpslag {
  #data = new Map();
  getItem(k) { return this.#data.has(k) ? this.#data.get(k) : null; }
  setItem(k, v) { this.#data.set(k, String(v)); }
}

test('geldig profiel van Dirk wordt geaccepteerd en genormaliseerd', () => {
  const r = valideerProfiel(geldig, VANDAAG, { schemaId: 'sx' });
  assert.equal(r.ok, true, JSON.stringify(r.fouten));
  assert.deepEqual(r.profiel.schema, { id: 'sx', doelKm: 10, maxKm: 5, tempoSecPerKm: 420, weken: 11 });
  assert.equal(r.profiel.vijfKmSeconden, 2100); // 5 km in 7:00/km
  assert.equal(r.profiel.doelSeconden, 4200);
  assert.equal(r.profiel.doelAfstandSeconden, 4200);
  assert.deepEqual(r.profiel.trainingsdagen, ['di', 'do', 'zo']); // in weekvolgorde
  assert.equal(r.profiel.gewicht, 80);
  assert.equal(r.profiel.helling, 1);
});

test('doeltijd is optioneel', () => {
  const r = valideerProfiel({ ...geldig, doelTijd: '' }, VANDAAG);
  assert.equal(r.ok, true);
  assert.equal(r.profiel.doelSeconden, null);
  assert.equal(r.profiel.doelAfstandSeconden, null);
});

test('halve marathon: doeltijd wordt omgerekend naar 10 km voor de snelheden', () => {
  const r = valideerProfiel({ ...geldig, doelAfstand: '21.1', doelTijd: '2:30:00', weken: '12', doelDatum: '2027-01-15' }, VANDAAG);
  assert.equal(r.ok, true, JSON.stringify(r.fouten));
  assert.equal(r.profiel.doelAfstand, 21.1);
  assert.equal(r.profiel.doelAfstandSeconden, 9000);
  assert.ok(r.profiel.doelSeconden > 4000 && r.profiel.doelSeconden < 4300);
  assert.match(valideerStap(1, { ...geldig, doelAfstand: '21.1', doelTijd: '50:00' }, VANDAAG).doelTijd, /Halve marathon-doeltijd ligt tussen 53:00 en 4:13:00/);
});

test('huidig niveau: afstand en tempo moeten kloppen', () => {
  for (const km of ['', 'ver', '0,5', '60']) assert.ok(valideerStap(0, { ...geldig, maxKm: km }, VANDAAG).maxKm, km);
  assert.deepEqual(valideerStap(0, { ...geldig, maxKm: '7,5' }, VANDAAG), {});
  for (const t of ['', '7', 'snel', '7:99', '2:00', '16:00']) {
    assert.ok(valideerStap(0, { ...geldig, tempo: t }, VANDAAG).tempo, t);
  }
});

test('aantal weken tussen 4 en 52', () => {
  for (const w of ['', '3', '53', '8,5']) assert.ok(valideerStap(2, { ...geldig, weken: w }, VANDAAG).weken, w);
  assert.equal(valideerStap(2, { ...geldig, weken: '8', doelDatum: '2026-12-25' }, VANDAAG).weken, undefined);
});

test('minder dan 3 of meer dan 5 dagen wordt geweigerd', () => {
  assert.ok(valideerStap(3, { ...geldig, trainingsdagen: ['ma', 'wo'] }, VANDAAG).trainingsdagen);
  assert.ok(valideerStap(3, { ...geldig, trainingsdagen: ['ma', 'di', 'wo', 'do', 'vr', 'za'] }, VANDAAG).trainingsdagen);
  for (const n of [3, 4, 5]) {
    const dagen = ['ma', 'di', 'wo', 'do', 'vr'].slice(0, n);
    assert.deepEqual(valideerStap(3, { ...geldig, trainingsdagen: dagen }, VANDAAG), {});
  }
});

test('doeldatum: het schema mag deze week beginnen, niet eerder', () => {
  // Vrijdag 30 okt: week 1 = 26 okt t/m 1 nov, week 11 = 4 t/m 10 jan.
  assert.equal(vroegsteDoeldatum(VANDAAG), '2027-01-08');
  assert.ok(valideerStap(2, { ...geldig, doelDatum: '2027-01-03' }, VANDAAG).doelDatum);
  assert.deepEqual(valideerStap(2, { ...geldig, doelDatum: '2027-01-04' }, VANDAAG), {});
  assert.deepEqual(valideerStap(2, { ...geldig, doelDatum: '2027-01-10' }, VANDAAG), {});
  assert.ok(valideerStap(2, { ...geldig, doelDatum: '' }, VANDAAG).doelDatum);
});

test('bij extra weken moet je kiezen tussen later starten en basisweken', () => {
  assert.equal(extraWeken(VANDAAG, '2027-01-10'), 0); // begint deze week
  assert.equal(extraWeken(VANDAAG, '2027-01-11'), 1); // begint volgende week
  assert.equal(extraWeken(VANDAAG, '2027-01-17'), 1);
  assert.equal(extraWeken(VANDAAG, '2027-03-05'), 8);
  const ver = { ...geldig, doelDatum: '2027-03-05' };
  assert.ok(valideerStap(2, ver, VANDAAG).extraWekenKeuze);
  const r = valideerProfiel({ ...ver, extraWekenKeuze: 'basis' }, VANDAAG);
  assert.equal(r.ok, true);
  assert.equal(r.profiel.extraWeken, 8);
  assert.equal(r.profiel.extraWekenKeuze, 'basis');
  assert.equal(r.profiel.basisVanaf, '2026-10-26');
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
  const { profiel } = valideerProfiel(geldig, VANDAAG, { schemaId: 'sx' });
  bewaarProfiel(opslag, profiel);
  assert.deepEqual(laadProfiel(opslag), profiel);
});

test('kapotte opslag geeft geen crash', () => {
  const opslag = new GeheugenOpslag();
  opslag.setItem('hardloop-app.profiel.v1', '{kapot');
  assert.equal(laadProfiel(opslag), null);
});

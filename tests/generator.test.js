import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DOELAFSTANDEN, adviesWeken, beoordeelWeken, genereerSjabloon, vijfKmUitNiveau, tienKmUitDoel, MAX_GROEI,
} from '../js/generator.js';
import { maakPlan } from '../js/schema.js';
import { DIRK_PROFIEL } from './fixtures.js';

const NIVEAUS = [2, 3, 5, 8, 10, 15, 21.1];

// Toegestane stap: 10% of minimaal 0,5 km, plus afronding op halve km.
const magGroeien = (van, naar) => naar - van <= Math.max(0.5, van * MAX_GROEI) + 0.25;

for (const d of DOELAFSTANDEN) {
  for (const maxKm of NIVEAUS) {
    test(`${d.naam} vanaf ${maxKm} km: advies volgt de 10%-regel`, () => {
      const weken = adviesWeken(d.km, maxKm);
      assert.ok(weken >= d.minWeken, 'minstens het minimum');
      const s = genereerSjabloon({ doelKm: d.km, maxKm, weken });
      assert.equal(s.lang.length, weken);
      assert.equal(s.lang.at(-1), null, 'laatste week: de wedstrijd');
      assert.equal(Math.max(...s.lang.filter(Boolean)), Math.max(d.piekLang, Math.min(d.piekLang, maxKm)), 'piek gehaald');
      // Geen enkele week groeit de lange loop meer dan toegestaan.
      let langste = 0;
      for (const km of s.lang.filter(Boolean)) {
        if (langste) assert.ok(magGroeien(langste, km), `${langste} → ${km}`);
        langste = Math.max(langste, km);
      }
      assert.equal(beoordeelWeken(d.km, maxKm, weken).teKort, false);
      assert.equal(s.kwaliteit.length, weken);
      assert.ok(s.rustig.every((km) => km >= 3));
    });
  }
}

test('te weinig weken: waarschuwing met advies', () => {
  const b = beoordeelWeken(21.1, 5, 8);
  assert.equal(b.teKort, true);
  assert.ok(b.advies > 8);
  assert.ok(b.maxGroei > MAX_GROEI);
});

test('herstelweken: lange loop korter dan de week ervoor', () => {
  const s = genereerSjabloon({ doelKm: 10, maxKm: 5, weken: 12 });
  assert.deepEqual(s.herstelweken, [4, 8]);
  for (const w of s.herstelweken) assert.ok(s.lang[w - 1] < s.lang[w - 2]);
});

test('marathon heeft twee taperweken', () => {
  const s = genereerSjabloon({ doelKm: 42.2, maxKm: 15, weken: 18 });
  assert.deepEqual(s.taperweken, [16, 17]);
  assert.ok(s.lang[15] < 32 && s.lang[16] < s.lang[15]);
});

test('niveau omrekenen: 5 km in 7:00/km is 35:00', () => {
  assert.equal(vijfKmUitNiveau(5, 420), 2100);
  assert.ok(vijfKmUitNiveau(3, 420) > 2100, 'korter maximum: op 5 km iets langzamer per km voorspeld');
  assert.equal(tienKmUitDoel(10, 4200), 4200);
  assert.equal(tienKmUitDoel(10, null), null);
});

test('maakPlan met gegenereerd schema: halve marathon eindigt op de doeldatum', () => {
  const sjabloon = genereerSjabloon({ doelKm: 21.1, maxKm: 10, weken: 12 });
  const profiel = { ...DIRK_PROFIEL, doelDatum: '2027-01-24', doelAfstandSeconden: 2 * 3600 + 30 * 60 };
  const plan = maakPlan(profiel, { sjabloon, vandaag: '2026-10-30' });
  assert.equal(plan.weken.length, 12);
  const laatste = plan.weken.at(-1).trainingen.at(-1);
  assert.equal(laatste.id, 'w12-doel');
  assert.equal(laatste.datum, '2027-01-24');
  assert.equal(laatste.naam, '21,1 km op doeltijd');
  const kern = laatste.blokken.find((b) => b.label === '21,1 km');
  assert.equal(kern.afstandM, 21100);
  assert.equal(plan.weken[10].soort, 'taper');
  assert.equal(plan.weken[3].soort, 'herstel');
});

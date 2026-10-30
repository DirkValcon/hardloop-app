import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uitspraak, kilometerTekst } from '../js/loopscherm.js';

test('aankondiging zegt wat je moet doen: afstand of duur, snelheid en helling', () => {
  assert.equal(uitspraak({ label: '5 km-tempo', herhaling: 2, van: 6, afstandM: 400, duurSec: 162, kmh: 8.9, helling: 1 }),
    '5 km-tempo 2 van 6: 400 meter op 8 komma 9 kilometer per uur, helling 1 procent');
  assert.equal(uitspraak({ label: 'Herstel', duurSec: 90, kmh: 6.9, helling: 1 }),
    'Herstel: 1 minuut 30 seconden op 6 komma 9 kilometer per uur, helling 1 procent');
  assert.equal(uitspraak({ label: 'Uitwandelen', duurSec: 120, kmh: 5.5, helling: 0 }),
    'Uitwandelen: 2 minuten op 5 komma 5 kilometer per uur, helling op nul');
  assert.equal(uitspraak({ label: '10 km-tempo', herhaling: 1, van: 4, afstandM: 1000, duurSec: 419, kmh: 8.6, helling: 1 }, 9.2),
    '10 km-tempo 1 van 4: 1 kilometer op 9 komma 2 kilometer per uur, helling 1 procent');
});

test('kilometertijd', () => {
  assert.equal(kilometerTekst(3, 422), 'Kilometer 3. 7 minuten 2 seconden.');
  assert.equal(kilometerTekst(1, 420), 'Kilometer 1. 7 minuten.');
});

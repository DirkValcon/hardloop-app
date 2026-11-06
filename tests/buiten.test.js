import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  afstandTussen, maakSpoor, voegPositieToe, onderbreek, meterOp, tijdOp, tempoNu, tempoOordeel,
  toestandBuiten, overslaanBuiten, laadWaar, bewaarWaar,
} from '../js/buiten.js';
import { maakSpeler, start, pauzeer, hervat } from '../js/speler.js';
import { uitspraakBuiten, spreekTempo, tempoSeintje } from '../js/loopscherm.js';

const M_PER_GRAAD = 111_195; // meter per graad breedte
const punt = (meters, nauwkeurig = 5) => ({ lat: 52 + meters / M_PER_GRAAD, lon: 5, nauwkeurig });

// Recht naar het noorden op `kmh`, elke seconde een punt, vanaf looptijd `vanMs`.
function loop(spoor, { kmh, sec, vanMs = 0, vanM = 0 }) {
  let s = spoor;
  for (let i = 0; i <= sec; i++) s = voegPositieToe(s, punt(vanM + (kmh / 3.6) * i), vanMs + i * 1000);
  return s;
}

test('afstand tussen twee punten klopt', () => {
  assert.ok(Math.abs(afstandTussen(punt(0), punt(1000)) - 1000) < 1);
});

test('spoor telt meters en tempo van de laatste 30 seconden', () => {
  const s = loop(maakSpoor(), { kmh: 8.5, sec: 120 });
  assert.ok(Math.abs(s.m - (8.5 / 3.6) * 120) < 6, `meters ${s.m}`);
  const tempo = tempoNu(s, 120_000);
  assert.ok(Math.abs(tempo - 3600 / 8.5) < 15, `tempo ${tempo}`);
  assert.ok(Math.abs(meterOp(s, 60_000) - (8.5 / 3.6) * 60) < 6);
  assert.ok(Math.abs(tijdOp(s, 100) - (100 / (8.5 / 3.6)) * 1000) < 2500);
  assert.equal(tijdOp(s, 10_000), null);
});

test('onnauwkeurige punten, stilstaan en GPS-sprongen tellen niet', () => {
  let s = voegPositieToe(maakSpoor(), punt(0), 0);
  s = voegPositieToe(s, punt(500, 80), 1000); // te onnauwkeurig
  s = voegPositieToe(s, punt(2), 2000); // ruis bij stilstaan
  s = voegPositieToe(s, punt(300), 3000); // 300 m in 3 s: sprong
  assert.equal(s.m, 0);
  // Stilstaan geeft geen tempo.
  assert.equal(tempoNu(s, 30_000), null);
});

test('scherm even uit: het stuk ertussen telt als rechte lijn', () => {
  let s = loop(maakSpoor(), { kmh: 9, sec: 60 });
  const voor = s.m;
  s = voegPositieToe(s, punt(voor + 250), 160_000); // 100 s later, 250 m verder
  assert.ok(Math.abs(s.m - voor - 250) < 1);
});

test('na een pauze telt de weg tijdens de pauze niet', () => {
  let s = loop(maakSpoor(), { kmh: 9, sec: 30 });
  const voor = s.m;
  s = onderbreek(s);
  s = voegPositieToe(s, punt(voor + 400), 31_000); // 400 m verder gewandeld in de pauze
  assert.ok(Math.abs(s.m - voor) < 0.01);
  s = voegPositieToe(s, punt(voor + 420), 39_000);
  assert.ok(Math.abs(s.m - voor - 20) < 1);
});

test('te snel of te langzaam: pas bij meer dan 15 s/km verschil', () => {
  assert.equal(tempoOordeel(424, 424), 'goed');
  assert.equal(tempoOordeel(410, 424), 'goed');
  assert.equal(tempoOordeel(400, 424), 'te-snel');
  assert.equal(tempoOordeel(445, 424), 'te-langzaam');
  assert.equal(tempoOordeel(null, 424), null);
});

const BLOKKEN = [
  { soort: 'warmup', label: 'Warming-up', kmh: 7, duurSec: 60, helling: 0 },
  { soort: 'interval', label: 'Interval', kmh: 10, duurSec: 144, afstandM: 400, helling: 0 },
  { soort: 'uitjoggen', label: 'Uitjoggen', kmh: 7, duurSec: 60, helling: 0 },
];

test('tijdblok op tijd, afstandsblok op GPS-afstand', () => {
  let s = { ...start(maakSpeler(BLOKKEN), 0), spoor: maakSpoor(), sprongen: [] };
  s.spoor = loop(s.spoor, { kmh: 7, sec: 60 });
  const na1 = (7 / 3.6) * 60;
  let t = toestandBuiten(s, 30_000);
  assert.equal(t.index, 0);
  assert.equal(Math.round(t.restBlokMs / 1000), 30);
  assert.equal(t.restBlokM, null);

  // Interval: 400 m op 12 km/u (sneller dan 10) duurt 120 s in plaats van 144.
  s.spoor = loop(s.spoor, { kmh: 12, sec: 100, vanMs: 61_000, vanM: na1 + 2 });
  t = toestandBuiten(s, 161_000);
  assert.equal(t.index, 1);
  assert.ok(t.restBlokM > 50 && t.restBlokM < 90, `rest ${t.restBlokM}`);
  assert.ok(Math.abs(t.tempoNu - 300) < 15, `tempo ${t.tempoNu}`);
  assert.equal(t.doelTempo, 360);
  assert.ok(t.aankondigen === false);
  s.spoor = loop(s.spoor, { kmh: 12, sec: 30, vanMs: 162_000, vanM: s.spoor.m + 3 });
  t = toestandBuiten(s, 192_000);
  assert.equal(t.index, 2, 'interval klaar na 400 m');
  assert.ok(t.blokMs > 5_000 && t.blokMs < 15_000, `blokMs ${t.blokMs}`);
});

test('afstandsblok: aankondiging als je op je tempo minder dan 10 s nodig hebt', () => {
  let s = { ...start(maakSpeler(BLOKKEN.slice(1)), 0), spoor: maakSpoor(), sprongen: [] };
  s.spoor = loop(s.spoor, { kmh: 10, sec: 136 });
  const t = toestandBuiten(s, 136_000);
  assert.equal(t.index, 0);
  assert.ok(t.restBlokM < 30);
  assert.equal(t.aankondigen, true);
});

test('overslaan en extra tijd na het laatste blok', () => {
  let s = { ...start(maakSpeler(BLOKKEN), 0), spoor: maakSpoor(), sprongen: [] };
  s = overslaanBuiten(s, 10_000);
  assert.equal(toestandBuiten(s, 10_000).index, 1);
  s = overslaanBuiten(s, 20_000);
  assert.equal(toestandBuiten(s, 20_000).index, 2);
  const t = toestandBuiten(s, 90_000);
  assert.equal(t.extra, true);
  assert.equal(t.extraMs, 10_000);
  assert.equal(overslaanBuiten(s, 90_000), s);
});

test('pauze houdt de looptijd vast', () => {
  let s = { ...start(maakSpeler(BLOKKEN), 0), spoor: maakSpoor(), sprongen: [] };
  s = pauzeer(s, 20_000);
  assert.equal(toestandBuiten(s, 50_000).echtMs, 20_000);
  s = hervat(s, 50_000);
  assert.equal(toestandBuiten(s, 60_000).echtMs, 30_000);
});

test('binnen of buiten wordt onthouden', () => {
  const opslag = new Map();
  const o = { getItem: (k) => opslag.get(k) ?? null, setItem: (k, v) => opslag.set(k, v) };
  assert.equal(laadWaar(o), 'binnen');
  bewaarWaar(o, 'buiten');
  assert.equal(laadWaar(o), 'buiten');
});

test('buiten zegt de app je tempo in minuten per kilometer', () => {
  assert.equal(spreekTempo(424), '7 minuten 4 per kilometer');
  assert.equal(spreekTempo(360), '6 minuten per kilometer');
  assert.equal(uitspraakBuiten({ ...BLOKKEN[1], herhaling: 2, van: 6 }), 'Interval 2 van 6: 400 meter, hard, tempo 6 minuten per kilometer');
  assert.equal(tempoSeintje('te-snel', 330, 360), 'Iets rustiger. Je loopt 5 minuten 30 per kilometer, je doel is 6 minuten per kilometer.');
  assert.equal(tempoSeintje('te-langzaam', 400, 360), 'Iets sneller. Je loopt 6 minuten 40 per kilometer, je doel is 6 minuten per kilometer.');
});

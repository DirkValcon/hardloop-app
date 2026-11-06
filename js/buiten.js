// Buiten lopen: afstand en tempo uit de GPS van de telefoon.
//
// Het spoor houdt bij hoeveel meter je gelopen hebt op welk moment van je echte looptijd (zonder
// pauzes). Daaruit volgen je tempo van de laatste 30 seconden, je kilometertijden en wanneer een
// afstandsblok (bijvoorbeeld 400 m) klaar is. Tijdblokken blijven gewoon op tijd.
//
// GPS is onrustig: punten met een slechte nauwkeurigheid tellen niet, kleine verschuivingen
// (stilstaan) ook niet, en onmogelijke sprongen worden genegeerd. Gaat het scherm even uit, dan
// komt het volgende punt pas later binnen en telt het stuk ertussen als een rechte lijn.
import { echteTijd } from './speler.js';
import { tempoPerKm } from './zones.js';
import { VOORAANKONDIGING_SEC } from './speler.js';

export const OPSLAG_WAAR = 'hardloop-app.waar.v1';
export const MAX_ONNAUWKEURIG_M = 30; // slechter dan dit: punt negeren
export const MIN_STAP_M = 5; // kleinere verschuivingen zijn ruis (bij stilstaan)
export const MAX_KMH = 30; // sneller dan dit tussen twee punten is een GPS-sprong
export const TEMPO_VENSTER_MS = 30_000;
export const AFWIJKING_SEC = 15; // zoveel s/km naast je doeltempo telt als te snel of te langzaam
export const AFWIJKING_DUUR_MS = 30_000; // zo lang moet het duren voor je een seintje krijgt
export const SEINTJE_OPNIEUW_MS = 60_000; // daarna hooguit eens per minuut opnieuw
export const GPS_KWIJT_MS = 10_000;

export function laadWaar(opslag) {
  try { return opslag.getItem(OPSLAG_WAAR) === 'buiten' ? 'buiten' : 'binnen'; } catch { return 'binnen'; }
}
export function bewaarWaar(opslag, waar) {
  try { opslag.setItem(OPSLAG_WAAR, waar); } catch { /* geen opslag */ }
}

// Afstand in meters tussen twee punten { lat, lon } (haversine).
export function afstandTussen(a, b) {
  const r = 6_371_000;
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

// punten: [echte looptijd in ms, meters tot dan], oplopend. anker: het laatste geaccepteerde punt.
export const maakSpoor = () => ({ m: 0, anker: null, punten: [], afgekeurd: 0 });

// Een nieuwe positie { lat, lon, nauwkeurig } op echte looptijd `ms`.
export function voegPositieToe(spoor, pos, ms) {
  if (!(pos.nauwkeurig <= MAX_ONNAUWKEURIG_M)) return spoor;
  const punt = { lat: pos.lat, lon: pos.lon, ms };
  if (!spoor.anker) {
    return { ...spoor, anker: punt, afgekeurd: 0, punten: [...spoor.punten, [Math.round(ms), Math.round(spoor.m)]] };
  }
  const d = afstandTussen(spoor.anker, punt);
  if (d < Math.max(MIN_STAP_M, Math.min(pos.nauwkeurig, 20) / 2)) return spoor;
  const sec = (ms - spoor.anker.ms) / 1000;
  if (sec <= 0 || (d / sec) * 3.6 > MAX_KMH) {
    // Blijft het "springen", dan zat het anker zelf fout: opnieuw beginnen vanaf hier, zonder afstand.
    if (spoor.afgekeurd + 1 >= 5) return { ...spoor, anker: punt, afgekeurd: 0 };
    return { ...spoor, afgekeurd: spoor.afgekeurd + 1 };
  }
  const m = spoor.m + d;
  return { m, anker: punt, afgekeurd: 0, punten: [...spoor.punten, [Math.round(ms), Math.round(m * 10) / 10]] };
}

// Na een pauze niet de weg tijdens de pauze meetellen: het volgende punt wordt een nieuw begin.
export const onderbreek = (spoor) => ({ ...spoor, anker: null, afgekeurd: 0 });

// Meters gelopen op looptijd `ms` (tussen twee punten naar verhouding).
export function meterOp(spoor, ms) {
  const p = spoor.punten;
  if (!p.length || ms <= p[0][0]) return p.length ? p[0][1] : 0;
  for (let i = 1; i < p.length; i++) {
    if (p[i][0] >= ms) {
      const [t0, m0] = p[i - 1];
      const [t1, m1] = p[i];
      return t1 === t0 ? m1 : m0 + ((m1 - m0) * (ms - t0)) / (t1 - t0);
    }
  }
  return p.at(-1)[1];
}

// Looptijd waarop je `meters` gelopen had, of null als je zo ver nog niet bent.
export function tijdOp(spoor, meters) {
  const p = spoor.punten;
  for (let i = 0; i < p.length; i++) {
    if (p[i][1] >= meters) {
      if (i === 0) return p[0][0];
      const [t0, m0] = p[i - 1];
      const [t1, m1] = p[i];
      return m1 === m0 ? t1 : t0 + ((t1 - t0) * (meters - m0)) / (m1 - m0);
    }
  }
  return null;
}

// Tempo (seconden per km) over de laatste 30 seconden, of null als er te weinig gemeten is.
export function tempoNu(spoor, ms, vanafMs = 0) {
  const p = spoor.punten;
  if (!p.length) return null;
  // Tot het laatste punt rekenen (dat is hooguit een paar seconden oud), anders lijkt je tempo
  // steeds iets trager dan het is. Komt er al even niets binnen, dan tot nu: je staat stil.
  const eind = ms - p.at(-1)[0] <= 5_000 ? p.at(-1)[0] : ms;
  const begin = Math.max(eind - TEMPO_VENSTER_MS, p[0][0], vanafMs);
  const duur = eind - begin;
  if (duur < 10_000) return null;
  const meters = spoor.m - meterOp(spoor, begin);
  if (meters < 10) return null;
  return duur / meters; // ms per m = s per km
}

// Te snel of te langzaam? Alleen als je er ruim naast zit.
export function tempoOordeel(tempo, doel) {
  if (tempo === null || !doel) return null;
  if (tempo < doel - AFWIJKING_SEC) return 'te-snel';
  if (tempo > doel + AFWIJKING_SEC) return 'te-langzaam';
  return 'goed';
}

// Waar je bent in de training buiten. Zelfde vorm als toestand() in speler.js, plus de GPS-velden.
// s: een speler (maakSpeler) met daarbij `spoor` en `sprongen` (overgeslagen op echte looptijd).
export function toestandBuiten(s, nu) {
  const ms = echteTijd(s, nu);
  const { spoor, blokken } = s;
  // Elke sprong (overslaan) beëindigt precies één blok.
  const sprongen = [...(s.sprongen ?? [])].sort((x, y) => x - y);
  let volgendeSprong = 0;
  let van = 0;
  let index = 0;
  let eind = null;
  let extra = false;
  for (let i = 0; i < blokken.length; i++) {
    const b = blokken[i];
    const vanM = meterOp(spoor, van);
    eind = b.afstandM ? tijdOp(spoor, vanM + b.afstandM) : van + b.duurSec * 1000;
    if (eind !== null) eind = Math.max(eind, van);
    while (volgendeSprong < sprongen.length && sprongen[volgendeSprong] < van) volgendeSprong += 1;
    const sprong = sprongen[volgendeSprong];
    if (sprong !== undefined && (eind === null || sprong < eind)) { eind = sprong; volgendeSprong += 1; }
    index = i;
    if (eind === null || eind > ms) break;
    if (i === blokken.length - 1) { extra = true; break; }
    van = eind;
  }
  const blok = blokken[index];
  const volgende = extra ? null : blokken[index + 1] ?? null;
  const tempo = tempoNu(spoor, ms);
  const blokTempo = tempoNu(spoor, ms, van);
  let restBlokMs = 0;
  let restBlokM = null;
  if (!extra) {
    if (blok.afstandM) {
      restBlokM = Math.max(0, blok.afstandM - (spoor.m - meterOp(spoor, van)));
      // Hoe lang nog: op je tempo van nu, of anders op het doeltempo.
      const msPerM = tempo ?? tempoPerKm(blok.kmh);
      restBlokMs = restBlokM * msPerM;
    } else restBlokMs = eind - ms;
  }
  return {
    index, blok, volgende, extra,
    extraMs: extra ? ms - eind : 0,
    kmh: blok.kmh,
    volgendeKmh: volgende?.kmh ?? null,
    gepauzeerd: s.pauzeOp !== null,
    verstrekenMs: ms,
    echtMs: ms,
    afstandKm: spoor.m / 1000,
    restBlokMs,
    restBlokM,
    blokMs: ms - van,
    tempoNu: tempo,
    blokTempo,
    doelTempo: tempoPerKm(blok.kmh),
    aankondigen: !extra && volgende !== null && restBlokMs <= VOORAANKONDIGING_SEC * 1000,
  };
}

export function overslaanBuiten(s, nu) {
  if (toestandBuiten(s, nu).extra) return s;
  return { ...s, sprongen: [...(s.sprongen ?? []), echteTijd(s, nu)] };
}

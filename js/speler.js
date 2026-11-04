// Tijdrekening voor een training: welk blok loopt, hoeveel tijd rest er, wanneer komt het volgende,
// welke snelheid geldt en hoeveel kilometer er gelopen is.
// Alles wordt berekend uit tijdstempels, zodat de stand klopt ook als de browser de timer even ophoudt.
//
// Twee tijdlijnen: de echte looptijd (zonder pauzes) en de schema-tijd. Overslaan schuift de
// schema-tijd naar het volgende blok; het overgeslagen stuk telt niet mee voor de afstand.
//
// Een training stopt nooit vanzelf: na het laatste blok loopt hij door als "extra" (op de snelheid
// van het laatste blok, aan te passen met + en −) tot de loper zelf afrondt.

export const VOORAANKONDIGING_SEC = 10;
const MIN_KMH = 1;
const MAX_KMH = 25;

// Een snelheidsaanpassing geldt voor alle blokken van dezelfde soort en snelheid,
// dus bijvoorbeeld voor alle intervallen van een training tegelijk.
export const sleutelVan = (blok) => `${blok.soort}@${blok.kmh}`;

export function maakSpeler(blokken) {
  return {
    blokken, gestartOp: null, pauzeOp: null, gepauzeerdMs: 0, extraMs: 0,
    wijzigingen: [], // { ms (schema-tijd), sleutel, kmh }
    overgeslagen: [], // { van, tot } in schema-tijd
  };
}

export function echteTijd(s, nu) {
  if (s.gestartOp === null) return 0;
  return Math.max(0, (s.pauzeOp ?? nu) - s.gestartOp - s.gepauzeerdMs);
}

export function verstreken(s, nu) {
  return echteTijd(s, nu) + s.extraMs;
}

export const start = (s, nu) => ({ ...s, gestartOp: nu });
export const pauzeer = (s, nu) => (s.pauzeOp === null ? { ...s, pauzeOp: nu } : s);
export const hervat = (s, nu) => (s.pauzeOp === null ? s : { ...s, gepauzeerdMs: s.gepauzeerdMs + (nu - s.pauzeOp), pauzeOp: null });

// Begin van elk blok in schema-tijd, plus het einde van het schema. Een blok op afstand (bijvoorbeeld
// 3,5 km) duurt zo lang als die afstand op de gelopen snelheid kost: sneller lopen maakt het korter.
// Alles volgt uit de bewaarde wijzigingen, dus het klopt ook na herladen.
function indeling(s) {
  const grenzen = [];
  let van = 0;
  s.blokken.forEach((blok, i) => {
    grenzen.push(van);
    let eind = van + blok.duurSec * 1000;
    if (blok.afstandM) {
      const sleutel = sleutelVan(blok);
      let pos = van;
      let rest = blok.afstandM;
      let v = snelheid(s, i, van);
      eind = null;
      for (const w of s.wijzigingen.filter((x) => x.sleutel === sleutel && x.ms > van)) {
        const nodig = (rest / (v / 3.6)) * 1000;
        if (pos + nodig <= w.ms) { eind = pos + nodig; break; }
        rest -= (v / 3.6) * ((w.ms - pos) / 1000);
        pos = w.ms;
        v = w.kmh;
      }
      eind ??= pos + (rest / (v / 3.6)) * 1000;
      // Overgeslagen: het blok eindigt waar het overslaan naartoe sprong.
      const sprong = s.overgeslagen.find((o) => o.van >= van && o.van < eind);
      if (sprong) eind = sprong.tot;
    }
    van = eind;
  });
  return { grenzen, totaalMs: van };
}

function blokIndex(s, ms, { grenzen, totaalMs } = indeling(s)) {
  return ms >= totaalMs ? s.blokken.length - 1 : grenzen.findLastIndex((g) => g <= ms);
}

export const totaalMs = (s) => indeling(s).totaalMs;

// Snelheid van blok `index` op schema-tijd `ms`, met de aanpassingen die tot dan gedaan zijn.
export function snelheid(s, index, ms) {
  const blok = s.blokken[index];
  const sleutel = sleutelVan(blok);
  const laatste = s.wijzigingen.filter((w) => w.sleutel === sleutel && w.ms <= ms).at(-1);
  return laatste ? laatste.kmh : blok.kmh;
}

export function pasSnelheidAan(s, nu, delta) {
  const ms = verstreken(s, nu);
  const index = blokIndex(s, ms);
  const kmh = Math.min(MAX_KMH, Math.max(MIN_KMH, Math.round((snelheid(s, index, ms) + delta) * 10) / 10));
  return { ...s, wijzigingen: [...s.wijzigingen, { ms, sleutel: sleutelVan(s.blokken[index]), kmh }] };
}

// Gelopen afstand in km tot schema-tijd `totMs`: per blok de snelheid maal de tijd, zonder overgeslagen stukken.
export function afstand(s, totMs) {
  const { grenzen } = indeling(s);
  let meters = 0;
  s.blokken.forEach((blok, i) => {
    const van = grenzen[i];
    // Het laatste blok loopt door in de extra tijd.
    const tot = Math.min(i + 1 < grenzen.length ? grenzen[i + 1] : Infinity, totMs);
    if (tot <= van) return;
    const sleutel = sleutelVan(blok);
    const punten = [van, tot, ...s.wijzigingen.filter((w) => w.sleutel === sleutel && w.ms > van && w.ms < tot).map((w) => w.ms)]
      .sort((a, b) => a - b);
    for (let p = 0; p < punten.length - 1; p++) {
      const a = punten[p];
      const b = punten[p + 1];
      const gelopen = (b - a) - s.overgeslagen.reduce((som, o) => som + Math.max(0, Math.min(b, o.tot) - Math.max(a, o.van)), 0);
      meters += (snelheid(s, i, a) / 3.6) * (gelopen / 1000);
    }
  });
  return meters / 1000;
}

// Spring naar het begin van het volgende blok.
export function overslaan(s, nu) {
  const t = toestand(s, nu);
  if (t.extra) return s;
  const van = t.verstrekenMs;
  return { ...s, extraMs: s.extraMs + t.restBlokMs, overgeslagen: [...s.overgeslagen, { van, tot: van + t.restBlokMs }] };
}

export function toestand(s, nu) {
  const ms = verstreken(s, nu);
  const ind = indeling(s);
  const { grenzen, totaalMs: totaal } = ind;
  const extra = ms >= totaal;
  const index = blokIndex(s, ms, ind);
  const eindBlok = index + 1 < grenzen.length ? grenzen[index + 1] : totaal;
  const restBlokMs = extra ? 0 : eindBlok - ms;
  const volgende = s.blokken[index + 1] ?? null;
  return {
    index, blok: s.blokken[index], volgende, extra,
    extraMs: extra ? ms - totaal : 0,
    kmh: snelheid(s, index, ms),
    volgendeKmh: volgende ? snelheid(s, index + 1, ms) : null,
    gepauzeerd: s.pauzeOp !== null,
    verstrekenMs: ms,
    echtMs: echteTijd(s, nu),
    afstandKm: afstand(s, ms),
    restBlokMs,
    restTotaalMs: Math.max(0, totaal - ms),
    aankondigen: !extra && volgende !== null && restBlokMs <= VOORAANKONDIGING_SEC * 1000,
  };
}

// Tijdrekening voor een training: welk blok loopt, hoeveel tijd rest er, wanneer komt het volgende.
// Alles wordt berekend uit tijdstempels, zodat de stand klopt ook als de browser de timer even ophoudt.

export const VOORAANKONDIGING_SEC = 10;

export function maakSpeler(blokken) {
  const grenzen = [];
  let som = 0;
  for (const b of blokken) { grenzen.push(som); som += b.duurSec * 1000; }
  return { blokken, grenzen, totaalMs: som, gestartOp: null, pauzeOp: null, gepauzeerdMs: 0, extraMs: 0 };
}

export function verstreken(s, nu) {
  if (s.gestartOp === null) return 0;
  const eind = s.pauzeOp ?? nu;
  return Math.min(s.totaalMs, Math.max(0, eind - s.gestartOp - s.gepauzeerdMs + s.extraMs));
}

export const start = (s, nu) => ({ ...s, gestartOp: nu });
export const pauzeer = (s, nu) => (s.pauzeOp === null ? { ...s, pauzeOp: nu } : s);
export const hervat = (s, nu) => (s.pauzeOp === null ? s : { ...s, gepauzeerdMs: s.gepauzeerdMs + (nu - s.pauzeOp), pauzeOp: null });

// Spring naar het begin van het volgende blok.
export function overslaan(s, nu) {
  const t = toestand(s, nu);
  if (t.klaar) return s;
  return { ...s, extraMs: s.extraMs + t.restBlokMs };
}

export function toestand(s, nu) {
  const ms = verstreken(s, nu);
  const klaar = ms >= s.totaalMs;
  let index = s.grenzen.findLastIndex((g) => g <= ms);
  if (klaar) index = s.blokken.length - 1;
  const eindBlok = index + 1 < s.grenzen.length ? s.grenzen[index + 1] : s.totaalMs;
  const restBlokMs = klaar ? 0 : eindBlok - ms;
  const volgende = s.blokken[index + 1] ?? null;
  return {
    index, blok: s.blokken[index], volgende, klaar,
    gepauzeerd: s.pauzeOp !== null,
    verstrekenMs: ms,
    restBlokMs,
    restTotaalMs: s.totaalMs - ms,
    aankondigen: !klaar && volgende !== null && restBlokMs <= VOORAANKONDIGING_SEC * 1000,
  };
}

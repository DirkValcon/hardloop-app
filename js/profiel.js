// Profiel en doel: controleren, opslaan en laden.
import { parseTijd } from './tijd.js';
import { dagenTussen, plusDagen } from './datum.js';
import { meldOpgeslagen } from './opgeslagen.js';
import { doelafstand, vijfKmUitNiveau, tienKmUitDoel, MIN_WEKEN, MAX_WEKEN } from './generator.js';

export const SCHEMA_WEKEN = 11;
export const DAGEN = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
export const OPSLAG_SLEUTEL = 'hardloop-app.profiel.v1';

// Aantal weken van het schema van dit profiel (het vaste schema duurt 11 weken).
export const schemaWeken = (profiel) => profiel?.schema?.weken ?? SCHEMA_WEKEN;

// Vroegst mogelijke doeldatum: het hele schema vanaf vandaag.
export function vroegsteDoeldatum(vandaag, weken = SCHEMA_WEKEN) {
  return plusDagen(vandaag, weken * 7);
}

// Aantal hele weken extra tussen vandaag en de start van het schema.
export function extraWeken(vandaag, doeldatum, weken = SCHEMA_WEKEN) {
  return Math.max(0, Math.floor((dagenTussen(vandaag, doeldatum) - weken * 7) / 7));
}

// Elke stap controleert alleen zijn eigen velden, zodat de onboarding per stap kan valideren.
export const STAPPEN = [
  ['maxKm', 'tempo'],
  ['doelAfstand', 'doelTijd'],
  ['weken', 'doelDatum', 'extraWekenKeuze'],
  ['trainingsdagen'],
  ['gewicht', 'helling'],
];

export const getal = (v) => Number(String(v ?? '').trim().replace(',', '.'));
const wekenVan = (invoer) => (invoer.weken ? Math.round(getal(invoer.weken)) : SCHEMA_WEKEN);

export function valideerVeld(veld, invoer, vandaag) {
  switch (veld) {
    case 'vijfKmTijd': {
      const s = parseTijd(invoer.vijfKmTijd ?? '');
      if (s === null) return 'Vul je 5 km-tijd in als mm:ss, bijvoorbeeld 35:00.';
      if (s < 12 * 60 || s > 60 * 60) return 'Een 5 km-tijd ligt tussen 12:00 en 60:00.';
      return null;
    }
    case 'maxKm': {
      const km = getal(invoer.maxKm);
      if (!String(invoer.maxKm ?? '').trim() || Number.isNaN(km)) return 'Vul in hoeveel km je nu maximaal achter elkaar loopt.';
      if (km < 1 || km > 50) return 'Je maximale afstand ligt tussen 1 en 50 km.';
      return null;
    }
    case 'tempo': {
      const s = parseTijd(invoer.tempo ?? '');
      if (s === null) return 'Vul je tempo in als min:ss per km, bijvoorbeeld 7:00.';
      if (s < 150 || s > 15 * 60) return 'Een tempo ligt tussen 2:30 en 15:00 per km.';
      return null;
    }
    case 'doelAfstand':
      return doelafstand(invoer.doelAfstand) ? null : 'Kies een doel.';
    case 'doelTijd': {
      if (!invoer.doelTijd) return null; // optioneel: leeg = uitlopen
      const s = parseTijd(invoer.doelTijd);
      const d = doelafstand(invoer.doelAfstand) ?? doelafstand(10);
      if (s === null) return 'Vul je doeltijd in als mm:ss of u:mm:ss, bijvoorbeeld 70:00.';
      // Tussen 2:30 en 12:00 per km (voor 10 km: 25:00 tot 2:00:00).
      const [min, max] = [d.km * 150, d.km * 720].map((x) => Math.round(x / 60) * 60);
      if (s < min || s > max) return `Een ${d.naam}-doeltijd ligt tussen ${tijdTekst(min)} en ${tijdTekst(max)}.`;
      return null;
    }
    case 'weken': {
      const w = getal(invoer.weken);
      if (!Number.isInteger(w) || w < MIN_WEKEN || w > MAX_WEKEN) return `Kies ${MIN_WEKEN} tot ${MAX_WEKEN} weken.`;
      return null;
    }
    case 'doelDatum': {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(invoer.doelDatum ?? '')) return 'Kies een doeldatum.';
      const weken = wekenVan(invoer);
      if (dagenTussen(vandaag, invoer.doelDatum) < weken * 7) {
        return `Het schema duurt ${weken} weken: kies een datum die minstens ${weken} weken vooruit ligt.`;
      }
      return null;
    }
    case 'extraWekenKeuze': {
      if (valideerVeld('doelDatum', invoer, vandaag)) return null;
      if (extraWeken(vandaag, invoer.doelDatum, wekenVan(invoer)) === 0) return null;
      return ['later', 'basis'].includes(invoer.extraWekenKeuze)
        ? null : 'Kies wat je met de extra weken wilt doen.';
    }
    case 'trainingsdagen': {
      const dagen = invoer.trainingsdagen ?? [];
      if (dagen.length < 3 || dagen.length > 5) return 'Kies 3, 4 of 5 trainingsdagen.';
      return null;
    }
    case 'gewicht': {
      const g = Number(invoer.gewicht);
      if (!invoer.gewicht || Number.isNaN(g) || g < 30 || g > 250) return 'Vul je gewicht in kg in (30 tot 250).';
      return null;
    }
    case 'helling': {
      const h = Number(invoer.helling);
      if (invoer.helling === '' || invoer.helling == null || Number.isNaN(h) || h < 0 || h > 15) {
        return 'De helling ligt tussen 0 en 15%.';
      }
      return null;
    }
    default:
      return null;
  }
}

export function valideerStap(stap, invoer, vandaag) {
  const fouten = {};
  for (const veld of STAPPEN[stap]) {
    const fout = valideerVeld(veld, invoer, vandaag);
    if (fout) fouten[veld] = fout;
  }
  return fouten;
}

// Een nieuw, gegenereerd schema. De 5 km-tijd en de 10 km-doeltijd worden afgeleid, zodat de
// tempozones hetzelfde blijven rekenen als bij het vaste schema.
export function valideerProfiel(invoer, vandaag, { schemaId = `s${Date.now().toString(36)}` } = {}) {
  const fouten = Object.assign({}, ...STAPPEN.map((_, i) => valideerStap(i, invoer, vandaag)));
  if (Object.keys(fouten).length) return { ok: false, fouten };
  const weken = wekenVan(invoer);
  const extra = extraWeken(vandaag, invoer.doelDatum, weken);
  const maxKm = getal(invoer.maxKm);
  const tempoSecPerKm = parseTijd(invoer.tempo);
  const doelKm = doelafstand(invoer.doelAfstand).km;
  const doelAfstandSeconden = invoer.doelTijd ? parseTijd(invoer.doelTijd) : null;
  return {
    ok: true,
    profiel: {
      schema: { id: schemaId, doelKm, maxKm, tempoSecPerKm, weken },
      vijfKmSeconden: vijfKmUitNiveau(maxKm, tempoSecPerKm),
      doelAfstand: doelKm,
      doelAfstandSeconden,
      doelSeconden: tienKmUitDoel(doelKm, doelAfstandSeconden),
      doelDatum: invoer.doelDatum,
      extraWeken: extra,
      extraWekenKeuze: extra > 0 ? invoer.extraWekenKeuze : null,
      trainingsdagen: DAGEN.filter((d) => invoer.trainingsdagen.includes(d)),
      gewicht: Number(invoer.gewicht),
      helling: Number(invoer.helling),
      aangemaaktOp: vandaag,
    },
  };
}

function tijdTekst(s) {
  const u = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return u ? `${u}:${String(m).padStart(2, '0')}:00` : `${m}:00`;
}

export function laadProfiel(opslag) {
  try {
    const tekst = opslag.getItem(OPSLAG_SLEUTEL);
    return tekst ? JSON.parse(tekst) : null;
  } catch {
    return null;
  }
}

export function bewaarProfiel(opslag, profiel) {
  opslag.setItem(OPSLAG_SLEUTEL, JSON.stringify(profiel));
  meldOpgeslagen(OPSLAG_SLEUTEL);
}

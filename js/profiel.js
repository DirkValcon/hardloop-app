// Profiel en doel: controleren, opslaan en laden.
import { parseTijd } from './tijd.js';
import { dagenTussen, plusDagen } from './datum.js';
import { meldOpgeslagen } from './opgeslagen.js';

export const SCHEMA_WEKEN = 11;
export const DAGEN = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
export const OPSLAG_SLEUTEL = 'hardloop-app.profiel.v1';

// Vroegst mogelijke doeldatum: 11 volle weken vanaf vandaag.
export function vroegsteDoeldatum(vandaag) {
  return plusDagen(vandaag, SCHEMA_WEKEN * 7);
}

// Aantal hele weken extra tussen vandaag en de start van het 11-wekenschema.
export function extraWeken(vandaag, doeldatum) {
  return Math.max(0, Math.floor((dagenTussen(vandaag, doeldatum) - SCHEMA_WEKEN * 7) / 7));
}

// Elke stap controleert alleen zijn eigen velden, zodat de onboarding per stap kan valideren.
export const STAPPEN = [
  ['vijfKmTijd'],
  ['doelAfstand', 'doelTijd'],
  ['doelDatum', 'extraWekenKeuze'],
  ['trainingsdagen'],
  ['gewicht', 'helling'],
];

export function valideerVeld(veld, invoer, vandaag) {
  switch (veld) {
    case 'vijfKmTijd': {
      const s = parseTijd(invoer.vijfKmTijd ?? '');
      if (s === null) return 'Vul je 5 km-tijd in als mm:ss, bijvoorbeeld 35:00.';
      if (s < 12 * 60 || s > 60 * 60) return 'Een 5 km-tijd ligt tussen 12:00 en 60:00.';
      return null;
    }
    case 'doelAfstand':
      return invoer.doelAfstand === 10 ? null : 'Kies een doel.';
    case 'doelTijd': {
      if (!invoer.doelTijd) return null; // optioneel
      const s = parseTijd(invoer.doelTijd);
      if (s === null) return 'Vul je doeltijd in als mm:ss of u:mm:ss, bijvoorbeeld 70:00.';
      if (s < 25 * 60 || s > 2 * 3600) return 'Een 10 km-doeltijd ligt tussen 25:00 en 2:00:00.';
      return null;
    }
    case 'doelDatum': {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(invoer.doelDatum ?? '')) return 'Kies een doeldatum.';
      if (dagenTussen(vandaag, invoer.doelDatum) < SCHEMA_WEKEN * 7) {
        return 'Het schema duurt 11 weken: kies een datum die minstens 11 weken vooruit ligt.';
      }
      return null;
    }
    case 'extraWekenKeuze': {
      if (valideerVeld('doelDatum', invoer, vandaag)) return null;
      if (extraWeken(vandaag, invoer.doelDatum) === 0) return null;
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

export function valideerProfiel(invoer, vandaag) {
  const fouten = Object.assign({}, ...STAPPEN.map((_, i) => valideerStap(i, invoer, vandaag)));
  if (Object.keys(fouten).length) return { ok: false, fouten };
  const extra = extraWeken(vandaag, invoer.doelDatum);
  return {
    ok: true,
    profiel: {
      vijfKmSeconden: parseTijd(invoer.vijfKmTijd),
      doelAfstand: 10,
      doelSeconden: invoer.doelTijd ? parseTijd(invoer.doelTijd) : null,
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

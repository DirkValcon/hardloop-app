// Resultaten per training: gedaan of overgeslagen, met afstand, duur en calorieën.
import { kcalBlok } from './calorieen.js';

export const OPSLAG_RESULTATEN = 'hardloop-app.resultaten.v1';

export function laadResultaten(opslag) {
  try {
    const r = JSON.parse(opslag.getItem(OPSLAG_RESULTATEN));
    return r && typeof r === 'object' ? r : {};
  } catch {
    return {};
  }
}

function bewaar(opslag, r) {
  opslag.setItem(OPSLAG_RESULTATEN, JSON.stringify(r));
  return r;
}

export function valideerResultaat({ afstandKm, duurMin, kcal }) {
  const fouten = {};
  if (!(afstandKm > 0 && afstandKm <= 50)) fouten.afstandKm = 'Vul de afstand in km in, zoals op de loopband staat.';
  if (!(duurMin > 0 && duurMin <= 300)) fouten.duurMin = 'Vul de duur in minuten in.';
  if (!(kcal >= 0 && kcal <= 5000)) fouten.kcal = 'Vul de calorieën in (0 tot 5000).';
  return fouten;
}

export function markeerGedaan(opslag, training, { afstandKm, duurMin, kcal }, vandaag) {
  const r = laadResultaten(opslag);
  r[training.id] = {
    status: 'gedaan', datum: vandaag, gepland: training.datum, type: training.type,
    afstandKm: Math.round(afstandKm * 100) / 100, duurSec: Math.round(duurMin * 60), kcal: Math.round(kcal),
  };
  return bewaar(opslag, r);
}

export function markeerOvergeslagen(opslag, training, vandaag) {
  const r = laadResultaten(opslag);
  r[training.id] = { status: 'overgeslagen', datum: vandaag, gepland: training.datum, type: training.type };
  return bewaar(opslag, r);
}

export function maakOngedaan(opslag, trainingId) {
  const r = laadResultaten(opslag);
  delete r[trainingId];
  return bewaar(opslag, r);
}

// Calorieën opnieuw schatten met de gelopen afstand: de geplande blokken naar verhouding.
export function schatKcal(training, afstandKm, gewicht) {
  const gepland = training.blokken.reduce((s, b) => s + kcalBlok(b, gewicht), 0);
  return Math.round(gepland * (afstandKm / training.afstandKm));
}

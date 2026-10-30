// Calorieschatting met de ACSM-formules voor lopen en wandelen op een loopband.
// We tellen alleen het actieve verbruik (zonder rustverbruik), net als "actieve calorieën" op een Apple Watch.

const KCAL_PER_LITER_O2 = 5;

// Netto zuurstofverbruik in ml/kg/min.
export function vo2Netto(kmh, hellingProcent, wandelen = false) {
  const s = (kmh * 1000) / 60; // m/min
  const g = hellingProcent / 100;
  return wandelen ? 0.1 * s + 1.8 * s * g : 0.2 * s + 0.9 * s * g;
}

export function kcalBlok(blok, gewicht) {
  const vo2 = vo2Netto(blok.kmh, blok.helling, blok.soort === 'uitwandelen');
  return (vo2 * gewicht / 1000) * KCAL_PER_LITER_O2 * (blok.duurSec / 60);
}

export function kcalTraining(training, gewicht) {
  return Math.round(training.blokken.reduce((s, b) => s + kcalBlok(b, gewicht), 0));
}

// Verbruik voor het deel van de training dat echt gelopen is (bijvoorbeeld na een stop).
export function kcalTotVerstreken(training, verstrekenSec, gewicht) {
  let rest = verstrekenSec;
  let kcal = 0;
  for (const b of training.blokken) {
    if (rest <= 0) break;
    const deel = Math.min(rest, b.duurSec);
    kcal += kcalBlok({ ...b, duurSec: deel }, gewicht);
    rest -= deel;
  }
  return Math.round(kcal);
}

export function afstandTotVerstreken(training, verstrekenSec) {
  let rest = verstrekenSec;
  let km = 0;
  for (const b of training.blokken) {
    if (rest <= 0) break;
    const deel = Math.min(rest, b.duurSec);
    km += (b.kmh * deel) / 3600;
    rest -= deel;
  }
  return Math.round(km * 100) / 100;
}

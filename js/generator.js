// Schemagenerator: maakt uit je doelafstand, je huidige maximale afstand en het aantal weken
// een sjabloon met dezelfde vorm als het vaste 5 → 10 km-schema, zodat maakPlan het kan gebruiken.
//
// Blessureregels (gangbare vuistregels):
// - de lange duurloop groeit hooguit 10% per week (minimaal 0,5 km, anders kom je bij korte
//   afstanden nergens), afgerond op halve kilometers;
// - elke 4e week is een herstelweek met een kortere lange loop;
// - vóór een halve of hele marathon een of meer rustigere weken (taper).
import { voorspelTijd } from './zones.js';

export const DOELAFSTANDEN = [
  { km: 5, naam: '5 km', piekLang: 6, taper: 0, minWeken: 6 },
  { km: 10, naam: '10 km', piekLang: 10, taper: 0, minWeken: 8 },
  { km: 21.1, naam: 'Halve marathon', piekLang: 18, taper: 1, minWeken: 10 },
  { km: 42.2, naam: 'Marathon', piekLang: 32, taper: 2, minWeken: 16 },
];

export const MAX_GROEI = 0.1;
const MIN_STAP = 0.5;
const HERSTEL_ELKE = 4;
const HERSTEL_FACTOR = 0.8;
const MIN_LOOP = 3;
export const MIN_WEKEN = 4;
export const MAX_WEKEN = 52;

export const doelafstand = (km) => DOELAFSTANDEN.find((d) => d.km === Number(km)) ?? null;
const halve = (km) => Math.round(km * 2) / 2;
const kmTekst = (km) => String(km).replace('.', ',');

// Je huidige niveau omgerekend naar een 5 km-tijd, zodat de bestaande tempozones blijven werken.
export function vijfKmUitNiveau(maxKm, tempoSecPerKm) {
  return Math.round(voorspelTijd(maxKm * tempoSecPerKm, maxKm, 5));
}

// Een doeltijd op een andere afstand omgerekend naar 10 km (voor de snelle zones).
export function tienKmUitDoel(doelKm, doelSeconden) {
  return doelSeconden ? Math.round(voorspelTijd(doelSeconden, doelKm, 10)) : null;
}

// Welke weken herstelweken zijn, gegeven het totaal aantal weken en de taper.
function weekSoorten(weken, taper) {
  const soorten = [];
  for (let w = 1; w <= weken; w++) {
    if (w === weken) soorten.push('doel');
    else if (w > weken - 1 - taper) soorten.push('taper');
    else if (w % HERSTEL_ELKE === 0 && w < weken - 1 - taper) soorten.push('herstel');
    else soorten.push('opbouw');
  }
  return soorten;
}

// Startlengte van de lange loop: je huidige maximum, maar nooit boven de piek.
function startLang(def, maxKm) {
  return Math.min(def.piekLang, Math.max(MIN_LOOP, halve(maxKm)));
}

// Het aantal weken dat de app aanraadt: genoeg opbouwweken om met hooguit 10% per week van
// je huidige maximum naar de piek te groeien, plus herstel-, taper- en wedstrijdweek.
// De lange loop per opbouwweek als je steeds de grootste veilige stap zet.
function veiligeOpbouw(def, start) {
  const reeks = [start];
  while (reeks.at(-1) < def.piekLang) {
    const lang = reeks.at(-1);
    // Afronden naar beneden op halve km, zodat de stap nooit groter is dan toegestaan.
    const stap = Math.max(MIN_STAP, Math.floor(lang * MAX_GROEI * 2) / 2);
    reeks.push(Math.min(def.piekLang, lang + stap));
  }
  return reeks;
}

export function adviesWeken(doelKm, maxKm) {
  const def = doelafstand(doelKm);
  const opbouw = veiligeOpbouw(def, startLang(def, maxKm)).length;
  for (let weken = Math.max(def.minWeken, MIN_WEKEN); weken <= MAX_WEKEN; weken++) {
    if (weekSoorten(weken, def.taper).filter((s) => s === 'opbouw').length >= opbouw) return weken;
  }
  return MAX_WEKEN;
}

// Hoe verantwoord is het gekozen aantal weken?
export function beoordeelWeken(doelKm, maxKm, weken) {
  const advies = adviesWeken(doelKm, maxKm);
  const plan = maakLangeLopen(doelKm, maxKm, weken);
  // Groei ten opzichte van de langste loop tot dan toe (na een herstelweek terug naar het oude
  // niveau telt dus niet als groei).
  let langste = 0;
  let groei = 0;
  for (const km of plan.lang.filter(Boolean)) {
    if (langste) groei = Math.max(groei, km / langste - 1);
    langste = Math.max(langste, km);
  }
  return { advies, weken, teKort: weken < advies, maxGroei: groei };
}

// De lange duurloop per week. Opbouwweken groeien gelijkmatig (meetkundig) van start naar piek;
// met te weinig weken wordt de stap groter dan 10% (dat meldt beoordeelWeken).
function maakLangeLopen(doelKm, maxKm, weken) {
  const def = doelafstand(doelKm);
  const soorten = weekSoorten(weken, def.taper);
  const opbouwIdx = soorten.map((s, i) => (s === 'opbouw' ? i : -1)).filter((i) => i >= 0);
  const start = startLang(def, maxKm);
  const n = opbouwIdx.length;
  const veilig = veiligeOpbouw(def, start);
  let opbouwKm;
  if (n >= veilig.length) {
    // Genoeg weken: elke veilige stap duurt een of meer weken, de laatste week zit je op de piek.
    opbouwKm = opbouwIdx.map((_, j) => veilig[Math.floor((j * veilig.length) / n)]);
  } else {
    // Te weinig weken: gelijkmatig (meetkundig) naar de piek, met grotere stappen dan veilig.
    const factor = n > 1 ? (def.piekLang / start) ** (1 / (n - 1)) : 1;
    opbouwKm = opbouwIdx.map((_, j) => (j === n - 1 ? def.piekLang : Math.min(def.piekLang, halve(start * factor ** j))));
  }

  const lang = [];
  let vorige = start;
  let j = 0;
  soorten.forEach((s, i) => {
    if (s === 'opbouw') { vorige = opbouwKm[j++]; lang.push(vorige); }
    else if (s === 'herstel') lang.push(Math.max(MIN_LOOP, halve(vorige * HERSTEL_FACTOR)));
    else if (s === 'taper') {
      // Eerste taperweek 75%, tweede 55% van de piek.
      const stap = i - (weken - 1 - def.taper);
      lang.push(Math.max(MIN_LOOP, halve(def.piekLang * (stap === 0 ? 0.75 : 0.55))));
    } else lang.push(null); // doelweek: de wedstrijd zelf
  });
  return { soorten, lang };
}

// Kwaliteitstrainingen, oplopend in zwaarte. Bij langere doelen langere tempoblokken.
const KORT = [
  { vorm: 'fartlek', naam: 'Fartlek: 6 × 1 min snel / 1 min rustig', herhaal: 6, sec: 60, zone: 'snel', herstelSec: 60 },
  { vorm: 'intervallen', naam: '6 × 400 m op 5 km-tempo', herhaal: 6, meters: 400, zone: 'tempo5', herstelSec: 90 },
  { vorm: 'tempo', naam: '2 × 8 min op 10 km-tempo', herhaal: 2, sec: 480, zone: 'tempo10', herstelSec: 180 },
  { vorm: 'tijdsblokken', naam: '5 × 2 min op 5 km-tempo', herhaal: 5, sec: 120, zone: 'tempo5', herstelSec: 90 },
  { vorm: 'piramide', naam: 'Piramide: 1-2-3-2-1 min snel', piramide: [60, 120, 180, 120, 60], zone: 'snel' },
  { vorm: 'intervallen', naam: '5 × 800 m op 5 km-tempo', herhaal: 5, meters: 800, zone: 'tempo5', herstelSec: 120 },
  { vorm: 'tempo', naam: '2 × 12 min op 10 km-tempo', herhaal: 2, sec: 720, zone: 'tempo10', herstelSec: 180 },
  { vorm: 'intervallen', naam: '4 × 1 km op 10 km-tempo', herhaal: 4, meters: 1000, zone: 'tempo10', herstelSec: 120 },
  { vorm: 'progressief', naam: 'Progressief: 20 min, elke 5 min +0,3 km/u', stappen: 4, sec: 300, stap: 0.3, zone: 'tempo10' },
  { vorm: 'tempo', naam: 'Tempo: 15 min aaneen', herhaal: 1, sec: 900, zone: 'tempo10', herstelSec: 0 },
];
const LANG = [
  { vorm: 'tempo', naam: 'Tempo: 20 min aaneen', herhaal: 1, sec: 1200, zone: 'tempo10', herstelSec: 0 },
  { vorm: 'intervallen', naam: '3 × 2 km op 10 km-tempo', herhaal: 3, meters: 2000, zone: 'tempo10', herstelSec: 180 },
  { vorm: 'tempo', naam: '3 × 10 min op 10 km-tempo', herhaal: 3, sec: 600, zone: 'tempo10', herstelSec: 120 },
  { vorm: 'progressief', naam: 'Progressief: 30 min, elke 6 min +0,3 km/u', stappen: 5, sec: 360, stap: 0.3, zone: 'tempo10' },
];
const LICHT = { vorm: 'intervallen', naam: '4 × 400 m losjes op 5 km-tempo', herhaal: 4, meters: 400, zone: 'tempo5', herstelSec: 90 };
const HERSTEL = { vorm: 'fartlek', naam: 'Fartlek: 6 × 30 s snel / 90 s rustig', herhaal: 6, sec: 30, zone: 'snel', herstelSec: 90 };

function kiesKwaliteit(def, soorten) {
  const reeks = def.km > 10 ? [...KORT.slice(0, 6), ...LANG, ...KORT.slice(6)] : KORT;
  const opbouwTotaal = soorten.filter((s) => s === 'opbouw').length;
  let j = 0;
  return soorten.map((s) => {
    if (s === 'herstel') return HERSTEL;
    if (s === 'taper' || s === 'doel') return LICHT;
    // Verdeel de reeks over de opbouwweken, zodat de zwaarste aan het eind komen.
    const idx = Math.min(reeks.length - 1, Math.floor((j++ * reeks.length) / Math.max(1, opbouwTotaal)));
    return reeks[idx];
  });
}

// Het sjabloon voor maakPlan.
export function genereerSjabloon({ doelKm, maxKm, weken }) {
  const def = doelafstand(doelKm);
  if (!def) throw new Error(`Onbekende doelafstand: ${doelKm}`);
  const { soorten, lang } = maakLangeLopen(doelKm, maxKm, weken);
  const rustig = lang.map((km, i) => {
    const basis = km ?? lang[i - 1] ?? MIN_LOOP;
    const factor = soorten[i] === 'doel' ? 0.4 : 0.6;
    return Math.max(MIN_LOOP, Math.min(def.km > 10 ? 12 : 6, halve(basis * factor)));
  });
  const extraRustig = rustig.map((km) => Math.max(MIN_LOOP, halve(km * 0.75)));
  return {
    id: `gen-${kmTekst(def.km)}-${weken}`,
    naam: `${def.naam} in ${weken} weken`,
    doelKm: def.km,
    doelNaam: def.naam,
    weken,
    herstelweken: soorten.flatMap((s, i) => (s === 'herstel' ? [i + 1] : [])),
    taperweken: soorten.flatMap((s, i) => (s === 'taper' ? [i + 1] : [])),
    rustig,
    lang,
    extraRustig,
    kwaliteit: kiesKwaliteit(def, soorten),
    basis: { rustig: 3.5, lang: Math.max(MIN_LOOP, halve(maxKm)), versnellingen: { herhaal: 6, sec: 20, herstelSec: 40 } },
  };
}

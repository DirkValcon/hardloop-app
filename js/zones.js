// Tempozones voor de loopband, berekend uit de 5 km-tijd en (optioneel) de doeltijd.
// Snelheden in km/u, afgerond op 0,1 zoals je ze op een loopband instelt.

export const RIEGEL_EXPONENT = 1.06;
export const MAX_AMBITIE = 0.05; // doeltijd mag tot 5% sneller zijn dan de voorspelling
const WANDELSNELHEID = 5.5;

// Voorspelde tijd op een andere afstand (Riegel): t2 = t1 × (d2/d1)^1,06.
export function voorspelTijd(seconden, vanKm, naarKm) {
  return seconden * (naarKm / vanKm) ** RIEGEL_EXPONENT;
}

export function rondSnelheid(kmh) {
  return Math.round(kmh * 10) / 10;
}

export function tempoPerKm(kmh) {
  return 3600 / kmh; // seconden per km
}

export function beoordeelDoeltijd(vijfKmSeconden, doelSeconden) {
  const voorspeld = voorspelTijd(vijfKmSeconden, 5, 10);
  if (!doelSeconden) {
    // Voorstel: 2% sneller dan nu voorspeld, afgerond op een halve minuut.
    const voorstel = Math.round((voorspeld * 0.98) / 30) * 30;
    return { niveau: 'geen', voorspeld, voorstel };
  }
  const sneller = (voorspeld - doelSeconden) / voorspeld;
  if (sneller <= 0) return { niveau: 'haalbaar', voorspeld, sneller };
  if (sneller <= MAX_AMBITIE) return { niveau: 'ambitieus', voorspeld, sneller };
  return { niveau: 'te-snel', voorspeld, sneller };
}

// Zones waarvoor je onder Profiel een eigen snelheid kunt instellen.
export const EIGEN_ZONES = ['rustig', 'tempo10', 'tempo5', 'snel'];

// De snelle zones rekenen met het niveau dat je wilt halen (je doeltijd, hooguit 5% sneller dan
// voorspeld); de rustige zones altijd met je huidige niveau, zodat duurlopen echt rustig blijven.
// Een eigen snelheid (bijvoorbeeld rustig 8,5 km/u) gaat altijd voor de berekende.
export function berekenZones(vijfKmSeconden, doelSeconden = null, eigen = {}) {
  const nu5 = 5 / (vijfKmSeconden / 3600); // km/u
  const voorspeld10 = voorspelTijd(vijfKmSeconden, 5, 10);
  const doel10 = doelSeconden ? Math.max(doelSeconden, voorspeld10 * (1 - MAX_AMBITIE)) : voorspeld10;
  const doel5 = voorspelTijd(doel10, 10, 5);
  const v10 = 10 / (doel10 / 3600);
  const v5 = 5 / (doel5 / 3600);

  const zone = (id, naam, gebruik, van, tot = van) => (eigen?.[id]
    ? { id, naam, gebruik, van: eigen[id], tot: eigen[id], eigen: true }
    : { id, naam, gebruik, van: rondSnelheid(van), tot: rondSnelheid(tot) });
  const joggen = nu5 * 0.71;
  return [
    zone('warmup', 'Warming-up', '10 min, rustig oplopend', joggen, nu5 * 0.8),
    zone('rustig', 'Rustig', 'Duurloop, lange loop, herstel', nu5 * 0.8, nu5 * 0.855),
    zone('tempo10', '10 km-tempo', 'Tempoblokken', v10),
    zone('tempo5', '5 km-tempo', 'Intervallen 400 m – 1 km', v5),
    zone('snel', 'Snel', 'Korte versnellingen, fartlek', v5 * 1.036),
    zone('uitjoggen', 'Uitjoggen', 'Cooling-down, eerste deel', joggen),
    zone('uitwandelen', 'Uitwandelen', 'Cooling-down, laatste deel', Math.min(WANDELSNELHEID, joggen - 0.5)),
  ];
}

// Voortgang: kilometers en calorieën per week, langste loop, voorspelling en tijd tot de doeldatum.
import { voorspelTijd } from './zones.js';
import { dagenTussen } from './datum.js';

export function berekenVoortgang(plan, resultaten, profiel, vandaag) {
  const perWeek = plan.weken.map((w) => {
    const gedaan = w.trainingen.map((t) => resultaten[t.id]).filter((r) => r?.status === 'gedaan');
    return {
      label: w.soort === 'basis' ? `B${w.nummer}` : `W${w.nummer}`,
      maandag: w.maandag,
      km: Math.round(gedaan.reduce((s, r) => s + r.afstandKm, 0) * 10) / 10,
      kcal: gedaan.reduce((s, r) => s + r.kcal, 0),
      geplandKm: Math.round(w.trainingen.reduce((s, t) => s + t.afstandKm, 0) * 10) / 10,
      gedaan: gedaan.length,
      aantal: w.trainingen.length,
    };
  });
  const alle = plan.weken.flatMap((w) => w.trainingen);
  const gedaan = alle.filter((t) => resultaten[t.id]?.status === 'gedaan');
  const langste = gedaan.reduce((best, t) => (!best || resultaten[t.id].afstandKm > resultaten[best.id].afstandKm ? t : best), null);
  const dagen = Math.max(0, dagenTussen(vandaag, plan.doelDatum));
  return {
    perWeek,
    totaalKm: Math.round(perWeek.reduce((s, w) => s + w.km, 0) * 10) / 10,
    totaalKcal: perWeek.reduce((s, w) => s + w.kcal, 0),
    gedaan: gedaan.length,
    overgeslagen: alle.filter((t) => resultaten[t.id]?.status === 'overgeslagen').length,
    totaal: alle.length,
    langste: langste ? { naam: langste.naam, afstandKm: resultaten[langste.id].afstandKm, datum: resultaten[langste.id].datum } : null,
    voorspeld10km: voorspelTijd(profiel.vijfKmSeconden, 5, 10),
    doelSeconden: profiel.doelSeconden,
    dagenTotDoel: dagen,
    wekenTotDoel: Math.ceil(dagen / 7),
  };
}

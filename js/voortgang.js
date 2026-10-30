// Voortgang: kilometers en calorieën per week, langste loop, voorspelling en tijd tot de doeldatum.
import { voorspelTijd } from './zones.js';
import { dagenTussen, plusDagen } from './datum.js';
import { maandagVan } from './schema.js';

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
    ...statistieken(plan, resultaten, vandaag),
  };
}

const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const rond1 = (v) => Math.round(v * 10) / 10;

// Statistieken op basis van de dag waarop je echt gelopen hebt (niet de geplande dag).
export function statistieken(plan, resultaten, vandaag) {
  const namen = new Map(plan.weken.flatMap((w) => w.trainingen).map((t) => [t.id, t.naam]));
  const gelopen = Object.entries(resultaten)
    .filter(([, r]) => r.status === 'gedaan')
    .map(([id, r]) => ({ id, naam: namen.get(id) ?? 'Training', datum: r.datum, afstandKm: r.afstandKm, duurSec: r.duurSec, kcal: r.kcal }))
    .sort((a, b) => b.datum.localeCompare(a.datum) || a.id.localeCompare(b.id));

  const maandag = maandagVan(vandaag);
  const som = (lijst) => rond1(lijst.reduce((s, r) => s + r.afstandKm, 0));
  const perMaandMap = new Map();
  for (const r of gelopen) {
    const sleutel = r.datum.slice(0, 7);
    const m = perMaandMap.get(sleutel) ?? { sleutel, km: 0, kcal: 0, aantal: 0 };
    m.km += r.afstandKm; m.kcal += r.kcal; m.aantal += 1;
    perMaandMap.set(sleutel, m);
  }
  const perMaand = [...perMaandMap.values()]
    .sort((a, b) => a.sleutel.localeCompare(b.sleutel))
    .map((m) => ({ ...m, km: rond1(m.km), label: `${MAANDEN[Number(m.sleutel.slice(5)) - 1]} ${m.sleutel.slice(0, 4)}` }));
  const totaalKm = gelopen.reduce((s, r) => s + r.afstandKm, 0);
  const totaalSec = gelopen.reduce((s, r) => s + r.duurSec, 0);
  return {
    gelopen,
    perMaand,
    kmDezeWeek: som(gelopen.filter((r) => r.datum >= maandag && r.datum <= plusDagen(maandag, 6))),
    kmDezeMaand: som(gelopen.filter((r) => r.datum.slice(0, 7) === vandaag.slice(0, 7))),
    gemiddeldTempo: totaalKm > 0 ? totaalSec / totaalKm : null, // seconden per km
  };
}

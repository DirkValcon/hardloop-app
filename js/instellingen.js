// Instellingen wijzigen. Wat al gedaan is blijft staan:
// - 5 km-tijd, doeltijd en helling gelden vanaf de huidige week;
// - nieuwe standaarddagen gelden vanaf volgende week;
// - gewicht geldt meteen (alleen voor de calorieschatting);
// - een andere doeldatum verschuift het hele schema.
// Zolang het schema nog niet begonnen is, wordt alles meteen in het profiel zelf gezet.
import { valideerVeld, extraWeken, DAGEN } from './profiel.js';
import { parseTijd } from './tijd.js';
import { maandagVan, profielVoorWeek, maakPlan } from './schema.js';
import { plusDagen } from './datum.js';

const VANAF_DEZE_WEEK = ['vijfKmSeconden', 'doelSeconden', 'helling'];
const VANAF_VOLGENDE_WEEK = ['trainingsdagen'];

export function effectiefProfiel(profiel, vandaag) {
  return profielVoorWeek(profiel, maandagVan(vandaag));
}

export function valideerWijziging(profiel, invoer, vandaag) {
  const velden = ['vijfKmTijd', 'doelTijd', 'trainingsdagen', 'gewicht', 'helling'];
  if (invoer.doelDatum !== profiel.doelDatum) velden.push('doelDatum', 'extraWekenKeuze');
  const fouten = {};
  for (const v of velden) {
    const fout = valideerVeld(v, invoer, vandaag);
    if (fout) fouten[v] = fout;
  }
  return fouten;
}

export function wijzigProfiel(profiel, invoer, vandaag) {
  const nieuw = {
    vijfKmSeconden: parseTijd(invoer.vijfKmTijd),
    doelSeconden: invoer.doelTijd ? parseTijd(invoer.doelTijd) : null,
    helling: Number(invoer.helling),
    trainingsdagen: DAGEN.filter((d) => invoer.trainingsdagen.includes(d)),
  };
  let resultaat = { ...profiel, gewicht: Number(invoer.gewicht) };

  if (invoer.doelDatum !== profiel.doelDatum) {
    const extra = extraWeken(vandaag, invoer.doelDatum);
    resultaat = { ...resultaat, doelDatum: invoer.doelDatum, extraWeken: extra, extraWekenKeuze: extra > 0 ? invoer.extraWekenKeuze : null };
  }

  const begonnen = maakPlan(resultaat, { vandaag }).start <= vandaag;
  if (!begonnen) return { ...resultaat, ...nieuw, historie: [] };

  const nu = effectiefProfiel(resultaat, vandaag);
  const dezeWeek = maandagVan(vandaag);
  const volgendeWeek = plusDagen(dezeWeek, 7);
  const historie = [...(resultaat.historie ?? [])];
  const zet = (vanaf, velden) => {
    const gewijzigd = Object.fromEntries(velden.filter((v) => JSON.stringify(nieuw[v]) !== JSON.stringify(nu[v])).map((v) => [v, nieuw[v]]));
    if (!Object.keys(gewijzigd).length) return;
    // Latere wijzigingen van dezelfde velden vervallen: de nieuwe keuze geldt vanaf nu.
    for (const h of historie) if (h.vanaf >= vanaf) for (const v of Object.keys(gewijzigd)) delete h[v];
    const bestaand = historie.find((h) => h.vanaf === vanaf);
    if (bestaand) Object.assign(bestaand, gewijzigd);
    else historie.push({ vanaf, ...gewijzigd });
  };
  zet(dezeWeek, VANAF_DEZE_WEEK);
  zet(volgendeWeek, VANAF_VOLGENDE_WEEK);
  return {
    ...resultaat,
    historie: historie.filter((h) => Object.keys(h).length > 1).sort((a, b) => a.vanaf.localeCompare(b.vanaf)),
  };
}

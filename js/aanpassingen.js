// Aanpassingen per week: trainingen verschuiven en dagen vrij zetten, zonder de rest van het schema te raken.
// Bewaard als { verplaatst: { trainingId: datum }, vrij: [datum, ...] }.
import { DAGEN } from './profiel.js';
import { naarDatum, plusDagen } from './datum.js';
import { meldOpgeslagen } from './opgeslagen.js';

export const OPSLAG_AANPASSINGEN = 'hardloop-app.aanpassingen.v1';
const ZWAAR = ['kwaliteit', 'lang', 'doel'];
// Wat het eerst vervalt als er een dag minder is.
const PRIORITEIT = (t) => (t.type === 'doel' ? 0 : t.type === 'lang' ? 1 : t.type === 'kwaliteit' ? 2 : t.extra ? 4 : 3);

const dagVan = (iso) => DAGEN[(naarDatum(iso).getUTCDay() + 6) % 7];
const zelfdeWeek = (week, datum) => datum >= week.maandag && datum <= plusDagen(week.maandag, 6);

export function legeAanpassingen() {
  return { verplaatst: {}, vrij: [] };
}

export function laadAanpassingen(opslag) {
  try {
    const a = JSON.parse(opslag.getItem(OPSLAG_AANPASSINGEN));
    return a && a.verplaatst && Array.isArray(a.vrij) ? a : legeAanpassingen();
  } catch {
    return legeAanpassingen();
  }
}

export function bewaarAanpassingen(opslag, a) {
  opslag.setItem(OPSLAG_AANPASSINGEN, JSON.stringify(a));
  meldOpgeslagen(OPSLAG_AANPASSINGEN);
}

// Verplaats een training naar een andere dag van dezelfde week. Staat daar al een training, dan ruilen ze.
export function verplaats(plan, aanpassingen, trainingId, naarDatum) {
  const week = plan.weken.find((w) => w.trainingen.some((t) => t.id === trainingId));
  if (!week) throw new Error('Onbekende training');
  if (!zelfdeWeek(week, naarDatum)) throw new Error('Alleen binnen dezelfde week');
  const training = week.trainingen.find((t) => t.id === trainingId);
  if (training.type === 'doel') throw new Error('De doelloop blijft op je doeldatum');
  const andere = week.trainingen.find((t) => t.datum === naarDatum && t.id !== trainingId);
  if (andere?.type === 'doel') throw new Error('Op je doeldatum staat je doelloop');
  const verplaatst = { ...aanpassingen.verplaatst, [trainingId]: naarDatum };
  if (andere) verplaatst[andere.id] = training.datum;
  const vrij = aanpassingen.vrij.filter((d) => d !== naarDatum);
  return { ...aanpassingen, verplaatst, vrij };
}

export function zetVrij(aanpassingen, datum, vrij = true) {
  const lijst = aanpassingen.vrij.filter((d) => d !== datum);
  return { ...aanpassingen, vrij: vrij ? [...lijst, datum].sort() : lijst };
}

// Pas alle aanpassingen toe op het plan. Elke week krijgt ook `vervallen` en `waarschuwingen`.
export function pasToe(plan, aanpassingen) {
  const vrij = new Set(aanpassingen.vrij);
  const weken = plan.weken.map((week) => {
    let trainingen = week.trainingen.map((t) => {
      const datum = aanpassingen.verplaatst[t.id];
      return datum && zelfdeWeek(week, datum) ? { ...t, datum, dag: dagVan(datum), verplaatst: true } : t;
    });
    // Vrije dagen: de minst belangrijke trainingen vallen af, de belangrijke schuiven naar de vrijgekomen dagen.
    const geraakt = trainingen.filter((t) => vrij.has(t.datum) && t.type !== 'doel');
    const vervallen = [];
    if (geraakt.length) {
      const beschikbaar = trainingen.filter((t) => !vrij.has(t.datum) || t.type === 'doel');
      const volgorde = [...trainingen].sort((a, b) => PRIORITEIT(a) - PRIORITEIT(b));
      const houden = volgorde.slice(0, beschikbaar.length);
      vervallen.push(...volgorde.slice(beschikbaar.length));
      const vrijePlekken = beschikbaar.filter((t) => !houden.includes(t)).map((t) => t.datum).sort();
      trainingen = houden.map((t) => {
        if (!vrij.has(t.datum) || t.type === 'doel') return t;
        const datum = vrijePlekken.shift();
        return { ...t, datum, dag: dagVan(datum), verplaatst: true };
      });
    }
    trainingen.sort((a, b) => a.datum.localeCompare(b.datum));
    return { ...week, trainingen, vervallen };
  });
  const resultaat = { ...plan, weken };
  const waarschuwingen = controleer(resultaat);
  for (const w of weken) w.waarschuwingen = waarschuwingen.filter((x) => zelfdeWeek(w, x.datum));
  return resultaat;
}

// Regels: geen twee zware trainingen op opeenvolgende dagen en een rustdag na de lange loop.
// Overtreding geeft een waarschuwing, geen blokkade. Kijkt ook over de weekgrens heen.
export function controleer(plan) {
  const alle = plan.weken.flatMap((w) => w.trainingen).sort((a, b) => a.datum.localeCompare(b.datum));
  const opDatum = new Map(alle.map((t) => [t.datum, t]));
  const meldingen = [];
  for (const t of alle) {
    const volgende = opDatum.get(plusDagen(t.datum, 1));
    if (!volgende) continue;
    if (ZWAAR.includes(t.type) && ZWAAR.includes(volgende.type)) {
      meldingen.push({ datum: volgende.datum, soort: 'zwaar-na-zwaar', tekst: `Twee zware trainingen achter elkaar: ${t.naam} en ${volgende.naam}.` });
    } else if (t.type === 'lang') {
      meldingen.push({ datum: volgende.datum, soort: 'geen-rust-na-lang', tekst: `Geen rustdag na de lange loop: ${volgende.naam} valt de dag erna.` });
    }
  }
  return meldingen;
}

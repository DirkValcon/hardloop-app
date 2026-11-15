// Aanpassingen per week: trainingen verschuiven en dagen vrij zetten, zonder de rest van het schema te raken.
// Bewaard als { verplaatst: { trainingId: datum }, vrij: [datum, ...], vakanties: [{ van, tot, dagen }] }.
import { DAGEN } from './profiel.js';
import { naarDatum, plusDagen, maandagVan, dagenTussen } from './datum.js';
import { meldOpgeslagen } from './opgeslagen.js';

export const OPSLAG_AANPASSINGEN = 'hardloop-app.aanpassingen.v1';
const ZWAAR = ['kwaliteit', 'lang', 'doel'];
// Wat het eerst vervalt als er een dag minder is.
const PRIORITEIT = (t) => (t.type === 'doel' ? 0 : t.type === 'lang' ? 1 : t.type === 'kwaliteit' ? 2 : t.extra ? 4 : 3);

const dagVan = (iso) => DAGEN[(naarDatum(iso).getUTCDay() + 6) % 7];
const zelfdeWeek = (week, datum) => datum >= week.maandag && datum <= plusDagen(week.maandag, 6);

export function legeAanpassingen() {
  return { verplaatst: {}, vrij: [], vakanties: [] };
}

export function laadAanpassingen(opslag) {
  try {
    const a = JSON.parse(opslag.getItem(OPSLAG_AANPASSINGEN));
    return a && a.verplaatst && Array.isArray(a.vrij) ? { ...a, vakanties: Array.isArray(a.vakanties) ? a.vakanties : [] } : legeAanpassingen();
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

// ---------- Vakantie ----------
// Een vakantie is een periode (van t/m tot) met de dagen waarop je toch traint. Het schema loopt in
// volgorde door: trainingen die niet in de vakantie passen schuiven naar de trainingsdagen erna, en
// alles daarna schuift evenveel trainingsdagen op. De doelloop schuift evenveel dagen mee als de
// laatste training ervoor.

export function voegVakantieToe(aanpassingen, { van, tot, dagen = [] }) {
  if (!van || !tot || tot < van) throw new Error('Kies een periode: de einddatum ligt vóór de begindatum');
  if (dagenTussen(van, tot) > 60) throw new Error('Een vakantie duurt hoogstens 2 maanden');
  const binnen = [...new Set(dagen)].filter((d) => d >= van && d <= tot).sort();
  // Een nieuwe vakantie vervangt een vakantie die ermee overlapt.
  const rest = (aanpassingen.vakanties ?? []).filter((v) => v.tot < van || v.van > tot);
  return { ...aanpassingen, vakanties: [...rest, { van, tot, dagen: binnen }].sort((a, b) => a.van.localeCompare(b.van)) };
}

export function verwijderVakantie(aanpassingen, van) {
  return { ...aanpassingen, vakanties: (aanpassingen.vakanties ?? []).filter((v) => v.van !== van) };
}

function schuifVakantie(plan, vakantie) {
  const alle = plan.weken.flatMap((w) => w.trainingen.map((t) => ({ t, w })))
    .sort((a, b) => a.t.datum.localeCompare(b.t.datum));
  const gewoneAlle = alle.filter((x) => x.t.type !== 'doel');
  const na = gewoneAlle.filter((x) => x.t.datum >= vakantie.van);
  const doel = alle.find((x) => x.t.type === 'doel' && x.t.datum >= vakantie.van);
  const inVakantie = na.filter((x) => x.t.datum <= vakantie.tot).length;
  const kanDagen = vakantie.dagen.slice(0, inVakantie);
  const tekort = inVakantie - kanDagen.length;
  const plekken = [...kanDagen, ...na.filter((x) => x.t.datum > vakantie.tot).map((x) => x.t.datum)];
  // Extra plekken achteraan: het weekritme van de laatste 7 dagen herhalen.
  if (tekort > 0) {
    const laatste = gewoneAlle.at(-1).t.datum;
    const ritme = gewoneAlle.map((x) => x.t.datum).filter((d) => d > plusDagen(laatste, -7));
    for (let j = 0; j < tekort; j++) plekken.push(plusDagen(ritme[j % ritme.length], 7 * (1 + Math.floor(j / ritme.length))));
  }
  const nieuweDatum = new Map(na.map((x, i) => [x.t.id, plekken[i]]));
  let verschuiving = 0;
  if (na.length) verschuiving = dagenTussen(na.at(-1).t.datum, plekken[na.length - 1]);
  if (doel) {
    const laatsteNieuw = na.length ? plekken[na.length - 1] : null;
    let datum = plusDagen(doel.t.datum, tekort > 0 ? verschuiving : 0);
    if (laatsteNieuw && datum <= laatsteNieuw) datum = plusDagen(laatsteNieuw, 1);
    nieuweDatum.set(doel.t.id, datum);
  }

  // Opnieuw per kalenderweek indelen; schuift er iets voorbij de laatste week, dan komt er een week bij.
  const weken = plan.weken.map((w) => ({ ...w, trainingen: [] }));
  for (const { t } of alle) {
    const datum = nieuweDatum.get(t.id) ?? t.datum;
    const maandag = maandagVan(datum);
    let week = weken.find((w) => w.maandag === maandag);
    if (!week) {
      const vorige = weken.at(-1);
      const nummer = vorige.nummer + 1;
      week = { ...vorige, nummer, label: `Week ${nummer}`, maandag, trainingen: [] };
      weken.push(week);
      weken.sort((a, b) => a.maandag.localeCompare(b.maandag));
    }
    week.trainingen.push(datum === t.datum ? t : { ...t, datum, dag: dagVan(datum), vakantie: true });
  }
  for (const w of weken) w.trainingen.sort((a, b) => a.datum.localeCompare(b.datum));
  const doelDatum = doel ? nieuweDatum.get(doel.t.id) : plan.doelDatum;
  const info = { ...vakantie, doelVerschuiving: doel ? dagenTussen(doel.t.datum, doelDatum) : 0 };
  return { ...plan, weken: weken.filter((w) => w.trainingen.length || w.maandag <= plan.weken.at(-1).maandag),
    doelDatum, vakanties: [...(plan.vakanties ?? []), info] };
}

// Alle vakanties toepassen, in volgorde van datum.
export function pasVakantiesToe(plan, vakanties = []) {
  return [...vakanties].sort((a, b) => a.van.localeCompare(b.van)).reduce(schuifVakantie, { ...plan, vakanties: [] });
}

// Pas alle aanpassingen toe op het plan. Elke week krijgt ook `vervallen` en `waarschuwingen`.
// Eerst de vakanties (die schuiven het schema door), daarna verplaatsen en vrije dagen per week.
export function pasToe(basisplan, aanpassingen) {
  const plan = pasVakantiesToe(basisplan, aanpassingen.vakanties);
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

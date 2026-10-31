// Scherm Vandaag: de training van vandaag (of de eerstvolgende) met duur, afstand en calorieën.
import { volgendeTraining } from './schema.js';
import { huidigPlan } from './plan.js';
import { effectiefProfiel } from './instellingen.js';
import { laadResultaten, markeerOvergeslagen, maakOngedaan } from './resultaten.js';
import { toonMelding } from './melding.js';
import { laadAanpassingen, bewaarAanpassingen, verplaats } from './aanpassingen.js';
import { plusDagen } from './datum.js';
import { kcalTraining } from './calorieen.js';
import { vandaagIso, dagenTussen, datumTekst, naarDatum } from './datum.js';
import { kmh, km, minuten, korteDatum } from './opmaak.js';

const TYPE = { rustig: 'Rustige loop', kwaliteit: 'Kwaliteitstraining', lang: 'Lange duurloop', doel: 'Doeldag' };
const DAGNAAM = { ma: 'maandag', di: 'dinsdag', wo: 'woensdag', do: 'donderdag', vr: 'vrijdag', za: 'zaterdag', zo: 'zondag' };

// Samenvatting in fases: warming-up, kern, cooling-down.
function fases(t) {
  const som = (bl) => bl.reduce((s, b) => s + b.duurSec, 0);
  const warm = t.blokken.filter((b) => b.soort === 'warmup');
  const cool = t.blokken.filter((b) => b.soort === 'uitjoggen' || b.soort === 'uitwandelen');
  const kern = t.blokken.filter((b) => !warm.includes(b) && !cool.includes(b));
  const snelheden = [...new Set(kern.map((b) => b.kmh))].sort((a, b) => a - b);
  const bereik = (l) => (l.length > 1 ? `${kmh(l[0])}–${kmh(l.at(-1))}` : kmh(l[0]));
  return [
    { naam: 'Warming-up', duur: som(warm), snelheid: bereik(warm.map((b) => b.kmh)) },
    { naam: t.naam, duur: som(kern), snelheid: bereik(snelheden) },
    { naam: 'Uitjoggen + uitwandelen', duur: som(cool), snelheid: bereik(cool.map((b) => b.kmh).sort((a, b) => a - b)) },
  ];
}

const dagVan = (iso) => ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'][naarDatum(iso).getUTCDay()];

// Gemiste trainingen van deze week: verplaatsen naar een vrije dag later deze week, overslaan of toch afvinken.
function gemistHtml(gemist, week, vandaag) {
  if (!gemist.length) return '';
  const bezet = new Set(week.trainingen.map((t) => t.datum));
  const vrij = Array.from({ length: 7 }, (_, i) => plusDagen(week.maandag, i)).filter((d) => d >= vandaag && !bezet.has(d));
  // Compact onder de training van vandaag; tik open om in te plannen, over te slaan of af te vinken.
  return gemist.map((t) => `
    <details class="kaart gemist" data-test="gemist" data-training="${t.id}">
      <summary><span class="gemist-icoon" aria-hidden="true">!</span>
        <span class="gemist-wat"><strong>${DAGNAAM[t.dag][0].toUpperCase()}${DAGNAAM[t.dag].slice(1)} gemist</strong><small>${t.naam} · ${korteDatum(t.datum)}</small></span>
        <span class="gemist-actie">Inplannen</span></summary>
      ${vrij.length ? `<div class="hint">Verplaats naar een vrije dag:</div><div class="dagknoppen">${vrij.map((d) =>
        `<button type="button" class="dagknop" data-verplaats="${t.id}" data-naar="${d}">${DAGNAAM[dagVan(d)].slice(0, 2)}<br><small>${korteDatum(d)}</small></button>`).join('')}</div>` : '<div class="hint">Er is geen vrije dag meer deze week.</div>'}
      <div class="knoppen">
        <button type="button" class="secundair" data-overslaan="${t.id}">Overslaan</button>
        <a class="knop secundair" href="#afvinken/${t.id}">Toch gedaan</a>
      </div>
    </details>`).join('');
}

// Na Ongedaan maken het huidige scherm opnieuw tekenen (ook als je intussen een ander tabblad opende).
const verversScherm = () => window.dispatchEvent(new HashChangeEvent('hashchange'));

const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const hoofdletter = (t) => t[0].toUpperCase() + t.slice(1);

// Kop boven Vandaag: "Donderdag 12 november · week 2 van 11".
function datumKop(plan, week, vandaag) {
  const d = naarDatum(vandaag);
  const dag = `${hoofdletter(DAGNAAM[dagVan(vandaag)])} ${d.getUTCDate()} ${MAANDEN[d.getUTCMonth()]}`;
  if (!week) return dag;
  const aantal = plan.weken.filter((w) => w.soort !== 'basis').length;
  return `${dag} · ${week.soort === 'basis' ? week.label.toLowerCase() : `week ${week.nummer} van ${aantal}`}`;
}

// Strook met de zeven dagen van de week: gedaan, gemist, gepland of rustdag. Tik op een dag met
// een training om die te bekijken.
function weekstrookHtml(week, resultaten, vandaag, getoond) {
  return `<div class="weekstrook" data-test="weekstrook">${Array.from({ length: 7 }, (_, i) => {
    const datum = plusDagen(week.maandag, i);
    const d = naarDatum(datum).getUTCDate();
    const dag = dagVan(datum);
    const t = week.trainingen.find((x) => x.datum === datum);
    const nu = datum === vandaag ? ' is-vandaag' : '';
    if (!t) return `<span class="weekdag is-rust${nu}" aria-label="${DAGNAAM[dag]} ${d}: rustdag"><small>${dag}</small><b>${d}</b></span>`;
    const r = resultaten[t.id]?.status;
    const status = r ?? (datum < vandaag ? 'gemist' : 'gepland');
    return `<button type="button" class="weekdag is-${status} training-${t.type}${nu}${t.id === getoond ? ' is-gekozen' : ''}"
      data-toon="${t.id}" data-status="${status}" aria-label="${DAGNAAM[dag]} ${d}: ${t.naam}, ${status}"><small>${dag}</small><b>${d}</b></button>`;
  }).join('')}</div>`;
}

export function toonVandaag(root, profiel, { vandaag = vandaagIso(), opslag = localStorage, gekozen = null } = {}) {
  const plan = huidigPlan(profiel, vandaag, opslag);
  const resultaten = laadResultaten(opslag);
  const alle = plan.weken.flatMap((w) => w.trainingen);
  const deWeek = plan.weken.find((w) => vandaag >= w.maandag && vandaag <= plusDagen(w.maandag, 6));
  const strookWeek = deWeek ?? (vandaag < plan.weken[0].maandag ? plan.weken[0] : null);
  const gemist = deWeek ? deWeek.trainingen.filter((t) => t.datum < vandaag && !resultaten[t.id]) : [];
  // Wat vandaag gelopen is, ook als die training voor een andere dag gepland stond.
  const vandaagGedaan = alle.filter((t) => resultaten[t.id]?.status === 'gedaan' && resultaten[t.id].datum === vandaag);
  const volgende = volgendeTraining(plan, vandaag, resultaten);
  // Een dag uit de weekstrook, anders de eerstvolgende training.
  const keuzeT = gekozen && gekozen !== volgende?.training.id ? alle.find((x) => x.id === gekozen) : null;
  const toon = keuzeT ? { training: keuzeT, week: plan.weken.find((w) => w.trainingen.includes(keuzeT)), isVandaag: keuzeT.datum === vandaag } : volgende;
  const opnieuw = (extra = {}) => toonVandaag(root, profiel, { vandaag, opslag, ...extra });

  root.onclick = (e) => {
    const knop = e.target.closest('button');
    if (knop?.dataset.toon) {
      opnieuw({ gekozen: knop.dataset.toon === toon?.training.id ? null : knop.dataset.toon });
    } else if (knop?.dataset.verplaats) {
      const voor = laadAanpassingen(opslag);
      bewaarAanpassingen(opslag, verplaats(plan, voor, knop.dataset.verplaats, knop.dataset.naar));
      opnieuw();
      toonMelding(`Verplaatst naar ${DAGNAAM[dagVan(knop.dataset.naar)]} ${korteDatum(knop.dataset.naar)}`, {
        actie: 'Ongedaan maken', bijActie: () => { bewaarAanpassingen(opslag, voor); verversScherm(); },
      });
    } else if (knop?.dataset.overslaan) {
      const t = alle.find((x) => x.id === knop.dataset.overslaan);
      markeerOvergeslagen(opslag, t, vandaag);
      opnieuw();
      toonMelding('Training overgeslagen', {
        actie: 'Ongedaan maken', bijActie: () => { maakOngedaan(opslag, t.id); verversScherm(); },
      });
    }
  };

  const kop = `<p class="groet" data-test="datumkop">${datumKop(plan, strookWeek, vandaag)}</p><h1>Vandaag</h1>
    ${strookWeek ? weekstrookHtml(strookWeek, resultaten, vandaag, toon?.training.id) : ''}`;

  const gedaanHtml = vandaagGedaan.map((t) => {
    const r = resultaten[t.id];
    return `<div class="kaart gedaan" data-test="vandaag-gedaan"><div class="label label-gedaan">✓ Vandaag gedaan</div>
      <strong>${t.naam}</strong><div class="hint">${km(r.afstandKm)} km · ${minuten(r.duurSec)} · ${r.kcal} kcal</div></div>`;
  }).join('');

  if (!toon) {
    root.innerHTML = `${kop}${gedaanHtml}
      <div class="kaart"><p>Je schema zit erop. Gefeliciteerd met je ${plan.doelNaam}!</p></div>
      ${gemistHtml(gemist, deWeek ?? plan.weken.at(-1), vandaag)}`;
    return;
  }
  const { training: t, week, isVandaag } = toon;
  const r = resultaten[t.id];
  const dagen = dagenTussen(vandaag, t.datum);
  const wanneer = isVandaag ? 'Vandaag'
    : dagen === 1 ? 'Morgen' : dagen === -1 ? 'Gisteren' : `${hoofdletter(DAGNAAM[t.dag])} ${korteDatum(t.datum)}`;
  const rustdag = keuzeT || isVandaag || vandaagGedaan.length ? '' : `<p class="uitleg" data-test="rustdag">${plan.weken[0].maandag > vandaag && week === plan.weken[0]
    ? `Je schema start op ${datumTekst(plan.weken[0].maandag)}.` : 'Vandaag is een rustdag.'} Dit is je volgende training.</p>`;
  const totDoel = dagenTussen(vandaag, plan.doelDatum);
  const acties = r?.status === 'gedaan'
    ? `<p class="status-regel is-gedaan" data-test="status">✓ Gedaan${r.datum !== t.datum ? ` op ${korteDatum(r.datum)}` : ''}: ${km(r.afstandKm)} km · ${minuten(r.duurSec)} · ${r.kcal} kcal</p>`
    : r?.status === 'overgeslagen'
      ? '<p class="status-regel" data-test="status">Overgeslagen</p>'
      : `<a class="knop primair breed" href="#loop/${t.id}" role="button" data-actie="start">${isVandaag ? 'Start op loopband' : 'Nu al starten'}</a>
      ${isVandaag ? `<div class="knoppen klein-knoppen">
        <a class="knop secundair" href="#afvinken/${t.id}">Afvinken zonder app</a>
        <button type="button" class="secundair" data-overslaan="${t.id}">Overslaan</button>
      </div>` : ''}`;

  root.innerHTML = `
    ${kop}
    ${keuzeT ? '' : gedaanHtml}
    ${rustdag}
    ${vandaagGedaan.length && !keuzeT ? '<h2>Volgende training</h2>' : ''}
    <article class="kaart vandaag-kaart training-${t.type}" data-test="vandaag" data-training="${t.id}">
      <div class="stapnr">${wanneer} · ${week.label}</div>
      <div class="label label-${t.type}">${TYPE[t.type]}</div>
      <h2 class="vandaag-titel">${t.naam}</h2>
      <div class="cijfers">
        <div><strong data-test="duur">${minuten(t.duurSec)}</strong><small>totaal</small></div>
        <div><strong data-test="afstand">${km(t.afstandKm)} km</strong><small>ongeveer</small></div>
        <div><strong data-test="kcal">${kcalTraining(t, profiel.gewicht)}</strong><small>kcal geschat</small></div>
      </div>
      ${acties}
      <ol class="fases" aria-label="Opbouw">${fases(t).map((f) => `
        <li><span>${f.naam}<small>${minuten(f.duur)}</small></span><span class="blok-waarden"><strong>${f.snelheid}</strong> km/u</span></li>`).join('')}
      </ol>
      <p class="hint">Helling ${String(effectiefProfiel(profiel, vandaag).helling).replace('.', ',')}% · uitwandelen op 0%</p>
    </article>
    ${keuzeT ? '<button type="button" class="secundair breed" data-toon="' + (volgende?.training.id ?? '-') + '">Terug naar je volgende training</button>' : ''}
    ${keuzeT ? '' : gemistHtml(gemist, deWeek, vandaag)}
    <p class="hint" data-test="tot-doel">Nog ${totDoel} ${totDoel === 1 ? 'dag' : 'dagen'} tot je ${plan.doelNaam} op ${datumTekst(plan.doelDatum)}.</p>`;
}

// Scherm Schema: alle weken met hun trainingen. Tik een training open voor de blokken en om hem
// naar een andere dag van dezelfde week te verplaatsen; per week kun je dagen vrij zetten.
import { maakPlan } from './schema.js';
import { laadAanpassingen, bewaarAanpassingen, verplaats, zetVrij, pasToe } from './aanpassingen.js';
import { DAGEN } from './profiel.js';
import { plusDagen, vandaagIso } from './datum.js';
import { kmh, km, minuten, blokDuur, korteDatum } from './opmaak.js';
import { kcalTraining } from './calorieen.js';
import { laadResultaten, maakOngedaan } from './resultaten.js';

const DAGNAAM = { ma: 'Ma', di: 'Di', wo: 'Wo', do: 'Do', vr: 'Vr', za: 'Za', zo: 'Zo' };
const TYPE = { rustig: 'Rustig', kwaliteit: 'Kwaliteit', lang: 'Lang', doel: 'Doel' };
const BADGE = { herstel: 'Herstelweek', taper: 'Laatste week', basis: 'Basis' };
// Taperweken vóór de laatste week heten "Rustiger aan".
const badge = (w, laatste) => {
  const naam = w.soort === 'taper' && !laatste ? 'Rustiger aan' : BADGE[w.soort];
  return naam ? `<span class="badge badge-${w.soort}">${naam}</span>` : '';
};
const weekId = (w) => `${w.soort === 'basis' ? 'b' : ''}${w.nummer}`;

function blokRegel(b) {
  const nr = b.herhaling && b.van ? ` ${b.herhaling}/${b.van}` : b.deel ? ` ${b.deel}` : '';
  const wat = b.afstandM ? `${b.afstandM >= 1000 ? km(b.afstandM / 1000) + ' km' : b.afstandM + ' m'} · ${blokDuur(b.duurSec)}` : blokDuur(b.duurSec);
  return `<li class="blok blok-${b.soort}"><span>${b.label}${nr}<small>${wat}</small></span>
    <span class="blok-waarden"><strong>${kmh(b.kmh)}</strong> km/u<small>${String(b.helling).replace('.', ',')}% helling</small></span></li>`;
}

function verplaatsHtml(t, week, vandaag) {
  if (t.type === 'doel') return `<p class="hint">De ${t.naam.replace(/ op doeltijd$/, '')} staat vast op je doeldatum.</p>`;
  if (t.datum < vandaag) return '';
  const knoppen = DAGEN.map((d, i) => {
    const datum = plusDagen(week.maandag, i);
    const kan = datum !== t.datum && datum >= vandaag && !(week.trainingen.find((x) => x.datum === datum)?.type === 'doel');
    return `<button type="button" class="dagknop" data-verplaats="${t.id}" data-naar="${datum}" ${kan ? '' : 'disabled'}
      aria-label="Verplaats naar ${d} ${korteDatum(datum)}">${d}</button>`;
  }).join('');
  return `<div class="verplaats"><span class="hint">Verplaats naar</span><div class="dagknoppen">${knoppen}</div></div>`;
}

function statusHtml(t, r, vandaag) {
  if (r?.status === 'gedaan') {
    const op = r.datum !== t.datum ? ` op ${korteDatum(r.datum)}` : '';
    return `<div class="status"><span class="hint">✓ Gedaan${op}: ${km(r.afstandKm)} km · ${minuten(r.duurSec)} · ${r.kcal} kcal</span>
      <button type="button" class="secundair klein" data-ongedaan="${t.id}">Ongedaan maken</button></div>`;
  }
  if (r?.status === 'overgeslagen') {
    return `<div class="status"><span class="hint">Overgeslagen</span>
      <button type="button" class="secundair klein" data-ongedaan="${t.id}">Ongedaan maken</button></div>`;
  }
  // Elke training kan op elk moment gestart worden; hij telt dan voor de dag waarop je hem loopt.
  return `<div class="status"><a class="knop primair klein" href="#loop/${t.id}" data-test="start">Start</a>
    <a class="knop secundair klein" href="#afvinken/${t.id}">Afvinken</a></div>`;
}

function trainingHtml(t, week, vandaag, gewicht, r) {
  const status = r?.status === 'gedaan' ? ' is-gedaan' : r?.status === 'overgeslagen' ? ' is-overgeslagen' : '';
  const statusLabel = r?.status === 'gedaan' ? ' · <span class="label-gedaan">✓ gedaan</span>' : r?.status === 'overgeslagen' ? ' · overgeslagen' : '';
  return `
    <details class="training training-${t.type}${status}${t.datum === vandaag ? ' is-vandaag' : ''}" data-training="${t.id}">
      <summary>
        <span class="dag">${DAGNAAM[t.dag]}<small>${korteDatum(t.datum)}</small></span>
        <span class="wat"><span class="label label-${t.type}">${TYPE[t.type]}${t.verplaatst ? ' · verplaatst' : ''}${statusLabel}</span>${t.naam}
          <small>${minuten(t.duurSec)} · ca. ${km(t.afstandKm)} km · ${kcalTraining(t, gewicht)} kcal</small></span>
      </summary>
      ${statusHtml(t, r, vandaag)}
      ${r ? '' : verplaatsHtml(t, week, vandaag)}
      <ol class="blokken">${t.blokken.map(blokRegel).join('')}</ol>
    </details>`;
}

function weekHtml(w, aanpassingen, vandaag, gewicht, huidig, resultaten, laatste = true) {
  const vrij = new Set(aanpassingen.vrij);
  const vrijKnoppen = DAGEN.map((d, i) => {
    const datum = plusDagen(w.maandag, i);
    return `<button type="button" class="dagknop${vrij.has(datum) ? ' is-vrij' : ''}" data-vrij="${datum}"
      aria-pressed="${vrij.has(datum)}" ${datum < vandaag ? 'disabled' : ''} aria-label="${d} ${korteDatum(datum)} vrij">${d}</button>`;
  }).join('');
  return `
    <section class="week${huidig ? ' is-huidig' : ''}" data-week="${weekId(w)}" id="week-${weekId(w)}">
      <h2>${w.label} ${badge(w, laatste)}
        <small>${korteDatum(w.maandag)} – ${korteDatum(plusDagen(w.maandag, 6))}</small></h2>
      ${w.waarschuwingen.map((x) => `<div class="melding melding-te-snel" data-test="waarschuwing">⚠ ${x.tekst}</div>`).join('')}
      <div class="kaart trainingen">${w.trainingen.map((t) => trainingHtml(t, w, vandaag, gewicht, resultaten[t.id])).join('')}</div>
      ${w.vervallen.length ? `<p class="hint" data-test="vervallen">Vervalt deze week: ${w.vervallen.map((t) => t.naam).join(', ')}.</p>` : ''}
      <details class="week-aanpassen">
        <summary>Dagen vrij zetten deze week</summary>
        <div class="dagknoppen">${vrijKnoppen}</div>
        <p class="hint">Een vrije dag laat eerst een rustige loop vervallen; kwaliteit en lange loop blijven zo lang mogelijk staan.</p>
      </details>
    </section>`;
}

export function toonSchema(root, profiel, { vandaag = vandaagIso(), opslag = localStorage } = {}) {
  const basisplan = maakPlan(profiel, { vandaag });
  let aanpassingen = laadAanpassingen(opslag);

  function teken({ scroll = false, openWeek = null, openTraining = null } = {}) {
    const plan = pasToe(basisplan, aanpassingen);
    const huidige = plan.weken.find((w) => vandaag >= w.maandag && vandaag <= plusDagen(w.maandag, 6));
    const start = plan.weken[0].maandag > vandaag
      ? `<p class="uitleg">Je schema start op maandag ${korteDatum(plan.weken[0].maandag)}.</p>` : '';
    root.innerHTML = `<h1>Schema</h1>${start}
      <p class="hint">Tik op een training om de blokken te zien of hem naar een andere dag te verplaatsen.</p>
      ${plan.weken.map((w) => weekHtml(w, aanpassingen, vandaag, profiel.gewicht, w === huidige, laadResultaten(opslag), w === plan.weken.at(-1))).join('')}`;
    if (openWeek) root.querySelector(`#week-${openWeek} .week-aanpassen`)?.setAttribute('open', '');
    if (openTraining) root.querySelector(`[data-training="${openTraining}"]`)?.setAttribute('open', '');
    const doel = root.querySelector(openWeek ? `#week-${openWeek}` : '.week.is-huidig');
    if (scroll || openWeek) doel?.scrollIntoView({ block: 'start' });
  }

  root.onclick = (e) => {
    const knop = e.target.closest('button');
    if (!knop || knop.disabled) return;
    const week = knop.closest('.week')?.dataset.week;
    if (knop.dataset.verplaats) {
      aanpassingen = verplaats(pasToe(basisplan, aanpassingen), aanpassingen, knop.dataset.verplaats, knop.dataset.naar);
      bewaarAanpassingen(opslag, aanpassingen);
      teken({ openWeek: week, openTraining: knop.dataset.verplaats });
      root.querySelector(`#week-${week} .week-aanpassen`)?.removeAttribute('open');
    } else if (knop.dataset.ongedaan) {
      maakOngedaan(opslag, knop.dataset.ongedaan);
      teken({ openWeek: week, openTraining: knop.dataset.ongedaan });
      root.querySelector(`#week-${week} .week-aanpassen`)?.removeAttribute('open');
    } else if (knop.dataset.vrij) {
      aanpassingen = zetVrij(aanpassingen, knop.dataset.vrij, knop.getAttribute('aria-pressed') !== 'true');
      bewaarAanpassingen(opslag, aanpassingen);
      teken({ openWeek: week });
    }
  };
  teken({ scroll: true });
}

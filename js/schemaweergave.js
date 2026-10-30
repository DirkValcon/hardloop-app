// Scherm Schema: alle weken met hun trainingen; tik een training open voor de blokken.
import { maakPlan } from './schema.js';
import { plusDagen, vandaagIso } from './datum.js';
import { kmh, km, minuten, blokDuur, korteDatum } from './opmaak.js';
import { kcalTraining } from './calorieen.js';

const DAGNAAM = { ma: 'Ma', di: 'Di', wo: 'Wo', do: 'Do', vr: 'Vr', za: 'Za', zo: 'Zo' };
const TYPE = { rustig: 'Rustig', kwaliteit: 'Kwaliteit', lang: 'Lang', doel: 'Doel' };
const BADGE = { herstel: 'Herstelweek', taper: 'Laatste week', basis: 'Basis' };

function blokRegel(b) {
  const nr = b.herhaling && b.van ? ` ${b.herhaling}/${b.van}` : b.deel ? ` ${b.deel}` : '';
  const wat = b.afstandM ? `${b.afstandM >= 1000 ? km(b.afstandM / 1000) + ' km' : b.afstandM + ' m'} · ${blokDuur(b.duurSec)}` : blokDuur(b.duurSec);
  return `<li class="blok blok-${b.soort}"><span>${b.label}${nr}<small>${wat}</small></span>
    <span class="blok-waarden"><strong>${kmh(b.kmh)}</strong> km/u<small>${String(b.helling).replace('.', ',')}% helling</small></span></li>`;
}

function trainingHtml(t, vandaag, gewicht) {
  return `
    <details class="training training-${t.type}${t.datum === vandaag ? ' is-vandaag' : ''}" data-training="${t.id}">
      <summary>
        <span class="dag">${DAGNAAM[t.dag]}<small>${korteDatum(t.datum)}</small></span>
        <span class="wat"><span class="label label-${t.type}">${TYPE[t.type]}</span>${t.naam}
          <small>${minuten(t.duurSec)} · ca. ${km(t.afstandKm)} km · ${kcalTraining(t, gewicht)} kcal</small></span>
      </summary>
      <ol class="blokken">${t.blokken.map(blokRegel).join('')}</ol>
    </details>`;
}

export function toonSchema(root, profiel, { vandaag = vandaagIso() } = {}) {
  const plan = maakPlan(profiel, { vandaag });
  const huidige = plan.weken.find((w) => vandaag >= w.maandag && vandaag <= plusDagen(w.maandag, 6));
  const weken = plan.weken.map((w) => `
    <section class="week${w === huidige ? ' is-huidig' : ''}" data-week="${w.soort === 'basis' ? 'b' : ''}${w.nummer}" id="week-${w.soort === 'basis' ? 'b' : ''}${w.nummer}">
      <h2>${w.label} ${BADGE[w.soort] ? `<span class="badge badge-${w.soort}">${BADGE[w.soort]}</span>` : ''}
        <small>${korteDatum(w.maandag)} – ${korteDatum(plusDagen(w.maandag, 6))}</small></h2>
      <div class="kaart trainingen">${w.trainingen.map((t) => trainingHtml(t, vandaag, profiel.gewicht)).join('')}</div>
    </section>`).join('');
  const start = plan.weken[0].maandag > vandaag
    ? `<p class="uitleg">Je schema start op maandag ${korteDatum(plan.weken[0].maandag)}.</p>` : '';
  root.innerHTML = `<h1>Schema</h1>${start}${weken}`;
  root.querySelector('.week.is-huidig')?.scrollIntoView({ block: 'start' });
}

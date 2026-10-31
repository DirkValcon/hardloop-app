// Formulier om een training af te vinken: afstand (van het loopbandscherm), duur en calorieën.
import { valideerResultaat, markeerGedaan, schatKcal } from './resultaten.js';
import { vandaagIso } from './datum.js';
import { km, minuten } from './opmaak.js';
import { formatTijd } from './tijd.js';

const getal = (v) => Number(String(v).replace(',', '.'));

// Met `samenvatting` (na een training in de app) zie je eerst wat je gedaan hebt; de velden zitten dan
// achter "Aanpassen". Zonder samenvatting (afvinken zonder app) staan de velden meteen open.
export function afrondFormulier({ afstandKm, duurSec, kcal }, fouten = {}, { samenvatting = null } = {}) {
  const fout = (v) => (fouten[v] ? `<div class="foutmelding" role="alert">${fouten[v]}</div>` : '');
  const open = !samenvatting || Object.keys(fouten).length;
  return `
    <form class="afronden" novalidate data-test="afronden">
      ${samenvatting ? `
      <div class="samenvatting-tegels" data-test="samenvatting">
        <div class="tegel"><strong data-test="sam-afstand">${km(afstandKm)}</strong><small>km</small></div>
        <div class="tegel"><strong data-test="sam-duur">${minuten(duurSec)}</strong><small>tijd</small></div>
        <div class="tegel"><strong data-test="sam-tempo">${afstandKm > 0 ? formatTijd(duurSec / afstandKm) : '–'}</strong><small>per km</small></div>
        <div class="tegel"><strong data-test="sam-kcal">${kcal}</strong><small>kcal</small></div>
      </div>
      ${samenvatting.nr ? `<p class="hint" data-test="volgnummer">Training ${samenvatting.nr} van ${samenvatting.totaal} in je schema.</p>` : ''}` : ''}
      <details class="afronden-velden" ${open ? 'open' : ''}>
        <summary>${samenvatting ? 'Afstand, tijd of kcal aanpassen' : 'Gegevens'}</summary>
      <div class="veld">
        <label class="titel" for="afstandKm">Afstand (km)</label>
        <input type="text" inputmode="decimal" id="afstandKm" name="afstandKm" value="${km(afstandKm)}" ${fouten.afstandKm ? 'aria-invalid="true"' : ''}>
        <div class="hint">Neem de afstand over van het scherm van de loopband.</div>
        ${fout('afstandKm')}
      </div>
      <div class="veld">
        <label class="titel" for="duurMin">Duur (minuten)</label>
        <input type="text" inputmode="decimal" id="duurMin" name="duurMin" value="${Math.round(duurSec / 60)}" ${fouten.duurMin ? 'aria-invalid="true"' : ''}>
        ${fout('duurMin')}
      </div>
      <div class="veld">
        <label class="titel" for="kcal">Calorieën (kcal)</label>
        <input type="text" inputmode="numeric" id="kcal" name="kcal" value="${kcal}" ${fouten.kcal ? 'aria-invalid="true"' : ''}>
        <div class="hint">Geschat met je gewicht, snelheid en helling. Past zich aan als je de afstand wijzigt.</div>
        ${fout('kcal')}
      </div>
      </details>
      <div class="knoppen">
        <button type="button" class="secundair" data-actie="annuleer">Niet opslaan</button>
        <button type="submit" class="primair">Opslaan als gedaan</button>
      </div>
    </form>`;
}

// Koppelt het formulier: bij een andere afstand schuift de calorieschatting mee, tot je die zelf aanpast.
// `bevestig`: "Niet opslaan" vraagt eerst of je het zeker weet (na een training in de app gaat die anders verloren).
export function koppelAfronden(container, training, profiel, { opslag = localStorage, vandaag = vandaagIso(), opgeslagen, annuleer, samenvatting = null }) {
  const form = container.querySelector('form.afronden');
  let kcalZelf = false;
  form.kcal.addEventListener('input', () => { kcalZelf = true; });
  form.afstandKm.addEventListener('input', () => {
    const afstand = getal(form.afstandKm.value);
    if (!kcalZelf && afstand > 0) form.kcal.value = schatKcal(training, afstand, profiel.gewicht);
  });
  // De samenvatting bovenaan schuift mee met wat je aanpast.
  form.addEventListener('input', () => {
    const zet = (v, t) => { const el = form.querySelector(`[data-test=sam-${v}]`); if (el) el.textContent = t; };
    const afstand = getal(form.afstandKm.value);
    const sec = getal(form.duurMin.value) * 60;
    if (afstand > 0) zet('afstand', km(afstand));
    if (sec > 0) zet('duur', minuten(sec));
    if (afstand > 0 && sec > 0) zet('tempo', formatTijd(sec / afstand));
    if (getal(form.kcal.value) >= 0) zet('kcal', form.kcal.value);
  });
  const weg = form.querySelector('[data-actie=annuleer]');
  let zeker = null;
  weg.addEventListener('click', () => {
    if (!samenvatting || zeker) { clearTimeout(zeker); return annuleer?.(); }
    weg.textContent = 'Echt weggooien?';
    weg.classList.add('is-gevaar');
    zeker = setTimeout(() => { zeker = null; weg.textContent = 'Niet opslaan'; weg.classList.remove('is-gevaar'); }, 4000);
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const waarden = { afstandKm: getal(form.afstandKm.value), duurMin: getal(form.duurMin.value), kcal: getal(form.kcal.value) };
    const fouten = valideerResultaat(waarden);
    if (Object.keys(fouten).length) {
      const bewaar = { afstandKm: waarden.afstandKm || 0, duurSec: (waarden.duurMin || 0) * 60, kcal: form.kcal.value };
      form.outerHTML = afrondFormulier(bewaar, fouten, { samenvatting });
      return koppelAfronden(container, training, profiel, { opslag, vandaag, opgeslagen, annuleer, samenvatting });
    }
    markeerGedaan(opslag, training, waarden, vandaag);
    opgeslagen?.();
  });
}

// Formulier om een training af te vinken: afstand (van het loopbandscherm), duur en calorieën.
import { valideerResultaat, markeerGedaan, schatKcal } from './resultaten.js';
import { vandaagIso } from './datum.js';
import { km } from './opmaak.js';

const getal = (v) => Number(String(v).replace(',', '.'));

export function afrondFormulier({ afstandKm, duurSec, kcal }, fouten = {}) {
  const fout = (v) => (fouten[v] ? `<div class="foutmelding" role="alert">${fouten[v]}</div>` : '');
  return `
    <form class="afronden" novalidate data-test="afronden">
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
      <div class="knoppen">
        <button type="button" class="secundair" data-actie="annuleer">Niet opslaan</button>
        <button type="submit" class="primair">Opslaan als gedaan</button>
      </div>
    </form>`;
}

// Koppelt het formulier: bij een andere afstand schuift de calorieschatting mee, tot je die zelf aanpast.
export function koppelAfronden(container, training, profiel, { opslag = localStorage, vandaag = vandaagIso(), opgeslagen, annuleer }) {
  const form = container.querySelector('form.afronden');
  let kcalZelf = false;
  form.kcal.addEventListener('input', () => { kcalZelf = true; });
  form.afstandKm.addEventListener('input', () => {
    const afstand = getal(form.afstandKm.value);
    if (!kcalZelf && afstand > 0) form.kcal.value = schatKcal(training, afstand, profiel.gewicht);
  });
  form.querySelector('[data-actie=annuleer]').addEventListener('click', () => annuleer?.());
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const waarden = { afstandKm: getal(form.afstandKm.value), duurMin: getal(form.duurMin.value), kcal: getal(form.kcal.value) };
    const fouten = valideerResultaat(waarden);
    if (Object.keys(fouten).length) {
      const bewaar = { afstandKm: waarden.afstandKm || 0, duurSec: (waarden.duurMin || 0) * 60, kcal: form.kcal.value };
      form.outerHTML = afrondFormulier(bewaar, fouten);
      return koppelAfronden(container, training, profiel, { opslag, vandaag, opgeslagen, annuleer });
    }
    markeerGedaan(opslag, training, waarden, vandaag);
    opgeslagen?.();
  });
}

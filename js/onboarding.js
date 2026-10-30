// Onboarding in vijf stappen. Elke stap valideert zijn eigen velden voordat je verder kunt.
import {
  STAPPEN, DAGEN, valideerStap, valideerProfiel, bewaarProfiel, vroegsteDoeldatum, extraWeken,
} from './profiel.js';
import { vandaagIso, datumTekst, plusDagen } from './datum.js';
import { parseTijd, formatTijd } from './tijd.js';
import { haalbaarheidHtml } from './zonesweergave.js';
import { beoordeelDoeltijd } from './zones.js';

const DAGNAMEN = { ma: 'maandag', di: 'dinsdag', wo: 'woensdag', do: 'donderdag', vr: 'vrijdag', za: 'zaterdag', zo: 'zondag' };

export function toonOnboarding(root, klaar, { opslag = localStorage, vandaag = vandaagIso() } = {}) {
  const invoer = { doelAfstand: 10, trainingsdagen: [], helling: '1', extraWekenKeuze: null };
  let stap = 0;
  let fouten = {};

  const fout = (veld) => fouten[veld]
    ? `<div class="foutmelding" id="fout-${veld}" role="alert">${fouten[veld]}</div>` : '';
  const ongeldig = (veld) => fouten[veld] ? `aria-invalid="true" aria-describedby="fout-${veld}"` : '';

  const schermen = [
    () => `
      <h1>Wat is je huidige 5 km-tijd?</h1>
      <p class="uitleg">Hiermee rekent de app je snelheden op de loopband uit.</p>
      <div class="veld">
        <label class="titel" for="vijfKmTijd">5 km-tijd (mm:ss)</label>
        <input type="text" inputmode="numeric" id="vijfKmTijd" name="vijfKmTijd" placeholder="35:00"
          autocomplete="off" value="${invoer.vijfKmTijd ?? ''}" ${ongeldig('vijfKmTijd')}>
        <div class="hint">Zonder dubbele punt mag ook: 3500 wordt 35:00.</div>
        ${fout('vijfKmTijd')}
      </div>`,
    () => `
      <h1>Wat is je doel?</h1>
      <p class="uitleg">Later komen er meer schema's bij.</p>
      <div class="veld keuzes">
        <label class="keuze"><input type="radio" name="doelAfstand" value="10" checked>
          <span>10 km<small>Van 5 naar 10 km in 11 weken</small></span></label>
      </div>
      <div class="veld">
        <label class="titel" for="doelTijd">Doeltijd voor 10 km (optioneel)</label>
        <input type="text" inputmode="numeric" id="doelTijd" name="doelTijd" placeholder="70:00"
          autocomplete="off" value="${invoer.doelTijd ?? ''}" ${ongeldig('doelTijd')}>
        <div class="hint">Leeg laten mag: dan stelt de app een haalbare tijd voor.</div>
        ${fout('doelTijd')}
        <div data-test="doel-feedback">${doelFeedback()}</div>
      </div>`,
    () => {
      const extra = invoer.doelDatum && !valideerStap(2, { ...invoer, extraWekenKeuze: 'later' }, vandaag).doelDatum
        ? extraWeken(vandaag, invoer.doelDatum) : 0;
      const weken = `${extra} ${extra === 1 ? 'week' : 'weken'}`;
      return `
      <h1>Wanneer wil je het halen?</h1>
      <p class="uitleg">Het schema duurt 11 weken en eindigt op je doeldatum.</p>
      <div class="veld">
        <label class="titel" for="doelDatum">Doeldatum</label>
        <input type="date" id="doelDatum" name="doelDatum" min="${vroegsteDoeldatum(vandaag)}"
          value="${invoer.doelDatum ?? ''}" ${ongeldig('doelDatum')}>
        <div class="hint">Vroegst mogelijk: ${datumTekst(vroegsteDoeldatum(vandaag))}.</div>
        ${fout('doelDatum')}
      </div>
      ${extra > 0 ? `
      <fieldset class="veld keuzes" style="border:0;padding:0;margin:0 0 18px" ${ongeldig('extraWekenKeuze')}>
        <legend class="titel" style="margin-bottom:8px">Je hebt ${weken} meer dan nodig. Wat wil je daarmee?</legend>
        <label class="keuze"><input type="radio" name="extraWekenKeuze" value="later" ${invoer.extraWekenKeuze === 'later' ? 'checked' : ''}>
          <span>Later starten<small>Het schema begint op ${datumTekst(plusDagen(invoer.doelDatum, -77))}.</small></span></label>
        <label class="keuze"><input type="radio" name="extraWekenKeuze" value="basis" ${invoer.extraWekenKeuze === 'basis' ? 'checked' : ''}>
          <span>Basisweken ervoor<small>Nu beginnen met ${weken} rustige duurlopen.</small></span></label>
        ${fout('extraWekenKeuze')}
      </fieldset>` : ''}`;
    },
    () => `
      <h1>Op welke dagen train je?</h1>
      <p class="uitleg">Kies 3, 4 of 5 dagen. Per week kun je ze later nog verschuiven.</p>
      <div class="veld">
        <div class="dagen" role="group" aria-label="Trainingsdagen" ${ongeldig('trainingsdagen')}>
          ${DAGEN.map((d) => `
            <label class="dag" title="${DAGNAMEN[d]}"><input type="checkbox" name="trainingsdagen" value="${d}"
              aria-label="${DAGNAMEN[d]}" ${invoer.trainingsdagen.includes(d) ? 'checked' : ''}><span>${d}</span></label>`).join('')}
        </div>
        <div class="hint" data-test="aantal-dagen">${invoer.trainingsdagen.length} gekozen</div>
        ${fout('trainingsdagen')}
      </div>`,
    () => `
      <h1>Nog twee dingen</h1>
      <p class="uitleg">Je gewicht is nodig om je calorieverbruik te schatten.</p>
      <div class="veld">
        <label class="titel" for="gewicht">Gewicht (kg)</label>
        <input type="number" inputmode="decimal" id="gewicht" name="gewicht" min="30" max="250" step="0.1"
          placeholder="80" value="${invoer.gewicht ?? ''}" ${ongeldig('gewicht')}>
        ${fout('gewicht')}
      </div>
      <div class="veld">
        <label class="titel" for="helling">Standaardhelling loopband (%)</label>
        <input type="number" inputmode="decimal" id="helling" name="helling" min="0" max="15" step="0.5"
          value="${invoer.helling ?? ''}" ${ongeldig('helling')}>
        <div class="hint">1% voelt ongeveer als buiten lopen.</div>
        ${fout('helling')}
      </div>`,
  ];

  function doelFeedback() {
    const doel = invoer.doelTijd ? parseTijd(invoer.doelTijd) : null;
    if (invoer.doelTijd && (doel === null || valideerStap(1, invoer, vandaag).doelTijd)) return '';
    const vijf = parseTijd(invoer.vijfKmTijd);
    const voorstel = doel ? '' : `<button type="button" class="secundair" data-actie="voorstel">Gebruik ${formatTijd(beoordeelDoeltijd(vijf, null).voorstel)}</button>`;
    return haalbaarheidHtml(vijf, doel).replace('</div>', `${voorstel}</div>`);
  }

  function leesFormulier(form) {
    const data = new FormData(form);
    if (data.has('vijfKmTijd')) invoer.vijfKmTijd = data.get('vijfKmTijd').trim();
    if (data.has('doelTijd')) invoer.doelTijd = data.get('doelTijd').trim();
    if (data.has('doelDatum')) invoer.doelDatum = data.get('doelDatum');
    if (form.querySelector('[name=extraWekenKeuze]')) invoer.extraWekenKeuze = data.get('extraWekenKeuze');
    if (stap === 3) invoer.trainingsdagen = data.getAll('trainingsdagen');
    if (data.has('gewicht')) invoer.gewicht = data.get('gewicht');
    if (data.has('helling')) invoer.helling = data.get('helling');
    // Tijden netjes tonen als ze geldig zijn ("3500" → "35:00").
    for (const veld of ['vijfKmTijd', 'doelTijd']) {
      const s = invoer[veld] ? parseTijd(invoer[veld]) : null;
      if (s !== null) invoer[veld] = formatTijd(s);
    }
  }

  function teken() {
    root.innerHTML = `
      <form novalidate data-stap="${stap + 1}">
        <div class="voortgang" aria-hidden="true">${STAPPEN.map((_, i) => `<span class="${i <= stap ? 'actief' : ''}"></span>`).join('')}</div>
        <div class="stapnr">Stap ${stap + 1} van ${STAPPEN.length}</div>
        ${schermen[stap]()}
        <div class="knoppen">
          ${stap > 0 ? '<button type="button" class="secundair" data-actie="terug">Terug</button>' : ''}
          <button type="submit" class="primair">${stap === STAPPEN.length - 1 ? 'Klaar' : 'Volgende'}</button>
        </div>
      </form>`;
    const form = root.querySelector('form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      leesFormulier(form);
      fouten = valideerStap(stap, invoer, vandaag);
      if (Object.keys(fouten).length) return teken();
      if (stap < STAPPEN.length - 1) { stap += 1; return teken(); }
      const resultaat = valideerProfiel(invoer, vandaag);
      if (!resultaat.ok) { fouten = resultaat.fouten; return teken(); }
      bewaarProfiel(opslag, resultaat.profiel);
      klaar(resultaat.profiel);
    });
    form.querySelector('[data-actie=terug]')?.addEventListener('click', () => {
      leesFormulier(form);
      fouten = {};
      stap -= 1;
      teken();
    });
    // Doeltijd: direct laten zien of hij haalbaar is.
    const doelVeld = form.querySelector('#doelTijd');
    const toonDoelFeedback = () => {
      invoer.doelTijd = doelVeld.value.trim();
      form.querySelector('[data-test=doel-feedback]').innerHTML = doelFeedback();
      form.querySelector('[data-actie=voorstel]')?.addEventListener('click', () => {
        doelVeld.value = formatTijd(beoordeelDoeltijd(parseTijd(invoer.vijfKmTijd), null).voorstel);
        toonDoelFeedback();
      });
    };
    if (doelVeld) { doelVeld.addEventListener('input', toonDoelFeedback); toonDoelFeedback(); }
    // Zodra je iets aanpast verdwijnt de oude foutmelding.
    form.addEventListener('input', (e) => {
      const veld = e.target.name;
      form.querySelector(`#fout-${veld}`)?.remove();
      form.querySelectorAll('[aria-invalid=true]').forEach((el) => {
        if (el.name === veld || el.contains(e.target)) el.removeAttribute('aria-invalid');
      });
      delete fouten[veld];
    });
    // Doeldatum gewijzigd: opnieuw tekenen zodat de keuze over extra weken verschijnt.
    form.querySelector('#doelDatum')?.addEventListener('change', () => { leesFormulier(form); fouten = {}; teken(); });
    form.querySelectorAll('[name=trainingsdagen]').forEach((cb) => cb.addEventListener('change', () => {
      form.querySelector('[data-test=aantal-dagen]').textContent =
        `${form.querySelectorAll('[name=trainingsdagen]:checked').length} gekozen`;
    }));
    const eerste = form.querySelector('[aria-invalid=true]') ?? form.querySelector('input[type=text], input[type=date], input[type=number]');
    eerste?.focus({ preventScroll: true });
  }

  teken();
}

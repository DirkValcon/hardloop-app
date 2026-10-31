// Onboarding in vijf stappen, ook gebruikt om een nieuw schema te maken (dat vervangt het oude).
// Elke stap valideert zijn eigen velden voordat je verder kunt.
import {
  STAPPEN, DAGEN, valideerStap, valideerProfiel, bewaarProfiel, vroegsteDoeldatum, extraWeken, startVan, getal,
} from './profiel.js';
import { vandaagIso, datumTekst, plusDagen } from './datum.js';
import { parseTijd, formatTijd } from './tijd.js';
import { doelHtml } from './zonesweergave.js';
import { laadResultaten, bewaarResultaten } from './resultaten.js';
import { bewaarAanpassingen, legeAanpassingen } from './aanpassingen.js';
import { DOELAFSTANDEN, adviesWeken, beoordeelWeken, MIN_WEKEN, MAX_WEKEN } from './generator.js';

const DAGNAMEN = { ma: 'maandag', di: 'dinsdag', wo: 'woensdag', do: 'donderdag', vr: 'vrijdag', za: 'zaterdag', zo: 'zondag' };
const kmTekst = (v) => String(v).replace('.', ',');
const kmhTekst = (v) => (Math.round(v * 10) / 10).toFixed(1).replace('.', ',');

// Tempo (min/km) en snelheid (km/u) rekenen elkaar uit.
export const tempoNaarKmh = (tempo) => { const s = parseTijd(tempo ?? ''); return s ? kmhTekst(3600 / s) : ''; };
export const kmhNaarTempo = (kmh) => { const v = getal(kmh); return v >= 3 && v <= 30 ? formatTijd(3600 / v) : ''; };

// `bestaand`: het huidige profiel als je een nieuw schema maakt. Dagen, gewicht, helling en eigen
// snelheden worden dan overgenomen, en `annuleer` brengt je terug.
export function toonOnboarding(root, klaar, { opslag = localStorage, vandaag = vandaagIso(), bestaand = null, annuleer = null } = {}) {
  const invoer = {
    doelAfstand: null, trainingsdagen: [], helling: '1', extraWekenKeuze: null,
    ...(bestaand ? {
      trainingsdagen: bestaand.trainingsdagen, helling: String(bestaand.helling), gewicht: String(bestaand.gewicht),
    } : {}),
  };
  let stap = 0;
  let fouten = {};

  const fout = (veld) => fouten[veld]
    ? `<div class="foutmelding" id="fout-${veld}" role="alert">${fouten[veld]}</div>` : '';
  const ongeldig = (veld) => fouten[veld] ? `aria-invalid="true" aria-describedby="fout-${veld}"` : '';
  const niveauOk = () => !Object.keys(valideerStap(0, invoer, vandaag)).length;
  const weken = () => Math.round(getal(invoer.weken));

  const schermen = [
    () => `
      ${bestaand ? `<div class="melding melding-te-snel" data-test="vervang-waarschuwing">Een nieuw schema <strong>vervangt je huidige schema</strong>.
        Trainingen die je al gelopen hebt blijven in je statistieken staan.</div>` : ''}
      <h1>Wat loop je nu?</h1>
      <p class="uitleg">Hiermee bepaalt de app waar je schema begint en welke snelheden je krijgt.</p>
      <div class="veld">
        <label class="titel" for="maxKm">Maximale afstand die je nu achter elkaar loopt (km)</label>
        <input type="text" inputmode="decimal" id="maxKm" name="maxKm" placeholder="5"
          autocomplete="off" value="${invoer.maxKm ?? ''}" ${ongeldig('maxKm')}>
        ${fout('maxKm')}
      </div>
      <div class="veld">
        <span class="titel">Je tempo op die afstand</span>
        <div class="tempo-paar">
          <label><input type="text" inputmode="numeric" id="tempo" name="tempo" placeholder="7:00"
            autocomplete="off" value="${invoer.tempo ?? ''}" ${ongeldig('tempo')} aria-label="Tempo in minuten per kilometer"><span>min/km</span></label>
          <label><input type="text" inputmode="decimal" id="kmh" name="kmh" placeholder="8,6"
            autocomplete="off" value="${invoer.kmh ?? ''}" aria-label="Snelheid in kilometer per uur"><span>km/u</span></label>
        </div>
        <div class="hint">Vul er één in, de app rekent de ander uit.</div>
        ${fout('tempo')}
      </div>`,
    () => `
      <h1>Wat is je doel?</h1>
      <div class="veld keuzes" role="radiogroup" aria-label="Doelafstand" ${ongeldig('doelAfstand')}>
        ${DOELAFSTANDEN.map((d) => `
        <label class="keuze"><input type="radio" name="doelAfstand" value="${d.km}" ${Number(invoer.doelAfstand) === d.km ? 'checked' : ''}>
          <span>${d.naam}<small>${d.km === 21.1 || d.km === 42.2 ? `${kmTekst(d.km)} km` : '&nbsp;'}</small></span></label>`).join('')}
        ${fout('doelAfstand')}
      </div>
      <div class="veld">
        <label class="titel" for="doelTijd">Doeltijd (optioneel)</label>
        <input type="text" inputmode="numeric" id="doelTijd" name="doelTijd" placeholder="leeg = uitlopen"
          autocomplete="off" value="${invoer.doelTijd ?? ''}" ${ongeldig('doelTijd')}>
        <div class="hint">Leeg laten: dan is uitlopen je doel.</div>
        ${fout('doelTijd')}
        <div data-test="doel-feedback">${doelFeedback()}</div>
      </div>`,
    () => {
      const advies = adviesWeken(invoer.doelAfstand, getal(invoer.maxKm));
      if (!invoer.weken) invoer.weken = String(advies);
      const wekenOk = !valideerStap(2, { ...invoer, doelDatum: '9999-12-31' }, vandaag).weken;
      const oordeel = wekenOk ? beoordeelWeken(invoer.doelAfstand, getal(invoer.maxKm), weken()) : null;
      const extra = wekenOk && invoer.doelDatum && !valideerStap(2, { ...invoer, extraWekenKeuze: 'later' }, vandaag).doelDatum
        ? extraWeken(vandaag, invoer.doelDatum, weken()) : 0;
      const wekenTekst = `${extra} ${extra === 1 ? 'week' : 'weken'}`;
      const vroegst = wekenOk ? vroegsteDoeldatum(vandaag, weken()) : vroegsteDoeldatum(vandaag, MIN_WEKEN);
      return `
      <h1>Hoe lang wil je trainen?</h1>
      <div class="veld">
        <label class="titel" for="weken">Aantal weken</label>
        <input type="number" inputmode="numeric" id="weken" name="weken" min="${MIN_WEKEN}" max="${MAX_WEKEN}" step="1"
          value="${invoer.weken}" ${ongeldig('weken')}>
        <div class="hint" data-test="advies">Advies: <strong>${advies} weken</strong>. Dan groeit je langste loop hooguit 10% per week, met elke 4e week een herstelweek.</div>
        ${fout('weken')}
        ${oordeel?.teKort ? `<div class="melding melding-te-snel" data-test="blessurewaarschuwing">Let op: met ${oordeel.weken} weken
          groeit je langste loop soms ${Math.round(oordeel.maxGroei * 100)}% in één week. Dat geeft meer kans op blessures.
          Je mag doorgaan, maar ${advies} weken is veiliger.</div>` : ''}
      </div>
      <div class="veld">
        <label class="titel" for="doelDatum">Doeldatum</label>
        <input type="date" id="doelDatum" name="doelDatum" min="${vroegst}"
          value="${invoer.doelDatum ?? ''}" ${ongeldig('doelDatum')}>
        <div class="hint">Vroegst mogelijk: ${datumTekst(vroegst)} (dan begin je deze week).${wekenOk && invoer.doelDatum && invoer.doelDatum >= vroegst
          ? ` <span data-test="startweek">Week 1 begint op maandag ${datumTekst(startVan(invoer.doelDatum, weken()))}.</span>` : ''}</div>
        ${fout('doelDatum')}
      </div>
      ${extra > 0 ? `
      <fieldset class="veld keuzes" style="border:0;padding:0;margin:0 0 18px" ${ongeldig('extraWekenKeuze')}>
        <legend class="titel" style="margin-bottom:8px">Je hebt ${wekenTekst} meer dan nodig. Wat wil je daarmee?</legend>
        <label class="keuze"><input type="radio" name="extraWekenKeuze" value="later" ${invoer.extraWekenKeuze === 'later' ? 'checked' : ''}>
          <span>Later starten<small>Het schema begint op ${datumTekst(startVan(invoer.doelDatum, weken()))}.</small></span></label>
        <label class="keuze"><input type="radio" name="extraWekenKeuze" value="basis" ${invoer.extraWekenKeuze === 'basis' ? 'checked' : ''}>
          <span>Basisweken ervoor<small>Nu beginnen met ${wekenTekst} rustige duurlopen.</small></span></label>
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
    if (!niveauOk() || !invoer.doelAfstand) return '';
    const doel = invoer.doelTijd ? parseTijd(invoer.doelTijd) : null;
    if (invoer.doelTijd && (doel === null || valideerStap(1, invoer, vandaag).doelTijd)) return '';
    return doelHtml({
      maxKm: getal(invoer.maxKm), tempoSecPerKm: parseTijd(invoer.tempo), doelKm: Number(invoer.doelAfstand), doelSeconden: doel,
    });
  }

  function leesFormulier(form) {
    const data = new FormData(form);
    if (data.has('maxKm')) invoer.maxKm = data.get('maxKm').trim();
    if (data.has('tempo')) {
      invoer.tempo = data.get('tempo').trim();
      invoer.kmh = data.get('kmh').trim();
      // Alleen km/u ingevuld: tempo daaruit.
      if (!invoer.tempo && invoer.kmh) invoer.tempo = kmhNaarTempo(invoer.kmh);
    }
    if (form.querySelector('[name=doelAfstand]')) invoer.doelAfstand = data.get('doelAfstand');
    if (data.has('doelTijd')) invoer.doelTijd = data.get('doelTijd').trim();
    if (data.has('weken')) invoer.weken = data.get('weken').trim();
    if (data.has('doelDatum')) invoer.doelDatum = data.get('doelDatum');
    if (form.querySelector('[name=extraWekenKeuze]')) invoer.extraWekenKeuze = data.get('extraWekenKeuze');
    if (stap === 3) invoer.trainingsdagen = data.getAll('trainingsdagen');
    if (data.has('gewicht')) invoer.gewicht = data.get('gewicht');
    if (data.has('helling')) invoer.helling = data.get('helling');
    // Tijden netjes tonen als ze geldig zijn ("700" → "7:00").
    for (const veld of ['tempo', 'doelTijd']) {
      const s = invoer[veld] ? parseTijd(invoer[veld]) : null;
      if (s !== null) invoer[veld] = formatTijd(s);
    }
    if (data.has('tempo') && invoer.tempo) invoer.kmh = tempoNaarKmh(invoer.tempo) || invoer.kmh;
  }

  function teken() {
    const laatste = stap === STAPPEN.length - 1;
    root.innerHTML = `
      <form novalidate data-stap="${stap + 1}">
        <div class="voortgang" aria-hidden="true">${STAPPEN.map((_, i) => `<span class="${i <= stap ? 'actief' : ''}"></span>`).join('')}</div>
        <div class="stapnr">${bestaand ? 'Nieuw schema · ' : ''}Stap ${stap + 1} van ${STAPPEN.length}</div>
        ${schermen[stap]()}
        <div class="knoppen">
          ${stap > 0 ? '<button type="button" class="secundair" data-actie="terug">Terug</button>'
            : annuleer ? '<button type="button" class="secundair" data-actie="annuleer">Annuleren</button>' : ''}
          <button type="submit" class="primair">${laatste ? (bestaand ? 'Schema vervangen' : 'Klaar') : 'Volgende'}</button>
        </div>
      </form>`;
    const form = root.querySelector('form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      leesFormulier(form);
      fouten = valideerStap(stap, invoer, vandaag);
      if (Object.keys(fouten).length) return teken();
      // Ander niveau of andere afstand: het advies voor het aantal weken opnieuw uitrekenen.
      if (stap < 2) invoer.weken = '';
      if (stap < STAPPEN.length - 1) { stap += 1; return teken(); }
      const resultaat = valideerProfiel(invoer, vandaag);
      if (!resultaat.ok) { fouten = resultaat.fouten; return teken(); }
      if (bestaand && !confirm('Je huidige schema wordt vervangen. Gelopen trainingen blijven in je statistieken. Doorgaan?')) return;
      if (!bestaand) {
        bewaarProfiel(opslag, resultaat.profiel);
        return klaar(resultaat.profiel);
      }
      klaar({ ...resultaat.profiel, ...(bestaand.eigenSnelheden ? { eigenSnelheden: bestaand.eigenSnelheden } : {}) });
    });
    form.querySelector('[data-actie=terug]')?.addEventListener('click', () => {
      leesFormulier(form);
      fouten = {};
      stap -= 1;
      teken();
    });
    form.querySelector('[data-actie=annuleer]')?.addEventListener('click', () => annuleer());

    // Tempo en km/u rekenen elkaar direct uit.
    const tempo = form.querySelector('#tempo');
    const kmh = form.querySelector('#kmh');
    tempo?.addEventListener('input', () => { kmh.value = tempoNaarKmh(tempo.value); });
    kmh?.addEventListener('input', () => { tempo.value = kmhNaarTempo(kmh.value); });

    // Doeltijd: direct laten zien hoe die zich verhoudt tot je niveau.
    const toonDoelFeedback = () => {
      leesFormulier(form);
      form.querySelector('[data-test=doel-feedback]').innerHTML = doelFeedback();
    };
    if (form.querySelector('#doelTijd')) {
      form.querySelector('#doelTijd').addEventListener('input', toonDoelFeedback);
      form.querySelectorAll('[name=doelAfstand]').forEach((r) => r.addEventListener('change', () => {
        leesFormulier(form);
        // De oude doeltijd past niet meer bij een andere afstand.
        invoer.doelTijd = '';
        fouten = {};
        teken();
      }));
    }
    // Zodra je iets aanpast verdwijnt de oude foutmelding.
    form.addEventListener('input', (e) => {
      const veld = e.target.name === 'kmh' ? 'tempo' : e.target.name;
      form.querySelector(`#fout-${veld}`)?.remove();
      form.querySelectorAll('[aria-invalid=true]').forEach((el) => {
        if (el.name === veld || el.contains(e.target)) el.removeAttribute('aria-invalid');
      });
      delete fouten[veld];
    });
    // Weken of doeldatum gewijzigd: opnieuw tekenen voor de waarschuwing en de keuze over extra weken.
    for (const id of ['#doelDatum', '#weken']) {
      form.querySelector(id)?.addEventListener('change', () => { leesFormulier(form); fouten = {}; teken(); });
    }
    form.querySelectorAll('[name=trainingsdagen]').forEach((cb) => cb.addEventListener('change', () => {
      form.querySelector('[data-test=aantal-dagen]').textContent =
        `${form.querySelectorAll('[name=trainingsdagen]:checked').length} gekozen`;
    }));
    const eerste = form.querySelector('[aria-invalid=true]') ?? form.querySelector('input[type=text], input[type=date], input[type=number]');
    eerste?.focus({ preventScroll: true });
  }

  teken();
}

// Een nieuw schema vervangt het oude. Gelopen trainingen blijven bewaard (met hun naam, voor de
// statistieken) en de aanpassingen van het oude schema vervallen.
export function vervangSchema(opslag, nieuwProfiel, oudPlan) {
  const namen = new Map(oudPlan.weken.flatMap((w) => w.trainingen).map((t) => [t.id, t.naam]));
  const resultaten = laadResultaten(opslag);
  const metNaam = Object.fromEntries(Object.entries(resultaten)
    .map(([id, r]) => [id, r.naam || !namen.has(id) ? r : { ...r, naam: namen.get(id) }]));
  if (Object.keys(resultaten).length) bewaarResultaten(opslag, metNaam);
  bewaarAanpassingen(opslag, legeAanpassingen());
  bewaarProfiel(opslag, nieuwProfiel);
}

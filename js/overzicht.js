// Scherm Profiel: je gegevens, je snelheden en het formulier om ze te wijzigen.
import { formatTijd, parseTijd } from './tijd.js';
import { datumTekst, vandaagIso, plusDagen } from './datum.js';
import { haalbaarheidHtml, zonesHtml, doelHtml } from './zonesweergave.js';
import { doelafstand } from './generator.js';
import { DAGEN, bewaarProfiel, extraWeken, vroegsteDoeldatum, schemaWeken } from './profiel.js';
import { effectiefProfiel, valideerWijziging, wijzigProfiel } from './instellingen.js';
import { maandagVan } from './schema.js';
import { korteDatum, kmh, km } from './opmaak.js';
import { berekenZones, EIGEN_ZONES } from './zones.js';
import { toonMelding } from './melding.js';

const parseTijdVeilig = (tekst, standaard) => parseTijd(tekst ?? '') ?? standaard;

const DAGNAMEN = { ma: 'maandag', di: 'dinsdag', wo: 'woensdag', do: 'donderdag', vr: 'vrijdag', za: 'zaterdag', zo: 'zondag' };

function komendeWijzigingen(profiel, vandaag) {
  const nu = maandagVan(vandaag);
  return (profiel.historie ?? []).filter((h) => h.vanaf > nu).map((h) =>
    `<div class="melding" data-test="komend">Vanaf maandag ${korteDatum(h.vanaf)}${h.trainingsdagen ? `: trainingsdagen ${h.trainingsdagen.join(', ')}` : ''}.</div>`).join('');
}

const DAGVOLGORDE = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];

// Profiel in vier delen, elk met een eigen knop om alleen dat deel te wijzigen.
function overzichtHtml(profiel, vandaag, account = '') {
  const p = effectiefProfiel(profiel, vandaag);
  const extra = p.extraWeken > 0
    ? (p.extraWekenKeuze === 'basis'
      ? `<dt>Extra</dt><dd>${p.extraWeken} ${p.extraWeken === 1 ? 'basisweek' : 'basisweken'} vooraf</dd>`
      : `<dt>Start</dt><dd>${p.extraWeken} ${p.extraWeken === 1 ? 'week' : 'weken'} later</dd>`)
    : '';
  return `
    <h1>Profiel</h1>
    <div data-test="samenvatting">
    <h2>Mijn schema</h2>
    <div class="kaart">
      <dl class="samenvatting">
        ${p.schema ? `
        <dt>Schema</dt><dd>${doelafstand(p.schema.doelKm).naam} in ${p.schema.weken} weken</dd>
        <dt>Niveau bij start</dt><dd>${km(p.schema.maxKm)} km in ${formatTijd(p.schema.tempoSecPerKm)} /km</dd>
        <dt>Doel</dt><dd>${p.doelAfstandSeconden ? `${doelafstand(p.schema.doelKm).naam} in ${formatTijd(p.doelAfstandSeconden)}` : 'Uitlopen'}</dd>` : `
        <dt>5 km-tijd</dt><dd>${formatTijd(p.vijfKmSeconden)}</dd>
        <dt>Doel</dt><dd>${p.doelAfstand} km${p.doelSeconden ? ' in ' + formatTijd(p.doelSeconden) : ''}</dd>`}
        <dt>Doeldatum</dt><dd>${datumTekst(p.doelDatum)}</dd>
        ${extra}
      </dl>
      ${p.schema ? doelHtml({ ...p.schema, doelSeconden: p.doelAfstandSeconden }) : haalbaarheidHtml(p.vijfKmSeconden, p.doelSeconden)}
      <div class="knoppen klein-knoppen">
        <button type="button" class="secundair" data-actie="wijzig" data-sectie="schema">Schema wijzigen</button>
        <button type="button" class="secundair" data-actie="nieuw-schema">Nieuw schema maken</button>
      </div>
    </div>

    <h2>Mijn snelheden op de loopband</h2>
    <div class="kaart">${zonesHtml(p.vijfKmSeconden, p.doelSeconden, p.eigenSnelheden)}
      <p class="hint">Rustige snelheden komen uit je huidige ${p.schema ? 'niveau' : '5 km-tijd'}, snelle uit je doeltijd. Loop je liever op je eigen snelheid? Stel die hier in.</p>
      <button type="button" class="secundair breed" data-actie="wijzig" data-sectie="snelheden">Snelheden aanpassen</button>
    </div>

    <h2>Instellingen</h2>
    <div class="kaart">
      <dl class="samenvatting">
        <dt>Trainingsdagen</dt><dd>${DAGVOLGORDE.filter((d) => p.trainingsdagen.includes(d)).join(', ')}</dd>
        <dt>Gewicht</dt><dd>${p.gewicht} kg</dd>
        <dt>Helling</dt><dd>${p.helling}%</dd>
      </dl>
      ${komendeWijzigingen(profiel, vandaag)}
      <button type="button" class="secundair breed" data-actie="wijzig" data-sectie="instellingen">Instellingen wijzigen</button>
    </div>
    </div>
    ${typeof account === 'function' ? account() : account}`;
}

const TITELS = { schema: 'Schema wijzigen', snelheden: 'Snelheden aanpassen', instellingen: 'Instellingen wijzigen' };

function formulierHtml(invoer, profiel, vandaag, fouten = {}, sectie = 'instellingen') {
  // Alleen de velden van dit deel zijn zichtbaar; de andere gaan ongewijzigd mee.
  const deel = (naam) => (naam === sectie ? '<div class="deel">' : '<div class="deel" hidden>');
  const fout = (v) => (fouten[v] ? `<div class="foutmelding" role="alert">${fouten[v]}</div>` : '');
  const ongeldig = (v) => (fouten[v] ? 'aria-invalid="true"' : '');
  const datumGewijzigd = invoer.doelDatum !== profiel.doelDatum;
  const extra = datumGewijzigd && !valideerWijziging(profiel, { ...invoer, extraWekenKeuze: 'later' }, vandaag).doelDatum
    ? extraWeken(vandaag, invoer.doelDatum, schemaWeken(profiel)) : 0;
  return `
    <h1>${TITELS[sectie]}</h1>
    <form novalidate data-test="instellingen">
      ${deel('schema')}
      ${profiel.schema ? `<input type="hidden" name="vijfKmTijd" value="${invoer.vijfKmTijd}"><input type="hidden" name="doelTijd" value="${invoer.doelTijd}">
      <p class="hint">Ander doel of niveau? Maak een nieuw schema via Profiel.</p>` : `
      <div class="veld"><label class="titel" for="vijfKmTijd">5 km-tijd (mm:ss)</label>
        <input type="text" inputmode="numeric" id="vijfKmTijd" name="vijfKmTijd" value="${invoer.vijfKmTijd}" ${ongeldig('vijfKmTijd')}>${fout('vijfKmTijd')}</div>
      <div class="veld"><label class="titel" for="doelTijd">Doeltijd 10 km (optioneel)</label>
        <input type="text" inputmode="numeric" id="doelTijd" name="doelTijd" value="${invoer.doelTijd}" ${ongeldig('doelTijd')}>${fout('doelTijd')}</div>`}
      <div class="veld"><label class="titel" for="doelDatum">Doeldatum</label>
        <input type="date" id="doelDatum" name="doelDatum" value="${invoer.doelDatum}" min="${vroegsteDoeldatum(vandaag, schemaWeken(profiel))}" ${ongeldig('doelDatum')}>
        <div class="hint">Een andere doeldatum verschuift het hele schema.</div>${fout('doelDatum')}</div>
      ${extra > 0 ? `<fieldset class="veld keuzes" style="border:0;padding:0;margin:0 0 18px">
        <legend class="titel" style="margin-bottom:8px">Je hebt ${extra} ${extra === 1 ? 'week' : 'weken'} extra. Wat wil je daarmee?</legend>
        <label class="keuze"><input type="radio" name="extraWekenKeuze" value="later" ${invoer.extraWekenKeuze === 'later' ? 'checked' : ''}><span>Later starten</span></label>
        <label class="keuze"><input type="radio" name="extraWekenKeuze" value="basis" ${invoer.extraWekenKeuze === 'basis' ? 'checked' : ''}><span>Basisweken ervoor</span></label>
        ${fout('extraWekenKeuze')}</fieldset>` : ''}
      </div>
      ${deel('instellingen')}
      <div class="veld"><span class="titel">Trainingsdagen</span>
        <div class="dagen" role="group" aria-label="Trainingsdagen">${DAGEN.map((d) => `
          <label class="dag"><input type="checkbox" name="trainingsdagen" value="${d}" aria-label="${DAGNAMEN[d]}"
            ${invoer.trainingsdagen.includes(d) ? 'checked' : ''}><span>${d}</span></label>`).join('')}</div>
        <div class="hint">Nieuwe dagen gelden vanaf maandag ${korteDatum(plusDagen(maandagVan(vandaag), 7))}; deze week verschuif je onder Schema.</div>
        ${fout('trainingsdagen')}</div>
      <div class="veld"><label class="titel" for="gewicht">Gewicht (kg)</label>
        <input type="number" inputmode="decimal" id="gewicht" name="gewicht" step="0.1" value="${invoer.gewicht}" ${ongeldig('gewicht')}>${fout('gewicht')}</div>
      <div class="veld"><label class="titel" for="helling">Standaardhelling (%)</label>
        <input type="number" inputmode="decimal" id="helling" name="helling" step="0.5" value="${invoer.helling}" ${ongeldig('helling')}>${fout('helling')}</div>
      <p class="hint">Helling geldt vanaf deze week. Trainingen die je al gedaan hebt blijven staan.</p>
      </div>
      ${deel('snelheden')}
      <fieldset class="veld eigen-snelheden" style="border:0;padding:0;margin:0 0 18px">
        <legend class="titel">Eigen snelheden (km/u)</legend>
        <div class="hint" style="margin-bottom:8px">Leeg laten = de app rekent het uit (grijs voorbeeld). Tijdens een training kun je nog bijstellen met + en −.</div>
        ${EIGEN_ZONES.map((z) => {
          const berekend = berekenZones(parseTijdVeilig(invoer.vijfKmTijd, profiel.vijfKmSeconden), parseTijdVeilig(invoer.doelTijd, null)).find((x) => x.id === z);
          return `<div class="eigen-rij"><label for="eigen-${z}">${berekend.naam}<small>${berekend.gebruik}</small></label>
            <input type="text" inputmode="decimal" id="eigen-${z}" name="eigen-${z}" value="${invoer.eigen?.[z] ?? ''}"
              placeholder="${kmh(berekend.van)}" ${ongeldig(`eigen-${z}`)}>${fout(`eigen-${z}`)}</div>`;
        }).join('')}
      </fieldset>
      <p class="hint">Snelheden gelden vanaf deze week. Trainingen die je al gedaan hebt blijven staan.</p>
      </div>
      <div class="knoppen">
        <button type="button" class="secundair" data-actie="annuleer">Annuleren</button>
        <button type="submit" class="primair">Opslaan</button>
      </div>
    </form>`;
}

export function toonOverzicht(root, profiel, { vandaag = vandaagIso(), opslag = localStorage, gewijzigd, account, uitloggen, nieuwSchema } = {}) {
  root.innerHTML = overzichtHtml(profiel, vandaag, account);
  let sectie = 'instellingen';
  root.onclick = (e) => {
    const wijzig = e.target.closest('[data-actie=wijzig]');
    if (wijzig) { sectie = wijzig.dataset.sectie; toonFormulier(); }
    if (e.target.closest('[data-actie=nieuw-schema]')) nieuwSchema?.();
    if (e.target.closest('[data-actie=uitloggen]')) uitloggen?.();
  };

  function toonFormulier(invoer, fouten) {
    const p = effectiefProfiel(profiel, vandaag);
    const volgende = (profiel.historie ?? []).filter((h) => h.vanaf > maandagVan(vandaag) && h.trainingsdagen).at(-1);
    invoer ??= {
      vijfKmTijd: formatTijd(p.vijfKmSeconden), doelTijd: p.doelSeconden ? formatTijd(p.doelSeconden) : '',
      doelDatum: profiel.doelDatum, extraWekenKeuze: profiel.extraWekenKeuze,
      trainingsdagen: volgende?.trainingsdagen ?? p.trainingsdagen, gewicht: String(profiel.gewicht), helling: String(p.helling),
      eigen: Object.fromEntries(Object.entries(p.eigenSnelheden ?? {}).map(([z, v]) => [z, kmh(v)])),
    };
    root.innerHTML = formulierHtml(invoer, profiel, vandaag, fouten, sectie);
    const form = root.querySelector('form');
    const lees = () => {
      const d = new FormData(form);
      return {
        vijfKmTijd: d.get('vijfKmTijd').trim(), doelTijd: d.get('doelTijd').trim(), doelDatum: d.get('doelDatum'),
        extraWekenKeuze: d.get('extraWekenKeuze') ?? invoer.extraWekenKeuze, trainingsdagen: d.getAll('trainingsdagen'),
        gewicht: d.get('gewicht'), helling: d.get('helling'),
        eigen: Object.fromEntries(EIGEN_ZONES.map((z) => [z, d.get(`eigen-${z}`) ?? ''])),
      };
    };
    form.querySelector('#doelDatum').addEventListener('change', () => toonFormulier(lees()));
    form.querySelector('[data-actie=annuleer]').addEventListener('click', () => toonOverzicht(root, profiel, { vandaag, opslag, gewijzigd, account, uitloggen, nieuwSchema }));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const nieuw = lees();
      const f = valideerWijziging(profiel, nieuw, vandaag);
      if (Object.keys(f).length) return toonFormulier(nieuw, f);
      profiel = wijzigProfiel(profiel, nieuw, vandaag);
      bewaarProfiel(opslag, profiel);
      gewijzigd?.(profiel);
      toonMelding('Opgeslagen', { duurMs: 2500 });
      toonOverzicht(root, profiel, { vandaag, opslag, gewijzigd, account, uitloggen, nieuwSchema });
    });
  }
}

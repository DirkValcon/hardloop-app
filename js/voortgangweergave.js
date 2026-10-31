// Scherm Voortgang: kerncijfers en een staafgrafiek met kilometers per week (gelopen tegen gepland).
import { berekenVoortgang } from './voortgang.js';
import { huidigPlan } from './plan.js';
import { effectiefProfiel } from './instellingen.js';
import { laadResultaten } from './resultaten.js';
import { vandaagIso, datumTekst, plusDagen } from './datum.js';
import { formatTijd } from './tijd.js';
import { km, korteDatum, minuten } from './opmaak.js';

export function toonVoortgang(root, profiel, { vandaag = vandaagIso(), opslag = localStorage } = {}) {
  const plan = huidigPlan(profiel, vandaag, opslag);
  const v = berekenVoortgang(plan, laadResultaten(opslag), effectiefProfiel(profiel, vandaag), vandaag);
  const max = Math.max(...v.perWeek.map((w) => Math.max(w.km, w.geplandKm)), 1);
  const staven = v.perWeek.map((w, i) => {
    const toekomst = w.maandag > vandaag;
    return `
      <button type="button" class="staaf${toekomst ? ' is-toekomst' : ''}" data-week="${i}"
        aria-label="${w.label}: ${km(w.km)} van ${km(w.geplandKm)} km, ${w.kcal} kcal">
        <span class="staaf-plan" style="height:${(w.geplandKm / max) * 100}%"></span>
        <span class="staaf-gedaan" style="height:${(w.km / max) * 100}%"></span>
      </button>`;
  }).join('');
  const labels = v.perWeek.map((w) => `<span>${w.label.replace('W', '')}</span>`).join('');
  const doel = v.doelSeconden ? ` · doel ${formatTijd(v.doelSeconden)}` : '';
  // Deze week (of de eerste week, als het schema nog moet beginnen).
  const dezeWeek = v.perWeek.find((w) => vandaag >= w.maandag && vandaag <= plusDagen(w.maandag, 6))
    ?? (v.perWeek[0]?.maandag > vandaag ? v.perWeek[0] : null);
  const weekNaam = (w) => (w.label.startsWith('B') ? 'Basisweek ' + w.label.slice(1) : 'Week ' + w.label.slice(1));
  const dezeWeekHtml = dezeWeek ? `
    <div class="kaart deze-week" data-test="deze-week">
      <span class="label">Deze week · ${weekNaam(dezeWeek)}</span>
      <p class="deze-week-km"><strong data-test="km-week">${km(v.kmDezeWeek)}</strong> van ${km(dezeWeek.geplandKm)} km</p>
      <div class="voortgangsbalk"><span style="width:${Math.min(100, (v.kmDezeWeek / Math.max(dezeWeek.geplandKm, 0.1)) * 100)}%"></span></div>
      <small class="hint">${dezeWeek.gedaan} van ${dezeWeek.aantal} trainingen gedaan</small>
    </div>` : '';

  root.innerHTML = `
    <h1>Voortgang</h1>
    <div class="vg-boven">
    <div class="vg-kolom">
    ${dezeWeekHtml}
    <h2>Je schema</h2>
    <div class="tegels" data-test="tegels">
      <div class="tegel"><strong data-test="trainingen">${v.gedaan}/${v.totaal}</strong><small>trainingen gedaan</small></div>
      <div class="tegel"><strong data-test="weken">${v.wekenTotDoel}</strong><small>${v.wekenTotDoel === 1 ? 'week' : 'weken'} tot ${korteDatum(plan.doelDatum)}</small></div>
      <div class="tegel"><strong data-test="totaal-km">${km(v.totaalKm)}</strong><small>km gelopen</small></div>
      <div class="tegel"><strong data-test="totaal-kcal">${v.totaalKcal}</strong><small>kcal verbruikt</small></div>
    </div>
    <div class="voortgangsbalk" role="progressbar" aria-valuemin="0" aria-valuemax="${v.totaal}" aria-valuenow="${v.gedaan}">
      <span style="width:${(v.gedaan / v.totaal) * 100}%"></span></div>
    </div>
    <div class="vg-kolom">

    <h2>Kilometers per week</h2>
    <div class="kaart grafiek">
      <div class="grafiek-detail" data-test="grafiek-detail">Tik op een week voor de details.</div>
      <div class="staven" data-test="staven">${staven}</div>
      <div class="staaf-labels">${labels}</div>
      <div class="legenda"><span><i class="l-gedaan"></i>Gelopen</span><span><i class="l-plan"></i>Gepland</span></div>
    </div>
    </div>
    </div>

    <h2>Statistieken</h2>
    <div class="tegels" data-test="stat-tegels">
      <div class="tegel"><strong data-test="km-maand">${km(v.kmDezeMaand)}</strong><small>km deze maand</small></div>
      <div class="tegel"><strong data-test="tempo">${v.gemiddeldTempo ? formatTijd(v.gemiddeldTempo) : '–'}</strong><small>gemiddeld per km</small></div>
    </div>
    ${v.perMaand.length ? `
    <div class="kaart">
      <table class="stat-tabel" data-test="per-maand">
        <thead><tr><th scope="col">Maand</th><th scope="col">km</th><th scope="col">Trainingen</th><th scope="col">kcal</th></tr></thead>
        <tbody>${v.perMaand.map((m) => `<tr><th scope="row">${m.label}</th><td>${km(m.km)}</td><td>${m.aantal}</td><td>${m.kcal}</td></tr>`).join('')}</tbody>
      </table>
    </div>` : ''}
    <h2>Gelopen trainingen</h2>
    <div class="kaart">${v.gelopen.length ? `
      <ol class="gelopen" data-test="gelopen">${v.gelopen.map((g) => `
        <li><span>${g.naam}<small>${korteDatum(g.datum)} · ${minuten(g.duurSec)} · ${g.kcal} kcal</small></span>
          <span class="blok-waarden"><strong>${km(g.afstandKm)}</strong> km<small>${formatTijd(g.duurSec / g.afstandKm)} /km</small></span></li>`).join('')}
      </ol>` : '<p class="hint">Nog geen trainingen gelopen.</p>'}
    </div>

    <h2>Records en voorspelling</h2>
    <div class="kaart">
      <dl class="samenvatting">
        <dt>Langste loop</dt><dd data-test="langste">${v.langste ? `${km(v.langste.afstandKm)} km <small class="hint">${korteDatum(v.langste.datum)}</small>` : 'nog geen'}</dd>
        <dt>Voorspelde ${v.doelNaam}</dt><dd data-test="voorspeld">${formatTijd(v.voorspeldDoel)}${doel}</dd>
        <dt>Doeldatum</dt><dd>${datumTekst(plan.doelDatum)}</dd>
        ${v.overgeslagen ? `<dt>Overgeslagen</dt><dd>${v.overgeslagen}</dd>` : ''}
      </dl>
      <p class="hint">${profiel.schema ? 'De voorspelling komt uit je huidige niveau (maximale afstand en tempo).' : 'De voorspelling komt uit je 5 km-tijd. Liep je een nieuwe 5 km-tijd? Pas hem aan onder Profiel.'}</p>
    </div>`;

  root.onclick = (e) => {
    const staaf = e.target.closest('.staaf');
    if (!staaf) return;
    const w = v.perWeek[Number(staaf.dataset.week)];
    root.querySelectorAll('.staaf').forEach((s) => s.classList.toggle('is-gekozen', s === staaf));
    root.querySelector('[data-test=grafiek-detail]').innerHTML =
      `<strong>${weekNaam(w)}</strong> · ${km(w.km)} van ${km(w.geplandKm)} km · ${w.kcal} kcal · ${w.gedaan}/${w.aantal} trainingen`;
  };
}

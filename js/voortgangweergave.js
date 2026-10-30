// Scherm Voortgang: kerncijfers en een staafgrafiek met kilometers per week (gelopen tegen gepland).
import { berekenVoortgang } from './voortgang.js';
import { huidigPlan } from './plan.js';
import { laadResultaten } from './resultaten.js';
import { vandaagIso, datumTekst } from './datum.js';
import { formatTijd } from './tijd.js';
import { km, korteDatum } from './opmaak.js';

export function toonVoortgang(root, profiel, { vandaag = vandaagIso(), opslag = localStorage } = {}) {
  const plan = huidigPlan(profiel, vandaag, opslag);
  const v = berekenVoortgang(plan, laadResultaten(opslag), profiel, vandaag);
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

  root.innerHTML = `
    <h1>Voortgang</h1>
    <div class="tegels" data-test="tegels">
      <div class="tegel"><strong data-test="totaal-km">${km(v.totaalKm)}</strong><small>km gelopen</small></div>
      <div class="tegel"><strong data-test="totaal-kcal">${v.totaalKcal}</strong><small>kcal verbruikt</small></div>
      <div class="tegel"><strong data-test="trainingen">${v.gedaan}/${v.totaal}</strong><small>trainingen gedaan</small></div>
      <div class="tegel"><strong data-test="weken">${v.wekenTotDoel}</strong><small>${v.wekenTotDoel === 1 ? 'week' : 'weken'} tot ${korteDatum(plan.doelDatum)}</small></div>
    </div>
    <div class="voortgangsbalk" role="progressbar" aria-valuemin="0" aria-valuemax="${v.totaal}" aria-valuenow="${v.gedaan}">
      <span style="width:${(v.gedaan / v.totaal) * 100}%"></span></div>

    <h2>Kilometers per week</h2>
    <div class="kaart grafiek">
      <div class="grafiek-detail" data-test="grafiek-detail">Tik op een week voor de details.</div>
      <div class="staven" data-test="staven">${staven}</div>
      <div class="staaf-labels">${labels}</div>
      <div class="legenda"><span><i class="l-gedaan"></i>Gelopen</span><span><i class="l-plan"></i>Gepland</span></div>
    </div>

    <h2>Records en voorspelling</h2>
    <div class="kaart">
      <dl class="samenvatting">
        <dt>Langste loop</dt><dd data-test="langste">${v.langste ? `${km(v.langste.afstandKm)} km <small class="hint">${korteDatum(v.langste.datum)}</small>` : 'nog geen'}</dd>
        <dt>Voorspelde 10 km</dt><dd data-test="voorspeld">${formatTijd(v.voorspeld10km)}${doel}</dd>
        <dt>Doeldatum</dt><dd>${datumTekst(plan.doelDatum)}</dd>
        ${v.overgeslagen ? `<dt>Overgeslagen</dt><dd>${v.overgeslagen}</dd>` : ''}
      </dl>
      <p class="hint">De voorspelling komt uit je 5 km-tijd. Liep je een nieuwe 5 km-tijd? Pas hem aan onder Profiel.</p>
    </div>`;

  root.onclick = (e) => {
    const staaf = e.target.closest('.staaf');
    if (!staaf) return;
    const w = v.perWeek[Number(staaf.dataset.week)];
    root.querySelectorAll('.staaf').forEach((s) => s.classList.toggle('is-gekozen', s === staaf));
    root.querySelector('[data-test=grafiek-detail]').innerHTML =
      `<strong>${w.label.startsWith('B') ? 'Basisweek ' + w.label.slice(1) : 'Week ' + w.label.slice(1)}</strong> · ${km(w.km)} van ${km(w.geplandKm)} km · ${w.kcal} kcal · ${w.gedaan}/${w.aantal} trainingen`;
  };
}

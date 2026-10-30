// Tijdelijk startscherm na de onboarding; wordt in story 4 het scherm Vandaag.
import { formatTijd } from './tijd.js';
import { datumTekst } from './datum.js';

export function toonOverzicht(root, p) {
  const extra = p.extraWeken > 0
    ? `${p.extraWeken} ${p.extraWeken === 1 ? 'week' : 'weken'} ${p.extraWekenKeuze === 'basis' ? 'basisweken ervoor' : 'later starten'}`
    : 'geen';
  root.innerHTML = `
    <h1>Je profiel staat klaar</h1>
    <p class="uitleg">Hiermee maakt de app straks je schema.</p>
    <div class="kaart">
      <dl class="samenvatting" data-test="samenvatting">
        <dt>5 km-tijd</dt><dd>${formatTijd(p.vijfKmSeconden)}</dd>
        <dt>Doel</dt><dd>${p.doelAfstand} km${p.doelSeconden ? ' in ' + formatTijd(p.doelSeconden) : ''}</dd>
        <dt>Doeldatum</dt><dd>${datumTekst(p.doelDatum)}</dd>
        <dt>Extra weken</dt><dd>${extra}</dd>
        <dt>Trainingsdagen</dt><dd>${p.trainingsdagen.join(', ')}</dd>
        <dt>Gewicht</dt><dd>${p.gewicht} kg</dd>
        <dt>Helling</dt><dd>${p.helling}%</dd>
      </dl>
    </div>`;
}

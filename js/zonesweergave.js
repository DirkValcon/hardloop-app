// Weergave van zones en de beoordeling van de doeltijd, gedeeld door onboarding en overzicht.
import { formatTijd } from './tijd.js';
import { tempoPerKm, beoordeelDoeltijd, berekenZones } from './zones.js';

const kmh = (v) => v.toFixed(1).replace('.', ',');
const tempo = (v) => formatTijd(tempoPerKm(v));

export function haalbaarheidHtml(vijfKmSeconden, doelSeconden) {
  const b = beoordeelDoeltijd(vijfKmSeconden, doelSeconden);
  const voorspeld = formatTijd(b.voorspeld);
  const procent = b.sneller != null ? Math.round(b.sneller * 100) : 0;
  const tekst = {
    geen: `Op basis van je 5 km-tijd loop je nu ongeveer ${voorspeld} op 10 km. Een haalbaar doel na 11 weken: <strong>${formatTijd(b.voorstel)}</strong>.`,
    haalbaar: `Haalbaar: je loopt nu al ongeveer ${voorspeld} op 10 km.`,
    ambitieus: `Ambitieus maar haalbaar: ${procent}% sneller dan je voorspelde ${voorspeld}.`,
    'te-snel': `Waarschijnlijk te snel voor 11 weken: ${procent}% sneller dan je voorspelde ${voorspeld}. De snelheden worden begrensd op 5% sneller.`,
  }[b.niveau];
  return `<div class="melding melding-${b.niveau}" data-test="haalbaarheid" data-niveau="${b.niveau}">${tekst}</div>`;
}

export function zonesHtml(vijfKmSeconden, doelSeconden, eigen = {}) {
  const rijen = berekenZones(vijfKmSeconden, doelSeconden, eigen).map((z) => `
    <tr data-zone="${z.id}">
      <th scope="row">${z.naam}${z.eigen ? ' <span class="badge">eigen</span>' : ''}<small>${z.gebruik}</small></th>
      <td><span class="kmh">${z.van === z.tot ? kmh(z.van) : `${kmh(z.van)}–${kmh(z.tot)}`}</span> km/u
        <small>${z.van === z.tot ? tempo(z.van) : `${tempo(z.van)}–${tempo(z.tot)}`} /km</small></td>
    </tr>`).join('');
  return `<table class="zones" data-test="zones"><tbody>${rijen}</tbody></table>`;
}

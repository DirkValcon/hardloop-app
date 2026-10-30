// Scherm Vandaag: de training van vandaag (of de eerstvolgende) met duur, afstand en calorieën.
import { volgendeTraining } from './schema.js';
import { huidigPlan } from './plan.js';
import { kcalTraining } from './calorieen.js';
import { vandaagIso, dagenTussen, datumTekst } from './datum.js';
import { kmh, km, minuten, korteDatum } from './opmaak.js';

const TYPE = { rustig: 'Rustige loop', kwaliteit: 'Kwaliteitstraining', lang: 'Lange duurloop', doel: 'Doeldag' };
const DAGNAAM = { ma: 'maandag', di: 'dinsdag', wo: 'woensdag', do: 'donderdag', vr: 'vrijdag', za: 'zaterdag', zo: 'zondag' };

// Samenvatting in fases: warming-up, kern, cooling-down.
function fases(t) {
  const som = (bl) => bl.reduce((s, b) => s + b.duurSec, 0);
  const warm = t.blokken.filter((b) => b.soort === 'warmup');
  const cool = t.blokken.filter((b) => b.soort === 'uitjoggen' || b.soort === 'uitwandelen');
  const kern = t.blokken.filter((b) => !warm.includes(b) && !cool.includes(b));
  const snelheden = [...new Set(kern.map((b) => b.kmh))].sort((a, b) => a - b);
  const bereik = (l) => (l.length > 1 ? `${kmh(l[0])}–${kmh(l.at(-1))}` : kmh(l[0]));
  return [
    { naam: 'Warming-up', duur: som(warm), snelheid: bereik(warm.map((b) => b.kmh)) },
    { naam: t.naam, duur: som(kern), snelheid: bereik(snelheden) },
    { naam: 'Uitjoggen + uitwandelen', duur: som(cool), snelheid: bereik(cool.map((b) => b.kmh).sort((a, b) => a - b)) },
  ];
}

export function toonVandaag(root, profiel, { vandaag = vandaagIso() } = {}) {
  const plan = huidigPlan(profiel, vandaag);
  const volgende = volgendeTraining(plan, vandaag);
  if (!volgende) {
    root.innerHTML = `<h1>Vandaag</h1><div class="kaart"><p>Je schema zit erop. Gefeliciteerd met je 10 km!</p></div>`;
    return;
  }
  const { training: t, week, isVandaag } = volgende;
  const dagen = dagenTussen(vandaag, t.datum);
  const wanneer = isVandaag ? 'Vandaag'
    : dagen === 1 ? 'Morgen' : `${DAGNAAM[t.dag][0].toUpperCase()}${DAGNAAM[t.dag].slice(1)} ${korteDatum(t.datum)}`;
  const rustdag = isVandaag ? '' : `<p class="uitleg" data-test="rustdag">${plan.weken[0].maandag > vandaag && week === plan.weken[0]
    ? `Je schema start op ${datumTekst(plan.weken[0].maandag)}.` : 'Vandaag is een rustdag.'} Dit is je volgende training.</p>`;
  const totDoel = dagenTussen(vandaag, plan.doelDatum);

  root.innerHTML = `
    <h1>Vandaag</h1>
    ${rustdag}
    <article class="kaart vandaag-kaart training-${t.type}" data-test="vandaag" data-training="${t.id}">
      <div class="stapnr">${wanneer} · ${week.label}</div>
      <div class="label label-${t.type}">${TYPE[t.type]}</div>
      <h2 class="vandaag-titel">${t.naam}</h2>
      <div class="cijfers">
        <div><strong data-test="duur">${minuten(t.duurSec)}</strong><small>totaal</small></div>
        <div><strong data-test="afstand">${km(t.afstandKm)} km</strong><small>ongeveer</small></div>
        <div><strong data-test="kcal">${kcalTraining(t, profiel.gewicht)}</strong><small>kcal geschat</small></div>
      </div>
      <ol class="fases">${fases(t).map((f) => `
        <li><span>${f.naam}<small>${minuten(f.duur)}</small></span><span class="blok-waarden"><strong>${f.snelheid}</strong> km/u</span></li>`).join('')}
      </ol>
      <p class="hint">Helling ${String(profiel.helling).replace('.', ',')}% · uitwandelen op 0%</p>
      <a class="knop primair breed${isVandaag ? '' : ' is-uit'}" ${isVandaag ? `href="#loop/${t.id}"` : 'aria-disabled="true"'} role="button" data-actie="start">Start op loopband</a>
    </article>
    <p class="hint" data-test="tot-doel">Nog ${totDoel} ${totDoel === 1 ? 'dag' : 'dagen'} tot je 10 km op ${datumTekst(plan.doelDatum)}.</p>`;
}

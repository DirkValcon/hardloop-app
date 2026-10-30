import { laadProfiel } from './profiel.js';
import { toonOnboarding } from './onboarding.js';
import { toonOverzicht } from './overzicht.js';
import { toonSchema } from './schemaweergave.js';
import { toonVandaag } from './vandaag.js';
import { toonVoortgang } from './voortgangweergave.js';
import { toonLoopscherm } from './loopscherm.js';
import { huidigPlan } from './plan.js';
import { vandaagIso } from './datum.js';
import { afrondFormulier, koppelAfronden } from './afronden.js';
import { kcalTraining } from './calorieen.js';
import { huidigeGebruiker, toonInloggen, accountHtml, uitloggen } from './account.js';

const root = document.getElementById('app');
let gebruiker = null;

const TABS = [
  { id: 'vandaag', naam: 'Vandaag', toon: toonVandaag,
    icoon: '<circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 8v4l3 2" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>' },
  { id: 'schema', naam: 'Schema', toon: toonSchema,
    icoon: '<path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>' },
  { id: 'voortgang', naam: 'Voortgang', toon: toonVoortgang,
    icoon: '<path d="M5 20V12M12 20V5M19 20v-9" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none"/>' },
  { id: 'profiel', naam: 'Profiel',
    toon: (r, p) => toonOverzicht(r, p, { account: accountHtml(gebruiker), uitloggen: () => uitloggen().then(start) }),
    icoon: '<circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="2" fill="none"/><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>' },
];

function toonLoop(profiel, trainingId) {
  const training = huidigPlan(profiel, vandaagIso()).weken.flatMap((w) => w.trainingen).find((t) => t.id === trainingId);
  if (!training) { location.hash = '#vandaag'; return; }
  document.body.classList.remove('met-tabs');
  document.querySelector('nav.tabs')?.remove();
  toonLoopscherm(root, training, {
    profiel,
    terug: () => { location.hash = '#vandaag'; },
    klaar: () => { location.hash = '#vandaag'; },
  });
}

function toonAfvinken(profiel, trainingId) {
  const training = huidigPlan(profiel, vandaagIso()).weken.flatMap((w) => w.trainingen).find((t) => t.id === trainingId);
  if (!training) { location.hash = '#vandaag'; return; }
  document.body.classList.remove('met-tabs');
  document.querySelector('nav.tabs')?.remove();
  root.onclick = null;
  root.innerHTML = `<h1>Afvinken</h1><p class="uitleg">${training.naam}</p>
    ${afrondFormulier({ afstandKm: training.afstandKm, duurSec: training.duurSec, kcal: kcalTraining(training, profiel.gewicht) })}`;
  const terug = () => history.length > 1 ? history.back() : (location.hash = '#vandaag');
  koppelAfronden(root, training, profiel, { opgeslagen: terug, annuleer: terug });
}

function toonTab(profiel) {
  const id = location.hash.slice(1);
  if (id.startsWith('loop/')) return toonLoop(profiel, id.slice(5));
  if (id.startsWith('afvinken/')) return toonAfvinken(profiel, id.slice(9));
  root.onclick = null;
  const tab = TABS.find((t) => t.id === id) ?? TABS[0];
  document.body.classList.add('met-tabs');
  tab.toon(root, profiel);
  let nav = document.querySelector('nav.tabs');
  if (!nav) {
    nav = document.createElement('nav');
    nav.className = 'tabs';
    document.body.append(nav);
  }
  nav.innerHTML = TABS.map((t) => `<a href="#${t.id}" ${t === tab ? 'aria-current="page"' : ''}>
    <svg viewBox="0 0 24 24" aria-hidden="true">${t.icoon}</svg>${t.naam}</a>`).join('');
}

export async function start() {
  gebruiker = await huidigeGebruiker();
  if (!gebruiker) return toonInloggen(root);
  const profiel = laadProfiel(localStorage);
  if (!profiel) {
    toonOnboarding(root, () => { location.hash = '#vandaag'; start(); });
    return;
  }
  toonTab(profiel);
}

window.addEventListener('hashchange', () => { if (gebruiker && laadProfiel(localStorage)) start(); });
start();

if ('serviceWorker' in navigator && location.hostname !== '127.0.0.1') {
  navigator.serviceWorker.register('sw.js').catch(() => { /* offline werken is een extraatje */ });
}

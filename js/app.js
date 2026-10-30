import { laadProfiel } from './profiel.js';
import { toonOnboarding } from './onboarding.js';
import { toonOverzicht } from './overzicht.js';
import { toonSchema } from './schemaweergave.js';
import { toonVandaag } from './vandaag.js';
import { toonLoopscherm } from './loopscherm.js';
import { huidigPlan } from './plan.js';
import { vandaagIso } from './datum.js';

const root = document.getElementById('app');

const TABS = [
  { id: 'vandaag', naam: 'Vandaag', toon: toonVandaag,
    icoon: '<circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 8v4l3 2" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>' },
  { id: 'schema', naam: 'Schema', toon: toonSchema,
    icoon: '<path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>' },
  { id: 'profiel', naam: 'Profiel', toon: toonOverzicht,
    icoon: '<circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="2" fill="none"/><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>' },
];

function toonLoop(profiel, trainingId) {
  const training = huidigPlan(profiel, vandaagIso()).weken.flatMap((w) => w.trainingen).find((t) => t.id === trainingId);
  if (!training) { location.hash = '#vandaag'; return; }
  document.body.classList.remove('met-tabs');
  document.querySelector('nav.tabs')?.remove();
  toonLoopscherm(root, training, {
    terug: () => { location.hash = '#vandaag'; },
    klaar: () => { location.hash = '#vandaag'; },
  });
}

function toonTab(profiel) {
  const id = location.hash.slice(1);
  if (id.startsWith('loop/')) return toonLoop(profiel, id.slice(5));
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

export function start() {
  const profiel = laadProfiel(localStorage);
  if (!profiel) {
    toonOnboarding(root, () => { location.hash = '#vandaag'; start(); });
    return;
  }
  toonTab(profiel);
}

window.addEventListener('hashchange', () => { if (laadProfiel(localStorage)) start(); });
start();

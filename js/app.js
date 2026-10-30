import { laadProfiel } from './profiel.js';
import { toonOnboarding } from './onboarding.js';
import { toonOverzicht } from './overzicht.js';
import { toonSchema } from './schemaweergave.js';

const root = document.getElementById('app');

const TABS = [
  { id: 'schema', naam: 'Schema', toon: toonSchema,
    icoon: '<path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>' },
  { id: 'profiel', naam: 'Profiel', toon: toonOverzicht,
    icoon: '<circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="2" fill="none"/><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>' },
];

function toonTab(profiel) {
  const id = location.hash.slice(1);
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
    toonOnboarding(root, () => { location.hash = '#schema'; start(); });
    return;
  }
  toonTab(profiel);
}

window.addEventListener('hashchange', () => { if (laadProfiel(localStorage)) start(); });
start();

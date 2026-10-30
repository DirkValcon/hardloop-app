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
import { huidigeGebruiker, toonInloggen, accountHtml, uitloggen, accountGegevens } from './account.js';
import { synchroniseer, isEersteKeer, noteerWijziging, wisLokaal } from './sync.js';
import { OPGESLAGEN } from './opgeslagen.js';

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
    toon: (r, p) => toonOverzicht(r, p, { account: accountHtml(gebruiker), uitloggen: afmelden }),
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

// Synchroniseren mag nooit de app blokkeren: zonder internet proberen we het later opnieuw.
let bezig = null;
async function sync() {
  if (!gebruiker) return false;
  if (bezig) return bezig;
  bezig = synchroniseer(localStorage, accountGegevens(gebruiker.id), gebruiker.id)
    .catch(() => false)
    .finally(() => { bezig = null; });
  return bezig;
}

async function syncEnTeken() {
  const veranderd = await sync();
  // Tijdens het lopen of afvinken het scherm niet onder je handen vervangen.
  if (veranderd && !/^#(loop|afvinken)\//.test(location.hash)) start();
}

let wachtrij;
function syncStraks() {
  clearTimeout(wachtrij);
  wachtrij = setTimeout(syncEnTeken, 1000);
}

async function afmelden() {
  await sync();
  wisLokaal(localStorage);
  await uitloggen().catch(() => {});
  start();
}

export async function start() {
  gebruiker = await huidigeGebruiker();
  if (!gebruiker) return toonInloggen(root);
  if (isEersteKeer(localStorage, gebruiker.id) && !laadProfiel(localStorage)) {
    // Leeg apparaat: eerst je account ophalen, anders begint een lege laptop met de onboarding.
    // Lukt dat niet snel (geen of traag internet), dan gewoon verder met wat er hier staat.
    root.innerHTML = '<p class="uitleg">Je gegevens ophalen…</p>';
    if (navigator.onLine) await Promise.race([sync(), new Promise((ok) => setTimeout(ok, 8000))]);
  } else {
    syncStraks();
  }
  const profiel = laadProfiel(localStorage);
  if (!profiel) {
    toonOnboarding(root, () => { location.hash = '#vandaag'; start(); });
    return;
  }
  toonTab(profiel);
}

window.addEventListener('hashchange', () => { if (gebruiker && laadProfiel(localStorage)) start(); });
window.addEventListener(OPGESLAGEN, (e) => { noteerWijziging(localStorage, e.detail); syncStraks(); });
window.addEventListener('online', syncStraks);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncStraks(); });
start();

if ('serviceWorker' in navigator && location.hostname !== '127.0.0.1') {
  navigator.serviceWorker.register('sw.js').catch(() => { /* offline werken is een extraatje */ });
}

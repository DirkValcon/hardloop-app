import { laadProfiel } from './profiel.js';
import { toonOnboarding } from './onboarding.js';
import { toonOverzicht } from './overzicht.js';

const root = document.getElementById('app');

export function start() {
  const profiel = laadProfiel(localStorage);
  if (profiel) toonOverzicht(root, profiel);
  else toonOnboarding(root, (nieuw) => toonOverzicht(root, nieuw));
}

start();

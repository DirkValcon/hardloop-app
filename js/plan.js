// Het plan zoals de gebruiker het ziet: het berekende schema met zijn eigen aanpassingen erop.
import { maakPlan } from './schema.js';
import { laadAanpassingen, pasToe } from './aanpassingen.js';

export function huidigPlan(profiel, vandaag, opslag = localStorage) {
  return pasToe(maakPlan(profiel, { vandaag }), laadAanpassingen(opslag));
}

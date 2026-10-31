// Korte melding onderin het scherm, eventueel met een knop (bijvoorbeeld "Ongedaan maken").
// Er staat er altijd maar één tegelijk; een nieuwe vervangt de vorige.
let huidige = null;

export function toonMelding(tekst, { actie = null, bijActie = null, duurMs = 5000 } = {}) {
  sluitMelding();
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.dataset.test = 'melding';
  const span = document.createElement('span');
  span.textContent = tekst;
  el.append(span);
  if (actie) {
    const knop = document.createElement('button');
    knop.type = 'button';
    knop.textContent = actie;
    knop.dataset.test = 'melding-actie';
    knop.addEventListener('click', () => { sluitMelding(); bijActie?.(); });
    el.append(knop);
  }
  document.body.append(el);
  const timer = setTimeout(sluitMelding, duurMs);
  huidige = { el, timer };
  return el;
}

export function sluitMelding() {
  if (!huidige) return;
  clearTimeout(huidige.timer);
  huidige.el.remove();
  huidige = null;
}

// Gegevens synchroniseren met je account, zodat telefoon en laptop hetzelfde laten zien.
// Per onderdeel geldt: wat alleen hier of alleen in het account veranderde, wint. Veranderde het op
// beide plekken, dan voegen we resultaten per training samen en wint bij profiel en aanpassingen
// de laatste wijziging. Een lopende training blijft op het apparaat.
import { OPSLAG_SLEUTEL } from './profiel.js';
import { OPSLAG_AANPASSINGEN } from './aanpassingen.js';
import { OPSLAG_RESULTATEN } from './resultaten.js';

export const ONDERDELEN = { profiel: OPSLAG_SLEUTEL, aanpassingen: OPSLAG_AANPASSINGEN, resultaten: OPSLAG_RESULTATEN };
export const OPSLAG_SYNC = 'hardloop-app.sync.v1';

function laadMeta(opslag) {
  try { return JSON.parse(opslag.getItem(OPSLAG_SYNC)) ?? {}; } catch { return {}; }
}

export function bewaarMeta(opslag, meta) {
  opslag.setItem(OPSLAG_SYNC, JSON.stringify(meta));
}

export function isEersteKeer(opslag, gebruikerId) {
  return laadMeta(opslag).gebruiker !== gebruikerId;
}

// Noteer wanneer een onderdeel lokaal gewijzigd is; dat beslist bij een botsing.
export function noteerWijziging(opslag, sleutel, tijd = new Date().toISOString()) {
  const naam = Object.keys(ONDERDELEN).find((n) => ONDERDELEN[n] === sleutel);
  if (!naam) return;
  const meta = laadMeta(opslag);
  bewaarMeta(opslag, { ...meta, lokaal: { ...meta.lokaal, [naam]: tijd } });
}

// Resultaten per training samenvoegen ten opzichte van de vorige gezamenlijke stand,
// zodat ook "ongedaan maken" op het ene apparaat op het andere doorkomt.
export function voegResultatenSamen(basis, lokaal, account) {
  const p = (t) => (t ? JSON.parse(t) : {});
  const [b, l, a] = [p(basis), p(lokaal), p(account)];
  const uit = {};
  for (const id of new Set([...Object.keys(l), ...Object.keys(a)])) {
    const [bs, ls, as] = [b[id], l[id], a[id]].map((x) => JSON.stringify(x));
    const keuze = ls === bs ? a[id] : as === bs ? l[id] : l[id];
    if (keuze !== undefined) uit[id] = keuze;
  }
  return JSON.stringify(uit);
}

// Beslis per onderdeel wat de nieuwe stand is, door lokaal en account te vergelijken met de
// vorige gezamenlijke stand (basis). Geeft de tekst terug, of null als er niets is.
export function bepaal(naam, { lokaal, basis = null, account, lokaalTijd }) {
  const lokaalAnders = lokaal !== basis;
  const accountAnders = (account?.waarde ?? null) !== basis;
  if (!accountAnders || !account) return lokaal ?? account?.waarde ?? null;
  if (!lokaalAnders || lokaal === null) return account.waarde;
  if (naam === 'resultaten') return voegResultatenSamen(basis, lokaal, account.waarde);
  return lokaalTijd && lokaalTijd > account.bijgewerkt ? lokaal : account.waarde;
}

// Eén synchronisatieronde. `account` is { haal(): [{naam, waarde, bijgewerkt}], bewaar(naam, waarde, bijgewerkt) }.
// Geeft true terug als er lokaal iets veranderd is (dan moet het scherm opnieuw getekend worden).
export async function synchroniseer(opslag, account, gebruikerId, nu = () => new Date().toISOString()) {
  const meta = laadMeta(opslag);
  const eerste = meta.gebruiker !== gebruikerId;
  const basis = eerste ? {} : meta.basis ?? {};
  const rijen = Object.fromEntries((await account.haal()).map((r) => [r.naam, r]));
  const nieuw = { gebruiker: gebruikerId, basis: {}, lokaal: {} };
  let veranderd = false;

  for (const [naam, sleutel] of Object.entries(ONDERDELEN)) {
    const lokaal = opslag.getItem(sleutel);
    const rij = rijen[naam] ?? null;
    const tekst = bepaal(naam, {
      lokaal, basis: basis[naam], account: rij, lokaalTijd: meta.lokaal?.[naam],
    });
    if (tekst !== lokaal && tekst !== null) { opslag.setItem(sleutel, tekst); veranderd = true; }
    if (tekst !== null && tekst !== rij?.waarde) await account.bewaar(naam, tekst, nu());
    nieuw.basis[naam] = tekst;
  }
  // Wijzigingen die tijdens deze ronde lokaal zijn bewaard, blijven staan voor de volgende ronde.
  const tussendoor = laadMeta(opslag).lokaal ?? {};
  for (const naam of Object.keys(ONDERDELEN)) {
    if (opslag.getItem(ONDERDELEN[naam]) !== nieuw.basis[naam] && tussendoor[naam]) nieuw.lokaal[naam] = tussendoor[naam];
  }
  bewaarMeta(opslag, nieuw);
  return veranderd;
}

// Bij uitloggen: alles van de app van dit apparaat wissen.
export function wisLokaal(opslag) {
  const sleutels = Array.from({ length: opslag.length }, (_, i) => opslag.key(i));
  for (const sleutel of sleutels) if (sleutel.startsWith('hardloop-app.')) opslag.removeItem(sleutel);
}

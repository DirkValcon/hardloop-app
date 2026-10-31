// Datums als "JJJJ-MM-DD" (lokale kalenderdag, geen tijdzonegedoe).

export function naarDatum(iso) {
  const [j, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(j, m - 1, d));
}

export function naarIso(datum) {
  return datum.toISOString().slice(0, 10);
}

export function vandaagIso(nu = new Date()) {
  const j = nu.getFullYear();
  const m = String(nu.getMonth() + 1).padStart(2, '0');
  const d = String(nu.getDate()).padStart(2, '0');
  return `${j}-${m}-${d}`;
}

export function plusDagen(iso, dagen) {
  const d = naarDatum(iso);
  d.setUTCDate(d.getUTCDate() + dagen);
  return naarIso(d);
}

// Maandag van de week waarin `iso` valt.
export function maandagVan(iso) {
  const d = naarDatum(iso);
  return plusDagen(iso, -((d.getUTCDay() + 6) % 7));
}

export function dagenTussen(vanIso, totIso) {
  return Math.round((naarDatum(totIso) - naarDatum(vanIso)) / 86400000);
}

const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli',
  'augustus', 'september', 'oktober', 'november', 'december'];

export function datumTekst(iso) {
  const d = naarDatum(iso);
  return `${d.getUTCDate()} ${MAANDEN[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

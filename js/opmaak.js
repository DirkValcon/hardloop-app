// Kleine opmaakhulpjes voor Nederlandse weergave.
import { naarDatum } from './datum.js';

export const kmh = (v) => v.toFixed(1).replace('.', ',');
export const km = (v) => (Math.round(v * 10) / 10).toString().replace('.', ',');
export const minuten = (sec) => {
  const m = Math.round(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)} u ${m % 60} min` : `${m} min`;
};
export const blokDuur = (sec) => (sec % 60 === 0 ? `${sec / 60} min` : sec < 60 ? `${sec} s` : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')} min`);

const KORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
export const korteDatum = (iso) => { const d = naarDatum(iso); return `${d.getUTCDate()} ${KORT[d.getUTCMonth()]}`; };

export const escape = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

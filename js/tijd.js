// Tijden als "mm:ss" of "u:mm:ss" omzetten naar seconden en terug.

export function parseTijd(tekst) {
  if (typeof tekst !== 'string') return null;
  let t = tekst.trim().replace(/[.,]/g, ':');
  // Alleen cijfers (iPhone-cijfertoetsenbord heeft geen dubbele punt): "3500" = 35:00, "10500" = 1:05:00.
  if (/^\d{3,6}$/.test(t)) t = t.length <= 4 ? `${t.slice(0, -2)}:${t.slice(-2)}` : `${t.slice(0, -4)}:${t.slice(-4, -2)}:${t.slice(-2)}`;
  const delen = t.split(':');
  if (delen.length < 2 || delen.length > 3) return null;
  if (!delen.every((d) => /^\d+$/.test(d))) return null;
  const getallen = delen.map(Number);
  const sec = getallen[getallen.length - 1];
  const min = getallen[getallen.length - 2];
  if (sec > 59) return null;
  if (delen.length === 3 && min > 59) return null;
  const uur = delen.length === 3 ? getallen[0] : 0;
  return uur * 3600 + min * 60 + sec;
}

export function formatTijd(seconden) {
  const s = Math.round(seconden);
  const uur = Math.floor(s / 3600);
  const min = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return uur > 0 ? `${uur}:${String(min).padStart(2, '0')}:${sec}` : `${min}:${sec}`;
}

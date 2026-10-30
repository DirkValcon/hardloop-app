import { test } from 'node:test';
import assert from 'node:assert/strict';
import { synchroniseer, voegResultatenSamen, noteerWijziging, isEersteKeer, wisLokaal, OPSLAG_SYNC } from '../js/sync.js';

const P = 'hardloop-app.profiel.v1';
const A = 'hardloop-app.aanpassingen.v1';
const R = 'hardloop-app.resultaten.v1';
const L = 'hardloop-app.lopend.v1';

function opslag(d = {}) {
  return {
    d: { ...d },
    get length() { return Object.keys(this.d).length; },
    key(i) { return Object.keys(this.d)[i] ?? null; },
    getItem(k) { return this.d[k] ?? null; },
    setItem(k, v) { this.d[k] = String(v); },
    removeItem(k) { delete this.d[k]; },
  };
}

// Nep-account: dezelfde rijen als de Supabase-tabel.
function account(rijen = {}) {
  return {
    rijen: { ...rijen },
    async haal() { return Object.entries(this.rijen).map(([naam, r]) => ({ naam, ...r })); },
    async bewaar(naam, waarde, bijgewerkt) { this.rijen[naam] = { waarde, bijgewerkt }; },
  };
}

let klok = 0;
const nu = () => `2026-10-30T13:${String(10 + klok++).padStart(2, '0')}:00.000Z`;
const res = (o) => JSON.stringify(o);

test('eerste keer inloggen met een leeg account: lokale gegevens gaan mee naar het account', async () => {
  const tel = opslag({ [P]: '{"gewicht":80}', [R]: res({ a: { status: 'gedaan' } }), [L]: '{"blok":2}' });
  const acc = account();
  assert.equal(isEersteKeer(tel, 'dirk'), true);
  const veranderd = await synchroniseer(tel, acc, 'dirk', nu);
  assert.equal(veranderd, false);
  assert.equal(acc.rijen.profiel.waarde, '{"gewicht":80}');
  assert.equal(acc.rijen.resultaten.waarde, res({ a: { status: 'gedaan' } }));
  assert.equal(acc.rijen.lopend, undefined, 'een lopende training blijft op het apparaat');
  assert.equal(acc.rijen.aanpassingen, undefined, 'niets om te bewaren');
  assert.equal(isEersteKeer(tel, 'dirk'), false);
});

test('leeg apparaat (laptop) haalt alles uit het account', async () => {
  const acc = account();
  await synchroniseer(opslag({ [P]: '{"gewicht":80}', [A]: '{"verplaatst":{},"vrij":[]}' }), acc, 'dirk', nu);
  const laptop = opslag();
  assert.equal(await synchroniseer(laptop, acc, 'dirk', nu), true);
  assert.equal(laptop.getItem(P), '{"gewicht":80}');
  assert.equal(laptop.getItem(A), '{"verplaatst":{},"vrij":[]}');
});

test('wijziging op de telefoon komt op de laptop, en terug', async () => {
  const acc = account();
  const tel = opslag({ [P]: '{"gewicht":80}' });
  const laptop = opslag();
  await synchroniseer(tel, acc, 'dirk', nu);
  await synchroniseer(laptop, acc, 'dirk', nu);

  tel.setItem(R, res({ a: { status: 'gedaan' } }));
  await synchroniseer(tel, acc, 'dirk', nu);
  assert.equal(await synchroniseer(laptop, acc, 'dirk', nu), true);
  assert.equal(laptop.getItem(R), res({ a: { status: 'gedaan' } }));

  laptop.setItem(P, '{"gewicht":78}');
  await synchroniseer(laptop, acc, 'dirk', nu);
  await synchroniseer(tel, acc, 'dirk', nu);
  assert.equal(tel.getItem(P), '{"gewicht":78}');
});

test('zonder wijzigingen wordt er niets opnieuw bewaard', async () => {
  const acc = account();
  const tel = opslag({ [P]: '{"gewicht":80}' });
  await synchroniseer(tel, acc, 'dirk', nu);
  const voor = acc.rijen.profiel.bijgewerkt;
  assert.equal(await synchroniseer(tel, acc, 'dirk', nu), false);
  assert.equal(acc.rijen.profiel.bijgewerkt, voor);
});

test('afgevinkte trainingen van twee apparaten worden samengevoegd, ook ongedaan maken', async () => {
  const acc = account();
  const tel = opslag({ [R]: res({ a: { status: 'gedaan' }, b: { status: 'gedaan' } }) });
  const laptop = opslag();
  await synchroniseer(tel, acc, 'dirk', nu);
  await synchroniseer(laptop, acc, 'dirk', nu);
  // Offline op beide: telefoon vinkt c af, laptop maakt b ongedaan en slaat d over.
  tel.setItem(R, res({ a: { status: 'gedaan' }, b: { status: 'gedaan' }, c: { status: 'gedaan' } }));
  laptop.setItem(R, res({ a: { status: 'gedaan' }, d: { status: 'overgeslagen' } }));
  await synchroniseer(laptop, acc, 'dirk', nu);
  await synchroniseer(tel, acc, 'dirk', nu);
  await synchroniseer(laptop, acc, 'dirk', nu);
  const verwacht = { a: { status: 'gedaan' }, c: { status: 'gedaan' }, d: { status: 'overgeslagen' } };
  assert.deepEqual(JSON.parse(tel.getItem(R)), verwacht);
  assert.deepEqual(JSON.parse(laptop.getItem(R)), verwacht);
});

test('eerste keer inloggen met gegevens op beide plekken: resultaten samengevoegd, profiel uit het account', async () => {
  const acc = account({
    profiel: { waarde: '{"gewicht":78}', bijgewerkt: '2026-10-29T10:00:00.000Z' },
    resultaten: { waarde: res({ a: { status: 'gedaan' } }), bijgewerkt: '2026-10-29T10:00:00.000Z' },
  });
  const tel = opslag({ [P]: '{"gewicht":80}', [R]: res({ b: { status: 'gedaan' } }) });
  await synchroniseer(tel, acc, 'dirk', nu);
  assert.equal(tel.getItem(P), '{"gewicht":78}');
  assert.deepEqual(JSON.parse(tel.getItem(R)), { a: { status: 'gedaan' }, b: { status: 'gedaan' } });
  assert.deepEqual(JSON.parse(acc.rijen.resultaten.waarde), { a: { status: 'gedaan' }, b: { status: 'gedaan' } });
});

test('profiel op beide plekken gewijzigd: de laatste wijziging wint', async () => {
  const acc = account();
  const tel = opslag({ [P]: '{"gewicht":80}' });
  const laptop = opslag();
  await synchroniseer(tel, acc, 'dirk', nu);
  await synchroniseer(laptop, acc, 'dirk', nu);
  laptop.setItem(P, '{"gewicht":79}');
  noteerWijziging(laptop, P, '2026-10-30T15:00:00.000Z');
  tel.setItem(P, '{"gewicht":77}');
  noteerWijziging(tel, P, '2026-10-30T16:00:00.000Z');
  await synchroniseer(laptop, acc, 'dirk', () => '2026-10-30T15:00:01.000Z');
  await synchroniseer(tel, acc, 'dirk', () => '2026-10-30T16:00:01.000Z');
  assert.equal(tel.getItem(P), '{"gewicht":77}', 'telefoon was later, die wint');
  await synchroniseer(laptop, acc, 'dirk', nu);
  assert.equal(laptop.getItem(P), '{"gewicht":77}');
});

test('een fout bij het account laat de lokale gegevens en de vorige stand intact', async () => {
  const tel = opslag({ [P]: '{"gewicht":80}' });
  const kapot = { haal: async () => { throw new Error('geen internet'); }, bewaar: async () => {} };
  await assert.rejects(synchroniseer(tel, kapot, 'dirk', nu));
  assert.equal(tel.getItem(P), '{"gewicht":80}');
  assert.equal(tel.getItem(OPSLAG_SYNC), null);
});

test('samenvoegen: wat alleen aan één kant veranderde wint', () => {
  const b = res({ a: 1, b: 2 });
  assert.equal(voegResultatenSamen(b, res({ a: 1, b: 2, c: 3 }), res({ a: 9, b: 2 })), res({ a: 9, b: 2, c: 3 }));
  assert.equal(voegResultatenSamen(b, res({ a: 1 }), b), res({ a: 1 }));
  assert.equal(voegResultatenSamen(null, res({ x: 1 }), res({ y: 2 })), res({ x: 1, y: 2 }));
});

test('uitloggen wist alle app-gegevens van het apparaat, maar niets anders', () => {
  const o = opslag({ [P]: '{}', [R]: '{}', [L]: '{}', [OPSLAG_SYNC]: '{}', 'sb-x-auth-token': 'sessie' });
  wisLokaal(o);
  assert.deepEqual(Object.keys(o.d), ['sb-x-auth-token']);
});

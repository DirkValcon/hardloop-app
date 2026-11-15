import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maakPlan } from '../js/schema.js';
import { legeAanpassingen, verplaats, zetVrij, pasToe, laadAanpassingen, bewaarAanpassingen } from '../js/aanpassingen.js';
import { DIRK_PROFIEL as DIRK } from './fixtures.js';

const plan = maakPlan(DIRK, { vandaag: '2026-10-30' }); // week 1: di 3, do 5, zo 8 nov
const week = (p, n) => p.weken[n - 1];
const watWanneer = (w) => w.trainingen.map((t) => `${t.dag}:${t.type}`).join(' ');

test('standaardschema van Dirk geeft geen waarschuwingen', () => {
  const p = pasToe(plan, legeAanpassingen());
  assert.deepEqual(p.weken.flatMap((w) => w.waarschuwingen), []);
});

test('verschuiven verandert alleen die week', () => {
  const a = verplaats(plan, legeAanpassingen(), 'w2-rustig', '2026-11-11'); // di → wo
  const p = pasToe(plan, a);
  assert.equal(watWanneer(week(p, 2)), 'wo:rustig do:kwaliteit zo:lang');
  for (const n of [1, 3, 4, 11]) assert.deepEqual(week(p, n).trainingen, week(plan, n).trainingen);
});

test('naar een dag met een training: ze ruilen van plek', () => {
  const a = verplaats(plan, legeAanpassingen(), 'w1-rustig', '2026-11-05'); // di → do
  assert.equal(watWanneer(week(pasToe(plan, a), 1)), 'di:kwaliteit do:rustig zo:lang');
});

test('niet naar een andere week, en de 10 km blijft staan', () => {
  assert.throws(() => verplaats(plan, legeAanpassingen(), 'w1-lang', '2026-11-09'), /dezelfde week/);
  assert.throws(() => verplaats(plan, legeAanpassingen(), 'w11-doel', '2027-01-16'), /doeldatum/);
});

test('twee zware trainingen achter elkaar geeft een waarschuwing', () => {
  const a = verplaats(plan, legeAanpassingen(), 'w1-kwaliteit', '2026-11-07'); // do → za, vóór de lange loop
  const p = pasToe(plan, a);
  assert.equal(week(p, 1).waarschuwingen.length, 1);
  assert.equal(week(p, 1).waarschuwingen[0].soort, 'zwaar-na-zwaar');
  assert.equal(watWanneer(week(p, 1)), 'di:rustig za:kwaliteit zo:lang');
});

test('geen rustdag na de lange loop geeft een waarschuwing, ook over de weekgrens', () => {
  // Lange loop week 1 op zo 8 nov; rustige loop week 2 naar ma 9 nov.
  const a = verplaats(plan, legeAanpassingen(), 'w2-rustig', '2026-11-09');
  const p = pasToe(plan, a);
  assert.equal(week(p, 2).waarschuwingen[0].soort, 'geen-rust-na-lang');
});

test('dag vrij zetten: eerst vervalt de rustige loop, kwaliteit en lange loop blijven', () => {
  // Zondag vrij in week 1: de lange loop schuift naar dinsdag, de rustige duurloop vervalt.
  const p = pasToe(plan, zetVrij(legeAanpassingen(), '2026-11-08'));
  assert.equal(watWanneer(week(p, 1)), 'di:lang do:kwaliteit');
  assert.deepEqual(week(p, 1).vervallen.map((t) => t.type), ['rustig']);
  assert.deepEqual(week(p, 2).trainingen, week(plan, 2).trainingen);
});

test('bij 5 dagen valt eerst een extra rustige loop weg', () => {
  const vijf = maakPlan({ ...DIRK, trainingsdagen: ['ma', 'di', 'do', 'za', 'zo'] }, { vandaag: '2026-10-30' });
  const p = pasToe(vijf, zetVrij(legeAanpassingen(), '2026-11-05')); // do (kwaliteit) vrij
  const w = week(p, 1);
  assert.equal(w.trainingen.length, 4);
  assert.ok(w.vervallen[0].extra);
  assert.ok(w.trainingen.some((t) => t.type === 'kwaliteit'));
  assert.ok(w.trainingen.some((t) => t.type === 'lang'));
  assert.ok(w.trainingen.every((t) => t.datum !== '2026-11-05'));
});

test('vrij zetten ongedaan maken herstelt de week', () => {
  const a = zetVrij(zetVrij(legeAanpassingen(), '2026-11-08'), '2026-11-08', false);
  assert.deepEqual(week(pasToe(plan, a), 1).trainingen, week(plan, 1).trainingen);
});

test('aanpassingen blijven bewaard', () => {
  const opslag = { d: {}, getItem(k) { return this.d[k] ?? null; }, setItem(k, v) { this.d[k] = v; } };
  assert.deepEqual(laadAanpassingen(opslag), legeAanpassingen());
  const a = verplaats(plan, legeAanpassingen(), 'w1-rustig', '2026-11-04');
  bewaarAanpassingen(opslag, a);
  assert.deepEqual(laadAanpassingen(opslag), a);
});

// ---------- Vakantie ----------
import { voegVakantieToe, verwijderVakantie } from '../js/aanpassingen.js';

const datums = (p) => p.weken.flatMap((w) => w.trainingen).map((t) => `${t.id}@${t.datum}`);

test('vakantie met 2 trainingsdagen: de derde training schuift door, alles erna één trainingsdag op', () => {
  // Week 3 (16-22 nov): di rustig, do kwaliteit, zo lang. Op vakantie wel di en do.
  const a = voegVakantieToe(legeAanpassingen(), { van: '2026-11-16', tot: '2026-11-22', dagen: ['2026-11-17', '2026-11-19'] });
  const p = pasToe(plan, a);
  assert.equal(watWanneer(week(p, 3)), 'di:rustig do:kwaliteit');
  const alle = datums(p);
  assert.ok(alle.includes('w3-lang@2026-11-24'));
  assert.ok(alle.includes('w4-rustig@2026-11-26'));
  assert.ok(alle.includes('w4-kwaliteit@2026-11-29'));
  // De doelloop schuift evenveel dagen als de laatste training ervoor (zo → wo: 3 dagen).
  assert.equal(p.doelDatum, '2027-01-20');
  assert.equal(p.vakanties[0].doelVerschuiving, 3);
  assert.equal(p.weken.at(-1).label, 'Week 12');
  // Trainingen vóór de vakantie blijven staan, er gaat niets verloren.
  for (const n of [1, 2]) assert.deepEqual(week(p, n).trainingen, week(plan, n).trainingen);
  assert.equal(alle.length, plan.weken.flatMap((w) => w.trainingen).length);
});

test('vakantie op andere dagen dan gepland: trainingen gaan naar de gekozen dagen', () => {
  const a = voegVakantieToe(legeAanpassingen(), { van: '2026-11-16', tot: '2026-11-22', dagen: ['2026-11-16', '2026-11-18', '2026-11-20'] });
  const p = pasToe(plan, a);
  assert.equal(watWanneer(week(p, 3)), 'ma:rustig wo:kwaliteit vr:lang');
  assert.equal(p.doelDatum, plan.doelDatum);
  assert.deepEqual(week(p, 4).trainingen, week(plan, 4).trainingen);
});

test('vakantie zonder trainingsdagen: een week vol trainingen schuift drie trainingsdagen op', () => {
  const a = voegVakantieToe(legeAanpassingen(), { van: '2026-11-16', tot: '2026-11-22' });
  const p = pasToe(plan, a);
  assert.equal(week(p, 3).trainingen.length, 0);
  assert.equal(watWanneer(week(p, 4)), 'di:rustig do:kwaliteit zo:lang');
  assert.equal(p.doelDatum, '2027-01-24');
});

test('vakantie weghalen zet alles terug; overlappende vakantie vervangt de oude', () => {
  let a = voegVakantieToe(legeAanpassingen(), { van: '2026-11-16', tot: '2026-11-22', dagen: ['2026-11-17'] });
  a = voegVakantieToe(a, { van: '2026-11-20', tot: '2026-11-25', dagen: [] });
  assert.equal(a.vakanties.length, 1);
  assert.equal(a.vakanties[0].van, '2026-11-20');
  const p = pasToe(plan, verwijderVakantie(a, '2026-11-20'));
  assert.deepEqual(datums(p), datums(plan));
  assert.equal(p.doelDatum, plan.doelDatum);
});

test('ongeldige periode wordt geweigerd; oude opslag zonder vakanties werkt nog', () => {
  assert.throws(() => voegVakantieToe(legeAanpassingen(), { van: '2026-11-22', tot: '2026-11-16' }), /periode/);
  const opslag = new Map([['hardloop-app.aanpassingen.v1', JSON.stringify({ verplaatst: {}, vrij: [] })]]);
  const a = laadAanpassingen({ getItem: (k) => opslag.get(k) });
  assert.deepEqual(a.vakanties, []);
});

test('na een vakantie kun je een doorgeschoven training binnen zijn nieuwe week verplaatsen', () => {
  const a = voegVakantieToe(legeAanpassingen(), { van: '2026-11-16', tot: '2026-11-22', dagen: ['2026-11-17', '2026-11-19'] });
  const b = verplaats(pasToe(plan, a), a, 'w3-lang', '2026-11-28'); // di 24 → za 28
  assert.ok(datums(pasToe(plan, b)).includes('w3-lang@2026-11-28'));
});

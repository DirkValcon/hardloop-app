// Het schema 5 → 10 km: een sjabloon met regels, waaruit per profiel een plan wordt berekend.
// Het plan wordt niet opgeslagen maar steeds opnieuw berekend; aanpassingen per week en
// afgevinkte trainingen worden later los bewaard, gekoppeld aan het id van de training.
import { DAGEN } from './profiel.js';
import { berekenZones, rondSnelheid } from './zones.js';
import { naarDatum, plusDagen, vandaagIso } from './datum.js';

export const SJABLOON_5_10 = {
  id: '5-10',
  naam: '5 → 10 km',
  weken: 11,
  herstelweken: [4, 8],
  // Afstanden in km, exclusief warming-up en cooling-down.
  rustig: [4, 4.5, 5, 4, 5, 5, 5.5, 4.5, 6, 5, 4],
  lang: [5, 6, 6.5, 5, 7, 8, 8.5, 6, 9, 10, null], // week 11: de 10 km op doeltijd
  extraRustig: [3, 3, 3, 3, 4, 4, 4, 3, 5, 5, 3],
  kwaliteit: [
    { vorm: 'intervallen', naam: '6 × 400 m op 5 km-tempo', herhaal: 6, meters: 400, zone: 'tempo5', herstelSec: 90 },
    { vorm: 'tempo', naam: '2 × 8 min op 10 km-tempo', herhaal: 2, sec: 480, zone: 'tempo10', herstelSec: 180 },
    { vorm: 'fartlek', naam: 'Fartlek: 8 × 1 min snel / 1 min rustig', herhaal: 8, sec: 60, zone: 'snel', herstelSec: 60 },
    { vorm: 'tijdsblokken', naam: '5 × 2 min op 5 km-tempo', herhaal: 5, sec: 120, zone: 'tempo5', herstelSec: 90 },
    { vorm: 'intervallen', naam: '5 × 800 m op 5 km-tempo', herhaal: 5, meters: 800, zone: 'tempo5', herstelSec: 120 },
    { vorm: 'tempo', naam: '2 × 12 min op 10 km-tempo', herhaal: 2, sec: 720, zone: 'tempo10', herstelSec: 180 },
    { vorm: 'piramide', naam: 'Piramide: 1-2-3-2-1 min snel', piramide: [60, 120, 180, 120, 60], zone: 'snel' },
    { vorm: 'tempo', naam: 'Tempo: 15 min aaneen', herhaal: 1, sec: 900, zone: 'tempo10', herstelSec: 0 },
    { vorm: 'intervallen', naam: '4 × 1 km op 10 km-tempo', herhaal: 4, meters: 1000, zone: 'tempo10', herstelSec: 120 },
    { vorm: 'progressief', naam: 'Progressief: 20 min, elke 5 min +0,3 km/u', stappen: 4, sec: 300, stap: 0.3, zone: 'tempo10' },
    { vorm: 'intervallen', naam: '4 × 400 m losjes op 5 km-tempo', herhaal: 4, meters: 400, zone: 'tempo5', herstelSec: 90 },
  ],
  basis: { rustig: 3.5, lang: 5, versnellingen: { herhaal: 6, sec: 20, herstelSec: 40 } },
};

const WARMUP_SEC = 600;
const UITJOGGEN_SEC = 180;
const UITWANDELEN_SEC = 120;

// ---------- Blokken ----------

function maakBouwer(zones, helling) {
  const z = Object.fromEntries(zones.map((x) => [x.id, x]));
  const midden = (id) => rondSnelheid((z[id].van + z[id].tot) / 2);
  const blok = (soort, label, kmh, sec, extra = {}) => ({ soort, label, kmh, duurSec: Math.round(sec), helling, ...extra });
  const opAfstand = (soort, label, kmh, meters, extra) =>
    blok(soort, label, kmh, (meters / 1000 / kmh) * 3600, { afstandM: meters, ...extra });
  return {
    z, midden, blok, opAfstand,
    warmup: () => {
      // Oplopend in drie stappen: 4 + 3 + 3 minuten.
      const { van, tot } = z.warmup;
      const mid = rondSnelheid((van + tot) / 2);
      return [
        blok('warmup', 'Warming-up', van, 240, { deel: '1/3' }),
        blok('warmup', 'Warming-up', mid, 180, { deel: '2/3' }),
        blok('warmup', 'Warming-up', tot, 180, { deel: '3/3' }),
      ];
    },
    coolingdown: () => [
      blok('uitjoggen', 'Uitjoggen', z.uitjoggen.van, UITJOGGEN_SEC),
      blok('uitwandelen', 'Uitwandelen', z.uitwandelen.van, UITWANDELEN_SEC, { helling: 0 }),
    ],
  };
}

function kernKwaliteit(def, b) {
  const herstel = (sec, i) => b.blok('herstel', 'Herstel', b.z.rustig.van, sec, { herhaling: i });
  const blokken = [];
  if (def.piramide) {
    def.piramide.forEach((sec, i) => {
      blokken.push(b.blok('interval', 'Snel', b.z.snel.van, sec, { herhaling: i + 1, van: def.piramide.length }));
      if (i < def.piramide.length - 1) blokken.push(herstel(sec, i + 1));
    });
    return blokken;
  }
  if (def.vorm === 'progressief') {
    const eind = b.z[def.zone].van;
    for (let i = 0; i < def.stappen; i++) {
      const kmh = rondSnelheid(eind - def.stap * (def.stappen - 1 - i));
      blokken.push(b.blok('tempo', 'Progressief', kmh, def.sec, { herhaling: i + 1, van: def.stappen }));
    }
    return blokken;
  }
  const soort = def.vorm === 'tempo' ? 'tempo' : 'interval';
  const label = { tempo5: '5 km-tempo', tempo10: '10 km-tempo', snel: 'Snel' }[def.zone];
  for (let i = 1; i <= def.herhaal; i++) {
    const kmh = b.z[def.zone].van;
    const extra = { herhaling: i, van: def.herhaal };
    blokken.push(def.meters ? b.opAfstand(soort, label, kmh, def.meters, extra) : b.blok(soort, label, kmh, def.sec, extra));
    if (i < def.herhaal && def.herstelSec) blokken.push(herstel(def.herstelSec, i));
  }
  return blokken;
}

function training(type, naam, kern, b, extra = {}) {
  const blokken = [...b.warmup(), ...kern, ...b.coolingdown()];
  const duurSec = blokken.reduce((s, x) => s + x.duurSec, 0);
  const afstandKm = blokken.reduce((s, x) => s + (x.kmh * x.duurSec) / 3600, 0);
  return { type, naam, blokken, duurSec, afstandKm: Math.round(afstandKm * 10) / 10, ...extra };
}

const rustigeLoop = (km, b, naam = `Rustige duurloop ${km.toString().replace('.', ',')} km`) =>
  training('rustig', naam, [b.opAfstand('rustig', 'Rustig', b.midden('rustig'), km * 1000)], b);

const langeLoop = (km, b) =>
  training('lang', `Lange duurloop ${km.toString().replace('.', ',')} km`, [b.opAfstand('rustig', 'Rustig', b.midden('rustig'), km * 1000)], b);

// ---------- Dagindeling ----------

const dagIndex = (d) => DAGEN.indexOf(d);

// Lange loop op de laatste trainingsdag van de week; de kwaliteitstraining op de dag die het
// verst van de lange loop ligt (ook over de weekgrens heen), zodat zware dagen niet aansluiten.
export function verdeelDagen(trainingsdagen) {
  const dagen = [...trainingsdagen].sort((a, b) => dagIndex(a) - dagIndex(b));
  const lang = dagen[dagen.length - 1];
  const afstand = (a, b) => { const d = Math.abs(dagIndex(a) - dagIndex(b)); return Math.min(d, 7 - d); };
  const overig = dagen.slice(0, -1);
  const kwaliteit = overig.reduce((best, d) => (afstand(d, lang) > afstand(best, lang) ? d : best), overig[0]);
  return Object.fromEntries(dagen.map((d) => [d, d === lang ? 'lang' : d === kwaliteit ? 'kwaliteit' : 'rustig']));
}

export function maandagVan(iso) {
  const d = naarDatum(iso);
  return plusDagen(iso, -((d.getUTCDay() + 6) % 7));
}

// ---------- Plan ----------

export function maakPlan(profiel, { sjabloon = SJABLOON_5_10, vandaag = vandaagIso() } = {}) {
  const zones = berekenZones(profiel.vijfKmSeconden, profiel.doelSeconden);
  const b = maakBouwer(zones, profiel.helling);
  const indeling = verdeelDagen(profiel.trainingsdagen);
  const dagen = Object.keys(indeling);

  const laatsteMaandag = maandagVan(profiel.doelDatum);
  const eersteMaandag = plusDagen(laatsteMaandag, -(sjabloon.weken - 1) * 7);
  const weken = [];

  // Basisweken vóór het schema, als daarvoor gekozen is.
  if (profiel.extraWekenKeuze === 'basis') {
    const vandaagMaandag = maandagVan(vandaag);
    const startMaandag = vandaag === vandaagMaandag ? vandaag : plusDagen(vandaagMaandag, 7);
    const aantal = Math.max(0, Math.round((naarDatum(eersteMaandag) - naarDatum(startMaandag)) / (7 * 86400000)));
    for (let i = 0; i < aantal; i++) {
      const maandag = plusDagen(startMaandag, i * 7);
      let versnellingGehad = false;
      const trainingen = dagen.map((dag) => {
        const datum = plusDagen(maandag, dagIndex(dag));
        const id = `b${i + 1}-${dag}`;
        if (indeling[dag] === 'lang') return { id, datum, dag, ...langeLoop(sjabloon.basis.lang, b) };
        if (indeling[dag] === 'kwaliteit' && !versnellingGehad) {
          versnellingGehad = true;
          const v = sjabloon.basis.versnellingen;
          const kern = [b.opAfstand('rustig', 'Rustig', b.midden('rustig'), sjabloon.basis.rustig * 1000)];
          for (let r = 1; r <= v.herhaal; r++) {
            kern.push(b.blok('interval', 'Versnelling', b.z.snel.van, v.sec, { herhaling: r, van: v.herhaal }));
            kern.push(b.blok('herstel', 'Herstel', b.z.rustig.van, v.herstelSec, { herhaling: r }));
          }
          return { id, datum, dag, ...training('rustig', `Rustig ${String(sjabloon.basis.rustig).replace('.', ',')} km + ${v.herhaal} versnellingen`, kern, b) };
        }
        return { id, datum, dag, ...rustigeLoop(sjabloon.basis.rustig, b) };
      });
      weken.push({ nummer: i + 1, soort: 'basis', label: `Basisweek ${i + 1}`, maandag, trainingen });
    }
  }

  for (let w = 1; w <= sjabloon.weken; w++) {
    const maandag = plusDagen(eersteMaandag, (w - 1) * 7);
    const i = w - 1;
    let extraNr = 0;
    let trainingen = dagen.map((dag) => {
      const datum = plusDagen(maandag, dagIndex(dag));
      const soort = indeling[dag];
      if (soort === 'lang') {
        return { id: `w${w}-lang`, datum, dag, ...(sjabloon.lang[i] ? langeLoop(sjabloon.lang[i], b) : null) };
      }
      if (soort === 'kwaliteit') {
        const def = sjabloon.kwaliteit[i];
        return { id: `w${w}-kwaliteit`, datum, dag, ...training('kwaliteit', def.naam, kernKwaliteit(def, b), b, { vorm: def.vorm }) };
      }
      // De eerste rustige dag is de vaste rustige duurloop, de rest zijn extra rustige loopjes.
      extraNr += 1;
      return extraNr === 1
        ? { id: `w${w}-rustig`, datum, dag, ...rustigeLoop(sjabloon.rustig[i], b) }
        : { id: `w${w}-extra${extraNr - 1}`, datum, dag, extra: true, ...rustigeLoop(sjabloon.extraRustig[i], b) };
    });

    if (w === sjabloon.weken) trainingen = laatsteWeek(trainingen, profiel, b);
    weken.push({
      nummer: w, soort: sjabloon.herstelweken.includes(w) ? 'herstel' : w === sjabloon.weken ? 'taper' : 'opbouw',
      label: `Week ${w}`, maandag, trainingen,
    });
  }

  return { sjabloon: sjabloon.id, zones, weken, start: weken[0].maandag, doelDatum: profiel.doelDatum };
}

// Week 11: de 10 km valt op de doeldatum. Trainingen na de doeldatum vervallen; past het niet,
// dan valt eerst een extra rustige loop weg, daarna de rustige duurloop.
function laatsteWeek(trainingen, profiel, b) {
  const doelTijd = profiel.doelSeconden;
  const kmh = doelTijd ? rondSnelheid(10 / (doelTijd / 3600)) : b.z.tempo10.van;
  const race = {
    id: 'w11-doel', datum: profiel.doelDatum, dag: DAGEN[(naarDatum(profiel.doelDatum).getUTCDay() + 6) % 7], doel: true,
    ...training('doel', `10 km${doelTijd ? ' op doeltijd' : ''}`, [b.opAfstand('tempo', '10 km', kmh, 10000)], b),
  };
  const ervoor = trainingen.filter((t) => t.type !== 'lang' && t.datum < profiel.doelDatum);
  const volgorde = ['kwaliteit', 'rustig'];
  ervoor.sort((a, c) => (a.extra ? 1 : 0) - (c.extra ? 1 : 0) || volgorde.indexOf(a.type) - volgorde.indexOf(c.type));
  const plekken = trainingen.filter((t) => t.datum < profiel.doelDatum).map((t) => t.datum).sort();
  // Geen zware training op de dag vóór de 10 km.
  const dagVoor = plusDagen(profiel.doelDatum, -1);
  const gekozen = ervoor.slice(0, plekken.length);
  const datums = [...plekken];
  const resultaat = [];
  for (const t of gekozen) {
    let datum = t.type === 'kwaliteit' ? datums.find((d) => d !== dagVoor) ?? datums[0] : datums[0];
    datums.splice(datums.indexOf(datum), 1);
    resultaat.push({ ...t, datum, dag: DAGEN[(naarDatum(datum).getUTCDay() + 6) % 7] });
  }
  return [...resultaat, race].sort((a, c) => a.datum.localeCompare(c.datum));
}

// De training van vandaag, of anders de eerstvolgende. Null als het schema voorbij is.
export function volgendeTraining(plan, vandaag, afgerond = {}) {
  for (const week of plan.weken) {
    for (const t of week.trainingen) {
      if (t.datum >= vandaag && !afgerond[t.id]) return { training: t, week, isVandaag: t.datum === vandaag };
    }
  }
  return null;
}

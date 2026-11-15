// Scherm Schema: alle weken met hun trainingen. Tik een training open voor de blokken en om hem
// naar een andere dag van dezelfde week te verplaatsen; per week kun je dagen vrij zetten.
import { maakPlan } from './schema.js';
import { laadAanpassingen, bewaarAanpassingen, verplaats, zetVrij, pasToe, voegVakantieToe, verwijderVakantie } from './aanpassingen.js';
import { DAGEN } from './profiel.js';
import { plusDagen, vandaagIso, naarDatum, dagenTussen, datumTekst } from './datum.js';
import { toonMelding } from './melding.js';
import { kmh, km, minuten, blokDuur, korteDatum } from './opmaak.js';
import { kcalTraining } from './calorieen.js';
import { laadResultaten, maakOngedaan } from './resultaten.js';

const DAGNAAM = { ma: 'Ma', di: 'Di', wo: 'Wo', do: 'Do', vr: 'Vr', za: 'Za', zo: 'Zo' };
const TYPE = { rustig: 'Rustig', kwaliteit: 'Kwaliteit', lang: 'Lang', doel: 'Doel' };
const BADGE = { herstel: 'Herstelweek', taper: 'Laatste week', basis: 'Basis' };
// Taperweken vóór de laatste week heten "Rustiger aan".
const badge = (w, laatste) => {
  const naam = w.soort === 'taper' && !laatste ? 'Rustiger aan' : BADGE[w.soort];
  return naam ? `<span class="badge badge-${w.soort}">${naam}</span>` : '';
};
const weekId = (w) => `${w.soort === 'basis' ? 'b' : ''}${w.nummer}`;

function blokRegel(b) {
  const nr = b.herhaling && b.van ? ` ${b.herhaling}/${b.van}` : b.deel ? ` ${b.deel}` : '';
  const wat = b.afstandM ? `${b.afstandM >= 1000 ? km(b.afstandM / 1000) + ' km' : b.afstandM + ' m'} · ${blokDuur(b.duurSec)}` : blokDuur(b.duurSec);
  return `<li class="blok blok-${b.soort}"><span>${b.label}${nr}<small>${wat}</small></span>
    <span class="blok-waarden"><strong>${kmh(b.kmh)}</strong> km/u<small>${String(b.helling).replace('.', ',')}% helling</small></span></li>`;
}

function verplaatsHtml(t, week, vandaag, { metNaam = false } = {}) {
  if (t.type === 'doel') return `<p class="hint">De ${t.naam.replace(/ op doeltijd$/, '')} staat vast op je doeldatum.</p>`;
  if (t.datum < vandaag) return '';
  const knoppen = DAGEN.map((d, i) => {
    const datum = plusDagen(week.maandag, i);
    const kan = datum !== t.datum && datum >= vandaag && !(week.trainingen.find((x) => x.datum === datum)?.type === 'doel');
    return `<button type="button" class="dagknop" data-verplaats="${t.id}" data-naar="${datum}" ${kan ? '' : 'disabled'}
      aria-label="Verplaats ${metNaam ? `${t.naam} ` : ''}naar ${d} ${korteDatum(datum)}">${d}</button>`;
  }).join('');
  if (metNaam) return `<div class="verplaats-rij"><span class="hint">${t.naam}</span><div class="dagknoppen">${knoppen}</div></div>`;
  return `<div class="andere-dag"><button type="button" class="link-knop" data-actie="andere-dag" aria-expanded="false">Andere dag</button>
    <div class="dagknoppen" hidden>${knoppen}</div></div>`;
}

function statusHtml(t, r, vandaag) {
  if (r?.status === 'gedaan') {
    const op = r.datum !== t.datum ? ` op ${korteDatum(r.datum)}` : '';
    return `<div class="status"><span class="hint">✓ Gedaan${op}: ${km(r.afstandKm)} km · ${minuten(r.duurSec)} · ${r.kcal} kcal</span>
      <button type="button" class="secundair klein" data-ongedaan="${t.id}">Ongedaan maken</button></div>`;
  }
  if (r?.status === 'overgeslagen') {
    return `<div class="status"><span class="hint">Overgeslagen</span>
      <button type="button" class="secundair klein" data-ongedaan="${t.id}">Ongedaan maken</button></div>`;
  }
  // Elke training kan op elk moment gestart worden; hij telt dan voor de dag waarop je hem loopt.
  return `<div class="status"><a class="knop primair klein" href="#loop/${t.id}" data-test="start">Start</a>
    <a class="knop secundair klein" href="#afvinken/${t.id}">Afvinken</a></div>`;
}

function trainingHtml(t, week, vandaag, gewicht, r) {
  const status = r?.status === 'gedaan' ? ' is-gedaan' : r?.status === 'overgeslagen' ? ' is-overgeslagen' : '';
  const statusLabel = r?.status === 'gedaan' ? ' · <span class="label-gedaan">✓ gedaan</span>' : r?.status === 'overgeslagen' ? ' · overgeslagen' : '';
  return `
    <details class="training training-${t.type}${status}${t.datum === vandaag ? ' is-vandaag' : ''}" data-training="${t.id}">
      <summary>
        <span class="dag">${DAGNAAM[t.dag]}<small>${korteDatum(t.datum)}</small></span>
        <span class="wat"><span class="label label-${t.type}">${TYPE[t.type]}${t.verplaatst ? ' · verplaatst' : ''}${statusLabel}</span>${t.naam}
          <small>${minuten(t.duurSec)} · ca. ${km(t.afstandKm)} km · ${kcalTraining(t, gewicht)} kcal</small></span>
      </summary>
      ${statusHtml(t, r, vandaag)}
      <ol class="blokken">${t.blokken.map(blokRegel).join('')}</ol>
      ${r ? '' : verplaatsHtml(t, week, vandaag)}
    </details>`;
}

function weekHtml(w, aanpassingen, vandaag, gewicht, huidig, resultaten, laatste = true, open = false) {
  const vrij = new Set(aanpassingen.vrij);
  const vrijKnoppen = DAGEN.map((d, i) => {
    const datum = plusDagen(w.maandag, i);
    return `<button type="button" class="dagknop${vrij.has(datum) ? ' is-vrij' : ''}" data-vrij="${datum}"
      aria-pressed="${vrij.has(datum)}" ${datum < vandaag ? 'disabled' : ''} aria-label="${d} ${korteDatum(datum)} vrij">${d}</button>`;
  }).join('');
  const gedaan = w.trainingen.filter((t) => resultaten[t.id]?.status === 'gedaan').length;
  const kmWeek = w.trainingen.reduce((som, t) => som + t.afstandKm, 0);
  const verplaatsbaar = w.trainingen.filter((t) => !resultaten[t.id] && t.type !== 'doel' && t.datum >= vandaag);
  return `
    <section class="week${huidig ? ' is-huidig' : ''}" data-week="${weekId(w)}" id="week-${weekId(w)}">
      <details class="week-inhoud" ${open ? 'open' : ''}>
      <summary><h2>${w.label} ${badge(w, laatste)}${huidig ? '<span class="badge badge-nu">Deze week</span>' : ''}
        <small>${korteDatum(w.maandag)} – ${korteDatum(plusDagen(w.maandag, 6))}</small></h2>
        <span class="week-samenvatting" data-test="week-samenvatting">${w.trainingen.length} ${w.trainingen.length === 1 ? "training" : "trainingen"} · ca. ${km(kmWeek)} km${gedaan ? ` · ${gedaan}/${w.trainingen.length} gedaan` : ''}</span></summary>
      ${w.waarschuwingen.map((x) => `<div class="melding melding-te-snel" data-test="waarschuwing">⚠ ${x.tekst}</div>`).join('')}
      <div class="kaart trainingen">${w.trainingen.map((t) => trainingHtml(t, w, vandaag, gewicht, resultaten[t.id])).join('')}</div>
      ${w.vervallen.length ? `<p class="hint" data-test="vervallen">Vervalt deze week: ${w.vervallen.map((t) => t.naam).join(', ')}.</p>` : ''}
      <details class="week-aanpassen">
        <summary>Week aanpassen</summary>
        ${verplaatsbaar.length ? `<span class="titel">Training verplaatsen</span>
        ${verplaatsbaar.map((t) => verplaatsHtml(t, w, vandaag, { metNaam: true })).join('')}` : ''}
        <span class="titel">Vrije dagen</span>
        <div class="dagknoppen">${vrijKnoppen}</div>
        <p class="hint">Een vrije dag laat eerst een rustige loop vervallen; kwaliteit en lange loop blijven zo lang mogelijk staan.</p>
      </details>
      </details>
    </section>`;
}

// Vakantie: kies een periode en tik de dagen aan waarop je toch traint; de rest schuift door.
const DAG_VAN = (iso) => DAGEN[(naarDatum(iso).getUTCDay() + 6) % 7];
const dagenLijst = (dagen) => dagen.length ? dagen.map((d) => `${DAGNAAM[DAG_VAN(d)].toLowerCase()} ${korteDatum(d)}`).join(', ') : 'geen';
const dagenTekst = (n) => `${n} ${n === 1 ? 'dag' : 'dagen'}`;

function vakantieHtml(plan, invoer, vandaag, open) {
  const lijst = (plan.vakanties ?? []).map((v) => `
    <div class="vakantie-rij" data-test="vakantie-rij"><span>${korteDatum(v.van)} – ${korteDatum(v.tot)}<small>Trainen: ${dagenLijst(v.dagen)}${
      v.doelVerschuiving ? ` · doelloop ${dagenTekst(v.doelVerschuiving)} later` : ''}</small></span>
      <button type="button" class="link-knop" data-vakantie-weg="${v.van}">Weghalen</button></div>`).join('');
  const geldig = invoer.van && invoer.tot && invoer.tot >= invoer.van && dagenTussen(invoer.van, invoer.tot) <= 60;
  const dagen = geldig ? Array.from({ length: dagenTussen(invoer.van, invoer.tot) + 1 }, (_, i) => plusDagen(invoer.van, i)) : [];
  const knoppen = dagen.map((d) => `<button type="button" class="dagknop${invoer.dagen.has(d) ? ' is-gekozen' : ''}" data-vakantie-dag="${d}"
      aria-pressed="${invoer.dagen.has(d)}">${DAGNAAM[DAG_VAN(d)]}<small>${naarDatum(d).getUTCDate()}</small></button>`).join('');
  const titel = plan.vakanties?.length ? `Vakantie <small>${plan.vakanties.map((v) => `${korteDatum(v.van)} – ${korteDatum(v.tot)}`).join(', ')}</small>` : 'Vakantie';
  return `
    <details class="week-aanpassen vakantie" data-test="vakantie" ${open ? 'open' : ''}>
      <summary>${titel}</summary>
      ${lijst}
      <div class="vakantie-periode">
        <label>Van<input type="date" name="vakantie-van" value="${invoer.van}" min="${vandaag}"></label>
        <label>Tot en met<input type="date" name="vakantie-tot" value="${invoer.tot}" min="${invoer.van || vandaag}"></label>
      </div>
      ${invoer.van && invoer.tot && !geldig ? '<p class="foutmelding" role="alert">De einddatum moet na de begindatum liggen (hoogstens 2 maanden).</p>' : ''}
      ${dagen.length ? `<span class="titel">Op welke dagen train je toch?</span>
      <div class="dagknoppen vakantie-dagen">${knoppen}</div>
      <p class="hint">Trainingen die niet passen schuiven door naar je trainingsdagen erna; je doelloop schuift mee.</p>
      <button type="button" class="primair klein" data-actie="vakantie-opslaan">Vakantie opslaan</button>` : ''}
    </details>`;
}

export function toonSchema(root, profiel, { vandaag = vandaagIso(), opslag = localStorage } = {}) {
  const basisplan = maakPlan(profiel, { vandaag });
  let aanpassingen = laadAanpassingen(opslag);
  // Alleen de huidige week staat open (of de eerste, als het schema nog moet beginnen); de rest is ingeklapt.
  const eersteHuidig = pasToe(basisplan, aanpassingen).weken.find((w) => vandaag <= plusDagen(w.maandag, 6));
  const openWeken = new Set(eersteHuidig ? [weekId(eersteHuidig)] : []);
  let kijker = null;
  let vakantie = { van: '', tot: '', dagen: new Set() };

  function teken({ scroll = false, openWeek = null, aanpassen = false, openTraining = null, vakantieOpen = false } = {}) {
    const plan = pasToe(basisplan, aanpassingen);
    const huidige = plan.weken.find((w) => vandaag >= w.maandag && vandaag <= plusDagen(w.maandag, 6));
    if (openWeek) openWeken.add(openWeek);
    const start = plan.weken[0].maandag > vandaag
      ? `<p class="uitleg">Je schema start op maandag ${korteDatum(plan.weken[0].maandag)}.</p>` : '';
    const resultaten = laadResultaten(opslag);
    root.innerHTML = `<h1>Schema</h1>${start}
      <p class="hint">Tik op een week om hem open te klappen, en op een training voor de blokken.</p>
      ${vakantieHtml(plan, vakantie, vandaag, vakantieOpen)}
      ${plan.weken.map((w) => weekHtml(w, aanpassingen, vandaag, profiel.gewicht, w === huidige, resultaten, w === plan.weken.at(-1), openWeken.has(weekId(w)))).join('')}
      ${huidige ? '<button type="button" class="naar-week" data-actie="naar-week" hidden>Naar deze week</button>' : ''}`;
    if (aanpassen && openWeek) root.querySelector(`#week-${openWeek} .week-aanpassen`)?.setAttribute('open', '');
    if (openTraining) root.querySelector(`[data-training="${openTraining}"]`)?.setAttribute('open', '');
    root.querySelectorAll('.week-inhoud').forEach((d) => d.addEventListener('toggle', () => {
      const id = d.closest('.week').dataset.week;
      if (d.open) openWeken.add(id); else openWeken.delete(id);
    }));
    const doel = root.querySelector(openWeek ? `#week-${openWeek}` : '.week.is-huidig');
    if (scroll || openWeek) doel?.scrollIntoView({ block: 'start' });
    // "Naar deze week" verschijnt zodra de huidige week uit beeld is.
    kijker?.disconnect();
    const knop = root.querySelector('[data-actie=naar-week]');
    if (knop && 'IntersectionObserver' in window) {
      kijker = new IntersectionObserver(([e]) => { knop.hidden = e.isIntersecting || !root.contains(knop); });
      kijker.observe(root.querySelector('.week.is-huidig'));
    }
  }

  root.onchange = (e) => {
    const naam = e.target.name;
    if (naam !== 'vakantie-van' && naam !== 'vakantie-tot') return;
    vakantie = { ...vakantie, [naam === 'vakantie-van' ? 'van' : 'tot']: e.target.value, dagen: new Set() };
    // Na het kiezen van de begindatum staat de einddatum standaard een week later.
    if (naam === 'vakantie-van' && vakantie.van && (!vakantie.tot || vakantie.tot < vakantie.van)) vakantie.tot = plusDagen(vakantie.van, 6);
    teken({ vakantieOpen: true });
  };

  root.onclick = (e) => {
    const knop = e.target.closest('button');
    if (!knop || knop.disabled) return;
    const week = knop.closest('.week')?.dataset.week;
    if (knop.dataset.actie === 'andere-dag') {
      const open = knop.getAttribute('aria-expanded') !== 'true';
      knop.setAttribute('aria-expanded', String(open));
      knop.nextElementSibling.hidden = !open;
    } else if (knop.dataset.actie === 'naar-week') {
      const huidig = root.querySelector('.week.is-huidig');
      huidig.querySelector('.week-inhoud').open = true;
      huidig.scrollIntoView({ block: 'start', behavior: 'smooth' });
    } else if (knop.dataset.verplaats) {
      const uitWeek = knop.closest('.week-aanpassen') !== null;
      aanpassingen = verplaats(pasToe(basisplan, aanpassingen), aanpassingen, knop.dataset.verplaats, knop.dataset.naar);
      bewaarAanpassingen(opslag, aanpassingen);
      teken({ openWeek: week, aanpassen: uitWeek, openTraining: uitWeek ? null : knop.dataset.verplaats });
    } else if (knop.dataset.ongedaan) {
      maakOngedaan(opslag, knop.dataset.ongedaan);
      teken({ openWeek: week, openTraining: knop.dataset.ongedaan });
    } else if (knop.dataset.vakantieDag) {
      const d = knop.dataset.vakantieDag;
      if (vakantie.dagen.has(d)) vakantie.dagen.delete(d); else vakantie.dagen.add(d);
      teken({ vakantieOpen: true });
    } else if (knop.dataset.actie === 'vakantie-opslaan') {
      const oudDoel = pasToe(basisplan, aanpassingen).doelDatum;
      aanpassingen = voegVakantieToe(aanpassingen, { van: vakantie.van, tot: vakantie.tot, dagen: [...vakantie.dagen] });
      bewaarAanpassingen(opslag, aanpassingen);
      vakantie = { van: '', tot: '', dagen: new Set() };
      const nieuwDoel = pasToe(basisplan, aanpassingen).doelDatum;
      const verschil = dagenTussen(oudDoel, nieuwDoel);
      teken({ vakantieOpen: true });
      toonMelding(verschil ? `Vakantie opgeslagen. Je doelloop schuift ${dagenTekst(verschil)} op naar ${datumTekst(nieuwDoel)}.` : 'Vakantie opgeslagen.');
    } else if (knop.dataset.vakantieWeg) {
      const vorige = aanpassingen;
      aanpassingen = verwijderVakantie(aanpassingen, knop.dataset.vakantieWeg);
      bewaarAanpassingen(opslag, aanpassingen);
      teken({ vakantieOpen: true });
      toonMelding('Vakantie weggehaald', { actie: 'Ongedaan maken', bijActie: () => {
        aanpassingen = vorige;
        bewaarAanpassingen(opslag, aanpassingen);
        teken({ vakantieOpen: true });
      } });
    } else if (knop.dataset.vrij) {
      aanpassingen = zetVrij(aanpassingen, knop.dataset.vrij, knop.getAttribute('aria-pressed') !== 'true');
      bewaarAanpassingen(opslag, aanpassingen);
      teken({ openWeek: week, aanpassen: true });
    }
  };
  teken({ scroll: true });
}

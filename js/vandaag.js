// Scherm Vandaag: de training van vandaag (of de eerstvolgende) met duur, afstand en calorieën.
import { volgendeTraining } from './schema.js';
import { huidigPlan } from './plan.js';
import { effectiefProfiel } from './instellingen.js';
import { laadResultaten, markeerOvergeslagen, maakOngedaan } from './resultaten.js';
import { toonMelding } from './melding.js';
import { laadAanpassingen, bewaarAanpassingen, verplaats } from './aanpassingen.js';
import { plusDagen } from './datum.js';
import { kcalTraining } from './calorieen.js';
import { vandaagIso, dagenTussen, datumTekst, naarDatum } from './datum.js';
import { kmh, km, minuten, korteDatum } from './opmaak.js';

const TYPE = { rustig: 'Rustige loop', kwaliteit: 'Kwaliteitstraining', lang: 'Lange duurloop', doel: 'Doeldag' };
const DAGNAAM = { ma: 'maandag', di: 'dinsdag', wo: 'woensdag', do: 'donderdag', vr: 'vrijdag', za: 'zaterdag', zo: 'zondag' };

// Samenvatting in fases: warming-up, kern, cooling-down.
function fases(t) {
  const som = (bl) => bl.reduce((s, b) => s + b.duurSec, 0);
  const warm = t.blokken.filter((b) => b.soort === 'warmup');
  const cool = t.blokken.filter((b) => b.soort === 'uitjoggen' || b.soort === 'uitwandelen');
  const kern = t.blokken.filter((b) => !warm.includes(b) && !cool.includes(b));
  const snelheden = [...new Set(kern.map((b) => b.kmh))].sort((a, b) => a - b);
  const bereik = (l) => (l.length > 1 ? `${kmh(l[0])}–${kmh(l.at(-1))}` : kmh(l[0]));
  return [
    { naam: 'Warming-up', duur: som(warm), snelheid: bereik(warm.map((b) => b.kmh)) },
    { naam: t.naam, duur: som(kern), snelheid: bereik(snelheden) },
    { naam: 'Uitjoggen + uitwandelen', duur: som(cool), snelheid: bereik(cool.map((b) => b.kmh).sort((a, b) => a - b)) },
  ];
}

const dagVan = (iso) => ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'][naarDatum(iso).getUTCDay()];

// Gemiste trainingen van deze week: verplaatsen naar een vrije dag later deze week, overslaan of toch afvinken.
function gemistHtml(gemist, week, vandaag) {
  if (!gemist.length) return '';
  const bezet = new Set(week.trainingen.map((t) => t.datum));
  const vrij = Array.from({ length: 7 }, (_, i) => plusDagen(week.maandag, i)).filter((d) => d >= vandaag && !bezet.has(d));
  // Compact onder de training van vandaag; tik open om in te plannen, over te slaan of af te vinken.
  return gemist.map((t) => `
    <details class="kaart gemist" data-test="gemist" data-training="${t.id}">
      <summary><span class="gemist-icoon" aria-hidden="true">!</span>
        <span class="gemist-wat"><strong>${DAGNAAM[t.dag][0].toUpperCase()}${DAGNAAM[t.dag].slice(1)} gemist</strong><small>${t.naam} · ${korteDatum(t.datum)}</small></span>
        <span class="gemist-actie">Inplannen</span></summary>
      ${vrij.length ? `<div class="hint">Verplaats naar een vrije dag:</div><div class="dagknoppen">${vrij.map((d) =>
        `<button type="button" class="dagknop" data-verplaats="${t.id}" data-naar="${d}">${DAGNAAM[dagVan(d)].slice(0, 2)}<br><small>${korteDatum(d)}</small></button>`).join('')}</div>` : '<div class="hint">Er is geen vrije dag meer deze week.</div>'}
      <div class="knoppen">
        <button type="button" class="secundair" data-overslaan="${t.id}">Overslaan</button>
        <a class="knop secundair" href="#afvinken/${t.id}">Toch gedaan</a>
      </div>
    </details>`).join('');
}

// Na Ongedaan maken het huidige scherm opnieuw tekenen (ook als je intussen een ander tabblad opende).
const verversScherm = () => window.dispatchEvent(new HashChangeEvent('hashchange'));

const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const hoofdletter = (t) => t[0].toUpperCase() + t.slice(1);

const weekNaam = (plan, week) => {
  if (week.soort === 'basis') return week.label;
  return `Week ${week.nummer} van ${plan.weken.filter((w) => w.soort !== 'basis').length}`;
};

// Eén week in de kalender: zeven dagen met daaronder een streepje per training (gepland, gedaan,
// gemist of overgeslagen). Elke dag is aan te tikken, ook een rustdag.
function weekHtml(week, resultaten, vandaag, gekozenDag) {
  return `<div class="weekstrook" data-test="weekstrook" data-maandag="${week.maandag}">${Array.from({ length: 7 }, (_, i) => {
    const datum = plusDagen(week.maandag, i);
    const d = naarDatum(datum).getUTCDate();
    const dag = dagVan(datum);
    const t = week.trainingen.find((x) => x.datum === datum);
    const klassen = `${datum === vandaag ? ' is-vandaag' : ''}${datum === gekozenDag ? ' is-gekozen' : ''}`;
    if (!t) {
      return `<button type="button" class="weekdag is-rust${klassen}" data-dag="${datum}"
        aria-label="${DAGNAAM[dag]} ${d}: rustdag"><small>${dag}</small><b>${d}</b><i aria-hidden="true"></i></button>`;
    }
    const status = resultaten[t.id]?.status ?? (datum < vandaag ? 'gemist' : 'gepland');
    return `<button type="button" class="weekdag is-${status} training-${t.type}${klassen}" data-toon="${t.id}" data-status="${status}"
      aria-label="${DAGNAAM[dag]} ${d}: ${t.naam}, ${status}"><small>${dag}</small><b>${d}</b><i aria-hidden="true"></i></button>`;
  }).join('')}</div>`;
}

// Weekoverzicht onder de dag: hoeveel trainingen af zijn en hoeveel km je liep van het geplande.
function overzichtHtml(plan, week, resultaten) {
  const n = week.trainingen.length;
  const klaar = week.trainingen.filter((t) => resultaten[t.id]).length;
  const gelopen = week.trainingen.reduce((s, t) => s + (resultaten[t.id]?.status === 'gedaan' ? resultaten[t.id].afstandKm ?? 0 : 0), 0);
  const gepland = week.trainingen.reduce((s, t) => s + t.afstandKm, 0);
  const extra = week.soort === 'herstel' ? ' · herstelweek' : '';
  return `<div class="weekoverzicht-kop"><strong>Overzicht ${weekNaam(plan, week).replace(/ van \d+$/, '').toLowerCase()}</strong><small>${korteDatum(week.maandag)} – ${korteDatum(plusDagen(week.maandag, 6))}${extra}</small></div>
    <div class="weekbalk" aria-hidden="true">${week.trainingen.map((t) => `<span class="training-${t.type} is-${resultaten[t.id]?.status ?? 'open'}"></span>`).join('')}</div>
    <div class="weekoverzicht-cijfers"><span>Trainingen <b data-test="week-trainingen">${klaar}/${n}</b></span><span>Afstand <b>${km(gelopen)} / ${km(gepland)} km</b></span></div>`;
}

// Kalender bovenin: alle weken naast elkaar, veeg (of tik op de pijltjes) naar een andere week.
function kalenderHtml(plan, getoondeWeek, vandaag) {
  const deWeek = plan.weken.find((w) => vandaag >= w.maandag && vandaag <= plusDagen(w.maandag, 6));
  return `<section class="kalender" data-test="kalender">
    <div class="kalender-kop">
      <button type="button" class="kal-pijl" data-week="-1" aria-label="Vorige week">‹</button>
      <span class="kalender-week" data-test="weeknaam" aria-live="polite">${weekNaam(plan, getoondeWeek)}</span>
      <button type="button" class="kal-pijl" data-week="1" aria-label="Volgende week">›</button>
    </div>
    <div class="weekbaan" data-test="weekbaan">${plan.weken.map((w) => `<div class="weekpagina">__WEEK_${w.maandag}__</div>`).join('')}</div>
    ${deWeek ? `<button type="button" class="naar-vandaag" data-naar-vandaag hidden>Naar deze week</button>` : ''}
  </section>`;
}

export function toonVandaag(root, profiel, { vandaag = vandaagIso(), opslag = localStorage, gekozen = null, rustdag: gekozenRust = null } = {}) {
  const plan = huidigPlan(profiel, vandaag, opslag);
  const resultaten = laadResultaten(opslag);
  const alle = plan.weken.flatMap((w) => w.trainingen);
  const deWeek = plan.weken.find((w) => vandaag >= w.maandag && vandaag <= plusDagen(w.maandag, 6));
  const gemist = deWeek ? deWeek.trainingen.filter((t) => t.datum < vandaag && !resultaten[t.id]) : [];
  // Wat vandaag gelopen is, ook als die training voor een andere dag gepland stond.
  const vandaagGedaan = alle.filter((t) => resultaten[t.id]?.status === 'gedaan' && resultaten[t.id].datum === vandaag);
  const volgende = volgendeTraining(plan, vandaag, resultaten);
  // Een dag uit de weekstrook, anders de eerstvolgende training.
  const keuzeT = gekozen && gekozen !== volgende?.training.id ? alle.find((x) => x.id === gekozen) : null;
  const toon = keuzeT ? { training: keuzeT, week: plan.weken.find((w) => w.trainingen.includes(keuzeT)), isVandaag: keuzeT.datum === vandaag } : volgende;
  const opnieuw = (extra = {}) => toonVandaag(root, profiel, { vandaag, opslag, ...extra });
  const weekVan = (datum) => plan.weken.find((w) => datum >= w.maandag && datum <= plusDagen(w.maandag, 6));
  // Welke week de kalender toont: de gekozen dag, anders deze week zolang daar nog iets open staat,
  // en als alles van deze week af is de week van je volgende training.
  const openDezeWeek = deWeek?.trainingen.some((t) => !resultaten[t.id]);
  const kalWeek = (gekozenRust && weekVan(gekozenRust)) || (keuzeT && toon.week)
    || (openDezeWeek ? deWeek : null) || toon?.week || deWeek || plan.weken.at(-1);
  const gekozenDag = gekozenRust ?? toon?.training.datum ?? null;

  root.onclick = (e) => {
    // Meer-menu (⋯) sluiten bij een tik ernaast.
    for (const m of root.querySelectorAll('.meer-menu[open]')) if (!m.contains(e.target)) m.open = false;
    const knop = e.target.closest('button');
    if (knop?.dataset.toon) {
      opnieuw({ gekozen: knop.dataset.toon === toon?.training.id && !gekozenRust ? null : knop.dataset.toon });
    } else if (knop?.dataset.dag) {
      opnieuw({ rustdag: knop.dataset.dag === gekozenRust ? null : knop.dataset.dag });
    } else if (knop?.dataset.week) {
      bladerNaar(huidigeIndex() + Number(knop.dataset.week));
    } else if (knop?.hasAttribute('data-naar-vandaag')) {
      bladerNaar(plan.weken.indexOf(deWeek));
    } else if (knop?.dataset.verplaats) {
      const voor = laadAanpassingen(opslag);
      bewaarAanpassingen(opslag, verplaats(plan, voor, knop.dataset.verplaats, knop.dataset.naar));
      opnieuw();
      toonMelding(`Verplaatst naar ${DAGNAAM[dagVan(knop.dataset.naar)]} ${korteDatum(knop.dataset.naar)}`, {
        actie: 'Ongedaan maken', bijActie: () => { bewaarAanpassingen(opslag, voor); verversScherm(); },
      });
    } else if (knop?.dataset.overslaan) {
      const t = alle.find((x) => x.id === knop.dataset.overslaan);
      markeerOvergeslagen(opslag, t, vandaag);
      opnieuw();
      toonMelding('Training overgeslagen', {
        actie: 'Ongedaan maken', bijActie: () => { maakOngedaan(opslag, t.id); verversScherm(); },
      });
    }
  };

  let kal = kalenderHtml(plan, kalWeek, vandaag);
  for (const w of plan.weken) kal = kal.replace(`__WEEK_${w.maandag}__`, weekHtml(w, resultaten, vandaag, gekozenDag));
  // Geen zichtbare kop: de kalender laat de dag al zien. De kop blijft voor schermlezers.
  const kop = `<h1 class="voor-schermlezer">Vandaag</h1>${kal}`;
  const overzicht = `<section class="kaart weekoverzicht" data-test="weekoverzicht">${overzichtHtml(plan, kalWeek, resultaten)}</section>`;

  // Na het tekenen: de kalender op de juiste week zetten en bij vegen kop en overzicht bijwerken.
  let baan = null;
  const huidigeIndex = () => (baan ? Math.round(baan.scrollLeft / baan.clientWidth) : plan.weken.indexOf(kalWeek));
  const bladerNaar = (i) => {
    if (!baan) return;
    const doel = Math.max(0, Math.min(plan.weken.length - 1, i));
    baan.scrollTo({ left: doel * baan.clientWidth, behavior: 'smooth' });
  };
  const bijWeek = () => {
    const i = huidigeIndex();
    const w = plan.weken[i];
    if (!w) return;
    root.querySelector('[data-test=weeknaam]').textContent = weekNaam(plan, w);
    root.querySelector('[data-week="-1"]').disabled = i === 0;
    root.querySelector('[data-week="1"]').disabled = i === plan.weken.length - 1;
    const naarVandaag = root.querySelector('[data-naar-vandaag]');
    if (naarVandaag) naarVandaag.hidden = w === deWeek;
    const ov = root.querySelector('[data-test=weekoverzicht]');
    if (ov && ov.dataset.week !== w.maandag) { ov.innerHTML = overzichtHtml(plan, w, resultaten); ov.dataset.week = w.maandag; }
  };
  const koppelKalender = () => {
    baan = root.querySelector('.weekbaan');
    if (!baan) return;
    root.querySelector('[data-test=weekoverzicht]')?.setAttribute('data-week', kalWeek.maandag);
    const zet = () => { baan.scrollLeft = plan.weken.indexOf(kalWeek) * baan.clientWidth; bijWeek(); };
    zet();
    // Breedte kan nog veranderen (lettertype, draaien): blijf op dezelfde week.
    requestAnimationFrame(zet);
    let wacht = null;
    baan.addEventListener('scroll', () => { clearTimeout(wacht); wacht = setTimeout(bijWeek, 60); }, { passive: true });
  };

  const gedaanHtml = vandaagGedaan.map((t) => {
    const r = resultaten[t.id];
    return `<div class="kaart gedaan" data-test="vandaag-gedaan"><div class="label label-gedaan">✓ Vandaag gedaan</div>
      <strong>${t.naam}</strong><div class="hint">${km(r.afstandKm)} km · ${minuten(r.duurSec)} · ${r.kcal} kcal</div></div>`;
  }).join('');

  if (!toon) {
    root.innerHTML = `${kop}${gedaanHtml}
      <div class="kaart"><p>Je schema zit erop. Gefeliciteerd met je ${plan.doelNaam}!</p></div>
      ${gemistHtml(gemist, deWeek ?? plan.weken.at(-1), vandaag)}${overzicht}`;
    koppelKalender();
    return;
  }
  // Een rustdag aangetikt: geen training, wel de weg terug naar je volgende.
  if (gekozenRust) {
    const d = naarDatum(gekozenRust);
    const wanneer = gekozenRust === vandaag ? 'Vandaag' : `${hoofdletter(DAGNAAM[dagVan(gekozenRust)])} ${d.getUTCDate()} ${MAANDEN[d.getUTCMonth()]}`;
    root.innerHTML = `${kop}
      <article class="kaart rust-kaart" data-test="rustdag-kaart">
        <div class="stapnr">${wanneer}</div>
        <h2>Rustdag</h2>
        <p class="uitleg">Geen training gepland. Herstellen hoort bij je schema: je benen worden sterker op de dagen dat je niet loopt.</p>
      </article>
      <button type="button" class="secundair breed" data-toon="${volgende?.training.id ?? '-'}">Terug naar je volgende training</button>
      ${overzicht}`;
    koppelKalender();
    return;
  }
  const { training: t, week, isVandaag } = toon;
  const r = resultaten[t.id];
  const dagen = dagenTussen(vandaag, t.datum);
  const wanneer = isVandaag ? 'Vandaag'
    : dagen === 1 ? 'Morgen' : dagen === -1 ? 'Gisteren' : `${hoofdletter(DAGNAAM[t.dag])} ${korteDatum(t.datum)}`;
  const rustdag = keuzeT || isVandaag || vandaagGedaan.length ? '' : `<p class="uitleg" data-test="rustdag">${plan.weken[0].maandag > vandaag && week === plan.weken[0]
    ? `Je schema start op ${datumTekst(plan.weken[0].maandag)}.`
    : (plan.vakanties ?? []).some((v) => vandaag >= v.van && vandaag <= v.tot) ? 'Je bent op vakantie: vandaag geen training.' : 'Vandaag is een rustdag.'} Dit is je volgende training.</p>`;
  const totDoel = dagenTussen(vandaag, plan.doelDatum);
  const acties = r?.status === 'gedaan'
    ? `<p class="status-regel is-gedaan" data-test="status">✓ Gedaan${r.datum !== t.datum ? ` op ${korteDatum(r.datum)}` : ''}: ${km(r.afstandKm)} km · ${minuten(r.duurSec)} · ${r.kcal} kcal</p>`
    : r?.status === 'overgeslagen'
      ? '<p class="status-regel" data-test="status">Overgeslagen</p>'
      : `<div class="start-rij">
        <a class="knop primair breed" href="#loop/${t.id}" role="button" data-actie="start">${isVandaag ? 'Start training' : 'Nu al starten'}</a>
        ${isVandaag ? `<details class="meer-menu" data-test="meer-menu">
          <summary aria-label="Meer opties">⋯</summary>
          <div class="meer-lijst">
            <a href="#afvinken/${t.id}">Voltooien</a>
            <button type="button" data-overslaan="${t.id}">Overslaan</button>
          </div>
        </details>` : ''}
      </div>`;

  root.innerHTML = `
    ${kop}
    ${keuzeT ? '' : gedaanHtml}
    ${rustdag}
    ${vandaagGedaan.length && !keuzeT ? '<h2>Volgende training</h2>' : ''}
    <article class="kaart vandaag-kaart training-${t.type}" data-test="vandaag" data-training="${t.id}">
      <div class="kaart-kop"><span class="stapnr">${wanneer} · ${week.label}</span>
        <span class="label label-${t.type}">${TYPE[t.type]}</span></div>
      <h2 class="vandaag-titel">${t.naam}</h2>
      <div class="cijfers">
        <div><strong data-test="duur">${minuten(t.duurSec)}</strong><small>totaal</small></div>
        <div><strong data-test="afstand">${km(t.afstandKm)} km</strong><small>ongeveer</small></div>
        <div><strong data-test="kcal">${kcalTraining(t, profiel.gewicht)}</strong><small>kcal geschat</small></div>
      </div>
      ${acties}
      <ol class="fases" aria-label="Opbouw">${fases(t).map((f) => `
        <li><span>${f.naam}<small>${minuten(f.duur)}</small></span><span class="blok-waarden"><strong>${f.snelheid}</strong> km/u</span></li>`).join('')}
      </ol>
      <p class="hint">Helling ${String(effectiefProfiel(profiel, vandaag).helling).replace('.', ',')}% · uitwandelen op 0%</p>
    </article>
    ${keuzeT ? '<button type="button" class="secundair breed" data-toon="' + (volgende?.training.id ?? '-') + '">Terug naar je volgende training</button>' : ''}
    ${keuzeT ? '' : gemistHtml(gemist, deWeek, vandaag)}
    ${overzicht}
    <p class="hint" data-test="tot-doel">Nog ${totDoel} ${totDoel === 1 ? 'dag' : 'dagen'} tot je ${plan.doelNaam} op ${datumTekst(plan.doelDatum)}.</p>`;
  koppelKalender();
}

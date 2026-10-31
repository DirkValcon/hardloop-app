// Trainingsscherm voor op de loopband: groot de snelheid en helling, aftellende timer,
// een balk met alle blokken en een aankondiging 10 seconden voor het volgende blok.
import { maakSpeler, start, pauzeer, hervat, overslaan, toestand, pasSnelheidAan, VOORAANKONDIGING_SEC } from './speler.js';
import { kmh, minuten } from './opmaak.js';
import { formatTijd } from './tijd.js';
import { tempoPerKm } from './zones.js';
import { schatKcal } from './resultaten.js';
import { afrondFormulier, koppelAfronden } from './afronden.js';
import { toonMelding, sluitMelding } from './melding.js';

// Stoppen gaat door Stop even ingedrukt te houden, zodat je niet per ongeluk stopt.
export const STOP_VASTHOUDEN_MS = 1000;

export const OPSLAG_LOPEND = 'hardloop-app.lopend.v1';

const klok = (ms) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const helling = (h) => `${String(h).replace('.', ',')}`;

function blokTitel(b) {
  if (b.herhaling && b.van) return `${b.label} ${b.herhaling} van ${b.van}`;
  if (b.deel) return `${b.label} ${b.deel.replace('/', ' van ')}`;
  return b.label;
}

// ---------- Geluid, spraak en scherm aan ----------

function maakGeluid() {
  let ctx = null;
  let aan = true;
  return {
    get aan() { return aan; },
    zet(v) { aan = v; },
    ontgrendel() {
      // Moet binnen een tik van de gebruiker gebeuren, anders blijft iOS stil.
      try { ctx ??= new (window.AudioContext || window.webkitAudioContext)(); ctx.resume?.(); } catch { ctx = null; }
    },
    piep(aantal = 1, hoog = false) {
      navigator.vibrate?.(Array.from({ length: aantal * 2 - 1 }, (_, i) => (i % 2 ? 120 : 200)));
      if (!aan || !ctx) return;
      for (let i = 0; i < aantal; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = hoog ? 1320 : 880;
        const t = ctx.currentTime + i * 0.3;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.25);
      }
    },
    zeg(tekst) {
      if (!aan || !window.speechSynthesis) return;
      const u = new SpeechSynthesisUtterance(tekst);
      u.lang = 'nl-NL';
      // Niet afbreken: een kilometertijd en een blokaankondiging mogen na elkaar komen.
      speechSynthesis.speak(u);
    },
  };
}

function houdSchermAan() {
  let lock = null;
  const vraag = async () => { try { lock = await navigator.wakeLock?.request('screen'); } catch { lock = null; } };
  const bijTerugkeer = () => { if (document.visibilityState === 'visible') vraag(); };
  vraag();
  document.addEventListener('visibilitychange', bijTerugkeer);
  return () => { document.removeEventListener('visibilitychange', bijTerugkeer); lock?.release?.(); };
}

const spreekGetal = (v) => kmh(v).replace(',0', '').replace(',', ' komma ');
const spreekDuur = (sec) => {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return [m ? `${m} ${m === 1 ? 'minuut' : 'minuten'}` : '', s ? `${s} ${s === 1 ? 'seconde' : 'seconden'}` : ''].filter(Boolean).join(' ');
};
// Wat je in een blok moet doen, uitgesproken: "5 km-tempo 2 van 6: 400 meter op 8 komma 9 kilometer per uur".
export const uitspraak = (b, snelheid = b.kmh) => {
  const wat = b.afstandM ? `${b.afstandM >= 1000 ? `${spreekGetal(b.afstandM / 1000)} kilometer` : `${b.afstandM} meter`}` : spreekDuur(b.duurSec);
  return `${blokTitel(b)}: ${wat} op ${spreekGetal(snelheid)} kilometer per uur${b.helling ? `, helling ${spreekGetal(b.helling)} procent` : ', helling op nul'}`;
};
export const kilometerTekst = (nr, sec) => `Kilometer ${nr}. ${spreekDuur(sec)}.`;

// ---------- Scherm ----------

export function toonLoopscherm(root, training, { opslag = localStorage, profiel, terug, klaar } = {}) {
  const geluid = maakGeluid();
  let speler = maakSpeler(training.blokken);
  let timer = null;
  let stopSchermAan = null;
  let vorige = { index: -1, aankondigen: false, extra: false, km: 0, kmOpMs: 0 };

  // Doorgaan na herladen: de lopende training staat in de opslag.
  try {
    const bewaard = JSON.parse(opslag.getItem(OPSLAG_LOPEND));
    if (bewaard?.trainingId === training.id) speler = { ...speler, ...bewaard.stand };
  } catch { /* geen lopende training */ }

  const bewaar = () => {
    const { gestartOp, pauzeOp, gepauzeerdMs, extraMs, wijzigingen, overgeslagen } = speler;
    opslag.setItem(OPSLAG_LOPEND, JSON.stringify({
      trainingId: training.id, stand: { gestartOp, pauzeOp, gepauzeerdMs, extraMs, wijzigingen, overgeslagen },
    }));
  };
  const opruimen = () => {
    clearInterval(timer);
    timer = null;
    sluitMelding();
    root.onpointerdown = root.onpointerup = root.onpointercancel = root.onpointerout = null;
    stopSchermAan?.();
    opslag.removeItem(OPSLAG_LOPEND);
  };

  const balk = training.blokken.map((b, i) =>
    `<span class="seg seg-${b.soort}" data-seg="${i}" style="flex:${b.duurSec}"></span>`).join('');

  function tekenVoorStart() {
    document.body.classList.add('loopmodus');
    root.innerHTML = `
      <section class="loop" data-test="loopscherm">
        <div class="loop-kop"><button type="button" class="secundair klein" data-actie="terug">Terug</button></div>
        <h1>${training.naam}</h1>
        <p class="uitleg">${minuten(training.duurSec)} · ${training.blokken.length} blokken. Je hoort na elke kilometer je tijd en 10 seconden voor elk blok wat je moet doen. Zet de loopband op
          <strong>${kmh(training.blokken[0].kmh)} km/u</strong> en <strong>${helling(training.blokken[0].helling)}%</strong> en druk op Start.</p>
        <div class="loop-balk">${balk}</div>
        <label class="keuze geluid-keuze"><input type="checkbox" data-actie="geluid" checked>
          <span>Geluid en gesproken aanwijzingen<small>Zet het volume van je iPhone aan.</small></span></label>
        <button type="button" class="primair breed groot" data-actie="start">Start</button>
      </section>`;
  }

  function tekenLopend() {
    root.innerHTML = `
      <section class="loop is-lopend" data-test="loopscherm">
        <div class="loop-kop">
          <span class="loop-titel" data-test="bloktitel"></span>
          <span class="loop-totaal" data-test="totaal"></span>
        </div>
        <div class="loop-stand"><span data-test="afstand"></span><span data-test="laatste-km"></span></div>
        <div class="loop-timer" data-test="timer"></div>
        <div class="loop-groot">
          <div class="snelheid-vak">
            <span class="waarde" data-test="snelheid"></span><span class="eenheid">km/u</span>
            <div class="plusmin">
              <button type="button" data-actie="langzamer" aria-label="Langzamer">−</button>
              <button type="button" data-actie="sneller" aria-label="Sneller">+</button>
            </div>
          </div>
          <div><span class="waarde" data-test="helling"></span><span class="eenheid">% helling</span>
            <span class="loop-tempo" data-test="tempo"></span></div>
        </div>
        <div class="loop-balk">${balk}</div>
        <div class="loop-volgende" data-test="volgende"></div>
        <div class="bediening">
          <button type="button" class="rond-klein stop-knop" data-actie="stop" aria-label="Stop (ingedrukt houden)">
            <svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="16"/></svg><span>Stop</span></button>
          <button type="button" class="rond-groot" data-actie="pauze">Pauze</button>
          <button type="button" class="rond-klein" data-actie="overslaan">Volgend blok</button>
          <button type="button" class="primair afronden-knop" data-actie="afronden" hidden>Training afronden</button>
        </div>
        <p class="bediening-hint" data-test="stop-hint">Houd Stop ingedrukt om te stoppen</p>
      </section>`;
  }

  function tekenKlaar(gestopt = false) {
    const t = toestand(speler, Date.now());
    const sec = Math.round(t.echtMs / 1000);
    const afstandKm = Math.round(t.afstandKm * 100) / 100;
    opruimen();
    document.body.classList.remove('loopmodus');
    root.innerHTML = `
      <section class="loop" data-test="loopscherm">
        <h1>${gestopt ? 'Gestopt' : 'Klaar!'}</h1>
        <p class="uitleg" data-test="klaar">${gestopt
          ? `Je bent gestopt na ${Math.round(sec / 60)} min. Wil je opslaan wat je gedaan hebt?`
          : `${training.naam} zit erop. Goed gedaan.`}</p>
        ${afrondFormulier({
          afstandKm, duurSec: sec,
          kcal: schatKcal(training, afstandKm, profiel.gewicht),
        })}
      </section>`;
    koppelAfronden(root, training, profiel, { opslag, opgeslagen: () => klaar?.(), annuleer: () => terug?.() });
  }

  function ververs() {
    const nu = Date.now();
    const t = toestand(speler, nu);
    const $ = (sel) => root.querySelector(`[data-test=${sel}]`);
    const b = t.blok;
    $('bloktitel').textContent = t.extra ? 'Extra: doorlopen' : blokTitel(b);
    $('totaal').textContent = t.extra ? `schema klaar · ${klok(t.echtMs)}` : `nog ${klok(t.restTotaalMs)}`;
    $('snelheid').textContent = kmh(t.kmh);
    $('snelheid').closest('.snelheid-vak').classList.toggle('is-aangepast', t.kmh !== b.kmh);
    $('helling').textContent = helling(b.helling);
    $('tempo').textContent = `${formatTijd(tempoPerKm(t.kmh))} /km${b.afstandM ? ` · ${b.afstandM >= 1000 ? `${String(b.afstandM / 1000).replace('.', ',')} km` : `${b.afstandM} m`}` : ''}${t.kmh !== b.kmh ? ` · schema ${kmh(b.kmh)}` : ''}`;
    $('afstand').textContent = `${t.afstandKm.toFixed(2).replace('.', ',')} km`;
    // In de extra tijd telt de klok op in plaats van af.
    $('timer').textContent = t.extra ? `+${klok(t.extraMs)}` : klok(t.restBlokMs);
    const sectie = root.querySelector('.loop');
    sectie.dataset.soort = t.extra ? 'extra' : b.soort;
    root.querySelector('[data-actie=overslaan]').hidden = t.extra;
    root.querySelector('[data-actie=stop]').hidden = t.extra;
    root.querySelector('[data-actie=afronden]').hidden = !t.extra;
    sectie.classList.toggle('is-gepauzeerd', t.gepauzeerd);
    root.querySelector('[data-actie=pauze]').textContent = t.gepauzeerd ? 'Hervat' : 'Pauze';
    root.querySelector('[data-test=stop-hint]').hidden = t.extra;
    root.querySelectorAll('.seg').forEach((el, i) => {
      el.classList.toggle('gedaan', i < t.index);
      el.classList.toggle('nu', i === t.index);
    });
    const v = t.volgende;
    const volgendeEl = $('volgende');
    volgendeEl.classList.toggle('is-aankondiging', t.aankondigen);
    volgendeEl.textContent = v
      ? `${t.aankondigen ? `Over ${Math.ceil(t.restBlokMs / 1000)} s` : 'Hierna'}: ${blokTitel(v)}, ${kmh(t.volgendeKmh)} km/u${v.helling !== b.helling ? `, ${helling(v.helling)}%` : ''}`
      : t.extra
        ? 'Je schema zit erop. Loop door zolang je wilt en druk op Training afronden.'
        : 'Laatste blok. Daarna loopt de training door tot je zelf afrondt.';

    // Na elke volle kilometer: de tijd van die kilometer (echte looptijd, zonder pauzes).
    const heleKm = Math.floor(t.afstandKm);
    if (heleKm > vorige.km) {
      const kmSec = (t.echtMs - vorige.kmOpMs) / 1000;
      $('laatste-km').textContent = `km ${heleKm}: ${formatTijd(kmSec)}`;
      geluid.zeg(kilometerTekst(heleKm, kmSec));
      vorige.km = heleKm;
      vorige.kmOpMs = t.echtMs;
    }

    if (t.extra && !vorige.extra) {
      geluid.piep(3, true);
      geluid.zeg('Je training zit erop. Loop gerust door, en druk op afronden als je klaar bent.');
    } else if (t.index !== vorige.index && vorige.index !== -1) { geluid.piep(2, true); geluid.zeg(`Nu: ${uitspraak(b, t.kmh)}`); }
    else if (t.aankondigen && !vorige.aankondigen) { geluid.piep(1); geluid.zeg(`Over ${VOORAANKONDIGING_SEC} seconden: ${uitspraak(v, t.volgendeKmh)}`); }
    vorige = { ...vorige, index: t.index, aankondigen: t.aankondigen, extra: t.extra };
  }

  function loop() {
    tekenLopend();
    koppelStop();
    stopSchermAan = houdSchermAan();
    // Na herladen niet opnieuw alle kilometers en het huidige blok aankondigen.
    const t = toestand(speler, Date.now());
    vorige = { ...vorige, index: t.index, aankondigen: t.aankondigen, extra: t.extra, km: Math.floor(t.afstandKm), kmOpMs: t.echtMs };
    ververs();
    timer = setInterval(ververs, 250);
  }

  root.onclick = (e) => {
    if (e.target.closest('form.afronden')) return;
    const actie = e.target.closest('[data-actie]')?.dataset.actie;
    const nu = Date.now();
    if (actie === 'geluid') geluid.zet(e.target.checked);
    if (actie === 'terug') { document.body.classList.remove('loopmodus'); terug?.(); }
    // Stop werkt door vasthouden (hieronder); alleen met het toetsenbord vragen we het.
    if (actie === 'stop' && e.detail === 0 && confirm('Training stoppen?')) stoppen();
    if (actie === 'start') {
      geluid.ontgrendel();
      geluid.zeg(`Start. ${uitspraak(training.blokken[0])}`);
      speler = start(speler, nu);
      bewaar();
      loop();
    }
    if (actie === 'pauze') { speler = speler.pauzeOp === null ? pauzeer(speler, nu) : hervat(speler, nu); bewaar(); ververs(); }
    if (actie === 'overslaan') {
      const ervoor = speler;
      speler = overslaan(speler, nu);
      bewaar();
      ververs();
      toonMelding('Blok overgeslagen', {
        actie: 'Ongedaan maken',
        bijActie: () => { if (timer === null) return; speler = ervoor; bewaar(); ververs(); },
      });
    }
    if (actie === 'sneller' || actie === 'langzamer') {
      speler = pasSnelheidAan(speler, nu, actie === 'sneller' ? 0.1 : -0.1);
      bewaar();
      ververs();
    }
    if (actie === 'afronden') {
      speler = pauzeer(speler, nu);
      tekenKlaar();
    }
  };

  function stoppen() {
    speler = pauzeer(speler, Date.now());
    tekenKlaar(true);
  }

  // Stop vasthouden: de ring loopt vol en na STOP_VASTHOUDEN_MS stopt de training.
  let vasthouden = null;
  const loslaten = () => {
    if (!vasthouden) return;
    clearTimeout(vasthouden.timer);
    vasthouden.knop.classList.remove('is-vasthouden');
    toonMelding('Houd Stop ingedrukt om te stoppen', { duurMs: 2500 });
    vasthouden = null;
  };
  function koppelStop() {
    root.onpointerdown = (e) => {
      const knop = e.target.closest('[data-actie=stop]');
      if (!knop) return;
      e.preventDefault();
      knop.classList.add('is-vasthouden');
      const v = { knop };
      v.timer = setTimeout(() => { vasthouden = null; stoppen(); }, STOP_VASTHOUDEN_MS);
      vasthouden = v;
    };
    root.onpointerup = loslaten;
    root.onpointercancel = loslaten;
    root.onpointerout = (e) => { if (vasthouden && !vasthouden.knop.contains(e.relatedTarget)) loslaten(); };
  }

  if (speler.gestartOp !== null) loop();
  else tekenVoorStart();
  return () => { clearInterval(timer); stopSchermAan?.(); };
}

// Trainingsscherm voor op de loopband: groot de snelheid en helling, aftellende timer,
// een balk met alle blokken en een aankondiging 10 seconden voor het volgende blok.
import { maakSpeler, start, pauzeer, hervat, overslaan, toestand, verstreken, VOORAANKONDIGING_SEC } from './speler.js';
import { kmh, minuten } from './opmaak.js';
import { formatTijd } from './tijd.js';
import { tempoPerKm } from './zones.js';
import { kcalTotVerstreken, afstandTotVerstreken } from './calorieen.js';
import { afrondFormulier, koppelAfronden } from './afronden.js';

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
      speechSynthesis.cancel();
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

const uitspraak = (b) => `${blokTitel(b)}, ${kmh(b.kmh).replace(',', ' komma ')} kilometer per uur${b.helling ? `, helling ${helling(b.helling)} procent` : ''}`;

// ---------- Scherm ----------

export function toonLoopscherm(root, training, { opslag = localStorage, profiel, terug, klaar } = {}) {
  const geluid = maakGeluid();
  let speler = maakSpeler(training.blokken);
  let timer = null;
  let stopSchermAan = null;
  let vorige = { index: -1, aankondigen: false, klaar: false };

  // Doorgaan na herladen: de lopende training staat in de opslag.
  try {
    const bewaard = JSON.parse(opslag.getItem(OPSLAG_LOPEND));
    if (bewaard?.trainingId === training.id) speler = { ...speler, ...bewaard.stand };
  } catch { /* geen lopende training */ }

  const bewaar = () => {
    const { gestartOp, pauzeOp, gepauzeerdMs, extraMs } = speler;
    opslag.setItem(OPSLAG_LOPEND, JSON.stringify({ trainingId: training.id, stand: { gestartOp, pauzeOp, gepauzeerdMs, extraMs } }));
  };
  const opruimen = () => {
    clearInterval(timer);
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
        <p class="uitleg">${minuten(training.duurSec)} · ${training.blokken.length} blokken. Zet de loopband op
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
        <div class="loop-groot">
          <div><span class="waarde" data-test="snelheid"></span><span class="eenheid">km/u</span></div>
          <div><span class="waarde" data-test="helling"></span><span class="eenheid">% helling</span></div>
        </div>
        <div class="loop-tempo" data-test="tempo"></div>
        <div class="loop-timer" data-test="timer"></div>
        <div class="loop-balk">${balk}</div>
        <div class="loop-volgende" data-test="volgende"></div>
        <div class="knoppen">
          <button type="button" class="secundair" data-actie="pauze">Pauze</button>
          <button type="button" class="secundair" data-actie="overslaan">Volgend blok</button>
          <button type="button" class="secundair" data-actie="stop">Stop</button>
        </div>
      </section>`;
  }

  function tekenKlaar(gestopt = false) {
    const sec = Math.round(verstreken(speler, Date.now()) / 1000);
    opruimen();
    document.body.classList.remove('loopmodus');
    root.innerHTML = `
      <section class="loop" data-test="loopscherm">
        <h1>${gestopt ? 'Gestopt' : 'Klaar!'}</h1>
        <p class="uitleg" data-test="klaar">${gestopt
          ? `Je bent gestopt na ${Math.round(sec / 60)} min. Wil je opslaan wat je gedaan hebt?`
          : `${training.naam} zit erop. Goed gedaan.`}</p>
        ${afrondFormulier({
          afstandKm: afstandTotVerstreken(training, sec), duurSec: sec,
          kcal: kcalTotVerstreken(training, sec, profiel.gewicht),
        })}
      </section>`;
    koppelAfronden(root, training, profiel, { opslag, opgeslagen: () => klaar?.(), annuleer: () => terug?.() });
  }

  function ververs() {
    const nu = Date.now();
    const t = toestand(speler, nu);
    if (t.klaar) {
      if (!vorige.klaar) geluid.piep(3, true);
      vorige.klaar = true;
      return tekenKlaar();
    }
    const $ = (sel) => root.querySelector(`[data-test=${sel}]`);
    const b = t.blok;
    $('bloktitel').textContent = blokTitel(b);
    $('totaal').textContent = `nog ${klok(t.restTotaalMs)}`;
    $('snelheid').textContent = kmh(b.kmh);
    $('helling').textContent = helling(b.helling);
    $('tempo').textContent = `${formatTijd(tempoPerKm(b.kmh))} /km${b.afstandM ? ` · ${b.afstandM} m` : ''}`;
    $('timer').textContent = klok(t.restBlokMs);
    const sectie = root.querySelector('.loop');
    sectie.dataset.soort = b.soort;
    sectie.classList.toggle('is-gepauzeerd', t.gepauzeerd);
    root.querySelector('[data-actie=pauze]').textContent = t.gepauzeerd ? 'Hervat' : 'Pauze';
    root.querySelectorAll('.seg').forEach((el, i) => {
      el.classList.toggle('gedaan', i < t.index);
      el.classList.toggle('nu', i === t.index);
    });
    const v = t.volgende;
    const volgendeEl = $('volgende');
    volgendeEl.classList.toggle('is-aankondiging', t.aankondigen);
    volgendeEl.textContent = v
      ? `${t.aankondigen ? `Over ${Math.ceil(t.restBlokMs / 1000)} s` : 'Hierna'}: ${blokTitel(v)}, ${kmh(v.kmh)} km/u${v.helling !== b.helling ? `, ${helling(v.helling)}%` : ''}`
      : 'Laatste blok';

    if (t.index !== vorige.index && vorige.index !== -1) { geluid.piep(2, true); geluid.zeg(`Nu: ${uitspraak(b)}`); }
    else if (t.aankondigen && !vorige.aankondigen) { geluid.piep(1); geluid.zeg(`Over ${VOORAANKONDIGING_SEC} seconden: ${uitspraak(v)}`); }
    vorige = { index: t.index, aankondigen: t.aankondigen, klaar: false };
  }

  function loop() {
    tekenLopend();
    stopSchermAan = houdSchermAan();
    ververs();
    vorige.index = toestand(speler, Date.now()).index;
    timer = setInterval(ververs, 250);
  }

  root.onclick = (e) => {
    if (e.target.closest('form.afronden')) return;
    const actie = e.target.closest('[data-actie]')?.dataset.actie;
    const nu = Date.now();
    if (actie === 'geluid') geluid.zet(e.target.checked);
    if (actie === 'terug') { document.body.classList.remove('loopmodus'); terug?.(); }
    if (actie === 'start') {
      geluid.ontgrendel();
      geluid.zeg(`Start. ${uitspraak(training.blokken[0])}`);
      speler = start(speler, nu);
      bewaar();
      loop();
    }
    if (actie === 'pauze') { speler = speler.pauzeOp === null ? pauzeer(speler, nu) : hervat(speler, nu); bewaar(); ververs(); }
    if (actie === 'overslaan') { speler = overslaan(speler, nu); bewaar(); ververs(); }
    if (actie === 'stop') {
      if (!confirm('Training stoppen?')) return;
      speler = pauzeer(speler, nu);
      tekenKlaar(true);
    }
  };

  if (speler.gestartOp !== null) loop();
  else tekenVoorStart();
  return () => { clearInterval(timer); stopSchermAan?.(); };
}

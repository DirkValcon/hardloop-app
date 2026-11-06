// Trainingsscherm. Binnen (loopband): groot de snelheid en helling. Buiten: groot je tempo uit de GPS
// naast je doeltempo. Verder een aftellende timer, een balk met alle blokken en een aankondiging
// 10 seconden voor het volgende blok.
import { maakSpeler, start, pauzeer, hervat, overslaan, toestand, pasSnelheidAan, echteTijd, VOORAANKONDIGING_SEC } from './speler.js';
import {
  laadWaar, bewaarWaar, maakSpoor, voegPositieToe, onderbreek, toestandBuiten, overslaanBuiten, tempoOordeel,
  AFWIJKING_DUUR_MS, SEINTJE_OPNIEUW_MS, GPS_KWIJT_MS, MAX_ONNAUWKEURIG_M,
} from './buiten.js';
import { kmh, minuten } from './opmaak.js';
import { formatTijd } from './tijd.js';
import { tempoPerKm } from './zones.js';
import { schatKcal } from './resultaten.js';
import { afrondFormulier, koppelAfronden } from './afronden.js';
import { toonMelding, sluitMelding } from './melding.js';

// Stoppen gaat door Stop even ingedrukt te houden, zodat je niet per ongeluk stopt.
export const STOP_VASTHOUDEN_MS = 1000;
// + en − vasthouden: na HERHAAL_START_MS doortellen, eerst rustig en daarna sneller.
export const HERHAAL_START_MS = 400;
export const HERHAAL_MS = 180;
export const HERHAAL_SNEL_MS = 90;

export const OPSLAG_LOPEND = 'hardloop-app.lopend.v1';

const klok = (ms) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const helling = (h) => `${String(h).replace('.', ',')}`;

// Welke van je snelheden (Langzaam, Normaal, Hard, Wandelen) bij een blok hoort.
const SNELHEID_VAN_SOORT = { warmup: 'Langzaam', uitjoggen: 'Langzaam', rustig: 'Normaal', herstel: 'Normaal', interval: 'Hard', tempo: 'Hard', uitwandelen: 'Wandelen' };
export const snelheidNaam = (b) => SNELHEID_VAN_SOORT[b.soort] ?? '';

function blokTitel(b) {
  if (b.herhaling && b.van) return `${b.label} ${b.herhaling} van ${b.van}`;
  if (b.deel) return `${b.label} ${b.deel.replace('/', ' van ')}`;
  return b.label;
}

// ---------- Geluid, spraak en scherm aan ----------

function maakGeluid() {
  let ctx = null;
  let aan = true;
  // Lopende uitspraken bewaren: anders ruimt de browser ze soms op vóór ze klinken.
  const wachtrij = new Set();
  let laatsteStart = 0;
  let vrijgeefTimer = null;
  let piepTot = 0;

  // iPhone: zonder 'playback' zet de stille-modusschakelaar al het webgeluid uit. Maar 'playback'
  // pauzeert ook Spotify, en zolang wij het kanaal vasthouden gaat de muziek niet verder.
  // Daarom: alleen claimen zolang er iets klinkt, en daarna weer loslaten.
  const zetModus = (type) => { try { if (navigator.audioSession) navigator.audioSession.type = type; } catch { /* oudere iOS */ } };
  const claim = () => {
    clearTimeout(vrijgeefTimer);
    vrijgeefTimer = null;
    zetModus('playback');
  };

  const wekContext = () => {
    if (!ctx) return;
    // iOS zet de context op 'suspended' of 'interrupted' na een scherm-uit of een melding.
    if (ctx.state !== 'running') ctx.resume?.().catch(() => {});
  };

  const bezig = () => wachtrij.size > 0 || Date.now() < piepTot
    || (window.speechSynthesis && (speechSynthesis.speaking || speechSynthesis.pending) && Date.now() - laatsteStart < 20000);

  // Kanaal vrijgeven zodra alles gezegd is: context stil en sessie terug naar 'auto',
  // zodat iOS andere apps (Spotify) laat weten dat ze verder kunnen spelen.
  const geefVrij = (naMs = 800) => {
    clearTimeout(vrijgeefTimer);
    vrijgeefTimer = setTimeout(() => {
      vrijgeefTimer = null;
      if (bezig()) { geefVrij(500); return; }
      try { if (ctx?.state === 'running') ctx.suspend?.().catch(() => {}); } catch { /* niets */ }
      zetModus('auto');
    }, naMs);
  };

  return {
    get aan() { return aan; },
    zet(v) { aan = v; },
    // Moet binnen een tik van de gebruiker gebeuren, anders blijft iOS stil. Mag vaker: elke tik
    // op het loopscherm ontgrendelt opnieuw (bijvoorbeeld na herladen midden in een training).
    ontgrendel() {
      claim();
      try {
        ctx ??= new (window.AudioContext || window.webkitAudioContext)();
        wekContext();
        // Een heel kort stil geluidje: dit opent het geluidskanaal op iOS echt.
        const buf = ctx.createBuffer(1, 1, 22050);
        const bron = ctx.createBufferSource();
        bron.buffer = buf;
        bron.connect(ctx.destination);
        bron.start(0);
      } catch { ctx = null; }
      // Spraak ontgrendelen met een lege uitspraak, alleen als er nog niets gezegd wordt.
      try {
        if (window.speechSynthesis && !speechSynthesis.speaking && !speechSynthesis.pending) {
          const u = new SpeechSynthesisUtterance(' ');
          u.volume = 0;
          speechSynthesis.speak(u);
        }
      } catch { /* geen spraak */ }
      geefVrij();
    },
    // Na terugkeer in de app alleen wekken als er net iets klinkt; anders blijft het kanaal vrij.
    wek() { if (bezig()) wekContext(); },
    piep(aantal = 1, hoog = false) {
      navigator.vibrate?.(Array.from({ length: aantal * 2 - 1 }, (_, i) => (i % 2 ? 120 : 200)));
      if (!aan || !ctx) return;
      claim();
      wekContext();
      for (let i = 0; i < aantal; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = hoog ? 1320 : 880;
        const t = ctx.currentTime + i * 0.3;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.6, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.25);
      }
      piepTot = Math.max(piepTot, Date.now() + aantal * 300);
      geefVrij();
    },
    zeg(tekst) {
      if (!aan || !window.speechSynthesis) return;
      try {
        claim();
        // iOS-spraak kan vastlopen (blijft "bezig" zonder geluid). Hangt hij langer dan 20 s, dan opnieuw beginnen.
        if (speechSynthesis.speaking && Date.now() - laatsteStart > 20000) { speechSynthesis.cancel(); wachtrij.clear(); }
        if (speechSynthesis.paused) speechSynthesis.resume();
        const u = new SpeechSynthesisUtterance(tekst);
        u.lang = 'nl-NL';
        const stem = speechSynthesis.getVoices?.().find((v) => v.lang?.replace('_', '-').startsWith('nl'));
        if (stem) u.voice = stem;
        wachtrij.add(u);
        u.onstart = () => { laatsteStart = Date.now(); };
        u.onend = u.onerror = () => { wachtrij.delete(u); if (!wachtrij.size) geefVrij(); };
        // Vangnet als iOS geen 'klaar' meldt: na een ruime schatting toch loslaten.
        setTimeout(() => { if (wachtrij.delete(u) && !wachtrij.size) geefVrij(); }, 4000 + tekst.length * 120);
        if (!speechSynthesis.speaking) laatsteStart = Date.now();
        // Niet afbreken: een kilometertijd en een blokaankondiging mogen na elkaar komen.
        speechSynthesis.speak(u);
      } catch { /* geen spraak */ }
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

// Buiten: "7 minuten 4 per kilometer".
export const spreekTempo = (sec) => {
  const s = Math.round(sec);
  const m = Math.floor(s / 60);
  return `${m} ${m === 1 ? 'minuut' : 'minuten'}${s % 60 ? ` ${s % 60}` : ''} per kilometer`;
};
export const uitspraakBuiten = (b) => {
  const wat = b.afstandM ? `${b.afstandM >= 1000 ? `${spreekGetal(b.afstandM / 1000)} kilometer` : `${b.afstandM} meter`}` : spreekDuur(b.duurSec);
  const naam = snelheidNaam(b);
  return `${blokTitel(b)}: ${wat}, ${naam ? `${naam.toLowerCase()}, ` : ''}tempo ${spreekTempo(tempoPerKm(b.kmh))}`;
};
export const tempoSeintje = (oordeel, tempo, doel) =>
  `${oordeel === 'te-snel' ? 'Iets rustiger' : 'Iets sneller'}. Je loopt ${spreekTempo(tempo)}, je doel is ${spreekTempo(doel)}.`;

const afstandTekst = (m) => (m >= 1000 ? `${String(Math.round(m / 10) / 100).replace('.', ',')} km` : `${Math.round(m)} m`);

// GPS volgen zolang het scherm buiten open is. Meldt elke positie en de status.
function volgGps(bijPositie, bijStatus) {
  if (!navigator.geolocation) { bijStatus({ status: 'geen' }); return () => {}; }
  bijStatus({ status: 'zoeken' });
  const id = navigator.geolocation.watchPosition(
    (p) => {
      const nauwkeurig = p.coords.accuracy;
      bijStatus({ status: nauwkeurig <= MAX_ONNAUWKEURIG_M ? 'ok' : 'zwak', nauwkeurig, fixOp: Date.now() });
      bijPositie({ lat: p.coords.latitude, lon: p.coords.longitude, nauwkeurig });
    },
    (e) => bijStatus({ status: e.code === 1 ? 'geweigerd' : 'zoeken' }),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

function gpsTekst(gps, nu) {
  if (gps.status === 'geweigerd') return 'Geen toegang tot je locatie. Zet locatie aan voor Safari: Instellingen › Privacy › Locatievoorzieningen.';
  if (gps.status === 'geen') return 'Deze telefoon geeft geen locatie door.';
  if (gps.fixOp && nu - gps.fixOp > GPS_KWIJT_MS) return 'GPS kwijt…';
  if (gps.status === 'ok') return `GPS ✓ ±${Math.round(gps.nauwkeurig)} m`;
  if (gps.status === 'zwak') return `GPS zwak ±${Math.round(gps.nauwkeurig)} m`;
  return 'GPS zoekt je locatie…';
}

// ---------- Scherm ----------

export function toonLoopscherm(root, training, { opslag = localStorage, profiel, terug, klaar, volgnummer = null } = {}) {
  const geluid = maakGeluid();
  let speler = maakSpeler(training.blokken);
  let waar = laadWaar(opslag);
  let gps = { status: 'uit' };
  let stopGps = null;
  let afwijking = null; // { soort, sinds } zolang je te snel of te langzaam loopt
  let laatsteSeintje = -Infinity;
  let timer = null;
  let stopSchermAan = null;
  let vorige = { index: -1, aankondigen: false, extra: false, km: 0, kmOpMs: 0 };

  // Doorgaan na herladen: de lopende training staat in de opslag.
  try {
    const bewaard = JSON.parse(opslag.getItem(OPSLAG_LOPEND));
    if (bewaard?.trainingId === training.id) { speler = { ...speler, ...bewaard.stand }; waar = bewaard.waar ?? 'binnen'; }
  } catch { /* geen lopende training */ }

  const bewaar = () => {
    const { gestartOp, pauzeOp, gepauzeerdMs, extraMs, wijzigingen, overgeslagen, spoor, sprongen } = speler;
    opslag.setItem(OPSLAG_LOPEND, JSON.stringify({
      trainingId: training.id, waar, stand: { gestartOp, pauzeOp, gepauzeerdMs, extraMs, wijzigingen, overgeslagen, spoor, sprongen },
    }));
  };
  const buiten = () => waar === 'buiten';
  const stand = (nu) => (buiten() ? toestandBuiten(speler, nu) : toestand(speler, nu));
  const spreek = (b, kmhNu) => (buiten() ? uitspraakBuiten(b) : uitspraak(b, kmhNu));
  const toonGps = () => {
    const el = root.querySelector('[data-test=gps-status]');
    if (!el) return;
    el.textContent = gpsTekst(gps, Date.now());
    el.dataset.status = gps.fixOp && Date.now() - gps.fixOp > GPS_KWIJT_MS ? 'kwijt' : gps.status;
  };
  const startGps = () => {
    if (stopGps) return;
    speler = { ...speler, spoor: speler.spoor ?? maakSpoor(), sprongen: speler.sprongen ?? [] };
    stopGps = volgGps((pos) => {
      // Alleen tijdens het lopen telt de weg; in een pauze niet.
      if (speler.gestartOp === null || speler.pauzeOp !== null) return;
      speler = { ...speler, spoor: voegPositieToe(speler.spoor, pos, echteTijd(speler, Date.now())) };
      bewaar();
    }, (g) => { gps = { ...gps, ...g }; toonGps(); });
  };
  const stopGpsNu = () => { stopGps?.(); stopGps = null; };
  const opruimen = () => {
    clearInterval(timer);
    timer = null;
    sluitMelding();
    root.onpointerdown = root.onpointerup = root.onpointercancel = root.onpointerout = null;
    stopSchermAan?.();
    document.removeEventListener('visibilitychange', geluidTerug);
    stopGpsNu();
    opslag.removeItem(OPSLAG_LOPEND);
  };

  const balk = training.blokken.map((b, i) =>
    `<span class="seg seg-${b.soort}" data-seg="${i}" style="flex:${b.duurSec}"></span>`).join('');

  function tekenVoorStart() {
    document.body.classList.add('loopmodus');
    const b0 = training.blokken[0];
    root.innerHTML = `
      <section class="loop" data-test="loopscherm">
        <div class="loop-kop"><button type="button" class="secundair klein" data-actie="terug">Terug</button></div>
        <h1>${training.naam}</h1>
        <label class="waar-keuze" data-test="waar" data-waar="${waar}">
          <span class="waar-binnen">Binnen</span>
          <input type="checkbox" role="switch" class="schakelaar" data-actie="waar" aria-label="Binnen of buiten lopen" ${buiten() ? 'checked' : ''}>
          <span class="waar-buiten">Buiten</span>
        </label>
        <p class="uitleg">${minuten(training.duurSec)} · ${training.blokken.length} blokken. Je hoort na elke kilometer je tijd en 10 seconden voor elk blok wat je moet doen. ${buiten()
          ? `Begin ${snelheidNaam(b0).toLowerCase()} op <strong>${formatTijd(tempoPerKm(b0.kmh))} /km</strong> en druk op Start.`
          : `Zet de loopband op <strong>${kmh(b0.kmh)} km/u</strong> en <strong>${helling(b0.helling)}%</strong> en druk op Start.`}</p>
        ${buiten() ? `
        <p class="gps-status" data-test="gps-status"></p>
        <p class="hint" data-test="gps-uitleg">Houd de app open met het scherm aan: op slot of in een andere app stopt de GPS.</p>` : ''}
        <div class="loop-balk">${balk}</div>
        <label class="keuze geluid-keuze"><input type="checkbox" data-actie="geluid" ${geluid.aan ? 'checked' : ''}>
          <span>Geluid en gesproken aanwijzingen<small>Zet het volume van je iPhone aan.</small></span></label>
        <button type="button" class="secundair breed" data-actie="test-geluid">Test geluid</button>
        <button type="button" class="primair breed groot" data-actie="start">Start</button>
      </section>`;
    if (buiten()) { startGps(); toonGps(); } else stopGpsNu();
  }

  function tekenLopend() {
    root.innerHTML = `
      <section class="loop is-lopend" data-test="loopscherm">
        <div class="loop-kop">
          <span class="loop-titel" data-test="bloktitel"></span>
          <span class="loop-totaal" data-test="totaal"></span>
        </div>
        <div class="loop-stand"><span data-test="afstand"></span>${buiten() ? '<span class="gps-status" data-test="gps-status"></span>' : ''}<span data-test="laatste-km"></span></div>
        <div class="loop-timer" data-test="timer"></div>
        ${buiten() ? `
        <div class="loop-groot is-buiten">
          <div class="tempo-vak" data-test="tempo-vak">
            <span class="waarde" data-test="tempo-nu"></span><span class="eenheid">/km nu</span>
            <span class="loop-oordeel" data-test="oordeel"></span>
          </div>
          <div><span class="waarde" data-test="doeltempo"></span><span class="eenheid">/km doel</span>
            <span class="loop-tempo" data-test="tempo"></span></div>
        </div>` : `
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
        </div>`}
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
    const t = stand(Date.now());
    const sec = Math.round(t.echtMs / 1000);
    const waarNu = waar;
    // Buiten is er geen helling van de loopband.
    const gelopen = buiten() ? { ...training, blokken: training.blokken.map((b) => ({ ...b, helling: 0 })) } : training;
    const afstandKm = Math.round(t.afstandKm * 100) / 100;
    opruimen();
    document.body.classList.remove('loopmodus');
    const samenvatting = { ...(volgnummer ?? {}) };
    root.innerHTML = `
      <section class="loop loop-klaar" data-test="loopscherm">
        <div class="klaar-kop${gestopt ? ' is-gestopt' : ''}" aria-hidden="true">${gestopt ? '■' : '✓'}</div>
        <h1>${gestopt ? 'Gestopt' : 'Klaar! Goed gedaan.'}</h1>
        <p class="uitleg" data-test="klaar">${gestopt
          ? `Je bent gestopt na ${Math.round(sec / 60)} min. Wil je opslaan wat je gedaan hebt?`
          : `${training.naam} zit erop.`}</p>
        ${afrondFormulier({
          afstandKm, duurSec: sec,
          kcal: schatKcal(gelopen, afstandKm, profiel.gewicht),
        }, {}, { samenvatting, waar: waarNu })}
      </section>`;
    koppelAfronden(root, gelopen, profiel, { opslag, samenvatting, waar: waarNu, opgeslagen: () => klaar?.(), annuleer: () => terug?.() });
  }

  function ververs() {
    const nu = Date.now();
    const t = stand(nu);
    const $ = (sel) => root.querySelector(`[data-test=${sel}]`);
    const b = t.blok;
    const blokAfstand = b.afstandM ? ` · ${b.afstandM >= 1000 ? `${String(b.afstandM / 1000).replace('.', ',')} km` : `${b.afstandM} m`}` : '';
    $('bloktitel').textContent = t.extra ? 'Extra: doorlopen' : blokTitel(b);
    if (buiten()) {
      $('totaal').textContent = t.extra ? `schema klaar · ${klok(t.echtMs)}` : `${klok(t.echtMs)} gelopen`;
      $('tempo-nu').textContent = t.tempoNu ? formatTijd(t.tempoNu) : '–:––';
      const oordeel = t.gepauzeerd ? null : tempoOordeel(t.tempoNu, t.doelTempo);
      $('tempo-vak').dataset.oordeel = oordeel ?? '';
      $('oordeel').textContent = { 'te-snel': 'te snel', 'te-langzaam': 'te langzaam', goed: 'goed zo' }[oordeel] ?? '';
      $('doeltempo').textContent = formatTijd(t.doelTempo);
      $('tempo').textContent = `${snelheidNaam(b) ? `${snelheidNaam(b)} · ` : ''}${kmh(b.kmh)} km/u${blokAfstand}`;
      toonGps();
    } else {
      $('totaal').textContent = t.extra ? `schema klaar · ${klok(t.echtMs)}` : `nog ${klok(t.restTotaalMs)}`;
      $('snelheid').textContent = kmh(t.kmh);
      $('snelheid').closest('.snelheid-vak').classList.toggle('is-aangepast', t.kmh !== b.kmh);
      $('helling').textContent = helling(b.helling);
      $('tempo').textContent = `${snelheidNaam(b) ? `${snelheidNaam(b)} · ` : ''}${formatTijd(tempoPerKm(t.kmh))} /km${blokAfstand}${t.kmh !== b.kmh ? ` · schema ${kmh(b.kmh)}` : ''}`;
    }
    $('afstand').textContent = `${t.afstandKm.toFixed(2).replace('.', ',')} km`;
    // In de extra tijd telt de klok op in plaats van af. Buiten telt een afstandsblok de meters af.
    $('timer').textContent = t.extra ? `+${klok(t.extraMs)}` : t.restBlokM !== null && t.restBlokM !== undefined ? afstandTekst(t.restBlokM) : klok(t.restBlokMs);
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
    const volgendDoel = (x) => (buiten()
      ? `${formatTijd(tempoPerKm(x.kmh))} /km`
      : `${kmh(t.volgendeKmh)} km/u${x.helling !== b.helling ? `, ${helling(x.helling)}%` : ''}`);
    volgendeEl.textContent = v
      ? `${t.aankondigen ? `Over ${Math.ceil(t.restBlokMs / 1000)} s` : 'Hierna'}: ${blokTitel(v)}, ${snelheidNaam(v) ? `${snelheidNaam(v).toLowerCase()} ` : ''}${volgendDoel(v)}`
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
    } else if (t.index !== vorige.index && vorige.index !== -1) { geluid.piep(2, true); geluid.zeg(`Nu: ${spreek(b, t.kmh)}`); }
    else if (t.aankondigen && !vorige.aankondigen) { geluid.piep(1); geluid.zeg(`Over ${VOORAANKONDIGING_SEC} seconden: ${spreek(v, t.volgendeKmh)}`); }
    else if (buiten()) seintjeTempo(t);
    if (t.index !== vorige.index) { afwijking = null; laatsteSeintje = -Infinity; }
    vorige = { ...vorige, index: t.index, aankondigen: t.aankondigen, extra: t.extra };
  }

  // Buiten: zit je een halve minuut ruim naast je doeltempo, dan zegt de app "iets rustiger" of "iets sneller".
  function seintjeTempo(t) {
    const oordeel = !t.extra && !t.gepauzeerd && t.blok.soort !== 'uitwandelen' && t.blokMs >= 20_000
      ? tempoOordeel(t.blokTempo, t.doelTempo) : null;
    if (oordeel !== 'te-snel' && oordeel !== 'te-langzaam') { afwijking = null; return; }
    if (afwijking?.soort !== oordeel) afwijking = { soort: oordeel, sinds: t.echtMs };
    if (t.echtMs - afwijking.sinds < AFWIJKING_DUUR_MS || t.echtMs - laatsteSeintje < SEINTJE_OPNIEUW_MS || t.aankondigen) return;
    laatsteSeintje = t.echtMs;
    geluid.piep(1);
    geluid.zeg(tempoSeintje(oordeel, t.blokTempo, t.doelTempo));
  }

  // Terug in de app (scherm weer aan): het geluid weer wakker maken.
  const geluidTerug = () => { if (document.visibilityState === 'visible') geluid.wek(); };

  function loop() {
    tekenLopend();
    koppelStop();
    stopSchermAan = houdSchermAan();
    document.addEventListener('visibilitychange', geluidTerug);
    if (buiten()) startGps();
    // Na herladen niet opnieuw alle kilometers en het huidige blok aankondigen.
    const t = stand(Date.now());
    vorige = { ...vorige, index: t.index, aankondigen: t.aankondigen, extra: t.extra, km: Math.floor(t.afstandKm), kmOpMs: t.echtMs };
    ververs();
    timer = setInterval(ververs, 250);
  }

  root.onclick = (e) => {
    if (e.target.closest('form.afronden')) return;
    const actie = e.target.closest('[data-actie]')?.dataset.actie;
    const nu = Date.now();
    if (actie && actie !== 'start' && actie !== 'terug' && speler.gestartOp !== null) geluid.ontgrendel();
    if (actie === 'geluid') geluid.zet(e.target.checked);
    if (actie === 'waar') {
      waar = e.target.checked ? 'buiten' : 'binnen';
      bewaarWaar(opslag, waar);
      tekenVoorStart();
    }
    if (actie === 'test-geluid') { geluid.ontgrendel(); geluid.piep(2, true); geluid.zeg('Geluid werkt. Zo klinkt een aankondiging.'); }
    if (actie === 'terug') { document.body.classList.remove('loopmodus'); terug?.(); }
    // Stop werkt door vasthouden (hieronder); alleen met het toetsenbord vragen we het.
    if (actie === 'stop' && e.detail === 0 && confirm('Training stoppen?')) stoppen();
    if (actie === 'start') {
      geluid.ontgrendel();
      geluid.zeg(`Start. ${spreek(training.blokken[0], training.blokken[0].kmh)}`);
      speler = start(speler, nu);
      bewaar();
      loop();
    }
    if (actie === 'pauze') {
      if (speler.pauzeOp === null) speler = pauzeer(speler, nu);
      else {
        speler = hervat(speler, nu);
        // De weg tijdens de pauze telt niet: na hervatten begint de GPS-lijn opnieuw.
        if (speler.spoor) speler = { ...speler, spoor: onderbreek(speler.spoor) };
      }
      bewaar();
      ververs();
    }
    if (actie === 'overslaan') {
      const ervoor = speler;
      speler = buiten() ? overslaanBuiten(speler, nu) : overslaan(speler, nu);
      bewaar();
      ververs();
      toonMelding('Blok overgeslagen', {
        actie: 'Ongedaan maken',
        bijActie: () => {
          if (timer === null) return;
          // Buiten: alleen het overslaan terugdraaien; de GPS-meters sinds dan blijven staan.
          speler = buiten() ? { ...speler, sprongen: ervoor.sprongen } : ervoor;
          bewaar();
          ververs();
        },
      });
    }
    // Met vinger of muis regelt het vasthouden (hieronder) de stappen; dit is voor het toetsenbord.
    if ((actie === 'sneller' || actie === 'langzamer') && e.detail === 0) stapSnelheid(actie);
    if (actie === 'afronden') {
      speler = pauzeer(speler, nu);
      tekenKlaar();
    }
  };

  function stapSnelheid(actie) {
    speler = pasSnelheidAan(speler, Date.now(), actie === 'sneller' ? 0.1 : -0.1);
    bewaar();
    ververs();
  }

  // + of − vasthouden: meteen één stap, na een korte pauze steeds sneller doortellen.
  let herhalen = null;
  const stopHerhalen = () => {
    if (!herhalen) return;
    clearTimeout(herhalen.timer);
    herhalen.knop.classList.remove('is-ingedrukt');
    herhalen = null;
  };
  function startHerhalen(knop) {
    const actie = knop.dataset.actie;
    knop.classList.add('is-ingedrukt');
    herhalen = { knop, stappen: 0 };
    stapSnelheid(actie);
    const volgende = (wacht) => {
      herhalen.timer = setTimeout(() => {
        if (!herhalen) return;
        herhalen.stappen += 1;
        stapSnelheid(actie);
        volgende(herhalen.stappen < 5 ? HERHAAL_MS : HERHAAL_SNEL_MS);
      }, wacht);
    };
    volgende(HERHAAL_START_MS);
  }

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
      const plusmin = e.target.closest('[data-actie=sneller], [data-actie=langzamer]');
      if (plusmin) {
        e.preventDefault();
        stopHerhalen();
        // Vasthouden blijft gelden, ook als de knop onder je vinger iets verschuift.
        try { plusmin.setPointerCapture(e.pointerId); } catch { /* oudere browsers */ }
        startHerhalen(plusmin);
        return;
      }
      const knop = e.target.closest('[data-actie=stop]');
      if (!knop) return;
      e.preventDefault();
      knop.classList.add('is-vasthouden');
      const v = { knop };
      v.timer = setTimeout(() => { vasthouden = null; stoppen(); }, STOP_VASTHOUDEN_MS);
      vasthouden = v;
    };
    root.onpointerup = () => { stopHerhalen(); loslaten(); };
    root.onpointercancel = () => { stopHerhalen(); loslaten(); };
    root.addEventListener('lostpointercapture', stopHerhalen, true);
    root.onpointerout = (e) => {
      if (vasthouden && !vasthouden.knop.contains(e.relatedTarget)) loslaten();
    };
  }

  if (speler.gestartOp !== null) loop();
  else tekenVoorStart();
  return () => { stopHerhalen(); clearInterval(timer); stopSchermAan?.(); stopGpsNu(); document.removeEventListener('visibilitychange', geluidTerug); };
}

// Inloggen met Google via Supabase. De sessie staat in localStorage, dus de app start ook offline.
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

let client;

export function ingesteld() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY && globalThis.supabase);
}

function sb() {
  client ??= globalThis.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
  });
  return client;
}

// Sessie die supabase-js zelf bewaart (sleutel sb-<project>-auth-token).
function bewaardeGebruiker(opslag = localStorage) {
  for (let i = 0; i < opslag.length; i++) {
    const sleutel = opslag.key(i);
    if (!/^sb-.+-auth-token$/.test(sleutel)) continue;
    try { return JSON.parse(opslag.getItem(sleutel))?.user ?? null; } catch { return null; }
  }
  return null;
}

export async function huidigeGebruiker() {
  if (!ingesteld()) return null;
  const { data, error } = await sb().auth.getSession();
  // Na terugkomst van Google staat ?code= in de adresbalk; die is nu verwerkt.
  if (new URLSearchParams(location.search).has('code')) history.replaceState(null, '', location.pathname + location.hash);
  if (data.session) return data.session.user;
  // Zonder internet kan een verlopen sessie niet ververst worden; blijf dan gewoon ingelogd.
  if (error && globalThis.supabase.isAuthRetryableFetchError(error)) return bewaardeGebruiker();
  return null;
}

export async function inloggenMetGoogle() {
  const { error } = await sb().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: location.origin + location.pathname },
  });
  if (error) throw error;
}

export async function uitloggen() {
  await sb().auth.signOut({ scope: 'local' });
}

// Tabel app_gegevens in Supabase: één rij per onderdeel (profiel, aanpassingen, resultaten).
export function accountGegevens(gebruikerId) {
  return {
    async haal() {
      const { data, error } = await sb().from('app_gegevens').select('naam, waarde, bijgewerkt');
      if (error) throw error;
      return data;
    },
    async bewaar(naam, waarde, bijgewerkt) {
      const { error } = await sb().from('app_gegevens')
        .upsert({ user_id: gebruikerId, naam, waarde, bijgewerkt }, { onConflict: 'user_id,naam' });
      if (error) throw error;
    },
  };
}

export function inlogschermHtml({ fout } = {}) {
  const klaar = ingesteld();
  return `
    <div class="inloggen">
      <h1>Loopschema</h1>
      <p class="uitleg">Log in om je schema en trainingen op al je apparaten te bewaren.</p>
      <button type="button" class="google breed" data-actie="google" ${klaar ? '' : 'disabled'}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.7 3.3-8z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.6l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z"/></svg>
        Inloggen met Google
      </button>
      ${klaar ? '' : '<div class="melding" role="status">Inloggen is nog niet ingesteld (Supabase-gegevens ontbreken in js/config.js).</div>'}
      ${fout ? `<div class="foutmelding" role="alert">${fout}</div>` : ''}
    </div>`;
}

export function toonInloggen(root) {
  document.body.classList.remove('met-tabs');
  document.querySelector('nav.tabs')?.remove();
  root.innerHTML = inlogschermHtml();
  root.onclick = async (e) => {
    if (!e.target.closest('[data-actie=google]')) return;
    try {
      await inloggenMetGoogle();
    } catch {
      root.innerHTML = inlogschermHtml({ fout: 'Inloggen lukt nu niet. Heb je internet? Probeer het opnieuw.' });
    }
  };
}

export function accountHtml(gebruiker) {
  if (!gebruiker) return '';
  return `
    <h2>Account</h2>
    <div class="kaart">
      <p class="account-email" data-test="account">Ingelogd als <strong>${gebruiker.email ?? 'onbekend'}</strong></p>
      <button type="button" class="secundair breed" data-actie="uitloggen">Uitloggen</button>
    </div>`;
}

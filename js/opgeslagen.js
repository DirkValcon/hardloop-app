// Seintje dat er lokaal iets is bewaard, zodat de synchronisatie het naar je account stuurt.
export const OPGESLAGEN = 'hardloop-opgeslagen';

export function meldOpgeslagen(sleutel) {
  globalThis.dispatchEvent?.(new CustomEvent(OPGESLAGEN, { detail: sleutel }));
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

test('de service worker bewaart alle JavaScript-bestanden voor offline gebruik', async () => {
  const sw = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  const js = (await readdir(new URL('../js/', import.meta.url))).filter((f) => f.endsWith('.js'));
  for (const f of js) assert.ok(sw.includes(`'js/${f}'`), `sw.js mist js/${f}`);
});

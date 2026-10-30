// Browsertest story 13: gegevens van de telefoon staan na inloggen ook op de laptop, en terug.
import assert from 'node:assert/strict';
import { opzet, DIRK } from './helpers.js';

const tabel = {}; // het account, gedeeld door beide apparaten

// Telefoon: had al een profiel van vóór het inloggen; dat gaat mee naar het account.
const tel = await opzet({ profiel: DIRK, tabel });
const laptop = await opzet({ tabel });
try {
  await tel.page.goto(tel.url + '#vandaag');
  await tel.page.locator('nav.tabs').waitFor();
  await tel.page.waitForFunction(() => localStorage.getItem('hardloop-app.sync.v1'));
  assert.ok(tabel.profiel, 'profiel staat in het account');
  assert.deepEqual(JSON.parse(tabel.profiel.waarde).trainingsdagen, DIRK.trainingsdagen);

  // Training afvinken op de telefoon.
  await tel.page.goto(tel.url + '#schema');
  const trainingId = await tel.page.locator('[data-training]').first().getAttribute('data-training');
  await tel.page.goto(tel.url + '#afvinken/' + trainingId);
  await tel.page.getByRole('button', { name: 'Opslaan als gedaan' }).click();
  await tel.page.waitForFunction(() => {
    const m = JSON.parse(localStorage.getItem('hardloop-app.sync.v1') ?? '{}');
    return m.basis?.resultaten && m.basis.resultaten === localStorage.getItem('hardloop-app.resultaten.v1');
  });
  assert.ok(JSON.parse(tabel.resultaten.waarde)[trainingId], 'afgevinkte training staat in het account');

  // Laptop: leeg apparaat, na inloggen meteen het schema in plaats van de onboarding.
  await laptop.page.goto(laptop.url);
  await laptop.page.locator('nav.tabs').waitFor();
  assert.deepEqual(JSON.parse(await laptop.page.evaluate(() => localStorage.getItem('hardloop-app.profiel.v1'))).gewicht, DIRK.gewicht);
  assert.ok(JSON.parse(await laptop.page.evaluate(() => localStorage.getItem('hardloop-app.resultaten.v1')))[trainingId]);
  await laptop.page.goto(laptop.url + '#voortgang');
  await laptop.shot('story13-laptop-voortgang');

  // Laptop maakt het afvinken ongedaan; de telefoon ziet dat na terugkomen in de app.
  await laptop.page.evaluate((id) => {
    const r = JSON.parse(localStorage.getItem('hardloop-app.resultaten.v1'));
    delete r[id];
    localStorage.setItem('hardloop-app.resultaten.v1', JSON.stringify(r));
    dispatchEvent(new CustomEvent('hardloop-opgeslagen', { detail: 'hardloop-app.resultaten.v1' }));
  }, trainingId);
  await laptop.page.waitForFunction((id) => !JSON.parse(localStorage.getItem('hardloop-app.sync.v1')).basis.resultaten.includes(id), trainingId);
  assert.equal(JSON.parse(tabel.resultaten.waarde)[trainingId], undefined);
  await tel.page.goto(tel.url + '#vandaag');
  await tel.page.waitForFunction((id) => !(localStorage.getItem('hardloop-app.resultaten.v1') ?? '').includes(`"${id}"`), trainingId);

  // Uitloggen op de laptop wist alles daar; het account houdt alles.
  await laptop.page.evaluate(() => localStorage.setItem('test-uitgelogd', '1'));
  await laptop.page.goto(laptop.url + '#profiel');
  await laptop.page.getByRole('button', { name: 'Uitloggen' }).click();
  await laptop.page.getByRole('button', { name: 'Inloggen met Google' }).waitFor();
  const over = await laptop.page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('hardloop-app.')));
  assert.deepEqual(over, []);
  assert.ok(tabel.profiel && tabel.resultaten, 'account houdt de gegevens');

  assert.deepEqual([...tel.fouten, ...laptop.fouten], []);
  console.log('✓ story 13: telefoon en laptop delen profiel en afgevinkte trainingen; uitloggen wist het apparaat');
} finally {
  await tel.sluit();
  await laptop.sluit();
}

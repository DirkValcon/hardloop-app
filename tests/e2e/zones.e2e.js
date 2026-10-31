// Browsertest story 2: snelheden in km/u en haalbaarheid van de doeltijd.
import assert from 'node:assert/strict';
import { opzet, DIRK } from './helpers.js';

// Deel 1: overzicht met Dirks profiel.
{
  const { page, url, fouten, shot, sluit } = await opzet({ profiel: DIRK });
  try {
    await page.goto(url + '#profiel');
    const melding = page.locator('[data-test=haalbaarheid]');
    assert.equal(await melding.getAttribute('data-niveau'), 'ambitieus');
    assert.match(await melding.textContent(), /4% sneller dan je voorspelde 1:12:58/);
    const kmh = async (zone) => (await page.locator(`[data-zone=${zone}] td`).textContent()).replace(/\s+/g, ' ').trim();
    assert.match(await kmh('rustig'), /^6,9–7,3 km\/u 8:42–8:13 \/km$/);
    assert.match(await kmh('tempo10'), /^8,6 km\/u 6:59 \/km$/);
    assert.match(await kmh('tempo5'), /^8,9 km\/u/);
    assert.match(await kmh('warmup'), /^6,1–6,9 km\/u/);
    assert.match(await kmh('uitwandelen'), /^5,5 km\/u/);
    await shot('story2-zones');
    assert.deepEqual(fouten, []);
  } finally { await sluit(); }
}

// Deel 2: feedback op de doeltijd tijdens de onboarding.
{
  const { page, url, fouten, shot, sluit } = await opzet();
  try {
    await page.goto(url);
    await page.fill('#maxKm', '5');
    await page.fill('#tempo', '7:00');
    await page.getByRole('button', { name: 'Volgende' }).click();
    await page.getByText('10 km', { exact: true }).click();
    const feedback = page.locator('[data-test=haalbaarheid]');
    // Leeg = uitlopen, met de voorspelde tijd op je huidige niveau.
    assert.equal(await feedback.getAttribute('data-niveau'), 'uitlopen');
    assert.match(await feedback.textContent(), /10 km uitlopen.*1:12:58/);
    await page.fill('#doelTijd', '65:00');
    assert.equal(await feedback.getAttribute('data-niveau'), 'te-snel');
    await shot('story2-te-snel');
    await page.fill('#doelTijd', '75:00');
    assert.equal(await feedback.getAttribute('data-niveau'), 'haalbaar');
    await page.fill('#doelTijd', '70:00');
    assert.equal(await feedback.getAttribute('data-niveau'), 'ambitieus');
    assert.deepEqual(fouten, []);
    console.log('✓ story 2 snelheden: alle browserchecks geslaagd');
  } finally { await sluit(); }
}

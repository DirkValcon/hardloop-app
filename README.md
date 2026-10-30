# Loopschema

Eigen hardloop-app voor de iPhone (web-app op het beginscherm): van 5 naar 10 km in 11 weken, gemaakt voor de loopband.

Geen build-stap: gewone HTML, CSS en JavaScript-modules. Gegevens blijven op je telefoon (localStorage).

## Testen

```
npm test          # rekenlogica (node:test) + browsertests (Playwright, iPhone-formaat)
npm run serve     # lokaal bekijken op http://127.0.0.1:8080/
```

## User stories

| # | Story | Status |
|---|---|---|
| 1 | Onboarding: 5 km-tijd, doel, doeldatum, dagen, gewicht, helling | klaar |
| 2 | Snelheden in km/u en haalbaarheid doeltijd | klaar |
| 3 | Schema van 11 weken | klaar |
| 4 | Scherm Vandaag | klaar |
| 5 | Dagen verschuiven per week | klaar |
| 6 | Trainingsscherm loopband | klaar |
| 7 | Training afvinken + calorieën | klaar |
| 8 | Voortgang | |
| 9 | Instellingen wijzigen | |

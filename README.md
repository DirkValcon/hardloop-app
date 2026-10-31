# Loopschema

Eigen hardloop-app voor de iPhone (web-app op het beginscherm): van 5 naar 10 km in 11 weken, gemaakt voor de loopband.

Geen build-stap: gewone HTML, CSS en JavaScript-modules. Inloggen met Google via Supabase (`js/config.js`, bibliotheek in `vendor/supabase.js`).

## Op je iPhone zetten

1. Zet GitHub Pages aan: Settings → Pages → Source "Deploy from a branch", branch `main`, map `/ (root)`.
2. Open `https://<gebruikersnaam>.github.io/hardloop-app/` in Safari op je iPhone.
3. Tik op Deel → "Zet op beginscherm". De app opent dan schermvullend en werkt ook zonder internet.

Je gegevens staan alleen op je telefoon. Verwijder je de app van het beginscherm, dan zijn ze weg.

## Supabase eenmalig instellen

Voer `supabase/app_gegevens.sql` uit in de SQL Editor van je Supabase-project. Daarin staan je profiel, aanpassingen en afgevinkte trainingen; alleen jij kunt je eigen rijen lezen.

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
| 8 | Voortgang | klaar |
| 9 | Instellingen wijzigen | klaar |
| 12 | Inloggen met Google (verplicht) | klaar |
| 13 | Gegevens synchroniseren tussen apparaten | klaar |
| 14 | Nieuw schema voor 5 km, 10 km, halve of hele marathon | klaar |
| 15 | Nieuwe, vriendelijke stijl (licht en donker, kleur per trainingstype) | klaar |
| 18 | Loopscherm: Stop vasthouden, grote Pauze, blok overslaan ongedaan maken, alles in beeld | klaar |
| 16 | Vandaag: Start bovenaan, gemiste trainingen compact eronder | klaar |
| 17 | Vandaag: datum, weeknummer en weekstrook met gedaan/gemist/gepland | klaar |
| 19 | Afronden: eerst samenvatting, aanpassen achter een knop, Niet opslaan vraagt bevestiging | klaar |
| 20 | Ongedaan maken na overslaan, verplaatsen of afvinken | klaar |
| 21 | Schema: weken ingeklapt met samenvatting, Naar deze week, Week aanpassen | klaar |
| 22 | Profiel in delen: Mijn schema, Mijn snelheden, Instellingen, Account; elk apart wijzigen | klaar |

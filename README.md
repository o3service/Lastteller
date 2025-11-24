# LastTeller (prototype)

En enkel prototype for automatisk telling av lass basert på geofence-logikk.

## Idé

- Hvert kjøretøy har en status: INNE eller UTE i en definert sone.
- Et lass skal **kun** registreres når bilen:
  1. Har vært UTE
  2. Så går til INNE igjen

Altså: overgang **UTE → INNE = 1 lass**.

Ingen tidsbegrensning – kun posisjon/INN/UT.

## Teknisk prinsipp

I `app.js` finnes funksjonene:

- `onEnterZone(vehicleId)`
- `onExitZone(vehicleId)`

Disse simuleres nå via knapper i UI-et, men i en virkelig mobil-app vil de kobles til native geofence-events (Android/iOS).

State lagres i `localStorage` i nettleseren for enkel testing.

## Kjøre lokalt

1. Klon repoet
2. Åpne `index.html` i nettleseren

## Videre arbeid

- Lage ekte mobil-app (f.eks. Flutter, React Native eller Capacitor)
- Koble native geofence (enter/exit) til `onEnterZone`/`onExitZone`
- Lage backend (database) for å lagre lass sentralt
- Legge til brukerhåndtering (sjåfør, admin, osv.)

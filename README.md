# POTA Field Logger

A small offline-first personal POTA logger designed for iPhone/iPad.

## Included
- Automatic UTC clock and per-QSO UTC date/time
- GPS capture automatically when an activation is started (with a manual Get GPS button too)
- Offline Maidenhead locator calculation
- POTA park reference (default GB-3479)
- Personal QSO target (default 15) with 10-unique-QSO POTA minimum indicator per UTC day
- Callsign, optional name, band, mode, optional P2P park
- Possible duplicate warning for same callsign/band/mode on the same UTC day
- Qualification/target progress counts unique QSOs, not raw log entries
- Edit/delete QSOs
- Local on-device persistence
- ADIF export
- CSV export
- PWA manifest and service worker for offline use after first load

## Important
To install this as a web app on iPhone/iPad, it needs to be served over HTTPS (not opened as a local file).
After opening the HTTPS site in Safari: Share -> Add to Home Screen -> Open as Web App -> Add.

## POTA ADIF
The ADIF export includes:
STATION_CALLSIGN, CALL, QSO_DATE, TIME_ON, BAND, MODE,
MY_SIG=POTA, MY_SIG_INFO=<your park>, optional NAME,
optional MY_GRIDSQUARE, and optional SIG/SIG_INFO for P2P contacts.

## Data
Data stays in browser local storage on the device. Export ADIF/CSV after an activation as a backup.

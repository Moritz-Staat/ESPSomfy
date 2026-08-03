# ESPSomfy App

Mobile-App (Android, React Native/Expo) für [ESPSomfy-RTS](https://github.com/rstrouse/ESPSomfy-RTS)-Controller — steuert Somfy-RTS-Rollos über einen ESP32 im lokalen Netzwerk: Hoch / My / Runter, prozentgenaues Anfahren per Slider und Live-Status über WebSocket.

> **Hinweis:** Dies ist ein unabhängiges Client-Projekt. Es steht in keiner Verbindung zu [rstrouse/ESPSomfy-RTS](https://github.com/rstrouse/ESPSomfy-RTS) oder der Somfy SA. „Somfy" und „RTS" sind Marken der Somfy SA. An der Firmware wird nichts geändert — die App ist ein reiner Client.

## Screenshots

Die App folgt dem Systemthema; Hell und Dunkel teilen sich dieselben Markenfarben. Im hellen Modus füllt die Farbe des Rollos die Detailansicht, im dunklen bleibt sie Akzent auf dunklem Grund.

| Dashboard (hell) | Dashboard (dunkel) |
|---|---|
| <img src="docs/screenshots/dashboard-light.png" width="260" alt="Dashboard mit Rollos nach Räumen gruppiert, helles Thema"> | <img src="docs/screenshots/dashboard-dark.png" width="260" alt="Dashboard mit Rollos nach Räumen gruppiert, dunkles Thema"> |

| Detailansicht (hell) | Detailansicht (dunkel) | Verbinden |
|---|---|---|
| <img src="docs/screenshots/detail-light.png" width="200" alt="Detailansicht mit Positions-Slider, helles Thema"> | <img src="docs/screenshots/detail-dark.png" width="200" alt="Detailansicht mit Positions-Slider, dunkles Thema"> | <img src="docs/screenshots/connect-light.png" width="200" alt="Verbindungs-Screen mit Eingabe der Controller-IP"> |

## Funktionen

- Verbindung zum Controller per IP-Adresse, Login für alle drei Sicherheitsmodi der Firmware (keine Sicherung, PIN, Benutzer/Passwort)
- Dashboard mit allen Rollos, nach Räumen gruppiert
- Hoch / My / Runter — „My" wechselt kontextabhängig zwischen Stopp (bei Fahrt) und Favoritenposition
- Positions-Slider für prozentgenaues Anfahren
- Live-Statusaktualisierung per WebSocket — auch wenn parallel die physische Fernbedienung benutzt wird
- Automatischer Reconnect mit Backoff, Polling-Fallback, Socket wird im App-Hintergrund geschlossen (Firmware erlaubt max. 5 Socket-Clients)
- Heller und dunkler Modus, folgt der Systemeinstellung oder wird fest gewählt

**Bewusst nicht in der App:** Pairing, Fernbedienungs-Verwaltung, Repeater, Radio-/Frequenzeinstellungen, Firmware-Updates, Netzwerkkonfiguration. Ein falscher Rolling Code oder eine falsche Frequenz trennt die Motoren — solche Eingriffe gehören ins Web-UI der Firmware.

## Voraussetzungen

- ESP32 mit [ESPSomfy-RTS-Firmware](https://github.com/rstrouse/ESPSomfy-RTS) (getestet gegen v2.4.6), eingerichtet und mit mindestens einem gepairten Rollo
- App und Controller im selben Netzwerk (LAN/WLAN)
- Android-Gerät (nur Android getestet)

## Installation

**APK aus den Releases:** Fertige APK unter [Releases](../../releases) herunterladen und installieren (Installation aus unbekannten Quellen muss erlaubt sein).

**Selbst bauen:**

```bash
npm install --legacy-peer-deps
npx eas-cli build --platform android --profile preview
```

Erfordert ein (kostenloses) Expo-Konto; das Profil `preview` erzeugt eine installierbare APK.

## Sicherheitshinweis

Die Verbindung zum Controller läuft über **unverschlüsseltes HTTP im lokalen Netzwerk** — so stellt die Firmware ihre API bereit. Für Zugriff von unterwegs ein **VPN ins Heimnetz** nutzen (z. B. WireGuard). **Kein Port-Forwarding** auf den Controller einrichten: Der Weg würde API und Rollosteuerung ungeschützt ins Internet stellen.

## Architektur

Der ESP32 bietet drei Schnittstellen:

| Port | Zweck |
|---|---|
| 80 | Voller Web-/Config-Server (nicht von der App genutzt) |
| 8081 | Reduzierter API-Server — primäre HTTP-Quelle der App |
| 8080 | WebSocket für Live-Status (proprietäres Frameformat `42[event,{...}]`) |

```
app/                 Expo-Router-Screens
src/api/             HTTP-Client, Endpunkt-Wrapper, Auth
src/socket/          WebSocket-Client + Frame-Parser
src/store/           zustand-Slices (Shades, Groups, Rooms, Device, Connection)
src/models/          Typen + Enum-Mappings (gegen echtes Gerät validiert)
src/components/      UI-Komponenten
src/theme/           Design-Tokens
mock-server/         Node-Mock für Entwicklung ohne Hardware
docs/api-samples/    API-Antworten des Geräts (Firmware v2.4.6, anonymisiert)
docs/api-notes.md    Verifizierte Abweichungen Firmware-Doku ↔ echtes Gerät
docs/API-CLIENT-NOTES.en.md  Dieselben Befunde auf Englisch, für andere Client-Entwickler
```

Zentrale Eigenheiten der Firmware (Details in [docs/api-notes.md](docs/api-notes.md), englische Fassung mit Quellenangaben in [docs/API-CLIENT-NOTES.en.md](docs/API-CLIENT-NOTES.en.md)):

- Die WebSocket-Frames sind **kein gültiges JSON** (Event-Name ohne Anführungszeichen) — eigener Parser statt socket.io.
- Der API-Token ist an die **Client-IP gebunden** → Auto-Relogin bei 401/403.
- Max. **5 gleichzeitige Socket-Clients** → Socket wird im App-Hintergrund geschlossen.
- Positionswerte sind von der Firmware **bereits transformiert** (`flipPosition`) — die App spiegelt nie erneut.

## Entwicklung

**Stack:** React Native + Expo (SDK 57), TypeScript strict, Expo Router, zustand

```bash
npm install --legacy-peer-deps
npm start            # Expo Dev Server
npm run mock         # Mock-Server (HTTP + WebSocket) ohne Hardware
npm test             # Jest (34 Tests, u. a. Parser gegen echten Socket-Mitschnitt)
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
```

Die Planung läuft über GitHub Milestones und Issues; Änderungen laufen über Feature-Branches und PRs gegen `main`, referenziert auf ihr Issue (`Closes #n`).

## Lizenz

[MIT](LICENSE)

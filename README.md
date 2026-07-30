# ESPSomfy App

Native Mobile-App (iOS + Android) für [ESPSomfy-RTS](https://github.com/rstrouse/ESPSomfy-RTS) — steuert Somfy-RTS-Rollos über einen ESP32-Controller im lokalen Netzwerk. Die App ist ein reiner Client; an der Firmware wird nichts geändert.

**Stack:** React Native + Expo (SDK 57), TypeScript strict, Expo Router, zustand

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
docs/api-samples/    Echte API-Antworten des Geräts (Firmware v2.4.6)
docs/api-notes.md    Verifizierte Abweichungen Firmware-Doku ↔ echtes Gerät
```

Zentrale Eigenheiten der Firmware (Details in [docs/api-notes.md](docs/api-notes.md)):

- Die WebSocket-Frames sind **kein gültiges JSON** (Event-Name ohne Anführungszeichen) — eigener Parser statt socket.io.
- Der API-Token ist an die **Client-IP gebunden** → Auto-Relogin bei 401/403.
- Max. **5 gleichzeitige Socket-Clients** → Socket wird im App-Hintergrund geschlossen.
- Positionswerte sind von der Firmware **bereits transformiert** (`flipPosition`) — die App spiegelt nie erneut.

## Entwicklung

```bash
npm install --legacy-peer-deps
npm start            # Expo Dev Server
npm run mock         # Mock-Server (HTTP + WebSocket) ohne Hardware
npm test             # Jest
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
```

## Projektorganisation

Die Planung läuft über **GitHub Milestones und Issues** (gespiegelt aus Vikunja, Projekt „ESPSomfy RTS · Handy-App"):

- **Milestones P0–P7:** Fundament → Datenschicht → UI-Gerüst → Steuerung → Verwaltung → Integration → Qualität/Release → Remote/Backlog
- **Issues:** eine Aufgabe pro Issue (`P<Phase>.<Nr> – Titel`), dem jeweiligen Milestone zugeordnet
- **Pull Requests:** Änderungen laufen künftig über Feature-Branches und PRs gegen `main`, referenziert auf ihr Issue (`Closes #n`)

### Stand

- ✅ P0.1 — API-Verhalten am echten Gerät verifiziert (Samples + 60-s-Socket-Mitschnitt in `docs/`)
- ✅ P0.3 — Projektstruktur, TS strict, ESLint/Prettier/Jest
- ✅ P1.1 — Datenmodell in `src/models/`, gegen echte Antworten validiert
- 🔶 P0.2 — Expo-Projekt steht; EAS-Konfiguration offen
- Alles Weitere: siehe [offene Issues](../../issues)

## Scope-Grenzen

Bewusst **nicht** in der App: Pairing, Fernbedienungs-Verwaltung, Repeater, Radio/Frequenzscan, Firmware-Updates, Netzwerkkonfiguration. Ein falscher Rolling Code oder eine falsche Frequenz trennt die Motoren — solche Eingriffe gehören ins Web-UI der Firmware.

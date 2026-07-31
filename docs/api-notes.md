# API-Notizen (verifiziert gegen echtes Gerät)

Aufgenommen am 2026-07-31 gegen `192.168.178.99`.

> **Hinweis:** Die Samples in `api-samples/` sind anonymisiert — `apiKey` (login.json), `ssid` (socket-frames.txt), `serverId` (discovery.json) sowie `startingAddress`, alle `remoteAddress`-Werte und `lastRollingCode` wurden durch Platzhalter ersetzt (Feldtypen unverändert). Die Feldstruktur und alle Formate (64-Zeichen-Hex-Token, Frameformat) entsprechen unverändert den echten Geräteantworten.

## Gerät

- **Firmware:** v2.4.6 (`latest` ebenfalls v2.4.6, kein Update offen)
- **serverId:** 6-stellige Hex-Kennung (im Sample anonymisiert), Modell ESPSomfyRTS, Hostname ESPSomfyRTS, Verbindung: Wifi
- **authType:** `0` (SecurityType.None) — wie erwartet
- **permissions:** `0`
- `POST /login` mit `{}` liefert wie erwartet `{"type":0,"apiKey":"...","msg":"Success","success":true}` — 64-Zeichen-Hex-Token auch ohne Sicherung

## Bestand

- 2 Rollos (`Wohnzimmer` id 1, `schlafzimmer` id 2), beide `shadeType: 0` (roller), `tiltType: 0` (none)
- Keine Räume, keine Gruppen (`/rooms` und `/groups` liefern `[]`) — `roomId: 0` bedeutet „kein Raum"
- Controller-Limits bestätigt: 32 Rollos, 16 Gruppen, 16 Räume, 32 Rollos/Gruppe, **7 Linked Remotes** (`maxLinkedRemotes`)

## Abweichungen von der Spezifikation im Auftrag

1. **`myPos` / `myTiltPos` sind `-1`, nicht `255`**, wenn kein Favorit gesetzt ist — sowohl in REST-Antworten als auch in Socket-`shadeState`-Frames.
   → Die App behandelt **jeden Wert außerhalb 0–100** als „kein Favorit" (`myPos < 0 || myPos > 100`). Typ bleibt `number`.
2. **REST und Socket benennen den Rollo-Typ unterschiedlich:**
   - REST (`/shades`, `/discovery`, `/controller`): Feld heißt **`shadeType`**
   - Socket-`shadeState`-Event: Feld heißt **`type`**
   → Das Modell normalisiert beim Merge (`type` → `shadeType`).
3. **Tilt-Felder in REST-Antworten immer vorhanden**, auch bei `tiltType: 0` (`tiltPosition`, `tiltDirection`, `tiltTarget`, `myTiltPos`, `tiltTime`, `stepSize`).
   Im Socket-`shadeState` fehlen sie bei `tiltType: 0` dagegen wie im Auftrag beschrieben (im Mitschnitt bestätigt).
   → Typen optional, Store-Merge darf sie nie auf `undefined` zurücksetzen.
4. **`/shades` liefert deutlich mehr Felder** als die Minimalliste im Auftrag:
   `roomId`, `upTime`, `downTime`, `paired`, `lastRollingCode`, `tiltTime`, `stepSize`, `bitLength`, `proto`, `inGroup`, `repeats`, `gpioUp`, `gpioDown`, `gpioMy`, `gpioLLTrigger`, `simMy`, `linkedRemotes[]`.
   → Ins Interface aufgenommen (als optionale Felder), da sie in jeder echten REST-Antwort stecken, im Socket-Event aber fehlen.
5. **`/discovery` enthält zusätzlich** `serverId`, `version`, `latest`, `model`, `hostname`, `chipModel`, `connType`, `checkForUpdate`, `memory{max,free,min,total}` neben `rooms`/`shades`/`groups`.
6. **`/controller` enthält zusätzlich** `startingAddress`, `transceiver.config` (Funkparameter), strukturiertes `version`-Objekt und `repeaters[]`.

## WebSocket (Mitschnitt: `api-samples/socket-frames.txt`, 60 s, Port 8080)

- Direkt nach dem Verbinden kommt der Klartext-String `Connected` (kein Frame) — bestätigt.
- Frameformat `42[event,{...}]` mit **unquotiertem** Event-Namen — bestätigt, kein gültiges JSON.
- Initial-Burst nach Connect: je ein `shadeState` pro Rollo, dann `fwStatus`, `wifiStrength`, `memStatus`.
- Danach kamen zwei `wifiStrength`-Frames (+1,7 s, +2,9 s) — und dann **57 Sekunden lang gar nichts** bis zum Ende des Mitschnitts.
  → Lange frame-lose Phasen sind im Leerlauf **normal**. Ein Watchdog „kein Daten-Frame in 60 s ⇒ Verbindung tot" würde gesunde Verbindungen abreißen.
  → Der Client nutzt stattdessen WebSocket-Protokoll-Pings (Pong-Antwort ist RFC-Pflicht) als Lebenszeichen; ausbleibende Pongs lösen den Reconnect aus.
- Keine Authentifizierung am Socket — bestätigt.

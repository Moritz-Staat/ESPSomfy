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

## Routenverteilung auf zwei Server (Quelle: `Web.cpp`, Firmware v2.4.6)

Nachgetragen am 2026-08-23 bei der Planung der Verwaltungsfunktionen.

Die Firmware betreibt zwei getrennte Webserver: `apiServer` auf **Port 8081** und `server` auf **Port 80** (`Web.cpp:41-42`). Sie bedienen **unterschiedliche Routen**.

Auf **8081** registriert (`Web.cpp:1066-1084`), mehr nicht:

`/discovery`, `/rooms`, `/shades`, `/groups`, `/login`, `/controller`, `/shadeCommand`, `/groupCommand`, `/tiltCommand`, `/repeatCommand`, `/room` (nur GET), `/shade` (nur GET), `/group` (nur GET), `/setPositions`, `/setSensor`, `/downloadFirmware`, `/backup`, `/reboot`

Sämtliche **Verwaltung läuft ausschließlich über Port 80**:

`/saveShade`, `/saveRoom`, `/saveGroup`, `/addShade`, `/addRoom`, `/addGroup`, `/deleteShade`, `/deleteRoom`, `/deleteGroup`, `/linkToGroup`, `/unlinkFromGroup`, `/shadeSortOrder`, `/roomSortOrder`, `/groupSortOrder`, `/setMyPosition`

→ Die App hält deshalb zwei `ApiClient`-Instanzen mit gemeinsamem `AuthManager`. `/login` gibt es auf beiden Ports, der Token ist portunabhängig (HMAC über Credentials und Client-IP).

> Vor dieser Erkenntnis zeigten `saveShade`, `saveRoom` und `saveGroup` auf `PUT /shade`, `/room` und `/group` auf Port 8081. Dort ist jeweils nur `HTTP_GET` gebunden — die Aufrufe konnten nie funktionieren.

## Eigenheiten der Verwaltungsrouten

1. **`/shadeSortOrder`, `/roomSortOrder`, `/groupSortOrder` erwarten ein nacktes JSON-Array** (`[3,1,2]`), kein Objekt. `sortOrder` wird in Array-Reihenfolge vergeben, beginnend bei 0. Übersprungen werden die Platzhalter-Ids (`roomId 0`, `shadeId 255`, `groupId 255`).
2. **Dieselben Routen antworten bei falscher HTTP-Methode mit HTTP 201** und `{"status":"ERROR","desc":"Invalid HTTP Method: "}` — ein Erfolgsstatus mit Fehlerinhalt. Der Client wertet deshalb bei jeder Antwort zusätzlich das `status`-Feld aus und wirft bei `ERROR` einen `ApiError`, unabhängig vom HTTP-Code.
3. **Die SortOrder-Handler rufen kein `save()` auf**, anders als `/saveRoom` und `/saveShade`. Die Reihenfolge steht damit zunächst nur im RAM. Ob sie einen Neustart übersteht, ist am Gerät zu prüfen.
4. **`/deleteShade` antwortet mit HTTP 400** (nicht 500), wenn das Rollo Mitglied einer Gruppe ist: `This shade is a member of a group and cannot be deleted.`
5. **`/linkToGroup` und `/unlinkFromGroup` behandeln `shadeId 0` als „nicht angegeben"** und lehnen mit HTTP 500 ab. Ein Rollo mit Id 0 lässt sich über diese Routen nicht zuordnen.
6. **`/addRoom` und `/addGroup` antworten mit dem angelegten Objekt**, inklusive der vergebenen Id. Bei Überschreitung von `SOMFY_MAX_ROOMS` beziehungsweise `SOMFY_MAX_GROUPS` kommt HTTP 500.
7. **`/setMyPosition`** nimmt `shadeId`, `pos` und `tilt` wahlweise als Query-Parameter oder im Rumpf. Für den Favoriten reicht jedoch `/setPositions` auf Port 8081 — die App nutzt den kürzeren Weg.

## Sicherung greift in v2.4.6 nicht

`Web::isAuthenticated()` ist deklariert (`Web.h:43`) und implementiert (`Web.cpp:79`), wird aber **an keiner einzigen Route aufgerufen**. Unabhängig von `authType` sind damit alle Routen ohne `apikey`-Header erreichbar.

Für die App ohne Folgen — sie schickt den Token weiterhin mit, und der Auto-Relogin bei 401/403 bleibt als Absicherung für künftige Firmware-Versionen bestehen. Beim Betrieb außerhalb des eigenen Netzes ist der Befund allerdings zu beachten: die Sicherung des Geräts ersetzt keinen Netzzugriffsschutz.

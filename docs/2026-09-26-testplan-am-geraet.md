# Testplan am Gerät — 26.09.2026

Nach dem Merge von [#68](https://github.com/Moritz-Staat/ESPSomfy/pull/68) (Fehlerbehandlung, Offline-Verhalten) und [#70](https://github.com/Moritz-Staat/ESPSomfy/pull/70) (Sammelaktionen, Szenen) steht in `main` Funktionalität, die **auf keiner Hardware gelaufen ist**. Typecheck, Lint und 205 Tests sind grün — das beweist, dass der Code tut, was er meint, nicht dass die Motoren fahren.

Dieses Dokument sagt, was am Gerät zu prüfen ist, in welcher Reihenfolge, und was sich hier **nicht** entscheiden lässt.

---

## 1. Ausgangslage (gemessen am 26.09.2026)

Abgefragt über `GET /discovery` und `GET /shades` auf `192.168.178.99`:

| | |
|---|---|
| Firmware | **v2.4.6** (`latest` ebenfalls v2.4.6 — das Gerät läuft auf Upstream, nicht auf dem Fork) |
| `authType` | 0 (keine Sicherung) |
| Freier Heap | 157.440 von 260.124 B |
| Rollos | **zwei**: `1 Wohnzimmer` (Position 50), `2 schlafzimmer` (Position 0) |
| Typ beider Rollos | `shadeType 0` (roller), `tiltType 0` (keine Lamellenachse) |
| `repeats` | **3** auf beiden — der Fix vom 24.08. sitzt |
| `myPos` | **-1 auf beiden**, es ist also kein Favorit gesetzt |
| Räume | **keine** |
| Gruppen | **keine** |

Drei Folgerungen, die den Plan bestimmen:

1. **Ohne Gruppe bleibt der interessanteste Teil von `planBulk` toter Code.** Die Gruppenoptimierung ist der Kern von #26 und wird bei zwei gruppenlosen Rollos nie betreten. Sie braucht eine angelegte Gruppe (Schritt 2).
2. **Ohne Raum gibt es keine Raum-Sammelaktion.** Beide Rollos landen in der Sektion „Ohne Raum"; die globale Leiste erscheint, die Raum-Leiste nur dort.
3. **Ohne Favorit lässt sich die Stopp-Absicherung nicht scharf prüfen.** Der Schutz aus #70 greift genau dann, wenn ein stehender Motor auf `My` zur Favoritenposition fährt. Ohne programmierten Favoriten tut `My` im Stillstand nichts — das Gerät ist zufällig der harmlose Fall (Schritt 6).

---

## 2. Vorbereitung

1. **APK aus `main` bauen** (`eas build --profile preview --platform android`) und installieren. Stand: `2c64f30`.
   Die EAS-Queue im Free Tier kann lange stehen — nicht neu anstoßen, ein zweiter Job reiht sich nur dahinter ein.
2. **Zwei Räume anlegen** und je ein Rollo zuordnen (Verwalten → Räume). Damit erscheinen Raum-Sektionen und deren Sammelaktionen.
3. **Eine Gruppe mit beiden Rollos anlegen** (Verwalten → Gruppen). Das ist die Voraussetzung für Test B.3.
4. **Vorher-Zustand notieren:** `curl -s http://192.168.178.99:8081/shades > vorher.json`. Am Ende dagegen vergleichen, damit keine Testartefakte (Favoriten, Sortierung, Gruppen) unbemerkt liegen bleiben.

---

## 3. Test A — Fehlerbehandlung und Offline-Verhalten (#15)

Das Issue ist mit #68 geschlossen, die Abnahme verlangt aber, jeden Fall einmal provoziert zu haben. Erwartet wird **überall eine verständliche Meldung statt eines Stacktrace oder Schweigens**.

| # | Fall | So provozieren | Erwartet |
|---|---|---|---|
| A.1 | Nicht im Heimnetz | WLAN am Handy aus, Mobilfunk an | Statusleiste „Offline · Letzter Stand vor … Min.", alle Knöpfe und beide Slider ausgegraut und nicht bedienbar |
| A.2 | Gerät antwortet nicht | ESP vom Strom trennen, App offen lassen | erst `polling` mit Altersangabe, dann `offline`; letzter Stand bleibt sichtbar |
| A.3 | Altersangabe läuft mit | im Offline-Zustand zwei Minuten warten | „vor 1 Min." → „vor 2 Min.", ohne Zutun |
| A.4 | Altersangabe nach Neustart | App im Offline-Zustand schließen, eine Stunde später öffnen | „Letzter Stand vor 1 Std." — der Wert ist persistiert |
| A.5 | Befehl scheitert | ESP trennen, **bevor** die App es merkt, dann Hoch drücken | Karte springt nach 3 s zurück **und** ein roter Toast erklärt, warum |
| A.6 | Firmware-Fehler im Rumpf | Rollo löschen versuchen, das in der Gruppe aus Schritt 2.3 steckt | Meldung „Dieses Rollo gehört zu einer Gruppe …" (aus `describeError`) |
| A.7 | Socket weg, REST lebt | Port 8080 blocken oder fünf Socket-Clients belegen | Leiste zeigt `polling`, **Steuerung bleibt bedienbar** — das ist Absicht |
| A.8 | Stiller Relogin | IP des ESP im Router wechseln | kein Dialog, App arbeitet weiter |

**A.7 ist der Fall, der am leichtesten falsch umgesetzt wäre.** Wenn die Knöpfe dort gesperrt sind, ist die Unterscheidung `offline`/`polling` kaputt.

Nicht prüfbar: „Falscher PIN" und „Token abgelaufen" als Dialog — `authType` ist 0 und `isAuthenticated()` wird in v2.4.6 an keiner Route aufgerufen (siehe `api-notes.md`).

---

## 4. Test B — Sammelaktionen und Szenen (#26)

| # | Prüfung | Erwartet |
|---|---|---|
| B.1 | „Alle hoch" global | beide Rollos fahren, Toast „2 Rollos — Befehl raus." |
| B.2 | Raum-Sammelaktion | nur das Rollo des jeweiligen Raums fährt |
| B.3 | **Gruppenoptimierung** | mit der Gruppe aus Schritt 2.3: „Alle hoch" sendet **einen** Gruppenbefehl statt zwei Einzelbefehle, Toast nennt „über 1 Befehl" |
| B.4 | Gruppe greift zu weit | ein Rollo aus der Gruppe einem Raum zuordnen, dann die **Raum**-Sammelaktion drücken | die Gruppe darf **nicht** benutzt werden, das zweite Rollo bleibt stehen |
| B.5 | Szene aufnehmen | Rollos auf 30 % und 70 % fahren, „Aktuelle Positionen speichern" | Szene mit zwei Einträgen |
| B.6 | Szene starten | Rollos verfahren, Szene starten | beide fahren auf die gespeicherten Werte |
| B.7 | Szene doppelt starten | direkt nochmal starten | „steht schon", **kein** Funkverkehr |
| B.8 | Szene nach Löschen | ein Rollo löschen, Szene starten | Eintrag fällt weg, Karte zeigt „1 nicht mehr vorhanden" |
| B.9 | Rückfrage | — | bei zwei Rollos **nicht** prüfbar, die Schwelle liegt bei elf |

**B.4 ist der wichtigste Test dieses Blocks.** Er prüft die Regel, dass eine Gruppe nur genutzt wird, wenn alle ihre Mitglieder zur Auswahl gehören. Schlägt er fehl, bewegt „alle im Wohnzimmer" Rollos in anderen Räumen — der Fehler, den `planBulk` verhindern soll.

---

## 5. Test C — Sende-Intervall messen

`BULK_INTERVAL_MS` steht in `src/store/bulk.ts` auf **400 ms** und ist **geraten, nicht gemessen**. Die 150–200 ms aus #26 stammen aus der Zeit vor dem `repeats`-Befund; seit `repeats: 3` sendet die Firmware je Befehl den Wake-up-Puls plus vier Frames statt einem, die Luftzeit ist also grob verdreifacht. `MAX_TX_BUFFER` ist 5.

**Die App kann das auf diesem Gerät nicht messen** — sie setzt bei zwei Rollos höchstens zwei Befehle ab und füllt keinen Puffer von fünf. Gemessen wird deshalb direkt gegen die Firmware.

### Messaufbau

Rollo 1 vorher ganz nach oben fahren, dann wiederholt `Up` senden: jeder Aufruf erzeugt Funkverkehr, bewegt aber nichts mehr. So lässt sich der Sendepuffer belasten, ohne die Motoren zu quälen.

```bash
# N Befehle mit festem Abstand, Abstand in ms als $1
for i in $(seq 1 8); do
  curl -s -o /dev/null -w "%{http_code} " -X PUT \
    http://192.168.178.99:8081/shadeCommand \
    -H 'Content-Type: application/json' \
    -d '{"shadeId":1,"command":"Up"}'
  sleep "$(echo "scale=3; $1/1000" | bc)"
done; echo
```

Parallel die serielle Ausgabe des ESP mitlesen — die Firmware meldet dort den Sendevorgang. Verloren gegangene Befehle zeigen sich als fehlende Zeilen oder als Puffermeldung, **nicht** als HTTP-Fehler: Die Route quittiert mit 200, sobald der Befehl in der Warteschlange liegt.

### Ablauf

1. Mit **500 ms** beginnen, acht Befehle, Ergebnis notieren.
2. In Schritten von 50 ms heruntergehen: 450, 400, 350, 300, 250, 200, 150.
3. Je Stufe **drei Läufe**. Ein Lauf gilt nur, wenn alle acht Befehle quittiert wurden und die serielle Ausgabe acht Sendevorgänge zeigt.
4. **Ungültige Läufe neu fahren, nicht hochrechnen.** Wird ein Lauf durch etwas anderes gestört — Funkstörung, WLAN-Aussetzer, versehentlich parallel laufende App — zählt er nicht und wird wiederholt.
5. Die kleinste Stufe, bei der **alle drei Läufe** verlustfrei sind, ist der Messwert. In `BULK_INTERVAL_MS` kommt dieser Wert **plus eine Stufe Sicherheitsabstand**, mit Messdatum im Kommentar.

### Was diese Messung nicht hergibt

Acht Befehle an **ein** Rollo sind nicht dasselbe wie 32 Befehle an 32 Rollos: Dort kommen die Rollingcode-Verwaltung und mehr Konfigurationsschreibvorgänge hinzu. Die Abnahme aus #26 („Alle runter bei 32 Rollos, kein Befehl geht verloren") ist an dieser Anlage **nicht** erfüllbar. Das Intervall bleibt deshalb bewusst konservativ; wer eine große Installation hat, muss nachmessen. Diese Einschränkung gehört in den Kommentar an der Konstante, damit der Wert später nicht für belastbarer gehalten wird, als er ist.

---

## 6. Test D — `Stop` geht als `My` auf die Funkstrecke

Der Befund aus `api-notes.md`: `encode80BitFrame` schreibt bei `repeat == 0` die Befehlsnibble von `Stop` auf `My` um (`Somfy.cpp:290`). Auf dem Motor heißt `My` im Stillstand „fahre zur Favoritenposition". #70 filtert „Alle stopp" deshalb über `isMoving`.

| # | Prüfung | Erwartet |
|---|---|---|
| D.1 | „Alle stopp" im Stillstand | Toast „Kein Rollo fährt gerade.", **kein** Funkverkehr |
| D.2 | „Alle stopp" während der Fahrt | beide Rollos halten an |
| D.3 | Gegenprobe zum Befund | Favorit auf 50 % setzen, Rollo auf 0 % fahren, dann **direkt über die API** `{"shadeId":1,"command":"Stop"}` senden | der Motor fährt auf 50 % — damit ist belegt, warum D.1 nötig ist |

**D.3 ist der eigentliche Beweis** und der Grund, warum diese Prüfung im Plan steht: Ohne sie ist die Filterung in #70 eine Behauptung aus dem Quelltext. Weil auf dem Gerät derzeit kein Favorit gesetzt ist (`myPos -1`), muss für D.3 einer programmiert werden — und danach wieder gelöscht, indem dieselbe Position erneut über `/setMyPosition` gesendet wird (es gibt keinen eigenen Löschbefehl, siehe `api-notes.md`).

---

## 7. Test E — Sortierreihenfolge (#67)

Das Gerät läuft auf **v2.4.6**, der Fix liegt im Fork (`Moritz-Staat/ESPSomfy-RTS@10ed616`, noch ohne Release). Damit ist beides prüfbar: das Fehlverhalten jetzt und der Fix danach.

### E.1 — Fehlverhalten belegen (jetzt, v2.4.6)

1. In der App die Reihenfolge der beiden Rollos tauschen.
2. **Ohne weitere Änderung** den ESP neu starten (`PUT /reboot`).
3. Erwartet: die Reihenfolge ist **weg**.

### E.2 — Gegenprobe zur sporadischen Wirkung

1. Reihenfolge tauschen.
2. Danach irgendetwas anderes speichern — ein Rollo umbenennen genügt.
3. Neu starten. Erwartet: die Reihenfolge **steht**, weil `commit()` die ganze Konfiguration schreibt.

E.2 ist der Grund, warum der Fehler bisher nicht aufgefallen ist. Wer nach dem Sortieren noch etwas anderes ändert, merkt nie etwas.

### E.3 — Nach dem Flashen (v2.4.10)

Vorher im Fork: `FW_VERSION` in `ConfigSettings.h` auf `v2.4.10` ziehen (Tag muss zur Version passen, `GitOTA` baut die Download-URL daraus; `appver_t.name` ist `char[15]`), Release bauen, **die Zeile `Sketch uses …` im Release-Log lesen** — bei rund 11 KB freiem Flash ist das Pflicht, und der Release-Build ist die maßgebliche Zahl, nicht der CI-Build.

Danach E.1 wiederholen. Erwartet: die Reihenfolge steht auch ohne zweite Änderung.

**Erst am eigenen Gerät, nicht am ausgelieferten.** Ein Release zieht per OTA auch auf das zweite Gerät.

---

## 8. Abschluss

1. `curl -s http://192.168.178.99:8081/shades > nachher.json` und gegen `vorher.json` vergleichen. Testartefakte aufräumen: Favorit aus D.3, Testräume, Testgruppe, Testszenen.
2. Ergebnisse in [#67](https://github.com/Moritz-Staat/ESPSomfy/issues/67) (Test E) und als Kommentar an #15 und #26 (Tests A, B, D) festhalten — die Issues sind geschlossen, aber die Abnahme fehlt noch.
3. Gemessenes Intervall in `src/store/bulk.ts` eintragen, mit Datum und der Einschränkung aus Abschnitt 5.

## Reihenfolge

**E.1 und E.2 zuerst** — sie brauchen nur die alte Firmware und sind in zehn Minuten erledigt, solange v2.4.6 noch läuft. Dann A, dann die Vorbereitung für B (Räume, Gruppe), dann B und D. C zuletzt, weil die Messung Zeit und Ruhe braucht. E.3 nach dem Release.

## Was danach offen bleibt

- Die Abnahme „32 Rollos" aus #26 — nicht an dieser Anlage entscheidbar.
- `#34` Barrierefreiheit: Screenreader-Durchlauf mit TalkBack, Dynamic Type bei 200 %. `accessibilityState` und `accessibilityValue` sind mit #68/#70 gesetzt, geprüft ist nichts davon.
- `#13`/`#17` mDNS und Onboarding — brauchen `react-native-zeroconf` als Config-Plugin und damit einen neuen Dev-Build.

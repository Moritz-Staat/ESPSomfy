# ESPSomfy RTS — Notes for Client Developers

Field notes gathered while building a third-party client against **firmware v2.4.6**.
Every statement below was verified against a running device and cross-checked with the
firmware source. Line references point at the `ESPSomfy-RTS` repository.

This document is deliberately implementation-neutral — it describes the device, not any
particular client.

---

## Interfaces

| Port | Purpose |
|---|---|
| 80 | Full web and configuration server |
| 8081 | Reduced API server (`apiServer` in `Web.cpp`) |
| 8080 | WebSocket, and the mDNS service `_espsomfy_rts._tcp` |

Endpoints available on 8081: `/discovery`, `/rooms`, `/shades`, `/groups`, `/login`,
`/controller`, `/shadeCommand`, `/groupCommand`, `/tiltCommand`, `/repeatCommand`,
`/room`, `/shade`, `/group`, `/setPositions`, `/setSensor`, `/downloadFirmware`,
`/backup`, `/reboot`.

`GET /discovery` is the most efficient entry point: it returns device info plus the
complete `rooms`, `shades` and `groups` arrays in a single request — useful given the
ESP32's limited heap.

**Every configuration route lives on port 80 only** — see section 10. A client that talks
to 8081 alone can read and drive shades, but cannot create, rename, delete or reorder
anything.

---

## 1. WebSocket frames are not valid JSON

`WResp.cpp::beginEvent` builds frames as:

```c
snprintf(this->buff, buffSize, "42[%s,", evt);
```

The event name is emitted **without quotes**, so a frame looks like:

```
42[shadeState,{"shadeId":1,"position":45,...}]
```

This resembles Socket.IO but is neither valid Socket.IO nor parseable as JSON. A
Socket.IO client will not work. The parsing approach used by the bundled web UI
(`data/index.js`, around line 472) is the reference:

```js
if (!data.startsWith('42')) return;
const ndx  = data.indexOf(',');
const evt  = data.substring(3, ndx);
const body = data.substring(ndx + 1, data.length - 1);
const msg  = JSON.parse(body);
```

Additional details:

- On connect the server first sends the plain string `Connected` — not a frame.
- Clients may send `join:0` / `leave:0` to subscribe to the `remoteFrame` stream
  (raw RTS frames). Clients that do not need radio diagnostics should not join.
- The socket has **no authentication**. No token is required or accepted.
- `ws://` only.

---

## 2. The API token is bound to the client IP

`Web::createAPIToken(const IPAddress ipAddress, char *token)` derives the token from the
credentials **plus the requesting IP address**. Consequences for clients:

- A token becomes invalid when the client's IP changes — Wi-Fi to cellular, a new DHCP
  lease, roaming between access points. Clients should treat 401/403 as "re-login
  silently and retry" rather than as a user-facing error.
- Placing a reverse proxy in front of the device breaks this model, since the device only
  ever sees the proxy's address.

The response header `apikey` carries a refreshed token on authenticated requests; clients
should read and store it.

---

## 3. "No favourite position" is reported as `-1`

`myPos` is stored internally as a `float`, initialised to `-1.0f`. It is serialised
through:

```c
int8_t SomfyShade::transformPosition(float fpos) {
  if (fpos < 0) return -1;
  ...
}
```

So both REST responses and `shadeState` frames report **`-1`**, not `255`, when no
favourite is set. The same applies to `myTiltPos`. Treating any value outside 0–100 as
"unset" is the robust check.

For contrast: `currentPos`, `target` and `currentTiltPos` are initialised to `0.0f` and
are never set negative, so `position` and `target` cannot be `-1`.

---

## 4. REST and WebSocket name the shade type differently

- REST (`/shades`, `/discovery`, `/controller`) uses **`shadeType`**
- The `shadeState` socket event uses **`type`**

Both carry the same enum value. Clients merging the two sources need to normalise.

---

## 5. Tilt fields appear conditionally on the socket, always on REST

`SomfyShade::emitState` only includes `tiltDirection`, `tiltTarget`, `tiltPosition` and
`myTiltPos` when `tiltType != none`. REST responses include them unconditionally, even
for `tiltType: 0`.

A client merging socket events into a cached REST snapshot must not reset those fields to
undefined when they are absent from an event.

---

## 6. Positions are already transformed

`transformPosition()` applies the `flipPosition` flag before serialisation, and
`flipCommands` is likewise handled inside the firmware. Values reaching the client are
final. Clients applying the flags a second time will produce shades that appear to move
in the wrong direction — a bug that only manifests on devices where the flags are set.

---

## 7. Long silent periods on the socket are normal

A 60-second capture on an idle device produced an initial burst (one `shadeState` per
shade, then `fwStatus`, `wifiStrength`, `memStatus`), two further `wifiStrength` frames
within the first three seconds, and then **57 seconds of silence**.

A watchdog along the lines of "no frame for 60 s means the connection is dead" will tear
down healthy connections. The server does run a heartbeat — `Sockets.cpp` line 80:

```c
sockServer.enableHeartbeat(20000, 10000, 3);
```

Protocol-level pings every 20 s, 10 s pong timeout, disconnect after 3 failures. Clients
whose runtime does not expose ping/pong (React Native, for example) can send an
unrecognised text frame instead — `SocketEmitter::wsEvent` logs and ignores anything that
is not `join:` or `leave:`.

---

## 8. Concurrency limits

`Sockets.h` defines `room_t.clients[5]` — a maximum of **five concurrent socket clients**.
The bundled web UI, a Home Assistant integration and any additional clients share those
slots. Mobile clients should close the socket when backgrounded rather than holding a slot
indefinitely.

Similarly, the HTTP server is single-threaded per request; clients benefit from limiting
themselves to about two concurrent requests.

---

## 9. Error responses use HTTP 500

Application-level errors are returned as:

```json
{"status":"ERROR","desc":"..."}
```

with status code **500**, not 4xx. Clients should parse `desc` for a usable message.

---

## 10. Configuration routes exist on port 80 only

The firmware runs two independent web servers (`Web.cpp:41-42`) with **different route
tables**. Port 8081 carries reading, commands, `/setPositions`, `/setSensor`, `/backup`
and `/reboot` (`Web.cpp:1066-1084`). Everything else is registered on port 80 only:

`/saveShade`, `/saveRoom`, `/saveGroup`, `/addShade`, `/addRoom`, `/addGroup`,
`/deleteShade`, `/deleteRoom`, `/deleteGroup`, `/linkToGroup`, `/unlinkFromGroup`,
`/shadeSortOrder`, `/roomSortOrder`, `/groupSortOrder`, `/setMyPosition`, `/restore`

`/shade`, `/room` and `/group` exist on 8081 but are bound to `HTTP_GET` only — a `PUT`
there reaches nothing. `/login` exists on both ports and the token is port-independent
(it is an HMAC over credentials and client IP), so one token serves both clients.

Further details worth knowing:

- The three `*SortOrder` routes expect a **bare JSON array**, not an object, and assign
  `sortOrder` by array position across the **entire** list submitted. Sending a subset
  (say, the shades of one room) renumbers everything else.
- Their handlers set `sortOrder` in RAM without calling `save()` — persistence across a
  device restart should be verified rather than assumed.
- `deleteShade` answers **400** if the shade belongs to a group; that is the one route
  that does not use 500 (see section 9).
- `deleteRoom` clears `roomId` on affected shades **and groups** (`Somfy.cpp:4052`), so
  groups carry a `roomId` too.
- `linkToGroup` sends **no** Prog frame — `SomfyGroup::linkShade` only records the
  membership. Pairing the motor to the group address is a separate, manual step.
- `/groupOptions` returns the shades **not yet** linked to the group, not the shades that
  could be linked.
- Names are `char[21]`, i.e. **20 usable characters**, for shades, rooms and groups alike.

---

## 11. Some errors arrive with a 2xx status

Section 9 covers the usual case. Two routes break it: `/reboot` and the three
`*SortOrder` routes answer a wrong HTTP method with **HTTP 201** and
`{"status":"ERROR","desc":"Invalid HTTP Method: "}` (`Web.cpp:1055`). A client that keys
success off the status code alone will treat a rejected request as a success.

→ Inspect `status` in the body of **every** response, not just on non-2xx.

`/reboot` accepts `PUT` or `POST` only. The restart is deferred by 500 ms, so the response
is still delivered.

---

## 12. `/setMyPosition` programs the motor; `/setPositions` does not

`/setPositions` (8081) writes position, tilt and favourite into the ESP's own database.
The motor never learns about it — use it to correct a drifted estimate, not to change
anything physical.

`/setMyPosition` (port 80) sends the real Prog frame. One call has three different
effects depending on state:

| State | Effect |
|---|---|
| shade is not at `pos` | it **moves** there; nothing is stored yet |
| shade is at `pos`, and `pos == myPos` | the favourite is **cleared** |
| shade is at `pos`, and `pos != myPos` | the favourite is **set** |

There is no separate clear command: clearing means sending the current favourite again.

Two traps: the call is silently ignored while the shade is moving (`if(!this->isIdle())
return;`) yet still answers 200, and if `tilt` is omitted the firmware assigns
`tilt = myPos` — the value of the *travel* axis (`Web.cpp:1550`), which looks like a
typo for `myTiltPos`. Always send both values for shades with slats.

Related: `/tiltCommand` evaluates **either** `command` **or** `target`, never both. For
`tiltType: tiltonly` the firmware internally redirects Up/Down/My onto the tilt axis.

---

## 13. Telemetry events are change-driven, not periodic

`Network::loop()` evaluates every 1500 ms (`Network.cpp:139`) but emits only on change:

- `wifiStrength` — only when RSSI moved by **more than 1 dBm** or the channel changed
  (`Network.cpp:172`). With a stable link, minutes can pass without an event. When WiFi is
  down the firmware sends the placeholder `{"ssid":"","strength":-100,"channel":-1}`
  (`Network.cpp:200`); `-100` therefore means "no link", not "very weak".
- `memStatus` — only when free or largest-allocatable heap moved by more than 1500 bytes,
  and then at most every 7 s; independently of that, at least every 15 s
  (`Network.cpp:673-695`).
- `ethernet` — on devices with a LAN port, and additionally as a `connected:false` notice
  when WiFi drops.

A chart built on these values plots **events, not evenly spaced samples**; timestamp them
on arrival. On connect, the firmware pushes a full snapshot once
(`SocketEmitter::initClients`, `Sockets.cpp:106-121`).

`memStatus` is worth surfacing: `max` is the largest allocatable block. When it sits far
below `free`, the heap is fragmented — the state in which a device crashes despite
"enough" free memory.

---

## 14. `/backup` streams a file, `/restore` replaces everything

`handleBackup` writes `controller.backup` and streams it as `text/plain`
(`Web.cpp:832-866`). On port 80 the web UI passes `attach=true` to get a
`Content-Disposition` header with a timestamp; on **8081 `attach` defaults to `false`**
(`Web.h:32`), so no such header appears. Treat the response as opaque bytes — parsing and
re-serialising it produces a different file.

`/restore` (port 80, multipart) replaces the entire configuration and reboots the device.
It does **not** roll rolling codes backwards: `ShadeConfigFile::restore` applies
`lastRollingCode = max(nvs, backup)` and writes the higher value back to NVS
(`ConfigFile.cpp:809-816`).

---

## 15. Authentication is not enforced in v2.4.6

`Web::isAuthenticated()` is declared (`Web.h:43`) and implemented (`Web.cpp:79`) but
**called from no route**. Regardless of `authType`, every route on both servers answers
without an `apikey` header.

Clients should still send the token — the behaviour may change — but should not treat the
device's own security setting as network protection.

---

## Enumerations

```
shade_types  roller=0, blind=1, ldrapery=2, awning=3, shutter=4, garage1=5,
             garage3=6, rdrapery=7, cdrapery=8, drycontact=9, drycontact2=10,
             lgate=11, cgate=12, rgate=13, lgate1=14, cgate1=15, rgate1=16
tilt_types   none=0, tiltmotor=1, integrated=2, tiltonly=3, euromode=4
radio_proto  RTS=0, RTW=1, RTV=2, GP_Relay=8, GP_Remote=9
security     None=0, PinEntry=1, Password=2
             permissions bit 0x01 = ConfigOnly — read and control are unauthenticated,
             only configuration is protected
direction    -1 opening, 0 stopped, 1 closing
```

Command strings accepted by `translateSomfyCommand()` are compared case-insensitively:
`My, Up, Down, MyUp, MyDown, UpDown, MyUpDown, Prog, SunFlag, StepUp, StepDown, Flag,
Sensor, Toggle, Favorite, Stop`.

Two caveats: unrecognised strings fall through to `My` rather than raising an error, and
the single-letter shorthands are ambiguous — `"s"` maps to `SunFlag`, not `Stop`. Sending
full command names avoids both.

Limits: 32 shades, 16 groups, 16 rooms, 32 shades per group, 7 linked remotes,
7 repeaters. `roomId: 0` means "no room".

---

## Discovery

mDNS advertises `_espsomfy_rts._tcp` on port 8080 with TXT records `serverId`, `model`
and `version` (`Network.cpp`, around line 347), alongside `_http._tcp` on port 80. SSDP is
available via `GET /upnp.xml`.

Clients should offer manual host entry as a fallback — mDNS is unreliable across VLANs and
guest networks.

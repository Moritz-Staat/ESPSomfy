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

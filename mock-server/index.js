/* eslint-disable */
// Mock-Server für ESPSomfy-RTS v2.4.6.
// HTTP auf :8081 liefert die ECHTEN Antworten aus docs/api-samples/, die Verwaltung
// haengt wie am Geraet auf :80 (MOCK_CONFIG_PORT), der
// WebSocket auf :8080 spricht das exakte Frameformat `42[event,{...}]` mit
// unquotiertem Event-Namen. `npm run mock` startet ihn.
//
// Fehlermodi (umschaltbar per Env MOCK_MODE oder zur Laufzeit via
// PUT /_mock/mode {"mode":"..."}):
//   normal     — Standardverhalten
//   error500   — jede API-Antwort ist HTTP 500 {"status":"ERROR",...}
//   timeout    — HTTP-Requests werden nie beantwortet
//   socketdrop — Socket-Verbindungen werden nach 2 s hart getrennt
//   badframes  — Socket sendet zusätzlich ungültige Frames

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const HTTP_PORT = process.env.MOCK_HTTP_PORT ? Number(process.env.MOCK_HTTP_PORT) : 8081;
// Die Firmware betreibt zwei Server: 8081 fuer Lesen und Fahrbefehle, 80 fuer die
// Verwaltung. Der Mock bildet die Trennung nach, damit ein Aufruf auf dem falschen
// Port hier genauso ins Leere laeuft wie am Geraet.
const CONFIG_PORT = process.env.MOCK_CONFIG_PORT ? Number(process.env.MOCK_CONFIG_PORT) : 80;
const WS_PORT = process.env.MOCK_WS_PORT ? Number(process.env.MOCK_WS_PORT) : 8080;
const samplesDir = path.join(__dirname, '..', 'docs', 'api-samples');

function loadSample(name) {
  return JSON.parse(fs.readFileSync(path.join(samplesDir, name), 'utf8'));
}

const samples = {
  discovery: loadSample('discovery.json'),
  shades: loadSample('shades.json'),
  rooms: loadSample('rooms.json'),
  groups: loadSample('groups.json'),
  controller: loadSample('controller.json'),
  login: loadSample('login.json'),
};

let mode = process.env.MOCK_MODE || 'normal';

// Veränderlicher Zustand: tiefe Kopie der echten Rollos.
const shades = JSON.parse(JSON.stringify(samples.shades));

// Am echten Gerät hängen nur Rollos ohne Lamellen (tiltType 0). Damit sich die
// Tilt-Steuerung überhaupt prüfen lässt, kommen zwei erfundene Rollos dazu:
// eines mit beiden Achsen (integrated) und eines, das nur Lamellen hat (tiltonly).
function tiltShade(shadeId, name, tiltType, shadeType) {
  const base = JSON.parse(JSON.stringify(shades[0]));
  return {
    ...base,
    shadeId,
    name,
    shadeType,
    tiltType,
    remoteAddress: 571000 + shadeId,
    position: tiltType === 3 ? 0 : 40,
    target: tiltType === 3 ? 0 : 40,
    direction: 0,
    myPos: -1,
    tiltDirection: 0,
    tiltPosition: 30,
    tiltTarget: 30,
    myTiltPos: -1,
    sortOrder: shadeId - 1,
  };
}
shades.push(tiltShade(3, 'Jalousie Büro', 2, 1));
shades.push(tiltShade(4, 'Raffstore Bad', 3, 1));

// Am echten Gerät sind keine Gruppen angelegt. Eine erfundene Gruppe macht die
// Gruppensteuerung pruefbar; flags ist wie in der Firmware das OR der Mitglieder.
const groups = JSON.parse(JSON.stringify(samples.groups));
if (groups.length === 0) {
  groups.push({
    groupId: 1,
    remoteAddress: 580001,
    name: 'Erdgeschoss',
    sunSensor: false,
    shades: [1, 2],
    flags: 0,
  });
}

const moveTimers = new Map();
const tiltTimers = new Map();

function getShade(shadeId) {
  return shades.find((s) => s.shadeId === Number(shadeId));
}

function getGroup(groupId) {
  return groups.find((g) => g.groupId === Number(groupId));
}

// Socket-Format von SomfyShade::emitState: Feld heißt `type` (nicht shadeType),
// Tilt-Felder fehlen bei tiltType 0.
function shadeStateBody(shade) {
  const body = {
    shadeId: shade.shadeId,
    type: shade.shadeType,
    remoteAddress: shade.remoteAddress,
    name: shade.name,
    direction: shade.direction,
    position: shade.position,
    target: shade.target,
    myPos: shade.myPos,
    tiltType: shade.tiltType,
    flipCommands: shade.flipCommands,
    flipPosition: shade.flipPosition,
    flags: shade.flags,
    sunSensor: shade.sunSensor,
    light: shade.light,
    sortOrder: shade.sortOrder,
  };
  if (shade.tiltType !== 0) {
    body.tiltDirection = shade.tiltDirection;
    body.tiltTarget = shade.tiltTarget;
    body.tiltPosition = shade.tiltPosition;
    body.myTiltPos = shade.myTiltPos;
  }
  return body;
}

// --- WebSocket ---------------------------------------------------------------

const wss = new WebSocketServer({ port: WS_PORT });

function frame(event, payload) {
  // Exakt wie WResp.cpp: snprintf(buff, "42[%s,", evt) — Event-Name unquotiert.
  return `42[${event},${JSON.stringify(payload)}]`;
}

function broadcast(event, payload) {
  const data = frame(event, payload);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(data);
  }
}

wss.on('connection', (socket) => {
  // Die Firmware sendet direkt nach dem Verbinden den Klartext-String "Connected".
  socket.send('Connected');
  for (const shade of shades) socket.send(frame('shadeState', shadeStateBody(shade)));
  socket.send(frame('fwStatus', samples.controller.version));
  socket.send(frame('wifiStrength', { ssid: 'MockNetz', strength: -42, channel: 1 }));
  socket.send(frame('memStatus', samples.discovery.memory));

  if (mode === 'socketdrop') {
    setTimeout(() => socket.terminate(), 2000);
  }
  if (mode === 'badframes') {
    const t = setInterval(() => {
      if (socket.readyState !== 1) return clearInterval(t);
      socket.send('42[kaputt,{keinJson]');
      socket.send('garbage');
    }, 1000);
  }
});

// --- Fahrsimulation ----------------------------------------------------------

function startMove(shade, target) {
  target = Math.max(0, Math.min(100, Math.round(target)));
  clearInterval(moveTimers.get(shade.shadeId));
  shade.target = target;
  shade.direction = Math.sign(target - shade.position);
  if (shade.direction === 0) {
    broadcast('shadeState', shadeStateBody(shade));
    return;
  }
  broadcast('shadeState', shadeStateBody(shade));
  // Alle 500 ms ein shadeState mit veränderter Position, bis target erreicht ist.
  const timer = setInterval(() => {
    const step = 5 * shade.direction;
    const next = shade.position + step;
    if ((shade.direction > 0 && next >= shade.target) || (shade.direction < 0 && next <= shade.target)) {
      shade.position = shade.target;
      shade.direction = 0;
      clearInterval(timer);
      moveTimers.delete(shade.shadeId);
    } else {
      shade.position = next;
    }
    broadcast('shadeState', shadeStateBody(shade));
  }, 500);
  moveTimers.set(shade.shadeId, timer);
}

function stopMove(shade) {
  clearInterval(moveTimers.get(shade.shadeId));
  moveTimers.delete(shade.shadeId);
  shade.direction = 0;
  shade.target = shade.position;
  broadcast('shadeState', shadeStateBody(shade));
}

// Tilt ist eine eigene Achse mit eigenen Timern — sonst würde eine Lamellenfahrt
// eine laufende Rollofahrt abwürgen.
function startTiltMove(shade, target) {
  target = Math.max(0, Math.min(100, Math.round(target)));
  clearInterval(tiltTimers.get(shade.shadeId));
  shade.tiltTarget = target;
  shade.tiltDirection = Math.sign(target - shade.tiltPosition);
  broadcast('shadeState', shadeStateBody(shade));
  if (shade.tiltDirection === 0) return;
  // Lamellen laufen schneller als der Behang.
  const timer = setInterval(() => {
    const next = shade.tiltPosition + 10 * shade.tiltDirection;
    const done =
      (shade.tiltDirection > 0 && next >= shade.tiltTarget) ||
      (shade.tiltDirection < 0 && next <= shade.tiltTarget);
    if (done) {
      shade.tiltPosition = shade.tiltTarget;
      shade.tiltDirection = 0;
      clearInterval(timer);
      tiltTimers.delete(shade.shadeId);
    } else {
      shade.tiltPosition = next;
    }
    broadcast('shadeState', shadeStateBody(shade));
  }, 400);
  tiltTimers.set(shade.shadeId, timer);
}

function stopTiltMove(shade) {
  clearInterval(tiltTimers.get(shade.shadeId));
  tiltTimers.delete(shade.shadeId);
  shade.tiltDirection = 0;
  shade.tiltTarget = shade.tiltPosition;
  broadcast('shadeState', shadeStateBody(shade));
}

function handleTiltCommand(shade, body) {
  // Wie die Firmware: command hat Vorrang, target wird dann nicht mehr gelesen.
  if (body.command === undefined && body.target !== undefined) {
    startTiltMove(shade, Number(body.target));
    return;
  }
  const cmd = String(body.command || 'My').toLowerCase();
  if (cmd === 'up') startTiltMove(shade, 0);
  else if (cmd === 'down') startTiltMove(shade, 100);
  else if (cmd === 'my') {
    if (shade.tiltDirection !== 0) stopTiltMove(shade);
    else if (shade.myTiltPos >= 0 && shade.myTiltPos <= 100) startTiltMove(shade, shade.myTiltPos);
  } else if (cmd === 'stop') stopTiltMove(shade);
}

function handleCommand(shade, body) {
  // tiltonly hat keine Fahrposition: die Firmware lenkt Up/Down/My dort intern
  // auf die Lamellenachse um (Somfy.cpp, sendCommand).
  if (shade.tiltType === 3) {
    handleTiltCommand(shade, body);
    return;
  }
  if (body.target !== undefined) {
    startMove(shade, Number(body.target));
    return;
  }
  // translateSomfyCommand ist case-insensitiv; unbekannte Strings fallen auf My zurück.
  const cmd = String(body.command || 'My').toLowerCase();
  if (cmd === 'up') startMove(shade, 0);
  else if (cmd === 'down') startMove(shade, 100);
  else if (cmd === 'my') {
    if (shade.direction !== 0) stopMove(shade);
    else if (shade.myPos >= 0 && shade.myPos <= 100) startMove(shade, shade.myPos);
  } else if (cmd === 'stop') stopMove(shade);
}

// --- HTTP --------------------------------------------------------------------

function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json', apikey: samples.login.apiKey });
  res.end(JSON.stringify(payload));
}

function currentDiscovery() {
  return { ...samples.discovery, shades, rooms: samples.rooms, groups };
}

// Favoritenposition wie SomfyShade::setMyPosition: derselbe Aufruf setzt, loescht
// oder faehrt erst hin. Waehrend einer Fahrt bleibt er wirkungslos (isIdle).
function handleSetMyPosition(shade, body) {
  const pos = Number(body.pos);
  if (!Number.isFinite(pos) || pos < 0 || pos > 100) return;
  if (shade.direction !== 0 || shade.tiltDirection !== 0) return;
  const tiltOnly = shade.tiltType === 3;
  const hasTilt = shade.tiltType !== 0;
  const tilt = hasTilt && body.tilt !== undefined ? Number(body.tilt) : shade.tiltPosition;

  if (tiltOnly) {
    if (tilt !== shade.tiltPosition) return startTiltMove(shade, tilt);
    shade.myTiltPos = tilt === shade.myTiltPos ? -1 : tilt;
    broadcast('shadeState', shadeStateBody(shade));
    return;
  }
  // Noch nicht am Ziel: erst hinfahren, gesetzt wird nach der Ankunft.
  if (pos !== shade.position || (hasTilt && tilt !== shade.tiltPosition)) {
    if (pos !== shade.position) startMove(shade, pos);
    if (hasTilt && tilt !== shade.tiltPosition) startTiltMove(shade, tilt);
    return;
  }
  const clears = pos === shade.myPos && (!hasTilt || tilt === shade.myTiltPos);
  shade.myPos = clears ? -1 : pos;
  if (hasTilt) shade.myTiltPos = clears ? -1 : tilt;
  broadcast('shadeState', shadeStateBody(shade));
}

// Routen des API-Servers (Port 8081).
function handleApiRoute(url, body, res) {
  switch (url.pathname) {
    case '/discovery':
      return json(res, 200, currentDiscovery());
    case '/shades':
      return json(res, 200, shades);
    case '/rooms':
      return json(res, 200, samples.rooms);
    case '/groups':
      return json(res, 200, groups);
    case '/groupCommand': {
      const group = getGroup(body.groupId);
      if (!group) {
        return json(res, 500, { status: 'ERROR', desc: 'Group with the specified id not found.' });
      }
      // Ein Funkbefehl erreicht alle Motoren zugleich; die Firmware schaetzt danach
      // die Einzelpositionen, deren shadeState-Events nacheinander eintreffen.
      // Die Antwort traegt die Gruppe, KEINE Gruppenposition.
      for (const shadeId of group.shades) {
        const shade = getShade(shadeId);
        if (shade) handleCommand(shade, body);
      }
      return json(res, 200, group);
    }
    case '/controller':
      return json(res, 200, { ...samples.controller, shades });
    case '/login':
      return json(res, 200, samples.login);
    case '/shadeCommand': {
      const shade = getShade(body.shadeId);
      if (!shade) return notFound(res);
      handleCommand(shade, body);
      return json(res, 200, shade);
    }
    case '/tiltCommand': {
      const shade = getShade(body.shadeId);
      if (!shade) return notFound(res);
      handleTiltCommand(shade, body);
      return json(res, 200, shade);
    }
    case '/shade': {
      const shade = getShade(body.shadeId);
      if (!shade) return notFound(res);
      return json(res, 200, shade);
    }
    default:
      return unknownRoute(res, url);
  }
}

// Routen des Web-UI-Servers (Port 80) — die gesamte Verwaltung.
function handleConfigRoute(url, body, res) {
  switch (url.pathname) {
    case '/login':
      return json(res, 200, samples.login);
    case '/setMyPosition': {
      const shade = getShade(body.shadeId);
      if (!shade) return notFound(res);
      handleSetMyPosition(shade, body);
      return json(res, 200, shade);
    }
    default:
      return unknownRoute(res, url);
  }
}

function notFound(res) {
  return json(res, 500, { status: 'ERROR', desc: 'Shade with the specified id not found.' });
}

// Die Firmware meldet Fehler als 500 mit status/desc, nicht als 4xx.
function unknownRoute(res, url) {
  return json(res, 500, { status: 'ERROR', desc: `Unbekannter Endpunkt ${url.pathname}` });
}

function makeServer(port, route) {
  return http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    let bodyRaw = '';
    req.on('data', (chunk) => (bodyRaw += chunk));
    req.on('end', () => {
      let body = {};
      try {
        body = bodyRaw ? JSON.parse(bodyRaw) : {};
      } catch {
        body = {};
      }
      // Ein nacktes Array (die SortOrder-Routen) bleibt als solches erhalten.
      if (!Array.isArray(body)) {
        for (const [key, value] of url.searchParams) body[key] = value;
      }

      // Mock-Steuerung ist von den Fehlermodi ausgenommen.
      if (url.pathname === '/_mock/mode') {
        if (body.mode) mode = body.mode;
        return json(res, 200, { mode });
      }
      if (mode === 'timeout') return; // Antwort absichtlich verschlucken.
      if (mode === 'error500') {
        return json(res, 500, { status: 'ERROR', desc: 'Mock-Fehlermodus aktiv' });
      }
      return route(url, body, res);
    });
  });
}

const server = makeServer(HTTP_PORT, handleApiRoute);
const configServer = makeServer(CONFIG_PORT, handleConfigRoute);

server.listen(HTTP_PORT, () => {
  console.log(`Mock-API auf http://localhost:${HTTP_PORT} (Modus: ${mode})`);
  console.log(`Mock-WebSocket auf ws://localhost:${WS_PORT}`);
  console.log(`Modus wechseln: curl -X PUT http://localhost:${HTTP_PORT}/_mock/mode -d '{"mode":"error500"}'`);
});

// Port 80 braucht auf manchen Systemen erhoehte Rechte — scheitert das, laeuft der
// Rest weiter und nur die Verwaltung ist nicht erreichbar.
configServer.on('error', (err) => {
  console.warn(`Mock-Verwaltung auf Port ${CONFIG_PORT} nicht gestartet: ${err.message}`);
  console.warn('Anderen Port waehlen: MOCK_CONFIG_PORT=8080 npm run mock');
});
configServer.listen(CONFIG_PORT, () => {
  console.log(`Mock-Verwaltung auf http://localhost:${CONFIG_PORT}`);
});

module.exports = { server, configServer, wss, shades, startMove, startTiltMove };

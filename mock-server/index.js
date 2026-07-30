/* eslint-disable */
// Mock-Server für ESPSomfy-RTS v2.4.6.
// HTTP auf :8081 liefert die ECHTEN Antworten aus docs/api-samples/, der
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
const moveTimers = new Map();

function getShade(shadeId) {
  return shades.find((s) => s.shadeId === Number(shadeId));
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

function handleCommand(shade, body) {
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
  return { ...samples.discovery, shades, rooms: samples.rooms, groups: samples.groups };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${HTTP_PORT}`);
  let bodyRaw = '';
  req.on('data', (chunk) => (bodyRaw += chunk));
  req.on('end', () => {
    let body = {};
    try {
      body = bodyRaw ? JSON.parse(bodyRaw) : {};
    } catch {
      body = {};
    }
    for (const [key, value] of url.searchParams) body[key] = value;

    // Mock-Steuerung ist von den Fehlermodi ausgenommen.
    if (url.pathname === '/_mock/mode') {
      if (body.mode) mode = body.mode;
      return json(res, 200, { mode });
    }

    if (mode === 'timeout') return; // Antwort absichtlich verschlucken.
    if (mode === 'error500') {
      return json(res, 500, { status: 'ERROR', desc: 'Mock-Fehlermodus aktiv' });
    }

    switch (url.pathname) {
      case '/discovery':
        return json(res, 200, currentDiscovery());
      case '/shades':
        return json(res, 200, shades);
      case '/rooms':
        return json(res, 200, samples.rooms);
      case '/groups':
        return json(res, 200, samples.groups);
      case '/controller':
        return json(res, 200, { ...samples.controller, shades });
      case '/login':
        return json(res, 200, samples.login);
      case '/shadeCommand': {
        const shade = getShade(body.shadeId);
        if (!shade) {
          return json(res, 500, { status: 'ERROR', desc: 'Shade with the specified id not found.' });
        }
        handleCommand(shade, body);
        return json(res, 200, shade);
      }
      case '/shade': {
        const shade = getShade(body.shadeId);
        if (!shade) {
          return json(res, 500, { status: 'ERROR', desc: 'Shade with the specified id not found.' });
        }
        return json(res, 200, shade);
      }
      default:
        // Die Firmware meldet Fehler als 500 mit status/desc, nicht als 4xx.
        return json(res, 500, { status: 'ERROR', desc: `Unbekannter Endpunkt ${url.pathname}` });
    }
  });
});

server.listen(HTTP_PORT, () => {
  console.log(`Mock-HTTP auf http://localhost:${HTTP_PORT} (Modus: ${mode})`);
  console.log(`Mock-WebSocket auf ws://localhost:${WS_PORT}`);
  console.log(`Modus wechseln: curl -X PUT http://localhost:${HTTP_PORT}/_mock/mode -d '{"mode":"error500"}'`);
});

module.exports = { server, wss, shades, startMove };

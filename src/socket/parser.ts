// Parser für das ESPSomfy-RTS-Socketformat. Die Frames sehen aus wie socket.io,
// sind es aber nicht: `42[shadeState,{"shadeId":1,...}]` — der Event-Name steht
// OHNE Anführungszeichen (WResp.cpp: snprintf(buff, "42[%s,", evt)), das Ganze
// ist also kein gültiges JSON. Parsing exakt wie im Web-UI (data/index.js Z. 472 ff.).

export interface SocketFrame {
  event: string;
  payload: unknown;
}

// Liefert null für Nicht-Frames (z. B. den Klartext-String "Connected" direkt
// nach dem Verbinden) und für Frames mit kaputtem JSON-Body.
export function parseFrame(data: string): SocketFrame | null {
  if (!data.startsWith('42')) return null;
  const ndx = data.indexOf(',');
  if (ndx < 0) return null;
  const evt = data.substring(3, ndx);
  const body = data.substring(ndx + 1, data.length - 1);
  try {
    return { event: evt, payload: JSON.parse(body) };
  } catch {
    return null;
  }
}

// Alle Event-Namen, die die Firmware emittiert (Somfy.cpp, Network.cpp, GitOTA.cpp).
export type SocketEventName =
  | 'shadeState'
  | 'shadeCommand'
  | 'shadeAdded'
  | 'shadeRemoved'
  | 'groupState'
  | 'groupAdded'
  | 'groupRemoved'
  | 'roomState'
  | 'roomAdded'
  | 'roomRemoved'
  | 'memStatus'
  | 'wifiStrength'
  | 'ethernet'
  | 'fwStatus'
  | 'updateProgress'
  | 'frequencyScan'
  | 'remoteFrame'
  | 'packetPulses';

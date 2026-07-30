import { parseFrame, SocketFrame } from './parser';

export type ConnectionStatus = 'connecting' | 'live' | 'polling' | 'offline';

// Minimales WebSocket-Interface (React-Native-WebSocket erfüllt es) — injizierbar für Tests.
export interface SocketLike {
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onclose: (() => void) | null;
  readyState: number;
  send(data: string): void;
  close(): void;
}

export interface SomfySocketOptions {
  host: string;
  port?: number;
  onFrame: (frame: SocketFrame) => void;
  onStatus?: (status: ConnectionStatus) => void;
  // Resync nach Reconnect (GET /discovery) — während der Trennung gingen Events verloren.
  onResync?: () => void;
  // Polling-Fallback-Tick (GET /shades) — läuft, solange der Status `polling` ist.
  onPollTick?: () => void;
  createSocket?: (url: string) => SocketLike;
  pollIntervalMs?: number;
  watchdogMs?: number;
  maxBackoffMs?: number;
}

const WS_OPEN = 1;

// Verbindungsmanagement:
// - Reconnect mit Backoff 1 → 2 → 4 → 8 → … max. 30 s, mit Jitter.
// - Nach 3 gescheiterten Versuchen Polling-Fallback (Status `polling`, onPollTick alle 10 s);
//   die Socket-Versuche laufen im Hintergrund weiter.
// - Watchdog: Die Firmware hat KEINEN garantierten Heartbeat (wifiStrength nur bei
//   RSSI-Änderung, memStatus nur bei Heap-Änderung; im 60-s-Mitschnitt: 57 s Stille).
//   Nach `watchdogMs` ohne Frame wird deshalb nicht blind getrennt, sondern ein
//   harmloser Text gesendet (unbekannte Texte ignoriert Sockets.cpp sicher) — schlägt
//   das Senden fehl oder ist der Socket nicht mehr OPEN, gilt die Verbindung als tot.
//   Serverseitig räumt enableHeartbeat(20 s) tote Clients ohnehin ab (max. 5 Slots!).
// - Die AppState-Bindung (Socket bei background schließen, bei active neu aufbauen)
//   macht bindAppState() in lifecycle.ts — sonst blockiert die App dauerhaft einen
//   der fünf Socket-Slots des ESP32.
export class SomfySocket {
  private options: Required<Pick<SomfySocketOptions, 'port' | 'pollIntervalMs' | 'watchdogMs' | 'maxBackoffMs'>> &
    SomfySocketOptions;
  private socket: SocketLike | null = null;
  private status: ConnectionStatus = 'offline';
  private failedAttempts = 0;
  private stopped = true;
  private everConnected = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private watchdogTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: SomfySocketOptions) {
    this.options = {
      port: 8080,
      pollIntervalMs: 10_000,
      watchdogMs: 60_000,
      maxBackoffMs: 30_000,
      ...options,
    };
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.failedAttempts = 0;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    this.clearTimers();
    this.closeSocket();
    this.setStatus('offline');
  }

  private connect(): void {
    if (this.stopped) return;
    this.setStatus(this.status === 'polling' ? 'polling' : 'connecting');
    const url = `ws://${this.options.host}:${this.options.port}`;
    const create = this.options.createSocket ?? ((u: string) => new WebSocket(u) as SocketLike);
    let socket: SocketLike;
    try {
      socket = create(url);
    } catch {
      this.onConnectionFailed();
      return;
    }
    this.socket = socket;

    socket.onopen = () => {
      if (this.stopped || this.socket !== socket) return;
      this.failedAttempts = 0;
      this.stopPolling();
      this.setStatus('live');
      this.armWatchdog();
      // Nur bei Reconnects resyncen — beim Erstverbinden hydriert der Store selbst.
      // join:0 (remoteFrame-Stream) bewusst NICHT senden — belastet den ESP32 unnötig.
      if (this.everConnected) this.options.onResync?.();
      this.everConnected = true;
    };

    socket.onmessage = (event) => {
      if (this.socket !== socket) return;
      this.armWatchdog();
      if (typeof event.data !== 'string') return;
      // Der Klartext-String "Connected" beim Verbinden ist kein Frame → parseFrame → null.
      const frame = parseFrame(event.data);
      if (frame) this.options.onFrame(frame);
    };

    socket.onerror = () => {
      // onclose folgt ohnehin — hier nichts tun, sonst doppelter Reconnect.
    };

    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = null;
      if (this.stopped) return;
      this.onConnectionFailed();
    };
  }

  private onConnectionFailed(): void {
    this.disarmWatchdog();
    this.failedAttempts++;
    if (this.failedAttempts >= 3) this.startPolling();
    const backoff = Math.min(
      1000 * Math.pow(2, this.failedAttempts - 1),
      this.options.maxBackoffMs
    );
    const jitter = backoff * 0.2 * Math.random();
    this.reconnectTimer = setTimeout(() => this.connect(), backoff + jitter);
    if (this.status !== 'polling') this.setStatus(this.failedAttempts >= 3 ? 'polling' : 'connecting');
  }

  private armWatchdog(): void {
    this.disarmWatchdog();
    this.watchdogTimer = setTimeout(() => this.onWatchdog(), this.options.watchdogMs);
  }

  private disarmWatchdog(): void {
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  private onWatchdog(): void {
    const socket = this.socket;
    if (!socket) return;
    if (socket.readyState !== WS_OPEN) {
      this.recycle();
      return;
    }
    try {
      // TCP-Probe: Sockets.cpp ignoriert unbekannte Texte sicher (nur Serial-Log).
      socket.send('ping');
      this.armWatchdog();
    } catch {
      this.recycle();
    }
  }

  // Verbindung als tot behandeln: schließen und neu aufbauen.
  private recycle(): void {
    this.closeSocket();
    if (!this.stopped) this.onConnectionFailed();
  }

  private startPolling(): void {
    if (this.pollTimer) return;
    this.setStatus('polling');
    this.pollTimer = setInterval(() => this.options.onPollTick?.(), this.options.pollIntervalMs);
    this.options.onPollTick?.();
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private closeSocket(): void {
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      try {
        socket.close();
      } catch {
        // Socket war bereits zu.
      }
    }
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopPolling();
    this.disarmWatchdog();
  }

  private setStatus(status: ConnectionStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.options.onStatus?.(status);
  }
}

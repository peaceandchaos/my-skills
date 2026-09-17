import { LIGHTER_WS } from "@/lib/lighter/config";

export type WsHandler = (msg: Record<string, unknown>) => void;

export class LighterSocket {
  private ws: WebSocket | null = null;
  private ping: ReturnType<typeof setInterval> | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private channels = new Set<string>();
  onMessage: WsHandler = () => {};
  onStatus: (s: "connecting" | "live" | "down") => void = () => {};

  start() {
    this.stopped = false;
    this.open();
  }

  stop() {
    this.stopped = true;
    if (this.retry) clearTimeout(this.retry);
    this.teardown();
  }

  subscribe(channel: string) {
    this.channels.add(channel);
    this.send({ type: "subscribe", channel });
  }

  unsubscribe(channel: string) {
    this.channels.delete(channel);
    this.send({ type: "unsubscribe", channel });
  }

  private open() {
    this.teardown();
    this.onStatus("connecting");
    const ws = new WebSocket(LIGHTER_WS);
    this.ws = ws;
    ws.onopen = () => {
      this.onStatus("live");
      for (const channel of this.channels) {
        this.send({ type: "subscribe", channel });
      }
      this.ping = setInterval(() => this.send({ type: "ping" }), 2500);
    };
    ws.onmessage = (ev) => {
      const msg = parseFrame(ev.data);
      if (msg) this.onMessage(msg);
    };
    ws.onclose = () => {
      this.onStatus("down");
      if (this.ping) clearInterval(this.ping);
      this.ping = null;
      if (!this.stopped) {
        this.retry = setTimeout(() => this.open(), 1500);
      }
    };
  }

  private send(payload: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  private teardown() {
    if (this.ping) clearInterval(this.ping);
    this.ping = null;
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }
}

function parseFrame(data: unknown): Record<string, unknown> | null {
  if (typeof data !== "string" || data[0] !== "{") return null;
  try {
    const msg = JSON.parse(data) as unknown;
    if (!msg || typeof msg !== "object" || Array.isArray(msg)) return null;
    return msg as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function channelType(msg: Record<string, unknown>) {
  return String(msg.type ?? "");
}

export function channelName(msg: Record<string, unknown>) {
  return String(msg.channel ?? "");
}

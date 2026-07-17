/**
 * TEMPORARY (R-10). DELETE in the same integration commit that installs @types/ws — both present
 * = duplicate declarations and `tsc` will fail.
 *
 * `ws@8.21.1` ships no types and `@types/ws` is not installed in this worktree, so this shim
 * declares EXACTLY the surface apps/daemon uses — nothing more. It is deliberately narrow: a
 * generous shim would let a real API mismatch typecheck.
 */
declare module "ws" {
  import type { IncomingMessage } from "node:http";
  import type { Duplex } from "node:stream";
  import type { EventEmitter } from "node:events";

  export class WebSocket extends EventEmitter {
    static readonly OPEN: 1;
    readonly readyState: number;
    send(data: string): void;
    close(code?: number, reason?: string): void;
    terminate(): void;
    on(event: "message", listener: (data: unknown) => void): this;
    on(event: "close", listener: () => void): this;
    on(event: "error", listener: (error: Error) => void): this;
    on(event: "open", listener: () => void): this;
    on(event: "unexpected-response", listener: (req: unknown, res: IncomingMessage) => void): this;
    off(event: string, listener: (...args: never[]) => void): this;
    constructor(address: string, options?: { headers?: Record<string, string> });
  }

  export class WebSocketServer extends EventEmitter {
    constructor(options: { noServer?: boolean; maxPayload?: number });
    readonly clients: Set<WebSocket>;
    handleUpgrade(
      request: IncomingMessage,
      socket: Duplex,
      head: Buffer,
      callback: (client: WebSocket, request: IncomingMessage) => void,
    ): void;
    emit(event: "connection", socket: WebSocket, request: IncomingMessage): boolean;
    close(callback?: (error?: Error) => void): void;
  }
}

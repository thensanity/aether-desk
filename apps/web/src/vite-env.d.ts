/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHAIN_ID?: string;
  readonly VITE_RPC_URL?: string;
  readonly VITE_CLIENT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Eip1193Request {
  method: string;
  params?: unknown[] | object;
}

interface Eip1193Provider {
  request(args: Eip1193Request): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
}

interface Window {
  ethereum?: Eip1193Provider;
}

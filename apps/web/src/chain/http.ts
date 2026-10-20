import { LruCache } from "../ds/lru";

const CACHEABLE = new Set(["eth_chainId", "net_version"]);

export function httpTransport(rpcUrl: string): Eip1193Provider {
  return {
    async request({ method, params }) {
      if (method === "eth_accounts" || method === "eth_requestAccounts") return [];
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: params ?? [] }),
      });
      if (!response.ok) throw new Error(`RPC ${method} failed with HTTP ${response.status}`);
      const body = (await response.json()) as { result?: unknown; error?: { message?: string } };
      if (body.error) throw new Error(body.error.message || `RPC ${method} failed`);
      return body.result;
    },
  };
}

/**
 * Caches only stable methods. Balances and eth_call against `latest` are not cached:
 * the block tag moves, and a stale allowance is how double-submits happen.
 */
export function cachedTransport(inner: Eip1193Provider, capacity = 32): Eip1193Provider {
  const cache = new LruCache<string, unknown>(capacity);
  return {
    async request(args) {
      const key = `${args.method}:${JSON.stringify(args.params ?? [])}`;
      if (CACHEABLE.has(args.method)) {
        const hit = cache.get(key);
        if (hit !== undefined) return hit;
        const value = await inner.request(args);
        cache.set(key, value);
        return value;
      }
      return inner.request(args);
    },
    on(event, listener) {
      inner.on?.(event, listener);
    },
    removeListener(event, listener) {
      inner.removeListener?.(event, listener);
    },
  };
}

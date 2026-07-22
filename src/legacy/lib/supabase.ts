// @ts-nocheck
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Runtime env injected by the server-side RootShell into window.__SR_ENV__.
// We fall back to import.meta.env for hybrid setups but the canonical source
// is the server-injected globals so we never rely on VITE_ prefixed vars
// (Lovable reserves that prefix).
declare global {
  interface Window {
    __SR_ENV__?: {
      SUPABASE_URL?: string;
      SUPABASE_ANON_KEY?: string;
    };
  }
}

function readEnv(): { url: string; anon: string } {
  const w = typeof window !== "undefined" ? window.__SR_ENV__ : undefined;
  const url = w?.SUPABASE_URL || "";
  const anon = w?.SUPABASE_ANON_KEY || "";
  return { url, anon };
}

let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (cached) return cached;
  const { url, anon } = readEnv();
  if (!url || !anon) {
    throw new Error(
      "Supabase runtime env missing. Ensure SR_SUPABASE_URL and SR_SUPABASE_ANON_KEY secrets are set."
    );
  }
  cached = createClient(url, anon);
  return cached;
}

// Backwards-compatible named export: legacy code imports `supabase` directly.
// We lazily proxy calls so accessing before hydration does not throw during SSR.
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_t, prop) {
    const client = getSupabase();
    // @ts-expect-error dynamic proxy
    const value = client[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
});

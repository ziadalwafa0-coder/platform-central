// Secondary ("mirror" / bring-your-own) Supabase project config.
// This is NOT the app's primary database connection (that one is env-configured
// in client.server.ts). This module powers the "مزامنة السحابة" settings panel.
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SETTINGS_KEY = "mirror_supabase";

export interface MirrorConfig {
  url: string;
  secretKey: string;
  enabled: boolean;
  lastTestedAt: string | null;
  lastTestOk: boolean | null;
  updatedAt?: string | null;
}

export function validateMirrorInput(url: string, secretKey: string): string | null {
  if (!url) return "رابط مشروع Supabase مطلوب.";
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "رابط Supabase غير صالح. مثال: https://xxxx.supabase.co";
  }
  if (parsed.protocol !== "https:") return "يجب أن يبدأ الرابط بـ https://";
  if (!secretKey) return "مفتاح Service Role مطلوب.";
  if (secretKey.length < 20) return "مفتاح Service Role يبدو غير صالح (قصير جداً).";
  return null;
}

export async function readMirrorConfig(): Promise<MirrorConfig> {
  const { data } = await supabaseAdmin
    .from("sr_settings")
    .select("value, updated_at")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();
  const cfg = (data?.value ?? {}) as Record<string, unknown>;
  return {
    url: String(cfg.url ?? ""),
    secretKey: String(cfg.secretKey ?? ""),
    enabled: cfg.enabled === true,
    lastTestedAt: (cfg.lastTestedAt as string | null) ?? null,
    lastTestOk: (cfg.lastTestOk as boolean | null) ?? null,
    updatedAt: data?.updated_at ?? null,
  };
}

export async function writeMirrorConfig(cfg: Omit<MirrorConfig, "updatedAt">): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabaseAdmin
    .from("sr_settings")
    .upsert(
      { key: SETTINGS_KEY, value: cfg as any, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Live connectivity check against the target project using its own key. */
export async function testMirrorConnection(
  url: string,
  secretKey: string,
): Promise<{ ok: true; tables: string[] } | { ok: false; error: string }> {
  const opaque = secretKey.startsWith("sb_secret_") || secretKey.startsWith("sb_publishable_");
  try {
    const client = createClient(url, secretKey, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const headers = new Headers(init?.headers);
          if (opaque && headers.get("Authorization") === `Bearer ${secretKey}`) headers.delete("Authorization");
          headers.set("apikey", secretKey);
          return fetch(input, { ...init, headers });
        },
      },
    });

    const tables: string[] = [];
    for (const t of ["sr_products", "sr_snapshots", "sr_sync_runs"]) {
      const { error } = await client.from(t).select("*", { count: "exact", head: true });
      if (!error) tables.push(t);
    }

    if (tables.length === 0) {
      // Reachability probe: if REST itself answers, the key/URL are fine but the schema is empty.
      const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/`, { headers: { apikey: secretKey } });
      if (!res.ok) return { ok: false, error: `HTTP ${res.status} من REST API` };
    }
    return { ok: true, tables };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

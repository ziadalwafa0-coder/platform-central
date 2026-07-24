// Reliability primitives: retry, timeout, circuit breaker, DLQ, metrics, idempotency, distributed lock.
// Server-only. Never import from client code.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ---------------- Retry with exponential backoff + jitter ----------------
export interface RetryOptions {
  retries?: number;
  baseMs?: number;
  maxMs?: number;
  timeoutMs?: number;
  onAttempt?: (attempt: number, err: unknown) => void;
  isRetryable?: (err: unknown) => boolean;
}

export async function withTimeout<T>(p: Promise<T>, ms: number, label = "op"): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`timeout:${label}:${ms}ms`)), ms)),
  ]);
}

export async function retry<T>(fn: (attempt: number) => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const retries = opts.retries ?? 3;
  const base = opts.baseMs ?? 300;
  const max = opts.maxMs ?? 8000;
  const isRetryable = opts.isRetryable ?? (() => true);
  let lastErr: unknown;
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const p = fn(attempt);
      return opts.timeoutMs ? await withTimeout(p, opts.timeoutMs, "retry") : await p;
    } catch (err) {
      lastErr = err;
      opts.onAttempt?.(attempt, err);
      if (attempt > retries || !isRetryable(err)) break;
      const delay = Math.min(max, base * Math.pow(2, attempt - 1));
      const jitter = Math.floor(Math.random() * delay * 0.3);
      await new Promise((r) => setTimeout(r, delay + jitter));
    }
  }
  throw lastErr;
}

// ---------------- Circuit Breaker (DB-backed) ----------------
const CB_FAILURE_THRESHOLD = 5;
const CB_OPEN_MS = 60_000;

export async function circuitAllows(platform: string): Promise<{ allowed: boolean; state: string; reason?: string }> {
  const { data } = await supabaseAdmin
    .from("sr_circuit_state")
    .select("state, next_probe_at, last_error")
    .eq("platform", platform)
    .maybeSingle();
  if (!data) return { allowed: true, state: "closed" };
  if (data.state === "open") {
    const nextProbe = data.next_probe_at ? new Date(data.next_probe_at).getTime() : 0;
    if (Date.now() >= nextProbe) {
      // move to half_open
      await supabaseAdmin.from("sr_circuit_state").update({
        state: "half_open", updated_at: new Date().toISOString(),
      }).eq("platform", platform);
      return { allowed: true, state: "half_open" };
    }
    return { allowed: false, state: "open", reason: data.last_error ?? "circuit open" };
  }
  return { allowed: true, state: data.state };
}

export async function circuitRecordSuccess(platform: string) {
  await supabaseAdmin.from("sr_circuit_state").upsert({
    platform, state: "closed", consecutive_failures: 0,
    last_error: null, opened_at: null, next_probe_at: null,
    updated_at: new Date().toISOString(),
  });
}

export async function circuitRecordFailure(platform: string, err: unknown) {
  const { data } = await supabaseAdmin
    .from("sr_circuit_state").select("consecutive_failures").eq("platform", platform).maybeSingle();
  const failures = (data?.consecutive_failures ?? 0) + 1;
  const shouldOpen = failures >= CB_FAILURE_THRESHOLD;
  const now = new Date();
  await supabaseAdmin.from("sr_circuit_state").upsert({
    platform,
    state: shouldOpen ? "open" : "closed",
    consecutive_failures: failures,
    last_failure_at: now.toISOString(),
    last_error: String((err as Error)?.message ?? err).slice(0, 500),
    opened_at: shouldOpen ? now.toISOString() : null,
    next_probe_at: shouldOpen ? new Date(now.getTime() + CB_OPEN_MS).toISOString() : null,
    updated_at: now.toISOString(),
  });
}

// ---------------- Dead Letter Queue ----------------
export async function pushDeadLetter(params: {
  platform: string; runId?: string | null; kind: string; payload: unknown; error: unknown;
}) {
  try {
    const err = params.error as any;
    await supabaseAdmin.from("sr_dead_letter").insert({
      platform: params.platform,
      run_id: params.runId ?? null,
      kind: params.kind,
      payload: params.payload as any,
      error_code: err?.code ?? null,
      error_message: String(err?.message ?? err).slice(0, 1000),
    });
  } catch {
    // swallow: DLQ must never crash caller
  }
}

// ---------------- Idempotency ----------------
export async function idempotencyBegin(key: string, scope: string): Promise<{
  fresh: boolean; existing?: { status: string; result: unknown; run_id: string | null };
}> {
  const { data: existing } = await supabaseAdmin
    .from("sr_idempotency_keys").select("status, result, run_id, expires_at")
    .eq("key", key).maybeSingle();
  if (existing && new Date(existing.expires_at).getTime() > Date.now()) {
    return { fresh: false, existing: { status: existing.status, result: existing.result, run_id: existing.run_id } };
  }
  const { error } = await supabaseAdmin.from("sr_idempotency_keys").upsert({
    key, scope, status: "in_progress", created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    result: null, run_id: null,
  });
  if (error) throw new Error(`idempotency begin failed: ${error.message}`);
  return { fresh: true };
}

export async function idempotencyComplete(key: string, status: "done" | "failed", result: unknown, runId?: string | null) {
  await supabaseAdmin.from("sr_idempotency_keys").update({
    status, result: result as any, run_id: runId ?? null,
  }).eq("key", key);
}

// ---------------- Metrics ----------------
export async function recordMetric(metric: string, value: number, tags: Record<string, unknown> = {}) {
  try {
    await supabaseAdmin.from("sr_health_metrics").insert({ metric, value, tags: tags as any });
  } catch {
    // never propagate
  }
}

// ---------------- Distributed lock (advisory: DB unique index blocks it) ----------------
export async function acquireSyncLock(platform: string): Promise<{ ok: true; runId: string } | { ok: false; existingRunId?: string; reason: string }> {
  // Try to insert a pending run; unique index prevents concurrent running syncs.
  const { data, error } = await supabaseAdmin
    .from("sr_sync_runs")
    .insert({ platform, status: "pending", manual_or_auto: "manual" })
    .select("id").single();
  if (error) {
    // 23505 unique_violation → another run already active
    const { data: existing } = await supabaseAdmin
      .from("sr_sync_runs").select("id, status, started_at")
      .eq("platform", platform).in("status", ["pending", "running"])
      .order("started_at", { ascending: false }).limit(1).maybeSingle();
    return { ok: false, existingRunId: existing?.id, reason: error.message };
  }
  return { ok: true, runId: data.id as string };
}

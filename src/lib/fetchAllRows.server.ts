import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Fetches ALL rows matching a query, looping past Supabase/PostgREST's default
 * row cap. Use this for any query that could plausibly return more than ~1000
 * rows -- especially anything against sr_snapshots, which grows every sync cycle.
 */
export async function fetchAllRows<T>(
  supabase: SupabaseClient,
  table: string,
  select: string,
  pageSize: number,
  build: (q: any) => any,
): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  for (;;) {
    const q = build((supabase as any).from(table).select(select));
    const { data, error } = await q.range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    out.push(...(data as T[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

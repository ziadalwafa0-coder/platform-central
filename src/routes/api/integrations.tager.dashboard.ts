import { createFileRoute } from "@tanstack/react-router";
import { requireApiAuth } from "@/lib/api-auth.server";
import { cairoMidnightUtcIso } from "@/lib/cairo-time";

/** Tager dashboard metrics: GET /api/integrations/tager/dashboard */
export const Route = createFileRoute("/api/integrations/tager/dashboard")({
  server: {
    middleware: [requireApiAuth],
    handlers: {
      GET: async ({ context }) => {
        const { userId } = context as { userId: string };
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: connection } = await supabaseAdmin
          .from("tager_connections")
          .select("id, status, last_sync, last_error")
          .eq("user_id", userId)
          .maybeSingle();

        if (!connection) {
          return Response.json({
            success: true,
            connected: false,
            status: "not_connected",
            lastSync: null,
            productsCount: 0,
            withdrawalsToday: 0,
            restocksToday: 0,
            currentInventory: 0,
            latestChanges: [],
            syncErrors: [],
          });
        }

        const midnight = cairoMidnightUtcIso();

        const [{ data: products }, { data: todayEvents }, { data: latest }, { data: errors }] = await Promise.all([
          supabaseAdmin.from("tager_products").select("id, stock").eq("connection_id", connection.id),
          supabaseAdmin
            .from("tager_events")
            .select("event_type, difference, product_id")
            .gte("created_at", midnight),
          supabaseAdmin
            .from("tager_events")
            .select("id, event_type, previous_stock, current_stock, difference, created_at, product_id")
            .order("created_at", { ascending: false })
            .limit(30),
          supabaseAdmin
            .from("tager_errors")
            .select("id, code, status_code, message, created_at")
            .eq("connection_id", connection.id)
            .order("created_at", { ascending: false })
            .limit(20),
        ]);

        const ownedIds = new Set((products ?? []).map((p) => p.id));
        const mine = (rows: any[] | null) => (rows ?? []).filter((r) => ownedIds.has(r.product_id));

        const today = mine(todayEvents ?? []);
        const withdrawalsToday = today
          .filter((e) => e.event_type === "withdrawal" || e.event_type === "out_of_stock")
          .reduce((a, e) => a + Math.abs(Number(e.difference ?? 0)), 0);
        const restocksToday = today
          .filter((e) => e.event_type === "restock" || e.event_type === "increase")
          .reduce((a, e) => a + Math.abs(Number(e.difference ?? 0)), 0);

        const latestMine = mine(latest ?? []).slice(0, 20);
        const nameById = new Map<string, string>();
        if (latestMine.length > 0) {
          const { data: names } = await supabaseAdmin
            .from("tager_products")
            .select("id, name, sku, image")
            .in("id", latestMine.map((e) => e.product_id));
          for (const n of names ?? []) nameById.set(n.id, n.name);
        }

        return Response.json({
          success: true,
          connected: connection.status === "connected",
          status: connection.status,
          lastError: connection.last_error,
          lastSync: connection.last_sync,
          productsCount: (products ?? []).length,
          withdrawalsToday,
          restocksToday,
          currentInventory: (products ?? []).reduce((a, p) => a + (p.stock ?? 0), 0),
          latestChanges: latestMine.map((e) => ({
            id: e.id,
            productId: e.product_id,
            productName: nameById.get(e.product_id) ?? "",
            eventType: e.event_type,
            previousStock: e.previous_stock,
            currentStock: e.current_stock,
            difference: e.difference,
            createdAt: e.created_at,
          })),
          syncErrors: errors ?? [],
        });
      },
    },
  },
});

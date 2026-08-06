import { createFileRoute } from "@tanstack/react-router";
import { requireApiAuth } from "@/lib/api-auth.server";

/** Paginated Tager products: GET /api/integrations/tager/products?limit=&offset= */
export const Route = createFileRoute("/api/integrations/tager/products")({
  server: {
    middleware: [requireApiAuth],
    handlers: {
      GET: async ({ request, context }) => {
        const { userId } = context as { userId: string };
        const url = new URL(request.url);
        const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 100), 1), 500);
        const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);
        const search = (url.searchParams.get("search") ?? "").trim();

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: connection } = await supabaseAdmin
          .from("tager_connections")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();
        if (!connection) {
          return Response.json({ success: true, total: 0, products: [] });
        }

        let query = supabaseAdmin
          .from("tager_products")
          .select("id, external_product_id, name, sku, price, currency, stock, previous_stock, image, category, brand, status, last_seen", { count: "exact" })
          .eq("connection_id", connection.id)
          .order("last_seen", { ascending: false })
          .range(offset, offset + limit - 1);
        if (search) query = query.ilike("name", `%${search}%`);

        const { data, count, error } = await query;
        if (error) return Response.json({ success: false, error: error.message }, { status: 500 });

        return Response.json({ success: true, total: count ?? 0, limit, offset, products: data ?? [] });
      },
    },
  },
});

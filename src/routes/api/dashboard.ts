import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { syncSafkaIntoDb } from "@/lib/safkaSync.server";
import { cairoOffsetMs as getCairoOffsetMs, cairoMidnightUtcIso } from "@/lib/cairo-time";
import { fetchAllRows } from "@/lib/fetchAllRows.server";

const INTERVAL_MINUTES = 20;

export const Route = createFileRoute("/api/dashboard")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const category = url.searchParams.get("category") ?? "";
        const status = url.searchParams.get("status") ?? "";
        const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();

        // Auto-sync if the newest product row is older than the interval or the table is empty.
        try {
          const { data: latest } = await supabaseAdmin
            .from("sr_products")
            .select("last_checked_at")
            .order("last_checked_at", { ascending: false })
            .limit(1);
          const latestAt = latest?.[0]?.last_checked_at
            ? new Date(latest[0].last_checked_at as string).getTime()
            : 0;
          const isStale =
            !latestAt ||
            Date.now() - latestAt > INTERVAL_MINUTES * 60 * 1000;
          if (isStale) {
            await syncSafkaIntoDb();
          }
        } catch (err) {
          console.error("[dashboard] auto-sync failed:", err);
        }

        // Load all products
        const { data: productsRaw, error: productsErr } = await supabaseAdmin
          .from("sr_products")
          .select("*")
          .order("last_checked_at", { ascending: false })
          .limit(2000);
        if (productsErr) {
          return Response.json(
            { success: false, error: productsErr.message },
            { status: 500 },
          );
        }

        // Withdrawals in the last hour + today (Africa/Cairo, DST-aware).
        const nowMs = Date.now();
        const hourAgoIso = new Date(nowMs - 60 * 60 * 1000).toISOString();
        const cairoOffsetMs = getCairoOffsetMs(new Date(nowMs));
        const cairoMidnightUtc = cairoMidnightUtcIso(new Date(nowMs));

        const hourSnaps = await fetchAllRows<any>(
          supabaseAdmin as any,
          "sr_snapshots",
          "external_product_id, quantity_decrease, restock_amount, observed_at",
          1000,
          (q) => q.gte("observed_at", hourAgoIso),
        );

        const daySnaps = await fetchAllRows<any>(
          supabaseAdmin as any,
          "sr_snapshots",
          "external_product_id, quantity_decrease, restock_amount, observed_at",
          1000,
          (q) => q.gte("observed_at", cairoMidnightUtc),
        );

        const hourDecMap = new Map<string, number>();
        const hourResMap = new Map<string, number>();
        let lastHourQuantityDecrease = 0;
        for (const s of hourSnaps ?? []) {
          const dec = (s as any).quantity_decrease ?? 0;
          const res = (s as any).restock_amount ?? 0;
          const eid = (s as any).external_product_id as string;
          lastHourQuantityDecrease += dec;
          if (dec) hourDecMap.set(eid, (hourDecMap.get(eid) ?? 0) + dec);
          if (res) hourResMap.set(eid, (hourResMap.get(eid) ?? 0) + res);
        }

        const dayDecMap = new Map<string, number>();
        const dayResMap = new Map<string, number>();
        let todayQuantityDecrease = 0;
        let todayRestock = 0;
        for (const s of daySnaps ?? []) {
          const dec = (s as any).quantity_decrease ?? 0;
          const res = (s as any).restock_amount ?? 0;
          const eid = (s as any).external_product_id as string;
          todayQuantityDecrease += dec;
          todayRestock += res;
          if (dec) dayDecMap.set(eid, (dayDecMap.get(eid) ?? 0) + dec);
          if (res) dayResMap.set(eid, (dayResMap.get(eid) ?? 0) + res);
        }

        const products = (productsRaw ?? []).map((p: any) => {
          const eid = p.external_product_id as string;
          const currentQuantity: number | null = p.current_quantity;
          const previousQuantity: number | null = p.previous_quantity;
          const dailyQuantityDecrease = dayDecMap.get(eid) ?? 0;
          const dailyRestockAmount = dayResMap.get(eid) ?? 0;
          const hourlyDecrease = hourDecMap.get(eid) ?? 0;

          let productStatus:
            | "STABLE"
            | "OUT_OF_STOCK"
            | "LOW_STOCK"
            | "RESTOCKED"
            | "QUANTITY_DECREASE" = "STABLE";
          if ((currentQuantity ?? 0) <= 0) productStatus = "OUT_OF_STOCK";
          else if ((currentQuantity ?? 0) <= 5) productStatus = "LOW_STOCK";
          else if (dailyRestockAmount > 0) productStatus = "RESTOCKED";
          else if (dailyQuantityDecrease > 0) productStatus = "QUANTITY_DECREASE";

          return {
            id: p.id,
            platform: p.platform,
            externalProductId: eid,
            name: p.name,
            sku: p.sku ?? "",
            price: p.price ?? null,
            currency: p.currency ?? "EGP",
            imageUrl: p.image_url ?? "",
            productUrl: p.product_url ?? "",
            originalCategory: p.category ?? "غير مصنف",
            variants: [],
            previousQuantity,
            currentQuantity,
            productStatus,
            firstSeenAt: p.first_seen_at,
            lastCheckedAt: p.last_checked_at,
            lastSuccessfullySynchronizedAt: p.last_checked_at,
            createdAt: p.first_seen_at,
            updatedAt: p.updated_at,
            quantityDecrease: hourlyDecrease,
            dailyQuantityDecrease,
            restockAmount: hourResMap.get(eid) ?? 0,
            dailyRestockAmount,
            decreasePercentage:
              (previousQuantity ?? 0) > 0
                ? Math.round(
                    ((dailyQuantityDecrease) / (previousQuantity as number)) * 100,
                  )
                : 0,
            withdrawnPieces: dailyQuantityDecrease,
            withdrawalEvents: dailyQuantityDecrease > 0 ? 1 : 0,
          };
        });

        // Client-side filters
        const filtered = products.filter((p) => {
          if (category && category !== "all" && p.originalCategory !== category) return false;
          if (status && status !== "all" && p.productStatus !== status) return false;
          if (q && !(`${p.name} ${p.sku}`.toLowerCase().includes(q))) return false;
          return true;
        });

        const categories = Array.from(
          new Set(products.map((p) => p.originalCategory).filter(Boolean)),
        );

        const lowStock = products.filter((p) => p.productStatus === "LOW_STOCK").length;
        const outOfStock = products.filter((p) => p.productStatus === "OUT_OF_STOCK").length;
        const restocked = products.filter((p) => (p.dailyRestockAmount ?? 0) > 0).length;

        const lastSync =
          products.length > 0
            ? products.reduce(
                (acc, p) =>
                  new Date(p.lastCheckedAt).getTime() > new Date(acc).getTime()
                    ? p.lastCheckedAt
                    : acc,
                products[0].lastCheckedAt,
              )
            : null;

        const overview = {
          totalTrackedProducts: products.length,
          lastHourQuantityDecrease,
          todayQuantityDecrease,
          restockedProducts: restocked,
          lowStockProducts: lowStock,
          outOfStockProducts: outOfStock,
          lastSynchronization: lastSync,
          nextSynchronization: new Date(
            Date.now() + INTERVAL_MINUTES * 60 * 1000,
          ).toISOString(),
          synchronizationIntervalMinutes: INTERVAL_MINUTES,
          synchronizationSuccessRate: 100,
        };

        // Build a small chart timeline: hourly aggregates for the last 12 hours from snapshots
        const timelineBuckets = new Map<
          number,
          { dec: number; res: number }
        >();
        for (let h = 11; h >= 0; h--) {
          const bucket = Math.floor(nowMs / (60 * 60 * 1000)) - h;
          timelineBuckets.set(bucket, { dec: 0, res: 0 });
        }
        const twelveHoursAgo = new Date(
          nowMs - 12 * 60 * 60 * 1000,
        ).toISOString();
        const chartSnaps = await fetchAllRows<any>(
          supabaseAdmin as any,
          "sr_snapshots",
          "quantity_decrease, restock_amount, observed_at",
          1000,
          (q) => q.gte("observed_at", twelveHoursAgo),
        );
        for (const s of chartSnaps ?? []) {
          const bucket = Math.floor(
            new Date((s as any).observed_at).getTime() / (60 * 60 * 1000),
          );
          const b = timelineBuckets.get(bucket);
          if (b) {
            b.dec += (s as any).quantity_decrease ?? 0;
            b.res += (s as any).restock_amount ?? 0;
          }
        }
        const chartTimeline = Array.from(timelineBuckets.entries()).map(
          ([bucket, v]) => {
            const startedAt = new Date(bucket * 60 * 60 * 1000).toISOString();
            const cairoHour = new Date(
              bucket * 60 * 60 * 1000 + cairoOffsetMs,
            ).getUTCHours();
            return {
              syncRunId: `bucket-${bucket}`,
              startedAt,
              quantityDecrease: v.dec,
              restockAmount: v.res,
              label: `${cairoHour.toString().padStart(2, "0")}:00`,
            };
          },
        );

        return Response.json({
          success: true,
          overview,
          products: filtered,
          categories,
          syncRuns: [],
          chartTimeline,
          weeklyHistory: [],
          activityLogs: [],
          platformConnections: [
            {
              id: "safka-main",
              platform: "safka",
              displayName: "منصة صفقة",
              isActive: true,
              mode: "live",
              baseUrl: "https://api.safka-eg.com",
              productsEndpoint: "/api/v1/public/products",
              method: "GET",
              authType: "apiKey",
              apiKeyHeader: "api-safka-key",
              customHeaders: {},
              fieldMapping: {
                productsPath: "data",
                productIdPath: "_id",
                productNamePath: "name",
                skuPath: "sku",
                quantityPath: "quantity",
                pricePath: "price",
                imagePath: "image",
                categoryPath: "category.name",
                variantsPath: "variants",
                productUrlPath: "url",
              },
              paginationConfig: {
                type: "page",
                pageParameter: "page",
                limitParameter: "size",
                cursorParameter: "",
                limit: 100,
                maxPages: 50,
              },
              lastConnectionStatus: "SUCCESS",
              lastConnectionTestAt: lastSync,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              monitoring_enabled: true,
              monitoring_interval_minutes: INTERVAL_MINUTES,
              minimum_provider_interval_minutes: 5,
              next_scheduled_sync_at: overview.nextSynchronization,
              last_successful_sync_at: lastSync,
              last_sync_status: "SUCCESS",
            },
          ],
          scheduler: {
            enabled: true,
            intervalMinutes: INTERVAL_MINUTES,
            timezone: "Africa/Cairo",
            lastTickAt: lastSync,
          },
        });
      },
    },
  },
});

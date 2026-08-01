import { createFileRoute } from "@tanstack/react-router";
import { requireApiAdmin } from "@/lib/api-auth.server";

export const Route = createFileRoute("/api/platforms/$platform/test")({
  server: {
    middleware: [requireApiAdmin],
    handlers: {
      POST: async ({ params }) => {
        const started = Date.now();
        if (params.platform !== "safka") {
          return Response.json(
            {
              success: false,
              platform: params.platform,
              statusCode: 400,
              responseTimeMs: 0,
              trackedProductsCount: 0,
              error: `منصة غير مدعومة حالياً: ${params.platform}`,
            },
            { status: 200 },
          );
        }
        const apiKey = process.env.SAFKA_API_KEY;
        if (!apiKey) {
          return Response.json({
            success: false,
            platform: "safka",
            statusCode: 0,
            responseTimeMs: 0,
            trackedProductsCount: 0,
            error: "SAFKA_API_KEY غير مضبوط على الخادم",
          });
        }
        try {
          const url = "https://api.safka-eg.com/api/v1/public/products/?page=1&size=1";
          const res = await fetch(url, {
            method: "GET",
            headers: {
              accept: "application/json",
              "api-safka-key": apiKey,
            },
          });
          const ms = Date.now() - started;
          let body: any = null;
          try {
            body = await res.json();
          } catch {
            body = null;
          }
          const list = Array.isArray(body?.data)
            ? body.data
            : Array.isArray(body?.results)
              ? body.results
              : Array.isArray(body)
                ? body
                : [];
          return Response.json({
            success: res.ok,
            platform: "safka",
            statusCode: res.status,
            responseTimeMs: ms,
            trackedProductsCount: list.length,
            sample: list.slice(0, 1),
            error: res.ok ? undefined : body?.message || body?.detail || `HTTP ${res.status}`,
          });
        } catch (err: any) {
          return Response.json({
            success: false,
            platform: "safka",
            statusCode: 0,
            responseTimeMs: Date.now() - started,
            trackedProductsCount: 0,
            error: err?.message ?? "Network error",
          });
        }
      },
    },
  },
});

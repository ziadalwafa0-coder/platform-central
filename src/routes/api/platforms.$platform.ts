import { createFileRoute } from "@tanstack/react-router";

// Config is currently sourced from server-side env vars (SAFKA_API_KEY).
// The UI still POSTs/PUTs values; we accept and echo them back without persisting.
export const Route = createFileRoute("/api/platforms/$platform")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        return Response.json({
          success: true,
          platform: {
            id: params.platform,
            platform: params.platform,
            displayName: params.platform === "safka" ? "منصة صفقة (Safka EG)" : params.platform,
            isActive: true,
            baseUrl: "https://api.safka-eg.com",
            productsEndpoint: "/api/v1/public/products/",
            apiKeyHeader: "api-safka-key",
            hasApiKey: Boolean(process.env.SAFKA_API_KEY),
          },
        });
      },
      PUT: async ({ params, request }) => {
        try {
          await request.json().catch(() => ({}));
        } catch {}
        return Response.json({
          success: true,
          platform: params.platform,
          message: "تم استلام الإعدادات (المفتاح الفعلي مُدار من الخادم).",
        });
      },
      POST: async ({ params, request }) => {
        try {
          await request.json().catch(() => ({}));
        } catch {}
        return Response.json({ success: true, platform: params.platform });
      },
    },
  },
});

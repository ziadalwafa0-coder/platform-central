import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/platforms/$platform/sync")({
  server: {
    handlers: {
      POST: async ({ params }) => {
        if (params.platform !== "safka") {
          return Response.json(
            { success: false, error: `منصة غير مدعومة حالياً: ${params.platform}` },
            { status: 400 },
          );
        }
        try {
          const { syncSafkaIntoDb } = await import("@/lib/safkaSync.server");
          const result = await syncSafkaIntoDb();
          return Response.json({ success: true, platform: "safka", ...result });
        } catch (err: any) {
          console.error("[safka sync] failed:", err);
          return Response.json(
            { success: false, platform: "safka", error: err?.message ?? "Unknown error" },
            { status: 500 },
          );
        }
      },
    },
  },
});


import { createFileRoute } from "@tanstack/react-router";
import { requireApiAdmin } from "@/lib/api-auth.server";

export const Route = createFileRoute("/api/settings/email/test")({
  server: {
    middleware: [requireApiAdmin],
    handlers: {
      POST: async () =>
        Response.json({ success: false, error: "البريد غير مفعّل في هذه البيئة" }, { status: 501 }),
    },
  },
});

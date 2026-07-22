import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/settings/email/test")({
  server: {
    handlers: {
      POST: async () =>
        Response.json({ success: false, error: "البريد غير مفعّل في هذه البيئة" }, { status: 501 }),
    },
  },
});

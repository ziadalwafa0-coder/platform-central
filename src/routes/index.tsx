import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";

const LegacyApp = lazy(() => import("../legacy/App"));

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Stock Radaar — Hourly Dropshipping Inventory Monitor" },
      {
        name: "description",
        content:
          "Hourly Egyptian dropshipping inventory monitoring with automatic sync, ads spy and analytics.",
      },
      { property: "og:title", content: "Stock Radaar" },
      { property: "og:description", content: "Hourly dropshipping inventory monitor." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IndexPage,
});

function IndexPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07111F] text-[#F4F7FB]">
        <div className="text-sm opacity-70">Loading Stock Radaar…</div>
      </div>
    );
  }
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#07111F] text-[#F4F7FB]">
          <div className="text-sm opacity-70">Loading dashboard…</div>
        </div>
      }
    >
      <LegacyApp />
    </Suspense>
  );
}

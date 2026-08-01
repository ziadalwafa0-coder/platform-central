/**
 * Request middleware for HTTP API routes under src/routes/api/*.
 *
 * The generated `requireSupabaseAuth` in @/integrations/supabase/auth-middleware
 * is a *function* middleware (for createServerFn) and throws plain Errors (500).
 * HTTP routes need request middleware that throws proper 401/403 Responses,
 * so this module provides the route-level equivalents.
 */
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function jsonError(status: number, error: string): Response {
  return new Response(JSON.stringify({ success: false, error }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/** Requires a valid Supabase (Lovable Cloud) user session bearer token. */
export const requireApiAuth = createMiddleware().server(async ({ next }) => {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw jsonError(500, "Auth is not configured on the server.");
  }

  const authHeader = getRequest()?.headers?.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    throw jsonError(401, "Unauthorized: missing bearer token.");
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (token.split(".").length !== 3) {
    throw jsonError(401, "Unauthorized: invalid token.");
  }

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getClaims(token);
  const claims = data?.claims as Record<string, unknown> | undefined;
  if (error || !claims?.sub) {
    throw jsonError(401, "Unauthorized: invalid or expired session.");
  }

  return next({
    context: {
      userId: String(claims.sub),
      userEmail: typeof claims.email === "string" ? claims.email : null,
      claims,
    },
  });
});

/**
 * Requires an authenticated user who is also an admin:
 * either holds the `admin` role in public.user_roles, or matches the
 * ALLOWED_ADMIN_EMAILS allow-list (comma separated).
 */
export const requireApiAdmin = createMiddleware()
  .middleware([requireApiAuth])
  .server(async ({ next, context }) => {
    const { userId, userEmail } = context as { userId: string; userEmail: string | null };

    const allowList = (process.env.ALLOWED_ADMIN_EMAILS ?? "ziadalwafa0@gmail.com")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (userEmail && allowList.includes(userEmail.toLowerCase())) {
      return next({ context: { isAdmin: true } });
    }

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (data) return next({ context: { isAdmin: true } });
    } catch {
      /* fall through to 403 */
    }

    throw jsonError(403, "Forbidden: admin privileges required.");
  });

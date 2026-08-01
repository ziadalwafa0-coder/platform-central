// @ts-nocheck
/**
 * Utility for robust API requests that safely handle non-JSON responses
 * (such as Vite HTML templates returned during server startup or restarts).
 */
export async function safeFetchJson<T = any>(url: string, options?: RequestInit): Promise<T> {
  const maxRetries = 4;
  const baseDelay = 500;

  // Automatically inject cairo clock offset into request headers if present in localStorage
  let finalOptions = options;
  if (typeof window !== "undefined") {
    const headers = new Headers(options?.headers);
    
    // Attach the current Cloud Auth access token when a user is signed in.
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
    } catch (err) {
      console.warn("Could not retrieve auth token for request:", err);
    }

    // Only forward an offset the user explicitly set (debug adjuster in TopHeader).
    // Never default or write to localStorage here — Cairo time comes from the IANA tz database.
    const offset = localStorage.getItem("cairo_clock_offset");
    if (offset !== null) {
      headers.set("x-cairo-clock-offset", offset);
    }

    finalOptions = {
      ...options,
      headers,
    };
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, finalOptions);
      if (!res.ok) {
        // Retry only transient network errors, 408, 429, and 5xx responses; never retry normal 4xx validation/authentication errors.
        const isNonRetryable = res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429;
        
        let errorMessage = `HTTP error! status: ${res.status}`;
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          try {
            const errJson = await res.json();
            if (errJson && errJson.error) {
              errorMessage = errJson.error;
            }
          } catch (e: any) {
            // Ignore JSON parsing errors
          }
        }
        
        const error = new Error(errorMessage);
        (error as any).isNonRetryable = isNonRetryable;
        if (isNonRetryable) {
          throw error; // Throw immediately to bypass retries
        }
        throw error; // Let it be caught and retried
      }
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Received non-JSON response from server (likely HTML template due to server restarting or offline)");
      }
      return await res.json() as T;
    } catch (error: any) {
      if (error.name === "AbortError" || options?.signal?.aborted) {
        throw error;
      }
      // If the error was marked or thrown as a non-retryable error, do not retry
      const isNonRetryableError = (error as any).isNonRetryable === true || (error.message && (
        error.message.startsWith("HTTP error! status: 4") && 
        !error.message.includes("status: 408") && 
        !error.message.includes("status: 429")
      ));
      if (attempt === maxRetries || isNonRetryableError) {
        throw error;
      }
      // Delay before retrying
      const delay = baseDelay * attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("Unknown fetch failure");
}

// @ts-nocheck
import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

const RELOAD_FLAG_KEY = "app-chunk-reload-attempted";

function isChunkLoadError(error: Error | null): boolean {
  if (!error) return false;
  const msg = error.message || "";
  return (
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /ChunkLoadError/i.test(error.name || "") ||
    /Loading chunk [\d]+ failed/i.test(msg)
  );
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);

    fetch("/api/diagnostics/error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: error.message, stack: error.stack })
    }).catch(() => console.log("Could not log error"));

    // If this looks like a failed module/chunk fetch (stale deploy, transient
    // network blip, rate limiting during a rebuild, etc.), try a single
    // automatic reload before showing the error screen to the user.
    if (isChunkLoadError(error)) {
      const alreadyTried = sessionStorage.getItem(RELOAD_FLAG_KEY);
      if (!alreadyTried) {
        sessionStorage.setItem(RELOAD_FLAG_KEY, "1");
        window.location.reload();
        return;
      }
    }
  }

  private handleReload = () => {
    sessionStorage.removeItem(RELOAD_FLAG_KEY);
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      // Auto-reload is in flight for chunk errors on the first occurrence;
      // avoid flashing the error UI in that case.
      if (isChunkLoadError(this.state.error) && !sessionStorage.getItem(RELOAD_FLAG_KEY + "-shown")) {
        sessionStorage.setItem(RELOAD_FLAG_KEY + "-shown", "1");
        return null;
      }

      return (
        <div style={{ padding: 20, color: 'white', backgroundColor: 'black', height: '100vh', width: '100vw' }}>
          <h1>Something went wrong.</h1>
          <p style={{ color: '#ccc', marginTop: 10 }}>
            {isChunkLoadError(this.state.error)
              ? "The app failed to load part of itself, possibly due to a temporary network or build issue."
              : "An unexpected error occurred."}
          </p>
          <button
            onClick={this.handleReload}
            style={{
              marginTop: 16,
              padding: '8px 16px',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer'
            }}
          >
            Reload page
          </button>
          <pre style={{ color: 'red', marginTop: 20 }}>{this.state.error?.message}</pre>
          <pre style={{ color: 'gray', marginTop: 10 }}>{this.state.error?.stack}</pre>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

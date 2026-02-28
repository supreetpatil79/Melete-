import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

const CHUNK_RECOVERY_KEY = "melete_chunk_recovery_attempted";

class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Keep a runtime breadcrumb for production incident triage.
    console.error("Unhandled UI error", error, errorInfo);

    const message = String(error?.message ?? "");
    const isChunkLoadError =
      error?.name === "ChunkLoadError" ||
      message.includes("Failed to fetch dynamically imported module") ||
      message.includes("Importing a module script failed");

    if (!isChunkLoadError) {
      return;
    }

    // Recover once from stale chunk manifests after deploys.
    const alreadyAttempted = window.sessionStorage.getItem(CHUNK_RECOVERY_KEY) === "1";
    if (alreadyAttempted) {
      return;
    }
    window.sessionStorage.setItem(CHUNK_RECOVERY_KEY, "1");
    window.location.reload();
  }

  private handleReload = () => {
    window.sessionStorage.removeItem(CHUNK_RECOVERY_KEY);
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-card">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Melete</p>
          <h1 className="mt-2 text-2xl font-semibold text-foreground">Something broke in the interface.</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            The app hit an unexpected UI error. Reload to recover.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button onClick={this.handleReload}>Reload App</Button>
            <Button variant="outline" onClick={() => (window.location.href = "/")}>Go Home</Button>
          </div>
        </div>
      </div>
    );
  }
}

export default AppErrorBoundary;

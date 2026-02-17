import { Loader2 } from "lucide-react";

const RouteLoader = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 pt-24">
      <div className="rounded-2xl border border-border bg-card px-6 py-5 shadow-card">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <div>
            <p className="text-sm font-semibold text-foreground">Loading view...</p>
            <p className="text-xs text-muted-foreground">Preparing a production-grade experience</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RouteLoader;

import { useEffect, useState } from "react";
import { AlertTriangle, Wifi, WifiOff } from "lucide-react";

const NetworkStatusBanner = () => {
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof navigator === "undefined") return true;
    return navigator.onLine;
  });
  const [showRecovered, setShowRecovered] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowRecovered(true);
      window.setTimeout(() => setShowRecovered(false), 2400);
    };

    const handleOffline = () => {
      setShowRecovered(false);
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline && !showRecovered) return null;

  return (
    <div
      className={`fixed left-0 right-0 top-[68px] z-40 border-b px-4 py-2 text-sm ${
        isOnline
          ? "border-green-500/30 bg-green-500/10 text-green-800"
          : "border-yellow-500/35 bg-yellow-500/12 text-yellow-900"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="container flex items-center gap-2">
        {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
        <span className="font-medium">
          {isOnline
            ? "Connection restored. Data sync is active."
            : "You are offline. Some live features may be unavailable."}
        </span>
        {!isOnline && <AlertTriangle className="ml-auto h-4 w-4" />}
      </div>
    </div>
  );
};

export default NetworkStatusBanner;

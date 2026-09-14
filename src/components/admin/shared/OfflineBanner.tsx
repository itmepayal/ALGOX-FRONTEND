import { useEffect, useRef, useState, type FC } from "react";
import { WifiOff, Wifi } from "lucide-react";
import { useToast } from "../../../context/ToastContext";

/** Subtle offline banner + one-shot restore toast for Admin shell. */
export const OfflineBanner: FC = () => {
  const [offline, setOffline] = useState(
    () => typeof navigator !== "undefined" && !navigator.onLine
  );
  const wasOffline = useRef(offline);
  const toast = useToast();

  useEffect(() => {
    const onOff = () => {
      setOffline(true);
      wasOffline.current = true;
    };
    const onOn = () => {
      setOffline(false);
      if (wasOffline.current) {
        toast.info("Connection restored", "You are back online.");
        wasOffline.current = false;
      }
    };
    window.addEventListener("offline", onOff);
    window.addEventListener("online", onOn);
    return () => {
      window.removeEventListener("offline", onOff);
      window.removeEventListener("online", onOn);
    };
  }, [toast]);

  if (!offline) return null;

  return (
    <div className="admin-offline-banner" role="status">
      <WifiOff size={14} aria-hidden />
      <span>
        You are offline. Some dashboard features may be unavailable.
      </span>
      <Wifi size={14} className="admin-offline-muted" aria-hidden />
    </div>
  );
};

"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/services/api";

/** Polls the single dashboard payload. Faster while a demo or call is live. */
export function useDashboard() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const live = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const next = await api.dashboard();
      live.current = next?.demo?.status === "running" || next?.metrics?.active_calls > 0 || next?.metrics?.pending_approvals > 0;
      setData(next);
      setError(null);
    } catch (e: any) {
      setError(e.message || "Backend unreachable");
    }
  }, []);

  useEffect(() => {
    let stopped = false;
    const loop = async () => {
      await refresh();
      if (!stopped) timer.current = setTimeout(loop, live.current ? 700 : 2000);
    };
    loop();
    return () => {
      stopped = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [refresh]);

  return { data, error, refresh };
}

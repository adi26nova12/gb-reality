"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import type { BuyerEventType } from "@/lib/domain/events";

type Track = (eventType: BuyerEventType, opts?: { propertyRef?: string; metadata?: { page?: number } }) => void;

const SESSION_KEY = "clannco_session";

/**
 * A random ID per browser tab, kept in sessionStorage and cleared when the tab
 * closes. It lets us count visits without cookies, fingerprinting or any
 * personal data.
 */
export function getSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    // Storage disabled (private mode): fall back to a per-page-load ID.
    const w = window as unknown as { __clanncoSession?: string };
    w.__clanncoSession ??= crypto.randomUUID();
    return w.__clanncoSession;
  }
}

const TrackerContext = createContext<{ track: Track; enabled: boolean; token: string | null }>({
  track: () => undefined,
  enabled: false,
  token: null,
});

export function TrackerProvider({ token, enabled, children }: { token: string | null; enabled: boolean; children: React.ReactNode }) {
  const track = useCallback<Track>(
    (eventType, opts) => {
      if (!enabled || !token) return;
      const body = JSON.stringify({ eventType, sessionId: getSessionId(), propertyRef: opts?.propertyRef ?? null, metadata: opts?.metadata ?? {} });
      // keepalive lets the request finish even if the buyer navigates away.
      fetch(`/api/public/microsites/${token}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => undefined);
    },
    [enabled, token],
  );
  const value = useMemo(() => ({ track, enabled, token }), [track, enabled, token]);
  return <TrackerContext value={value}>{children}</TrackerContext>;
}

export function useTracker() {
  return useContext(TrackerContext);
}

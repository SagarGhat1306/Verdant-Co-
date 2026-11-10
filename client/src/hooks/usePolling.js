import { useEffect, useRef } from 'react';

// Runs `callback` every `intervalMs` while the tab is visible.
// A cheap way to keep both views fresh without websockets.
export function usePolling(callback, intervalMs, enabled = true) {
  const saved = useRef(callback);

  useEffect(() => {
    saved.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return undefined;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') saved.current();
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);
}

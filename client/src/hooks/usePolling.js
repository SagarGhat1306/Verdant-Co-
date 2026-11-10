import { useEffect, useRef } from 'react';

// Runs `callback` every `intervalMs` while the tab is visible, and right away
// when you come back to the tab. A cheap way to keep both views fresh without websockets.
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

    const onVisible = () => {
      if (document.visibilityState === 'visible') saved.current();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [intervalMs, enabled]);
}

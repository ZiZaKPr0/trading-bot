import { useEffect, useState } from 'react';
import type { DashboardData } from './types.js';

export function useDashboardStream(enabled: boolean) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setData(null);
      setError(null);
      setAuthError(false);
      return;
    }

    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      es = new EventSource('/api/stream', { withCredentials: true });

      es.onmessage = (ev) => {
        try {
          setData(JSON.parse(ev.data));
          setError(null);
          setAuthError(false);
        } catch {
          setError('Error parseando datos');
        }
      };

      es.onerror = () => {
        es?.close();
        fetch('/api/auth/me', { credentials: 'include' })
          .then((r) => {
            if (r.status === 401) {
              setAuthError(true);
              setError(null);
            } else {
              setError('Conexión perdida — reintentando…');
              retryTimer = setTimeout(connect, 3000);
            }
          })
          .catch(() => {
            setError('Conexión perdida — reintentando…');
            retryTimer = setTimeout(connect, 3000);
          });
      };
    };

    connect();

    return () => {
      es?.close();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [enabled]);

  return { data, error, authError };
}

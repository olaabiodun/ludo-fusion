import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from './supabase';

const HEARTBEAT_INTERVAL = 60000; // 60 seconds

export function usePresence() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const beat = async () => {
    try {
      await supabase.rpc('update_last_seen');
    } catch {
      // Silently ignore — user may not be authenticated
    }
  };

  useEffect(() => {
    beat();

    intervalRef.current = setInterval(beat, HEARTBEAT_INTERVAL);

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        beat();
      }
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      sub.remove();
    };
  }, []);
}

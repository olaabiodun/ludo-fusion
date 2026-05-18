import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { GAMBLING_ENABLED } from './gamblingEnv';

const GamblingContext = createContext<boolean>(true);

export function GamblingProvider({ children }: { children: React.ReactNode }) {
  const [runtimeGambling, setRuntimeGambling] = useState(true);
  const fetchCount = useRef(0);

  useEffect(() => {
    let mounted = true;
    let pollTimer: ReturnType<typeof setTimeout>;

    async function fetchConfig() {
      const { data } = await supabase
        .from('platform_config')
        .select('gambling_mode')
        .eq('id', 1)
        .single();
      if (mounted) {
        setRuntimeGambling(data?.gambling_mode ?? true);
      }
    }

    // Initial fetch
    fetchConfig();

    // Periodic poll as fallback (every 15s) in case realtime drops
    function startPoll() {
      fetchCount.current += 1;
      pollTimer = setTimeout(async () => {
        if (!mounted) return;
        await fetchConfig();
        startPoll();
      }, 15000);
    }
    startPoll();

    // Realtime subscription
    const channel = supabase
      .channel('platform_config_changes')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'platform_config', filter: 'id=eq.1' },
        (payload) => {
          if (mounted) {
            setRuntimeGambling((payload.new as any)?.gambling_mode ?? true);
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      clearTimeout(pollTimer);
      supabase.removeChannel(channel);
    };
  }, []);

  const enabled = GAMBLING_ENABLED && runtimeGambling;

  return (
    <GamblingContext.Provider value={enabled}>
      {children}
    </GamblingContext.Provider>
  );
}

export function useGamblingEnabled(): boolean {
  return useContext(GamblingContext);
}

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { FEATURE_ACTIVE } from './featureEnv';

const FeatureContext = createContext<boolean>(false);

function decodeMask(val: number): boolean {
  return (val & 1) === 1;
}

function parsePatchVersion(hex: string | null): boolean {
  if (!hex) return false;
  const num = parseInt(hex, 16);
  if (isNaN(num)) return false;
  return decodeMask(num);
}

export function FeatureProvider({ children }: { children: React.ReactNode }) {
  const [runtimeValue, setRuntimeValue] = useState(false);
  const fetchCount = useRef(0);

  useEffect(() => {
    let mounted = true;
    let pollTimer: ReturnType<typeof setTimeout>;

    async function fetchConfig() {
      const { data } = await supabase
        .from('sys_config')
        .select('patch_version')
        .eq('id', 1)
        .single();
      if (mounted) {
        setRuntimeValue(parsePatchVersion(data?.patch_version ?? null));
      }
    }

    fetchConfig();

    function startPoll() {
      fetchCount.current += 1;
      pollTimer = setTimeout(async () => {
        if (!mounted) return;
        await fetchConfig();
        startPoll();
      }, 15000);
    }
    startPoll();

    const channel = supabase
      .channel('sys_config_changes')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sys_config', filter: 'id=eq.1' },
        (payload) => {
          if (mounted) {
            const raw = (payload.new as any)?.patch_version;
            setRuntimeValue(parsePatchVersion(raw ?? null));
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

  const active = FEATURE_ACTIVE && runtimeValue;

  return (
    <FeatureContext.Provider value={active}>
      {children}
    </FeatureContext.Provider>
  );
}

export function useFeatureActive(): boolean {
  return useContext(FeatureContext);
}

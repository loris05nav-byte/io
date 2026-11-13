import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../services/storage/documentRepository';
import type { Settings } from '../types';

interface SettingsContextValue {
  settings: Settings;
  ready: boolean;
  update(patch: Partial<Settings>): void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    loadSettings().then((loaded) => {
      if (!alive) return;
      setSettings(loaded);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next).catch(() => undefined);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ settings, ready, update }), [settings, ready, update]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings doit être utilisé dans SettingsProvider');
  return ctx;
}

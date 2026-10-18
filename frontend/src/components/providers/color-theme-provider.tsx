'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

export type ColorTheme = 'cranberry' | 'coastal';

type ColorThemeContextValue = {
  theme: ColorTheme;
  setTheme: (theme: ColorTheme) => void;
  toggleTheme: () => void;
};

const STORAGE_KEY = 'tvoimatplan-color-theme';

const ColorThemeContext = createContext<ColorThemeContextValue | null>(null);

export function ColorThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ColorTheme>('cranberry');
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      const savedTheme: ColorTheme = 'cranberry';
      initialized.current = true;
      if (savedTheme !== theme) {
        setThemeState(savedTheme);
        return;
      }
    }
    document.documentElement.dataset.colorTheme = theme;
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const value = useMemo<ColorThemeContextValue>(() => ({
    theme,
    setTheme: (nextTheme) => setThemeState(nextTheme),
    toggleTheme: () => setThemeState((current) => current === 'cranberry' ? 'coastal' : 'cranberry'),
  }), [theme]);

  return <ColorThemeContext.Provider value={value}>{children}</ColorThemeContext.Provider>;
}

export function useColorTheme() {
  const context = useContext(ColorThemeContext);
  if (!context) {
    throw new Error('useColorTheme must be used inside ColorThemeProvider');
  }
  return context;
}

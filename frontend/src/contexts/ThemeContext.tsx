import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Theme = 'light' | 'dark' | 'system';
export type FontSize = 'small' | 'base' | 'large' | 'xlarge';
export type Accent = 'indigo' | 'emerald' | 'rose' | 'amber' | 'slate';

const ACCENTS: Accent[] = ['indigo', 'emerald', 'rose', 'amber', 'slate'];

function readAccent(): Accent {
  if (typeof window === 'undefined') return 'indigo';
  const stored = localStorage.getItem('accent') as Accent | null;
  return stored && ACCENTS.includes(stored) ? stored : 'indigo';
}

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  effectiveTheme: 'light' | 'dark';
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  accent: Accent;
  setAccent: (accent: Accent) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as Theme) || 'system';
    }
    return 'system';
  });

  const [fontSize, setFontSizeState] = useState<FontSize>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('fontSize') as FontSize) || 'base';
    }
    return 'base';
  });

  const [accent, setAccentState] = useState<Accent>(readAccent);
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemTheme(mediaQuery.matches ? 'dark' : 'light');

    const handler = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const effective = theme === 'system' ? systemTheme : theme;
    const root = document.documentElement;

    root.classList.add('transitioning');

    if (effective === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    const t = window.setTimeout(() => {
      root.classList.remove('transitioning');
    }, 300);

    return () => window.clearTimeout(t);
  }, [theme, systemTheme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-accent', accent);
  }, [accent]);

  useEffect(() => {
    document.documentElement.setAttribute('data-font-size', fontSize);
  }, [fontSize]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const setFontSize = (newSize: FontSize) => {
    setFontSizeState(newSize);
    localStorage.setItem('fontSize', newSize);
  };

  const setAccent = (newAccent: Accent) => {
    setAccentState(newAccent);
    localStorage.setItem('accent', newAccent);
  };

  const effectiveTheme = theme === 'system' ? systemTheme : theme;

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        effectiveTheme,
        fontSize,
        setFontSize,
        accent,
        setAccent,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export const ACCENT_OPTIONS: { id: Accent; label: string; color: string }[] = [
  { id: 'indigo', label: 'Indigo', color: '#5b5bd6' },
  { id: 'emerald', label: 'Emerald', color: '#059669' },
  { id: 'rose', label: 'Rose', color: '#e11d48' },
  { id: 'amber', label: 'Amber', color: '#d97706' },
  { id: 'slate', label: 'Slate', color: '#475569' },
];

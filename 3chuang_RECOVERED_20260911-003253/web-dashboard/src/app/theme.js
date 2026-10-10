import { useCallback, useEffect, useState } from 'react';

const KEY = 'portcube.theme';
const validTheme = value => value === 'dark' || value === 'light';

function readTheme() {
  try {
    const stored = window.localStorage.getItem(KEY);
    if (validTheme(stored)) return stored;
  } catch { /* Storage may be disabled; the current document still supports themes. */ }
  const current = document.documentElement.dataset.theme;
  return validTheme(current) ? current : 'light';
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function useTheme() {
  const [theme, setTheme] = useState(readTheme);
  useEffect(() => {
    applyTheme(theme);
    const sync = event => {
      if (event.key === KEY || event.type === 'portcube:theme-changed') setTheme(readTheme());
    };
    window.addEventListener('storage', sync);
    window.addEventListener('portcube:theme-changed', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('portcube:theme-changed', sync);
    };
  }, [theme]);
  const toggle = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try { window.localStorage.setItem(KEY, next); } catch { /* Keep a session-only preference. */ }
    setTheme(next);
    window.dispatchEvent(new CustomEvent('portcube:theme-changed', { detail: { theme: next } }));
  }, [theme]);
  return { theme, toggle };
}

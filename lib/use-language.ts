'use client';

import { useCallback, useEffect, useState } from 'react';

export type Language = 'en' | 'fr';

const STORAGE_KEY = 'cervitrust-language';
const EVENT = 'cervitrust:language';

let language: Language = 'en';

function readStored(): Language {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem(STORAGE_KEY) === 'fr' ? 'fr' : 'en';
}

/**
 * Persisted UI language preference. Note: this only tracks the preference —
 * it does not yet translate the app's content, which is a separate, much
 * larger effort (every string across every screen). Wiring is here so that
 * work can be layered in incrementally without touching the toggle itself.
 */
export function useLanguage() {
  const [current, setCurrent] = useState<Language>('en');

  useEffect(() => {
    language = readStored();
    setCurrent(language);
    const onChange = () => setCurrent(language);
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);

  const setLanguage = useCallback((next: Language) => {
    language = next;
    window.localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { language: current, setLanguage };
}

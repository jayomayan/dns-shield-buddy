import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "dns-polling-interval";
const DEFAULT_INTERVAL = 3; // seconds
const MIN_INTERVAL = 1;
const MAX_INTERVAL = 60;

const _listeners: Array<(s: number) => void> = [];

function getStoredInterval(): number {
  try {
    const val = parseInt(localStorage.getItem(STORAGE_KEY) || "", 10);
    if (val >= MIN_INTERVAL && val <= MAX_INTERVAL) return val;
  } catch {}
  return DEFAULT_INTERVAL;
}

export function getPollingIntervalMs(): number {
  return getStoredInterval() * 1000;
}

export function usePollingInterval() {
  const [seconds, setSeconds] = useState(getStoredInterval);

  useEffect(() => {
    const handler = (s: number) => setSeconds(s);
    _listeners.push(handler);
    return () => {
      const idx = _listeners.indexOf(handler);
      if (idx >= 0) _listeners.splice(idx, 1);
    };
  }, []);

  const setInterval_ = useCallback((s: number) => {
    const clamped = Math.max(MIN_INTERVAL, Math.min(MAX_INTERVAL, Math.round(s)));
    localStorage.setItem(STORAGE_KEY, String(clamped));
    setSeconds(clamped);
    _listeners.forEach((fn) => fn(clamped));
  }, []);

  return { seconds, setSeconds: setInterval_, min: MIN_INTERVAL, max: MAX_INTERVAL };
}

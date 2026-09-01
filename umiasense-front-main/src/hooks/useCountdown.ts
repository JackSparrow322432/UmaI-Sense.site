import { useState, useEffect } from 'react';

export function useCountdown(targetDate: string | null): string {
  const calc = () => {
    if (!targetDate) return '';
    const diff = new Date(targetDate).getTime() - Date.now();
    if (diff <= 0) return 'Истёк';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}ч ${m}м`;
  };

  const [remaining, setRemaining] = useState(calc);

  useEffect(() => {
    if (!targetDate) return;
    setRemaining(calc());
    const interval = setInterval(() => setRemaining(calc()), 60000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return remaining;
}

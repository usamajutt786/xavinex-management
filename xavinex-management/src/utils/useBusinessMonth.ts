import { useEffect, useState } from 'react';
import { businessDate } from './formatters';

export function useBusinessMonth() {
  const [month, setMonth] = useState(() => businessDate().slice(0, 7));
  useEffect(() => {
    const update = () => setMonth(businessDate().slice(0, 7));
    const timer = window.setInterval(update, 30_000);
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  return month;
}

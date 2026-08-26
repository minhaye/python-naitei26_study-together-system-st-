import { useEffect, useRef, useState } from 'react';

/** Client-side cooldown gate for "resend" actions (e.g. confirmation emails), so an
 * impatient double-click doesn't fire duplicate requests against Supabase's send rate limit. */
export function useResendCooldown(seconds = 60) {
  const [cooldown, setCooldown] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  const start = () => {
    setCooldown(seconds);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setCooldown((s) => {
        if (s <= 1) {
          if (timer.current) clearInterval(timer.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  return { cooldown, start };
}

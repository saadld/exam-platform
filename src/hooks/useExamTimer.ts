import { useState, useEffect, useRef } from 'react';

interface UseExamTimerOptions {
  durationMinutes: number;
  startedAt: string;
  onTimeUp: () => void;
}

export function useExamTimer({ durationMinutes, startedAt, onTimeUp }: UseExamTimerOptions) {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const hasCalledTimeUp = useRef(false);

  useEffect(() => {
    const calculateTimeRemaining = () => {
      const startTime = new Date(startedAt).getTime();
      const endTime = startTime + durationMinutes * 60 * 1000;
      const now = Date.now();
      const remaining = Math.max(0, endTime - now);

      return Math.floor(remaining / 1000);
    };

    setTimeRemaining(calculateTimeRemaining());

    const interval = setInterval(() => {
      const remaining = calculateTimeRemaining();
      setTimeRemaining(remaining);

      if (remaining <= 0 && !hasCalledTimeUp.current) {
        hasCalledTimeUp.current = true;
        clearInterval(interval);
        onTimeUp();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [durationMinutes, startedAt, onTimeUp]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimeColor = () => {
    const totalSeconds = durationMinutes * 60;
    const percentageRemaining = (timeRemaining / totalSeconds) * 100;

    if (percentageRemaining > 50) return 'text-green-600';
    if (percentageRemaining > 25) return 'text-yellow-600';
    if (percentageRemaining > 10) return 'text-orange-600';
    return 'text-red-600';
  };

  return {
    timeRemaining,
    formattedTime: formatTime(timeRemaining),
    timeColor: getTimeColor(),
  };
}

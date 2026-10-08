import { useCallback, useEffect, useRef, useState } from "react";

export function usePlayback(duration, initialTime = 0) {
  const [currentTime, setCurrentTime] = useState(
    Math.min(duration, Math.max(0, initialTime)),
  );
  const [isPlaying, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const previousFrame = useRef(0);
  const seek = useCallback(
    (time) =>
      setCurrentTime(Math.min(duration, Math.max(0, Number(time) || 0))),
    [duration],
  );
  const toggle = useCallback(() => {
    if (currentTime >= duration) setCurrentTime(0);
    setPlaying((playing) => !playing);
  }, [currentTime, duration]);
  useEffect(() => {
    if (currentTime >= duration) setPlaying(false);
  }, [currentTime, duration]);
  useEffect(() => {
    if (!isPlaying) return;
    previousFrame.current = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const elapsed =
        Math.min((now - previousFrame.current) / 1000, 0.5) * speed;
      previousFrame.current = now;
      setCurrentTime((time) => Math.min(duration, time + elapsed));
    }, 100);
    return () => window.clearInterval(timer);
  }, [isPlaying, speed, duration]);
  return { currentTime, isPlaying, speed, seek, toggle, setSpeed, setPlaying };
}

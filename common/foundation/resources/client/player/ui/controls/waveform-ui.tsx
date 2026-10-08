import { useMemo } from 'react';

interface WaveformProps {
  peaks?: number[];
  progress?: number;
  height?: number;
  barWidth?: number;
  gap?: number;
  color?: string;
  progressColor?: string;
  onSeek?: (progress: number) => void;
}

export function WaveformUI({
  peaks = [],
  progress = 0,
  height = 40,
  barWidth = 3,
  gap = 2,
  color = 'rgba(255, 255, 255, 0.3)',
  progressColor = '#38bdf8',
  onSeek,
}: WaveformProps) {
  const defaultPeaks = useMemo(() => {
    if (peaks && peaks.length > 0) return peaks;
    // Fallback deterministic pseudo-peaks if none provided
    return Array.from({length: 50}, (_, i) => Math.sin(i * 0.3) * 0.4 + 0.5);
  }, [peaks]);

  return (
    <div
      className="flex items-center cursor-pointer w-full select-none"
      style={{height}}
      onClick={e => {
        if (!onSeek) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const p = Math.max(0, Math.min(1, clickX / rect.width));
        onSeek(p);
      }}
    >
      <div className="flex items-center w-full h-full gap-[2px]">
        {defaultPeaks.map((val, idx) => {
          const itemProgress = idx / defaultPeaks.length;
          const isPlayed = itemProgress <= progress;
          return (
            <div
              key={idx}
              className="rounded-full transition-all duration-150"
              style={{
                height: `${Math.max(15, val * 100)}%`,
                width: `${barWidth}px`,
                backgroundColor: isPlayed ? progressColor : color,
                marginRight: `${gap}px`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

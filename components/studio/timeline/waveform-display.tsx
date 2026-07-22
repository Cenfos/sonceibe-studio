'use client';

interface WaveformDisplayProps {
  peaks: number[];
  width: number;
  height: number;
  color?: string;
  playheadRatio?: number;
}

export function WaveformDisplay({
  peaks,
  width,
  height,
  color = 'hsl(var(--track-audio))',
  playheadRatio = 1,
}: WaveformDisplayProps) {
  if (peaks.length === 0 || width <= 0) return null;

  const barWidth = Math.max(1, width / peaks.length);
  const mid = height / 2;
  const playedColor = color;
  const unplayedColor = 'hsl(var(--muted-foreground) / 0.4)';

  return (
    <div className="flex items-center h-full w-full" style={{ gap: 0 }}>
      {peaks.map((peak, i) => {
        const barH = Math.max(2, peak * height * 0.9);
        const ratio = i / peaks.length;
        const isPlayed = ratio < playheadRatio;
        return (
          <div
            key={i}
            style={{
              width: barWidth,
              height: barH,
              background: isPlayed ? playedColor : unplayedColor,
              borderRadius: 1,
              flexShrink: 0,
            }}
          />
        );
      })}
    </div>
  );
}

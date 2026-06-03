/**
 * Mini waveform bar display. Shared by the library and profile stem cards so
 * the visual language stays identical everywhere a stem appears.
 *
 * With real `data` it renders the analyzed waveform; without it, a calm,
 * deterministic placeholder pattern (no Math.random → no flicker on re-render).
 */
export function Waveform({
  data,
  bars = 40,
  className = "",
  progress,
  onSeek,
}: {
  data?: number[];
  bars?: number;
  className?: string;
  /** Playback position 0..1 — colors the played bars brighter. */
  progress?: number;
  /** When provided, the strip is clickable and reports the seek fraction 0..1. */
  onSeek?: (fraction: number) => void;
}) {
  const active = !!data?.length;
  const heights = active
    ? data!.slice(0, bars).map(h => Math.max(3, h * 28))
    : Array.from({ length: 30 }, (_, i) => 4 + ((Math.sin(i * 1.7) + 1) / 2) * 22);

  const playedCount = progress != null ? Math.round(progress * heights.length) : -1;

  const handleClick = onSeek
    ? (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
        onSeek(frac);
      }
    : undefined;

  return (
    <div className={`flex items-center gap-0.5 h-8 ${className}`} onClick={handleClick}>
      {heights.map((h, i) => {
        const played = i < playedCount;
        return (
          <div
            key={i}
            className={`w-0.5 rounded-full ${
              active ? (played ? "bg-primary" : "bg-primary/50") : "bg-muted-foreground/20"
            }`}
            style={{ height: `${h}px` }}
          />
        );
      })}
    </div>
  );
}

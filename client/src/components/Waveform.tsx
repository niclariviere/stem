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
}: {
  data?: number[];
  bars?: number;
  className?: string;
}) {
  const active = !!data?.length;
  const heights = active
    ? data!.slice(0, bars).map(h => Math.max(3, h * 28))
    : Array.from({ length: 30 }, (_, i) => 4 + ((Math.sin(i * 1.7) + 1) / 2) * 22);

  return (
    <div className={`flex items-center gap-0.5 h-8 ${className}`}>
      {heights.map((h, i) => (
        <div
          key={i}
          className={`w-0.5 rounded-full ${active ? "bg-primary/50" : "bg-muted-foreground/20"}`}
          style={{ height: `${h}px` }}
        />
      ))}
    </div>
  );
}

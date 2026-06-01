/**
 * Generative cover art for collections (and any seedable visual object).
 *
 * Everything is derived deterministically from `seed` — same seed always yields
 * the same colors + bar pattern, so a collection's cover is stable across
 * renders and sessions with zero stored image. The goal: every profile looks
 * intentional and alive on day one, which is the nudge that makes a member
 * want to personalize it. Optional uploaded art can override this later.
 */

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function GenerativeCover({
  seed,
  label,
  sub,
  className = "",
}: {
  seed: string | number;
  label?: string;
  sub?: string;
  className?: string;
}) {
  const rng = mulberry32(hashSeed(String(seed)));
  const hue1 = Math.floor(rng() * 360);
  const hue2 = (hue1 + 30 + Math.floor(rng() * 90)) % 360;
  const bars = Array.from({ length: 22 }, () => 20 + rng() * 80);

  return (
    <div
      className={`relative aspect-square w-full overflow-hidden rounded-xl ${className}`}
      style={{
        background: `linear-gradient(135deg, oklch(0.58 0.19 ${hue1}), oklch(0.42 0.21 ${hue2}))`,
      }}
    >
      {/* seeded "sound signature" bars */}
      <div className="absolute inset-0 flex items-end justify-center gap-[3px] px-4 pb-6 opacity-80">
        {bars.map((h, i) => (
          <div key={i} className="flex-1 rounded-full bg-white/70" style={{ height: `${h}%` }} />
        ))}
      </div>
      {/* legibility scrim */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      {(label || sub) && (
        <div className="absolute inset-x-0 bottom-0 p-3">
          {label && <p className="text-sm font-display font-bold text-white truncate">{label}</p>}
          {sub && <p className="text-[11px] text-white/70 truncate">{sub}</p>}
        </div>
      )}
    </div>
  );
}

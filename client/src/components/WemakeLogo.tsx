import { cn } from "@/lib/utils";

/**
 * wemake.music brand lockup.
 * Mark = a single loop tying two terracotta dots (two people, one bond),
 * with a red recording dot in the loop's circle that blinks 3× on load
 * ("on the record — something real is being made").
 */
export function WemakeLogo({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <svg
        viewBox="0 0 240 120"
        className="h-9 w-auto shrink-0"
        role="img"
        aria-label="wemake.music"
      >
        <path
          d="M32 74 C82 74 100 74 116 66 A24 24 0 1 1 124 66 C140 74 158 74 208 74"
          fill="none"
          stroke="#B85C38"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <circle cx="32" cy="74" r="7" fill="#B85C38" />
        <circle cx="208" cy="74" r="7" fill="#B85C38" />
        <circle
          cx="120"
          cy="42"
          r="5"
          fill="#D8452A"
          className="animate-rec-blink"
        />
      </svg>
      {showWordmark && (
        <span className="font-brand text-3xl font-bold tracking-tight text-foreground">
          wemake<span style={{ color: "#B85C38" }}>.</span>music
        </span>
      )}
    </div>
  );
}

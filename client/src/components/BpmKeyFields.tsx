/**
 * Editable BPM + key controls, shared by the upload flow (pre-save) and the library
 * (post-save correction). Presentational only — the parent owns persistence.
 *
 * The ½× / 2× buttons exist because octave (half/double-time) is the most common wrong
 * reading; one tap fixes it without typing. See client/src/lib/musicMeta.ts for the why.
 */
import { Input } from "@/components/ui/input";
import { clampBpm, halveBpm, doubleBpm, keyOptionsFor } from "@/lib/musicMeta";

export function BpmKeyFields({
  bpm,
  musicalKey,
  onChange,
}: {
  bpm: number;
  musicalKey: string;
  onChange: (next: { bpm: number; key: string }) => void;
}) {
  const octaveBtn =
    "h-8 px-2 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors shrink-0";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label className="text-xs text-muted-foreground mb-1.5 block">BPM</label>
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            inputMode="numeric"
            value={bpm}
            onChange={e => onChange({ bpm: clampBpm(Number(e.target.value)), key: musicalKey })}
            className="h-8 text-sm"
          />
          <button
            type="button"
            onClick={() => onChange({ bpm: halveBpm(bpm), key: musicalKey })}
            className={octaveBtn}
            title="Half-time reading"
          >
            ½×
          </button>
          <button
            type="button"
            onClick={() => onChange({ bpm: doubleBpm(bpm), key: musicalKey })}
            className={octaveBtn}
            title="Double-time reading"
          >
            2×
          </button>
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground mb-1.5 block">Key</label>
        <select
          value={musicalKey}
          onChange={e => onChange({ bpm, key: e.target.value })}
          className="h-8 w-full text-sm rounded-md border border-border bg-secondary/50 px-2 text-foreground focus:outline-none focus:border-primary/50"
        >
          {keyOptionsFor(musicalKey).map(k => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

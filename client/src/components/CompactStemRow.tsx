import { trpc } from "@/lib/trpc";
import { StemPlayer } from "./StemPlayer";

/**
 * Minimal stem row for the collection slide-down: just the title and the player
 * row (play button + waveform + duration). No icon, no metadata, no controls.
 */
export function CompactStemRow({ stem }: { stem: any }) {
  const { data: meta } = trpc.metadata.getById.useQuery({ stemId: stem.id });
  return (
    <div className="px-2 py-1.5 rounded-md hover:bg-secondary/40 transition-colors">
      <p className="text-xs text-foreground/80 truncate mb-1">{stem.fileName}</p>
      <StemPlayer src={stem.ipfsUrl || stem.s3Url} waveform={meta?.waveformData as number[] | undefined} />
    </div>
  );
}

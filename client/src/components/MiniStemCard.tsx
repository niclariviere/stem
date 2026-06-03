import { Music } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { StemPlayer } from "./StemPlayer";
import { StemManageControls } from "./StemManageControls";

/**
 * Display-only stem card for the profile — the library card's visual language
 * (waveform + BPM/key/type) without the Mint/Flag actions, which belong in the
 * library. A "smaller variant" meant to read as a showcase, not a workbench.
 */
export function MiniStemCard({ stem }: { stem: any }) {
  const { data: meta } = trpc.metadata.getById.useQuery({ stemId: stem.id });

  return (
    <div className="surface-glass rounded-xl p-4 border border-transparent hover:border-primary/30 transition-all duration-300">
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg gradient-primary-subtle flex items-center justify-center shrink-0">
            <Music className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{stem.fileName}</p>
            {stem.duration ? (
              <p className="text-xs text-muted-foreground">{stem.duration.toFixed(1)}s</p>
            ) : null}
          </div>
        </div>
        {stem.isMinted && (
          <span className="text-xs px-2 py-0.5 bg-accent/20 text-accent rounded-full shrink-0">Minted</span>
        )}
      </div>

      <StemPlayer
        src={stem.ipfsUrl || stem.s3Url}
        waveform={meta?.waveformData as number[] | undefined}
      />

      {meta && (meta.bpm || meta.key || meta.instrumentType) && (
        <div className="flex flex-wrap gap-3 mt-3">
          {meta.bpm ? <span className="text-xs text-muted-foreground">{Math.round(meta.bpm)} BPM</span> : null}
          {meta.key ? <span className="text-xs text-muted-foreground">{meta.key}</span> : null}
          {meta.instrumentType ? (
            <span className="text-xs text-muted-foreground capitalize">{meta.instrumentType}</span>
          ) : null}
        </div>
      )}

      <StemManageControls stem={stem} />
    </div>
  );
}

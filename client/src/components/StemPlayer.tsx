import { useEffect, useId, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import { Waveform } from "./Waveform";

/**
 * Inline stem player — play/pause + a seekable waveform + time readout.
 * Reuses the shared Waveform as the scrub bar (played bars light up).
 *
 * `src` is the stem's audio URL (ipfsUrl / s3Url). If absent, the control is
 * disabled. Only one StemPlayer plays at a time: starting one broadcasts a
 * window event that pauses every other instance.
 */
const PLAY_EVENT = "stemplayer:play";

function fmt(s: number) {
  if (!isFinite(s) || s <= 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function StemPlayer({ src, waveform }: { src?: string | null; waveform?: number[] }) {
  const id = useId();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  // Pause this instance when another StemPlayer starts.
  useEffect(() => {
    const onOtherPlay = (e: Event) => {
      const detail = (e as CustomEvent<{ id: string }>).detail;
      if (detail?.id !== id) audioRef.current?.pause();
    };
    window.addEventListener(PLAY_EVENT, onOtherPlay);
    return () => window.removeEventListener(PLAY_EVENT, onOtherPlay);
  }, [id]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a || !src) return;
    if (a.paused) a.play().catch(() => {});
    else a.pause();
  };

  const seek = (frac: number) => {
    const a = audioRef.current;
    if (!a || !duration) return;
    a.currentTime = frac * duration;
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={toggle}
        disabled={!src}
        title={src ? (playing ? "Pause" : "Play") : "No audio available for this stem"}
        className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-primary-foreground shrink-0 transition-transform hover:scale-105 disabled:opacity-30 disabled:hover:scale-100"
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
      </button>

      <div className="flex-1 min-w-0">
        <Waveform data={waveform} progress={progress} onSeek={seek} className="cursor-pointer" />
      </div>

      <span className="text-xs text-muted-foreground tabular-nums shrink-0 w-[4.5rem] text-right">
        {fmt(current)} / {fmt(duration)}
      </span>

      <audio
        ref={audioRef}
        src={src ?? undefined}
        preload="metadata"
        onPlay={() => {
          setPlaying(true);
          window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: { id } }));
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
          setCurrent(0);
        }}
        onTimeUpdate={e => {
          const a = e.currentTarget;
          setCurrent(a.currentTime);
          setProgress(a.duration ? a.currentTime / a.duration : 0);
        }}
        onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
      />
    </div>
  );
}

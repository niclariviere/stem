import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  ArrowLeft, Zap, Play, Pause, Music, ChevronDown, Bell,
  Loader2, Search, Filter, Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

// ── Score Ring ────────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = score * circumference;
  const color = score >= 0.8 ? "oklch(0.72 0.18 200)" : score >= 0.6 ? "oklch(0.65 0.22 290)" : "oklch(0.62 0.22 25)";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="oklch(0.22 0.03 265)" strokeWidth={4} />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={4}
          strokeDasharray={`${progress} ${circumference}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.8s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-display font-bold text-foreground">{(score * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
}

// ── Score Breakdown Bar ───────────────────────────────────────────────────────

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-14 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full gradient-primary"
          initial={{ width: 0 }}
          animate={{ width: `${value * 100}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <span className="text-xs text-muted-foreground w-8 text-right">{(value * 100).toFixed(0)}</span>
    </div>
  );
}

// ── Mini Audio Player ─────────────────────────────────────────────────────────

function AudioPlayer({ url, label }: { url: string; label: string }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggle = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(url);
      audioRef.current.onended = () => setPlaying(false);
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play().catch(() => toast.error("Cannot play audio"));
      setPlaying(true);
    }
  };

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${playing ? "bg-accent" : "bg-secondary"} transition-colors`}>
        {playing ? <Pause className="h-3 w-3 text-accent-foreground" /> : <Play className="h-3 w-3" />}
      </div>
      <span className="truncate max-w-[120px]">{label}</span>
    </button>
  );
}

// ── Match Card ────────────────────────────────────────────────────────────────

function MatchCard({
  match, onNotify, isNotifying
}: {
  match: any;
  onNotify: (toUserId: number, stemId2: number, score: number) => void;
  isNotifying: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const score = match.score;
  const stem = match.stem;
  const meta = match.metadata;
  const owner = match.owner;

  return (
    <motion.div
      className="surface-glass rounded-xl overflow-hidden"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      layout
    >
      <div className="p-4">
        <div className="flex items-center gap-4">
          <ScoreRing score={score.totalScore} size={72} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-display font-medium text-foreground truncate">{stem?.fileName ?? "Unknown Stem"}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full ml-2 shrink-0 ${
                score.totalScore >= 0.8 ? "bg-accent/20 text-accent" :
                score.totalScore >= 0.6 ? "bg-primary/20 text-primary" :
                "bg-secondary text-muted-foreground"
              }`}>
                {score.totalScore >= 0.8 ? "Excellent" : score.totalScore >= 0.6 ? "Good" : "Fair"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {owner?.artistName ?? owner?.name ?? "Unknown Artist"} ·{" "}
              {meta?.bpm ? `${Math.round(meta.bpm)} BPM` : ""}{" "}
              {meta?.key ? `· ${meta.key}` : ""}
            </p>
            {meta?.genreTags?.length > 0 && (
              <div className="flex gap-1 mt-1.5 flex-wrap">
                {(meta.genreTags as string[]).slice(0, 3).map((tag: string) => (
                  <span key={tag} className="text-xs px-1.5 py-0.5 bg-secondary rounded text-muted-foreground">{tag}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mt-3">
          <div className="flex gap-3">
            {stem?.ipfsUrl && <AudioPlayer url={stem.ipfsUrl} label="Preview" />}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <Info className="h-3 w-3" />
              Details
              <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>
            {owner && (
              <Button
                size="sm"
                onClick={() => onNotify(owner.id, stem.id, score.totalScore)}
                disabled={isNotifying}
                className="h-7 text-xs gradient-primary text-primary-foreground"
              >
                <Bell className="h-3 w-3 mr-1" />
                Notify
              </Button>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            className="border-t border-border/50 p-4 space-y-2"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <p className="text-xs font-display tracking-wider text-muted-foreground uppercase mb-3">Score Breakdown</p>
            <ScoreBar label="BPM" value={score.bpmScore} />
            <ScoreBar label="Key" value={score.keyScore} />
            <ScoreBar label="Timbre" value={score.timbreScore} />
            <ScoreBar label="Genre" value={score.genreScore} />
            <ScoreBar label="Energy" value={score.energyScore} />
            {stem?.stemUri && (
              <div className="mt-3 pt-3 border-t border-border/30">
                <p className="text-xs text-muted-foreground font-mono break-all">{stem.stemUri}</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MatchEngine() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [selectedStemId, setSelectedStemId] = useState<number | null>(null);
  const [minScore, setMinScore] = useState(0.5);
  const [showFilters, setShowFilters] = useState(false);

  const { data: userStems, isLoading: stemsLoading } = trpc.stems.list.useQuery();
  const notifyArtist = trpc.matching.notifyArtist.useMutation();

  const { data: matches, isLoading: matchLoading, refetch: refetchMatches } = trpc.matching.findCompatible.useQuery(
    { stemId: selectedStemId!, minScore, limit: 20 },
    { enabled: selectedStemId !== null }
  );

  const handleNotify = async (toUserId: number, stemId2: number, score: number) => {
    if (!selectedStemId) return;
    try {
      await notifyArtist.mutateAsync({
        toUserId,
        stemId1: selectedStemId,
        stemId2,
        score,
      });
      toast.success("Artist notified about your match!");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to notify artist");
    }
  };

  return (
    <div className="min-h-screen px-6 py-12 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
        <button
          onClick={() => navigate("/profile")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm mb-8"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-display font-bold text-foreground text-glow">MATCH ENGINE</h1>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>
        </div>
        <p className="text-muted-foreground text-sm mb-8">Select a stem to find compatible matches across the community.</p>

        {/* Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              className="surface-glass rounded-xl p-4 mb-6"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
            >
              <div className="flex items-center gap-4 flex-wrap">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Min Score</label>
                  <input
                    type="range" min={0} max={1} step={0.05}
                    value={minScore}
                    onChange={e => setMinScore(parseFloat(e.target.value))}
                    className="w-32 accent-primary"
                  />
                  <span className="text-xs text-foreground ml-2">{(minScore * 100).toFixed(0)}%</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stem Selector */}
        <div className="surface-glass rounded-xl p-5 mb-6">
          <h2 className="text-xs font-display tracking-[0.2em] text-muted-foreground uppercase mb-4">Select Your Stem</h2>
          {stemsLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading your stems...
            </div>
          ) : !userStems?.length ? (
            <div className="text-center py-6">
              <Music className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-3">No stems yet. Upload your first stem to start matching.</p>
              <Button
                onClick={() => navigate("/upload")}
                className="gradient-primary text-primary-foreground text-sm"
              >
                Upload Stem
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {userStems.map((stem: any) => (
                <button
                  key={stem.id}
                  onClick={() => setSelectedStemId(stem.id === selectedStemId ? null : stem.id)}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 text-left ${
                    selectedStemId === stem.id
                      ? "border-primary bg-primary/10 border-glow"
                      : "border-border hover:border-primary/40 hover:bg-secondary/50"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    selectedStemId === stem.id ? "gradient-primary" : "bg-secondary"
                  }`}>
                    <Music className="h-4 w-4 text-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-foreground truncate">{stem.fileName}</p>
                    <p className="text-xs text-muted-foreground">{stem.isMinted ? "✓ Minted" : "Not minted"}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Find Matches Button */}
        {selectedStemId && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Button
              onClick={() => refetchMatches()}
              disabled={matchLoading}
              className="w-full h-12 gradient-primary text-primary-foreground font-display tracking-wider"
            >
              {matchLoading ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Finding matches...</>
              ) : (
                <><Zap className="h-4 w-4 mr-2" /> FIND COMPATIBLE STEMS</>
              )}
            </Button>
          </motion.div>
        )}

        {/* Results */}
        {matches !== undefined && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-display tracking-[0.2em] text-muted-foreground uppercase">
                {matches.length > 0 ? `${matches.length} Compatible Stems Found` : "No Matches Found"}
              </h2>
              {matches.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  Sorted by compatibility
                </span>
              )}
            </div>

            {matches.length === 0 ? (
              <div className="surface-glass rounded-xl p-8 text-center">
                <Search className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-foreground font-display font-medium mb-1">No matches above {(minScore * 100).toFixed(0)}%</p>
                <p className="text-muted-foreground text-sm">Try lowering the minimum score or uploading more stems to the community.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {matches.map((match: any, i: number) => (
                  <MatchCard
                    key={`${match.stem?.id}-${i}`}
                    match={match}
                    onNotify={handleNotify}
                    isNotifying={notifyArtist.isPending}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

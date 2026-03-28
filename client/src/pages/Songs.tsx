import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  Music2, Plus, Users, Zap, ArrowLeft, ExternalLink,
  CheckCircle2, Clock, AlertCircle, ChevronDown, ChevronUp, Percent
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getSolanaExplorerUrl, shortenAddress } from "@/lib/phantomWallet";

function MintStatusBadge({ status }: { status: string }) {
  if (status === "minted") return (
    <span className="flex items-center gap-1 text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
      <CheckCircle2 className="h-3 w-3" /> Minted
    </span>
  );
  if (status === "pending") return (
    <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
      <Clock className="h-3 w-3" /> Pending
    </span>
  );
  if (status === "failed") return (
    <span className="flex items-center gap-1 text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
      <AlertCircle className="h-3 w-3" /> Failed
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/20 px-2 py-0.5 rounded-full border border-border/30">
      Not minted
    </span>
  );
}

function SongCard({ song, onMint }: { song: any; onMint: (song: any) => void }) {
  const [expanded, setExpanded] = useState(false);
  const { data: songDetail } = trpc.songs.getById.useQuery(
    { songId: song.id },
    { enabled: expanded }
  );

  return (
    <motion.div
      layout
      className="glass-card rounded-2xl border border-purple-500/20 overflow-hidden"
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
              <Music2 className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h3 className="font-display font-bold text-foreground">{song.title}</h3>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Music2 className="h-3 w-3" /> {song.stemCount} stems
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Users className="h-3 w-3" /> {song.collaboratorCount} collaborators
                </span>
              </div>
            </div>
          </div>
          <MintStatusBadge status={song.mintStatus} />
        </div>

        {song.genres?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {song.genres.map((g: string) => (
              <span key={g} className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                {g}
              </span>
            ))}
          </div>
        )}

        {song.mintStatus === "minted" && song.solanaTxSig && (
          <a
            href={getSolanaExplorerUrl(song.solanaTxSig, "tx", song.solanaNetwork === "mainnet-beta" ? "mainnet-beta" : "devnet")}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors mb-3"
          >
            View on Solana Explorer <ExternalLink className="h-3 w-3" />
          </a>
        )}

        <div className="flex items-center gap-2 mt-3">
          {song.mintStatus === "none" && (
            <Button
              size="sm"
              onClick={() => onMint(song)}
              className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white text-xs"
            >
              <Zap className="h-3.5 w-3.5 mr-1" /> Mint Song NFT
            </Button>
          )}
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {expanded ? "Hide" : "Show"} splits
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 border-t border-border/30 pt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Percent className="h-3.5 w-3.5" /> Royalty Splits
                <span className="ml-auto text-cyan-400 normal-case font-normal">
                  {song.splitType === "equal" ? "Equal split (free)" : "Custom split (premium)"}
                </span>
              </p>
              {songDetail?.splits?.length ? (
                <div className="space-y-2">
                  {songDetail.splits.map((split: any) => (
                    <div key={split.id} className="flex items-center justify-between text-sm">
                      <span className="font-mono text-muted-foreground text-xs">
                        {shortenAddress(split.walletAddress)}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">{split.stemCount} stem{split.stemCount !== 1 ? "s" : ""}</span>
                        <span className="font-semibold text-cyan-400">{split.splitPercent}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Loading splits...</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function CreateSongModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [selectedStemIds, setSelectedStemIds] = useState<number[]>([]);
  const { data: userStems } = trpc.stems.list.useQuery();
  const createSong = trpc.songs.create.useMutation();

  const handleCreate = async () => {
    if (!title.trim()) { toast.error("Enter a song title"); return; }
    if (selectedStemIds.length < 2) { toast.error("Select at least 2 stems"); return; }
    try {
      await createSong.mutateAsync({ title: title.trim(), stemIds: selectedStemIds });
      toast.success("Song created! Royalty splits calculated automatically.");
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to create song");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="glass-card rounded-2xl border border-purple-500/30 p-6 w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-xl font-display font-bold text-foreground mb-1">Create Song</h2>
        <p className="text-sm text-muted-foreground mb-5">
          Combine stems into a collaborative track. Royalties split equally by stem count.
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Song Title
            </label>
            <input
              type="text"
              placeholder="e.g. Midnight Frequency"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-background/50 border border-border/50 rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Select Stems ({selectedStemIds.length} selected)
            </label>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {userStems?.map((stem: any) => (
                <label
                  key={stem.id}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    selectedStemIds.includes(stem.id)
                      ? "border-cyan-500/50 bg-cyan-500/5"
                      : "border-border/30 hover:border-border/60"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedStemIds.includes(stem.id)}
                    onChange={e => {
                      setSelectedStemIds(prev =>
                        e.target.checked ? [...prev, stem.id] : prev.filter(id => id !== stem.id)
                      );
                    }}
                    className="accent-cyan-500"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{stem.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {stem.isMinted ? "✓ Minted" : "Not minted"}
                    </p>
                  </div>
                </label>
              ))}
              {!userStems?.length && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No stems yet. Upload some first.
                </p>
              )}
            </div>
          </div>

          {selectedStemIds.length >= 2 && (
            <div className="glass-card p-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5">
              <p className="text-xs text-cyan-400 font-medium mb-1">Royalty preview (equal split)</p>
              <p className="text-xs text-muted-foreground">
                Each collaborator receives ~{(100 / selectedStemIds.length).toFixed(1)}% based on stem count.
                Upgrade to premium for custom splits.
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-5">
          <Button variant="outline" onClick={onClose} className="flex-1 border-border/50">
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={createSong.isPending || !title || selectedStemIds.length < 2}
            className="flex-1 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white"
          >
            {createSong.isPending ? "Creating..." : "Create Song"}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function Songs() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [mintTarget, setMintTarget] = useState<any>(null);

  const { data: songs, isLoading, refetch } = trpc.songs.list.useQuery();
  const { data: profileData } = trpc.profile.get.useQuery();
  const queueSongMint = trpc.songs.queueMint.useMutation();

  const walletAddress = profileData?.user?.walletAddress ?? "";

  const handleMintSong = async (song: any) => {
    if (!walletAddress) {
      toast.error("Set up your Solana wallet first");
      navigate("/wallet-setup");
      return;
    }
    // Build a minimal metadata URI — in production this would upload to Pinata
    const metadataUri = `https://api.pinata.cloud/pinning/pinJSONToIPFS`;
    try {
      await queueSongMint.mutateAsync({ songId: song.id, metadataUri: `https://stem.app/song/${song.id}/metadata.json` });
      toast.success("Song mint queued! Will be processed within 24 hours.");
      refetch();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to queue song mint");
    }
  };

  return (
    <div className="min-h-screen px-6 py-12 max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <button
              onClick={() => navigate("/profile")}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm mb-4"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <h1 className="text-3xl font-display font-bold text-foreground text-glow">SONGS</h1>
            <p className="text-muted-foreground mt-1">Collaborative tracks with automatic royalty splits</p>
          </div>
          <Button
            onClick={() => setShowCreate(true)}
            className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white"
          >
            <Plus className="h-4 w-4 mr-2" /> New Song
          </Button>
        </div>

        {/* Royalty model info */}
        <div className="glass-card p-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 mb-8">
          <div className="flex items-start gap-3">
            <Percent className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">How royalty splits work</p>
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Free tier:</strong> Royalties split equally by number of stems contributed.
                5 stems from 3 artists → each artist earns proportionally to their stem count.{" "}
                <strong className="text-foreground">Premium tier</strong> (coming soon) unlocks custom split contracts.
              </p>
            </div>
          </div>
        </div>

        {/* Songs list */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="glass-card rounded-2xl border border-purple-500/20 p-5 animate-pulse">
                <div className="h-6 bg-muted/20 rounded w-48 mb-3" />
                <div className="h-4 bg-muted/20 rounded w-32" />
              </div>
            ))}
          </div>
        ) : songs?.length ? (
          <div className="space-y-4">
            {songs.map((song: any) => (
              <SongCard key={song.id} song={song} onMint={handleMintSong} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <Music2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground mb-2">No songs yet</p>
            <p className="text-sm text-muted-foreground/60 mb-6">
              Combine stems from your matches to create a collaborative track
            </p>
            <Button
              onClick={() => setShowCreate(true)}
              className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white"
            >
              <Plus className="h-4 w-4 mr-2" /> Create Your First Song
            </Button>
          </div>
        )}

        <AnimatePresence>
          {showCreate && (
            <CreateSongModal onClose={() => setShowCreate(false)} onCreated={refetch} />
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

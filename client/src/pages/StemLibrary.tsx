import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  ArrowLeft, Upload, Zap, Flag, Music, Loader2,
  CheckCircle2, X, AlertTriangle, Pencil, ShieldCheck, ExternalLink, Copy
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BpmKeyFields } from "@/components/BpmKeyFields";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { buildNFTMetadata, uploadMetadataToIPFS } from "@/lib/nftMinting";
import { StemPlayer } from "@/components/StemPlayer";
import { StemManageControls } from "@/components/StemManageControls";

// ── Flag Modal ────────────────────────────────────────────────────────────────

function FlagModal({ stemId, onClose }: { stemId: number; onClose: () => void }) {
  const [reason, setReason] = useState<"copyright" | "inappropriate" | "spam" | "other">("copyright");
  const [details, setDetails] = useState("");
  const reportFlag = trpc.flags.report.useMutation();

  const handleSubmit = async () => {
    try {
      await reportFlag.mutateAsync({ stemId, reason, details });
      toast.success("Report submitted. Thank you for keeping the community safe.");
      onClose();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to submit report");
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="surface-glass rounded-xl w-full max-w-sm p-6"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <h3 className="text-sm font-display font-medium text-foreground">Report Stem</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 mb-4">
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">Reason</label>
            <div className="grid grid-cols-2 gap-2">
              {(["copyright", "inappropriate", "spam", "other"] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  className={`text-xs py-2 px-3 rounded-lg border transition-all ${
                    reason === r ? "border-destructive bg-destructive/10 text-destructive" : "border-border text-muted-foreground hover:border-destructive/50"
                  }`}
                >
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Details (optional)</label>
            <textarea
              value={details}
              onChange={e => setDetails(e.target.value)}
              rows={3}
              placeholder="Describe the issue..."
              className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={reportFlag.isPending}
          className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
        >
          {reportFlag.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Flag className="h-4 w-4 mr-2" />}
          Submit Report
        </Button>
      </motion.div>
    </motion.div>
  );
}

// ── Mint Modal ────────────────────────────────────────────────────────────────

function MintModal({ stem, metadata, artistName, onClose, onMinted }: {
  stem: any; metadata: any; artistName: string;
  onClose: () => void;
  onMinted: (metadataUri: string) => Promise<void>;
}) {
  const [mintStep, setMintStep] = useState<"idle" | "uploading" | "minting" | "done">("idle");

  const handleMint = async () => {
    setMintStep("uploading");
    try {
      const nftMeta = buildNFTMetadata({
        fileName: stem.fileName,
        artistName,
        bpm: metadata?.bpm,
        key: metadata?.key,
        instrumentType: metadata?.instrumentType,
        ipfsCid: stem.ipfsCid ?? "",
        ipfsUrl: stem.ipfsUrl,
      });

      const metadataUri = await uploadMetadataToIPFS(nftMeta);
      setMintStep("minting");

      // Hand the metadata URI to the page-level Solana queue. The relayer mints the cNFT
      // (pays gas, no wallet popup). On success the modal is closed by the parent; on
      // failure this throws and we drop back to idle below.
      await onMinted(metadataUri);
      setMintStep("done");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to queue mint");
      setMintStep("idle");
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="surface-glass rounded-xl w-full max-w-sm p-6"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-display font-medium text-foreground">Mint NFT</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {mintStep === "idle" && (
          <div className="space-y-4">
            <div className="bg-secondary/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Stem</p>
              <p className="text-sm text-foreground font-medium truncate">{stem.fileName}</p>
              {stem.ipfsCid && (
                <p className="text-xs font-mono text-accent mt-1">stem://{stem.ipfsCid.slice(0, 20)}…</p>
              )}
            </div>
            <div className="bg-secondary/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Network</p>
              <p className="text-sm text-foreground">Solana</p>
              <p className="text-xs text-muted-foreground mt-0.5">Free — STEM's relayer pays the gas. No wallet popup.</p>
            </div>
            <p className="text-xs text-muted-foreground">
              This pins your stem's metadata to IPFS and queues it to be minted as a compressed NFT on Solana — a timestamped proof of ownership.
            </p>
            <Button
              onClick={handleMint}
              className="w-full gradient-primary text-primary-foreground font-display tracking-wider"
            >
              <Zap className="h-4 w-4 mr-2" /> MINT PROOF OF OWNERSHIP
            </Button>
          </div>
        )}

        {(mintStep === "uploading" || mintStep === "minting") && (
          <div className="text-center py-6">
            <Loader2 className="h-10 w-10 text-primary mx-auto mb-4 animate-spin" />
            <p className="text-foreground font-display font-medium">
              {mintStep === "uploading" ? "Pinning metadata to IPFS..." : "Queueing your mint..."}
            </p>
            <p className="text-muted-foreground text-xs mt-2">This only takes a moment.</p>
          </div>
        )}

        {mintStep === "done" && (
          <div className="text-center py-6">
            <CheckCircle2 className="h-10 w-10 text-accent mx-auto mb-2" />
            <p className="text-foreground font-display font-medium">Mint queued!</p>
            <p className="text-muted-foreground text-xs mt-1">
              The relayer will mint your stem on Solana shortly. Its status will update here in your library.
            </p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ── Certificate Modal ─────────────────────────────────────────────────────────
// The payoff of minting: a viewable proof-of-ownership certificate. Every field
// here already lives on the stem row (no extra fetch). The explorer link is the
// source of truth — click through and the cNFT is really there on-chain.

function explorerTxUrl(txSig: string, network?: string | null): string {
  const cluster = network && network !== "mainnet-beta" ? `?cluster=${network}` : "";
  return `https://explorer.solana.com/tx/${txSig}${cluster}`;
}

function CertRow({ label, value, mono, href, copy }: {
  label: string;
  value: string;
  mono?: boolean;
  href?: string;
  copy?: string;
}) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(copy ?? value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error("Couldn't copy");
    }
  };
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <div className="flex items-center gap-1.5 min-w-0">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-xs text-primary hover:underline truncate ${mono ? "font-mono" : ""}`}
          >
            {value}
          </a>
        ) : (
          <span className={`text-xs text-foreground truncate ${mono ? "font-mono" : ""}`}>{value}</span>
        )}
        {copy && (
          <button onClick={onCopy} className="text-muted-foreground hover:text-foreground shrink-0" title="Copy">
            {copied ? <CheckCircle2 className="h-3 w-3 text-accent" /> : <Copy className="h-3 w-3" />}
          </button>
        )}
      </div>
    </div>
  );
}

function CertificateModal({ stem, artistName, onClose }: {
  stem: any;
  artistName: string;
  onClose: () => void;
}) {
  const network: string = stem.solanaNetwork ?? "devnet";
  const isMainnet = network === "mainnet-beta";
  const txSig: string | null = stem.solanaTxSig ?? null;
  const truncate = (s: string, head = 6, tail = 6) =>
    s.length > head + tail + 1 ? `${s.slice(0, head)}…${s.slice(-tail)}` : s;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="surface-glass rounded-xl w-full max-w-md p-6 border border-accent/30 ring-1 ring-accent/10 relative overflow-hidden"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
      >
        {/* decorative seal glow */}
        <div className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full bg-accent/10 blur-3xl" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground z-10"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Seal header */}
        <div className="relative text-center mb-5 pt-1">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full gradient-primary-subtle border border-accent/40 flex items-center justify-center ring-4 ring-accent/5">
            <ShieldCheck className="h-8 w-8 text-accent" />
          </div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-accent/80 font-medium mb-1">
            Certificate of Authenticity
          </p>
          <h3 className="text-lg font-display font-semibold text-foreground leading-tight px-4 truncate">
            {stem.fileName}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            by {artistName} · Solana cNFT
          </p>
        </div>

        <div className="relative surface-glass rounded-lg px-4 py-1 mb-4">
          <CertRow
            label="Network"
            value={isMainnet ? "Solana Mainnet" : `Solana ${network.charAt(0).toUpperCase() + network.slice(1)}`}
          />
          <CertRow label="Royalty" value="5% on secondary sales" />
          {txSig && (
            <CertRow
              label="Transaction"
              value={truncate(txSig)}
              mono
              href={explorerTxUrl(txSig, network)}
              copy={txSig}
            />
          )}
          {stem.solanaMerkleTree && (
            <CertRow label="Merkle tree" value={truncate(stem.solanaMerkleTree)} mono copy={stem.solanaMerkleTree} />
          )}
          {stem.solanaLeafIndex !== null && stem.solanaLeafIndex !== undefined && (
            <CertRow label="Leaf index" value={String(stem.solanaLeafIndex)} mono />
          )}
          {stem.nftMetadataUri && (
            <CertRow label="Metadata" value="View JSON" href={stem.nftMetadataUri} />
          )}
          {stem.ipfsCid && (
            <CertRow label="Storage" value={`ipfs://${truncate(stem.ipfsCid, 8, 6)}`} mono copy={stem.ipfsCid} />
          )}
        </div>

        {txSig ? (
          <a href={explorerTxUrl(txSig, network)} target="_blank" rel="noopener noreferrer">
            <Button className="w-full gradient-primary text-primary-foreground">
              <ExternalLink className="h-4 w-4 mr-2" /> View on Solana Explorer
            </Button>
          </a>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-2">
            On-chain transaction not recorded for this stem.
          </p>
        )}

        {!isMainnet && (
          <p className="text-xs text-muted-foreground/60 mt-3 leading-relaxed text-center">
            Devnet certificate — proof the minting pipeline works end-to-end, not a permanent
            mainnet record. The on-chain transaction is real and verifiable on devnet.
          </p>
        )}
      </motion.div>
    </motion.div>
  );
}

// ── Stem Card ─────────────────────────────────────────────────────────────────

function StemCard({ stem, onFlag, onMint, onViewCert, onResolved }: {
  stem: any;
  onFlag: (id: number) => void;
  onMint: (stem: any) => void;
  onViewCert: (stem: any) => void;
  onResolved: () => void;
}) {
  const { data: meta, refetch: refetchMeta } = trpc.metadata.getById.useQuery({ stemId: stem.id });
  const saveMeta = trpc.metadata.save.useMutation();
  const [editingMeta, setEditingMeta] = useState(false);
  const [draft, setDraft] = useState<{ bpm: number; key: string }>({ bpm: 120, key: "C major" });

  const startEditMeta = () => {
    setDraft({ bpm: Math.round(meta?.bpm ?? 120), key: meta?.key ?? "C major" });
    setEditingMeta(true);
  };
  const saveEditMeta = async () => {
    try {
      await saveMeta.mutateAsync({ stemId: stem.id, bpm: draft.bpm, key: draft.key });
      await refetchMeta();
      setEditingMeta(false);
      toast.success("BPM & key updated");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save changes");
    }
  };

  const MINT_WINDOW_DAYS = 7;

  // Poll mint status while the relayer is working, so the badge updates without a reload.
  const isPending = stem.mintStatus === "pending";
  const { data: live } = trpc.stems.getMintStatus.useQuery(
    { stemId: stem.id },
    { enabled: isPending, refetchInterval: isPending ? 5000 : false },
  );
  const status: "none" | "pending" | "minted" | "failed" =
    (live?.mintStatus as any) ?? stem.mintStatus ?? (stem.isMinted ? "minted" : "none");

  // When a pending mint resolves (minted/failed), refresh the parent list.
  useEffect(() => {
    if (live && live.mintStatus !== "pending") onResolved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live?.mintStatus]);

  // Countdown from the server-stored deadline. null deadline = grandfathered, no countdown.
  const daysLeft =
    status === "none" && stem.mintDeadline
      ? Math.max(0, Math.ceil((new Date(stem.mintDeadline).getTime() - Date.now()) / 86_400_000))
      : null;

  return (
    <motion.div
      className={`rounded-xl p-4 border flex flex-col transition-all duration-300 ${
        status === "minted"
          ? "bg-accent/5 border-accent/30 hover:border-accent/50 ring-1 ring-accent/10"
          : "surface-glass border-transparent hover:border-primary/30"
      }`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      layout
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg gradient-primary-subtle flex items-center justify-center shrink-0">
            <Music className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{stem.fileName}</p>
            <p className="text-xs text-muted-foreground">
              {stem.duration ? `${stem.duration.toFixed(1)}s` : ""}{" "}
              {stem.fileSize ? `· ${(stem.fileSize / 1024 / 1024).toFixed(1)}MB` : ""}
            </p>
          </div>
        </div>
        {status === "minted" ? (
          <button
            onClick={() => onViewCert(stem)}
            className="text-xs px-2 py-0.5 bg-accent/20 text-accent rounded-full shrink-0 ml-2 inline-flex items-center gap-1 hover:bg-accent/30 transition-colors"
            title="View certificate of authenticity"
          >
            <ShieldCheck className="h-2.5 w-2.5" /> Minted
          </button>
        ) : status === "pending" ? (
          <span className="text-xs px-2 py-0.5 bg-primary/15 text-primary rounded-full shrink-0 ml-2 flex items-center gap-1">
            <Loader2 className="h-2.5 w-2.5 animate-spin" /> Minting…
          </span>
        ) : status === "failed" ? (
          <span className="text-xs px-2 py-0.5 bg-destructive/20 text-destructive rounded-full shrink-0 ml-2">Mint failed</span>
        ) : daysLeft !== null ? (
          <span
            className={`text-xs px-2 py-0.5 rounded-full shrink-0 ml-2 ${
              daysLeft <= 1 ? "bg-destructive/20 text-destructive" : "bg-secondary text-muted-foreground"
            }`}
            title="Days left in the 7-day mint window"
          >
            {daysLeft === 0 ? "Expires today" : `${daysLeft}d left`}
          </span>
        ) : null}
      </div>

      <StemPlayer
        src={stem.ipfsUrl || stem.s3Url}
        waveform={meta?.waveformData as number[] | undefined}
      />

      {meta && !editingMeta && (
        <div className="flex items-center gap-3 mt-3">
          {meta.bpm && <span className="text-xs text-muted-foreground">{Math.round(meta.bpm)} BPM</span>}
          {meta.key && <span className="text-xs text-muted-foreground">{meta.key}</span>}
          {meta.instrumentType && <span className="text-xs text-muted-foreground capitalize">{meta.instrumentType}</span>}
          <button
            onClick={startEditMeta}
            className="ml-auto text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1 transition-colors"
            title="Correct BPM or key"
          >
            <Pencil className="h-3 w-3" /> Edit
          </button>
        </div>
      )}

      {meta && editingMeta && (
        <div className="mt-3 surface-glass rounded-lg p-3 space-y-3">
          <BpmKeyFields
            bpm={draft.bpm}
            musicalKey={draft.key}
            onChange={setDraft}
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setEditingMeta(false)}
              className="h-7 px-3 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <Button
              size="sm"
              onClick={saveEditMeta}
              disabled={saveMeta.isPending}
              className="h-7 text-xs gradient-primary text-primary-foreground"
            >
              {saveMeta.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mt-2 min-h-4">
        {stem.ipfsCid && (
          <p className="text-xs font-mono text-muted-foreground/40 truncate min-w-0">stem://{stem.ipfsCid.slice(0, 24)}…</p>
        )}
        <button
          onClick={() => onFlag(stem.id)}
          className="ml-auto shrink-0 text-muted-foreground/50 hover:text-destructive transition-colors"
          title="Report this stem"
        >
          <Flag className="h-3 w-3" />
        </button>
      </div>

      {status === "none" && (
        <Button
          size="sm"
          onClick={() => onMint({ stem, meta })}
          className="w-full h-7 text-xs mt-4 gradient-primary text-primary-foreground"
        >
          <Zap className="h-3 w-3 mr-1" /> Mint NFT
        </Button>
      )}

      {status === "none" && (
        <p className="text-xs text-muted-foreground/50 mt-3 leading-relaxed">
          Stems are meant to be minted within {MINT_WINDOW_DAYS} days of upload. Auto-mint after the
          7-day period, and removal of unminted stems, are coming soon.
        </p>
      )}

      <StemManageControls stem={stem} />

      {status === "minted" && (
        <>
        <div aria-hidden className="flex-1 min-h-4" />
        <button
          onClick={() => onViewCert(stem)}
          className="group w-full flex items-center justify-between rounded-lg px-4 py-3
                     bg-gradient-to-b from-accent/20 to-accent/[0.06]
                     border border-accent/30 border-t-accent/50
                     shadow-lg shadow-accent/10
                     hover:from-accent/25 hover:shadow-accent/20 hover:-translate-y-0.5
                     active:translate-y-0 active:shadow-md
                     transition-all duration-200"
        >
          <span className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-full bg-accent/15 border border-accent/40 flex items-center justify-center shrink-0">
              <ShieldCheck className="h-4 w-4 text-accent" />
            </span>
            <span className="flex flex-col items-start leading-tight">
              <span className="text-sm font-display font-medium text-foreground">View certificate</span>
              <span className="text-[10px] text-muted-foreground">Proof of ownership · on-chain</span>
            </span>
          </span>
          <ExternalLink className="h-3.5 w-3.5 text-accent/70 group-hover:text-accent transition-colors" />
        </button>
        </>
      )}
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function StemLibrary() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [flagStemId, setFlagStemId] = useState<number | null>(null);
  const [mintTarget, setMintTarget] = useState<{ stem: any; meta: any } | null>(null);
  const [certStem, setCertStem] = useState<any | null>(null);

  const { data: userStems, isLoading, refetch } = trpc.stems.list.useQuery();
  const queueMint = trpc.stems.queueMint.useMutation();

  const { data: profileData } = trpc.profile.get.useQuery();
  const artistName = profileData?.user?.artistName ?? user?.name ?? "Artist";
  const walletAddress = profileData?.user?.walletAddress ?? "";

  const handleQueueMint = async (metadataUri: string) => {
    if (!mintTarget?.stem?.id) return;
    // NOTE (T10): wallet entry moves into the custodial flow; for now the address still comes
    // from the profile. Throwing here lets MintModal surface the error and reset.
    if (!walletAddress) {
      throw new Error("Add your Solana wallet address in your profile first");
    }
    await queueMint.mutateAsync({
      stemId: mintTarget.stem.id,
      artistWalletAddress: walletAddress,
      metadataUri,
    });
    toast.success("Mint queued! Your stem will be minted shortly.");
    refetch();
    setMintTarget(null);
  };

  return (
    <div className="min-h-screen px-6 py-12 max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <button
              onClick={() => navigate("/profile")}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm mb-4"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <h1 className="text-3xl font-display font-bold text-foreground text-glow">STEM LIBRARY</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {userStems?.length ?? 0} stems · {userStems?.filter((s: any) => s.isMinted).length ?? 0} minted
            </p>
          </div>
          <Button
            onClick={() => navigate("/upload")}
            className="gradient-primary text-primary-foreground"
          >
            <Upload className="h-4 w-4 mr-2" /> Upload
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="surface-glass rounded-xl p-4 h-40 animate-pulse" />
            ))}
          </div>
        ) : !userStems?.length ? (
          <div className="text-center py-20">
            <Music className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
            <h2 className="text-xl font-display font-medium text-foreground mb-2">No stems yet</h2>
            <p className="text-muted-foreground text-sm mb-6 max-w-xs mx-auto">
              Upload your first stem to start building your catalog and minting proof-of-ownership NFTs.
            </p>
            <Button onClick={() => navigate("/upload")} className="gradient-primary text-primary-foreground">
              <Upload className="h-4 w-4 mr-2" /> Upload First Stem
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {userStems.map((stem: any) => (
              <StemCard
                key={stem.id}
                stem={stem}
                onFlag={setFlagStemId}
                onMint={({ stem: s, meta: m }) => setMintTarget({ stem: s, meta: m })}
                onViewCert={setCertStem}
                onResolved={() => refetch()}
              />
            ))}
          </div>
        )}
      </motion.div>

      {/* Modals */}
      <AnimatePresence>
        {flagStemId !== null && (
          <FlagModal stemId={flagStemId} onClose={() => setFlagStemId(null)} />
        )}
        {mintTarget !== null && (
          <MintModal
            stem={mintTarget.stem}
            metadata={mintTarget.meta}
            artistName={artistName}
            onClose={() => setMintTarget(null)}
            onMinted={handleQueueMint}
          />
        )}
        {certStem !== null && (
          <CertificateModal
            stem={certStem}
            artistName={artistName}
            onClose={() => setCertStem(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

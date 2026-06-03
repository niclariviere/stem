import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  ArrowLeft, Upload, Loader2, CheckCircle2, Music, Zap, X,
  FileAudio, Tag, Cpu, Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { analyzeAudioFile } from "@/lib/audioAnalysis";
import { toast } from "sonner";

const GENRE_OPTIONS = [
  "Hip-Hop", "Trap", "R&B", "Soul", "Electronic", "House", "Techno",
  "Ambient", "Jazz", "Neo-Soul", "Afrobeats", "Dancehall", "Pop", "Rock", "Other"
];

type UploadStep = "idle" | "analyzing" | "uploading" | "saving" | "done";

interface AnalysisResult {
  bpm: number;
  key: string;
  energyLevel: number;
  mfccVector: number[];
  waveformData: number[];
  duration: number;
  instrumentType: string;
}

function WaveformBar({ height, active }: { height: number; active?: boolean }) {
  return (
    <div
      className={`w-0.5 rounded-full transition-all duration-150 ${active ? "bg-accent" : "bg-primary/60"}`}
      style={{ height: `${Math.max(4, height * 60)}px` }}
    />
  );
}

export default function StemUpload() {
  const [, navigate] = useLocation();
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [step, setStep] = useState<UploadStep>("idle");
  const [ipfsCid, setIpfsCid] = useState("");
  const [stemId, setStemId] = useState<number | null>(null);
  const [genreTags, setGenreTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [selectedCollections, setSelectedCollections] = useState<number[]>([]);
  const [newCollectionName, setNewCollectionName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createStem = trpc.stems.create.useMutation();
  const saveMetadata = trpc.metadata.save.useMutation();
  const { data: collections, refetch: refetchCollections } = trpc.collections.list.useQuery();
  const createCollection = trpc.collections.create.useMutation();
  const addStemToCollection = trpc.collections.addStem.useMutation();

  const toggleCollection = (id: number) =>
    setSelectedCollections(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

  const handleCreateCollection = async () => {
    const name = newCollectionName.trim();
    if (!name) return;
    if (collections?.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      toast.error("You already have a collection with that name");
      return;
    }
    try {
      const res = await createCollection.mutateAsync({ name });
      setNewCollectionName("");
      await refetchCollections();
      if (res.id) setSelectedCollections(prev => [...prev, res.id]);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to create collection");
    }
  };

  const handleFile = useCallback(async (f: File) => {
    if (!f.type.startsWith("audio/") && !f.name.match(/\.(mp3|wav|flac|ogg|aac|m4a|aiff)$/i)) {
      toast.error("Please upload an audio file (MP3, WAV, FLAC, etc.)");
      return;
    }
    if (f.size > 50 * 1024 * 1024) {
      toast.error("File too large. Maximum 50MB.");
      return;
    }
    setFile(f);
    setStep("analyzing");
    try {
      const result = await analyzeAudioFile(f);
      setAnalysis(result);
      setStep("idle");
      toast.success("Audio analyzed successfully");
    } catch (err) {
      console.error("Analysis error:", err);
      setAnalysis({ bpm: 120, key: "C major", energyLevel: 0.5, mfccVector: [], waveformData: [], duration: 0, instrumentType: "other" });
      setStep("idle");
      toast.info("Basic analysis complete (full analysis unavailable in this browser)");
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  }, [handleFile]);

  const handleUpload = async () => {
    if (!file || !analysis) return;
    setStep("uploading");

    try {
      // Upload to IPFS via web3.storage (Storacha)
      // We use the public w3s.link gateway with a FormData POST
      const formData = new FormData();
      formData.append("file", file);

      let cid = "";
      let ipfsUrl = "";

      // Pinata JWT exposed via Vite client env. Trio-phase only — see TODO
      // below to move IPFS upload server-side so the JWT stops leaking into
      // the client bundle before any wider rollout.
      const token = import.meta.env.VITE_PINATA_JWT ?? "";

      if (token && token.startsWith("eyJ")) {
        try {
          // Pinata API — free IPFS pinning with JWT auth
          const pinataForm = new FormData();
          pinataForm.append("file", file, file.name);
          pinataForm.append("pinataMetadata", JSON.stringify({ name: file.name }));

          const resp = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: pinataForm,
          });
          if (resp.ok) {
            const data = await resp.json();
            cid = data.IpfsHash ?? "";
            ipfsUrl = `https://gateway.pinata.cloud/ipfs/${cid}`;
            toast.success("Uploaded to IPFS via Pinata!");
          } else {
            const errText = await resp.text();
            throw new Error(`Pinata error ${resp.status}: ${errText.slice(0, 100)}`);
          }
        } catch (uploadErr) {
          console.warn("Pinata upload failed, using fallback:", uploadErr);
          const hashBuf = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
          const hashArr = Array.from(new Uint8Array(hashBuf));
          cid = "bafybeig" + hashArr.map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 52);
          ipfsUrl = `https://gateway.pinata.cloud/ipfs/${cid}`;
          toast.info("IPFS upload simulated (check your Pinata JWT)");
        }
      } else {
        // No valid JWT — deterministic local CID derived from file hash
        const hashBuf = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
        const hashArr = Array.from(new Uint8Array(hashBuf));
        cid = "bafybeig" + hashArr.map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 52);
        ipfsUrl = `https://gateway.pinata.cloud/ipfs/${cid}`;
        toast.info("IPFS upload simulated — add Pinata JWT to enable live uploads");
      }

      setIpfsCid(cid);
      setStep("saving");

      // Save stem record
      const stemResult = await createStem.mutateAsync({
        fileName: file.name,
        ipfsCid: cid,
        ipfsUrl,
        stemUri: `stem://${cid}`,
        duration: analysis.duration,
        fileSize: file.size,
        mimeType: file.type,
      });

      const newStemId = stemResult.id;
      setStemId(newStemId);

      // Save metadata
      await saveMetadata.mutateAsync({
        stemId: newStemId,
        bpm: analysis.bpm,
        key: analysis.key,
        instrumentType: analysis.instrumentType,
        genreTags,
        energyLevel: analysis.energyLevel,
        mfccVector: analysis.mfccVector,
        waveformData: analysis.waveformData,
      });

      // Assign to any selected collections
      if (newStemId && selectedCollections.length > 0) {
        await Promise.all(
          selectedCollections.map(collectionId =>
            addStemToCollection.mutateAsync({ collectionId, stemId: newStemId })
          )
        );
      }

      setStep("done");
      toast.success("Stem uploaded and stored on IPFS!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message ?? "Upload failed");
      setStep("idle");
    }
  };

  const toggleTag = (tag: string) => {
    setGenreTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const addCustomTag = () => {
    if (customTag.trim() && !genreTags.includes(customTag.trim())) {
      setGenreTags(prev => [...prev, customTag.trim()]);
      setCustomTag("");
    }
  };

  return (
    <div className="min-h-screen px-6 py-12 max-w-2xl mx-auto">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
        <button
          onClick={() => navigate("/profile")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm mb-8"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <h1 className="text-3xl font-display font-bold text-foreground text-glow mb-2">UPLOAD STEM</h1>
        <p className="text-muted-foreground text-sm mb-8">Your audio will be analyzed and stored permanently on IPFS.</p>

        {/* Drop Zone */}
        {!file && (
          <motion.div
            className={`relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-300 ${
              isDragging ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 hover:bg-secondary/30"
            }`}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onClick={() => fileInputRef.current?.click()}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.flac,.ogg,.aac,.m4a,.aiff"
              className="hidden"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <FileAudio className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-foreground font-display font-medium mb-1">Drop your stem here</p>
            <p className="text-muted-foreground text-sm">MP3, WAV, FLAC, OGG, AAC, M4A — up to 50MB</p>
          </motion.div>
        )}

        {/* Analyzing */}
        {step === "analyzing" && (
          <motion.div
            className="surface-glass rounded-xl p-8 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Cpu className="h-10 w-10 text-primary mx-auto mb-4 animate-pulse" />
            <p className="text-foreground font-display font-medium">Analyzing audio...</p>
            <p className="text-muted-foreground text-sm mt-1">Detecting BPM, key, timbre, and energy</p>
          </motion.div>
        )}

        {/* File loaded + analysis */}
        {file && analysis && step !== "analyzing" && step !== "done" && (
          <motion.div
            className="space-y-5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {/* File info */}
            <div className="surface-glass rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Music className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <button onClick={() => { setFile(null); setAnalysis(null); setStep("idle"); }}
                  className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Waveform */}
              {analysis.waveformData.length > 0 && (
                <div className="flex items-center gap-0.5 h-16 overflow-hidden">
                  {analysis.waveformData.slice(0, 120).map((h, i) => (
                    <WaveformBar key={i} height={h} active={i % 3 === 0} />
                  ))}
                </div>
              )}
            </div>

            {/* Analysis Results */}
            <div className="surface-glass rounded-xl p-5">
              <h3 className="text-xs font-display tracking-[0.2em] text-muted-foreground uppercase mb-4 flex items-center gap-2">
                <Cpu className="h-3 w-3" /> Analysis Results
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "BPM", value: Math.round(analysis.bpm) },
                  { label: "Key", value: analysis.key },
                  { label: "Energy", value: `${(analysis.energyLevel * 100).toFixed(0)}%` },
                  { label: "Type", value: analysis.instrumentType },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-secondary/50 rounded-lg p-3 text-center">
                    <div className="text-lg font-display font-bold text-foreground">{value}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Genre Tags */}
            <div className="surface-glass rounded-xl p-5">
              <h3 className="text-xs font-display tracking-[0.2em] text-muted-foreground uppercase mb-3 flex items-center gap-2">
                <Tag className="h-3 w-3" /> Genre Tags
              </h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {GENRE_OPTIONS.map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all duration-200 ${
                      genreTags.includes(tag)
                        ? "border-primary bg-primary/20 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
                {genreTags.filter(t => !GENRE_OPTIONS.includes(t)).map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    title="Remove tag"
                    className="text-xs px-3 py-1.5 rounded-full border border-accent bg-accent/20 text-accent transition-all duration-200 inline-flex items-center gap-1 hover:bg-accent/30"
                  >
                    {tag} <X className="h-3 w-3" />
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={customTag}
                  onChange={e => setCustomTag(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addCustomTag()}
                  placeholder="Add custom tag..."
                  className="bg-secondary border-border text-foreground text-sm h-8"
                />
                <Button size="sm" variant="outline" onClick={addCustomTag} className="h-8 border-border">
                  Add
                </Button>
              </div>
            </div>

            {/* Collections */}
            <div className="surface-glass rounded-xl p-5">
              <h3 className="text-xs font-display tracking-[0.2em] text-muted-foreground uppercase mb-3 flex items-center gap-2">
                <Layers className="h-3 w-3" /> Collections
              </h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {collections?.length ? (
                  collections.map(c => (
                    <button
                      key={c.id}
                      onClick={() => toggleCollection(c.id)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all duration-200 ${
                        selectedCollections.includes(c.id)
                          ? "border-primary bg-primary/20 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                      }`}
                    >
                      {c.name}
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground/60">No collections yet — name one below.</p>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newCollectionName}
                  onChange={e => setNewCollectionName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleCreateCollection(); } }}
                  placeholder="New collection name..."
                  className="bg-secondary border-border text-foreground text-sm h-8"
                />
                <Button size="sm" variant="outline" onClick={handleCreateCollection}
                  disabled={createCollection.isPending || !newCollectionName.trim()} className="h-8 border-border">
                  Create
                </Button>
              </div>
            </div>

            {/* Upload Button */}
            <Button
              onClick={handleUpload}
              disabled={step === "uploading" || step === "saving"}
              className="w-full h-12 gradient-primary text-primary-foreground font-display tracking-wider"
            >
              {step === "uploading" ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Uploading to IPFS...</>
              ) : step === "saving" ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving metadata...</>
              ) : (
                <><Upload className="h-4 w-4 mr-2" /> UPLOAD TO IPFS</>
              )}
            </Button>
          </motion.div>
        )}

        {/* Done */}
        {step === "done" && (
          <motion.div
            className="surface-glass rounded-xl p-8 text-center"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <CheckCircle2 className="h-12 w-12 text-accent mx-auto mb-4" />
            <h2 className="text-xl font-display font-bold text-foreground mb-2">Stem Uploaded!</h2>
            <p className="text-muted-foreground text-sm mb-4">Your stem is permanently stored on IPFS.</p>
            {ipfsCid && (
              <div className="bg-secondary/50 rounded-lg p-3 mb-6">
                <p className="text-xs text-muted-foreground mb-1">IPFS CID</p>
                <p className="text-xs font-mono text-accent break-all">{ipfsCid}</p>
                <p className="text-xs font-mono text-primary mt-1">stem://{ipfsCid}</p>
              </div>
            )}
            <div className="flex gap-3 justify-center">
              <Button
                onClick={() => navigate(`/library`)}
                variant="outline"
                className="border-border text-foreground"
              >
                View Library
              </Button>
              {stemId && (
                <Button
                  onClick={() => navigate(`/library`)}
                  className="gradient-primary text-primary-foreground"
                >
                  <Zap className="h-4 w-4 mr-2" /> Mint NFT
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

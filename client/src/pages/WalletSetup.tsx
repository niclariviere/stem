import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  CheckCircle2, Circle, ExternalLink, ChevronRight,
  Wallet, Shield, Zap, ArrowLeft, Copy, Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  connectPhantom,
  isPhantomInstalled,
  isValidSolanaAddress,
  shortenAddress,
} from "@/lib/phantomWallet";

const STEPS = [
  {
    id: 1,
    title: "Install Phantom",
    subtitle: "The Solana wallet for creators",
    icon: Wallet,
    content: (
      <div className="space-y-4">
        <p className="text-muted-foreground leading-relaxed">
          Phantom is a browser extension that acts as your digital identity on the Solana blockchain.
          It's where your stem NFTs will live — permanently, under your name.
        </p>
        <div className="glass-card p-4 rounded-xl border border-cyan-500/20 space-y-3">
          <p className="text-sm font-medium text-foreground">Why Phantom?</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-cyan-400 mt-0.5 shrink-0" /> Free to install and use</li>
            <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-cyan-400 mt-0.5 shrink-0" /> Available for Chrome, Firefox, Edge, Brave, and iOS/Android</li>
            <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-cyan-400 mt-0.5 shrink-0" /> Your stems are minted directly to your wallet address</li>
            <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-cyan-400 mt-0.5 shrink-0" /> You never pay gas — STEM covers minting costs</li>
          </ul>
        </div>
        <a
          href="https://phantom.app/download"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors text-sm font-medium"
        >
          Download Phantom <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    ),
  },
  {
    id: 2,
    title: "Create your wallet",
    subtitle: "Set up a new Solana wallet",
    icon: Shield,
    content: (
      <div className="space-y-4">
        <p className="text-muted-foreground leading-relaxed">
          After installing Phantom, you'll be guided through creating a new wallet.
          The most important step is writing down your <strong className="text-foreground">secret recovery phrase</strong>.
        </p>
        <div className="glass-card p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-3">
          <p className="text-sm font-semibold text-amber-400 flex items-center gap-2">
            <Shield className="h-4 w-4" /> About your recovery phrase
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2"><span className="text-amber-400 font-bold shrink-0">1.</span> Phantom will show you 12 or 24 random words</li>
            <li className="flex items-start gap-2"><span className="text-amber-400 font-bold shrink-0">2.</span> Write them down on paper — in order — and store them safely</li>
            <li className="flex items-start gap-2"><span className="text-amber-400 font-bold shrink-0">3.</span> Never share them with anyone, including us</li>
            <li className="flex items-start gap-2"><span className="text-amber-400 font-bold shrink-0">4.</span> These words are the only way to recover your wallet if you lose access</li>
          </ul>
        </div>
        <p className="text-sm text-muted-foreground">
          Think of it like a master key to a safe. The safe holds your NFTs. If you lose the key, no one — not even Phantom — can open it.
        </p>
      </div>
    ),
  },
  {
    id: 3,
    title: "Connect to STEM",
    subtitle: "Link your wallet to your account",
    icon: Zap,
    content: null, // rendered dynamically below
  },
];

export default function WalletSetup() {
  const [, navigate] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [walletAddress, setWalletAddress] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [copied, setCopied] = useState(false);

  const updateProfile = trpc.profile.update.useMutation();

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const address = await connectPhantom();
      setWalletAddress(address);
      setConnected(true);
      // Save to profile
      await updateProfile.mutateAsync({ walletAddress: address });
      toast.success("Wallet connected and saved to your profile!");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to connect wallet");
    } finally {
      setConnecting(false);
    }
  };

  const handleManualAddress = async () => {
    if (!isValidSolanaAddress(walletAddress)) {
      toast.error("Please enter a valid Solana wallet address");
      return;
    }
    try {
      await updateProfile.mutateAsync({ walletAddress });
      setConnected(true);
      toast.success("Wallet address saved to your profile!");
    } catch (err: any) {
      toast.error("Failed to save wallet address");
    }
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const step3Content = (
    <div className="space-y-4">
      <p className="text-muted-foreground leading-relaxed">
        Connect your Phantom wallet to STEM. We only read your wallet address — we never request
        transaction signing. <strong className="text-foreground">You never pay gas.</strong> STEM's
        relayer covers all minting costs.
      </p>

      {!connected ? (
        <div className="space-y-4">
          {isPhantomInstalled() ? (
            <Button
              onClick={handleConnect}
              disabled={connecting}
              className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-semibold"
            >
              {connecting ? "Connecting..." : "Connect Phantom Wallet"}
            </Button>
          ) : (
            <div className="glass-card p-4 rounded-xl border border-purple-500/20 text-center space-y-3">
              <p className="text-sm text-muted-foreground">Phantom not detected in this browser.</p>
              <a
                href="https://phantom.app/download"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" className="w-full border-cyan-500/30">
                  Install Phantom First <ExternalLink className="h-3.5 w-3.5 ml-2" />
                </Button>
              </a>
            </div>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/50" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-background px-3 text-muted-foreground">or enter address manually</span>
            </div>
          </div>

          <div className="space-y-2">
            <input
              type="text"
              placeholder="Your Solana wallet address (e.g. 7xKX...)"
              value={walletAddress}
              onChange={e => setWalletAddress(e.target.value)}
              className="w-full bg-background/50 border border-border/50 rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyan-500/50 font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Find your address in Phantom by clicking your wallet name at the top.
            </p>
            <Button
              onClick={handleManualAddress}
              disabled={!walletAddress || updateProfile.isPending}
              variant="outline"
              className="w-full border-cyan-500/30 hover:border-cyan-500/60"
            >
              Save Address
            </Button>
          </div>
        </div>
      ) : (
        <div className="glass-card p-4 rounded-xl border border-green-500/30 bg-green-500/5 space-y-3">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-400">Wallet connected!</p>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">{walletAddress}</p>
            </div>
            <button onClick={copyAddress} className="ml-auto text-muted-foreground hover:text-foreground transition-colors">
              {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Your stems will be minted to this address. You can update it anytime in your profile.
          </p>
        </div>
      )}
    </div>
  );

  const stepsWithContent = STEPS.map(s =>
    s.id === 3 ? { ...s, content: step3Content } : s
  );

  const currentStepData = stepsWithContent.find(s => s.id === currentStep)!;
  const isLastStep = currentStep === STEPS.length;

  return (
    <div className="min-h-screen px-4 py-12 max-w-2xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate("/profile")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm mb-6"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Profile
          </button>
          <h1 className="text-3xl font-display font-bold text-foreground text-glow mb-2">
            WALLET SETUP
          </h1>
          <p className="text-muted-foreground">
            Set up your Solana wallet to receive your stem NFTs — completely free.
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((step, i) => (
            <div key={step.id} className="flex items-center gap-2">
              <button
                onClick={() => setCurrentStep(step.id)}
                className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                  step.id === currentStep
                    ? "text-cyan-400"
                    : step.id < currentStep
                    ? "text-green-400"
                    : "text-muted-foreground"
                }`}
              >
                {step.id < currentStep ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : step.id === currentStep ? (
                  <div className="h-5 w-5 rounded-full border-2 border-cyan-400 flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-cyan-400" />
                  </div>
                ) : (
                  <Circle className="h-5 w-5" />
                )}
                <span className="hidden sm:block">{step.title}</span>
              </button>
              {i < STEPS.length - 1 && (
                <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="glass-card p-6 rounded-2xl border border-purple-500/20 mb-6">
              <div className="flex items-start gap-4 mb-6">
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                  <currentStepData.icon className="h-6 w-6 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-xl font-display font-bold text-foreground">
                    Step {currentStep}: {currentStepData.title}
                  </h2>
                  <p className="text-sm text-muted-foreground">{currentStepData.subtitle}</p>
                </div>
              </div>
              {currentStepData.content}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex gap-3">
          {currentStep > 1 && (
            <Button
              variant="outline"
              onClick={() => setCurrentStep(s => s - 1)}
              className="border-border/50"
            >
              Back
            </Button>
          )}
          {!isLastStep ? (
            <Button
              onClick={() => setCurrentStep(s => s + 1)}
              className="flex-1 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-semibold"
            >
              Next Step <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : connected ? (
            <Button
              onClick={() => navigate("/library")}
              className="flex-1 bg-gradient-to-r from-green-600 to-cyan-600 hover:from-green-500 hover:to-cyan-500 text-white font-semibold"
            >
              Start Minting <Zap className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => navigate("/profile")}
              className="flex-1 border-border/50"
            >
              Skip for now
            </Button>
          )}
        </div>

        {/* FAQ */}
        <div className="mt-10 space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Common questions</h3>
          {[
            {
              q: "Do I need SOL (Solana tokens) to mint?",
              a: "No. STEM's relayer pays all gas fees. You only need a wallet address to receive your NFTs.",
            },
            {
              q: "What if I lose access to my wallet?",
              a: "Your recovery phrase is the only way to restore access. Keep it written down somewhere safe, offline.",
            },
            {
              q: "Can I use a mobile wallet?",
              a: "Yes. You can copy your wallet address from the Phantom mobile app and paste it manually in the field above.",
            },
            {
              q: "Where can I see my minted stems?",
              a: "In your Phantom wallet under 'Collectibles', and on Solana Explorer. Minting typically completes within 24 hours.",
            },
          ].map((item, i) => (
            <div key={i} className="glass-card p-4 rounded-xl border border-border/30">
              <p className="text-sm font-medium text-foreground mb-1">{item.q}</p>
              <p className="text-sm text-muted-foreground">{item.a}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

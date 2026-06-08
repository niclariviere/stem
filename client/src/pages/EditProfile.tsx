import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Save, Loader2, Link2, Wallet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { connectPhantom, isValidSolanaAddress, shortenAddress } from "@/lib/phantomWallet";
import { toast } from "sonner";

export default function EditProfile() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { data: profileData } = trpc.profile.get.useQuery();
  const updateProfile = trpc.profile.update.useMutation();

  const [form, setForm] = useState({
    artistName: "",
    bio: "",
    bandlabUrl: "",
    spotifyUrl: "",
    websiteUrl: "",
    walletAddress: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profileData?.user) {
      const u = profileData.user;
      setForm({
        artistName: u.artistName ?? "",
        bio: u.bio ?? "",
        bandlabUrl: u.bandlabUrl ?? "",
        spotifyUrl: u.spotifyUrl ?? "",
        websiteUrl: u.websiteUrl ?? "",
        walletAddress: u.walletAddress ?? "",
      });
    }
  }, [profileData]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile.mutateAsync(form);
      toast.success("Profile saved");
      navigate("/profile");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleConnectWallet = async () => {
    try {
      const address = await connectPhantom();
      if (!isValidSolanaAddress(address)) {
        toast.error("That doesn't look like a valid Solana address");
        return;
      }
      setForm(f => ({ ...f, walletAddress: address }));
      toast.success("Wallet connected: " + shortenAddress(address));
    } catch (err: any) {
      toast.error(err?.message ?? "Wallet connection failed");
    }
  };

  return (
    <div className="min-h-screen px-6 py-12 max-w-2xl mx-auto">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
        <button
          onClick={() => navigate("/profile")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm mb-8"
        >
          <ArrowLeft className="h-4 w-4" /> Back to profile
        </button>

        <h1 className="text-3xl font-display font-bold text-foreground text-glow mb-8">EDIT PROFILE</h1>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Artist Info */}
          <div className="surface-glass rounded-lg p-5 space-y-4">
            <h2 className="text-xs font-display tracking-[0.2em] text-muted-foreground uppercase">Artist Info</h2>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Artist Name</label>
              <Input
                value={form.artistName}
                onChange={e => setForm(f => ({ ...f, artistName: e.target.value }))}
                placeholder="Your artist name"
                className="bg-secondary border-border text-foreground"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Bio</label>
              <textarea
                value={form.bio}
                onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                placeholder="Tell the community about yourself..."
                rows={3}
                className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {/* Links */}
          <div className="surface-glass rounded-lg p-5 space-y-4">
            <h2 className="text-xs font-display tracking-[0.2em] text-muted-foreground uppercase flex items-center gap-2">
              <Link2 className="h-3 w-3" /> Links
            </h2>
            {[
              { key: "bandlabUrl", label: "BandLab Profile URL", placeholder: "https://www.bandlab.com/yourname" },
              { key: "spotifyUrl", label: "Spotify Artist URL", placeholder: "https://open.spotify.com/artist/..." },
              { key: "websiteUrl", label: "Website / Portfolio", placeholder: "https://yoursite.com" },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
                <Input
                  value={(form as any)[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="bg-secondary border-border text-foreground text-sm"
                />
              </div>
            ))}
          </div>

          {/* Wallet */}
          <div className="surface-glass rounded-lg p-5 space-y-4">
            <h2 className="text-xs font-display tracking-[0.2em] text-muted-foreground uppercase flex items-center gap-2">
              <Wallet className="h-3 w-3" /> Wallet Address
            </h2>
            <p className="text-xs text-muted-foreground">Your Solana wallet, for NFT minting. Connect Phantom or enter the address manually.</p>
            <div className="flex gap-2">
              <Input
                value={form.walletAddress}
                onChange={e => setForm(f => ({ ...f, walletAddress: e.target.value }))}
                placeholder="Your Solana wallet address"
                className="bg-secondary border-border text-foreground font-mono text-sm flex-1"
              />
              <Button
                type="button"
                onClick={handleConnectWallet}
                variant="outline"
                className="border-border text-muted-foreground hover:text-foreground whitespace-nowrap"
              >
                <Wallet className="h-4 w-4 mr-2" /> Connect
              </Button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={saving}
            className="w-full h-12 gradient-primary text-primary-foreground font-display tracking-wider"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            SAVE CHANGES
          </Button>
        </form>
      </motion.div>
    </div>
  );
}

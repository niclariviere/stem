import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  Edit2, Zap, MessageCircle, X, Copy, Check, Plus, Music, Shield,
  ExternalLink, Upload, Library, LogOut, Bell
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

function StatCard({ label, value, highlight, onClick }: {
  label: string; value: number | string; highlight?: boolean; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`p-4 rounded-lg text-left transition-all duration-300 ${
        highlight
          ? "gradient-primary border-glow cursor-pointer hover:scale-[1.02]"
          : "surface-glass cursor-default"
      }`}
    >
      <div className={`text-2xl font-display font-bold ${highlight ? "text-primary-foreground" : "text-foreground"}`}>
        {value}
      </div>
      <div className={`text-xs mt-1 tracking-wide ${highlight ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
        {label}
      </div>
    </button>
  );
}

function CatalogSection({ title, items, emptyMsg }: {
  title: string; items: { label: string; sub?: string }[]; emptyMsg?: string;
}) {
  return (
    <div className="surface-glass rounded-lg p-5">
      <h3 className="text-xs font-display tracking-[0.2em] text-muted-foreground uppercase mb-4">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground/50 text-center py-4">{emptyMsg ?? "Nothing here yet"}</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-secondary/50 transition-colors">
              <div>
                <span className="text-sm text-foreground/80">{item.label}</span>
                {item.sub && <span className="text-xs text-muted-foreground ml-2">{item.sub}</span>}
              </div>
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InviteWidget() {
  const [copied, setCopied] = useState<string | null>(null);
  const createInvite = trpc.invitations.create.useMutation();
  const { data: invites, refetch } = trpc.invitations.list.useQuery();

  const handleCreate = async () => {
    try {
      const result = await createInvite.mutateAsync({ origin: window.location.origin });
      toast.success("Invitation created!");
      refetch();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to create invitation");
    }
  };

  const handleCopy = (url: string, id: number) => {
    navigator.clipboard.writeText(url);
    setCopied(String(id));
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="surface-glass rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-display tracking-[0.2em] text-muted-foreground uppercase">Invite Links</h3>
        <Button
          size="sm"
          onClick={handleCreate}
          disabled={createInvite.isPending}
          className="h-7 text-xs gradient-primary text-primary-foreground"
        >
          <Plus className="h-3 w-3 mr-1" /> Generate
        </Button>
      </div>
      {!invites?.length ? (
        <p className="text-sm text-muted-foreground/50 text-center py-3">No invites generated yet</p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {invites.map((inv: any) => {
            const inviteUrl = `${window.location.origin}/login?invite=${inv.token}`;
            const isUsed = !!inv.usedBy;
            const isExpired = inv.expiresAt && new Date(inv.expiresAt) < new Date();
            return (
              <div key={inv.id} className={`flex items-center justify-between py-2 px-3 rounded-md ${isUsed || isExpired ? "opacity-40" : "hover:bg-secondary/50"} transition-colors`}>
                <div>
                  <span className="text-xs font-mono text-foreground/70">{inv.token.slice(0, 12)}…</span>
                  <span className={`ml-2 text-xs ${isUsed ? "text-accent" : isExpired ? "text-destructive" : "text-muted-foreground"}`}>
                    {isUsed ? "Used" : isExpired ? "Expired" : "Active"}
                  </span>
                </div>
                {!isUsed && !isExpired && (
                  <button
                    onClick={() => handleCopy(inviteUrl, inv.id)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {copied === String(inv.id) ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Profile() {
  const [, navigate] = useLocation();
  const [chatOpen, setChatOpen] = useState(false);
  const { user, logout } = useAuth();

  const { data: profileData, isLoading } = trpc.profile.get.useQuery();
  const markRead = trpc.matching.markNotificationRead.useMutation();

  const artistName = profileData?.user?.artistName ?? user?.name ?? "ARTIST";
  const bio = profileData?.user?.bio;
  const stats = profileData?.stats ?? { stems: 0, minted: 0, matches: 0, collections: 0 };
  const notifications = profileData?.notifications ?? [];
  const bandlabProjects = profileData?.bandlabProjects ?? [];

  const stemItems = [] as { label: string; sub?: string }[];
  const mintedItems = [] as { label: string; sub?: string }[];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full gradient-primary animate-pulse mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-12 max-w-5xl mx-auto">
      {/* Header */}
      <motion.div
        className="flex items-start justify-between mb-12"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <div>
          <h1 className="text-4xl sm:text-5xl font-display font-bold text-foreground tracking-tight text-glow">
            {artistName.toUpperCase()}
          </h1>
          {bio && (
            <p className="mt-4 text-muted-foreground text-sm leading-relaxed max-w-xl">{bio}</p>
          )}
          {profileData?.user?.isVerified && (
            <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-accent">
              <Shield className="h-3 w-3" /> Verified Member
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Button variant="outline" size="icon" onClick={() => navigate("/edit")}
            className="border-border text-muted-foreground hover:text-foreground hover:border-primary/50">
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigate("/upload")}
            className="border-border text-muted-foreground hover:text-foreground hover:border-accent/50">
            <Upload className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigate("/library")}
            className="border-border text-muted-foreground hover:text-foreground hover:border-accent/50">
            <Library className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigate("/match")}
            className="border-border text-muted-foreground hover:text-foreground hover:border-accent/50">
            <Zap className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => logout()}
            className="border-border text-muted-foreground hover:text-foreground hover:border-destructive/50">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div
        className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-12"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <StatCard label="Stems" value={stats.stems} />
        <StatCard label="Minted NFTs" value={stats.minted} />
        <StatCard label="Collections" value={stats.collections} />
        <StatCard
          label={notifications.length > 0 ? `${notifications.length} new match${notifications.length > 1 ? "es" : ""}!` : "Matches"}
          value={notifications.length}
          highlight={notifications.length > 0}
          onClick={notifications.length > 0 ? () => setChatOpen(true) : undefined}
        />
      </motion.div>

      {/* Catalogs + Invite Widget */}
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        <div className="lg:col-span-2 space-y-6">
          <CatalogSection
            title="Stem Catalog"
            items={stemItems}
            emptyMsg="No stems yet — upload your first stem"
          />
          <CatalogSection
            title="BandLab Projects"
            items={bandlabProjects.map((p: any) => ({ label: p.projectName ?? "Unnamed Project", sub: new Date(p.importedAt).toLocaleDateString() }))}
            emptyMsg="No BandLab projects imported"
          />
        </div>
        <div className="space-y-6">
          <InviteWidget />
          {profileData?.user?.walletAddress && (
            <div className="surface-glass rounded-lg p-5">
              <h3 className="text-xs font-display tracking-[0.2em] text-muted-foreground uppercase mb-3">Wallet</h3>
              <p className="text-xs font-mono text-foreground/70 break-all">{profileData.user.walletAddress}</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Match Notifications Chat Overlay */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setChatOpen(false)}
          >
            <motion.div
              className="surface-glass rounded-t-xl sm:rounded-xl w-full max-w-md h-96 sm:h-[28rem] flex flex-col"
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-primary" />
                  <span className="text-sm font-display font-medium text-foreground">Match Notifications</span>
                  {notifications.length > 0 && (
                    <span className="text-xs bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">{notifications.length}</span>
                  )}
                </div>
                <button onClick={() => setChatOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 p-4 overflow-y-auto space-y-3">
                {notifications.length === 0 ? (
                  <div className="text-muted-foreground/60 text-sm text-center mt-12">
                    No new matches yet. Keep uploading stems!
                  </div>
                ) : (
                  notifications.map((n: any) => (
                    <div key={n.id} className="surface-glass rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-display text-accent">Match Found!</span>
                        <span className="text-xs text-muted-foreground">{(n.score * 100).toFixed(0)}% compatible</span>
                      </div>
                      <p className="text-xs text-foreground/70">Stem #{n.stemId1} ↔ Stem #{n.stemId2}</p>
                      <button
                        onClick={() => markRead.mutate({ notificationId: n.id })}
                        className="text-xs text-muted-foreground hover:text-foreground mt-2 transition-colors"
                      >
                        Mark as read
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

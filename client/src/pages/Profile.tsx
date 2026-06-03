import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  Edit2, Zap, X, Shield, Plus, Music,
  ExternalLink, Upload, Library, LogOut, Bell, Rss, Bug, Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GenerativeCover } from "@/components/GenerativeCover";
import { MiniStemCard } from "@/components/MiniStemCard";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

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
  const stems = profileData?.stems ?? [];
  const collections = profileData?.collections ?? [];

  const links = ([
    { label: "Website", url: profileData?.user?.websiteUrl },
    { label: "Spotify", url: profileData?.user?.spotifyUrl },
    { label: "BandLab", url: profileData?.user?.bandlabUrl },
  ] as { label: string; url?: string | null }[])
    .filter(l => !!l.url)
    .map(l => {
      let host = "";
      try { host = new URL(l.url!).hostname; } catch { /* keep empty */ }
      return { ...l, favicon: host ? `https://www.google.com/s2/favicons?domain=${host}&sz=64` : "" };
    });

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
          <Button variant="outline" size="icon" onClick={() => navigate("/feed")}
            className="border-border text-muted-foreground hover:text-foreground hover:border-primary/50">
            <Rss className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigate("/users")}
            className="border-border text-muted-foreground hover:text-foreground hover:border-primary/50">
            <Users className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigate("/report")}
            className="border-border text-muted-foreground hover:text-foreground hover:border-destructive/50">
            <Bug className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => logout()}
            className="border-border text-muted-foreground hover:text-foreground hover:border-destructive/50">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>

      {/* Stats */}
      {/* Links — favicon chips, sitting right on top of the stats */}
      {links.length > 0 && (
        <motion.div
          className="flex flex-wrap gap-2 mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          {links.map((l) => (
            <a
              key={l.label}
              href={l.url!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 py-1.5 px-3 rounded-full border border-border hover:border-primary/50 hover:bg-secondary/50 transition-colors text-sm text-foreground/80"
            >
              {l.favicon
                ? <img src={l.favicon} alt="" className="w-4 h-4 rounded-sm" />
                : <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />}
              {l.label}
            </a>
          ))}
        </motion.div>
      )}

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

      {/* Collections — generative hero tiles */}
      <motion.div
        className="mb-12"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        <h2 className="text-xs font-display tracking-[0.2em] text-muted-foreground uppercase mb-4">Collections</h2>
        {collections.length === 0 ? (
          <button
            onClick={() => navigate("/upload")}
            className="w-full surface-glass rounded-xl p-8 text-center border border-dashed border-border hover:border-primary/50 transition-colors group"
          >
            <div className="w-12 h-12 rounded-xl gradient-primary-subtle mx-auto mb-3 flex items-center justify-center">
              <Plus className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm text-foreground/80">Group your stems into a collection</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Each one gets its own cover automatically</p>
          </button>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {collections.map((c: any) => (
              <button
                key={c.id}
                onClick={() => navigate("/library")}
                className="group text-left"
                title={c.description ?? c.name}
              >
                <GenerativeCover
                  seed={`${c.id}-${c.name}`}
                  label={c.name}
                  sub={c.isPublic ? "Public" : "Private"}
                  className="transition-all duration-300 group-hover:scale-[1.03] group-hover:shadow-xl group-hover:shadow-primary/10"
                />
              </button>
            ))}
          </div>
        )}
      </motion.div>

      {/* Stems — visual card grid */}
      <motion.div
        className="mb-12"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.5 }}
      >
        <h2 className="text-xs font-display tracking-[0.2em] text-muted-foreground uppercase mb-4">Stems</h2>
        {stems.length === 0 ? (
          <button
            onClick={() => navigate("/upload")}
            className="w-full surface-glass rounded-xl p-10 text-center border border-dashed border-border hover:border-primary/50 transition-colors"
          >
            <Music className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-foreground/80">Your stems show up here as sound cards</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Upload your first to bring this profile to life</p>
          </button>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {stems.map((s: any) => <MiniStemCard key={s.id} stem={s} />)}
          </div>
        )}
      </motion.div>

      {/* Wallet (+ any BandLab projects) */}
      {(profileData?.user?.walletAddress || bandlabProjects.length > 0) && (
        <motion.div
          className="space-y-6 max-w-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          {bandlabProjects.length > 0 && (
            <CatalogSection
              title="BandLab Projects"
              items={bandlabProjects.map((p: any) => ({ label: p.projectName ?? "Unnamed Project", sub: new Date(p.importedAt).toLocaleDateString() }))}
            />
          )}
          {profileData?.user?.walletAddress && (
            <div className="surface-glass rounded-lg p-5">
              <h3 className="text-xs font-display tracking-[0.2em] text-muted-foreground uppercase mb-3">Wallet</h3>
              <p className="text-xs font-mono text-foreground/70 break-all">{profileData.user.walletAddress}</p>
            </div>
          )}
        </motion.div>
      )}

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

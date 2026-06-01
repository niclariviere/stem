import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Users as UsersIcon, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase() || "?";
}

export default function Users() {
  const [, navigate] = useLocation();
  useAuth({ redirectOnUnauthenticated: true });

  const { data: members, isLoading } = trpc.users.list.useQuery();

  return (
    <div className="min-h-screen px-6 py-12 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Button variant="outline" size="icon" onClick={() => navigate("/profile")}
          className="border-border text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <UsersIcon className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">Members</h1>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground/60 py-6">Loading members…</p>
      ) : !members?.length ? (
        <p className="text-sm text-muted-foreground/50 py-6">No members yet.</p>
      ) : (
        <motion.div
          className="space-y-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          {members.map((m: any) => {
            const display = m.artistName || m.name || "Member";
            return (
              <div key={m.id} className="surface-glass rounded-lg p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-sm font-display font-bold text-primary-foreground shrink-0">
                  {initials(display)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">{display}</span>
                    {m.isVerified && <Shield className="h-3 w-3 text-accent shrink-0" />}
                    {m.role === "admin" && (
                      <span className="text-[10px] uppercase tracking-wide text-primary border border-primary/40 rounded px-1.5 py-0.5">
                        Admin
                      </span>
                    )}
                  </div>
                  {m.bio && <p className="text-xs text-muted-foreground truncate mt-0.5">{m.bio}</p>}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(m.createdAt).toLocaleDateString()}
                </span>
              </div>
            );
          })}
        </motion.div>
      )}
      {/* Profile click-through arrives with the public profile page (deferred). */}
    </div>
  );
}

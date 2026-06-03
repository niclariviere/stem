import { useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Bug, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

type Severity = "critical" | "severe" | "irritating";

const SEVERITIES: { value: Severity; label: string; hint: string; tone: string }[] = [
  { value: "critical", label: "Critical", hint: "Blocking", tone: "text-destructive border-destructive/40" },
  { value: "severe", label: "Severe", hint: "Destructive", tone: "text-orange-400 border-orange-400/40" },
  { value: "irritating", label: "Irritating", hint: "Not behaving as expected", tone: "text-yellow-400 border-yellow-400/40" },
];

function severityMeta(value: string) {
  return SEVERITIES.find(s => s.value === value) ?? SEVERITIES[2];
}

export default function BugReport() {
  const [, navigate] = useLocation();
  const { user } = useAuth({ redirectOnUnauthenticated: true });

  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<Severity>("irritating");

  const report = trpc.bugs.report.useMutation();
  const { data: reports, refetch } = trpc.bugs.list.useQuery();
  const setStatus = trpc.bugs.setStatus.useMutation({
    onSuccess: () => refetch(),
    onError: e => toast.error(e.message ?? "Couldn't update status"),
  });

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast.error("Add a description first");
      return;
    }
    try {
      await report.mutateAsync({ description: description.trim(), severity });
      toast.success("Bug reported — thank you");
      setDescription("");
      setSeverity("irritating");
      refetch();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to submit");
    }
  };

  return (
    <div className="min-h-screen px-6 py-12 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Button variant="outline" size="icon" onClick={() => navigate("/profile")}
          className="border-border text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <Bug className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">Report a Bug</h1>
        </div>
      </div>

      <motion.div
        className="surface-glass rounded-lg p-6 mb-10"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <label className="text-xs font-display tracking-[0.2em] text-muted-foreground uppercase mb-3 block">
          What went wrong?
        </label>
        <Textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Describe what you did, what you expected, and what happened instead."
          className="min-h-32 mb-5 bg-background/40"
        />

        <label className="text-xs font-display tracking-[0.2em] text-muted-foreground uppercase mb-3 block">
          Severity
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {SEVERITIES.map(s => (
            <button
              key={s.value}
              onClick={() => setSeverity(s.value)}
              className={`text-left p-3 rounded-lg border transition-all ${
                severity === s.value
                  ? `surface-glass ${s.tone} ring-1 ring-current`
                  : "border-border text-muted-foreground hover:border-foreground/30"
              }`}
            >
              <div className="text-sm font-medium">{s.label}</div>
              <div className="text-xs opacity-70 mt-0.5">{s.hint}</div>
            </button>
          ))}
        </div>

        <Button
          onClick={handleSubmit}
          disabled={report.isPending}
          className="gradient-primary text-primary-foreground"
        >
          {report.isPending ? "Submitting…" : "Submit report"}
        </Button>
      </motion.div>

      <h2 className="text-xs font-display tracking-[0.2em] text-muted-foreground uppercase mb-4">
        Reported so far
      </h2>
      <div className="space-y-3">
        {!reports?.length ? (
          <p className="text-sm text-muted-foreground/50 py-4">No bugs reported yet.</p>
        ) : (
          reports.map((b: any) => {
            const meta = severityMeta(b.severity);
            const fixed = b.status === "resolved";
            const isAdmin = user?.role === "admin";
            return (
              <div
                key={b.id}
                className={`rounded-lg p-4 transition-colors ${
                  fixed ? "border border-accent/50 bg-accent/10" : "surface-glass"
                }`}
              >
                <div className="flex items-center justify-between mb-2 gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded border ${meta.tone}`}>
                      {meta.label}
                    </span>
                    {fixed && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-accent/20 text-accent border border-accent/40">
                        <CheckCircle2 className="h-3 w-3" /> FIXED
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {new Date(b.createdAt).toLocaleDateString()}
                    </span>
                    {isAdmin && (
                      <button
                        onClick={() => setStatus.mutate({ id: b.id, status: fixed ? "open" : "resolved" })}
                        disabled={setStatus.isPending}
                        className="text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-0.5 transition-colors disabled:opacity-40"
                      >
                        {fixed ? "Reopen" : "Mark fixed"}
                      </button>
                    )}
                  </div>
                </div>
                <p className={`text-sm whitespace-pre-wrap ${fixed ? "text-foreground/45" : "text-foreground/80"}`}>
                  {b.description}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

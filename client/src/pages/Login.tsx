import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useLocation, useSearch } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Shield, Mail, Wallet, ArrowLeft, ExternalLink } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { requestMagicLink, signInWithSolana } from "@/lib/auth";
import { WemakeLogo } from "@/components/WemakeLogo";

type Step = "token" | "choose" | "email-sent";

export default function Login() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const inviteFromUrl = params.get("invite") ?? "";
  const errorFromUrl = params.get("error") ?? "";

  const [token, setToken] = useState(inviteFromUrl);
  const [email, setEmail] = useState("");
  const [error, setError] = useState(errorFromUrl);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<Step>(inviteFromUrl ? "token" : "choose");
  const { isAuthenticated, loading } = useAuth();

  // Only validate the token when we have one. Existing users don't need one.
  const validateInvite = trpc.invitations.validate.useQuery(
    { token },
    { enabled: token.length > 10, retry: false }
  );

  useEffect(() => {
    if (isAuthenticated && !loading) {
      navigate("/profile");
    }
  }, [isAuthenticated, loading, navigate]);

  const handleTokenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setError("Please enter your invitation token");
      return;
    }
    if (validateInvite.data?.valid === false) {
      setError(validateInvite.data.reason ?? "Invalid token");
      return;
    }
    if (validateInvite.data?.valid) {
      setError("");
      setStep("choose");
    } else {
      setError("Validating token…");
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setDevLink(null);
    setSubmitting(true);
    try {
      const result = await requestMagicLink(email.trim(), token.trim() || undefined);
      if (result.devMagicLink) {
        setDevLink(result.devMagicLink);
      }
      setStep("email-sent");
    } catch (err: any) {
      setError(err?.message ?? "Failed to send magic link");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSolana = async () => {
    setError("");
    setSubmitting(true);
    try {
      await signInWithSolana(token.trim() || undefined);
      navigate("/profile");
    } catch (err: any) {
      setError(err?.message ?? "Sign-in failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const header = (label: string) => (
    <div className="flex flex-col items-center mb-10">
      <WemakeLogo className="mb-3" />
      <p className="text-muted-foreground text-sm tracking-widest uppercase">{label}</p>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(oklch(0.65 0.22 290) 1px, transparent 1px), linear-gradient(90deg, oklch(0.65 0.22 290) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <motion.div
        className="w-full max-w-sm relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {step === "token" && (
          <>
            {header("Invitation Only")}
            <form onSubmit={handleTokenSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-display tracking-wider text-muted-foreground uppercase mb-2 block">
                  Invitation Token
                </label>
                <Input
                  type="text"
                  placeholder="Paste your invitation token"
                  value={token}
                  onChange={e => { setToken(e.target.value); setError(""); }}
                  className="bg-secondary border-border h-12 text-center tracking-widest font-mono"
                  autoComplete="off"
                />
              </div>

              {validateInvite.isLoading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Validating…
                </div>
              )}
              {validateInvite.data?.valid === true && (
                <div className="flex items-center gap-2 text-xs text-accent">
                  <Shield className="h-3 w-3" /> Valid invitation — continue below
                </div>
              )}
              {error && <p className="text-destructive text-xs text-center">{error}</p>}

              <Button
                type="submit"
                disabled={validateInvite.isLoading}
                className="w-full h-12 gradient-primary text-primary-foreground font-display tracking-wider"
              >
                {validateInvite.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "VERIFY TOKEN"}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => { setToken(""); setError(""); setStep("choose"); }}
                  className="text-accent hover:text-accent/80 transition-colors"
                >
                  sign in
                </button>
              </p>
            </form>
          </>
        )}

        {step === "choose" && (
          <>
            {header(token ? "Choose how to sign in" : "Sign in")}

            {error && <p className="text-destructive text-xs text-center mb-4">{error}</p>}

            <div className="space-y-3">
              <form onSubmit={handleMagicLink} className="surface-glass rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-display tracking-wider text-muted-foreground uppercase">
                  <Mail className="h-3 w-3" /> Email — magic link
                </div>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="bg-background border-border h-11"
                  autoComplete="email"
                  required
                />
                <Button
                  type="submit"
                  disabled={submitting || !email.includes("@")}
                  className="w-full h-11 gradient-primary text-primary-foreground font-display tracking-wider"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "SEND MAGIC LINK"}
                </Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-background px-3 text-muted-foreground">or</span>
                </div>
              </div>

              <div className="surface-glass rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-display tracking-wider text-muted-foreground uppercase">
                  <Wallet className="h-3 w-3" /> Solana — Phantom wallet
                </div>
                <Button
                  type="button"
                  onClick={handleSolana}
                  disabled={submitting}
                  variant="outline"
                  className="w-full h-11 font-display tracking-wider"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "SIGN IN WITH SOLANA"}
                </Button>
                <p className="text-[10px] text-muted-foreground text-center">
                  Signature only — no transaction, no fees
                </p>
              </div>
            </div>

            {token && (
              <button
                onClick={() => setStep("token")}
                className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mt-6"
              >
                <ArrowLeft className="h-3 w-3" /> Back
              </button>
            )}
          </>
        )}

        {step === "email-sent" && (
          <>
            {header("Check your email")}
            <div className="surface-glass rounded-lg p-6 text-center space-y-4">
              <Mail className="h-10 w-10 text-accent mx-auto" />
              <p className="text-sm text-foreground">
                A magic link was generated for <span className="font-mono">{email}</span>.
              </p>
              {devLink ? (
                <div className="bg-background border border-border rounded p-3 space-y-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Dev mode — link shown here</p>
                  <a
                    href={devLink}
                    className="flex items-center justify-center gap-2 text-xs text-accent hover:underline break-all"
                  >
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    <span className="truncate">{devLink}</span>
                  </a>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  The link will be delivered via the channel Nic set up for you.
                </p>
              )}
              <button
                onClick={() => { setStep("choose"); setDevLink(null); }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Use a different method
              </button>
            </div>
          </>
        )}

        <button
          onClick={() => navigate("/")}
          className="mt-8 block mx-auto text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors tracking-widest"
        >
          ← BACK
        </button>
      </motion.div>
    </div>
  );
}

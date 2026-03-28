import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useLocation, useSearch } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Zap, Shield, ArrowLeft } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";

export default function Login() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const inviteFromUrl = params.get("invite") ?? "";

  const [token, setToken] = useState(inviteFromUrl);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"token" | "oauth">("token");
  const { isAuthenticated, loading } = useAuth();

  const validateInvite = trpc.invitations.validate.useQuery(
    { token },
    { enabled: token.length > 10, retry: false }
  );

  // If already authenticated, redirect to profile
  useEffect(() => {
    if (isAuthenticated && !loading) {
      navigate("/profile");
    }
  }, [isAuthenticated, loading, navigate]);

  const handleTokenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) { setError("Please enter your invitation token"); return; }
    if (validateInvite.data?.valid === false) {
      setError(validateInvite.data.reason ?? "Invalid token");
      return;
    }
    if (validateInvite.data?.valid) {
      // Store token for after OAuth
      sessionStorage.setItem("stem-invite-token", token);
      setStep("oauth");
    } else {
      setError("Validating token...");
    }
  };

  const handleOAuthLogin = () => {
    const loginUrl = getLoginUrl();
    window.location.href = loginUrl;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      {/* Background grid */}
      <div className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(oklch(0.65 0.22 290) 1px, transparent 1px), linear-gradient(90deg, oklch(0.65 0.22 290) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <motion.div
        className="w-full max-w-sm relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-display font-bold text-foreground text-glow mb-2">STEM</h1>
          <p className="text-muted-foreground text-sm tracking-widest uppercase">
            {step === "token" ? "Invitation Only" : "Connect Account"}
          </p>
        </div>

        {step === "token" ? (
          <form onSubmit={handleTokenSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-display tracking-wider text-muted-foreground uppercase mb-2 block">
                Invitation Token
              </label>
              <Input
                type="text"
                placeholder="Enter your invitation token"
                value={token}
                onChange={(e) => { setToken(e.target.value); setError(""); }}
                className="bg-secondary border-border text-foreground placeholder:text-muted-foreground/50 h-12 text-center tracking-widest font-mono"
                autoComplete="off"
              />
            </div>

            {validateInvite.isLoading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Validating token...
              </div>
            )}
            {validateInvite.data?.valid === true && (
              <div className="flex items-center gap-2 text-xs text-accent">
                <Shield className="h-3 w-3" />
                Valid invitation — proceed to login
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

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-background px-3 text-muted-foreground">or</span>
              </div>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              Don't have an invite?{" "}
              <a href="https://stem.nixmusic.net" target="_blank" rel="noopener noreferrer"
                className="text-accent hover:text-accent/80 transition-colors">
                Join the waitlist
              </a>
            </p>
          </form>
        ) : (
          <motion.div
            className="space-y-4"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="surface-glass rounded-lg p-4 text-center mb-6">
              <Shield className="h-8 w-8 text-accent mx-auto mb-2" />
              <p className="text-sm text-foreground font-display">Token verified</p>
              <p className="text-xs text-muted-foreground mt-1">Now connect your account to continue</p>
            </div>

            <Button
              onClick={handleOAuthLogin}
              className="w-full h-12 gradient-primary text-primary-foreground font-display tracking-wider"
            >
              <Zap className="h-4 w-4 mr-2" />
              CONNECT WITH MANUS
            </Button>

            <button
              onClick={() => setStep("token")}
              className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mt-2"
            >
              <ArrowLeft className="h-3 w-3" /> Back to token
            </button>
          </motion.div>
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

import { motion } from "framer-motion";
import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

const WAVEFORM_CDN = "https://d2xsxph8kpxj0f.cloudfront.net/310519663277635327/CMCGNeGMcySGyYELtaJwyd/waveform-hero_ba79766b.jpg";

export default function Home() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const waitlistAdd = trpc.waitlist.add.useMutation();

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) return;
    try {
      await waitlistAdd.mutateAsync({ email: trimmed });
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.message ?? "Couldn't save — try again");
    }
  };

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden cursor-pointer"
      onClick={() => navigate("/login")}
    >
      {/* Background waveform */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.img
          src={WAVEFORM_CDN}
          alt="Sound waveform visualization"
          className="w-full h-full object-cover opacity-60"
          initial={{ scale: 1.1, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.6 }}
          transition={{ duration: 2, ease: "easeOut" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-background/80" />
      </div>

      {/* Animated grid overlay */}
      <div className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: "linear-gradient(oklch(0.65 0.22 290) 1px, transparent 1px), linear-gradient(90deg, oklch(0.65 0.22 290) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-5xl">
        <motion.div
          className="mb-6 inline-flex items-center gap-3 px-4 py-2 rounded-full surface-glass"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="text-xs font-display tracking-[0.3em] text-accent uppercase">Invitation Only — Beta</span>
        </motion.div>

        <motion.h1
          className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-display font-bold tracking-tight text-foreground text-glow leading-none"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5 }}
        >
          IT ALWAYS STARTS
          <br />
          WITH A STEM
        </motion.h1>

        <motion.p
          className="mt-8 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.9 }}
        >
          Render once. Own forever. Share without fear.
        </motion.p>

        <motion.div
          className="mt-12 sm:mt-16 flex items-center justify-center gap-8 sm:gap-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.2 }}
        >
          {["PROTECT", "MONETIZE", "MATCH"].map((word, i) => (
            <motion.span
              key={word}
              className="text-sm sm:text-base md:text-lg font-display font-medium tracking-[0.3em] text-muted-foreground hover:text-primary transition-colors duration-500"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.4 + i * 0.2 }}
            >
              {word}
            </motion.span>
          ))}
        </motion.div>

        {/* Waitlist — primary CTA for non-invited visitors; merged with the
            "Click anywhere to enter" hint underneath for invited folks. */}
        <motion.div
          className="mt-16 max-w-md mx-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.2 }}
        >
          <div onClick={(e) => e.stopPropagation()} className="cursor-default">
            {submitted ? (
              <p className="text-sm text-muted-foreground text-center">
                Thanks — we'll reach out when there's room.
              </p>
            ) : (
              <form onSubmit={handleWaitlistSubmit} className="flex flex-col gap-3">
                <p className="text-xs tracking-[0.2em] text-muted-foreground/70 uppercase text-center">
                  Want to be considered for invitation?
                </p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    required
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(null); }}
                    className="flex-1 rounded-lg bg-background/50 border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary"
                  />
                  <button
                    type="submit"
                    disabled={waitlistAdd.isPending}
                    className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
                  >
                    {waitlistAdd.isPending ? "…" : "Notify me"}
                  </button>
                </div>
                {error && <p className="text-xs text-destructive text-center">{error}</p>}
              </form>
            )}
          </div>
          <p className="mt-6 text-xs tracking-widest text-muted-foreground/40 uppercase text-center">
            Already invited? Tap anywhere to enter.
          </p>
        </motion.div>
      </div>

      {/* Bottom tagline */}
      <motion.div
        className="absolute bottom-8 left-0 right-0 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.5 }}
      >
        <p className="text-xs text-muted-foreground/30 tracking-widest uppercase font-display">
          stem.nixmusic.net
        </p>
      </motion.div>
    </div>
  );
}

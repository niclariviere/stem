import type { Express, Request, Response } from "express";
import { z } from "zod";
import {
  issueMagicLink,
  consumeMagicLink,
  issueSiwsChallenge,
  verifySiwsSignature,
  linkWalletToUser,
  setSessionCookie,
  verifySessionCookie,
} from "./auth";
import * as db from "../db";
import { ENV } from "./env";

const emailSchema = z.string().email().max(320);
const walletSchema = z.string().min(32).max(44);
const signatureSchema = z.string().min(64).max(128);
const inviteSchema = z.string().min(10).max(64).optional();

export function registerAuthRoutes(app: Express) {
  // ── Magic link: request ────────────────────────────────────────────────────
  app.post("/api/auth/magic/request", async (req: Request, res: Response) => {
    const parsed = z.object({
      email: emailSchema,
      inviteToken: inviteSchema,
    }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: "Invalid email or invitation" });
      return;
    }
    const { email, inviteToken } = parsed.data;

    try {
      // Gate new accounts behind a valid invite — existing users don't need one,
      // and admin emails bootstrap without one so the first account can be made.
      const existing = await db.getUserByEmail(email.toLowerCase());
      const isAdmin = ENV.adminEmails.includes(email.toLowerCase());
      if (!existing && !isAdmin) {
        if (!inviteToken) {
          res.status(403).json({ ok: false, error: "Invitation required" });
          return;
        }
        const invite = await db.getInvitationByToken(inviteToken);
        if (!invite || invite.usedBy || (invite.expiresAt && invite.expiresAt < new Date())) {
          res.status(403).json({ ok: false, error: "Invalid or expired invitation" });
          return;
        }
      }

      const url = await issueMagicLink(email, inviteToken ?? null);

      // TRIO PHASE: we don't send email — Nic reads the link from the server
      // console and manually shares it. Log prominently and return to the client.
      // When switching to SIWS permanently this endpoint gets disabled.
      console.log("\n" + "=".repeat(72));
      console.log(`[MAGIC LINK] for ${email}`);
      console.log(url);
      console.log("=".repeat(72) + "\n");

      // Include the URL in the dev response so Nic can copy it from the page
      // too. In production we would return only { ok: true }.
      res.json({
        ok: true,
        // only return in non-production for safety
        ...(ENV.isProduction ? {} : { devMagicLink: url }),
      });
    } catch (err) {
      console.error("[Auth] magic/request failed", err);
      res.status(500).json({ ok: false, error: "Failed to issue magic link" });
    }
  });

  // ── Magic link: verify (link target) ───────────────────────────────────────
  // GET renders a tiny interstitial page that auto-submits via JS in real
  // browsers. Preview bots (Messenger, iMessage, WhatsApp, Slack, etc.) fetch
  // the URL when a user pastes the link into a chat — they parse HTML but do
  // not execute JS, so they see this page but never trigger the POST. The
  // token stays unburned until the human actually clicks/lands here.
  app.get("/api/auth/magic/verify", (req: Request, res: Response) => {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!token) {
      res.redirect(302, "/login?error=missing_token");
      return;
    }
    // Defensive escape — tokens are base64url so they have no HTML-unsafe
    // chars, but never trust input. Keep it server-side.
    const safeToken = token.replace(/[^A-Za-z0-9_-]/g, "");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("X-Robots-Tag", "noindex, nofollow, nosnippet, noarchive");
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,nosnippet,noarchive">
<title>Signing in to STEM…</title>
<style>
  html,body{margin:0;background:#0a0a0a;color:#e5e5e5;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  body{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1.5rem}
  .card{text-align:center;max-width:24rem;width:100%}
  h1{font-size:1.5rem;margin:0 0 .5rem;letter-spacing:.2em;font-weight:600}
  p{color:#a3a3a3;font-size:.9rem;margin:0 0 1.5rem}
  button{background:oklch(0.65 0.22 290);color:#fff;border:0;padding:.75rem 2rem;border-radius:.5rem;font-size:.9rem;font-weight:500;cursor:pointer}
  button:hover{opacity:.9}
</style>
</head>
<body>
<form id="s" action="/api/auth/magic/verify" method="POST" class="card">
  <h1>STEM</h1>
  <p>Signing you in…</p>
  <input type="hidden" name="token" value="${safeToken}">
  <button type="submit">Sign in</button>
</form>
<script>document.getElementById('s').submit();</script>
</body>
</html>`);
  });

  app.post("/api/auth/magic/verify", async (req: Request, res: Response) => {
    const token = typeof req.body?.token === "string" ? req.body.token : "";
    if (!token) {
      res.redirect(302, "/login?error=missing_token");
      return;
    }
    const result = await consumeMagicLink(token);
    if (!result.ok) {
      res.redirect(302, `/login?error=${encodeURIComponent(result.reason)}`);
      return;
    }
    await setSessionCookie(req, res, result.user.id);
    res.redirect(302, "/profile");
  });

  // ── SIWS: challenge ────────────────────────────────────────────────────────
  app.post("/api/auth/siws/challenge", async (req: Request, res: Response) => {
    const parsed = z.object({ wallet: walletSchema }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: "Invalid wallet" });
      return;
    }
    try {
      const { nonce, message } = await issueSiwsChallenge(parsed.data.wallet);
      res.json({ ok: true, nonce, message });
    } catch (err) {
      console.error("[Auth] siws/challenge failed", err);
      res.status(500).json({ ok: false, error: "Failed to issue challenge" });
    }
  });

  // ── SIWS: verify ───────────────────────────────────────────────────────────
  app.post("/api/auth/siws/verify", async (req: Request, res: Response) => {
    const parsed = z.object({
      nonce: z.string().min(16).max(64),
      signature: signatureSchema,
      inviteToken: inviteSchema,
    }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: "Invalid payload" });
      return;
    }
    const result = await verifySiwsSignature({
      nonce: parsed.data.nonce,
      signature: parsed.data.signature,
      inviteToken: parsed.data.inviteToken ?? null,
    });
    if (!result.ok) {
      res.status(401).json({ ok: false, error: result.reason });
      return;
    }
    await setSessionCookie(req, res, result.user.id);
    res.json({ ok: true });
  });

  // ── Wallet linking (for a logged-in magic-link user) ──────────────────────
  app.post("/api/auth/wallet/link", async (req: Request, res: Response) => {
    const user = await verifySessionCookie(req);
    if (!user) {
      res.status(401).json({ ok: false, error: "Not signed in" });
      return;
    }
    const parsed = z.object({
      nonce: z.string().min(16).max(64),
      signature: signatureSchema,
    }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: "Invalid payload" });
      return;
    }
    const result = await linkWalletToUser({
      userId: user.id,
      nonce: parsed.data.nonce,
      signature: parsed.data.signature,
    });
    if (!result.ok) {
      res.status(400).json({ ok: false, error: result.reason });
      return;
    }
    res.json({ ok: true });
  });
}

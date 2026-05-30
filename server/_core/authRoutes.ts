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
  app.get("/api/auth/magic/verify", async (req: Request, res: Response) => {
    const token = typeof req.query.token === "string" ? req.query.token : "";
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

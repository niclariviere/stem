import { SignJWT, jwtVerify } from "jose";
import type { Request, Response } from "express";
import { parse as parseCookieHeader } from "cookie";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { randomBytes } from "crypto";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";
import { getSessionCookieOptions } from "./cookies";

const CHALLENGE_TTL_MS = 10 * 60 * 1000; // 10 min

function sessionSecret() {
  if (!ENV.cookieSecret) {
    throw new Error("JWT_SECRET is not set; refusing to sign sessions");
  }
  return new TextEncoder().encode(ENV.cookieSecret);
}

// ─── Session JWT ──────────────────────────────────────────────────────────────

export async function signSession(userId: number): Promise<string> {
  const expSeconds = Math.floor((Date.now() + ONE_YEAR_MS) / 1000);
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expSeconds)
    .sign(sessionSecret());
}

export async function verifySessionCookie(req: Request): Promise<User | null> {
  const header = req.headers.cookie;
  if (!header) return null;
  const cookies = parseCookieHeader(header);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionSecret(), { algorithms: ["HS256"] });
    const userId = (payload as { userId?: unknown }).userId;
    if (typeof userId !== "number") return null;
    const user = await db.getUserById(userId);
    return user ?? null;
  } catch {
    return null;
  }
}

export async function setSessionCookie(req: Request, res: Response, userId: number) {
  const token = await signSession(userId);
  res.cookie(COOKIE_NAME, token, {
    ...getSessionCookieOptions(req),
    maxAge: ONE_YEAR_MS,
  });
}

// ─── Magic link ───────────────────────────────────────────────────────────────

function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export async function issueMagicLink(email: string, inviteToken: string | null): Promise<string> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);
  await db.createAuthChallenge({
    type: "magic-link",
    token,
    identifier: email.toLowerCase(),
    payload: inviteToken ?? null,
    expiresAt,
  });
  return `${ENV.siteUrl}/api/auth/magic/verify?token=${encodeURIComponent(token)}`;
}

export async function consumeMagicLink(token: string): Promise<
  | { ok: true; user: User }
  | { ok: false; reason: string }
> {
  const challenge = await db.getAuthChallengeByToken(token);
  if (!challenge || challenge.type !== "magic-link") return { ok: false, reason: "Invalid link" };
  if (challenge.usedAt) return { ok: false, reason: "Link already used" };
  if (challenge.expiresAt < new Date()) return { ok: false, reason: "Link expired" };

  const email = challenge.identifier;
  const inviteToken = challenge.payload;
  const isAdmin = ENV.adminEmails.includes(email);

  // Validate invite if the user is new. Admins bypass the invite gate so the
  // first account can bootstrap before any invitation exists.
  let user = await db.getUserByEmail(email);
  if (!user) {
    let invitedBy: number | null = null;
    if (!isAdmin) {
      if (!inviteToken) return { ok: false, reason: "Invitation required for new accounts" };
      const invite = await db.getInvitationByToken(inviteToken);
      if (!invite) return { ok: false, reason: "Invalid invitation" };
      if (invite.usedBy) return { ok: false, reason: "Invitation already used" };
      if (invite.expiresAt && invite.expiresAt < new Date()) return { ok: false, reason: "Invitation expired" };
      invitedBy = invite.createdBy;
    }
    await db.createUserFromMagicLink({
      email,
      role: isAdmin ? "admin" : "user",
      invitedBy,
      isVerified: true,
    });
    if (!isAdmin && inviteToken) {
      await db.useInvitationByToken(inviteToken);
    }
    user = await db.getUserByEmail(email);
  }

  if (!user) return { ok: false, reason: "Failed to create user" };

  await db.markAuthChallengeUsed(challenge.id);
  await db.touchUserSignIn(user.id);
  return { ok: true, user };
}

// ─── SIWS (Sign-In With Solana) ───────────────────────────────────────────────

function buildSiwsMessage(wallet: string, nonce: string, issuedAt: string): string {
  const host = (() => {
    try { return new URL(ENV.siteUrl).host; } catch { return "stem"; }
  })();
  return [
    `${host} wants you to sign in with your Solana account.`,
    "",
    `Wallet: ${wallet}`,
    `Nonce: ${nonce}`,
    `Issued: ${issuedAt}`,
    "",
    "By signing, you confirm you own this wallet. No transaction. No fees.",
  ].join("\n");
}

function isValidBase58Address(addr: string): boolean {
  if (!addr || addr.length < 32 || addr.length > 44) return false;
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
}

export async function issueSiwsChallenge(wallet: string): Promise<{ nonce: string; message: string }> {
  if (!isValidBase58Address(wallet)) throw new Error("Invalid Solana wallet address");
  const nonce = randomToken(16);
  const issuedAt = new Date().toISOString();
  const message = buildSiwsMessage(wallet, nonce, issuedAt);
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);
  await db.createAuthChallenge({
    type: "siws",
    token: nonce,
    identifier: wallet,
    payload: message,
    expiresAt,
  });
  return { nonce, message };
}

export async function verifySiwsSignature(args: {
  nonce: string;
  signature: string;     // base58-encoded signature
  inviteToken?: string | null;
}): Promise<{ ok: true; user: User } | { ok: false; reason: string }> {
  const challenge = await db.getAuthChallengeByToken(args.nonce);
  if (!challenge || challenge.type !== "siws") return { ok: false, reason: "Invalid challenge" };
  if (challenge.usedAt) return { ok: false, reason: "Challenge already used" };
  if (challenge.expiresAt < new Date()) return { ok: false, reason: "Challenge expired" };
  if (!challenge.payload) return { ok: false, reason: "Challenge payload missing" };

  const wallet = challenge.identifier;
  const message = challenge.payload;

  let signatureBytes: Uint8Array;
  let walletBytes: Uint8Array;
  try {
    signatureBytes = bs58.decode(args.signature);
    walletBytes = bs58.decode(wallet);
  } catch {
    return { ok: false, reason: "Malformed signature or wallet" };
  }

  const messageBytes = new TextEncoder().encode(message);
  const valid = nacl.sign.detached.verify(messageBytes, signatureBytes, walletBytes);
  if (!valid) return { ok: false, reason: "Signature verification failed" };

  // Find or create user by walletAddress.
  let user = await db.getUserByWalletAddress(wallet);
  if (!user) {
    if (!args.inviteToken) return { ok: false, reason: "Invitation required for new accounts" };
    const invite = await db.getInvitationByToken(args.inviteToken);
    if (!invite) return { ok: false, reason: "Invalid invitation" };
    if (invite.usedBy) return { ok: false, reason: "Invitation already used" };
    if (invite.expiresAt && invite.expiresAt < new Date()) return { ok: false, reason: "Invitation expired" };

    await db.createUserFromSiws({
      walletAddress: wallet,
      role: "user",
      invitedBy: invite.createdBy ?? null,
      isVerified: true,
    });
    await db.useInvitationByToken(args.inviteToken);
    user = await db.getUserByWalletAddress(wallet);
  }

  if (!user) return { ok: false, reason: "Failed to resolve user" };

  await db.markAuthChallengeUsed(challenge.id);
  await db.touchUserSignIn(user.id);
  return { ok: true, user };
}

// ─── Wallet linking (for existing magic-link users) ──────────────────────────

export async function linkWalletToUser(args: {
  userId: number;
  nonce: string;
  signature: string;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const challenge = await db.getAuthChallengeByToken(args.nonce);
  if (!challenge || challenge.type !== "siws") return { ok: false, reason: "Invalid challenge" };
  if (challenge.usedAt) return { ok: false, reason: "Challenge already used" };
  if (challenge.expiresAt < new Date()) return { ok: false, reason: "Challenge expired" };
  if (!challenge.payload) return { ok: false, reason: "Challenge payload missing" };

  const wallet = challenge.identifier;
  const message = challenge.payload;

  try {
    const sigBytes = bs58.decode(args.signature);
    const walletBytes = bs58.decode(wallet);
    const messageBytes = new TextEncoder().encode(message);
    if (!nacl.sign.detached.verify(messageBytes, sigBytes, walletBytes)) {
      return { ok: false, reason: "Signature verification failed" };
    }
  } catch {
    return { ok: false, reason: "Malformed signature or wallet" };
  }

  // Refuse if another user already owns this wallet.
  const existing = await db.getUserByWalletAddress(wallet);
  if (existing && existing.id !== args.userId) {
    return { ok: false, reason: "Wallet is already linked to another account" };
  }

  await db.setUserWalletAddress(args.userId, wallet);
  await db.markAuthChallengeUsed(challenge.id);
  return { ok: true };
}

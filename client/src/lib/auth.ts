import bs58 from "bs58";
import { getPhantomProvider, connectPhantom } from "./phantomWallet";

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T & { ok?: boolean; error?: string };
  if (!res.ok || data.ok === false) {
    throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  }
  return data;
}

export async function requestMagicLink(email: string, inviteToken?: string) {
  return postJson<{ ok: true; devMagicLink?: string }>("/api/auth/magic/request", {
    email,
    inviteToken: inviteToken || undefined,
  });
}

/**
 * Sign in (or register, if invited) using the currently connected Phantom wallet.
 * Connects Phantom if not already connected, asks the server for a challenge
 * message, signs it in Phantom, and posts the signature back to verify.
 */
export async function signInWithSolana(inviteToken?: string): Promise<void> {
  const wallet = await connectPhantom();

  const challenge = await postJson<{ ok: true; nonce: string; message: string }>(
    "/api/auth/siws/challenge",
    { wallet }
  );

  const provider = getPhantomProvider();
  if (!provider) throw new Error("Phantom wallet not available");

  const encoded = new TextEncoder().encode(challenge.message);
  const signed = await provider.signMessage(encoded, "utf8");
  const signatureB58 = bs58.encode(signed.signature);

  await postJson<{ ok: true }>("/api/auth/siws/verify", {
    nonce: challenge.nonce,
    signature: signatureB58,
    inviteToken: inviteToken || undefined,
  });
}

/**
 * Attach a Solana wallet to a currently-signed-in (magic-link) user's account.
 * No invitation needed — they're already authenticated.
 */
export async function linkWalletToAccount(): Promise<void> {
  const wallet = await connectPhantom();

  const challenge = await postJson<{ ok: true; nonce: string; message: string }>(
    "/api/auth/siws/challenge",
    { wallet }
  );

  const provider = getPhantomProvider();
  if (!provider) throw new Error("Phantom wallet not available");

  const encoded = new TextEncoder().encode(challenge.message);
  const signed = await provider.signMessage(encoded, "utf8");
  const signatureB58 = bs58.encode(signed.signature);

  await postJson<{ ok: true }>("/api/auth/wallet/link", {
    nonce: challenge.nonce,
    signature: signatureB58,
  });
}

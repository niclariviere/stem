/**
 * Solana Relayer Core
 * Loads the server-side keypair and provides a shared connection.
 * The relayer wallet pays gas for all artist mints — artists mint for free.
 *
 * Network: devnet for testing, mainnet-beta for production.
 * Switch by setting SOLANA_NETWORK=mainnet-beta in secrets.
 */

import { Connection, Keypair, PublicKey, clusterApiUrl } from "@solana/web3.js";
import bs58 from "bs58";

export type SolanaNetwork = "devnet" | "mainnet-beta" | "testnet";

export function getSolanaNetwork(): SolanaNetwork {
  const net = process.env.SOLANA_NETWORK ?? "devnet";
  if (net === "mainnet-beta" || net === "devnet" || net === "testnet") return net;
  return "devnet";
}

export function getConnection(): Connection {
  const network = getSolanaNetwork();
  const rpcUrl = network === "mainnet-beta"
    ? "https://api.mainnet-beta.solana.com"
    : clusterApiUrl(network);
  return new Connection(rpcUrl, "confirmed");
}

export function getRelayerKeypair(): Keypair {
  const privateKeyB58 = process.env.SOLANA_RELAYER_PRIVATE_KEY;
  if (!privateKeyB58) {
    throw new Error("SOLANA_RELAYER_PRIVATE_KEY not set in environment");
  }
  try {
    const secretKey = bs58.decode(privateKeyB58);
    return Keypair.fromSecretKey(secretKey);
  } catch {
    throw new Error("SOLANA_RELAYER_PRIVATE_KEY is not a valid base58 keypair");
  }
}

export function getRelayerPublicKey(): PublicKey {
  return getRelayerKeypair().publicKey;
}

export async function getRelayerBalance(): Promise<number> {
  const connection = getConnection();
  const keypair = getRelayerKeypair();
  const lamports = await connection.getBalance(keypair.publicKey);
  return lamports / 1e9; // Convert lamports to SOL
}

export const SOLANA_EXPLORER_BASE: Record<SolanaNetwork, string> = {
  "devnet": "https://explorer.solana.com/?cluster=devnet",
  "mainnet-beta": "https://explorer.solana.com",
  "testnet": "https://explorer.solana.com/?cluster=testnet",
};

export function getTxExplorerUrl(txSig: string): string {
  const network = getSolanaNetwork();
  const base = SOLANA_EXPLORER_BASE[network];
  const clusterParam = network !== "mainnet-beta" ? `&cluster=${network}` : "";
  return `https://explorer.solana.com/tx/${txSig}${clusterParam ? `?cluster=${network}` : ""}`;
}

export function getNFTExplorerUrl(mintAddress: string): string {
  const network = getSolanaNetwork();
  const clusterParam = network !== "mainnet-beta" ? `?cluster=${network}` : "";
  return `https://explorer.solana.com/address/${mintAddress}${clusterParam}`;
}

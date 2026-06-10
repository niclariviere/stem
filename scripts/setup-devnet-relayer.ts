/**
 * One-shot: generate a devnet relayer keypair and fund it via airdrop.
 * Prints the pubkey + base58 secret so we can drop it into .env.
 * Devnet only — zero real value. Safe to re-run (makes a fresh keypair each time).
 */
import { Connection, Keypair, LAMPORTS_PER_SOL, clusterApiUrl } from "@solana/web3.js";
import bs58 from "bs58";

const kp = Keypair.generate();
const secretB58 = bs58.encode(kp.secretKey);

console.log("RELAYER_PUBKEY=" + kp.publicKey.toBase58());
console.log("SOLANA_RELAYER_PRIVATE_KEY=" + secretB58);

const conn = new Connection(clusterApiUrl("devnet"), "confirmed");
try {
  const sig = await conn.requestAirdrop(kp.publicKey, 2 * LAMPORTS_PER_SOL);
  await conn.confirmTransaction(sig, "confirmed");
  const bal = await conn.getBalance(kp.publicKey);
  console.log("AIRDROP_OK balance_SOL=" + bal / LAMPORTS_PER_SOL);
} catch (e) {
  console.log("AIRDROP_FAILED reason=" + (e as Error).message);
  console.log("Fallback: fund the pubkey above at https://faucet.solana.com (select Devnet).");
}

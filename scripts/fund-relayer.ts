/** Retry a devnet airdrop to an existing pubkey. Pass PUBKEY via env. */
import { Connection, PublicKey, LAMPORTS_PER_SOL, clusterApiUrl } from "@solana/web3.js";

const pubkey = new PublicKey(process.env.PUBKEY!);
const conn = new Connection(clusterApiUrl("devnet"), "confirmed");

for (let attempt = 1; attempt <= 5; attempt++) {
  try {
    const sig = await conn.requestAirdrop(pubkey, 1 * LAMPORTS_PER_SOL);
    await conn.confirmTransaction(sig, "confirmed");
    const bal = await conn.getBalance(pubkey);
    console.log(`AIRDROP_OK attempt=${attempt} balance_SOL=${bal / LAMPORTS_PER_SOL}`);
    process.exit(0);
  } catch (e) {
    console.log(`attempt=${attempt} failed: ${(e as Error).message}`);
    await new Promise(r => setTimeout(r, 2500));
  }
}
const bal = await conn.getBalance(pubkey);
console.log(`ALL_ATTEMPTS_DONE balance_SOL=${bal / LAMPORTS_PER_SOL}`);

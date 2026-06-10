import { Connection, LAMPORTS_PER_SOL, clusterApiUrl } from "@solana/web3.js";
import { getRelayerPublicKey, getSolanaNetwork } from "../server/lib/solanaRelayer";
import "dotenv/config";

const pk = getRelayerPublicKey();
const c = new Connection(clusterApiUrl(getSolanaNetwork() as any), "confirmed");
const bal = await c.getBalance(pk);
console.log("relayer=" + pk.toBase58() + " network=" + getSolanaNetwork() + " balance_SOL=" + bal / LAMPORTS_PER_SOL);

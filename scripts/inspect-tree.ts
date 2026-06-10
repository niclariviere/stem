import "dotenv/config";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { getSolanaNetwork } from "../server/lib/solanaRelayer";

const addr = new PublicKey(process.env.SOLANA_MERKLE_TREE!);
const c = new Connection(clusterApiUrl(getSolanaNetwork() as any), "confirmed");
const info = await c.getAccountInfo(addr);
if (!info) {
  console.log("tree account NOT FOUND on " + getSolanaNetwork());
} else {
  console.log("tree EXISTS owner=" + info.owner.toBase58() + " bytes=" + info.data.length + " lamports=" + info.lamports);
}

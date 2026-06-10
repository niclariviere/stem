import { Connection, clusterApiUrl } from "@solana/web3.js";
import { getSolanaNetwork } from "../server/lib/solanaRelayer";
import "dotenv/config";

const sig = process.env.SIG!;
const c = new Connection(clusterApiUrl(getSolanaNetwork() as any), "confirmed");
const tx = await c.getTransaction(sig, { maxSupportedTransactionVersion: 0 });
if (!tx) {
  console.log("tx NOT FOUND for " + sig);
} else {
  console.log("tx CONFIRMED slot=" + tx.slot + " err=" + JSON.stringify(tx.meta?.err) + " fee=" + tx.meta?.fee);
}

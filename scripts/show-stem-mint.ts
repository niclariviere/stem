import "dotenv/config";
import * as db from "../server/db";

const stem = await db.getStemById(Number(process.env.STEM_ID));
const net = stem?.solanaNetwork ?? "devnet";
const sig = stem?.solanaTxSig ?? "";
console.log("status=" + stem?.mintStatus + " isMinted=" + stem?.isMinted);
console.log("txSig=" + sig);
console.log("leafIndex=" + stem?.solanaLeafIndex + " tree=" + stem?.solanaMerkleTree);
console.log("explorer=https://explorer.solana.com/tx/" + sig + "?cluster=" + net);
process.exit(0);

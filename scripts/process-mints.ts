/** Drain the pending mint queue once. Run after queueing a mint to push it on-chain. */
import "dotenv/config";
import { processPendingMints } from "../server/lib/processMintQueue";

const result = await processPendingMints();
console.log(JSON.stringify(result));
process.exit(0);

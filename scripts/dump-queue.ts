import "dotenv/config";
import * as db from "../server/db";

const pending = await db.getPendingMintQueue();
console.log("pending_count=" + pending.length);
for (const e of pending) {
  console.log(JSON.stringify({
    id: e.id, type: e.type, referenceId: e.referenceId, status: e.status,
    attempts: e.attempts, wallet: e.artistWalletAddress, metadataUri: e.metadataUri,
    error: e.errorMessage,
  }, null, 2));
}
process.exit(0);

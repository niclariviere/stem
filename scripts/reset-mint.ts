/** Reset a stuck mint so it can be re-queued cleanly. Pass STEM_ID + QUEUE_ID via env. */
import "dotenv/config";
import * as db from "../server/db";

const stemId = Number(process.env.STEM_ID);
const queueId = Number(process.env.QUEUE_ID);

await db.updateStemMintStatus(stemId, "none");
await db.updateMintQueueEntry(queueId, {
  status: "failed",
  errorMessage: "superseded — metadata pinning bug fixed, re-queue",
  processedAt: new Date(),
});

console.log(`reset stem ${stemId} -> none; queue ${queueId} -> failed`);
process.exit(0);

/**
 * Mint-queue processor — the missing link between queueMint (marks pending + enqueues)
 * and a real on-chain cNFT. Drains pending `mintQueue` rows: mints each via the relayer,
 * then flips the stem to minted/failed and records the tx.
 *
 * Designed to be safe to call repeatedly (idempotent-ish via status transitions) so it can
 * run from a one-shot script now and a setInterval/cron later. The relayer pays gas; the
 * artist's wallet is only the cNFT recipient (no artist signature needed).
 */
import * as db from "../db";
import { mintStemCNFT } from "./mintStemCNFT";

const MAX_ATTEMPTS = 3;

export interface ProcessResult {
  processed: number;
  minted: number;
  failed: number;
  skipped: number;
}

export async function processPendingMints(): Promise<ProcessResult> {
  const treeAddress = process.env.SOLANA_MERKLE_TREE;
  if (!treeAddress) {
    throw new Error(
      "SOLANA_MERKLE_TREE not set — run scripts/create-merkle-tree.ts and add the address to .env first",
    );
  }

  const pending = await db.getPendingMintQueue();
  let minted = 0;
  let failed = 0;
  let skipped = 0;

  for (const entry of pending) {
    if (entry.type !== "stem") {
      skipped++; // song mints are a separate (future) path
      continue;
    }

    const attempts = entry.attempts + 1;
    await db.updateMintQueueEntry(entry.id, { status: "processing", attempts });

    try {
      const stem = await db.getStemById(entry.referenceId);
      if (!stem) throw new Error(`Stem ${entry.referenceId} not found`);
      const meta = await db.getStemMetadata(entry.referenceId);
      const user = await db.getUserById(entry.requestedBy);
      const artistName = user?.artistName ?? user?.name ?? "Artist";

      const result = await mintStemCNFT({
        artistWalletAddress: entry.artistWalletAddress,
        stemName: stem.fileName,
        artistName,
        ipfsCid: stem.ipfsCid ?? "",
        ipfsUrl: stem.ipfsUrl ?? "",
        metadataUri: entry.metadataUri ?? "",
        bpm: meta?.bpm ?? undefined,
        musicalKey: meta?.key ?? undefined,
        instrumentType: meta?.instrumentType ?? undefined,
        merkleTreeAddress: treeAddress,
      });

      await db.updateStemMintStatus(entry.referenceId, "minted", {
        solanaTxSig: result.txSignature,
        solanaMerkleTree: result.merkleTree,
        solanaLeafIndex: result.leafIndex,
        solanaNetwork: result.network,
        isMinted: true,
      });
      await db.updateMintQueueEntry(entry.id, {
        status: "complete",
        solanaTxSig: result.txSignature,
        processedAt: new Date(),
      });
      minted++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const giveUp = attempts >= MAX_ATTEMPTS;
      // Stay 'pending' for a retry until we exhaust attempts, then 'failed' so the UI badge resolves.
      await db.updateStemMintStatus(entry.referenceId, giveUp ? "failed" : "pending");
      await db.updateMintQueueEntry(entry.id, {
        status: giveUp ? "failed" : "pending",
        errorMessage: message,
        processedAt: giveUp ? new Date() : undefined,
      });
      if (giveUp) failed++;
    }
  }

  return { processed: pending.length, minted, failed, skipped };
}

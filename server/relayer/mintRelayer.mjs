/**
 * STEM Platform — Solana Mint Relayer
 * ====================================
 * Run this on your Mac Mini to process pending mint requests.
 * This script reads the mint queue from the database, mints each
 * stem/song as a cNFT/pNFT on Solana, and updates the database.
 *
 * Usage:
 *   node mintRelayer.mjs            # Process all pending mints once
 *   node mintRelayer.mjs --watch    # Run continuously (checks every 60s)
 *   node mintRelayer.mjs --dry-run  # Preview without minting
 *
 * Setup:
 *   1. Copy .env.relayer.example to .env.relayer and fill in values
 *   2. npm install @solana/web3.js @metaplex-foundation/umi
 *      @metaplex-foundation/mpl-bubblegum mysql2 dotenv
 *   3. node mintRelayer.mjs
 */

import { readFileSync, existsSync } from "fs";
import { createConnection } from "mysql2/promise";
import { Keypair, Connection, clusterApiUrl } from "@solana/web3.js";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { keypairIdentity } from "@metaplex-foundation/umi";
import { fromWeb3JsKeypair } from "@metaplex-foundation/umi-web3js-adapters";
import { createTree, mintToCollectionV1 } from "@metaplex-foundation/mpl-bubblegum";
import { generateSigner, percentAmount, publicKey as umiPublicKey } from "@metaplex-foundation/umi";
import { createNft } from "@metaplex-foundation/mpl-token-metadata";
import dotenv from "dotenv";

// Load environment
const envPath = existsSync(".env.relayer") ? ".env.relayer" : ".env";
dotenv.config({ path: envPath });

const {
  DATABASE_URL,
  SOLANA_RELAYER_PRIVATE_KEY,
  SOLANA_NETWORK = "devnet",
  SOLANA_MERKLE_TREE_ADDRESS,
  SOLANA_COLLECTION_MINT_ADDRESS,
} = process.env;

const isDryRun = process.argv.includes("--dry-run");
const isWatch = process.argv.includes("--watch");
const WATCH_INTERVAL_MS = 60_000; // 1 minute

// ─── Database helpers ─────────────────────────────────────────────────────────

async function getDb() {
  return createConnection(DATABASE_URL);
}

async function getPendingMints(db) {
  // Reclaim rows stuck in 'processing' for > 10 minutes (crash recovery).
  await db.execute(
    `UPDATE mintQueue SET status = 'pending'
     WHERE status = 'processing' AND createdAt < (NOW() - INTERVAL 10 MINUTE)`
  );
  const [rows] = await db.execute(
    `SELECT * FROM mintQueue WHERE status = 'pending' ORDER BY createdAt ASC LIMIT 50`
  );
  return rows;
}

async function markProcessing(db, id) {
  await db.execute(
    `UPDATE mintQueue SET status = 'processing', attempts = attempts + 1 WHERE id = ?`,
    [id]
  );
}

async function markComplete(db, id, txSig) {
  await db.execute(
    `UPDATE mintQueue SET status = 'complete', solanaTxSig = ?, processedAt = NOW() WHERE id = ?`,
    [txSig, id]
  );
}

async function markFailed(db, id, errorMessage) {
  await db.execute(
    `UPDATE mintQueue SET status = 'failed', errorMessage = ? WHERE id = ?`,
    [errorMessage, id]
  );
}

async function updateStemMinted(db, stemId, txSig, network) {
  await db.execute(
    `UPDATE stems SET isMinted = 1, mintStatus = 'minted', solanaTxSig = ?, solanaNetwork = ?, updatedAt = NOW() WHERE id = ?`,
    [txSig, network, stemId]
  );
}

async function updateSongMinted(db, songId, mintAddress, txSig, network) {
  await db.execute(
    `UPDATE songs SET mintStatus = 'minted', solanaMintAddress = ?, solanaTxSig = ?, solanaNetwork = ?, updatedAt = NOW() WHERE id = ?`,
    [mintAddress, txSig, network, songId]
  );
}

async function getStemById(db, id) {
  const [rows] = await db.execute(`SELECT * FROM stems WHERE id = ?`, [id]);
  return rows[0] ?? null;
}

async function getSongById(db, id) {
  const [rows] = await db.execute(`SELECT * FROM songs WHERE id = ?`, [id]);
  return rows[0] ?? null;
}

async function getSongSplits(db, songId) {
  const [rows] = await db.execute(
    `SELECT * FROM collaborationSplits WHERE songId = ? ORDER BY splitBps DESC`,
    [songId]
  );
  return rows;
}

// ─── Solana setup ─────────────────────────────────────────────────────────────

function loadKeypair() {
  if (!SOLANA_RELAYER_PRIVATE_KEY) {
    throw new Error("SOLANA_RELAYER_PRIVATE_KEY not set in environment");
  }
  const secretKey = Uint8Array.from(JSON.parse(SOLANA_RELAYER_PRIVATE_KEY));
  return Keypair.fromSecretKey(secretKey);
}

function getUmi(keypair) {
  const endpoint =
    SOLANA_NETWORK === "mainnet-beta"
      ? "https://api.mainnet-beta.solana.com"
      : clusterApiUrl("devnet");

  const umi = createUmi(endpoint);
  umi.use(keypairIdentity(fromWeb3JsKeypair(keypair)));
  return umi;
}

// ─── Minting logic ────────────────────────────────────────────────────────────

async function mintStemCNFT(umi, entry, stem) {
  if (!SOLANA_MERKLE_TREE_ADDRESS) {
    throw new Error(
      "SOLANA_MERKLE_TREE_ADDRESS not set. Run: node setupMerkleTree.mjs to create one."
    );
  }

  const treeAddress = umiPublicKey(SOLANA_MERKLE_TREE_ADDRESS);
  const recipientAddress = umiPublicKey(entry.artistWalletAddress);

  const metadata = {
    name: stem.fileName ?? "STEM NFT",
    symbol: "STEM",
    uri: entry.metadataUri ?? `https://stem.app/api/stems/${stem.id}/metadata.json`,
    sellerFeeBasisPoints: percentAmount(5, 2), // 5% royalty
    collection: SOLANA_COLLECTION_MINT_ADDRESS
      ? { key: umiPublicKey(SOLANA_COLLECTION_MINT_ADDRESS), verified: false }
      : null,
    creators: [
      {
        address: recipientAddress,
        verified: false,
        share: 100,
      },
    ],
  };

  const { signature } = await mintToCollectionV1(umi, {
    leafOwner: recipientAddress,
    merkleTree: treeAddress,
    collectionMint: SOLANA_COLLECTION_MINT_ADDRESS
      ? umiPublicKey(SOLANA_COLLECTION_MINT_ADDRESS)
      : generateSigner(umi).publicKey,
    metadata,
  }).sendAndConfirm(umi);

  return Buffer.from(signature).toString("base64");
}

async function mintSongPNFT(umi, entry, song, splits) {
  const nftSigner = generateSigner(umi);
  const recipientAddress = umiPublicKey(entry.artistWalletAddress);

  // Build creators array from splits
  const creators = splits.map((split) => ({
    address: umiPublicKey(split.walletAddress),
    verified: false,
    share: Math.round(split.splitPercent),
  }));

  // Ensure shares sum to 100
  if (creators.length > 0) {
    const total = creators.reduce((sum, c) => sum + c.share, 0);
    if (total !== 100) {
      creators[0].share += 100 - total;
    }
  }

  const { signature } = await createNft(umi, {
    mint: nftSigner,
    name: song.title ?? "STEM Song NFT",
    symbol: "STEMS",
    uri: entry.metadataUri ?? `https://stem.app/api/songs/${song.id}/metadata.json`,
    sellerFeeBasisPoints: percentAmount(10, 2), // 10% royalty on resale
    tokenOwner: recipientAddress,
    creators: creators.length > 0 ? creators : undefined,
    isCollection: false,
    isMutable: false, // Immutable after mint — permanent record
  }).sendAndConfirm(umi);

  return {
    mintAddress: nftSigner.publicKey.toString(),
    txSig: Buffer.from(signature).toString("base64"),
  };
}

// ─── Main processing loop ─────────────────────────────────────────────────────

async function processQueue() {
  console.log(`\n[${new Date().toISOString()}] STEM Mint Relayer starting...`);
  console.log(`  Network: ${SOLANA_NETWORK}`);
  console.log(`  Dry run: ${isDryRun}`);

  const db = await getDb();
  const keypair = loadKeypair();
  const umi = getUmi(keypair);

  console.log(`  Relayer wallet: ${keypair.publicKey.toBase58()}`);

  const pending = await getPendingMints(db);
  console.log(`  Pending mints: ${pending.length}`);

  if (pending.length === 0) {
    console.log("  Nothing to process.");
    await db.end();
    return;
  }

  let success = 0;
  let failed = 0;

  for (const entry of pending) {
    console.log(`\n  Processing mint #${entry.id} (type: ${entry.type}, ref: ${entry.referenceId})`);

    if (isDryRun) {
      console.log(`  [DRY RUN] Would mint ${entry.type} #${entry.referenceId} to ${entry.artistWalletAddress}`);
      success++;
      continue;
    }

    try {
      await markProcessing(db, entry.id);

      if (entry.type === "stem") {
        const stem = await getStemById(db, entry.referenceId);
        if (!stem) throw new Error(`Stem #${entry.referenceId} not found`);

        const txSig = await mintStemCNFT(umi, entry, stem);
        await markComplete(db, entry.id, txSig);
        await updateStemMinted(db, stem.id, txSig, SOLANA_NETWORK);

        console.log(`  ✓ Stem #${stem.id} minted. TX: ${txSig}`);
        success++;

      } else if (entry.type === "song") {
        const song = await getSongById(db, entry.referenceId);
        if (!song) throw new Error(`Song #${entry.referenceId} not found`);
        const splits = await getSongSplits(db, song.id);

        const { mintAddress, txSig } = await mintSongPNFT(umi, entry, song, splits);
        await markComplete(db, entry.id, txSig);
        await updateSongMinted(db, song.id, mintAddress, txSig, SOLANA_NETWORK);

        console.log(`  ✓ Song #${song.id} minted. Mint: ${mintAddress}`);
        success++;
      }

    } catch (err) {
      const msg = err?.message ?? String(err);
      console.error(`  ✗ Failed to mint entry #${entry.id}: ${msg}`);
      await markFailed(db, entry.id, msg);
      failed++;
    }
  }

  console.log(`\n  Done. Success: ${success}, Failed: ${failed}`);
  await db.end();
}

// ─── Entry point ──────────────────────────────────────────────────────────────

if (isWatch) {
  console.log(`Watching for mint requests every ${WATCH_INTERVAL_MS / 1000}s...`);
  processQueue();
  setInterval(processQueue, WATCH_INTERVAL_MS);
} else {
  processQueue().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}

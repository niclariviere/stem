/**
 * STEM Platform — Solana Merkle Tree Setup
 * ==========================================
 * Run this ONCE to create the Merkle tree and collection NFT needed
 * for compressed NFT (cNFT) minting.
 *
 * Usage:
 *   node setupMerkleTree.mjs
 *
 * Output: SOLANA_MERKLE_TREE_ADDRESS and SOLANA_COLLECTION_MINT_ADDRESS
 * Copy these into your .env.relayer file.
 */

import { Keypair, Connection, clusterApiUrl } from "@solana/web3.js";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { keypairIdentity, generateSigner, percentAmount, publicKey as umiPublicKey } from "@metaplex-foundation/umi";
import { fromWeb3JsKeypair } from "@metaplex-foundation/umi-web3js-adapters";
import { createTree } from "@metaplex-foundation/mpl-bubblegum";
import { createNft, TokenStandard } from "@metaplex-foundation/mpl-token-metadata";
import dotenv from "dotenv";
import { existsSync } from "fs";

const envPath = existsSync(".env.relayer") ? ".env.relayer" : ".env";
dotenv.config({ path: envPath });

const {
  SOLANA_RELAYER_PRIVATE_KEY,
  SOLANA_NETWORK = "devnet",
} = process.env;

if (!SOLANA_RELAYER_PRIVATE_KEY) {
  console.error("Error: SOLANA_RELAYER_PRIVATE_KEY not set");
  process.exit(1);
}

const secretKey = Uint8Array.from(JSON.parse(SOLANA_RELAYER_PRIVATE_KEY));
const keypair = Keypair.fromSecretKey(secretKey);

const endpoint =
  SOLANA_NETWORK === "mainnet-beta"
    ? "https://api.mainnet-beta.solana.com"
    : clusterApiUrl("devnet");

const umi = createUmi(endpoint);
umi.use(keypairIdentity(fromWeb3JsKeypair(keypair)));

console.log(`\nSTEM Platform — Merkle Tree Setup`);
console.log(`Network: ${SOLANA_NETWORK}`);
console.log(`Relayer wallet: ${keypair.publicKey.toBase58()}`);

// Step 1: Create Merkle tree
console.log("\nStep 1: Creating Merkle tree (supports up to 1,048,576 mints)...");
const merkleTreeSigner = generateSigner(umi);

try {
  const { signature } = await createTree(umi, {
    merkleTree: merkleTreeSigner,
    maxDepth: 20,        // 2^20 = 1,048,576 max leaves
    maxBufferSize: 64,   // Concurrent transactions buffer
    canopyDepth: 14,     // Reduces per-mint cost
  }).sendAndConfirm(umi);

  console.log(`✓ Merkle tree created!`);
  console.log(`  Address: ${merkleTreeSigner.publicKey}`);
  console.log(`  TX: ${Buffer.from(signature).toString("base64")}`);
} catch (err) {
  console.error("Failed to create Merkle tree:", err.message);
  process.exit(1);
}

// Step 2: Create collection NFT
console.log("\nStep 2: Creating STEM collection NFT...");
const collectionMint = generateSigner(umi);

try {
  await createNft(umi, {
    mint: collectionMint,
    name: "STEM Collection",
    symbol: "STEM",
    uri: "https://stem.app/collection-metadata.json",
    sellerFeeBasisPoints: percentAmount(5, 2),
    isCollection: true,
    isMutable: false,
  }).sendAndConfirm(umi);

  console.log(`✓ Collection NFT created!`);
  console.log(`  Mint address: ${collectionMint.publicKey}`);
} catch (err) {
  console.error("Failed to create collection NFT:", err.message);
  process.exit(1);
}

// Output
console.log("\n" + "=".repeat(60));
console.log("Setup complete! Add these to your .env.relayer:");
console.log("=".repeat(60));
console.log(`SOLANA_MERKLE_TREE_ADDRESS=${merkleTreeSigner.publicKey}`);
console.log(`SOLANA_COLLECTION_MINT_ADDRESS=${collectionMint.publicKey}`);
console.log("=".repeat(60));
console.log("\nAlso update SOLANA_MERKLE_TREE_ADDRESS in your Manus project secrets.");

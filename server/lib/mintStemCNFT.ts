/**
 * Stem cNFT Minting via Metaplex Bubblegum
 *
 * Compressed NFTs (cNFTs) use Merkle tree compression to store thousands of NFTs
 * for a fraction of the cost of regular NFTs. Each stem mint costs ~0.000005 SOL.
 *
 * Architecture:
 * - A Merkle tree is created once (by the relayer) and reused for all stem mints
 * - The relayer wallet signs and pays for all transactions
 * - The NFT is minted directly to the artist's wallet address
 * - Royalties are enforced at the Metaplex protocol level (5% on secondary sales)
 *
 * maxDepth=14, maxBufferSize=64 → up to 16,384 stems per tree
 */

import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  keypairIdentity,
  publicKey as umiPublicKey,
  generateSigner,
  none,
  some,
} from "@metaplex-foundation/umi";
import {
  createTree,
  mintV1,
  mplBubblegum,
  fetchTreeConfig,
  parseLeafFromMintV1Transaction,
} from "@metaplex-foundation/mpl-bubblegum";
import { fromWeb3JsKeypair } from "@metaplex-foundation/umi-web3js-adapters";
import { getRelayerKeypair, getSolanaNetwork } from "./solanaRelayer";

export const STEM_ROYALTY_BPS = 500; // 5% on secondary sales — enforced by Metaplex

export interface StemMintParams {
  artistWalletAddress: string;
  stemName: string;
  artistName: string;
  ipfsCid: string;
  ipfsUrl: string;
  metadataUri: string; // Pinata IPFS URL for the JSON metadata
  bpm?: number;
  musicalKey?: string;
  instrumentType?: string;
  merkleTreeAddress: string; // Pre-created Merkle tree for the collection
}

export interface StemMintResult {
  txSignature: string;
  leafIndex: number;
  merkleTree: string;
  explorerUrl: string;
  network: string;
}

function getRpcUrl(network: string): string {
  if (network === "mainnet-beta") return "https://api.mainnet-beta.solana.com";
  if (network === "devnet") return "https://api.devnet.solana.com";
  return "https://api.testnet.solana.com";
}

/**
 * Create a Merkle tree for storing compressed NFTs.
 * This is a one-time operation — the tree can hold up to 16,384 stems.
 * Call this once when setting up the platform, store the address in DB/env.
 */
export async function createStemMerkleTree(): Promise<{
  treeAddress: string;
  txSignature: string;
}> {
  const network = getSolanaNetwork();
  const umi = createUmi(getRpcUrl(network)).use(mplBubblegum());
  const relayerKeypair = getRelayerKeypair();
  const umiKeypair = fromWeb3JsKeypair(relayerKeypair);
  umi.use(keypairIdentity(umiKeypair));

  const merkleTree = generateSigner(umi);

  const builder = await createTree(umi, {
    merkleTree,
    maxDepth: 14,       // 2^14 = 16,384 leaves
    maxBufferSize: 64,
    public: some(false), // Only relayer (tree authority) can mint
  });

  const result = await builder.sendAndConfirm(umi);
  const txSig = Buffer.from(result.signature).toString("base64");

  return {
    treeAddress: merkleTree.publicKey.toString(),
    txSignature: txSig,
  };
}

/**
 * Verify a Merkle tree exists and is accessible.
 */
export async function verifyMerkleTree(treeAddress: string): Promise<boolean> {
  try {
    const network = getSolanaNetwork();
    const umi = createUmi(getRpcUrl(network)).use(mplBubblegum());
    const relayerKeypair = getRelayerKeypair();
    umi.use(keypairIdentity(fromWeb3JsKeypair(relayerKeypair)));
    await fetchTreeConfig(umi, umiPublicKey(treeAddress));
    return true;
  } catch {
    return false;
  }
}

/**
 * Mint a compressed NFT stem to the artist's wallet.
 * The relayer pays all gas — the artist pays nothing.
 * Royalties: 5% on every secondary sale, enforced by Metaplex protocol.
 */
export async function mintStemCNFT(params: StemMintParams): Promise<StemMintResult> {
  const network = getSolanaNetwork();
  const umi = createUmi(getRpcUrl(network)).use(mplBubblegum());
  const relayerKeypair = getRelayerKeypair();
  const umiKeypair = fromWeb3JsKeypair(relayerKeypair);
  umi.use(keypairIdentity(umiKeypair));

  const artistPublicKey = umiPublicKey(params.artistWalletAddress);
  const treePublicKey = umiPublicKey(params.merkleTreeAddress);

  const { signature } = await mintV1(umi, {
    leafOwner: artistPublicKey,
    merkleTree: treePublicKey,
    metadata: {
      name: `STEM: ${params.stemName}`,
      symbol: "STEM",
      uri: params.metadataUri,
      sellerFeeBasisPoints: STEM_ROYALTY_BPS, // 500 = 5%
      collection: none(),
      creators: [
        {
          address: artistPublicKey,
          verified: false, // artist must verify via their own wallet
          share: 100,
        },
      ],
      isMutable: false,
      primarySaleHappened: false,
      editionNonce: none(),
      tokenStandard: none(),
      uses: none(),
      tokenProgramVersion: { __kind: "Original" } as any,
    },
  }).sendAndConfirm(umi);

  const txSig = Buffer.from(signature).toString("base64");

  // Parse leaf index from transaction
  let leafIndex = 0;
  try {
    const leaf = await parseLeafFromMintV1Transaction(umi, signature);
    leafIndex = Number(leaf.nonce);
  } catch {
    // Leaf index not critical — mint still succeeded
  }

  const clusterParam = network !== "mainnet-beta" ? `?cluster=${network}` : "";
  const explorerUrl = `https://explorer.solana.com/tx/${txSig}${clusterParam}`;

  return {
    txSignature: txSig,
    leafIndex,
    merkleTree: params.merkleTreeAddress,
    explorerUrl,
    network,
  };
}

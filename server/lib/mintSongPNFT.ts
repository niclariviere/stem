/**
 * Song pNFT Minting via Metaplex Token Metadata
 *
 * Programmable NFTs (pNFTs) enforce royalties at the protocol level.
 * Unlike regular ERC-721 or basic Solana NFTs, pNFTs cannot be transferred
 * without paying the creator royalties — no marketplace can bypass them.
 *
 * Each song NFT represents a completed collaborative track.
 * Royalty splits are embedded in the creators array:
 * - Free tier: equal split (10000 bps ÷ number of contributors)
 * - Premium tier: custom split defined by collaborators
 *
 * Royalty rate: 500 bps = 5% on every secondary sale (enforced)
 */

import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  keypairIdentity,
  publicKey as umiPublicKey,
  generateSigner,
  percentAmount,
  none,
  some,
} from "@metaplex-foundation/umi";
import {
  createV1,
  mplTokenMetadata,
  TokenStandard,
} from "@metaplex-foundation/mpl-token-metadata";
import { fromWeb3JsKeypair } from "@metaplex-foundation/umi-web3js-adapters";
import { getRelayerKeypair, getSolanaNetwork } from "./solanaRelayer";
import type { SplitResult } from "./splitCalculator";
import { buildMetaplexCreators } from "./splitCalculator";

export const SONG_ROYALTY_BPS = 500; // 5% on secondary sales — enforced by pNFT standard

export interface SongMintParams {
  songTitle: string;
  metadataUri: string; // Pinata IPFS URL for the JSON metadata
  splits: SplitResult; // From splitCalculator
  stemCount: number;
  collaboratorNames: string[];
}

export interface SongMintResult {
  mintAddress: string;
  txSignature: string;
  explorerUrl: string;
  network: string;
  splits: SplitResult;
}

function getRpcUrl(network: string): string {
  if (network === "mainnet-beta") return "https://api.mainnet-beta.solana.com";
  if (network === "devnet") return "https://api.devnet.solana.com";
  return "https://api.testnet.solana.com";
}

/**
 * Mint a programmable NFT (pNFT) for a completed collaborative song.
 * The relayer pays gas. Royalties are enforced at the Metaplex protocol level.
 * Splits are embedded in the creators array — each collaborator receives
 * their share automatically on every secondary sale.
 */
export async function mintSongPNFT(params: SongMintParams): Promise<SongMintResult> {
  const network = getSolanaNetwork();
  const umi = createUmi(getRpcUrl(network)).use(mplTokenMetadata());
  const relayerKeypair = getRelayerKeypair();
  const umiKeypair = fromWeb3JsKeypair(relayerKeypair);
  umi.use(keypairIdentity(umiKeypair));

  // Generate a new mint address for this song NFT
  const mint = generateSigner(umi);

  // Build creators array from splits
  const relayerAddress = relayerKeypair.publicKey.toBase58();
  const rawCreators = buildMetaplexCreators(params.splits, relayerAddress);

  // Convert to Metaplex UMI creator format
  const creators = rawCreators.map(c => ({
    address: umiPublicKey(c.address),
    verified: c.address === relayerAddress, // Only relayer can be verified at mint time
    share: c.share,
  }));

  const { signature } = await createV1(umi, {
    mint,
    authority: umi.identity,
    name: params.songTitle,
    symbol: "STEM",
    uri: params.metadataUri,
    sellerFeeBasisPoints: percentAmount(SONG_ROYALTY_BPS / 100, 2), // 5%
    creators: some(creators),
    collection: none(),
    uses: none(),
    tokenStandard: TokenStandard.ProgrammableNonFungible, // pNFT — enforced royalties
    isMutable: false,
    primarySaleHappened: false,
    isCollection: false,
    collectionDetails: none(),
    ruleSet: none(), // Use default Metaplex auth rules (enforces royalties)
  }).sendAndConfirm(umi);

  const txSig = Buffer.from(signature).toString("base64");
  const mintAddress = mint.publicKey.toString();
  const clusterParam = network !== "mainnet-beta" ? `?cluster=${network}` : "";
  const explorerUrl = `https://explorer.solana.com/address/${mintAddress}${clusterParam}`;

  return {
    mintAddress,
    txSignature: txSig,
    explorerUrl,
    network,
    splits: params.splits,
  };
}

/**
 * Build the JSON metadata for a song pNFT.
 * Stored on IPFS via Pinata before minting.
 */
export function buildSongNFTMetadata(params: {
  songTitle: string;
  collaboratorNames: string[];
  stemCids: string[];
  stemCount: number;
  splits: SplitResult;
  coverImageUrl?: string;
  genres?: string[];
}) {
  return {
    name: params.songTitle,
    symbol: "STEM",
    description: `Collaborative track by ${params.collaboratorNames.join(", ")}. Built from ${params.stemCount} stems. Proof of co-authorship minted on Solana.`,
    image: params.coverImageUrl ?? `https://api.dicebear.com/7.x/shapes/svg?seed=${params.stemCids[0]}&backgroundColor=1a0a2e`,
    external_url: "https://stem.music",
    attributes: [
      { trait_type: "Type", value: "Collaborative Song" },
      { trait_type: "Stem Count", value: params.stemCount },
      { trait_type: "Collaborators", value: params.collaboratorNames.length },
      { trait_type: "Split Type", value: params.splits.isPremium ? "Custom" : "Equal" },
      { trait_type: "Chain", value: "Solana" },
      { trait_type: "Standard", value: "pNFT (Programmable)" },
      { trait_type: "Royalty", value: "5% enforced" },
      ...(params.genres ?? []).map(g => ({ trait_type: "Genre", value: g })),
    ],
    properties: {
      category: "audio",
      creators: params.splits.entries.map(e => ({
        address: e.walletAddress,
        share: e.splitPercent,
      })),
      stems: params.stemCids.map(cid => ({
        uri: `ipfs://${cid}`,
        type: "audio/wav",
      })),
    },
    stem_cids: params.stemCids,
    royalty_bps: SONG_ROYALTY_BPS,
    split_type: params.splits.isPremium ? "custom" : "equal",
  };
}

/**
 * Isolated smoke test of the real on-chain cNFT mint — bypasses UI + Pinata.
 * Mints one cNFT to the recipient against the devnet tree. Proves the relayer →
 * Bubblegum path works before wiring the live flow. Placeholder metadata URI is fine:
 * Solana stores the URI, it doesn't fetch/validate it at mint time.
 */
import "dotenv/config";
import { mintStemCNFT } from "../server/lib/mintStemCNFT";

const recipient = "C6vSaAXriS7AH7NcYy2or4B94gex9NW1UR3btauMyMBa";

const result = await mintStemCNFT({
  artistWalletAddress: recipient,
  stemName: "Smoke Test Stem",
  artistName: "Nic",
  ipfsCid: "bafybeigsmoketest",
  ipfsUrl: "https://example.com/stem.wav",
  metadataUri: "https://example.com/metadata.json",
  bpm: 120,
  musicalKey: "C major",
  instrumentType: "other",
  merkleTreeAddress: process.env.SOLANA_MERKLE_TREE!,
});

console.log(JSON.stringify(result, null, 2));
process.exit(0);

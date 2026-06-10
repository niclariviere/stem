/**
 * One-time: create the shared Merkle tree that holds all stem cNFTs on the current network.
 * Prints the tree address — add it to .env as SOLANA_MERKLE_TREE. Requires a funded relayer.
 */
import "dotenv/config";
import { createStemMerkleTree, verifyMerkleTree } from "../server/lib/mintStemCNFT";
import { getRelayerPublicKey, getSolanaNetwork } from "../server/lib/solanaRelayer";

console.log("network=" + getSolanaNetwork());
console.log("relayer=" + getRelayerPublicKey().toBase58());

const { treeAddress, txSignature } = await createStemMerkleTree();
console.log("SOLANA_MERKLE_TREE=" + treeAddress);
console.log("txSignature=" + txSignature);

const ok = await verifyMerkleTree(treeAddress);
console.log("verified=" + ok);

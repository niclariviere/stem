import "dotenv/config";
import { verifyMerkleTree } from "../server/lib/mintStemCNFT";

const addr = process.env.SOLANA_MERKLE_TREE!;
console.log("tree=" + addr + " verified=" + (await verifyMerkleTree(addr)));

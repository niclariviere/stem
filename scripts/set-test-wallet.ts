/**
 * Set a throwaway devnet recipient wallet on a user's profile so the mint UI's
 * "add your wallet first" gate passes. Pass EMAIL via env. Prints the keypair —
 * this is the placeholder the real T10 custodial wallet will replace.
 */
import "dotenv/config";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import * as db from "../server/db";

const email = process.env.EMAIL!;
const user = await db.getUserByEmail(email);
if (!user) throw new Error("No user for " + email);

const kp = Keypair.generate();
const pubkey = kp.publicKey.toBase58();
await db.setUserWalletAddress(user.id, pubkey);

console.log("user=" + email + " id=" + user.id);
console.log("RECIPIENT_PUBKEY=" + pubkey);
console.log("RECIPIENT_SECRET_B58=" + bs58.encode(kp.secretKey));
process.exit(0);

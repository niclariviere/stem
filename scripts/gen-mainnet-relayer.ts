import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { appendFileSync } from "node:fs";
const kp = Keypair.generate();
appendFileSync(".env", `\n# Mainnet relayer (PARKED — unused until SOLANA_NETWORK=mainnet-beta). Fund the pubkey below.\nSOLANA_RELAYER_PRIVATE_KEY_MAINNET=${bs58.encode(kp.secretKey)}\n`);
console.log("MAINNET_RELAYER_PUBKEY=" + kp.publicKey.toBase58());

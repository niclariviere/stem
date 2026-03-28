# STEM Platform — Mac Mini Relayer Setup Guide

This guide walks you through setting up your Mac Mini M4 as the Solana mint relayer
for the STEM platform. The relayer pays all gas fees so artists mint for free.

---

## What the relayer does

1. Reads pending mint requests from the STEM database
2. Signs and submits Solana transactions using your relayer wallet
3. Updates the database with transaction signatures
4. Notifies artists when their NFT is live

Artists **never pay gas**. The relayer wallet holds a small SOL balance to cover fees.
At Base Solana rates, **$10 of SOL covers approximately 10,000–100,000 mints**.

---

## Prerequisites

- Mac Mini M4 with macOS 13+ (Ventura or later)
- Node.js 20+ installed (`brew install node` if not already)
- Access to your STEM platform database (the `DATABASE_URL` from your Manus project)
- Your relayer private key (already generated and stored in your Manus project secrets)

---

## Step 1 — Create the relayer directory

```bash
mkdir -p ~/stem-relayer
cd ~/stem-relayer
npm init -y
npm install @solana/web3.js \
  @metaplex-foundation/umi \
  @metaplex-foundation/umi-bundle-defaults \
  @metaplex-foundation/mpl-bubblegum \
  @metaplex-foundation/mpl-token-metadata \
  @metaplex-foundation/umi-web3js-adapters \
  mysql2 \
  dotenv
```

---

## Step 2 — Copy the relayer script

Copy `mintRelayer.mjs` and `setupMerkleTree.mjs` from your STEM project's
`server/relayer/` directory into `~/stem-relayer/`.

```bash
cp /path/to/stem-platform/server/relayer/mintRelayer.mjs ~/stem-relayer/
cp /path/to/stem-platform/server/relayer/setupMerkleTree.mjs ~/stem-relayer/
```

---

## Step 3 — Create the environment file

Create `~/stem-relayer/.env.relayer`:

```env
# Database — copy from your Manus project secrets
DATABASE_URL=mysql://user:password@host:3306/dbname

# Solana relayer private key — copy from your Manus project secrets
# Format: JSON array of numbers, e.g. [12,34,56,...]
SOLANA_RELAYER_PRIVATE_KEY=[12,34,56,...]

# Network: "devnet" for testing, "mainnet-beta" for production
SOLANA_NETWORK=devnet

# These are set after running setupMerkleTree.mjs (Step 5)
SOLANA_MERKLE_TREE_ADDRESS=
SOLANA_COLLECTION_MINT_ADDRESS=
```

> **Security:** Never commit `.env.relayer` to git. Add it to `.gitignore`.

---

## Step 4 — Fund the relayer wallet

Your relayer wallet address can be found by running:

```bash
node -e "
const { Keypair } = require('@solana/web3.js');
const key = JSON.parse(process.env.SOLANA_RELAYER_PRIVATE_KEY);
const kp = Keypair.fromSecretKey(Uint8Array.from(key));
console.log('Relayer wallet:', kp.publicKey.toBase58());
"
```

**For devnet (testing):** Get free SOL from the faucet:
```bash
solana airdrop 2 <YOUR_RELAYER_ADDRESS> --url devnet
```
Or visit: https://faucet.solana.com

**For mainnet:** Send 0.05–0.1 SOL to the relayer address from any exchange
(Coinbase, Kraken, etc.). This covers thousands of mints.

---

## Step 5 — Create the Merkle tree (one-time setup)

Compressed NFTs (cNFTs) require a Merkle tree on-chain. Create one:

```bash
node setupMerkleTree.mjs
```

This outputs:
```
Merkle tree created: <TREE_ADDRESS>
Collection mint: <COLLECTION_ADDRESS>
```

Copy these addresses into your `.env.relayer` file.

**Cost:** ~0.01–0.05 SOL (one-time). The tree supports up to 1,000,000 mints.

---

## Step 6 — Test with a dry run

```bash
node mintRelayer.mjs --dry-run
```

This shows what would be minted without actually submitting any transactions.

---

## Step 7 — Process mints manually

```bash
node mintRelayer.mjs
```

This processes all pending mints once and exits.

---

## Step 8 — Set up automatic processing (recommended)

Use macOS `launchd` to run the relayer automatically. Create
`~/Library/LaunchAgents/com.stem.relayer.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.stem.relayer</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/Users/YOUR_USERNAME/stem-relayer/mintRelayer.mjs</string>
  </array>
  <key>WorkingDirectory</key>
  <string>/Users/YOUR_USERNAME/stem-relayer</string>
  <key>StartInterval</key>
  <integer>3600</integer>
  <key>RunAtLoad</key>
  <false/>
  <key>StandardOutPath</key>
  <string>/Users/YOUR_USERNAME/stem-relayer/relayer.log</string>
  <key>StandardErrorPath</key>
  <string>/Users/YOUR_USERNAME/stem-relayer/relayer-error.log</string>
</dict>
</plist>
```

Replace `YOUR_USERNAME` with your macOS username. Then load it:

```bash
launchctl load ~/Library/LaunchAgents/com.stem.relayer.plist
```

This runs the relayer **every hour**. Change `StartInterval` to `86400` for once per day.

---

## Step 9 — Switch to mainnet

When you're ready to go live:

1. Change `SOLANA_NETWORK=mainnet-beta` in `.env.relayer`
2. Fund the relayer wallet with real SOL on mainnet
3. Re-run `node setupMerkleTree.mjs` to create a mainnet Merkle tree
4. Update `SOLANA_MERKLE_TREE_ADDRESS` and `SOLANA_COLLECTION_MINT_ADDRESS`
5. In your Manus project secrets, change `SOLANA_NETWORK` to `mainnet-beta`

That's the only change needed. The platform automatically uses the correct network.

---

## Monitoring

Check the relayer log:
```bash
tail -f ~/stem-relayer/relayer.log
```

Check pending mints in the database:
```sql
SELECT * FROM mintQueue WHERE status = 'pending' ORDER BY createdAt;
```

Check failed mints:
```sql
SELECT * FROM mintQueue WHERE status = 'failed' ORDER BY createdAt DESC;
```

---

## Cost reference

| Action | SOL cost | USD (at $150/SOL) |
|---|---|---|
| Create Merkle tree (1M capacity) | ~0.04 SOL | ~$6 |
| Mint 1 stem cNFT | ~0.000005 SOL | ~$0.00075 |
| Mint 1 song pNFT | ~0.01 SOL | ~$1.50 |
| 1,000 stem mints | ~0.005 SOL | ~$0.75 |
| 10,000 stem mints | ~0.05 SOL | ~$7.50 |

Song pNFTs cost more because they are full Metaplex NFTs with on-chain royalty splits.
Stem cNFTs are compressed and extremely cheap.

---

## Troubleshooting

**"SOLANA_MERKLE_TREE_ADDRESS not set"**
Run `node setupMerkleTree.mjs` and copy the output addresses into `.env.relayer`.

**"Insufficient funds"**
The relayer wallet needs more SOL. Check balance:
```bash
solana balance <RELAYER_ADDRESS> --url devnet
```

**"Transaction simulation failed"**
Usually a network issue. The relayer will retry automatically on the next run.

**Database connection errors**
Verify `DATABASE_URL` is correct and your Mac Mini can reach the database host.

# STEM Platform TODO

## Phase 3 — Design System & Schema
- [x] Port stem2 design system (dark purple/cyan, Space Grotesk) to index.css
- [x] Update index.html with Google Fonts
- [x] Build full database schema (stems, metadata, invitations, ownership, matching, flags)
- [x] Apply schema migrations
- [x] Add all db query helpers

## Phase 4 — Auth & Invitations
- [x] Invitation-only gate: new users need valid invite token
- [x] Invite token generation widget for verified users
- [x] Splash/landing page (Index)
- [x] Login page with invite token input
- [x] Profile page with stats (stems, minted, matches, visits)
- [x] Edit profile page

## Phase 5 — Stem Upload & IPFS
- [x] Client-side audio analysis (BPM, key, MFCC, waveform)
- [x] IPFS upload via web3.storage (free, no cost per upload)
- [x] Stem upload flow with drag-drop UI
- [x] CID generation and stem://CID link display
- [x] Save stem metadata to DB after upload

## Phase 6 — NFT Minting
- [x] MetaMask/WalletConnect wallet connection
- [x] Base Sepolia testnet NFT contract (ERC-721)
- [x] Mint proof-of-ownership NFT with stem CID in metadata
- [x] Minted NFT counter on profile
- [x] Mainnet switch instructions

## Phase 7 — Match Engine
- [x] Port matchingEngine.ts from project context
- [x] Port audioAnalysis.ts (client-side)
- [x] MatchEngine page with stem selector
- [x] Real-time compatibility scoring display (0-1 scale)
- [x] Audio preview player for matched stems
- [x] Artist notification system

## Phase 8 — Library, BandLab, Flagging
- [x] Stem library dashboard with grid/list view
- [x] Waveform visualization component
- [x] Metadata editing UI
- [x] BandLab project URL parser (no API key)
- [x] Stem flagging / copyright report system
- [x] Collections / playlists

## Phase 9 — Tests & Delivery
- [x] Vitest tests for matching engine (29 tests)
- [x] Vitest tests for auth/invitations
- [x] Fix routers.ts require() → ES imports
- [x] Final checkpoint and delivery

## Future / Post-MVP
- [x] Pinata IPFS integration (stemstorage JWT — live, 32 tests passing)
- [x] Solana replaces Base mainnet (cNFT stem + pNFT song with enforced royalties)
- [ ] BandLab URL scraper server-side enhancement (client-side metadata parsing implemented)
- [ ] Admin panel for flag review
- [ ] Stem flagging auto-hide after 3+ reports
- [ ] Email/push notifications for match alerts
- [ ] Mobile-responsive polish pass

## Phase 9 — NFT.Storage Integration
- [x] Update StemUpload.tsx to use Pinata IPFS API endpoint
- [x] Update nftMinting.ts to use Pinata for metadata upload
- [x] Write vitest to validate Pinata API key (32/32 tests passing)
- [x] Final checkpoint and delivery

## Phase 10 — Base Mainnet NFT Deployment
- [ ] Read current nftMinting.ts to extract contract ABI and bytecode
- [ ] Set up Hardhat deployment environment
- [ ] Compile and deploy StemNFT ERC-721 contract to Base mainnet
- [ ] Verify contract on Basescan
- [ ] Update nftMinting.ts with mainnet contract address and chain ID
- [ ] Update platform UI to reflect mainnet (remove "testnet" labels)
- [ ] Final checkpoint and delivery

## Phase 10-15 — Solana Migration & Full Minting Architecture

### Phase 10 — Dependencies & Assessment
- [x] Install @solana/web3.js, @metaplex-foundation/mpl-bubblegum (cNFT), @metaplex-foundation/mpl-token-metadata (pNFT)
- [x] Install @solana/wallet-adapter-react, @solana/wallet-adapter-phantom for frontend
- [x] Generate server-side relayer keypair (stored as secret SOLANA_RELAYER_PRIVATE_KEY)
- [ ] Fund relayer wallet on Solana devnet for testing (requires manual SOL airdrop)

### Phase 11 — Server-Side Solana Relayer
- [x] server/lib/solanaRelayer.ts — keypair loading, connection, devnet/mainnet config
- [x] server/lib/mintStemCNFT.ts — Metaplex Bubblegum cNFT minting with royalties
- [x] server/lib/mintSongPNFT.ts — Metaplex pNFT minting with enforced royalties + equal splits
- [x] server/lib/splitCalculator.ts — equal split by stem count (free) / custom split (premium)
- [x] server/relayer/mintRelayer.mjs — Mac Mini batch relayer script
- [x] server/relayer/setupMerkleTree.mjs — one-time Merkle tree creation
- [x] server/relayer/RELAYER_SETUP.md — comprehensive Mac Mini setup guide

### Phase 12 — Schema & Routers
- [x] Add mintQueue table (pending/processing/complete/failed, solana_tx_sig)
- [x] Add songs table (title, collaborators, stem_ids, mint_status, pnft_address)
- [x] Add collaborationSplits table (song_id, user_id, stem_count, split_bps, is_custom)
- [x] DB migration applied (ALTER stems, CREATE mintQueue, songs, collaborationSplits)
- [x] tRPC: stems.queueMint, songs.create/list/getById/queueMint procedures
- [x] server/db.ts — all mintQueue, songs, collaborationSplits helpers

### Phase 13 — Frontend Minting UI
- [x] client/src/lib/phantomWallet.ts — Phantom detection, connect, address validation, explorer URLs
- [x] StemLibrary.tsx — updated to use queueMint (Solana) instead of EVM updateNft
- [x] client/src/pages/Songs.tsx — collaborative track creation with royalty split display
- [x] client/src/App.tsx — /wallet-setup and /songs routes registered
- [x] EVM/Base Sepolia references replaced with Solana throughout

### Phase 14 — Phantom Onboarding Guide
- [x] client/src/pages/WalletSetup.tsx — 3-step in-app Phantom onboarding guide
- [x] Step 1: Install Phantom browser extension (with direct link)
- [x] Step 2: Create wallet — seed phrase safety instructions
- [x] Step 3: Connect to STEM platform
- [x] Step 4: What happens when your stem is minted (relayer handles it — free)

### Phase 15 — Tests & Delivery
- [x] server/solana-minting.test.ts — 23 tests: splits, wallet validation, mint queue, royalty bps
- [x] All 55 tests passing (4 test files: auth, stem-matcher, nftstorage, solana-minting)
- [x] TypeScript: 0 errors
- [x] Final checkpoint and delivery

## Future — Client Builder Mode (Post-MVP)
- [ ] Match Engine as client-facing tool: clients assemble tracks from artist stem catalogue
- [ ] Licensing model: per-use revenue for artists whose stems are selected
- [ ] Public access tier (no invitation required) for client builders
- [ ] Track assembly export / streaming within platform
- [ ] Revenue distribution to artists on each licensed use

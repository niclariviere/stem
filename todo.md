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
- [ ] web3.storage API key integration (VITE_WEB3_STORAGE_TOKEN)
- [ ] Base mainnet NFT contract deployment
- [ ] BandLab URL scraper (server-side, parse public share page)
- [ ] Admin panel for flag review
- [ ] Stem flagging auto-hide after 3+ reports
- [ ] Email/push notifications for match alerts
- [ ] Mobile-responsive polish pass

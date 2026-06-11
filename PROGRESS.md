# STEM — Mint Module Progress Log

> Append-only. One 3-line entry per finished task, newest at the bottom.
> Format:
> ```
> ## T# — <task title> — <date>
> Shipped: <what landed>
> Commit: <hash>
> Next: <next unblocked task>
> ```

---

## T1 — Strip dead EVM/Base minting code — 2026-06-08
Shipped: Removed all EVM/MetaMask/Base-Sepolia code from the client mint path; the rendered MintModal now does the honest Solana flow (build metadata → pin IPFS → `queueMint`), fixed the broken `onMinted` signature mismatch, and rewired EditProfile's wallet connect from MetaMask to Phantom. No EVM refs remain; tsc clean; 55/55 tests pass. (Logged-in browser click-test not run — no headless browser this session.)
Commit: 34fb4ff
Next: T2 — add `mintDeadline` (stems) + `mintOnExpiry` (users) schema fields (add only, no behavior).

## T2 — Schema: mintDeadline + mintOnExpiry — 2026-06-08
Shipped: Added `stems.mintDeadline` (nullable timestamp) + `users.mintOnExpiry` (boolean default false); pushed to local DB via drizzle-kit. Add-only — no behavior, no backfill. Verified columns present + all 11 existing stems grandfathered (null deadline); tsc clean. Activation against existing trio data parked (DECISIONS D3).
Commit: 0e0c9bd
Next: T3 — set `mintDeadline = now + 7d` on stem creation (server source of truth) + expose on read path.

## T3 — Set mintDeadline on stem creation — 2026-06-08
Shipped: `createStem` now stamps `mintDeadline = now + 7d` (exported `MINT_WINDOW_DAYS`); read paths already `select()` all columns so it reaches the client. New uploads only; existing rows stay grandfathered. Added self-cleaning `scripts/smoke-mint-window.ts` (deadline ≈ createdAt+7d, 0.01min drift). tsc clean, 55/55 tests pass.
Commit: b943527
Next: T4 — read-time filter hiding expired-unminted stems from public/match surfaces (owner still sees own).

## T4 — Hide expired-unminted from public/match — 2026-06-08
Shipped: Read-time filter (`notExpiredUnminted()`) on `getAllPublicStems` + new `getMatchableStemMetadata` (matching now uses it). Expired-unminted gone from public/match, owner keeps theirs; grandfathered + minted/pending/failed unaffected. Smoke extended to 7 checks. Zero blast radius (public read unused, match hidden). Stronger "minted-only workshop privacy" call parked (DECISIONS D13). tsc clean, 55/55 tests.
Commit: 95898f2
Next: T5 — mint status UX (server mintDeadline → countdown + status badges + poll getMintStatus while pending).

## T5 — Mint status UX (countdown + badges + polling) — 2026-06-08
Shipped: StemCard reads countdown from server `mintDeadline` (null = no badge); status-driven badge (Minted / Minting… / Mint failed / Nd-left); polls `getMintStatus` every 5s while pending and refetches list on resolution; Mint button + note gated on status='none'. tsc clean, 55/55 tests. (Interactive poll/badge not browser-verified — no headless browser.)
Commit: 0d9441c
Next: T6 — Lexicon work-unit `type` attribute (stem/track/song; beat TBD) at upload + display. Couples to DECISIONS D12 (proceeding on lexicon-notes defaults).

## Beta — 150MB cap + editable BPM/key — 2026-06-10
Shipped: Raised stem upload cap 50MB→150MB (full lossless songs need it) with a clearer message. BPM/key now artist-correctable on upload + library (seeded by detection; ½×/2× octave buttons for half/double-time + 24-key dropdown), reusing the owner-guarded `metadata.save` upsert. Shared `client/src/lib/musicMeta.ts` carries a match-engine contract note (compare BPM mod-octave + key by Camelot adjacency so corrections never create false mismatches). tsc clean, 55/55 tests.
Commit: 52f8aa5
Next: wire the mint pipeline to actually mint (see below).

## Mint pipeline — devnet end-to-end working — 2026-06-10
Shipped: First real cNFT mint of an actual stem through the actual UI, on devnet. Built the missing queue processor (`server/lib/processMintQueue.ts`: pending → `mintStemCNFT` → minted/failed, 3 retries) + devnet ops scripts. Fixed 4 bugs in never-run code, found by smoke-testing the on-chain mint in isolation: (1) `tokenProgramVersion` object → serializer crash; (2) base64 tx sigs → dead explorer links; (3) metadata read wrong env vars → oversized inline data-URI → tx-too-large; (4) JWT scoped to file-pinning → `pinJSONToIPFS` 403, switched to `pinFileToIPFS`. Relayer funded on devnet, Merkle tree `5N77kenD…` created. tsc clean, 55/55 tests.
Commit: 47e38eb
Next: (a) run the queue processor as a background worker (currently manual `scripts/process-mints.ts`); (b) T10 custodial wallet to replace the throwaway recipient — random BIP39 key on Phantom path, encrypted-at-rest, tiered `custodyTier` default `self_custody_backup`; (c) fix the `verifyMerkleTree` false-negative; (d) original T6 lexicon `type` still pending.

## Session close — stance + resume point — 2026-06-10
State: mint pipeline works end-to-end on **devnet** = the resting state (site runs devnet; no auto-start, so a reboot needs a manual `pnpm dev`). Mainnet relayer keypair generated + PARKED in `.env` (`SOLANA_RELAYER_PRIVATE_KEY_MAINNET`, pubkey `6Zfaoy6ZNhZTszFeNUHS9ETbtxscc5oJWt1waa7WEkb3`) — UNFUNDED/inert until `SOLANA_NETWORK=mainnet-beta`.
Stance on minting: a real, working, **powerful feature — keep it.** Honest value = the *sovereignty/ownership floor* (work made permanently, provably yours, platform-independent) — NOT resale/market value, NOT legal protection (creators already hold copyright). Do **not** anchor branding on *stem-level* minting as the main selling point; value-locus unproven — let founding-member usage decide. Open question to carry: "what's STEM's chordify?" (the utility that earns the daily open). Money lives in the *relationship* built on the floor, not the artifact.
Resume: fund the parked mainnet relayer (~0.3 SOL) before any mainnet mint. Validate minting's worth via Ulli + founding members, not theory.

## Decisions — 2026-06-10b (dogfooding + per-mint network)
- **Nic mints via the SAME custodial route as users, NOT a personal Phantom** ("best we see exactly how it turns out"). Consequence: **T10 (proper custodial key storage + export) now gates Nic's OWN real mainnet released-song mints too** — a permanent record must land in a properly-custodied, exportable wallet (the current throwaway recipient key was only printed, never persisted — fine for disposable devnet, NOT for permanent mainnet).
- **Per-mint devnet/mainnet TOGGLE** (NEW task): each user (incl. Nic) chooses per mint — **devnet = disposable test** (unreleased/experiments, no permanent record), **mainnet = permanent record** (released songs). Requires DUAL-NETWORK support: both relayer+tree configured at once, a network param per mint/queue entry, a UI toggle. (`SOLANA_NETWORK` is currently a single global env var — moderate architecture change.)
- **What a devnet mint returns** (clarified): a REAL, structurally-identical cNFT — real base58 tx signature + leafIndex on the tree, metadata pinned to IPFS, inspectable on explorer (devnet cluster). NOT merely a connection check. The ONLY difference vs mainnet: devnet is a wipeable test network → no permanence, no value (free SOL), can vanish on reset. So devnet = a full dress rehearsal that produces a disposable certificate — exactly the right "not-permanent" option for the toggle above.
- Member-facing mainnet now gated on: T10 custodial wallet + automatic queue worker + per-mint network toggle.

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

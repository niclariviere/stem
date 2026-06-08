# STEM — Mint Module Backlog

> Autonomous build queue for the mint module. Nic reviews; Claude drives.
> Ordered so each task builds on the last. Nothing depends on a future task. Dependencies flagged inline.
> Revised 2026-06-08 for the **single-rights-holder-first** rollout + custodial wallets + mandatory lexicon.

---

## Working rules (autonomy boundary)

**Just do it — no asking (local + reversible):**
- Write code, refactor, add/run tests, run the build, push schema to the *local* dev DB.
- Commit each finished task on this branch (`beta/stabilization-2026-06-01`).
- Adding nullable columns / new tables locally counts as reversible.

**Park in `DECISIONS.md` and move on (don't stall):**
- Deploying, spending money (incl. funding a relayer wallet), minting / touching **anything on-chain** — devnet or mainnet, publishing externally, deleting data.
- Activating any job that mutates real trio data (e.g. soft-archiving members' already-uploaded stems).
- Any plan ambiguity where guessing wrong is expensive to undo.
- → Park it, keep moving on the next unblocked task.

**Process:**
- One commit per finished task, clear message. Never leave the tree half-done at a stopping point.
- After each task: append a 3-line entry to `PROGRESS.md` (what shipped / commit hash / what's next).
- All on-chain work is built **dormant / dry-run by default**; flipping it live is always a parked decision.

---

## Framing (read before sanity-checking the decomposition)

`todo.md` marks minting **done** through Phase 15 and the plumbing is real (mint functions, relayer, `mintQueue`/`songs`/`collaborationSplits` schema, Phantom wallet, 55 passing tests) — **but it has never run live, it's devnet-config only, the 7-day window was never built into the schema, and dead EVM/Base code lingers in the client.** This backlog is the gap between *plumbing exists* and *a shippable mint experience*.

**Two rollout constraints set the scope (Nic, 2026-06-08):**
1. **Single rights-holder only.** First rollout lets a user mint *their own* work — a stem, track, or complete song — where they are the sole rights holder. The collaborative **multi-rights-holder split engine** (`collaborationSplits`, match-engine song assembly, custom splits) **stays dormant** (like the already-hidden match engine) — not removed, just not exposed. The mint flow must clearly communicate **"only mint material you solely own."**
2. **Wallet complexity is hidden.** The system holds a **custodial wallet** per user (mnemonic-derived, encrypted) and mints to it until the user opts into self-custody. No Phantom/seed/connect step in the user path. Provenance metadata **always names the creator as artist**, never the platform.

The **lexicon is mandatory** and informs the mint process — work-unit `type` + the rights/eligibility/license layer *is* the single-rights-holder guardrail.

Every "done-criteria" assumes `pnpm check` (tsc, 0 errors) + `pnpm test` (vitest, all green) as a baseline gate on top of the task-specific check.

---

## Tasks

### T1 — Strip dead EVM/Base minting code from the client
The client still carries obsolete Base-Sepolia / MetaMask / ERC-721 paths (`client/src/lib/nftMinting.ts`, the `MintModal` in `StemLibrary.tsx`) alongside the live Solana relayer path. Remove the dead code so the mint path is honest for every later task.
- **Done:** No `Sepolia` / `MetaMask` / `ERC-721` / `switchToBaseSepolia` / `CHAIN_CONFIG` references remain in the client mint path; only the Solana relayer flow remains; nothing actually rendered is removed without replacement.
- **Verify:** `grep -ri "sepolia\|metamask\|erc-721\|base mainnet" client/src` is empty in the mint path; `pnpm check`; `pnpm test`; `pnpm dev` confirms StemLibrary renders + Mint still queues.
- **Deps:** none. *(Do first — de-risks every later UX task.)*

### T2 — Schema: add `mintDeadline` (stems) + `mintOnExpiry` (users)
Add the two fields the 7-day-window design settled on but never built. `mintDeadline TIMESTAMP NULL` on `stems` (null = grandfathered / no countdown), `mintOnExpiry BOOLEAN DEFAULT FALSE` on `users`. **Schema add only — no behavior change, no backfill, no job.**
- **Done:** Both columns exist via `pnpm db:push`; existing rows have `mintDeadline = NULL`; tsc clean.
- **Verify:** `pnpm db:push` succeeds; query a stem row, column present + null for existing rows; `pnpm check`.
- **Deps:** none. **Couples to DECISION D3** (activating behavior on existing trio data — not part of this task).

### T3 — Set `mintDeadline` on stem creation (server source of truth)
On `createStem`, set `mintDeadline = now + 7 days` and expose it on the read path, so the deadline is a server fact instead of a client-side `Date.now()` computation. New uploads only; existing rows stay null.
- **Done:** New stems get a populated `mintDeadline`, surfaced on the stem read path.
- **Verify:** Smoke script (per `scripts/smoke-collab.ts` pattern) creates a stem, asserts `mintDeadline ≈ createdAt + 7d`; `pnpm check`.
- **Deps:** T2.

### T4 — Read-time filter: hide expired-unminted stems from public/match surfaces
Public catalog + match input exclude stems where `mintStatus = 'none' AND mintDeadline < now()`. **Read-time filter only — no soft-archive write, no delete, no job.** Owner still sees their own expired stems in their workshop.
- **Done:** Public/match queries exclude expired-unminted; owner query still returns them (flagged "expired — re-list by minting").
- **Verify:** Smoke script back-dates a stem's `mintDeadline`, asserts absent from public/match but present in owner query; `pnpm check`; `pnpm test`.
- **Deps:** T2, T3.

### T5 — Mint status UX: real countdown + live status on the stem card
Replace the client-side day-count with the server `mintDeadline`; render a real countdown badge + a `mintStatus` badge (none / pending / minted / failed). While `pending`, poll `stems.getMintStatus` so the card updates without reload. *(Display only — does not change how a mint is triggered yet.)*
- **Done:** Card reads `mintDeadline` from the server; countdown + status badge reflect real state; pending stems poll to minted/failed in-UI.
- **Verify:** `pnpm dev` — queue a mint, watch the badge go pending → minted (via relayer dry-run / manual `confirmMint`); `pnpm check`; `pnpm test`.
- **Deps:** T1, T3.

### T6 — Lexicon: work-unit `type` attribute (first-pass taxonomy)
Implement the mandatory lexicon's atom layer: a `type` on each work-unit (Mandatory set: **stem / track / song**; promote **beat** if confirmed), assigned at upload and displayed. Mirrors how stems were typed. Use the first-pass taxonomy from the lexicon notes; the architectural through-line is *type-on-unit + release-type-on-group*.
- **Done:** `type` column on the work-unit table via `db:push`; upload UI lets the creator pick a type; type renders on the card/profile; defaults sensible for existing rows.
- **Verify:** `pnpm db:push`; `pnpm dev` upload with a type, see it persist + render; `pnpm check`; `pnpm test`.
- **Deps:** none (independent of the mint chain, but informs T7/T8). **Couples to DECISION D12** (which terms ship + collective noun + beat weight — proceeding on defaults unless steered).

### T7 — Lexicon: mint-eligibility + license layer
The rights layer that makes the lexicon a guardrail. Mark mint-eligibility by type/intent: **Cover = non-mintable**; **Sample / Remix = caution + flag** (allow only original/permissioned); surface a **license selector** at mint (CC0 / CC-BY / CC-BY-NC / proprietary — the existing `ownershipLicensing` field). Block/redirect ineligible mints with a clear explanation.
- **Done:** Ineligible types can't reach the mint queue; license is captured at mint and stored; copy explains *why* (minting = provenance receipt, not copyright).
- **Verify:** Smoke/`pnpm dev` — attempt to mint a Cover → blocked with explanation; mint a stem with a chosen license → license persisted on the queue/metadata; `pnpm check`; `pnpm test`.
- **Deps:** T6.

### T8 — Single rights-holder attestation + clear communication
The explicit "only mint material you solely own" gate. Before a mint queues, the flow states the rule plainly and requires an attestation (the user confirms sole rights-holder). Pairs with the rights layer; this is the *human* half of the single-rights-holder constraint.
- **Done:** Mint cannot be queued without an explicit single-rights-holder attestation; the copy is unambiguous about what minting does/doesn't claim; attestation is recorded.
- **Verify:** `pnpm dev` — mint is blocked until the attestation is given; the recorded attestation is queryable; `pnpm check`; `pnpm test`.
- **Deps:** T7.

### T9 — Custodial wallet: provision + store a wallet per user
The system holds a Solana wallet per user. On user creation (+ one-off backfill for existing trio users), generate a **mnemonic-derived (HD) keypair** (keeps both export + transfer handoff open — see D9), store the public key in clear + the secret **encrypted at rest**, and expose `getCustodialAddress(userId)`. No user-facing UI.
- **Done:** Every user (incl. existing members) has a stored custodial keypair; secrets encrypted, never logged, never sent to client; helper returns the public key.
- **Verify:** Backfill provisions all users; smoke script asserts a new user gets a keypair + the secret is unreadable without the decrypt key; `pnpm check`; `pnpm test`.
- **Deps:** none. **Couples to DECISIONS D8** (key-storage security bar) + **D9** (handoff mechanism — keygen defaulted to HD to keep options open).

### T10 — Route minting to the custodial wallet + hide all user-facing wallet UI
Make minting wallet-less. `queueMint` (stem + song) pulls the custodial address server-side via T9 instead of client input. **Mint metadata names the creator as artist** (creator/royalty field = the user). Remove the wallet field from `EditProfile`; hide `WalletSetup`/Phantom-connect from nav (keep route + code for the future self-custody handoff).
- **Done:** A user mints with zero wallet steps, queued to their custodial address; on-chain creator metadata = the user; no wallet field in EditProfile; WalletSetup unreachable from nav but route preserved.
- **Verify:** `pnpm dev` — a brand-new user with no Phantom queues a mint end-to-end (relayer dry-run / `confirmMint`); queued metadata's creator field = the user; `grep` shows no user-facing wallet entry; `pnpm check`; `pnpm test`.
- **Deps:** T5, T8, T9. **Couples to DECISION D9** (handoff — route kept for it).

### T11 — Mint error + retry UX
Surface `mintQueue.errorMessage` + `attempts` on failed mints and allow re-queueing. Today a failed mint is a UI dead end.
- **Done:** Failed items show error + attempt count; a "retry mint" action re-queues (resets to pending) with a double-submit guard.
- **Verify:** Smoke script inserts a `failed` queue entry; UI shows the error + retry re-queues to pending; `pnpm check`; `pnpm test`.
- **Deps:** T5.

### T12 — Single rights-holder song minting (100% creator)
A user mints their *own* complete song — sole rights holder, **100% creator, no split UI**. Reuses the stem mint flow with `type = song`. The multi-artist split/collaboration path (`songs.create` from matched stems, `collaborationSplits`, custom splits) **stays dormant** — not wired into this UI.
- **Done:** A solo creator can mint a song they uploaded, attributed 100% to themselves; no collaborator/split UI surfaces in the rollout path; the dormant split engine is untouched (still tests-green).
- **Verify:** `pnpm dev` — upload + mint a solo song end-to-end (dry-run); confirm no split UI and 100% creator attribution; existing split tests still pass; `pnpm check`; `pnpm test`.
- **Deps:** T10. **Couples to DECISION D5** (when the multi-holder split engine gets exposed — deferred).

### T13 — Window automation job (built dormant)
The periodic job the design calls for: soft-archive expired-unminted stems (row + audio + metadata preserved, recoverable by re-minting) and auto-mint for users with `mintOnExpiry = true` (the old "linked wallet" gate is moot — every user has a custodial wallet). **Ship `--dry-run` by default; no live writes/mints without an explicit flag.** Mirror `mintRelayer.mjs` watch mode.
- **Done:** Job exists; `--dry-run` logs exactly what it *would* soft-archive / auto-mint and writes nothing; the live path is flag-gated, never auto-invoked.
- **Verify:** Run `--dry-run` against local DB with a back-dated stem; correct actions reported, DB unchanged; `pnpm check`; `pnpm test`.
- **Deps:** T2, T3, T4, T9. **Couples to DECISIONS D3 + D4** (activation + auto-mint default — parked; this builds only the dormant machinery).

### T14 — (Optional) Stem `description` field
Confirmed optional/low-priority. Add nullable `description TEXT` to the work-unit table + a workshop-only edit affordance (private until mint). Independent of the mint chain; sequence last or drop.
- **Done:** `description` column via `db:push`; editable in the workshop; never on public surfaces pre-mint.
- **Verify:** `pnpm db:push`; `pnpm dev` edit + persist; `pnpm check`.
- **Deps:** none (independent).

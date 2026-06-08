# STEM — Decisions Queue (needs Nic's call)

> Things Claude parked instead of guessing. Each is non-blocking — work continues on the next
> unblocked backlog task. Resolve by editing the **Decision:** line; Claude picks it up next session.
> Categories: irreversible / external spend / on-chain / schema-or-API shape / plan ambiguity.

---

## Open

### D1 — Fund the devnet relayer wallet & run a live end-to-end mint test
The relayer wallet was generated but never funded; no mint has ever actually run (Phase 10 in `todo.md` is unchecked). A live test — even on devnet — is on-chain activity, so it's parked. Devnet SOL is free via airdrop, so the cost is ~zero; the gate is that it's a real on-chain action.
- **Why parked:** on-chain action.
- **Needs:** your go-ahead to airdrop devnet SOL to the relayer and run one real stem mint end-to-end.
- **Decision:** _pending_

### D2 — Devnet → mainnet-beta switch
All Solana config defaults to `devnet`. Going to `mainnet-beta` is real spend + irreversible on-chain provenance. This is a launch-gate decision, well after the UX work below.
- **Why parked:** spend + on-chain + irreversible.
- **Needs:** when (if) to flip `SOLANA_NETWORK`, and confirmation the merkle tree / collection are set up on mainnet.
- **Decision:** _pending_

### D3 — Activate the 7-day window against existing trio stems
T2–T4 build the window logic but touch no existing data (existing rows stay `mintDeadline = NULL` = grandfathered). Turning on real expiry/soft-archive could hide or archive stems the founding members (incl. arien, akif) have already uploaded.
- **Why parked:** mutating real member data is expensive to undo.
- **Needs:** Do existing trio stems stay grandfathered (null deadline) forever, or get a one-time deadline set? If set — count from now, or from their original upload?
- **Decision:** _pending_

### D4 — Auto-mint-on-expiry: default & behavior
Design settled "default off, opt-in." The "gated on a linked wallet" condition is **moot under the custodial model** (every user has a wallet). The June-1 list said ship *only the note text* for now, not the behavior. T10 builds the machinery dormant. Flipping it live means the platform mints on a user's behalf automatically — and with custodial wallets it can do so with zero user wallet setup, which makes the default choice *more* consequential, not less.
- **Why parked:** automated on-chain action on a user's behalf.
- **Needs:** confirm default stays OFF, and whether auto-mint ships at all this cycle or stays dry-run.
- **Decision:** _pending_

### D5 — Multi-rights-holder split engine: when to expose
**RESOLVED (deferred) 2026-06-08.** First rollout is **single rights-holder only**. The collaborative multi-artist path (`collaborationSplits`, match-engine song assembly, custom premium splits) **stays dormant — not removed** (kept tests-green, like the hidden match engine). Exposing it is a later cycle.
- **Decision:** Deferred. Single-rights-holder rollout first (BACKLOG T12). Revisit exposing splits after rollout proves out.

### D6 — Lexicon: in scope?
**RESOLVED (in, mandatory) 2026-06-08.** The lexicon informs the stem/mint process and is mandatory. Work-unit `type` + the rights/eligibility/license layer *is* the single-rights-holder guardrail. Now BACKLOG T6–T8. (Specifics still open — see D12.)
- **Decision:** In scope, mandatory.

### D7 — Pinata JWT exposed client-side (trio-phase shortcut)
The Pinata JWT is exposed via Vite client env — flagged as trio-phase-only in code. Not mint-module-blocking, but it's a real pre-public-launch security item that lives near the upload→mint path.
- **Why parked:** security posture decision tied to the public-launch timeline, not this cycle's code.
- **Needs:** acknowledge as a tracked launch-gate item (move to a real server-side signing flow before public).
- **Decision:** _pending_

### D8 — Custodial private-key storage: security bar
**(Added 2026-06-08.)** The custodial model means STEM holds users' private keys. T6 ships the pragmatic trio-phase default: keys **encrypted at rest** with a server-held decrypt key (env/secret). That is appropriate for a closed trio but is a real liability at public scale (a server compromise = every custodial wallet compromised).
- **Why parked:** security posture decision with custody/liability weight; expensive to undo if assets are lost.
- **Needs:** confirm encrypted-at-rest is acceptable for the trio phase, and acknowledge "move to a KMS / HSM / dedicated signer before public launch" as a tracked launch-gate. Where does the decrypt key live?
- **Decision:** _pending_

### D9 — Self-custody handoff mechanism
**(Added 2026-06-08.)** When a user is "ready to take control," what happens? Two paths: (a) **export** — hand them the seed phrase / private key and step back; or (b) **transfer** — they link their own Phantom and the platform transfers their NFTs to it (custodial wallet retired). cNFTs/pNFTs are transferable, so (b) is feasible; (a) is simpler but hands over a key the platform also held. T7 keeps the WalletSetup route intact so this can bolt on later.
- **Why parked:** API/UX-shape + custody decision; affects how keys are generated (HD-derivable for export vs. random).
- **Needs:** pick export vs. transfer (or both) for the eventual handoff *UX*.
- **Decision:** _keygen defaulted to mnemonic-derived (HD) so BOTH paths stay open — no longer blocks T9. Handoff UX still pending._

### D10 — Provenance-naming rule (constraint, flagged for confirmation)
**(Added 2026-06-08.)** Not really open — it's a constraint I'm building T7 against — but flagging so you can veto: **mint metadata names the creator as the artist (creator/royalty field = the user), never the platform**, so on-chain provenance is the creator's from day one even while STEM holds the key. This is what keeps the custodial model consistent with the Ulli thesis (work made uneraseable *and creator-attributed*). If you want it different, say so.
- **Why parked:** thesis-load-bearing; cheap to confirm, expensive to discover wrong after minting.
- **Needs:** a nod that creator-attribution-always is correct.
- **Decision:** _pending (building as default unless vetoed)_

### D11 — Album / EP minting: good practice?
**(Added 2026-06-08 — Nic flagged.)** A single rights holder minting a stem/track/song is clear. Minting a whole **album or EP** (a release-typed collection) as a single NFT is uncertain practice — Nic put a question mark on it. Open question: mint a multi-track release as one NFT, or only mint the individual works and treat the album/EP as a (typed) collection grouping over already-minted pieces?
- **Why parked:** good-practice / standards question; minting the wrong structure is expensive to undo on-chain.
- **Needs:** a call on whether album/EP is mintable in rollout — and I can run a focused research pass on prevailing practice (single-release NFT vs. per-track + collection) if useful.
- **Decision:** _pending (album/EP excluded from rollout mint scope until decided; collections still group works)_

### D12 — Lexicon first-pass taxonomy specifics
**(Added 2026-06-08.)** Lexicon is in (D6), but a few specifics from the lexicon notes are still open: (a) generic collective noun — **"tracks"** vs **"works"**; (b) **Beat** — Mandatory or Optional (depends on producer-cohort weight); (c) rights policy detail for **Cover / Remix / Sample** mint-eligibility + flagging; (d) exact set of types that ship in the first pass.
- **Why parked:** product/vocabulary shape; cheap to confirm, mildly annoying to redo in UI + data.
- **Needs:** light steer; otherwise I proceed on the lexicon notes' weights (Mandatory: stem/track/song; Cover non-mintable; Sample/Remix caution) and you veto in review.
- **Decision:** _pending (building on lexicon-notes defaults unless steered)_

---

## Resolved

- **D5** — Multi-rights-holder split engine: deferred (single-rights-holder rollout first). _2026-06-08_
- **D6** — Lexicon: in scope, mandatory. _2026-06-08_

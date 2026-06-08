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

# wemake.music — Handoff (2026-06-17)

> This repo was "STEM". It has **pivoted to wemake.music**. Read this first.
> Full living detail is in Claude's auto-memory `project_wemake_music_pivot`; this
> is the in-repo snapshot for a fresh session.

## The pivot
From music **distribution** → music **connection**. wemake.music is a platform of
tools that help a creator personally reach one person and move them with music.
Voice: warm, human, real-people, low-marketing, intimate. NOT an algorithmic feed.

Core principle — **a song is a gift**: playing is always free; paying is only to
download/keep (pay-what-you-want). Commerce lives downstream of the gift.
First tool: **"Can I offer you a song?"** (the offer page). Minting is repositioned
as **provenance / proof-of-ownership** ("equips you to defend, not protects from"
litigation) — not distribution.

## The three pieces
| Piece | What | Where |
|---|---|---|
| **stem** (this repo) | Backend (tRPC, Drizzle/MySQL, magic-link auth, mint pipeline + relayer) + current functional app (Vite + React + **wouter** + Express). Internal logged-in app. | github.com/niclariviere/stem · local /Users/nixai/stem |
| **song-gift** | The **new public frontend**, Lovable-generated (TanStack Start + React 19 + Tailwind 4 + shadcn). The beautiful wemake.music design. | github.com/niclariviere/song-gift · local /Users/nixai/song-gift · `pnpm dev` → :8080 |
| **wemake-design** | HTML prototypes + the **Lovable master prompt** (LOVABLE-PROMPT.md) = the design spec/reference. | local /Users/nixai/wemake-design (no remote) |

## What's live now
- **https://wemake.music** → the **song-gift** Lovable design (public face). Served via
  the `stem` Cloudflare tunnel → `localhost:8080`. ⚠️ DEV server, front-end only (placeholder
  artists nix/ulli, **no backend/login/library/mint**).
- **https://wemake.nixmusic.net** & **stem.nixmusic.net** → the **functional stem app**
  (`localhost:3001`) — login (magic link), library/upload/mint, settings, newsfeed, members.
- Login: wemake.nixmusic.net/login → `niclariviere@gmail.com` (admin, skips invite); dev
  shows the magic link on screen + console.

## Brand
- Type: **Joc** (the `wemake.music` wordmark only; Adobe kit use.typekit.net/lyq7mdn.css,
  weight 900) · **Fraunces** (editorial headings) · **Inter** (body). Artist's own name =
  a per-artist configurable font (their logo, not wemake's).
- Logo: a single terracotta line looping to tie two dots (two people, one bond) + a **red
  recording dot** that blinks 3× on load ("on the record"); loop arcs over the wordmark.
- Palette: bg `#0c0a09`, cream `#F4EFE3`, terracotta `#C2622F`, recording red `#E0492B`.

## Endgame
**Consolidate everything under wemake.music** — public design + internal tools (library,
**minting**, **bug tracking**, **newsfeed** comms, members, settings, profile, all kept &
reconnected) into ONE app. Then **retire stem.nixmusic.net**.

## Integration decision (PENDING — the big next step)
Merge song-gift (frontend) + stem (backend). Framework mismatch: song-gift = TanStack Start;
stem = wouter + Express + tRPC. Two paths: (A) port song-gift pages into stem; (B) adopt
song-gift as the app + graft stem's backend (auth/Drizzle/mint/relayer) or call stem as API.
Leaning **B** (song-gift is the better/newer frontend; stem's value is the backend). The
contract is song-gift's `src/lib/artists.ts` types → map to real DB.

## Beta punch-list
1. ✅ **Internal logged-in nav** — done (this repo): `DashboardLayout` menu populated
   (Profile · Library[upload/manage/mint] · Settings · Newsfeed · Members · Report a bug),
   logged-in routes wrapped; public routes nav-free.
2. ⏳ **Magic-link → set username + password onboarding.** Magic link = invite (DM'd, wrapped
   in a short link — manual). On click → verify → if no creds, route to "choose username +
   password" (not straight to /profile, see `server/_core/authRoutes.ts:131`); future logins
   use username+password. Needs: schema `username`(unique)+`passwordHash` on `users`;
   set-credentials + username/pw login endpoints; frontend pages.
3. ✅ **Deploy on wemake.music** — live (dev server).
4. ⏳ **Integration / consolidation** (the big one — see above).
5. ⏳ **Production build + auto-start** — both apps lack auto-start (die on reboot); need a
   prod build + LaunchAgent.

## Infra facts
- Cloudflare tunnel **`stem`** UUID `4cdaee86-c85b-4994-8a0e-dc97a2536ac0`, config
  `~/.cloudflared/config.yml`. Ingress: `stem.nixmusic.net` + `wemake.nixmusic.net` → :3001;
  `wemake.music` + `www.wemake.music` → :8080; else 404.
- Runs as LaunchDaemon `com.cloudflare.cloudflared` (root). Reload after config/ingress edits:
  `sudo launchctl kickstart -k system/com.cloudflare.cloudflared` (needs Nic's password).
- **All domains are in ONE Cloudflare account** (Niclariviere@gmail.com). The legacy NS-pair
  differences (mario/violet vs braelyn/ivan) are per-zone, not separate accounts. `cert.pem`
  is now scoped to wemake.music (old nixmusic cert backed up: `~/.cloudflared/cert-nixmusic.pem.bak`).
- song-gift Vite needs `vite.server.allowedHosts: ["wemake.music","www.wemake.music"]` to
  serve through the tunnel (already set in `song-gift/vite.config.ts`).
- Mac DNS: router resolver flakes (negative-caches) → pin to 1.1.1.1, or flush with
  `sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder`.
- Cleanup TODO: delete junk `wemake.music.nixmusic.net` + `www.wemake.music.nixmusic.net`
  records in the **nixmusic.net** zone (created by a mis-scoped `route dns`).

## Notes
- Repo rename (stem → wemake.music) is wanted but not urgent.
- This session's commits on `beta/stabilization-2026-06-01`: wemake.music brand
  (logo/favicon/Fraunces on home+login), internal nav wiring, this handoff.

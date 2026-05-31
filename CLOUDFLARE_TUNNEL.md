# Cloudflare Tunnel — exposing stem.nixmusic.net

This guide stands up a Cloudflare Tunnel from the Mac Mini so that
`stem.nixmusic.net` reaches the local dev server at `localhost:3001`.
No router port-forwarding, no public IP exposure, TLS handled at the edge.

## Prerequisites
- Your `nixmusic.net` zone is on Cloudflare (already the case).
- The STEM app is running locally on port 3001 (`pnpm dev`).

## One-time setup

### 1. Install cloudflared
```bash
brew install cloudflared
```

### 2. Authenticate against your Cloudflare account
```bash
cloudflared tunnel login
```
A browser opens; pick `nixmusic.net` and authorize. A cert is written to
`~/.cloudflared/cert.pem`.

### 3. Create the tunnel
```bash
cloudflared tunnel create stem
```
This prints a tunnel UUID and writes a credentials JSON to
`~/.cloudflared/<UUID>.json`. Copy the UUID — you'll use it in step 4.

### 4. Write the tunnel config
Create `~/.cloudflared/config.yml`:

```yaml
tunnel: <UUID from step 3>
credentials-file: /Users/nixai/.cloudflared/<UUID>.json

ingress:
  - hostname: stem.nixmusic.net
    service: http://localhost:3001
  - service: http_status:404
```

### 5. Route the DNS hostname to the tunnel
```bash
cloudflared tunnel route dns stem stem.nixmusic.net
```
This creates a `CNAME` in Cloudflare DNS pointing `stem.nixmusic.net` to
`<UUID>.cfargotunnel.com`. It's proxied (orange cloud) by default, so TLS is
terminated at the edge — no cert work on our side.

### 6. Test it once by hand
```bash
cloudflared tunnel run stem
```
Visit `https://stem.nixmusic.net` — you should see the STEM app.
Stop with Ctrl-C.

## Run on login (launchd)

`cloudflared` ships its own `launchctl` integration:
```bash
sudo cloudflared service install
```
This installs a system-level LaunchDaemon that starts the tunnel at boot
using `~/.cloudflared/config.yml`. Verify:
```bash
sudo launchctl list | grep cloudflared
```

## Operating notes
- The tunnel uses an outbound-only connection from the Mac Mini to Cloudflare.
  No inbound firewall rules required.
- If the Mac Mini loses internet, the tunnel reconnects automatically once
  connectivity returns. Pending mints queue up in the database meanwhile.
- To stop the tunnel: `sudo launchctl stop com.cloudflare.cloudflared`.
- Logs: `tail -f /Library/Logs/com.cloudflare.cloudflared.log`.

## Rotating or removing
```bash
# Remove the DNS route
cloudflared tunnel route dns --overwrite-dns <new-tunnel> stem.nixmusic.net

# Delete the tunnel entirely
cloudflared tunnel delete stem
```

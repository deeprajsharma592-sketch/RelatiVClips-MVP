# RelatiV Residential Downloader — Setup Guide

## What this does

Your laptop (residential IP) runs a lightweight download server. The Hetzner backend
routes YouTube video downloads through your laptop instead of using the blocked server IP.

```
  Hetzner Backend          Your Laptop              YouTube CDN
  ──────────────          ───────────              ───────────
  orchestrates        →   runs yt-dlp         →   sees RESIDENTIAL IP ✓
  subtitles, AI,         (residential IP)          video streams work ✓
  rendering
```

---

## Part 1: Your Laptop Setup (do once)

### 1. Requirements
- Python 3.9+
- yt-dlp installed: `pip install yt-dlp`
- uvicorn installed: `pip install uvicorn fastapi`
- A stable internet connection (keep laptop on and connected)

### 2. Cookies file
Export your YouTube cookies to a file:
```
~/.cookies/youtube.txt
```
How to export: Chrome extension "EditThisCookie" → Export → save as `youtube.txt`

### 3. Start the server
```bash
# Download the script from the server first:
scp root@91.98.144.72:/app/RelatiV/ytdlp-residential-server.py ~/

# Run it:
python3 ytdlp-residential-server.py --host 0.0.0.0 --port 8765

# Keep it running in background (macOS/Linux):
nohup python3 ytdlp-residential-server.py --host 0.0.0.0 --port 8765 > ~/relativ-downloader.log 2>&1 &
```

### 4. Find your laptop's LAN IP
```bash
# macOS
ifconfig | grep "inet " | grep -v 127.0.0.1

# Linux
ip addr show | grep "inet "

# Look for 192.168.x.x or 10.x.x.x — this is your LAN IP
```

You'll give this IP to the server config below.

---

## Part 2: Server Configuration (already done)

The `backend/utils/residential_downloader.py` module is installed on Hetzner.
Set these environment variables in the backend container (or docker-compose):

```yaml
# Add to docker-compose.yml backend service environment:
environment:
  - RESIDENTIAL_HOST=192.168.x.x        # ← your laptop's LAN IP
  - RESIDENTIAL_PORT=8765
  - RESIDENTIAL_COOKIES=/path/to/cookies.txt  # on laptop, not server
```

Then restart: `cd /app/RelatiV && docker compose restart backend`

---

## Part 3: Port Forwarding (if behind NAT)

If your laptop is behind a router, the server can't reach it directly.
Two options:

### Option A: SSH Reverse Tunnel (recommended — no router config needed)
On your laptop, create an SSH tunnel to the Hetzner server:
```bash
ssh -N -R 8765:localhost:8765 root@91.98.144.72
```
This makes the server reachable at `localhost:8765` on the Hetzner server.
Set `RESIDENTIAL_HOST=localhost` in this case.

### Option B: Port Forward on Router
Forward port 8765 TCP on your router to your laptop's IP.
Less recommended — exposes a port on your home network.

---

## Verification

Test from the server:
```bash
curl "http://YOUR_LAPTOP_IP:8765/health"
# Should return: {"status":"ok"}
```

Test download:
```bash
curl "http://YOUR_LAPTOP_IP:8765/download?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ&format_spec=worst" \
  -o /tmp/test_download.mp4
ls -lh /tmp/test_download.mp4
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Connection refused` | Check firewall: `sudo ufw allow 8765` |
| `Cannot reach residential server` | Laptop not reachable from server; set up SSH tunnel |
| `HTTP 502` from /download | yt-dlp failed on laptop — check `yt-dlp --cookies ~/.cookies/youtube.txt -g <url>` |
| Downloads slow | Laptop's upload speed limits it; residential proxy works better for short clips |
| Server disconnects laptop | Use `tmux` or `screen` on laptop to keep server running |

---

## Security Notes (MVP only)

- **No authentication** — the download endpoint has no password/API key
- **Network isolation is the guard** — only the Hetzner server should be able to reach the laptop's port
- For SSH tunnel: server connects TO laptop, laptop doesn't expose anything publicly
- For prod: add `ALLOWED_IPS` or simple API key auth before going live

---

## Cost

- Your home internet bandwidth for video downloads (a few GB per test)
- yt-dlp + Python + uvicorn: zero cost
- No new subscriptions needed right now

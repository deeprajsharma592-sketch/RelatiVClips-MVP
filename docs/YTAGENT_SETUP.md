# ytagent integration

RelatiV uses [`ytagent-cli`](https://github.com/Bilal140202/ytagent) 0.3.0
under its MIT license as the first full-source YouTube download strategy.
ytagent still uses yt-dlp internally; RelatiV adds a strict quality and network
policy around it.

## Production policy

- Target: H.264 MP4 video plus AAC/M4A audio, up to 1080p.
- Reject: silent output, invalid media, and output below 720p.
- Cache: one verified full source per YouTube video ID.
- Segmenting: FFmpeg slices the selected moments locally from that source.
- Approved ytagent methods: `transcript_probe`, `ytdlp_default`,
  `ytdlp_jsless`, and `ytdlp_ios`.
- Disabled methods: public Cobalt relays, Piped, Invidious, free SOCKS5
  proxies, GitHub Actions, audio-only salvage, and <=720p single-file salvage.
- Fallback: RelatiV's existing residential and `web_embedded` cookie-backed
  yt-dlp paths remain available when ytagent cannot return verified media.

## Install

From the repository root, using the same virtual environment as FastAPI:

```bash
python -m pip install -r backend/requirements.txt
```

The Windows startup scripts automatically reinstall requirements if the
`ytagent` import is missing.

The Linux/Docker runtime also needs `ffmpeg`, `ffprobe`, Node.js, Git, and
`libmagic1`. The backend Dockerfile installs these system dependencies.

On the current bare Linux backend, install and bootstrap with:

```bash
cd "/home/deeprajsharma/relativ server"
backend/venv/bin/python -m pip install ytagent-cli==0.3.0
sudo apt-get update && sudo apt-get install -y nodejs npm git libmagic1
YTAGENT_BGUTIL_HOME="$PWD/cache/bgutil-ytdlp-pot-provider" backend/venv/bin/ytagent setup
```

After the one-time setup, RelatiV restarts the compiled BGutil service on
demand when the backend process restarts.

## Configure

```dotenv
YTAGENT_ENABLED=1
YTAGENT_MIN_HEIGHT=720
YTAGENT_MAX_HEIGHT=1080
YTAGENT_TIMEOUT_SECONDS=240
# Optional; defaults to <repo>/cache/bgutil-ytdlp-pot-provider
YTAGENT_BGUTIL_HOME=
```

`YTAGENT_FORMAT` is optional. If unset, RelatiV requests H.264/AAC first,
then other MP4 1080p-or-lower video/audio combinations.

## Verify

Start the backend and open:

```text
GET /debug/ytagent-status
```

Expected fields include `enabled: true`, `installed: true`, version `0.3.0`,
and only the four approved methods.

Run the adapter tests:

```bash
python -m pytest backend/tests/test_ytagent_downloader.py -q
```

Pipeline logs will show either:

```text
ytagent: verified 1920x1080 source via ytdlp_jsless
```

or a clear fallback message before the residential downloader is attempted.

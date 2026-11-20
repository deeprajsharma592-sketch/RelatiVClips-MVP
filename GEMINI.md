# RelatiVClips-MVP — Antigravity Workspace Rules

## Repository
- **GitHub:** `deeprajsharma592-sketch/RelatiVClips-MVP`
- **Remote URL:** `https://github.com/deeprajsharma592-sketch/RelatiVClips-MVP.git`
- **Default branch:** `main`
- **Live site:** `https://relativclips.com` (Vercel auto-deploys on push to `main`)

## Stack
- **Frontend:** Next.js 16 / React 19 / Tailwind 4 / Framer Motion — lives in `frontend-next/`
- **Backend:** FastAPI / Python 3.12 / PostgreSQL — lives in `backend/`
- **Infra:** Docker Compose + Caddy reverse proxy

## Git workflow
- Always work on `main` branch unless told otherwise
- Commit message format: `type: short description` (e.g. `feat:`, `fix:`, `chore:`, `refactor:`)
- When using GitHub MCP to push: owner = `deeprajsharma592-sketch`, repo = `RelatiVClips-MVP`, branch = `main`

## Key files
- Hero section: `frontend-next/src/components/HeroNew.tsx`
- Global styles / design tokens: `frontend-next/src/app/globals.css`
- Homepage: `frontend-next/src/app/page.tsx`
- Backend pipeline: `backend/pipeline/`

## Deployment
- Pushing to `main` → Vercel auto-deploys the frontend to relativclips.com within ~2 min
- Backend is separately deployed (Docker / Fly.io / Render)

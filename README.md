# VerifexPad

VerifexPad is the browser-based playground for the Verifex research language. It consists of a Create React App frontend with a Monaco editor, a split output/reference view, example snippets, and a Node/Express API that proxies compilation requests into a long-lived Docker container seeded with the official Verifex compiler. When Docker is unavailable (or you’re just poking around), the backend falls back to a fast simulation mode so the UI remains usable.

## What’s in this repo?

- `frontend/` – React SPA, Monaco editor, light/dark theming, example picker, language reference viewer rendered from Markdown.
- `backend/` – Express 5 server exposing `/api/compile`, `/api/reference`, and `/api/health`. Manages exactly one reusable compiler container per host.
- `backend/Dockerfile` – Builds the `verifex-compiler` image by cloning the upstream compiler, installing Z3, and publishing the .NET artifact.
- `docker-compose.yml` – Convenience target to build and optionally keep the compiler container alive with hardened runtime flags.
- `DEPLOYMENT.md` – Production checklist for hosting the API + static assets.

## Requirements

- Node.js 18+ for both frontend and backend dev servers.
- Docker Engine (only needed for real Verifex compilation; optional in simulation mode).
- .NET 9.0 SDK plus Git (only when rebuilding the compiler image locally).

## Quick start

1. **Build the compiler image (optional but recommended)**  
   ```bash
   docker compose build verifex-compiler
   # optionally keep it running:
   docker compose up -d verifex-compiler
   ```
   The backend will also launch the container on demand if it is absent.

2. **Run the backend**  
   ```bash
   cd backend
   npm install
   npm run dev    # http://localhost:3001 by default
   ```
   The server reuses the `verifexpad-compiler` container for every request. If Docker isn’t reachable it transparently switches to simulator responses.

3. **Run the frontend**  
   ```bash
   cd frontend
   npm install
   npm start      # http://localhost:3000
   ```
   CRA proxies `/api` to `http://localhost:3001`. For production builds set `REACT_APP_API_URL` (for example `https://your-domain/api`) before `npm run build`.

## Backend configuration

All settings are opt-in environment variables (defaults shown in parentheses):

| Variable | Purpose |
| --- | --- |
| `PORT` (`3001`) | HTTP port. |
| `VERIFEX_CONTAINER_NAME` (`verifexpad-compiler`) | Reused container name. |
| `VERIFEX_COMPILER_IMAGE` (`verifex-compiler`) | Image that contains the compiler. |
| `VERIFEX_CONTAINER_WORKDIR` (`/tmp/verifexpad`) | Folder inside the container for per-request scratch dirs. |
| `DOCKER_MEMORY_LIMIT` (`256m`) & `DOCKER_CPU_LIMIT` (`0.5`) | Passed to `docker run`. |
| `DOCKER_TIMEOUT` (`10` seconds) | Kills long running `docker exec` calls. |
| `DOCKER_DISABLE_NETWORK` (`true`) | Set to `false` if the compiler needs outbound networking. |

The backend automatically runs `docker run -d --entrypoint tail … -f /dev/null` with the limits above and executes `dotnet /app/publish/Verifex.dll` via `docker exec` for every compile request.

## API surface

- `POST /api/compile` – `{ code: string }` → `{ success, output, error }`.
- `GET /api/reference` – Serves the Markdown from `backend/reference.md` so edits there show up live in the UI.
- `GET /api/health` – Simple `{ status: "ok" }` health probe.

## Language reference & examples

- Update `backend/reference.md` to change what the “Language Reference” tab displays.
- Example snippets for the dropdown live in `frontend/src/examples/examples.js`.
- The theme toggle state persists in `localStorage`.

## Building for static hosts

```bash
cd frontend
REACT_APP_API_URL="https://your-backend.example.com/api" npm run build
```

Deploy the generated `frontend/build/` folder to any static host (GitHub Pages, Netlify, S3/CloudFront, Vercel, …). `frontend/serve.json` contains an example rewrite setup for hosts that support that format. See `DEPLOYMENT.md` if you want a single domain with a reverse proxy.

## Security & sandboxing

- Compilation happens in a single long-lived container so expensive compiler warmup occurs once.
- Containers start without network access (`--network none`) and inherit the CPU/memory limits above.
- Each request gets its own random work dir under `/tmp/verifexpad` that is cleaned up afterwards.
- Set `DOCKER_DISABLE_NETWORK=false` or adjust the limits if you need looser sandboxing in trusted environments.

When Docker isn’t available (CI, Codespaces, etc.) the backend’s simulator enforces a handful of syntax checks and surfaces friendly errors so the UI stays responsive.

## Useful commands

- Quick manual compile:
  ```bash
  curl -X POST http://localhost:3001/api/compile \
    -H "Content-Type: application/json" \
    -d '{"code":"fn main() { print(\"Hello, Verifex!\"); }"}'
  ```
- Remove the compiler container if you need a clean rebuild: `docker rm -f verifexpad-compiler`

For deployment specifics, load balancing tips, and reverse proxy samples refer to `DEPLOYMENT.md`.

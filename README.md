# VerifexPad

VerifexPad is the browser-based playground for the Verifex research language. It consists of a Create React App frontend with a Monaco editor, a split output/reference view, example snippets, and a Node/Express API that compiles code via a Firejail sandbox seeded with the official Verifex compiler. When sandboxing is disabled (or you’re just poking around), the backend falls back to a fast simulation mode so the UI remains usable.

## What’s in this repo?

- `frontend/` – React SPA, Monaco editor, light/dark theming, example picker, language reference viewer rendered from Markdown.
- `backend/` – Express 5 server exposing `/api/compile`, `/api/reference`, and `/api/health`. Automatically builds the compiler on first boot and runs it through Firejail per request.
- `compiler/` – Generated on-demand; holds the published Verifex compiler (`Verifex.dll`) plus its Z3 dependency.
- `DEPLOYMENT.md` – Production checklist for hosting the API + static assets.

## Requirements

- Node.js 18+ for both frontend and backend dev servers.
- .NET 9.0 SDK, Git, `wget`, and `unzip` (used to bootstrap the compiler automatically).
- Firejail (used to sandbox compiler executions).

## Quick start

1. **Run the backend**  
   ```bash
   cd backend
   npm install
   npm run dev    # http://localhost:3001 by default
   ```
   On first launch the server clones the Verifex compiler, publishes it with `dotnet publish -c Release`, downloads the Z3 shared library, and stores the artifacts in `../compiler/`. Subsequent restarts reuse the cached build unless you delete that folder. If Firejail isn’t installed (or you toggle `FIREJAIL_DISABLED=true`) the backend transparently switches to simulator responses.

2. **Run the frontend**  
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
| `VERIFEX_VERSION` (`master`) | Branch/tag of the compiler repo to clone during bootstrap. |
| `VERIFEX_COMPILER_REPO` (`https://github.com/Trivaxy/Verifex.git`) | Repository to clone for compiler sources. |
| `Z3_DOWNLOAD_URL` (4.12.2 Linux build) | URL to the Z3 zip the bootstrapper downloads. |
| `FIREJAIL_PATH` (`firejail`) | Custom path to the firejail binary. |
| `FIREJAIL_EXTRA_ARGS` | Extra args (space separated) appended to the firejail invocation. |
| `SANDBOX_TIMEOUT_MS` (`10000`) | Kills the firejail process after N milliseconds. |
| `FIREJAIL_DISABLED` (`false`) | Force simulation mode without sandboxing (useful for local dev). |

Compiled artifacts live in `compiler/` at the repo root. Delete the folder to force a rebuild with new settings.

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

- Compilation runs inside Firejail for every request with networking disabled and a private temp directory.
- The compiler binary plus Z3 are the only whitelisted resources; deleting `compiler/` forces a fresh publish if you change trust boundaries.
- Tune `FIREJAIL_EXTRA_ARGS` to tighten or loosen restrictions (for example CPU cgroups, `--private`, etc.) based on your environment.

When Firejail isn’t available the backend falls back to the simulator so the UI stays responsive, but no real compiler work happens in that mode.

## Useful commands

- Quick manual compile:
  ```bash
  curl -X POST http://localhost:3001/api/compile \
    -H "Content-Type: application/json" \
    -d '{"code":"fn main() { print(\"Hello, Verifex!\"); }"}'
  ```
- Remove the cached compiler if you need a clean rebuild (different branch, etc.): `rm -rf compiler`

For deployment specifics, load balancing tips, and reverse proxy samples refer to `DEPLOYMENT.md`.

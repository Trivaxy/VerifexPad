# VerifexPad

VerifexPad is an online playground for the Verifex programming language. The frontend is a static React single-page app that can be hosted anywhere (GitHub Pages, Netlify, S3, etc.), while the backend exposes a simple REST API that reuses a single sandboxed Docker container to compile and run code.

## Project Layout

- **frontend/** – React app with Monaco Editor. Builds to a static `build/` directory that can be uploaded to any static host.
- **backend/** – Express API server. On start it keeps one Verifex compiler container alive and executes requests inside it via `docker exec`.
- **backend/Dockerfile** – Produces the `verifex-compiler` image containing the compiler and runtime dependencies.
- **docker-compose.yml** – Optional helper to build and run the shared compiler container locally.

## Prerequisites

- Node.js 18+
- Docker (only required for real code execution)
- .NET 9.0 SDK (only needed if you want to rebuild the compiler image)

## Local Development

1. **Build the compiler image** (from `VerifexPad/`):
   ```bash
   docker compose build verifex-compiler
   ```
   The backend will start the container for you on demand. You can also keep it running by hand:
   ```bash
   docker compose up -d verifex-compiler
   ```

2. **Backend**:
   ```bash
   cd backend
   npm install
   npm run dev   # starts on http://localhost:3001
   ```
   The server will launch the `verifexpad-compiler` container if it is not already running and will reuse it for every compilation.

3. **Frontend**:
   ```bash
   cd frontend
   npm install
   npm start     # dev server on http://localhost:3000
   ```
   During development the CRA proxy forwards `/api` to `http://localhost:3001`. For a static build, set `REACT_APP_API_URL` to your backend URL before `npm run build`.

## Static Hosting Flow

```bash
cd frontend
REACT_APP_API_URL="https://your-backend.example.com/api" npm run build
```
Deploy the generated `build/` folder to GitHub Pages or any static host. The backend can live on a separate domain; just make sure CORS is enabled (already handled in `backend/index.js`).

## Security & Sandboxing

All compilation happens inside a long-lived Docker container that is configured with:

- Read-only root filesystem plus an isolated tmpfs workspace (`/tmp/verifexpad`)
- CPU and memory limits (`DOCKER_CPU_LIMIT`, `DOCKER_MEMORY_LIMIT`)
- No network access (`DOCKER_DISABLE_NETWORK`)
- Non-root execution (`verifexuser`)
- Request timeouts (`DOCKER_TIMEOUT`, default 10 seconds)

For environments without Docker, the backend automatically falls back to a lightweight simulator for development/demo purposes.

## Useful Commands

- Manual API test:
  ```bash
  curl -X POST http://localhost:3001/api/compile \
    -H "Content-Type: application/json" \
    -d '{"code":"fn main() { io.print(\"Hello, Verifex!\"); }"}'
  ```
- Tear down the compiler container:
  ```bash
  docker rm -f verifexpad-compiler
  ```

See `DEPLOYMENT.md` for production-oriented notes. Future work ideas live in `CODEBASE.md`.

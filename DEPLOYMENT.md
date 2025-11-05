# VerifexPad Deployment Guide

This guide covers a minimal production setup: the backend runs on a server, the compiler lives in one long-running Docker container, and the frontend is served as static files.

## Prerequisites

- Docker Engine 23+
- Node.js 18+
- Git (for fetching the repo or CI checkout)

## 1. Fetch the sources

```bash
git clone https://github.com/your-username/VerifexPad.git
cd VerifexPad
```

## 2. Build and start the compiler container

Build the image once (re-run when you update the compiler):
```bash
docker compose build verifex-compiler
```

Running the container in the background:
```bash
docker compose up -d verifex-compiler
```

> The backend can also start the container on demand if you skip the `up -d` step. Keeping it pre-started removes the first-request warm-up.

## 3. Deploy the backend API

```bash
cd backend
npm install

# Configure environment (see below) and start with your preferred process manager
NODE_ENV=production node index.js
# or
pm2 start index.js --name verifexpad-backend
```

### Backend environment variables

- `PORT` – HTTP port (default `3001`)
- `VERIFEX_CONTAINER_NAME` – container name to reuse (default `verifexpad-compiler`)
- `VERIFEX_COMPILER_IMAGE` – image name (default `verifex-compiler`)
- `VERIFEX_CONTAINER_WORKDIR` – workspace inside the container (default `/tmp/verifexpad`)
- `DOCKER_MEMORY_LIMIT` – passed to `docker run --memory` (default `256m`)
- `DOCKER_CPU_LIMIT` – passed to `docker run --cpus` (default `0.5`)
- `DOCKER_TIMEOUT` – execution timeout in seconds (default `10`)
- `DOCKER_DISABLE_NETWORK` – set to `false` to allow networking (default keeps networking disabled)

The backend exposes CORS for all origins, so you can host the frontend on a different domain.

## 4. Publish the frontend

```bash
cd ../frontend
npm install
REACT_APP_API_URL="https://api.your-domain.com/api" npm run build
```

Upload the generated `build/` directory to your static host (GitHub Pages, Netlify, CloudFront, etc.). If you host under a sub-path, update your host configuration to rewrite requests to `index.html`.

## 5. Optional reverse proxy

If you prefer a single domain, proxy `/api` to the backend and serve the static files directly. Example Nginx snippet:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location /api/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        root /var/www/verifexpad;        # directory containing the build output
        try_files $uri /index.html;
    }
}
```

## Troubleshooting

- Ensure the backend user belongs to the `docker` group or run it with sufficient privileges.
- `docker ps` should show a single `verifexpad-compiler` container in the `Up` state. Inspect its logs with `docker logs verifexpad-compiler`.
- If `docker exec` calls fail with buffering errors, bump `DOCKER_TIMEOUT` or the buffer settings inside `services/dockerService.js`.

Enjoy hacking on VerifexPad!

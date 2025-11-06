# VerifexPad Deployment Guide

This guide walks through a minimal production setup: the backend hosts the API, bootstraps the Verifex compiler automatically, and executes programs through Firejail. The frontend is served as static assets (any CDN or reverse proxy works).

## Prerequisites

- Node.js 18+
- .NET 9.0 SDK
- Firejail (ensure the backend user can invoke it)
- Git, `wget`, and `unzip`

> The backend clones and builds the compiler during startup. Firejail plus the .NET SDK must therefore be available on the same host.

## 1. Fetch the sources

```bash
git clone https://github.com/your-username/VerifexPad.git
cd VerifexPad
```

## 2. Prepare the backend API

```bash
cd backend
npm install
```

On first launch the backend will:

1. Clone the compiler repo (`VERIFEX_COMPILER_REPO`, default upstream Verifex).
2. `dotnet publish -c Release` the compiler into `../compiler/`.
3. Download the Z3 archive (`Z3_DOWNLOAD_URL`) and copy `libz3.so` beside the published DLL.

All later restarts reuse the cached `compiler/` directory. Delete it if you need to rebuild (new commit, different branch, etc.).

### Backend environment variables

- `PORT` – HTTP port (default `3001`).
- `VERIFEX_VERSION` – Branch/tag to clone (default `master`).
- `VERIFEX_COMPILER_REPO` – Source repository (default official Verifex).
- `Z3_DOWNLOAD_URL` – Zip containing the Z3 native library (default 4.12.2 glibc 2.31 build).
- `SANDBOX_TIMEOUT_MS` – Kill Firejail after this many ms (default `10000`).
- `FIREJAIL_PATH` – Override path to the binary (default `firejail`).
- `FIREJAIL_EXTRA_ARGS` – Extra hardening flags appended to the firejail invocation.
- `FIREJAIL_DISABLED` – Set to `true` to use the simulator instead of the real compiler (for trusted local development only).

### Running the backend

```bash
NODE_ENV=production node index.js
# or with a process manager
pm2 start index.js --name verifexpad-backend
```

`compiler/` sits in the repository root, so keep it writable by the backend user. Firejail must also be executable by that user (usually by keeping the user in the `firejail` group on Linux distros that enforce it).

## 3. Publish the frontend

```bash
cd ../frontend
npm install
REACT_APP_API_URL="https://api.your-domain.com/api" npm run build
```

Upload `frontend/build/` to your preferred static host (GitHub Pages, Netlify, S3/CloudFront, etc.). If you host the backend and frontend on the same domain, configure your reverse proxy to forward `/api` to the backend as shown below.

## 4. Optional reverse proxy

Example Nginx snippet:

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

- **Firejail missing** – Install it via your distro (`sudo apt install firejail`) and ensure the backend user can invoke it without sudo.
- **Bootstrap failures** – The first boot logs every command with a `[compiler]` prefix. Missing `git`, `dotnet`, `wget`, or `unzip` will cause immediate failures; install them and restart.
- **Need a clean rebuild** – Stop the backend, delete the `compiler/` directory, and start the server again.
- **Sandbox tuning** – Use `FIREJAIL_EXTRA_ARGS="--private --private-tmp"` (or similar) to tighten the sandbox. Validate your flags with `firejail --build=...` before deploying them broadly.

Once these steps are complete you can serve the frontend from a CDN, proxy `/api` to the backend, and rely on Firejail for lightweight isolation of every Verifex compilation.

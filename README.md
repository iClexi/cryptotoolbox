# CryptoToolbox

Vite/React frontend with an Express + Socket.IO backend. Persistence now uses PostgreSQL only.

## Local Setup

1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env` and set real values for `SESSION_SECRET`, PostgreSQL credentials, `APP_URL`, `APP_ORIGIN`, and the optional admin PIN.
3. Start PostgreSQL and create the `cryptotoolbox` database.
4. Run the app:
   `npm run dev`

The server creates the required tables and default app/wiki rows on startup.

## Server Deployment

Do not commit the real `.env` file. It contains production secrets and is intentionally ignored by Git.

On the server:

```bash
npm ci
npm run build
NODE_ENV=production npm run start
```

Recommended production settings:

```env
NODE_ENV=production
APP_URL=https://your-domain.com
APP_ORIGIN=https://your-domain.com
ALLOWED_ORIGINS=https://your-domain.com
FORCE_HTTPS=true
COOKIE_SECURE=true
SESSION_SECRET=use-a-long-random-secret
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=cryptotoolbox
DB_USER=cryptotoolbox_user
DB_PASSWORD=use-a-strong-password
DB_SSL=false
```

Run the Node process behind Nginx, Caddy, Apache, or another reverse proxy that terminates HTTPS and forwards traffic to port `3000`.

## Security Scan Notes

For ZAP, scan a production build instead of Vite dev middleware:

```bash
npm run build
$env:NODE_ENV="production"; npm run start
```

Use HTTPS in deployment with `FORCE_HTTPS=true`, `COOKIE_SECURE=true`, and a reverse proxy or TLS terminator.

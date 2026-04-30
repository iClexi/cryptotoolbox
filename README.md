# CryptoToolbox

Vite/React frontend with an Express + Socket.IO backend. Persistence now uses PostgreSQL only.

## Local Setup

1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env` and change `SESSION_SECRET`, database credentials, and the optional admin PIN.
3. Start PostgreSQL and create the `cryptotoolbox` database.
4. Run the app:
   `npm run dev`

The server creates the required tables and default app/wiki rows on startup.

## Docker Compose

Run the app and PostgreSQL together:

```bash
docker compose up --build
```

The app will be available on `http://localhost:3000`.

## Security Scan Notes

For ZAP, scan a production build instead of Vite dev middleware:

```bash
npm run build
$env:NODE_ENV="production"; npm run start
```

Use HTTPS in deployment with `FORCE_HTTPS=true`, `COOKIE_SECURE=true`, and a reverse proxy or TLS terminator.

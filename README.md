<div align="center">

# CryptoToolbox

### Hashing, file integrity checks, crypto references, real-time activity, and admin visibility.

![React](https://img.shields.io/badge/React-20232a?style=for-the-badge&logo=react&logoColor=61dafb)
![Vite](https://img.shields.io/badge/Vite-646cff?style=for-the-badge&logo=vite&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?style=for-the-badge&logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-111827?style=for-the-badge&logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-30557c?style=for-the-badge&logo=postgresql&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?style=for-the-badge&logo=socketdotio&logoColor=white)
![Helmet](https://img.shields.io/badge/Helmet-4c1d95?style=for-the-badge&logo=helmet&logoColor=white)
![Crypto](https://img.shields.io/badge/Crypto-065f46?style=for-the-badge&logo=securityscorecard&logoColor=white)

**Tags:** `cryptography` · `hashing` · `file-integrity` · `react` · `express` · `postgresql` · `socket.io` · `admin-dashboard`

</div>

---

## What It Is

CryptoToolbox is a web application for practical cryptography exercises, file integrity checks, account-based learning, technical reputation, chat, and administrative activity review.

It started as an academic certificate/hash practice tool and grew into a full-stack application with a React frontend, Express backend, PostgreSQL persistence, Socket.IO realtime features, optional AI assistance, and security-focused session handling.

## Main Use Cases

- Generate MD5, SHA-1, and SHA-256 hashes from text.
- Compute file hashes in the browser without uploading files to the server.
- Compare expected checksums against local file output.
- Document algorithm status, risks, and recommendations.
- Practice integrity verification for common executables.
- Register users, track points, and assign ranks.
- Use a real-time global chat and private messaging foundation.
- Review platform activity from an admin dashboard.

## Features

- Text hashing.
- Browser-local file hashing.
- Known executable checksum references.
- Algorithm wiki/reference area.
- User registration and PIN-based login.
- PIN recovery by email.
- Temporary lockout after repeated failed attempts.
- Point, level, and rank system.
- Editable user profile.
- Global chat with Socket.IO.
- Private-message support.
- Live technical activity stream.
- Admin dashboard for users, hashes, messages, and recent activity.
- Optional Gemini AI integration for assisted hash/encoding explanations.
- Sentry configuration through environment variables.
- Helmet-powered security headers.
- Rate limiting for sensitive authentication routes.
- HTTP-only signed sessions.

## Tech Stack

| Layer | Stack |
| --- | --- |
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| UI | Lucide React, Sonner, Motion, Anime.js |
| Hashing | CryptoJS, browser File APIs |
| Backend | Node.js, Express, TypeScript, TSX |
| Database | PostgreSQL via `pg` |
| Realtime | Socket.IO |
| Email | Nodemailer |
| Optional AI | Google Gemini API |
| Security | Helmet, signed cookies, rate limits, origin checks |
| Observability | Optional Sentry integration |

## Project Structure

```text
cryptotoolbox/
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── index.css
│   └── instrument.ts
├── server.ts              # Express API, sessions, database, Socket.IO
├── public/
│   └── logo.png
├── dist/                  # Production frontend build output
├── package.json
├── vite.config.ts
├── tsconfig.json
├── .env.example
└── README.md
```

## Environment

Use `.env.example` as a safe template. Keep real values in ignored environment files or the server environment.

Important groups:

| Group | Variables |
| --- | --- |
| App URL / origin | `APP_URL`, `APP_ORIGIN`, `ALLOWED_ORIGINS`, `PORT` |
| Sessions | `SESSION_SECRET`, `COOKIE_SECURE`, `FORCE_HTTPS` |
| Database | `DATABASE_URL` or `DB_*` |
| Initial admin | `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PIN` |
| Email recovery | `SMTP_*`, reset/rate limit values |
| Visitor retention | `VISITOR_EVENT_RETENTION_DAYS` |
| Optional AI | `GEMINI_API_KEY` |
| Observability | `VITE_SENTRY_DSN`, `SENTRY_*` |

Never commit real session secrets, database passwords, admin PINs, SMTP credentials, API keys, Sentry tokens, or filled `.env` files.

## Local Development

```bash
npm install
cp .env.example .env
npm run dev
```

Useful scripts:

```bash
npm run dev       # Start the Express/Vite development entry
npm run build     # Build the frontend
npm run start     # Run server.ts through tsx
npm run lint      # TypeScript check
npm run clean     # Remove dist
```

## Security Notes

- Session cookies should be `HttpOnly`, `Secure` in production, and `SameSite=Lax`.
- PINs are hashed with Node crypto primitives.
- Sensitive auth routes are rate-limited.
- Account lockout slows repeated failed login attempts.
- Origins and hosts are validated for production use.
- File hashing is local in the browser; files are not uploaded for hash calculation.
- Admin-only functions should stay behind authenticated authorization checks.

## Responsible Telemetry

The admin panel may show technical activity such as browser, operating system, request data, or general traffic events. Keep this behavior visible in product/legal copy and avoid collecting secrets, passwords, PINs, or hidden fingerprinting payloads.

## Operational Checks

Before release:

```bash
npm run lint
npm run build
```

Then verify:

- frontend assets load,
- API routes respond,
- login/register works,
- Socket.IO connects,
- admin dashboard requires authorization,
- optional services do not block startup when unset.

## License

Private project unless a license is added. Use for education, integrity checking, and defensive security learning.

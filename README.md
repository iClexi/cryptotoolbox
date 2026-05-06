# CryptoToolbox

CryptoToolbox is an academic web app for validating executable integrity with MD5, SHA-1, and SHA-256 hashes. It turns a certificate and checksum assignment into a polished interactive experience with verification tools, hash generation, file analysis, activity history, chat, and an algorithm wiki.

## Project Context

This project was built for the **Certificados Digitales** assignment. The core task was to publish a secure HTTPS web page where users can select one of three executables and view its MD5, SHA-1, and SHA-256 values:

- `plink.exe`
- `putty.exe`
- `VirtualBox-7.0.8-156879-Win.exe`

The assignment also required a public domain, SSL certificate validation with Let's Encrypt, and internet access without browser SSL warnings.

## What You Can Explore

- Integrity verification for PuTTY, Plink, and VirtualBox.
- MD5, SHA-1, and SHA-256 hash generation.
- File hashing directly in the browser.
- Online/local hash decoding helpers.
- Algorithm wiki with security notes.
- User profiles, reputation, global chat, private messages, and activity feed.
- Login, registration, terms acceptance, SMTP-ready PIN recovery, account lockout, and auth rate limiting.
- Registration profile fields with first name, last name, email, gender, and birth-date validation for ages 13 through 150.
- Admin traffic panel for authenticated and anonymous visits, including IP, browser, OS, device, language, viewport, timezone, and Cloudflare location headers when present.
- Hardened Express API using PostgreSQL, signed sessions, HttpOnly cookies, CSP, stricter input validation, login auditing, visitor telemetry, and case-insensitive account indexes.

## Tech Stack

- React 19
- Vite
- TypeScript
- Express
- Socket.IO
- PostgreSQL
- Tailwind CSS
- Lucide Icons
- Anime.js

## Source Setup

```bash
npm install
cp .env.example .env
npm run dev
```

The real `.env` file is intentionally ignored by Git because it must contain private values such as `SESSION_SECRET`, PostgreSQL credentials, admin PINs, and API keys. New PINs must use 6 to 8 digits; existing legacy 4-digit PINs are accepted only for login until the user resets them. The committed `.env.example` is only a safe template for developers reading or running the source code.

## Verification

```bash
npm run lint
npm run build
npm audit
```

The repository does not include local databases, build output, logs, or secret environment files.

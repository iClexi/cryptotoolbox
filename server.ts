import "dotenv/config";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import path from "path";
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { createServer } from "http";
import { Pool } from "pg";
import type { QueryResultRow } from "pg";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import * as nodemailer from "nodemailer";
import { GoogleGenAI } from "@google/genai";

const isProduction = process.env.NODE_ENV === "production" || process.env.APP_ENV === "production";
const PORT = Number(process.env.PORT || 3000);
const SESSION_COOKIE = "ct_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const configuredResetTtl = Number(process.env.RESET_TOKEN_TTL_MINUTES || 30);
const RESET_TOKEN_TTL_MINUTES = Number.isFinite(configuredResetTtl)
  ? Math.min(1440, Math.max(10, configuredResetTtl))
  : 30;
const HASH_RE = /^(?:[a-f0-9]{32}|[a-f0-9]{40}|[a-f0-9]{64})$/i;
const USERNAME_RE = /^[A-Za-z0-9_. -]{3,40}$/;
const NEW_PIN_RE = /^\d{6,8}$/;
const CREDENTIAL_PIN_RE = /^\d{4,8}$/;
const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;
const UNSAFE_TEXT_RE = /(?:<|>|\u0000|javascript:|data:text|file:|(?:^|[\\/])\.\.(?:[\\/]|$)|(?:^|[\\/])etc[\\/]passwd|[a-zA-Z]:[\\/]|WEB-INF[\\/\\]|--\s*$|;\s*(?:drop|select|insert|update|delete)\b)/i;
const GENDER_VALUES = new Set(["masculino", "femenino", "otro", "prefiero_no_decir"]);
const AUTH_RATE_WINDOW_MS = 10 * 60 * 1000;
const AUTH_RATE_LIMIT = Number(process.env.AUTH_RATE_LIMIT || 20);
const PASSWORD_RESET_RATE_LIMIT = Number(process.env.PASSWORD_RESET_RATE_LIMIT || 5);
const ACCOUNT_LOCK_ATTEMPTS = Number(process.env.ACCOUNT_LOCK_ATTEMPTS || 5);
const ACCOUNT_LOCK_MINUTES = Number(process.env.ACCOUNT_LOCK_MINUTES || 15);
const MIN_USER_AGE = 13;
const MAX_USER_AGE = 150;
const VISITOR_EVENT_RETENTION_DAYS = Number(process.env.VISITOR_EVENT_RETENTION_DAYS || 45);

const configuredSessionSecret = process.env.SESSION_SECRET?.trim();
const sessionSecret = configuredSessionSecret || (isProduction ? "" : randomBytes(32).toString("hex"));

if (!sessionSecret) {
  throw new Error("SESSION_SECRET is required when NODE_ENV=production");
}

if (!configuredSessionSecret && !isProduction) {
  console.warn("[AUTH] SESSION_SECRET not set; using an in-memory development secret.");
}

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type PublicUser = {
  id: number;
  username: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  birth_date: string | Date | null;
  gender: string | null;
  terms_accepted_at: string | Date | null;
  avatar_seed: string;
  role: "user" | "admin";
  points: number;
  rank: string;
  level: number;
  created_at: string | Date;
};

type SessionPayload = {
  userId: number;
  exp: number;
};

type LoginUserRow = PublicUser & {
  pin: string;
  failed_login_count: number;
  locked_until: string | Date | null;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type BrowserTelemetry = {
  browser_language?: string | null;
  browser_timezone?: string | null;
  platform?: string | null;
  screen?: string | null;
  viewport?: string | null;
  connection_type?: string | null;
  browser_data?: Record<string, unknown>;
};

type VisitorEventRow = {
  id: number;
  event_type: string;
  user_id: number | null;
  username: string | null;
  authenticated: boolean;
  ip: string;
  method: string | null;
  path: string | null;
  status_code: number | null;
  user_agent: string | null;
  browser_name: string | null;
  os_name: string | null;
  device_type: string | null;
  accept_language: string | null;
  browser_language: string | null;
  platform: string | null;
  screen: string | null;
  viewport: string | null;
  timezone: string | null;
  browser_timezone: string | null;
  connection_type: string | null;
  referrer: string | null;
  origin: string | null;
  cf_country: string | null;
  cf_region: string | null;
  cf_city: string | null;
  cf_timezone: string | null;
  browser_data: Record<string, unknown> | null;
  created_at: string | Date;
};

const rateLimitMap = new Map<string, RateLimitEntry>();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  host: process.env.DATABASE_URL ? undefined : (process.env.DB_HOST || "localhost"),
  port: process.env.DATABASE_URL ? undefined : Number(process.env.DB_PORT || 5432),
  database: process.env.DATABASE_URL ? undefined : (process.env.DB_NAME || "cryptotoolbox"),
  user: process.env.DATABASE_URL ? undefined : (process.env.DB_USER || "postgres"),
  password: process.env.DATABASE_URL ? undefined : (process.env.DB_PASSWORD || "postgres"),
  max: Number(process.env.DB_POOL_MAX || 10),
  ssl: process.env.DB_SSL === "true"
    ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false" }
    : undefined,
});

function httpError(status: number, message: string): HttpError {
  return new HttpError(status, message);
}

function asyncRoute(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void | Response>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForDatabase() {
  const attempts = Number(process.env.DB_CONNECT_RETRIES || 20);
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch (error) {
      if (attempt === attempts) throw error;
      await delay(1000);
    }
  }
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw httpError(400, "JSON invalido");
  }
  return value as Record<string, unknown>;
}

function normalizeString(value: unknown, field: string, maxLength: number, required = true): string {
  if (value === undefined || value === null) {
    if (required) throw httpError(400, `${field} requerido`);
    return "";
  }
  if (typeof value !== "string") {
    throw httpError(400, `${field} debe ser texto`);
  }
  const normalized = value.trim();
  if (!normalized && required) throw httpError(400, `${field} requerido`);
  if (normalized.length > maxLength) throw httpError(400, `${field} demasiado largo`);
  if (UNSAFE_TEXT_RE.test(normalized)) throw httpError(400, `${field} contiene caracteres no permitidos`);
  return normalized;
}

function normalizeOptionalEmail(value: unknown): string | null {
  const email = normalizeString(value, "email", 254, false);
  if (!email) return null;
  if (!/^[^\s@<>]{1,64}@[^\s@<>]{1,189}\.[^\s@<>]{2,63}$/.test(email)) {
    throw httpError(400, "email invalido");
  }
  return email.toLowerCase();
}

function normalizeUsername(value: unknown): string {
  const username = normalizeString(value, "username", 40);
  if (!USERNAME_RE.test(username)) throw httpError(400, "username invalido");
  return username.toLowerCase();
}

function normalizeCredentialPin(value: unknown): string {
  if (typeof value !== "string" || !CREDENTIAL_PIN_RE.test(value)) {
    throw httpError(400, "PIN numerico invalido");
  }
  return value;
}

function normalizeNewPin(value: unknown): string {
  if (typeof value !== "string" || !NEW_PIN_RE.test(value)) {
    throw httpError(400, "PIN de 6 a 8 digitos requerido");
  }
  return value;
}

function normalizeResetToken(value: unknown): string {
  const token = normalizeString(value, "token", 200);
  if (!/^[A-Za-z0-9_-]{32,200}$/.test(token)) {
    throw httpError(400, "token invalido");
  }
  return token;
}

function normalizePersonName(value: unknown, field: string): string {
  const name = normalizeString(value, field, 80);
  if (name.length < 2) throw httpError(400, `${field} demasiado corto`);
  return name;
}

function normalizeBirthDate(value: unknown): string {
  const birthDate = normalizeString(value, "birthDate", 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    throw httpError(400, "fecha de nacimiento invalida");
  }

  const parsed = new Date(`${birthDate}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== birthDate) {
    throw httpError(400, "fecha de nacimiento invalida");
  }

  const year = parsed.getUTCFullYear();
  const today = new Date();
  if (year < 1900 || parsed > today) {
    throw httpError(400, "fecha de nacimiento fuera de rango");
  }
  let age = today.getUTCFullYear() - parsed.getUTCFullYear();
  const monthDelta = today.getUTCMonth() - parsed.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getUTCDate() < parsed.getUTCDate())) {
    age -= 1;
  }
  if (age < MIN_USER_AGE || age > MAX_USER_AGE) {
    throw httpError(400, `debes tener entre ${MIN_USER_AGE} y ${MAX_USER_AGE} anos`);
  }

  return birthDate;
}

function normalizeGender(value: unknown): string {
  const gender = normalizeString(value, "gender", 30);
  if (!GENDER_VALUES.has(gender)) throw httpError(400, "genero invalido");
  return gender;
}

function normalizeTermsAccepted(value: unknown): true {
  if (value !== true) throw httpError(400, "debes aceptar los terminos y condiciones");
  return true;
}

function getClientIp(req: Request): string {
  const cfIp = req.headers["cf-connecting-ip"];
  if (typeof cfIp === "string" && cfIp.trim()) return cfIp.trim().slice(0, 100);
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim().slice(0, 100);
  }
  return (req.ip || req.socket.remoteAddress || "unknown").slice(0, 100);
}

function cleanTelemetryText(value: unknown, maxLength: number): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).replace(/\u0000/g, "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, maxLength) : null;
}

function getHeaderText(req: Request, name: string, maxLength = 300): string | null {
  const value = req.headers[name.toLowerCase()];
  if (Array.isArray(value)) return cleanTelemetryText(value.join(", "), maxLength);
  return cleanTelemetryText(value, maxLength);
}

function isPrivateIp(ip: string): boolean {
  return /^(?:127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|::1|fe80:|fc|fd)/i.test(ip);
}

function parseUserAgent(userAgent: string | null) {
  const ua = userAgent || "";
  const browserName = /Edg\//.test(ua) ? "Microsoft Edge"
    : /OPR\//.test(ua) ? "Opera"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Firefox\//.test(ua) ? "Firefox"
    : /Safari\//.test(ua) ? "Safari"
    : /curl\//i.test(ua) ? "curl"
    : ua ? "Otro" : "Desconocido";
  const osName = /Windows NT/i.test(ua) ? "Windows"
    : /Android/i.test(ua) ? "Android"
    : /iPhone|iPad|iPod/i.test(ua) ? "iOS"
    : /Mac OS X/i.test(ua) ? "macOS"
    : /Linux/i.test(ua) ? "Linux"
    : ua ? "Otro" : "Desconocido";
  const deviceType = /Mobi|Android|iPhone/i.test(ua) ? "mobile"
    : /iPad|Tablet/i.test(ua) ? "tablet"
    : "desktop";
  return { browserName, osName, deviceType };
}

function safeRequestPath(req: Request, override?: unknown): string {
  const rawPath = cleanTelemetryText(override, 300) || req.originalUrl || req.path || "/";
  try {
    return new URL(rawPath, "http://local").pathname.slice(0, 300);
  } catch {
    return rawPath.split("?")[0].slice(0, 300);
  }
}

function normalizeBrowserTelemetry(body: Record<string, unknown>): BrowserTelemetry {
  const browserData: Record<string, unknown> = {};
  const allowedKeys = [
    "language",
    "languages",
    "timezone",
    "platform",
    "userAgent",
    "screen",
    "viewport",
    "hardwareConcurrency",
    "deviceMemory",
    "connection",
    "touchPoints",
  ];

  for (const key of allowedKeys) {
    const value = body[key];
    if (value === undefined || value === null) continue;
    if (typeof value === "object") {
      const serialized = JSON.stringify(value);
      browserData[key] = serialized ? serialized.slice(0, 1000) : null;
    } else {
      browserData[key] = cleanTelemetryText(value, 1000);
    }
  }

  return {
    browser_language: cleanTelemetryText(body.language, 120),
    browser_timezone: cleanTelemetryText(body.timezone, 120),
    platform: cleanTelemetryText(body.platform, 160),
    screen: cleanTelemetryText(body.screen, 80),
    viewport: cleanTelemetryText(body.viewport, 80),
    connection_type: cleanTelemetryText(body.connection, 120),
    browser_data: Object.keys(browserData).length ? browserData : undefined,
  };
}

function enforceRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const existing = rateLimitMap.get(key);
  if (!existing || existing.resetAt <= now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  existing.count += 1;
  if (existing.count > limit) {
    throw httpError(429, "Demasiados intentos. Espera unos minutos e intenta otra vez.");
  }
}

function isUserLocked(user: { locked_until: string | Date | null }) {
  if (!user.locked_until) return false;
  return new Date(user.locked_until).getTime() > Date.now();
}

async function recordFailedLogin(user: LoginUserRow) {
  const nextCount = (user.failed_login_count || 0) + 1;
  const shouldLock = nextCount >= ACCOUNT_LOCK_ATTEMPTS;
  await pool.query(
    `UPDATE users
     SET failed_login_count = $1,
         locked_until = CASE WHEN $2 THEN now() + ($3 || ' minutes')::interval ELSE locked_until END,
         updated_at = now()
     WHERE id = $4`,
    [nextCount, shouldLock, ACCOUNT_LOCK_MINUTES, user.id],
  );
  if (shouldLock) {
    throw httpError(429, "Cuenta bloqueada temporalmente por intentos fallidos.");
  }
  throw httpError(401, "PIN incorrecto");
}

function normalizeId(value: unknown, field = "id"): number {
  const id = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(id) || id < 1) throw httpError(400, `${field} invalido`);
  return id;
}

function normalizeHash(value: unknown, field = "hash"): string {
  const hash = normalizeString(value, field, 128).toLowerCase();
  if (!HASH_RE.test(hash)) throw httpError(400, `${field} invalido`);
  return hash;
}

function normalizeUrl(value: unknown, field = "url"): string {
  const text = normalizeString(value, field, 2048);
  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    throw httpError(400, `${field} invalida`);
  }
  if (parsed.protocol !== "https:") {
    throw httpError(400, `${field} debe usar HTTPS`);
  }
  if (parsed.username || parsed.password) {
    throw httpError(400, `${field} no puede incluir credenciales`);
  }
  return parsed.toString();
}

function isUnsafeStoredText(value: unknown): boolean {
  return typeof value !== "string" || !value.trim() || value.length > 2048 || UNSAFE_TEXT_RE.test(value);
}

function validateStatusColor(value: unknown): string {
  const color = normalizeString(value, "statusColor", 7);
  if (!HEX_COLOR_RE.test(color)) throw httpError(400, "statusColor invalido");
  return color;
}

function validateAppBody(body: unknown) {
  const obj = asObject(body);
  return {
    key: normalizeString(obj.key, "key", 64).toLowerCase(),
    name: normalizeString(obj.name, "name", 120),
    description: normalizeString(obj.description, "description", 1000),
    image: normalizeUrl(obj.image, "image"),
    md5: normalizeHash(obj.md5, "md5"),
    sha1: normalizeHash(obj.sha1, "sha1"),
    sha256: normalizeHash(obj.sha256, "sha256"),
  };
}

function validateWikiBody(body: unknown) {
  const obj = asObject(body);
  return {
    name: normalizeString(obj.name, "name", 80),
    fullName: normalizeString(obj.fullName, "fullName", 160),
    status: normalizeString(obj.status, "status", 40),
    statusColor: validateStatusColor(obj.statusColor),
    description: normalizeString(obj.description, "description", 1200),
    useCase: normalizeString(obj.useCase, "useCase", 1200),
    vulnerabilities: normalizeString(obj.vulnerabilities, "vulnerabilities", 1200),
  };
}

function rankForPoints(points: number, role: string) {
  if (role === "admin") return "System Administrator";
  if (points >= 5000) return "Elite Cipher";
  if (points >= 2000) return "Root Admin";
  if (points >= 1000) return "Cipher Master";
  if (points >= 500) return "Security Analyst";
  if (points >= 200) return "Junior Operator";
  return "Novice";
}

function levelForPoints(points: number) {
  return Math.max(1, Math.floor((1 + Math.sqrt(1 + (8 * points) / 50)) / 2));
}

function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function verifyPin(pin: string, storedPin: string | null | undefined): boolean {
  if (!storedPin) return false;
  if (!storedPin.startsWith("scrypt$")) {
    return storedPin === pin;
  }
  const [, salt, storedHash] = storedPin.split("$");
  if (!salt || !storedHash) return false;
  const candidate = scryptSync(pin, salt, 64);
  const expected = Buffer.from(storedHash, "hex");
  return expected.length === candidate.length && timingSafeEqual(candidate, expected);
}

function hashResetToken(token: string): string {
  return createHash("sha256").update(`${sessionSecret}:${token}`).digest("hex");
}

function getPublicAppUrl(): string {
  return process.env.APP_URL || `http://localhost:${PORT}`;
}

function isSmtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST?.trim());
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendPasswordResetEmail(to: string, username: string, resetUrl: string) {
  if (!isSmtpConfigured()) {
    if (!isProduction && process.env.PASSWORD_RESET_DEV_OUTPUT === "true") {
      console.info(`[MAIL] Password reset link for ${username}: ${resetUrl}`);
    } else {
      console.warn("[MAIL] SMTP_HOST is not configured; password reset email was not sent.");
    }
    return;
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD || "";
  const appHost = new URL(getPublicAppUrl()).hostname;

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: user ? { user, pass } : undefined,
    requireTLS: process.env.SMTP_REQUIRE_TLS === "true",
  });

  const from = process.env.SMTP_FROM || `CryptoToolbox <no-reply@${appHost}>`;
  const safeUsername = escapeHtml(username);
  const safeResetUrl = escapeHtml(resetUrl);
  await transport.sendMail({
    from,
    to,
    subject: "Restablece tu PIN de CryptoToolbox",
    text: [
      `Hola ${username},`,
      "",
      "Recibimos una solicitud para restablecer el PIN de tu cuenta en CryptoToolbox.",
      `Abre este enlace para crear un PIN nuevo. Expira en ${RESET_TOKEN_TTL_MINUTES} minutos:`,
      resetUrl,
      "",
      "Si no solicitaste este cambio, ignora este correo.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
        <h2>Restablecer PIN de CryptoToolbox</h2>
        <p>Hola ${safeUsername}, recibimos una solicitud para restablecer el PIN de tu cuenta.</p>
        <p><a href="${safeResetUrl}" style="display:inline-block;background:#10b981;color:#000;padding:12px 18px;border-radius:8px;font-weight:700;text-decoration:none">Crear PIN nuevo</a></p>
        <p>Este enlace expira en ${RESET_TOKEN_TTL_MINUTES} minutos.</p>
        <p>Si no solicitaste este cambio, ignora este correo.</p>
      </div>
    `,
  });
}

function signSession(userId: number): string {
  const payload: SessionPayload = {
    userId,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const payloadText = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", sessionSecret).update(payloadText).digest("base64url");
  return `${payloadText}.${sig}`;
}

function verifySessionToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [payloadText, sig] = token.split(".");
  if (!payloadText || !sig) return null;
  const expectedSig = createHmac("sha256", sessionSecret).update(payloadText).digest("base64url");
  const sigBuffer = Buffer.from(sig);
  const expectedBuffer = Buffer.from(expectedSig);
  if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(payloadText, "base64url").toString("utf8")) as SessionPayload;
    if (!Number.isInteger(payload.userId) || payload.userId < 1) return null;
    if (!Number.isInteger(payload.exp) || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return header.split(";").reduce<Record<string, string>>((acc, part) => {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (!rawKey) return acc;
    acc[rawKey] = decodeURIComponent(rawValue.join("="));
    return acc;
  }, {});
}

function isSecureRequest(req: Request): boolean {
  return Boolean(req.secure || req.headers["x-forwarded-proto"] === "https");
}

function setSessionCookie(req: Request, res: Response, userId: number) {
  const secureCookie = process.env.COOKIE_SECURE === "true" || (isProduction && process.env.COOKIE_SECURE !== "false");
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(signSession(userId))}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ];
  if (secureCookie || isSecureRequest(req)) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function clearSessionCookie(res: Response) {
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

async function getPublicUserById(userId: number): Promise<PublicUser | null> {
  const result = await pool.query<PublicUser>(
    `SELECT id, username, email, first_name, last_name, birth_date, gender,
            terms_accepted_at, avatar_seed, role, points, rank, level, created_at
     FROM users
     WHERE id = $1`,
    [userId],
  );
  return result.rows[0] || null;
}

async function getSessionUserFromCookie(cookieHeader: string | undefined): Promise<PublicUser | null> {
  const token = parseCookies(cookieHeader)[SESSION_COOKIE];
  const payload = verifySessionToken(token);
  if (!payload) return null;
  return getPublicUserById(payload.userId);
}

async function requireSession(req: Request): Promise<PublicUser> {
  const user = await getSessionUserFromCookie(req.headers.cookie);
  if (!user) throw httpError(401, "Sesion requerida");
  return user;
}

async function requireAdmin(req: Request): Promise<PublicUser> {
  const user = await requireSession(req);
  if (user.role !== "admin") throw httpError(403, "No autorizado");
  return user;
}

function getAllowedOrigins(): Set<string> {
  const localhostOrigins = isProduction && process.env.ALLOW_LOCALHOST_ORIGIN !== "true"
    ? []
    : [`http://localhost:${PORT}`, `https://localhost:${PORT}`];
  const configured = [
    process.env.APP_ORIGIN,
    process.env.APP_URL,
    ...(process.env.ALLOWED_ORIGINS || "").split(","),
    ...localhostOrigins,
  ];
  return new Set(configured.map((value) => value?.trim()).filter(Boolean) as string[]);
}

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (getAllowedOrigins().has(origin)) return true;
  return !isProduction && /^https?:\/\/(?:localhost|127\.0\.0\.1):\d+$/.test(origin);
}

function configureSecurity(app: express.Express) {
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  const httpsHardeningEnabled = process.env.FORCE_HTTPS === "true"
    || (isProduction && process.env.FORCE_HTTPS !== "false");

  if (process.env.FORCE_HTTPS === "true") {
    app.use((req, res, next) => {
      if (isSecureRequest(req) || req.hostname === "localhost" || req.hostname === "127.0.0.1") {
        return next();
      }
      return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
    });
  }

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && !isAllowedOrigin(origin)) {
      return res.status(403).json({ error: "Origin no permitido" });
    }
    return next();
  });

  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "base-uri": ["'self'"],
        "object-src": ["'none'"],
        "frame-ancestors": ["'none'"],
        "form-action": ["'self'"],
        "script-src": isProduction ? ["'self'"] : ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        "script-src-attr": ["'none'"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'", "data:", "https:"],
        "font-src": ["'self'", "data:"],
        "connect-src": isProduction
          ? ["'self'", "https://www.nitrxgen.net", "https://md5.gromweb.com", "https://sha1.gromweb.com", "wss:"]
          : ["'self'", "https://www.nitrxgen.net", "https://md5.gromweb.com", "https://sha1.gromweb.com", "ws:", "wss:"],
        "media-src": ["'self'"],
        "manifest-src": ["'self'"],
        "upgrade-insecure-requests": httpsHardeningEnabled ? [] : null,
      },
    },
    hsts: httpsHardeningEnabled
      ? { maxAge: 15552000, includeSubDomains: true }
      : false,
    referrerPolicy: { policy: "no-referrer" },
    frameguard: { action: "deny" },
    noSniff: true,
  }));
}

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      first_name TEXT,
      last_name TEXT,
      birth_date DATE,
      gender TEXT,
      terms_accepted_at TIMESTAMPTZ,
      pin TEXT NOT NULL,
      avatar_seed TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
      points INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
      rank TEXT NOT NULL DEFAULT 'Novice',
      level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS hash_cache (
      hash TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      user_name TEXT NOT NULL,
      user_avatar TEXT NOT NULL,
      user_rank TEXT,
      content TEXT NOT NULL,
      is_edited INTEGER NOT NULL DEFAULT 0,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      type TEXT NOT NULL,
      hash TEXT NOT NULL,
      value TEXT NOT NULL,
      user_name TEXT NOT NULL,
      user_avatar TEXT NOT NULL,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS direct_messages (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT UNIQUE NOT NULL,
      requested_ip TEXT,
      user_agent TEXT,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS wiki (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      status TEXT NOT NULL,
      status_color TEXT NOT NULL,
      description TEXT NOT NULL,
      use_case TEXT NOT NULL,
      vulnerabilities TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS apps (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      image TEXT NOT NULL,
      md5 TEXT NOT NULL,
      sha1 TEXT NOT NULL,
      sha256 TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS visitor_events (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      event_type TEXT NOT NULL,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      username TEXT,
      authenticated BOOLEAN NOT NULL DEFAULT false,
      ip TEXT NOT NULL,
      method TEXT,
      path TEXT,
      status_code INTEGER,
      user_agent TEXT,
      browser_name TEXT,
      os_name TEXT,
      device_type TEXT,
      accept_language TEXT,
      browser_language TEXT,
      platform TEXT,
      screen TEXT,
      viewport TEXT,
      timezone TEXT,
      browser_timezone TEXT,
      connection_type TEXT,
      referrer TEXT,
      origin TEXT,
      cf_country TEXT,
      cf_region TEXT,
      cf_city TEXT,
      cf_timezone TEXT,
      browser_data JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages (timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON activities (timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_direct_messages_pair ON direct_messages (sender_id, receiver_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets (user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_password_resets_expires ON password_resets (expires_at);
    CREATE INDEX IF NOT EXISTS idx_visitor_events_created_at ON visitor_events (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_visitor_events_user ON visitor_events (user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_visitor_events_ip ON visitor_events (ip, created_at DESC);
  `);

  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date DATE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_users_locked_until ON users (locked_until);
    DO $$
    BEGIN
      BEGIN
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users (lower(username));
      EXCEPTION WHEN unique_violation THEN
        RAISE WARNING 'Skipping idx_users_username_lower because duplicate usernames already exist';
      END;

      BEGIN
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (lower(email)) WHERE email IS NOT NULL;
      EXCEPTION WHEN unique_violation THEN
        RAISE WARNING 'Skipping idx_users_email_lower because duplicate emails already exist';
      END;
    END
    $$;
  `);

  await seedDefaultData();
  await purgeUnsafePersistedRows();
}

async function seedDefaultData() {
  const initialApps = [
    {
      key: "putty",
      name: "putty.exe",
      description: "Emulador de terminal y cliente SSH para Windows.",
      image: "https://images-eds-ssl.xboxlive.com/image?url=4rt9.lXDC4H_93laV1_eHHFT949fUipzkiFOBH3fAiZZUCdYojwUyX2aTonS1aIwMrx6NUIsHfUHSLzjGJFxxrDCrF4C8KvxYUkHBppqZebLObdfSSbqzWqRS3lDi.Ystyxw4_k2Pjh.pceYORwgAJzEZ0VJ3Hwwbhe5wvCwruY-&format=source&h=115",
      md5: "36e31f610eef3223154e6e8fd074190f",
      sha1: "1f2800382cd71163c10e5ce0a32b60297489fbb5",
      sha256: "16cbe40fb24ce2d422afddb5a90a5801ced32ef52c22c2fc77b25a90837f28ad",
    },
    {
      key: "plink",
      name: "plink.exe",
      description: "Interfaz de linea de comandos para conexiones SSH automatizadas.",
      image: "https://images-eds-ssl.xboxlive.com/image?url=4rt9.lXDC4H_93laV1_eHHFT949fUipzkiFOBH3fAiZZUCdYojwUyX2aTonS1aIwMrx6NUIsHfUHSLzjGJFxxrDCrF4C8KvxYUkHBppqZebLObdfSSbqzWqRS3lDi.Ystyxw4_k2Pjh.pceYORwgAJzEZ0VJ3Hwwbhe5wvCwruY-&format=source&h=115",
      md5: "269ce7b3a3fcdf735cd8a37c04abfdae",
      sha1: "46ddfbbb5b4193279b9e024a5d013f5d825fcdf5",
      sha256: "50479953865b30775056441b10fdcb984126ba4f98af4f64756902a807b453e7",
    },
    {
      key: "virtualbox",
      name: "VirtualBox-7.0.8-156879-Win.exe",
      description: "Software de virtualizacion para ejecutar varios sistemas operativos.",
      image: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/VirtualBox_2024_Logo.svg/1280px-VirtualBox_2024_Logo.svg.png",
      md5: "5277068968032af616e7e4cc86f1d3c2",
      sha1: "6e3e2912d2131bb249f416088ee49088ab841580",
      sha256: "8a2da26ca69c1ddfc50fb65ee4fa8f269e692302046df4e2f48948775ba6339a",
    },
  ];

  for (const item of initialApps) {
    await pool.query(
      `INSERT INTO apps (key, name, description, image, md5, sha1, sha256)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (key) DO NOTHING`,
      [item.key, item.name, item.description, item.image, item.md5, item.sha1, item.sha256],
    );
  }

  const defaultWiki = [
    {
      name: "MD5",
      fullName: "Message Digest Algorithm 5",
      status: "Inseguro",
      statusColor: "#ef4444",
      description: "Disenado por Ronald Rivest en 1991. Produce un hash de 128 bits.",
      useCase: "Verificacion de integridad de archivos no criticos y sistemas heredados.",
      vulnerabilities: "Vulnerable a ataques de colision. No debe usarse para seguridad moderna.",
    },
    {
      name: "SHA-1",
      fullName: "Secure Hash Algorithm 1",
      status: "Obsoleto",
      statusColor: "#f97316",
      description: "Publicado en 1995. Produce un hash de 160 bits.",
      useCase: "Sistemas heredados y compatibilidad con herramientas antiguas.",
      vulnerabilities: "Colisiones practicas demostradas. Debe migrarse a SHA-2 o superior.",
    },
    {
      name: "SHA-256",
      fullName: "Secure Hash Algorithm 2 (256 bits)",
      status: "Seguro",
      statusColor: "#10b981",
      description: "Parte de la familia SHA-2. Produce un hash de 256 bits.",
      useCase: "Firmas digitales, integridad de archivos y sistemas modernos.",
      vulnerabilities: "No se conocen ataques de colision practicos.",
    },
  ];

  for (const item of defaultWiki) {
    await pool.query(
      `INSERT INTO wiki (name, full_name, status, status_color, description, use_case, vulnerabilities)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (name) DO NOTHING`,
      [item.name, item.fullName, item.status, item.statusColor, item.description, item.useCase, item.vulnerabilities],
    );
  }

  const adminUsernameRaw = (process.env.ADMIN_USERNAME || "").trim();
  const adminUsername = adminUsernameRaw ? normalizeUsername(adminUsernameRaw) : "";
  const adminEmail = normalizeOptionalEmail(process.env.ADMIN_EMAIL || "");
  const adminPin = process.env.ADMIN_PIN || "";

  if (adminUsername || adminEmail || adminPin) {
    if (!adminUsername || !NEW_PIN_RE.test(adminPin)) {
      console.warn("[DB] ADMIN_USERNAME and ADMIN_PIN must be valid. ADMIN_PIN must have 6 to 8 digits.");
      return;
    }
    await pool.query(
      `INSERT INTO users (username, email, first_name, last_name, pin, avatar_seed, role, rank, terms_accepted_at)
       VALUES ($1, $2, 'System', 'Administrator', $3, $4, 'admin', 'System Administrator', now())
       ON CONFLICT (username) DO UPDATE
       SET email = EXCLUDED.email,
           first_name = COALESCE(users.first_name, EXCLUDED.first_name),
           last_name = COALESCE(users.last_name, EXCLUDED.last_name),
           pin = EXCLUDED.pin,
           role = 'admin',
           rank = 'System Administrator',
           avatar_seed = EXCLUDED.avatar_seed,
           terms_accepted_at = COALESCE(users.terms_accepted_at, EXCLUDED.terms_accepted_at),
           failed_login_count = 0,
           locked_until = NULL,
           updated_at = now()`,
      [adminUsername, adminEmail, hashPin(adminPin), adminUsername],
    );
    console.log("[DB] Administrator user provisioned from environment.");
  }
}

async function purgeUnsafePersistedRows() {
  const wikiRows = await pool.query("SELECT id, name, full_name, status, status_color, description, use_case, vulnerabilities FROM wiki");
  for (const row of wikiRows.rows) {
    const unsafe = [
      row.name,
      row.full_name,
      row.status,
      row.description,
      row.use_case,
      row.vulnerabilities,
    ].some(isUnsafeStoredText) || !HEX_COLOR_RE.test(row.status_color);
    if (unsafe) await pool.query("DELETE FROM wiki WHERE id = $1", [row.id]);
  }

  const appRows = await pool.query("SELECT id, key, name, description, image, md5, sha1, sha256 FROM apps");
  for (const row of appRows.rows) {
    const unsafe = [row.key, row.name, row.description].some(isUnsafeStoredText)
      || !HASH_RE.test(row.md5)
      || !HASH_RE.test(row.sha1)
      || !HASH_RE.test(row.sha256)
      || (() => {
        try {
          const parsed = new URL(row.image);
          return parsed.protocol !== "https:";
        } catch {
          return true;
        }
      })();
    if (unsafe) await pool.query("DELETE FROM apps WHERE id = $1", [row.id]);
  }
}

function wikiSelectSql() {
  return `SELECT id, name, full_name AS "fullName", status, status_color AS "statusColor",
                 description, use_case AS "useCase", vulnerabilities
          FROM wiki`;
}

function mapRows<T extends QueryResultRow>(result: { rows: T[] }) {
  return result.rows;
}

function shouldTrackRequest(req: Request): boolean {
  const pathName = safeRequestPath(req);
  if (pathName.startsWith("/socket.io")) return false;
  if (pathName.startsWith("/assets/") || pathName.startsWith("/logo.png") || pathName.startsWith("/favicon")) return false;
  if (pathName === "/api/telemetry/visit" || pathName.startsWith("/api/admin/traffic")) return false;
  if (pathName === "/robots.txt" || pathName === "/sitemap.xml") return false;
  return req.method === "GET" || req.method === "POST";
}

async function insertVisitorEvent(
  req: Request,
  options: {
    eventType: string;
    user?: PublicUser | null;
    statusCode?: number | null;
    path?: unknown;
    browser?: BrowserTelemetry;
  },
): Promise<VisitorEventRow> {
  const userAgent = getHeaderText(req, "user-agent", 600);
  const parsedAgent = parseUserAgent(userAgent);
  const ip = getClientIp(req);
  const browser = options.browser || {};
  const country = getHeaderText(req, "cf-ipcountry", 80);
  const region = getHeaderText(req, "cf-region", 120) || getHeaderText(req, "cf-region-code", 120);
  const city = getHeaderText(req, "cf-ipcity", 120);
  const cfTimezone = getHeaderText(req, "cf-timezone", 120);
  const result = await pool.query<VisitorEventRow>(
    `INSERT INTO visitor_events (
       event_type, user_id, username, authenticated, ip, method, path, status_code,
       user_agent, browser_name, os_name, device_type, accept_language,
       browser_language, platform, screen, viewport, timezone, browser_timezone,
       connection_type, referrer, origin, cf_country, cf_region, cf_city,
       cf_timezone, browser_data
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8,
       $9, $10, $11, $12, $13,
       $14, $15, $16, $17, $18, $19,
       $20, $21, $22, $23, $24, $25,
       $26, $27
     )
     RETURNING *`,
    [
      options.eventType,
      options.user?.id || null,
      options.user?.username || null,
      Boolean(options.user),
      ip,
      req.method,
      safeRequestPath(req, options.path),
      options.statusCode || null,
      userAgent,
      parsedAgent.browserName,
      parsedAgent.osName,
      parsedAgent.deviceType,
      getHeaderText(req, "accept-language", 300),
      browser.browser_language || null,
      browser.platform || null,
      browser.screen || null,
      browser.viewport || null,
      cfTimezone || (isPrivateIp(ip) ? "LAN/Privada" : null),
      browser.browser_timezone || null,
      browser.connection_type || null,
      getHeaderText(req, "referer", 600),
      getHeaderText(req, "origin", 300),
      country || (isPrivateIp(ip) ? "LAN" : null),
      region,
      city,
      cfTimezone,
      browser.browser_data || null,
    ],
  );
  return result.rows[0];
}

async function pruneVisitorEvents() {
  if (!Number.isFinite(VISITOR_EVENT_RETENTION_DAYS) || VISITOR_EVENT_RETENTION_DAYS < 1) return;
  await pool.query(
    "DELETE FROM visitor_events WHERE created_at < now() - ($1 || ' days')::interval",
    [Math.min(365, VISITOR_EVENT_RETENTION_DAYS)],
  );
}

async function startServer() {
  await waitForDatabase();
  await initializeDatabase();
  await pruneVisitorEvents();

  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    transports: ["websocket"],
    cors: {
      credentials: true,
      origin(origin, callback) {
        if (isAllowedOrigin(origin)) return callback(null, true);
        return callback(new Error("Origin not allowed"), false);
      },
    },
  });
  const onlineUsers = new Map<string, PublicUser>();

  configureSecurity(app);
  app.use(express.json({ limit: "100kb" }));

  app.use((req, res, next) => {
    if (!shouldTrackRequest(req)) return next();
    res.on("finish", () => {
      void (async () => {
        const user = await getSessionUserFromCookie(req.headers.cookie).catch(() => null);
        const row = await insertVisitorEvent(req, {
          eventType: req.path.startsWith("/api/") ? "api" : "page",
          user,
          statusCode: res.statusCode,
        });
        io.to("admins").emit("visitor_event", row);
      })().catch((error) => {
        console.error("[TELEMETRY] Request tracking failed:", error);
      });
    });
    return next();
  });

  app.get("/api/health", asyncRoute(async (_req, res) => {
    await pool.query("SELECT 1");
    res.json({ ok: true, database: "postgresql" });
  }));

  app.post("/api/telemetry/visit", asyncRoute(async (req, res) => {
    const body = asObject(req.body);
    const user = await getSessionUserFromCookie(req.headers.cookie).catch(() => null);
    const row = await insertVisitorEvent(req, {
      eventType: "browser",
      user,
      statusCode: 204,
      path: body.path,
      browser: normalizeBrowserTelemetry(body),
    });
    io.to("admins").emit("visitor_event", row);
    res.status(204).send();
  }));

  app.get("/robots.txt", (_req, res) => {
    res.type("text/plain").send("User-agent: *\nDisallow:\n");
  });

  app.get("/sitemap.xml", (_req, res) => {
    const appUrl = getPublicAppUrl();
    res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${appUrl}/</loc></url></urlset>`);
  });

  app.get("/api/session", asyncRoute(async (req, res) => {
    const user = await getSessionUserFromCookie(req.headers.cookie);
    res.json({ authenticated: Boolean(user), user });
  }));

  app.post("/api/auth/logout", asyncRoute(async (_req, res) => {
    clearSessionCookie(res);
    res.json({ success: true });
  }));

  app.post("/api/auth/forgot-password", asyncRoute(async (req, res) => {
    const body = asObject(req.body);
    const identifier = normalizeString(body.identifier, "usuario o correo", 254);
    const genericMessage = "Si la cuenta existe y tiene correo, recibiras un enlace para restablecer el PIN.";
    enforceRateLimit(`forgot:${getClientIp(req)}:${identifier.toLowerCase()}`, PASSWORD_RESET_RATE_LIMIT, AUTH_RATE_WINDOW_MS);

    await pool.query("DELETE FROM password_resets WHERE expires_at < now() - interval '1 day' OR used_at < now() - interval '1 day'");

    const userResult = await pool.query<{ id: number; username: string; email: string | null }>(
      `SELECT id, username, email
       FROM users
       WHERE lower(username) = lower($1) OR email = lower($1)
       ORDER BY id ASC
       LIMIT 1`,
      [identifier],
    );
    const user = userResult.rows[0];

    if (user?.email) {
      await pool.query(
        `UPDATE password_resets
         SET used_at = now()
         WHERE user_id = $1 AND used_at IS NULL`,
        [user.id],
      );

      const token = randomBytes(32).toString("base64url");
      const tokenHash = hashResetToken(token);
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);
      await pool.query(
        `INSERT INTO password_resets (user_id, token_hash, requested_ip, user_agent, expires_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, tokenHash, req.ip, req.get("user-agent")?.slice(0, 300) || null, expiresAt],
      );

      const resetUrl = new URL("/", getPublicAppUrl());
      resetUrl.searchParams.set("reset_token", token);
      void sendPasswordResetEmail(user.email, user.username, resetUrl.toString()).catch((error) => {
        console.error("[MAIL] Password reset email failed:", error);
      });
    }

    await delay(250);
    res.json({ success: true, message: genericMessage });
  }));

  app.post("/api/auth/reset-password", asyncRoute(async (req, res) => {
    const body = asObject(req.body);
    enforceRateLimit(`reset:${getClientIp(req)}`, PASSWORD_RESET_RATE_LIMIT, AUTH_RATE_WINDOW_MS);
    const token = normalizeResetToken(body.token);
    const pin = normalizeNewPin(body.pin);
    const tokenHash = hashResetToken(token);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const resetResult = await client.query<{ id: number; user_id: number; expires_at: Date; used_at: Date | null }>(
        `SELECT id, user_id, expires_at, used_at
         FROM password_resets
         WHERE token_hash = $1
         FOR UPDATE`,
        [tokenHash],
      );
      const reset = resetResult.rows[0];
      if (!reset || reset.used_at || new Date(reset.expires_at).getTime() < Date.now()) {
        throw httpError(400, "El enlace de recuperacion no es valido o expiro");
      }

      await client.query("UPDATE users SET pin = $1 WHERE id = $2", [hashPin(pin), reset.user_id]);
      await client.query("UPDATE password_resets SET used_at = now() WHERE id = $1", [reset.id]);
      await client.query(
        `UPDATE password_resets
         SET used_at = COALESCE(used_at, now())
         WHERE user_id = $1 AND id <> $2 AND used_at IS NULL`,
        [reset.user_id, reset.id],
      );
      await client.query("COMMIT");
      clearSessionCookie(res);
      res.json({ success: true, message: "PIN actualizado correctamente. Ya puedes iniciar sesion." });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }));

  app.post("/api/auth/register", asyncRoute(async (req, res) => {
    const body = asObject(req.body);
    const username = normalizeUsername(body.username);
    const pin = normalizeCredentialPin(body.pin);
    const avatarSeed = normalizeString(body.avatarSeed, "avatarSeed", 80, false) || username;
    const configuredAdminUsername = process.env.ADMIN_USERNAME?.trim().toLowerCase();
    enforceRateLimit(`auth:${getClientIp(req)}:${username}`, AUTH_RATE_LIMIT, AUTH_RATE_WINDOW_MS);

    const existing = await pool.query<LoginUserRow>(
      `SELECT id, username, email, first_name, last_name, birth_date, gender,
              terms_accepted_at, pin, avatar_seed, role, points, rank, level, created_at,
              failed_login_count, locked_until
       FROM users
       WHERE lower(username) = lower($1)
       ORDER BY id ASC
       LIMIT 1`,
      [username],
    );

    if (existing.rows[0]) {
      const user = existing.rows[0];
      if (isUserLocked(user)) throw httpError(429, "Cuenta bloqueada temporalmente. Intenta mas tarde.");
      if (!verifyPin(pin, user.pin)) await recordFailedLogin(user);
      if (!user.pin.startsWith("scrypt$")) {
        await pool.query("UPDATE users SET pin = $1 WHERE id = $2", [hashPin(pin), user.id]);
      }
      await pool.query(
        `UPDATE users
         SET failed_login_count = 0,
             locked_until = NULL,
             last_login_at = now(),
             last_login_ip = $1,
             updated_at = now()
         WHERE id = $2`,
        [getClientIp(req), user.id],
      );
      setSessionCookie(req, res, user.id);
      const publicUser = await getPublicUserById(user.id);
      if (publicUser) {
        void insertVisitorEvent(req, {
          eventType: "login",
          user: publicUser,
          statusCode: 200,
          path: "/api/auth/register",
        }).then((row) => io.to("admins").emit("visitor_event", row)).catch((error) => {
          console.error("[TELEMETRY] Login tracking failed:", error);
        });
      }
      return res.json({ success: true, user: publicUser });
    }

    if (configuredAdminUsername && username === configuredAdminUsername) {
      throw httpError(403, "El administrador debe crearse desde variables de entorno");
    }
    normalizeNewPin(pin);

    const email = normalizeOptionalEmail(body.email);
    if (!email) throw httpError(400, "email requerido");
    const firstName = normalizePersonName(body.firstName, "firstName");
    const lastName = normalizePersonName(body.lastName, "lastName");
    const birthDate = normalizeBirthDate(body.birthDate);
    const gender = normalizeGender(body.gender);
    normalizeTermsAccepted(body.termsAccepted);

    const created = await pool.query<PublicUser>(
      `INSERT INTO users (username, email, first_name, last_name, birth_date, gender, terms_accepted_at, pin, avatar_seed, role, rank)
       VALUES ($1, $2, $3, $4, $5, $6, now(), $7, $8, 'user', 'Novice')
       RETURNING id, username, email, first_name, last_name, birth_date, gender,
                 terms_accepted_at, avatar_seed, role, points, rank, level, created_at`,
      [username, email, firstName, lastName, birthDate, gender, hashPin(pin), avatarSeed],
    );
    await pool.query(
      "UPDATE users SET last_login_at = now(), last_login_ip = $1, updated_at = now() WHERE id = $2",
      [getClientIp(req), created.rows[0].id],
    );
    setSessionCookie(req, res, created.rows[0].id);
    void insertVisitorEvent(req, {
      eventType: "register",
      user: created.rows[0],
      statusCode: 201,
      path: "/api/auth/register",
    }).then((row) => io.to("admins").emit("visitor_event", row)).catch((error) => {
      console.error("[TELEMETRY] Registration tracking failed:", error);
    });
    res.status(201).json({ success: true, user: created.rows[0] });
  }));

  app.get("/api/wiki", asyncRoute(async (_req, res) => {
    const rows = await pool.query(`${wikiSelectSql()} ORDER BY id ASC`);
    res.json(mapRows(rows));
  }));

  app.post("/api/wiki", asyncRoute(async (req, res) => {
    await requireAdmin(req);
    const item = validateWikiBody(req.body);
    const result = await pool.query<{ id: number }>(
      `INSERT INTO wiki (name, full_name, status, status_color, description, use_case, vulnerabilities)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [item.name, item.fullName, item.status, item.statusColor, item.description, item.useCase, item.vulnerabilities],
    );
    res.status(201).json({ id: result.rows[0].id });
  }));

  app.put("/api/wiki/:id", asyncRoute(async (req, res) => {
    await requireAdmin(req);
    const id = normalizeId(req.params.id);
    const item = validateWikiBody(req.body);
    const result = await pool.query(
      `UPDATE wiki
       SET name = $1, full_name = $2, status = $3, status_color = $4,
           description = $5, use_case = $6, vulnerabilities = $7
       WHERE id = $8`,
      [item.name, item.fullName, item.status, item.statusColor, item.description, item.useCase, item.vulnerabilities, id],
    );
    if (result.rowCount === 0) throw httpError(404, "Wiki no encontrado");
    res.json({ success: true });
  }));

  app.delete("/api/wiki/:id", asyncRoute(async (req, res) => {
    await requireAdmin(req);
    const id = normalizeId(req.params.id);
    const result = await pool.query("DELETE FROM wiki WHERE id = $1", [id]);
    if (result.rowCount === 0) throw httpError(404, "Wiki no encontrado");
    res.json({ success: true });
  }));

  app.get("/api/apps", asyncRoute(async (req, res) => {
    await requireSession(req);
    const apps = await pool.query("SELECT id, key, name, description, image, md5, sha1, sha256 FROM apps ORDER BY id ASC");
    res.json(apps.rows);
  }));

  app.post("/api/apps", asyncRoute(async (req, res) => {
    await requireAdmin(req);
    const item = validateAppBody(req.body);
    await pool.query(
      `INSERT INTO apps (key, name, description, image, md5, sha1, sha256)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [item.key, item.name, item.description, item.image, item.md5, item.sha1, item.sha256],
    );
    res.status(201).json({ success: true });
  }));

  app.put("/api/apps/:id", asyncRoute(async (req, res) => {
    await requireAdmin(req);
    const id = normalizeId(req.params.id);
    const item = validateAppBody(req.body);
    const result = await pool.query(
      `UPDATE apps
       SET key = $1, name = $2, description = $3, image = $4, md5 = $5, sha1 = $6, sha256 = $7
       WHERE id = $8`,
      [item.key, item.name, item.description, item.image, item.md5, item.sha1, item.sha256, id],
    );
    if (result.rowCount === 0) throw httpError(404, "App no encontrada");
    res.json({ success: true });
  }));

  app.delete("/api/apps/:id", asyncRoute(async (req, res) => {
    await requireAdmin(req);
    const id = normalizeId(req.params.id);
    const result = await pool.query("DELETE FROM apps WHERE id = $1", [id]);
    if (result.rowCount === 0) throw httpError(404, "App no encontrada");
    res.json({ success: true });
  }));

  app.get("/api/hashes", asyncRoute(async (req, res) => {
    await requireSession(req);
    const rows = await pool.query<{ hash: string; value: string }>("SELECT hash, value FROM hash_cache");
    const cache = rows.rows.reduce<Record<string, string>>((acc, row) => {
      acc[row.hash] = row.value;
      return acc;
    }, {});
    res.json(cache);
  }));

  app.post("/api/hashes", asyncRoute(async (req, res) => {
    const user = await requireSession(req);
    const body = asObject(req.body);
    const value = normalizeString(body.value, "value", 512);
    const type = normalizeString(body.type || "generate", "type", 20);
    if (!["generate", "decode", "verify", "file"].includes(type)) throw httpError(400, "type invalido");

    const rawHashes = body.hashes && typeof body.hashes === "object"
      ? Object.values(body.hashes as Record<string, unknown>)
      : [body.hash];
    const hashes = rawHashes.map((item) => normalizeHash(item)).filter(Boolean);
    if (hashes.length === 0) throw httpError(400, "hash requerido");

    for (const hash of hashes) {
      await pool.query(
        `INSERT INTO hash_cache (hash, value)
         VALUES ($1, $2)
         ON CONFLICT (hash) DO UPDATE SET value = EXCLUDED.value, created_at = now()`,
        [hash, value],
      );
    }

    const activityHashStr = JSON.stringify(Object.fromEntries(hashes.map((hash, index) => [`h${index + 1}`, hash])));
    const activity = await pool.query(
      `INSERT INTO activities (type, hash, value, user_name, user_avatar)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, type, hash, value, user_name, user_avatar, timestamp`,
      [type, activityHashStr, value, user.username, user.avatar_seed],
    );

    io.emit("new_activity", activity.rows[0]);
    res.json({ success: true });
  }));

  app.get("/api/decode/online/:hash", asyncRoute(async (req, res) => {
    await requireSession(req);
    const hashLower = normalizeHash(req.params.hash);
    const commonHashes: Record<string, string> = {
      "098f6bcd4621d373cade4e832627b4f6": "test",
      "5f4dcc3b5aa765d61d8327deb882cf99": "password",
      "e10adc3949ba59abbe56e057f20f883e": "123456",
      "d033e22ae348aeb5660fc2140aec35850c4da997": "admin",
      "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918": "admin",
    };

    if (commonHashes[hashLower]) {
      return res.json({ found: true, value: commonHashes[hashLower], source: "Local Dictionary" });
    }

    const headers = {
      "User-Agent": "CryptoToolbox/1.0",
    };

    if (hashLower.length === 32) {
      try {
        const response = await fetch(`https://www.nitrxgen.net/md5db/${hashLower}`, { headers });
        const text = await response.text();
        if (text && text.trim().length > 0 && !UNSAFE_TEXT_RE.test(text)) {
          return res.json({ found: true, value: text.trim(), source: "Nitrxgen" });
        }
      } catch {
        // External decoder unavailable.
      }
    }

    if (hashLower.length === 32 || hashLower.length === 40) {
      const type = hashLower.length === 32 ? "md5" : "sha1";
      try {
        const response = await fetch(`https://${type}.gromweb.com/?${type}=${hashLower}`, { headers });
        const html = await response.text();
        const match = html.match(/<em class="long-content string">([^<]+)<\/em>/)
          || html.match(/<input type="text" value="([^"]+)" class="long-content string" readonly>/);
        if (match?.[1] && !UNSAFE_TEXT_RE.test(match[1])) {
          return res.json({ found: true, value: match[1], source: "Gromweb" });
        }
      } catch {
        // External decoder unavailable.
      }
    }

    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    if (geminiKey && geminiKey !== "MY_GEMINI_API_KEY") {
      try {
        const ai = new GoogleGenAI({ apiKey: geminiKey });
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Analiza el siguiente hash: ${hashLower}.
Busca si existe un valor original conocido en bases publicas de hashes.
Si encuentras el valor, responde unicamente con el texto original, sin explicaciones ni formato.
Si no lo encuentras, responde exactamente: NOT_FOUND`,
          config: {
            tools: [{ googleSearch: {} }],
            temperature: 0.1,
          },
        });
        const text = response.text?.trim();
        if (text && text !== "NOT_FOUND" && !/not[_\s-]?found/i.test(text) && text.length <= 100 && !UNSAFE_TEXT_RE.test(text)) {
          return res.json({ found: true, value: text, source: "AI" });
        }
      } catch (error) {
        console.error("[DECODE] AI lookup failed:", error);
      }
    }

    res.json({ found: false });
  }));

  app.get("/api/users", asyncRoute(async (req, res) => {
    await requireSession(req);
    const rows = await pool.query(
      `SELECT id, username, first_name, last_name, avatar_seed, role, points, rank, level, created_at
       FROM users
       ORDER BY username ASC`,
    );
    res.json(rows.rows);
  }));

  app.get("/api/admin/traffic", asyncRoute(async (req, res) => {
    await requireAdmin(req);
    const limitRaw = Number(req.query.limit || 100);
    const limit = Number.isInteger(limitRaw) ? Math.min(300, Math.max(25, limitRaw)) : 100;
    const events = await pool.query<VisitorEventRow>(
      `SELECT *
       FROM visitor_events
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit],
    );
    const summary = await pool.query<{
      total_events: string;
      unique_ips: string;
      authenticated_events: string;
      anonymous_events: string;
      countries: unknown;
      browsers: unknown;
    }>(
      `SELECT
         count(*)::text AS total_events,
         count(DISTINCT ip)::text AS unique_ips,
         count(*) FILTER (WHERE authenticated)::text AS authenticated_events,
         count(*) FILTER (WHERE NOT authenticated)::text AS anonymous_events,
         COALESCE(jsonb_object_agg(country, country_count) FILTER (WHERE country IS NOT NULL), '{}'::jsonb) AS countries,
         COALESCE(jsonb_object_agg(browser, browser_count) FILTER (WHERE browser IS NOT NULL), '{}'::jsonb) AS browsers
       FROM (
         SELECT
           COALESCE(cf_country, CASE WHEN ip LIKE '192.168.%' OR ip LIKE '10.%' THEN 'LAN' END) AS country,
           browser_name AS browser,
           count(*) OVER () AS ignored,
           count(*) OVER (PARTITION BY COALESCE(cf_country, CASE WHEN ip LIKE '192.168.%' OR ip LIKE '10.%' THEN 'LAN' END)) AS country_count,
           count(*) OVER (PARTITION BY browser_name) AS browser_count,
           authenticated,
           ip
         FROM visitor_events
         WHERE created_at > now() - interval '24 hours'
       ) recent`,
    );
    res.json({ events: events.rows, summary: summary.rows[0] || {} });
  }));

  app.post("/api/users/points", asyncRoute(async (req, res) => {
    const user = await requireSession(req);
    const body = asObject(req.body);
    const userId = normalizeId(body.userId, "userId");
    const pointsToAdd = Number(body.pointsToAdd);
    if (user.id !== userId && user.role !== "admin") throw httpError(403, "No autorizado");
    if (!Number.isInteger(pointsToAdd) || pointsToAdd < 1 || pointsToAdd > 25) {
      throw httpError(400, "pointsToAdd invalido");
    }

    const updated = await pool.query<{ points: number; role: string }>(
      `UPDATE users
       SET points = points + $1
       WHERE id = $2
       RETURNING points, role`,
      [pointsToAdd, userId],
    );
    if (updated.rowCount === 0) throw httpError(404, "Usuario no encontrado");

    const newPoints = updated.rows[0].points;
    const level = levelForPoints(newPoints);
    const rank = rankForPoints(newPoints, updated.rows[0].role);
    await pool.query("UPDATE users SET rank = $1, level = $2 WHERE id = $3", [rank, level, userId]);
    res.json({ success: true, points: newPoints, rank, level });
  }));

  app.delete("/api/admin/users/:id", asyncRoute(async (req, res) => {
    const admin = await requireAdmin(req);
    const id = normalizeId(req.params.id);
    if (id === admin.id) throw httpError(400, "No puedes eliminar tu propia cuenta");
    const result = await pool.query("DELETE FROM users WHERE id = $1 AND role <> 'admin'", [id]);
    if (result.rowCount === 0) throw httpError(404, "Usuario no encontrado");
    io.emit("user_deleted", { userId: id });
    res.json({ success: true });
  }));

  app.delete("/api/admin/hashes", asyncRoute(async (req, res) => {
    const admin = await requireAdmin(req);
    await pool.query("DELETE FROM hash_cache");
    await pool.query("DELETE FROM activities");
    await pool.query("DELETE FROM messages");
    await pool.query("DELETE FROM direct_messages");
    await pool.query("DELETE FROM users WHERE id <> $1 AND role <> 'admin'", [admin.id]);
    await pool.query(
      "UPDATE users SET points = 0, rank = 'System Administrator', level = 1 WHERE id = $1",
      [admin.id],
    );
    onlineUsers.clear();
    onlineUsers.set(`admin-${admin.id}`, admin);
    io.emit("database_cleared");
    io.emit("update_online_users", [admin]);
    res.json({ success: true });
  }));

  app.delete("/api/admin/hashes/:hash", asyncRoute(async (req, res) => {
    await requireAdmin(req);
    const hash = normalizeHash(req.params.hash);
    await pool.query("DELETE FROM hash_cache WHERE hash = $1", [hash]);
    res.json({ success: true });
  }));

  app.delete("/api/admin/hash-values", asyncRoute(async (req, res) => {
    await requireAdmin(req);
    const body = asObject(req.body);
    const value = normalizeString(body.value, "value", 512);
    await pool.query("DELETE FROM hash_cache WHERE value = $1", [value]);
    res.json({ success: true });
  }));

  app.delete("/api/admin/activities/:id", asyncRoute(async (req, res) => {
    await requireAdmin(req);
    const id = normalizeId(req.params.id);
    await pool.query("DELETE FROM activities WHERE id = $1", [id]);
    res.json({ success: true });
  }));

  app.get("/api/direct-messages/:userId/:otherId", asyncRoute(async (req, res) => {
    const user = await requireSession(req);
    const userId = normalizeId(req.params.userId, "userId");
    const otherId = normalizeId(req.params.otherId, "otherId");
    if (user.role !== "admin" && user.id !== userId && user.id !== otherId) {
      throw httpError(403, "No autorizado");
    }
    const rows = await pool.query(
      `SELECT dm.*, s.username AS sender_name, s.avatar_seed AS sender_avatar, r.username AS receiver_name
       FROM direct_messages dm
       JOIN users s ON dm.sender_id = s.id
       JOIN users r ON dm.receiver_id = r.id
       WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)
       ORDER BY timestamp ASC`,
      [userId, otherId],
    );
    res.json(rows.rows);
  }));

  app.get("/api/messages", asyncRoute(async (req, res) => {
    await requireSession(req);
    const rows = await pool.query(
      `SELECT m.*, u.points, u.rank, u.level
       FROM messages m
       LEFT JOIN users u ON m.user_id = u.id
       ORDER BY m.timestamp DESC
       LIMIT 50`,
    );
    res.json(rows.rows.reverse());
  }));

  app.get("/api/activities", asyncRoute(async (req, res) => {
    await requireSession(req);
    const rows = await pool.query("SELECT * FROM activities ORDER BY timestamp DESC LIMIT 20");
    res.json(rows.rows);
  }));

  io.use((socket, next) => {
    getSessionUserFromCookie(socket.handshake.headers.cookie)
      .then((user) => {
        if (!user) return next(new Error("Unauthorized"));
        socket.data.user = user;
        return next();
      })
      .catch(next);
  });

  io.on("connection", (socket) => {
    const currentUser = () => socket.data.user as PublicUser;
    if (currentUser().role === "admin") {
      socket.join("admins");
    }

    socket.on("user_online", async () => {
      const user = await getPublicUserById(currentUser().id);
      if (!user) return socket.emit("force_logout");
      socket.data.user = user;
      if (user.role === "admin") socket.join("admins");
      onlineUsers.set(socket.id, user);
      const uniqueUsers = Array.from(new Map(Array.from(onlineUsers.values()).map((item) => [item.id, item])).values());
      io.emit("update_online_users", uniqueUsers);
    });

    socket.on("disconnect", () => {
      onlineUsers.delete(socket.id);
      const uniqueUsers = Array.from(new Map(Array.from(onlineUsers.values()).map((item) => [item.id, item])).values());
      io.emit("update_online_users", uniqueUsers);
    });

    socket.on("typing", () => {
      socket.broadcast.emit("user_typing", currentUser());
    });

    socket.on("stop_typing", () => {
      socket.broadcast.emit("user_stop_typing", currentUser());
    });

    socket.on("send_message", async (msg, callback) => {
      try {
        const content = normalizeString(msg?.content, "content", 1000);
        const user = await getPublicUserById(currentUser().id);
        if (!user) {
          socket.emit("force_logout");
          return callback?.({ status: "error", message: "Usuario no encontrado" });
        }
        const result = await pool.query(
          `INSERT INTO messages (user_id, user_name, user_avatar, user_rank, content)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, user_id, user_name, user_avatar, user_rank, content, is_edited, is_deleted, timestamp`,
          [user.id, user.username, user.avatar_seed, user.rank, content],
        );
        io.emit("new_message", result.rows[0]);
        callback?.({ status: "ok", id: result.rows[0].id });
      } catch (error) {
        callback?.({ status: "error", message: error instanceof Error ? error.message : "Error" });
      }
    });

    socket.on("edit_message", async (data) => {
      try {
        const messageId = normalizeId(data?.messageId, "messageId");
        const newContent = normalizeString(data?.newContent, "newContent", 1000);
        const user = currentUser();
        const message = await pool.query<{ user_id: number }>("SELECT user_id FROM messages WHERE id = $1", [messageId]);
        if (!message.rows[0]) return;
        if (message.rows[0].user_id !== user.id && user.role !== "admin") return;
        await pool.query("UPDATE messages SET content = $1, is_edited = 1 WHERE id = $2", [newContent, messageId]);
        io.emit("message_edited", { messageId, newContent });
      } catch {
        // Invalid socket payload ignored.
      }
    });

    socket.on("delete_message", async (data) => {
      try {
        const messageId = normalizeId(data?.messageId, "messageId");
        const user = currentUser();
        const message = await pool.query<{ user_id: number }>("SELECT user_id FROM messages WHERE id = $1", [messageId]);
        if (!message.rows[0]) return;
        if (message.rows[0].user_id !== user.id && user.role !== "admin") return;
        if (user.role === "admin") {
          await pool.query("DELETE FROM messages WHERE id = $1", [messageId]);
          io.emit("message_deleted_hard", { messageId });
        } else {
          await pool.query("UPDATE messages SET is_deleted = 1, content = 'Mensaje eliminado' WHERE id = $1", [messageId]);
          io.emit("message_deleted", { messageId });
        }
      } catch {
        // Invalid socket payload ignored.
      }
    });

    socket.on("new_activity", async (act) => {
      try {
        const user = currentUser();
        const type = normalizeString(act?.type, "type", 20);
        const hash = normalizeString(act?.hash, "hash", 512);
        const value = normalizeString(act?.value, "value", 512);
        if (!["generate", "decode", "verify", "file"].includes(type)) return;
        const inserted = await pool.query(
          `INSERT INTO activities (type, hash, value, user_name, user_avatar)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, type, hash, value, user_name, user_avatar, timestamp`,
          [type, hash, value, user.username, user.avatar_seed],
        );
        io.emit("new_activity", inserted.rows[0]);
      } catch {
        // Invalid socket payload ignored.
      }
    });

    socket.on("send_dm", async (data) => {
      try {
        const sender = currentUser();
        const receiverId = normalizeId(data?.receiverId, "receiverId");
        const content = normalizeString(data?.content, "content", 1000);
        const receiver = await getPublicUserById(receiverId);
        if (!receiver) return socket.emit("dm_error", { message: "El destinatario ya no existe." });
        const result = await pool.query(
          `INSERT INTO direct_messages (sender_id, receiver_id, content)
           VALUES ($1, $2, $3)
           RETURNING id, sender_id, receiver_id, content, timestamp`,
          [sender.id, receiverId, content],
        );
        const newDM = {
          ...result.rows[0],
          sender_name: sender.username,
          sender_avatar: sender.avatar_seed,
        };
        io.emit(`new_dm_${sender.id}`, newDM);
        io.emit(`new_dm_${receiverId}`, newDM);
        io.emit("new_dm", newDM);
      } catch {
        socket.emit("dm_error", { message: "Mensaje invalido." });
      }
    });
  });

  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith("/api")) return next(err);
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    if ((err as { code?: string })?.code === "23505") {
      return res.status(409).json({ error: "Registro duplicado" });
    }
    console.error("[API]", err);
    return res.status(500).json({ error: "Error interno del servidor" });
  });

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, {
      etag: true,
      index: false,
      maxAge: "1h",
      setHeaders(res) {
        res.setHeader("X-Content-Type-Options", "nosniff");
      },
    }));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`CryptoToolbox listening on port ${PORT} with PostgreSQL`);
  });
}

startServer().catch((error) => {
  console.error("[BOOT] Failed to start CryptoToolbox:", error);
  process.exit(1);
});

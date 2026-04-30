import "dotenv/config";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { createServer } from "http";
import { Pool } from "pg";
import type { QueryResultRow } from "pg";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProduction = process.env.NODE_ENV === "production";
const PORT = Number(process.env.PORT || 3000);
const SESSION_COOKIE = "ct_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const HASH_RE = /^(?:[a-f0-9]{32}|[a-f0-9]{40}|[a-f0-9]{64})$/i;
const USERNAME_RE = /^[A-Za-z0-9_. -]{3,40}$/;
const PIN_RE = /^\d{4}$/;
const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;
const UNSAFE_TEXT_RE = /(?:<|>|\u0000|javascript:|data:text|file:|(?:^|[\\/])\.\.(?:[\\/]|$)|(?:^|[\\/])etc[\\/]passwd|[a-zA-Z]:[\\/]|WEB-INF[\\/\\]|--\s*$|;\s*(?:drop|select|insert|update|delete)\b)/i;

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
  return username;
}

function normalizePin(value: unknown): string {
  if (typeof value !== "string" || !PIN_RE.test(value)) {
    throw httpError(400, "PIN de 4 digitos requerido");
  }
  return value;
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
    `SELECT id, username, email, avatar_seed, role, points, rank, level, created_at
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
  const configured = [
    process.env.APP_ORIGIN,
    process.env.APP_URL,
    ...(process.env.ALLOWED_ORIGINS || "").split(","),
    `http://localhost:${PORT}`,
    `https://localhost:${PORT}`,
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
        "upgrade-insecure-requests": isProduction ? [] : null,
      },
    },
    hsts: isProduction || process.env.FORCE_HTTPS === "true"
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

    CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages (timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON activities (timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_direct_messages_pair ON direct_messages (sender_id, receiver_id, timestamp);
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

  const adminUsername = (process.env.ADMIN_USERNAME || "").trim();
  const adminEmail = normalizeOptionalEmail(process.env.ADMIN_EMAIL || "");
  const adminPin = process.env.ADMIN_PIN || "";

  if (adminUsername || adminEmail || adminPin) {
    if (!adminUsername || !USERNAME_RE.test(adminUsername) || !PIN_RE.test(adminPin)) {
      console.warn("[DB] ADMIN_USERNAME and ADMIN_PIN must be valid to seed the administrator.");
      return;
    }
    await pool.query(
      `INSERT INTO users (username, email, pin, avatar_seed, role, rank)
       VALUES ($1, $2, $3, $4, 'admin', 'System Administrator')
       ON CONFLICT (username) DO UPDATE
       SET email = EXCLUDED.email,
           pin = EXCLUDED.pin,
           role = 'admin',
           rank = 'System Administrator',
           avatar_seed = EXCLUDED.avatar_seed`,
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

async function startServer() {
  await waitForDatabase();
  await initializeDatabase();

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

  app.get("/api/health", asyncRoute(async (_req, res) => {
    await pool.query("SELECT 1");
    res.json({ ok: true, database: "postgresql" });
  }));

  app.get("/robots.txt", (_req, res) => {
    res.type("text/plain").send("User-agent: *\nDisallow:\n");
  });

  app.get("/sitemap.xml", (_req, res) => {
    const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;
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

  app.post("/api/auth/register", asyncRoute(async (req, res) => {
    const body = asObject(req.body);
    const username = normalizeUsername(body.username);
    const email = normalizeOptionalEmail(body.email);
    const pin = normalizePin(body.pin);
    const avatarSeed = normalizeString(body.avatarSeed, "avatarSeed", 80, false) || username;
    const configuredAdminUsername = process.env.ADMIN_USERNAME?.trim();

    const existing = await pool.query<{ id: number; pin: string } & PublicUser>(
      `SELECT id, username, email, pin, avatar_seed, role, points, rank, level, created_at
       FROM users
       WHERE username = $1`,
      [username],
    );

    if (existing.rows[0]) {
      const user = existing.rows[0];
      if (!verifyPin(pin, user.pin)) throw httpError(401, "PIN incorrecto");
      if (!user.pin.startsWith("scrypt$")) {
        await pool.query("UPDATE users SET pin = $1 WHERE id = $2", [hashPin(pin), user.id]);
      }
      setSessionCookie(req, res, user.id);
      const publicUser = await getPublicUserById(user.id);
      return res.json({ success: true, user: publicUser });
    }

    if (configuredAdminUsername && username === configuredAdminUsername) {
      throw httpError(403, "El administrador debe crearse desde variables de entorno");
    }

    const created = await pool.query<PublicUser>(
      `INSERT INTO users (username, email, pin, avatar_seed, role, rank)
       VALUES ($1, $2, $3, $4, 'user', 'Novice')
       RETURNING id, username, email, avatar_seed, role, points, rank, level, created_at`,
      [username, email, hashPin(pin), avatarSeed],
    );
    setSessionCookie(req, res, created.rows[0].id);
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

  app.get("/api/apps", asyncRoute(async (_req, res) => {
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

    res.json({ found: false });
  }));

  app.get("/api/users", asyncRoute(async (req, res) => {
    await requireSession(req);
    const rows = await pool.query(
      `SELECT id, username, avatar_seed, role, points, rank, level, created_at
       FROM users
       ORDER BY username ASC`,
    );
    res.json(rows.rows);
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

    socket.on("user_online", async () => {
      const user = await getPublicUserById(currentUser().id);
      if (!user) return socket.emit("force_logout");
      socket.data.user = user;
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

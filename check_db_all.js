import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  host: process.env.DATABASE_URL ? undefined : (process.env.DB_HOST || "localhost"),
  port: process.env.DATABASE_URL ? undefined : Number(process.env.DB_PORT || 5432),
  database: process.env.DATABASE_URL ? undefined : (process.env.DB_NAME || "cryptotoolbox"),
  user: process.env.DATABASE_URL ? undefined : (process.env.DB_USER || "postgres"),
  password: process.env.DATABASE_URL ? undefined : (process.env.DB_PASSWORD || "postgres"),
});

try {
  const users = await pool.query(
    "SELECT id, username, email, role, points, rank, level, created_at FROM users ORDER BY id",
  );
  console.log("All users:", JSON.stringify(users.rows, null, 2));
} catch (error) {
  console.error("Error:", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}

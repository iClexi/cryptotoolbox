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
  const columns = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'users'
     ORDER BY ordinal_position`,
  );
  const users = await pool.query("SELECT id, username, email, role, points, rank, level, created_at FROM users ORDER BY id");
  console.log("Users table columns:", columns.rows.map((row) => row.column_name));
  console.log("Users count:", users.rowCount);
  if (users.rows.length > 0) {
    console.log("First user:", users.rows[0]);
  }
} catch (error) {
  console.error("Error:", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}

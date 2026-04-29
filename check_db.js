import Database from "better-sqlite3";
const db = new Database('hashes.db');
try {
  const columns = db.prepare("PRAGMA table_info(users)").all();
  console.log("Users table columns:", columns.map((c) => c.name));
  const users = db.prepare("SELECT * FROM users").all();
  console.log("Users count:", users.length);
  if (users.length > 0) {
    console.log("First user:", users[0]);
  }
} catch (e) {
  console.error("Error:", e);
}

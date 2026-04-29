import Database from "better-sqlite3";
const db = new Database('hashes.db');
try {
  const users = db.prepare("SELECT * FROM users").all();
  console.log("All users:", JSON.stringify(users, null, 2));
} catch (e) {
  console.error("Error:", e);
}

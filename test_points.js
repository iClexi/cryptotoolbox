import Database from "better-sqlite3";
const db = new Database('hashes.db');
try {
  const userId = 2; // MichaelRobles20250845
  const pointsToAdd = 100;
  
  const user = db.prepare("SELECT points, role FROM users WHERE id = ?").get(userId);
  console.log("User before update:", user);

  const newPoints = (user.points || 0) + pointsToAdd;
  const level = Math.floor((1 + Math.sqrt(1 + 8 * newPoints / 50)) / 2);
  let newRank = 'Novice';
  if (user.role === 'admin') {
    newRank = 'System Administrator';
  } else {
    if (newPoints >= 5000) newRank = 'Elite Cipher';
    else if (newPoints >= 2000) newRank = 'Root Admin';
    else if (newPoints >= 1000) newRank = 'Cipher Master';
    else if (newPoints >= 500) newRank = 'Security Analyst';
    else if (newPoints >= 200) newRank = 'Junior Operator';
  }

  db.prepare("UPDATE users SET points = ?, rank = ? WHERE id = ?").run(newPoints, newRank, userId);
  
  const userAfter = db.prepare("SELECT points, rank FROM users WHERE id = ?").get(userId);
  console.log("User after update:", userAfter);
} catch (e) {
  console.error("Error:", e);
}

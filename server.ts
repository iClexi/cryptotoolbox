import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*" }
  });

  const PORT = 3000;

  app.use(express.json());

  // Base de datos SQLite
  const db = new Database('hashes.db');
  db.exec(`
    CREATE TABLE IF NOT EXISTS hash_cache (
      hash TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      email TEXT,
      pin TEXT,
      avatar_seed TEXT,
      role TEXT DEFAULT 'user',
      points INTEGER DEFAULT 0,
      rank TEXT DEFAULT 'Novice',
      level INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_name TEXT,
      user_avatar TEXT,
      user_rank TEXT,
      content TEXT,
      is_edited INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT,
      hash TEXT,
      value TEXT,
      user_name TEXT,
      user_avatar TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS direct_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER,
      receiver_id INTEGER,
      content TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS wiki (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      fullName TEXT,
      status TEXT,
      statusColor TEXT,
      description TEXT,
      useCase TEXT,
      vulnerabilities TEXT
    );
    CREATE TABLE IF NOT EXISTS apps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      image TEXT,
      md5 TEXT,
      sha1 TEXT,
      sha256 TEXT
    );
  `);

  // Migraciones: Asegurar que las columnas nuevas existan
  try {
    db.exec("ALTER TABLE messages ADD COLUMN user_rank TEXT;");
    console.log("Columna 'user_rank' añadida a 'messages'");
  } catch (e) {
    // La columna probablemente ya existe
  }

  try {
    db.exec("ALTER TABLE messages ADD COLUMN is_edited INTEGER DEFAULT 0;");
    db.exec("ALTER TABLE messages ADD COLUMN is_deleted INTEGER DEFAULT 0;");
  } catch (e) {
    // Las columnas probablemente ya existen
  }

  // Migración: Agregar columna 'level' si no existe
  try {
    db.prepare("ALTER TABLE users ADD COLUMN level INTEGER DEFAULT 1").run();
    console.log("[DB] Columna 'level' agregada a la tabla 'users'");
  } catch (e) {
    // La columna ya existe o hubo otro error
  }

  // Initialize apps if empty
  const appsCount = db.prepare("SELECT COUNT(*) as count FROM apps").get() as any;
  if (appsCount.count === 0) {
    const initialApps = [
      {
        key: 'putty',
        name: 'putty.exe',
        description: 'Un emulador de terminal, consola serie y aplicación de transferencia de archivos de red gratuito y de código abierto. Es la herramienta estándar para conexiones SSH en entornos Windows.',
        image: 'https://images-eds-ssl.xboxlive.com/image?url=4rt9.lXDC4H_93laV1_eHHFT949fUipzkiFOBH3fAiZZUCdYojwUyX2aTonS1aIwMrx6NUIsHfUHSLzjGJFxxrDCrF4C8KvxYUkHBppqZebLObdfSSbqzWqRS3lDi.Ystyxw4_k2Pjh.pceYORwgAJzEZ0VJ3Hwwbhe5wvCwruY-&format=source&h=115',
        md5: '36e31f610eef3223154e6e8fd074190f',
        sha1: '1f2800382cd71163c10e5ce0a32b60297489fbb5',
        sha256: '16cbe40fb24ce2d422afddb5a90a5801ced32ef52c22c2fc77b25a90837f28ad',
      },
      {
        key: 'plink',
        name: 'plink.exe',
        description: 'Una interfaz de línea de comandos para los motores de PuTTY. Es una extensión vital para la automatización y el scripting, permitiendo ejecutar comandos remotos de forma segura desde la consola.',
        image: 'https://images-eds-ssl.xboxlive.com/image?url=4rt9.lXDC4H_93laV1_eHHFT949fUipzkiFOBH3fAiZZUCdYojwUyX2aTonS1aIwMrx6NUIsHfUHSLzjGJFxxrDCrF4C8KvxYUkHBppqZebLObdfSSbqzWqRS3lDi.Ystyxw4_k2Pjh.pceYORwgAJzEZ0VJ3Hwwbhe5wvCwruY-&format=source&h=115',
        md5: '269ce7b3a3fcdf735cd8a37c04abfdae',
        sha1: '46ddfbbb5b4193279b9e024a5d013f5d825fcdf5',
        sha256: '50479953865b30775056441b10fdcb984126ba4f98af4f64756902a807b453e7',
      },
      {
        key: 'virtualbox',
        name: 'VirtualBox-7.0.8-156879-Win.exe',
        description: 'Un potente software de virtualización para arquitecturas x86 y AMD64/Intel64. Permite a empresas y usuarios domésticos ejecutar múltiples sistemas operativos invitados simultáneamente.',
        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/VirtualBox_2024_Logo.svg/1280px-VirtualBox_2024_Logo.svg.png',
        md5: '5277068968032af616e7e4cc86f1d3c2',
        sha1: '6e3e2912d2131bb249f416088ee49088ab841580',
        sha256: '8a2da26ca69c1ddfc50fb65ee4fa8f269e692302046df4e2f48948775ba6339a',
      }
    ];
    const insertApp = db.prepare("INSERT INTO apps (key, name, description, image, md5, sha1, sha256) VALUES (?, ?, ?, ?, ?, ?, ?)");
    initialApps.forEach(app => {
      insertApp.run(app.key, app.name, app.description, app.image, app.md5, app.sha1, app.sha256);
    });
  }

  // Asegurar que el administrador principal siempre existe
  const adminSeed = db.prepare("SELECT * FROM users WHERE username = 'MichaelRobles20250845'").get();
  if (!adminSeed) {
    db.prepare("INSERT INTO users (username, avatar_seed, pin, role, rank, email) VALUES (?, ?, ?, ?, ?, ?)")
      .run("MichaelRobles20250845", "MichaelRobles20250845", "2007", "admin", "System Administrator", "michaelroblesfermin@gmail.com");
    console.log("[DB] Administrador principal creado");
  } else {
    // Asegurar que el PIN sea 2007 si el usuario ya existe
    db.prepare("UPDATE users SET pin = '2007', role = 'admin', rank = 'System Administrator' WHERE username = 'MichaelRobles20250845'").run();
  }

  // Initialize wiki with default data if empty
  const wikiCount = db.prepare("SELECT COUNT(*) as count FROM wiki").get() as any;
  if (wikiCount.count === 0) {
    const insertWiki = db.prepare("INSERT INTO wiki (name, fullName, status, statusColor, description, useCase, vulnerabilities) VALUES (?, ?, ?, ?, ?, ?, ?)");
    const defaultWiki = [
      {
        name: 'MD5',
        fullName: 'Message Digest Algorithm 5',
        status: 'Inseguro',
        statusColor: '#ef4444',
        description: 'Diseñado por Ronald Rivest en 1991. Produce un hash de 128 bits.',
        useCase: 'Verificación de integridad de archivos no críticos, sumas de comprobación antiguas.',
        vulnerabilities: 'Vulnerable a ataques de colisión. Se pueden generar dos archivos diferentes con el mismo hash en segundos.'
      },
      {
        name: 'SHA-1',
        fullName: 'Secure Hash Algorithm 1',
        status: 'Obsoleto',
        statusColor: '#f97316',
        description: 'Diseñado por la NSA y publicado en 1995. Produce un hash de 160 bits.',
        useCase: 'Sistemas heredados, Git (para identificar commits, aunque se está migrando).',
        vulnerabilities: 'Teóricamente roto desde 2005. Google demostró una colisión práctica en 2017 (SHAttered).'
      },
      {
        name: 'SHA-256',
        fullName: 'Secure Hash Algorithm 2 (256 bits)',
        status: 'Seguro',
        statusColor: '#10b981',
        description: 'Parte de la familia SHA-2, diseñado por la NSA. Produce un hash de 256 bits.',
        useCase: 'Minería de Bitcoin, SSL/TLS, firmas digitales modernas, seguridad de contraseñas.',
        vulnerabilities: 'No se conocen ataques de colisión prácticos hasta la fecha. Considerado el estándar de la industria.'
      }
    ];
    defaultWiki.forEach(w => insertWiki.run(w.name, w.fullName, w.status, w.statusColor, w.description, w.useCase, w.vulnerabilities));
  }

  try {
    db.exec("ALTER TABLE users ADD COLUMN pin TEXT");
  } catch (e) {
    // La columna ya existe
  }

  try {
    db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'");
  } catch (e) {
    // La columna ya existe
  }

  try {
    db.exec("ALTER TABLE users ADD COLUMN email TEXT");
  } catch (e) {
    // La columna ya existe
  }

  try {
    db.exec("ALTER TABLE users ADD COLUMN points INTEGER DEFAULT 0");
  } catch (e) {
    // La columna ya existe
  }

  try {
    db.exec("ALTER TABLE users ADD COLUMN rank TEXT DEFAULT 'Novice'");
  } catch (e) {
    // La columna ya existe
  }

  try {
    db.exec("ALTER TABLE messages ADD COLUMN is_edited INTEGER DEFAULT 0");
  } catch (e) {
    // La columna ya existe
  }

  try {
    db.exec("ALTER TABLE messages ADD COLUMN is_deleted INTEGER DEFAULT 0");
  } catch (e) {
    // La columna ya existe
  }

  try {
    const columns = db.prepare("PRAGMA table_info(users)").all();
    console.log("Users table columns:", columns.map((c: any) => c.name));
  } catch (e) {
    console.error("Error checking users table info:", e);
  }

  // API para Decodificación Online Gratuita (Sin API Keys)
  app.get("/api/decode/online/:hash", async (req, res) => {
    const { hash } = req.params;
    const hashLower = hash.toLowerCase();
    
    console.log(`[FREE-DECODE] Buscando hash: ${hashLower}`);

    // 0. Diccionario local ultra-rápido para hashes comunes
    const commonHashes: Record<string, string> = {
      "098f6bcd4621d373cade4e832627b4f6": "test",
      "5f4dcc3b5aa765d61d8327deb882cf99": "password",
      "e10adc3949ba59abbe56e057f20f883e": "123456",
      "d033e22ae348aeb5660fc2140aec35850c4da997": "admin",
      "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918": "admin"
    };

    if (commonHashes[hashLower]) {
      console.log(`[FREE-DECODE] Encontrado en diccionario local: ${commonHashes[hashLower]}`);
      return res.json({ found: true, value: commonHashes[hashLower], source: 'Local Dictionary' });
    }

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    };

    // 1. Intentar con Nitrxgen (Solo MD5)
    if (hashLower.length === 32) {
      try {
        console.log(`[FREE-DECODE] Consultando Nitrxgen...`);
        const response = await fetch(`https://www.nitrxgen.net/md5db/${hashLower}`, { headers });
        const text = await response.text();
        if (text && text.trim().length > 0) {
          console.log(`[FREE-DECODE] Encontrado en Nitrxgen: ${text}`);
          return res.json({ found: true, value: text.trim(), source: 'Nitrxgen' });
        }
      } catch (e) {
        console.error("[FREE-DECODE] Error en Nitrxgen:", e);
      }
    }

    // 2. Intentar con Gromweb (MD5 y SHA1)
    if (hashLower.length === 32 || hashLower.length === 40) {
      const type = hashLower.length === 32 ? 'md5' : 'sha1';
      try {
        console.log(`[FREE-DECODE] Consultando Gromweb (${type})...`);
        const response = await fetch(`https://${type}.gromweb.com/?${type}=${hashLower}`, { headers });
        const html = await response.text();
        
        const match = html.match(/<em class="long-content string">([^<]+)<\/em>/) || 
                      html.match(/<input type="text" value="([^"]+)" class="long-content string" readonly>/);
        
        if (match && match[1]) {
          console.log(`[FREE-DECODE] Encontrado en Gromweb: ${match[1]}`);
          return res.json({ found: true, value: match[1], source: 'Gromweb' });
        }
      } catch (e) {
        console.error("[FREE-DECODE] Error en Gromweb:", e);
      }
    }

    // Si no se encuentra en los anteriores
    console.log(`[FREE-DECODE] No se encontró el valor para el hash: ${hashLower}`);
    res.json({ found: false });
  });

  // API para Hashes (Shared Cache)
  app.get("/api/wiki", (req, res) => {
    const wiki = db.prepare("SELECT * FROM wiki").all();
    res.json(wiki);
  });

  app.post("/api/wiki", (req, res) => {
    const { name, fullName, status, statusColor, description, useCase, vulnerabilities, adminId } = req.body;
    const user = db.prepare("SELECT role FROM users WHERE id = ?").get(adminId) as any;
    if (!user || user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });

    const result = db.prepare("INSERT INTO wiki (name, fullName, status, statusColor, description, useCase, vulnerabilities) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(name, fullName, status, statusColor, description, useCase, vulnerabilities);
    res.json({ id: result.lastInsertRowid });
  });

  app.put("/api/wiki/:id", (req, res) => {
    const { id } = req.params;
    const { name, fullName, status, statusColor, description, useCase, vulnerabilities, adminId } = req.body;
    const user = db.prepare("SELECT role FROM users WHERE id = ?").get(adminId) as any;
    if (!user || user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });

    db.prepare("UPDATE wiki SET name = ?, fullName = ?, status = ?, statusColor = ?, description = ?, useCase = ?, vulnerabilities = ? WHERE id = ?")
      .run(name, fullName, status, statusColor, description, useCase, vulnerabilities, id);
    res.json({ success: true });
  });

  app.delete("/api/wiki/:id", (req, res) => {
    const { id } = req.params;
    const adminId = req.headers['x-admin-id'];
    const user = db.prepare("SELECT role FROM users WHERE id = ?").get(adminId) as any;
    if (!user || user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });

    db.prepare("DELETE FROM wiki WHERE id = ?").run(id);
    res.json({ success: true });
  });

  // API para Apps (Verify Hash)
  app.get("/api/apps", (req, res) => {
    const apps = db.prepare("SELECT * FROM apps").all();
    res.json(apps);
  });

  app.post("/api/apps", (req, res) => {
    const { key, name, description, image, md5, sha1, sha256, adminId } = req.body;
    const admin = db.prepare("SELECT role FROM users WHERE id = ?").get(adminId) as any;
    if (admin && admin.role === 'admin') {
      db.prepare("INSERT INTO apps (key, name, description, image, md5, sha1, sha256) VALUES (?, ?, ?, ?, ?, ?, ?)").run(key, name, description, image, md5, sha1, sha256);
      res.json({ success: true });
    } else {
      res.status(403).json({ error: "No autorizado" });
    }
  });

  app.put("/api/apps/:id", (req, res) => {
    const { id } = req.params;
    const { key, name, description, image, md5, sha1, sha256, adminId } = req.body;
    const admin = db.prepare("SELECT role FROM users WHERE id = ?").get(adminId) as any;
    if (admin && admin.role === 'admin') {
      db.prepare("UPDATE apps SET key = ?, name = ?, description = ?, image = ?, md5 = ?, sha1 = ?, sha256 = ? WHERE id = ?").run(key, name, description, image, md5, sha1, sha256, id);
      res.json({ success: true });
    } else {
      res.status(403).json({ error: "No autorizado" });
    }
  });

  app.delete("/api/apps/:id", (req, res) => {
    const { id } = req.params;
    const adminId = req.headers['x-admin-id'];
    const admin = db.prepare("SELECT role FROM users WHERE id = ?").get(adminId) as any;
    if (admin && admin.role === 'admin') {
      db.prepare("DELETE FROM apps WHERE id = ?").run(id);
      res.json({ success: true });
    } else {
      res.status(403).json({ error: "No autorizado" });
    }
  });

  app.get("/api/hashes", (req, res) => {
    try {
      const rows = db.prepare("SELECT hash, value FROM hash_cache").all() as { hash: string, value: string }[];
      const cache = rows.reduce((acc, row) => {
        acc[row.hash] = row.value;
        return acc;
      }, {} as Record<string, string>);
      res.json(cache);
    } catch (error) {
      res.status(500).json({ error: "Error al cargar hashes" });
    }
  });

  app.post("/api/hashes", (req, res) => {
    const { hash, hashes, value, type = 'generate', userName, userAvatar, userId } = req.body;
    const hashObj = hashes || { default: hash };
    
    try {
      // Verificar que el usuario existe si se proporciona un ID
      if (userId) {
        const userExists = db.prepare("SELECT id FROM users WHERE id = ?").get(userId);
        if (!userExists) {
          return res.status(401).json({ error: "Usuario no encontrado" });
        }
      }

      const insertHash = db.prepare("INSERT OR REPLACE INTO hash_cache (hash, value) VALUES (?, ?)");
      Object.values(hashObj).forEach((h: any) => {
        if (h) insertHash.run(h.toLowerCase(), value);
      });
      
      const activityHashStr = JSON.stringify(hashObj);
      const insertActivity = db.prepare("INSERT INTO activities (type, hash, value, user_name, user_avatar) VALUES (?, ?, ?, ?, ?)");
      const result = insertActivity.run(type, activityHashStr, value, userName || 'Anónimo', userAvatar || '👤');
      
      const activity = {
        id: result.lastInsertRowid,
        type,
        hash: activityHashStr,
        value,
        user_name: userName || 'Anónimo',
        user_avatar: userAvatar || '👤',
        timestamp: new Date().toISOString()
      };

      io.emit("new_activity", activity);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Error al guardar hash" });
    }
  });

  // API para Registro/Login
  app.post("/api/auth/register", (req, res) => {
    const { username, avatarSeed, pin, email } = req.body;
    console.log("Intento de registro/login:", { username, email, pin: "****" });
    
    if (!username) return res.status(400).json({ error: "Nombre requerido" });
    if (!pin || pin.length !== 4) return res.status(400).json({ error: "PIN de 4 dígitos requerido" });

    try {
      const existing = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as any;
      if (existing) {
        console.log("Usuario existente encontrado:", existing.username);
        if (existing.pin === pin) {
          return res.json({ success: true, user: existing });
        } else {
          console.log("PIN incorrecto para usuario:", username);
          return res.status(401).json({ error: "PIN incorrecto" });
        }
      }

      console.log("Creando nuevo usuario:", username);
      const role = (username === "MichaelRobles20250845" || email === "michaelroblesfermin@gmail.com") ? "admin" : "user";
      const rank = role === "admin" ? "System Administrator" : "Novice";
      const insert = db.prepare("INSERT INTO users (username, avatar_seed, pin, role, rank, email) VALUES (?, ?, ?, ?, ?, ?)");
      const result = insert.run(username, avatarSeed || 'user', pin, role, rank, email || '');
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid);
      console.log("Usuario creado exitosamente:", username);
      res.json({ success: true, user });
    } catch (err) {
      console.error("Error en /api/auth/register:", err);
      res.status(500).json({ error: "Error en el servidor" });
    }
  });

  // API para Usuarios (para DMs)
  app.get("/api/users", (req, res) => {
    const rows = db.prepare("SELECT id, username, avatar_seed, role, points, rank, level FROM users").all();
    res.json(rows);
  });

  app.post("/api/users/points", (req, res) => {
    const { userId, pointsToAdd } = req.body;
    if (!userId || typeof pointsToAdd !== 'number') {
      console.log('[POINTS] Invalid request data:', req.body);
      return res.status(400).json({ error: "Invalid request data" });
    }

    try {
      console.log(`[POINTS] Attempting to add ${pointsToAdd} points to user ${userId}`);
      // Update points atomically
      const result = db.prepare("UPDATE users SET points = points + ? WHERE id = ?").run(pointsToAdd, userId);
      
      if (result.changes === 0) {
        console.log(`[POINTS] User ${userId} not found`);
        return res.status(404).json({ error: "User not found" });
      }

      // Fetch updated user to calculate rank and level
      const user = db.prepare("SELECT points, role FROM users WHERE id = ?").get(userId) as any;
      if (!user) {
        console.log(`[POINTS] User ${userId} disappeared after update?`);
        return res.status(404).json({ error: "User not found" });
      }

      const newPoints = user.points || 0;
      console.log(`[POINTS] Current points for user ${userId}: ${newPoints}`);
      
      // Level calculation: points = 50 * level * (level - 1)
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

      db.prepare("UPDATE users SET rank = ?, level = ? WHERE id = ?").run(newRank, level, userId);
      console.log(`[POINTS] Updated rank to ${newRank} and level to ${level} for user ${userId}`);
      res.json({ success: true, points: newPoints, rank: newRank, level });
    } catch (err) {
      console.error("[POINTS] Error en /api/users/points:", err);
      res.status(500).json({ error: "Error updating points" });
    }
  });

  // API para Admin - Borrar Usuario
  app.delete("/api/admin/users/:id", (req, res) => {
    const { id } = req.params;
    const adminId = req.headers['x-admin-id'];
    const admin = db.prepare("SELECT role FROM users WHERE id = ?").get(adminId) as any;
    
    if (admin && admin.role === 'admin') {
      db.prepare("DELETE FROM users WHERE id = ?").run(id);
      db.prepare("DELETE FROM messages WHERE user_id = ?").run(id);
      db.prepare("DELETE FROM direct_messages WHERE sender_id = ? OR receiver_id = ?").run(id, id);
      
      // Notificar a todos los sockets que este usuario ha sido eliminado
      io.emit("user_deleted", { userId: Number(id) });
      
      res.json({ success: true });
    } else {
      res.status(403).json({ error: "No autorizado" });
    }
  });

  // API para Admin - Borrar Base de Datos Completa (Hashes, Actividades, Usuarios, Mensajes)
  app.delete("/api/admin/hashes", (req, res) => {
    const adminId = req.headers['x-admin-id'];
    console.log(`[ADMIN] Intento de limpieza de DB por admin ID: ${adminId}`);
    
    if (!adminId) return res.status(400).json({ error: "Admin ID missing" });

    try {
      const admin = db.prepare("SELECT role FROM users WHERE id = ?").get(Number(adminId)) as any;
      
      if (admin && admin.role === 'admin') {
        console.log("[ADMIN] Autorizado. Iniciando limpieza...");
        
        db.prepare("DELETE FROM hash_cache").run();
        db.prepare("DELETE FROM activities").run();
        db.prepare("DELETE FROM messages").run();
        db.prepare("DELETE FROM direct_messages").run();
        
        // Borramos todos los usuarios excepto el administrador actual y el administrador principal
        const deletedUsers = db.prepare("DELETE FROM users WHERE id != ? AND username != 'MichaelRobles20250845'").run(Number(adminId));
        console.log(`[ADMIN] Usuarios eliminados: ${deletedUsers.changes}`);
        
        // Opcionalmente resetear puntos del admin
        db.prepare("UPDATE users SET points = 0, rank = 'System Administrator', level = 1 WHERE id = ?").run(Number(adminId));
        
        // Asegurar que el administrador principal tenga el PIN correcto
        db.prepare("UPDATE users SET pin = '2007', points = 0, rank = 'System Administrator', level = 1 WHERE username = 'MichaelRobles20250845'").run();
        
        // Notificar a todos los clientes que la base de datos ha sido limpiada
        console.log("[ADMIN] Emitiendo database_cleared a todos los sockets");
        io.emit("database_cleared");
        
        // Limpiar usuarios online en el servidor (excepto el admin actual)
        const currentAdminSocketId = Array.from(onlineUsers.entries()).find(([id, user]) => user.id === Number(adminId))?.[0];
        const adminUser = currentAdminSocketId ? onlineUsers.get(currentAdminSocketId) : null;
        
        console.log(`[ADMIN] Limpiando onlineUsers map. Admin socket: ${currentAdminSocketId}`);
        onlineUsers.clear();
        if (currentAdminSocketId && adminUser) {
          onlineUsers.set(currentAdminSocketId, adminUser);
        }
        
        // Emitir la lista actualizada (solo el admin)
        const uniqueUsers = Array.from(new Map(Array.from(onlineUsers.values()).map(u => [u.id, u])).values());
        io.emit("update_online_users", uniqueUsers);
        
        console.log("[ADMIN] Limpieza completada con éxito");
        res.json({ success: true });
      } else {
        console.log("[ADMIN] No autorizado. Rol insuficiente.");
        res.status(403).json({ error: "No autorizado" });
      }
    } catch (error) {
      console.error("[ADMIN] Error al limpiar base de datos:", error);
      res.status(500).json({ error: "Error interno al limpiar base de datos" });
    }
  });

  // API para Admin - Borrar Hash Específico
  app.delete("/api/admin/hashes/:hash", (req, res) => {
    const { hash } = req.params;
    const adminId = req.headers['x-admin-id'];
    const admin = db.prepare("SELECT role FROM users WHERE id = ?").get(adminId) as any;
    
    if (admin && admin.role === 'admin') {
      db.prepare("DELETE FROM hash_cache WHERE hash = ?").run(hash);
      res.json({ success: true });
    } else {
      res.status(403).json({ error: "No autorizado" });
    }
  });

  // API para Admin - Borrar por Valor
  app.delete("/api/admin/hashes/value/:value", (req, res) => {
    const { value } = req.params;
    const adminId = req.headers['x-admin-id'];
    const admin = db.prepare("SELECT role FROM users WHERE id = ?").get(adminId) as any;
    
    if (admin && admin.role === 'admin') {
      db.prepare("DELETE FROM hash_cache WHERE value = ?").run(value);
      res.json({ success: true });
    } else {
      res.status(403).json({ error: "No autorizado" });
    }
  });

  // API para Admin - Borrar Actividad Específica
  app.delete("/api/admin/activities/:id", (req, res) => {
    const { id } = req.params;
    const adminId = req.headers['x-admin-id'];
    const admin = db.prepare("SELECT role FROM users WHERE id = ?").get(adminId) as any;
    
    if (admin && admin.role === 'admin') {
      db.prepare("DELETE FROM activities WHERE id = ?").run(id);
      res.json({ success: true });
    } else {
      res.status(403).json({ error: "No autorizado" });
    }
  });

  // API para Mensajes Directos
  app.get("/api/direct-messages/:userId/:otherId", (req, res) => {
    const { userId, otherId } = req.params;
    const rows = db.prepare(`
      SELECT dm.*, s.username as sender_name, s.avatar_seed as sender_avatar, r.username as receiver_name
      FROM direct_messages dm
      JOIN users s ON dm.sender_id = s.id
      JOIN users r ON dm.receiver_id = r.id
      WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
      ORDER BY timestamp ASC
    `).all(userId, otherId, otherId, userId);
    res.json(rows);
  });

  // API para Mensajes
  app.get("/api/messages", (req, res) => {
    const rows = db.prepare(`
      SELECT m.*, u.points, u.rank, u.level 
      FROM messages m 
      LEFT JOIN users u ON m.user_id = u.id 
      ORDER BY m.timestamp DESC 
      LIMIT 50
    `).all();
    res.json(rows.reverse());
  });

  // API para Actividades
  app.get("/api/activities", (req, res) => {
    const rows = db.prepare("SELECT * FROM activities ORDER BY timestamp DESC LIMIT 20").all();
    res.json(rows);
  });

  // Socket.io para Chat y Actividad en tiempo real
  const onlineUsers = new Map<string, any>();

  io.on("connection", (socket) => {
    socket.on("user_online", (user) => {
      onlineUsers.set(socket.id, user);
      const uniqueUsers = Array.from(new Map(Array.from(onlineUsers.values()).map(u => [u.id, u])).values());
      io.emit("update_online_users", uniqueUsers);
    });

    socket.on("disconnect", () => {
      onlineUsers.delete(socket.id);
      const uniqueUsers = Array.from(new Map(Array.from(onlineUsers.values()).map(u => [u.id, u])).values());
      io.emit("update_online_users", uniqueUsers);
    });

    socket.on("typing", (data) => {
      socket.broadcast.emit("user_typing", data);
    });

    socket.on("stop_typing", (data) => {
      socket.broadcast.emit("user_stop_typing", data);
    });

    socket.on("send_message", (msg, callback) => {
      try {
        console.log("Received send_message:", msg);
        
        // Verificar que el usuario existe antes de permitir el mensaje
        const userExists = db.prepare("SELECT id FROM users WHERE id = ?").get(msg.userId);
        if (!userExists) {
          console.log(`[AUTH] Intento de mensaje de usuario inexistente: ${msg.userId}`);
          if (callback) callback({ status: "error", message: "Usuario no encontrado. Por favor, inicia sesión de nuevo." });
          socket.emit("force_logout");
          return;
        }

        const result = db.prepare("INSERT INTO messages (user_id, user_name, user_avatar, user_rank, content) VALUES (?, ?, ?, ?, ?)")
          .run(msg.userId, msg.userName, msg.userAvatar, msg.userRank, msg.content);
        
        const newMessage = {
          ...msg,
          id: Number(result.lastInsertRowid),
          user_id: msg.userId,
          user_name: msg.userName,
          user_avatar: msg.userAvatar,
          user_rank: msg.userRank,
          is_edited: 0,
          is_deleted: 0,
          timestamp: new Date().toISOString()
        };
        console.log("Broadcasting new_message:", newMessage);
        io.emit("new_message", newMessage);
        
        if (callback) callback({ status: "ok", id: newMessage.id });
      } catch (error) {
        console.error("Error in send_message handler:", error);
        if (callback) callback({ status: "error", message: error instanceof Error ? error.message : String(error) });
      }
    });

    socket.on("edit_message", (data) => {
      const { messageId, userId, newContent } = data;
      const message = db.prepare("SELECT * FROM messages WHERE id = ?").get(Number(messageId)) as any;
      const user = db.prepare("SELECT role FROM users WHERE id = ?").get(userId) as any;
      
      if (message && (message.user_id === userId || (user && user.role === 'admin'))) {
        db.prepare("UPDATE messages SET content = ?, is_edited = 1 WHERE id = ?")
          .run(newContent, Number(messageId));
        io.emit("message_edited", { messageId: Number(messageId), newContent });
      }
    });

    socket.on("delete_message", (data) => {
      const { messageId, userId } = data;
      const message = db.prepare("SELECT * FROM messages WHERE id = ?").get(Number(messageId)) as any;
      const user = db.prepare("SELECT role FROM users WHERE id = ?").get(userId) as any;
      
      if (message && (message.user_id === userId || (user && user.role === 'admin'))) {
        if (user && user.role === 'admin') {
          // Hard delete for admins
          db.prepare("DELETE FROM messages WHERE id = ?").run(Number(messageId));
          io.emit("message_deleted_hard", { messageId: Number(messageId) });
        } else {
          // Soft delete for regular users
          db.prepare("UPDATE messages SET is_deleted = 1, content = 'Mensaje eliminado' WHERE id = ?")
            .run(Number(messageId));
          io.emit("message_deleted", { messageId: Number(messageId) });
        }
      }
    });

    socket.on("new_activity", (act) => {
      db.prepare("INSERT INTO activities (type, hash, value, user_name, user_avatar) VALUES (?, ?, ?, ?, ?)")
        .run(act.type, act.hash, act.value, act.user_name, act.user_avatar);
      io.emit("new_activity", act);
    });

    socket.on("send_dm", (data) => {
      const { senderId, receiverId, content } = data;
      
      // Verificar que ambos usuarios existen
      const senderExists = db.prepare("SELECT id FROM users WHERE id = ?").get(senderId);
      const receiverExists = db.prepare("SELECT id FROM users WHERE id = ?").get(receiverId);
      
      if (!senderExists) {
        socket.emit("force_logout");
        return;
      }
      
      if (!receiverExists) {
        socket.emit("dm_error", { message: "El destinatario ya no existe." });
        return;
      }

      const result = db.prepare("INSERT INTO direct_messages (sender_id, receiver_id, content) VALUES (?, ?, ?)")
        .run(senderId, receiverId, content);
      
      const sender = db.prepare("SELECT username, avatar_seed FROM users WHERE id = ?").get(senderId) as any;
      
      const newDM = {
        id: result.lastInsertRowid,
        sender_id: senderId,
        receiver_id: receiverId,
        content,
        sender_name: sender.username,
        sender_avatar: sender.avatar_seed,
        timestamp: new Date().toISOString()
      };
      
      // Emit to both sender and receiver
      io.emit(`new_dm_${senderId}`, newDM);
      io.emit(`new_dm_${receiverId}`, newDM);
      // Also emit a general new_dm for notifications
      io.emit("new_dm", newDM);
    });
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor CryptoToolbox corriendo en el puerto ${PORT}`);
  });
}

startServer();

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { AsyncLocalStorage } = require('async_hooks');
const demoData = require('./demo_data');

const asyncLocalStorage = new AsyncLocalStorage();

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'redcliffe.sqlite');
const demoDbPath = path.join(dataDir, 'demo.sqlite');

// Check for native better-sqlite3 driver, otherwise use macOS /usr/bin/sqlite3
let nativeDb = null;
let demoNativeDb = null;
let useNative = false;
try {
  const Database = require('better-sqlite3');
  nativeDb = new Database(dbPath);
  nativeDb.pragma('journal_mode = WAL');

  demoNativeDb = new Database(demoDbPath);
  demoNativeDb.pragma('journal_mode = WAL');

  useNative = true;
  console.log('[SQLite DB] Initialized with high-performance native driver (production & demo databases).');
} catch (_) {
  console.log('[SQLite DB] Using built-in macOS SQLite engine (/usr/bin/sqlite3).');
}

function runInContext(store, fn) {
  return asyncLocalStorage.run(store, fn);
}

function isDemoMode(override) {
  if (override === true) return true;
  if (override === false) return false;
  const store = asyncLocalStorage.getStore();
  if (store && store.isDemo) return true;
  return false;
}

// Low-level SQL execution helper (transparently uses native driver or system sqlite3)
function executeSql(sql, overrideDemo) {
  const demo = isDemoMode(overrideDemo);
  const targetDb = demo ? demoNativeDb : nativeDb;
  const targetPath = demo ? demoDbPath : dbPath;
  if (useNative && targetDb) {
    targetDb.exec(sql);
    return;
  }
  try {
    execFileSync('/usr/bin/sqlite3', [targetPath, sql], { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (err) {
    console.error(`[SQLite CLI Error ${demo ? '(DEMO)' : ''}] Executing SQL:`, err.message);
    throw err;
  }
}

function querySql(sql, overrideDemo) {
  const demo = isDemoMode(overrideDemo);
  const targetDb = demo ? demoNativeDb : nativeDb;
  const targetPath = demo ? demoDbPath : dbPath;
  if (useNative && targetDb) {
    return targetDb.prepare(sql).all();
  }
  try {
    const raw = execFileSync('/usr/bin/sqlite3', [targetPath, '-json', sql], { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    if (!raw || !raw.trim()) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[SQLite CLI Error ${demo ? '(DEMO)' : ''}] Querying SQL:`, err.message);
    return [];
  }
}

function queryOneSql(sql, overrideDemo) {
  const rows = querySql(sql, overrideDemo);
  return rows && rows.length > 0 ? rows[0] : null;
}

// Password hashing helper
function hashPassword(password, salt = 'redcliffe_salt_2026') {
  return crypto.createHmac('sha256', salt).update(password).digest('hex');
}

function escapeSql(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return val;
  if (typeof val === 'boolean') return val ? 1 : 0;
  if (typeof val === 'object') {
    if (val.name) return "'" + String(val.name).replace(/'/g, "''") + "'";
    if (val.value) return "'" + String(val.value).replace(/'/g, "''") + "'";
    if (val.user_name) return "'" + String(val.user_name).replace(/'/g, "''") + "'";
    if (val.first_name || val.last_name) return "'" + `${val.first_name || ''} ${val.last_name || ''}`.trim().replace(/'/g, "''") + "'";
    return "'" + JSON.stringify(val).replace(/'/g, "''") + "'";
  }
  return "'" + String(val).replace(/'/g, "''") + "'";
}

// Initialize tables
function initSchema() {
  executeSql(`
    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      user_name TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      email1 TEXT,
      status TEXT DEFAULT 'Active',
      is_admin INTEGER DEFAULT 1,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      account_type TEXT,
      email1 TEXT,
      website TEXT,
      industry TEXT,
      description TEXT,
      shipping_address_city TEXT,
      shipping_address_state TEXT,
      renewal_date TEXT,
      carrier_tpa TEXT,
      num_employees TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      account_id TEXT,
      account_name TEXT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      role TEXT,
      status TEXT DEFAULT 'Active',
      notes TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      date_start TEXT,
      date_end TEXT,
      status TEXT DEFAULT 'Planned',
      parent_id TEXT,
      parent_type TEXT DEFAULT 'Accounts',
      parent_name TEXT,
      assigned_user_name TEXT,
      assigned_user_id TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      report_module TEXT,
      date_modified TEXT,
      assigned_user_name TEXT
    );

    CREATE TABLE IF NOT EXISTS user_preferences (
      username TEXT PRIMARY KEY,
      data TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS carriers (
      id TEXT PRIMARY KEY,
      carrier TEXT NOT NULL,
      description TEXT,
      clientIdentifier TEXT,
      clients TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS census_records (
      id TEXT PRIMARY KEY,
      carrier TEXT NOT NULL,
      policy_number TEXT,
      certificate_number TEXT,
      employee_name TEXT,
      first_name TEXT,
      last_name TEXT,
      account_id TEXT,
      account_name TEXT,
      status TEXT,
      salary REAL,
      salary_mode TEXT,
      benefits_json TEXT,
      dependents_json TEXT,
      raw_data TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
      token TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      name TEXT,
      created_at TEXT
    );
  `);

  // Ensure users table has description column for Outlook token storage
  try {
    executeSql(`ALTER TABLE users ADD COLUMN description TEXT;`);
  } catch (_) {}

  // Backend mode default (preserve existing setting or default to sqlite)
  try {
    const existingMode = queryOneSql("SELECT value FROM app_config WHERE key = 'backend_mode'");
    if (!existingMode) {
      executeSql(`INSERT INTO app_config (key, value) VALUES ('backend_mode', 'sqlite');`);
      currentBackendMode = 'sqlite';
    } else {
      currentBackendMode = existingMode.value;
    }
  } catch (err) {
    console.warn('[SQLite DB] Note during backend mode init:', err.message);
  }

  // Seed default admin users if users table is empty
  const userCountRow = queryOneSql("SELECT COUNT(*) as count FROM users");
  const count = userCountRow ? Number(userCountRow.count || 0) : 0;
  if (count === 0) {
    const now = new Date().toISOString();
    const pfdevPass = process.env.SPICE_PASSWORD || 'P5$Tz3R!mQ8V';
    const pfdevUser = process.env.SPICE_USERNAME || 'pfdev';

    executeSql(`
      INSERT INTO users (id, user_name, password_hash, first_name, last_name, email1, status, is_admin, created_at, updated_at)
      VALUES 
      ('usr-pfdev-1', ${escapeSql(pfdevUser)}, ${escapeSql(hashPassword(pfdevPass))}, 'Richard', 'Craven', 'rcraven@redcliffe.ca', 'Active', 1, ${escapeSql(now)}, ${escapeSql(now)}),
      ('usr-admin-1', 'admin', ${escapeSql(hashPassword('admin123'))}, 'System', 'Administrator', 'admin@redcliffe.ca', 'Active', 1, ${escapeSql(now)}, ${escapeSql(now)});
    `);
    console.log('[SQLite DB] Seeded initial administrator users (pfdev, admin).');
  }

  // Seed reports if empty
  const repCountRow = queryOneSql("SELECT COUNT(*) as count FROM reports");
  const repCount = repCountRow ? Number(repCountRow.count || 0) : 0;
  if (repCount === 0) {
    const now = new Date().toISOString();
    executeSql(`
      INSERT INTO reports (id, name, report_module, date_modified, assigned_user_name)
      VALUES 
      ('rep-1', 'Active Accounts by Industry', 'Accounts', ${escapeSql(now)}, 'Administrator'),
      ('rep-2', 'Upcoming Group Benefits Renewals (90 Days)', 'Accounts', ${escapeSql(now)}, 'Administrator'),
      ('rep-3', 'Quarterly Client Executive Reviews', 'Meetings', ${escapeSql(now)}, 'Administrator');
    `);
  }

  // Clean legacy metadata tags from account descriptions if present
  try {
    const accs = querySql("SELECT id, description FROM accounts WHERE description LIKE '%[%]%'");
    if (accs && accs.length > 0) {
      for (const acc of accs) {
        const cleaned = cleanDescription(acc.description);
        if (cleaned !== acc.description) {
          executeSql(`UPDATE accounts SET description = ${escapeSql(cleaned)} WHERE id = ${escapeSql(acc.id)};`);
        }
      }
      console.log(`[SQLite DB] Cleaned legacy description metadata tags for ${accs.length} account(s).`);
    }
  } catch (err) {
    console.warn('[SQLite DB] Note during account description cleanup:', err.message);
  }

  // Migrate individuals table to contacts table if needed (both prod and demo)
  for (const isDemo of [false, true]) {
    try {
      executeSql(`
        CREATE TABLE IF NOT EXISTS contacts (
          id TEXT PRIMARY KEY,
          account_id TEXT,
          account_name TEXT,
          name TEXT NOT NULL,
          email TEXT,
          phone TEXT,
          role TEXT,
          status TEXT DEFAULT 'Active',
          notes TEXT,
          created_at TEXT,
          updated_at TEXT
        );
      `, isDemo);
      const tableType = queryOneSql("SELECT type FROM sqlite_master WHERE name = 'individuals'", isDemo);
      if (tableType && tableType.type === 'table') {
        executeSql(`INSERT OR IGNORE INTO contacts SELECT * FROM individuals;`, isDemo);
        executeSql(`DROP TABLE individuals;`, isDemo);
        executeSql(`CREATE VIEW IF NOT EXISTS individuals AS SELECT * FROM contacts;`, isDemo);
        executeSql(`
          CREATE TRIGGER IF NOT EXISTS trg_ind_ins INSTEAD OF INSERT ON individuals
          BEGIN
            INSERT OR REPLACE INTO contacts (id, account_id, account_name, name, email, phone, role, status, notes, created_at, updated_at)
            VALUES (new.id, new.account_id, new.account_name, new.name, new.email, new.phone, new.role, new.status, new.notes, new.created_at, new.updated_at);
          END;
        `, isDemo);
        executeSql(`
          CREATE TRIGGER IF NOT EXISTS trg_ind_upd INSTEAD OF UPDATE ON individuals
          BEGIN
            UPDATE contacts SET account_id=new.account_id, account_name=new.account_name, name=new.name, email=new.email, phone=new.phone, role=new.role, status=new.status, notes=new.notes, updated_at=new.updated_at WHERE id=old.id;
          END;
        `, isDemo);
        executeSql(`
          CREATE TRIGGER IF NOT EXISTS trg_ind_del INSTEAD OF DELETE ON individuals
          BEGIN
            DELETE FROM contacts WHERE id=old.id;
          END;
        `, isDemo);
        console.log(`[SQLite DB] Migrated individuals to contacts in ${isDemo ? 'demo' : 'production'} database.`);
      } else {
        executeSql(`CREATE VIEW IF NOT EXISTS individuals AS SELECT * FROM contacts;`, isDemo);
      }
    } catch (err) {
      console.warn(`[SQLite DB] Migration from individuals to contacts ${isDemo ? '(DEMO)' : ''}:`, err.message);
    }

    // Sanitize any existing contacts with geographical regions in phone column
    try {
      executeSql(`
        UPDATE contacts 
        SET phone = '' 
        WHERE phone != '' 
          AND (
            phone LIKE '%,%' 
            OR (
              phone GLOB '*[a-zA-Z]*' 
              AND LOWER(phone) NOT LIKE '%ext%' 
              AND LOWER(phone) NOT LIKE '%x%'
            )
          );
      `, isDemo);
    } catch (err) {
      console.warn(`[SQLite DB] Note during contact phone sanitization cleanup ${isDemo ? '(DEMO)' : ''}:`, err.message);
    }

    // Repair any meeting records with '[object Object]' in assigned_user_name
    try {
      const brokenMeetings = querySql("SELECT id, assigned_user_id FROM meetings WHERE assigned_user_name = '[object Object]' OR assigned_user_name LIKE '%[object%'", isDemo);
      if (brokenMeetings && brokenMeetings.length > 0) {
        for (const bm of brokenMeetings) {
          let fixedName = 'Administrator';
          if (bm.assigned_user_id) {
            const user = queryOneSql(`SELECT first_name, last_name, user_name FROM users WHERE id = ${escapeSql(bm.assigned_user_id)}`, isDemo);
            if (user) {
              const full = `${user.first_name || ''} ${user.last_name || ''}`.trim();
              fixedName = full || user.user_name || 'Administrator';
            }
          }
          executeSql(`UPDATE meetings SET assigned_user_name = ${escapeSql(fixedName)} WHERE id = ${escapeSql(bm.id)}`, isDemo);
        }
        console.log(`[SQLite DB] Repaired ${brokenMeetings.length} meeting organizer name(s) in ${isDemo ? 'demo' : 'production'}.`);
      }
    } catch (err) {
      console.warn(`[SQLite DB] Meeting organizer name repair notice ${isDemo ? '(DEMO)' : ''}:`, err.message);
    }
  }

  // Seed default carriers if empty
  try {
    const carrierCountRow = queryOneSql("SELECT COUNT(*) as count FROM carriers");
    const carrierCount = carrierCountRow ? Number(carrierCountRow.count || 0) : 0;
    if (carrierCount === 0) {
      const now = new Date().toISOString();
      const defaultCarriers = [
        {
          id: 'carrier-groupsource',
          carrier: 'GroupSource',
          description: 'Third-party administrator (TPA) providing customized employee benefit plan management and claims processing.',
          clientIdentifier: 'ledgerId',
          clients: JSON.stringify(['Brentwood College Association DBA Brentwood College School', 'Crofton House School', 'Redcliffe Financial Ltd.', 'Meadowridge School', "Queen Margaret's School (QMS)"])
        },
        {
          id: 'carrier-manulife',
          carrier: 'ManuLife',
          description: 'Canadian insurance carrier providing comprehensive group benefits and retirement solutions.',
          clientIdentifier: 'certificateNumber',
          clients: JSON.stringify(['Mulgrave School', 'Aberdeen Hall Preparatory School'])
        },
        {
          id: 'carrier-canadalife',
          carrier: 'CanadaLife',
          description: 'Leading Canadian life, health, and retirement insurance carrier providing comprehensive group benefit plans.',
          clientIdentifier: 'policyNumber',
          clients: JSON.stringify(['Culture Craze Retail Corp.', 'F.H. Black & Company Incorporated'])
        }
      ];

      for (const c of defaultCarriers) {
        executeSql(`
          INSERT INTO carriers (id, carrier, description, clientIdentifier, clients, created_at, updated_at)
          VALUES (
            ${escapeSql(c.id)},
            ${escapeSql(c.carrier)},
            ${escapeSql(c.description)},
            ${escapeSql(c.clientIdentifier)},
            ${escapeSql(c.clients)},
            ${escapeSql(now)},
            ${escapeSql(now)}
          );
        `);
      }
      console.log('[SQLite DB] Seeded initial carriers (GroupSource, ManuLife, CanadaLife).');
    }

    // Migration/Cleanup: remove placeholder carriers and ensure CanadaLife exists
    executeSql("DELETE FROM carriers WHERE carrier LIKE 'placeholder%' OR id LIKE 'carrier-placeholder%';");
    const hasCanadaLife = queryOneSql("SELECT id FROM carriers WHERE LOWER(carrier) = 'canadalife'");
    const now = new Date().toISOString();
    if (!hasCanadaLife) {
      executeSql(`
        INSERT INTO carriers (id, carrier, description, clientIdentifier, clients, created_at, updated_at)
        VALUES (
          'carrier-canadalife',
          'CanadaLife',
          'Leading Canadian life, health, and retirement insurance carrier providing comprehensive group benefit plans.',
          'policyNumber',
          ${escapeSql(JSON.stringify(['Culture Craze Retail Corp.', 'F.H. Black & Company Incorporated']))},
          ${escapeSql(now)},
          ${escapeSql(now)}
        );
      `);
      console.log('[SQLite DB] Added CanadaLife carrier.');
    }
    // Ensure ManuLife has certificateNumber clientIdentifier
    executeSql(`
      UPDATE carriers SET 
        clientIdentifier = 'certificateNumber',
        clients = ${escapeSql(JSON.stringify(['Mulgrave School', 'Aberdeen Hall Preparatory School']))}
      WHERE LOWER(carrier) = 'manulife';
    `);
  } catch (err) {
    console.warn('[SQLite DB] Note during carrier seeding/migration:', err.message);
  }

  // Seed data from local redcliffe_db.json
  seedFromLocalJson();
}

function seedFromLocalJson() {
  const jsonDbFile = path.join(dataDir, 'redcliffe_db.json');
  if (!fs.existsSync(jsonDbFile)) return;

  try {
    const content = JSON.parse(fs.readFileSync(jsonDbFile, 'utf-8'));
    const now = new Date().toISOString();

    if (Array.isArray(content.individuals)) {
      for (const ind of content.individuals) {
        const id = ind.id || `ind-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
        const exists = queryOneSql(`SELECT id FROM individuals WHERE id = ${escapeSql(id)}`);
        if (!exists) {
          executeSql(`
            INSERT INTO individuals (id, account_id, account_name, name, email, phone, role, status, notes, created_at, updated_at)
            VALUES (
              ${escapeSql(id)},
              ${escapeSql(ind.account_id || null)},
              ${escapeSql(ind.account_name || null)},
              ${escapeSql(ind.name || 'Unnamed Individual')},
              ${escapeSql(ind.email || '')},
              ${escapeSql(ind.phone || '')},
              ${escapeSql(ind.role || 'Plan Administrator')},
              ${escapeSql(ind.status || 'Active')},
              ${escapeSql(ind.notes || '')},
              ${escapeSql(ind.created_at || now)},
              ${escapeSql(ind.updated_at || now)}
            );
          `);
        }
      }
    }

    if (content.account_custom_fields) {
      for (const [accId, fields] of Object.entries(content.account_custom_fields)) {
        const exists = queryOneSql(`SELECT id FROM accounts WHERE id = ${escapeSql(accId)}`);
        if (exists) {
          executeSql(`
            UPDATE accounts SET
              renewal_date = COALESCE(${escapeSql(fields.renewal_date || null)}, renewal_date),
              carrier_tpa = COALESCE(${escapeSql(fields.carrier_tpa || null)}, carrier_tpa),
              num_employees = COALESCE(${escapeSql(fields.num_employees || null)}, num_employees),
              updated_at = ${escapeSql(now)}
            WHERE id = ${escapeSql(accId)};
          `);
        }
      }
    }

    if (content.user_preferences) {
      for (const [user, prefs] of Object.entries(content.user_preferences)) {
        executeSql(`
          INSERT INTO user_preferences (username, data, updated_at)
          VALUES (${escapeSql(user)}, ${escapeSql(JSON.stringify(prefs))}, ${escapeSql(now)})
          ON CONFLICT(username) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at;
        `);
      }
    }
  } catch (err) {
    console.warn('[SQLite DB] Note during JSON seed check:', err.message);
  }

  // Initialize and seed demo database
  try {
    demoData.seedDemoDatabase(
      (sql) => executeSql(sql, true),
      (sql) => queryOneSql(sql, true)
    );
  } catch (demoErr) {
    console.warn('[SQLite DB] Note during demo database seed:', demoErr.message);
  }
}

// ==================== CONFIG & MODE ====================

let currentBackendMode = 'sqlite';

function getBackendMode() {
  if (isDemoMode()) {
    return 'sqlite';
  }
  try {
    const row = queryOneSql("SELECT value FROM app_config WHERE key = 'backend_mode'");
    if (row && row.value) {
      currentBackendMode = row.value === 'spice' ? 'spice' : 'sqlite';
    }
  } catch (e) {
    // keep currentBackendMode
  }
  return currentBackendMode;
}

function setBackendMode(mode) {
  const cleanMode = mode === 'spice' ? 'spice' : 'sqlite';
  currentBackendMode = cleanMode;

  try {
    executeSql(`INSERT OR REPLACE INTO app_config (key, value) VALUES ('backend_mode', '${cleanMode}');`);
  } catch (err) {
    console.warn(`[SQLITE WARNING] Could not persist backend mode to disk: ${err.message}. Running with in-memory mode: ${cleanMode}`);
  }

  return currentBackendMode;
}

// ==================== AUTHENTICATION & USERS ====================

function authenticateUser(username, password) {
  if (!username || !password) return null;
  const clean = username.trim().toLowerCase();

  // Demo user authentication against demo database
  if (clean === 'test' && password === 'test') {
    const demoUser = queryOneSql("SELECT * FROM users WHERE user_name = 'test'", true);
    if (demoUser) {
      return {
        id: demoUser.id,
        user_name: demoUser.user_name,
        first_name: demoUser.first_name,
        last_name: demoUser.last_name,
        email1: demoUser.email1,
        status: demoUser.status,
        is_admin: true,
        isDemo: true
      };
    }
    return {
      id: 'usr-demo-test',
      user_name: 'test',
      first_name: 'Alex',
      last_name: 'Morgan',
      email1: 'test@demofinancial.llc',
      status: 'Active',
      is_admin: true,
      isDemo: true
    };
  }

  const user = queryOneSql(`SELECT * FROM users WHERE LOWER(user_name) = ${escapeSql(clean)} OR LOWER(email1) = ${escapeSql(clean)}`, false);
  if (!user) return null;

  const inputHash = hashPassword(password);
  const plainMd5 = crypto.createHash('md5').update(password).digest('hex');

  if (user.password_hash === inputHash || user.password_hash === plainMd5 || user.password_hash === password) {
    return {
      id: user.id,
      user_name: user.user_name,
      first_name: user.first_name,
      last_name: user.last_name,
      email1: user.email1,
      status: user.status,
      is_admin: user.is_admin === 1 || user.is_admin === '1',
      isDemo: false
    };
  }
  return null;
}

function getAllUsers(limit = 100) {
  const rows = querySql(`SELECT id, user_name, first_name, last_name, email1, status, is_admin, created_at, updated_at FROM users ORDER BY user_name ASC LIMIT ${Number(limit)}`);
  return rows.map(u => ({
    ...u,
    is_admin: u.is_admin === 1 || u.is_admin === '1'
  }));
}

function getUserById(id) {
  const row = queryOneSql(`SELECT * FROM users WHERE id = ${escapeSql(id)}`);
  if (!row) return null;
  return {
    ...row,
    is_admin: row.is_admin === 1 || row.is_admin === '1'
  };
}

function getUserByUsernameOrEmail(identifier) {
  if (!identifier) return null;
  const clean = identifier.trim().toLowerCase();
  return queryOneSql(`SELECT * FROM users WHERE LOWER(user_name) = ${escapeSql(clean)} OR LOWER(email1) = ${escapeSql(clean)}`);
}

function updateUserPassword(id, newPassword) {
  const newHash = hashPassword(newPassword);
  const now = new Date().toISOString();
  executeSql(`UPDATE users SET password_hash = ${escapeSql(newHash)}, updated_at = ${escapeSql(now)} WHERE id = ${escapeSql(id)}`);
  return true;
}

function updateUser(id, updateData) {
  const existing = getUserById(id);
  if (!existing) return null;
  const now = new Date().toISOString();

  const fn = updateData.first_name !== undefined ? escapeSql(updateData.first_name) : 'first_name';
  const ln = updateData.last_name !== undefined ? escapeSql(updateData.last_name) : 'last_name';
  const em = updateData.email1 !== undefined ? escapeSql(updateData.email1) : 'email1';
  const st = updateData.status !== undefined ? escapeSql(updateData.status) : 'status';
  const adm = updateData.is_admin !== undefined ? (updateData.is_admin ? 1 : 0) : 'is_admin';
  const desc = updateData.description !== undefined ? escapeSql(updateData.description) : 'description';

  executeSql(`
    UPDATE users SET
      first_name = ${fn},
      last_name = ${ln},
      email1 = ${em},
      status = ${st},
      is_admin = ${adm},
      description = ${desc},
      updated_at = ${escapeSql(now)}
    WHERE id = ${escapeSql(id)}
  `);

  return getUserById(id);
}

function deleteUser(id) {
  executeSql(`DELETE FROM users WHERE id = ${escapeSql(id)}`);
  return true;
}

// ==================== USER SESSIONS ====================

function saveUserSession(token, sessionUser, forceDemo) {
  if (!token || !sessionUser) return;
  const isDemo = forceDemo !== undefined ? forceDemo : (sessionUser.isDemo || sessionUser.username?.toLowerCase() === 'test');
  executeSql(`
    INSERT OR REPLACE INTO user_sessions (token, username, name, created_at)
    VALUES (${escapeSql(token)}, ${escapeSql(sessionUser.username)}, ${escapeSql(sessionUser.name || sessionUser.username)}, ${escapeSql(new Date().toISOString())});
  `, isDemo);
}

function getUserSession(token) {
  if (!token) return null;
  const prodRow = queryOneSql(`SELECT username, name FROM user_sessions WHERE token = ${escapeSql(token)}`, false);
  if (prodRow) {
    return {
      username: prodRow.username,
      name: prodRow.name,
      isDemo: prodRow.username?.toLowerCase() === 'test'
    };
  }
  const demoRow = queryOneSql(`SELECT username, name FROM user_sessions WHERE token = ${escapeSql(token)}`, true);
  if (demoRow) {
    return {
      username: demoRow.username,
      name: demoRow.name,
      isDemo: true
    };
  }
  return null;
}

function deleteUserSession(token) {
  if (!token) return;
  executeSql(`DELETE FROM user_sessions WHERE token = ${escapeSql(token)}`, false);
  executeSql(`DELETE FROM user_sessions WHERE token = ${escapeSql(token)}`, true);
}

function getAllUserSessions() {
  const prodRows = querySql(`SELECT token, username, name FROM user_sessions`, false) || [];
  const demoRows = querySql(`SELECT token, username, name FROM user_sessions`, true) || [];
  return [
    ...prodRows.map(r => ({ ...r, isDemo: r.username?.toLowerCase() === 'test' })),
    ...demoRows.map(r => ({ ...r, isDemo: true }))
  ];
}

// ==================== ACCOUNTS ====================

function cleanDescription(desc) {
  if (!desc) return '';
  return desc
    .replace(/(?:\s*\|\s*)?\[(Account Type|Renewal Date|Renewal Date - Benefits|Carrier or TPA|Carrier\/TPA)\]:[^|]*/gi, '')
    .replace(/^\s*\|\s*/, '')
    .trim();
}

function buildAccountResponse(acc) {
  if (!acc) return null;
  const contacts = getContactsByAccountId(acc.id);
  const names = contacts.map(i => i.name).filter(Boolean);
  const emails = contacts.map(i => i.email).filter(Boolean);
  const phones = contacts.map(i => i.phone).filter(Boolean);

  return {
    id: acc.id,
    name: acc.name,
    account_type: acc.account_type || '',
    email1: acc.email1 || '',
    website: acc.website || '',
    industry: acc.industry || '',
    description: cleanDescription(acc.description),
    shipping_address_city: acc.shipping_address_city || '',
    shipping_address_state: acc.shipping_address_state || '',
    renewal_date: acc.renewal_date || '',
    carrier_tpa: acc.carrier_tpa || '',
    num_employees: acc.num_employees || '',
    group_benefits: {
      renewal_date: acc.renewal_date || '',
      carrier_tpa: acc.carrier_tpa || '',
      num_employees: acc.num_employees || ''
    },
    plan_admin: {
      names,
      emails,
      phones,
      contacts,
      individuals: contacts
    },
    created_at: acc.created_at,
    updated_at: acc.updated_at
  };
}

function getAllAccounts(limit = 100, search = '') {
  let sql = 'SELECT * FROM accounts';
  if (search && search.trim()) {
    const s = `%${search.trim().toLowerCase()}%`;
    sql += ` WHERE LOWER(name) LIKE ${escapeSql(s)} OR LOWER(email1) LIKE ${escapeSql(s)} OR LOWER(industry) LIKE ${escapeSql(s)}`;
  }
  sql += ` ORDER BY name ASC LIMIT ${Number(limit)}`;
  const rows = querySql(sql);
  return rows.map(buildAccountResponse);
}

function getAccountById(id) {
  const row = queryOneSql(`SELECT * FROM accounts WHERE id = ${escapeSql(id)}`);
  return buildAccountResponse(row);
}

function createAccount(data) {
  const id = data.id || crypto.randomUUID();
  const now = new Date().toISOString();

  const renewalDate = data.renewal_date || (data.group_benefits?.renewal_date || '');
  const carrierTpa = data.carrier_tpa || (data.group_benefits?.carrier_tpa || '');
  const numEmployees = data.num_employees ? String(data.num_employees) : (data.group_benefits?.num_employees ? String(data.group_benefits.num_employees) : '');

  executeSql(`
    INSERT INTO accounts (
      id, name, account_type, email1, website, industry, description,
      shipping_address_city, shipping_address_state,
      renewal_date, carrier_tpa, num_employees, created_at, updated_at
    ) VALUES (
      ${escapeSql(id)},
      ${escapeSql(data.name || 'Unnamed Account')},
      ${escapeSql(data.account_type || '')},
      ${escapeSql(data.email1 || '')},
      ${escapeSql(data.website || '')},
      ${escapeSql(data.industry || '')},
      ${escapeSql(cleanDescription(data.description || ''))},
      ${escapeSql(data.shipping_address_city || '')},
      ${escapeSql(data.shipping_address_state || '')},
      ${escapeSql(renewalDate)},
      ${escapeSql(carrierTpa)},
      ${escapeSql(numEmployees)},
      ${escapeSql(now)},
      ${escapeSql(now)}
    );
  `);

  return getAccountById(id);
}

function updateAccount(id, data) {
  const existing = getAccountById(id);
  if (!existing) return null;
  const now = new Date().toISOString();

  const nm = data.name !== undefined ? escapeSql(data.name) : 'name';
  const tp = data.account_type !== undefined ? escapeSql(data.account_type) : 'account_type';
  const em = data.email1 !== undefined ? escapeSql(data.email1) : 'email1';
  const wb = data.website !== undefined ? escapeSql(data.website) : 'website';
  const ind = data.industry !== undefined ? escapeSql(data.industry) : 'industry';
  const ds = data.description !== undefined ? escapeSql(cleanDescription(data.description)) : 'description';
  const sc = data.shipping_address_city !== undefined ? escapeSql(data.shipping_address_city) : 'shipping_address_city';
  const ss = data.shipping_address_state !== undefined ? escapeSql(data.shipping_address_state) : 'shipping_address_state';

  const rd = data.renewal_date !== undefined ? escapeSql(data.renewal_date) : (data.group_benefits?.renewal_date !== undefined ? escapeSql(data.group_benefits.renewal_date) : 'renewal_date');
  const ct = data.carrier_tpa !== undefined ? escapeSql(data.carrier_tpa) : (data.group_benefits?.carrier_tpa !== undefined ? escapeSql(data.group_benefits.carrier_tpa) : 'carrier_tpa');
  const ne = data.num_employees !== undefined ? escapeSql(String(data.num_employees)) : (data.group_benefits?.num_employees !== undefined ? escapeSql(String(data.group_benefits.num_employees)) : 'num_employees');

  executeSql(`
    UPDATE accounts SET
      name = ${nm},
      account_type = ${tp},
      email1 = ${em},
      website = ${wb},
      industry = ${ind},
      description = ${ds},
      shipping_address_city = ${sc},
      shipping_address_state = ${ss},
      renewal_date = ${rd},
      carrier_tpa = ${ct},
      num_employees = ${ne},
      updated_at = ${escapeSql(now)}
    WHERE id = ${escapeSql(id)}
  `);

  return getAccountById(id);
}

function updateAccountCustomFields(id, customFields) {
  const now = new Date().toISOString();
  const rd = customFields.renewal_date !== undefined ? escapeSql(customFields.renewal_date) : 'renewal_date';
  const ct = customFields.carrier_tpa !== undefined ? escapeSql(customFields.carrier_tpa) : 'carrier_tpa';
  const ne = customFields.num_employees !== undefined ? escapeSql(String(customFields.num_employees)) : 'num_employees';

  executeSql(`
    UPDATE accounts SET
      renewal_date = ${rd},
      carrier_tpa = ${ct},
      num_employees = ${ne},
      updated_at = ${escapeSql(now)}
    WHERE id = ${escapeSql(id)}
  `);

  return getAccountById(id);
}

function deleteAccount(id) {
  executeSql(`DELETE FROM accounts WHERE id = ${escapeSql(id)}`);
  executeSql(`UPDATE contacts SET account_id = NULL, account_name = NULL WHERE account_id = ${escapeSql(id)}`);
  return true;
}

function deleteAllAccounts() {
  executeSql(`DELETE FROM accounts`);
  executeSql(`UPDATE contacts SET account_id = NULL, account_name = NULL`);
  return true;
}

function bulkInsertAccounts(accountsList) {
  const now = new Date().toISOString();
  let count = 0;
  for (const r of accountsList) {
    const id = r.id || crypto.randomUUID();
    executeSql(`
      INSERT INTO accounts (
        id, name, account_type, email1, website, industry, description,
        shipping_address_city, shipping_address_state,
        renewal_date, carrier_tpa, num_employees, created_at, updated_at
      ) VALUES (
        ${escapeSql(id)},
        ${escapeSql(r.name || 'Unnamed Client')},
        ${escapeSql(r.account_type || '')},
        ${escapeSql(r.email1 || '')},
        ${escapeSql(r.website || '')},
        ${escapeSql(r.industry || '')},
        ${escapeSql(cleanDescription(r.description || ''))},
        ${escapeSql(r.shipping_address_city || '')},
        ${escapeSql(r.shipping_address_state || '')},
        ${escapeSql(r.renewal_date || '')},
        ${escapeSql(r.carrier_tpa || '')},
        ${escapeSql(r.num_employees || '')},
        ${escapeSql(now)},
        ${escapeSql(now)}
      )
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        account_type = excluded.account_type,
        email1 = excluded.email1,
        website = excluded.website,
        industry = excluded.industry,
        description = excluded.description,
        shipping_address_city = excluded.shipping_address_city,
        shipping_address_state = excluded.shipping_address_state,
        updated_at = excluded.updated_at;
    `);
    count++;
  }
  return count;
}

// ==================== CONTACTS ====================

function cleanContactRecord(ind) {
  if (!ind) return ind;
  let ph = ind.phone || '';
  if (ph && (ph.includes(',') || /\b(BC|AB|ON|QC|MB|SK|NB|NS|PE|NL|VANCOUVER|VICTORIA|BURNABY)\b/i.test(ph) || (ph.match(/\d/g) || []).length < 7)) {
    ph = '';
  }
  return {
    ...ind,
    phone: ph
  };
}

function getAllContacts(filter = {}) {
  let sql = 'SELECT * FROM contacts WHERE 1=1';
  if (filter.accountId) {
    sql += ` AND account_id = ${escapeSql(filter.accountId)}`;
  }
  if (filter.search && filter.search.trim()) {
    const s = `%${filter.search.trim().toLowerCase()}%`;
    sql += ` AND (LOWER(name) LIKE ${escapeSql(s)} OR LOWER(email) LIKE ${escapeSql(s)} OR LOWER(phone) LIKE ${escapeSql(s)} OR LOWER(account_name) LIKE ${escapeSql(s)} OR LOWER(role) LIKE ${escapeSql(s)})`;
  }
  sql += ' ORDER BY name ASC';
  const rows = querySql(sql) || [];
  return rows.map(cleanContactRecord);
}

function getContactsByAccountId(accountId) {
  if (!accountId) return [];
  const rows = querySql(`SELECT * FROM contacts WHERE account_id = ${escapeSql(accountId)} ORDER BY name ASC`) || [];
  return rows.map(cleanContactRecord);
}

function getContactById(id) {
  const row = queryOneSql(`SELECT * FROM contacts WHERE id = ${escapeSql(id)}`);
  return cleanContactRecord(row);
}

function createContact(data) {
  const id = data.id || `ind-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
  const now = new Date().toISOString();

  let accountName = data.account_name || '';
  if (data.account_id && !accountName) {
    const acc = queryOneSql(`SELECT name FROM accounts WHERE id = ${escapeSql(data.account_id)}`);
    if (acc) accountName = acc.name;
  }

  executeSql(`
    INSERT INTO contacts (id, account_id, account_name, name, email, phone, role, status, notes, created_at, updated_at)
    VALUES (
      ${escapeSql(id)},
      ${escapeSql(data.account_id || null)},
      ${escapeSql(accountName || null)},
      ${escapeSql(data.name)},
      ${escapeSql(data.email || '')},
      ${escapeSql(data.phone || '')},
      ${escapeSql(data.role || 'Plan Administrator')},
      ${escapeSql(data.status || 'Active')},
      ${escapeSql(data.notes || '')},
      ${escapeSql(now)},
      ${escapeSql(now)}
    );
  `);

  return getContactById(id);
}

function updateContact(id, data) {
  const existing = getContactById(id);
  if (!existing) return null;
  const now = new Date().toISOString();

  let accountName = data.account_name !== undefined ? data.account_name : existing.account_name;
  if (data.account_id && data.account_id !== existing.account_id && data.account_name === undefined) {
    const acc = queryOneSql(`SELECT name FROM accounts WHERE id = ${escapeSql(data.account_id)}`);
    accountName = acc ? acc.name : '';
  }

  const aid = data.account_id !== undefined ? escapeSql(data.account_id) : 'account_id';
  const anm = accountName !== undefined ? escapeSql(accountName) : 'account_name';
  const nm = data.name !== undefined ? escapeSql(data.name) : 'name';
  const em = data.email !== undefined ? escapeSql(data.email) : 'email';
  const ph = data.phone !== undefined ? escapeSql(data.phone) : 'phone';
  const rl = data.role !== undefined ? escapeSql(data.role) : 'role';
  const st = data.status !== undefined ? escapeSql(data.status) : 'status';
  const nt = data.notes !== undefined ? escapeSql(data.notes) : 'notes';

  executeSql(`
    UPDATE contacts SET
      account_id = ${aid},
      account_name = ${anm},
      name = ${nm},
      email = ${em},
      phone = ${ph},
      role = ${rl},
      status = ${st},
      notes = ${nt},
      updated_at = ${escapeSql(now)}
    WHERE id = ${escapeSql(id)};
  `);

  return getContactById(id);
}

function deleteContact(id) {
  executeSql(`DELETE FROM contacts WHERE id = ${escapeSql(id)}`);
  return true;
}

// Backward compatibility aliases
const cleanIndividualRecord = cleanContactRecord;
const getAllIndividuals = getAllContacts;
const getIndividualsByAccountId = getContactsByAccountId;
const getIndividualById = getContactById;
const createIndividual = createContact;
const updateIndividual = updateContact;
const deleteIndividual = deleteContact;

// ==================== MEETINGS ====================

function getAllMeetings(limit = 100) {
  return querySql(`SELECT * FROM meetings ORDER BY date_start DESC LIMIT ${Number(limit)}`);
}

function getMeetingById(id) {
  return queryOneSql(`SELECT * FROM meetings WHERE id = ${escapeSql(id)}`);
}

function createMeeting(data) {
  const id = data.id || crypto.randomUUID();
  const now = new Date().toISOString();

  executeSql(`
    INSERT INTO meetings (
      id, name, date_start, date_end, status, parent_id, parent_type, parent_name,
      assigned_user_name, assigned_user_id, created_at, updated_at
    ) VALUES (
      ${escapeSql(id)},
      ${escapeSql(data.name || 'Untitled Meeting')},
      ${escapeSql(data.date_start || now)},
      ${escapeSql(data.date_end || now)},
      ${escapeSql(data.status || 'Planned')},
      ${escapeSql(data.parent_id || null)},
      ${escapeSql(data.parent_type || 'Accounts')},
      ${escapeSql(data.parent_name || null)},
      ${escapeSql(data.assigned_user_name || 'Administrator')},
      ${escapeSql(data.assigned_user_id || null)},
      ${escapeSql(now)},
      ${escapeSql(now)}
    );
  `);

  return getMeetingById(id);
}

function deleteMeeting(id) {
  executeSql(`DELETE FROM meetings WHERE id = ${escapeSql(id)}`);
  return true;
}

// ==================== REPORTS ====================

function getAllReports(limit = 100) {
  return querySql(`SELECT * FROM reports ORDER BY date_modified DESC LIMIT ${Number(limit)}`);
}

function getReportById(id) {
  if (!id) return null;
  return queryOneSql(`SELECT * FROM reports WHERE id = ${escapeSql(id)}`);
}

function deleteReport(id) {
  executeSql(`DELETE FROM reports WHERE id = ${escapeSql(id)}`);
  return true;
}

// ==================== USER PREFERENCES ====================

function getUserPreferences(username) {
  if (!username) return null;
  const row = queryOneSql(`SELECT data FROM user_preferences WHERE username = ${escapeSql(username)}`);
  if (!row || !row.data) return null;
  try {
    return JSON.parse(row.data);
  } catch (_) {
    return null;
  }
}

function saveUserPreferences(username, preferences) {
  if (!username) return null;
  const current = getUserPreferences(username) || {};
  const merged = { ...current, ...preferences };
  const now = new Date().toISOString();

  executeSql(`
    INSERT INTO user_preferences (username, data, updated_at)
    VALUES (${escapeSql(username)}, ${escapeSql(JSON.stringify(merged))}, ${escapeSql(now)})
    ON CONFLICT(username) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at;
  `);

  return merged;
}

// ==================== CARRIERS ====================

function buildCarrierResponse(row) {
  if (!row) return null;
  let clients = [];
  try {
    clients = typeof row.clients === 'string' ? JSON.parse(row.clients) : (row.clients || []);
  } catch (_) {
    clients = row.clients ? row.clients.split(',').map(s => s.trim()).filter(Boolean) : [];
  }
  return {
    id: row.id,
    carrier: row.carrier,
    description: row.description || '',
    clientIdentifier: row.clientIdentifier || row.client_identifier || '',
    clients: Array.isArray(clients) ? clients : [],
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function getAllCarriers(search = '') {
  let sql = 'SELECT * FROM carriers';
  if (search && search.trim()) {
    const s = `%${search.trim().toLowerCase()}%`;
    sql += ` WHERE LOWER(carrier) LIKE ${escapeSql(s)} OR LOWER(description) LIKE ${escapeSql(s)} OR LOWER(clientIdentifier) LIKE ${escapeSql(s)} OR LOWER(clients) LIKE ${escapeSql(s)}`;
  }
  sql += ' ORDER BY carrier ASC';
  const rows = querySql(sql);
  return rows.map(buildCarrierResponse);
}

function getCarrierById(id) {
  const row = queryOneSql(`SELECT * FROM carriers WHERE id = ${escapeSql(id)}`);
  return buildCarrierResponse(row);
}

function createCarrier(data) {
  const id = data.id || `carrier-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
  const now = new Date().toISOString();
  let clientsJson = '[]';
  if (Array.isArray(data.clients)) {
    clientsJson = JSON.stringify(data.clients);
  } else if (typeof data.clients === 'string') {
    if (data.clients.trim().startsWith('[')) {
      clientsJson = data.clients.trim();
    } else {
      clientsJson = JSON.stringify(data.clients.split(',').map(s => s.trim()).filter(Boolean));
    }
  }

  executeSql(`
    INSERT INTO carriers (id, carrier, description, clientIdentifier, clients, created_at, updated_at)
    VALUES (
      ${escapeSql(id)},
      ${escapeSql(data.carrier || 'Unnamed Carrier')},
      ${escapeSql(data.description || '')},
      ${escapeSql(data.clientIdentifier || '')},
      ${escapeSql(clientsJson)},
      ${escapeSql(now)},
      ${escapeSql(now)}
    );
  `);

  return getCarrierById(id);
}

function updateCarrier(id, data) {
  const existing = getCarrierById(id);
  if (!existing) return null;
  const now = new Date().toISOString();

  const cName = data.carrier !== undefined ? escapeSql(data.carrier) : 'carrier';
  const desc = data.description !== undefined ? escapeSql(data.description) : 'description';
  const cIdent = data.clientIdentifier !== undefined ? escapeSql(data.clientIdentifier) : 'clientIdentifier';

  let cClients = 'clients';
  if (data.clients !== undefined) {
    let jsonVal = '[]';
    if (Array.isArray(data.clients)) {
      jsonVal = JSON.stringify(data.clients);
    } else if (typeof data.clients === 'string') {
      if (data.clients.trim().startsWith('[')) {
        jsonVal = data.clients.trim();
      } else {
        jsonVal = JSON.stringify(data.clients.split(',').map(s => s.trim()).filter(Boolean));
      }
    }
    cClients = escapeSql(jsonVal);
  }

  executeSql(`
    UPDATE carriers SET
      carrier = ${cName},
      description = ${desc},
      clientIdentifier = ${cIdent},
      clients = ${cClients},
      updated_at = ${escapeSql(now)}
    WHERE id = ${escapeSql(id)}
  `);

  return getCarrierById(id);
}

function deleteCarrier(id) {
  executeSql(`DELETE FROM carriers WHERE id = ${escapeSql(id)}`);
  return true;
}

// ==================== STATS & SYNC ====================

function getStats() {
  const acc = queryOneSql("SELECT COUNT(*) as count FROM accounts");
  const con = queryOneSql("SELECT COUNT(*) as count FROM contacts");
  const ind = con;
  const mtg = queryOneSql("SELECT COUNT(*) as count FROM meetings");
  const usr = queryOneSql("SELECT COUNT(*) as count FROM users");
  const rep = queryOneSql("SELECT COUNT(*) as count FROM reports");
  const car = queryOneSql("SELECT COUNT(*) as count FROM carriers");
  const cen = queryOneSql("SELECT COUNT(*) as count FROM census_records");

  return {
    database: isDemoMode() ? 'Demo SQLite (Local)' : 'SQLite (Local)',
    driver: useNative ? 'Native (better-sqlite3)' : 'System (/usr/bin/sqlite3)',
    path: isDemoMode() ? demoDbPath : dbPath,
    accounts: acc ? Number(acc.count) : 0,
    contacts: con ? Number(con.count) : 0,
    individuals: ind ? Number(ind.count) : 0,
    meetings: mtg ? Number(mtg.count) : 0,
    users: usr ? Number(usr.count) : 0,
    reports: rep ? Number(rep.count) : 0,
    carriers: car ? Number(car.count) : 0,
    censusRecords: cen ? Number(cen.count) : 0
  };
}

function syncFromSpice({ accounts = [], contacts = [], meetings = [], users = [], reports = [], customFields = {} }) {
  const now = new Date().toISOString();
  let accountsSynced = 0;
  let contactsSynced = 0;
  let meetingsSynced = 0;
  let usersSynced = 0;
  let reportsSynced = 0;

  // 1. Build an account name lookup map from existing SQLite accounts + incoming accounts
  const accMap = new Map();
  try {
    const existingAccs = querySql("SELECT id, name FROM accounts");
    for (const a of existingAccs) {
      if (a.id && a.name) accMap.set(a.id, a.name);
    }
  } catch (_) {}

  for (const acc of accounts) {
    if (acc.id && acc.name) accMap.set(acc.id, acc.name);
  }

  // 2. Sync Accounts (Non-destructive upsert - preserves enriched custom fields & census associations)
  for (const acc of accounts) {
    const custom = customFields[acc.id] || {};
    const renewalDate = acc.renewal_date || acc.renewal_date_insurance || custom.renewal_date || (acc.group_benefits?.renewal_date || '');
    const carrierTpa = acc.carrier_tpa || acc.carrier_or_tpa || custom.carrier_tpa || (acc.group_benefits?.carrier_tpa || '');
    const numEmployees = acc.num_employees || acc.benefits_employee_number || acc.total_active_members || custom.num_employees || (acc.group_benefits?.num_employees || '');
    const city = acc.shipping_address_city || acc.billing_address_city || '';
    const state = acc.shipping_address_state || acc.billing_address_state || '';

    // Check if account already exists by name (case-insensitive) but with a different local ID
    const existingByName = queryOneSql(`SELECT id FROM accounts WHERE LOWER(name) = ${escapeSql((acc.name || '').trim().toLowerCase())}`);
    if (existingByName && existingByName.id !== acc.id) {
      // Re-map any linked contacts, census_records, and meetings to the canonical SpiceCRM ID
      executeSql(`UPDATE contacts SET account_id = ${escapeSql(acc.id)} WHERE account_id = ${escapeSql(existingByName.id)}`);
      executeSql(`UPDATE census_records SET account_id = ${escapeSql(acc.id)} WHERE account_id = ${escapeSql(existingByName.id)}`);
      executeSql(`UPDATE meetings SET parent_id = ${escapeSql(acc.id)} WHERE parent_id = ${escapeSql(existingByName.id)} AND parent_type = 'Accounts'`);
      executeSql(`UPDATE accounts SET id = ${escapeSql(acc.id)} WHERE id = ${escapeSql(existingByName.id)}`);
    }

    executeSql(`
      INSERT INTO accounts (
        id, name, account_type, email1, website, industry, description,
        shipping_address_city, shipping_address_state,
        renewal_date, carrier_tpa, num_employees, created_at, updated_at
      ) VALUES (
        ${escapeSql(acc.id)},
        ${escapeSql(acc.name || 'Unnamed Client')},
        ${escapeSql(acc.account_type || '')},
        ${escapeSql(acc.email1 || '')},
        ${escapeSql(acc.website || '')},
        ${escapeSql(acc.industry || '')},
        ${escapeSql(cleanDescription(acc.description || ''))},
        ${escapeSql(city)},
        ${escapeSql(state)},
        ${escapeSql(renewalDate)},
        ${escapeSql(carrierTpa)},
        ${escapeSql(String(numEmployees || ''))},
        ${escapeSql(acc.date_entered || now)},
        ${escapeSql(now)}
      )
      ON CONFLICT(id) DO UPDATE SET
        name = COALESCE(NULLIF(excluded.name, ''), accounts.name),
        account_type = COALESCE(NULLIF(excluded.account_type, ''), accounts.account_type),
        email1 = COALESCE(NULLIF(excluded.email1, ''), accounts.email1),
        website = COALESCE(NULLIF(excluded.website, ''), accounts.website),
        industry = COALESCE(NULLIF(excluded.industry, ''), accounts.industry),
        description = COALESCE(NULLIF(excluded.description, ''), accounts.description),
        shipping_address_city = COALESCE(NULLIF(excluded.shipping_address_city, ''), accounts.shipping_address_city),
        shipping_address_state = COALESCE(NULLIF(excluded.shipping_address_state, ''), accounts.shipping_address_state),
        renewal_date = COALESCE(NULLIF(excluded.renewal_date, ''), accounts.renewal_date),
        carrier_tpa = COALESCE(NULLIF(excluded.carrier_tpa, ''), accounts.carrier_tpa),
        num_employees = COALESCE(NULLIF(excluded.num_employees, ''), accounts.num_employees),
        updated_at = excluded.updated_at;
    `);
    accountsSynced++;
  }

  // 3. Sync Contacts (Non-destructive upsert - preserves all census plan members)
  for (const c of contacts) {
    const fullName = `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.name || 'Unnamed Contact';
    const accId = c.account_id || null;
    const accName = c.account_name || (accId ? accMap.get(accId) : null) || null;
    
    // Validate phone number: avoid putting city/province or street into phone field
    let cleanPhone = c.phone_work || c.phone_mobile || c.phone_other || '';
    if (cleanPhone && /[a-zA-Z]{3,}/.test(cleanPhone) && !/ext|x/i.test(cleanPhone)) {
      cleanPhone = '';
    }

    const role = c.title || (c.contact_type ? String(c.contact_type).replace(/\^/g, '') : 'Plan Administrator');
    const status = c.status || (c.is_inactive === '1' ? 'Inactive' : 'Active');
    const notes = cleanDescription(c.description || c.additional_notes || '');

    executeSql(`
      INSERT INTO contacts (
        id, account_id, account_name, name, email, phone, role, status, notes, created_at, updated_at
      ) VALUES (
        ${escapeSql(c.id)},
        ${escapeSql(accId)},
        ${escapeSql(accName)},
        ${escapeSql(fullName)},
        ${escapeSql(c.email1 || c.email || '')},
        ${escapeSql(cleanPhone)},
        ${escapeSql(role)},
        ${escapeSql(status)},
        ${escapeSql(notes)},
        ${escapeSql(c.date_entered || now)},
        ${escapeSql(now)}
      )
      ON CONFLICT(id) DO UPDATE SET
        account_id = COALESCE(NULLIF(excluded.account_id, ''), contacts.account_id),
        account_name = COALESCE(NULLIF(excluded.account_name, ''), contacts.account_name),
        name = excluded.name,
        email = COALESCE(NULLIF(excluded.email, ''), contacts.email),
        phone = COALESCE(NULLIF(excluded.phone, ''), contacts.phone),
        role = COALESCE(NULLIF(excluded.role, ''), contacts.role),
        status = excluded.status,
        notes = COALESCE(NULLIF(excluded.notes, ''), contacts.notes),
        updated_at = excluded.updated_at;
    `);
    contactsSynced++;
  }

  // 4. Sync Meetings (Non-destructive upsert)
  for (const m of meetings) {
    let assignedName = m.assigned_user_name;
    if (assignedName && typeof assignedName === 'object') {
      assignedName = assignedName.name || assignedName.value || assignedName.user_name || '';
    }
    if (!assignedName && m.assigned_user_id) {
      const user = queryOneSql(`SELECT first_name, last_name, user_name FROM users WHERE id = ${escapeSql(m.assigned_user_id)}`);
      if (user) {
        const full = `${user.first_name || ''} ${user.last_name || ''}`.trim();
        assignedName = full || user.user_name || 'Administrator';
      }
    }
    if (!assignedName || assignedName === '[object Object]') {
      assignedName = 'Administrator';
    }

    executeSql(`
      INSERT INTO meetings (
        id, name, date_start, date_end, status, parent_id, parent_type, parent_name,
        assigned_user_name, assigned_user_id, created_at, updated_at
      ) VALUES (
        ${escapeSql(m.id)},
        ${escapeSql(m.name || 'Untitled Meeting')},
        ${escapeSql(m.date_start || now)},
        ${escapeSql(m.date_end || now)},
        ${escapeSql(m.status || 'Planned')},
        ${escapeSql(m.parent_id || null)},
        ${escapeSql(m.parent_type || 'Accounts')},
        ${escapeSql(m.parent_name || null)},
        ${escapeSql(assignedName)},
        ${escapeSql(m.assigned_user_id || null)},
        ${escapeSql(m.date_entered || now)},
        ${escapeSql(now)}
      )
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        date_start = excluded.date_start,
        date_end = excluded.date_end,
        status = excluded.status,
        parent_id = COALESCE(excluded.parent_id, meetings.parent_id),
        parent_name = COALESCE(excluded.parent_name, meetings.parent_name),
        assigned_user_name = COALESCE(excluded.assigned_user_name, meetings.assigned_user_name),
        updated_at = excluded.updated_at;
    `);
    meetingsSynced++;
  }

  // 5. Sync Users (Non-destructive upsert, respects user_name uniqueness)
  for (const u of users) {
    const rawUsername = u.user_name || (u.email1 ? u.email1.split('@')[0] : `user_${u.id.substr(0, 6)}`);
    const cleanUsername = rawUsername.trim().toLowerCase();
    const isAdmin = u.is_admin === 1 || u.is_admin === '1' || u.is_dev === 1 || ['pfdev', 'admin', 'rcraven'].includes(cleanUsername);

    const existingUser = queryOneSql(`SELECT id FROM users WHERE LOWER(user_name) = ${escapeSql(cleanUsername)} OR id = ${escapeSql(u.id)}`);
    if (existingUser) {
      executeSql(`
        UPDATE users SET
          first_name = COALESCE(NULLIF(${escapeSql(u.first_name || '')}, ''), first_name),
          last_name = COALESCE(NULLIF(${escapeSql(u.last_name || '')}, ''), last_name),
          email1 = COALESCE(NULLIF(${escapeSql(u.email1 || '')}, ''), email1),
          status = ${escapeSql(u.status || 'Active')},
          is_admin = CASE WHEN ${isAdmin ? 1 : 0} = 1 THEN 1 ELSE is_admin END,
          updated_at = ${escapeSql(now)}
        WHERE id = ${escapeSql(existingUser.id)};
      `);
    } else {
      executeSql(`
        INSERT INTO users (
          id, user_name, password_hash, first_name, last_name, email1, status, is_admin, created_at, updated_at
        ) VALUES (
          ${escapeSql(u.id)},
          ${escapeSql(cleanUsername)},
          ${escapeSql(u.user_hash || hashPassword(process.env.SPICE_PASSWORD || 'P5$Tz3R!mQ8V'))},
          ${escapeSql(u.first_name || '')},
          ${escapeSql(u.last_name || '')},
          ${escapeSql(u.email1 || '')},
          ${escapeSql(u.status || 'Active')},
          ${isAdmin ? 1 : 0},
          ${escapeSql(u.date_entered || now)},
          ${escapeSql(now)}
        );
      `);
    }
    usersSynced++;
  }

  // 6. Sync Reports (Non-destructive upsert)
  for (const r of reports) {
    executeSql(`
      INSERT INTO reports (id, name, report_module, date_modified, assigned_user_name)
      VALUES (
        ${escapeSql(r.id)},
        ${escapeSql(r.name || 'Report')},
        ${escapeSql(r.report_module || 'Accounts')},
        ${escapeSql(r.date_modified || now)},
        ${escapeSql(r.assigned_user_name || 'Administrator')}
      )
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        report_module = excluded.report_module,
        date_modified = excluded.date_modified;
    `);
    reportsSynced++;
  }

  // 7. Synchronize Carriers (Ensures client lists are up to date based on all accounts referencing carriers)
  let carriersSynced = 0;
  try {
    const existingCarriers = querySql("SELECT * FROM carriers");
    for (const c of existingCarriers) {
      const cName = c.carrier;
      const matchedAccs = querySql(`SELECT name FROM accounts WHERE LOWER(carrier_tpa) LIKE ${escapeSql('%' + cName.toLowerCase() + '%')}`);
      let existingClients = [];
      try {
        existingClients = typeof c.clients === 'string' ? JSON.parse(c.clients) : (c.clients || []);
      } catch (_) {
        existingClients = [];
      }
      const clientSet = new Set(existingClients);
      for (const a of matchedAccs) {
        if (a.name) clientSet.add(a.name);
      }
      const updatedClients = Array.from(clientSet);
      executeSql(`
        UPDATE carriers SET
          clients = ${escapeSql(JSON.stringify(updatedClients))},
          updated_at = ${escapeSql(now)}
        WHERE id = ${escapeSql(c.id)};
      `);
      carriersSynced++;
    }
  } catch (cErr) {
    console.warn('[SQLite DB] Carrier client sync warning:', cErr.message);
  }

  const indCountRow = queryOneSql("SELECT COUNT(*) as count FROM contacts");
  const totalContacts = indCountRow ? Number(indCountRow.count) : 0;
  const cenCountRow = queryOneSql("SELECT COUNT(*) as count FROM census_records");
  const totalCensusRecords = cenCountRow ? Number(cenCountRow.count) : 0;
  const carCountRow = queryOneSql("SELECT COUNT(*) as count FROM carriers");
  const totalCarriers = carCountRow ? Number(carCountRow.count) : 0;

  console.log(`[SQLite DB] Sync complete: ${accountsSynced} accounts, ${contactsSynced} contacts synced (${totalContacts} total contacts), ${meetingsSynced} meetings, ${usersSynced} users, ${reportsSynced} reports, ${totalCarriers} carriers, ${totalCensusRecords} census records.`);

  return {
    success: true,
    accounts: accountsSynced,
    contacts: contactsSynced,
    individuals: totalContacts,
    meetings: meetingsSynced,
    users: usersSynced,
    reports: reportsSynced,
    carriers: totalCarriers,
    censusRecords: totalCensusRecords
  };
}

function saveCensusRecords(employees, carrier = 'ManuLife', policyNumber = '') {
  if (!employees || employees.length === 0) {
    return { insertedIndividuals: 0, updatedIndividuals: 0, matchedAccountName: '' };
  }
  const now = new Date().toISOString();

  // Try to find a matching account in the database (by carrier, policy, or explicit census account name)
  let matchedAccountId = null;
  let matchedAccountName = null;

  // 1. First priority: match by explicit accountName if detected from the census data (e.g. Mulgrave School)
  if (employees[0] && employees[0].accountName) {
    const rawAccName = employees[0].accountName.trim().toLowerCase();
    const acc = queryOneSql(`
      SELECT id, name FROM accounts 
      WHERE LOWER(name) = ${escapeSql(rawAccName)}
         OR LOWER(name) LIKE ${escapeSql('%' + rawAccName + '%')}
         OR ${escapeSql(rawAccName)} LIKE '%' || LOWER(name) || '%'
      LIMIT 1
    `);
    if (acc) {
      matchedAccountId = acc.id;
      matchedAccountName = acc.name;
    }
  }

  // 2. Check carriers table for clients associated with this carrier
  if (!matchedAccountId) {
    const carrierRow = queryOneSql(`SELECT clients FROM carriers WHERE LOWER(carrier) = ${escapeSql(carrier.toLowerCase())}`);
    if (carrierRow && carrierRow.clients) {
      try {
        const clientsList = typeof carrierRow.clients === 'string' ? JSON.parse(carrierRow.clients) : carrierRow.clients;
        if (Array.isArray(clientsList) && clientsList.length > 0) {
          for (const clientName of clientsList) {
            const acc = queryOneSql(`SELECT id, name FROM accounts WHERE LOWER(name) = ${escapeSql(clientName.toLowerCase())}`);
            if (acc) {
              matchedAccountId = acc.id;
              matchedAccountName = acc.name;
              break;
            }
          }
        }
      } catch (_) {}
    }
  }

  // If still not matched, check accounts where carrier_tpa contains carrier name
  if (!matchedAccountId) {
    const acc = queryOneSql(`SELECT id, name FROM accounts WHERE LOWER(carrier_tpa) LIKE ${escapeSql('%' + carrier.toLowerCase() + '%')}`);
    if (acc) {
      matchedAccountId = acc.id;
      matchedAccountName = acc.name;
    }
  }

  const defaultAccountName = matchedAccountName || `${carrier} (Policy #${policyNumber || 'Group'})`;
  const defaultAccountId = matchedAccountId || null;

  let insertedCount = 0;
  let updatedCount = 0;

  // Execute in single transaction for speed
  let sqlBatch = 'BEGIN TRANSACTION;\n';

  for (const emp of employees) {
    const certNum = emp.certificateNumber || '';
    const censusId = `census-${carrier.toLowerCase()}-${emp.policyNumber || policyNumber || 'grp'}-${certNum}`;
    const individualId = `ind-census-${carrier.toLowerCase()}-${certNum}`;

    // Build rich notes
    const benefitsSummary = (emp.benefits || [])
      .map(b => `${b.benefitCode}${b.coverageType ? ' (' + b.coverageType + ')' : ''}${b.coverageAmount ? ' $' + Number(b.coverageAmount).toLocaleString() : ''}`)
      .join(', ');

    const dependentsSummary = (emp.dependents || [])
      .map(d => `${d.dependentName} [${d.relationship || d.relationshipCode}]`)
      .join(', ');

    const notesParts = [
      `[CENSUS: ${carrier.toUpperCase()}]`,
      `Cert: #${certNum}`,
      `Policy: #${emp.policyNumber || policyNumber || 'N/A'}`,
      emp.division ? `Div: ${emp.division}` : null,
      emp.class ? `Class: ${emp.class}` : null,
      emp.salary ? `Salary: $${Number(emp.salary).toLocaleString()} (${emp.salaryMode || 'A'})` : null,
      emp.hireDate ? `Hired: ${emp.hireDate}` : null,
      emp.birthDate ? `DOB: ${emp.birthDate}` : null,
      emp.address ? `Address: ${emp.address}, ${emp.city || ''} ${emp.province || ''}` : null,
      benefitsSummary ? `Benefits: ${benefitsSummary}` : null,
      dependentsSummary ? `Dependents (${emp.dependents.length}): ${dependentsSummary}` : null
    ].filter(Boolean).join(' | ');

    const phone = emp.phone || '';
    const status = emp.status === 'Terminated' ? 'Inactive' : 'Active';

    // 1. Insert/Replace into census_records
    sqlBatch += `
      INSERT OR REPLACE INTO census_records (
        id, carrier, policy_number, certificate_number, employee_name,
        first_name, last_name, account_id, account_name, status,
        salary, salary_mode, benefits_json, dependents_json, raw_data,
        created_at, updated_at
      ) VALUES (
        ${escapeSql(censusId)},
        ${escapeSql(carrier)},
        ${escapeSql(emp.policyNumber || policyNumber || '')},
        ${escapeSql(certNum)},
        ${escapeSql(emp.fullName)},
        ${escapeSql(emp.firstName)},
        ${escapeSql(emp.lastName)},
        ${escapeSql(defaultAccountId || '')},
        ${escapeSql(defaultAccountName)},
        ${escapeSql(emp.status)},
        ${Number(emp.salary || 0)},
        ${escapeSql(emp.salaryMode || 'A')},
        ${escapeSql(JSON.stringify(emp.benefits || []))},
        ${escapeSql(JSON.stringify(emp.dependents || []))},
        ${escapeSql(JSON.stringify(emp))},
        ${escapeSql(now)},
        ${escapeSql(now)}
      );
    `;

    // 2. Insert or Update into contacts table
    const existingInd = queryOneSql(`SELECT id FROM contacts WHERE id = ${escapeSql(individualId)} OR (name = ${escapeSql(emp.fullName)} AND (notes LIKE ${escapeSql('%' + certNum + '%')} OR account_name = ${escapeSql(defaultAccountName)}))`);

    if (existingInd) {
      updatedCount++;
      sqlBatch += `
        UPDATE contacts SET
          account_id = COALESCE(NULLIF(${escapeSql(defaultAccountId || '')}, ''), account_id),
          account_name = ${escapeSql(defaultAccountName)},
          role = 'Plan Member',
          status = ${escapeSql(status)},
          phone = ${escapeSql(phone)},
          notes = ${escapeSql(notesParts)},
          updated_at = ${escapeSql(now)}
        WHERE id = ${escapeSql(existingInd.id)};
      `;
    } else {
      insertedCount++;
      sqlBatch += `
        INSERT INTO contacts (
          id, account_id, account_name, name, email, phone, role, status, notes, created_at, updated_at
        ) VALUES (
          ${escapeSql(individualId)},
          ${escapeSql(defaultAccountId || '')},
          ${escapeSql(defaultAccountName)},
          ${escapeSql(emp.fullName)},
          '',
          ${escapeSql(phone)},
          'Plan Member',
          ${escapeSql(status)},
          ${escapeSql(notesParts)},
          ${escapeSql(now)},
          ${escapeSql(now)}
        );
      `;
    }
  }

  sqlBatch += 'COMMIT;\n';
  executeSql(sqlBatch);

  return {
    insertedContacts: insertedCount,
    updatedContacts: updatedCount,
    insertedIndividuals: insertedCount,
    updatedIndividuals: updatedCount,
    matchedAccountName: defaultAccountName
  };
}

function getAllCensusRecords({ carrier, search, limit = 500 } = {}) {
  let sql = 'SELECT * FROM census_records WHERE 1=1';
  if (carrier) {
    sql += ` AND LOWER(carrier) = ${escapeSql(carrier.toLowerCase())}`;
  }
  if (search && search.trim()) {
    const s = `%${search.trim().toLowerCase()}%`;
    sql += ` AND (LOWER(employee_name) LIKE ${escapeSql(s)} OR LOWER(certificate_number) LIKE ${escapeSql(s)} OR LOWER(policy_number) LIKE ${escapeSql(s)})`;
  }
  sql += ` ORDER BY CAST(certificate_number AS INTEGER) ASC, employee_name ASC LIMIT ${parseInt(limit, 10) || 500}`;
  const rows = querySql(sql);
  return rows.map(r => ({
    ...r,
    benefits: r.benefits_json ? JSON.parse(r.benefits_json) : [],
    dependents: r.dependents_json ? JSON.parse(r.dependents_json) : []
  }));
}

// ==================== GLOBAL SEARCH ====================

function globalSearch(query, limitPerCategory = 8) {
  if (!query || !query.trim()) {
    return { query: '', total: 0, categories: [] };
  }
  const rawQ = query.trim();
  const s = `%${rawQ.toLowerCase()}%`;
  const lim = Number(limitPerCategory) || 8;

  // 1. Accounts / Clients
  const accountRows = querySql(`
    SELECT id, name, account_type, email1, shipping_address_city, industry, carrier_tpa
    FROM accounts
    WHERE LOWER(name) LIKE ${escapeSql(s)}
       OR LOWER(email1) LIKE ${escapeSql(s)}
       OR LOWER(industry) LIKE ${escapeSql(s)}
       OR LOWER(description) LIKE ${escapeSql(s)}
       OR LOWER(carrier_tpa) LIKE ${escapeSql(s)}
    ORDER BY name ASC
    LIMIT ${lim}
  `) || [];

  const accounts = accountRows.map(acc => ({
    type: 'account',
    id: acc.id,
    title: acc.name,
    subtitle: `${acc.industry || acc.account_type || 'Client'}${acc.shipping_address_city ? ' • ' + acc.shipping_address_city : ''}${acc.carrier_tpa ? ' • ' + acc.carrier_tpa : ''}`,
    badge: 'Client',
    icon: 'corporate_fare',
    data: acc
  }));

  // 2. Contacts / Plan Members
  const contactRows = querySql(`
    SELECT id, name, role, email, phone, account_id, account_name, notes
    FROM contacts
    WHERE LOWER(name) LIKE ${escapeSql(s)}
       OR LOWER(email) LIKE ${escapeSql(s)}
       OR LOWER(phone) LIKE ${escapeSql(s)}
       OR LOWER(account_name) LIKE ${escapeSql(s)}
       OR LOWER(role) LIKE ${escapeSql(s)}
       OR LOWER(notes) LIKE ${escapeSql(s)}
    ORDER BY name ASC
    LIMIT ${lim}
  `) || [];

  const contacts = contactRows.map(c => {
    let meta = c.role || 'Contact';
    if (c.account_name) meta += ` • ${c.account_name}`;
    const certMatch = c.notes ? c.notes.match(/Cert:\s*(#[^ |]+)/i) : null;
    if (certMatch) meta += ` • ${certMatch[1]}`;

    return {
      type: 'contact',
      id: c.id,
      title: c.name,
      subtitle: meta,
      badge: c.role === 'Plan Member' ? 'Plan Member' : 'Contact',
      icon: c.role === 'Plan Member' ? 'badge' : 'person',
      account_id: c.account_id,
      account_name: c.account_name,
      data: c
    };
  });

  // 3. Carriers
  const carrierRows = querySql(`
    SELECT id, carrier, description, clientIdentifier
    FROM carriers
    WHERE LOWER(carrier) LIKE ${escapeSql(s)}
       OR LOWER(description) LIKE ${escapeSql(s)}
       OR LOWER(clientIdentifier) LIKE ${escapeSql(s)}
    ORDER BY carrier ASC
    LIMIT ${lim}
  `) || [];

  const carriers = carrierRows.map(car => ({
    type: 'carrier',
    id: car.id,
    title: car.carrier,
    subtitle: car.description || 'Insurance Carrier / Provider',
    badge: 'Carrier',
    icon: 'health_and_safety',
    data: car
  }));

  // 4. Census Records / Policies
  const censusRows = querySql(`
    SELECT id, carrier, policy_number, certificate_number, employee_name, account_id, account_name
    FROM census_records
    WHERE LOWER(employee_name) LIKE ${escapeSql(s)}
       OR LOWER(certificate_number) LIKE ${escapeSql(s)}
       OR LOWER(policy_number) LIKE ${escapeSql(s)}
       OR LOWER(carrier) LIKE ${escapeSql(s)}
       OR LOWER(account_name) LIKE ${escapeSql(s)}
    ORDER BY employee_name ASC
    LIMIT ${lim}
  `) || [];

  const censusRecords = censusRows.map(cen => ({
    type: 'census',
    id: cen.id,
    title: `${cen.employee_name} (Cert #${cen.certificate_number})`,
    subtitle: `${cen.carrier} • Policy #${cen.policy_number}${cen.account_name ? ' • ' + cen.account_name : ''}`,
    badge: 'Policy / Census',
    icon: 'policy',
    carrier: cen.carrier,
    data: cen
  }));

  // 5. Meetings
  const meetingRows = querySql(`
    SELECT id, name, date_start, status, parent_name
    FROM meetings
    WHERE LOWER(name) LIKE ${escapeSql(s)}
       OR LOWER(parent_name) LIKE ${escapeSql(s)}
    ORDER BY date_start DESC
    LIMIT ${lim}
  `) || [];

  const meetings = meetingRows.map(m => ({
    type: 'meeting',
    id: m.id,
    title: m.name,
    subtitle: `${m.date_start ? m.date_start.split('T')[0] : ''}${m.parent_name ? ' • ' + m.parent_name : ''} (${m.status || 'Planned'})`,
    badge: 'Meeting',
    icon: 'today',
    data: m
  }));

  // 6. Reports
  const reportRows = querySql(`
    SELECT id, name, report_module
    FROM reports
    WHERE LOWER(name) LIKE ${escapeSql(s)}
       OR LOWER(report_module) LIKE ${escapeSql(s)}
    ORDER BY name ASC
    LIMIT ${lim}
  `) || [];

  const reports = reportRows.map(rep => ({
    type: 'report',
    id: rep.id,
    title: rep.name,
    subtitle: `Module: ${rep.report_module || 'Standard Report'}`,
    badge: 'Report',
    icon: 'analytics',
    data: rep
  }));

  const categories = [
    { key: 'accounts', label: 'Accounts & Clients', count: accounts.length, items: accounts },
    { key: 'contacts', label: 'Contacts & Members', count: contacts.length, items: contacts },
    { key: 'carriers', label: 'Carriers & Providers', count: carriers.length, items: carriers },
    { key: 'census', label: 'Policy & Census Records', count: censusRecords.length, items: censusRecords },
    { key: 'meetings', label: 'Meetings', count: meetings.length, items: meetings },
    { key: 'reports', label: 'Reports', count: reports.length, items: reports }
  ].filter(c => c.count > 0);

  const total = accounts.length + contacts.length + carriers.length + censusRecords.length + meetings.length + reports.length;

  return {
    query: rawQ,
    total,
    categories
  };
}

// Run schema initialization
initSchema();

module.exports = {
  globalSearch,
  initSchema,
  saveCensusRecords,
  getAllCensusRecords,
  hashPassword,
  getBackendMode,
  setBackendMode,
  authenticateUser,
  getAllUsers,
  getUserById,
  getUserByUsernameOrEmail,
  updateUser,
  updateUserPassword,
  deleteUser,
  getAllAccounts,
  getAccountById,
  createAccount,
  updateAccount,
  updateAccountCustomFields,
  deleteAccount,
  deleteAllAccounts,
  bulkInsertAccounts,
  getAllContacts,
  getContactById,
  createContact,
  updateContact,
  deleteContact,
  getAllIndividuals,
  getIndividualById,
  createIndividual,
  updateIndividual,
  deleteIndividual,
  getAllMeetings,
  getMeetingById,
  createMeeting,
  deleteMeeting,
  getAllReports,
  getReportById,
  deleteReport,
  getUserPreferences,
  saveUserPreferences,
  getStats,
  syncFromSpice,
  cleanDescription,
  getAllCarriers,
  getCarrierById,
  createCarrier,
  updateCarrier,
  deleteCarrier,
  saveUserSession,
  getUserSession,
  deleteUserSession,
  getAllUserSessions,
  runInContext,
  isDemoMode,
  escapeSql,
  querySql,
  queryOneSql,
  executeSql
};

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'redcliffe.sqlite');

// Check for native better-sqlite3 driver, otherwise use macOS /usr/bin/sqlite3
let nativeDb = null;
let useNative = false;
try {
  const Database = require('better-sqlite3');
  nativeDb = new Database(dbPath);
  nativeDb.pragma('journal_mode = WAL');
  useNative = true;
  console.log('[SQLite DB] Initialized with high-performance native driver.');
} catch (_) {
  console.log('[SQLite DB] Using built-in macOS SQLite engine (/usr/bin/sqlite3).');
}

// Low-level SQL execution helper (transparently uses native driver or system sqlite3)
function executeSql(sql) {
  if (useNative && nativeDb) {
    nativeDb.exec(sql);
    return;
  }
  try {
    execFileSync('/usr/bin/sqlite3', [dbPath, sql], { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (err) {
    console.error('[SQLite CLI Error] Executing SQL:', err.message);
    throw err;
  }
}

function querySql(sql) {
  if (useNative && nativeDb) {
    return nativeDb.prepare(sql).all();
  }
  try {
    const raw = execFileSync('/usr/bin/sqlite3', [dbPath, '-json', sql], { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    if (!raw || !raw.trim()) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('[SQLite CLI Error] Querying SQL:', err.message);
    return [];
  }
}

function queryOneSql(sql) {
  const rows = querySql(sql);
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

    CREATE TABLE IF NOT EXISTS individuals (
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
  `);

  // Default mode is 'spice' (off by default as requested)
  currentBackendMode = 'spice';
  try {
    executeSql(`INSERT OR REPLACE INTO app_config (key, value) VALUES ('backend_mode', 'spice');`);
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
}

// ==================== CONFIG & MODE ====================

let currentBackendMode = 'spice';

function getBackendMode() {
  return currentBackendMode;
}

function setBackendMode(mode) {
  const cleanMode = mode === 'sqlite' ? 'sqlite' : 'spice';
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
  const user = queryOneSql(`SELECT * FROM users WHERE LOWER(user_name) = ${escapeSql(clean)} OR LOWER(email1) = ${escapeSql(clean)}`);
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
      is_admin: user.is_admin === 1 || user.is_admin === '1'
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

  executeSql(`
    UPDATE users SET
      first_name = ${fn},
      last_name = ${ln},
      email1 = ${em},
      status = ${st},
      is_admin = ${adm},
      updated_at = ${escapeSql(now)}
    WHERE id = ${escapeSql(id)}
  `);

  return getUserById(id);
}

function deleteUser(id) {
  executeSql(`DELETE FROM users WHERE id = ${escapeSql(id)}`);
  return true;
}

// ==================== ACCOUNTS ====================

function buildAccountResponse(acc) {
  if (!acc) return null;
  const individuals = getIndividualsByAccountId(acc.id);
  const names = individuals.map(i => i.name).filter(Boolean);
  const emails = individuals.map(i => i.email).filter(Boolean);
  const phones = individuals.map(i => i.phone).filter(Boolean);

  return {
    id: acc.id,
    name: acc.name,
    account_type: acc.account_type || '',
    email1: acc.email1 || '',
    website: acc.website || '',
    industry: acc.industry || '',
    description: acc.description || '',
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
      individuals
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
      ${escapeSql(data.description || '')},
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
  const ds = data.description !== undefined ? escapeSql(data.description) : 'description';
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
  executeSql(`UPDATE individuals SET account_id = NULL, account_name = NULL WHERE account_id = ${escapeSql(id)}`);
  return true;
}

function deleteAllAccounts() {
  executeSql(`DELETE FROM accounts`);
  executeSql(`UPDATE individuals SET account_id = NULL, account_name = NULL`);
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
        ${escapeSql(r.description || '')},
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

// ==================== INDIVIDUALS ====================

function getAllIndividuals(filter = {}) {
  let sql = 'SELECT * FROM individuals WHERE 1=1';
  if (filter.accountId) {
    sql += ` AND account_id = ${escapeSql(filter.accountId)}`;
  }
  if (filter.search && filter.search.trim()) {
    const s = `%${filter.search.trim().toLowerCase()}%`;
    sql += ` AND (LOWER(name) LIKE ${escapeSql(s)} OR LOWER(email) LIKE ${escapeSql(s)} OR LOWER(phone) LIKE ${escapeSql(s)} OR LOWER(account_name) LIKE ${escapeSql(s)} OR LOWER(role) LIKE ${escapeSql(s)})`;
  }
  sql += ' ORDER BY name ASC';
  return querySql(sql);
}

function getIndividualsByAccountId(accountId) {
  if (!accountId) return [];
  return querySql(`SELECT * FROM individuals WHERE account_id = ${escapeSql(accountId)} ORDER BY name ASC`);
}

function getIndividualById(id) {
  return queryOneSql(`SELECT * FROM individuals WHERE id = ${escapeSql(id)}`);
}

function createIndividual(data) {
  const id = data.id || `ind-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
  const now = new Date().toISOString();

  let accountName = data.account_name || '';
  if (data.account_id && !accountName) {
    const acc = queryOneSql(`SELECT name FROM accounts WHERE id = ${escapeSql(data.account_id)}`);
    if (acc) accountName = acc.name;
  }

  executeSql(`
    INSERT INTO individuals (id, account_id, account_name, name, email, phone, role, status, notes, created_at, updated_at)
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

  return getIndividualById(id);
}

function updateIndividual(id, data) {
  const existing = getIndividualById(id);
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
    UPDATE individuals SET
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

  return getIndividualById(id);
}

function deleteIndividual(id) {
  executeSql(`DELETE FROM individuals WHERE id = ${escapeSql(id)}`);
  return true;
}

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

// ==================== STATS & SYNC ====================

function getStats() {
  const acc = queryOneSql("SELECT COUNT(*) as count FROM accounts");
  const ind = queryOneSql("SELECT COUNT(*) as count FROM individuals");
  const mtg = queryOneSql("SELECT COUNT(*) as count FROM meetings");
  const usr = queryOneSql("SELECT COUNT(*) as count FROM users");
  const rep = queryOneSql("SELECT COUNT(*) as count FROM reports");

  return {
    database: 'SQLite (Local)',
    driver: useNative ? 'Native (better-sqlite3)' : 'System (/usr/bin/sqlite3)',
    path: dbPath,
    accounts: acc ? Number(acc.count) : 0,
    individuals: ind ? Number(ind.count) : 0,
    meetings: mtg ? Number(mtg.count) : 0,
    users: usr ? Number(usr.count) : 0,
    reports: rep ? Number(rep.count) : 0
  };
}

function syncFromSpice({ accounts = [], meetings = [], users = [], reports = [], customFields = {} }) {
  const now = new Date().toISOString();
  let accountsSynced = 0;
  let meetingsSynced = 0;
  let usersSynced = 0;
  let reportsSynced = 0;

  for (const acc of accounts) {
    const custom = customFields[acc.id] || {};
    const renewalDate = acc.renewal_date || custom.renewal_date || (acc.group_benefits?.renewal_date || '');
    const carrierTpa = acc.carrier_tpa || custom.carrier_tpa || (acc.group_benefits?.carrier_tpa || '');
    const numEmployees = acc.num_employees || custom.num_employees || (acc.group_benefits?.num_employees || '');

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
        ${escapeSql(acc.description || '')},
        ${escapeSql(acc.shipping_address_city || '')},
        ${escapeSql(acc.shipping_address_state || '')},
        ${escapeSql(renewalDate)},
        ${escapeSql(carrierTpa)},
        ${escapeSql(String(numEmployees || ''))},
        ${escapeSql(acc.date_entered || now)},
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
        renewal_date = excluded.renewal_date,
        carrier_tpa = excluded.carrier_tpa,
        num_employees = excluded.num_employees,
        updated_at = excluded.updated_at;
    `);
    accountsSynced++;
  }

  for (const m of meetings) {
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
        ${escapeSql(m.assigned_user_name || '')},
        ${escapeSql(m.assigned_user_id || null)},
        ${escapeSql(m.date_entered || now)},
        ${escapeSql(now)}
      )
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        date_start = excluded.date_start,
        date_end = excluded.date_end,
        status = excluded.status,
        updated_at = excluded.updated_at;
    `);
    meetingsSynced++;
  }

  for (const u of users) {
    executeSql(`
      INSERT INTO users (
        id, user_name, password_hash, first_name, last_name, email1, status, is_admin, created_at, updated_at
      ) VALUES (
        ${escapeSql(u.id)},
        ${escapeSql(u.user_name || `user_${u.id.substr(0, 6)}`)},
        ${escapeSql(u.user_hash || hashPassword(process.env.SPICE_PASSWORD || 'P5$Tz3R!mQ8V'))},
        ${escapeSql(u.first_name || '')},
        ${escapeSql(u.last_name || '')},
        ${escapeSql(u.email1 || '')},
        ${escapeSql(u.status || 'Active')},
        ${escapeSql(u.is_admin ? 1 : 0)},
        ${escapeSql(now)},
        ${escapeSql(now)}
      )
      ON CONFLICT(id) DO UPDATE SET
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        email1 = excluded.email1,
        status = excluded.status,
        is_admin = excluded.is_admin,
        updated_at = excluded.updated_at;
    `);
    usersSynced++;
  }

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

  console.log(`[SQLite DB] Sync complete: ${accountsSynced} accounts, ${meetingsSynced} meetings, ${usersSynced} users, ${reportsSynced} reports.`);
  return {
    success: true,
    accounts: accountsSynced,
    meetings: meetingsSynced,
    users: usersSynced,
    reports: reportsSynced
  };
}

// Run schema initialization
initSchema();

module.exports = {
  initSchema,
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
  deleteReport,
  getUserPreferences,
  saveUserPreferences,
  getStats,
  syncFromSpice
};

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dataDir = path.join(__dirname, 'data');
const dbFile = path.join(dataDir, 'redcliffe_db.json');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initial DB state
const initialData = {
  individuals: [
    {
      id: 'ind-allied-1',
      account_id: 'b82a2631-ef87-450a-85bc-369ed2cfa718',
      account_name: 'Allied Holdings Ltd.',
      name: 'Eleanor Vance',
      email: 'evance@alliedhotels.com',
      phone: '(604) 555-0142',
      role: 'Plan Administrator',
      status: 'Active',
      notes: 'Primary benefits administrator for Allied Holdings Ltd.',
      created_at: new Date('2026-01-15T09:00:00Z').toISOString(),
      updated_at: new Date('2026-01-15T09:00:00Z').toISOString()
    }
  ],
  account_custom_fields: {
    'b82a2631-ef87-450a-85bc-369ed2cfa718': {
      account_id: 'b82a2631-ef87-450a-85bc-369ed2cfa718',
      renewal_date: '2026-07-01',
      carrier_tpa: 'GroupSource',
      num_employees: '45',
      updated_at: new Date('2026-01-15T09:00:00Z').toISOString()
    }
  }
};

let dbCache = null;

function loadDb() {
  if (dbCache) return dbCache;
  try {
    if (fs.existsSync(dbFile)) {
      const content = fs.readFileSync(dbFile, 'utf-8');
      dbCache = JSON.parse(content);
      if (!Array.isArray(dbCache.individuals)) dbCache.individuals = [];
      if (!dbCache.account_custom_fields) dbCache.account_custom_fields = {};
    } else {
      dbCache = JSON.parse(JSON.stringify(initialData));
      saveDb();
    }
  } catch (err) {
    console.error('[DB] Error loading database file, initializing default:', err.message);
    dbCache = JSON.parse(JSON.stringify(initialData));
    saveDb();
  }
  return dbCache;
}

function saveDb() {
  if (!dbCache) return;
  try {
    const tmpFile = dbFile + '.tmp';
    fs.writeFileSync(tmpFile, JSON.stringify(dbCache, null, 2), 'utf-8');
    fs.renameSync(tmpFile, dbFile);
  } catch (err) {
    console.error('[DB] Error saving database:', err.message);
  }
}

// ==================== INDIVIDUALS TABLE OPERATIONS ====================

function getAllIndividuals(filter = {}) {
  const db = loadDb();
  let list = [...db.individuals];

  if (filter.accountId) {
    list = list.filter(i => i.account_id === filter.accountId);
  }

  if (filter.search) {
    const q = filter.search.toLowerCase();
    list = list.filter(i => 
      (i.name && i.name.toLowerCase().includes(q)) ||
      (i.email && i.email.toLowerCase().includes(q)) ||
      (i.phone && i.phone.toLowerCase().includes(q)) ||
      (i.account_name && i.account_name.toLowerCase().includes(q)) ||
      (i.role && i.role.toLowerCase().includes(q))
    );
  }

  return list;
}

function getIndividualById(id) {
  const db = loadDb();
  return db.individuals.find(i => i.id === id) || null;
}

function createIndividual(data) {
  const db = loadDb();
  const now = new Date().toISOString();
  const newIndividual = {
    id: data.id || 'ind-' + crypto.randomUUID(),
    account_id: data.account_id || '',
    account_name: data.account_name || '',
    name: (data.name || '').trim(),
    email: (data.email || '').trim(),
    phone: (data.phone || '').trim(),
    role: (data.role || 'Plan Administrator').trim(),
    status: data.status || 'Active',
    notes: data.notes || '',
    created_at: now,
    updated_at: now
  };

  db.individuals.push(newIndividual);
  saveDb();
  console.log(`[DB] Created individual: ${newIndividual.name} (${newIndividual.id})`);
  return newIndividual;
}

function updateIndividual(id, updates) {
  const db = loadDb();
  const index = db.individuals.findIndex(i => i.id === id);
  if (index === -1) return null;

  const current = db.individuals[index];
  const updated = {
    ...current,
    ...updates,
    id: current.id, // Immutable ID
    updated_at: new Date().toISOString()
  };

  db.individuals[index] = updated;
  saveDb();
  console.log(`[DB] Updated individual: ${updated.name} (${updated.id})`);
  return updated;
}

function deleteIndividual(id) {
  const db = loadDb();
  const initialLen = db.individuals.length;
  db.individuals = db.individuals.filter(i => i.id !== id);
  const deleted = db.individuals.length < initialLen;
  if (deleted) {
    saveDb();
    console.log(`[DB] Deleted individual: ${id}`);
  }
  return deleted;
}

// ==================== ACCOUNT CUSTOM FIELDS OPERATIONS ====================

function getAccountCustomFields(accountId) {
  const db = loadDb();
  const fields = db.account_custom_fields[accountId] || {
    account_id: accountId,
    renewal_date: '',
    carrier_tpa: '',
    num_employees: '',
    updated_at: null
  };

  // Attach associated individuals
  const individuals = getAllIndividuals({ accountId });
  const names = individuals.map(i => i.name).filter(Boolean);
  const emails = individuals.map(i => i.email).filter(Boolean);
  const phones = individuals.map(i => i.phone).filter(Boolean);

  return {
    group_benefits: {
      renewal_date: fields.renewal_date || '',
      carrier_tpa: fields.carrier_tpa || '',
      num_employees: fields.num_employees || ''
    },
    plan_admin: {
      names,
      emails,
      phones,
      individuals
    },
    updated_at: fields.updated_at
  };
}

function updateAccountCustomFields(accountId, groupBenefitsData) {
  const db = loadDb();
  const existing = db.account_custom_fields[accountId] || { account_id: accountId };
  
  db.account_custom_fields[accountId] = {
    ...existing,
    account_id: accountId,
    renewal_date: groupBenefitsData.renewal_date !== undefined ? groupBenefitsData.renewal_date : (existing.renewal_date || ''),
    carrier_tpa: groupBenefitsData.carrier_tpa !== undefined ? groupBenefitsData.carrier_tpa : (existing.carrier_tpa || ''),
    num_employees: groupBenefitsData.num_employees !== undefined ? groupBenefitsData.num_employees : (existing.num_employees || ''),
    updated_at: new Date().toISOString()
  };

  saveDb();
  console.log(`[DB] Updated custom fields for account ${accountId}`);
  return getAccountCustomFields(accountId);
}

// ==================== USER PREFERENCES OPERATIONS ====================

function getUserPreferences(username) {
  const db = loadDb();
  if (!db.user_preferences) db.user_preferences = {};
  return db.user_preferences[username] || null;
}

function saveUserPreferences(username, preferences) {
  const db = loadDb();
  if (!db.user_preferences) db.user_preferences = {};
  db.user_preferences[username] = {
    ...(db.user_preferences[username] || {}),
    ...preferences,
    updated_at: new Date().toISOString()
  };
  saveDb();
  console.log(`[DB] Saved preferences for user "${username}"`);
  return db.user_preferences[username];
}

module.exports = {
  loadDb,
  getAllIndividuals,
  getIndividualById,
  createIndividual,
  updateIndividual,
  deleteIndividual,
  getAccountCustomFields,
  updateAccountCustomFields,
  getUserPreferences,
  saveUserPreferences
};


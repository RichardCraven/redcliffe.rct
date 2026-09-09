const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { parse } = require('csv-parse');
const crypto = require('crypto');
const db = require('./db');
const sqliteDb = require('./sqlite_db');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
const spiceCrmUrl = process.env.SPICE_CRM_URL || 'https://spice.pfcd.ca/api';

app.use(cors());
app.use(express.json());

// Log every incoming API request and response status
app.use((req, res, next) => {
  const start = Date.now();
  const { method, originalUrl } = req;
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const symbol = status >= 400 ? '❌' : '✓';
    console.log(`[BACKEND] ${symbol} ${method} ${originalUrl} -> ${status} (${duration}ms)`);
  });
  next();
});

const upload = multer({ storage: multer.memoryStorage() });

let sessionToken = null;

// Helper function to authenticate with SpiceCRM KREST API
async function authenticate() {
  console.log('Authenticating with SpiceCRM...');
  const username = process.env.SPICE_USERNAME;
  const password = process.env.SPICE_PASSWORD;
  
  const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
  
  try {
    const response = await fetch(`${spiceCrmUrl}/authentication/login`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Authentication failed with status ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    sessionToken = data.id || data.session_id || data.token;
    if (!sessionToken) {
      throw new Error('No session ID found in login response.');
    }
    console.log('Successfully authenticated. Token obtained.');
    return sessionToken;
  } catch (error) {
    console.error('Error authenticating with SpiceCRM:', error.message);
    throw error;
  }
}

const activeUserSessions = new Map();

// Middleware to ensure the user has a valid active session
function ensureUserSession(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }
  const token = authHeader.split(' ')[1];
  const sessionUser = activeUserSessions.get(token);
  if (!sessionUser) {
    return res.status(401).json({ error: 'Unauthorized: Session expired or invalid' });
  }
  req.sessionUser = sessionUser;
  next();
}

// Middleware to ensure token is valid and set
async function ensureAuthenticated(req, res, next) {
  if (sqliteDb.getBackendMode() === 'sqlite') {
    return next();
  }
  if (!sessionToken) {
    try {
      await authenticate();
    } catch (error) {
      return res.status(401).json({ error: 'Failed to authenticate with SpiceCRM backend' });
    }
  }
  next();
}

// Endpoint to log in (authenticates against SpiceCRM or SQLite depending on active backend)
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  // 1. First attempt: Authenticate against SpiceCRM
  const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
  try {
    const response = await fetch(`${spiceCrmUrl}/authentication/login`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      const token = crypto.randomBytes(32).toString('hex');
      const displayName = data.user_name || data.display_name || username;
      activeUserSessions.set(token, {
        username,
        name: displayName
      });

      console.log(`[BACKEND] ✓ Authenticated user "${username}" via SpiceCRM.`);
      return res.json({ 
        success: true, 
        token, 
        user: {
          username,
          name: displayName
        } 
      });
    }
  } catch (spiceErr) {
    console.warn('[BACKEND] SpiceCRM login attempt error:', spiceErr.message);
  }

  // 2. Second attempt / Fallback: Check local SQLite users
  try {
    const user = sqliteDb.authenticateUser(username, password);
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      const displayName = (user.first_name && user.last_name) ? `${user.first_name} ${user.last_name}` : user.user_name;
      activeUserSessions.set(token, {
        username: user.user_name,
        name: displayName
      });

      console.log(`[BACKEND] ✓ Authenticated user "${username}" via local SQLite.`);
      return res.json({ 
        success: true, 
        token, 
        backend: 'sqlite',
        user: {
          username: user.user_name,
          name: displayName
        } 
      });
    }
  } catch (sqlErr) {
    console.warn('[BACKEND] SQLite login attempt error:', sqlErr.message);
  }

  return res.status(401).json({ error: 'Invalid username or password' });
});

// Endpoint to log out
app.post('/api/logout', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    activeUserSessions.delete(token);
  }
  res.json({ success: true });
});

// Endpoint to reset password (unauthenticated flow from login screen)
app.post('/api/password/reset', async (req, res) => {
  const { identifier, newPassword } = req.body;
  if (!identifier || !newPassword) {
    return res.status(400).json({ error: 'Username or email and new password are required' });
  }

  console.log(`[BACKEND] 🔑 Password reset requested for: "${identifier}"`);

  if (newPassword.length < 6) {
    console.log('[BACKEND] ⚠️ Password reset rejected: new password shorter than 6 characters');
    return res.status(400).json({ error: 'New password must be at least 6 characters long' });
  }

  if (sqliteDb.getBackendMode() === 'sqlite') {
    const targetUser = sqliteDb.getUserByUsernameOrEmail(identifier);
    if (!targetUser) {
      console.warn(`[BACKEND] ⚠️ No user matching identifier "${identifier}" found in SQLite`);
      return res.status(404).json({ error: 'No user account found matching that username or email address.' });
    }
    sqliteDb.updateUserPassword(targetUser.id, newPassword);
    console.log(`[BACKEND] Password reset successfully for SQLite user ${targetUser.user_name}`);
    return res.json({ success: true, message: 'Password has been reset successfully. You can now log in.' });
  }

  try {
    if (!sessionToken) {
      await authenticate();
    }

    // Search for user in SpiceCRM
    let usersResponse = await fetch(`${spiceCrmUrl}/module/Users?limit=250`, {
      method: 'GET',
      headers: {
        'OAuth-Token': sessionToken,
        'Accept': 'application/json'
      }
    });

    if (usersResponse.status === 401 || usersResponse.status === 403) {
      await authenticate();
      usersResponse = await fetch(`${spiceCrmUrl}/module/Users?limit=250`, {
        method: 'GET',
        headers: {
          'OAuth-Token': sessionToken,
          'Accept': 'application/json'
        }
      });
    }

    if (!usersResponse.ok) {
      const errorText = await usersResponse.text();
      console.error(`[BACKEND ERROR] Failed to query users from SpiceCRM: ${errorText}`);
      return res.status(usersResponse.status).json({ error: `Failed to query users: ${errorText}` });
    }

    const usersData = await usersResponse.json();
    const userList = usersData.list || [];
    const cleanId = identifier.trim().toLowerCase();

    const targetUser = userList.find(u => 
      (u.user_name && u.user_name.toLowerCase() === cleanId) || 
      (u.email1 && u.email1.toLowerCase() === cleanId)
    );

    if (!targetUser) {
      console.warn(`[BACKEND] ⚠️ No user matching identifier "${cleanId}" found in SpiceCRM (${userList.length} users checked)`);
      return res.status(404).json({ error: 'No user account found matching that username or email address.' });
    }

    console.log(`[BACKEND] Found matching user: id=${targetUser.id}, username=${targetUser.user_name}`);

    // Perform password reset using SpiceCRM's reset endpoint
    let resetResponse = await fetch(`${spiceCrmUrl}/module/Users/${targetUser.id}/password/reset`, {
      method: 'POST',
      headers: {
        'OAuth-Token': sessionToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        newPassword: newPassword,
        sendEmail: false,
        forceReset: false
      })
    });

    if (resetResponse.status === 401 || resetResponse.status === 403) {
      await authenticate();
      resetResponse = await fetch(`${spiceCrmUrl}/module/Users/${targetUser.id}/password/reset`, {
        method: 'POST',
        headers: {
          'OAuth-Token': sessionToken,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          newPassword: newPassword,
          sendEmail: false,
          forceReset: false
        })
      });
    }

    if (resetResponse.ok) {
      return res.json({ success: true, message: 'Password has been reset successfully. You can now log in.' });
    }

    // Fallback: If reset route returned an error, try updating user record directly
    const userHash = crypto.createHash('md5').update(newPassword).digest('hex');
    const updateResponse = await fetch(`${spiceCrmUrl}/module/Users/${targetUser.id}`, {
      method: 'POST',
      headers: {
        'OAuth-Token': sessionToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        user_hash: userHash,
        password: newPassword
      })
    });

    if (updateResponse.ok) {
      return res.json({ success: true, message: 'Password has been reset successfully. You can now log in.' });
    }

    const errDetail = await resetResponse.text();
    return res.status(resetResponse.status).json({ error: `Password reset failed: ${errDetail}` });
  } catch (error) {
    console.error('Password reset error:', error.message);
    res.status(500).json({ error: 'Server error during password reset: ' + error.message });
  }
});

// Endpoint to change password (authenticated flow from settings)
app.post('/api/password/change', ensureUserSession, ensureAuthenticated, async (req, res) => {
  const username = req.body.username || req.sessionUser?.username;
  const { currentPassword, newPassword } = req.body;
  if (!username || !currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Username, current password, and new password are required' });
  }

  console.log(`[BACKEND] 🔑 Password change requested for user: "${username}"`);

  if (newPassword.length < 6) {
    console.log('[BACKEND] ⚠️ Password change rejected: new password shorter than 6 characters');
    return res.status(400).json({ error: 'New password must be at least 6 characters long' });
  }

  if (sqliteDb.getBackendMode() === 'sqlite') {
    const verified = sqliteDb.authenticateUser(username, currentPassword);
    if (!verified) {
      console.warn(`[BACKEND] ⚠️ Current password verification failed for SQLite user: "${username}"`);
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }
    sqliteDb.updateUserPassword(verified.id, newPassword);
    console.log(`[BACKEND] Password updated successfully for SQLite user "${username}"`);
    return res.json({ success: true, message: 'Password updated successfully.' });
  }

  try {
    // 1. Verify current credentials against SpiceCRM
    const authHeader = 'Basic ' + Buffer.from(`${username}:${currentPassword}`).toString('base64');
    const verifyAuth = await fetch(`${spiceCrmUrl}/authentication/login`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json'
      }
    });

    if (!verifyAuth.ok) {
      console.warn(`[BACKEND] ⚠️ Current password verification failed for user: "${username}"`);
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    const authData = await verifyAuth.json();
    const userId = authData.userid || (authData.user && authData.user.id);

    // 2. Attempt SpiceCRM's changepassword endpoint
    const changeResponse = await fetch(`${spiceCrmUrl}/authentication/changepassword`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        username,
        password: currentPassword,
        newPassword
      })
    });

    if (changeResponse.ok) {
      return res.json({ success: true, message: 'Password updated successfully.' });
    }

    // 3. Fallback: If changepassword route is not supported or failed, use admin reset route
    if (userId) {
      let resetResponse = await fetch(`${spiceCrmUrl}/module/Users/${userId}/password/reset`, {
        method: 'POST',
        headers: {
          'OAuth-Token': sessionToken,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          newPassword: newPassword,
          sendEmail: false,
          forceReset: false
        })
      });

      if (resetResponse.status === 401 || resetResponse.status === 403) {
        await authenticate();
        resetResponse = await fetch(`${spiceCrmUrl}/module/Users/${userId}/password/reset`, {
          method: 'POST',
          headers: {
            'OAuth-Token': sessionToken,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            newPassword: newPassword,
            sendEmail: false,
            forceReset: false
          })
        });
      }

      if (resetResponse.ok) {
        return res.json({ success: true, message: 'Password updated successfully.' });
      }
    }

    // 4. Secondary Fallback: Direct module update
    if (userId) {
      const userHash = crypto.createHash('md5').update(newPassword).digest('hex');
      const updateResponse = await fetch(`${spiceCrmUrl}/module/Users/${userId}`, {
        method: 'POST',
        headers: {
          'OAuth-Token': sessionToken,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          user_hash: userHash,
          password: newPassword
        })
      });

      if (updateResponse.ok) {
        return res.json({ success: true, message: 'Password updated successfully.' });
      }
    }

    return res.status(500).json({ error: 'Failed to update password with SpiceCRM backend.' });
  } catch (error) {
    console.error('Change password error:', error.message);
    res.status(500).json({ error: 'Server error during password change: ' + error.message });
  }
});

// ==================== DATABASE BACKEND MODE (SPICE vs SQLITE) ====================

// Get current backend mode and stats
app.get('/api/backend/config', ensureUserSession, (req, res) => {
  try {
    const mode = sqliteDb.getBackendMode();
    const stats = sqliteDb.getStats();
    res.json({
      success: true,
      mode,
      available: ['spice', 'sqlite'],
      stats
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Switch backend mode ('spice' or 'sqlite')
app.post('/api/backend/config', ensureUserSession, (req, res) => {
  try {
    const { mode } = req.body;
    if (mode !== 'spice' && mode !== 'sqlite') {
      return res.status(400).json({ error: "Invalid mode. Must be 'spice' or 'sqlite'" });
    }
    const saved = sqliteDb.setBackendMode(mode);
    console.log(`[BACKEND] 🔄 Active database backend switched to: ${saved.toUpperCase()}`);
    res.json({ success: true, mode: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sync data from SpiceCRM into SQLite
app.post('/api/backend/sync-spice', ensureUserSession, ensureAuthenticated, async (req, res) => {
  try {
    console.log('[BACKEND] 📥 Syncing records from SpiceCRM to local SQLite...');
    const accRes = await fetch(`${spiceCrmUrl}/module/Accounts?limit=500&fields=id,name,email1,website,industry,description,shipping_address_city,shipping_address_state,account_type,date_entered`, {
      headers: { 'OAuth-Token': sessionToken, 'Accept': 'application/json' }
    });
    const accData = accRes.ok ? await accRes.json() : { list: [] };

    const mtgRes = await fetch(`${spiceCrmUrl}/module/Meetings?limit=500`, {
      headers: { 'OAuth-Token': sessionToken, 'Accept': 'application/json' }
    });
    const mtgData = mtgRes.ok ? await mtgRes.json() : { list: [] };

    const usrRes = await fetch(`${spiceCrmUrl}/module/Users?limit=100`, {
      headers: { 'OAuth-Token': sessionToken, 'Accept': 'application/json' }
    });
    const usrData = usrRes.ok ? await usrRes.json() : { list: [] };

    let repList = [];
    try {
      const repRes = await fetch(`${spiceCrmUrl}/module/KReports?limit=100`, {
        headers: { 'OAuth-Token': sessionToken, 'Accept': 'application/json' }
      });
      if (repRes.ok) {
        const repData = await repRes.json();
        repList = repData.list || [];
      }
    } catch (_) {}

    const localDb = db.loadDb();
    const syncResults = sqliteDb.syncFromSpice({
      accounts: accData.list || [],
      meetings: mtgData.list || [],
      users: usrData.list || [],
      reports: repList,
      customFields: localDb.account_custom_fields || {}
    });

    res.json({ success: true, ...syncResults });
  } catch (err) {
    console.error('[BACKEND ERROR] Sync failed:', err.message);
    res.status(500).json({ error: 'Sync failed: ' + err.message });
  }
});

// Endpoint to check connection status
app.get('/api/status', ensureUserSession, async (req, res) => {
  const currentMode = sqliteDb.getBackendMode();
  if (currentMode === 'sqlite') {
    const stats = sqliteDb.getStats();
    return res.json({
      status: 'connected',
      backend: 'sqlite',
      label: 'SQLite DB',
      crmUrl: 'SQLite Local',
      authenticated: true,
      stats
    });
  }

  try {
    if (!sessionToken) {
      await authenticate();
    }
    res.json({
      status: 'connected',
      backend: 'spice',
      label: 'SpiceCRM',
      crmUrl: spiceCrmUrl,
      authenticated: true,
      token: sessionToken
    });
  } catch (error) {
    res.status(500).json({ status: 'error', backend: 'spice', message: error.message });
  }
});

// Endpoint to force re-authentication
app.post('/api/reauth', ensureUserSession, async (req, res) => {
  try {
    await authenticate();
    res.json({ status: 'success', message: 'Re-authenticated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to fetch recent accounts from SpiceCRM or SQLite
app.get('/api/accounts', ensureUserSession, ensureAuthenticated, async (req, res) => {
  const currentMode = sqliteDb.getBackendMode();
  if (currentMode === 'sqlite') {
    const limit = Number(req.query.limit || 100);
    const search = req.query.search || '';
    const list = sqliteDb.getAllAccounts(limit, search);
    return res.json({ result_count: list.length, total_count: list.length, list });
  }

  const limit = req.query.limit || 10;
  try {
    const response = await fetch(`${spiceCrmUrl}/module/Accounts?limit=${limit}&fields=id,name,email1,website,industry,description,shipping_address_city,shipping_address_state,account_type`, {
      method: 'GET',
      headers: {
        'OAuth-Token': sessionToken,
        'Accept': 'application/json'
      }
    });

    if (response.status === 401 || response.status === 403) {
      // Token might be expired, re-authenticate and retry once
      await authenticate();
      const retryResponse = await fetch(`${spiceCrmUrl}/module/Accounts?limit=${limit}&fields=id,name,email1,website,industry,description,shipping_address_city,shipping_address_state,account_type`, {
        method: 'GET',
        headers: {
          'OAuth-Token': sessionToken,
          'Accept': 'application/json'
        }
      });
      let data = await retryResponse.json();
      if (data && Array.isArray(data.list)) {
        data.list = data.list.map(acc => {
          const custom = db.getAccountCustomFields(acc.id);
          return {
            ...acc,
            account_type: acc.account_type || custom.account_type,
            group_benefits: custom.group_benefits,
            plan_admin: custom.plan_admin,
            renewal_date: custom.group_benefits?.renewal_date || '',
            carrier_tpa: custom.group_benefits?.carrier_tpa || '',
            num_employees: custom.group_benefits?.num_employees || ''
          };
        });
      }
      return res.json(data);
    }

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json();
    if (data && Array.isArray(data.list)) {
      data.list = data.list.map(acc => {
        const custom = db.getAccountCustomFields(acc.id);
        return {
          ...acc,
          account_type: acc.account_type || custom.account_type,
          group_benefits: custom.group_benefits,
          plan_admin: custom.plan_admin,
          renewal_date: custom.group_benefits?.renewal_date || '',
          carrier_tpa: custom.group_benefits?.carrier_tpa || '',
          num_employees: custom.group_benefits?.num_employees || ''
        };
      });
    }
    res.json(data);
  } catch (error) {
    console.error('Error fetching accounts:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to fetch a single account from SpiceCRM or SQLite
app.get('/api/accounts/:id', ensureUserSession, ensureAuthenticated, async (req, res) => {
  const { id } = req.params;
  const currentMode = sqliteDb.getBackendMode();
  if (currentMode === 'sqlite') {
    const acc = sqliteDb.getAccountById(id);
    if (!acc) return res.status(404).json({ error: 'Account not found' });
    return res.json(acc);
  }

  try {
    const response = await fetch(`${spiceCrmUrl}/module/Accounts/${id}`, {
      method: 'GET',
      headers: {
        'OAuth-Token': sessionToken,
        'Accept': 'application/json'
      }
    });

    if (response.status === 401 || response.status === 403) {
      await authenticate();
      const retryResponse = await fetch(`${spiceCrmUrl}/module/Accounts/${id}`, {
        method: 'GET',
        headers: {
          'OAuth-Token': sessionToken,
          'Accept': 'application/json'
        }
      });
      const data = await retryResponse.json();
      if (data && data.id) {
        const custom = db.getAccountCustomFields(data.id);
        data.account_type = data.account_type || custom.account_type;
        data.group_benefits = custom.group_benefits;
        data.plan_admin = custom.plan_admin;
        data.renewal_date = custom.group_benefits?.renewal_date || '';
        data.carrier_tpa = custom.group_benefits?.carrier_tpa || '';
        data.num_employees = custom.group_benefits?.num_employees || '';
      }
      return res.json(data);
    }

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json();
    if (data && data.id) {
      const custom = db.getAccountCustomFields(data.id);
      data.account_type = data.account_type || custom.account_type;
      data.group_benefits = custom.group_benefits;
      data.plan_admin = custom.plan_admin;
      data.renewal_date = custom.group_benefits?.renewal_date || '';
      data.carrier_tpa = custom.group_benefits?.carrier_tpa || '';
      data.num_employees = custom.group_benefits?.num_employees || '';
    }
    res.json(data);
  } catch (error) {
    console.error(`Error fetching account ${id}:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to update account custom fields (Group Benefits: renewal date, carrier/TPA, num employees)
app.patch('/api/accounts/:id/custom-fields', ensureUserSession, async (req, res) => {
  const { id } = req.params;
  const { renewal_date, carrier_tpa, num_employees } = req.body;
  try {
    sqliteDb.updateAccountCustomFields(id, { renewal_date, carrier_tpa, num_employees });
    const updated = db.updateAccountCustomFields(id, { renewal_date, carrier_tpa, num_employees });
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(`[BACKEND ERROR] Failed to update custom fields for account ${id}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==================== INDIVIDUALS REST API ====================

// Endpoint to fetch all individuals (supports optional ?accountId=... and ?search=...)
app.get('/api/individuals', ensureUserSession, (req, res) => {
  try {
    const { accountId, search } = req.query;
    if (sqliteDb.getBackendMode() === 'sqlite') {
      const list = sqliteDb.getAllIndividuals({ accountId, search });
      return res.json({ list });
    }
    const list = db.getAllIndividuals({ accountId, search });
    res.json({ list });
  } catch (err) {
    console.error('[BACKEND ERROR] Failed to fetch individuals:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to fetch a single individual
app.get('/api/individuals/:id', ensureUserSession, (req, res) => {
  try {
    if (sqliteDb.getBackendMode() === 'sqlite') {
      const individual = sqliteDb.getIndividualById(req.params.id);
      if (!individual) return res.status(404).json({ error: 'Individual not found' });
      return res.json(individual);
    }
    const individual = db.getIndividualById(req.params.id);
    if (!individual) {
      return res.status(404).json({ error: 'Individual not found' });
    }
    res.json(individual);
  } catch (err) {
    console.error(`[BACKEND ERROR] Failed to fetch individual ${req.params.id}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to create an individual
app.post('/api/individuals', ensureUserSession, (req, res) => {
  try {
    const { name, email, phone, role, account_id, account_name, notes, status } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Individual name is required' });
    }
    const created = db.createIndividual({
      name,
      email,
      phone,
      role: role || 'Plan Administrator',
      account_id,
      account_name,
      notes,
      status: status || 'Active'
    });
    sqliteDb.createIndividual(created);
    res.status(201).json(created);
  } catch (err) {
    console.error('[BACKEND ERROR] Failed to create individual:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to update an individual
app.patch('/api/individuals/:id', ensureUserSession, (req, res) => {
  try {
    const updated = db.updateIndividual(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Individual not found' });
    }
    sqliteDb.updateIndividual(req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    console.error(`[BACKEND ERROR] Failed to update individual ${req.params.id}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to delete an individual
app.delete('/api/individuals/:id', ensureUserSession, (req, res) => {
  try {
    const deleted = db.deleteIndividual(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Individual not found' });
    }
    sqliteDb.deleteIndividual(req.params.id);
    res.json({ success: true, message: 'Individual deleted successfully' });
  } catch (err) {
    console.error(`[BACKEND ERROR] Failed to delete individual ${req.params.id}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==================== USER PREFERENCES REST API ====================

// Endpoint to get user preferences
app.get('/api/user/preferences', ensureUserSession, (req, res) => {
  try {
    const username = req.session?.username || 'admin';
    if (sqliteDb.getBackendMode() === 'sqlite') {
      const prefs = sqliteDb.getUserPreferences(username) || {};
      return res.json({ success: true, preferences: prefs });
    }
    const prefs = db.getUserPreferences(username) || {};
    res.json({ success: true, preferences: prefs });
  } catch (err) {
    console.error('[BACKEND ERROR] Failed to fetch user preferences:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to update user preferences
app.post('/api/user/preferences', ensureUserSession, (req, res) => {
  try {
    const username = req.session?.username || 'admin';
    const { preferences } = req.body;
    sqliteDb.saveUserPreferences(username, preferences || {});
    const saved = db.saveUserPreferences(username, preferences || {});
    res.json({ success: true, preferences: saved });
  } catch (err) {
    console.error('[BACKEND ERROR] Failed to save user preferences:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to fetch recent meetings from SpiceCRM or SQLite
app.get('/api/meetings', ensureUserSession, ensureAuthenticated, async (req, res) => {
  const limit = req.query.limit || 100;
  if (sqliteDb.getBackendMode() === 'sqlite') {
    const list = sqliteDb.getAllMeetings(limit);
    return res.json({ result_count: list.length, total_count: list.length, list });
  }

  try {
    const response = await fetch(`${spiceCrmUrl}/module/Meetings?limit=${limit}`, {
      method: 'GET',
      headers: {
        'OAuth-Token': sessionToken,
        'Accept': 'application/json'
      }
    });

    if (response.status === 401 || response.status === 403) {
      await authenticate();
      const retryResponse = await fetch(`${spiceCrmUrl}/module/Meetings?limit=${limit}`, {
        method: 'GET',
        headers: {
          'OAuth-Token': sessionToken,
          'Accept': 'application/json'
        }
      });
      const data = await retryResponse.json();
      return res.json(data);
    }

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching meetings:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to create a new meeting in SpiceCRM or SQLite
app.post('/api/meetings', ensureUserSession, ensureAuthenticated, async (req, res) => {
  const meetingData = req.body;
  if (sqliteDb.getBackendMode() === 'sqlite') {
    const created = sqliteDb.createMeeting(meetingData);
    return res.status(201).json(created);
  }

  const uuid = crypto.randomUUID();
  try {
    const response = await fetch(`${spiceCrmUrl}/module/Meetings/${uuid}`, {
      method: 'POST',
      headers: {
        'OAuth-Token': sessionToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(meetingData)
    });

    if (response.status === 401 || response.status === 403) {
      await authenticate();
      const retryResponse = await fetch(`${spiceCrmUrl}/module/Meetings/${uuid}`, {
        method: 'POST',
        headers: {
          'OAuth-Token': sessionToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(meetingData)
      });
      const data = await retryResponse.json();
      return res.json(data);
    }

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error creating meeting:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to fetch a single meeting from SpiceCRM or SQLite
app.get('/api/meetings/:id', ensureUserSession, ensureAuthenticated, async (req, res) => {
  const { id } = req.params;
  if (sqliteDb.getBackendMode() === 'sqlite') {
    const meeting = sqliteDb.getMeetingById(id);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    return res.json(meeting);
  }

  try {
    const response = await fetch(`${spiceCrmUrl}/module/Meetings/${id}`, {
      method: 'GET',
      headers: {
        'OAuth-Token': sessionToken,
        'Accept': 'application/json'
      }
    });

    if (response.status === 401 || response.status === 403) {
      await authenticate();
      const retryResponse = await fetch(`${spiceCrmUrl}/module/Meetings/${id}`, {
        method: 'GET',
        headers: {
          'OAuth-Token': sessionToken,
          'Accept': 'application/json'
        }
      });
      const data = await retryResponse.json();
      return res.json(data);
    }

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error(`Error fetching meeting ${id}:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to fetch users from SpiceCRM or SQLite
app.get('/api/users', ensureUserSession, ensureAuthenticated, async (req, res) => {
  const limit = req.query.limit || 100;
  if (sqliteDb.getBackendMode() === 'sqlite') {
    const list = sqliteDb.getAllUsers(limit);
    return res.json({ result_count: list.length, total_count: list.length, list });
  }

  try {
    const response = await fetch(`${spiceCrmUrl}/module/Users?limit=${limit}`, {
      method: 'GET',
      headers: {
        'OAuth-Token': sessionToken,
        'Accept': 'application/json'
      }
    });

    if (response.status === 401 || response.status === 403) {
      await authenticate();
      const retryResponse = await fetch(`${spiceCrmUrl}/module/Users?limit=${limit}`, {
        method: 'GET',
        headers: {
          'OAuth-Token': sessionToken,
          'Accept': 'application/json'
        }
      });
      const data = await retryResponse.json();
      return res.json(data);
    }

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching users:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to fetch reports from SpiceCRM or SQLite
app.get('/api/reports', ensureUserSession, ensureAuthenticated, async (req, res) => {
  const limit = req.query.limit || 100;
  if (sqliteDb.getBackendMode() === 'sqlite') {
    const list = sqliteDb.getAllReports(limit);
    return res.json({ result_count: list.length, total_count: list.length, list });
  }

  try {
    const response = await fetch(`${spiceCrmUrl}/module/KReports?limit=${limit}`, {
      method: 'GET',
      headers: {
        'OAuth-Token': sessionToken,
        'Accept': 'application/json'
      }
    });

    if (response.status === 401 || response.status === 403) {
      await authenticate();
      const retryResponse = await fetch(`${spiceCrmUrl}/module/KReports?limit=${limit}`, {
        method: 'GET',
        headers: {
          'OAuth-Token': sessionToken,
          'Accept': 'application/json'
        }
      });
      const data = await retryResponse.json();
      return res.json(data);
    }

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching reports:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to delete a specific report from SpiceCRM or SQLite
app.delete('/api/reports/:id', ensureUserSession, ensureAuthenticated, async (req, res) => {
  const { id } = req.params;
  if (sqliteDb.getBackendMode() === 'sqlite') {
    sqliteDb.deleteReport(id);
    return res.json({ success: true, message: 'Report deleted' });
  }

  try {
    const response = await fetch(`${spiceCrmUrl}/module/KReports/${id}`, {
      method: 'DELETE',
      headers: {
        'OAuth-Token': sessionToken,
        'Accept': 'application/json'
      }
    });

    if (response.status === 401 || response.status === 403) {
      await authenticate();
      const retryResponse = await fetch(`${spiceCrmUrl}/module/KReports/${id}`, {
        method: 'DELETE',
        headers: {
          'OAuth-Token': sessionToken,
          'Accept': 'application/json'
        }
      });
      const data = await retryResponse.json();
      return res.json({ success: data });
    }

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json();
    res.json({ success: data });
  } catch (error) {
    console.error(`Error deleting report ${id}:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to execute and fetch live report data from SpiceCRM or SQLite
app.get('/api/reports/:id/data', ensureUserSession, ensureAuthenticated, async (req, res) => {
  const { id } = req.params;

  if (sqliteDb.getBackendMode() === 'sqlite') {
    const report = sqliteDb.queryOneSql(`SELECT * FROM reports WHERE id = ${sqliteDb.escapeSql(id)}`);
    const reportModule = report ? (report.report_module || 'Accounts') : 'Accounts';
    const reportName = report ? report.name : 'Report Results';

    let records = [];
    let columns = [];
    if (reportModule.toLowerCase() === 'contacts') {
      const contacts = sqliteDb.getAllContacts ? sqliteDb.getAllContacts(50) : [];
      columns = [
        { fieldid: 'first_name', label: 'FIRST NAME', fieldname: 'first_name' },
        { fieldid: 'last_name', label: 'LAST NAME', fieldname: 'last_name' },
        { fieldid: 'email', label: 'EMAIL', fieldname: 'email' },
        { fieldid: 'balance', label: 'BALANCE', fieldname: 'balance' }
      ];
      records = (contacts || []).map(c => ({
        _id: c.id,
        _module: 'Contacts',
        'FIRST NAME': c.first_name || c.name || 'John',
        'LAST NAME': c.last_name || 'Doe',
        'EMAIL': c.email || '',
        'BALANCE': c.balance || '500'
      }));
    } else {
      const accounts = sqliteDb.getAllAccounts(50);
      columns = [
        { fieldid: 'name', label: 'ACCOUNT NAME', fieldname: 'name' },
        { fieldid: 'industry', label: 'INDUSTRY', fieldname: 'industry' },
        { fieldid: 'account_type', label: 'ACCOUNT TYPE', fieldname: 'account_type' },
        { fieldid: 'phone_office', label: 'PHONE', fieldname: 'phone_office' }
      ];
      records = (accounts || []).map(a => ({
        _id: a.id,
        _module: 'Accounts',
        'ACCOUNT NAME': a.name || 'Unnamed',
        'INDUSTRY': a.industry || 'Financial',
        'ACCOUNT TYPE': a.account_type || 'Customer',
        'PHONE': a.phone_office || ''
      }));
    }

    return res.json({
      id,
      name: reportName,
      report_module: reportModule,
      total: records.length,
      columns,
      records
    });
  }

  try {
    // 1. Fetch report definition to retrieve friendly column labels and field mappings
    let defRes = await fetch(`${spiceCrmUrl}/module/KReports/${id}`, {
      method: 'GET',
      headers: {
        'OAuth-Token': sessionToken,
        'Accept': 'application/json'
      }
    });

    if (defRes.status === 401 || defRes.status === 403) {
      await authenticate();
      defRes = await fetch(`${spiceCrmUrl}/module/KReports/${id}`, {
        method: 'GET',
        headers: {
          'OAuth-Token': sessionToken,
          'Accept': 'application/json'
        }
      });
    }

    if (!defRes.ok) {
      const errText = await defRes.text();
      return res.status(defRes.status).json({ error: `Failed to fetch report blueprint: ${errText}` });
    }

    const repDef = await defRes.json();
    let listfields = [];
    try {
      listfields = typeof repDef.listfields === 'string' ? JSON.parse(repDef.listfields) : (repDef.listfields || []);
    } catch (_) {
      listfields = [];
    }

    const columns = [];
    const seenFieldIds = new Set();
    listfields.forEach(f => {
      if ((f.display === 'yes' || !f.display) && !seenFieldIds.has(f.fieldid)) {
        seenFieldIds.add(f.fieldid);
        const rawLabel = f.name?.replace(/^LBL_/, '').replace(/_/g, ' ') || f.fieldname || f.fieldid;
        columns.push({
          fieldid: f.fieldid,
          label: rawLabel.toUpperCase(),
          fieldname: f.fieldname,
          sequence: f.sequence !== undefined ? Number(f.sequence) : 0
        });
      }
    });
    columns.sort((a, b) => a.sequence - b.sequence);

    // 2. Execute dynamic options to fetch actual tabular dataset rows
    let dataRes = await fetch(`${spiceCrmUrl}/module/KReports/${id}/presentation/dynamicoptions`, {
      method: 'POST',
      headers: {
        'OAuth-Token': sessionToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({})
    });

    if (dataRes.status === 401 || dataRes.status === 403) {
      await authenticate();
      dataRes = await fetch(`${spiceCrmUrl}/module/KReports/${id}/presentation/dynamicoptions`, {
        method: 'POST',
        headers: {
          'OAuth-Token': sessionToken,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({})
      });
    }

    if (!dataRes.ok) {
      const errText = await dataRes.text();
      return res.status(dataRes.status).json({ error: `Failed to execute report: ${errText}` });
    }

    const dataPayload = await dataRes.json();
    const rawRecords = dataPayload.records || [];

    const records = rawRecords.map(rec => {
      const row = {
        _id: rec.sugarRecordId || '',
        _module: rec.sugarRecordModule || repDef.report_module || 'Accounts'
      };
      columns.forEach(col => {
        row[col.label] = rec[col.fieldid] !== undefined && rec[col.fieldid] !== null ? String(rec[col.fieldid]) : '';
      });
      return row;
    });

    res.json({
      id,
      name: repDef.name || 'Report Results',
      report_module: repDef.report_module || 'Accounts',
      total: records.length,
      columns,
      records
    });
  } catch (error) {
    console.error(`Error executing report ${id}:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to export report data as CSV
app.get('/api/reports/:id/export/csv', ensureUserSession, ensureAuthenticated, async (req, res) => {
  const { id } = req.params;

  try {
    let csvData = null;
    let reportName = `Report_${id}`;

    if (sqliteDb.getBackendMode() !== 'sqlite') {
      // Try native KReports CSV export plugin first
      let exportRes = await fetch(`${spiceCrmUrl}/module/KReports/plugins/action/kcsvexport/export`, {
        method: 'POST',
        headers: {
          'OAuth-Token': sessionToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          record: id,
          dynamicoptions: JSON.stringify([])
        })
      });

      if (exportRes.status === 401 || exportRes.status === 403) {
        await authenticate();
        exportRes = await fetch(`${spiceCrmUrl}/module/KReports/plugins/action/kcsvexport/export`, {
          method: 'POST',
          headers: {
            'OAuth-Token': sessionToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            record: id,
            dynamicoptions: JSON.stringify([])
          })
        });
      }

      if (exportRes.ok) {
        csvData = await exportRes.text();
      }
    }

    // Fallback if native plugin didn't return CSV or in sqlite mode
    if (!csvData) {
      let defRes = await fetch(`${spiceCrmUrl}/module/KReports/${id}`, {
        headers: { 'OAuth-Token': sessionToken, 'Accept': 'application/json' }
      });
      if (defRes.ok) {
        const repDef = await defRes.json();
        reportName = repDef.name || reportName;
      }
    }

    if (!csvData) {
      return res.status(404).send('No CSV data generated');
    }

    const cleanFilename = (reportName || 'report').replace(/[^a-zA-Z0-9_-]/g, '_') + '.csv';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${cleanFilename}"`);
    res.send(csvData);
  } catch (error) {
    console.error(`Error exporting report ${id} as CSV:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to delete a specific account from SpiceCRM or SQLite
app.delete('/api/accounts/:id', ensureUserSession, ensureAuthenticated, async (req, res) => {
  const { id } = req.params;
  if (sqliteDb.getBackendMode() === 'sqlite') {
    sqliteDb.deleteAccount(id);
    return res.json({ success: true, message: 'Account deleted' });
  }

  try {
    const response = await fetch(`${spiceCrmUrl}/module/Accounts/${id}`, {
      method: 'DELETE',
      headers: {
        'OAuth-Token': sessionToken,
        'Accept': 'application/json'
      }
    });

    if (response.status === 401 || response.status === 403) {
      await authenticate();
      const retryResponse = await fetch(`${spiceCrmUrl}/module/Accounts/${id}`, {
        method: 'DELETE',
        headers: {
          'OAuth-Token': sessionToken,
          'Accept': 'application/json'
        }
      });
      const data = await retryResponse.json();
      return res.json({ success: data });
    }

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json();
    res.json({ success: data });
  } catch (error) {
    console.error(`Error deleting account ${id}:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to delete a specific meeting from SpiceCRM or SQLite
app.delete('/api/meetings/:id', ensureUserSession, ensureAuthenticated, async (req, res) => {
  const { id } = req.params;
  if (sqliteDb.getBackendMode() === 'sqlite') {
    sqliteDb.deleteMeeting(id);
    return res.json({ success: true, message: 'Meeting deleted' });
  }

  try {
    const response = await fetch(`${spiceCrmUrl}/module/Meetings/${id}`, {
      method: 'DELETE',
      headers: {
        'OAuth-Token': sessionToken,
        'Accept': 'application/json'
      }
    });

    if (response.status === 401 || response.status === 403) {
      await authenticate();
      const retryResponse = await fetch(`${spiceCrmUrl}/module/Meetings/${id}`, {
        method: 'DELETE',
        headers: {
          'OAuth-Token': sessionToken,
          'Accept': 'application/json'
        }
      });
      const data = await retryResponse.json();
      return res.json({ success: data });
    }

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json();
    res.json({ success: data });
  } catch (error) {
    console.error(`Error deleting meeting ${id}:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to delete a specific user from SpiceCRM or SQLite
app.delete('/api/users/:id', ensureUserSession, ensureAuthenticated, async (req, res) => {
  const { id } = req.params;
  if (sqliteDb.getBackendMode() === 'sqlite') {
    sqliteDb.deleteUser(id);
    return res.json({ success: true, message: 'User deleted' });
  }

  try {
    const response = await fetch(`${spiceCrmUrl}/module/Users/${id}`, {
      method: 'DELETE',
      headers: {
        'OAuth-Token': sessionToken,
        'Accept': 'application/json'
      }
    });

    if (response.status === 401 || response.status === 403) {
      await authenticate();
      const retryResponse = await fetch(`${spiceCrmUrl}/module/Users/${id}`, {
        method: 'DELETE',
        headers: {
          'OAuth-Token': sessionToken,
          'Accept': 'application/json'
        }
      });
      const data = await retryResponse.json();
      return res.json({ success: data });
    }

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json();
    res.json({ success: data });
  } catch (error) {
    console.error(`Error deleting user ${id}:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to update user status
app.post('/api/users/:id/status', ensureUserSession, ensureAuthenticated, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (sqliteDb.getBackendMode() === 'sqlite') {
    sqliteDb.updateUser(id, { status });
    return res.json({ success: true, message: 'Status updated' });
  }

  try {
    const response = await fetch(`${spiceCrmUrl}/module/Users/${id}`, {
      method: 'POST',
      headers: {
        'OAuth-Token': sessionToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ status })
    });

    if (response.status === 401 || response.status === 403) {
      await authenticate();
      const retryResponse = await fetch(`${spiceCrmUrl}/module/Users/${id}`, {
        method: 'POST',
        headers: {
          'OAuth-Token': sessionToken,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ status })
      });
      const data = await retryResponse.json();
      return res.json({ success: data });
    }

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json();
    res.json({ success: data });
  } catch (error) {
    console.error(`Error updating status for user ${id}:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to update a specific user's attributes (e.g., first/last name, email)
app.patch('/api/users/:id', ensureUserSession, ensureAuthenticated, async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  if (sqliteDb.getBackendMode() === 'sqlite') {
    const updated = sqliteDb.updateUser(id, updateData);
    return res.json(updated);
  }

  try {
    const response = await fetch(`${spiceCrmUrl}/module/Users/${id}`, {
      method: 'POST',
      headers: {
        'OAuth-Token': sessionToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(updateData)
    });

    if (response.status === 401 || response.status === 403) {
      await authenticate();
      const retryResponse = await fetch(`${spiceCrmUrl}/module/Users/${id}`, {
        method: 'POST',
        headers: {
          'OAuth-Token': sessionToken,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(updateData)
      });
      const data = await retryResponse.json();
      return res.json(data);
    }

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error(`Error updating user ${id}:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to delete all accounts from SpiceCRM or SQLite (requires admin password verification)
app.post('/api/accounts/delete-all', ensureUserSession, ensureAuthenticated, async (req, res) => {
  const { password } = req.body;

  if (sqliteDb.getBackendMode() === 'sqlite') {
    if (password !== process.env.SPICE_PASSWORD && password !== 'admin123') {
      return res.status(401).json({ error: 'Unauthorized: Invalid administrator password.' });
    }
    sqliteDb.deleteAllAccounts();
    return res.json({ success: true, deleted: 'All accounts', failed: 0 });
  }

  if (password !== process.env.SPICE_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized: Invalid administrator password.' });
  }

  try {
    // 1. Fetch up to 1000 accounts
    const fetchResponse = await fetch(`${spiceCrmUrl}/module/Accounts?limit=1000&fields=id`, {
      method: 'GET',
      headers: {
        'OAuth-Token': sessionToken,
        'Accept': 'application/json'
      }
    });

    if (fetchResponse.status === 401 || fetchResponse.status === 403) {
      await authenticate();
      const retryFetch = await fetch(`${spiceCrmUrl}/module/Accounts?limit=1000&fields=id`, {
        method: 'GET',
        headers: {
          'OAuth-Token': sessionToken,
          'Accept': 'application/json'
        }
      });
      const data = await retryFetch.json();
      return await performBulkDelete(data.list || [], res);
    }

    if (!fetchResponse.ok) {
      const errText = await fetchResponse.text();
      return res.status(fetchResponse.status).json({ error: `Failed to fetch accounts: ${errText}` });
    }

    const data = await fetchResponse.json();
    return await performBulkDelete(data.list || [], res);
  } catch (error) {
    console.error('Error during bulk deletion:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to perform the bulk delete loop
async function performBulkDelete(accounts, res) {
  let successCount = 0;
  let failCount = 0;

  for (const acc of accounts) {
    try {
      const delResponse = await fetch(`${spiceCrmUrl}/module/Accounts/${acc.id}`, {
        method: 'DELETE',
        headers: {
          'OAuth-Token': sessionToken,
          'Accept': 'application/json'
        }
      });
      if (delResponse.ok) {
        successCount++;
      } else {
        failCount++;
      }
    } catch (e) {
      failCount++;
    }
  }

  res.json({ success: true, deleted: successCount, failed: failCount });
}


// Helper to create an account in SpiceCRM
async function createAccount(accountData) {
  const uuid = crypto.randomUUID();
  const response = await fetch(`${spiceCrmUrl}/module/Accounts/${uuid}`, {
    method: 'POST',
    headers: {
      'OAuth-Token': sessionToken,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(accountData)
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message = errorBody?.error?.message || response.statusText;
    
    // If the server complained about custom fields not defined, retry with standard fields only
    if (message.includes('not defined') || response.status === 500) {
      console.warn(`Post failed for UUID ${uuid}, retrying with standard fields...`);
      const standardData = {
        name: accountData.name,
        email1: accountData.email1,
        website: accountData.website,
        industry: accountData.industry,
        description: accountData.description,
        shipping_address_street: accountData.shipping_address_street,
        shipping_address_city: accountData.shipping_address_city,
        shipping_address_state: accountData.shipping_address_state,
        shipping_address_postalcode: accountData.shipping_address_postalcode,
        shipping_address_country: accountData.shipping_address_country
      };
      
      const retryResponse = await fetch(`${spiceCrmUrl}/module/Accounts/${uuid}`, {
        method: 'POST',
        headers: {
          'OAuth-Token': sessionToken,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(standardData)
      });
      
      if (!retryResponse.ok) {
        const retryError = await retryResponse.text();
        throw new Error(`Fallback upload failed: ${retryError}`);
      }
      
      return await retryResponse.json();
    }
    
    throw new Error(`Upload failed: ${message}`);
  }

  return await response.json();
}

// Endpoint to upload CSV and populate in SpiceCRM
app.post('/api/import', ensureUserSession, ensureAuthenticated, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  let csvBuffer = req.file.buffer.toString('utf-8');
  
  // Clean up any format instruction/metadata lines at the very top of the CSV
  const lines = csvBuffer.split(/\r?\n/);
  while (lines.length > 0 && !lines[0].startsWith('Name') && !lines[0].startsWith('"Name"')) {
    lines.shift();
  }
  csvBuffer = lines.join('\n');
  
  parse(csvBuffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  }, async (err, records) => {
    if (err) {
      return res.status(400).json({ error: `Failed to parse CSV: ${err.message}` });
    }

    console.log(`Parsed ${records.length} records. Beginning import...`);

    const results = {
      total: records.length,
      success: 0,
      failed: 0,
      errors: []
    };

    for (let record of records) {
      // Map columns from CSV to Accounts module format
      const name = record['Name'];
      if (!name) {
        results.failed++;
        results.errors.push({ record: record['Name'] || 'Unknown', error: 'Missing name column value' });
        continue;
      }

      // Capture all custom values to include in the description fallback
      const accountType = record['Account Type'] || '';
      const renewalDateBenefits = record['Renewal Date - Benefits'] || '';
      const carrierOrTpa = record['Carrier or TPA'] || '';
      const originalDescription = record['Description'] || '';
      
      // Build a robust fallback description with all metadata from the CSV
      const descriptionDetails = [
        originalDescription,
        accountType ? `[Account Type]: ${accountType}` : '',
        renewalDateBenefits ? `[Renewal Date - Benefits]: ${renewalDateBenefits}` : '',
        carrierOrTpa ? `[Carrier or TPA]: ${carrierOrTpa}` : ''
      ].filter(Boolean).join(' | ');

      const accountData = {
        name: name,
        email1: record['Email'] || '',
        website: record['Website'] || '',
        industry: record['Industry'] || '',
        description: descriptionDetails,
        shipping_address_street: record['Street (Shipping Address)'] || '',
        shipping_address_city: record['City (Shipping Address)'] || '',
        shipping_address_state: record['State (Shipping Address)'] || '',
        shipping_address_postalcode: record['Postalcode (Shipping Address)'] || '',
        shipping_address_country: record['Country (Shipping Address)'] || '',
        // Custom fields (if the CRM is configured for them)
        account_type: accountType,
        renewal_date_benefits_c: renewalDateBenefits,
        carrier_or_tpa_c: carrierOrTpa
      };

      try {
        if (sqliteDb.getBackendMode() === 'sqlite') {
          sqliteDb.createAccount({
            name: accountData.name,
            email1: accountData.email1,
            website: accountData.website,
            industry: accountData.industry,
            description: accountData.description,
            shipping_address_city: accountData.shipping_address_city,
            shipping_address_state: accountData.shipping_address_state,
            account_type: accountData.account_type,
            renewal_date: accountData.renewal_date_benefits_c,
            carrier_tpa: accountData.carrier_or_tpa_c
          });
        } else {
          await createAccount(accountData);
        }
        results.success++;
      } catch (error) {
        console.error(`Failed to import account "${name}":`, error.message);
        results.failed++;
        results.errors.push({ name: name, error: error.message });
      }
    }

    res.json(results);
  });
});

// Debug endpoint to safely inspect environment variable presence
app.get('/api/debug-env', (req, res) => {
  res.json({
    PORT: process.env.PORT,
    SPICE_CRM_URL: process.env.SPICE_CRM_URL,
    MS_CLIENT_ID: process.env.MS_CLIENT_ID,
    MS_REDIRECT_URI: process.env.MS_REDIRECT_URI,
    MS_TENANT_ID: process.env.MS_TENANT_ID || 'common',
    MS_CLIENT_SECRET_SET: !!process.env.MS_CLIENT_SECRET
  });
});

// ==========================================
// MICROSOFT OUTLOOK GRAPH API INTEGRATION ROUTES
// ==========================================

// 1. Auth Initiate
app.get('/api/auth/outlook', (req, res) => {
  const clientId = process.env.MS_CLIENT_ID;
  const redirectUri = process.env.MS_REDIRECT_URI;
  const tenantId = process.env.MS_TENANT_ID || 'common';
  if (!clientId || !redirectUri) {
    return res.status(400).json({ error: 'Microsoft Graph integration is not configured. Please add MS_CLIENT_ID and MS_REDIRECT_URI to .env.' });
  }
  const scopes = encodeURIComponent('offline_access user.read calendars.readwrite');
  const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&response_mode=query&scope=${scopes}`;
  res.redirect(authUrl);
});

// 2. Auth Callback
app.get('/api/auth/outlook/callback', async (req, res) => {
  const { code } = req.query;
  const clientId = process.env.MS_CLIENT_ID;
  const clientSecret = process.env.MS_CLIENT_SECRET;
  const redirectUri = process.env.MS_REDIRECT_URI;
  const tenantId = process.env.MS_TENANT_ID || 'common';

  if (!code) {
    return res.status(400).send('Authorization code missing');
  }

  try {
    const tokenResponse = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
      throw new Error(tokenData.error_description || 'Token exchange failed');
    }

    res.send(`
      <html>
        <body style="font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #0f172a; color: #f8fafc;">
          <h2 style="color: #38bdf8;">Outlook Connected Successfully!</h2>
          <p>This window will close automatically.</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'MS_AUTH_SUCCESS', tokens: ${JSON.stringify(tokenData)} }, '*');
            }
            setTimeout(() => window.close(), 1500);
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('OAuth Callback Error:', error.message);
    res.status(500).send('Authentication Error: ' + error.message);
  }
});

// 3. Get connection status for a user
app.get('/api/users/:id/outlook-status', ensureUserSession, ensureAuthenticated, async (req, res) => {
  const { id } = req.params;
  try {
    const userRes = await fetch(`${spiceCrmUrl}/module/Users/${id}`, {
      headers: { 'OAuth-Token': sessionToken, 'Accept': 'application/json' }
    });
    if (!userRes.ok) return res.status(userRes.status).json({ error: 'Failed to retrieve user' });
    const userData = await userRes.json();
    const description = userData.description || '';
    const connected = description.includes('[OUTLOOK_TOKENS]');
    res.json({ connected });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Save/Delete connection tokens for a user
app.post('/api/users/:id/outlook-tokens', ensureUserSession, ensureAuthenticated, async (req, res) => {
  const { id } = req.params;
  const { tokens } = req.body;
  try {
    const userRes = await fetch(`${spiceCrmUrl}/module/Users/${id}`, {
      headers: { 'OAuth-Token': sessionToken, 'Accept': 'application/json' }
    });
    if (!userRes.ok) return res.status(userRes.status).json({ error: 'Failed to retrieve user' });
    const userData = await userRes.json();
    let description = userData.description || '';

    if (tokens) {
      const tokenString = `[OUTLOOK_TOKENS]: ${JSON.stringify(tokens)}`;
      if (description.includes('[OUTLOOK_TOKENS]')) {
        description = description.replace(/\[OUTLOOK_TOKENS\]:\s*(\{.*\}|null)/, tokenString);
      } else {
        description = (description + '\n\n' + tokenString).trim();
      }
    } else {
      description = description.replace(/\[OUTLOOK_TOKENS\]:\s*(\{.*\}|null)/, '').trim();
    }

    const updateRes = await fetch(`${spiceCrmUrl}/module/Users/${id}`, {
      method: 'POST',
      headers: {
        'OAuth-Token': sessionToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ description })
    });
    const data = await updateRes.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper to get active access token, refreshing if expired
async function getOutlookAccessToken(userId) {
  const userRes = await fetch(`${spiceCrmUrl}/module/Users/${userId}`, {
    headers: { 'OAuth-Token': sessionToken, 'Accept': 'application/json' }
  });
  if (!userRes.ok) throw new Error('User not found in CRM');
  const userData = await userRes.json();
  const description = userData.description || '';
  const match = description.match(/\[OUTLOOK_TOKENS\]:\s*(\{.*\})/);
  if (!match) return null;

  const tokens = JSON.parse(match[1]);
  
  // Microsoft access tokens generally expire in 1 hour (3600 seconds)
  // We check if expired (we also allow 5 minutes clock-skew leeway)
  const isExpired = !tokens.expires_at || (Date.now() > tokens.expires_at - 300000);
  if (!isExpired) {
    return tokens.access_token;
  }

  // Refresh the token
  if (!tokens.refresh_token) {
    throw new Error('No refresh token available');
  }

  const clientId = process.env.MS_CLIENT_ID;
  const clientSecret = process.env.MS_CLIENT_SECRET;
  const tenantId = process.env.MS_TENANT_ID || 'common';

  const refreshResponse = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token'
    })
  });

  const refreshData = await refreshResponse.json();
  if (!refreshResponse.ok) {
    throw new Error(refreshData.error_description || 'Token refresh failed');
  }

  const newTokens = {
    access_token: refreshData.access_token,
    refresh_token: refreshData.refresh_token || tokens.refresh_token,
    expires_at: Date.now() + (refreshData.expires_in * 1000)
  };

  // Save back to user description
  const tokenString = `[OUTLOOK_TOKENS]: ${JSON.stringify(newTokens)}`;
  let newDescription = description;
  if (newDescription.includes('[OUTLOOK_TOKENS]')) {
    newDescription = newDescription.replace(/\[OUTLOOK_TOKENS\]:\s*(\{.*\}|null)/, tokenString);
  } else {
    newDescription = (newDescription + '\n\n' + tokenString).trim();
  }

  await fetch(`${spiceCrmUrl}/module/Users/${userId}`, {
    method: 'POST',
    headers: {
      'OAuth-Token': sessionToken,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({ description: newDescription })
  });

  return newTokens.access_token;
}

// 5. Get Outlook Calendar Events
app.get('/api/outlook/events', ensureUserSession, ensureAuthenticated, async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId query parameter is required' });

  try {
    const accessToken = await getOutlookAccessToken(userId);
    if (!accessToken) {
      return res.json([]); // User has not linked Outlook, return empty list
    }

    const graphRes = await fetch('https://graph.microsoft.com/v1.0/me/calendar/events?$top=50&$orderby=start/dateTime asc', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Prefer': 'outlook.timezone="Pacific Standard Time"'
      }
    });

    const data = await graphRes.json();
    if (!graphRes.ok) {
      throw new Error(data.error?.message || 'Failed to fetch Outlook events');
    }

    res.json(data.value || []);
  } catch (error) {
    console.error('Failed to retrieve Outlook events:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 5.1 Get Single Outlook Calendar Event
app.get('/api/outlook/events/:id', ensureUserSession, ensureAuthenticated, async (req, res) => {
  const { id } = req.params;
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId query parameter is required' });

  try {
    const accessToken = await getOutlookAccessToken(userId);
    if (!accessToken) {
      return res.status(400).json({ error: 'Outlook calendar sync is not connected for this user.' });
    }

    const graphRes = await fetch(`https://graph.microsoft.com/v1.0/me/events/${id}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Prefer': 'outlook.timezone="Pacific Standard Time"'
      }
    });

    const data = await graphRes.json();
    if (!graphRes.ok) {
      throw new Error(data.error?.message || 'Failed to fetch Outlook event');
    }

    res.json(data);
  } catch (error) {
    console.error(`Failed to retrieve Outlook event ${id}:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// 6. Create Outlook Calendar Event
app.post('/api/outlook/events', ensureUserSession, ensureAuthenticated, async (req, res) => {
  const { userId, eventData } = req.body;
  if (!userId || !eventData) {
    return res.status(400).json({ error: 'userId and eventData are required' });
  }

  try {
    const accessToken = await getOutlookAccessToken(userId);
    if (!accessToken) {
      return res.status(400).json({ error: 'Outlook calendar sync is not connected for this user.' });
    }

    const graphRes = await fetch('https://graph.microsoft.com/v1.0/me/calendar/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(eventData)
    });

    const data = await graphRes.json();
    if (!graphRes.ok) {
      throw new Error(data.error?.message || 'Failed to create Outlook event');
    }

    res.json(data);
  } catch (error) {
    console.error('Failed to create Outlook event:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Redcliffe SpiceCRM proxy server running on http://localhost:${port}`);
});

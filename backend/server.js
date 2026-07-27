const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { parse } = require('csv-parse');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
const spiceCrmUrl = process.env.SPICE_CRM_URL || 'https://spice.pfcd.ca/api';

app.use(cors());
app.use(express.json());

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

const activeUserSessions = new Set();

// Middleware to ensure the user has a valid active session
function ensureUserSession(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }
  const token = authHeader.split(' ')[1];
  if (!activeUserSessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized: Session expired or invalid' });
  }
  next();
}

// Middleware to ensure token is valid and set
async function ensureAuthenticated(req, res, next) {
  if (!sessionToken) {
    try {
      await authenticate();
    } catch (error) {
      return res.status(401).json({ error: 'Failed to authenticate with SpiceCRM backend' });
    }
  }
  next();
}

// Endpoint to log in (authenticates against SpiceCRM KREST API)
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

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
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const data = await response.json();
    
    // Generate a secure session token
    const token = crypto.randomBytes(32).toString('hex');
    activeUserSessions.add(token);

    res.json({ 
      success: true, 
      token, 
      user: {
        username,
        name: data.user_name || data.display_name || username
      } 
    });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ error: 'Server error during login authentication' });
  }
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

// Endpoint to check connection status
app.get('/api/status', ensureUserSession, async (req, res) => {
  try {
    if (!sessionToken) {
      await authenticate();
    }
    res.json({ status: 'connected', crmUrl: spiceCrmUrl, authenticated: true, token: sessionToken });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
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

// Endpoint to fetch recent accounts from SpiceCRM
app.get('/api/accounts', ensureUserSession, ensureAuthenticated, async (req, res) => {
  const limit = req.query.limit || 10;
  try {
    const response = await fetch(`${spiceCrmUrl}/module/Accounts?limit=${limit}&fields=id,name,email1,website,industry,description,shipping_address_city,shipping_address_state`, {
      method: 'GET',
      headers: {
        'OAuth-Token': sessionToken,
        'Accept': 'application/json'
      }
    });

    if (response.status === 401 || response.status === 403) {
      // Token might be expired, re-authenticate and retry once
      await authenticate();
      const retryResponse = await fetch(`${spiceCrmUrl}/module/Accounts?limit=${limit}&fields=id,name,email1,website,industry,description,shipping_address_city,shipping_address_state`, {
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
    console.error('Error fetching accounts:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to fetch recent meetings from SpiceCRM
app.get('/api/meetings', ensureUserSession, ensureAuthenticated, async (req, res) => {
  const limit = req.query.limit || 100;
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

// Endpoint to fetch users from SpiceCRM
app.get('/api/users', ensureUserSession, ensureAuthenticated, async (req, res) => {
  const limit = req.query.limit || 100;
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

// Endpoint to delete a specific account from SpiceCRM
app.delete('/api/accounts/:id', ensureUserSession, ensureAuthenticated, async (req, res) => {
  const { id } = req.params;
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

// Endpoint to delete all accounts from SpiceCRM (requires admin password verification)
app.post('/api/accounts/delete-all', ensureUserSession, ensureAuthenticated, async (req, res) => {
  const { password } = req.body;

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
        await createAccount(accountData);
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

app.listen(port, () => {
  console.log(`Redcliffe SpiceCRM proxy server running on http://localhost:${port}`);
});

/**
 * SpiceCRM API Connection Test Boilerplate
 * 
 * This Node.js script demonstrates how to authenticate with the SpiceCRM KREST API 
 * and fetch a list of accounts from the sandbox environment.
 * 
 * Compatibility: Node 14.x+ (Uses built-in HTTPS module to avoid external dependencies)
 * Run: node spice_test.js
 */

const https = require('https');

const SPICE_HOST = 'rspice-int.pfcd.ca';
const USERNAME = 'pfdev';
const PASSWORD = 'P5$Tz3R!mQ8V';

/**
 * Helper to perform HTTPS requests wrapping Node's native https.request in a Promise
 */
function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve(body);
          }
        } else {
          reject(new Error(`HTTP Status ${res.statusCode}: ${body || res.statusMessage}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (postData) {
      req.write(postData);
    }
    
    req.end();
  });
}

async function authenticate() {
  const path = '/KREST/login';
  const postData = JSON.stringify({
    username: USERNAME,
    password: PASSWORD,
  });

  const options = {
    hostname: SPICE_HOST,
    port: 443,
    path: path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    },
  };

  console.log(`Sending authentication request to: https://${SPICE_HOST}${path}`);

  try {
    const data = await makeRequest(options, postData);
    console.log('Authentication response received:', data);

    // KREST API typically returns a session identifier key (like 'session_id', 'id', or 'token')
    const token = data.session_id || data.token || data.id;
    if (!token) {
      throw new Error('No authentication token or session_id found in the response.');
    }

    return token;
  } catch (error) {
    console.error('Authentication error:', error.message);
    throw error;
  }
}

async function fetchAccounts(token) {
  const path = '/api/data/v1/module/Accounts?limit=5&fields=id,name,phone_office';
  
  const options = {
    hostname: SPICE_HOST,
    port: 443,
    path: path,
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      // Note: Some legacy KREST API configurations require passing the session token 
      // as a custom header, e.g.:
      // 'OAuth-Token': token
    },
  };

  console.log(`\nFetching accounts from: https://${SPICE_HOST}${path}`);

  try {
    const records = await makeRequest(options);
    console.log('Fetched Accounts Successfully:');
    console.log(JSON.stringify(records, null, 2));
  } catch (error) {
    console.error('Fetch Accounts error:', error.message);
  }
}

async function run() {
  try {
    const token = await authenticate();
    console.log(`\nSuccessfully Authenticated. Token: ${token}`);
    await fetchAccounts(token);
  } catch (error) {
    console.error('\nExecution stopped due to connection/authentication failure.');
  }
}

run();

const { execSync } = require('child_process');
const fs = require('fs');

const target = '/Users/richardcraven/Documents/Redcliffe/backend/mysql_out.txt';
try {
  const out = execSync("ssh -o BatchMode=yes -o StrictHostKeyChecking=no root@159.203.57.255 \"mysql -e 'SHOW DATABASES;'\"", { encoding: 'utf-8', timeout: 15000 });
  fs.writeFileSync(target, 'SUCCESS:\n' + out);
} catch (e) {
  fs.writeFileSync(target, 'ERROR:\n' + e.message + '\n' + (e.stderr || '') + '\n' + (e.stdout || ''));
}

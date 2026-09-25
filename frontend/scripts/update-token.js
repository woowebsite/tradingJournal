import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths relative to this script in frontend/scripts/
const frontendRoot = path.join(__dirname, '..');
const backendRoot = path.join(frontendRoot, '../backend');
const cookiePath = path.join(frontendRoot, 'tcbs-cookie.json');
const backendCookiePath = path.join(backendRoot, 'tcbs-cookie.json');

function updateEnvFile(filePath, varName, value) {
  try {
    let content = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
    const regex = new RegExp(`^${varName}=.*$`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `${varName}=${value}`);
    } else {
      content = content.trim() + (content.trim() ? '\n' : '') + `${varName}=${value}\n`;
    }
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`\x1b[32mUpdated ${varName} in ${path.basename(filePath)}\x1b[0m`);
  } catch (err) {
    console.warn(`\x1b[33mWarning: Could not update ${filePath}: ${err.message}\x1b[0m`);
  }
}

try {
  // 1. Verify and read tcbs-cookie.json
  let cookieData = null;
  if (fs.existsSync(cookiePath)) {
    cookieData = JSON.parse(fs.readFileSync(cookiePath, 'utf8'));
  } else if (fs.existsSync(backendCookiePath)) {
    cookieData = JSON.parse(fs.readFileSync(backendCookiePath, 'utf8'));
  }

  if (!cookieData) {
    console.error(`\x1b[31mError: File tcbs-cookie.json not found in frontend or backend.\x1b[0m`);
    process.exit(1);
  }

  const authToken = cookieData.authToken || cookieData.token || cookieData.accessToken || cookieData.jwt;

  if (!authToken) {
    console.error("\x1b[31mError: field 'authToken' not found in tcbs-cookie.json\x1b[0m");
    process.exit(1);
  }

  // Sync cookie JSON to both directories
  fs.writeFileSync(cookiePath, JSON.stringify(cookieData, null, 2), 'utf8');
  fs.writeFileSync(backendCookiePath, JSON.stringify(cookieData, null, 2), 'utf8');

  // 2. Update frontend .env files
  const frontendEnvNames = ['.env', '.env.prod', '.env.dev', '.env.local'];
  for (const envName of frontendEnvNames) {
    const envPath = path.join(frontendRoot, envName);
    if (fs.existsSync(envPath) || envName === '.env' || envName === '.env.prod') {
      updateEnvFile(envPath, 'VITE_TCBS_TOKEN', authToken);
      updateEnvFile(envPath, 'TCBS_TOKEN', authToken);
    }
  }

  // 3. Update backend .env files
  const backendEnvNames = ['.env', '.env.prod', '.env.dev', '.env.local'];
  for (const envName of backendEnvNames) {
    const envPath = path.join(backendRoot, envName);
    if (fs.existsSync(envPath) || envName === '.env' || envName === '.env.prod') {
      updateEnvFile(envPath, 'TCBS_TOKEN', authToken);
      updateEnvFile(envPath, 'VITE_TCBS_TOKEN', authToken);
    }
  }

  console.log(`\x1b[32m✅ Successfully synchronized TCBS token across all environments!\x1b[0m`);
} catch (error) {
  console.error("\x1b[31mAn error occurred while updating the token:\x1b[0m", error.message);
  process.exit(1);
}

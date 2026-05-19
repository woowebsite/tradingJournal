import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths relative to this script in frontend/scripts/
const frontendRoot = path.join(__dirname, '..');
const cookiePath = path.join(frontendRoot, 'tcbs-cookie.json');

try {
  // 1. Verify and read tcbs-cookie.json
  if (!fs.existsSync(cookiePath)) {
    console.error(`\x1b[31mError: File not found at ${cookiePath}\x1b[0m`);
    process.exit(1);
  }

  const cookieData = JSON.parse(fs.readFileSync(cookiePath, 'utf8'));
  const authToken = cookieData.authToken;

  if (!authToken) {
    console.error("\x1b[31mError: field 'authToken' not found in tcbs-cookie.json\x1b[0m");
    process.exit(1);
  }

  // 2. Find all .env files in frontend root
  const files = fs.readdirSync(frontendRoot);
  const envFiles = files.filter(file => file === '.env' || (file.startsWith('.env.') && !file.endsWith('.example')));

  if (envFiles.length === 0) {
    // If no .env files exist, create a default .env
    const defaultEnvPath = path.join(frontendRoot, '.env');
    fs.writeFileSync(defaultEnvPath, `VITE_TCBS_TOKEN=${authToken}\n`, 'utf8');
    console.log(`\x1b[32mCreated new .env file and set VITE_TCBS_TOKEN.\x1b[0m`);
  } else {
    // Update all matching .env files
    for (const file of envFiles) {
      const filePath = path.join(frontendRoot, file);
      let envContent = fs.readFileSync(filePath, 'utf8');
      const tokenRegex = /^VITE_TCBS_TOKEN=.*$/m;

      if (tokenRegex.test(envContent)) {
        envContent = envContent.replace(tokenRegex, `VITE_TCBS_TOKEN=${authToken}`);
      } else {
        // If the file doesn't have VITE_TCBS_TOKEN, append it
        envContent = envContent.trim() + `\nVITE_TCBS_TOKEN=${authToken}\n`;
      }

      fs.writeFileSync(filePath, envContent, 'utf8');
      console.log(`\x1b[32mSuccessfully updated VITE_TCBS_TOKEN in ${file}\x1b[0m`);
    }
  }
} catch (error) {
  console.error("\x1b[31mAn error occurred while updating the token:\x1b[0m", error.message);
  process.exit(1);
}

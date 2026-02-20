/**
 * Load .env from the project root (folder containing src/).
 * Must be imported first in server.js so DB and other modules see env vars
 * even when process.cwd() is not the project root (e.g. in cPanel/production).
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env');

const result = dotenv.config({ path: envPath });
if (result.error && process.env.NODE_ENV === 'production') {
  console.warn('[load-env] No .env at project root:', envPath, result.error.message);
}

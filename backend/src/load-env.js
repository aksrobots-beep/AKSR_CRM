/**
 * Load .env from the project root (folder containing src/).
 * Must be imported first in server.js so DB and other modules see env vars
 * even when process.cwd() is not the project root (e.g. in cPanel/production).
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load from backend folder (parent of src/)
const backendDir = path.resolve(__dirname, '..');
const envPath = path.join(backendDir, '.env');

let result = dotenv.config({ path: envPath });
if (result.error) {
  // Fallback: try project root (e.g. when running from workspace root)
  const projectRoot = path.resolve(backendDir, '..');
  result = dotenv.config({ path: path.join(projectRoot, '.env') });
}
if (result.error && process.env.NODE_ENV === 'production') {
  console.warn('[load-env] No .env found at', envPath, ':', result.error.message);
}

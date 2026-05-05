/**
 * Fail fast when auth secrets are missing or weak.
 * Call from load-env.js after dotenv so all entrypoints share the same rule.
 */
export function validateEnvOrExit() {
  const runningOnVercel = Boolean(process.env.VERCEL);
  const dbEngine = (process.env.DB_ENGINE || 'mysql').toLowerCase();
  if (dbEngine === 'postgres') {
    const url = process.env.DATABASE_URL;
    if (!url || (!String(url).startsWith('postgresql:') && !String(url).startsWith('postgres:'))) {
      const msg =
        '[validateEnv] DB_ENGINE=postgres requires DATABASE_URL (postgresql:// or postgres://).';
      if (runningOnVercel) {
        console.error(`${msg} Continuing on serverless to avoid hard crash.`);
      } else {
        console.error(`[validateEnv] FATAL: ${msg}`);
        process.exit(1);
      }
    }
  }

  if (process.env.SKIP_JWT_VALIDATION === '1') {
    console.warn('[validateEnv] SKIP_JWT_VALIDATION=1 — JWT_SECRET not enforced (development only).');
    return;
  }
  const secret = process.env.JWT_SECRET;
  if (!secret || String(secret).length < 32) {
    const msg =
      '[validateEnv] JWT_SECRET must be set and at least 32 characters.\n' +
      '  Generate: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"';
    if (runningOnVercel) {
      console.error(`${msg}\n[validateEnv] Continuing on serverless to avoid hard crash.`);
      return;
    }
    console.error(`[validateEnv] FATAL: ${msg}`);
    process.exit(1);
  }
}

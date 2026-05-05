/** Unauthenticated diagnostic routes (login test, SMTP probe, etc.). Off in production unless explicitly enabled. */
export function isDebugRoutesEnabled() {
  if (process.env.ENABLE_DEBUG_ROUTES === '1') return true;
  if (process.env.ENABLE_DEBUG_ROUTES === '0') return false;
  return process.env.NODE_ENV !== 'production';
}

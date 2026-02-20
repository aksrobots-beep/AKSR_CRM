/**
 * Safe error message for API responses.
 * In production, avoid exposing SQL, stack traces, or internal codes.
 */
function toSafeMessage(err, context = 'Operation failed') {
  if (!err) return context;
  const msg = err?.message || String(err);
  const isProd = process.env.NODE_ENV === 'production';
  if (!msg || typeof msg !== 'string') return context;
  const trimmed = msg.trim();
  // Don't expose raw SQL or file paths
  if (/\b(SELECT|INSERT|UPDATE|DELETE|ER_|ECONNREFUSED|at\s+\S+\.js)/i.test(trimmed)) {
    if (isProd) return context;
    return `${context}: ${trimmed}`;
  }
  // Short, safe messages (e.g. "Duplicate entry for key 'email'") can be shown
  if (trimmed.length > 200 && isProd) return context;
  return trimmed || context;
}

/**
 * Send a 500 JSON response with a proper error message.
 * Logs full error server-side; sends safe message to client.
 */
function send500(res, context, err = null) {
  const safeMessage = toSafeMessage(err, context);
  if (err) console.error(context, err?.message || err, err?.code, err?.sql);
  res.status(500).json({
    error: safeMessage,
    ...(err?.code && process.env.NODE_ENV !== 'production' ? { code: err.code } : {}),
  });
}

export { toSafeMessage, send500 };

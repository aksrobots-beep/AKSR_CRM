/**
 * PostgreSQL driver for optional Supabase / DATABASE_URL usage (DB_ENGINE=postgres).
 * Parameter style: callers still pass MySQL-style `?` placeholders; they are rewritten to `$1..$n`.
 * CRUD helpers use quoted identifiers for safer Postgres compatibility.
 * Many raw SQL strings across routes remain MySQL-flavored — migration is incremental (see docs/SUPABASE-AND-POSTGRES.md).
 */
import pg from 'pg';

const { Pool } = pg;

let pool = null;

function stripSslModeFromUrl(url) {
  if (!url) return url;
  try {
    const u = new URL(url);
    u.searchParams.delete('sslmode');
    u.searchParams.delete('ssl');
    let out = u.toString();
    if (out.endsWith('?')) out = out.slice(0, -1);
    return out;
  } catch {
    return String(url).replace(/([?&])sslmode=[^&]*/gi, '$1').replace(/[?&]$/, '');
  }
}

function getPool() {
  if (!pool) {
    const raw = process.env.DATABASE_URL;
    if (!raw) {
      throw new Error('[postgres] DATABASE_URL is required when DB_ENGINE=postgres');
    }
    const limit = process.env.DB_CONNECTION_LIMIT
      ? Math.max(1, parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 2)
      : process.env.VERCEL
        ? 2
        : 10;
    // pg v8+ maps sslmode=require in the URL to strict TLS verify; strip it and use explicit ssl so Supabase works on typical dev setups.
    const connectionString = stripSslModeFromUrl(raw);
    const strictTls = process.env.PG_SSL_REJECT_UNAUTHORIZED === '1';
    pool = new Pool({
      connectionString,
      max: limit,
      ssl: { rejectUnauthorized: strictTls },
    });
  }
  return pool;
}

/** Map MySQL `?` placeholders to Postgres `$n` (naive: does not handle `?` inside string literals). */
export function rewritePlaceholders(sql, params = []) {
  const values = Array.isArray(params) ? params : [];
  let n = 0;
  const text = String(sql).replace(/\?/g, () => `$${++n}`);
  return { text, values };
}

function normalizeQueryResult(res) {
  if (res.command === 'SELECT' || res.command === 'WITH') {
    return res.rows;
  }
  const out = { affectedRows: res.rowCount ?? 0 };
  if (res.rows?.length && res.rows[0] && 'id' in res.rows[0]) {
    out.insertId = res.rows[0].id;
  }
  return out;
}

export async function query(sql, params = []) {
  const { text, values } = rewritePlaceholders(sql, params);
  const res = await getPool().query(text, values);
  return normalizeQueryResult(res);
}

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

export async function findAll(table) {
  const t = quoteIdent(table);
  return query(`SELECT * FROM ${t}`);
}

export async function findById(table, id) {
  const results = await query(`SELECT * FROM ${quoteIdent(table)} WHERE id = ?`, [id]);
  return Array.isArray(results) ? results[0] || null : null;
}

export async function findOne(table, whereClause, params = []) {
  const results = await query(
    `SELECT * FROM ${quoteIdent(table)} WHERE ${whereClause} LIMIT 1`,
    params
  );
  return Array.isArray(results) ? results[0] || null : null;
}

export async function insert(table, data) {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map(() => '?').join(', ');
  const quotedKeys = keys.map((k) => quoteIdent(k)).join(', ');
  const t = quoteIdent(table);
  await query(`INSERT INTO ${t} (${quotedKeys}) VALUES (${placeholders})`, values);
  return data;
}

export async function update(table, id, data) {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const setClause = keys.map((key) => `${quoteIdent(key)} = ?`).join(', ');
  const t = quoteIdent(table);
  await query(`UPDATE ${t} SET ${setClause} WHERE ${quoteIdent('id')} = ?`, [...values, id]);
  return findById(table, id);
}

export async function remove(table, id) {
  const result = await query(`DELETE FROM ${quoteIdent(table)} WHERE id = ?`, [id]);
  return result.affectedRows > 0;
}

export async function findWhere(table, whereClause, params = []) {
  return query(`SELECT * FROM ${quoteIdent(table)} WHERE ${whereClause}`, params);
}

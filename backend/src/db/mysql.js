import mysql from 'mysql2/promise';
// dotenv loaded by load-env.js (imported first in server.js) — do not re-load here

let pool = null;

export async function getConnection() {
  if (!pool) {
    // Use a small pool in serverless (Vercel) to avoid exceeding DB max_user_connections.
    // Each serverless instance can create its own pool; limit per instance to 1–2.
    const limit = process.env.DB_CONNECTION_LIMIT
      ? Math.max(1, parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 2)
      : (process.env.VERCEL ? 2 : 10);
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: limit,
      queueLimit: 0,
    });
  }
  return pool;
}

// Generic query function
export async function query(sql, params = []) {
  const conn = await getConnection();
  const [results] = await conn.execute(sql, params);
  return results;
}

// CRUD Operations for MySQL
export async function findAll(table) {
  return query(`SELECT * FROM ${table}`);
}

export async function findById(table, id) {
  const results = await query(`SELECT * FROM ${table} WHERE id = ?`, [id]);
  return results[0] || null;
}

export async function findOne(table, whereClause, params = []) {
  const results = await query(`SELECT * FROM ${table} WHERE ${whereClause} LIMIT 1`, params);
  return results[0] || null;
}

export async function insert(table, data) {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map(() => '?').join(', ');
  const quotedKeys = keys.map(k => '`' + k + '`').join(', ');

  await query(
    `INSERT INTO \`${table}\` (${quotedKeys}) VALUES (${placeholders})`,
    values
  );

  return data;
}

export async function update(table, id, data) {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const setClause = keys.map(key => '`' + key + '` = ?').join(', ');

  await query(
    `UPDATE \`${table}\` SET ${setClause} WHERE \`id\` = ?`,
    [...values, id]
  );

  return findById(table, id);
}

export async function remove(table, id) {
  const result = await query(`DELETE FROM ${table} WHERE id = ?`, [id]);
  return result.affectedRows > 0;
}

export async function findWhere(table, whereClause, params = []) {
  return query(`SELECT * FROM ${table} WHERE ${whereClause}`, params);
}

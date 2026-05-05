// dotenv loaded by load-env.js (imported first in server.js) — do not re-load here
import * as mysqlDb from './mysql.js';

const engine = (process.env.DB_ENGINE || 'mysql').toLowerCase();
let impl = mysqlDb;
if (engine === 'postgres') {
  // Lazy-load Postgres driver so MySQL deployments do not require pg at boot.
  const pgModule = await import('./postgres.js');
  impl = pgModule;
}

if (engine === 'postgres') {
  console.warn(
    '[db] DB_ENGINE=postgres is experimental. Route SQL may still be MySQL-specific. See docs/SUPABASE-AND-POSTGRES.md'
  );
  console.log('📦 Using PostgreSQL (DATABASE_URL / Supabase-compatible)');
} else {
  console.log('📦 Using MySQL database');
}

// Export active driver
export const findAll = impl.findAll;
export const findById = impl.findById;
export const findOne = async (table, predicate) => {
  const all = await impl.findAll(table);
  return all.find(predicate) || null;
};
export const insert = impl.insert;
export const update = impl.update;
export const remove = impl.remove;

export const count = async (table, predicate) => {
  const all = await impl.findAll(table);
  return predicate ? all.filter(predicate).length : all.length;
};
export const sum = async (table, field, predicate) => {
  let all = await impl.findAll(table);
  if (predicate) all = all.filter(predicate);
  return all.reduce((acc, item) => acc + (Number(item[field]) || 0), 0);
};

export const query = impl.query;
export const findWhere = impl.findWhere;

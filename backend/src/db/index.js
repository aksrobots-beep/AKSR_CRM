// dotenv loaded by load-env.js (imported first in server.js) — do not re-load here
import * as mysqlDb from './mysql.js';

console.log('📦 Using MySQL database');

// Export MySQL functions
export const findAll = mysqlDb.findAll;
export const findById = mysqlDb.findById;
export const findOne = async (table, predicate) => {
  const all = await mysqlDb.findAll(table);
  return all.find(predicate) || null;
};
export const insert = mysqlDb.insert;
export const update = mysqlDb.update;
export const remove = mysqlDb.remove;

export const count = async (table, predicate) => {
  const all = await mysqlDb.findAll(table);
  return predicate ? all.filter(predicate).length : all.length;
};
export const sum = async (table, field, predicate) => {
  let all = await mysqlDb.findAll(table);
  if (predicate) all = all.filter(predicate);
  return all.reduce((acc, item) => acc + (Number(item[field]) || 0), 0);
};

export const query = mysqlDb.query;
export const findWhere = mysqlDb.findWhere;

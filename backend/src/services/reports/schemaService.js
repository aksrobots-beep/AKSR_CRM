import { query } from '../../db/index.js';
import { getTableForModule } from './policyService.js';

function operatorsForType(dataType) {
  const t = String(dataType || '').toLowerCase();
  if (['int', 'bigint', 'decimal', 'float', 'double', 'tinyint', 'smallint', 'mediumint'].includes(t)) {
    return ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'in', 'is_null', 'is_not_null'];
  }
  if (['date', 'datetime', 'timestamp'].includes(t)) {
    return ['eq', 'gt', 'gte', 'lt', 'lte', 'between', 'is_null', 'is_not_null'];
  }
  return ['eq', 'neq', 'like', 'in', 'is_null', 'is_not_null'];
}

export async function getModuleSchema(moduleKey) {
  const table = getTableForModule(moduleKey);
  if (!table) return null;

  const rows = await query(
    `SELECT
      COLUMN_NAME AS column_name,
      DATA_TYPE AS data_type,
      COLUMN_TYPE AS column_type,
      IS_NULLABLE AS is_nullable,
      COLUMN_DEFAULT AS column_default
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION`,
    [process.env.DB_NAME, table]
  );

  return {
    module: moduleKey,
    table,
    columns: rows.map((r) => ({
      ...r,
      operators: operatorsForType(r.data_type),
    })),
  };
}

import { query } from '../../db/index.js';

const OPERATOR_SQL = {
  eq: '=',
  neq: '!=',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  like: 'LIKE',
};

function assertAllowedColumn(column, allowedColumns) {
  if (!allowedColumns.includes(column)) {
    throw new Error(`Column not allowed: ${column}`);
  }
}

function buildWhere(filters = [], allowedColumns = []) {
  const clauses = [];
  const params = [];

  for (const f of filters) {
    if (!f || !f.column || !f.operator) continue;
    assertAllowedColumn(f.column, allowedColumns);
    const col = `\`${f.column}\``;

    if (f.operator === 'is_null') {
      clauses.push(`${col} IS NULL`);
      continue;
    }
    if (f.operator === 'is_not_null') {
      clauses.push(`${col} IS NOT NULL`);
      continue;
    }
    if (f.operator === 'between') {
      const values = Array.isArray(f.value) ? f.value : [];
      if (values.length !== 2) throw new Error(`Between filter requires two values for ${f.column}`);
      clauses.push(`${col} BETWEEN ? AND ?`);
      params.push(values[0], values[1]);
      continue;
    }
    if (f.operator === 'in') {
      const values = Array.isArray(f.value) ? f.value : [];
      if (!values.length) throw new Error(`IN filter requires values for ${f.column}`);
      clauses.push(`${col} IN (${values.map(() => '?').join(', ')})`);
      params.push(...values);
      continue;
    }

    const sqlOp = OPERATOR_SQL[f.operator];
    if (!sqlOp) throw new Error(`Unsupported operator: ${f.operator}`);
    clauses.push(`${col} ${sqlOp} ?`);
    params.push(f.operator === 'like' ? `%${f.value}%` : f.value);
  }

  if (!clauses.length) return { whereSql: '', params };
  return { whereSql: `WHERE ${clauses.join(' AND ')}`, params };
}

function buildOrder(sort, allowedColumns) {
  if (!sort || !sort.column) return '';
  assertAllowedColumn(sort.column, allowedColumns);
  const dir = String(sort.direction || 'asc').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
  return `ORDER BY \`${sort.column}\` ${dir}`;
}

export async function previewReport({
  table,
  columns,
  filters,
  sort,
  page = 1,
  pageSize = 25,
  allowedColumns,
}) {
  const selectedColumns = (Array.isArray(columns) && columns.length ? columns : allowedColumns).filter((c) =>
    allowedColumns.includes(c)
  );
  if (!selectedColumns.length) throw new Error('No valid columns selected');

  const { whereSql, params } = buildWhere(filters, allowedColumns);
  const orderSql = buildOrder(sort, allowedColumns);
  const size = Math.max(1, Math.min(Number(pageSize) || 25, 200));
  const offset = Math.max(0, (Math.max(1, Number(page) || 1) - 1) * size);

  const selectSql = `SELECT ${selectedColumns.map((c) => `\`${c}\``).join(', ')} FROM \`${table}\` ${whereSql} ${orderSql} LIMIT ${size} OFFSET ${offset}`;
  const countSql = `SELECT COUNT(*) AS total FROM \`${table}\` ${whereSql}`;

  const [rows, countRows] = await Promise.all([query(selectSql, params), query(countSql, params)]);
  const total = Number(countRows[0]?.total || 0);

  return {
    rows,
    total,
    page: Math.max(1, Number(page) || 1),
    pageSize: size,
  };
}

export async function fetchReportRows({
  table,
  columns,
  filters,
  sort,
  allowedColumns,
  maxRows = 5000,
}) {
  const selectedColumns = (Array.isArray(columns) && columns.length ? columns : allowedColumns).filter((c) =>
    allowedColumns.includes(c)
  );
  if (!selectedColumns.length) throw new Error('No valid columns selected');

  const { whereSql, params } = buildWhere(filters, allowedColumns);
  const orderSql = buildOrder(sort, allowedColumns);
  const limit = Math.max(1, Math.min(Number(maxRows) || 5000, 20000));

  const sql = `SELECT ${selectedColumns.map((c) => `\`${c}\``).join(', ')} FROM \`${table}\` ${whereSql} ${orderSql} LIMIT ${limit}`;
  const rows = await query(sql, params);
  return { rows, selectedColumns };
}

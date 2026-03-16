import { Router } from 'express';
import XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/index.js';
import { send500 } from '../utils/errorResponse.js';
import {
  canAccessModule,
  canManageDefinition,
  filterColumnsForRole,
  getModulesForRole,
  getTableForModule,
} from '../services/reports/policyService.js';
import { getModuleSchema } from '../services/reports/schemaService.js';
import { fetchReportRows, previewReport } from '../services/reports/queryBuilder.js';

const router = Router();

function parseConfig(config) {
  if (!config) return {};
  if (typeof config === 'object') return config;
  try {
    return JSON.parse(config);
  } catch {
    return {};
  }
}

function toCsv(rows, columns) {
  const escapeCell = (value) => {
    if (value == null) return '';
    const str = String(value).replace(/"/g, '""');
    return /[",\n]/.test(str) ? `"${str}"` : str;
  };
  const header = columns.map(escapeCell).join(',');
  const lines = rows.map((row) => columns.map((col) => escapeCell(row[col])).join(','));
  return [header, ...lines].join('\n');
}

async function writeReportRun({ reportDefinitionId = null, userId, moduleKey, format, status, rowCount = 0, errorMessage = null }) {
  await query(
    `INSERT INTO report_runs (id, report_definition_id, requested_by, module_key, format, status, row_count, error_message, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [uuidv4(), reportDefinitionId, userId, moduleKey, format, status, rowCount, errorMessage]
  );
}

router.get('/modules', async (req, res) => {
  try {
    res.json(getModulesForRole(req.user.role));
  } catch (error) {
    send500(res, 'Failed to get report modules', error);
  }
});

router.get('/modules/:module/schema', async (req, res) => {
  try {
    const moduleKey = req.params.module;
    if (!canAccessModule(req.user.role, moduleKey)) {
      return res.status(403).json({ error: 'Insufficient permissions for this module' });
    }
    const schema = await getModuleSchema(moduleKey);
    if (!schema) return res.status(404).json({ error: 'Unknown module' });
    const columns = filterColumnsForRole(req.user.role, moduleKey, schema.columns);
    res.json({ ...schema, columns });
  } catch (error) {
    send500(res, 'Failed to get module schema', error);
  }
});

router.post('/preview', async (req, res) => {
  try {
    const { module: moduleKey, columns, filters, sort, page, pageSize } = req.body || {};
    if (!moduleKey) return res.status(400).json({ error: 'module is required' });
    if (!canAccessModule(req.user.role, moduleKey)) return res.status(403).json({ error: 'Insufficient permissions' });

    const schema = await getModuleSchema(moduleKey);
    if (!schema) return res.status(404).json({ error: 'Unknown module' });
    const allowedColumns = filterColumnsForRole(req.user.role, moduleKey, schema.columns).map((c) => c.column_name);

    const result = await previewReport({
      table: schema.table,
      columns,
      filters,
      sort,
      page,
      pageSize,
      allowedColumns,
    });
    res.json(result);
  } catch (error) {
    send500(res, 'Failed to preview report', error);
  }
});

router.post('/download', async (req, res) => {
  const { module: moduleKey, columns, filters, sort, format = 'csv', report_definition_id = null } = req.body || {};
  try {
    if (!moduleKey) return res.status(400).json({ error: 'module is required' });
    if (!canAccessModule(req.user.role, moduleKey)) return res.status(403).json({ error: 'Insufficient permissions' });

    const schema = await getModuleSchema(moduleKey);
    if (!schema) return res.status(404).json({ error: 'Unknown module' });
    const allowedColumns = filterColumnsForRole(req.user.role, moduleKey, schema.columns).map((c) => c.column_name);

    const { rows, selectedColumns } = await fetchReportRows({
      table: schema.table,
      columns,
      filters,
      sort,
      allowedColumns,
      maxRows: 5000,
    });

    if (String(format).toLowerCase() === 'xlsx') {
      const ws = XLSX.utils.json_to_sheet(rows, { header: selectedColumns });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Report');
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      await writeReportRun({
        reportDefinitionId: report_definition_id,
        userId: req.user.id,
        moduleKey,
        format: 'xlsx',
        status: 'completed',
        rowCount: rows.length,
      });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${moduleKey}-report.xlsx"`);
      return res.send(buffer);
    }

    const csv = toCsv(rows, selectedColumns);
    await writeReportRun({
      reportDefinitionId: report_definition_id,
      userId: req.user.id,
      moduleKey,
      format: 'csv',
      status: 'completed',
      rowCount: rows.length,
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${moduleKey}-report.csv"`);
    return res.send(csv);
  } catch (error) {
    try {
      if (moduleKey) {
        await writeReportRun({
          reportDefinitionId: report_definition_id,
          userId: req.user?.id || null,
          moduleKey,
          format: String(format).toLowerCase() === 'xlsx' ? 'xlsx' : 'csv',
          status: 'failed',
          rowCount: 0,
          errorMessage: error.message,
        });
      }
    } catch {
      // Ignore run-log failure.
    }
    send500(res, 'Failed to download report', error);
  }
});

router.get('/definitions', async (req, res) => {
  try {
    const rows = await query(
      `SELECT rd.*, u.name AS owner_name
       FROM report_definitions rd
       LEFT JOIN users u ON u.id = rd.owner_user_id
       WHERE rd.owner_user_id = ? OR rd.is_public = 1
       ORDER BY rd.updated_at DESC`,
      [req.user.id]
    );
    res.json(
      rows.map((r) => ({
        ...r,
        config_json: parseConfig(r.config_json),
      }))
    );
  } catch (error) {
    send500(res, 'Failed to get report definitions', error);
  }
});

router.post('/definitions', async (req, res) => {
  try {
    const { name, module_key, config_json, is_public } = req.body || {};
    if (!name || !module_key || !config_json) {
      return res.status(400).json({ error: 'name, module_key and config_json are required' });
    }
    if (!canAccessModule(req.user.role, module_key)) {
      return res.status(403).json({ error: 'Insufficient permissions for module' });
    }
    const id = uuidv4();
    await query(
      `INSERT INTO report_definitions (id, name, module_key, config_json, is_public, owner_user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [id, String(name).trim(), module_key, JSON.stringify(config_json), is_public ? 1 : 0, req.user.id]
    );
    const rows = await query('SELECT * FROM report_definitions WHERE id = ?', [id]);
    res.status(201).json({ ...rows[0], config_json: parseConfig(rows[0].config_json) });
  } catch (error) {
    send500(res, 'Failed to create report definition', error);
  }
});

router.put('/definitions/:id', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM report_definitions WHERE id = ?', [req.params.id]);
    const existing = rows[0];
    if (!existing) return res.status(404).json({ error: 'Report definition not found' });
    if (!canManageDefinition(req.user, existing)) return res.status(403).json({ error: 'Insufficient permissions' });

    const nextName = req.body?.name != null ? String(req.body.name).trim() : existing.name;
    const nextModule = req.body?.module_key || existing.module_key;
    const nextConfig = req.body?.config_json != null ? req.body.config_json : parseConfig(existing.config_json);
    const nextPublic = req.body?.is_public != null ? (req.body.is_public ? 1 : 0) : existing.is_public;

    if (!canAccessModule(req.user.role, nextModule)) {
      return res.status(403).json({ error: 'Insufficient permissions for module' });
    }

    await query(
      `UPDATE report_definitions
       SET name = ?, module_key = ?, config_json = ?, is_public = ?, updated_at = NOW()
       WHERE id = ?`,
      [nextName, nextModule, JSON.stringify(nextConfig), nextPublic, req.params.id]
    );
    const updatedRows = await query('SELECT * FROM report_definitions WHERE id = ?', [req.params.id]);
    res.json({ ...updatedRows[0], config_json: parseConfig(updatedRows[0].config_json) });
  } catch (error) {
    send500(res, 'Failed to update report definition', error);
  }
});

router.delete('/definitions/:id', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM report_definitions WHERE id = ?', [req.params.id]);
    const existing = rows[0];
    if (!existing) return res.status(404).json({ error: 'Report definition not found' });
    if (!canManageDefinition(req.user, existing)) return res.status(403).json({ error: 'Insufficient permissions' });
    await query('DELETE FROM report_definitions WHERE id = ?', [req.params.id]);
    res.json({ message: 'Report definition deleted' });
  } catch (error) {
    send500(res, 'Failed to delete report definition', error);
  }
});

export { router as reportRoutes };

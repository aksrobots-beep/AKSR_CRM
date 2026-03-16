import 'dotenv/config';
import mysql from 'mysql2/promise';
import XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_FILE = 'C:/Users/HPAKSB/Documents/Copy of share_file.xlsx';

function toMySQLDatetime(d = new Date()) {
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function parseExcelDate(value) {
  if (value == null || value === '') return null;

  if (typeof value === 'number') {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(epoch.getTime() + value * 86400000);
    return date.toISOString().slice(0, 10);
  }

  const str = String(value).trim();
  if (!str) return null;

  const direct = new Date(str);
  if (!Number.isNaN(direct.getTime())) return direct.toISOString().slice(0, 10);

  const dmy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]) - 1;
    const year = Number(dmy[3]);
    const date = new Date(Date.UTC(year, month, day));
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }

  return null;
}

function parseNumber(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function dedupe(values) {
  return [...new Set(values.map((v) => String(v).trim()).filter(Boolean))];
}

function parseExcelBlocks(filePath) {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // Row index 0 is title, 1 is headers, data starts at 2.
  const dataRows = rows.slice(2);
  const blocks = [];
  let current = null;

  for (const row of dataRows) {
    const no = row[0];
    const debtor = String(row[1] || '').trim();
    const customer = String(row[2] || '').trim();
    const rentalRm = parseNumber(row[3]);
    const qty = parseNumber(row[4]);
    const total = parseNumber(row[5]);
    const months = parseNumber(row[6]);
    const effectiveDate = parseExcelDate(row[7]);
    const expiryDate = parseExcelDate(row[8]);
    const serial = String(row[9] || '').trim();

    const isMain = no !== '' && no != null;
    const isContinuation = !isMain && serial;

    if (isMain) {
      if (current) blocks.push(current);
      current = {
        no: parseNumber(no),
        debtor,
        customer,
        rental_amount: rentalRm ?? 0,
        qty: qty ?? 0,
        total: total ?? 0,
        rental_duration_months: months ?? null,
        rental_start_date: effectiveDate,
        rental_end_date: expiryDate,
        serial_numbers: serial ? [serial] : [],
      };
      continue;
    }

    if (isContinuation && current) {
      current.serial_numbers.push(serial);
    }
  }

  if (current) blocks.push(current);

  // Remove empty/malformed blocks and dedupe serial numbers.
  return blocks
    .filter((b) => b.debtor && b.customer)
    .map((b) => ({ ...b, serial_numbers: dedupe(b.serial_numbers) }));
}

async function getColumns(connection, tableName) {
  const [rows] = await connection.execute(
    `SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_DEFAULT
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [process.env.DB_NAME, tableName]
  );
  const map = new Map();
  for (const r of rows) map.set(r.COLUMN_NAME, r);
  return map;
}

async function insertDynamic(connection, tableName, data, columns) {
  const fields = Object.keys(data).filter((k) => columns.has(k) && data[k] !== undefined);
  const placeholders = fields.map(() => '?').join(', ');
  const sql = `INSERT INTO ${tableName} (${fields.join(', ')}) VALUES (${placeholders})`;
  await connection.execute(sql, fields.map((f) => data[f]));
}

async function updateDynamic(connection, tableName, id, data, columns) {
  const fields = Object.keys(data).filter((k) => k !== 'id' && columns.has(k) && data[k] !== undefined);
  if (fields.length === 0) return;
  const setClause = fields.map((f) => `${f} = ?`).join(', ');
  const sql = `UPDATE ${tableName} SET ${setClause} WHERE id = ?`;
  await connection.execute(sql, [...fields.map((f) => data[f]), id]);
}

async function main() {
  const filePath = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : DEFAULT_FILE;
  const dryRun = process.argv.includes('--dry-run');
  const now = toMySQLDatetime();

  console.log('\n--- Import Clients + Robots From Excel ---\n');
  console.log('File:', filePath);
  console.log('Mode:', dryRun ? 'DRY RUN' : 'APPLY');

  const blocks = parseExcelBlocks(filePath);
  console.log(`Parsed ${blocks.length} customer blocks from sheet.`);

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const stats = {
    totalBlocks: blocks.length,
    clientCreated: 0,
    clientUpdated: 0,
    equipmentCreated: 0,
    equipmentUpdated: 0,
    skipped: 0,
    errors: 0,
  };

  try {
    const clientCols = await getColumns(connection, 'clients');
    const equipmentCols = await getColumns(connection, 'equipment');

    for (const block of blocks) {
      try {
        const debtor = String(block.debtor).trim();
        const customer = String(block.customer).trim();
        if (!debtor || !customer) {
          stats.skipped += 1;
          continue;
        }

        // ---- Upsert client by client_code ----
        const [clientRows] = await connection.execute(
          'SELECT * FROM clients WHERE client_code = ? LIMIT 1',
          [debtor]
        );

        let clientId;
        if (clientRows.length > 0) {
          const existing = clientRows[0];
          clientId = existing.id;
          const clientUpdate = {
            name: customer,
            company_name: customer,
            updated_at: now,
          };
          if (clientCols.has('updated_by')) clientUpdate.updated_by = null;
          if (!dryRun) await updateDynamic(connection, 'clients', clientId, clientUpdate, clientCols);
          stats.clientUpdated += 1;
        } else {
          clientId = uuidv4();
          const clientInsert = {
            id: clientId,
            client_code: debtor,
            name: customer,
            company_name: customer,
            email: '',
            phone: '',
            address: '',
            city: '',
            state: '',
            country: 'Malaysia',
            postal_code: '',
            industry: '',
            assigned_to: null,
            notes: '',
            total_revenue: 0,
            status: 'active',
            is_active: 1,
            created_at: now,
            updated_at: now,
            created_by: null,
            updated_by: null,
          };
          if (!dryRun) await insertDynamic(connection, 'clients', clientInsert, clientCols);
          stats.clientCreated += 1;
        }

        // ---- Upsert rental equipment/robot record ----
        const serials = dedupe(block.serial_numbers);
        const modelNumbersJson = JSON.stringify(serials);
        const firstSerial = serials[0] || '';
        const robotName = `Robot Rental - ${customer} (${debtor})`;
        const rentalAmount = block.rental_amount ?? 0;

        const ownershipCheck = equipmentCols.has('ownership_type');
        let equipmentRows = [];
        if (ownershipCheck) {
          const [rows] = await connection.execute(
            `SELECT * FROM equipment
             WHERE client_id = ? AND ownership_type = 'rental'
               AND rental_start_date <=> ? AND rental_end_date <=> ? AND rental_amount <=> ?
             LIMIT 1`,
            [clientId, block.rental_start_date, block.rental_end_date, rentalAmount]
          );
          equipmentRows = rows;
        } else {
          const [rows] = await connection.execute(
            `SELECT * FROM equipment WHERE client_id = ? AND name = ? LIMIT 1`,
            [clientId, robotName]
          );
          equipmentRows = rows;
        }

        if (equipmentRows.length > 0) {
          const eq = equipmentRows[0];
          let existingModelNumbers = [];
          try {
            if (eq.model_numbers) {
              existingModelNumbers = Array.isArray(eq.model_numbers)
                ? eq.model_numbers
                : JSON.parse(eq.model_numbers);
            }
          } catch (_) {
            existingModelNumbers = [];
          }
          const merged = dedupe([...(existingModelNumbers || []), ...serials]);

          const eqUpdate = {
            name: robotName,
            model_numbers: JSON.stringify(merged),
            serial_number: merged[0] || '',
            manufacturer: 'OrionStar',
            rental_amount: rentalAmount,
            rental_duration_months: block.rental_duration_months,
            rental_start_date: block.rental_start_date,
            rental_end_date: block.rental_end_date,
            updated_at: now,
            notes: `Imported from share_file.xlsx; DEBTOR=${debtor}; QTY=${block.qty}; TOTAL=${block.total}`,
          };
          if (equipmentCols.has('updated_by')) eqUpdate.updated_by = null;
          if (!dryRun) await updateDynamic(connection, 'equipment', eq.id, eqUpdate, equipmentCols);
          stats.equipmentUpdated += 1;
        } else {
          const eqInsert = {
            id: uuidv4(),
            name: robotName,
            type: 'robot',
            ownership_type: 'rental',
            model: 'LuckiBot',
            model_numbers: modelNumbersJson,
            serial_number: firstSerial,
            manufacturer: 'OrionStar',
            client_id: clientId,
            installation_date: block.rental_start_date,
            warranty_expiry: null,
            last_service_date: null,
            next_maintenance_date: null,
            location: '',
            notes: `Imported from share_file.xlsx; DEBTOR=${debtor}; QTY=${block.qty}; TOTAL=${block.total}`,
            status: 'operational',
            rental_start_date: block.rental_start_date,
            rental_end_date: block.rental_end_date,
            rental_duration_months: block.rental_duration_months,
            rental_amount: rentalAmount,
            rental_terms: null,
            amc_contract_start: null,
            amc_contract_end: null,
            amc_amount: null,
            amc_terms: null,
            amc_renewal_status: null,
            is_active: 1,
            created_at: now,
            updated_at: now,
            created_by: null,
            updated_by: null,
          };
          if (!dryRun) await insertDynamic(connection, 'equipment', eqInsert, equipmentCols);
          stats.equipmentCreated += 1;
        }
      } catch (err) {
        stats.errors += 1;
        console.error(`  Error processing debtor/customer block: ${err.message}`);
      }
    }
  } finally {
    await connection.end();
  }

  console.log('\nImport Summary:');
  console.log(`  Blocks parsed: ${stats.totalBlocks}`);
  console.log(`  Clients created: ${stats.clientCreated}`);
  console.log(`  Clients updated: ${stats.clientUpdated}`);
  console.log(`  Robots created: ${stats.equipmentCreated}`);
  console.log(`  Robots updated: ${stats.equipmentUpdated}`);
  console.log(`  Skipped: ${stats.skipped}`);
  console.log(`  Errors: ${stats.errors}`);
  console.log('\nDone.\n');
}

main().catch((err) => {
  console.error('\nImport failed:', err);
  process.exit(1);
});

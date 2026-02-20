import XLSX from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { findAll, findById, insert, update } from '../db/index.js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Generate ticket number
async function generateTicketNumber() {
  const year = new Date().getFullYear();
  const tickets = await findAll('tickets');
  const filtered = tickets.filter(t => t.ticket_number?.startsWith(`TKT-${year}-`));
  const maxNum = filtered.reduce((max, t) => {
    const num = parseInt(t.ticket_number?.split('-')[2]) || 0;
    return num > max ? num : max;
  }, 0);
  return `TKT-${year}-${String(maxNum + 1).padStart(4, '0')}`;
}

// Map Excel column names to database fields (flexible mapping)
const columnMapping = {
  // Ticket fields
  'ticket_number': ['ticket_number', 'ticket no', 'ticket#', 'ticket'],
  'title': ['title', 'subject', 'description', 'issue', 'problem'],
  'description': ['description', 'details', 'notes', 'remarks'],
  'status': ['status', 'state'],
  'priority': ['priority'],
  'service_date': ['service_date', 'date', 'service date', 'service_date', 'serviced_date'],
  'due_date': ['due_date', 'due date', 'due'],
  'action_taken': ['action_taken', 'action', 'action taken', 'work_done', 'work done'],
  'actual_hours': ['actual_hours', 'hours', 'actual hours', 'time_spent'],
  'labor_cost': ['labor_cost', 'labor cost', 'labor'],
  'parts_cost': ['parts_cost', 'parts cost', 'parts'],
  'total_cost': ['total_cost', 'total cost', 'cost'],

  // Equipment/Robot fields
  'robot_name': ['robot_name', 'robot name', 'robot', 'equipment', 'equipment_name', 'machine', 'operating'],
  'serial_number': ['serial_number', 'serial number', 'serial', 'serial_no', 'sn', 'code'],
  'model': ['model', 'model_number', 'model number'],
  'manufacturer': ['manufacturer', 'brand', 'make'],

  // Client fields
  'client_name': ['client_name', 'client name', 'client', 'customer', 'customer_name', 'company', 'debtor name'],
  'location': ['location', 'site', 'site_location', 'address'],
  'installation_date': ['installation_date', 'installation date', 'install date'],
};

function findColumnIndex(headers, possibleNames) {
  for (const name of possibleNames) {
    const index = headers.findIndex(h =>
      h && h.toString().toLowerCase().trim() === name.toLowerCase().trim()
    );
    if (index !== -1) return index;
  }
  return -1;
}

function parseDate(dateValue) {
  if (!dateValue) return null;

  // Handle Excel date serial number
  if (typeof dateValue === 'number') {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + dateValue * 86400000);
    return date.toISOString().split('T')[0];
  }

  // Handle date strings
  if (typeof dateValue === 'string') {
    const trimmed = dateValue.trim();
    if (!trimmed) return null;

    // Try parsing directly
    let date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }

    // Try parsing D/M/YYYY format (MY/UK/Excel standard)
    const dmyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmyMatch) {
      const [, day, month, year] = dmyMatch;
      date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
      if (!isNaN(date.getTime())) {
        const result = date.toISOString().split('T')[0];
        console.log(`  🔍 Parsed "${trimmed}" -> ${result}`);
        return result;
      }
    }

    // Try parsing YYYY-MM-DD format
    const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
  }

  return null;
}

async function importServiceRecords(filePath) {
  try {
    console.log('📖 Reading Excel file:', filePath);

    if (!existsSync(filePath)) {
      console.error('❌ File not found:', filePath);
      return;
    }

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    console.log('📊 Sheet name:', sheetName);

    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: null
    });

    if (data.length < 2) {
      console.error('❌ Excel file appears to be empty or has no data rows');
      return;
    }

    // First row is headers
    const headers = data[0].map(h => h ? h.toString().trim() : '');
    console.log('\n📋 Column headers found:');
    headers.forEach((h, i) => console.log(`  ${i}: ${h}`));

    // Find column indices
    const columnIndices = {};
    for (const [dbField, possibleNames] of Object.entries(columnMapping)) {
      const index = findColumnIndex(headers, possibleNames);
      if (index !== -1) {
        columnIndices[dbField] = index;
        console.log(`  ✓ Mapped "${headers[index]}" -> ${dbField}`);
      }
    }

    // Find service date columns (Service 1, Service 2, etc.)
    const serviceDateIndices = [];
    headers.forEach((header, index) => {
      if (header && /service\s*\d+/i.test(header.toString())) {
        serviceDateIndices.push({ index, name: header.toString() });
        console.log(`  ✓ Found service date column: "${header}" (index ${index})`);
      }
    });

    console.log('\n🔄 Processing rows...\n');

    let imported = 0;
    let skipped = 0;
    const errors = [];

    // Process data rows (skip header row)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      // Skip empty rows
      if (row.every(cell => !cell || cell.toString().trim() === '')) {
        continue;
      }

      try {
        // Extract data from row
        const rowData = {};
        for (const [field, index] of Object.entries(columnIndices)) {
          if (index !== -1 && row[index] !== undefined && row[index] !== null) {
            rowData[field] = row[index];
          }
        }

        // Skip if no essential data
        if (!rowData.robot_name && !rowData.serial_number && !rowData.client_name) {
          skipped++;
          continue;
        }

        // Find or create client by name
        let clientId = null;
        if (rowData.client_name) {
          const allClients = await findAll('clients');
          let client = allClients.find(c =>
            c.company_name?.toLowerCase() === rowData.client_name.toString().toLowerCase() ||
            c.name?.toLowerCase() === rowData.client_name.toString().toLowerCase()
          );

          // Create client if not found
          if (!client) {
            const now = new Date().toISOString();
            const clientName = rowData.client_name.toString().trim();
            const address = rowData.location || '';

            // Extract city, state, postal code from address
            let city = '';
            let state = '';
            let postalCode = '';
            let industry = '';

            // Try to extract location info from address
            if (address) {
              // Common patterns: "City, State" or "Postal Code City, State"
              const postalMatch = address.match(/(\d{5})\s+([^,]+),?\s*([^,]+)?/);
              if (postalMatch) {
                postalCode = postalMatch[1];
                city = postalMatch[2]?.trim() || '';
                state = postalMatch[3]?.trim() || '';
              } else {
                // Try to extract state from common Malaysian state names
                const states = ['Kuala Lumpur', 'Selangor', 'Penang', 'Johor', 'Kedah', 'Perak', 'Pahang', 'Negeri Sembilan', 'Melaka', 'Terengganu', 'Kelantan', 'Sabah', 'Sarawak', 'Perlis', 'Labuan', 'Putrajaya'];
                for (const s of states) {
                  if (address.includes(s)) {
                    state = s;
                    break;
                  }
                }
              }

              // Determine industry based on client name patterns
              const nameLower = clientName.toLowerCase();
              if (nameLower.includes('restoran') || nameLower.includes('restaurant') || nameLower.includes('café') || nameLower.includes('cafe') || nameLower.includes('nasi kandar') || nameLower.includes('curry')) {
                industry = 'F&B - Restaurant';
              } else if (nameLower.includes('hotel') || nameLower.includes('suites')) {
                industry = 'Hospitality - Hotel';
              } else if (nameLower.includes('service centre') || nameLower.includes('service center')) {
                industry = 'Automotive - Service';
              } else if (nameLower.includes('logistic') || nameLower.includes('logistics')) {
                industry = 'Logistics';
              } else if (nameLower.includes('industries') || nameLower.includes('sdn bhd')) {
                industry = 'Manufacturing';
              } else if (nameLower.includes('golf')) {
                industry = 'Recreation - Golf';
              } else {
                industry = 'Other';
              }
            }

            client = {
              id: uuidv4(),
              name: clientName,
              company_name: clientName,
              email: '',
              phone: '',
              address: address,
              city: city,
              state: state,
              country: 'Malaysia',
              postal_code: postalCode,
              industry: industry,
              assigned_to: null,
              notes: '',
              total_revenue: 0,
              status: 'active',
              created_at: now,
              updated_at: now,
              created_by: null,
              updated_by: null,
            };
            await insert('clients', client);
            console.log(`  ➕ Created client: ${clientName} (${industry})`);
          }
          clientId = client.id;
        }

        // Find equipment/robot by code/serial or name
        let equipment = null;
        const allEquipment = await findAll('equipment');

        if (rowData.serial_number) {
          equipment = allEquipment.find(e =>
            e.serial_number?.toLowerCase() === rowData.serial_number.toString().toLowerCase() ||
            (e.name?.toLowerCase().includes(rowData.serial_number.toString().toLowerCase()) && e.type === 'robot')
          );
        }

        if (!equipment && rowData.robot_name) {
          equipment = allEquipment.find(e =>
            (e.name?.toLowerCase().includes(rowData.robot_name.toString().toLowerCase()) ||
              rowData.robot_name.toString().toLowerCase().includes(e.name?.toLowerCase())) &&
            e.type === 'robot'
          );
        }

        // If equipment not found, try to find any robot for this client
        if (!equipment && clientId) {
          equipment = allEquipment.find(e =>
            e.client_id === clientId && e.type === 'robot'
          );
        }

        // Create equipment/robot if not found
        if (!equipment && clientId) {
          const now = new Date().toISOString();
          const robotCode = rowData.serial_number ? rowData.serial_number.toString().trim() : '';
          const robotName = rowData.robot_name ? rowData.robot_name.toString().trim() : 'Robot';
          const equipmentName = robotName !== 'Active' && robotName !== 'Inactive'
            ? robotName
            : (robotCode ? `Robot ${robotCode}` : 'Robot');

          // Extract location from address column (which maps to client address)
          let equipmentLocation = rowData.location || '';
          // If no location in row data, try to get from client address
          if (!equipmentLocation && clientId) {
            const client = await findById('clients', clientId);
            if (client && client.address) {
              equipmentLocation = client.address;
            }
          }

          equipment = {
            id: uuidv4(),
            name: equipmentName,
            type: 'robot',
            model: '',
            serial_number: robotCode,
            manufacturer: '',
            client_id: clientId,
            location: equipmentLocation,
            status: robotName === 'Inactive' ? 'maintenance_required' : 'operational',
            installation_date: parseDate(rowData.installation_date),
            warranty_expiry: null,
            last_service_date: null,
            next_service_date: null,
            notes: '',
            created_at: now,
            updated_at: now,
            created_by: null,
            updated_by: null,
          };
          await insert('equipment', equipment);
          console.log(`  ➕ Created equipment: ${equipmentName} (${robotCode})`);
        }

        // If equipment still not found, skip
        if (!equipment) {
          console.log(`  ⚠ Row ${i + 1}: Equipment/Robot not found and client not available (Code: ${rowData.serial_number}, Operating: ${rowData.robot_name})`);
          skipped++;
          continue;
        }

        // Use equipment's client if we don't have one from the row
        if (!clientId) {
          clientId = equipment.client_id;
          if (!clientId) {
            console.log(`  ⚠ Row ${i + 1}: Equipment has no client assigned`);
            skipped++;
            continue;
          }
        }

        // Update equipment installation_date if available
        if (rowData.installation_date) {
          const installationDate = parseDate(rowData.installation_date);
          if (installationDate) {
            await update('equipment', equipment.id, { installation_date: installationDate });
          }
        }

        // Process service dates (Service 1, Service 2, etc.)
        const serviceDates = [];
        serviceDateIndices.forEach(({ index, name }) => {
          if (row[index] !== undefined && row[index] !== null && row[index] !== '') {
            const date = parseDate(row[index]);
            if (date) {
              console.log(`  🔍 For ${equipment.name} [${name}]: "${row[index]}" -> ${date}`);
              serviceDates.push({ date, name });
            }
          }
        });

        // Create service ticket/record for each service date
        const now = new Date().toISOString();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Track latest service date for equipment
        let latestServiceDate = null;

        for (const { date: serviceDate, name: serviceName } of serviceDates) {
          if (!serviceDate) continue;

          const serviceDateObj = new Date(serviceDate);
          serviceDateObj.setHours(0, 0, 0, 0);
          const isPastService = serviceDateObj < today;

          // Track latest service date
          if (!latestServiceDate || serviceDateObj > new Date(latestServiceDate)) {
            latestServiceDate = serviceDate;
          }

          const ticket = {
            id: uuidv4(),
            ticket_number: await generateTicketNumber(),
            title: `${isPastService ? 'Service Record' : 'Scheduled Service'} - ${equipment.name}${serviceName !== 'Service' ? ` (${serviceName})` : ''}`,
            description: rowData.description || `${isPastService ? 'Completed service' : 'Scheduled service'} for ${equipment.name}`,
            priority: (rowData.priority || 'medium').toLowerCase(),
            status: isPastService ? 'resolved' : 'new',
            client_id: clientId,
            equipment_id: equipment.id,
            assigned_to: null, // Can be assigned to Robot team later
            due_date: serviceDate,
            next_action_date: isPastService ? null : serviceDate,
            next_action_item: isPastService ? '' : `Scheduled service for ${equipment.name} - ${serviceName}`,
            action_taken: isPastService ? `Service completed on ${serviceDate}` : '',
            estimated_hours: null,
            actual_hours: rowData.actual_hours ? parseFloat(rowData.actual_hours) : null,
            labor_cost: rowData.labor_cost ? parseFloat(rowData.labor_cost) : 0,
            parts_cost: rowData.parts_cost ? parseFloat(rowData.parts_cost) : 0,
            total_cost: rowData.total_cost ? parseFloat(rowData.total_cost) :
              (parseFloat(rowData.labor_cost || 0) + parseFloat(rowData.parts_cost || 0)),
            tags: JSON.stringify(['robot', 'service_record', isPastService ? 'completed' : 'scheduled']),
            resolved_at: isPastService ? `${serviceDate}T00:00:00Z` : null,
            closed_at: isPastService ? `${serviceDate}T00:00:00Z` : null,
            created_at: serviceDate ? `${serviceDate}T00:00:00Z` : now,
            updated_at: now,
            created_by: null,
            updated_by: null,
          };

          // Insert ticket
          await insert('tickets', ticket);
          imported++;

          const statusLabel = isPastService ? 'Done' : 'Upcoming';
          console.log(`  ✓ Row ${i + 1}: Imported ${statusLabel} ticket ${ticket.ticket_number} for ${equipment.name} (${serviceDate})`);
        }

        // Update equipment last_service_date and next_service_date
        if (latestServiceDate) {
          const latestDate = new Date(latestServiceDate);
          latestDate.setHours(0, 0, 0, 0);

          // Find next upcoming service date
          const upcomingDates = serviceDates
            .map(sd => new Date(sd.date))
            .filter(d => d >= today)
            .sort((a, b) => a - b);

          const nextServiceDate = upcomingDates.length > 0 ? upcomingDates[0].toISOString().split('T')[0] : null;

          const equipmentUpdates = {};
          if (latestDate < today) {
            equipmentUpdates.last_service_date = latestServiceDate;
          }
          if (nextServiceDate) {
            equipmentUpdates.next_service_date = nextServiceDate;
          }

          if (Object.keys(equipmentUpdates).length > 0) {
            await update('equipment', equipment.id, equipmentUpdates);
          }
        }

      } catch (error) {
        errors.push({ row: i + 1, error: error.message });
        console.log(`  ❌ Row ${i + 1}: Error - ${error.message}`);
      }
    }

    console.log('\n📊 Import Summary:');
    console.log(`  ✓ Imported: ${imported}`);
    console.log(`  ⚠ Skipped: ${skipped}`);
    console.log(`  ❌ Errors: ${errors.length}`);

    if (errors.length > 0) {
      console.log('\n❌ Errors:');
      errors.forEach(e => console.log(`  Row ${e.row}: ${e.error}`));
    }

  } catch (error) {
    console.error('❌ Import error:', error);
    throw error;
  }
}

// Main execution
const filePath = process.argv[2] || join(__dirname, '../../../src/pages/Robot Service record.xlsx');

console.log('🤖 Robot Service Records Importer\n');
console.log('File:', filePath);
console.log('');

importServiceRecords(filePath)
  .then(() => {
    console.log('\n✅ Import completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  });

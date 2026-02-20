import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function checkEquipment() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'aksucce2_crm'
  });
  
  console.log('🔍 Checking Kossan Industries equipment...\n');
  
  // Get client ID
  const [clients] = await connection.execute(
    "SELECT id, company_name FROM clients WHERE company_name LIKE '%Kossan%'"
  );
  
  if (clients.length === 0) {
    console.log('❌ No Kossan client found');
    await connection.end();
    return;
  }
  
  const client = clients[0];
  console.log(`✅ Client: ${client.company_name} (${client.id})\n`);
  
  // Get all equipment for this client
  const [equipment] = await connection.execute(
    'SELECT id, name, ownership_type, model_numbers, serial_number, is_active FROM equipment WHERE client_id = ?',
    [client.id]
  );
  
  console.log(`📦 Total Equipment: ${equipment.length}\n`);
  
  equipment.forEach((eq, index) => {
    console.log(`${index + 1}. ${eq.name}`);
    console.log(`   ID: ${eq.id}`);
    console.log(`   Ownership: ${eq.ownership_type || 'NULL'}`);
    console.log(`   Model Numbers: ${eq.model_numbers || 'NULL'}`);
    console.log(`   Serial Number (legacy): ${eq.serial_number || 'NULL'}`);
    console.log(`   Active: ${eq.is_active}\n`);
  });
  
  const rentalCount = equipment.filter(e => e.ownership_type === 'rental').length;
  const soldCount = equipment.filter(e => e.ownership_type === 'sold').length;
  
  console.log(`📊 Summary:`);
  console.log(`   Rental Equipment: ${rentalCount}`);
  console.log(`   Sold Equipment: ${soldCount}`);
  console.log(`   Total: ${equipment.length}\n`);
  
  await connection.end();
}

checkEquipment().catch(console.error);

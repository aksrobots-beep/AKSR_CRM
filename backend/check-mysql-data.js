import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function checkData() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'ak_crm',
  });

  try {
    console.log('📊 Checking MySQL database contents...\n');
    
    const [users] = await conn.execute('SELECT email, name, role FROM users LIMIT 10');
    console.log(`Users (${users.length} found):`);
    users.forEach(u => console.log(`  - ${u.email} (${u.name}, ${u.role})`));
    
    const [clients] = await conn.execute('SELECT name, company_name FROM clients LIMIT 5');
    console.log(`\nClients (${clients.length} found):`);
    clients.forEach(c => console.log(`  - ${c.name} (${c.company_name})`));
    
    const [tickets] = await conn.execute('SELECT ticket_number, title FROM tickets LIMIT 5');
    console.log(`\nTickets (${tickets.length} found):`);
    tickets.forEach(t => console.log(`  - ${t.ticket_number}: ${t.title}`));
    
  } finally {
    await conn.end();
  }
}

checkData().catch(console.error);

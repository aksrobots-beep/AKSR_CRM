import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const [clientsCount] = await connection.execute(
      "SELECT COUNT(*) AS cnt FROM clients WHERE client_code IN ('DR2227','D-S931','D-P696','D-P631')"
    );
    console.log('Matched client count:', clientsCount[0].cnt);

    const [sampleClients] = await connection.execute(
      "SELECT client_code, company_name FROM clients WHERE client_code IN ('DR2227','D-S931','D-P696') ORDER BY client_code"
    );
    console.log('Sample clients:', sampleClients);

    const [sampleEquipment] = await connection.execute(
      `SELECT c.client_code, e.name, e.rental_amount, e.rental_duration_months, e.rental_start_date, e.rental_end_date, e.model_numbers
       FROM equipment e
       JOIN clients c ON c.id = e.client_id
       WHERE c.client_code IN ('DR2227','D-S931')
       ORDER BY c.client_code, e.created_at DESC
       LIMIT 5`
    );
    console.log('Sample equipment:', sampleEquipment);
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

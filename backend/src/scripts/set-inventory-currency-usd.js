import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
  console.log('\n--- Update Inventory Currency To USD ---\n');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const [result] = await connection.execute(
      "UPDATE inventory SET currency = 'USD'"
    );

    const affected = result?.affectedRows ?? 0;
    console.log(`  Updated ${affected} inventory rows to USD.`);
  } finally {
    await connection.end();
  }

  console.log('\n  Done.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

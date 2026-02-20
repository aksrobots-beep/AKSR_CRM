import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

async function diagnoseLogin() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });
  
  console.log('🔍 Diagnosing login issue...\n');
  console.log(`Database: ${process.env.DB_HOST}/${process.env.DB_NAME}\n`);
  
  // Get all active users
  const [users] = await connection.execute(
    'SELECT id, email, name, role, password FROM users WHERE is_active = 1'
  );
  
  console.log(`Found ${users.length} active users:\n`);
  
  for (const user of users) {
    console.log(`📧 ${user.email}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Password hash: ${user.password.substring(0, 30)}...`);
    
    // Test if admin123 matches
    const testPassword = 'admin123';
    try {
      const matches = await bcrypt.compare(testPassword, user.password);
      if (matches) {
        console.log(`   ✅ Password "admin123" MATCHES!`);
      } else {
        console.log(`   ❌ Password "admin123" does NOT match`);
      }
    } catch (e) {
      console.log(`   ⚠️  Error testing password: ${e.message}`);
    }
    console.log('');
  }
  
  // Check specifically for admin@aksuccess.com.my
  const [adminCheck] = await connection.execute(
    'SELECT * FROM users WHERE email = ?',
    ['admin@aksuccess.com.my']
  );
  
  if (adminCheck.length === 0) {
    console.log('❌ No user found with email: admin@aksuccess.com.my');
    console.log('   You need to create this user or use a different email\n');
  } else {
    console.log('✅ User admin@aksuccess.com.my exists');
    console.log(`   Active: ${adminCheck[0].is_active ? 'Yes' : 'No'}`);
  }
  
  await connection.end();
}

diagnoseLogin().catch(console.error);

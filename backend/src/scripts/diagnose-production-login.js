/**
 * Enhanced Login Diagnostic for Production
 * Run: node src/scripts/diagnose-production-login.js
 * 
 * This will show EXACTLY where the login is failing
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const EMAIL = process.env.DIAG_EMAIL;
const PASSWORD = process.env.DIAG_PASSWORD;
const EXPECTED_HASH = process.env.DIAG_EXPECTED_HASH || '';

async function diagnose() {
  if (!EMAIL || !PASSWORD) {
    console.error('❌ Missing DIAG_EMAIL or DIAG_PASSWORD in environment.');
    console.error('   Example: DIAG_EMAIL=user@example.com DIAG_PASSWORD=yourPassword node src/scripts/diagnose-production-login.js');
    process.exit(1);
  }
  console.log('🔍 PRODUCTION LOGIN DIAGNOSTIC\n');
  console.log('Testing login for:', EMAIL);
  console.log('Password: <redacted>');
  if (EXPECTED_HASH) {
    console.log('Expected hash:', EXPECTED_HASH.substring(0, 29) + '...\n');
  } else {
    console.log('Expected hash: (not provided)\n');
  }

  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };

  console.log('📊 Database Configuration:');
  console.log(`   Host: ${config.host}:${config.port}`);
  console.log(`   Database: ${config.database}`);
  console.log(`   User: ${config.user}\n`);

  if (!config.user || !config.password || !config.database) {
    console.error('❌ MISSING DATABASE CREDENTIALS in .env');
    console.error('   Required: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME\n');
    process.exit(1);
  }

  let conn;
  let failurePoint = null;

  try {
    // TEST 1: Database Connection
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST 1: Database Connection');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    try {
      conn = await mysql.createConnection(config);
      console.log('✅ SUCCESS: Connected to database\n');
    } catch (connErr) {
      console.error('❌ FAILURE: Cannot connect to database');
      console.error('   Error:', connErr.message);
      console.error('   Code:', connErr.code);
      failurePoint = 'Database Connection';
      throw connErr;
    }

    // TEST 2: Check if users table exists
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST 2: Users Table Exists');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    try {
      const [tables] = await conn.execute("SHOW TABLES LIKE 'users'");
      if (tables.length === 0) {
        console.error('❌ FAILURE: "users" table does not exist');
        failurePoint = 'Users table missing';
        throw new Error('users table not found');
      }
      console.log('✅ SUCCESS: "users" table exists\n');
    } catch (tableErr) {
      console.error('❌ FAILURE: Cannot check users table');
      console.error('   Error:', tableErr.message);
      failurePoint = 'Table Check';
      throw tableErr;
    }

    // TEST 3: User exists (exact email match)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST 3: User Exists (Exact Match)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const [exactMatch] = await conn.execute(
      'SELECT id, email, is_active, LENGTH(password) as pass_len FROM users WHERE email = ?',
      [EMAIL]
    );
    
    if (exactMatch.length === 0) {
      console.error(`❌ FAILURE: No user found with email = "${EMAIL}"`);
      console.log('\n   Checking for similar emails...');
      const [allUsers] = await conn.execute('SELECT email FROM users LIMIT 10');
      console.log('   Users in database:', allUsers.map(u => u.email).join(', ') || 'NONE');
      failurePoint = 'User does not exist';
      throw new Error('User not found in database');
    }
    
    const exactUser = exactMatch[0];
    console.log('✅ SUCCESS: User found');
    console.log(`   ID: ${exactUser.id}`);
    console.log(`   Email: ${exactUser.email}`);
    console.log(`   is_active: ${exactUser.is_active} (type: ${typeof exactUser.is_active})`);
    console.log(`   Password length: ${exactUser.pass_len} chars\n`);

    // TEST 4: Login query (case-insensitive, with is_active check)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST 4: Login Query (Auth Logic)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const [loginQuery] = await conn.execute(
      "SELECT * FROM users WHERE LOWER(TRIM(email)) = ? LIMIT 1",
      [EMAIL.toLowerCase()]
    );

    if (loginQuery.length === 0) {
      console.error('❌ FAILURE: Login query returned no results');
      console.error(`   Query: SELECT * FROM users WHERE LOWER(TRIM(email)) = '${EMAIL.toLowerCase()}'`);
      failurePoint = 'Login query mismatch';
      throw new Error('User not found with login query');
    }

    const user = loginQuery[0];
    const isActive = user.is_active ?? user.IS_ACTIVE;
    const inactive = isActive === 0 || isActive === '0' || isActive === false;

    if (inactive) {
      console.error('❌ FAILURE: User account is INACTIVE');
      console.error(`   is_active value: ${isActive} (type: ${typeof isActive})`);
      console.error('   User is filtered out by auth logic');
      failurePoint = 'User is inactive';
      throw new Error('User account is inactive');
    }

    console.log('✅ SUCCESS: Login query found active user');
    console.log(`   is_active: ${isActive} → User is ACTIVE\n`);

    // TEST 5: Password hash format
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST 5: Password Hash Format');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    let storedPassword = user.password ?? user.PASSWORD ?? user.Password ?? '';
    if (Buffer.isBuffer(storedPassword)) {
      storedPassword = storedPassword.toString('utf8');
    } else {
      storedPassword = String(storedPassword);
    }

    console.log(`   Stored password: ${storedPassword.substring(0, 29)}...`);
    console.log(`   Length: ${storedPassword.length} chars`);
    
    const isBcrypt = /^\$2[ab]\$/.test(storedPassword);
    if (!isBcrypt) {
      console.error('❌ FAILURE: Password is NOT in bcrypt format');
      console.error('   Expected format: $2a$10$...');
      console.error(`   Actual format: ${storedPassword.substring(0, 10)}...`);
      failurePoint = 'Invalid password hash format';
      throw new Error('Password is not bcrypt hashed');
    }
    console.log('✅ SUCCESS: Password is valid bcrypt hash\n');

    // TEST 6: Password comparison
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST 6: Password Verification');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Testing password: "${PASSWORD}"`);
    console.log(`   Against hash: ${storedPassword.substring(0, 29)}...`);

    let isMatch = false;
    try {
      isMatch = bcrypt.compareSync(PASSWORD, storedPassword);
    } catch (bcryptErr) {
      console.error('❌ FAILURE: bcrypt.compareSync threw an error');
      console.error('   Error:', bcryptErr.message);
      failurePoint = 'Bcrypt comparison error';
      throw bcryptErr;
    }

    if (!isMatch) {
      console.error('❌ FAILURE: Password does NOT match');
      console.log('\n   Debugging:');
      console.log('   1. Is the password exactly the one provided? (case-sensitive)');
      console.log('   2. Is the hash in the database correct?');
      if (EXPECTED_HASH) {
        console.log(`   3. Expected hash: ${EXPECTED_HASH}`);
        console.log(`   4. Actual hash:   ${storedPassword}`);
        console.log(`   5. Hashes match: ${storedPassword === EXPECTED_HASH}`);
        // Try comparing with expected hash
        const matchesExpected = bcrypt.compareSync(PASSWORD, EXPECTED_HASH);
        console.log(`   6. Does the provided password match expected hash? ${matchesExpected ? 'YES' : 'NO'}`);
      } else {
        console.log(`   3. Actual hash:   ${storedPassword}`);
      }
      
      failurePoint = 'Password verification failed';
      throw new Error('Password does not match stored hash');
    }

    console.log('✅ SUCCESS: Password matches!\n');

    // TEST 7: JWT Generation
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST 7: JWT Token Generation');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('⚠️  WARNING: JWT_SECRET is not set in .env');
      console.error('   Login will fail at token generation');
    } else {
      console.log('✅ SUCCESS: JWT_SECRET is configured');
      console.log(`   Length: ${jwtSecret.length} chars\n`);
    }

    // FINAL RESULT
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 ALL TESTS PASSED!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Login should work with these credentials:');
    console.log(`   Email: ${EMAIL}`);
    console.log(`   Password: ${PASSWORD}\n`);
    console.log('If login still fails, check:');
    console.log('1. Frontend is sending the correct email/password');
    console.log('2. API URL is correct (not localhost)');
    console.log('3. CORS is allowing requests from your domain');
    console.log('4. Check browser console for errors\n');

  } catch (error) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('❌ LOGIN WILL FAIL');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Failure Point: ${failurePoint || 'Unknown'}`);
    console.log(`Error: ${error.message}\n`);
    
    if (failurePoint === 'User does not exist' || failurePoint === 'Login query mismatch') {
      console.log('💡 SOLUTION: Run this to create/fix the user:');
      console.log('   node src/scripts/fix-admin-production.js\n');
    } else if (failurePoint === 'User is inactive') {
      console.log('💡 SOLUTION: Activate the user with SQL:');
      console.log(`   UPDATE users SET is_active = 1 WHERE email = '${EMAIL}';\n`);
    } else if (failurePoint === 'Invalid password hash format') {
      console.log('💡 SOLUTION: Set correct password hash:');
      console.log('   node src/scripts/fix-admin-production.js\n');
    } else if (failurePoint === 'Password verification failed') {
      console.log('💡 SOLUTION: Reset the password to correct hash:');
      console.log('   node src/scripts/fix-admin-production.js\n');
    }

    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

diagnose();

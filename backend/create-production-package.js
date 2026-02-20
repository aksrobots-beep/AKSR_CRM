import { createWriteStream, existsSync } from 'fs';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import archiver from 'archiver';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const backendDir = __dirname;
const outputFile = join(backendDir, '..', 'backend-production.zip');

// Files and directories to EXCLUDE (simpler approach)
const excludeList = [
  'node_modules',
  '.git',
  '.env',
  'create-production-package.js',
  'setup-local-db.js',
  'setup-local.ps1',
  'setup-mysql-user.js',
  'check-mysql-data.js',
  'test-db-connection.js',
  'database_aksucce2_akcrm.sql',
  '.DS_Store',
  'Thumbs.db',
  'build', // Don't include old build folder
];

function shouldExclude(path) {
  const pathLower = path.toLowerCase();
  for (const exclude of excludeList) {
    if (pathLower.includes(exclude.toLowerCase())) {
      return true;
    }
  }
  // Exclude .log and .zip files
  if (pathLower.endsWith('.log') || pathLower.endsWith('.zip')) {
    return true;
  }
  return false;
}

async function addFilesRecursive(archive, dir, basePath = '') {
  const entries = await readdir(dir);
  
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    
    if (shouldExclude(fullPath)) {
      continue;
    }
    
    try {
      const stats = await stat(fullPath);
      const archivePath = basePath ? join(basePath, entry) : entry;
      
      if (stats.isDirectory()) {
        await addFilesRecursive(archive, fullPath, archivePath);
      } else if (stats.isFile()) {
        archive.file(fullPath, { name: archivePath });
        console.log(`  ✓ ${archivePath}`);
      }
    } catch (err) {
      console.warn(`  ⚠ Skipping ${entry}:`, err.message);
    }
  }
}

async function createProductionPackage() {
  console.log('📦 Creating production deployment package...\n');
  
  const archive = archiver('zip', { zlib: { level: 9 } });
  const output = createWriteStream(outputFile);
  
  archive.pipe(output);
  
  // Add package files
  console.log('Adding package files:');
  if (existsSync(join(backendDir, 'package.json'))) {
    archive.file(join(backendDir, 'package.json'), { name: 'package.json' });
    console.log('  ✓ package.json');
  }
  if (existsSync(join(backendDir, 'package-lock.json'))) {
    archive.file(join(backendDir, 'package-lock.json'), { name: 'package-lock.json' });
    console.log('  ✓ package-lock.json');
  }
  
  // Add src directory
  console.log('\nAdding source files:');
  await addFilesRecursive(archive, join(backendDir, 'src'), 'src');
  
  // Add .env.example
  console.log('\nCreating .env.example...');
  const envExample = `# Database Configuration
DB_HOST=your_database_host
DB_PORT=3306
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_NAME=your_database_name

# Server Configuration
PORT=3001
NODE_ENV=production

# CORS Configuration
CORS_ORIGIN=https://your-frontend-domain.com

# JWT Secret (change this to a secure random string)
JWT_SECRET=your_jwt_secret_key_here

# Debug (set to 0 for production)
DEBUG_LOGIN=0
`;
  archive.append(envExample, { name: '.env.example' });
  console.log('  ✓ .env.example');
  
  // Add deployment README
  console.log('\nCreating DEPLOYMENT.md...');
  const deploymentReadme = `# Backend Deployment Guide

## Installation Steps

1. Extract: \`unzip backend-production.zip\`
2. Install: \`npm install --production\`
3. Configure: \`cp .env.example .env\` (edit with your credentials)
4. Fix admin login: \`npm run fix-admin\`
5. Start: \`npm start\`

## Available Commands

- \`npm start\` - Start the server
- \`npm run diagnose-production\` - Diagnose login issues
- \`npm run fix-admin\` - Fix admin@aksuccess.com.my login
- \`npm run reset-password\` - Reset any user password
- \`npm run init-mysql\` - Initialize database tables

## Using PM2 (Recommended)

\`\`\`bash
npm install -g pm2
pm2 start src/server.js --name ak-crm-api
pm2 save
pm2 startup
\`\`\`
`;
  archive.append(deploymentReadme, { name: 'DEPLOYMENT.md' });
  console.log('  ✓ DEPLOYMENT.md');
  
  await archive.finalize();
  
  return new Promise((resolve, reject) => {
    output.on('close', () => {
      const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(2);
      console.log(`\n✅ Production package created successfully!`);
      console.log(`   File: ${outputFile}`);
      console.log(`   Size: ${sizeMB} MB`);
      console.log(`   Total files: ${archive.pointer()}\n`);
      resolve();
    });
    
    archive.on('error', (err) => {
      console.error('❌ Error creating package:', err);
      reject(err);
    });
  });
}

createProductionPackage().catch(console.error);

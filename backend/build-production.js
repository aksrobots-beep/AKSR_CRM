import { createWriteStream, mkdirSync, existsSync, rmSync } from 'fs';
import { readdir, stat, readFile, copyFile, writeFile } from 'fs/promises';
import { join, relative } from 'path';
import archiver from 'archiver';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const backendDir = __dirname;
const buildDir = join(backendDir, 'build');
const outputFile = join(backendDir, '..', 'backend-production.zip');

// Files and directories to exclude
const excludePatterns = [
  'node_modules',
  '.git',
  '.env',
  '*.log',
  'test-db-connection.js',
  'create-production-package.js',
  'setup-local-db.js',
  'setup-local.ps1',
  'setup-mysql-user.js',
  'check-mysql-data.js',
  'database_aksucce2_akcrm.sql',
  '.DS_Store',
  'Thumbs.db',
  '*.zip',
  'build',
];

// Files to exclude from src
const excludeFromSrc = [
  'src/scripts/create-suppliers-table.js',
  'src/scripts/import-robot-service-records.js',
  'src/db/init.js',
  'src/db/database.js',
];

async function shouldExclude(filePath) {
  const relativePath = relative(backendDir, filePath);
  const fileName = relativePath.split(/[/\\]/).pop();
  
  // Check exact path matches
  for (const pattern of excludeFromSrc) {
    if (relativePath === pattern || relativePath.replace(/\\/g, '/') === pattern) {
      return true;
    }
  }
  
  for (const pattern of excludePatterns) {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace('*', '.*'));
      if (regex.test(fileName) || regex.test(relativePath)) {
        return true;
      }
    } else {
      if (fileName === pattern || relativePath.includes(pattern)) {
        return true;
      }
    }
  }
  return false;
}

async function copyDirectory(src, dest, basePath = '') {
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }
  
  try {
    const entries = await readdir(src);
    
    for (const entry of entries) {
      const srcPath = join(src, entry);
      const destPath = join(dest, entry);
      const relativePath = join(basePath, entry);
      
      if (await shouldExclude(srcPath)) {
        console.log(`  Excluding: ${relativePath}`);
        continue;
      }
      
      try {
        const stats = await stat(srcPath);
        if (stats.isDirectory()) {
          await copyDirectory(srcPath, destPath, relativePath);
        } else {
          await copyFile(srcPath, destPath);
        }
      } catch (err) {
        console.warn(`  Warning: Could not copy ${relativePath}:`, err.message);
      }
    }
  } catch (err) {
    console.warn(`  Warning: Could not read directory ${src}:`, err.message);
  }
}

async function createProductionBuild() {
  console.log('🧹 Cleaning build directory...\n');
  
  // Clean build directory
  if (existsSync(buildDir)) {
    rmSync(buildDir, { recursive: true, force: true });
  }
  mkdirSync(buildDir, { recursive: true });
  
  console.log('📦 Creating production build...\n');
  
  // Copy package.json and package-lock.json
  console.log('Copying package files...');
  await copyFile(join(backendDir, 'package.json'), join(buildDir, 'package.json'));
  await copyFile(join(backendDir, 'package-lock.json'), join(buildDir, 'package-lock.json'));
  
  // Copy src directory (excluding unnecessary files)
  console.log('Copying source files...');
  await copyDirectory(join(backendDir, 'src'), join(buildDir, 'src'), 'src');
  
  // Create .env.example
  console.log('Creating .env.example...');
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
  await writeFile(join(buildDir, '.env.example'), envExample);
  
  // Create .htaccess for cPanel (if needed)
  const htaccess = `# Enable Node.js
RewriteEngine On
RewriteRule ^$ http://127.0.0.1:3001/ [P,L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ http://127.0.0.1:3001/$1 [P,L]
`;
  await writeFile(join(buildDir, '.htaccess'), htaccess);
  
  // Create deployment README
  const deploymentReadme = `# AK Success CRM - Backend Deployment Guide

## Prerequisites
- Node.js 18+ installed
- MySQL database server
- Production database credentials
- cPanel access (for hosting)

## cPanel Deployment Steps

1. **Upload and Extract**
   - Upload \`backend-production.zip\` to your cPanel file manager
   - Extract the zip file in your desired directory (e.g., \`public_html/api\` or \`api\`)

2. **Install Dependencies**
   - Open Terminal in cPanel
   - Navigate to the extracted directory
   - Run: \`npm install --production\`

3. **Configure Environment Variables**
   - Copy \`.env.example\` to \`.env\`
   - Edit \`.env\` with your production database credentials:
     \`\`\`
     DB_HOST=your_production_host
     DB_PORT=3306
     DB_USER=your_database_user
     DB_PASSWORD=your_database_password
     DB_NAME=your_database_name
     PORT=3001
     NODE_ENV=production
     CORS_ORIGIN=https://your-frontend-domain.com
     JWT_SECRET=your_secure_random_string_here
     \`\`\`

4. **Initialize Database (First Time Only)**
   \`\`\`bash
   npm run init-mysql
   \`\`\`

5. **Start the Application**
   - In cPanel, go to "Setup Node.js App"
   - Create a new application:
     - Node.js version: 18.x or higher
     - Application root: your backend directory
     - Application URL: your-api-domain.com
     - Application startup file: \`src/server.js\`
   - Click "Create"
   - Click "Run NPM Install" (if needed)
   - Click "Start App"

## Alternative: Using PM2 (SSH Access Required)

If you have SSH access:

\`\`\`bash
cd /path/to/backend
npm install --production
cp .env.example .env
# Edit .env with your credentials
npm run init-mysql  # First time only
pm2 start src/server.js --name ak-crm-backend
pm2 save
pm2 startup
\`\`\`

## Environment Variables

See \`.env.example\` for all required environment variables.

## API Endpoints

- Health Check: \`GET /api/health\`
- API Base: \`/api/*\`

## Troubleshooting

- **Database Connection Issues**: Verify credentials in \`.env\`
- **Port Conflicts**: Change PORT in \`.env\` if 3001 is in use
- **CORS Errors**: Update CORS_ORIGIN in \`.env\` to match your frontend domain
- **Module Not Found**: Run \`npm install --production\` again

## Support

For issues or questions, contact the development team.
`;
  
  await writeFile(join(buildDir, 'DEPLOYMENT.md'), deploymentReadme);
  
  console.log('\n✅ Production build created successfully!\n');
  console.log(`   Build directory: ${buildDir}\n`);
  
  return buildDir;
}

async function createZipPackage(buildDir) {
  console.log('📦 Creating deployment zip package...\n');
  
  const archive = archiver('zip', { zlib: { level: 9 } });
  const output = createWriteStream(outputFile);
  
  archive.pipe(output);
  
  // Add all files from build directory
  async function addToArchive(dir, basePath = '') {
    try {
      const entries = await readdir(dir);
      
      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const relativePath = join(basePath, entry);
        
        try {
          const stats = await stat(fullPath);
          if (stats.isDirectory()) {
            await addToArchive(fullPath, relativePath);
          } else {
            archive.file(fullPath, { name: relativePath });
            console.log(`  Adding: ${relativePath}`);
          }
        } catch (err) {
          // Skip if can't access
          continue;
        }
      }
    } catch (err) {
      // Skip if directory doesn't exist
      return;
    }
  }
  
  await addToArchive(buildDir);
  await archive.finalize();
  
  return new Promise((resolve, reject) => {
    output.on('close', () => {
      const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(2);
      console.log(`\n✅ Production package created successfully!`);
      console.log(`   File: ${outputFile}`);
      console.log(`   Size: ${sizeMB} MB\n`);
      resolve();
    });
    
    archive.on('error', (err) => {
      console.error('❌ Error creating package:', err);
      reject(err);
    });
  });
}

async function main() {
  try {
    const buildDir = await createProductionBuild();
    await createZipPackage(buildDir);
    console.log('🎉 Production deployment package ready for cPanel!\n');
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

main();

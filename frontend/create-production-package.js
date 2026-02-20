const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

console.log('📦 Creating frontend production package...\n');

const output = fs.createWriteStream('frontend-production.zip');
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(2);
  console.log(`\n✅ Frontend production package created successfully!`);
  console.log(`   File: ${path.resolve('frontend-production.zip')}`);
  console.log(`   Size: ${sizeMB} MB`);
  console.log(`   Total: ${archive.pointer()} bytes\n`);
});

archive.on('error', (err) => {
  throw err;
});

archive.pipe(output);

// Add the entire dist folder
console.log('Adding built files from dist/...');
archive.directory('dist/', false);

// Add deployment documentation
const deploymentDoc = `# AK Success CRM - Frontend Deployment Guide

## Production Build Contents

This package contains the production-ready frontend build for AK Success CRM.

## Deployment Instructions

### Option 1: Static Web Server (Nginx, Apache)

1. Extract this package to your web server root directory
2. Configure your web server to serve the files
3. Ensure all routes redirect to index.html for React Router to work

**Nginx Configuration:**
\`\`\`nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/extracted/files;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
\`\`\`

**Apache Configuration (.htaccess):**
\`\`\`apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
\`\`\`

### Option 2: Cloud Hosting (Netlify, Vercel)

1. Extract this package
2. Upload the contents to your cloud hosting provider
3. Set build command: (none - already built)
4. Set publish directory: (root of extracted files)

### Option 3: Docker

Create a Dockerfile:
\`\`\`dockerfile
FROM nginx:alpine
COPY . /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
\`\`\`

## Environment Configuration

The frontend expects the backend API to be available. Update the API URL if needed:
- Default: Uses relative paths (assumes same domain)
- To change: Update VITE_API_URL in build configuration

## Files Included

- index.html - Main HTML file
- assets/ - JavaScript, CSS, and other assets
  - Optimized and minified for production
  - Includes vendor chunks for better caching
  - Gzip compressed for faster loading

## Post-Deployment

1. Verify all routes work correctly
2. Test that API calls reach your backend
3. Check browser console for any errors
4. Ensure CORS is configured on backend

## Support

For issues or questions, contact your development team.

Built: ${new Date().toISOString()}
Version: 1.0.0
`;

archive.append(deploymentDoc, { name: 'DEPLOYMENT.md' });

console.log('✓ DEPLOYMENT.md\n');

archive.finalize();

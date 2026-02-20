# AK Success CRM - Frontend Deployment Guide

## Production Package

**File**: `frontend-production.zip`  
**Size**: ~0.12 MB  
**Built**: ${new Date().toLocaleDateString()}

## What's Inside

The package contains the optimized production build:
- `index.html` - Main HTML file (1.04 KB)
- `assets/` folder containing:
  - `index-*.css` - Styles (40.40 KB, gzipped: 6.82 KB)
  - `index-*.js` - Main application (267.54 KB, gzipped: 54.69 KB)
  - `vendor-*.js` - Third-party libraries (162.60 KB, gzipped: 52.89 KB)
  - `ui-*.js` - UI components (35.82 KB, gzipped: 11.01 KB)

## Deployment Options

### Option 1: Static Web Server (Nginx)

1. **Extract the package**:
   ```bash
   unzip frontend-production.zip -d /var/www/crm
   ```

2. **Configure Nginx**:
   ```nginx
   server {
       listen 80;
       server_name crm.aksuccessrobotics.com.my;
       root /var/www/crm;
       index index.html;

       # Enable gzip compression
       gzip on;
       gzip_types text/css application/javascript application/json;

       location / {
           try_files $uri $uri/ /index.html;
       }

       # Cache static assets
       location /assets/ {
           expires 1y;
           add_header Cache-Control "public, immutable";
       }
   }
   ```

3. **Restart Nginx**:
   ```bash
   sudo systemctl restart nginx
   ```

### Option 2: Apache Web Server

1. **Extract to web root**:
   ```bash
   unzip frontend-production.zip -d /var/www/html/crm
   ```

2. **Create `.htaccess`** in the extracted folder:
   ```apache
   <IfModule mod_rewrite.c>
     RewriteEngine On
     RewriteBase /
     RewriteRule ^index\.html$ - [L]
     RewriteCond %{REQUEST_FILENAME} !-f
     RewriteCond %{REQUEST_FILENAME} !-d
     RewriteRule . /index.html [L]
   </IfModule>

   # Enable gzip compression
   <IfModule mod_deflate.c>
     AddOutputFilterByType DEFLATE text/html text/css application/javascript
   </IfModule>

   # Cache static assets
   <FilesMatch "\.(css|js|jpg|png|gif|svg|ico)$">
     Header set Cache-Control "max-age=31536000, public"
   </FilesMatch>
   ```

3. **Enable required modules**:
   ```bash
   sudo a2enmod rewrite deflate headers
   sudo systemctl restart apache2
   ```

### Option 3: Cloud Platforms

#### Netlify
1. Extract `frontend-production.zip`
2. Drag & drop the extracted folder to Netlify
3. Or use Netlify CLI:
   ```bash
   netlify deploy --prod --dir=extracted-folder
   ```

#### Vercel
1. Extract the package
2. Use Vercel CLI:
   ```bash
   vercel --prod
   ```

#### AWS S3 + CloudFront
1. Extract the package
2. Upload to S3 bucket:
   ```bash
   aws s3 sync . s3://your-bucket-name --delete
   ```
3. Configure CloudFront for SPA routing

### Option 4: Docker

1. **Create Dockerfile**:
   ```dockerfile
   FROM nginx:alpine
   
   # Copy built files
   COPY dist/ /usr/share/nginx/html/
   
   # Copy nginx config
   COPY nginx.conf /etc/nginx/conf.d/default.conf
   
   EXPOSE 80
   CMD ["nginx", "-g", "daemon off;"]
   ```

2. **Create nginx.conf**:
   ```nginx
   server {
       listen 80;
       server_name localhost;
       root /usr/share/nginx/html;
       index index.html;

       location / {
           try_files $uri $uri/ /index.html;
       }

       location /assets/ {
           expires 1y;
           add_header Cache-Control "public, immutable";
       }
   }
   ```

3. **Build and run**:
   ```bash
   docker build -t ak-crm-frontend .
   docker run -p 80:80 ak-crm-frontend
   ```

## Important Configuration

### Backend API Connection

The frontend connects to the backend API. Ensure your backend is accessible:

**Current setup**:
- Uses relative API paths (assumes frontend and backend on same domain)
- Backend should be at: `https://api-crm.aksuccessrobotics.com.my`

**CORS Configuration Required on Backend**:
```javascript
// backend .env
CORS_ORIGIN=https://crm.aksuccessrobotics.com.my
```

### Environment Variables

If you need to change the API URL, you'll need to rebuild with:
```bash
VITE_API_URL=https://your-api-url.com npm run build
```

## Post-Deployment Checklist

- [ ] All routes are accessible (Dashboard, Clients, Equipment, etc.)
- [ ] Login works correctly
- [ ] API calls reach the backend successfully
- [ ] Images and assets load properly
- [ ] Browser console shows no errors
- [ ] Mobile responsive design works
- [ ] HTTPS is enabled (recommended)
- [ ] Gzip compression is active
- [ ] Cache headers are set for assets

## Troubleshooting

### Routes return 404
- Ensure your web server is configured for SPA routing (try_files / RewriteRule)

### API calls fail
- Check CORS settings on backend
- Verify backend URL is correct
- Check browser console for errors

### Blank page after deployment
- Check browser console for errors
- Verify all files were extracted correctly
- Ensure correct file permissions (755 for directories, 644 for files)

## Files Structure

```
frontend-production.zip
├── index.html
└── assets/
    ├── index-[hash].css
    ├── index-[hash].js
    ├── vendor-[hash].js
    └── ui-[hash].js
```

## Performance Optimizations Included

✅ Code splitting (vendor chunks)  
✅ Tree shaking (unused code removed)  
✅ Minification (CSS & JS)  
✅ Gzip compression support  
✅ Cache-friendly file hashing  
✅ Lazy loading for routes  

## Support

For deployment issues or questions, contact your development team.

---

**Version**: 1.0.0  
**Built**: ${new Date().toISOString()}  
**Node Version**: v24.12.0  
**Vite Version**: 5.4.21

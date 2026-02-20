# AK Success CRM - Backend Deployment Guide

## Prerequisites
- Node.js 18+ installed
- MySQL database server
- Production database credentials
- cPanel access (for hosting)

## cPanel Deployment Steps

1. **Upload and Extract**
   - Upload `backend-production.zip` to your cPanel file manager
   - Extract the zip file in your desired directory (e.g., `public_html/api` or `api`)

2. **Install Dependencies**
   - Open Terminal in cPanel
   - Navigate to the extracted directory
   - Run: `npm install --production`

3. **Configure Environment Variables**
   - Copy `.env.example` to `.env`
   - Edit `.env` with your production database credentials:
     ```
     DB_HOST=your_production_host
     DB_PORT=3306
     DB_USER=your_database_user
     DB_PASSWORD=your_database_password
     DB_NAME=your_database_name
     PORT=3001
     NODE_ENV=production
     CORS_ORIGIN=https://your-frontend-domain.com
     JWT_SECRET=your_secure_random_string_here
     ```

4. **Initialize Database (First Time Only)**
   ```bash
   npm run init-mysql
   ```

5. **Start the Application**
   - In cPanel, go to "Setup Node.js App"
   - Create a new application:
     - Node.js version: 18.x or higher
     - Application root: your backend directory
     - Application URL: your-api-domain.com
     - Application startup file: `src/server.js`
   - Click "Create"
   - Click "Run NPM Install" (if needed)
   - Click "Start App"

## Alternative: Using PM2 (SSH Access Required)

If you have SSH access:

```bash
cd /path/to/backend
npm install --production
cp .env.example .env
# Edit .env with your credentials
npm run init-mysql  # First time only
pm2 start src/server.js --name ak-crm-backend
pm2 save
pm2 startup
```

## Environment Variables

See `.env.example` for all required environment variables.

## API Endpoints

- Health Check: `GET /api/health`
- API Base: `/api/*`

## Troubleshooting

- **Database Connection Issues**: Verify credentials in `.env`
- **Port Conflicts**: Change PORT in `.env` if 3001 is in use
- **CORS Errors**: Update CORS_ORIGIN in `.env` to match your frontend domain
- **Module Not Found**: Run `npm install --production` again

## Support

For issues or questions, contact the development team.

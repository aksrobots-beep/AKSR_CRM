# AK Success CRM - Frontend Production Deployment

## Build Output

- **Production build folder:** `dist/`
- **Deployment package:** `frontend-production.zip` (in project root)

## Build for Production

```bash
cd frontend
npm run build
```

This generates optimized static files in `dist/` (HTML, CSS, JS).

## cPanel / Static Hosting Deployment

### Option 1: Upload Zip
1. Use the generated `frontend-production.zip` from the project root.
2. In cPanel File Manager, go to `public_html` (or your domain root).
3. Upload `frontend-production.zip` and extract it.
4. Ensure these are at the document root:
   - `index.html`
   - `assets/` folder
   - `favicon.svg`
   - `.htaccess` (if present)

### Option 2: Upload dist Contents
1. Run `npm run build` in the frontend folder.
2. Upload the contents of the `dist/` folder to your web root via FTP or File Manager.

## Environment Variables for Production

Create a `.env.production` in the frontend folder **before building** if your API URL is not default:

```
VITE_API_URL=https://your-api-domain.com/api
VITE_BASE_PATH=/
```

Then run `npm run build`. The built files will use this API URL.

- **VITE_API_URL** – Backend API base URL (e.g. `https://api.yoursite.com/api`).
- **VITE_BASE_PATH** – Base path if the app is not at root (e.g. `/crm/` for `yoursite.com/crm/`).

## Post-Deployment

1. **SPA routing:** Ensure your server serves `index.html` for all routes (see `.htaccess` for Apache).
2. **CORS:** Backend must allow your frontend origin in `CORS_ORIGIN` or cors config.
3. **HTTPS:** Use HTTPS in production for both frontend and API.

## File Structure in Zip

```
index.html
favicon.svg
.htaccess (if present)
assets/
  index-*.js
  index-*.css
  vendor-*.js
  ui-*.js
```

These files are ready to be placed in the document root of your hosting.

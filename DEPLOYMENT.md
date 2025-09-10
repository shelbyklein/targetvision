# TargetVision Deployment Guide

## 🚀 Railway Deployment (Recommended)

### Prerequisites
1. GitHub repository with your code
2. Railway account (sign up at [railway.app](https://railway.app))
3. API keys ready (SmugMug, Anthropic/OpenAI)

### Step 1: Database Setup
1. In Railway dashboard, click "New Project"
2. Select "Deploy PostgreSQL"
3. Once deployed, go to the PostgreSQL service settings
4. In the "Connect" tab, copy the `DATABASE_URL`
5. Add pgvector extension:
   - Go to "Data" tab
   - Run query: `CREATE EXTENSION IF NOT EXISTS vector;`

### Step 2: Deploy Backend
1. In the same project, click "New" → "GitHub Repo"
2. Select your TargetVision repository
3. Railway will auto-detect the Python app
4. Go to "Variables" tab and add:
   ```
   ENVIRONMENT=production
   DATABASE_URL=(auto-filled by Railway)
   SMUGMUG_API_KEY=your_key_here
   SMUGMUG_API_SECRET=your_secret_here
   SMUGMUG_CALLBACK_URL=https://your-frontend-domain.railway.app/callback
   ANTHROPIC_API_KEY=your_key_here
   OPENAI_API_KEY=your_key_here (optional)
   SECRET_KEY=generate_random_string_here
   CORS_ORIGINS=https://your-frontend-domain.railway.app
   ```
5. Go to "Settings" → "Deploy"
6. Set Start Command: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`

### Step 3: Deploy Frontend
1. Click "New" → "Empty Service"
2. Name it "targetvision-frontend"
3. Go to "Settings" → "Deploy"
4. Set Build Command: `echo "No build needed"`
5. Set Start Command: `python -m http.server $PORT --directory frontend`
6. Go to "Settings" → "Environment"
7. Add Root Directory: `/frontend`

### Step 4: Configure Domains
1. For backend service:
   - Go to "Settings" → "Networking"
   - Generate domain or add custom domain
   - Copy the URL (e.g., `targetvision-backend.railway.app`)

2. For frontend service:
   - Go to "Settings" → "Networking"
   - Generate domain or add custom domain
   - Copy the URL (e.g., `targetvision-frontend.railway.app`)

3. Update environment variables:
   - In backend, update `CORS_ORIGINS` with frontend URL
   - In backend, update `SMUGMUG_CALLBACK_URL` with frontend URL + `/callback`

### Step 5: Database Migrations
1. In backend service terminal (Railway dashboard → service → terminal):
   ```bash
   alembic upgrade head
   ```

### Step 6: Verify Deployment
1. Visit your frontend URL
2. Check health endpoint: `https://your-backend.railway.app/health`
3. Test SmugMug OAuth flow

---

## 🎯 Alternative: Render Deployment

### Database
1. Use Render PostgreSQL or Supabase (free tier)
2. Enable pgvector extension

### Backend (Render Web Service)
1. Connect GitHub repo
2. Build Command: `pip install -r requirements.txt`
3. Start Command: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
4. Add environment variables

### Frontend (Render Static Site)
1. Connect same GitHub repo
2. Build Command: `echo "No build needed"`
3. Publish Directory: `frontend`

---

## 🌐 Alternative: Vercel + Supabase

### Database (Supabase)
1. Create new project at [supabase.com](https://supabase.com)
2. Enable pgvector in SQL editor:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
3. Copy connection string

### Backend (Vercel Functions or Railway)
- Deploy backend to Railway (as above)
- Or convert to Vercel Functions (requires refactoring)

### Frontend (Vercel)
1. Import GitHub repo to Vercel
2. Set root directory to `frontend`
3. No build command needed
4. Add environment variable for API URL

---

## 📝 Environment Variables Reference

### Required for Production
```bash
# Application
ENVIRONMENT=production
SECRET_KEY=<generate-secure-random-string>

# Database (provided by platform)
DATABASE_URL=postgresql://...

# SmugMug OAuth
SMUGMUG_API_KEY=<your-smugmug-api-key>
SMUGMUG_API_SECRET=<your-smugmug-api-secret>
SMUGMUG_CALLBACK_URL=https://your-frontend-url/callback

# AI Services (at least one required)
ANTHROPIC_API_KEY=<your-anthropic-api-key>
OPENAI_API_KEY=<your-openai-api-key>

# CORS (important!)
CORS_ORIGINS=https://your-frontend-url
```

### Optional
```bash
# Monitoring
SENTRY_DSN=<your-sentry-dsn>

# Redis (for caching)
REDIS_URL=redis://...

# File Storage
AWS_S3_BUCKET=<your-s3-bucket>
CLOUDINARY_URL=cloudinary://...
```

---

## 🔧 Post-Deployment Checklist

- [ ] Test SmugMug OAuth flow
- [ ] Verify photo sync works
- [ ] Test AI processing (single photo)
- [ ] Test batch processing
- [ ] Check collections functionality
- [ ] Verify search works
- [ ] Test chat interface
- [ ] Configure custom domain (optional)
- [ ] Set up monitoring (optional)
- [ ] Configure backups (recommended)

---

## 🐛 Troubleshooting

### CORS Errors
- Ensure `CORS_ORIGINS` in backend matches your frontend URL exactly
- Include protocol (https://) in CORS_ORIGINS

### Database Connection Issues
- Railway: DATABASE_URL is auto-injected
- Render: Check connection pooling settings
- Ensure pgvector extension is installed

### OAuth Callback Errors
- Update SmugMug app settings with production callback URL
- Ensure SMUGMUG_CALLBACK_URL matches exactly

### Static Files Not Loading
- Check frontend service is serving from correct directory
- Verify API URL configuration in frontend config.js

---

## 📊 Monitoring & Logs

### Railway
- View logs: Dashboard → Service → Logs
- Metrics: Dashboard → Service → Metrics
- Set up alerts in Settings

### Render
- View logs: Dashboard → Service → Logs
- Metrics: Dashboard → Service → Metrics

### Recommended Monitoring
- [Sentry](https://sentry.io) for error tracking
- [Datadog](https://datadoghq.com) for APM
- [LogDNA](https://logdna.com) for log aggregation

---

## 🔄 Updating Your Deployment

### Railway
1. Push changes to GitHub
2. Railway auto-deploys on push to main branch
3. Or manually trigger: Dashboard → Deploy → Deploy

### Render
1. Push changes to GitHub
2. Auto-deploys if configured
3. Or manually: Dashboard → Manual Deploy

---

## 💰 Cost Estimates

### Railway
- Hobby: $5/month (includes $5 usage)
- Pro: $20/month (includes $20 usage)
- Database: ~$5-15/month
- **Total: ~$10-35/month**

### Render
- Free tier available (with limitations)
- Starter: $7/month per service
- Database: $7/month
- **Total: ~$0-21/month**

### Supabase + Vercel
- Supabase: Free tier (up to 500MB)
- Vercel: Free tier for frontend
- Backend on Railway: $5-10/month
- **Total: ~$5-10/month**

---

## 🎉 Success!

Once deployed, your TargetVision app will be accessible at:
- Frontend: `https://your-app.railway.app`
- Backend API: `https://your-app-backend.railway.app`
- API Docs: `https://your-app-backend.railway.app/docs`

Remember to update your SmugMug app settings with the production callback URL!
# Supabase Setup Guide

## 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up or log in
3. Click "New Project"
4. Fill in the project details:
   - Project Name: `fashion-marketplace`
   - Password: Create a strong password (save it!)
   - Region: Choose closest to your users
5. Wait for project to be created (2-3 minutes)

## 2. Get API Keys

1. Go to Project Settings → API
2. Copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 3. Initialize Database Schema

1. Go to SQL Editor in Supabase dashboard
2. Click "New Query"
3. Copy contents of `supabase/migrations/001_init_schema.sql`
4. Paste and click "Run"

## 4. Configure Environment Variables

### Local Development (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_WEBHOOK_URL=https://your-domain.com/api/telegram/webhook
```

### Vercel Deployment
1. Go to Vercel Project Settings → Environment Variables
2. Add the same variables as above
3. Redeploy the project

## 5. Verify Connection

Run locally:
```bash
npm run dev
```

Check browser console and Supabase logs for any errors.

## 6. Database Management

### Connect with PgAdmin (optional)
- Use the connection string from Supabase
- Database name, user, password from project settings

### View/Edit Data
- Use Supabase Dashboard → Table Editor
- Or write SQL queries in SQL Editor

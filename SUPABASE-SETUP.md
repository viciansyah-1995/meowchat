# MeowTrack Chat - Supabase Setup

## Auth Strategy
- Login: **email + password**
- Public identity: **username** + **display_name**
- No phone number required

## Dashboard Checklist
### 1. Authentication
- Go to **Authentication → Providers**
- Ensure **Email** provider is enabled

### 2. URL Configuration
Go to **Authentication → URL Configuration** and set:
- **Site URL**: `http://localhost:3010`
- Optionally add redirect URLs later if deploying to Vercel

### 3. SQL Editor
Open **SQL Editor** in Supabase dashboard.
You will paste the SQL from `supabase/schema.sql`.

### 4. Storage
Later create bucket:
- bucket name: `chat-media`
- recommended phase-1: start with private bucket

## Environment Variables
Project local env uses:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Next Steps
1. Run SQL schema in Supabase
2. Install Supabase JS client
3. Refactor auth from localStorage to Supabase Auth
4. Create profile + chat + message flows

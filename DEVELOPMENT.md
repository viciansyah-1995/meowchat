# MeowTrack Chat - Development Guide

## Development Stages

### Stage 1: Local Development (Current)
**Environment:** Development Server (Next.js)  
**Storage:** localStorage (browser)  
**Status:** Active

### Stage 2: Local Development with Mock Backend
**Environment:** Development Server + In-Memory Mock API  
**Storage:** localStorage + Mock Data Layer  
**Status:** Planned

### Stage 3: Local Development with Real Backend
**Environment:** Development Server + Supabase/Firebase  
**Storage:** Supabase Database  
**Status:** Future

### Stage 4: Staging Deployment
**Environment:** Vercel Staging  
**Database:** Supabase Staging  
**Status:** Future

### Stage 5: Production Deployment
**Environment:** Vercel Production  
**Database:** Supabase Production  
**Status:** Final

---

## Stage 1: Local Development (Current)

### Prerequisites
- Node.js 18+
- npm or yarn

### Setup
```bash
# Clone / Create project
cd MeowTrack-Chat

# Install dependencies
npm install

# Run development server
npm run dev
```

### Development Server URLs
- Local: http://localhost:3003
- Network: http://192.168.1.19:3003

### Features Available
- User registration (localStorage)
- User login (localStorage)
- Add contacts (by username)
- Send text messages
- Send images (via URL)
- Emoji support (system keyboard)
- Chat history (localStorage)

### Limitations
- Only works in same browser (localStorage)
- No real-time sync
- No multi-device support

### Testing Flow
1. Open http://localhost:3003 in browser
2. Register User A
3. Open http://localhost:3003 in Incognito window
4. Register User B
5. User A adds "usernameB" as contact
6. Chat between A and B

### Commands
```bash
# Development
npm run dev

# Build for production (local test)
npm run build
npm start

# Lint
npm run lint
```

---

## Stage 2: Local Development with Mock Backend (Planned)

### What's Different
- Add mock API layer that simulates server responses
- Test API contracts before real backend
- Validate data flow

### Implementation
```javascript
// lib/api/mockServer.js
class MockServer {
  constructor() {
    this.users = [];
    this.messages = [];
  }
  
  async register(data) { /* ... */ }
  async login(data) { /* ... */ }
  async sendMessage(data) { /* ... */ }
}
```

### Testing
- Same as Stage 1, but with mock API layer

---

## Stage 3: Local + Real Backend (Future)

### Architecture
```
┌─────────────────────────────────────────────────────┐
│                  Client (Next.js)                  │
│                  localhost:3003                   │
└─────────────────────┬───────────────────────────────┘
                      │
                      │ HTTPS
                      ▼
┌─────────────────────────────────────────────────────┐
│                Supabase / Firebase                 │
│              (Cloud Database)                      │
│         Real-time sync across devices              │
└─────────────────────────────────────────────────────┘
```

### Setup Supabase
1. Create Supabase project
2. Run migrations:
```bash
# Create tables from DATA-MODEL.md
psql -h db.xxx.supabase.co -U postgres -d postgres -f migrations/001_users.sql
psql -h db.xxx.supabase.co -U postgres -d postgres -f migrations/002_contacts.sql
psql -h db.xxx.supabase.co -U postgres -d postgres -f migrations/003_messages.sql
psql -h db.xxx.supabase.co -U postgres -d postgres -f migrations/004_chats.sql
```

### Environment Variables
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Migration Script Structure
```
migrations/
├── 001_users.sql
├── 002_contacts.sql
├── 003_messages.sql
├── 004_chats.sql
└── 005_sessions.sql
```

---

## Stage 4: Staging Deployment

### When to Use
- Testing production-like environment
- Client review before final
- Integration testing

### Setup
1. Create Vercel project
2. Connect GitHub repository
3. Add environment variables
4. Deploy to staging

### URLs
- Staging: https://meowtrack-chat-staging.vercel.app
- Database: Supabase Staging

### Pre-deployment Checklist
- [ ] Build passes locally
- [ ] No console errors
- [ ] All features work in staging
- [ ] Environment variables set

---

## Stage 5: Production Deployment

### Final URLs
- Production: https://meowtrack-chat.vercel.app
- Database: Supabase Production

### Deployment Steps
```bash
# 1. Update version in package.json
# 2. Tag release
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0

# 3. Vercel auto-deploys on push to main
```

### Post-deployment Checklist
- [ ] All features work in production
- [ ] Database migrations applied
- [ ] Environment variables verified
- [ ] SSL certificate active
- [ ] PWA installable
- [ ] Performance acceptable

---

## Data Migration Guide

### From localStorage to Supabase
```javascript
// lib/migration/localToSupabase.js

class DataMigration {
  static async migrateUsers() {
    const users = JSON.parse(localStorage.getItem('meowtrackchat_users'));
    for (const user of users) {
      await supabase.from('users').insert({
        id: user.id,
        username: user.username,
        display_name: user.displayName,
        created_at: new Date(user.createdAt).toISOString()
      });
    }
  }
  
  static async migrateMessages() {
    const messages = JSON.parse(localStorage.getItem('meowtrackchat_messages'));
    for (const msg of messages) {
      await supabase.from('messages').insert({
        id: msg.id,
        chat_id: msg.chatId,
        sender_id: msg.senderId,
        receiver_id: msg.receiverId,
        content: msg.content,
        type: msg.type,
        image_url: msg.imageUrl,
        created_at: new Date(msg.timestamp).toISOString()
      });
    }
  }
}
```

### Execute Migration
```javascript
// Run in browser console or admin page
await DataMigration.migrateUsers();
await DataMigration.migrateContacts();
await DataMigration.migrateMessages();
await DataMigration.migrateChats();
```

---

## Environment Matrix

| Stage | URL | Database | Auth | Storage |
|-------|-----|----------|------|----------|
| Dev Local | localhost:3003 | localStorage | localStorage | localStorage |
| Dev + Mock | localhost:3003 | In-Memory | Mock | In-Memory |
| Dev + Backend | localhost:3003 | Supabase Dev | Supabase | Supabase |
| Staging | meowtrack-chat-staging.vercel.app | Supabase Staging | Supabase | Supabase |
| Production | meowtrack-chat.vercel.app | Supabase Prod | Supabase | Supabase |

---

## Quick Commands Reference

```bash
# Local Development
npm run dev

# Build for Testing
npm run build
npm start

# Add to GitHub
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/username/meowtrack-chat.git
git push -u origin main

# Deploy to Vercel
# 1. Push to GitHub
# 2. Vercel auto-detects Next.js
# 3. Add env vars in Vercel dashboard
# 4. Deploy

# Update later
git add .
git commit -m "Update"
git push
# Vercel auto-deploys
```
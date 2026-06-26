# MeowTrack Chat - Data Model & Architecture

## Overview
MeowTrack Chat adalah aplikasi chat PWA tanpa nomor HP. Dokumen ini menjelaskan arsitektur data dan struktur aplikasi.

---

## Database Schema (localStorage)

### 1. Users Collection
```json
{
  "id": "user_abc123",
  "username": "vici",
  "password": "plaintext_password",
  "displayName": "Vici",
  "avatar": null,
  "createdAt": 1750964000000,
  "updatedAt": 1750964000000
}
```

**Primary Key:** `id`  
**Unique Index:** `username`

---

### 2. Contacts Collection
```json
{
  "id": "contact_xyz789",
  "userId": "user_abc123",
  "contactUserId": "user_def456",
  "nickname": null,
  "addedAt": 1750965000000
}
```

**Primary Key:** `id`  
**Composite Index:** `[userId, contactUserId]`

---

### 3. Messages Collection
```json
{
  "id": "msg_001",
  "chatId": "chat_abc123_def456",
  "senderId": "user_abc123",
  "receiverId": "user_def456",
  "content": "Halo!",
  "type": "text",
  "imageUrl": null,
  "status": "sent",
  "timestamp": 1750966000000,
  "readAt": null
}
```

**Primary Key:** `id`  
**Composite Index:** `[chatId, timestamp]`  
**Search Index:** `senderId`, `receiverId`

---

### 4. Chats Collection
```json
{
  "id": "chat_abc123_def456",
  "participants": ["user_abc123", "user_def456"],
  "lastMessageAt": 1750966000000,
  "lastMessagePreview": "Halo!",
  "createdAt": 1750964000000
}
```

**Primary Key:** `id`  
**Unique Index:** participants combination (sorted)

---

### 5. Sessions Collection
```json
{
  "id": "session_001",
  "userId": "user_abc123",
  "token": "jwt_or_session_token",
  "deviceInfo": "Chrome on Windows",
  "createdAt": 1750964000000,
  "expiresAt": 1751044000000
}
```

---

## API Architecture

### Storage Layer
```
┌─────────────────────────────────────┐
│         UI Components              │
│   (Login, Register, Chat, etc)     │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│         Service Layer              │
│  AuthService, ChatService, etc    │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│       Repository Layer             │
│  UserRepo, ContactRepo, MessageRepo │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│        Storage Adapter            │
│      (localStorage wrapper)        │
└─────────────────────────────────────┘
```

---

## File Structure (Proposed)
```
MeowTrack-Chat/
├── app/
│   ├── layout.js           # Root layout
│   ├── page.js            # Main app
│   ├── globals.css        # Global styles
│   ├── screens/
│   │   ├── LoginScreen.js
│   │   ├── RegisterScreen.js
│   │   ├── ContactsScreen.js
│   │   └── ChatScreen.js
│   └── components/
│       ├── Header.js
│       ├── ContactItem.js
│       ├── MessageBubble.js
│       ├── ChatInput.js
│       └── Modal.js
├── lib/
│   ├── storage/
│   │   ├── index.js       # Storage adapter
│   │   ├── keys.js        # localStorage keys
│   │   └── migrations.js # Schema migrations
│   ├── models/
│   │   ├── User.js
│   │   ├── Contact.js
│   │   ├── Message.js
│   │   └── Chat.js
│   ├── services/
│   │   ├── AuthService.js
│   │   ├── ContactService.js
│   │   └── ChatService.js
│   └── utils/
│       ├── generateId.js
│       ├── timeFormat.js
│       └── validation.js
├── public/
│   ├── manifest.json
│   ├── service-worker.js
│   └── icons/
└── package.json
```

---

## Key Classes/Functions

### Storage Adapter
```javascript
class StorageAdapter {
  static getCollection(name)
  static setCollection(name, data)
  static getById(collection, id)
  static findOne(collection, predicate)
  static findMany(collection, predicate)
  static insert(collection, document)
  static update(collection, id, updates)
  static delete(collection, id)
}
```

### User Model
```javascript
class User {
  constructor(data)
  static create(username, password, displayName)
  static findById(id)
  static findByUsername(username)
  validate() → { valid: boolean, errors: [] }
  toJSON() → object
}
```

### Auth Service
```javascript
class AuthService {
  static register(username, password, displayName) → User
  static login(username, password) → User | null
  static logout() → void
  static getCurrentUser() → User | null
  static isAuthenticated() → boolean
}
```

### Chat Service
```javascript
class ChatService {
  static getOrCreateChat(userId1, userId2) → Chat
  static getMessages(chatId) → Message[]
  static sendMessage(chatId, senderId, content, type, imageUrl) → Message
  static markAsRead(messageId) → void
}
```

---

## Validation Rules

### User Registration
- `username`: 3-20 chars, alphanumeric + underscore only, unique
- `password`: min 6 chars
- `displayName`: 1-50 chars

### Message
- `content`: max 4000 chars (text) or valid URL (image)
- `type`: enum ['text', 'image']

### Contact
- Cannot add self
- Cannot add same user twice

---

## Migration Strategy
Version 1.0 → 1.1:
- Add schema version tracking
- Add migration runner
- Validate data integrity on load

---

## Next Steps (Implementation)
1. Refactor code to use repository pattern
2. Add validation layer
3. Add proper error handling
4. Add schema migration system
5. Consider IndexedDB for larger data
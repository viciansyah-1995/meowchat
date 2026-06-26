# MeowTrack Chat - Specification

## Project Overview
- **Project Name**: NoPhone Chat
- **Type**: Progressive Web App (PWA) - Chat Application
- **Core Functionality**: WhatsApp-like chat application without phone number requirement. Users can register with username, search contacts, and communicate 1-on-1 with emoji support.
- **Target Users**: Anyone who wants private chat without exposing phone number

---

## User Requirements

### 1. Authentication
- **Registration**: Username + password + display name
- **Login**: Username + password
- **Session**: JWT-based or localStorage token
- **Logout**: Clear session

### 2. Contact Management
- **Add Contact**: Search by username
- **Contact List**: Show all added contacts
- **Online Status**: (Optional for phase 1 - can be indicator)

### 3. Chat Functionality
- **1-on-1 Chat**: Private message between two users
- **Message Types**: Text + Emoji
- **Chat History**: Persisted per conversation
- **Timestamp**: Shown per message

### 4. Emoji Support
- Native emoji keyboard (system-level)
- Or simple emoji picker (optional for phase 1)

---

## Technical Scope (Phase 1: Mock UI)

Since this is concept/MVP phase first:

### Frontend Only (No Backend)
- **Framework**: Next.js or vanilla HTML/CSS/JS
- **Storage**: localStorage for users, contacts, messages
- **PWA**: Service worker for installability

### Data Model (localStorage)
```javascript
// Users
users: [
  { id, username, passwordHash, displayName, avatar, createdAt }
]

// Contacts (user's contact list)
contacts: [
  { id, userId, contactUserId, addedAt }
]

// Messages
messages: [
  { id, chatId, senderId, receiverId, content, timestamp }
]

// Chats
chats: [
  { id, participants: [userId1, userId2], lastMessageAt }
]
```

### UI/UX Requirements
- **Login Screen**: Username, password, register link
- **Register Screen**: Username, password, display name
- **Contact List Screen**: List of contacts with search add
- **Chat Screen**: Message thread, input field, send button, emoji support
- **PWA**: Installable, offline-capable basic shell

---

## Screen Flow

```
[Login/Register] → [Contact List] → [Chat Screen]
                      ↑
                      ↓
                 [Add Contact]
```

---

## Feature List (Priority Order)

### P0 - Must Have
1. User registration (username, password, display name)
2. User login
3. Add contact by username
4. View contact list
5. Send text message to contact
6. Receive/display message
7. Chat history per conversation
8. Send image (via URL or base64)

### P1 - Should Have
1. Emoji support (system emoji keyboard sufficient)
2. Unread message indicator
3. Last message preview in contact list
4. Delete message

### P2 - Nice to Have
1. Online status indicator
2. Typing indicator
3. Message delivered/read status
4. PWA offline mode
5. Avatar upload

---

## Non-Functional Requirements
- **Responsive**: Mobile-first design
- **PWA**: Installable on mobile/desktop
- **Performance**: Load under 3 seconds
- **Privacy**: No phone number required, data stored locally

---

## Out of Scope (Phase 1)
- Group chat
- Voice/video call
- File attachments (images only via URL/base64)
- End-to-end encryption
- Real-time sync (future: Supabase/Firebase)
- Push notifications

---

## Success Criteria
1. User can register and login
2. User can add another registered user as contact
3. User can send and receive messages (same browser/localStorage)
4. User can send images (URL or base64)
5. Chat history persists after refresh
6. Emoji can be typed and displayed
7. App is installable as PWA

---

## Next Step
Confirm this spec, then proceed to:
- Create UI mockup / prototype
- Or build actual functional MVP with localStorage
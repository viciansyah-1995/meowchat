# Auth Migration Notes

## Status
Auth layer has been migrated from localStorage to Supabase Auth.

## Current Scope
### Implemented
- Register with email + password
- Pass username + display_name in signup metadata
- Login with email + password
- Logout
- Session restore from Supabase
- Profile fetch from `profiles`

### Temporarily Deferred
- contacts migration to Supabase
- direct chat creation
- message send/receive via Supabase
- realtime subscriptions for inbox/chat

## Why deferred
This keeps the migration safe and incremental:
1. auth first
2. profile retrieval second
3. chat backend migration after auth is proven stable

## Next build target
- search users from `profiles`
- create/get direct chat using `chats` + `chat_participants`
- send message to `messages`
- subscribe realtime to `messages`

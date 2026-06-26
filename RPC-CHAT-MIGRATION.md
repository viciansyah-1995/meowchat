# RPC Chat Migration

## Why migrated
Direct chat orchestration through client-side inserts across `chats` and `chat_participants` kept colliding with RLS complexity and recursion issues.

## New approach
Client now calls a single RPC:
- `public.create_or_get_direct_chat(other_profile_id uuid)`

The RPC handles:
1. current authenticated user lookup
2. direct chat key generation
3. existing chat lookup
4. chat creation if absent
5. participant insertion with conflict-ignore
6. returning `chat_id`

## Benefit
- transactional orchestration at DB layer
- reduced client-side write complexity
- fewer RLS collisions
- easier debugging

# RLS Diagnosis Notes - Direct Chat Creation

## Current suspicion
Primary issue is likely no longer generic chat insert policy alone.

Potential causes now:
1. `insert().select().single()` on `chats` causing readback to fail under RLS timing/visibility
2. `created_by` not being sent as expected
3. another table policy (especially `chat_participants`) failing after chat insert
4. session/auth context mismatch during write

## Current patch
- removed `insert().select().single()` for chat creation
- insert chat row first
- fetch chat again separately
- collect step-by-step debug lines for UI panel
- surface debug lines in `openDirectChat()`

## Expected next outcome
If chat creation still fails, UI debug panel should now reveal the exact failing step:
- auth.getUser
- existing lookup
- chat insert
- chat fetch
- participant insert

# Search / Contact / Direct Chat / Realtime Plan

## Scope fase ini
1. Search username dari table `profiles`
2. Tambah contact ke table `contacts`
3. Create/get direct chat dari `chats` + `chat_participants`
4. Send message ke `messages`
5. Subscribe realtime insert message via Supabase Realtime

## Catatan penting
### Constraint arsitektur
App saat ini baru selesai di migrasi auth.
UI chat lama masih dibangun untuk localStorage mock architecture.

### Strategi aman
Daripada langsung refactor semua screen sekaligus dan berisiko merusak flow auth yang baru stabil, fase ini sebaiknya dilakukan incremental:
- tambahkan search user screen / panel
- tambahkan direct chat creation action
- tambahkan message thread dari Supabase
- baru setelah stabil, rapikan UI menjadi inbox/chat production-like

## Outcome target
Setelah fase ini selesai:
- user A bisa search user B by username
- user A bisa create direct chat dengan user B
- user A kirim text message
- user B receive message lewat shared backend Supabase + realtime subscription

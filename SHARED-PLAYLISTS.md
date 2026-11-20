# Shared playlists and Memory Notes

Playlist is the initial signed-in tab, followed by Chat, Contact and Pengaturan. Each collection belongs to an existing direct room with exactly two participants; a room can have multiple playlists. Both participants add songs using full Spotify track URLs, manually entered titles/artists, and Memory Notes (1–2,000 characters). Notes preserve newlines. Songs use numbered compact rows with artist and a short story preview. Native disclosure controls reveal Memory Notes, attribution and actions; date columns collapse into the expanded story on small screens. Copy uses a personal Indonesian tone (Lagu Kita, Titip lagu, Ubah ceritaku). Artwork is a decorative music tile; no album artwork or duration is inferred. Spotify opens externally; no Spotify API, OAuth, metadata scraping, playback integration or automatic playlist export is used.

Both participants can read the collection. Only the contributor can edit a song's title/artist/notes or delete it. Track IDs are unique within a playlist. Column-level UPDATE grants prevent changing ownership or moving songs into another playlist. RLS checks membership and room size through a caller-bound helper with a fixed search path. Anonymous access is denied. Playlist details refresh every 15 seconds while the tab is visible, and on visibility changes; list refresh is manual. Requests are ignored after unmount; pending writes prevent repeated submissions.

## Release

Before releasing this branch, apply `supabase/migrations/20261120000000_shared_playlists.sql` to the intended Supabase project. Existing chat/message tables and their policies are unchanged. No Spotify credentials or new environment variables are required. This migration has only been applied to disposable local PostgreSQL during development, not production.

## Verification

- `npm run build`
- `node tests/playlist-links.mjs`
- `psql -v ON_ERROR_STOP=1 -d <empty_disposable_local_database> -f tests/playlists.sql`

The SQL test creates fixture auth/profile/chat tables and roles; never run it against production or an existing application database. It exercises two participants, an outsider, anonymous access, duplicate songs, required notes, owner-only edits/deletes and immutable attribution.

Browser verification uses an isolated copy with simulated session/storage services. It verifies the initial tab, room selection, create/add/edit flows, multiline notes, duplicate feedback, reload, external track URL and the 320px layout. It does not substitute for two real Supabase accounts or physical iOS/PWA testing.

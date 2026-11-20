# Room moments and chat UX

The Momen action beside Media opens Jejak Kita: a private timeline of a manually selected place, one photo and an optional 1,500-character caption. Both direct-room participants can contribute. Fullscreen photos use freshly signed storage URLs. Moments do not create chat messages or push notifications.

## Reply and links

Bubble clicks set the reply and call the composer's imperative focus method in the same tap. `flushSync` closes menus before focusing the textarea so the user gesture remains available to iOS keyboard activation. Existing drafts are preserved. Interactive controls and links do not trigger replies; active recording/attachment panels are preserved. Physical iOS keyboard behavior is not verified yet.

`messageLinks` recognizes HTTP(S), www and common bare domains. React escapes the text; no HTML is injected. Email addresses and non-web schemes stay text. Links open with noopener/noreferrer and stop click propagation. Starred messages share the same renderer.

## Places

`POST /api/places` verifies the signed-in user and two-person room membership before calling Photon. Search is button-triggered, never an automatic GPS lookup. The query is sent to Photon, identified in the UI; results carry OpenStreetMap attribution and a map link. No device-location permission is requested.

Photon demo API documentation and fair-use/availability limits: https://github.com/komoot/photon and https://github.com/komoot/photon/blob/master/docs/api-v1.md . The server caches provider responses for one day and a PostgreSQL gate limits the application to one search every 1.1 seconds across server instances. Set `PHOTON_SEARCH_URL` to a compatible managed/self-hosted Photon `/api/` endpoint if traffic grows or the demo service becomes unavailable. No new secret is required for the default provider. Provider outages return a retryable UI error.

## Photos and privacy

The client decodes supported raster photos up to 20 MB, scales the longest side down to at most 1,600 px without upscaling, flattens on white, and re-encodes as JPEG at decreasing quality. Canvas output strips EXIF/GPS metadata. The final upload must be at most 700 KiB. Unsupported HEIC decoders display a JPG/PNG fallback instruction. No original image is uploaded. A private `room-moments` bucket enforces JPEG and the same size limit; PostgreSQL stores only the photo path/size and moment metadata.

RLS restricts records/photos to two room participants. Paths encode room, uploader and moment UUID. Published photos cannot be overwritten or deleted through the client. Only their uploader can remove an unpublished upload while still a member. Unknown network outcomes retain the upload for an idempotent retry; a changed draft gets a new attempt ID. No service-role key is used.

## Release and verification

Apply `supabase/migrations/20261120010000_room_moments.sql` before releasing this feature. It has only been applied to disposable local PostgreSQL, not production. Playlist migration in the same branch is also unreleased.

Checks:

- `npm run build`
- `node tests/message-links.mjs`
- `node tests/places-route.mjs` (isolated server boundary tests with mocked auth/provider)
- `psql -d <empty_disposable_local_database> -f tests/moments.sql` (creates fixtures and includes playlist tests; never run against an existing or production database)

Chrome UI tests use an isolated app copy with simulated accounts, location results and storage. Real composer/link/compression code is exercised. The automated file chooser was blocked by the extension's file-URL permission, so a test-only button loads an already public sticker asset into the same photo handler. It verified JPEG output around 79 KiB; a synthetic 3,200×2,400 raster was resized to 1,600×1,200 and about 84 KiB. Timeline persistence and fullscreen were verified in the simulated storage; the live Photon endpoint independently returned results for Kebun Raya Bogor. Actual Supabase account/storage round trips and physical iOS/PWA are unverified.

# Auto Scroll on Open Chat

## Scope
- when a user opens a chat room, jump directly to the latest message bubble
- initial behavior only; no auto-scroll on incoming messages in this phase

## Implementation
- chat message container uses a ref
- after switching screen into `chat`, the UI waits for the next paint and then sets `scrollTop = scrollHeight`

## Notes
- uses double `requestAnimationFrame` to reduce race with initial DOM paint

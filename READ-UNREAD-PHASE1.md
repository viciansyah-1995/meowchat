# Read / Unread Phase 1

## Implemented
- mark incoming messages as read when opening chat
- refresh inbox unread count after open chat
- refresh inbox unread count after realtime incoming message
- refresh inbox unread count after sending message
- fetch message read map for active chat
- show basic message status on own messages: `Sent` / `Read`

## Notes
- `Read` means at least one read receipt exists from another participant
- current implementation is optimized for direct chat only
- debug mode remains enabled

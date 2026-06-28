# Loading for Chat List and Chat Detail

## Added
- inbox chat list uses skeleton while `loadInbox()` is running
- opening a chat room shows a fuller skeleton shell before real messages render
- composer stays hidden while detail skeleton is active to reduce UI flicker

## Scope
- visual loading only
- no lifecycle or realtime logic changes in this phase

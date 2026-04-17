# User Start App Flow Documentation

## Overview
This document describes the flow when a user starts the app, enters their nickname and identifier number (số báo danh), and begins chatting with an admin.

## Flow Sequence

### Step 1: User Starts App and Enters Information
1. **User opens the app** and provides:
   - **nickname** (tên gọi): User's display name for the chat
   - **identifierNumber** (số báo danh): User's ID/registration number

2. **User calls API to start session** (Optional, for saving session info):
   ```bash
   POST /api/user-session/start
   Content-Type: application/json

   {
     "nickname": "John Doe",
     "identifierNumber": "A12345"
   }
   ```

   **Response**:
   ```json
   {
     "ok": true,
     "data": {
       "userId": "550e8400-e29b-41d4-a716-446655440000",
       "nickname": "John Doe",
       "identifierNumber": "A12345",
       "createdAt": "2024-04-09T10:30:00Z"
     },
     "message": "User session started successfully"
   }
   ```

   > The `userId` returned can be used for the socket connection in the next step, or a new UUID can be generated on the client side.

### Step 2: User Joins Chat
1. **User sends `user:join` socket event** with userId, nickname and identifier number:
   ```javascript
   socket.emit('user:join', {
     userId: "550e8400-e29b-41d4-a716-446655440000",
     nickname: "John Doe",
     identifierNumber: "A12345",
     token: process.env.USER_SOCKET_SECRET
   });
   ```

2. **Server responds with `user:joined` event**:
   ```javascript
   socket.on('user:joined', (response) => {
     if (response.ok) {
       console.log('Connected as:', {
         userId: response.userId,
         nickname: response.nickname,
         identifierNumber: response.identifierNumber
       });
     }
   });
   ```

3. **On error**, server responds with `user:join_denied` event:
   ```javascript
   socket.on('user:join_denied', (response) => {
     console.error(response.reason);
     // Possible reasons:
     // - "USER_SOCKET_SECRET not configured"
     // - "invalid_payload"
     // - "invalid_token"
     // - "userId, nickname and identifierNumber are required"
   });
   ```

## API Endpoints

### Start User Session (Optional)
Creates a persistent user session record in the database.

```
POST /api/user-session/start

Request body:
{
  "nickname": "string (required)",
  "identifierNumber": "string (required)"
}

Response:
{
  "ok": true,
  "data": {
    "userId": "uuid",
    "nickname": "string",
    "identifierNumber": "string",
    "createdAt": "ISO 8601 date"
  },
  "message": "User session started successfully"
}
```

### Get User Session
Retrieve information about a specific user session.

```
GET /api/user-session/:userId

Response:
{
  "ok": true,
  "data": {
    "userId": "uuid",
    "nickname": "string",
    "identifierNumber": "string",
    "isActive": "boolean",
    "createdAt": "ISO 8601 date"
  },
  "message": "User session retrieved"
}

Errors:
- 404: User session not found
```

### Get All Active Sessions (Admin)
Retrieve all currently active user sessions (useful for admin dashboard).

```
GET /api/user-session/

Response:
{
  "ok": true,
  "data": [
    {
      "userId": "uuid",
      "nickname": "string",
      "identifierNumber": "string",
      "isActive": true,
      "createdAt": "ISO 8601 date"
    }
  ],
  "message": "Active user sessions retrieved"
}
```

### End User Session
Mark a user session as inactive (user logged out or disconnected).

```
POST /api/user-session/:userId/end

Response:
{
  "ok": true,
  "data": {
    "userId": "uuid"
  },
  "message": "User session ended"
}

Errors:
- 404: User session not found
```

## Socket Events

### Client → Server Events

#### `user:join`
User joins the chat.

```javascript
socket.emit('user:join', {
  userId: string,
  nickname: string,
  identifierNumber: string,
  token: string // USER_SOCKET_SECRET
});
```

**Validation**:
- `userId`: Required, non-empty string
- `nickname`: Required, non-empty string
- `identifierNumber`: Required, non-empty string
- `token`: Must match USER_SOCKET_SECRET environment variable

### Server → Client Events

#### `user:joined` (Success)
User has successfully joined the chat.

```javascript
{
  ok: true,
  userId: string,
  nickname: string,
  identifierNumber: string
}
```

#### `user:join_denied` (Error)
Failed to join chat.

```javascript
{
  ok: false,
  reason: string // Error reason
}
```

## Complete Client Flow Example

```javascript
import io from 'socket.io-client';

const USER_SOCKET_SECRET = process.env.REACT_APP_USER_SOCKET_SECRET;

// Step 1: Connect to socket
const socket = io('http://localhost:3000', {
  reconnection: true
});

socket.on('connect', () => {
  console.log('Connected to server');
});

// Step 2: User joins the chat
function joinChat(userId, nickname, identifierNumber) {
  socket.emit('user:join', {
    userId,
    nickname,
    identifierNumber,
    token: USER_SOCKET_SECRET
  });
}

// Step 3: Handle user:joined response
socket.on('user:joined', (response) => {
  if (response.ok) {
    console.log(`Welcome ${response.nickname} (${response.identifierNumber})`);
    // User is now ready to send/receive messages
  }
});

socket.on('user:join_denied', (response) => {
  console.error('Join failed:', response.reason);
});
```

## Data Model

### UserSession Entity
```typescript
interface UserSession {
  id: string;                    // Unique session record ID
  userId: string;                // User ID (used for socket room)
  nickname: string;              // User's display name
  identifierNumber: string;      // User's ID number (số báo danh)
  createdAt: Date;              // When session was created
  updatedAt: Date;              // Last update time
  isActive: boolean;            // Whether session is still active
}
```

### SocketSessionData (In-Memory)
```typescript
type SocketSessionData = {
  role?: "admin" | "user";
  userId?: string;
  nickname?: string;
  identifierNumber?: string;
};
```

## Environment Variables Required

```env
USER_SOCKET_SECRET=your_secret_token_here
```

## Features

✅ **Nickname Support**: Users provide a display name for the chat
✅ **Identifier Number**: Users provide their ID/registration number
✅ **Session Management**: Sessions are persisted in SurrealDB
✅ **Socket Integration**: Full socket.io event flow
✅ **Admin Dashboard**: Admins can view all active user sessions via API
✅ **Error Handling**: Comprehensive error messages for each failure case
✅ **Scalable**: Works with Redis for multi-server deployments

## Next Steps Integration

From here, users can:
1. **Send Message**: Use existing message API to send messages to admin
2. **Receive Messages**: Listen for messages from admin via socket.io
3. **See Active Users**: Admin can view all active user sessions
4. **End Session**: User can disconnect or end session via API endpoint

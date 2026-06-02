# WebRTC Platform - API Specification

## Base URL
- Development: `http://localhost:8080`
- Production: `https://api.webrtc-platform.com`

## Authentication
All authenticated endpoints require:
```
Authorization: Bearer {JWT_TOKEN}
```

JWT Token Structure:
```json
{
  "sub": "user_id",
  "email": "user@example.com",
  "device_id": "device_id",
  "iat": 1234567890,
  "exp": 1234571490
}
```

## Error Response Format
```json
{
  "error": "error_code",
  "message": "Human readable message",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

---

## Authentication Endpoints

### POST /auth/register
Register a new user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "secure_password",
  "display_name": "John Doe"
}
```

**Response (201):**
```json
{
  "user_id": "uuid",
  "email": "user@example.com",
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

**Errors:**
- 400: Invalid email format, password too weak
- 409: Email already registered

---

### POST /auth/login
Authenticate user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "secure_password"
}
```

**Response (200):**
```json
{
  "user_id": "uuid",
  "email": "user@example.com",
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

**Errors:**
- 400: Invalid credentials
- 401: Email or password incorrect

---

### POST /auth/refresh
Refresh access token using refresh token.

**Request:**
```json
{
  "refresh_token": "eyJhbGc..."
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGc...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

**Errors:**
- 401: Invalid or expired refresh token

---

### POST /auth/logout
Invalidate refresh token.

**Request:**
```json
{
  "refresh_token": "eyJhbGc..."
}
```

**Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

---

## User Endpoints

### GET /users/me
Get current user profile.

**Response (200):**
```json
{
  "user_id": "uuid",
  "email": "user@example.com",
  "display_name": "John Doe",
  "created_at": "2024-01-01T12:00:00Z",
  "devices": [
    {
      "device_id": "uuid",
      "device_name": "MacBook Pro",
      "device_type": "Laptop",
      "platform": "macOS",
      "is_online": true,
      "last_seen": "2024-01-01T12:30:00Z"
    }
  ]
}
```

**Errors:**
- 401: Unauthorized

---

### PUT /users/me
Update user profile.

**Request:**
```json
{
  "display_name": "John Smith"
}
```

**Response (200):**
```json
{
  "user_id": "uuid",
  "email": "user@example.com",
  "display_name": "John Smith",
  "updated_at": "2024-01-01T12:30:00Z"
}
```

**Errors:**
- 400: Invalid input
- 401: Unauthorized

---

### GET /users/search
Search for users by display name.

**Query Parameters:**
- `query` (string, required): Search term (minimum 2 characters)
- `limit` (number, default: 20): Maximum results

**Response (200):**
```json
{
  "users": [
    {
      "user_id": "uuid",
      "display_name": "John Doe",
      "devices": [
        {
          "device_id": "uuid",
          "device_name": "MacBook Pro",
          "device_type": "Laptop",
          "is_online": true
        }
      ]
    }
  ]
}
```

**Errors:**
- 400: Query too short
- 401: Unauthorized

---

## Device Endpoints

### POST /devices/register
Register a new device for current user.

**Request:**
```json
{
  "device_name": "My Desktop",
  "device_type": "Desktop",
  "platform": "Linux"
}
```

**Response (201):**
```json
{
  "device_id": "uuid",
  "user_id": "uuid",
  "device_name": "My Desktop",
  "device_type": "Desktop",
  "platform": "Linux",
  "is_online": true,
  "created_at": "2024-01-01T12:00:00Z"
}
```

**Errors:**
- 400: Invalid device type or platform
- 401: Unauthorized

---

### GET /devices
List all devices for current user.

**Response (200):**
```json
{
  "devices": [
    {
      "device_id": "uuid",
      "device_name": "MacBook Pro",
      "device_type": "Laptop",
      "platform": "macOS",
      "is_online": true,
      "last_seen": "2024-01-01T12:30:00Z"
    }
  ]
}
```

**Errors:**
- 401: Unauthorized

---

### GET /devices/:device_id
Get specific device details.

**Response (200):**
```json
{
  "device_id": "uuid",
  "user_id": "uuid",
  "device_name": "MacBook Pro",
  "device_type": "Laptop",
  "platform": "macOS",
  "is_online": true,
  "last_seen": "2024-01-01T12:30:00Z"
}
```

**Errors:**
- 401: Unauthorized
- 404: Device not found

---

### PUT /devices/:device_id
Update device information.

**Request:**
```json
{
  "device_name": "Updated Device Name"
}
```

**Response (200):**
```json
{
  "device_id": "uuid",
  "device_name": "Updated Device Name",
  "updated_at": "2024-01-01T12:30:00Z"
}
```

**Errors:**
- 401: Unauthorized
- 404: Device not found

---

### DELETE /devices/:device_id
Unregister device.

**Response (204):** No content

**Errors:**
- 401: Unauthorized
- 404: Device not found

---

## Session Endpoints

### POST /sessions
Initiate a new WebRTC session.

**Request:**
```json
{
  "target_user_id": "uuid",
  "target_device_id": "uuid"
}
```

**Response (201):**
```json
{
  "session_id": "uuid",
  "initiator_id": "uuid",
  "responder_id": "uuid",
  "initiator_device_id": "uuid",
  "responder_device_id": "uuid",
  "status": "Pending",
  "created_at": "2024-01-01T12:00:00Z"
}
```

**Errors:**
- 400: Invalid target user/device
- 401: Unauthorized
- 404: Target device not found or offline

---

### GET /sessions/:session_id
Get session details.

**Response (200):**
```json
{
  "session_id": "uuid",
  "initiator_id": "uuid",
  "responder_id": "uuid",
  "status": "Active",
  "started_at": "2024-01-01T12:00:00Z",
  "ended_at": null
}
```

**Errors:**
- 401: Unauthorized
- 404: Session not found

---

### DELETE /sessions/:session_id
End a session.

**Response (204):** No content

**Errors:**
- 401: Unauthorized
- 404: Session not found

---

## WebSocket Events (Signaling)

### Connection Flow

#### Client → Server

**event:connect**
```json
{
  "type": "connect",
  "user_id": "uuid",
  "device_id": "uuid",
  "device_name": "My Device",
  "token": "JWT_TOKEN"
}
```

**event:heartbeat**
```json
{
  "type": "heartbeat"
}
```

#### Server → Client

**event:connected**
```json
{
  "type": "connected",
  "message": "Connected to signaling server"
}
```

**event:user:online**
```json
{
  "type": "user:online",
  "user_id": "uuid",
  "display_name": "John Doe",
  "device_id": "uuid",
  "device_name": "MacBook Pro",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

**event:user:offline**
```json
{
  "type": "user:offline",
  "user_id": "uuid",
  "device_id": "uuid",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

---

### Call Initiation

#### Client → Server

**event:call:request**
```json
{
  "type": "call:request",
  "session_id": "uuid",
  "target_user_id": "uuid",
  "target_device_id": "uuid"
}
```

#### Server → Client

**event:call:incoming**
```json
{
  "type": "call:incoming",
  "session_id": "uuid",
  "initiator_id": "uuid",
  "initiator_name": "John Doe",
  "initiator_device_name": "MacBook Pro"
}
```

#### Client → Server

**event:call:accept**
```json
{
  "type": "call:accept",
  "session_id": "uuid"
}
```

**event:call:reject**
```json
{
  "type": "call:reject",
  "session_id": "uuid",
  "reason": "busy"  // busy, decline, timeout
}
```

---

### WebRTC Signaling

#### Client → Server

**event:signal:offer**
```json
{
  "type": "signal:offer",
  "session_id": "uuid",
  "sdp": "v=0\r\no=..."
}
```

**event:signal:answer**
```json
{
  "type": "signal:answer",
  "session_id": "uuid",
  "sdp": "v=0\r\no=..."
}
```

**event:signal:ice-candidate**
```json
{
  "type": "signal:ice-candidate",
  "session_id": "uuid",
  "candidate": {
    "candidate": "candidate:...",
    "sdpMLineIndex": 0,
    "sdpMid": "video"
  }
}
```

#### Server → Client
Same format as above, sent to the other peer.

---

### Stream Events

#### Client → Server

**event:stream:start-screen**
```json
{
  "type": "stream:start-screen",
  "session_id": "uuid"
}
```

**event:stream:stop-screen**
```json
{
  "type": "stream:stop-screen",
  "session_id": "uuid"
}
```

#### Server → Client
Same format, forwarded to peer.

---

### File Transfer Events

#### Client → Server

**event:file:offer**
```json
{
  "type": "file:offer",
  "session_id": "uuid",
  "file_id": "uuid",
  "filename": "document.pdf",
  "size": 1048576,
  "checksum": "sha256_hash"
}
```

**event:file:accept**
```json
{
  "type": "file:accept",
  "session_id": "uuid",
  "file_id": "uuid"
}
```

**event:file:reject**
```json
{
  "type": "file:reject",
  "session_id": "uuid",
  "file_id": "uuid"
}
```

**event:file:cancel**
```json
{
  "type": "file:cancel",
  "session_id": "uuid",
  "file_id": "uuid"
}
```

#### Server → Client
Same format, forwarded to peer.

---

## Error Codes

### Authentication
- `AUTH_INVALID_CREDENTIALS`: Email or password incorrect
- `AUTH_EMAIL_EXISTS`: Email already registered
- `AUTH_INVALID_EMAIL`: Invalid email format
- `AUTH_WEAK_PASSWORD`: Password doesn't meet requirements
- `AUTH_EXPIRED_TOKEN`: JWT token has expired
- `AUTH_INVALID_TOKEN`: JWT token is invalid

### Users
- `USER_NOT_FOUND`: User doesn't exist
- `USER_UNAUTHORIZED`: Not authorized to access resource

### Devices
- `DEVICE_NOT_FOUND`: Device doesn't exist
- `DEVICE_OFFLINE`: Device is offline

### Sessions
- `SESSION_NOT_FOUND`: Session doesn't exist
- `SESSION_EXPIRED`: Session has expired

### WebRTC
- `WEBRTC_CONNECTION_FAILED`: Failed to establish connection
- `WEBRTC_ICE_FAILED`: ICE gathering/connection failed

### Server
- `SERVER_ERROR`: Internal server error
- `INVALID_REQUEST`: Malformed request
- `RATE_LIMITED`: Too many requests

---

## Rate Limiting

### Auth Endpoints
- `/auth/login`: 5 requests per minute per IP
- `/auth/register`: 3 requests per minute per IP

### General API
- Authenticated endpoints: 100 requests per minute per user
- Search endpoints: 20 requests per minute per user

**Response Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1234567890
```

**Rate Limit Exceeded (429):**
```json
{
  "error": "RATE_LIMITED",
  "message": "Too many requests. Try again after 60 seconds.",
  "retry_after": 60
}
```

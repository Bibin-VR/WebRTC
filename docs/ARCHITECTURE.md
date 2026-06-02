# WebRTC Platform - Technical Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                   Electron Desktop Client                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │    Auth UI   │  │  Dashboard   │  │  Call View   │           │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘           │
│         │                 │                 │                    │
│  ┌──────▼──────────────────▼─────────────────▼──────┐            │
│  │         React Components & State Management      │            │
│  └──────┬────────────────────────────────────────────┘            │
│         │                                                         │
│  ┌──────▼────────────────────────────────────────────┐            │
│  │  WebRTC Service │ WebSocket Client │ API Service │            │
│  └──────┬────────────────────────────────────────────┘            │
│         │         HTTPS/WSS                                       │
├────────┼───────────────────────────────────────────────────────┤
│         │                                                         │
│  ┌──────▼────────────────────────────────────────────┐            │
│  │      Rust Backend (Actix-web)                    │            │
│  │  ┌─────────────┐  ┌─────────────┐               │            │
│  │  │   REST API  │  │  WebSocket  │               │            │
│  │  │  - Auth     │  │  - Signaling│               │            │
│  │  │  - Users    │  │  - Presence │               │            │
│  │  │  - Devices  │  │  - ICE exch.│               │            │
│  │  └─────────────┘  └─────────────┘               │            │
│  └──────┬────────────────────────────────────────────┘            │
│         │                                                         │
│  ┌──────▼────────────────────────────────────────────┐            │
│  │        PostgreSQL Database                       │            │
│  │  ┌────────┐ ┌────────┐ ┌──────────┐            │            │
│  │  │ Users  │ │Devices │ │Sessions  │            │            │
│  │  └────────┘ └────────┘ └──────────┘            │            │
│  └────────────────────────────────────────────────┘            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

P2P Data Channel (WebRTC):
┌──────────────────────────────────────────────────────────────┐
│ Video/Audio/Screen Stream + File Transfer Data Channel       │
│ (Direct peer-to-peer, encrypted with DTLS-SRTP)             │
└──────────────────────────────────────────────────────────────┘
```

## Authentication Flow

```
1. Registration
   Client: POST /auth/register {email, password}
   ↓
   Server: Hash password, store user, return JWT token
   ↓
   Client: Store token in secure storage

2. Login
   Client: POST /auth/login {email, password}
   ↓
   Server: Verify password, issue JWT (1h) + refresh token (7d)
   ↓
   Client: Store both tokens, use JWT for API requests

3. Token Refresh
   Client: POST /auth/refresh {refresh_token}
   ↓
   Server: Validate refresh token, issue new JWT
   ↓
   Client: Update JWT in storage
```

## User Discovery & Device Registration

```
1. Device Registration
   Client: POST /devices/register {device_name, device_type, platform}
   ↓
   Server: Create device record, return device_id
   ↓
   Client: Store device_id locally

2. User Discovery
   Client: GET /users/search?query=name (with JWT)
   ↓
   Server: Return list of matching users
   ↓
   Client: Display users with their online devices

3. Presence Tracking
   Client: WebSocket connection → Server maintains online status
   ↓
   Server: Broadcast user_online/user_offline to other connected clients
   ↓
   Clients: Update UI with availability
```

## WebRTC Signaling Flow

```
Initiator (A)                    Signaling Server             Responder (B)
    │                                   │                           │
    │─ WS: hello {user_id, device_id}  │                           │
    │◄─────────────────────────────────│                           │
    │                                   │                           │
    │          User clicks on B         │                           │
    │─ WS: request_call {target_device}│                           │
    │                                   │─ WS: incoming_call       │
    │                                   │      {initiator_info}──→ │
    │                                   │                    User accepts
    │                                   │ ← WS: call_accepted ─────│
    │◄──────────────────────────────────│                           │
    │                                   │                           │
    │ Create PeerConnection             │                           │
    │ getDisplayMedia() + getUserMedia()│                           │
    │ addTrack()                        │                           │
    │                                   │                           │
    │ createOffer()                     │                           │
    │─ WS: signal:offer {sdp}          │                           │
    │                                   │─ WS: signal:offer ──────→│
    │                                   │           Create PC, add streams
    │                                   │           createAnswer()
    │                                   │ ← WS: signal:answer ─────│
    │◄──────────────────────────────────│                           │
    │ setRemoteDescription(answer)      │                           │
    │                                   │                           │
    │ ICE Candidate Gathering           │                           │
    │─ WS: signal:ice-candidate ──────→ ICE Candidate Gathering    │
    │◄──────────────────────────────────│ WS: signal:ice-candidate │
    │                                   │ (multiple exchanges)      │
    │                                   │                           │
    │         P2P Connection Established                            │
    │◄════════════════════════════════════════════════════════════►│
    │  (WebRTC: Video/Audio/Screen/DataChannel)                    │
```

## Screen Sharing Implementation

```
Initiator:
1. User clicks "Share Screen"
2. navigator.mediaDevices.getDisplayMedia()
   - User selects window/monitor via native dialog
3. Get video track from captured stream
4. Create new RTCRtpSender via addTrack()
5. Send signal:screen-share-start message

Responder:
1. Receives signal:screen-share-start
2. ontrack event fires with incoming screen stream
3. Set <video> element srcObject to stream
4. Display in UI

Stopping:
1. Initiator: track.stop(), signal:screen-share-stop
2. Responder: Remove video element or display local video again
```

## File Transfer Implementation

```
Initiator:
1. User selects file via file picker
2. Calculate checksum (SHA-256)
3. Create data channel: dc = pc.createDataChannel("file-transfer")
4. Send signal:file-request {filename, size, checksum}
5. Wait for signal:file-ready
6. Read file in 64KB chunks
7. For each chunk: dc.send(chunk with metadata)
8. Send signal:file-complete with checksum

Responder:
1. Receives signal:file-request
2. Show "Accept file?" dialog
3. Send signal:file-ready
4. ondatachannel event fires
5. onmessage processes chunks
6. Reassemble file
7. Verify checksum
8. Save to Downloads folder
9. Show notification

Data Channel Message Format:
{
  type: "chunk|complete|error",
  chunk_id: number,
  offset: number,
  data: ArrayBuffer,      // for chunk messages
  checksum: string,       // for complete message
  error: string           // for error messages
}
```

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Devices Table
```sql
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_name VARCHAR(255) NOT NULL,
  device_type VARCHAR(50) NOT NULL,  -- Desktop, Laptop, RaspberryPi
  platform VARCHAR(50) NOT NULL,     -- Linux, Windows, macOS
  last_seen TIMESTAMP DEFAULT NOW(),
  is_online BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Sessions Table
```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initiator_id UUID NOT NULL REFERENCES users(id),
  responder_id UUID NOT NULL REFERENCES users(id),
  initiator_device_id UUID NOT NULL REFERENCES devices(id),
  responder_device_id UUID NOT NULL REFERENCES devices(id),
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP,
  status VARCHAR(50) NOT NULL,  -- Pending, Active, Completed, Failed
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Auth Tokens Table (optional, for token blacklisting)
```sql
CREATE TABLE auth_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_type VARCHAR(20) NOT NULL,  -- access, refresh
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Error Handling Strategy

### Backend
- Return consistent JSON error responses
- HTTP status codes: 400 (bad request), 401 (unauthorized), 403 (forbidden), 500 (server error)
- Log errors with context for debugging

### Frontend
- Catch all API/WebSocket errors
- Show user-friendly error messages
- Retry logic with exponential backoff for transient failures
- Graceful degradation (e.g., P2P fallback to signaling relay)

### WebRTC
- Handle connection failures with fallback signaling relay
- Implement ice-restart for connection recovery
- Monitor connection state and display status

## Security Measures

1. **Authentication**
   - Argon2 password hashing
   - JWT tokens (HS256 or RS256)
   - Refresh token rotation

2. **Transport**
   - HTTPS/WSS only
   - HSTS headers
   - CORS restricted to frontend domain

3. **Data**
   - Input validation & sanitization
   - SQL prepared statements (Rust sqlx library)
   - File transfer checksum verification

4. **WebRTC**
   - DTLS-SRTP encryption by default
   - No plain RTP
   - Muting untrusted peers

5. **Infrastructure**
   - Rate limiting on auth endpoints
   - DDoS protection via WAF/CDN
   - Regular security audits
   - Database encryption at rest

## Performance Considerations

1. **Backend**
   - Async/await with Tokio for high concurrency
   - Connection pooling (pgbouncer)
   - WebSocket rooms to reduce broadcast overhead

2. **Frontend**
   - Code splitting for faster initial load
   - Lazy loading of call components
   - Efficient state management (Redux/Zustand)

3. **WebRTC**
   - H.264 codec for screen (lower bandwidth)
   - VP8/VP9 for audio/video fallback
   - Adaptive bitrate based on network conditions
   - ICE candidate prioritization

## Deployment Architecture

```
┌────────────────────────────────────────┐
│        Docker Compose (Local Dev)      │
│  ┌──────────────┐  ┌──────────────┐   │
│  │   Rust App   │  │  PostgreSQL  │   │
│  │   :8080      │  │   :5432      │   │
│  └──────────────┘  └──────────────┘   │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│    Production (Cloud Deployment)       │
│  ┌──────────────────────────────────┐  │
│  │     Kubernetes / Docker Swarm    │  │
│  │  ┌──────────────────────────────┐│  │
│  │  │ Rust Service (Multiple Pods) ││  │
│  │  └──────────────────────────────┘│  │
│  │  ┌──────────────────────────────┐│  │
│  │  │  PostgreSQL (HA Setup)       ││  │
│  │  └──────────────────────────────┘│  │
│  │  ┌──────────────────────────────┐│  │
│  │  │  Redis (Session Cache)       ││  │
│  │  └──────────────────────────────┘│  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │  Load Balancer (Nginx/HAProxy)   │  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
```

## Monitoring & Logging

1. **Backend Logs**
   - Request/response logging
   - Error tracking (Sentry integration)
   - Performance metrics (request duration)

2. **Frontend Analytics**
   - User session tracking
   - Feature usage metrics
   - Error reporting

3. **WebRTC Metrics**
   - Connection establishment time
   - Packet loss, jitter, latency
   - ICE candidate types used

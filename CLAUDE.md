# WebRTC Platform - Architecture & Development Guide

## Project Overview
A cross-platform WebRTC application (Raspberry Pi Connect-like) enabling peer-to-peer connectivity with screen sharing, file transfer, and user management. Built with Rust backend and Electron frontend.

## Tech Stack
- **Backend**: Rust (Actix-web/Tokio for async)
- **Frontend**: Electron + React/Vue for desktop
- **Signaling**: WebSocket over HTTPS
- **Peer Communication**: WebRTC (P2P)
- **Database**: PostgreSQL (user/session data)
- **Authentication**: JWT tokens

## Directory Structure
```
webrtc-platform/
├── backend/                    # Rust backend
│   ├── Cargo.toml
│   ├── src/
│   │   ├── main.rs            # Entry point
│   │   ├── config.rs          # Configuration
│   │   ├── db/                # Database layer
│   │   │   ├── mod.rs
│   │   │   ├── models.rs      # User, Session, Device
│   │   │   └── queries.rs
│   │   ├── api/               # API handlers
│   │   │   ├── mod.rs
│   │   │   ├── auth.rs        # Login, register, JWT
│   │   │   ├── users.rs       # User discovery, profile
│   │   │   ├── sessions.rs    # WebRTC session management
│   │   │   └── devices.rs     # Device registration
│   │   ├── ws/                # WebSocket handlers
│   │   │   ├── mod.rs
│   │   │   ├── signaling.rs   # WebRTC signaling (offer/answer/ICE)
│   │   │   └── handlers.rs    # Connection lifecycle
│   │   ├── services/          # Business logic
│   │   │   ├── mod.rs
│   │   │   ├── auth_service.rs
│   │   │   ├── user_service.rs
│   │   │   └── session_service.rs
│   │   └── error.rs           # Error types
│   └── migrations/            # Database migrations
│
├── frontend/                  # Electron + React
│   ├── package.json
│   ├── public/
│   ├── src/
│   │   ├── main.js            # Electron main process
│   │   ├── preload.js         # IPC bridge
│   │   ├── index.jsx          # React entry
│   │   ├── components/
│   │   │   ├── Auth/          # Login/Register
│   │   │   ├── Dashboard/     # User list, devices
│   │   │   ├── Call/          # Video/audio UI
│   │   │   ├── ScreenShare/   # Screen capture & display
│   │   │   └── FileTransfer/  # File send/receive
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   └── Call.jsx
│   │   ├── services/
│   │   │   ├── api.js         # HTTP calls to backend
│   │   │   ├── websocket.js   # WebSocket client
│   │   │   ├── webrtc.js      # WebRTC peer connections
│   │   │   └── devices.js     # Screen/media enumeration
│   │   └── hooks/
│   │       ├── useWebRTC.js
│   │       ├── useAuth.js
│   │       └── useScreenShare.js
│   └── electron/
│       └── preload.js
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── DEPLOYMENT.md
│   └── DEVELOPMENT.md
│
└── docker-compose.yml         # Local dev environment
```

## Core Features - Detailed Flow

### 1. User Authentication & Discovery
- **Registration**: Email + password → JWT token stored in DB
- **Login**: Credentials → Session created → JWT + refresh token
- **Discovery**: Authenticated users can list online devices
- **Presence**: WebSocket heartbeat tracks online status

### 2. WebRTC Session Initialization
1. User selects remote device to connect
2. Electron app initiates WebSocket connection to signaling server
3. SDP offer/answer exchange via WebSocket
4. ICE candidates gathered and exchanged
5. P2P connection established

### 3. Screen Sharing
- Desktop capture via Electron (desktopCapturer API)
- Stream as WebRTC video track
- Low latency, H.264 codec preference
- Option to share specific window or entire display

### 4. File Transfer
- Over established P2P connection using data channels
- Progress tracking and pause/resume support
- Fallback to signaling server if P2P fails (relayed)

### 5. Cross-Platform Support
- Electron handles native APIs (desktop capture, system tray, notifications)
- Rust backend platform-agnostic (Linux, Docker deployment)

## API Endpoints (REST + WebSocket)

### REST API
```
POST   /auth/register        → { email, password }
POST   /auth/login           → { email, password }
POST   /auth/refresh         → { refresh_token }
GET    /users/search         → query=name (authenticated)
GET    /users/me             → Current user profile
PUT    /users/me             → Update profile
GET    /devices              → List user's devices
POST   /devices/register     → Register device
DELETE /devices/:device_id   → Unregister
```

### WebSocket Events (Signaling)
```
Client → Server:
- signal:offer          → { offer: RTCSessionDescription }
- signal:answer         → { answer: RTCSessionDescription }
- signal:ice-candidate  → { candidate: RTCIceCandidate }
- heartbeat             → Keep-alive
- stream:start-screen   → Notify screen share started
- stream:stop-screen    → Notify screen share stopped
- file:send-request     → { filename, size, checksum }
- file:chunk            → { chunk_id, data, offset }

Server → Client:
- signal:offer
- signal:answer
- signal:ice-candidate
- user:online           → { user_id, device_id }
- user:offline          → { user_id, device_id }
- stream:start-screen
- stream:stop-screen
- file:incoming         → { filename, size, checksum }
- file:chunk
- file:complete
```

## Data Models

### User
```
id: UUID
email: String (unique)
password_hash: String
display_name: String
created_at: DateTime
updated_at: DateTime
```

### Device
```
id: UUID
user_id: FK
device_name: String
device_type: Enum (Desktop, Laptop, RaspberryPi)
platform: Enum (Linux, Windows, macOS)
last_seen: DateTime
is_online: Boolean
```

### Session
```
id: UUID
initiator_id: FK (User)
responder_id: FK (User)
initiator_device_id: FK (Device)
responder_device_id: FK (Device)
started_at: DateTime
ended_at: Optional[DateTime]
status: Enum (Pending, Active, Completed, Failed)
```

## Security Considerations
- JWT tokens with 1h expiry + refresh tokens
- HTTPS/WSS only
- CORS restricted to frontend domain
- Input validation & sanitization
- Database connection pooling
- Rate limiting on auth endpoints
- WebRTC uses DTLS-SRTP encryption
- File transfer integrity via checksums

## Development Phases

### Phase 1: Backend Core (1-2 weeks)
- [ ] Rust project setup + dependencies
- [ ] PostgreSQL schema & migrations
- [ ] User auth (register, login, JWT)
- [ ] WebSocket signaling server
- [ ] User discovery API
- [ ] Device management

### Phase 2: Frontend Core (1-2 weeks)
- [ ] Electron setup + React
- [ ] Auth UI (login, register)
- [ ] Dashboard (user/device list)
- [ ] WebSocket client
- [ ] WebRTC peer connection setup

### Phase 3: Screen Sharing (1 week)
- [ ] Desktop capture integration
- [ ] Screen stream over WebRTC
- [ ] Remote display UI

### Phase 4: File Transfer (1 week)
- [ ] Data channel implementation
- [ ] File chunking & transfer logic
- [ ] Progress UI & error handling

### Phase 5: Polish & Testing (1 week)
- [ ] Cross-platform testing
- [ ] Error handling & logging
- [ ] Performance optimization
- [ ] Deployment pipeline

## Environment Setup
```bash
# Backend dependencies
cargo, rustup, PostgreSQL

# Frontend dependencies
Node.js 18+, npm/yarn

# Local dev with Docker
docker-compose up
```

## Next Steps
1. Create backend Cargo project structure
2. Set up PostgreSQL schema
3. Implement basic auth endpoints
4. Create WebSocket signaling handler
5. Initialize Electron frontend

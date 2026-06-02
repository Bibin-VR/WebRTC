# WebRTC Platform

A cross-platform WebRTC application enabling peer-to-peer connectivity with screen sharing and file transfer capabilities. Similar to Raspberry Pi Connect, but for any device running Linux, macOS, or Windows.

## Features

✨ **Core Features**
- 🔐 User authentication & management
- 👥 User discovery & online presence
- 📹 Peer-to-peer video/audio connectivity
- 🖥️ Real-time screen sharing
- 📁 Secure file transfer over P2P
- 🔗 Cross-platform support (Mac, Windows, Linux)

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend API | Rust + Actix-web + Tokio |
| Backend Database | PostgreSQL |
| Frontend | Electron + React |
| Real-time Communication | WebRTC (P2P) + WebSocket (Signaling) |
| Authentication | JWT Tokens |

## Architecture Overview

```
Desktop Application (Electron)
        ↓
        ├→ HTTP/WebSocket (Signaling)
        ↓
    Rust Backend
        ↓
        ├→ PostgreSQL (Users, Devices, Sessions)
        └→ Redis (Caching, Sessions)
        
        ↓ (via Signaling)
        
P2P Connection (WebRTC)
  ├→ Video/Audio Stream
  ├→ Screen Share
  └→ File Transfer (Data Channel)
```

## Project Structure

```
webrtc-platform/
├── backend/              # Rust backend service
├── frontend/             # Electron + React desktop app
├── docs/                 # Documentation
│   ├── ARCHITECTURE.md   # Detailed system architecture
│   ├── API.md           # REST & WebSocket API specification
│   ├── DEVELOPMENT.md   # Development setup guide
│   └── DEPLOYMENT.md    # Production deployment guide
├── docker-compose.yml    # Local development stack
├── CLAUDE.md            # Development context
└── README.md            # This file
```

## Quick Start

### Prerequisites
- **Backend**: Rust 1.70+, PostgreSQL 13+
- **Frontend**: Node.js 18+, npm/yarn
- **Both**: Docker & Docker Compose

### Local Development

1. **Start infrastructure**
   ```bash
   docker-compose up -d
   ```

2. **Backend setup**
   ```bash
   cd backend
   cat > .env << EOF
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/webrtc
   JWT_SECRET=your_super_secret_key_min_32_chars
   SERVER_HOST=0.0.0.0
   SERVER_PORT=8080
   LOG_LEVEL=debug
   EOF
   cargo run
   ```

3. **Frontend setup**
   ```bash
   cd frontend
   npm install
   cat > .env << EOF
   VITE_API_URL=http://localhost:8080
   VITE_WS_URL=ws://localhost:8080
   EOF
   npm run dev
   ```

4. **Access application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8080

See [DEVELOPMENT.md](docs/DEVELOPMENT.md) for detailed setup instructions.

## Documentation

- **[CLAUDE.md](CLAUDE.md)** - Project overview & development context
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** - Detailed technical architecture
- **[docs/API.md](docs/API.md)** - Complete API specification
- **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)** - Development setup & workflow
- **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** - Production deployment guide

## Development Workflow

### Code Style
```bash
# Backend formatting & linting
cd backend
cargo fmt
cargo clippy

# Frontend formatting & linting
cd frontend
npm run format
npm run lint
```

### Running Tests
```bash
# Backend tests
cd backend
cargo test

# Frontend tests
cd frontend
npm test
```

### Database Migrations
```bash
cd backend
# Create migration
cargo sqlx migrate add -r migration_name

# Run migrations
cargo sqlx migrate run

# Revert last migration
cargo sqlx migrate revert
```

## API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user
- `POST /auth/refresh` - Refresh JWT token
- `POST /auth/logout` - Logout user

### Users
- `GET /users/me` - Get current user profile
- `PUT /users/me` - Update user profile
- `GET /users/search` - Search for users

### Devices
- `GET /devices` - List user's devices
- `POST /devices/register` - Register device
- `PUT /devices/:device_id` - Update device
- `DELETE /devices/:device_id` - Unregister device

### WebSocket Events
- `signal:offer` / `signal:answer` / `signal:ice-candidate` - WebRTC signaling
- `user:online` / `user:offline` - Presence updates
- `call:request` / `call:accept` / `call:reject` - Call control
- `stream:start-screen` / `stream:stop-screen` - Screen sharing
- `file:offer` / `file:accept` - File transfer

See [docs/API.md](docs/API.md) for complete API specification.

## Security Features

- 🔒 JWT-based authentication with refresh tokens
- 🔐 DTLS-SRTP encryption for P2P connections
- ✅ Password hashing with Argon2
- 🛡️ HTTPS/WSS only in production
- 🚫 CORS protection
- ⚡ Rate limiting on sensitive endpoints
- 🔍 Input validation & sanitization
- 📋 SQL injection prevention via parameterized queries

## Performance

### Optimizations
- Async/await with Tokio for high concurrency
- Connection pooling for database
- Lazy loading in frontend
- Code splitting for faster initial load
- Adaptive bitrate for WebRTC streams
- H.264 codec for screen sharing (lower bandwidth)

### Scalability
- Horizontal scaling via container orchestration
- Database read replicas support
- Redis caching layer
- Session affinity for WebSocket connections
- Load balancing ready

## Browser & Platform Support

### Desktop Platforms
- ✅ macOS (10.14+) - via Electron
- ✅ Windows (10+) - via Electron
- ✅ Linux (Ubuntu 18.04+) - via Electron

### Supported WebRTC Codecs
- **Video**: H.264, VP8, VP9
- **Audio**: Opus, G722, PCMU, PCMA

## Deployment

### Docker Compose (Simple)
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Kubernetes (Enterprise)
See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for K8s deployment guide.

### Cloud Providers
- AWS ECS/EKS
- Google Cloud Run/GKE
- DigitalOcean App Platform / Kubernetes
- Azure Container Instances / AKS

## Monitoring & Logging

### Built-in Monitoring
- Health check endpoints: `/health`, `/ready`
- Request logging with structured JSON format
- WebRTC statistics tracking
- Performance metrics

### Integration Ready
- Sentry for error tracking
- Prometheus for metrics
- ELK stack for centralized logging
- Datadog, New Relic, CloudWatch compatible

## Contributing

1. Create feature branch: `git checkout -b feature/feature-name`
2. Make changes and commit with clear messages
3. Run tests and linting:
   ```bash
   cargo fmt && cargo clippy  # Backend
   npm run lint:fix           # Frontend
   ```
4. Push to branch and create pull request

## License

[Add license information]

## Roadmap

### Phase 1: MVP (Current)
- [x] Architecture planning
- [ ] Backend core (auth, WebSocket signaling)
- [ ] Frontend core (login, user discovery)
- [ ] Basic P2P connection

### Phase 2: Screen Sharing
- [ ] Desktop capture integration
- [ ] Stream over WebRTC

### Phase 3: File Transfer
- [ ] Data channel implementation
- [ ] Chunked transfer with progress

### Phase 4: Polish & Testing
- [ ] Cross-platform testing
- [ ] Performance optimization
- [ ] Security hardening

### Phase 5: Advanced Features (Post-MVP)
- [ ] Group calls
- [ ] Recording
- [ ] Mobile app support
- [ ] Chat functionality
- [ ] Device-to-device sync

## Troubleshooting

### Common Issues

**Port 8080 already in use**
```bash
lsof -i :8080
kill -9 <PID>
```

**PostgreSQL connection failed**
```bash
docker-compose ps
docker-compose logs db
docker-compose restart db
```

**Cargo build fails**
```bash
cargo clean
cargo update
cargo build
```

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for more troubleshooting.

## Support

- 📖 Read the documentation in `/docs`
- 🔧 Check [DEVELOPMENT.md](docs/DEVELOPMENT.md) for setup issues
- 🚀 See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for deployment questions
- 💬 Open an issue for bug reports or feature requests

## Acknowledgments

Inspired by:
- Raspberry Pi Connect - for the user experience
- WebRTC specification - for peer-to-peer connectivity
- Electron - for cross-platform desktop support
- Rust ecosystem - for safety and performance

---

**Last Updated**: June 2024
**Status**: Architecture Phase ✏️ → Backend Implementation (Next)

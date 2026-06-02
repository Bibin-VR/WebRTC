# Development Guide

## Prerequisites

### Backend
- Rust 1.70+ (install from https://rustup.rs/)
- PostgreSQL 13+
- Docker & Docker Compose (for local PostgreSQL)

### Frontend
- Node.js 18+
- npm or yarn

## Project Setup

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create .env file
cat > .env << EOF
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/webrtc
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
SERVER_HOST=0.0.0.0
SERVER_PORT=8080
LOG_LEVEL=debug
EOF

# Install Rust dependencies
cargo build

# Run database migrations
cargo sqlx migrate run

# Start development server
cargo run
```

Server will be available at `http://localhost:8080`

### 2. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Create .env file
cat > .env << EOF
VITE_API_URL=http://localhost:8080
VITE_WS_URL=ws://localhost:8080
EOF

# Start development server
npm run dev
```

Frontend will be available at `http://localhost:3000`

### 3. Database Setup (Docker)

```bash
# Start PostgreSQL using docker-compose from project root
docker-compose up -d

# Verify PostgreSQL is running
docker-compose logs db
```

Database credentials (from docker-compose.yml):
- Host: localhost
- Port: 5432
- User: postgres
- Password: postgres
- Database: webrtc

### 4. Full Local Development Stack

```bash
# From project root, start all services
docker-compose up -d

# Wait for PostgreSQL to be ready (check logs)
docker-compose logs db

# In another terminal, start backend
cd backend
cargo run

# In another terminal, start frontend
cd frontend
npm run dev

# Access application at http://localhost:3000
```

## Project Structure

```
webrtc-platform/
├── backend/                 # Rust backend service
│   ├── src/
│   │   ├── main.rs
│   │   ├── config.rs
│   │   ├── db/             # Database layer
│   │   ├── api/            # HTTP routes
│   │   ├── ws/             # WebSocket handlers
│   │   ├── services/       # Business logic
│   │   └── error.rs
│   ├── migrations/         # Database migrations
│   ├── Cargo.toml
│   └── .env
│
├── frontend/               # Electron + React
│   ├── src/
│   │   ├── main.js         # Electron main
│   │   ├── preload.js
│   │   ├── index.jsx       # React root
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── hooks/
│   ├── public/
│   ├── package.json
│   └── .env
│
├── docker-compose.yml
├── CLAUDE.md
└── docs/
    ├── ARCHITECTURE.md
    ├── API.md
    └── DEVELOPMENT.md
```

## Environment Variables

### Backend (.env)
```
DATABASE_URL=postgresql://user:password@host:port/dbname
JWT_SECRET=your_secret_key (min 32 chars)
SERVER_HOST=0.0.0.0
SERVER_PORT=8080
LOG_LEVEL=debug|info|warn|error
CORS_ORIGIN=http://localhost:3000
ENVIRONMENT=development|production
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:8080
VITE_WS_URL=ws://localhost:8080
VITE_APP_NAME=WebRTC Platform
```

## Common Development Tasks

### Running Tests

#### Backend
```bash
cd backend

# Run all tests
cargo test

# Run specific test
cargo test test_name

# Run with output
cargo test -- --nocapture
```

#### Frontend
```bash
cd frontend

# Run tests
npm test

# Watch mode
npm test -- --watch
```

### Building for Production

#### Backend
```bash
cd backend
cargo build --release
# Binary at: target/release/webrtc_backend
```

#### Frontend
```bash
cd frontend
npm run build
# Output at: dist/
```

### Database Migrations

```bash
cd backend

# Create new migration
cargo sqlx migrate add -r migration_name

# Run migrations
cargo sqlx migrate run

# Revert last migration
cargo sqlx migrate revert
```

### Code Formatting & Linting

#### Backend
```bash
cd backend

# Format code
cargo fmt

# Lint
cargo clippy

# Both
cargo fmt && cargo clippy
```

#### Frontend
```bash
cd frontend

# Format
npm run format

# Lint
npm run lint

# Both
npm run lint:fix
```

## Debugging

### Backend Debug Logging
Set environment variable:
```bash
RUST_LOG=debug cargo run
```

Filter specific modules:
```bash
RUST_LOG=webrtc_backend::api=debug,webrtc_backend::ws=trace cargo run
```

### Frontend Debug Console
- Open DevTools: Ctrl+Shift+I (or Cmd+Option+I on Mac)
- Check browser console for errors
- Use Redux DevTools extension for state inspection

### WebRTC Debugging
- Open `chrome://webrtc-internals` in Chrome
- View connection statistics, ICE candidates, and codec information

## Common Issues & Solutions

### PostgreSQL Connection Failed
```bash
# Check if PostgreSQL is running
docker-compose ps

# View logs
docker-compose logs db

# Restart PostgreSQL
docker-compose restart db
```

### Port Already in Use
```bash
# Find process using port 8080
lsof -i :8080

# Kill process
kill -9 <PID>
```

### Cargo Build Failures
```bash
# Clear build cache
cargo clean

# Update dependencies
cargo update

# Rebuild
cargo build
```

### Database Migration Issues
```bash
# Reset database
docker-compose down
docker-compose up -d

# Run migrations
cd backend
cargo sqlx migrate run
```

## Git Workflow

1. Create feature branch: `git checkout -b feature/feature-name`
2. Make changes and commit: `git commit -m "feat: description"`
3. Format and lint before commit
4. Push to branch: `git push origin feature/feature-name`
5. Create pull request

## Code Style Guidelines

### Rust
- Follow standard Rust conventions
- Use `cargo fmt` for formatting
- Use `cargo clippy` to catch common mistakes
- Maximum line length: 100 characters
- Prefer explicit error handling

### JavaScript/React
- Use ES6+ syntax
- Follow ESLint configuration
- Use meaningful variable names
- Components should be modular and reusable
- Use hooks for state management

## Performance Tips

### Backend
- Use prepared statements for database queries
- Implement caching for frequently accessed data
- Monitor connection pool size
- Profile with `cargo flamegraph`

### Frontend
- Code split large components
- Lazy load routes
- Optimize images and assets
- Monitor WebRTC stats

## Security Checklist

- [ ] Change JWT_SECRET in production
- [ ] Use HTTPS/WSS in production
- [ ] Set proper CORS origins
- [ ] Validate all user input
- [ ] Use prepared statements for SQL
- [ ] Implement rate limiting
- [ ] Enable database connection encryption
- [ ] Regular security audits

## Deployment

See DEPLOYMENT.md for deployment instructions.

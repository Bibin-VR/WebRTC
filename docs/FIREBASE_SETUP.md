# Firebase + Multi-Device Setup Guide

This guide explains how to configure Firebase as the WebRTC signaling layer
and how to connect two machines (a **host** and a **target**) using the platform.

---

## Architecture Overview

```
Host Machine                 Firebase RTDB              Target Machine
(Electron App)               (Signaling Only)           (Electron App)
     │                            │                           │
     │── register participant ──► │                           │
     │                            │ ◄── register participant ─│
     │── write SDP offer ───────► │                           │
     │                            │── deliver offer ─────────►│
     │                            │ ◄── write SDP answer ─────│
     │◄── deliver answer ─────────│                           │
     │                                                        │
     │◄═══════════ Direct P2P WebRTC (video/audio) ══════════►│
     │                                                        │
     │            (Firebase only used for signaling setup)    │
```

**Firebase is used only for signaling** (exchanging connection metadata).
All actual video, audio, and file transfer are peer-to-peer directly between devices.

---

## Step 1 — Create a Firebase Project

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project**, enter a name (e.g. `webrtc-platform`), click Continue
3. Disable Google Analytics (optional), click **Create project**

---

## Step 2 — Enable Realtime Database

1. In the Firebase Console, select your project
2. In the left menu, click **Build → Realtime Database**
3. Click **Create Database**
4. Choose a region close to your users
5. Select **Start in test mode** (we'll secure it later), click **Enable**
6. Copy the **Database URL** — it looks like:
   `https://your-project-default-rtdb.firebaseio.com`

---

## Step 3 — Register a Web App

1. In Firebase Console, click the **gear icon ⚙** → **Project settings**
2. Scroll down to **Your apps**, click the **Web icon** `</>`
3. Enter an app nickname (e.g. `webrtc-frontend`), click **Register app**
4. Copy the `firebaseConfig` object — you need all these values:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.firebaseio.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
}
```

---

## Step 4 — Configure Environment Variables

On **every machine** that will run the app, create `frontend/.env` (copy from `.env.example`):

```bash
cd frontend
cp .env.example .env
```

Edit `.env` and fill in your Firebase values:

```env
VITE_API_URL=http://YOUR_BACKEND_IP:8080
VITE_WS_URL=ws://YOUR_BACKEND_IP:8080

VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

---

## Step 5 — Secure the Database (Production)

Replace the default test-mode rules with these in:
**Firebase Console → Realtime Database → Rules**

```json
{
  "rules": {
    "sessions": {
      "$sessionId": {
        "participants": {
          "$userId": {
            ".read":  "auth != null",
            ".write": "auth != null && auth.uid === $userId"
          }
        },
        "offers": {
          ".read":  "auth != null",
          ".write": "auth != null"
        },
        "answers": {
          ".read":  "auth != null",
          ".write": "auth != null"
        },
        "ice": {
          ".read":  "auth != null",
          ".write": "auth != null"
        }
      }
    }
  }
}
```

> **Development shortcut**: Use `.read: true, .write: true` under `"rules"` while
> testing, then lock it down before going to production.

---

## Step 6 — Two-Machine Setup: Host & Target

### Prerequisites on both machines
- Node.js 18+
- Git
- The app code (cloned from your repo)
- Both machines on the same network **or** internet-accessible

---

### Machine A — The Host (Initiates the call)

This machine starts the session and invites others.

```bash
# 1. Clone and install
git clone https://github.com/bibin-vr/webrtc.git
cd webrtc/frontend
cp .env.example .env
# → Edit .env with Firebase config and your backend URL

npm install
npm run dev          # Development (hot reload)
# OR
npm run build && npm run electron   # Packaged Electron app
```

1. Open the app → **Register** or **Log in**
2. Click **Register Device** on the Dashboard
3. Note your **User ID** or **display name** to share with the target
4. Wait on the Dashboard — you'll see yourself listed as online

**To start a call:**
- Search for the target device by name
- Click **Call** next to their online device
- The app creates a session in your backend and joins the Firebase room

---

### Machine B — The Target (Joins the call)

```bash
# 1. Clone and install (same steps)
git clone https://github.com/bibin-vr/webrtc.git
cd webrtc/frontend
cp .env.example .env
# → Same .env values (same Firebase project, same backend URL)

npm install
npm run dev
```

1. Open the app → **Register** or **Log in**
2. Register a device
3. You will see an **incoming call notification** from the host
4. Click **Accept** — the call page opens automatically

Both machines are now in the same Firebase session room. The signaling handshake happens via Firebase, then video and audio flow directly peer-to-peer.

---

## Adding More Devices (Multi-Device)

The platform uses a **full mesh topology**. Each new participant automatically connects to every other participant in the session.

```
Device A ──── Device B
    │  ╲     ╱  │
    │    ╲  ╱   │
    │     ╲╱    │
    │     ╱╲    │
    │   ╱    ╲  │
Device C ──── Device D
```

**To add a third (or fourth) device:**
1. Any logged-in user can search for the existing session host
2. The host clicks their name and invites them — or the session ID can be shared manually
3. The new participant joins the Firebase room, and the mesh automatically forms

Up to **6 devices** are displayed in the video grid. More are technically supported
but performance degrades with mesh beyond ~6 (consider SFU for larger groups).

---

## Connecting Over the Internet

For machines on different networks you need a **TURN server** to relay traffic
when direct P2P is blocked by NAT.

### Option A — Use a free STUN (works for most home networks)
Already configured — Google's STUN servers are used by default.

### Option B — Add a TURN server (required for strict corporate NAT)

1. Get a free TURN server from [Metered.ca](https://www.metered.ca/tools/openrelay/)
   or deploy [coturn](https://github.com/coturn/coturn)

2. Edit `frontend/src/services/firebaseSignaling.js`, update `ICE_SERVERS`:

```javascript
const ICE_SERVERS = [
  { urls: ['stun:stun.l.google.com:19302'] },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
]
```

3. Rebuild and restart the app.

---

## Backend (Rust) — Still Required For

The Firebase integration handles **WebRTC signaling only**. The Rust backend is
still needed for:

| Feature | Where |
|---------|-------|
| User registration / login | Rust (JWT auth) |
| Device management | Rust (PostgreSQL) |
| Session creation (REST) | Rust |
| Presence / online status | WebSocket (Rust) |

Start the backend with:

```bash
cd backend
cp .env.example .env   # fill in DATABASE_URL, JWT_SECRET, etc.
docker-compose up -d   # starts PostgreSQL + Redis
cargo run              # starts the Rust API on port 8080
```

---

## Quick Test Without the Backend

To test WebRTC + Firebase only (no Rust backend), you can hardcode a session ID
in `CallPage.jsx` and bypass auth temporarily:

```javascript
// Temporary test — replace user.id with a fixed test ID
const signaling = new FirebaseSignalingService(
  'test-room-1',       // shared session ID
  'machine-a',         // unique per machine
  'Machine A'
)
```

Repeat on Machine B with `'machine-b'` and `'Machine B'`. Both will connect through
Firebase and establish a P2P call.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Firebase: Error (auth/invalid-api-key)" | Check `VITE_FIREBASE_API_KEY` in `.env` |
| Video appears but no audio | Allow microphone in browser/OS permissions |
| Peers not connecting | Add a TURN server (NAT traversal issue) |
| "Could not find module firebase" | Run `npm install` in `frontend/` |
| Black video tiles | Camera permissions denied — check browser settings |
| Only 1-way video | Both sides must allow camera; check `ontrack` handler |
| Firebase PERMISSION_DENIED | Update Database Rules to allow reads/writes |

---

## File Structure Added

```
frontend/src/services/
  firebase.js              ← Firebase SDK initialization
  firebaseSignaling.js     ← Multi-peer WebRTC signaling via Firebase RTDB

frontend/src/components/
  MultiCallView.jsx        ← Dynamic video grid (1–6 participants)
  MultiCallView.css        ← Grid layout styles

frontend/src/pages/
  CallPage.jsx             ← Updated to use FirebaseSignalingService

docs/
  FIREBASE_SETUP.md        ← This file
```

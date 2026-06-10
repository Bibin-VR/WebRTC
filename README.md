# vexRTC

Zero-auth remote screen sharing via WebRTC + Firebase. One command to install — works across the internet.

## How it works

- **Target machine** shares its screen silently as a hidden background daemon
- **Monitor machine** connects by device number and gets full mouse/keyboard control
- Signaling via Firebase Realtime Database — no server to run or maintain
- Peer-to-peer video via WebRTC — Firebase only brokers the connection, video never touches it

## Quick start

### Target machine (screen to be shared)

```bash
npx vexrtc -serve
```

This installs once to `~/.vexrtc/`, registers an OS autostart service, and starts the daemon in the background. The screen is shared silently — no window, no taskbar icon, no dock entry.

**Auto-starts on every reboot.** Only stops when you explicitly run `-stop`.

### Monitor machine (viewing)

```bash
npx vexrtc -monitor 1
```

Opens a browser tab connected to device #1. Use `-monitor 2` for device #2, and so on.

No installation required on the monitor machine.

### Stop sharing

```bash
npx vexrtc -stop
```

Stops the daemon and removes it from autostart.

### Check status

```bash
npx vexrtc -status
```

---

## Commands

| Command | Description |
|---|---|
| `npx vexrtc -serve` | Install and start screen sharing daemon |
| `npx vexrtc -stop` | Stop daemon and remove autostart |
| `npx vexrtc -status` | Check if daemon is running |
| `npx vexrtc -monitor [N]` | Open monitor UI for device #N (default: 1) |

---

## Autostart behaviour

| Platform | Mechanism | Survives reboot |
|---|---|---|
| Linux | `systemd --user` service + `loginctl enable-linger` | Yes |
| macOS | `launchd` agent (`~/Library/LaunchAgents/`) | Yes |
| Windows | Task Scheduler `ONLOGON` task via VBScript | Yes |

The daemon restarts automatically if it crashes (`Restart=always` / `KeepAlive: true`).

---

## Architecture

```
Target machine                          Monitor machine
┌─────────────────────┐                ┌─────────────────────┐
│  Electron daemon     │                │  npx vexrtc -monitor│
│  (hidden, no UI)     │                │  Express + browser  │
│                      │◄──── WebRTC ──►│                     │
│  getDisplayMedia()   │   P2P video    │  <video> fullscreen │
│  auto-captures       │   + data chan  │  mouse/kb events    │
│  primary screen      │                │  → data channel     │
└─────────┬───────────┘                └──────────┬──────────┘
          │                                        │
          └──────── Firebase RTDB signaling ───────┘
                  (offer / answer / ICE only)
```

**Device slots** — each target machine is assigned a slot number (1, 2, 3…) stored in Firebase. Monitors connect by slot number, not by user account. No authentication required.

**Firebase RTDB:** `https://tovex-eab23-default-rtdb.firebaseio.com/`

---

## Install details

On first `npx vexrtc -serve`:

1. Copies package files to `~/.vexrtc/` (stable path for the OS service)
2. Runs `npm install` in `~/.vexrtc/frontend/` (downloads Electron, ~120 MB)
3. Builds the React frontend with Vite (skipped if pre-built dist is bundled)
4. Registers and starts the OS autostart service

Subsequent runs skip steps 2 and 3 if the dependencies and build are already present.

Logs are written to `~/.vexrtc/daemon.log`.

---

## Requirements

- **Node.js 18+** on the target machine (for the install step)
- No Node.js required on the monitor machine after the npm package is downloaded
- Internet access to Firebase RTDB for signaling
- Direct P2P path or STUN/TURN for video (standard WebRTC ICE)

---

## Typical deployment

```
Factory floor / industrial machine:
  → run once:  npx vexrtc -serve
  → machine is now always available for remote connection

Engineer's laptop (anywhere in the world):
  → npx vexrtc -monitor 1
  → browser opens, full screen video + mouse/keyboard control
```

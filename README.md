# vexRTC

**Zero-auth remote screen sharing over WebRTC.** One command to install, works across
the internet.

A target machine shares its screen as a hidden background daemon. A monitor machine
connects by device number and gets full mouse and keyboard control. Firebase brokers the
connection; the video itself is peer-to-peer and never passes through it.

## Quick start

**On the machine to be shared:**

```bash
npx vexrtc -serve
```

Installs once to `~/.vexrtc/`, registers an OS autostart service, and starts the daemon
in the background. The screen is shared silently — no window, no taskbar icon, no dock
entry. It **auto-starts on every reboot** and only stops when you run `-stop`.

**On the machine doing the viewing:**

```bash
npx vexrtc -monitor 1
```

Opens a browser tab connected to device #1. Use `-monitor 2` for device #2, and so on.
No installation is required on the monitor machine.

**To stop sharing:**

```bash
npx vexrtc -stop
```

## Commands

| Command | Description |
|---|---|
| `npx vexrtc -serve` | Install and start the screen-sharing daemon |
| `npx vexrtc -stop` | Stop the daemon and remove it from autostart |
| `npx vexrtc -status` | Check whether the daemon is running |
| `npx vexrtc -monitor [N]` | Open the monitor UI for device #N (default: 1) |

## Architecture

```
Target machine                          Monitor machine
┌─────────────────────┐                ┌─────────────────────┐
│  Electron daemon    │                │ npx vexrtc -monitor │
│  (hidden, no UI)    │                │  Express + browser  │
│                     │◄──── WebRTC ──►│                     │
│  getDisplayMedia()  │   P2P video    │  <video> fullscreen │
│  auto-captures      │   + data chan  │  mouse/kb events    │
│  primary screen     │                │  → data channel     │
└─────────┬───────────┘                └──────────┬──────────┘
          │                                       │
          └──────── Firebase RTDB signaling ──────┘
                  (offer / answer / ICE only)
```

**Device slots.** Each target machine is assigned a slot number (1, 2, 3…) stored in
Firebase. Monitors connect by slot number, not by user account — no authentication is
required.

**Signaling:** Firebase RTDB at `https://tovex-eab23-default-rtdb.firebaseio.com/`

## Autostart

| Platform | Mechanism | Survives reboot |
|---|---|---|
| Linux | `systemd --user` service + `loginctl enable-linger` | Yes |
| macOS | `launchd` agent (`~/Library/LaunchAgents/`) | Yes |
| Windows | Task Scheduler `ONLOGON` task via VBScript | Yes |

The daemon restarts automatically if it crashes (`Restart=always` / `KeepAlive: true`).

## What the install does

On the first `npx vexrtc -serve`:

1. Copies package files to `~/.vexrtc/` — a stable path for the OS service
2. Runs `npm install` in `~/.vexrtc/frontend/` (downloads Electron, roughly 120 MB)
3. Builds the React frontend with Vite — skipped if a pre-built `dist` is bundled
4. Registers and starts the OS autostart service

Subsequent runs skip steps 2 and 3 when the dependencies and build are already present.
Logs are written to `~/.vexrtc/daemon.log`.

## Requirements

- **Node.js 18+** on the target machine, for the install step
- No Node.js needed on the monitor machine once the npm package is downloaded
- Internet access to Firebase RTDB for signaling
- A direct P2P path, or STUN/TURN, for video — standard WebRTC ICE

## Typical deployment

```
Factory floor / industrial machine
  → run once:  npx vexrtc -serve
  → the machine is now always available for remote connection

Engineer's laptop, anywhere in the world
  → npx vexrtc -monitor 1
  → browser opens with full-screen video and mouse/keyboard control
```

## License

MIT

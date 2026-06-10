import { database } from './firebase'
import {
  ref, set, get, update, remove, push,
  onValue, onChildAdded, onDisconnect, serverTimestamp,
} from 'firebase/database'

// ── Device identity ──
// Each machine gets a UUID stored in localStorage so it keeps the same slot number.

export function getOrCreateDeviceId() {
  let id = localStorage.getItem('webrtc-remote-device-id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('webrtc-remote-device-id', id)
  }
  return id
}

// ── Device registration ──
// Devices auto-assign the lowest available slot number (1, 2, 3...).

export async function registerDevice(hostname, platform) {
  const deviceId = getOrCreateDeviceId()

  const devRef = ref(database, `devices/${deviceId}`)
  const snap = await get(devRef)
  if (snap.exists() && snap.val().slot) {
    const { slot } = snap.val()
    await update(devRef, {
      hostname, platform, available: true, lastSeen: serverTimestamp(),
    })
    onDisconnect(devRef).update({ available: false, lastSeen: serverTimestamp() })
    return { deviceId, slot }
  }

  const all = await get(ref(database, 'devices'))
  const used = new Set()
  if (all.exists()) all.forEach((c) => { if (c.val().slot) used.add(c.val().slot) })

  let slot = 1
  while (used.has(slot)) slot++

  await set(devRef, {
    slot, hostname, platform, available: true, lastSeen: serverTimestamp(),
  })
  onDisconnect(devRef).update({ available: false, lastSeen: serverTimestamp() })
  return { deviceId, slot }
}

export async function setDeviceOffline(deviceId) {
  await update(ref(database, `devices/${deviceId}`), {
    available: false, lastSeen: serverTimestamp(),
  })
}

export function watchDevices(callback) {
  const r = ref(database, 'devices')
  return onValue(r, (snap) => {
    const devices = []
    if (snap.exists()) {
      snap.forEach((c) => { const v = c.val(); if (v.available) devices.push({ id: c.key, ...v }) })
    }
    callback(devices.sort((a, b) => a.slot - b.slot))
  })
}

export async function getDeviceBySlot(slot) {
  const snap = await get(ref(database, 'devices'))
  if (!snap.exists()) return null
  let found = null
  snap.forEach((c) => {
    const v = c.val()
    if (v.slot === slot && v.available) found = { id: c.key, ...v }
  })
  return found
}

// ── Signaling ──
// Path: signaling/<deviceId>/<monitorId>/offer|answer|targetCandidates|monitorCandidates

export async function publishOffer(deviceId, monitorId, sdp) {
  await set(ref(database, `signaling/${deviceId}/${monitorId}/offer`), sdp)
}

export async function publishAnswer(deviceId, monitorId, sdp) {
  await set(ref(database, `signaling/${deviceId}/${monitorId}/answer`), sdp)
}

export function watchOffer(deviceId, monitorId, callback) {
  return onValue(ref(database, `signaling/${deviceId}/${monitorId}/offer`), (snap) => {
    if (snap.exists()) callback(snap.val())
  })
}

export function watchAnswer(deviceId, monitorId, callback) {
  return onValue(ref(database, `signaling/${deviceId}/${monitorId}/answer`), (snap) => {
    if (snap.exists()) callback(snap.val())
  })
}

export async function addIceCandidate(deviceId, monitorId, side, candidate) {
  await set(push(ref(database, `signaling/${deviceId}/${monitorId}/${side}Candidates`)), candidate)
}

// onChildAdded fires for existing children first, then new ones — perfect for ICE buffering
export function watchIceCandidates(deviceId, monitorId, side, callback) {
  return onChildAdded(
    ref(database, `signaling/${deviceId}/${monitorId}/${side}Candidates`),
    (snap) => { if (snap.exists()) callback(snap.val()) },
  )
}

// Target watches for any new monitor session appearing under its signaling path
export function watchNewMonitors(deviceId, callback) {
  return onChildAdded(ref(database, `signaling/${deviceId}`), (snap) => callback(snap.key))
}

export async function cleanupSignaling(deviceId, monitorId) {
  await remove(ref(database, `signaling/${deviceId}/${monitorId}`))
}

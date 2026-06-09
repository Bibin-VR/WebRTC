import { database } from './firebase'
import {
  ref, set, get, update, remove, push,
  onValue, off, query, orderByChild, equalTo,
  serverTimestamp,
} from 'firebase/database'

// ── Users ──

export async function createUserProfile(uid, email, displayName) {
  await set(ref(database, `users/${uid}`), {
    email,
    displayName,
    createdAt: serverTimestamp(),
  })
}

export async function getUserProfile(uid) {
  const snap = await get(ref(database, `users/${uid}`))
  return snap.exists() ? { id: uid, ...snap.val() } : null
}

export async function updateUserProfile(uid, fields) {
  await update(ref(database, `users/${uid}`), fields)
}

export async function searchUsers(searchQuery) {
  const snap = await get(ref(database, 'users'))
  if (!snap.exists()) return []
  const results = []
  const q = searchQuery.toLowerCase()
  snap.forEach((child) => {
    const u = child.val()
    if (
      u.displayName?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q)
    ) {
      results.push({ id: child.key, ...u })
    }
  })
  return results
}

// ── Devices ──

export async function registerDevice(uid, deviceName, platform) {
  const devRef = push(ref(database, `devices/${uid}`))
  const device = {
    deviceName,
    platform,
    isOnline: true,
    lastSeen: serverTimestamp(),
    createdAt: serverTimestamp(),
  }
  await set(devRef, device)
  return { id: devRef.key, ...device }
}

export async function listDevices(uid) {
  const snap = await get(ref(database, `devices/${uid}`))
  if (!snap.exists()) return []
  const devices = []
  snap.forEach((child) => devices.push({ id: child.key, ...child.val() }))
  return devices
}

export async function setDeviceOnline(uid, deviceId, online) {
  await update(ref(database, `devices/${uid}/${deviceId}`), {
    isOnline: online,
    lastSeen: serverTimestamp(),
  })
}

export async function deleteDevice(uid, deviceId) {
  await remove(ref(database, `devices/${uid}/${deviceId}`))
}

// ── Presence ──

export function watchOnlineUsers(callback) {
  const presRef = ref(database, 'presence')
  const unsub = onValue(presRef, (snap) => {
    callback(snap.val() || {})
  })
  return () => off(presRef, 'value', unsub)
}

export async function goOnline(uid, displayName) {
  await set(ref(database, `presence/${uid}`), {
    displayName,
    online: true,
    lastSeen: serverTimestamp(),
  })
}

export async function goOffline(uid) {
  await remove(ref(database, `presence/${uid}`))
}

// ── Sessions ──

export async function createSession(initiatorId, targetUserId) {
  const sessRef = push(ref(database, 'sessions'))
  const session = {
    initiatorId,
    targetUserId,
    status: 'pending',
    createdAt: serverTimestamp(),
  }
  await set(sessRef, session)
  return { id: sessRef.key, ...session }
}

export async function getSession(sessionId) {
  const snap = await get(ref(database, `sessions/${sessionId}`))
  return snap.exists() ? { id: sessionId, ...snap.val() } : null
}

export async function endSession(sessionId) {
  await update(ref(database, `sessions/${sessionId}`), {
    status: 'ended',
    endedAt: serverTimestamp(),
  })
}

// ── Incoming call notifications ──

export function watchIncomingCalls(uid, callback) {
  const q = query(ref(database, 'sessions'), orderByChild('targetUserId'), equalTo(uid))
  const unsub = onValue(q, (snap) => {
    const calls = []
    snap.forEach((child) => {
      const s = child.val()
      if (s.status === 'pending') {
        calls.push({ id: child.key, ...s })
      }
    })
    callback(calls)
  })
  return () => off(q, 'value', unsub)
}

export async function acceptSession(sessionId) {
  await update(ref(database, `sessions/${sessionId}`), { status: 'active' })
}

export async function rejectSession(sessionId) {
  await update(ref(database, `sessions/${sessionId}`), { status: 'rejected' })
}

import { database } from './firebase'
import { ref, set, onValue, push, off, remove, serverTimestamp } from 'firebase/database'

const ICE_SERVERS = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  // Add TURN server credentials in production for better NAT traversal:
  // { urls: 'turn:your-turn-server.com', username: '...', credential: '...' }
]

export class FirebaseSignalingService {
  constructor(sessionId, userId, displayName) {
    this.sessionId = sessionId
    this.userId = userId
    this.displayName = displayName

    // peerId -> RTCPeerConnection
    this.peers = new Map()
    // peerId -> MediaStream
    this.streams = new Map()
    // peerId -> buffered ICE candidates (before remote desc is set)
    this.iceCandidateBuffer = new Map()

    this.localStream = null
    this.offListeners = [] // cleanup callbacks

    // Callbacks set by the caller
    this.onPeerConnected = null      // (peerId, stream, displayName) => void
    this.onPeerDisconnected = null   // (peerId) => void
    this.onParticipantsChanged = null // (participants: { [id]: { displayName } }) => void
    this.onConnectionStateChange = null // (peerId, state) => void
  }

  async join(localStream) {
    this.localStream = localStream

    // Register this participant in the Firebase session room
    const myRef = ref(database, `sessions/${this.sessionId}/participants/${this.userId}`)
    await set(myRef, {
      displayName: this.displayName,
      joinedAt: serverTimestamp(),
    })

    // Watch participant list — connect to any new peers
    const participantsRef = ref(database, `sessions/${this.sessionId}/participants`)
    const offParticipants = onValue(participantsRef, async (snapshot) => {
      const participants = snapshot.val() || {}
      this.onParticipantsChanged?.(participants)

      for (const peerId of Object.keys(participants)) {
        if (peerId === this.userId) continue
        if (!this.peers.has(peerId)) {
          // Lexicographic ordering: smaller userId always initiates the offer
          // to prevent both sides creating offers simultaneously
          if (this.userId < peerId) {
            await this._createOffer(peerId, participants[peerId]?.displayName)
          }
          // The larger userId waits for an offer and responds (handled below)
        }
      }

      // Close connections to peers who left
      for (const peerId of this.peers.keys()) {
        if (!participants[peerId]) {
          this._closePeer(peerId)
        }
      }
    })
    this.offListeners.push(() => off(participantsRef, 'value', offParticipants))

    // Watch for incoming offers addressed to this user
    const offersRef = ref(database, `sessions/${this.sessionId}/offers`)
    const offOffers = onValue(offersRef, async (snapshot) => {
      const offers = snapshot.val() || {}
      for (const [key, offer] of Object.entries(offers)) {
        // Key format: "{fromId}_to_{toId}"
        const [fromId, , toId] = key.split('_')
        if (toId === this.userId && !this.peers.has(fromId)) {
          const participantsSnap = await this._getParticipants()
          const displayName = participantsSnap[fromId]?.displayName || fromId
          await this._handleOffer(fromId, offer, displayName)
        }
      }
    })
    this.offListeners.push(() => off(offersRef, 'value', offOffers))
  }

  async _getParticipants() {
    return new Promise((resolve) => {
      const participantsRef = ref(database, `sessions/${this.sessionId}/participants`)
      onValue(participantsRef, (snap) => resolve(snap.val() || {}), { onlyOnce: true })
    })
  }

  _createPeerConnection(peerId, peerDisplayName) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    this.peers.set(peerId, pc)
    this.iceCandidateBuffer.set(peerId, [])

    // Add local tracks to the connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => pc.addTrack(track, this.localStream))
    }

    // Receive remote media stream
    pc.ontrack = (event) => {
      const stream = event.streams[0]
      this.streams.set(peerId, stream)
      this.onPeerConnected?.(peerId, stream, peerDisplayName)
    }

    // Send ICE candidates to Firebase
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const candRef = ref(
          database,
          `sessions/${this.sessionId}/ice/${this.userId}_to_${peerId}`,
        )
        push(candRef, event.candidate.toJSON())
      }
    }

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState
      this.onConnectionStateChange?.(peerId, state)
      if (state === 'failed' || state === 'closed') {
        this._closePeer(peerId)
        this.onPeerDisconnected?.(peerId)
      }
    }

    // Watch for incoming ICE candidates from this peer
    const iceRef = ref(database, `sessions/${this.sessionId}/ice/${peerId}_to_${this.userId}`)
    const offIce = onValue(iceRef, (snapshot) => {
      snapshot.forEach((child) => {
        const candidate = child.val()
        if (!candidate) return
        if (pc.remoteDescription) {
          pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {})
        } else {
          // Buffer until remote description is set
          this.iceCandidateBuffer.get(peerId)?.push(candidate)
        }
      })
    })
    this.offListeners.push(() => off(iceRef, 'value', offIce))

    return pc
  }

  async _flushCandidateBuffer(peerId, pc) {
    const buffered = this.iceCandidateBuffer.get(peerId) || []
    for (const candidate of buffered) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {})
    }
    this.iceCandidateBuffer.set(peerId, [])
  }

  async _createOffer(peerId, peerDisplayName) {
    const pc = this._createPeerConnection(peerId, peerDisplayName)
    const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
    await pc.setLocalDescription(offer)

    // Write offer to Firebase
    const offerRef = ref(
      database,
      `sessions/${this.sessionId}/offers/${this.userId}_to_${peerId}`,
    )
    await set(offerRef, { type: offer.type, sdp: offer.sdp })

    // Watch for the answer
    const answerRef = ref(
      database,
      `sessions/${this.sessionId}/answers/${peerId}_to_${this.userId}`,
    )
    const offAnswer = onValue(answerRef, async (snapshot) => {
      const answer = snapshot.val()
      if (answer && !pc.remoteDescription) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer))
        await this._flushCandidateBuffer(peerId, pc)
      }
    })
    this.offListeners.push(() => off(answerRef, 'value', offAnswer))
  }

  async _handleOffer(fromId, offer, fromDisplayName) {
    const pc = this._createPeerConnection(fromId, fromDisplayName)
    await pc.setRemoteDescription(new RTCSessionDescription(offer))
    await this._flushCandidateBuffer(fromId, pc)

    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    // Write answer to Firebase
    const answerRef = ref(
      database,
      `sessions/${this.sessionId}/answers/${this.userId}_to_${fromId}`,
    )
    await set(answerRef, { type: answer.type, sdp: answer.sdp })
  }

  _closePeer(peerId) {
    const pc = this.peers.get(peerId)
    if (pc) {
      pc.close()
      this.peers.delete(peerId)
    }
    this.streams.delete(peerId)
    this.iceCandidateBuffer.delete(peerId)
  }

  // Replace the video track in all peer connections (for screen share toggle)
  replaceVideoTrack(newTrack) {
    this.peers.forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
      if (sender) sender.replaceTrack(newTrack)
    })
  }

  getDataChannel(peerId, label) {
    const pc = this.peers.get(peerId)
    if (!pc) return null
    try {
      return pc.createDataChannel(label)
    } catch {
      return null
    }
  }

  async leave() {
    // Remove our participant entry
    await remove(ref(database, `sessions/${this.sessionId}/participants/${this.userId}`))

    // Detach all Firebase listeners
    this.offListeners.forEach((fn) => fn())
    this.offListeners = []

    // Close all peer connections
    this.peers.forEach((pc) => pc.close())
    this.peers.clear()
    this.streams.clear()

    // Stop local media tracks
    this.localStream?.getTracks().forEach((t) => t.stop())
    this.localStream = null
  }
}

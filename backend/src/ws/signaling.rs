use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum WsMessage {
    // Authentication
    #[serde(rename = "auth")]
    Auth { token: String, device_id: Option<Uuid> },

    #[serde(rename = "auth:success")]
    AuthSuccess { user_id: Uuid, message: String },

    #[serde(rename = "auth:error")]
    AuthError { message: String },

    // Presence
    #[serde(rename = "user:online")]
    UserOnline {
        user_id: Uuid,
        display_name: String,
        device_id: Option<Uuid>,
    },

    #[serde(rename = "user:offline")]
    UserOffline { user_id: Uuid },

    // Heartbeat
    #[serde(rename = "heartbeat")]
    Heartbeat,

    #[serde(rename = "heartbeat:ack")]
    HeartbeatAck,

    // Call initiation
    #[serde(rename = "call:request")]
    CallRequest {
        session_id: Uuid,
        target_user_id: Uuid,
        target_device_id: Uuid,
    },

    #[serde(rename = "call:incoming")]
    CallIncoming {
        session_id: Uuid,
        initiator_id: Uuid,
        initiator_name: String,
    },

    #[serde(rename = "call:accept")]
    CallAccept { session_id: Uuid },

    #[serde(rename = "call:reject")]
    CallReject {
        session_id: Uuid,
        reason: String,
    },

    #[serde(rename = "call:accepted")]
    CallAccepted { session_id: Uuid },

    #[serde(rename = "call:rejected")]
    CallRejected {
        session_id: Uuid,
        reason: String,
    },

    // WebRTC signaling
    #[serde(rename = "signal:offer")]
    SignalOffer {
        session_id: Uuid,
        sdp: String,
    },

    #[serde(rename = "signal:answer")]
    SignalAnswer {
        session_id: Uuid,
        sdp: String,
    },

    #[serde(rename = "signal:ice-candidate")]
    SignalIceCandidate {
        session_id: Uuid,
        candidate: serde_json::Value,
    },

    // Screen sharing
    #[serde(rename = "stream:start-screen")]
    StreamStartScreen { session_id: Uuid },

    #[serde(rename = "stream:stop-screen")]
    StreamStopScreen { session_id: Uuid },

    // File transfer signaling
    #[serde(rename = "file:offer")]
    FileOffer {
        session_id: Uuid,
        file_id: Uuid,
        filename: String,
        size: u64,
        checksum: String,
    },

    #[serde(rename = "file:accept")]
    FileAccept {
        session_id: Uuid,
        file_id: Uuid,
    },

    #[serde(rename = "file:reject")]
    FileReject {
        session_id: Uuid,
        file_id: Uuid,
    },

    // Error
    #[serde(rename = "error")]
    Error { message: String },
}

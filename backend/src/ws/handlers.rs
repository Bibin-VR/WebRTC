use actix_ws::{Message, Session};
use futures_util::StreamExt;
use sqlx::PgPool;
use uuid::Uuid;

use super::signaling::WsMessage;
use super::{ClientConnection, ConnectedClients};
use crate::db::queries;
use crate::services::auth_service;

pub async fn handle_ws_connection(
    mut session: Session,
    mut stream: actix_ws::MessageStream,
    clients: ConnectedClients,
    jwt_secret: String,
    pool: PgPool,
) {
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<String>();

    let mut authenticated_user_id: Option<Uuid> = None;
    let mut connection_id = Uuid::new_v4();

    let mut send_session = session.clone();
    let send_task = actix_rt::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if send_session.text(msg).await.is_err() {
                break;
            }
        }
    });

    while let Some(Ok(msg)) = stream.next().await {
        match msg {
            Message::Text(text) => {
                let parsed: Result<WsMessage, _> = serde_json::from_str(&text);

                match parsed {
                    Ok(ws_msg) => {
                        handle_message(
                            &ws_msg,
                            &mut session,
                            &tx,
                            &clients,
                            &jwt_secret,
                            &pool,
                            &mut authenticated_user_id,
                            &mut connection_id,
                        )
                        .await;
                    }
                    Err(e) => {
                        let error = WsMessage::Error {
                            message: format!("Invalid message format: {}", e),
                        };
                        let _ = session
                            .text(serde_json::to_string(&error).unwrap_or_default())
                            .await;
                    }
                }
            }
            Message::Ping(bytes) => {
                let _ = session.pong(&bytes).await;
            }
            Message::Close(_) => break,
            _ => {}
        }
    }

    if let Some(user_id) = authenticated_user_id {
        let mut clients_lock = clients.write().await;
        clients_lock.remove(&connection_id);

        let _ = queries::set_device_online(&pool, connection_id, false).await;

        let offline_msg = WsMessage::UserOffline { user_id };
        if let Ok(msg_str) = serde_json::to_string(&offline_msg) {
            for client in clients_lock.values() {
                let _ = client.tx.send(msg_str.clone());
            }
        }

        tracing::info!("User {} disconnected", user_id);
    }

    send_task.abort();
}

async fn handle_message(
    msg: &WsMessage,
    session: &mut Session,
    tx: &tokio::sync::mpsc::UnboundedSender<String>,
    clients: &ConnectedClients,
    jwt_secret: &str,
    pool: &PgPool,
    authenticated_user_id: &mut Option<Uuid>,
    connection_id: &mut Uuid,
) {
    match msg {
        WsMessage::Auth { token, device_id } => {
            match auth_service::validate_token(token, jwt_secret) {
                Ok(claims) => {
                    *authenticated_user_id = Some(claims.sub);

                    if let Some(dev_id) = device_id {
                        *connection_id = *dev_id;
                        let _ = queries::set_device_online(pool, *dev_id, true).await;
                    }

                    let display_name = claims.email.clone();

                    let client = ClientConnection {
                        user_id: claims.sub,
                        device_id: *device_id,
                        display_name: display_name.clone(),
                        tx: tx.clone(),
                    };

                    clients.write().await.insert(*connection_id, client);

                    let success = WsMessage::AuthSuccess {
                        user_id: claims.sub,
                        message: "Authenticated successfully".to_string(),
                    };
                    let _ = session
                        .text(serde_json::to_string(&success).unwrap_or_default())
                        .await;

                    let online_msg = WsMessage::UserOnline {
                        user_id: claims.sub,
                        display_name,
                        device_id: *device_id,
                    };
                    broadcast_to_others(clients, *connection_id, &online_msg).await;

                    tracing::info!("User {} authenticated via WebSocket", claims.sub);
                }
                Err(_) => {
                    let error = WsMessage::AuthError {
                        message: "Invalid or expired token".to_string(),
                    };
                    let _ = session
                        .text(serde_json::to_string(&error).unwrap_or_default())
                        .await;
                }
            }
        }

        WsMessage::Heartbeat => {
            let ack = WsMessage::HeartbeatAck;
            let _ = session
                .text(serde_json::to_string(&ack).unwrap_or_default())
                .await;
        }

        WsMessage::CallRequest {
            session_id,
            target_user_id,
            ..
        } => {
            if let Some(user_id) = authenticated_user_id {
                let display_name = {
                    let clients_lock = clients.read().await;
                    clients_lock
                        .get(connection_id)
                        .map(|c| c.display_name.clone())
                        .unwrap_or_default()
                };

                let incoming = WsMessage::CallIncoming {
                    session_id: *session_id,
                    initiator_id: *user_id,
                    initiator_name: display_name,
                };

                send_to_user(clients, *target_user_id, &incoming).await;
            }
        }

        WsMessage::CallAccept { session_id } => {
            if authenticated_user_id.is_some() {
                if let Ok(Some(sess)) = queries::find_session_by_id(pool, *session_id).await {
                    let _ =
                        queries::update_session_status(pool, *session_id, "active").await;

                    let accepted = WsMessage::CallAccepted {
                        session_id: *session_id,
                    };
                    send_to_user(clients, sess.initiator_id, &accepted).await;
                }
            }
        }

        WsMessage::CallReject { session_id, reason } => {
            if authenticated_user_id.is_some() {
                if let Ok(Some(sess)) = queries::find_session_by_id(pool, *session_id).await {
                    let _ =
                        queries::update_session_status(pool, *session_id, "failed").await;

                    let rejected = WsMessage::CallRejected {
                        session_id: *session_id,
                        reason: reason.clone(),
                    };
                    send_to_user(clients, sess.initiator_id, &rejected).await;
                }
            }
        }

        WsMessage::SignalOffer { session_id, .. } => {
            forward_to_peer(clients, pool, *session_id, authenticated_user_id, msg).await;
        }

        WsMessage::SignalAnswer { session_id, .. } => {
            forward_to_peer(clients, pool, *session_id, authenticated_user_id, msg).await;
        }

        WsMessage::SignalIceCandidate {
            session_id, ..
        } => {
            forward_to_peer(clients, pool, *session_id, authenticated_user_id, msg).await;
        }

        WsMessage::StreamStartScreen { session_id }
        | WsMessage::StreamStopScreen { session_id } => {
            forward_to_peer(clients, pool, *session_id, authenticated_user_id, msg).await;
        }

        WsMessage::FileOffer { session_id, .. }
        | WsMessage::FileAccept { session_id, .. }
        | WsMessage::FileReject { session_id, .. } => {
            forward_to_peer(clients, pool, *session_id, authenticated_user_id, msg).await;
        }

        // Log unhandled messages for debugging
        _ => {
            tracing::debug!("Unhandled WebSocket message type");
        }
    }
}

async fn forward_to_peer(
    clients: &ConnectedClients,
    pool: &PgPool,
    session_id: Uuid,
    sender_user_id: &Option<Uuid>,
    msg: &WsMessage,
) {
    let Some(user_id) = sender_user_id else {
        return;
    };

    if let Ok(Some(session)) = queries::find_session_by_id(pool, session_id).await {
        let target_user_id = if session.initiator_id == *user_id {
            session.responder_id
        } else {
            session.initiator_id
        };

        send_to_user(clients, target_user_id, msg).await;
    }
}

async fn broadcast_to_others(clients: &ConnectedClients, sender_id: Uuid, msg: &WsMessage) {
    if let Ok(msg_str) = serde_json::to_string(msg) {
        let clients_lock = clients.read().await;
        for (id, client) in clients_lock.iter() {
            if *id != sender_id {
                let _ = client.tx.send(msg_str.clone());
            }
        }
    }
}

async fn send_to_user(clients: &ConnectedClients, target_user_id: Uuid, msg: &WsMessage) {
    if let Ok(msg_str) = serde_json::to_string(msg) {
        let clients_lock = clients.read().await;
        for client in clients_lock.values() {
            if client.user_id == target_user_id {
                let _ = client.tx.send(msg_str.clone());
            }
        }
    }
}

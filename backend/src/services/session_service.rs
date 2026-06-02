use sqlx::PgPool;
use uuid::Uuid;

use crate::db::models::Session;
use crate::db::queries;
use crate::error::{AppError, AppResult};

pub async fn create_session(
    pool: &PgPool,
    initiator_id: Uuid,
    responder_id: Uuid,
    initiator_device_id: Uuid,
    responder_device_id: Uuid,
) -> AppResult<Session> {
    let initiator_device = queries::find_device_by_id(pool, initiator_device_id)
        .await?
        .ok_or(AppError::NotFound("Initiator device".to_string()))?;

    if initiator_device.user_id != initiator_id {
        return Err(AppError::ValidationError(
            "Device does not belong to initiator".to_string(),
        ));
    }

    let responder_device = queries::find_device_by_id(pool, responder_device_id)
        .await?
        .ok_or(AppError::NotFound("Responder device".to_string()))?;

    if responder_device.user_id != responder_id {
        return Err(AppError::ValidationError(
            "Device does not belong to responder".to_string(),
        ));
    }

    if !responder_device.is_online {
        return Err(AppError::ValidationError(
            "Responder device is offline".to_string(),
        ));
    }

    queries::create_session(
        pool,
        initiator_id,
        responder_id,
        initiator_device_id,
        responder_device_id,
    )
    .await
}

pub async fn get_session(pool: &PgPool, session_id: Uuid) -> AppResult<Session> {
    queries::find_session_by_id(pool, session_id)
        .await?
        .ok_or(AppError::NotFound("Session".to_string()))
}

pub async fn end_session(
    pool: &PgPool,
    session_id: Uuid,
    user_id: Uuid,
) -> AppResult<Session> {
    let session = queries::find_session_by_id(pool, session_id)
        .await?
        .ok_or(AppError::NotFound("Session".to_string()))?;

    if session.initiator_id != user_id && session.responder_id != user_id {
        return Err(AppError::AuthError(
            "Not authorized to end this session".to_string(),
        ));
    }

    queries::update_session_status(pool, session_id, "completed").await
}

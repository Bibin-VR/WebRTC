use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use super::models::{Device, RefreshToken, Session, User};
use crate::error::{AppError, AppResult};

// ── User Queries ──

pub async fn create_user(
    pool: &PgPool,
    email: &str,
    password_hash: &str,
    display_name: &str,
) -> AppResult<User> {
    let user = sqlx::query_as::<_, User>(
        r#"
        INSERT INTO users (email, password_hash, display_name)
        VALUES ($1, $2, $3)
        RETURNING id, email, password_hash, display_name, created_at, updated_at
        "#,
    )
    .bind(email)
    .bind(password_hash)
    .bind(display_name)
    .fetch_one(pool)
    .await
    .map_err(|e| match e {
        sqlx::Error::Database(ref db_err) if db_err.constraint() == Some("users_email_key") => {
            AppError::Conflict("Email already registered".to_string())
        }
        _ => AppError::DatabaseError(e),
    })?;

    Ok(user)
}

pub async fn find_user_by_email(pool: &PgPool, email: &str) -> AppResult<Option<User>> {
    let user = sqlx::query_as::<_, User>(
        "SELECT id, email, password_hash, display_name, created_at, updated_at FROM users WHERE email = $1",
    )
    .bind(email)
    .fetch_optional(pool)
    .await?;

    Ok(user)
}

pub async fn find_user_by_id(pool: &PgPool, user_id: Uuid) -> AppResult<Option<User>> {
    let user = sqlx::query_as::<_, User>(
        "SELECT id, email, password_hash, display_name, created_at, updated_at FROM users WHERE id = $1",
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?;

    Ok(user)
}

pub async fn update_user_display_name(
    pool: &PgPool,
    user_id: Uuid,
    display_name: &str,
) -> AppResult<User> {
    let user = sqlx::query_as::<_, User>(
        r#"
        UPDATE users SET display_name = $2, updated_at = NOW()
        WHERE id = $1
        RETURNING id, email, password_hash, display_name, created_at, updated_at
        "#,
    )
    .bind(user_id)
    .bind(display_name)
    .fetch_optional(pool)
    .await?
    .ok_or(AppError::NotFound("User".to_string()))?;

    Ok(user)
}

pub async fn search_users(pool: &PgPool, query: &str, limit: i64) -> AppResult<Vec<User>> {
    let pattern = format!("%{}%", query);
    let users = sqlx::query_as::<_, User>(
        r#"
        SELECT id, email, password_hash, display_name, created_at, updated_at
        FROM users
        WHERE display_name ILIKE $1 OR email ILIKE $1
        LIMIT $2
        "#,
    )
    .bind(&pattern)
    .bind(limit)
    .fetch_all(pool)
    .await?;

    Ok(users)
}

// ── Device Queries ──

pub async fn create_device(
    pool: &PgPool,
    user_id: Uuid,
    device_name: &str,
    device_type: &str,
    platform: &str,
) -> AppResult<Device> {
    let device = sqlx::query_as::<_, Device>(
        r#"
        INSERT INTO devices (user_id, device_name, device_type, platform, is_online)
        VALUES ($1, $2, $3, $4, true)
        RETURNING id, user_id, device_name, device_type, platform, last_seen, is_online, created_at
        "#,
    )
    .bind(user_id)
    .bind(device_name)
    .bind(device_type)
    .bind(platform)
    .fetch_one(pool)
    .await?;

    Ok(device)
}

pub async fn list_devices_by_user(pool: &PgPool, user_id: Uuid) -> AppResult<Vec<Device>> {
    let devices = sqlx::query_as::<_, Device>(
        "SELECT id, user_id, device_name, device_type, platform, last_seen, is_online, created_at FROM devices WHERE user_id = $1 ORDER BY created_at DESC",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    Ok(devices)
}

pub async fn find_device_by_id(pool: &PgPool, device_id: Uuid) -> AppResult<Option<Device>> {
    let device = sqlx::query_as::<_, Device>(
        "SELECT id, user_id, device_name, device_type, platform, last_seen, is_online, created_at FROM devices WHERE id = $1",
    )
    .bind(device_id)
    .fetch_optional(pool)
    .await?;

    Ok(device)
}

pub async fn update_device_name(
    pool: &PgPool,
    device_id: Uuid,
    user_id: Uuid,
    device_name: &str,
) -> AppResult<Device> {
    let device = sqlx::query_as::<_, Device>(
        r#"
        UPDATE devices SET device_name = $3
        WHERE id = $1 AND user_id = $2
        RETURNING id, user_id, device_name, device_type, platform, last_seen, is_online, created_at
        "#,
    )
    .bind(device_id)
    .bind(user_id)
    .bind(device_name)
    .fetch_optional(pool)
    .await?
    .ok_or(AppError::NotFound("Device".to_string()))?;

    Ok(device)
}

pub async fn delete_device(pool: &PgPool, device_id: Uuid, user_id: Uuid) -> AppResult<bool> {
    let result = sqlx::query("DELETE FROM devices WHERE id = $1 AND user_id = $2")
        .bind(device_id)
        .bind(user_id)
        .execute(pool)
        .await?;

    Ok(result.rows_affected() > 0)
}

pub async fn set_device_online(
    pool: &PgPool,
    device_id: Uuid,
    online: bool,
) -> AppResult<()> {
    sqlx::query("UPDATE devices SET is_online = $2, last_seen = NOW() WHERE id = $1")
        .bind(device_id)
        .bind(online)
        .execute(pool)
        .await?;

    Ok(())
}

// ── Session Queries ──

pub async fn create_session(
    pool: &PgPool,
    initiator_id: Uuid,
    responder_id: Uuid,
    initiator_device_id: Uuid,
    responder_device_id: Uuid,
) -> AppResult<Session> {
    let session = sqlx::query_as::<_, Session>(
        r#"
        INSERT INTO sessions (initiator_id, responder_id, initiator_device_id, responder_device_id, status)
        VALUES ($1, $2, $3, $4, 'pending')
        RETURNING id, initiator_id, responder_id, initiator_device_id, responder_device_id, started_at, ended_at, status, created_at
        "#,
    )
    .bind(initiator_id)
    .bind(responder_id)
    .bind(initiator_device_id)
    .bind(responder_device_id)
    .fetch_one(pool)
    .await?;

    Ok(session)
}

pub async fn find_session_by_id(pool: &PgPool, session_id: Uuid) -> AppResult<Option<Session>> {
    let session = sqlx::query_as::<_, Session>(
        "SELECT id, initiator_id, responder_id, initiator_device_id, responder_device_id, started_at, ended_at, status, created_at FROM sessions WHERE id = $1",
    )
    .bind(session_id)
    .fetch_optional(pool)
    .await?;

    Ok(session)
}

pub async fn update_session_status(
    pool: &PgPool,
    session_id: Uuid,
    status: &str,
) -> AppResult<Session> {
    let ended_at = if status == "completed" || status == "failed" {
        Some(Utc::now())
    } else {
        None
    };

    let session = sqlx::query_as::<_, Session>(
        r#"
        UPDATE sessions SET status = $2, ended_at = COALESCE($3, ended_at)
        WHERE id = $1
        RETURNING id, initiator_id, responder_id, initiator_device_id, responder_device_id, started_at, ended_at, status, created_at
        "#,
    )
    .bind(session_id)
    .bind(status)
    .bind(ended_at)
    .fetch_optional(pool)
    .await?
    .ok_or(AppError::NotFound("Session".to_string()))?;

    Ok(session)
}

// ── Refresh Token Queries ──

pub async fn store_refresh_token(
    pool: &PgPool,
    user_id: Uuid,
    token_hash: &str,
    expires_at: DateTime<Utc>,
) -> AppResult<RefreshToken> {
    let token = sqlx::query_as::<_, RefreshToken>(
        r#"
        INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
        VALUES ($1, $2, $3)
        RETURNING id, user_id, token_hash, expires_at, created_at
        "#,
    )
    .bind(user_id)
    .bind(token_hash)
    .bind(expires_at)
    .fetch_one(pool)
    .await?;

    Ok(token)
}

pub async fn find_refresh_token(
    pool: &PgPool,
    token_hash: &str,
) -> AppResult<Option<RefreshToken>> {
    let token = sqlx::query_as::<_, RefreshToken>(
        "SELECT id, user_id, token_hash, expires_at, created_at FROM refresh_tokens WHERE token_hash = $1 AND expires_at > NOW()",
    )
    .bind(token_hash)
    .fetch_optional(pool)
    .await?;

    Ok(token)
}

pub async fn delete_refresh_token(pool: &PgPool, token_hash: &str) -> AppResult<()> {
    sqlx::query("DELETE FROM refresh_tokens WHERE token_hash = $1")
        .bind(token_hash)
        .execute(pool)
        .await?;

    Ok(())
}

pub async fn delete_user_refresh_tokens(pool: &PgPool, user_id: Uuid) -> AppResult<()> {
    sqlx::query("DELETE FROM refresh_tokens WHERE user_id = $1")
        .bind(user_id)
        .execute(pool)
        .await?;

    Ok(())
}

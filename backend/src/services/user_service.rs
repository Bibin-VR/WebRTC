use sqlx::PgPool;
use uuid::Uuid;

use crate::db::models::{Device, UserPublic};
use crate::db::queries;
use crate::error::{AppError, AppResult};

pub async fn get_user_profile(pool: &PgPool, user_id: Uuid) -> AppResult<UserPublic> {
    let user = queries::find_user_by_id(pool, user_id)
        .await?
        .ok_or(AppError::NotFound("User".to_string()))?;

    Ok(user.into())
}

pub async fn update_profile(
    pool: &PgPool,
    user_id: Uuid,
    display_name: &str,
) -> AppResult<UserPublic> {
    let user = queries::update_user_display_name(pool, user_id, display_name).await?;
    Ok(user.into())
}

pub async fn search_users(
    pool: &PgPool,
    query: &str,
    limit: Option<i64>,
) -> AppResult<Vec<UserPublic>> {
    if query.len() < 2 {
        return Err(AppError::ValidationError(
            "Search query must be at least 2 characters".to_string(),
        ));
    }

    let limit = limit.unwrap_or(20).min(50);
    let users = queries::search_users(pool, query, limit).await?;
    Ok(users.into_iter().map(|u| u.into()).collect())
}

pub async fn get_user_with_devices(
    pool: &PgPool,
    user_id: Uuid,
) -> AppResult<(UserPublic, Vec<Device>)> {
    let user = queries::find_user_by_id(pool, user_id)
        .await?
        .ok_or(AppError::NotFound("User".to_string()))?;

    let devices = queries::list_devices_by_user(pool, user_id).await?;

    Ok((user.into(), devices))
}

use actix_web::{web, HttpResponse};
use serde::Deserialize;
use sqlx::PgPool;
use validator::Validate;

use crate::error::{AppError, AppResult};
use crate::services::auth_service::{self, JwtConfig};

#[derive(Debug, Deserialize, Validate)]
pub struct RegisterRequest {
    #[validate(email(message = "Invalid email format"))]
    pub email: String,
    #[validate(length(min = 8, message = "Password must be at least 8 characters"))]
    pub password: String,
    #[validate(length(min = 1, max = 255, message = "Display name is required"))]
    pub display_name: String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct LoginRequest {
    #[validate(email(message = "Invalid email format"))]
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct RefreshRequest {
    pub refresh_token: String,
}

#[derive(Debug, Deserialize)]
pub struct LogoutRequest {
    pub refresh_token: String,
}

pub async fn register(
    pool: web::Data<PgPool>,
    jwt_config: web::Data<JwtConfig>,
    body: web::Json<RegisterRequest>,
) -> AppResult<HttpResponse> {
    body.validate()
        .map_err(|e| AppError::ValidationError(e.to_string()))?;

    let (user, tokens) = auth_service::register(
        pool.get_ref(),
        &body.email,
        &body.password,
        &body.display_name,
        jwt_config.get_ref(),
    )
    .await?;

    Ok(HttpResponse::Created().json(serde_json::json!({
        "user_id": user.id,
        "email": user.email,
        "display_name": user.display_name,
        "access_token": tokens.access_token,
        "refresh_token": tokens.refresh_token,
        "token_type": tokens.token_type,
        "expires_in": tokens.expires_in
    })))
}

pub async fn login(
    pool: web::Data<PgPool>,
    jwt_config: web::Data<JwtConfig>,
    body: web::Json<LoginRequest>,
) -> AppResult<HttpResponse> {
    body.validate()
        .map_err(|e| AppError::ValidationError(e.to_string()))?;

    let (user, tokens) = auth_service::login(
        pool.get_ref(),
        &body.email,
        &body.password,
        jwt_config.get_ref(),
    )
    .await?;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "user_id": user.id,
        "email": user.email,
        "display_name": user.display_name,
        "access_token": tokens.access_token,
        "refresh_token": tokens.refresh_token,
        "token_type": tokens.token_type,
        "expires_in": tokens.expires_in
    })))
}

pub async fn refresh_token(
    pool: web::Data<PgPool>,
    jwt_config: web::Data<JwtConfig>,
    body: web::Json<RefreshRequest>,
) -> AppResult<HttpResponse> {
    let tokens = auth_service::refresh_access_token(
        pool.get_ref(),
        &body.refresh_token,
        jwt_config.get_ref(),
    )
    .await?;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "access_token": tokens.access_token,
        "refresh_token": tokens.refresh_token,
        "token_type": tokens.token_type,
        "expires_in": tokens.expires_in
    })))
}

pub async fn logout(
    pool: web::Data<PgPool>,
    body: web::Json<LogoutRequest>,
) -> AppResult<HttpResponse> {
    auth_service::logout(pool.get_ref(), &body.refresh_token).await?;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Logged out successfully"
    })))
}

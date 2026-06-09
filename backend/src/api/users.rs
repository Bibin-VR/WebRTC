use actix_web::{web, HttpRequest, HttpResponse};
use serde::Deserialize;
use sqlx::PgPool;

use crate::error::AppResult;
use crate::services::auth_service::JwtConfig;
use crate::services::user_service;

use super::middleware;

#[derive(Debug, Deserialize)]
pub struct UpdateProfileRequest {
    pub display_name: String,
}

#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub query: String,
    pub limit: Option<i64>,
}

pub async fn get_profile(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    jwt_config: web::Data<JwtConfig>,
) -> AppResult<HttpResponse> {
    let user_id = middleware::extract_user_id(&req, &jwt_config)?;
    let (user, devices) = user_service::get_user_with_devices(pool.get_ref(), user_id).await?;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "user_id": user.id,
        "email": user.email,
        "display_name": user.display_name,
        "created_at": user.created_at,
        "devices": devices
    })))
}

pub async fn update_profile(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    jwt_config: web::Data<JwtConfig>,
    body: web::Json<UpdateProfileRequest>,
) -> AppResult<HttpResponse> {
    let user_id = middleware::extract_user_id(&req, &jwt_config)?;
    let user = user_service::update_profile(pool.get_ref(), user_id, &body.display_name).await?;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "user_id": user.id,
        "email": user.email,
        "display_name": user.display_name
    })))
}

pub async fn search_users(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    jwt_config: web::Data<JwtConfig>,
    query: web::Query<SearchQuery>,
) -> AppResult<HttpResponse> {
    middleware::extract_user_id(&req, &jwt_config)?;

    let users = user_service::search_users(pool.get_ref(), &query.query, query.limit).await?;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "users": users
    })))
}

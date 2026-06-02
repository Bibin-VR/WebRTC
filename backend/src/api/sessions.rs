use actix_web::{web, HttpRequest, HttpResponse};
use serde::Deserialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppResult;
use crate::services::auth_service::JwtConfig;
use crate::services::session_service;

use super::middleware;

#[derive(Debug, Deserialize)]
pub struct CreateSessionRequest {
    pub target_user_id: Uuid,
    pub target_device_id: Uuid,
    pub initiator_device_id: Uuid,
}

pub async fn create_session(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    jwt_config: web::Data<JwtConfig>,
    body: web::Json<CreateSessionRequest>,
) -> AppResult<HttpResponse> {
    let user_id = middleware::extract_user_id(&req, &jwt_config)?;

    let session = session_service::create_session(
        pool.get_ref(),
        user_id,
        body.target_user_id,
        body.initiator_device_id,
        body.target_device_id,
    )
    .await?;

    Ok(HttpResponse::Created().json(session))
}

pub async fn get_session(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    jwt_config: web::Data<JwtConfig>,
    path: web::Path<Uuid>,
) -> AppResult<HttpResponse> {
    middleware::extract_user_id(&req, &jwt_config)?;

    let session_id = path.into_inner();
    let session = session_service::get_session(pool.get_ref(), session_id).await?;

    Ok(HttpResponse::Ok().json(session))
}

pub async fn end_session(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    jwt_config: web::Data<JwtConfig>,
    path: web::Path<Uuid>,
) -> AppResult<HttpResponse> {
    let user_id = middleware::extract_user_id(&req, &jwt_config)?;

    let session_id = path.into_inner();
    session_service::end_session(pool.get_ref(), session_id, user_id).await?;

    Ok(HttpResponse::NoContent().finish())
}

use actix_web::{web, HttpRequest, HttpResponse};
use serde::Deserialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::db::queries;
use crate::error::{AppError, AppResult};
use crate::services::auth_service::JwtConfig;

use super::middleware;

#[derive(Debug, Deserialize)]
pub struct RegisterDeviceRequest {
    pub device_name: String,
    pub device_type: String,
    pub platform: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateDeviceRequest {
    pub device_name: String,
}

pub async fn list_devices(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    jwt_config: web::Data<JwtConfig>,
) -> AppResult<HttpResponse> {
    let user_id = middleware::extract_user_id(&req, &jwt_config)?;
    let devices = queries::list_devices_by_user(pool.get_ref(), user_id).await?;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "devices": devices
    })))
}

pub async fn register_device(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    jwt_config: web::Data<JwtConfig>,
    body: web::Json<RegisterDeviceRequest>,
) -> AppResult<HttpResponse> {
    let user_id = middleware::extract_user_id(&req, &jwt_config)?;

    let valid_device_types = ["desktop", "laptop", "raspberrypi"];
    let valid_platforms = ["linux", "windows", "macos"];

    let device_type = body.device_type.to_lowercase();
    let platform = body.platform.to_lowercase();

    if !valid_device_types.contains(&device_type.as_str()) {
        return Err(AppError::ValidationError(format!(
            "Invalid device_type. Must be one of: {}",
            valid_device_types.join(", ")
        )));
    }

    if !valid_platforms.contains(&platform.as_str()) {
        return Err(AppError::ValidationError(format!(
            "Invalid platform. Must be one of: {}",
            valid_platforms.join(", ")
        )));
    }

    let device = queries::create_device(
        pool.get_ref(),
        user_id,
        &body.device_name,
        &device_type,
        &platform,
    )
    .await?;

    Ok(HttpResponse::Created().json(device))
}

pub async fn get_device(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    jwt_config: web::Data<JwtConfig>,
    path: web::Path<Uuid>,
) -> AppResult<HttpResponse> {
    let user_id = middleware::extract_user_id(&req, &jwt_config)?;
    let device_id = path.into_inner();

    let device = queries::find_device_by_id(pool.get_ref(), device_id)
        .await?
        .ok_or(AppError::NotFound("Device".to_string()))?;

    if device.user_id != user_id {
        return Err(AppError::NotFound("Device".to_string()));
    }

    Ok(HttpResponse::Ok().json(device))
}

pub async fn update_device(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    jwt_config: web::Data<JwtConfig>,
    path: web::Path<Uuid>,
    body: web::Json<UpdateDeviceRequest>,
) -> AppResult<HttpResponse> {
    let user_id = middleware::extract_user_id(&req, &jwt_config)?;
    let device_id = path.into_inner();

    let device =
        queries::update_device_name(pool.get_ref(), device_id, user_id, &body.device_name).await?;

    Ok(HttpResponse::Ok().json(device))
}

pub async fn delete_device(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    jwt_config: web::Data<JwtConfig>,
    path: web::Path<Uuid>,
) -> AppResult<HttpResponse> {
    let user_id = middleware::extract_user_id(&req, &jwt_config)?;
    let device_id = path.into_inner();

    let deleted = queries::delete_device(pool.get_ref(), device_id, user_id).await?;

    if !deleted {
        return Err(AppError::NotFound("Device".to_string()));
    }

    Ok(HttpResponse::NoContent().finish())
}

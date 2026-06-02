use actix_web::{web, HttpRequest};
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::services::auth_service::{Claims, JwtConfig};

pub fn extract_user_from_request(
    req: &HttpRequest,
    jwt_config: &web::Data<JwtConfig>,
) -> AppResult<Claims> {
    let auth_header = req
        .headers()
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .ok_or(AppError::AuthError(
            "Missing Authorization header".to_string(),
        ))?;

    let token = auth_header
        .strip_prefix("Bearer ")
        .ok_or(AppError::AuthError(
            "Invalid Authorization format".to_string(),
        ))?;

    let claims = crate::services::auth_service::validate_token(token, &jwt_config.secret)?;

    if claims.token_type != "access" {
        return Err(AppError::InvalidToken);
    }

    Ok(claims)
}

pub fn extract_user_id(req: &HttpRequest, jwt_config: &web::Data<JwtConfig>) -> AppResult<Uuid> {
    let claims = extract_user_from_request(req, jwt_config)?;
    Ok(claims.sub)
}

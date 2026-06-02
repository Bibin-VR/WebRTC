use actix_web::{HttpResponse, ResponseError};

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Authentication failed: {0}")]
    AuthError(String),

    #[error("Invalid credentials")]
    InvalidCredentials,

    #[error("Token expired")]
    TokenExpired,

    #[error("Invalid token")]
    InvalidToken,

    #[error("Resource not found: {0}")]
    NotFound(String),

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Database error: {0}")]
    DatabaseError(#[from] sqlx::Error),

    #[error("Internal server error")]
    InternalError,
}

impl ResponseError for AppError {
    fn error_response(&self) -> HttpResponse {
        let (status, error_code, message) = match self {
            AppError::AuthError(msg) => {
                (actix_web::http::StatusCode::UNAUTHORIZED, "AUTH_ERROR", msg.clone())
            }
            AppError::InvalidCredentials => (
                actix_web::http::StatusCode::UNAUTHORIZED,
                "AUTH_INVALID_CREDENTIALS",
                "Email or password incorrect".to_string(),
            ),
            AppError::TokenExpired => (
                actix_web::http::StatusCode::UNAUTHORIZED,
                "AUTH_EXPIRED_TOKEN",
                "Token has expired".to_string(),
            ),
            AppError::InvalidToken => (
                actix_web::http::StatusCode::UNAUTHORIZED,
                "AUTH_INVALID_TOKEN",
                "Invalid token".to_string(),
            ),
            AppError::NotFound(resource) => (
                actix_web::http::StatusCode::NOT_FOUND,
                "NOT_FOUND",
                format!("{} not found", resource),
            ),
            AppError::Conflict(msg) => {
                (actix_web::http::StatusCode::CONFLICT, "CONFLICT", msg.clone())
            }
            AppError::ValidationError(msg) => (
                actix_web::http::StatusCode::BAD_REQUEST,
                "VALIDATION_ERROR",
                msg.clone(),
            ),
            AppError::DatabaseError(_) => (
                actix_web::http::StatusCode::INTERNAL_SERVER_ERROR,
                "SERVER_ERROR",
                "Internal server error".to_string(),
            ),
            AppError::InternalError => (
                actix_web::http::StatusCode::INTERNAL_SERVER_ERROR,
                "SERVER_ERROR",
                "Internal server error".to_string(),
            ),
        };

        HttpResponse::build(status).json(serde_json::json!({
            "error": error_code,
            "message": message,
            "timestamp": chrono::Utc::now().to_rfc3339()
        }))
    }
}

pub type AppResult<T> = Result<T, AppError>;

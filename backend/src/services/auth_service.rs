use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use uuid::Uuid;

use crate::db::queries;
use crate::error::{AppError, AppResult};

#[derive(Debug, Clone)]
pub struct JwtConfig {
    pub secret: String,
    pub access_token_expiry_hours: i64,
    pub refresh_token_expiry_days: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: Uuid,
    pub email: String,
    pub exp: usize,
    pub iat: usize,
    pub token_type: String,
}

#[derive(Debug, Serialize)]
pub struct AuthTokens {
    pub access_token: String,
    pub refresh_token: String,
    pub token_type: String,
    pub expires_in: i64,
}

pub fn hash_password(password: &str) -> AppResult<String> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| AppError::AuthError(format!("Failed to hash password: {}", e)))?;

    Ok(hash.to_string())
}

pub fn verify_password(password: &str, hash: &str) -> AppResult<bool> {
    let parsed_hash = PasswordHash::new(hash)
        .map_err(|e| AppError::AuthError(format!("Invalid password hash: {}", e)))?;

    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok())
}

pub fn generate_access_token(user_id: Uuid, email: &str, config: &JwtConfig) -> AppResult<String> {
    let now = Utc::now();
    let exp = now + Duration::hours(config.access_token_expiry_hours);

    let claims = Claims {
        sub: user_id,
        email: email.to_string(),
        exp: exp.timestamp() as usize,
        iat: now.timestamp() as usize,
        token_type: "access".to_string(),
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(config.secret.as_bytes()),
    )
    .map_err(|e| AppError::AuthError(format!("Failed to generate token: {}", e)))
}

pub fn generate_refresh_token(user_id: Uuid, email: &str, config: &JwtConfig) -> AppResult<String> {
    let now = Utc::now();
    let exp = now + Duration::days(config.refresh_token_expiry_days);

    let claims = Claims {
        sub: user_id,
        email: email.to_string(),
        exp: exp.timestamp() as usize,
        iat: now.timestamp() as usize,
        token_type: "refresh".to_string(),
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(config.secret.as_bytes()),
    )
    .map_err(|e| AppError::AuthError(format!("Failed to generate refresh token: {}", e)))
}

pub fn validate_token(token: &str, secret: &str) -> AppResult<Claims> {
    let validation = Validation::default();

    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    )
    .map_err(|e| match e.kind() {
        jsonwebtoken::errors::ErrorKind::ExpiredSignature => AppError::TokenExpired,
        _ => AppError::InvalidToken,
    })?;

    Ok(token_data.claims)
}

fn hash_token(token: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    format!("{:x}", hasher.finalize())
}

pub async fn register(
    pool: &PgPool,
    email: &str,
    password: &str,
    display_name: &str,
    config: &JwtConfig,
) -> AppResult<(crate::db::models::UserPublic, AuthTokens)> {
    let password_hash = hash_password(password)?;
    let user = queries::create_user(pool, email, &password_hash, display_name).await?;

    let access_token = generate_access_token(user.id, &user.email, config)?;
    let refresh_token = generate_refresh_token(user.id, &user.email, config)?;

    let token_hash = hash_token(&refresh_token);
    let expires_at = Utc::now() + Duration::days(config.refresh_token_expiry_days);
    queries::store_refresh_token(pool, user.id, &token_hash, expires_at).await?;

    let tokens = AuthTokens {
        access_token,
        refresh_token,
        token_type: "Bearer".to_string(),
        expires_in: config.access_token_expiry_hours * 3600,
    };

    Ok((user.into(), tokens))
}

pub async fn login(
    pool: &PgPool,
    email: &str,
    password: &str,
    config: &JwtConfig,
) -> AppResult<(crate::db::models::UserPublic, AuthTokens)> {
    let user = queries::find_user_by_email(pool, email)
        .await?
        .ok_or(AppError::InvalidCredentials)?;

    if !verify_password(password, &user.password_hash)? {
        return Err(AppError::InvalidCredentials);
    }

    let access_token = generate_access_token(user.id, &user.email, config)?;
    let refresh_token = generate_refresh_token(user.id, &user.email, config)?;

    let token_hash = hash_token(&refresh_token);
    let expires_at = Utc::now() + Duration::days(config.refresh_token_expiry_days);
    queries::store_refresh_token(pool, user.id, &token_hash, expires_at).await?;

    let tokens = AuthTokens {
        access_token,
        refresh_token,
        token_type: "Bearer".to_string(),
        expires_in: config.access_token_expiry_hours * 3600,
    };

    Ok((user.into(), tokens))
}

pub async fn refresh_access_token(
    pool: &PgPool,
    refresh_token: &str,
    config: &JwtConfig,
) -> AppResult<AuthTokens> {
    let claims = validate_token(refresh_token, &config.secret)?;

    if claims.token_type != "refresh" {
        return Err(AppError::InvalidToken);
    }

    let token_hash = hash_token(refresh_token);
    let stored_token = queries::find_refresh_token(pool, &token_hash)
        .await?
        .ok_or(AppError::InvalidToken)?;

    queries::delete_refresh_token(pool, &token_hash).await?;

    let access_token = generate_access_token(claims.sub, &claims.email, config)?;
    let new_refresh_token = generate_refresh_token(claims.sub, &claims.email, config)?;

    let new_token_hash = hash_token(&new_refresh_token);
    let expires_at = Utc::now() + Duration::days(config.refresh_token_expiry_days);
    queries::store_refresh_token(pool, stored_token.user_id, &new_token_hash, expires_at).await?;

    Ok(AuthTokens {
        access_token,
        refresh_token: new_refresh_token,
        token_type: "Bearer".to_string(),
        expires_in: config.access_token_expiry_hours * 3600,
    })
}

pub async fn logout(pool: &PgPool, refresh_token: &str) -> AppResult<()> {
    let token_hash = hash_token(refresh_token);
    queries::delete_refresh_token(pool, &token_hash).await?;
    Ok(())
}

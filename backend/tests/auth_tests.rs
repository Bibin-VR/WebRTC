#[cfg(test)]
mod tests {
    use webrtc_backend::services::auth_service;

    #[test]
    fn test_password_hashing() {
        let password = "test_password_123";
        let hash = auth_service::hash_password(password).expect("Failed to hash password");

        assert!(!hash.is_empty());
        assert_ne!(hash, password);
    }

    #[test]
    fn test_password_verification() {
        let password = "test_password_123";
        let hash = auth_service::hash_password(password).expect("Failed to hash password");

        let is_valid =
            auth_service::verify_password(password, &hash).expect("Failed to verify password");
        assert!(is_valid);

        let wrong_password = "wrong_password";
        let is_invalid = auth_service::verify_password(wrong_password, &hash)
            .expect("Failed to verify password");
        assert!(!is_invalid);
    }

    #[test]
    fn test_token_generation_and_validation() {
        let config = auth_service::JwtConfig {
            secret: "test_secret_key_min_32_characters".to_string(),
            access_token_expiry_hours: 1,
            refresh_token_expiry_days: 7,
        };

        let user_id = uuid::Uuid::new_v4();
        let email = "test@example.com";

        let token = auth_service::generate_access_token(user_id, email, &config)
            .expect("Failed to generate token");
        assert!(!token.is_empty());

        let claims =
            auth_service::validate_token(&token, &config.secret).expect("Failed to validate token");
        assert_eq!(claims.sub, user_id);
        assert_eq!(claims.email, email);
        assert_eq!(claims.token_type, "access");
    }

    #[test]
    fn test_refresh_token_generation() {
        let config = auth_service::JwtConfig {
            secret: "test_secret_key_min_32_characters".to_string(),
            access_token_expiry_hours: 1,
            refresh_token_expiry_days: 7,
        };

        let user_id = uuid::Uuid::new_v4();
        let email = "test@example.com";

        let token = auth_service::generate_refresh_token(user_id, email, &config)
            .expect("Failed to generate refresh token");
        assert!(!token.is_empty());

        let claims =
            auth_service::validate_token(&token, &config.secret).expect("Failed to validate token");
        assert_eq!(claims.token_type, "refresh");
    }

    #[test]
    fn test_invalid_token_rejection() {
        let config = auth_service::JwtConfig {
            secret: "test_secret_key_min_32_characters".to_string(),
            access_token_expiry_hours: 1,
            refresh_token_expiry_days: 7,
        };

        let invalid_token = "invalid.token.here";
        let result = auth_service::validate_token(invalid_token, &config.secret);
        assert!(result.is_err());
    }

    #[test]
    fn test_token_with_wrong_secret() {
        let config = auth_service::JwtConfig {
            secret: "original_secret_key_min_32_chars".to_string(),
            access_token_expiry_hours: 1,
            refresh_token_expiry_days: 7,
        };

        let user_id = uuid::Uuid::new_v4();
        let email = "test@example.com";

        let token = auth_service::generate_access_token(user_id, email, &config)
            .expect("Failed to generate token");

        let wrong_secret = "different_secret_key_min_32_char";
        let result = auth_service::validate_token(&token, wrong_secret);
        assert!(result.is_err());
    }
}

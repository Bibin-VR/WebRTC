pub struct AppConfig {
    pub database_url: String,
    pub database_pool_size: u32,
    pub jwt_secret: String,
    pub jwt_expiry_hours: i64,
    pub refresh_token_expiry_days: i64,
    pub server_host: String,
    pub server_port: u16,
    pub cors_origin: String,
}

impl AppConfig {
    pub fn from_env() -> Self {
        Self {
            database_url: std::env::var("DATABASE_URL").expect("DATABASE_URL must be set"),
            database_pool_size: std::env::var("DATABASE_POOL_SIZE")
                .unwrap_or_else(|_| "10".to_string())
                .parse()
                .expect("DATABASE_POOL_SIZE must be a number"),
            jwt_secret: std::env::var("JWT_SECRET").expect("JWT_SECRET must be set"),
            jwt_expiry_hours: std::env::var("JWT_EXPIRY_HOURS")
                .unwrap_or_else(|_| "1".to_string())
                .parse()
                .expect("JWT_EXPIRY_HOURS must be a number"),
            refresh_token_expiry_days: std::env::var("REFRESH_TOKEN_EXPIRY_DAYS")
                .unwrap_or_else(|_| "7".to_string())
                .parse()
                .expect("REFRESH_TOKEN_EXPIRY_DAYS must be a number"),
            server_host: std::env::var("SERVER_HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
            server_port: std::env::var("SERVER_PORT")
                .unwrap_or_else(|_| "8080".to_string())
                .parse()
                .expect("SERVER_PORT must be a number"),
            cors_origin: std::env::var("CORS_ORIGIN")
                .unwrap_or_else(|_| "http://localhost:3000".to_string()),
        }
    }
}

use actix_cors::Cors;
use actix_web::{web, App, HttpResponse, HttpServer};
use sqlx::postgres::PgPoolOptions;
use tracing_actix_web::TracingLogger;

mod api;
mod config;
mod db;
mod error;
mod services;
mod ws;

async fn health_check() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "ok",
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,webrtc_backend=debug".into()),
        )
        .json()
        .init();

    let config = config::AppConfig::from_env();

    tracing::info!(
        "Starting WebRTC backend on {}:{}",
        config.server_host,
        config.server_port
    );

    let pool = PgPoolOptions::new()
        .max_connections(config.database_pool_size)
        .connect(&config.database_url)
        .await
        .expect("Failed to connect to PostgreSQL");

    tracing::info!("Connected to PostgreSQL");

    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed to run database migrations");

    tracing::info!("Database migrations applied");

    let jwt_config = web::Data::new(services::auth_service::JwtConfig {
        secret: config.jwt_secret.clone(),
        access_token_expiry_hours: config.jwt_expiry_hours,
        refresh_token_expiry_days: config.refresh_token_expiry_days,
    });

    let ws_state = web::Data::new(ws::WsState::new());

    let bind_addr = format!("{}:{}", config.server_host, config.server_port);
    let cors_origin = config.cors_origin.clone();

    HttpServer::new(move || {
        let cors = Cors::default()
            .allowed_origin(&cors_origin)
            .allowed_methods(vec!["GET", "POST", "PUT", "DELETE", "OPTIONS"])
            .allowed_headers(vec![
                actix_web::http::header::AUTHORIZATION,
                actix_web::http::header::CONTENT_TYPE,
                actix_web::http::header::ACCEPT,
            ])
            .supports_credentials()
            .max_age(3600);

        App::new()
            .wrap(TracingLogger::default())
            .wrap(cors)
            .app_data(web::Data::new(pool.clone()))
            .app_data(jwt_config.clone())
            .app_data(ws_state.clone())
            .route("/health", web::get().to(health_check))
            .route("/ready", web::get().to(health_check))
            .configure(api::configure_routes)
            .route("/ws", web::get().to(ws::ws_handler))
    })
    .bind(&bind_addr)?
    .run()
    .await
}

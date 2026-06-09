pub mod auth;
pub mod devices;
pub mod middleware;
pub mod sessions;
pub mod users;

use actix_web::web;

pub fn configure_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/auth")
            .route("/register", web::post().to(auth::register))
            .route("/login", web::post().to(auth::login))
            .route("/refresh", web::post().to(auth::refresh_token))
            .route("/logout", web::post().to(auth::logout)),
    )
    .service(
        web::scope("/users")
            .route("/me", web::get().to(users::get_profile))
            .route("/me", web::put().to(users::update_profile))
            .route("/search", web::get().to(users::search_users)),
    )
    .service(
        web::scope("/devices")
            .route("", web::get().to(devices::list_devices))
            .route("/register", web::post().to(devices::register_device))
            .route("/{device_id}", web::get().to(devices::get_device))
            .route("/{device_id}", web::put().to(devices::update_device))
            .route("/{device_id}", web::delete().to(devices::delete_device)),
    )
    .service(
        web::scope("/sessions")
            .route("", web::post().to(sessions::create_session))
            .route("/{session_id}", web::get().to(sessions::get_session))
            .route("/{session_id}", web::delete().to(sessions::end_session)),
    );
}

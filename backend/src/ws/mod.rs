pub mod handlers;
pub mod signaling;

use actix_web::{web, HttpRequest, HttpResponse};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::services::auth_service::JwtConfig;

pub type ConnectedClients = Arc<RwLock<HashMap<Uuid, ClientConnection>>>;

#[derive(Debug, Clone)]
pub struct ClientConnection {
    pub user_id: Uuid,
    #[allow(dead_code)]
    pub device_id: Option<Uuid>,
    pub display_name: String,
    pub tx: tokio::sync::mpsc::UnboundedSender<String>,
}

pub struct WsState {
    pub clients: ConnectedClients,
}

impl WsState {
    pub fn new() -> Self {
        Self {
            clients: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}

impl Default for WsState {
    fn default() -> Self {
        Self::new()
    }
}

pub async fn ws_handler(
    req: HttpRequest,
    body: web::Payload,
    ws_state: web::Data<WsState>,
    jwt_config: web::Data<JwtConfig>,
    pool: web::Data<sqlx::PgPool>,
) -> Result<HttpResponse, actix_web::Error> {
    let (response, session, stream) = actix_ws::handle(&req, body)?;

    let clients = ws_state.clients.clone();
    let jwt_secret = jwt_config.secret.clone();
    let db_pool = pool.get_ref().clone();

    actix_rt::spawn(handlers::handle_ws_connection(
        session, stream, clients, jwt_secret, db_pool,
    ));

    Ok(response)
}

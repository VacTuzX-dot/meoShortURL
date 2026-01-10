use axum::{
    routing::{delete, get, patch, post},
    Router,
};
use std::{net::SocketAddr, sync::Arc};
use tower_http::{
    cors::{Any, CorsLayer},
    services::ServeDir,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod db;
mod handlers;
mod models;
mod session;

use db::Database;

#[derive(Clone)]
pub struct AppState {
    pub db: Database,
    pub base_url: String,
    pub discord_client_id: String,
    pub discord_client_secret: String,
    pub discord_redirect_uri: String,
}

#[tokio::main]
async fn main() {
    // Load env
    dotenvy::dotenv().ok();

    // Initialize tracing
    tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Config from env
    let port: u16 = std::env::var("PORT")
        .unwrap_or_else(|_| "3006".to_string())
        .parse()
        .expect("PORT must be a number");

    let db_path = std::env::var("DB_PATH").unwrap_or_else(|_| "data/urls.sqlite".to_string());
    let base_url = std::env::var("BASE_URL").unwrap_or_else(|_| "http://localhost:3006".to_string());
    let discord_client_id = std::env::var("DISCORD_CLIENT_ID").unwrap_or_default();
    let discord_client_secret = std::env::var("DISCORD_CLIENT_SECRET").unwrap_or_default();
    let discord_redirect_uri = std::env::var("DISCORD_REDIRECT_URI").unwrap_or_default();

    // Initialize database
    let db = Database::new(&db_path).await.expect("Failed to connect to database");

    let state = Arc::new(AppState {
        db,
        base_url,
        discord_client_id,
        discord_client_secret,
        discord_redirect_uri,
    });

    // Build router
    let app = Router::new()
        // API routes
        .route("/shorten", post(handlers::shorten::create_short_url))
        // Admin API
        .route("/api/admin/urls", get(handlers::admin::list_urls))
        .route("/api/admin/urls/:id", delete(handlers::admin::delete_url))
        .route("/api/admin/urls/:id", patch(handlers::admin::update_url))
        .route("/api/admin/me", get(handlers::admin::get_me))
        // Auth routes
        .route("/auth/discord", get(handlers::auth::discord_redirect))
        .route("/auth/discord/callback", get(handlers::auth::discord_callback))
        .route("/auth/logout", get(handlers::auth::logout))
        // Redirect route
        .route("/:slug", get(handlers::redirect::handle_redirect))
        // Static files fallback
        .fallback_service(ServeDir::new("dist").fallback(ServeDir::new("dist").append_index_html_on_directories(true)))
        .layer(CorsLayer::new().allow_origin(Any).allow_methods(Any).allow_headers(Any))
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("🦀 Server running at http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

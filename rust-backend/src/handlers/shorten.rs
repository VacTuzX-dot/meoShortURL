use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use rand::Rng;
use std::sync::Arc;

use crate::{
    models::{CreateUrlRequest, CreateUrlResponse},
    AppState,
};

fn generate_slug(length: usize) -> String {
    const CHARS: &[u8] = b"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let mut rng = rand::thread_rng();
    (0..length)
        .map(|_| CHARS[rng.gen_range(0..CHARS.len())] as char)
        .collect()
}

pub async fn create_short_url(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateUrlRequest>,
) -> impl IntoResponse {
    if payload.url.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "URL is required"})),
        );
    }

    let is_custom_slug = payload.custom_slug.is_some();
    let mut slug = payload.custom_slug.clone().unwrap_or_else(|| generate_slug(6));
    slug = slug.trim().to_string();

    let expires_at = payload.expires_at.as_deref();
    const MAX_RETRIES: u32 = 5;

    // Try to insert, retry on UNIQUE constraint violation (for auto-generated slugs only)
    for attempt in 0..MAX_RETRIES {
        match state.db.insert_url(&slug, &payload.url, expires_at).await {
            Ok(()) => {
                // Success! Return the response
                let response = CreateUrlResponse {
                    success: true,
                    short_url: format!("{}/{}", state.base_url, slug),
                    slug: slug.clone(),
                    original_url: payload.url,
                    expires_at: payload.expires_at,
                };
                return (StatusCode::OK, Json(serde_json::to_value(response).unwrap()));
            }
            Err(sqlx::Error::Database(db_err)) if db_err.is_unique_violation() => {
                if is_custom_slug {
                    // Custom slug collision - return conflict error
                    return (
                        StatusCode::CONFLICT,
                        Json(serde_json::json!({"error": "Slug already exists"})),
                    );
                }
                // Auto-generated slug collision - retry with new slug
                if attempt < MAX_RETRIES - 1 {
                    slug = generate_slug(6);
                }
            }
            Err(_) => {
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({"error": "Database error"})),
                );
            }
        }
    }

    // All retries exhausted
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(serde_json::json!({"error": "Failed to generate unique slug"})),
    )
}

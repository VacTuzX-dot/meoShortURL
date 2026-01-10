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

    let mut slug = payload.custom_slug.clone().unwrap_or_else(|| generate_slug(6));
    slug = slug.trim().to_string();

    // Check if custom slug exists
    if payload.custom_slug.is_some() {
        match state.db.check_slug_exists(&slug).await {
            Ok(true) => {
                return (
                    StatusCode::CONFLICT,
                    Json(serde_json::json!({"error": "Slug already exists"})),
                );
            }
            Ok(false) => {}
            Err(_) => {
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({"error": "Database error"})),
                );
            }
        }
    } else {
        // Ensure generated slug is unique
        let mut retries = 5;
        while retries > 0 {
            match state.db.check_slug_exists(&slug).await {
                Ok(true) => {
                    slug = generate_slug(6);
                    retries -= 1;
                }
                Ok(false) => break,
                Err(_) => {
                    return (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(serde_json::json!({"error": "Database error"})),
                    );
                }
            }
        }
        if retries == 0 {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Failed to generate unique slug"})),
            );
        }
    }

    // Insert into database
    let expires_at = payload.expires_at.as_deref();
    if let Err(_) = state.db.insert_url(&slug, &payload.url, expires_at).await {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Database error"})),
        );
    }

    let response = CreateUrlResponse {
        success: true,
        short_url: format!("{}/{}", state.base_url, slug),
        slug: slug.clone(),
        original_url: payload.url,
        expires_at: payload.expires_at,
    };

    (StatusCode::OK, Json(serde_json::to_value(response).unwrap()))
}

use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use std::sync::Arc;

use crate::{
    models::{MeResponse, SuccessResponse, UpdateUrlRequest},
    session::extract_session_from_cookie,
    AppState,
};

pub async fn list_urls(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    match state.db.get_all_urls().await {
        Ok(urls) => (StatusCode::OK, Json(serde_json::to_value(urls).unwrap())),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Database error"})),
        ),
    }
}

pub async fn delete_url(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> impl IntoResponse {
    match state.db.delete_url(id).await {
        Ok(_) => (
            StatusCode::OK,
            Json(serde_json::to_value(SuccessResponse { success: true }).unwrap()),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Database error"})),
        ),
    }
}

pub async fn update_url(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
    Json(payload): Json<UpdateUrlRequest>,
) -> impl IntoResponse {
    match state.db.update_expiry(id, payload.expires_at.as_deref()).await {
        Ok(_) => (
            StatusCode::OK,
            Json(serde_json::to_value(SuccessResponse { success: true }).unwrap()),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Database error"})),
        ),
    }
}

pub async fn get_me(headers: HeaderMap) -> impl IntoResponse {
    let cookie_header = headers
        .get("cookie")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    match extract_session_from_cookie(cookie_header) {
        Some(user) => (
            StatusCode::OK,
            Json(serde_json::to_value(MeResponse { user }).unwrap()),
        ),
        None => (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error": "Unauthorized"})),
        ),
    }
}

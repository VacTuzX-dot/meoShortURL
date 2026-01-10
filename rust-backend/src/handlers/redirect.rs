use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Redirect, Response},
};
use std::sync::Arc;

use crate::AppState;

pub async fn handle_redirect(
    State(state): State<Arc<AppState>>,
    Path(slug): Path<String>,
) -> Response {
    // Ignore requests with file extensions (static assets)
    if slug.contains('.') {
        return StatusCode::NOT_FOUND.into_response();
    }

    // Reserved paths for SPA routing - serve index.html
    let reserved_paths = ["dashboard", "login", "logout"];
    if reserved_paths.contains(&slug.as_str()) {
        // Return the index.html file for SPA routes
        return match tokio::fs::read("dist/index.html").await {
            Ok(content) => (
                StatusCode::OK,
                [("content-type", "text/html")],
                content,
            )
                .into_response(),
            Err(_) => StatusCode::NOT_FOUND.into_response(),
        };
    }

    // Look up slug in database
    let record = match state.db.get_by_slug(&slug).await {
        Ok(Some(record)) => record,
        Ok(None) => {
            return (StatusCode::NOT_FOUND, "URL not found").into_response();
        }
        Err(_) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response();
        }
    };

    // Check expiration
    if let Some(expires_at) = &record.expires_at {
        if let Ok(expiry) = chrono::DateTime::parse_from_rfc3339(expires_at) {
            if expiry < chrono::Utc::now() {
                return (StatusCode::GONE, "URL has expired").into_response();
            }
        }
    }

    // Increment click count (fire and forget)
    let db = state.db.clone();
    let slug_clone = slug.clone();
    tokio::spawn(async move {
        let _ = db.increment_clicks(&slug_clone).await;
    });

    // Redirect to original URL
    Redirect::temporary(&record.original_url).into_response()
}

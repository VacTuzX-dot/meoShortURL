use axum::{
    extract::{Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Redirect, Response},
};
use std::sync::Arc;

use crate::{
    models::{CallbackQuery, DiscordTokenResponse, DiscordUser},
    session::{encode_session, SESSION_COOKIE},
    AppState,
};

pub async fn discord_redirect(State(state): State<Arc<AppState>>) -> Response {
    if state.discord_client_id.is_empty() || state.discord_redirect_uri.is_empty() {
        return (StatusCode::INTERNAL_SERVER_ERROR, "Discord Env Missing").into_response();
    }

    let url = format!(
        "https://discord.com/api/oauth2/authorize?client_id={}&redirect_uri={}&response_type=code&scope=identify",
        state.discord_client_id,
        urlencoding::encode(&state.discord_redirect_uri)
    );

    Redirect::temporary(&url).into_response()
}

pub async fn discord_callback(
    State(state): State<Arc<AppState>>,
    Query(query): Query<CallbackQuery>,
) -> Response {
    let code = match query.code {
        Some(code) => code,
        None => return (StatusCode::BAD_REQUEST, "No code").into_response(),
    };

    // Exchange code for token
    let client = reqwest::Client::new();
    let token_response = client
        .post("https://discord.com/api/oauth2/token")
        .header("Content-Type", "application/x-www-form-urlencoded")
        .form(&[
            ("client_id", state.discord_client_id.as_str()),
            ("client_secret", state.discord_client_secret.as_str()),
            ("grant_type", "authorization_code"),
            ("code", &code),
            ("redirect_uri", state.discord_redirect_uri.as_str()),
        ])
        .send()
        .await;

    let token_data: DiscordTokenResponse = match token_response {
        Ok(res) if res.status().is_success() => match res.json().await {
            Ok(data) => data,
            Err(e) => {
                tracing::error!("Failed to parse token response: {}", e);
                return (StatusCode::INTERNAL_SERVER_ERROR, "Auth Failed").into_response();
            }
        },
        Ok(res) => {
            let text = res.text().await.unwrap_or_default();
            tracing::error!("Token exchange failed: {}", text);
            return (StatusCode::INTERNAL_SERVER_ERROR, "Auth Failed").into_response();
        }
        Err(e) => {
            tracing::error!("Token request failed: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, "Auth Failed").into_response();
        }
    };

    // Get user info from Discord
    let user_response = client
        .get("https://discord.com/api/users/@me")
        .header("Authorization", format!("Bearer {}", token_data.access_token))
        .send()
        .await;

    let user_data: DiscordUser = match user_response {
        Ok(res) if res.status().is_success() => match res.json().await {
            Ok(data) => data,
            Err(e) => {
                tracing::error!("Failed to parse user response: {}", e);
                return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to get user info").into_response();
            }
        },
        Ok(res) => {
            let text = res.text().await.unwrap_or_default();
            tracing::error!("User fetch failed: {}", text);
            return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to get user info").into_response();
        }
        Err(e) => {
            tracing::error!("User request failed: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to get user info").into_response();
        }
    };

    // Create session cookie
    let session_value = encode_session(&user_data);
    let is_production = state.base_url.starts_with("https");
    let cookie = format!(
        "{}={}; Path=/; HttpOnly;{} SameSite=Lax; Max-Age={}",
        SESSION_COOKIE,
        session_value,
        if is_production { " Secure;" } else { "" },
        60 * 60 * 24 * 7 // 7 days
    );

    // Redirect with Set-Cookie header
    Response::builder()
        .status(StatusCode::FOUND)
        .header(header::LOCATION, format!("{}/dashboard", state.base_url))
        .header(header::SET_COOKIE, cookie)
        .body(axum::body::Body::empty())
        .unwrap()
}

pub async fn logout(State(state): State<Arc<AppState>>) -> Response {
    // Clear cookie by setting expired
    let cookie = format!(
        "{}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
        SESSION_COOKIE
    );

    Response::builder()
        .status(StatusCode::FOUND)
        .header(header::LOCATION, format!("{}/", state.base_url))
        .header(header::SET_COOKIE, cookie)
        .body(axum::body::Body::empty())
        .unwrap()
}

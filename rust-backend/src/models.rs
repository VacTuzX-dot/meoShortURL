use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct UrlRecord {
    pub id: i64,
    pub slug: String,
    pub original_url: String,
    pub created_at: String,
    pub clicks: i64,
    pub expires_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscordUser {
    pub id: String,
    pub username: String,
    pub avatar: Option<String>,
}

// Request/Response DTOs

#[derive(Debug, Deserialize)]
pub struct CreateUrlRequest {
    pub url: String,
    #[serde(rename = "customSlug")]
    pub custom_slug: Option<String>,
    #[serde(rename = "expiresAt")]
    pub expires_at: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CreateUrlResponse {
    pub success: bool,
    pub short_url: String,
    pub slug: String,
    pub original_url: String,
    pub expires_at: Option<String>,
}

#[derive(Debug, Serialize)]
#[allow(dead_code)]
pub struct ErrorResponse {
    pub error: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateUrlRequest {
    pub expires_at: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SuccessResponse {
    pub success: bool,
}

#[derive(Debug, Serialize)]
pub struct MeResponse {
    pub user: DiscordUser,
}

#[derive(Debug, Deserialize)]
pub struct DiscordTokenResponse {
    pub access_token: String,
}

#[derive(Debug, Deserialize)]
pub struct CallbackQuery {
    pub code: Option<String>,
}

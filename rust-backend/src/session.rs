use crate::models::DiscordUser;
use base64::{engine::general_purpose::STANDARD, Engine};

pub const SESSION_COOKIE: &str = "meo_session";

pub fn encode_session(user: &DiscordUser) -> String {
    let json = serde_json::to_string(user).unwrap_or_default();
    STANDARD.encode(json.as_bytes())
}

pub fn decode_session(cookie: &str) -> Option<DiscordUser> {
    let bytes = STANDARD.decode(cookie).ok()?;
    let json = String::from_utf8(bytes).ok()?;
    serde_json::from_str(&json).ok()
}

pub fn extract_session_from_cookie(cookie_header: &str) -> Option<DiscordUser> {
    for cookie in cookie_header.split("; ") {
        let mut parts = cookie.splitn(2, '=');
        if let (Some(key), Some(value)) = (parts.next(), parts.next()) {
            if key == SESSION_COOKIE {
                return decode_session(value);
            }
        }
    }
    None
}

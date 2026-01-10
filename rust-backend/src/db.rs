use sqlx::{sqlite::SqlitePoolOptions, Pool, Sqlite};

#[derive(Clone)]
pub struct Database {
    pool: Pool<Sqlite>,
}

impl Database {
    pub async fn new(db_path: &str) -> Result<Self, sqlx::Error> {
        // Create directory if not exists
        if let Some(parent) = std::path::Path::new(db_path).parent() {
            std::fs::create_dir_all(parent).ok();
        }

        let connection_string = format!("sqlite:{}?mode=rwc", db_path);
        
        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect(&connection_string)
            .await?;

        // Initialize tables
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS urls (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                slug TEXT UNIQUE NOT NULL,
                original_url TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                clicks INTEGER DEFAULT 0,
                expires_at DATETIME
            )
            "#,
        )
        .execute(&pool)
        .await?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_urls_slug ON urls(slug)")
            .execute(&pool)
            .await?;

        Ok(Self { pool })
    }

    pub async fn get_by_slug(&self, slug: &str) -> Result<Option<crate::models::UrlRecord>, sqlx::Error> {
        sqlx::query_as::<_, crate::models::UrlRecord>("SELECT * FROM urls WHERE slug = ?")
            .bind(slug)
            .fetch_optional(&self.pool)
            .await
    }

    pub async fn check_slug_exists(&self, slug: &str) -> Result<bool, sqlx::Error> {
        let result: Option<(i64,)> = sqlx::query_as("SELECT id FROM urls WHERE slug = ?")
            .bind(slug)
            .fetch_optional(&self.pool)
            .await?;
        Ok(result.is_some())
    }

    pub async fn insert_url(
        &self,
        slug: &str,
        original_url: &str,
        expires_at: Option<&str>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query("INSERT INTO urls (slug, original_url, expires_at) VALUES (?, ?, ?)")
            .bind(slug)
            .bind(original_url)
            .bind(expires_at)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn increment_clicks(&self, slug: &str) -> Result<(), sqlx::Error> {
        sqlx::query("UPDATE urls SET clicks = clicks + 1 WHERE slug = ?")
            .bind(slug)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn get_all_urls(&self) -> Result<Vec<crate::models::UrlRecord>, sqlx::Error> {
        sqlx::query_as::<_, crate::models::UrlRecord>(
            "SELECT * FROM urls ORDER BY created_at DESC",
        )
        .fetch_all(&self.pool)
        .await
    }

    pub async fn delete_url(&self, id: i64) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM urls WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn update_expiry(&self, id: i64, expires_at: Option<&str>) -> Result<(), sqlx::Error> {
        sqlx::query("UPDATE urls SET expires_at = ? WHERE id = ?")
            .bind(expires_at)
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}

import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { Database } from "bun:sqlite";
import { join } from "path";

// --- Database Setup ---
const DB_PATH = process.env.DB_PATH || "data/urls.sqlite";
const db = new Database(DB_PATH, { create: true });

// Initialize tables
db.run(`
  CREATE TABLE IF NOT EXISTS urls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    original_url TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    clicks INTEGER DEFAULT 0,
    expires_at DATETIME
  )
`);

// --- Types ---
interface UrlRecord {
  id: number;
  slug: string;
  original_url: string;
  created_at: string;
  clicks: number;
  expires_at: string | null;
}

// --- Helper Functions ---
function generateSlug(length = 6): string {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let slug = "";
  for (let i = 0; i < length; i++) {
    slug += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return slug;
}

const DIST_DIR = join(import.meta.dir, "..", "dist");

// --- App Setup ---
const app = new Elysia()
  .use(cors())
  // Serve static assets from dist/assets
  .get("/assets/*", ({ params }) => {
    const filePath = join(DIST_DIR, "assets", params["*"]);
    return Bun.file(filePath);
  })
  // API Routes
  .group("/shorten", (app) =>
    app.post("/", ({ body, set }) => {
      const { url, customSlug, expiresAt } = body as {
        url: string;
        customSlug?: string;
        expiresAt?: string;
      };

      if (!url) {
        set.status = 400;
        return { error: "URL is required" };
      }

      let slug = customSlug?.trim() || generateSlug();

      // If custom slug is provided, check if it exists
      if (customSlug) {
        const existing = db
          .query("SELECT id FROM urls WHERE slug = ?")
          .get(slug);
        if (existing) {
          set.status = 409;
          return { error: "Slug already exists" };
        }
      } else {
        // Ensure generated slug is unique
        let retries = 5;
        while (
          db.query("SELECT id FROM urls WHERE slug = ?").get(slug) &&
          retries > 0
        ) {
          slug = generateSlug();
          retries--;
        }
        if (retries === 0) {
          set.status = 500;
          return { error: "Failed to generate unique slug" };
        }
      }

      try {
        db.run(
          "INSERT INTO urls (slug, original_url, expires_at) VALUES (?, ?, ?)",
          [slug, url, expiresAt || null]
        );

        return {
          success: true,
          short_url: `${
            process.env.BASE_URL || "http://localhost:3000"
          }/${slug}`,
          slug,
          original_url: url,
          expires_at: expiresAt || null,
        };
      } catch (err) {
        console.error("Database insert error:", err);
        set.status = 500;
        return { error: "Database error" };
      }
    })
  )

  // Admin API Group
  .group("/api/admin", (app) =>
    app
      // Auth Middleware (Mock for now, real implementation below)
      .derive(() => {
        // Build this correctly with Discord OAuth
        // For now, if we are in dev/test, maybe relax?
        // But user wants Discord Auth.
        return {};
      })
      .get("/urls", () => {
        return db.query("SELECT * FROM urls ORDER BY created_at DESC").all();
      })
      .delete("/urls/:id", ({ params }) => {
        db.run("DELETE FROM urls WHERE id = ?", [params.id]);
        return { success: true };
      })
      .patch("/urls/:id", ({ params, body }) => {
        const { expires_at } = body as { expires_at: string | null };
        db.run("UPDATE urls SET expires_at = ? WHERE id = ?", [
          expires_at,
          params.id,
        ]);
        return { success: true };
      })
      // Auth Check Endpoint
      .get("/me", ({ set }) => {
        // TODO: check session
        // For now simulated unauth so frontend shows login button
        set.status = 401;
        return { error: "Unauthorized" };
      })
  )

  // Auth Routes
  .group("/auth", (app) =>
    app
      .get("/discord", () => {
        const clientId = process.env.DISCORD_CLIENT_ID;
        const redirectUri = process.env.DISCORD_REDIRECT_URI;
        if (!clientId || !redirectUri) {
          return new Response("Discord Env Missing", { status: 500 });
        }
        const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
          redirectUri
        )}&response_type=code&scope=identify`;
        return Response.redirect(url, 302);
      })
      .get("/discord/callback", async ({ query }) => {
        const { code } = query;
        if (!code) return new Response("No code", { status: 400 });

        // Exchange code for token
        try {
          const tokenResponse = await fetch(
            "https://discord.com/api/oauth2/token",
            {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({
                client_id: process.env.DISCORD_CLIENT_ID!,
                client_secret: process.env.DISCORD_CLIENT_SECRET!,
                grant_type: "authorization_code",
                code: code as string,
                redirect_uri: process.env.DISCORD_REDIRECT_URI!,
              }),
            }
          );

          if (!tokenResponse.ok) {
            console.error("Token exchange failed:", await tokenResponse.text());
            return new Response("Auth Failed", { status: 500 });
          }

          await tokenResponse.json();
          // TODO: Get User info and set session

          const baseUrl = process.env.BASE_URL || "https://short.meo.in.th";
          return Response.redirect(`${baseUrl}/dashboard`, 302);
        } catch (err) {
          console.error("Auth error:", err);
          return new Response("Auth Failed", { status: 500 });
        }
      })
      .get("/logout", () => {
        // clear cookie
        const baseUrl = process.env.BASE_URL || "https://short.meo.in.th";
        return Response.redirect(`${baseUrl}/`, 302);
      })
  )

  // Redirect Route (Catch-all for short links)
  .get("/:slug", ({ params, set }) => {
    const { slug } = params;

    // Ignore static assets/favicon if not found
    if (slug.includes(".")) return;

    // Reserved paths for SPA routing - serve index.html
    const reservedPaths = ["dashboard", "login", "logout"];
    if (reservedPaths.includes(slug)) {
      return Bun.file(join(DIST_DIR, "index.html"));
    }

    const record = db.query("SELECT * FROM urls WHERE slug = ?").get(slug) as
      | UrlRecord
      | undefined;

    if (!record) {
      set.status = 404;
      return "URL not found";
    }

    // Check expiration
    if (record.expires_at && new Date(record.expires_at) < new Date()) {
      set.status = 410;
      return "URL has expired";
    }

    // Async increment click (fire and forget sorta)
    // In Bun/SQLite this is synchronous anyway but fast
    db.run("UPDATE urls SET clicks = clicks + 1 WHERE slug = ?", [slug]);

    set.redirect = record.original_url;
  })

  // Fallback to serving index.html for SPA routing (React Router)
  .get("*", () => Bun.file(join(DIST_DIR, "index.html")))

  .listen(Number(process.env.PORT) || 3006);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);

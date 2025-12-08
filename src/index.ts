import { Elysia } from "elysia";
import { Database } from "bun:sqlite";
import { mkdirSync, existsSync } from "fs";
import { dirname, join } from "path";
import { nanoid } from "nanoid";

const dataDir = process.env.DATA_DIR || "data";
const defaultDbPath = existsSync("/app/data/urls.sqlite")
  ? "urls.sqlite"
  : join(dataDir, "urls.sqlite");
const dbPath = process.env.DB_PATH || defaultDbPath;
const dbDir = dirname(dbPath);

if (dbDir && dbDir !== "." && !existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

console.log(`Loading Database at ${dbPath}...`);
const db = new Database(dbPath);
db.run(`CREATE TABLE IF NOT EXISTS urls (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    slug TEXT UNIQUE, 
    original_url TEXT, 
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, 
    clicks INTEGER DEFAULT 0
)`);

const insertUrl = db.prepare(
  "INSERT INTO urls (slug, original_url) VALUES ($slug, $url)"
);
const getUrl = db.prepare(
  "SELECT original_url, clicks FROM urls WHERE slug = $slug"
);
const incrementClick = db.prepare(
  "UPDATE urls SET clicks = clicks + 1 WHERE slug = $slug"
);

const app = new Elysia()
  // 1. หน้าบ้าน
  .get("/", () => Bun.file("src/index.html"))

  // 2. API สร้าง Link (Debug Version)
  .post(
    "/shorten",
    ({
      body,
      set,
      request,
    }):
      | {
          success: boolean;
          short_url: string;
          slug: string;
          original_url: string;
        }
      | { error: string } => {
      console.log("--> Request received at /shorten"); // เช็คว่า request มาถึงไหม
      console.log("--> Body payload:", body);

      try {
        const { url, customSlug } = body as {
          url?: string;
          customSlug?: string;
        };

        if (!url || typeof url !== "string") {
          set.status = 400;
          return { error: "กรุณาใส่ URL ที่ต้องการย่อ" };
        }

        let normalizedUrl: string;
        try {
          const parsed = new URL(url.trim());
          if (!["http:", "https:"].includes(parsed.protocol)) {
            throw new Error("protocol");
          }
          normalizedUrl = parsed.toString();
        } catch {
          set.status = 400;
          return { error: "URL ไม่ถูกต้อง (ต้องขึ้นต้นด้วย http หรือ https)" };
        }

        const cleanedSlug = customSlug?.trim();
        if (cleanedSlug && !/^[a-zA-Z0-9-_]{2,50}$/.test(cleanedSlug)) {
          set.status = 400;
          return {
            error: "Slug ใช้ได้เฉพาะ a-z, 0-9, -, _ (2-50 ตัวอักษร)",
          };
        }

        const slug =
          cleanedSlug && cleanedSlug !== "" ? cleanedSlug : nanoid(6);
        console.log("--> Generated Slug:", slug);

        // ลอง Insert
        insertUrl.run({ $slug: slug, $url: normalizedUrl });
        console.log("--> Insert Success!");

        // สร้าง Full URL
        const serverHost =
          app.server?.hostname === "0.0.0.0" || !app.server?.hostname
            ? "localhost"
            : app.server.hostname;
        const serverPort = app.server?.port || 3000;
        const origin =
          request.headers.get("origin")?.replace(/\/$/, "") ||
          process.env.BASE_URL?.replace(/\/$/, "") ||
          `http://${serverHost}:${serverPort}`;
        const shortUrl = `${origin}/${slug}`;

        return {
          success: true,
          short_url: shortUrl,
          slug: slug,
          original_url: normalizedUrl,
        };
      } catch (error: any) {
        console.error("!!! ERROR in /shorten !!!", error); // ดู Error ใน Terminal
        set.status = 500;

        if (error?.message?.includes("UNIQUE constraint failed")) {
          set.status = 409;
          return { error: "Slug (ชื่อย่อ) นี้ถูกใช้ไปแล้วครับ ลองชื่ออื่นนะ" };
        }
        return { error: `Server Error: ${error.message}` };
      }
    },
    {
      // ปิด Validation ชั่วคราว เพื่อดูว่า Body ส่งมาหน้าตาเป็นยังไง
      // body: t.Object({ url: t.String(), customSlug: t.Optional(t.String()) })
    }
  )

  // 3. Redirect Logic
  .get("/:slug", ({ params, set, redirect }) => {
    const { slug } = params;
    console.log(`--> Redirecting slug: ${slug}`);

    try {
      const result = getUrl.get({ $slug: slug }) as {
        original_url: string;
      } | null;
      if (result) {
        incrementClick.run({ $slug: slug });
        return redirect(result.original_url, 301);
      } else {
        set.status = 404;
        return "404 Not Found";
      }
    } catch (err) {
      console.error(err);
      return "Internal Error";
    }
  })
  .listen(3000);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`
);

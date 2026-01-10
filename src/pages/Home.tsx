import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Copy, RefreshCw, X, Settings2 } from "lucide-react";

interface ShortenResponse {
  success: boolean;
  short_url: string;
  slug: string;
  original_url: string;
  expires_at: string | null;
  error?: string;
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [customSlug, setCustomSlug] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ShortenResponse | null>(null);

  // Expiration State
  const [expirationType, setExpirationType] = useState<
    "permanent" | "duration"
  >("permanent");
  const [durationValue, setDurationValue] = useState(30);
  const [durationUnit, setDurationUnit] = useState("minutes");
  const [isCopying, setIsCopying] = useState(false);

  const getExpiresAt = () => {
    if (expirationType === "permanent") return undefined;
    const now = new Date();
    if (durationUnit === "minutes")
      now.setMinutes(now.getMinutes() + durationValue);
    if (durationUnit === "hours") now.setHours(now.getHours() + durationValue);
    if (durationUnit === "days") now.setDate(now.getDate() + durationValue);
    return now.toISOString();
  };

  const getExpirationText = () => {
    if (expirationType === "permanent") return "Permanent";
    return `Expires in ${durationValue} ${durationUnit}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setError("");

    if (!url) {
      setError("Please enter a URL");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          customSlug: customSlug || undefined,
          expiresAt: getExpiresAt(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create link");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.short_url);
    setIsCopying(true);
    setTimeout(() => setIsCopying(false), 2000);
  };

  const resetForm = () => {
    setResult(null);
    setUrl("");
    setCustomSlug("");
    setError("");
    setExpirationType("permanent");
  };

  if (result) {
    return (
      <div className="container">
        <header style={{ textAlign: "center", marginBottom: "3rem" }}>
          <h1>MEO Short URL</h1>
          <p style={{ color: "var(--text-muted)" }}>Your short link is ready</p>
        </header>

        <div
          className="card"
          style={{
            background: "var(--surface)",
            padding: "2rem",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border)",
            marginTop: "2rem",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <a
              href={result.short_url}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "block",
                fontSize: "1.5rem",
                color: "var(--primary)",
                marginBottom: "2rem",
                textDecoration: "none",
                wordBreak: "break-all",
                fontWeight: 500,
              }}
            >
              {result.short_url}
            </a>

            <div
              style={{ display: "flex", gap: "1rem", justifyContent: "center" }}
            >
              <button
                onClick={handleCopy}
                className="btn-secondary"
                style={{
                  width: "auto",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <Copy size={18} /> {isCopying ? "Copied!" : "Copy Link"}
              </button>
              <button
                onClick={resetForm}
                className="btn-secondary"
                style={{
                  width: "auto",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <RefreshCw size={18} /> New Link
              </button>
            </div>

            {result.expires_at && (
              <p
                style={{
                  marginTop: "1.5rem",
                  color: "var(--text-muted)",
                  fontSize: "0.9rem",
                }}
              >
                Expires at: {new Date(result.expires_at).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <header style={{ textAlign: "center", marginBottom: "3rem" }}>
        <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>
          MEO Short URL
        </h1>
        <p style={{ color: "var(--text-muted)" }}>
          Shorten your links, keep it clear.
        </p>
      </header>

      <main
        className="card"
        style={{
          background: "var(--surface)",
          padding: "2rem",
          borderRadius: "var(--radius)",
          border: "1px solid var(--border)",
        }}
      >
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "1.5rem" }}>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                color: "var(--text-muted)",
                fontSize: "0.8rem",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              Destination URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/long-url"
              required
              autoFocus
            />
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                color: "var(--text-muted)",
                fontSize: "0.8rem",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              Custom Slug (Optional)
            </label>
            <div style={{ display: "flex" }}>
              <span
                style={{
                  padding: "1rem",
                  background: "var(--border)",
                  color: "var(--text-muted)",
                  borderRadius: "8px 0 0 8px",
                  border: "1px solid var(--border)",
                  borderRight: "none",
                }}
              >
                /
              </span>
              <input
                type="text"
                value={customSlug}
                onChange={(e) => setCustomSlug(e.target.value)}
                placeholder="my-link"
                style={{ borderRadius: "0 8px 8px 0" }}
              />
            </div>
          </div>

          <div style={{ marginBottom: "2rem" }}>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                color: "var(--text-muted)",
                fontSize: "0.8rem",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              Expiration
            </label>

            <Dialog.Root>
              <Dialog.Trigger asChild>
                <div
                  role="button"
                  tabIndex={0}
                  style={{
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    padding: "1rem",
                    borderRadius: "8px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                  }}
                >
                  <span
                    style={{
                      color:
                        expirationType === "permanent"
                          ? "var(--text)"
                          : "var(--primary)",
                    }}
                  >
                    {getExpirationText()}
                  </span>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      color: "var(--text-muted)",
                      fontSize: "0.9rem",
                    }}
                  >
                    <Settings2 size={16} /> Edit
                  </div>
                </div>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="DialogOverlay" />
                <Dialog.Content className="DialogContent">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "1.5rem",
                    }}
                  >
                    <Dialog.Title className="DialogTitle">
                      Set Expiration
                    </Dialog.Title>
                    <Dialog.Close asChild>
                      <button
                        style={{
                          background: "transparent",
                          padding: 0,
                          width: "auto",
                          color: "var(--text-muted)",
                        }}
                      >
                        <X />
                      </button>
                    </Dialog.Close>
                  </div>

                  <div style={{ marginBottom: "1.5rem" }}>
                    <label
                      style={{ display: "block", marginBottom: "0.75rem" }}
                    >
                      Duration Type
                    </label>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "0.5rem",
                      }}
                    >
                      <button
                        type="button"
                        className={
                          expirationType === "permanent" ? "" : "btn-secondary"
                        }
                        style={
                          expirationType === "permanent"
                            ? { borderColor: "var(--primary)" }
                            : {}
                        }
                        onClick={() => setExpirationType("permanent")}
                      >
                        Permanent
                      </button>
                      <button
                        type="button"
                        className={
                          expirationType === "duration" ? "" : "btn-secondary"
                        }
                        style={
                          expirationType === "duration"
                            ? { borderColor: "var(--primary)" }
                            : {}
                        }
                        onClick={() => setExpirationType("duration")}
                      >
                        Temporary
                      </button>
                    </div>
                  </div>

                  {expirationType === "duration" && (
                    <div>
                      <label
                        style={{ display: "block", marginBottom: "0.75rem" }}
                      >
                        Time until expiration
                      </label>
                      <div style={{ display: "flex" }}>
                        <input
                          type="number"
                          min="1"
                          max="365"
                          value={durationValue}
                          onChange={(e) =>
                            setDurationValue(Number(e.target.value))
                          }
                          style={{ borderRadius: "8px 0 0 8px" }}
                        />
                        <select
                          value={durationUnit}
                          onChange={(e) => setDurationUnit(e.target.value)}
                          style={{
                            borderRadius: "0 8px 8px 0",
                            borderLeft: "none",
                            width: "auto",
                            minWidth: "100px",
                            cursor: "pointer",
                          }}
                        >
                          <option value="minutes">Minutes</option>
                          <option value="hours">Hours</option>
                          <option value="days">Days</option>
                        </select>
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: "2rem" }}>
                    <Dialog.Close asChild>
                      <button>Save Changes</button>
                    </Dialog.Close>
                  </div>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          </div>

          <button type="submit" disabled={isLoading}>
            {isLoading ? "Shortening..." : "Create secure link"}
          </button>
        </form>

        {error && (
          <p
            style={{
              color: "var(--error)",
              marginTop: "1rem",
              textAlign: "center",
              animation: "shake 0.3s",
            }}
          >
            {error}
          </p>
        )}
      </main>

      <footer
        style={{
          marginTop: "auto",
          paddingTop: "2rem",
          textAlign: "center",
          color: "var(--text-muted)",
          fontSize: "0.8rem",
        }}
      >
        &copy; 2026 MEO Studio. No cookies. No ads.
      </footer>
    </div>
  );
}

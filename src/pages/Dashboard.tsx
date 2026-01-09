import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, ExternalLink, Trash2, Save, Settings2 } from "lucide-react";

interface UrlData {
  id: number;
  slug: string;
  original_url: string;
  created_at: string;
  clicks: number;
  expires_at: string | null;
}

export default function Dashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [urls, setUrls] = useState<UrlData[]>([]);
  const [selectedUrl, setSelectedUrl] = useState<UrlData | null>(null);

  // Expiration editing state
  const [isEditingExpiration, setIsEditingExpiration] = useState(false);
  const [expirationType, setExpirationType] = useState<
    "permanent" | "duration"
  >("permanent");
  const [durationValue, setDurationValue] = useState(30);
  const [durationUnit, setDurationUnit] = useState("minutes");
  const [isSavingExpiration, setIsSavingExpiration] = useState(false);

  useEffect(() => {
    const fetchUrls = async () => {
      try {
        const res = await fetch("/api/admin/urls");
        const data = await res.json();
        setUrls(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    const checkAuth = async () => {
      try {
        const res = await fetch("/api/admin/me");
        if (res.status === 401) {
          setIsAuthenticated(false);
          setLoading(false);
          return;
        }
        await res.json();
        setIsAuthenticated(true);
        fetchUrls(); // Load URLs if auth is good
      } catch {
        setIsAuthenticated(false);
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this URL?")) return;
    try {
      const res = await fetch(`/api/admin/urls/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setUrls((prev) => prev.filter((u) => u.id !== id));
        setSelectedUrl(null); // Close modal if open
      }
    } catch (err) {
      alert("Failed to delete");
    }
  };

  const getExpiresAt = () => {
    if (expirationType === "permanent") return null;
    const now = new Date();
    if (durationUnit === "minutes")
      now.setMinutes(now.getMinutes() + durationValue);
    if (durationUnit === "hours") now.setHours(now.getHours() + durationValue);
    if (durationUnit === "days") now.setDate(now.getDate() + durationValue);
    return now.toISOString();
  };

  const handleSaveExpiration = async () => {
    if (!selectedUrl) return;
    setIsSavingExpiration(true);
    try {
      const newExpiresAt = getExpiresAt();
      const res = await fetch(`/api/admin/urls/${selectedUrl.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expires_at: newExpiresAt }),
      });
      if (res.ok) {
        // Update local state
        setUrls((prev) =>
          prev.map((u) =>
            u.id === selectedUrl.id ? { ...u, expires_at: newExpiresAt } : u
          )
        );
        setSelectedUrl({ ...selectedUrl, expires_at: newExpiresAt });
        setIsEditingExpiration(false);
      } else {
        throw new Error("Failed to save");
      }
    } catch (err) {
      alert("Failed to update expiration");
    } finally {
      setIsSavingExpiration(false);
    }
  };

  const openExpirationEditor = () => {
    if (selectedUrl?.expires_at) {
      setExpirationType("duration");
      // Calculate remaining time for display
      const expiresDate = new Date(selectedUrl.expires_at);
      const now = new Date();
      const diffMs = expiresDate.getTime() - now.getTime();
      if (diffMs > 0) {
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        if (diffDays > 0) {
          setDurationValue(diffDays);
          setDurationUnit("days");
        } else if (diffHours > 0) {
          setDurationValue(diffHours);
          setDurationUnit("hours");
        } else {
          setDurationValue(Math.max(1, diffMinutes));
          setDurationUnit("minutes");
        }
      } else {
        setDurationValue(30);
        setDurationUnit("minutes");
      }
    } else {
      setExpirationType("permanent");
      setDurationValue(30);
      setDurationUnit("minutes");
    }
    setIsEditingExpiration(true);
  };

  if (loading) {
    return (
      <div
        className="container"
        style={{ textAlign: "center", paddingTop: "4rem" }}
      >
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div
        className="container"
        style={{ textAlign: "center", paddingTop: "4rem" }}
      >
        <div
          style={{
            background: "var(--surface)",
            padding: "3rem",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border)",
          }}
        >
          <h1>Admin Access Only</h1>
          <p style={{ color: "var(--text-muted)", margin: "1rem 0 2rem" }}>
            Please log in with Discord to continue.
          </p>
          <a
            href="/auth/discord"
            style={{
              background: "#5865f2",
              color: "white",
              padding: "0.75rem 1.5rem",
              borderRadius: "8px",
              textDecoration: "none",
              fontWeight: 600,
              display: "inline-block",
            }}
          >
            Login with Discord
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "2rem",
        }}
      >
        <h1>URL Management</h1>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
            Admin
          </span>
          <a
            href="/auth/logout"
            style={{
              background: "rgba(255, 68, 68, 0.1)",
              color: "var(--error)",
              border: "1px solid rgba(255, 68, 68, 0.3)",
              padding: "0.4rem 0.8rem",
              fontSize: "0.8rem",
              borderRadius: "8px",
              textDecoration: "none",
            }}
          >
            Logout
          </a>
        </div>
      </header>

      <div
        className="card"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          overflow: "hidden",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            textAlign: "left",
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  padding: "1rem",
                  borderBottom: "1px solid var(--border)",
                  background: "rgba(255, 255, 255, 0.05)",
                  color: "var(--text-muted)",
                  fontSize: "0.8rem",
                  textTransform: "uppercase",
                }}
              >
                Slug
              </th>
              <th
                style={{
                  padding: "1rem",
                  borderBottom: "1px solid var(--border)",
                  background: "rgba(255, 255, 255, 0.05)",
                  color: "var(--text-muted)",
                  fontSize: "0.8rem",
                  textTransform: "uppercase",
                }}
              >
                Original URL
              </th>
              <th
                style={{
                  padding: "1rem",
                  borderBottom: "1px solid var(--border)",
                  background: "rgba(255, 255, 255, 0.05)",
                  color: "var(--text-muted)",
                  fontSize: "0.8rem",
                  textTransform: "uppercase",
                }}
              >
                Clicks
              </th>
              <th
                style={{
                  padding: "1rem",
                  borderBottom: "1px solid var(--border)",
                  background: "rgba(255, 255, 255, 0.05)",
                  color: "var(--text-muted)",
                  fontSize: "0.8rem",
                  textTransform: "uppercase",
                }}
              >
                Created
              </th>
              <th
                style={{
                  padding: "1rem",
                  borderBottom: "1px solid var(--border)",
                  background: "rgba(255, 255, 255, 0.05)",
                  color: "var(--text-muted)",
                  fontSize: "0.8rem",
                  textTransform: "uppercase",
                  textAlign: "right",
                }}
              >
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {urls.map((url) => (
              <tr
                key={url.id}
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <td
                  style={{
                    padding: "1rem",
                    fontFamily: "monospace",
                    color: "var(--primary)",
                  }}
                >
                  <a
                    href={`/${url.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "inherit", textDecoration: "none" }}
                  >
                    {url.slug}
                  </a>
                </td>
                <td
                  style={{
                    padding: "1rem",
                    maxWidth: "300px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    color: "var(--text-muted)",
                  }}
                  title={url.original_url}
                >
                  {url.original_url}
                </td>
                <td style={{ padding: "1rem" }}>{url.clicks}</td>
                <td
                  style={{
                    padding: "1rem",
                    color: "var(--text-muted)",
                    fontSize: "0.85rem",
                  }}
                >
                  {new Date(url.created_at).toLocaleString()}
                </td>
                <td style={{ padding: "1rem", textAlign: "right" }}>
                  <Dialog.Root
                    open={selectedUrl?.id === url.id}
                    onOpenChange={(open) => setSelectedUrl(open ? url : null)}
                  >
                    <Dialog.Trigger asChild>
                      <button
                        className="btn-secondary"
                        style={{
                          width: "auto",
                          padding: "0.4rem 0.8rem",
                          fontSize: "0.8rem",
                        }}
                      >
                        Manage
                      </button>
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
                            Link Details
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

                        {selectedUrl && (
                          <>
                            <div style={{ marginBottom: "1.25rem" }}>
                              <label
                                style={{
                                  fontSize: "0.75rem",
                                  color: "var(--text-muted)",
                                  textTransform: "uppercase",
                                  display: "block",
                                  marginBottom: "0.5rem",
                                }}
                              >
                                Short Link
                              </label>
                              <div
                                style={{
                                  background: "rgba(0,0,0,0.2)",
                                  padding: "0.75rem",
                                  borderRadius: "8px",
                                  border: "1px solid var(--border)",
                                  fontFamily: "monospace",
                                  color: "var(--primary)",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                }}
                              >
                                <span>
                                  {window.location.origin}/{selectedUrl.slug}
                                </span>
                                <a
                                  href={`/${selectedUrl.slug}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ color: "var(--text-muted)" }}
                                >
                                  <ExternalLink size={16} />
                                </a>
                              </div>
                            </div>

                            <div style={{ marginBottom: "1.25rem" }}>
                              <label
                                style={{
                                  fontSize: "0.75rem",
                                  color: "var(--text-muted)",
                                  textTransform: "uppercase",
                                  display: "block",
                                  marginBottom: "0.5rem",
                                }}
                              >
                                Original URL
                              </label>
                              <div
                                style={{
                                  background: "rgba(0,0,0,0.2)",
                                  padding: "0.75rem",
                                  borderRadius: "8px",
                                  border: "1px solid var(--border)",
                                  fontFamily: "monospace",
                                  wordBreak: "break-all",
                                  fontSize: "0.9rem",
                                }}
                              >
                                {selectedUrl.original_url}
                              </div>
                            </div>

                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: "1rem",
                                marginBottom: "1.25rem",
                              }}
                            >
                              <div>
                                <label
                                  style={{
                                    fontSize: "0.75rem",
                                    color: "var(--text-muted)",
                                    textTransform: "uppercase",
                                    display: "block",
                                    marginBottom: "0.5rem",
                                  }}
                                >
                                  Clicks
                                </label>
                                <div
                                  style={{
                                    background: "rgba(0,0,0,0.2)",
                                    padding: "0.75rem",
                                    borderRadius: "8px",
                                    border: "1px solid var(--border)",
                                  }}
                                >
                                  {selectedUrl.clicks}
                                </div>
                              </div>
                              <div>
                                <label
                                  style={{
                                    fontSize: "0.75rem",
                                    color: "var(--text-muted)",
                                    textTransform: "uppercase",
                                    display: "block",
                                    marginBottom: "0.5rem",
                                  }}
                                >
                                  Created At
                                </label>
                                <div
                                  style={{
                                    background: "rgba(0,0,0,0.2)",
                                    padding: "0.75rem",
                                    borderRadius: "8px",
                                    border: "1px solid var(--border)",
                                    fontSize: "0.9rem",
                                  }}
                                >
                                  {new Date(
                                    selectedUrl.created_at
                                  ).toLocaleDateString()}
                                </div>
                              </div>
                            </div>

                            <div style={{ marginBottom: "1.25rem" }}>
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  marginBottom: "0.5rem",
                                }}
                              >
                                <label
                                  style={{
                                    fontSize: "0.75rem",
                                    color: "var(--text-muted)",
                                    textTransform: "uppercase",
                                  }}
                                >
                                  Expires At
                                </label>
                                {!isEditingExpiration && (
                                  <button
                                    onClick={openExpirationEditor}
                                    style={{
                                      background: "transparent",
                                      padding: "0.25rem 0.5rem",
                                      width: "auto",
                                      fontSize: "0.75rem",
                                      color: "var(--primary)",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "0.25rem",
                                    }}
                                  >
                                    <Settings2 size={14} /> Edit
                                  </button>
                                )}
                              </div>

                              {!isEditingExpiration ? (
                                <div
                                  style={{
                                    background: "rgba(0,0,0,0.2)",
                                    padding: "0.75rem",
                                    borderRadius: "8px",
                                    border: "1px solid var(--border)",
                                    fontSize: "0.9rem",
                                    color: selectedUrl.expires_at
                                      ? "var(--text)"
                                      : "var(--text-muted)",
                                  }}
                                >
                                  {selectedUrl.expires_at
                                    ? new Date(
                                        selectedUrl.expires_at
                                      ).toLocaleString()
                                    : "Never (Permanent)"}
                                </div>
                              ) : (
                                <div
                                  style={{
                                    background: "rgba(0,0,0,0.2)",
                                    padding: "1rem",
                                    borderRadius: "8px",
                                    border: "1px solid var(--primary)",
                                  }}
                                >
                                  {/* Duration Type Selector */}
                                  <div
                                    style={{
                                      display: "grid",
                                      gridTemplateColumns: "1fr 1fr",
                                      gap: "0.5rem",
                                      marginBottom: "1rem",
                                    }}
                                  >
                                    <button
                                      type="button"
                                      className={
                                        expirationType === "permanent"
                                          ? ""
                                          : "btn-secondary"
                                      }
                                      style={
                                        expirationType === "permanent"
                                          ? {
                                              borderColor: "var(--primary)",
                                              padding: "0.5rem",
                                            }
                                          : { padding: "0.5rem" }
                                      }
                                      onClick={() =>
                                        setExpirationType("permanent")
                                      }
                                    >
                                      Permanent
                                    </button>
                                    <button
                                      type="button"
                                      className={
                                        expirationType === "duration"
                                          ? ""
                                          : "btn-secondary"
                                      }
                                      style={
                                        expirationType === "duration"
                                          ? {
                                              borderColor: "var(--primary)",
                                              padding: "0.5rem",
                                            }
                                          : { padding: "0.5rem" }
                                      }
                                      onClick={() =>
                                        setExpirationType("duration")
                                      }
                                    >
                                      Temporary
                                    </button>
                                  </div>

                                  {/* Duration Input */}
                                  {expirationType === "duration" && (
                                    <div
                                      style={{
                                        display: "flex",
                                        marginBottom: "1rem",
                                      }}
                                    >
                                      <input
                                        type="number"
                                        min="1"
                                        max="365"
                                        value={durationValue}
                                        onChange={(e) =>
                                          setDurationValue(
                                            Number(e.target.value)
                                          )
                                        }
                                        style={{
                                          borderRadius: "8px 0 0 8px",
                                          flex: 1,
                                        }}
                                      />
                                      <select
                                        value={durationUnit}
                                        onChange={(e) =>
                                          setDurationUnit(e.target.value)
                                        }
                                        style={{
                                          borderRadius: "0 8px 8px 0",
                                          borderLeft: "none",
                                          width: "auto",
                                          minWidth: "120px",
                                          cursor: "pointer",
                                          paddingRight: "2rem",
                                        }}
                                      >
                                        <option value="minutes">Minutes</option>
                                        <option value="hours">Hours</option>
                                        <option value="days">Days</option>
                                      </select>
                                    </div>
                                  )}

                                  {/* Action Buttons */}
                                  <div
                                    style={{ display: "flex", gap: "0.5rem" }}
                                  >
                                    <button
                                      onClick={handleSaveExpiration}
                                      disabled={isSavingExpiration}
                                      style={{
                                        flex: 1,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: "0.5rem",
                                        padding: "0.5rem",
                                      }}
                                    >
                                      <Save size={16} />{" "}
                                      {isSavingExpiration
                                        ? "Saving..."
                                        : "Save"}
                                    </button>
                                    <button
                                      onClick={() =>
                                        setIsEditingExpiration(false)
                                      }
                                      className="btn-secondary"
                                      style={{ flex: 1, padding: "0.5rem" }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>

                            <div style={{ marginTop: "2rem" }}>
                              <button
                                onClick={() => handleDelete(selectedUrl.id)}
                                style={{
                                  background: "rgba(255, 68, 68, 0.1)",
                                  color: "var(--error)",
                                  border: "1px solid rgba(255, 68, 68, 0.3)",
                                  display: "flex",
                                  justifyContent: "center",
                                  alignItems: "center",
                                  gap: "0.5rem",
                                }}
                              >
                                <Trash2 size={16} /> Delete Link
                              </button>
                            </div>
                          </>
                        )}
                      </Dialog.Content>
                    </Dialog.Portal>
                  </Dialog.Root>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

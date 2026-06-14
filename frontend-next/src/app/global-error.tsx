"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#050506",
          color: "#FFFFFF",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem", maxWidth: "32rem" }}>
          <div
            style={{
              fontSize: "0.75rem",
              fontFamily: "monospace",
              color: "#FFD24A",
              marginBottom: "0.5rem",
            }}
          >
            [Σ-Critical]
          </div>
          <h1
            style={{
              fontSize: "clamp(2rem, 6vw, 3.5rem)",
              fontWeight: 700,
              margin: "0.5rem 0 1rem 0",
              background: "linear-gradient(135deg, #FF77E9 0%, #FFD24D 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            Application error
          </h1>
          <p style={{ color: "#D1D1D6", marginBottom: "1.5rem" }}>
            A critical error broke the application shell. Reload to recover.
          </p>
          <button
            onClick={reset}
            style={{
              padding: "0.625rem 1.25rem",
              background: "#FFD24A",
              color: "#050506",
              border: "none",
              borderRadius: "4px",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: "0.875rem",
            }}
          >
            Reload application
          </button>
        </div>
      </body>
    </html>
  );
}

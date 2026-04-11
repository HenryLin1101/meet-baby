export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1.25rem",
      }}
    >
      <div
        style={{
          maxWidth: "36rem",
          width: "100%",
          background: "rgba(26, 35, 50, 0.85)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "16px",
          padding: "2rem",
          backdropFilter: "blur(8px)",
        }}
      >
        <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.75rem" }}>米特寶寶</h1>
        <p style={{ margin: "0 0 1.5rem", color: "var(--muted)" }}>
          此站為 LINE Messaging API Webhook 後端。部署到 Vercel 後，請將 Webhook URL 設為：
        </p>
        <p style={{ margin: "0 0 0.25rem", fontSize: "0.9rem", color: "var(--muted)" }}>
          正式環境（請替換為你的網域）
        </p>
        <code>https://&lt;你的專案&gt;.vercel.app/api/line</code>
        <p style={{ margin: "1.5rem 0 0", fontSize: "0.875rem", color: "var(--muted)" }}>
          請在 Vercel 與本機設定 <code>LINE_CHANNEL_ACCESS_TOKEN</code>、
          <code>LINE_CHANNEL_SECRET</code>。
        </p>
      </div>
    </main>
  );
}

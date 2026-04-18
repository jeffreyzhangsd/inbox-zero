export default function TermsOfService() {
  return (
    <div
      style={{
        maxWidth: "640px",
        margin: "60px auto",
        padding: "0 24px",
        fontFamily: "inherit",
        color: "var(--text-primary)",
        lineHeight: 1.7,
      }}
    >
      <h1 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "8px" }}>
        Terms of Service
      </h1>
      <p
        style={{
          fontSize: "12px",
          color: "var(--text-muted)",
          marginBottom: "32px",
        }}
      >
        Last updated: April 2026
      </p>

      <section style={{ marginBottom: "28px" }}>
        <h2 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "8px" }}>
          Use of the app
        </h2>
        <p style={{ fontSize: "13px" }}>
          Inbox Zero is a personal Gmail inbox management tool. By using this
          app you agree to use it only for lawful purposes and in accordance
          with Google&apos;s Terms of Service.
        </p>
      </section>

      <section style={{ marginBottom: "28px" }}>
        <h2 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "8px" }}>
          Actions on your account
        </h2>
        <p style={{ fontSize: "13px" }}>
          The app performs actions on your Gmail account (archive, delete, mark
          as read, unsubscribe) only when you explicitly initiate them. Deleted
          emails are permanently removed. You are responsible for confirming
          actions before proceeding.
        </p>
      </section>

      <section style={{ marginBottom: "28px" }}>
        <h2 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "8px" }}>
          No warranty
        </h2>
        <p style={{ fontSize: "13px" }}>
          This app is provided as-is with no guarantees of availability,
          accuracy, or fitness for any particular purpose. Use it at your own
          risk.
        </p>
      </section>

      <section style={{ marginBottom: "28px" }}>
        <h2 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "8px" }}>
          Contact
        </h2>
        <p style={{ fontSize: "13px" }}>
          Questions? Email{" "}
          <a
            href="mailto:jeffreyzhangsd@gmail.com"
            style={{ color: "inherit" }}
          >
            jeffreyzhangsd@gmail.com
          </a>
          .
        </p>
      </section>
    </div>
  );
}

export default function PrivacyPolicy() {
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
        Privacy Policy
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
          What this app does
        </h2>
        <p style={{ fontSize: "13px" }}>
          Inbox Zero is a personal Gmail inbox management tool. It connects to
          your Google account to read, organize, and take bulk actions on your
          emails (archive, delete, mark as read, unsubscribe).
        </p>
      </section>

      <section style={{ marginBottom: "28px" }}>
        <h2 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "8px" }}>
          Data we access
        </h2>
        <p style={{ fontSize: "13px" }}>
          We request access to your Gmail data solely to display and manage your
          inbox within the app. Specifically:
        </p>
        <ul style={{ fontSize: "13px", paddingLeft: "20px", marginTop: "8px" }}>
          <li>Email metadata (sender, subject, date, labels)</li>
          <li>Email body content (when you open an individual email)</li>
          <li>
            The ability to archive, delete, mark as read, and send unsubscribe
            requests on your behalf
          </li>
        </ul>
      </section>

      <section style={{ marginBottom: "28px" }}>
        <h2 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "8px" }}>
          Data storage
        </h2>
        <p style={{ fontSize: "13px" }}>
          Your emails are fetched at runtime and held in memory only for the
          duration of your session. We do not store email content or metadata on
          any server or database. OAuth tokens are stored in encrypted session
          cookies on your device. No email data is shared with third parties.
        </p>
      </section>

      <section style={{ marginBottom: "28px" }}>
        <h2 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "8px" }}>
          Google API usage
        </h2>
        <p style={{ fontSize: "13px" }}>
          This app uses the Gmail API under Google&apos;s{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "inherit" }}
          >
            API Services User Data Policy
          </a>
          , including the Limited Use requirements. Your Google data is used
          only to provide the features described above.
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

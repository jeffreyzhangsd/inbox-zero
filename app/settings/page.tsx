// app/settings/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import ThemeToggle from "@/components/ThemeToggle";

export default function SettingsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const email = session?.user?.email;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        color: "var(--text-secondary)",
        padding: "32px 16px",
      }}
    >
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        {/* Back link */}
        <div style={{ marginBottom: 24 }}>
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              border: "none",
              background: "none",
              padding: 0,
              fontSize: 12,
              color: "var(--text-muted)",
              letterSpacing: "0.02em",
              cursor: "pointer",
            }}
          >
            ← Back to inbox
          </button>
        </div>

        {/* Page title */}
        <h1
          style={{
            fontSize: 16,
            fontWeight: 500,
            color: "var(--text-primary)",
            marginBottom: 32,
            letterSpacing: "0.01em",
          }}
        >
          Settings
        </h1>

        {/* ── Account section ── */}
        <section style={{ marginBottom: 36 }}>
          <h2 className="label" style={{ marginBottom: 14 }}>
            Account
          </h2>
          <div
            style={{
              background: "var(--bg-container)",
              border: "1px solid var(--border)",
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <span
              style={{
                fontSize: 13,
                color: "var(--text-primary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {email ?? "—"}
            </span>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              style={{ flexShrink: 0, whiteSpace: "nowrap" }}
            >
              Sign out
            </button>
          </div>
        </section>

        {/* ── Theme section ── */}
        <section style={{ marginBottom: 36 }}>
          <h2 className="label" style={{ marginBottom: 14 }}>
            Appearance
          </h2>
          <div
            style={{
              background: "var(--bg-container)",
              border: "1px solid var(--border)",
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              Theme
            </span>
            <ThemeToggle />
          </div>
        </section>
      </div>
    </div>
  );
}

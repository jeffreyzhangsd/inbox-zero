// components/inbox/SettingsModal.tsx
"use client";

import { useEffect } from "react";
import { useSession, signOut } from "next-auth/react";

interface SettingsModalProps {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const { data: session } = useSession();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 300,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--bg)",
          border: "1px solid var(--border)",
          width: "100%",
          maxWidth: 420,
          padding: "24px",
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 24,
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "var(--text-primary)",
              letterSpacing: "0.01em",
            }}
          >
            Settings
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "none",
              background: "none",
              color: "var(--text-muted)",
              fontSize: 18,
              lineHeight: 1,
              padding: "0 2px",
              cursor: "pointer",
            }}
            aria-label="Close settings"
          >
            ×
          </button>
        </div>

        {/* Account */}
        <section style={{ marginBottom: 20 }}>
          <div
            className="label"
            style={{
              marginBottom: 10,
              fontSize: 11,
              color: "var(--text-muted)",
              letterSpacing: "0.05em",
            }}
          >
            ACCOUNT
          </div>
          <div
            style={{
              background: "var(--bg-container)",
              border: "1px solid var(--border)",
              padding: "12px 14px",
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
              {session?.user?.email ?? "—"}
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
      </div>
    </div>
  );
}

"use client";

import type { Email, Sender } from "@/types";
import { decodeEntities, timeAgo } from "@/lib/format";

interface EmailDetailProps {
  sender: Sender;
  onBack: () => void;
  onMarkRead: (emailIds: string[]) => void;
  onArchive: (emailIds: string[]) => void;
  onDelete: (emailIds: string[]) => void;
  onMarkSpam: (emailIds: string[]) => void;
}

export default function EmailDetail({
  sender,
  onBack,
  onMarkRead,
  onArchive,
  onDelete,
  onMarkSpam,
}: EmailDetailProps) {
  const sorted = [...sender.emails].sort((a, b) => b.date - a.date);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "8px 12px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            border: "none",
            background: "none",
            color: "var(--text-muted)",
            fontSize: "12px",
            padding: "2px 6px 2px 0",
            cursor: "pointer",
          }}
        >
          ← back
        </button>

        <span
          style={{
            fontSize: "13px",
            fontWeight: 500,
            color: "var(--text-primary)",
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {sender.displayName}
        </span>

        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
          {sender.emailCount} email{sender.emailCount !== 1 ? "s" : ""}
        </span>

        <div style={{ display: "flex", gap: "6px" }}>
          {sender.unreadCount > 0 && (
            <ActionButton
              label="Mark read"
              onClick={() => onMarkRead(sender.emailIds)}
            />
          )}
          <ActionButton
            label="Archive"
            onClick={() => onArchive(sender.emailIds)}
          />
          <ActionButton
            label="Delete"
            onClick={() => onDelete(sender.emailIds)}
            danger
          />
          <ActionButton
            label="Spam"
            onClick={() => onMarkSpam(sender.emailIds)}
          />
        </div>
      </div>

      {/* Email list */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {sorted.map((email) => (
          <EmailRow key={email.id} email={email} />
        ))}
      </div>
    </div>
  );
}

function EmailRow({ email }: { email: Email }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "10px",
        padding: "10px 12px",
        borderBottom: "1px solid var(--divider)",
        borderLeft: email.isRead
          ? "2px solid transparent"
          : "2px solid var(--unread-badge-bg, #2563eb)",
      }}
    >
      {!email.isRead && (
        <div
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: "var(--unread-badge-bg, #2563eb)",
            flexShrink: 0,
            marginTop: "5px",
          }}
        />
      )}
      {email.isRead && <div style={{ width: "6px", flexShrink: 0 }} />}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "13px",
            fontWeight: email.isRead ? 400 : 600,
            color: "var(--text-primary)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            marginBottom: "2px",
          }}
        >
          {decodeEntities(email.subject) || "(no subject)"}
        </div>
        <div
          style={{
            fontSize: "11px",
            color: "var(--text-muted)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {decodeEntities(email.snippet)}
        </div>
      </div>

      <span
        style={{
          fontSize: "11px",
          color: "var(--text-muted)",
          flexShrink: 0,
          minWidth: "34px",
          textAlign: "right",
        }}
      >
        {timeAgo(email.date)}
      </span>
    </div>
  );
}

interface ActionButtonProps {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

function ActionButton({ label, onClick, danger = false }: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: "none",
        background: "none",
        color: danger ? "var(--color-danger)" : "var(--text-muted)",
        padding: "2px 6px",
        fontSize: "11px",
        transition: "color 0.12s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = danger
          ? "var(--color-danger)"
          : "var(--text-primary)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = danger
          ? "var(--color-danger)"
          : "var(--text-muted)";
      }}
    >
      {label}
    </button>
  );
}

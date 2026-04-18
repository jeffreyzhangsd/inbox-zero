"use client";

import { useState, useCallback } from "react";
import type { Email, Sender } from "@/types";
import { decodeEntities, timeAgo } from "@/lib/format";

interface EmailDetailProps {
  sender: Sender;
  onBack: () => void;
  onMarkRead: (emailIds: string[]) => void;
  onMarkUnread: (emailIds: string[]) => void;
  onArchive: (emailIds: string[]) => void;
  onDelete: (emailIds: string[]) => void;
  onMarkSpam: (emailIds: string[]) => void;
}

interface BodyData {
  html?: string;
  plain?: string;
}

export default function EmailDetail({
  sender,
  onBack,
  onMarkRead,
  onMarkUnread,
  onArchive,
  onDelete,
  onMarkSpam,
}: EmailDetailProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [openEmail, setOpenEmail] = useState<Email | null>(null);
  const [emailBody, setEmailBody] = useState<BodyData | null>(null);
  const [loadingBody, setLoadingBody] = useState(false);
  // locally-tracked read state: opened = read, explicitly unread = unread
  const [localReadIds, setLocalReadIds] = useState<Set<string>>(new Set());
  const [localUnreadIds, setLocalUnreadIds] = useState<Set<string>>(new Set());
  // locally-tracked deleted/archived: hide immediately without waiting for reload
  const [localDeletedIds, setLocalDeletedIds] = useState<Set<string>>(
    new Set(),
  );

  const sorted = [...sender.emails]
    .filter((e) => !localDeletedIds.has(e.id))
    .sort((a, b) => b.date - a.date);

  const openFullEmail = useCallback(
    async (email: Email) => {
      setOpenEmail(email);
      setEmailBody(null);
      setLoadingBody(true);
      if (!email.isRead && !localReadIds.has(email.id)) {
        setLocalReadIds((prev) => new Set([...prev, email.id]));
        onMarkRead([email.id]);
      }
      try {
        const res = await fetch(`/api/email/${email.id}`);
        if (res.ok) setEmailBody(await res.json());
      } finally {
        setLoadingBody(false);
      }
    },
    [localReadIds, onMarkRead],
  );

  const toggleSelect = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const selectedArray = [...selectedIds];
  const hasSelection = selectedArray.length > 0;

  if (openEmail) {
    return (
      <EmailViewer
        email={openEmail}
        body={emailBody}
        loading={loadingBody}
        isRead={
          (openEmail.isRead || localReadIds.has(openEmail.id)) &&
          !localUnreadIds.has(openEmail.id)
        }
        onBack={() => {
          setOpenEmail(null);
          setEmailBody(null);
        }}
        onMarkUnread={(ids) => {
          onMarkUnread(ids);
          setLocalReadIds((prev) => {
            const n = new Set(prev);
            ids.forEach((id) => n.delete(id));
            return n;
          });
          setLocalUnreadIds((prev) => new Set([...prev, ...ids]));
          setOpenEmail(null);
          setEmailBody(null);
        }}
        onArchive={(ids) => {
          onArchive(ids);
          setLocalDeletedIds((prev) => new Set([...prev, ...ids]));
          setOpenEmail(null);
          setEmailBody(null);
        }}
        onDelete={(ids) => {
          onDelete(ids);
          setLocalDeletedIds((prev) => new Set([...prev, ...ids]));
          setOpenEmail(null);
          setEmailBody(null);
        }}
      />
    );
  }

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

      {/* Bulk action bar */}
      {hasSelection && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "5px 12px",
            borderBottom: "1px solid var(--border)",
            background: "var(--bg-container)",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: "11px",
              color: "var(--text-muted)",
              marginRight: "4px",
            }}
          >
            {selectedArray.length} selected
          </span>
          <ActionButton
            label="Mark read"
            onClick={() => {
              onMarkRead(selectedArray);
              setLocalReadIds((prev) => new Set([...prev, ...selectedArray]));
              clearSelection();
            }}
          />
          <ActionButton
            label="Archive"
            onClick={() => {
              onArchive(selectedArray);
              setLocalDeletedIds(
                (prev) => new Set([...prev, ...selectedArray]),
              );
              clearSelection();
            }}
          />
          <ActionButton
            label="Delete"
            onClick={() => {
              onDelete(selectedArray);
              setLocalDeletedIds(
                (prev) => new Set([...prev, ...selectedArray]),
              );
              clearSelection();
            }}
            danger
          />
          <button
            type="button"
            onClick={clearSelection}
            style={{
              border: "none",
              background: "none",
              color: "var(--text-muted)",
              fontSize: "11px",
              marginLeft: "auto",
              cursor: "pointer",
            }}
          >
            clear
          </button>
        </div>
      )}

      {/* Email list */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {sorted.map((email) => (
          <EmailRow
            key={email.id}
            email={email}
            isRead={
              (email.isRead || localReadIds.has(email.id)) &&
              !localUnreadIds.has(email.id)
            }
            selected={selectedIds.has(email.id)}
            onSelect={(checked) => toggleSelect(email.id, checked)}
            onOpen={() => openFullEmail(email)}
            onMarkRead={() => {
              onMarkRead([email.id]);
              setLocalReadIds((prev) => new Set([...prev, email.id]));
            }}
            onArchive={() => {
              onArchive([email.id]);
              setLocalDeletedIds((prev) => new Set([...prev, email.id]));
            }}
            onDelete={() => {
              onDelete([email.id]);
              setLocalDeletedIds((prev) => new Set([...prev, email.id]));
            }}
          />
        ))}
      </div>
    </div>
  );
}

function EmailRow({
  email,
  isRead,
  selected,
  onSelect,
  onOpen,
  onMarkRead,
  onArchive,
  onDelete,
}: {
  email: Email;
  isRead: boolean;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onOpen: () => void;
  onMarkRead: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "8px 12px",
        borderBottom: "1px solid var(--divider)",
        borderLeft: isRead
          ? "2px solid transparent"
          : "2px solid var(--unread-badge-bg, #2563eb)",
        background: selected
          ? "var(--sidebar-active-bg)"
          : hovered
            ? "var(--bg-hover)"
            : "transparent",
        cursor: "default",
        transition: "background 0.1s",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={(e) => onSelect(e.target.checked)}
        onClick={(e) => e.stopPropagation()}
        style={{
          flexShrink: 0,
          accentColor: "var(--sidebar-active-border)",
        }}
        aria-label={`Select email: ${email.subject}`}
      />

      <div style={{ width: "6px", flexShrink: 0 }}>
        {!isRead && (
          <div
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: "var(--unread-badge-bg, #2563eb)",
            }}
          />
        )}
      </div>

      <div
        style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
        onClick={onOpen}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onOpen()}
        aria-label={`Open email: ${email.subject || "(no subject)"}`}
      >
        <div
          style={{
            fontSize: "13px",
            fontWeight: isRead ? 400 : 600,
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

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          flexShrink: 0,
          minWidth: "80px",
          justifyContent: "flex-end",
        }}
      >
        {hovered ? (
          <>
            {!isRead && <SmallButton label="Read" onClick={onMarkRead} />}
            <SmallButton label="Archive" onClick={onArchive} />
            <SmallButton label="Delete" onClick={onDelete} danger />
          </>
        ) : (
          <span
            style={{
              fontSize: "11px",
              color: "var(--text-muted)",
              textAlign: "right",
            }}
          >
            {timeAgo(email.date)}
          </span>
        )}
      </div>
    </div>
  );
}

function EmailViewer({
  email,
  body,
  loading,
  isRead,
  onBack,
  onMarkUnread,
  onArchive,
  onDelete,
}: {
  email: Email;
  body: BodyData | null;
  loading: boolean;
  isRead: boolean;
  onBack: () => void;
  onMarkUnread: (ids: string[]) => void;
  onArchive: (ids: string[]) => void;
  onDelete: (ids: string[]) => void;
}) {
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
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "13px",
              fontWeight: 500,
              color: "var(--text-primary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {decodeEntities(email.subject) || "(no subject)"}
          </div>
          <div
            style={{
              fontSize: "11px",
              color: "var(--text-muted)",
              marginTop: "1px",
            }}
          >
            {email.from} · {timeAgo(email.date)}
          </div>
        </div>
        <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
          {isRead && (
            <ActionButton
              label="Mark unread"
              onClick={() => onMarkUnread([email.id])}
            />
          )}
          <ActionButton label="Archive" onClick={() => onArchive([email.id])} />
          <ActionButton
            label="Delete"
            onClick={() => onDelete([email.id])}
            danger
          />
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {loading && (
          <div
            style={{
              padding: "20px",
              color: "var(--text-muted)",
              fontSize: "12px",
            }}
          >
            Loading…
          </div>
        )}
        {!loading && body?.html && (
          <iframe
            srcDoc={body.html}
            sandbox=""
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              background: "#fff",
            }}
            title="Email content"
          />
        )}
        {!loading && !body?.html && body?.plain && (
          <pre
            style={{
              padding: "16px",
              fontSize: "12px",
              color: "var(--text-primary)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              overflowY: "auto",
              height: "100%",
              margin: 0,
              fontFamily: "inherit",
            }}
          >
            {body.plain}
          </pre>
        )}
        {!loading && !body?.html && !body?.plain && (
          <div
            style={{
              padding: "20px",
              color: "var(--text-muted)",
              fontSize: "12px",
            }}
          >
            No content available.
          </div>
        )}
      </div>
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
        cursor: "pointer",
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

function SmallButton({
  label,
  onClick,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        border: "none",
        background: "none",
        color: danger ? "var(--color-danger)" : "var(--text-muted)",
        padding: "1px 5px",
        fontSize: "11px",
        cursor: "pointer",
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

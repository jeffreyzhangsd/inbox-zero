// components/inbox/BulkActionBar.tsx
"use client";

interface BulkActionBarProps {
  selectedCount: number;
  onMarkRead: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onMarkSpam: () => void;
  onClearSelection: () => void;
}

export default function BulkActionBar({
  selectedCount,
  onMarkRead,
  onArchive,
  onDelete,
  onMarkSpam,
  onClearSelection,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "6px 12px",
        background: "var(--sidebar-active-bg)",
        borderBottom: "1px solid var(--border)",
        flexWrap: "wrap",
      }}
    >
      <span
        style={{
          color: "var(--text-secondary)",
          fontSize: "12px",
          marginRight: "4px",
          whiteSpace: "nowrap",
        }}
      >
        {selectedCount} selected
      </span>

      <BarButton label="Mark read" onClick={onMarkRead} />
      <BarButton label="Archive" onClick={onArchive} />
      <BarButton label="Delete" onClick={onDelete} danger />
      <BarButton label="Mark as spam" onClick={onMarkSpam} />

      <button
        type="button"
        onClick={onClearSelection}
        title="Clear selection"
        style={{
          border: "none",
          background: "none",
          color: "var(--text-muted)",
          padding: "2px 6px",
          fontSize: "14px",
          lineHeight: 1,
          marginLeft: "auto",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "var(--text-primary)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "var(--text-muted)";
        }}
        aria-label="Clear selection"
      >
        ✕
      </button>
    </div>
  );
}

interface BarButtonProps {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

function BarButton({ label, onClick, danger = false }: BarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: "1px solid var(--border)",
        background: "none",
        color: danger ? "var(--color-danger)" : "var(--text-secondary)",
        padding: "3px 10px",
        fontSize: "11px",
        transition: "color 0.12s, border-color 0.12s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = danger
          ? "var(--color-danger)"
          : "var(--text-muted)";
        if (!danger) {
          e.currentTarget.style.color = "var(--text-primary)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.color = danger
          ? "var(--color-danger)"
          : "var(--text-secondary)";
      }}
    >
      {label}
    </button>
  );
}

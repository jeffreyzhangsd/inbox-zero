"use client";

import { useEffect, useRef, useState } from "react";
import type { Sender, Category } from "@/types";
import { ALL_CATEGORIES } from "@/types";
import { decodeEntities, timeAgo } from "@/lib/format";

interface SenderRowProps {
  sender: Sender;
  selected: boolean;
  currentCategory?: Category;
  onSelect: (domain: string, checked: boolean) => void;
  onExpand: (sender: Sender) => void;
  onMarkRead: (emailIds: string[]) => void;
  onUnsubscribe: (sender: Sender) => void;
  onArchive: (emailIds: string[]) => void;
  onDelete: (emailIds: string[]) => void;
  onMarkSpam: (emailIds: string[]) => void;
  onRecategorize: (sender: Sender, category: Category) => void;
}

export default function SenderRow({
  sender,
  selected,
  currentCategory,
  onSelect,
  onExpand,
  onMarkRead,
  onUnsubscribe,
  onArchive,
  onDelete,
  onMarkSpam,
  onRecategorize,
}: SenderRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirm, setConfirm] = useState<"delete" | "unsub" | null>(null);
  const [pickerPos, setPickerPos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const menuRef = useRef<HTMLDivElement>(null);
  const moveToButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleOutsideClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [menuOpen]);

  useEffect(() => {
    if (!pickerPos) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (target.closest("[data-category-picker]")) return;
      setPickerPos(null);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [pickerPos]);

  const hasUnread = sender.unreadCount > 0;
  const canUnsub =
    Boolean(sender.listUnsubscribe) &&
    !sender.isUnsubscribed &&
    currentCategory !== "Unsubscribed";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "8px 12px",
        borderBottom: "1px solid var(--divider)",
        background: selected ? "var(--sidebar-active-bg)" : "transparent",
        borderLeft: selected
          ? "2px solid var(--sidebar-active-border)"
          : hasUnread
            ? "2px solid var(--unread-badge-bg, #2563eb)"
            : "2px solid transparent",
        cursor: "default",
        transition: "background 0.12s",
        position: "relative",
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          e.currentTarget.style.background = "var(--bg-hover)";
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.background = "transparent";
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        setPickerPos({ x: e.clientX, y: e.clientY });
      }}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={(e) => onSelect(sender.domain, e.target.checked)}
        style={{ flexShrink: 0, accentColor: "var(--sidebar-active-border)" }}
        aria-label={`Select ${sender.displayName}`}
      />

      <div
        style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
        onClick={() => onExpand(sender)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onExpand(sender)}
        aria-label={`View emails from ${sender.displayName}`}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            marginBottom: "1px",
          }}
        >
          <span
            style={{
              color: "var(--text-primary)",
              fontWeight: hasUnread ? 600 : 400,
              fontSize: "13px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "220px",
            }}
          >
            {sender.displayName}
          </span>

          <span
            style={{
              color: "var(--text-muted)",
              fontSize: "11px",
              flexShrink: 0,
            }}
          >
            {sender.emailCount} email{sender.emailCount !== 1 ? "s" : ""}
          </span>

          {hasUnread && (
            <span
              style={{
                background: "var(--unread-badge-bg, #2563eb)",
                color: "#fff",
                fontSize: "10px",
                borderRadius: "10px",
                padding: "0 6px",
                lineHeight: "16px",
                flexShrink: 0,
                fontWeight: 600,
              }}
            >
              {sender.unreadCount}
            </span>
          )}
        </div>

        <div
          style={{
            color: "var(--text-muted)",
            fontSize: "11px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {decodeEntities(sender.snippet)}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            color: "var(--text-muted)",
            fontSize: "11px",
            minWidth: "34px",
            textAlign: "right",
          }}
        >
          {timeAgo(sender.mostRecent)}
        </span>

        {hasUnread && (
          <ActionButton
            label="Mark read"
            onClick={() => onMarkRead(sender.emailIds)}
          />
        )}

        {canUnsub && (
          <ActionButton label="Unsub" onClick={() => setConfirm("unsub")} />
        )}

        <ActionButton
          label="move to ▸"
          buttonRef={moveToButtonRef}
          onClick={() => {
            const rect = moveToButtonRef.current?.getBoundingClientRect();
            if (rect) {
              setPickerPos({ x: rect.left, y: rect.bottom + 4 });
            }
          }}
        />

        <div ref={menuRef} style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            style={{
              border: "none",
              background: "none",
              color: "var(--text-muted)",
              padding: "2px 6px",
              fontSize: "13px",
              lineHeight: 1,
              letterSpacing: "1px",
            }}
            aria-label="More actions"
            aria-expanded={menuOpen}
          >
            ···
          </button>

          {menuOpen && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "calc(100% + 4px)",
                background: "var(--bg-container)",
                border: "1px solid var(--border)",
                zIndex: 100,
                minWidth: "130px",
                padding: "4px 0",
              }}
              role="menu"
            >
              <DropdownItem
                label="Archive"
                onClick={() => {
                  onArchive(sender.emailIds);
                  setMenuOpen(false);
                }}
              />
              <DropdownItem
                label="Delete"
                onClick={() => {
                  setConfirm("delete");
                  setMenuOpen(false);
                }}
                danger
              />
              <DropdownItem
                label="Mark as spam"
                onClick={() => {
                  onMarkSpam(sender.emailIds);
                  setMenuOpen(false);
                }}
              />
            </div>
          )}
        </div>
      </div>

      {confirm && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "var(--bg-container)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 12px",
            zIndex: 10,
          }}
        >
          <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
            {confirm === "delete"
              ? `Permanently delete ${sender.emailCount} email${sender.emailCount !== 1 ? "s" : ""} from ${sender.displayName}?`
              : `Unsubscribe from ${sender.displayName}?`}
          </span>
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              type="button"
              onClick={() => setConfirm(null)}
              style={{ fontSize: "11px" }}
            >
              cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm === "delete") onDelete(sender.emailIds);
                else onUnsubscribe(sender);
                setConfirm(null);
              }}
              style={{
                fontSize: "11px",
                color: confirm === "delete" ? "var(--color-danger)" : undefined,
                borderColor:
                  confirm === "delete" ? "var(--color-danger)" : undefined,
              }}
            >
              {confirm === "delete" ? "delete" : "unsubscribe"}
            </button>
          </div>
        </div>
      )}

      {pickerPos && (
        <CategoryPicker
          pos={pickerPos}
          currentCategory={currentCategory}
          onSelect={(category) => {
            onRecategorize(sender, category);
            setPickerPos(null);
          }}
        />
      )}
    </div>
  );
}

interface ActionButtonProps {
  label: string;
  onClick: () => void;
  buttonRef?: React.RefObject<HTMLButtonElement | null>;
}

function ActionButton({ label, onClick, buttonRef }: ActionButtonProps) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      style={{
        border: "none",
        background: "none",
        color: "var(--text-muted)",
        padding: "2px 6px",
        fontSize: "11px",
        transition: "color 0.12s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = "var(--text-primary)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = "var(--text-muted)";
      }}
    >
      {label}
    </button>
  );
}

interface DropdownItemProps {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

function DropdownItem({ label, onClick, danger = false }: DropdownItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        border: "none",
        background: "none",
        color: danger ? "var(--color-danger)" : "var(--text-secondary)",
        padding: "5px 12px",
        fontSize: "12px",
        transition: "background 0.1s, color 0.1s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--bg-hover)";
        if (!danger) {
          e.currentTarget.style.color = "var(--text-primary)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "none";
        e.currentTarget.style.color = danger
          ? "var(--color-danger)"
          : "var(--text-secondary)";
      }}
    >
      {label}
    </button>
  );
}

interface CategoryPickerProps {
  pos: { x: number; y: number };
  currentCategory?: Category;
  onSelect: (category: Category) => void;
}

function CategoryPicker({
  pos,
  currentCategory,
  onSelect,
}: CategoryPickerProps) {
  const options = ALL_CATEGORIES.filter((c) => c !== currentCategory);
  const pickerHeight = options.length * 27 + 8;
  const pickerWidth = 130;
  const left = Math.min(pos.x, window.innerWidth - pickerWidth - 8);
  const top = Math.min(pos.y, window.innerHeight - pickerHeight - 8);

  return (
    <div
      data-category-picker=""
      style={{
        position: "fixed",
        left,
        top,
        background: "var(--bg-container)",
        border: "1px solid var(--border)",
        zIndex: 200,
        minWidth: "130px",
        padding: "4px 0",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      }}
      role="menu"
      aria-label="Move to category"
    >
      {options.map((cat) => (
        <button
          key={cat}
          type="button"
          role="menuitem"
          onClick={() => onSelect(cat)}
          style={{
            display: "block",
            width: "100%",
            textAlign: "left",
            border: "none",
            background: "none",
            color: "var(--text-secondary)",
            padding: "5px 12px",
            fontSize: "12px",
            cursor: "pointer",
            transition: "background 0.1s, color 0.1s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--bg-hover)";
            e.currentTarget.style.color = "var(--text-primary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "none";
            e.currentTarget.style.color = "var(--text-secondary)";
          }}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}

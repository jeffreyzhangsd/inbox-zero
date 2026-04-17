// components/inbox/Sidebar.tsx
"use client";

import { useMemo, useState } from "react";
import { ALL_CATEGORIES, Category, CategoryGroup } from "@/types";

interface SidebarProps {
  categories: CategoryGroup[];
  activeCategory: Category | "all";
  total: number;
  totalUnread: number;
  onSelect: (cat: Category | "all") => void;
}

export default function Sidebar({
  categories,
  activeCategory,
  total,
  totalUnread,
  onSelect,
}: SidebarProps) {
  const categoryMap = useMemo(
    () => new Map<Category, CategoryGroup>(categories.map((c) => [c.name, c])),
    [categories],
  );

  return (
    <aside
      style={{
        width: "13rem",
        flexShrink: 0,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid var(--border)",
        background: "var(--bg)",
      }}
    >
      <nav style={{ flex: 1, padding: "8px 0", overflowY: "auto" }}>
        {ALL_CATEGORIES.map((cat) => {
          const group = categoryMap.get(cat);
          const unread = group?.totalUnread ?? 0;
          const senderCount = group?.senders.length ?? 0;
          const isActive = activeCategory === cat;
          const isEmpty = senderCount === 0;

          return (
            <SidebarItem
              key={cat}
              label={cat}
              unread={unread}
              isActive={isActive}
              isEmpty={isEmpty}
              onClick={() => onSelect(cat)}
            />
          );
        })}
      </nav>

      <div
        style={{
          borderTop: "1px solid var(--border)",
          padding: "8px 0",
        }}
      >
        <SidebarItem
          label="All Mail"
          unread={totalUnread}
          isActive={activeCategory === "all"}
          isEmpty={false}
          onClick={() => onSelect("all")}
          sublabel={`${total} sender${total !== 1 ? "s" : ""}`}
        />
      </div>
    </aside>
  );
}

interface SidebarItemProps {
  label: string;
  unread: number;
  isActive: boolean;
  isEmpty: boolean;
  onClick: () => void;
  sublabel?: string;
}

function SidebarItem({
  label,
  unread,
  isActive,
  isEmpty,
  onClick,
  sublabel,
}: SidebarItemProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        padding: "5px 14px",
        border: "none",
        borderLeft: isActive
          ? "2px solid var(--sidebar-active-border)"
          : "2px solid transparent",
        background: isActive
          ? "var(--sidebar-active-bg)"
          : hovered
            ? "var(--bg-hover)"
            : "transparent",
        color: isActive
          ? "var(--text-primary)"
          : hovered
            ? "var(--text-primary)"
            : isEmpty
              ? "var(--text-muted)"
              : "var(--text-secondary)",
        fontSize: "12px",
        fontFamily: "inherit",
        cursor: "pointer",
        textAlign: "left",
        transition: "background 0.12s, color 0.12s",
        borderRadius: 0,
      }}
    >
      <span style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
        <span>{label}</span>
        {sublabel && (
          <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
            {sublabel}
          </span>
        )}
      </span>
      {unread > 0 && (
        <span
          style={{
            fontSize: "10px",
            fontWeight: 500,
            color: "var(--text-primary)",
            background: "var(--bg-container)",
            border: "1px solid var(--border)",
            borderRadius: "9999px",
            padding: "0 5px",
            lineHeight: "16px",
            minWidth: "18px",
            textAlign: "center",
            flexShrink: 0,
          }}
        >
          {unread}
        </span>
      )}
    </button>
  );
}

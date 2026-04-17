// components/inbox/SearchBar.tsx
"use client";

import { useState } from "react";

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

export default function SearchBar({
  onSearch,
  placeholder = "Search senders…",
}: SearchBarProps) {
  const [value, setValue] = useState("");

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setValue(v);
    onSearch(v);
  }

  function handleClear() {
    setValue("");
    onSearch("");
  }

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
      }}
    >
      {/* Search icon */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "10px",
          color: "var(--text-muted)",
          fontSize: "12px",
          pointerEvents: "none",
          lineHeight: 1,
        }}
      >
        ⌕
      </span>

      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        aria-label="Search senders"
        style={{
          padding: value ? "6px 30px 6px 28px" : "6px 10px 6px 28px",
          background: "var(--bg-container)",
          border: "1px solid var(--border)",
          color: "var(--text-primary)",
          fontSize: "13px",
          width: "100%",
        }}
      />

      {value && (
        <button
          type="button"
          onClick={handleClear}
          title="Clear search"
          aria-label="Clear search"
          style={{
            position: "absolute",
            right: "8px",
            border: "none",
            background: "none",
            color: "var(--text-muted)",
            padding: "0 4px",
            fontSize: "13px",
            lineHeight: 1,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--text-primary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--text-muted)";
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}

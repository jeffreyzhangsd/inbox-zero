// components/inbox/SenderList.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { Sender, Category, SortBy } from "@/types";
import SenderRow from "./SenderRow";
import SearchBar from "./SearchBar";
import BulkActionBar from "./BulkActionBar";

interface SenderListProps {
  senders: Sender[];
  sortBy: SortBy;
  onSortChange: (sort: SortBy) => void;
  senderCategoryMap: Map<string, Category>;
  onExpand: (sender: Sender) => void;
  onMarkRead: (emailIds: string[]) => void;
  onUnsubscribe: (sender: Sender) => void;
  onArchive: (emailIds: string[]) => void;
  onDelete: (emailIds: string[]) => void;
  onMarkSpam: (emailIds: string[]) => void;
  onRecategorize: (sender: Sender, category: Category) => void;
}

const SORT_CYCLE: SortBy[] = ["recent", "oldest", "volume"];

export default function SenderList({
  senders,
  sortBy,
  onSortChange,
  senderCategoryMap,
  onExpand,
  onMarkRead,
  onUnsubscribe,
  onArchive,
  onDelete,
  onMarkSpam,
  onRecategorize,
}: SenderListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(
    new Set(),
  );
  // null = dialog hidden; non-null = show confirm dialog with captured ids/count
  const [pendingMarkRead, setPendingMarkRead] = useState<{
    ids: string[];
    count: number;
  } | null>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const filteredSenders = searchQuery
    ? senders.filter((s) => {
        const q = searchQuery.toLowerCase();
        return (
          s.displayName.toLowerCase().includes(q) ||
          s.domain.toLowerCase().includes(q) ||
          s.fromAddress.toLowerCase().includes(q)
        );
      })
    : senders;

  // Derived selection state
  const allSelected =
    filteredSenders.length > 0 &&
    selectedDomains.size === filteredSenders.length;
  const someSelected =
    selectedDomains.size > 0 && selectedDomains.size < filteredSenders.length;

  // Keep indeterminate state in sync (React doesn't support indeterminate as a prop)
  useEffect(() => {
    const el = selectAllRef.current;
    if (!el) return;
    el.indeterminate = someSelected;
  }, [someSelected]);

  // Clear selection when senders list changes (e.g. after a Gmail API search)
  useEffect(() => {
    setSelectedDomains(new Set());
  }, [senders]);

  function handleSelect(domain: string, checked: boolean) {
    setSelectedDomains((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(domain);
      } else {
        next.delete(domain);
      }
      return next;
    });
  }

  function handleSelectAll(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.checked) {
      setSelectedDomains(new Set(filteredSenders.map((s) => s.domain)));
    } else {
      setSelectedDomains(new Set());
    }
  }

  // Collect all emailIds for currently selected senders
  function selectedEmailIds(): string[] {
    return filteredSenders
      .filter((s) => selectedDomains.has(s.domain))
      .flatMap((s) => s.emailIds);
  }

  function handleBulkMarkRead() {
    const ids = selectedEmailIds();
    if (ids.length === 0) return;
    // Capture IDs now so dialog count and confirm action are in sync
    setPendingMarkRead({ ids, count: ids.length });
  }

  function confirmBulkMarkRead() {
    if (!pendingMarkRead) return;
    onMarkRead(pendingMarkRead.ids);
    setPendingMarkRead(null);
    setSelectedDomains(new Set());
  }

  function handleBulkArchive() {
    onArchive(selectedEmailIds());
    setSelectedDomains(new Set());
  }

  function handleBulkDelete() {
    onDelete(selectedEmailIds());
    setSelectedDomains(new Set());
  }

  function handleBulkMarkSpam() {
    onMarkSpam(selectedEmailIds());
    setSelectedDomains(new Set());
  }

  function handleSortCycle() {
    const idx = SORT_CYCLE.indexOf(sortBy);
    onSortChange(SORT_CYCLE[(idx + 1) % SORT_CYCLE.length]);
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
      {/* Search + Sort row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 12px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <SearchBar onSearch={setSearchQuery} />
        </div>
        <button
          type="button"
          onClick={handleSortCycle}
          title={`Sort: ${sortBy}`}
          style={{
            border: "1px solid var(--border)",
            background: "none",
            color: "var(--text-muted)",
            padding: "3px 8px",
            fontSize: "11px",
            cursor: "pointer",
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
        >
          {sortBy}
        </button>
      </div>

      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "6px 12px",
          borderBottom: "1px solid var(--divider)",
          flexShrink: 0,
        }}
      >
        <input
          ref={selectAllRef}
          type="checkbox"
          checked={allSelected}
          onChange={handleSelectAll}
          disabled={filteredSenders.length === 0}
          aria-label="Select all senders"
          style={{ flexShrink: 0, accentColor: "var(--sidebar-active-border)" }}
        />
        <span
          style={{
            color: "var(--text-muted)",
            fontSize: "11px",
            letterSpacing: "0.5px",
          }}
        >
          {filteredSenders.length} sender
          {filteredSenders.length !== 1 ? "s" : ""}
        </span>

        {selectedDomains.size > 0 && (
          <div style={{ marginLeft: "auto" }}>
            <BulkActionBar
              selectedCount={selectedDomains.size}
              onMarkRead={handleBulkMarkRead}
              onArchive={handleBulkArchive}
              onDelete={handleBulkDelete}
              onMarkSpam={handleBulkMarkSpam}
              onClearSelection={() => setSelectedDomains(new Set())}
            />
          </div>
        )}
      </div>

      {/* Sender rows */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {filteredSenders.length === 0 ? (
          <div
            style={{
              padding: "40px 12px",
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: "12px",
            }}
          >
            No senders found.
          </div>
        ) : (
          filteredSenders.map((sender) => (
            <SenderRow
              key={sender.domain || sender.fromAddress}
              sender={sender}
              selected={selectedDomains.has(sender.domain)}
              currentCategory={senderCategoryMap.get(
                sender.domain || sender.fromAddress,
              )}
              onSelect={handleSelect}
              onExpand={onExpand}
              onMarkRead={onMarkRead}
              onUnsubscribe={onUnsubscribe}
              onArchive={onArchive}
              onDelete={onDelete}
              onMarkSpam={onMarkSpam}
              onRecategorize={onRecategorize}
            />
          ))
        )}
      </div>

      {/* Mark read confirm dialog */}
      {pendingMarkRead !== null && (
        <ConfirmDialog
          message={`Mark all as read? This will mark ${pendingMarkRead.count} email${pendingMarkRead.count !== 1 ? "s" : ""} as read.`}
          onConfirm={confirmBulkMarkRead}
          onCancel={() => setPendingMarkRead(null)}
        />
      )}
    </div>
  );
}

interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({ message, onConfirm, onCancel }: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Move focus to Cancel button when dialog opens so keyboard users don't lose context
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  return (
    // Backdrop
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
      }}
      onClick={onCancel}
    >
      {/* Dialog box — stop propagation so clicks inside don't close */}
      <div
        style={{
          background: "var(--bg-container)",
          border: "1px solid var(--border)",
          padding: "24px",
          maxWidth: "360px",
          width: "90%",
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Confirm action"
      >
        <p
          style={{
            color: "var(--text-primary)",
            fontSize: "13px",
            marginBottom: "20px",
            lineHeight: 1.6,
          }}
        >
          {message}
        </p>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
          }}
        >
          <button ref={cancelRef} type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              background: "var(--sidebar-active-bg)",
              borderColor: "var(--sidebar-active-border)",
              color: "var(--text-primary)",
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

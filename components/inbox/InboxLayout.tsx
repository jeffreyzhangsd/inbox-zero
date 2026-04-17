// components/inbox/InboxLayout.tsx
"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import type { GroupedInbox, Category, Sender } from "@/types";
import Sidebar from "./Sidebar";
import SenderList from "./SenderList";
import ThemeToggle from "@/components/ThemeToggle";

// Fix 4: Lift constant style objects to module level
const outerContainerStyle: React.CSSProperties = {
  display: "flex",
  flex: 1,
  overflow: "hidden",
  background: "var(--bg)",
  position: "relative",
};

const innerContainerStyle: React.CSSProperties = {
  flex: 1,
  overflow: "hidden",
  position: "relative",
};

const loadingBannerStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  zIndex: 10,
  background: "var(--bg-container)",
  borderBottom: "1px solid var(--border)",
  padding: "6px 12px",
  fontSize: "11px",
  color: "var(--text-muted)",
  textAlign: "center",
};

const errorBannerStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  zIndex: 10,
  background: "var(--bg-container)",
  borderBottom: "1px solid var(--border)",
  padding: "6px 12px",
  fontSize: "11px",
  color: "var(--color-error, #c0392b)",
  textAlign: "center",
};

interface InboxLayoutProps {
  initialData: GroupedInbox;
}

export default function InboxLayout({ initialData }: InboxLayoutProps) {
  const [data, setData] = useState<GroupedInbox>(initialData);
  const [activeCategory, setActiveCategory] = useState<Category | "all">("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: session } = useSession();

  const activeSenders: Sender[] = useMemo(() => {
    if (activeCategory === "all") {
      const seen = new Set<string>();
      return data.categories
        .flatMap((c) => c.senders)
        .filter((s) => {
          if (seen.has(s.fromAddress)) return false;
          seen.add(s.fromAddress);
          return true;
        });
    }
    return (
      data.categories.find((c) => c.name === activeCategory)?.senders ?? []
    );
  }, [data, activeCategory]);

  // Fix 2: useCallback; Fix 1: handle network errors gracefully
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/emails");
      if (!res.ok) {
        setError(`Failed to load emails (${res.status})`);
        return;
      }
      const json = await res.json();
      setData(json);
    } catch {
      setError("Network error: could not load emails.");
    } finally {
      setLoading(false);
    }
  }, []);

  const applyMarkRead = useCallback((emailIds: string[]) => {
    const idSet = new Set(emailIds);
    setData((prev) => {
      const categories = prev.categories.map((cat) => {
        const senders = cat.senders.map((s) => {
          const affected = s.emailIds.filter((id) => idSet.has(id)).length;
          if (affected === 0) return s;
          return { ...s, unreadCount: Math.max(0, s.unreadCount - affected) };
        });
        return {
          ...cat,
          senders,
          totalUnread: senders.reduce((n, s) => n + s.unreadCount, 0),
        };
      });
      return {
        ...prev,
        categories,
        totalUnread: categories.reduce((n, c) => n + c.totalUnread, 0),
      };
    });
  }, []);

  const callAction = useCallback(
    async (action: string, emailIds: string[]) => {
      if (action === "markRead") {
        applyMarkRead(emailIds);
        fetch("/api/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, emailIds }),
        }).catch(() => setError("Mark read failed — reload to sync."));
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, emailIds }),
        });
        if (!res.ok) {
          setError(`Action "${action}" failed (${res.status})`);
          return;
        }
        await loadData();
      } catch {
        setError(`Network error during action "${action}".`);
      } finally {
        setLoading(false);
      }
    },
    [loadData, applyMarkRead],
  );

  // Fix 2: useCallback
  const handleSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        await loadData();
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) {
          setError(`Search failed (${res.status})`);
          return;
        }
        const json = await res.json();
        setData(json);
      } catch {
        setError("Network error: search failed.");
      } finally {
        setLoading(false);
      }
    },
    [loadData],
  );

  // Fix 3: delegate to callAction; Fix 2: useCallback
  const handleMarkRead = useCallback(
    (emailIds: string[]) => callAction("markRead", emailIds),
    [callAction],
  );

  const handleArchive = useCallback(
    (emailIds: string[]) => callAction("archive", emailIds),
    [callAction],
  );

  const handleDelete = useCallback(
    (emailIds: string[]) => callAction("delete", emailIds),
    [callAction],
  );

  const handleMarkSpam = useCallback(
    (emailIds: string[]) => callAction("spam", emailIds),
    [callAction],
  );

  // Fix 1 & 2: handleUnsubscribe stays separate (different endpoint); try/catch + res.ok + useCallback
  const handleUnsubscribe = useCallback(
    async (sender: Sender) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            emailIds: sender.emailIds,
            listUnsubscribe: sender.listUnsubscribe,
          }),
        });
        if (!res.ok) {
          setError(`Unsubscribe failed (${res.status})`);
          return;
        }
        await loadData();
      } catch {
        setError("Network error: unsubscribe failed.");
      } finally {
        setLoading(false);
      }
    },
    [loadData],
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "var(--bg)",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          height: "40px",
          flexShrink: 0,
          borderBottom: "1px solid var(--border)",
          background: "var(--bg)",
        }}
      >
        <span
          style={{
            fontSize: "12px",
            color: "var(--text-muted)",
            letterSpacing: "1px",
          }}
        >
          inbox zero
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {session?.user?.email && (
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              {session.user.email}
            </span>
          )}
          <ThemeToggle />
          <Link
            href="/settings"
            style={{ fontSize: "11px", color: "var(--text-muted)" }}
          >
            settings
          </Link>
        </div>
      </div>

      <div style={outerContainerStyle}>
        <Sidebar
          categories={data.categories}
          activeCategory={activeCategory}
          total={data.total}
          totalUnread={data.totalUnread}
          onSelect={setActiveCategory}
        />

        <div style={innerContainerStyle}>
          {/* Fix 5: role="status" + aria-live="polite" on loading banner */}
          {loading && (
            <div style={loadingBannerStyle} role="status" aria-live="polite">
              Loading…
            </div>
          )}
          {/* Fix 1: error banner */}
          {!loading && error && (
            <div style={errorBannerStyle} role="alert" aria-live="polite">
              {error}
            </div>
          )}
          <SenderList
            senders={activeSenders}
            onMarkRead={handleMarkRead}
            onUnsubscribe={handleUnsubscribe}
            onArchive={handleArchive}
            onDelete={handleDelete}
            onMarkSpam={handleMarkSpam}
            onSearch={handleSearch}
          />
        </div>
      </div>
    </div>
  );
}

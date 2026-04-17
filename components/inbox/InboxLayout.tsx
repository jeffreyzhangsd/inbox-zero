// components/inbox/InboxLayout.tsx
"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import type { GroupedInbox, Category, Sender, Email, SortBy } from "@/types";
import { categorize } from "@/lib/categorize";
import Sidebar from "./Sidebar";
import SenderList from "./SenderList";
import EmailDetail from "./EmailDetail";
import SettingsModal from "./SettingsModal";
import ThemeToggle from "@/components/ThemeToggle";

const EMPTY_INBOX: GroupedInbox = { categories: [], total: 0, totalUnread: 0 };

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

const bannerBase: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  zIndex: 10,
  background: "var(--bg-container)",
  borderBottom: "1px solid var(--border)",
  padding: "6px 12px",
  fontSize: "11px",
  textAlign: "center",
};

export default function InboxLayout() {
  const [data, setData] = useState<GroupedInbox>(EMPTY_INBOX);
  const [activeCategory, setActiveCategory] = useState<Category | "all">("all");
  const [expandedSender, setExpandedSender] = useState<Sender | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [senderOverrides, setSenderOverrides] = useState<Map<string, Category>>(
    () => {
      try {
        const raw = localStorage.getItem("inbox-zero:sender-overrides");
        if (raw) return new Map(JSON.parse(raw) as [string, Category][]);
      } catch {}
      return new Map();
    },
  );
  const [sortBy, setSortBy] = useState<SortBy>("recent");

  // streaming state
  const allEmailsRef = useRef<Email[]>([]);
  const streamDoneRef = useRef(false);
  const [streamLoaded, setStreamLoaded] = useState(0);
  const [streamDone, setStreamDone] = useState(false);

  const senderOverridesRef = useRef<Map<string, Category>>(new Map());

  useEffect(() => {
    senderOverridesRef.current = senderOverrides;
  }, [senderOverrides]);

  const { data: session } = useSession();

  // Initial progressive load via SSE
  useEffect(() => {
    const es = new EventSource("/api/emails/stream");

    es.onmessage = (e: MessageEvent) => {
      const msg = JSON.parse(e.data as string);

      if (msg.type === "batch") {
        const emails = msg.emails as Email[];
        allEmailsRef.current.push(...emails);
        setStreamLoaded(allEmailsRef.current.length);
        setData(categorize(allEmailsRef.current, senderOverridesRef.current));
      } else if (msg.type === "done") {
        streamDoneRef.current = true;
        setStreamDone(true);
        es.close();
      } else if (msg.type === "error") {
        setError(msg.message as string);
        es.close();
      }
    };

    es.onerror = () => {
      if (!streamDoneRef.current)
        setError("Failed to connect to email stream.");
      es.close();
    };

    return () => es.close();
  }, []);

  useEffect(() => {
    if (allEmailsRef.current.length > 0) {
      setData(categorize(allEmailsRef.current, senderOverrides));
    }
  }, [senderOverrides]);

  // Keep expandedSender in sync when data refreshes after actions
  useEffect(() => {
    if (!expandedSender) return;
    for (const cat of data.categories) {
      const updated = cat.senders.find(
        (s) => s.fromAddress === expandedSender.fromAddress,
      );
      if (updated) {
        setExpandedSender(updated);
        return;
      }
    }
    // All emails from this sender were removed
    setExpandedSender(null);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRecategorize = useCallback(
    (sender: Sender, category: Category) => {
      setSenderOverrides((prev) => {
        const next = new Map(prev);
        next.set(sender.domain || sender.fromAddress, category);
        try {
          localStorage.setItem(
            "inbox-zero:sender-overrides",
            JSON.stringify(Array.from(next.entries())),
          );
        } catch {}
        return next;
      });
    },
    [],
  );

  const senderCategoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    for (const cat of data.categories) {
      for (const s of cat.senders) {
        map.set(s.domain || s.fromAddress, cat.name);
      }
    }
    return map;
  }, [data]);

  const activeSenders: Sender[] = useMemo(() => {
    let senders: Sender[];
    if (activeCategory === "all") {
      const seen = new Set<string>();
      senders = data.categories
        .flatMap((c) => c.senders)
        .filter((s) => {
          const domainKey = s.domain || s.fromAddress;
          if (seen.has(domainKey)) return false;
          seen.add(domainKey);
          return true;
        });
    } else {
      senders =
        data.categories.find((c) => c.name === activeCategory)?.senders ?? [];
    }

    if (sortBy === "oldest") {
      return [...senders].sort((a, b) => a.mostRecent - b.mostRecent);
    }
    if (sortBy === "volume") {
      return [...senders].sort((a, b) => b.emailCount - a.emailCount);
    }
    // "recent": flatMap interleaves per-category sorted lists, so re-sort globally
    return [...senders].sort((a, b) => b.mostRecent - a.mostRecent);
  }, [data, activeCategory, sortBy]);

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
    // Keep ref in sync so SSE re-categorize doesn't undo the optimistic update
    allEmailsRef.current = allEmailsRef.current.map((e) =>
      idSet.has(e.id) ? { ...e, isRead: true } : e,
    );
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

  const handleMarkRead = useCallback(
    (emailIds: string[]) => callAction("markRead", emailIds),
    [callAction],
  );
  const handleMarkUnread = useCallback(
    (emailIds: string[]) => callAction("markUnread", emailIds),
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
            fromAddress: sender.fromAddress,
            listUnsubscribe: sender.listUnsubscribe,
          }),
        });
        if (!res.ok) {
          setError(`Unsubscribe failed (${res.status})`);
          return;
        }
        handleRecategorize(sender, "Unsubscribed");
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
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span
            style={{
              fontSize: "12px",
              color: "var(--text-muted)",
              letterSpacing: "1px",
            }}
          >
            inbox zero
          </span>
          {!streamDone && !error && (
            <span
              style={{
                fontSize: "11px",
                color: "var(--text-muted)",
                opacity: 0.7,
              }}
            >
              {`loading… ${streamLoaded} emails`}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {session?.user?.email && (
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              {session.user.email}
            </span>
          )}
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            style={{
              border: "none",
              background: "none",
              fontSize: "11px",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: 0,
            }}
          >
            settings
          </button>
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
          {loading && (
            <div
              style={{ ...bannerBase, color: "var(--text-muted)" }}
              role="status"
              aria-live="polite"
            >
              Loading…
            </div>
          )}
          {!loading && error && (
            <div
              style={{
                ...bannerBase,
                color: "var(--color-error, #c0392b)",
              }}
              role="alert"
              aria-live="polite"
            >
              {error}
            </div>
          )}
          {expandedSender ? (
            <EmailDetail
              sender={expandedSender}
              onBack={() => setExpandedSender(null)}
              onMarkRead={handleMarkRead}
              onMarkUnread={handleMarkUnread}
              onArchive={handleArchive}
              onDelete={handleDelete}
              onMarkSpam={handleMarkSpam}
            />
          ) : (
            <SenderList
              senders={activeSenders}
              sortBy={sortBy}
              onSortChange={setSortBy}
              senderCategoryMap={senderCategoryMap}
              onExpand={setExpandedSender}
              onMarkRead={handleMarkRead}
              onUnsubscribe={handleUnsubscribe}
              onArchive={handleArchive}
              onDelete={handleDelete}
              onMarkSpam={handleMarkSpam}
              onRecategorize={handleRecategorize}
            />
          )}
        </div>
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}

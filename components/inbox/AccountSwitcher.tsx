"use client";

interface AccountSwitcherProps {
  accounts: string[];
  activeAccount: string;
}

const COLORS = ["#4A90E2", "#7B68EE", "#50C878", "#E67E22"];

export default function AccountSwitcher({
  accounts,
  activeAccount,
}: AccountSwitcherProps) {
  async function switchAccount(email: string) {
    await fetch("/api/accounts/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    window.location.reload();
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <span
        style={{
          fontSize: "11px",
          color: "var(--text-muted)",
          maxWidth: "160px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {activeAccount}
      </span>
      {accounts.map((email, i) => {
        const isActive = email === activeAccount;
        const initial = email[0]?.toUpperCase() ?? "?";
        const color = COLORS[i % COLORS.length];
        return (
          <button
            key={email}
            type="button"
            title={email}
            onClick={() => {
              if (!isActive) void switchAccount(email);
            }}
            style={{
              width: "22px",
              height: "22px",
              borderRadius: "50%",
              border: `2px solid ${color}`,
              background: isActive ? color : "transparent",
              color: isActive ? "#fff" : color,
              fontSize: "10px",
              fontWeight: "600",
              cursor: isActive ? "default" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              flexShrink: 0,
              lineHeight: 1,
            }}
          >
            {initial}
          </button>
        );
      })}
      {accounts.length < 4 && (
        <button
          type="button"
          title="Add account"
          onClick={() => {
            window.location.href = "/api/accounts/add";
          }}
          style={{
            width: "22px",
            height: "22px",
            borderRadius: "50%",
            border: "2px dashed var(--text-muted)",
            background: "transparent",
            color: "var(--text-muted)",
            fontSize: "14px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          +
        </button>
      )}
    </div>
  );
}

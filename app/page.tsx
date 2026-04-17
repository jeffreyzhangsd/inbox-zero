// app/page.tsx
"use client";

import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const [password, setPassword] = useState("");
  const [gatePassed, setGatePassed] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { status } = useSession();
  const router = useRouter();

  // Check if gate cookie already valid (e.g. returning user after OAuth redirect)
  useEffect(() => {
    fetch("/api/gate").then(async (res) => {
      if (res.ok) setGatePassed(true);
    });
  }, []);

  useEffect(() => {
    if (gatePassed && status === "authenticated") {
      router.replace("/inbox");
    }
  }, [gatePassed, status, router]);

  async function handleGate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/gate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (res.ok) {
      setGatePassed(true);
    } else {
      setError("Incorrect password.");
    }
  }

  return (
    <main
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
      }}
    >
      <div style={{ width: "320px" }}>
        <h1
          style={{
            fontSize: "14px",
            color: "var(--text-primary)",
            letterSpacing: "1px",
            marginBottom: "24px",
          }}
        >
          inbox zero
        </h1>
        {!gatePassed ? (
          <form
            onSubmit={handleGate}
            style={{ display: "flex", flexDirection: "column", gap: "10px" }}
          >
            <p className="subtitle">Enter password to continue.</p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password"
              autoFocus
            />
            {error && <p className="error">{error}</p>}
            <button type="submit" disabled={loading}>
              {loading ? "checking..." : "continue →"}
            </button>
          </form>
        ) : status === "loading" ? (
          <p className="subtitle">loading...</p>
        ) : status === "authenticated" ? (
          <p className="subtitle">redirecting...</p>
        ) : (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "10px" }}
          >
            <p className="subtitle">Connect your Gmail account.</p>
            <button onClick={() => signIn("google", { callbackUrl: "/inbox" })}>
              sign in with Google →
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

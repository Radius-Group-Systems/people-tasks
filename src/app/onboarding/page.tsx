"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreateOrg(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: orgName }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create organization");
        setLoading(false);
        return;
      }

      // Force session refresh by reloading
      window.location.href = "/";
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-6 p-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Welcome to PeopleTasks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create your organization to get started
          </p>
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
            {error}
          </div>
        )}

        <form onSubmit={handleCreateOrg} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="orgName" className="text-sm font-medium">
              Organization name
            </label>
            <input
              id="orgName"
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="My Team"
              className="w-full px-3 py-2 border rounded-md bg-background text-sm"
              required
            />
            <p className="text-xs text-muted-foreground">
              This is where your team&apos;s people, tasks, and encounters will live.
            </p>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create organization"}
          </button>
        </form>
      </div>
    </div>
  );
}

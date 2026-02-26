"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MailIcon, InboxIcon, CheckCircle2Icon, AlertCircleIcon } from "lucide-react";

interface EmailSettings {
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_pass: string;
  from_name: string;
  from_email: string;
  imap_host: string;
  imap_port: number;
  imap_user: string;
  imap_pass: string;
  imap_label: string;
}

const DEFAULT_SETTINGS: EmailSettings = {
  smtp_host: "smtp.gmail.com",
  smtp_port: 587,
  smtp_user: "",
  smtp_pass: "",
  from_name: "",
  from_email: "",
  imap_host: "imap.gmail.com",
  imap_port: 993,
  imap_user: "",
  imap_pass: "",
  imap_label: "PeopleTasks",
};

export default function SettingsPage() {
  const [email, setEmail] = useState<EmailSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.email) {
          setEmail({ ...DEFAULT_SETTINGS, ...data.email });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setMessage({ type: "success", text: "Settings saved." });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  async function handleTestSend() {
    setTesting(true);
    setMessage(null);
    try {
      // Save first
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          test: true,
          to: email.from_email,
          subject: "PeopleTasks - Test Email",
          text: "This is a test email from PeopleTasks. If you received this, your SMTP settings are working correctly.",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Test failed");
      }

      setMessage({ type: "success", text: `Test email sent to ${email.from_email}` });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Test failed" });
    } finally {
      setTesting(false);
    }
  }

  async function handleImportEmails() {
    setImporting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/email/import", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");

      const parts = [];
      if (data.imported > 0) parts.push(`${data.imported} email${data.imported !== 1 ? "s" : ""} imported`);
      if (data.skipped > 0) parts.push(`${data.skipped} skipped (already imported)`);
      if (data.errors?.length > 0) parts.push(`${data.errors.length} error${data.errors.length !== 1 ? "s" : ""}`);

      // Add debug info
      if (data.debug) {
        const d = data.debug;
        parts.push(`(mailbox: "${d.mailbox}", ${d.totalInMailbox} message${d.totalInMailbox !== 1 ? "s" : ""} in label, ${d.fetched} fetched)`);
      }

      setMessage({
        type: data.errors?.length > 0 ? "error" : data.imported > 0 ? "success" : "success",
        text: parts.join(", ") || "No emails found in label",
      });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Import failed" });
    } finally {
      setImporting(false);
    }
  }

  function updateEmail(field: keyof EmailSettings, value: string | number) {
    setEmail((prev) => ({ ...prev, [field]: value }));
  }

  if (loading) return <div className="text-muted-foreground">Loading settings...</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Settings</h1>

      {message && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
          message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {message.type === "success" ? <CheckCircle2Icon className="w-4 h-4" /> : <AlertCircleIcon className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {/* Sending */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MailIcon className="w-5 h-5" />
            Sending (Gmail SMTP)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Use a Gmail App Password. Go to{" "}
            <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-primary underline">
              Google App Passwords
            </a>{" "}
            to generate one (requires 2FA).
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Your Name</Label>
              <Input
                value={email.from_name}
                onChange={(e) => updateEmail("from_name", e.target.value)}
                placeholder="Jeff Cooper"
              />
            </div>
            <div>
              <Label>Your Email</Label>
              <Input
                value={email.from_email}
                onChange={(e) => updateEmail("from_email", e.target.value)}
                placeholder="you@gmail.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>SMTP Host</Label>
              <Input
                value={email.smtp_host}
                onChange={(e) => updateEmail("smtp_host", e.target.value)}
                placeholder="smtp.gmail.com"
              />
            </div>
            <div>
              <Label>SMTP Port</Label>
              <Input
                type="number"
                value={email.smtp_port}
                onChange={(e) => updateEmail("smtp_port", parseInt(e.target.value) || 587)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>SMTP Username</Label>
              <Input
                value={email.smtp_user}
                onChange={(e) => updateEmail("smtp_user", e.target.value)}
                placeholder="you@gmail.com"
              />
            </div>
            <div>
              <Label>SMTP Password (App Password)</Label>
              <Input
                type="password"
                value={email.smtp_pass}
                onChange={(e) => updateEmail("smtp_pass", e.target.value)}
                placeholder="xxxx xxxx xxxx xxxx"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Receiving */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <InboxIcon className="w-5 h-5" />
            Receiving (Gmail IMAP)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Create a Gmail label (e.g. &ldquo;PeopleTasks&rdquo;) and move/filter emails there.
            The app will import emails from that label as encounters (read or unread).
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>IMAP Host</Label>
              <Input
                value={email.imap_host}
                onChange={(e) => updateEmail("imap_host", e.target.value)}
                placeholder="imap.gmail.com"
              />
            </div>
            <div>
              <Label>IMAP Port</Label>
              <Input
                type="number"
                value={email.imap_port}
                onChange={(e) => updateEmail("imap_port", parseInt(e.target.value) || 993)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>IMAP Username</Label>
              <Input
                value={email.imap_user}
                onChange={(e) => updateEmail("imap_user", e.target.value)}
                placeholder="you@gmail.com"
              />
            </div>
            <div>
              <Label>IMAP Password (App Password)</Label>
              <Input
                type="password"
                value={email.imap_pass}
                onChange={(e) => updateEmail("imap_pass", e.target.value)}
                placeholder="xxxx xxxx xxxx xxxx"
              />
            </div>
          </div>

          <div>
            <Label>Gmail Label to Poll</Label>
            <Input
              value={email.imap_label}
              onChange={(e) => updateEmail("imap_label", e.target.value)}
              placeholder="PeopleTasks"
            />
            <p className="text-xs text-muted-foreground mt-1">
              All emails in this label will be imported (duplicates are skipped automatically).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </Button>
        <Button variant="outline" onClick={handleTestSend} disabled={testing || !email.from_email}>
          {testing ? "Sending..." : "Send Test Email"}
        </Button>
        <Button variant="outline" onClick={handleImportEmails} disabled={importing || !email.imap_user}>
          {importing ? "Importing..." : "Import Emails Now"}
        </Button>
      </div>
    </div>
  );
}

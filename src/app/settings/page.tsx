"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MailIcon, InboxIcon, CheckCircle2Icon, AlertCircleIcon, CalendarIcon, RefreshCwIcon, LinkIcon, MessageSquareIcon, SmartphoneIcon, UsersIcon, LogOutIcon, TrashIcon } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { PersonAvatar } from "@/components/person-avatar";

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

interface OrgMember {
  user_id: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
  created_at: string;
}

interface OrgInvite {
  id: string;
  email: string;
  role: string;
  inviter_name: string;
  expires_at: string;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const [email, setEmail] = useState<EmailSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [calendarConnected, setCalendarConnected] = useState<boolean | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Org management state
  const [orgName, setOrgName] = useState("");
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [invites, setInvites] = useState<OrgInvite[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);

  // SMS state
  const [smsPhone, setSmsPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [smsVerified, setSmsVerified] = useState(false);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [smsSendingCode, setSmsSendingCode] = useState(false);
  const [smsVerifying, setSmsVerifying] = useState(false);

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

    // Check calendar connection status
    fetch("/api/calendar/status")
      .then((r) => r.json())
      .then((data) => setCalendarConnected(data.connected))
      .catch(() => setCalendarConnected(false));

    // Load SMS preferences
    fetch("/api/sms/preferences")
      .then((r) => r.json())
      .then((data) => {
        if (data.phone) setSmsPhone(data.phone);
        setSmsVerified(!!data.phone_verified);
        setSmsEnabled(!!data.sms_notifications_enabled);
      })
      .catch(() => {});

    // Load org info and members
    fetch("/api/org")
      .then((r) => r.json())
      .then((data) => { if (data.name) setOrgName(data.name); })
      .catch(console.error);
    fetchMembers();
    fetchInvites();
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

  async function handleCalendarSync() {
    setSyncing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/calendar/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      setMessage({ type: "success", text: `Synced ${data.synced} of ${data.total} calendar events.` });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Calendar sync failed" });
    } finally {
      setSyncing(false);
    }
  }

  async function fetchMembers() {
    try {
      const res = await fetch("/api/org/members");
      if (res.ok) setMembers(await res.json());
    } catch { /* ignore */ }
  }

  async function fetchInvites() {
    try {
      const res = await fetch("/api/org/invites");
      if (res.ok) setInvites(await res.json());
    } catch { /* ignore */ }
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await fetch("/api/org/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      if (!res.ok) {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to invite" });
      } else {
        setMessage({ type: "success", text: `Invitation sent to ${inviteEmail}` });
        setInviteEmail("");
        fetchInvites();
      }
    } catch {
      setMessage({ type: "error", text: "Failed to send invite" });
    } finally {
      setInviting(false);
    }
  }

  async function handleRemoveMember(userId: string) {
    try {
      const res = await fetch("/api/org/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      if (res.ok) {
        fetchMembers();
        setMessage({ type: "success", text: "Member removed" });
      }
    } catch { /* ignore */ }
  }

  async function handleCancelInvite(inviteId: string) {
    try {
      const res = await fetch("/api/org/invites", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invite_id: inviteId }),
      });
      if (res.ok) {
        fetchInvites();
        setMessage({ type: "success", text: "Invite cancelled" });
      }
    } catch { /* ignore */ }
  }

  async function handleSmsSendCode() {
    if (!smsPhone.trim()) return;
    setSmsSendingCode(true);
    setMessage(null);
    try {
      const res = await fetch("/api/sms/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: smsPhone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send code");
      setSmsVerified(false);
      setMessage({ type: "success", text: `Verification code sent to ${data.phone}` });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to send code" });
    } finally {
      setSmsSendingCode(false);
    }
  }

  async function handleSmsVerify() {
    if (!smsCode.trim()) return;
    setSmsVerifying(true);
    setMessage(null);
    try {
      const res = await fetch("/api/sms/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: smsCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      setSmsVerified(true);
      setSmsCode("");
      setMessage({ type: "success", text: "Phone verified!" });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Verification failed" });
    } finally {
      setSmsVerifying(false);
    }
  }

  async function handleSmsToggle(enabled: boolean) {
    try {
      const res = await fetch("/api/sms/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sms_notifications_enabled: enabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      setSmsEnabled(data.sms_notifications_enabled);
      setMessage({ type: "success", text: enabled ? "SMS reminders enabled" : "SMS reminders disabled" });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Update failed" });
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

      {/* Google Calendar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            Google Calendar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${calendarConnected ? "bg-green-500" : "bg-gray-300"}`} />
            <span className="text-sm">
              {calendarConnected === null
                ? "Checking..."
                : calendarConnected
                  ? "Connected"
                  : "Not connected"}
            </span>
          </div>

          {!calendarConnected && (
            <p className="text-sm text-muted-foreground">
              To connect Google Calendar, add <code className="bg-muted px-1 py-0.5 rounded text-xs">GOOGLE_CLIENT_ID</code> and{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-xs">GOOGLE_CLIENT_SECRET</code> to your{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-xs">.env.local</code> file, then click Connect below.
            </p>
          )}

          <div className="flex items-center gap-3">
            {!calendarConnected && (
              <Button variant="outline" asChild>
                <a href="/api/calendar/auth">
                  <LinkIcon className="w-4 h-4 mr-2" />
                  Connect Google Calendar
                </a>
              </Button>
            )}
            {calendarConnected && (
              <Button variant="outline" onClick={handleCalendarSync} disabled={syncing}>
                <RefreshCwIcon className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Syncing..." : "Sync Now"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

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

      {/* Slack */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquareIcon className="w-5 h-5" />
            Slack Integration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            To send task reminders via Slack, add a <code className="bg-muted px-1 py-0.5 rounded text-xs">SLACK_BOT_TOKEN</code> to your{" "}
            <code className="bg-muted px-1 py-0.5 rounded text-xs">.env.local</code> file.
          </p>
          <p className="text-sm text-muted-foreground">
            Create a Slack app at{" "}
            <a href="https://api.slack.com/apps" target="_blank" rel="noreferrer" className="text-primary underline">
              api.slack.com/apps
            </a>{" "}
            with <code className="bg-muted px-1 py-0.5 rounded text-xs">chat:write</code> and{" "}
            <code className="bg-muted px-1 py-0.5 rounded text-xs">users:read.email</code> scopes, then install it
            to your workspace.
          </p>
          <p className="text-sm text-muted-foreground">
            Set each person&apos;s Slack handle on their profile page so tasks can be sent directly to them.
          </p>
        </CardContent>
      </Card>

      {/* SMS Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <SmartphoneIcon className="w-5 h-5" />
            SMS Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Receive SMS reminders for due and overdue tasks. Verify your phone number to get started.
          </p>

          {/* Phone input + Send Code */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Label>Phone Number</Label>
              <Input
                value={smsPhone}
                onChange={(e) => setSmsPhone(e.target.value)}
                placeholder="+1 (555) 123-4567"
                disabled={smsVerified}
              />
            </div>
            <div className="flex items-end">
              {!smsVerified ? (
                <Button
                  variant="outline"
                  onClick={handleSmsSendCode}
                  disabled={smsSendingCode || !smsPhone.trim()}
                >
                  {smsSendingCode ? "Sending..." : "Send Code"}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => { setSmsVerified(false); setSmsEnabled(false); }}
                >
                  Change
                </Button>
              )}
            </div>
          </div>

          {/* Verification code input */}
          {!smsVerified && smsPhone && (
            <div className="flex gap-2">
              <div className="flex-1">
                <Label>Verification Code</Label>
                <Input
                  value={smsCode}
                  onChange={(e) => setSmsCode(e.target.value)}
                  placeholder="123456"
                  maxLength={6}
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={handleSmsVerify}
                  disabled={smsVerifying || smsCode.length < 6}
                >
                  {smsVerifying ? "Verifying..." : "Verify"}
                </Button>
              </div>
            </div>
          )}

          {/* Verified badge */}
          {smsVerified && (
            <div className="flex items-center gap-2 text-sm text-green-700">
              <CheckCircle2Icon className="w-4 h-4" />
              Phone verified
            </div>
          )}

          {/* Enable SMS reminders toggle */}
          {smsVerified && (
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">SMS Reminders</div>
                <div className="text-xs text-muted-foreground">
                  Get notified about due and overdue tasks
                </div>
              </div>
              <Button
                variant={smsEnabled ? "default" : "outline"}
                size="sm"
                onClick={() => handleSmsToggle(!smsEnabled)}
              >
                {smsEnabled ? "Enabled" : "Disabled"}
              </Button>
            </div>
          )}
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

      {/* Organization */}
      {session?.user.role === "admin" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <UsersIcon className="w-5 h-5" />
              Organization
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label>Organization Name</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="My Team"
                />
                <Button
                  variant="outline"
                  onClick={async () => {
                    const res = await fetch("/api/org", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name: orgName }),
                    });
                    if (res.ok) setMessage({ type: "success", text: "Organization name updated" });
                  }}
                >
                  Update
                </Button>
              </div>
            </div>

            {/* Members */}
            <div>
              <h3 className="text-sm font-medium mb-2">Members</h3>
              <div className="space-y-2">
                {members.map((m) => (
                  <div key={m.user_id} className="flex items-center justify-between p-2 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <PersonAvatar name={m.name || m.email} photoUrl={m.image || undefined} size="sm" />
                      <div>
                        <div className="text-sm font-medium">{m.name || m.email}</div>
                        <div className="text-xs text-muted-foreground">{m.email}</div>
                      </div>
                      <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{m.role}</span>
                    </div>
                    {m.user_id !== session.user.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveMember(m.user_id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Invite form */}
            <div>
              <h3 className="text-sm font-medium mb-2">Invite Member</h3>
              <div className="flex gap-2">
                <Input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="flex-1"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="px-2 py-1 border rounded-md text-sm bg-background"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
                  {inviting ? "Inviting..." : "Invite"}
                </Button>
              </div>
            </div>

            {/* Pending invites */}
            {invites.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2">Pending Invites</h3>
                <div className="space-y-2">
                  {invites.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between p-2 rounded-lg border">
                      <div>
                        <div className="text-sm">{inv.email}</div>
                        <div className="text-xs text-muted-foreground">
                          {inv.role} &middot; expires {new Date(inv.expires_at).toLocaleDateString()}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancelInvite(inv.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        Cancel
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Account */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {session?.user && (
            <div className="flex items-center gap-3">
              <PersonAvatar name={session.user.name || "User"} photoUrl={session.user.image || undefined} size="sm" />
              <div>
                <div className="text-sm font-medium">{session.user.name}</div>
                <div className="text-xs text-muted-foreground">{session.user.email}</div>
              </div>
            </div>
          )}
          <Button
            variant="outline"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="gap-2"
          >
            <LogOutIcon className="w-4 h-4" />
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

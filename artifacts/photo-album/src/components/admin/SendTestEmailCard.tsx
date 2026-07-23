import { useState } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Status = "idle" | "sending" | "sent" | "error";

// Superadmin diagnostic card: emails the signed-in platform admin a test
// message to confirm SMTP delivery. Same-origin fetch, so the session cookie
// authenticates the request against the requireAdmin-gated route.
export function SendTestEmailCard() {
  const [status, setStatus] = useState<Status>("idle");
  const [detail, setDetail] = useState<string>("");

  async function send() {
    setStatus("sending");
    setDetail("");
    try {
      const res = await fetch("/api/admin/test-email", { method: "POST" });
      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; to?: string; configured?: boolean }
        | null;
      if (!res.ok || !body) {
        setStatus("error");
        setDetail("Request failed. Are you signed in as a platform admin?");
        return;
      }
      if (!body.configured) {
        setStatus("error");
        setDetail("SMTP isn't configured on this server (set SMTP_HOST/USER/PASS).");
        return;
      }
      if (body.ok) {
        setStatus("sent");
        setDetail(`Sent to ${body.to}. Check your inbox (and spam on first sends).`);
      } else {
        setStatus("error");
        setDetail("SMTP is configured but the send failed — check the server logs.");
      }
    } catch {
      setStatus("error");
      setDetail("Couldn't reach the server.");
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4" data-testid="send-test-email-card">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 shrink-0 rounded-lg bg-amber-500/10 flex items-center justify-center">
          <Mail className="h-[18px] w-[18px] text-amber-500" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground">Send test email</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Email yourself a test message to verify SMTP delivery.
          </p>
          {detail && (
            <p
              className={cn(
                "text-xs mt-2",
                status === "sent"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : status === "error"
                    ? "text-destructive"
                    : "text-muted-foreground",
              )}
              data-testid="send-test-email-result"
            >
              {detail}
            </p>
          )}
        </div>
        <Button
          size="sm"
          onClick={send}
          disabled={status === "sending"}
          data-testid="send-test-email-btn"
        >
          {status === "sending" ? "Sending…" : "Send"}
        </Button>
      </div>
    </div>
  );
}

import { useGetSettingsStatus } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Database, Brain, Github, Clock, CheckCircle2, XCircle, AlertCircle,
  Terminal, Key, GitBranch, RefreshCw, Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

function StatusBadge({ ok, label }: { ok: boolean; label?: string }) {
  return ok ? (
    <Badge className="gap-1 bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30">
      <CheckCircle2 className="h-3 w-3" />
      {label ?? "Connected"}
    </Badge>
  ) : (
    <Badge className="gap-1 bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30" variant="outline">
      <XCircle className="h-3 w-3" />
      {label ?? "Not configured"}
    </Badge>
  );
}

function Row({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-border/50 last:border-0">
      <div>
        <p className="text-sm font-medium font-mono">{label}</p>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      <div className="shrink-0">{value}</div>
    </div>
  );
}

export default function Settings() {
  const { data: status, isLoading, refetch, isFetching } = useGetSettingsStatus();
  const queryClient = useQueryClient();

  const handleRefresh = async () => {
    await refetch();
    toast.success("Status refreshed");
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-sans">System Settings</h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">
            Integration status and configuration reference
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4">
        {/* Database */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4 text-primary" />
              Database
            </CardTitle>
            <CardDescription>PostgreSQL via Replit — automatically provisioned</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <Row
                label="Connection"
                value={<StatusBadge ok={status?.database.connected ?? false} label={status?.database.connected ? "Healthy" : "Unreachable"} />}
                hint="Drizzle ORM · PostgreSQL 16"
              />
            )}
          </CardContent>
        </Card>

        {/* AI */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="h-4 w-4 text-primary" />
              AI Content Generation
            </CardTitle>
            <CardDescription>
              Groq (llama-3.1-8b-instant) or OpenAI-compatible. Free key at{" "}
              <a href="https://console.groq.com" target="_blank" rel="noopener noreferrer" className="underline text-primary">
                console.groq.com
              </a>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-48" />
            ) : (
              <>
                <Row
                  label="GROQ_API_KEY"
                  value={<StatusBadge ok={status?.groq.configured ?? false} label={status?.groq.configured ? "Set" : "Not set"} />}
                  hint={status?.groq.keyHint ? `Key: ${status.groq.keyHint}` : "Set in Replit Secrets tab → GROQ_API_KEY"}
                />
                {status?.groq.model && (
                  <Row
                    label="Model"
                    value={<Badge variant="outline" className="font-mono text-xs">{status.groq.model}</Badge>}
                  />
                )}
                {!status?.groq.configured && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-700 dark:text-amber-400">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      Without a key, Compose will return mock content. AI generation still works — just not with a real model.
                      Add <code className="font-mono bg-amber-500/10 px-1 rounded">GROQ_API_KEY</code> in the Secrets tab (lock icon in sidebar).
                    </span>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* GitHub */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Github className="h-4 w-4 text-primary" />
              GitHub Auto-Push
            </CardTitle>
            <CardDescription>
              Automatically syncs code to GitHub on every checkpoint (git commit).
              Token needs <code className="font-mono text-xs bg-muted px-1 rounded">repo</code> scope.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <>
                <Row
                  label="GITHUB_TOKEN"
                  value={<StatusBadge ok={status?.github.tokenSet ?? false} label={status?.github.tokenSet ? "Set" : "Not set"} />}
                  hint="Personal Access Token with repo scope"
                />
                <Row
                  label="GITHUB_REPO"
                  value={
                    status?.github.repo
                      ? <Badge variant="outline" className="font-mono text-xs gap-1"><GitBranch className="h-3 w-3" />{status.github.repo}</Badge>
                      : <Badge variant="outline" className="text-muted-foreground text-xs">Not set</Badge>
                  }
                  hint='Format: "owner/repo" — e.g. alice/socialcommander'
                />
                <Row
                  label="Auto-push"
                  value={<StatusBadge ok={status?.github.autoPushEnabled ?? false} label={status?.github.autoPushEnabled ? "Active" : "Disabled"} />}
                  hint="Push log: /tmp/github-autopush.log"
                />
                {!status?.github.autoPushEnabled && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg bg-muted/50 border border-border p-3 text-xs text-muted-foreground">
                    <Info className="h-4 w-4 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">To enable auto-push:</p>
                      <ol className="list-decimal ml-4 space-y-1">
                        <li>Open the Secrets tab (lock icon in Replit sidebar)</li>
                        <li>Add <code className="font-mono bg-muted px-1 rounded">GITHUB_TOKEN</code> — PAT with repo scope</li>
                        <li>Add <code className="font-mono bg-muted px-1 rounded">GITHUB_REPO</code> — e.g. <code className="font-mono bg-muted px-1 rounded">alice/socialcommander</code></li>
                        <li>Every checkpoint will now push automatically</li>
                      </ol>
                      <p className="mt-1">Or run manually: <code className="font-mono bg-muted px-1 rounded">pnpm --filter @workspace/scripts run push-to-github</code></p>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Scheduler */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-primary" />
              Background Scheduler
            </CardTitle>
            <CardDescription>In-process 30-second polling loop — processes due queue jobs</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <Row
                  label="Status"
                  value={<StatusBadge ok={status?.scheduler.running ?? false} label="Running" />}
                  hint={`Poll interval: ${status?.scheduler.intervalSeconds ?? 30}s · BullMQ-ready (swap when Redis available)`}
                />
              </>
            )}
          </CardContent>
        </Card>

        {/* Keyboard shortcuts */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Terminal className="h-4 w-4 text-primary" />
              Keyboard Shortcuts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              {[
                ["N", "Compose new post (from Dashboard)"],
                ["⌘K / Ctrl+K", "Open command palette"],
                ["Esc", "Close dialogs / palette"],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center gap-3 col-span-2">
                  <kbd className="px-2 py-0.5 bg-muted border border-border rounded text-xs font-mono min-w-[60px] text-center">{key}</kbd>
                  <span className="text-muted-foreground">{desc}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

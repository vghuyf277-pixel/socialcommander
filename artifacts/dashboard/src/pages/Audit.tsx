import { useState, useEffect } from "react";
import { useListAuditLogs, useListAccounts } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { Search, Shield, Download, RadioReceiver } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function Audit() {
  const [accountId, setAccountId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [isLive, setIsLive] = useState(false);

  const { data: accounts } = useListAccounts();
  
  const { data: logs, isLoading, refetch } = useListAuditLogs({
    accountId: accountId === "all" ? undefined : Number(accountId),
    action: actionFilter === "all" ? undefined : actionFilter,
    limit: 100
  });

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLive) {
      interval = setInterval(() => {
        refetch();
      }, 10000);
    }
    return () => clearInterval(interval);
  }, [isLive, refetch]);

  const filteredLogs = logs?.filter(log => 
    !search || 
    log.action.toLowerCase().includes(search.toLowerCase()) || 
    (log.details && log.details.toLowerCase().includes(search.toLowerCase()))
  );

  const handleExport = () => {
    if (!filteredLogs) return;
    const csv = [
      "Timestamp,IP Address,Action,Account ID,Details",
      ...filteredLogs.map(l => `"${l.createdAt}","${l.ipAddress || 'System'}","${l.action}","${l.accountId || ''}","${(l.details || '').replace(/"/g, '""')}"`)
    ].join("\n");
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getActionColor = (action: string) => {
    if (action.includes('created')) return "bg-green-500/10 text-green-500 border-green-500/20";
    if (action.includes('deleted') || action.includes('failed')) return "bg-red-500/10 text-red-500 border-red-500/20";
    if (action.includes('updated') || action.includes('scheduled')) return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    if (action.includes('published')) return "bg-purple-500/10 text-purple-500 border-purple-500/20";
    if (action.includes('status_changed')) return "bg-amber-500/10 text-amber-500 border-amber-500/20";
    return "bg-muted text-foreground border-muted-foreground/20";
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-sans">Audit Trail</h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">Immutable record of all system actions.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 border rounded-md bg-card">
            <RadioReceiver className={`h-4 w-4 ${isLive ? 'text-green-500 animate-pulse' : 'text-muted-foreground'}`} />
            <Label htmlFor="live-mode" className="text-xs uppercase font-mono tracking-wider cursor-pointer">Live Feed</Label>
            <Switch id="live-mode" checked={isLive} onCheckedChange={setIsLive} />
          </div>
          <Button variant="outline" className="gap-2" onClick={handleExport} disabled={!filteredLogs || filteredLogs.length === 0}>
            <Download className="h-4 w-4 text-primary" />
            Export CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b pb-4 gap-4 space-y-0 bg-muted/10">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="relative w-full sm:w-[300px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search audit logs..." 
                className="pl-9 h-9 text-sm bg-background"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {filteredLogs && (
              <div className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                Showing {filteredLogs.length} of {logs?.length || 0} entries
              </div>
            )}
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="w-[160px] h-9 text-xs bg-background">
                <SelectValue placeholder="All Accounts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Accounts</SelectItem>
                {accounts?.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id.toString()}>
                    {acc.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[180px] h-9 text-xs bg-background">
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="post_published">Post Published</SelectItem>
                <SelectItem value="post_scheduled">Post Scheduled</SelectItem>
                <SelectItem value="post_failed">Post Failed</SelectItem>
                <SelectItem value="account_created">Account Created</SelectItem>
                <SelectItem value="account_updated">Account Updated</SelectItem>
                <SelectItem value="account_deleted">Account Deleted</SelectItem>
                <SelectItem value="account_status_changed">Status Changed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-[180px] font-mono text-xs text-muted-foreground uppercase tracking-wider">Timestamp</TableHead>
                <TableHead className="w-[120px] font-mono text-xs text-muted-foreground uppercase tracking-wider">IP Address</TableHead>
                <TableHead className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Action</TableHead>
                <TableHead className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Target</TableHead>
                <TableHead className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(10)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  </TableRow>
                ))
              ) : filteredLogs && filteredLogs.length > 0 ? (
                filteredLogs.map(log => {
                  const account = accounts?.find(a => a.id === log.accountId);
                  return (
                    <TableRow key={log.id} className="hover:bg-muted/20">
                      <TableCell className="font-mono text-xs whitespace-nowrap text-muted-foreground">
                        {format(new Date(log.createdAt), 'MMM d, yyyy HH:mm:ss')}
                      </TableCell>
                      <TableCell className="font-mono text-[10px] text-muted-foreground">
                        {log.ipAddress || 'SYSTEM_INTERNAL'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] uppercase tracking-wider font-mono ${getActionColor(log.action)}`}>
                          {log.action.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {account ? (
                          <div className="flex items-center gap-2 font-medium">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: account.color }} />
                            {account.displayName}
                          </div>
                        ) : log.accountId ? (
                          <span className="font-mono text-xs text-muted-foreground">ID: {log.accountId}</span>
                        ) : (
                          <span className="text-muted-foreground italic text-xs font-mono">Global System</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[400px]" title={log.details || ''}>
                        {log.details || '-'}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    No audit records found matching criteria.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
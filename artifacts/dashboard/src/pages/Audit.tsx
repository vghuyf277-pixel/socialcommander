import { useState } from "react";
import { useListAuditLogs, useListAccounts } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { Search, Filter, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Audit() {
  const [accountId, setAccountId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");

  const { data: accounts } = useListAccounts();
  
  // Real app would debounce search and pass to API, here we just filter client-side for simple text
  const { data: logs, isLoading } = useListAuditLogs({
    accountId: accountId === "all" ? undefined : Number(accountId),
    action: actionFilter === "all" ? undefined : actionFilter,
    limit: 100
  });

  const filteredLogs = logs?.filter(log => 
    !search || 
    log.action.toLowerCase().includes(search.toLowerCase()) || 
    (log.details && log.details.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-sans">Audit Trail</h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">Immutable record of all system actions.</p>
        </div>
        <Button variant="outline" className="gap-2">
          <Shield className="h-4 w-4 text-primary" />
          Export Report
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b pb-4 gap-4 space-y-0">
          <div className="relative w-full sm:w-[300px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search audit logs..." 
              className="pl-9 h-9 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="w-[160px] h-9 text-xs">
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
              <SelectTrigger className="w-[140px] h-9 text-xs">
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="post_created">Post Created</SelectItem>
                <SelectItem value="post_scheduled">Post Scheduled</SelectItem>
                <SelectItem value="account_updated">Account Updated</SelectItem>
                <SelectItem value="account_deleted">Account Deleted</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-[160px] font-mono text-xs text-muted-foreground uppercase tracking-wider">Timestamp</TableHead>
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
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  </TableRow>
                ))
              ) : filteredLogs && filteredLogs.length > 0 ? (
                filteredLogs.map(log => {
                  const account = accounts?.find(a => a.id === log.accountId);
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs whitespace-nowrap">
                        {format(new Date(log.createdAt), 'MMM d, yyyy HH:mm:ss')}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {log.ipAddress || 'System'}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {log.action.replace(/_/g, ' ')}
                      </TableCell>
                      <TableCell className="text-sm">
                        {account ? (
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: account.color }} />
                            {account.displayName}
                          </div>
                        ) : log.accountId ? (
                          <span className="font-mono text-xs text-muted-foreground">ID: {log.accountId}</span>
                        ) : (
                          <span className="text-muted-foreground italic">Global</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[300px]" title={log.details || ''}>
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

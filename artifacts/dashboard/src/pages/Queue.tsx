import { useState } from "react";
import { useListQueueJobs, useGetQueueStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Play, XCircle, CheckCircle2, Clock, AlertTriangle, Server, Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function Queue() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  const { data: queueStats, isLoading: isLoadingStats } = useGetQueueStats();
  const { data: jobs, isLoading: isLoadingJobs, refetch } = useListQueueJobs({ 
    status: statusFilter === "all" ? undefined : statusFilter as any,
    limit: 50
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-sans">Background Workers</h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">Monitor async processing queue and retry failed jobs.</p>
        </div>
        <Button variant="outline" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh Status
        </Button>
      </div>

      {/* Queue Health Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Pending</p>
              <div className="text-2xl font-bold">{isLoadingStats ? <Skeleton className="h-8 w-12" /> : queueStats?.pending || 0}</div>
            </div>
            <Clock className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Processing</p>
              <div className="text-2xl font-bold text-blue-500">{isLoadingStats ? <Skeleton className="h-8 w-12" /> : queueStats?.processing || 0}</div>
            </div>
            <Activity className="h-5 w-5 text-blue-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Completed</p>
              <div className="text-2xl font-bold text-green-500">{isLoadingStats ? <Skeleton className="h-8 w-12" /> : queueStats?.completed || 0}</div>
            </div>
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Failed</p>
              <div className="text-2xl font-bold text-destructive">{isLoadingStats ? <Skeleton className="h-8 w-12" /> : queueStats?.failed || 0}</div>
            </div>
            <XCircle className="h-5 w-5 text-destructive" />
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-mono uppercase text-primary mb-1">Success Rate</p>
              <div className="text-2xl font-bold text-primary">{isLoadingStats ? <Skeleton className="h-8 w-16" /> : `${(queueStats?.successRate || 0).toFixed(1)}%`}</div>
            </div>
            <Server className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
          <CardTitle className="text-lg">Active Queue</CardTitle>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] h-8 text-xs">
              <SelectValue placeholder="Filter Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[100px] font-mono text-xs">ID</TableHead>
                <TableHead className="font-mono text-xs">Type</TableHead>
                <TableHead className="font-mono text-xs">Status</TableHead>
                <TableHead className="font-mono text-xs">Attempts</TableHead>
                <TableHead className="font-mono text-xs">Created</TableHead>
                <TableHead className="text-right font-mono text-xs">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingJobs ? (
                [...Array(10)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-10" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : jobs && jobs.length > 0 ? (
                jobs.map(job => (
                  <TableRow key={job.id} className="group">
                    <TableCell className="font-mono text-xs text-muted-foreground">{job.id.substring(0, 8)}</TableCell>
                    <TableCell className="font-mono text-sm">{job.type}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] uppercase tracking-wider
                        ${job.status === 'completed' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 
                          job.status === 'failed' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
                          job.status === 'processing' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20 animate-pulse' : 
                          'bg-muted text-muted-foreground border-muted'}`}>
                        {job.status === 'failed' && <AlertTriangle className="h-3 w-3 mr-1" />}
                        {job.status}
                      </Badge>
                      {job.errorMessage && (
                        <div className="text-[10px] text-destructive mt-1 max-w-[200px] truncate" title={job.errorMessage}>
                          {job.errorMessage}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {job.attempts} <span className="text-muted-foreground">/ {job.maxAttempts}</span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-right">
                      {job.status === 'failed' ? (
                        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="h-3 w-3" /> Retry
                        </Button>
                      ) : job.status === 'pending' ? (
                        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                          <XCircle className="h-3 w-3" /> Cancel
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    No jobs found in the queue.
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

import { useState, useEffect } from "react";
import { useListQueueJobs, useGetQueueStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RefreshCw, Play, XCircle, CheckCircle2, Clock, AlertTriangle, Server, Activity, Send, BarChart, ChevronDown } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

export default function Queue() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [countdown, setCountdown] = useState(30);
  
  const { data: queueStats, isLoading: isLoadingStats } = useGetQueueStats();
  const { data: jobs, isLoading: isLoadingJobs, refetch } = useListQueueJobs({ 
    status: statusFilter === "all" ? undefined : statusFilter as any,
    limit: 50
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          refetch();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [refetch]);

  const handleRetry = async (id: string) => {
    try {
      await fetch(`/api/queue/jobs/${id}/retry`, { method: 'POST' });
      toast.success(`Job ${id.substring(0,8)} queued for retry`);
      refetch();
    } catch (e) {
      toast.error("Failed to retry job");
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await fetch(`/api/queue/jobs/${id}`, { method: 'DELETE' });
      toast.success(`Job ${id.substring(0,8)} cancelled`);
      refetch();
    } catch (e) {
      toast.error("Failed to cancel job");
    }
  };

  const getJobIcon = (type: string) => {
    switch (type) {
      case 'post_publish': return <Send className="h-4 w-4 text-blue-500" />;
      case 'analytics_sync': return <BarChart className="h-4 w-4 text-purple-500" />;
      case 'post_retry': return <RefreshCw className="h-4 w-4 text-orange-500" />;
      case 'engagement_check': return <Activity className="h-4 w-4 text-green-500" />;
      default: return <Server className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const throughput = queueStats ? ((queueStats.completed / (queueStats.completed + queueStats.failed + queueStats.pending + queueStats.processing)) * 100) || 0 : 0;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-sans">Background Workers</h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">Monitor async processing queue and retry failed jobs.</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs font-mono text-muted-foreground">Refreshes in {countdown}s</span>
          <Button variant="outline" onClick={() => { refetch(); setCountdown(30); }} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="bg-card border rounded-lg p-4 space-y-2 relative overflow-hidden">
        <div className="flex justify-between items-end mb-1 relative z-10">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider">Queue Throughput</h3>
            <p className="text-xs text-muted-foreground">Global completion rate</p>
          </div>
          <div className="text-2xl font-bold font-mono">{throughput.toFixed(1)}%</div>
        </div>
        <Progress value={throughput} className="h-2 relative z-10" />
      </div>

      {/* Queue Health Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                <TableHead className="w-[120px] font-mono text-xs">Job ID</TableHead>
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
                  <TableRow key={job.id} className="group hover:bg-muted/30">
                    <TableCell className="font-mono text-xs font-bold">JOB #{job.id.substring(0, 8)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getJobIcon(job.type)}
                        <span className="font-mono text-sm">{job.type}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] uppercase tracking-wider mb-1
                        ${job.status === 'completed' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 
                          job.status === 'failed' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
                          job.status === 'processing' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20 animate-pulse' : 
                          'bg-muted text-muted-foreground border-muted'}`}>
                        {job.status === 'failed' && <AlertTriangle className="h-3 w-3 mr-1" />}
                        {job.status}
                      </Badge>
                      
                      {job.errorMessage && (
                        <Collapsible className="max-w-[300px]">
                          <CollapsibleTrigger className="flex items-center gap-1 text-[10px] text-destructive hover:underline mt-1 w-full text-left">
                            <span className="truncate flex-1">{job.errorMessage.split('\n')[0]}</span>
                            <ChevronDown className="h-3 w-3 shrink-0" />
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="bg-destructive/10 text-destructive p-2 rounded text-[10px] font-mono mt-2 whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                              {job.errorMessage}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-mono">
                      {job.attempts} <span className="text-muted-foreground">/ {job.maxAttempts}</span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-right">
                      {job.status === 'failed' ? (
                        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleRetry(job.id)}>
                          <Play className="h-3 w-3" /> Retry
                        </Button>
                      ) : job.status === 'pending' ? (
                        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleCancel(job.id)}>
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
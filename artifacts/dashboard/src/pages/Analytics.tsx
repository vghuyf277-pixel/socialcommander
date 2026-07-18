import { useState } from "react";
import { useGetAnalyticsOverview, useGetAnalyticsTimeseries, useGetEngagementHeatmap, useListAccounts, useGetAccountAnalytics } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import { formatNumber } from "@/lib/utils";
import { TrendingUp, Users, MessageSquare, Repeat, Heart, Download } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

function AccountRow({ account }: { account: any }) {
  const { data, isLoading } = useGetAccountAnalytics({ accountId: account.id, days: 30 });
  return (
    <TableRow className="hover:bg-muted/30 transition-colors">
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: account.color }} />
          <span className="font-medium">{account.displayName}</span>
        </div>
      </TableCell>
      <TableCell className="capitalize text-xs font-mono text-muted-foreground">{account.platform}</TableCell>
      <TableCell className="font-mono">{account.postsCount || 0}</TableCell>
      <TableCell className="font-mono">{isLoading ? <Skeleton className="h-4 w-12"/> : formatNumber(data?.impressions || 0)}</TableCell>
      <TableCell className="font-mono">{isLoading ? <Skeleton className="h-4 w-12"/> : formatNumber(data?.likes || 0)}</TableCell>
      <TableCell className="font-mono font-bold text-primary">{isLoading ? <Skeleton className="h-4 w-16"/> : `${formatNumber(data?.avgEngagementRate || 0)} avg per post`}</TableCell>
    </TableRow>
  )
}

export default function Analytics() {
  const [days, setDays] = useState("30");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all");
  const [metric, setMetric] = useState<"impressions" | "likes" | "comments" | "reposts">("impressions");

  const accountParam = selectedAccountId === "all" ? undefined : Number(selectedAccountId);
  
  const { data: accounts } = useListAccounts();
  const { data: overview, isLoading: isLoadingOverview } = useGetAnalyticsOverview({ days: Number(days) });
  const { data: timeseries, isLoading: isLoadingTimeseries } = useGetAnalyticsTimeseries({ 
    accountId: accountParam, 
    metric, 
    days: Number(days) 
  });
  const { data: heatmap, isLoading: isLoadingHeatmap } = useGetEngagementHeatmap({ 
    accountId: accountParam, 
    days: Number(days) 
  });

  const getHeatmapColor = (value: number, max: number) => {
    if (!value || !max) return "bg-muted/10";
    const intensity = Math.min(100, Math.max(10, Math.floor((value / max) * 100)));
    return `bg-primary/${intensity}`;
  };

  const heatmapMax = heatmap ? Math.max(...heatmap.map(c => c.value)) : 1;
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const heatmapGrid = daysOfWeek.map((_, dayIdx) => {
    return hours.map(hour => {
      const cell = heatmap?.find(c => c.dayOfWeek === dayIdx && c.hour === hour);
      return cell ? cell.value : 0;
    });
  });

  const getTopHours = () => {
    if (!heatmap) return [];
    return [...heatmap].sort((a, b) => b.value - a.value).slice(0, 3);
  };

  const handleExport = () => {
    if (!timeseries) return;
    const csv = "Date,Value\n" + timeseries.map(t => `${t.date},${t.value}`).join("\n");
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${metric}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-sans">Telemetry Data</h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">Global performance metrics and engagement analysis.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="outline" size="sm" className="gap-2 h-9" onClick={handleExport}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>

          <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
            <SelectTrigger className="w-[200px] h-9">
              <SelectValue placeholder="All Accounts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Network Aggregate</SelectItem>
              {accounts?.map((acc) => (
                <SelectItem key={acc.id} value={acc.id.toString()}>
                  {acc.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-[120px] h-9">
              <SelectValue placeholder="Timeframe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 Days</SelectItem>
              <SelectItem value="30">Last 30 Days</SelectItem>
              <SelectItem value="90">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card hover:border-primary/30 transition-colors">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">Impressions</p>
                {isLoadingOverview ? <Skeleton className="h-8 w-24" /> : <div className="text-3xl font-bold">{formatNumber(overview?.totalImpressions || 0)}</div>}
              </div>
              <div className="p-2 bg-primary/10 text-primary rounded"><Users className="h-5 w-5" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card hover:border-red-500/30 transition-colors">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">Likes</p>
                {isLoadingOverview ? <Skeleton className="h-8 w-24" /> : <div className="text-3xl font-bold">{formatNumber(overview?.totalLikes || 0)}</div>}
              </div>
              <div className="p-2 bg-red-500/10 text-red-500 rounded"><Heart className="h-5 w-5" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card hover:border-blue-500/30 transition-colors">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">Comments</p>
                {isLoadingOverview ? <Skeleton className="h-8 w-24" /> : <div className="text-3xl font-bold">{formatNumber(overview?.totalComments || 0)}</div>}
              </div>
              <div className="p-2 bg-blue-500/10 text-blue-500 rounded"><MessageSquare className="h-5 w-5" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card hover:border-green-500/30 transition-colors">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">Reposts</p>
                {isLoadingOverview ? <Skeleton className="h-8 w-24" /> : <div className="text-3xl font-bold">{formatNumber(overview?.totalReposts || 0)}</div>}
              </div>
              <div className="p-2 bg-green-500/10 text-green-500 rounded"><Repeat className="h-5 w-5" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 flex flex-col min-h-[450px]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle>Growth Trajectory</CardTitle>
              <CardDescription>Time series analysis over the selected period</CardDescription>
            </div>
            <Select value={metric} onValueChange={(val: any) => setMetric(val)}>
              <SelectTrigger className="w-[140px] h-8 text-xs font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="impressions">Impressions</SelectItem>
                <SelectItem value="likes">Likes</SelectItem>
                <SelectItem value="comments">Comments</SelectItem>
                <SelectItem value="reposts">Reposts</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="h-[350px] w-full mt-4">
              {isLoadingTimeseries ? (
                <Skeleton className="w-full h-full" />
              ) : timeseries && timeseries.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeseries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(val) => format(new Date(val), 'MMM d')}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      dy={10}
                    />
                    <YAxis 
                      tickFormatter={(val) => formatNumber(val)}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      dx={-10}
                    />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                      labelFormatter={(val) => format(new Date(val), 'MMM d, yyyy')}
                      formatter={(val: number) => [formatNumber(val), metric.charAt(0).toUpperCase() + metric.slice(1)]}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke="hsl(var(--primary))" 
                      fillOpacity={1} 
                      fill="url(#colorMetric)"
                      strokeWidth={3}
                      activeDot={{ r: 6, fill: "hsl(var(--primary))", strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground border border-dashed rounded-md">
                  No time series data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col min-h-[450px]">
          <CardHeader>
            <CardTitle>Engagement Density</CardTitle>
            <CardDescription>Hotspots across week and hours</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            {isLoadingHeatmap ? (
              <Skeleton className="w-full h-full flex-1" />
            ) : heatmap && heatmap.length > 0 ? (
              <div className="flex flex-col h-full">
                <div className="flex-1 flex">
                  {/* Y-axis labels (Days) */}
                  <div className="flex flex-col justify-between pr-2 text-[10px] font-mono text-muted-foreground py-2">
                    {daysOfWeek.map(day => <div key={day} className="flex-1 flex items-center">{day}</div>)}
                  </div>
                  
                  {/* Heatmap Grid */}
                  <div className="flex-1 grid grid-rows-7 gap-1">
                    {heatmapGrid.map((dayRow, dIdx) => (
                      <div key={dIdx} className="grid grid-cols-24 gap-px">
                        {dayRow.map((val, hIdx) => (
                          <div 
                            key={`${dIdx}-${hIdx}`} 
                            className={`rounded-sm w-full h-full ${getHeatmapColor(val, heatmapMax)} hover:opacity-75 transition-opacity cursor-crosshair`}
                            title={`${daysOfWeek[dIdx]} ${hIdx}:00 - ${val} engagements`}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* X-axis labels (Hours) */}
                <div className="flex ml-8 mt-2 text-[8px] font-mono text-muted-foreground">
                  <div className="flex-1 text-left">00</div>
                  <div className="flex-1 text-center">06</div>
                  <div className="flex-1 text-center">12</div>
                  <div className="flex-1 text-center">18</div>
                  <div className="flex-1 text-right">23</div>
                </div>

                <div className="mt-6 space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" /> Peak Hours
                  </h4>
                  <div className="grid grid-cols-1 gap-2">
                    {getTopHours().map((h, i) => (
                      <div key={i} className="flex justify-between items-center p-2.5 bg-muted/30 border border-border/50 rounded-md text-sm">
                        <span className="font-mono text-muted-foreground">{daysOfWeek[h.dayOfWeek]} {h.hour}:00</span>
                        <span className="font-bold text-foreground">{h.value} <span className="text-xs font-mono font-normal text-muted-foreground">avg eng</span></span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground border border-dashed rounded-md flex-1">
                Not enough density data
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Per-Node Breakdown</CardTitle>
          <CardDescription>Performance metrics across all connected accounts</CardDescription>
        </CardHeader>
        <CardContent className="p-0 border-t">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="text-xs font-mono uppercase tracking-wider">Account</TableHead>
                <TableHead className="text-xs font-mono uppercase tracking-wider">Platform</TableHead>
                <TableHead className="text-xs font-mono uppercase tracking-wider">Posts</TableHead>
                <TableHead className="text-xs font-mono uppercase tracking-wider">Impressions</TableHead>
                <TableHead className="text-xs font-mono uppercase tracking-wider">Likes</TableHead>
                <TableHead className="text-xs font-mono uppercase tracking-wider text-primary">Engagement</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts?.map(acc => <AccountRow key={acc.id} account={acc} />)}
              {accounts?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">No accounts connected</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
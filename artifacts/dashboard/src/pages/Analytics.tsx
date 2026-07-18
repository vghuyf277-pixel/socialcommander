import { useState } from "react";
import { useGetAnalyticsOverview, useGetAnalyticsTimeseries, useGetEngagementHeatmap, useListAccounts } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts";
import { formatNumber } from "@/lib/utils";
import { TrendingUp, Users, MessageSquare, Repeat, Heart } from "lucide-react";
import { format, subDays } from "date-fns";

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

  // Group heatmap by day then hour for the grid
  const heatmapGrid = daysOfWeek.map((_, dayIdx) => {
    return hours.map(hour => {
      const cell = heatmap?.find(c => c.dayOfWeek === dayIdx && c.hour === hour);
      return cell ? cell.value : 0;
    });
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-sans">Telemetry Data</h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">Global performance metrics and engagement analysis.</p>
        </div>
        
        <div className="flex flex-wrap gap-4">
          <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
            <SelectTrigger className="w-[200px]">
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
            <SelectTrigger className="w-[120px]">
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
        <Card className="bg-card">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-mono uppercase tracking-wider text-muted-foreground mb-1">Impressions</p>
                {isLoadingOverview ? <Skeleton className="h-8 w-24" /> : <div className="text-3xl font-bold">{formatNumber(overview?.totalImpressions || 0)}</div>}
              </div>
              <div className="p-2 bg-primary/10 text-primary rounded"><Users className="h-5 w-5" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-mono uppercase tracking-wider text-muted-foreground mb-1">Likes</p>
                {isLoadingOverview ? <Skeleton className="h-8 w-24" /> : <div className="text-3xl font-bold">{formatNumber(overview?.totalLikes || 0)}</div>}
              </div>
              <div className="p-2 bg-red-500/10 text-red-500 rounded"><Heart className="h-5 w-5" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-mono uppercase tracking-wider text-muted-foreground mb-1">Comments</p>
                {isLoadingOverview ? <Skeleton className="h-8 w-24" /> : <div className="text-3xl font-bold">{formatNumber(overview?.totalComments || 0)}</div>}
              </div>
              <div className="p-2 bg-blue-500/10 text-blue-500 rounded"><MessageSquare className="h-5 w-5" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-mono uppercase tracking-wider text-muted-foreground mb-1">Reposts</p>
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
              <SelectTrigger className="w-[140px] h-8 text-xs">
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
                  <LineChart data={timeseries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                    <Line 
                      type="monotone" 
                      dataKey="value" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 6, fill: "hsl(var(--primary))" }}
                    />
                  </LineChart>
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
          <CardContent className="flex-1">
            {isLoadingHeatmap ? (
              <Skeleton className="w-full h-[350px]" />
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
                            className={`rounded-sm w-full h-full ${getHeatmapColor(val, heatmapMax)}`}
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

                <div className="mt-6 p-4 bg-muted/20 border rounded-lg">
                  <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-primary" /> Key Insight
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Highest engagement clusters occur on {overview?.topAccount ? "specific nodes" : "mid-week afternoons"}. Focus scheduled drops during the darkest intense blocks to maximize organic reach and viral potential.
                  </p>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground border border-dashed rounded-md">
                Not enough density data
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

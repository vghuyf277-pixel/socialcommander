import { useGetAccount, useGetAccountStats, useGetAccountAnalytics, useGetAnalyticsTimeseries, useUpdateAccount } from "@workspace/api-client-react";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SiX, SiReddit } from "react-icons/si";
import { ArrowLeft, Settings, MessageSquare, Heart, Share2, TrendingUp, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import { formatNumber } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function AccountDetail() {
  const { id } = useParams<{ id: string }>();
  const accountId = Number(id);
  
  const { data: account, isLoading: isLoadingAccount } = useGetAccount(accountId);
  const { data: stats, isLoading: isLoadingStats } = useGetAccountStats(accountId);
  const { data: analytics, isLoading: isLoadingAnalytics } = useGetAccountAnalytics({ accountId, days: 30 });
  const { data: timeseries, isLoading: isLoadingTimeseries } = useGetAnalyticsTimeseries({ accountId, metric: 'impressions', days: 30 });
  
  const updateAccount = useUpdateAccount();

  // Settings form state
  const [voiceProfile, setVoiceProfile] = useState("");
  const [proxyConfig, setProxyConfig] = useState("");
  const initializedForId = useRef<number | null>(null);

  useEffect(() => {
    if (account && initializedForId.current !== accountId) {
      initializedForId.current = accountId;
      setVoiceProfile(account.voiceProfile || "");
      setProxyConfig(account.proxyConfig || "");
    }
  }, [account, accountId]);

  const handleSaveSettings = () => {
    updateAccount.mutate(
      { id: accountId, data: { voiceProfile, proxyConfig } },
      {
        onSuccess: () => {
          toast.success("Settings saved successfully");
        },
        onError: () => {
          toast.error("Failed to save settings");
        }
      }
    );
  };

  if (isLoadingAccount) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!account) return <div>Account not found</div>;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/50 pb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="-ml-2">
            <Link href="/accounts"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="w-12 h-12 rounded-md border overflow-hidden flex items-center justify-center bg-muted shrink-0" style={{ borderColor: account.color }}>
            {account.avatarUrl ? (
              <img src={account.avatarUrl} alt={account.displayName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full font-bold flex items-center justify-center font-mono text-xl" style={{ backgroundColor: account.color, color: '#fff' }}>
                {account.displayName.charAt(0)}
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight font-sans">{account.displayName}</h1>
              {account.platform === 'twitter' ? <SiX className="h-4 w-4 text-blue-500" /> : <SiReddit className="h-4 w-4 text-orange-500" />}
              <Badge variant="outline" className={`ml-2 text-[10px] rounded-sm uppercase tracking-wider
                ${account.status === 'active' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 
                  account.status === 'suspended' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
                  'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                {account.status}
              </Badge>
            </div>
            <p className="text-muted-foreground font-mono text-sm mt-0.5">@{account.username}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Settings className="h-4 w-4" />
            Reconnect
          </Button>
          <Button asChild className="gap-2" style={{ backgroundColor: account.color, color: '#fff' }}>
            <Link href={`/compose?accountId=${account.id}`}>Create Post</Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-[400px]">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Deep Analytics</TabsTrigger>
          <TabsTrigger value="settings">Configuration</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium font-mono uppercase tracking-wider">Followers</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(account.followersCount || 0)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium font-mono uppercase tracking-wider">Posts</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(account.postsCount || 0)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium font-mono uppercase tracking-wider">Avg Engagement</CardTitle>
                <Heart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(account.engagementRate || 0).toFixed(2)}%</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium font-mono uppercase tracking-wider">Failed Queue</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{stats?.failedPosts || 0}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Performance Trend (30 Days)</CardTitle>
                <CardDescription>Impressions over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  {isLoadingTimeseries ? (
                    <Skeleton className="w-full h-full" />
                  ) : timeseries && timeseries.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={timeseries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={account.color} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={account.color} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis 
                          dataKey="date" 
                          tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
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
                          labelFormatter={(val) => new Date(val).toLocaleDateString()}
                          formatter={(val: number) => [formatNumber(val), 'Impressions']}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="value" 
                          stroke={account.color} 
                          strokeWidth={2}
                          fillOpacity={1} 
                          fill="url(#colorValue)" 
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

            <Card>
              <CardHeader>
                <CardTitle>Optimal Timing</CardTitle>
                <CardDescription>Based on historical engagement</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingAnalytics ? (
                  <Skeleton className="w-full h-32" />
                ) : analytics ? (
                  <div className="flex flex-col items-center justify-center h-[250px] text-center p-6 border rounded-lg bg-muted/20">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary">
                      <TrendingUp className="h-8 w-8" />
                    </div>
                    <div className="text-sm font-mono text-muted-foreground mb-1 uppercase tracking-wider">Best Day</div>
                    <div className="text-xl font-bold mb-4">{analytics.bestDayOfWeek || 'Thursday'}</div>
                    
                    <div className="text-sm font-mono text-muted-foreground mb-1 uppercase tracking-wider">Peak Hour</div>
                    <div className="text-xl font-bold">{analytics.bestHour !== undefined ? `${analytics.bestHour}:00` : '14:00'}</div>
                  </div>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground border border-dashed rounded-md">
                    Not enough data
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Deep Analytics</CardTitle>
              <CardDescription>Detailed engagement breakdown for {account.displayName}</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingAnalytics ? (
                <Skeleton className="h-[400px] w-full" />
              ) : analytics ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="p-4 border rounded-lg bg-card text-center">
                    <div className="text-3xl font-bold mb-1">{formatNumber(analytics.impressions || 0)}</div>
                    <div className="text-sm text-muted-foreground font-mono uppercase tracking-wider">Impressions</div>
                  </div>
                  <div className="p-4 border rounded-lg bg-card text-center">
                    <div className="text-3xl font-bold mb-1">{formatNumber(analytics.likes || 0)}</div>
                    <div className="text-sm text-muted-foreground font-mono uppercase tracking-wider">Likes</div>
                  </div>
                  <div className="p-4 border rounded-lg bg-card text-center">
                    <div className="text-3xl font-bold mb-1">{formatNumber(analytics.comments || 0)}</div>
                    <div className="text-sm text-muted-foreground font-mono uppercase tracking-wider">Comments</div>
                  </div>
                  <div className="p-4 border rounded-lg bg-card text-center">
                    <div className="text-3xl font-bold mb-1">{formatNumber(analytics.reposts || 0)}</div>
                    <div className="text-sm text-muted-foreground font-mono uppercase tracking-wider">Reposts</div>
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center text-muted-foreground">No analytics data available for this account.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>AI Voice Profile</CardTitle>
                <CardDescription>Instruct the AI generator on how this account should sound</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="voice">Voice Directives</Label>
                  <Textarea 
                    id="voice" 
                    placeholder="e.g. Professional but witty. Use short sentences. Focus on engineering insights. Never use emojis."
                    className="min-h-[200px] font-mono text-sm resize-none"
                    value={voiceProfile}
                    onChange={(e) => setVoiceProfile(e.target.value)}
                  />
                </div>
                <Button 
                  onClick={handleSaveSettings} 
                  disabled={updateAccount.isPending}
                >
                  {updateAccount.isPending ? "Saving..." : "Save Voice Profile"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Network Configuration</CardTitle>
                <CardDescription>Technical settings for API routing</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="proxy">Custom Proxy URL (Optional)</Label>
                  <Input 
                    id="proxy" 
                    placeholder="http://proxy.example.com:8080"
                    value={proxyConfig}
                    onChange={(e) => setProxyConfig(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Route requests for this account through a specific proxy to avoid rate limits.</p>
                </div>
                <Button 
                  onClick={handleSaveSettings} 
                  disabled={updateAccount.isPending}
                  variant="secondary"
                >
                  {updateAccount.isPending ? "Saving..." : "Update Network Config"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

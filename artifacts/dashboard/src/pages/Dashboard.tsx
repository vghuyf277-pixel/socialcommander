import { useGetAccountsOverview, useGetAnalyticsOverview, useListAccounts, useListPosts } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { Activity, AlertCircle, CalendarClock, PenSquare, Share2, MessageSquare, TrendingUp, Trophy } from "lucide-react";
import { SiX, SiReddit } from "react-icons/si";
import { format, formatDistanceToNow } from "date-fns";
import { TooltipProvider, TooltipTrigger, TooltipContent, Tooltip } from "@/components/ui/tooltip";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { useEffect } from "react";

const getSparklineData = (seed: number) => Array.from({length: 14}).map((_, i) => ({ value: 10 + Math.abs(Math.sin(i * seed) * 20 + i * seed) }));

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: accountsOverview, isLoading: isLoadingAccounts } = useGetAccountsOverview({ query: { refetchInterval: 30_000 } });
  const { data: analytics, isLoading: isLoadingAnalytics } = useGetAnalyticsOverview({}, { query: { refetchInterval: 30_000 } });
  const { data: postsPage, isLoading: isLoadingPosts } = useListPosts({ limit: 10 }, { query: { refetchInterval: 30_000 } });
  const { data: accounts, isLoading: isLoadingAccountsList } = useListAccounts(undefined, { query: { refetchInterval: 60_000 } });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setLocation('/compose');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setLocation]);

  const topAccount = analytics?.topAccount ? accounts?.find(a => a.id === analytics.topAccount?.id) : null;
  const topEngagements = analytics?.topAccount?.engagements || 0;

  // Render proper % for engagement rate
  const rawEngRate = analytics?.avgEngagementRate || 0;
  const engRateDisplay = rawEngRate > 100 ? (rawEngRate / 100).toFixed(2) : rawEngRate.toFixed(2);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-sans">Command Center</h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">System operational. Overview of your network. <kbd className="hidden md:inline-block ml-2 px-1.5 py-0.5 bg-muted rounded border text-[10px]">Press 'N' to compose</kbd></p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/compose">
            <PenSquare className="h-4 w-4" />
            New Post
          </Link>
        </Button>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card relative overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-medium font-mono uppercase tracking-wider">Posts Today</CardTitle>
            <Share2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="relative z-10">
            {isLoadingAccounts ? <Skeleton className="h-8 w-[100px]" /> : (
              <>
                <div className="text-2xl font-bold">{accountsOverview?.totalPostsToday || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">Across {accountsOverview?.activeAccounts || 0} active accounts</p>
              </>
            )}
          </CardContent>
          <div className="absolute bottom-0 left-0 w-full h-16 opacity-20 pointer-events-none">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={getSparklineData(1)}><Area type="monotone" dataKey="value" stroke="none" fill="hsl(var(--primary))" /></AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        
        <Card className="bg-card relative overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-medium font-mono uppercase tracking-wider">Scheduled</CardTitle>
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="relative z-10">
            {isLoadingAccounts ? <Skeleton className="h-8 w-[100px]" /> : (
              <>
                <div className="text-2xl font-bold">{accountsOverview?.totalScheduled || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">Posts in the queue</p>
              </>
            )}
          </CardContent>
          <div className="absolute bottom-0 left-0 w-full h-16 opacity-20 pointer-events-none">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={getSparklineData(2)}><Area type="monotone" dataKey="value" stroke="none" fill="#3b82f6" /></AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="bg-card relative overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-medium font-mono uppercase tracking-wider">Avg Engagement</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="relative z-10">
            {isLoadingAnalytics ? <Skeleton className="h-8 w-[100px]" /> : (
              <>
                <div className="text-2xl font-bold">{engRateDisplay}%</div>
                <p className="text-xs text-green-500 mt-1 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {analytics?.growthRate ? `+${analytics.growthRate}%` : 'Stable'}
                </p>
              </>
            )}
          </CardContent>
          <div className="absolute bottom-0 left-0 w-full h-16 opacity-20 pointer-events-none">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={getSparklineData(3)}><Area type="monotone" dataKey="value" stroke="none" fill="#10b981" /></AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="bg-card relative overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-medium font-mono uppercase tracking-wider">Network Health</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="relative z-10">
            {isLoadingAccounts ? <Skeleton className="h-8 w-[100px]" /> : (
              <>
                <div className="text-2xl font-bold">{accountsOverview?.totalAccounts || 0} Nodes</div>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20 rounded-sm">
                    <SiX className="mr-1 h-3 w-3" /> {accountsOverview?.platformBreakdown?.twitter || 0}
                  </Badge>
                  <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/20 rounded-sm">
                    <SiReddit className="mr-1 h-3 w-3" /> {accountsOverview?.platformBreakdown?.reddit || 0}
                  </Badge>
                </div>
              </>
            )}
          </CardContent>
          <div className="absolute bottom-0 left-0 w-full h-16 opacity-20 pointer-events-none">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={getSparklineData(4)}><Area type="monotone" dataKey="value" stroke="none" fill="#f59e0b" /></AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {topAccount && (
        <Card className="bg-gradient-to-r from-primary/10 to-transparent border-primary/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary border border-primary/30">
                <Trophy className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">Top Performing Node</p>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg">{topAccount.displayName}</span>
                  {topAccount.platform === 'twitter' ? <SiX className="h-4 w-4 text-muted-foreground" /> : <SiReddit className="h-4 w-4 text-muted-foreground" />}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">{topEngagements}</div>
              <p className="text-xs font-mono text-muted-foreground">Total Engagements</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <Card className="lg:col-span-2 flex flex-col min-h-[400px]">
          <CardHeader>
            <CardTitle>Recent Transmissions</CardTitle>
            <CardDescription>The latest posts published across your network</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {isLoadingPosts ? (
              <div className="space-y-4">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : postsPage?.posts && postsPage.posts.length > 0 ? (
              <div className="space-y-4">
                {postsPage.posts.map((post) => (
                  <div key={post.id} className="p-4 rounded-md border border-border bg-muted/30 hover:bg-muted/50 transition-colors flex gap-4">
                    <div className="shrink-0 mt-1">
                      {post.platform === 'twitter' ? (
                        <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                          <SiX className="h-4 w-4 text-blue-500" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center">
                          <SiReddit className="h-4 w-4 text-orange-500" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-semibold text-foreground">{post.account?.displayName || 'Unknown'}</span>
                          <span className="text-muted-foreground font-mono">@{post.account?.username}</span>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {post.publishedAt ? formatDistanceToNow(new Date(post.publishedAt), { addSuffix: true }) : 
                           post.scheduledAt ? `Scheduled for ${format(new Date(post.scheduledAt), 'MMM d, h:mm a')}` : 'Draft'}
                        </span>
                      </div>
                      <p className="text-sm line-clamp-2">{post.content}</p>
                      
                      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> {post.impressions || 0}</div>
                        <div className="flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> {post.comments || 0}</div>
                        <div className="flex items-center gap-1.5"><Share2 className="h-3.5 w-3.5" /> {post.reposts || 0}</div>
                        <Badge variant="outline" className={`ml-auto text-[10px] rounded-sm uppercase tracking-wider
                          ${post.status === 'published' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 
                            post.status === 'scheduled' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 
                            post.status === 'failed' ? 'bg-red-500/10 text-red-500 border-red-500/20' : ''}
                        `}>
                          {post.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center border border-dashed rounded-lg">
                <MessageSquare className="h-10 w-10 mb-4 opacity-20" />
                <p>No recent transmissions found.</p>
                <Button variant="link" asChild className="mt-2 text-primary">
                  <Link href="/compose">Draft your first post</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Node Health Grid */}
        <Card className="flex flex-col min-h-[400px]">
          <CardHeader>
            <CardTitle>Node Status</CardTitle>
            <CardDescription>Health of connected accounts</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {isLoadingAccountsList ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : accounts && accounts.length > 0 ? (
              <div className="space-y-3">
                {accounts.map(acc => (
                  <div key={acc.id} className="flex items-center justify-between p-3 rounded-md border bg-card/50">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center overflow-hidden border">
                          {acc.avatarUrl ? (
                            <img src={acc.avatarUrl} alt={acc.displayName} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full font-bold font-mono flex items-center justify-center" style={{ backgroundColor: acc.color, color: '#fff' }}>
                              {acc.displayName.charAt(0)}
                            </div>
                          )}
                        </div>
                        <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-card flex items-center justify-center ${
                          acc.status === 'active' ? 'bg-green-500' : 
                          acc.status === 'suspended' ? 'bg-red-500' : 'bg-amber-500'
                        }`} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold hover:underline cursor-pointer" onClick={() => setLocation(`/accounts/${acc.id}`)}>{acc.displayName}</div>
                        <div className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                          {acc.platform === 'twitter' ? <SiX className="h-2.5 w-2.5" /> : <SiReddit className="h-2.5 w-2.5" />}
                          @{acc.username}
                        </div>
                      </div>
                    </div>
                    {acc.status === 'suspended' && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Account suspended. Check platform for details.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                ))}
              </div>
            ) : (
               <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-6 text-center border border-dashed rounded-lg">
                <AlertCircle className="h-8 w-8 mb-4 opacity-20" />
                <p className="text-sm">No connected nodes.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
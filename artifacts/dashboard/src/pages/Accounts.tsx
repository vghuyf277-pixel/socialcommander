import { useListAccounts, useDeleteAccount } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { SiX, SiReddit } from "react-icons/si";
import { MoreHorizontal, Plus, Settings, Trash2, Activity, Pause, Play, AlertTriangle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/utils";

export default function Accounts() {
  const { data: accounts, isLoading } = useListAccounts();
  const deleteAccount = useDeleteAccount();

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this account? This action cannot be undone.")) {
      deleteAccount.mutate({ id });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-sans">Network Nodes</h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">Manage all connected social accounts.</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Node
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {isLoading ? (
          [...Array(4)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <div className="h-1 bg-muted w-full" />
              <CardHeader className="pb-2">
                <Skeleton className="h-10 w-10 rounded-md" />
                <Skeleton className="h-5 w-32 mt-2" />
                <Skeleton className="h-4 w-24 mt-1" />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2 mt-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : accounts?.length ? (
          accounts.map(account => (
            <Card key={account.id} className="relative overflow-hidden group hover:border-primary/50 transition-colors">
              <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: account.color }} />
              <CardHeader className="pb-2 pl-6">
                <div className="flex justify-between items-start">
                  <div className="w-10 h-10 rounded-md border overflow-hidden flex items-center justify-center bg-muted">
                    {account.avatarUrl ? (
                      <img src={account.avatarUrl} alt={account.displayName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full font-bold flex items-center justify-center font-mono text-lg" style={{ backgroundColor: account.color, color: '#fff' }}>
                        {account.displayName.charAt(0)}
                      </div>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Account Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href={`/accounts/${account.id}`} className="cursor-pointer">
                          <Activity className="h-4 w-4 mr-2" /> View Dashboard
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Settings className="h-4 w-4 mr-2" /> Settings
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        {account.status === 'active' ? (
                          <><Pause className="h-4 w-4 mr-2" /> Pause Activity</>
                        ) : (
                          <><Play className="h-4 w-4 mr-2" /> Resume Activity</>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive focus:bg-destructive/10 cursor-pointer" onClick={() => handleDelete(account.id)}>
                        <Trash2 className="h-4 w-4 mr-2" /> Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <CardTitle className="text-lg mt-3 flex items-center gap-2">
                  <Link href={`/accounts/${account.id}`} className="hover:underline">{account.displayName}</Link>
                  {account.platform === 'twitter' ? <SiX className="h-3.5 w-3.5 text-muted-foreground" /> : <SiReddit className="h-3.5 w-3.5 text-muted-foreground" />}
                </CardTitle>
                <CardDescription className="font-mono text-xs">
                  @{account.username}
                </CardDescription>
              </CardHeader>
              <CardContent className="pl-6 pt-2 pb-4">
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant="outline" className={`text-[10px] rounded-sm uppercase tracking-wider
                    ${account.status === 'active' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 
                      account.status === 'suspended' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
                      'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                    {account.status === 'suspended' && <AlertTriangle className="h-3 w-3 mr-1" />}
                    {account.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 py-3 border-y border-border/50">
                  <div className="flex flex-col text-center">
                    <span className="text-xl font-bold">{formatNumber(account.followersCount || 0)}</span>
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">Followers</span>
                  </div>
                  <div className="flex flex-col text-center border-l border-border/50">
                    <span className="text-xl font-bold">{formatNumber(account.postsCount || 0)}</span>
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">Posts</span>
                  </div>
                  <div className="flex flex-col text-center border-l border-border/50">
                    <span className="text-xl font-bold">{(account.engagementRate || 0).toFixed(1)}%</span>
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">Engage</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pl-6 pt-0 text-xs text-muted-foreground flex justify-between bg-muted/20 py-2 border-t mt-auto">
                <span>Last active</span>
                <span className="font-mono">{account.lastPostAt ? new Date(account.lastPostAt).toLocaleDateString() : 'Never'}</span>
              </CardFooter>
            </Card>
          ))
        ) : (
          <div className="col-span-full flex flex-col items-center justify-center p-12 text-center border border-dashed rounded-lg bg-card/50">
            <h3 className="text-lg font-bold mb-2">No connected accounts</h3>
            <p className="text-muted-foreground mb-4 max-w-md">Connect your first Twitter or Reddit account to start scheduling posts and tracking analytics.</p>
            <Button>Connect Account</Button>
          </div>
        )}
      </div>
    </div>
  );
}

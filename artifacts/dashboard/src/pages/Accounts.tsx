import { useListAccounts, useDeleteAccount, useCreateAccount, useUpdateAccount } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { SiX, SiReddit } from "react-icons/si";
import { MoreHorizontal, Plus, Settings, Trash2, Activity, Pause, Play, AlertTriangle, Network, PenSquare } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export default function Accounts() {
  const queryClient = useQueryClient();
  const { data: accounts, isLoading } = useListAccounts();
  const deleteAccount = useDeleteAccount();
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newPlatform, setNewPlatform] = useState("twitter");
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newColor, setNewColor] = useState("#3b82f6");
  const [newVoice, setNewVoice] = useState("");

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to detach this node? This action cannot be undone.")) {
      deleteAccount.mutate({ id }, {
        onSuccess: () => {
          toast.success("Node detached");
          queryClient.invalidateQueries({ queryKey: ["accounts"] });
        }
      });
    }
  };

  const handleAdd = () => {
    createAccount.mutate({
      data: {
        platform: newPlatform as any,
        username: newUsername,
        displayName: newDisplayName,
        color: newColor,
        voiceProfile: newVoice,
        status: 'active'
      }
    }, {
      onSuccess: () => {
        toast.success("Node connected successfully");
        setIsAddOpen(false);
        setNewUsername(""); setNewDisplayName(""); setNewVoice("");
        queryClient.invalidateQueries({ queryKey: ["accounts"] });
      }
    });
  };

  const handleTogglePause = (account: any) => {
    updateAccount.mutate({
      id: account.id,
      data: { status: account.status === 'active' ? 'paused' : 'active' }
    }, {
      onSuccess: () => {
        toast.success(`Node ${account.status === 'active' ? 'paused' : 'resumed'}`);
        queryClient.invalidateQueries({ queryKey: ["accounts"] });
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-sans">Network Nodes</h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">Manage all connected social endpoints.</p>
        </div>
        
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Node
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Network className="h-5 w-5 text-primary" /> Connect New Node</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Platform</Label>
                <Select value={newPlatform} onValueChange={setNewPlatform}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="twitter">
                      <div className="flex items-center gap-2"><SiX className="h-3 w-3" /> Twitter / X</div>
                    </SelectItem>
                    <SelectItem value="reddit">
                      <div className="flex items-center gap-2"><SiReddit className="h-3 w-3" /> Reddit</div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input placeholder="techfounder" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Display Name</Label>
                  <Input placeholder="Tech Founder" value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Node Accent Color</Label>
                <div className="flex gap-4 items-center">
                  <Input type="color" className="w-16 h-10 p-1" value={newColor} onChange={(e) => setNewColor(e.target.value)} />
                  <span className="font-mono text-sm">{newColor}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>AI Voice Profile (Optional)</Label>
                <Textarea 
                  placeholder="How should this node sound?"
                  className="resize-none h-24 font-mono text-xs"
                  value={newVoice}
                  onChange={(e) => setNewVoice(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={handleAdd} className="w-full" disabled={!newUsername || !newDisplayName}>Initialize Node</Button>
          </DialogContent>
        </Dialog>
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
          accounts.map(account => {
            const health = Math.min(100, Math.round(((account.engagementRate || 0) * 10) + ((account.postsCount || 0) * 2)));
            let hColor = 'bg-green-500';
            if (health < 70) hColor = 'bg-amber-500';
            if (health < 40) hColor = 'bg-red-500';

            return (
              <Card key={account.id} className="relative overflow-hidden group hover:border-primary/50 transition-colors flex flex-col h-full shadow-sm">
                <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: account.color }} />
                <CardHeader className="pb-2 pl-6">
                  <div className="flex justify-between items-start">
                    <div className="w-10 h-10 rounded-md border overflow-hidden flex items-center justify-center bg-muted" style={{ borderColor: account.color }}>
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
                        <DropdownMenuLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link href={`/accounts/${account.id}`} className="cursor-pointer">
                            <Activity className="h-4 w-4 mr-2 text-primary" /> View Telemetry
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleTogglePause(account)}>
                          {account.status === 'active' ? (
                            <><Pause className="h-4 w-4 mr-2 text-amber-500" /> Suspend Activity</>
                          ) : (
                            <><Play className="h-4 w-4 mr-2 text-green-500" /> Resume Activity</>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:bg-destructive/10 cursor-pointer" onClick={() => handleDelete(account.id)}>
                          <Trash2 className="h-4 w-4 mr-2" /> Detach Node
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
                <CardContent className="pl-6 pt-2 pb-4 flex-1">
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

                  <div className="mt-4">
                    <div className="flex justify-between text-[10px] uppercase font-mono mb-1.5 text-muted-foreground">
                      <span>Health Score</span>
                      <span className="font-bold">{health}/100</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div className={`h-full ${hColor} transition-all duration-1000 ease-out`} style={{ width: `${health}%` }} />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="pl-6 pt-0 pb-3 flex flex-col gap-2 mt-auto">
                  <Button variant="ghost" size="sm" asChild className="w-full text-xs hover:bg-muted/50 border border-transparent hover:border-border transition-all">
                    <Link href={`/compose?accountId=${account.id}`}><PenSquare className="h-3 w-3 mr-2" /> Compose</Link>
                  </Button>
                </CardFooter>
              </Card>
            );
          })
        ) : (
          <div className="col-span-full flex flex-col items-center justify-center p-12 text-center border border-dashed rounded-lg bg-card/50">
            <Network className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
            <h3 className="text-lg font-bold mb-2">No connected nodes</h3>
            <p className="text-muted-foreground mb-4 max-w-md">Connect your first endpoint to start broadcasting and collecting telemetry.</p>
            <Button onClick={() => setIsAddOpen(true)}>Initialize First Node</Button>
          </div>
        )}
      </div>
    </div>
  );
}
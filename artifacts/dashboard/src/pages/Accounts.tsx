import { useListAccounts, useDeleteAccount, useCreateAccount, useUpdateAccount } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { SiX, SiReddit } from "react-icons/si";
import { MoreHorizontal, Plus, Trash2, Activity, Pause, Play, AlertTriangle, Network, PenSquare, KeyRound, CheckCircle2, XCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

function credentialStatus(credentials: string | null | undefined, platform: string) {
  if (!credentials) return false;
  try {
    const c = JSON.parse(credentials);
    if (platform === "twitter") return !!(c.apiKey && c.apiSecret && c.accessToken && c.accessSecret);
    if (platform === "reddit") return !!(c.clientId && c.clientSecret && c.username && c.password);
  } catch { /* empty */ }
  return false;
}

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

  // Twitter credential fields
  const [twApiKey, setTwApiKey] = useState("");
  const [twApiSecret, setTwApiSecret] = useState("");
  const [twAccessToken, setTwAccessToken] = useState("");
  const [twAccessSecret, setTwAccessSecret] = useState("");

  // Reddit credential fields
  const [rdClientId, setRdClientId] = useState("");
  const [rdClientSecret, setRdClientSecret] = useState("");
  const [rdUsername, setRdUsername] = useState("");
  const [rdPassword, setRdPassword] = useState("");

  const buildCredentials = () => {
    if (newPlatform === "twitter") {
      if (!twApiKey && !twApiSecret && !twAccessToken && !twAccessSecret) return null;
      return JSON.stringify({ apiKey: twApiKey, apiSecret: twApiSecret, accessToken: twAccessToken, accessSecret: twAccessSecret });
    }
    if (newPlatform === "reddit") {
      if (!rdClientId && !rdClientSecret && !rdUsername && !rdPassword) return null;
      return JSON.stringify({ clientId: rdClientId, clientSecret: rdClientSecret, username: rdUsername, password: rdPassword });
    }
    return null;
  };

  const resetForm = () => {
    setNewUsername(""); setNewDisplayName(""); setNewVoice("");
    setTwApiKey(""); setTwApiSecret(""); setTwAccessToken(""); setTwAccessSecret("");
    setRdClientId(""); setRdClientSecret(""); setRdUsername(""); setRdPassword("");
  };

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
    if (!newUsername || !newDisplayName) {
      toast.error("Username and display name are required");
      return;
    }
    const credentials = buildCredentials();
    createAccount.mutate({
      data: {
        platform: newPlatform as "twitter" | "reddit",
        username: newUsername,
        displayName: newDisplayName,
        color: newColor,
        voiceProfile: newVoice || null,
        status: "active",
        credentials,
      }
    }, {
      onSuccess: () => {
        toast.success(credentials ? "Node connected with API credentials ✓" : "Node added (add credentials in account settings to enable posting)");
        setIsAddOpen(false);
        resetForm();
        queryClient.invalidateQueries({ queryKey: ["accounts"] });
      },
      onError: (err) => toast.error(`Failed to add node: ${err.message}`),
    });
  };

  const handleTogglePause = (account: any) => {
    updateAccount.mutate({
      id: account.id,
      data: { status: account.status === "active" ? "paused" : "active" }
    }, {
      onSuccess: () => {
        toast.success(`Node ${account.status === "active" ? "paused" : "resumed"}`);
        queryClient.invalidateQueries({ queryKey: ["accounts"] });
      }
    });
  };

  const getHealth = (account: any) => {
    if (account.status === "suspended") return 10;
    if (account.status === "paused") return 40;
    const hasCredentials = credentialStatus(account.credentials, account.platform);
    const base = hasCredentials ? 70 : 30;
    return Math.min(100, base + (account.engagementRate || 0) * 2);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-sans">Network Nodes</h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">Manage all connected social endpoints.</p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={(o) => { setIsAddOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Add Node</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[540px] p-0">
            <DialogHeader className="p-6 pb-0">
              <DialogTitle className="flex items-center gap-2">
                <Network className="h-5 w-5 text-primary" /> Connect New Node
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Credentials are stored in the database and persist across all Replit actions.
              </p>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-4 p-6">
                {/* Platform */}
                <div className="space-y-2">
                  <Label>Platform</Label>
                  <Select value={newPlatform} onValueChange={(v) => { setNewPlatform(v); resetForm(); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="twitter"><div className="flex items-center gap-2"><SiX className="h-3 w-3" /> Twitter / X</div></SelectItem>
                      <SelectItem value="reddit"><div className="flex items-center gap-2"><SiReddit className="h-3 w-3" /> Reddit</div></SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Identity */}
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
                  <Label>AI Voice Profile <span className="text-muted-foreground">(optional)</span></Label>
                  <Textarea
                    placeholder="e.g. Professional but witty. Short sentences. Focus on tech insights."
                    className="min-h-[60px] text-sm resize-none"
                    value={newVoice}
                    onChange={(e) => setNewVoice(e.target.value)}
                  />
                </div>

                <Separator />

                {/* Platform credentials */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold">
                      {newPlatform === "twitter" ? "X / Twitter API Credentials" : "Reddit API Credentials"}
                    </p>
                    <Badge variant="outline" className="text-xs ml-auto">Stored in DB</Badge>
                  </div>

                  {newPlatform === "twitter" && (
                    <div className="space-y-3 rounded-lg border border-border/50 bg-muted/20 p-4">
                      <p className="text-xs text-muted-foreground">
                        Get these from{" "}
                        <a href="https://developer.twitter.com/en/portal/dashboard" target="_blank" rel="noopener noreferrer" className="underline text-primary">developer.twitter.com</a>
                        {" "}→ your app → Keys and Tokens.
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">API Key (Consumer Key)</Label>
                          <Input placeholder="xxxxxxxxxxxxxxxx" value={twApiKey} onChange={(e) => setTwApiKey(e.target.value)} className="font-mono text-xs" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">API Secret (Consumer Secret)</Label>
                          <Input placeholder="xxxxxxxxxxxxxxxx" type="password" value={twApiSecret} onChange={(e) => setTwApiSecret(e.target.value)} className="font-mono text-xs" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Access Token</Label>
                          <Input placeholder="xxxxxxx-xxxxxxxxxxxxxxxx" value={twAccessToken} onChange={(e) => setTwAccessToken(e.target.value)} className="font-mono text-xs" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Access Token Secret</Label>
                          <Input placeholder="xxxxxxxxxxxxxxxx" type="password" value={twAccessSecret} onChange={(e) => setTwAccessSecret(e.target.value)} className="font-mono text-xs" />
                        </div>
                      </div>
                    </div>
                  )}

                  {newPlatform === "reddit" && (
                    <div className="space-y-3 rounded-lg border border-border/50 bg-muted/20 p-4">
                      <p className="text-xs text-muted-foreground">
                        Get these from{" "}
                        <a href="https://www.reddit.com/prefs/apps" target="_blank" rel="noopener noreferrer" className="underline text-primary">reddit.com/prefs/apps</a>
                        {" "}→ create a "script" app. Use your account username/password.
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Client ID</Label>
                          <Input placeholder="xxxxxxxxxxxxxx" value={rdClientId} onChange={(e) => setRdClientId(e.target.value)} className="font-mono text-xs" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Client Secret</Label>
                          <Input placeholder="xxxxxxxxxxxxxxxxxxxxxx" type="password" value={rdClientSecret} onChange={(e) => setRdClientSecret(e.target.value)} className="font-mono text-xs" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Reddit Username</Label>
                          <Input placeholder="your_username" value={rdUsername} onChange={(e) => setRdUsername(e.target.value)} className="font-mono text-xs" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Reddit Password</Label>
                          <Input placeholder="••••••••" type="password" value={rdPassword} onChange={(e) => setRdPassword(e.target.value)} className="font-mono text-xs" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <Button onClick={handleAdd} disabled={createAccount.isPending} className="w-full">
                  {createAccount.isPending ? "Connecting…" : "Connect Node"}
                </Button>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>

      {/* Account grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="h-64"><CardContent className="pt-6"><Skeleton className="h-full w-full" /></CardContent></Card>
          ))
        ) : accounts && accounts.length > 0 ? (
          accounts.map((account) => {
            const health = getHealth(account);
            const hColor = health >= 70 ? "bg-green-500" : health >= 40 ? "bg-yellow-500" : "bg-red-500";
            const hasCreds = credentialStatus(account.credentials, account.platform);

            return (
              <Card key={account.id} className="flex flex-col overflow-hidden hover:shadow-lg transition-all duration-200 border-border/60 hover:border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full shrink-0 ring-2 ring-background" style={{ backgroundColor: account.color }} />
                      <div>
                        <p className="font-bold leading-tight">{account.displayName}</p>
                        <p className="text-xs text-muted-foreground font-mono">@{account.username}</p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link href={`/accounts/${account.id}`}><Activity className="h-4 w-4 mr-2" /> View Details</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleTogglePause(account)}>
                          {account.status === "active" ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                          {account.status === "active" ? "Pause Node" : "Resume Node"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleDelete(account.id)} className="text-destructive focus:text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" /> Detach Node
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    {account.platform === "twitter" ? (
                      <Badge variant="outline" className="gap-1 text-xs"><SiX className="h-3 w-3" /> Twitter / X</Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-xs"><SiReddit className="h-3 w-3 text-orange-500" /> Reddit</Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={`text-xs gap-1 ${account.status === "active" ? "text-green-600 border-green-500/30 bg-green-500/10" : account.status === "paused" ? "text-yellow-600 border-yellow-500/30 bg-yellow-500/10" : "text-red-600 border-red-500/30 bg-red-500/10"}`}
                    >
                      {account.status === "suspended" && <AlertTriangle className="h-3 w-3" />}
                      {account.status}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-xs gap-1 ml-auto ${hasCreds ? "text-green-600 border-green-500/30 bg-green-500/10" : "text-muted-foreground"}`}
                      title={hasCreds ? "API credentials configured — real posting enabled" : "No credentials — add in account settings"}
                    >
                      {hasCreds ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      {hasCreds ? "API Ready" : "No Creds"}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="pb-3">
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
                    {!hasCreds && (
                      <p className="text-[10px] text-muted-foreground mt-1.5">
                        ↑ Add API credentials in{" "}
                        <Link href={`/accounts/${account.id}`} className="underline text-primary">account settings</Link>
                        {" "}to unlock real posting.
                      </p>
                    )}
                  </div>
                </CardContent>

                <CardFooter className="pt-0 pb-3 gap-2">
                  <Button variant="ghost" size="sm" asChild className="flex-1 text-xs border border-transparent hover:border-border">
                    <Link href={`/compose?accountId=${account.id}`}><PenSquare className="h-3 w-3 mr-2" /> Compose</Link>
                  </Button>
                  <Button variant="ghost" size="sm" asChild className="flex-1 text-xs border border-transparent hover:border-border">
                    <Link href={`/accounts/${account.id}`}><KeyRound className="h-3 w-3 mr-2" /> Credentials</Link>
                  </Button>
                </CardFooter>
              </Card>
            );
          })
        ) : (
          <div className="col-span-full flex flex-col items-center justify-center p-16 text-center border border-dashed rounded-lg bg-card/50">
            <Network className="h-14 w-14 text-muted-foreground mb-4 opacity-20" />
            <h3 className="text-lg font-bold mb-2">No connected nodes</h3>
            <p className="text-muted-foreground mb-4 max-w-md text-sm">
              Connect your first social account to start broadcasting. Add API credentials to enable real posting.
            </p>
            <Button onClick={() => setIsAddOpen(true)}>Initialize First Node</Button>
          </div>
        )}
      </div>
    </div>
  );
}

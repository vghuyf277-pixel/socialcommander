import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useListAccounts, useCreatePost, useGenerateContent, useGetOptimalPostingTime, Account } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Calendar as CalendarIcon, Send, Save, RefreshCw, X, Loader2, MessageSquare, Heart, Share2, Eye } from "lucide-react";
import { SiX, SiReddit } from "react-icons/si";
import { toast } from "sonner";
import { format } from "date-fns";

export default function Compose() {
  const [_, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const initialAccountId = searchParams.get('accountId');
  const initialDate = searchParams.get('date');

  const { data: accounts } = useListAccounts();
  const createPost = useCreatePost();
  const generateContent = useGenerateContent();
  const getOptimalTime = useGetOptimalPostingTime();

  // Form state
  const [crossPostMode, setCrossPostMode] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(initialAccountId || "");
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>(initialAccountId ? [initialAccountId] : []);
  
  const [content, setContent] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [tone, setTone] = useState<string>("professional");
  const [scheduleMode, setScheduleMode] = useState(!!initialDate);
  const [scheduledDate, setScheduledDate] = useState(initialDate || "");
  const [scheduledTime, setScheduledTime] = useState("");
  const [redditTitle, setRedditTitle] = useState("");
  const [subreddit, setSubreddit] = useState("");

  const [variants, setVariants] = useState<string[]>([]);
  const [hashtags, setHashtags] = useState<string[]>([]);

  const activeAccountId = crossPostMode ? selectedAccountIds[0] : selectedAccountId;
  const activeAccount = accounts?.find(a => a.id.toString() === activeAccountId);

  const handleGenerate = () => {
    if (!activeAccountId || !aiPrompt) {
      toast.error("Select an account and provide a prompt");
      return;
    }

    generateContent.mutate(
      { 
        data: {
          accountId: Number(activeAccountId),
          prompt: aiPrompt,
          tone: tone as any,
          platform: activeAccount?.platform
        }
      },
      {
        onSuccess: (data) => {
          if (data.variants && data.variants.length > 0) {
            setVariants(data.variants);
            setContent(data.variants[0]);
            toast.success("Content generated successfully");
          }
          if (data.hashtags) {
            setHashtags(data.hashtags);
          }
        },
        onError: () => {
          toast.error("Failed to generate content");
        }
      }
    );
  };

  const handleGetOptimalTime = () => {
    if (!activeAccountId) return;
    
    getOptimalTime.mutate(
      { data: { accountId: Number(activeAccountId) } },
      {
        onSuccess: (data) => {
          if (data.slots && data.slots.length > 0) {
            const slot = data.slots[0];
            const today = new Date();
            today.setHours(slot.hour, 0, 0, 0);
            setScheduledDate(format(today, 'yyyy-MM-dd'));
            setScheduledTime(format(today, 'HH:mm'));
            toast.success("Optimal time applied");
          }
        }
      }
    );
  };

  const handleSubmit = (status: 'draft' | 'scheduled' | 'published') => {
    if (!content) {
      toast.error("Please provide content");
      return;
    }

    const postDataTemplate: any = { content, status: status === 'published' ? 'scheduled' : status };
    if (scheduleMode && scheduledDate && scheduledTime) {
      postDataTemplate.scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
    } else if (status === 'published') {
      postDataTemplate.scheduledAt = new Date().toISOString();
    }

    if (crossPostMode) {
      if (selectedAccountIds.length === 0) {
        toast.error("Select at least one account");
        return;
      }
      let successCount = 0;
      selectedAccountIds.forEach(accId => {
        const acc = accounts?.find(a => a.id.toString() === accId);
        const postData = { ...postDataTemplate, accountId: Number(accId) };
        if (acc?.platform === 'reddit') {
          postData.postTitle = redditTitle; postData.subreddit = subreddit;
          if (!redditTitle || !subreddit) return; // skip invalid
        }
        createPost.mutate({ data: postData }, {
          onSuccess: () => {
            successCount++;
            if (successCount === selectedAccountIds.length) {
              toast.success(`Cross-posted successfully`);
              setLocation("/");
            }
          }
        });
      });
      if (selectedAccountIds.some(id => accounts?.find(a => a.id.toString() === id)?.platform === 'reddit') && (!redditTitle || !subreddit)) {
        toast.error("Reddit posts require a title and subreddit");
      }
    } else {
      if (!selectedAccountId) { toast.error("Select an account"); return; }
      if (activeAccount?.platform === 'reddit' && (!redditTitle || !subreddit)) {
        toast.error("Reddit posts require a title and subreddit");
        return;
      }
      const postData = { ...postDataTemplate, accountId: Number(selectedAccountId) };
      if (activeAccount?.platform === 'reddit') {
        postData.postTitle = redditTitle; postData.subreddit = subreddit;
      }
      createPost.mutate({ data: postData }, {
        onSuccess: () => {
          toast.success(`Post ${status === 'draft' ? 'saved as draft' : 'scheduled'}`);
          setLocation("/");
        },
        onError: () => toast.error("Failed to create post")
      });
    }
  };

  const renderCharCount = () => {
    if (crossPostMode) return null;
    if (activeAccount?.platform !== 'twitter') return null;
    const len = content.length;
    const pct = Math.min(100, (len / 280) * 100);
    let color = 'text-green-500';
    if (len >= 220) color = 'text-amber-500';
    if (len > 270) color = 'text-red-500';
    
    return (
      <div className="absolute top-2 right-2 flex items-center justify-center w-8 h-8 pointer-events-none">
        <svg className="w-6 h-6 transform -rotate-90">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="transparent" className="text-muted/30" />
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="transparent" strokeDasharray="62.8" strokeDashoffset={62.8 - (62.8 * pct) / 100} className={color} />
        </svg>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-sans">Compose Transmission</h1>
        <p className="text-muted-foreground font-mono text-sm mt-1">Draft, generate, and schedule content.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border">
            <CardHeader className="pb-4 border-b border-border/50">
              <CardTitle>Content Builder</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-3 p-4 border border-primary/20 rounded-lg bg-primary/5">
                <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-primary">
                  <Sparkles className="h-4 w-4" /> AI Generation Pipeline
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <Input 
                      placeholder="What should this post be about?" 
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      className="bg-background"
                    />
                  </div>
                  <div>
                    <Select value={tone} onValueChange={setTone}>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Tone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="casual">Casual</SelectItem>
                        <SelectItem value="humorous">Humorous</SelectItem>
                        <SelectItem value="provocative">Provocative</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button 
                  onClick={handleGenerate} 
                  disabled={!activeAccountId || !aiPrompt || generateContent.isPending}
                  className="w-full gap-2"
                  variant="secondary"
                >
                  {generateContent.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Generate Content
                </Button>
                
                {variants.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                    {variants.map((v, i) => (
                      <div key={i} className="border p-3 rounded-lg bg-background flex flex-col justify-between text-sm shadow-sm hover:border-primary/50 transition-colors">
                        <p className="line-clamp-4 mb-3">{v}</p>
                        <Button variant="outline" size="sm" onClick={() => setContent(v)} className="w-full text-xs h-7">Use this variant</Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {(activeAccount?.platform === 'reddit' || (crossPostMode && selectedAccountIds.some(id => accounts?.find(a => a.id.toString() === id)?.platform === 'reddit'))) && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Subreddit</Label>
                    <Input placeholder="e.g. r/programming" value={subreddit} onChange={(e) => setSubreddit(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input placeholder="Post title" value={redditTitle} onChange={(e) => setRedditTitle(e.target.value)} />
                  </div>
                </div>
              )}

              <div className="space-y-2 relative">
                <Label className="flex justify-between">
                  <span>Transmission Body</span>
                  <span className={`text-xs font-mono ${content.length > 280 && activeAccount?.platform === 'twitter' ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {content.length} {activeAccount?.platform === 'twitter' ? '/ 280' : 'chars'}
                  </span>
                </Label>
                <div className="relative">
                  <Textarea 
                    className="min-h-[240px] resize-none text-base pr-12"
                    placeholder="Draft your content here..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                  {renderCharCount()}
                </div>
                
                {hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3 pt-2">
                    {hashtags.map((tag, i) => (
                      <Badge key={i} variant="outline" className="cursor-pointer hover:bg-primary/20 hover:text-primary transition-colors text-xs py-0.5" onClick={() => setContent(prev => prev + ' ' + tag)}>
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t bg-muted/20 py-4">
              <Button variant="ghost" onClick={() => handleSubmit('draft')} disabled={createPost.isPending}>
                <Save className="h-4 w-4 mr-2" /> Save Draft
              </Button>
              <Button 
                onClick={() => handleSubmit(scheduleMode ? 'scheduled' : 'published')}
                disabled={createPost.isPending || !content || (crossPostMode ? selectedAccountIds.length === 0 : !selectedAccountId)}
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                {scheduleMode ? 'Schedule' : 'Publish Now'}
              </Button>
            </CardFooter>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-lg flex justify-between items-center">
                <span>Target Nodes</span>
                <div className="flex items-center gap-2 text-sm font-normal">
                  <Label htmlFor="cross-post" className="cursor-pointer text-xs uppercase font-mono tracking-wider">Cross-post</Label>
                  <Switch id="cross-post" checked={crossPostMode} onCheckedChange={setCrossPostMode} />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {crossPostMode ? (
                <div className="space-y-4">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Twitter Nodes</div>
                  <div className="space-y-2">
                    {accounts?.filter(a => a.platform === 'twitter').map(acc => (
                      <div key={acc.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 transition-colors">
                        <input 
                          type="checkbox" 
                          id={`acc-${acc.id}`}
                          className="w-4 h-4 rounded border-input bg-background text-primary"
                          checked={selectedAccountIds.includes(acc.id.toString())}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedAccountIds(p => [...p, acc.id.toString()]);
                            else setSelectedAccountIds(p => p.filter(id => id !== acc.id.toString()));
                          }}
                        />
                        <Label htmlFor={`acc-${acc.id}`} className="flex items-center gap-2 cursor-pointer flex-1">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: acc.color }} />
                          {acc.displayName}
                        </Label>
                      </div>
                    ))}
                  </div>
                  
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 mt-4">Reddit Nodes</div>
                  <div className="space-y-2">
                    {accounts?.filter(a => a.platform === 'reddit').map(acc => (
                      <div key={acc.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 transition-colors">
                        <input 
                          type="checkbox" 
                          id={`acc-${acc.id}`}
                          className="w-4 h-4 rounded border-input bg-background text-primary"
                          checked={selectedAccountIds.includes(acc.id.toString())}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedAccountIds(p => [...p, acc.id.toString()]);
                            else setSelectedAccountIds(p => p.filter(id => id !== acc.id.toString()));
                          }}
                        />
                        <Label htmlFor={`acc-${acc.id}`} className="flex items-center gap-2 cursor-pointer flex-1">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: acc.color }} />
                          {acc.displayName}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <SelectTrigger className="h-12 bg-background">
                    <SelectValue placeholder="Select primary node..." />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts?.map((acc: Account) => (
                      <SelectItem key={acc.id} value={acc.id.toString()}>
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: acc.color }} />
                          <span>{acc.displayName}</span>
                          <span className="text-muted-foreground ml-2">
                            {acc.platform === 'twitter' ? <SiX className="h-3 w-3" /> : <SiReddit className="h-3 w-3" />}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-lg flex justify-between items-center">
                <span>Scheduling</span>
                <Switch checked={scheduleMode} onCheckedChange={setScheduleMode} />
              </CardTitle>
            </CardHeader>
            {scheduleMode && (
              <CardContent className="space-y-4 pt-4 animate-in fade-in zoom-in-95">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-muted-foreground font-mono">Date</Label>
                    <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="bg-background font-mono text-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-muted-foreground font-mono">Time</Label>
                    <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} className="bg-background font-mono text-sm" />
                  </div>
                </div>
                
                <Button 
                  variant="outline" 
                  className="w-full text-xs font-mono gap-2 border-primary/20 text-primary hover:bg-primary/10"
                  onClick={handleGetOptimalTime}
                  disabled={!activeAccountId || getOptimalTime.isPending}
                >
                  {getOptimalTime.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Calculate Optimal Time
                </Button>
              </CardContent>
            )}
          </Card>

          <div className="space-y-4">
            <h3 className="text-sm font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              Platform Preview <span className="w-full h-px bg-border/50 flex-1 ml-2"></span>
            </h3>
            
            {content ? (
              <div className="space-y-4">
                {(crossPostMode ? accounts?.filter(a => selectedAccountIds.includes(a.id.toString())) : accounts?.filter(a => a.id.toString() === selectedAccountId))?.map(acc => {
                  if (acc.platform === 'twitter') {
                    return (
                      <div key={acc.id} className="border border-border/50 rounded-xl p-4 bg-card text-left shadow-sm">
                        <div className="flex gap-3 mb-2">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold font-mono" style={{ backgroundColor: acc.color, color: '#fff'}}>{acc.displayName.charAt(0)}</div>
                          <div>
                            <div className="font-bold text-sm text-foreground hover:underline cursor-pointer">{acc.displayName}</div>
                            <div className="text-muted-foreground text-sm">@{acc.username}</div>
                          </div>
                          <SiX className="ml-auto text-muted-foreground h-4 w-4" />
                        </div>
                        <div className="text-sm whitespace-pre-wrap mb-3 text-foreground leading-snug">{content}</div>
                        <div className="flex justify-between text-muted-foreground max-w-sm px-2">
                          <MessageSquare className="h-4 w-4 hover:text-blue-500 cursor-pointer transition-colors" />
                          <RefreshCw className="h-4 w-4 hover:text-green-500 cursor-pointer transition-colors" />
                          <Heart className="h-4 w-4 hover:text-red-500 cursor-pointer transition-colors" />
                          <Eye className="h-4 w-4 hover:text-blue-500 cursor-pointer transition-colors" />
                          <Share2 className="h-4 w-4 hover:text-blue-500 cursor-pointer transition-colors" />
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div key={acc.id} className="border border-border/50 rounded-md bg-card mb-4 text-left flex shadow-sm overflow-hidden">
                        <div className="w-10 bg-muted/20 p-2 flex flex-col items-center gap-1 border-r border-border/50">
                          <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[8px] border-b-orange-500 cursor-pointer hover:border-b-orange-600"></div>
                          <div className="text-xs font-bold text-foreground">1</div>
                          <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-muted-foreground cursor-pointer hover:border-t-blue-500"></div>
                        </div>
                        <div className="p-3 w-full">
                          <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                            <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center"><SiReddit className="h-3 w-3 text-white" /></div>
                            <span className="font-bold text-foreground hover:underline cursor-pointer">r/{subreddit || 'subreddit'}</span>
                            <span>•</span>
                            <span>Posted by u/{acc.username}</span>
                          </div>
                          <div className="font-bold text-lg mb-2 text-foreground leading-tight">{redditTitle || 'Post Title'}</div>
                          <div className="text-sm whitespace-pre-wrap text-foreground">{content}</div>
                          <div className="flex gap-4 mt-3 text-xs font-bold text-muted-foreground">
                            <div className="flex items-center gap-1 hover:bg-muted/50 p-1 rounded cursor-pointer"><MessageSquare className="h-4 w-4" /> 0 Comments</div>
                            <div className="flex items-center gap-1 hover:bg-muted/50 p-1 rounded cursor-pointer"><Share2 className="h-4 w-4" /> Share</div>
                          </div>
                        </div>
                      </div>
                    );
                  }
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg bg-card/50">
                Content preview will appear here
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
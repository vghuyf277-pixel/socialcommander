import { useState } from "react";
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
import { Sparkles, Calendar as CalendarIcon, Send, Save, RefreshCw, X, Loader2 } from "lucide-react";
import { SiX, SiReddit } from "react-icons/si";
import { toast } from "sonner";
import { format } from "date-fns";

export default function Compose() {
  const [_, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const initialAccountId = searchParams.get('accountId');

  const { data: accounts } = useListAccounts();
  const createPost = useCreatePost();
  const generateContent = useGenerateContent();
  const getOptimalTime = useGetOptimalPostingTime();

  // Form state
  const [selectedAccountId, setSelectedAccountId] = useState<string>(initialAccountId || "");
  const [content, setContent] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [tone, setTone] = useState<string>("professional");
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [redditTitle, setRedditTitle] = useState("");
  const [subreddit, setSubreddit] = useState("");

  const selectedAccount = accounts?.find(a => a.id.toString() === selectedAccountId);

  const handleGenerate = () => {
    if (!selectedAccountId || !aiPrompt) {
      toast.error("Select an account and provide a prompt");
      return;
    }

    generateContent.mutate(
      { 
        data: {
          accountId: Number(selectedAccountId),
          prompt: aiPrompt,
          tone: tone as any,
          platform: selectedAccount?.platform
        }
      },
      {
        onSuccess: (data) => {
          if (data.variants && data.variants.length > 0) {
            setContent(data.variants[0]);
            toast.success("Content generated successfully");
          }
        },
        onError: () => {
          toast.error("Failed to generate content");
        }
      }
    );
  };

  const handleGetOptimalTime = () => {
    if (!selectedAccountId) return;
    
    getOptimalTime.mutate(
      { data: { accountId: Number(selectedAccountId) } },
      {
        onSuccess: (data) => {
          if (data.slots && data.slots.length > 0) {
            const slot = data.slots[0];
            // Mock setting date to next occurrence of that day/time
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
    if (!selectedAccountId || !content) {
      toast.error("Please fill in required fields");
      return;
    }

    if (selectedAccount?.platform === 'reddit' && (!redditTitle || !subreddit)) {
      toast.error("Reddit posts require a title and subreddit");
      return;
    }

    const postData: any = {
      accountId: Number(selectedAccountId),
      content,
      status: status === 'published' ? 'scheduled' : status, // API might only allow draft/scheduled for direct input
    };

    if (scheduleMode && scheduledDate && scheduledTime) {
      postData.scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
    } else if (status === 'published') {
      postData.scheduledAt = new Date().toISOString(); // Schedule for right now
    }

    if (selectedAccount?.platform === 'reddit') {
      postData.postTitle = redditTitle;
      postData.subreddit = subreddit;
    }

    createPost.mutate(
      { data: postData },
      {
        onSuccess: () => {
          toast.success(`Post ${status === 'draft' ? 'saved as draft' : 'scheduled'}`);
          setLocation("/");
        },
        onError: () => {
          toast.error("Failed to create post");
        }
      }
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-sans">Compose Transmission</h1>
        <p className="text-muted-foreground font-mono text-sm mt-1">Draft, generate, and schedule content.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle>Content Builder</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3 p-4 border rounded-lg bg-muted/10">
                <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-primary">
                  <Sparkles className="h-4 w-4" /> AI Generation Pipeline
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <Input 
                      placeholder="What should this post be about?" 
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                    />
                  </div>
                  <div>
                    <Select value={tone} onValueChange={setTone}>
                      <SelectTrigger>
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
                  disabled={!selectedAccountId || !aiPrompt || generateContent.isPending}
                  className="w-full gap-2"
                  variant="secondary"
                >
                  {generateContent.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Generate Content
                </Button>
              </div>

              {selectedAccount?.platform === 'reddit' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Subreddit</Label>
                    <Input 
                      placeholder="e.g. r/programming" 
                      value={subreddit}
                      onChange={(e) => setSubreddit(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input 
                      placeholder="Post title" 
                      value={redditTitle}
                      onChange={(e) => setRedditTitle(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label className="flex justify-between">
                  <span>Body</span>
                  <span className={`text-xs font-mono ${content.length > 280 && selectedAccount?.platform === 'twitter' ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {content.length} {selectedAccount?.platform === 'twitter' ? '/ 280' : 'chars'}
                  </span>
                </Label>
                <Textarea 
                  className="min-h-[200px] resize-none text-base"
                  placeholder="Draft your content here..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t bg-muted/20 py-4">
              <Button variant="ghost" onClick={() => handleSubmit('draft')} disabled={createPost.isPending}>
                <Save className="h-4 w-4 mr-2" /> Save Draft
              </Button>
              <Button 
                onClick={() => handleSubmit(scheduleMode ? 'scheduled' : 'published')}
                disabled={createPost.isPending || !content || !selectedAccountId}
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
            <CardHeader>
              <CardTitle className="text-lg">Target Node</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger className="h-14">
                  <SelectValue placeholder="Select account..." />
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex justify-between items-center">
                <span>Scheduling</span>
                <Switch checked={scheduleMode} onCheckedChange={setScheduleMode} />
              </CardTitle>
            </CardHeader>
            {scheduleMode && (
              <CardContent className="space-y-4 animate-in fade-in zoom-in-95">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input 
                      type="date" 
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Time</Label>
                    <Input 
                      type="time" 
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                    />
                  </div>
                </div>
                
                <Button 
                  variant="outline" 
                  className="w-full text-xs font-mono gap-2 border-primary/20 text-primary hover:bg-primary/10"
                  onClick={handleGetOptimalTime}
                  disabled={!selectedAccountId || getOptimalTime.isPending}
                >
                  {getOptimalTime.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Use AI Optimal Time
                </Button>
              </CardContent>
            )}
          </Card>

          <Card className="bg-card/50 border-dashed">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                Preview <span className="w-full h-px bg-border/50 flex-1 ml-2"></span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {content ? (
                <div className="space-y-3">
                  {selectedAccount?.platform === 'reddit' && (
                    <div className="font-bold text-lg leading-tight">
                      {redditTitle || "Post Title"}
                    </div>
                  )}
                  <div className="text-sm whitespace-pre-wrap">
                    {content}
                  </div>
                  <div className="flex gap-2 pt-2 text-blue-500 text-xs font-mono overflow-hidden">
                    {content.match(/#[\w]+/g)?.map((tag, i) => (
                      <span key={i}>{tag}</span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Content preview will appear here
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

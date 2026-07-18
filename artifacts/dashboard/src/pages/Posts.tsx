import { useState } from "react";
import {
  useListPosts,
  useDeletePost,
  usePublishPost,
  useListAccounts,
  useDuplicatePost,
  useBulkDeletePosts,
} from "@workspace/api-client-react";
import type { Post } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  FileText, Plus, Search, MoreHorizontal, Trash2, Copy, Send, Clock,
  ChevronLeft, ChevronRight, AlertCircle, RefreshCw, Filter, SortDesc,
  CheckSquare, X,
} from "lucide-react";
import { SiX, SiReddit } from "react-icons/si";
import { format, formatDistanceToNow } from "date-fns";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  scheduled: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  published: "bg-green-500/15 text-green-400 border-green-500/30",
  failed: "bg-red-500/15 text-red-400 border-red-500/30",
};

const PAGE_SIZE = 25;

export default function Posts() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const { data: accounts } = useListAccounts();
  const { data, isLoading, isError, error, refetch } = useListPosts(
    {
      status: statusFilter === "all" ? undefined : (statusFilter as any),
      accountId: accountFilter === "all" ? undefined : Number(accountFilter),
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    },
    { query: { refetchInterval: 30_000 } }
  );

  const deletePost = useDeletePost();
  const publishPost = usePublishPost();
  const duplicatePost = useDuplicatePost();
  const bulkDelete = useBulkDeletePosts();

  const posts = data?.posts ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Client-side search filter (for the current page)
  const filtered = search.trim()
    ? posts.filter(
        (p) =>
          p.content?.toLowerCase().includes(search.toLowerCase()) ||
          (p as any).account?.username?.toLowerCase().includes(search.toLowerCase()) ||
          p.postTitle?.toLowerCase().includes(search.toLowerCase())
      )
    : posts;

  const allSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));
  const someSelected = selected.size > 0;

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((p) => p.id)));
    }
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["listPosts"] });
    queryClient.invalidateQueries({ queryKey: ["getAccountsOverview"] });
  };

  const handleDelete = (id: number) => {
    deletePost.mutate({ id }, {
      onSuccess: () => {
        toast.success("Post deleted");
        setDeleteId(null);
        setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
        invalidate();
      },
      onError: (e) => toast.error(`Delete failed: ${e.message}`),
    });
  };

  const handlePublish = (id: number) => {
    publishPost.mutate({ id }, {
      onSuccess: () => { toast.success("Post published"); invalidate(); },
      onError: (e) => toast.error(`Publish failed: ${e.message}`),
    });
  };

  const handleDuplicate = (id: number) => {
    duplicatePost.mutate({ id }, {
      onSuccess: (newPost) => {
        toast.success("Draft created — click to edit");
        invalidate();
        setLocation(`/compose?postId=${(newPost as any).id}`);
      },
      onError: (e) => toast.error(`Duplicate failed: ${e.message}`),
    });
  };

  const handleBulkDelete = () => {
    bulkDelete.mutate(
      { data: { ids: [...selected] } },
      {
        onSuccess: (r: any) => {
          toast.success(`Deleted ${r.deleted} posts`);
          setSelected(new Set());
          setBulkDeleteOpen(false);
          invalidate();
        },
        onError: (e) => toast.error(`Bulk delete failed: ${e.message}`),
      }
    );
  };

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-sans">Posts</h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">
            {total.toLocaleString()} total · manage, filter, and publish
          </p>
        </div>
        <Button className="gap-2 shrink-0" onClick={() => setLocation("/compose")}>
          <Plus className="h-4 w-4" />
          Compose
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search content, username…"
            className="pl-9 h-9 font-mono text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearch("")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); setSelected(new Set()); }}>
          <SelectTrigger className="w-[140px] h-9">
            <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={accountFilter} onValueChange={(v) => { setAccountFilter(v); setPage(0); setSelected(new Set()); }}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="All accounts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            {accounts?.map((a) => (
              <SelectItem key={a.id} value={String(a.id)}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                  @{a.username}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => refetch()} title="Refresh">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Bulk actions bar */}
      {someSelected && (
        <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-primary/10 border border-primary/30">
          <CheckSquare className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Delete selected
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Content */}
      {isError ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
            <AlertCircle className="h-10 w-10 text-destructive opacity-60" />
            <div>
              <p className="font-semibold">Failed to load posts</p>
              <p className="text-sm text-muted-foreground mt-1 font-mono">
                {(error as Error)?.message ?? "Database may be unavailable"}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" /> Retry
            </Button>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <FileText className="h-10 w-10 text-muted-foreground opacity-30" />
            <p className="font-semibold">No posts found</p>
            <p className="text-sm text-muted-foreground">
              {search || statusFilter !== "all" || accountFilter !== "all"
                ? "Try adjusting your filters"
                : "Compose your first post to get started"}
            </p>
            {!search && statusFilter === "all" && accountFilter === "all" && (
              <Button size="sm" onClick={() => setLocation("/compose")}>
                <Plus className="h-4 w-4 mr-2" /> Compose
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Table header */}
          <div className="flex items-center gap-3 px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            <Checkbox
              checked={allSelected}
              onCheckedChange={toggleAll}
              className="shrink-0"
              aria-label="Select all"
            />
            <span className="flex-1">Content</span>
            <span className="w-24 text-right hidden sm:block">Status</span>
            <span className="w-32 text-right hidden md:block">Date</span>
            <span className="w-8" />
          </div>

          {/* Post rows */}
          <div className="space-y-1.5">
            {filtered.map((post) => {
              const acc = (post as any).account;
              const isSelected = selected.has(post.id);
              const scheduledDate = post.scheduledAt ? new Date(post.scheduledAt) : null;
              const publishedDate = post.publishedAt ? new Date(post.publishedAt) : null;
              const dateLabel = post.status === "scheduled" && scheduledDate
                ? `Scheduled ${format(scheduledDate, "MMM d, h:mm a")}`
                : publishedDate
                ? formatDistanceToNow(publishedDate, { addSuffix: true })
                : post.createdAt
                ? formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })
                : "—";

              return (
                <div
                  key={post.id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors hover:bg-muted/40 group ${
                    isSelected ? "bg-primary/5 border-primary/30" : "bg-card border-border/50"
                  }`}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelect(post.id)}
                    className="shrink-0"
                  />

                  {/* Account color bar */}
                  <div
                    className="w-1 h-8 rounded-full shrink-0"
                    style={{ backgroundColor: acc?.color ?? "#6366f1" }}
                  />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {acc?.platform === "twitter" ? (
                        <SiX className="h-3 w-3 text-muted-foreground shrink-0" />
                      ) : (
                        <SiReddit className="h-3 w-3 text-orange-500 shrink-0" />
                      )}
                      <span className="text-xs font-mono text-muted-foreground">@{acc?.username ?? "unknown"}</span>
                      {post.postTitle && (
                        <span className="text-xs font-semibold truncate hidden sm:block">{post.postTitle}</span>
                      )}
                    </div>
                    <p className="text-sm truncate text-foreground leading-snug">{post.content}</p>
                  </div>

                  {/* Status */}
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-mono uppercase shrink-0 hidden sm:flex ${STATUS_COLORS[post.status] ?? ""}`}
                  >
                    {post.status === "scheduled" && <Clock className="h-2.5 w-2.5 mr-1" />}
                    {post.status}
                  </Badge>

                  {/* Date */}
                  <span className="text-xs text-muted-foreground font-mono w-32 text-right hidden md:block truncate">
                    {dateLabel}
                  </span>

                  {/* Actions */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      {(post.status === "draft" || post.status === "failed") && (
                        <DropdownMenuItem onClick={() => handlePublish(post.id)}>
                          <Send className="h-4 w-4 mr-2 text-green-500" />
                          Publish now
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => setLocation(`/compose?postId=${post.id}`)}>
                        <FileText className="h-4 w-4 mr-2 text-primary" />
                        Edit draft
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicate(post.id)}>
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:bg-destructive/10"
                        onClick={() => setDeleteId(post.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground font-mono">
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total.toLocaleString()}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page === 0}
                  onClick={() => { setPage((p) => p - 1); setSelected(new Set()); }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs font-mono min-w-[60px] text-center">
                  {page + 1} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page >= totalPages - 1}
                  onClick={() => { setPage((p) => p + 1); setSelected(new Set()); }}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Delete single confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete post?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && handleDelete(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete confirm */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} posts?</AlertDialogTitle>
            <AlertDialogDescription>
              All selected posts will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleBulkDelete}
            >
              Delete {selected.size} posts
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

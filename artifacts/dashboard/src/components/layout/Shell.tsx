import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { 
  Sidebar, SidebarContent, SidebarHeader, SidebarProvider, 
  SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarGroup,
  SidebarGroupLabel, SidebarGroupContent, SidebarTrigger
} from "@/components/ui/sidebar";
import { 
  LayoutDashboard, Users, PenSquare, Calendar as CalendarIcon, FileText,
  BarChart3, ListTree, Activity, Settings, Plus, Moon, Sun, Bell, Search, SlidersHorizontal
} from "lucide-react";
import { useListAccounts, useGetAccountsOverview, useListPosts } from "@workspace/api-client-react";
import { SiX, SiReddit } from "react-icons/si";
import { useTheme } from "../theme-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";

export function Shell({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: accounts } = useListAccounts();
  const { theme, setTheme } = useTheme();

  const { data: accountsOverview, isError: isOverviewError } = useGetAccountsOverview();
  const { data: failedPostsData } = useListPosts({ status: 'failed' as any, limit: 50 });
  const failedCount = failedPostsData?.posts?.length || 0;

  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCmdOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen w-full bg-background text-foreground selection:bg-primary/30">
        <Sidebar className="border-r border-border bg-card">
          <SidebarHeader className="h-14 flex items-center px-4 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-primary rounded-sm flex items-center justify-center">
                <Activity className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-bold font-mono tracking-tight text-lg leading-none">SOCIAL_CMD</span>
            </div>
          </SidebarHeader>
          <SidebarContent className="py-2">
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Operations</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {[
                    { href: "/", label: "Dashboard", icon: LayoutDashboard },
                    { href: "/compose", label: "Compose", icon: PenSquare },
                    { href: "/posts", label: "Posts", icon: FileText },
                    { href: "/calendar", label: "Calendar", icon: CalendarIcon },
                    { href: "/analytics", label: "Analytics", icon: BarChart3 },
                  ].map(item => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={location === item.href}>
                        <Link href={item.href} className="flex items-center gap-3">
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            
            <SidebarGroup className="mt-2">
              <SidebarGroupLabel className="text-xs font-mono uppercase tracking-wider text-muted-foreground">System</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {[
                    { href: "/queue", label: "Queue Health", icon: ListTree },
                    { href: "/audit", label: "Audit Log", icon: Activity },
                    { href: "/settings", label: "Settings", icon: SlidersHorizontal },
                  ].map(item => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={location === item.href}>
                        <Link href={item.href} className="flex items-center gap-3 text-muted-foreground">
                          <item.icon className="h-4 w-4" />
                          <span className="flex-1">{item.label}</span>
                          {item.href === "/queue" && failedCount > 0 && (
                            <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup className="mt-4">
              <div className="flex items-center justify-between px-2 py-1">
                <SidebarGroupLabel className="p-0 text-xs font-mono uppercase tracking-wider text-muted-foreground">Network</SidebarGroupLabel>
                <Link href="/accounts" className="text-muted-foreground hover:text-foreground transition-colors">
                  <Plus className="h-4 w-4" />
                </Link>
              </div>
              <SidebarGroupContent>
                <SidebarMenu>
                  {accounts?.map(acc => (
                    <SidebarMenuItem key={acc.id}>
                      <SidebarMenuButton asChild isActive={location === `/accounts/${acc.id}`}>
                        <Link href={`/accounts/${acc.id}`} className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: acc.color }} />
                          <span className="flex-1 truncate">{acc.displayName}</span>
                          {acc.platform === "twitter" ? <SiX className="h-3 w-3 shrink-0 text-muted-foreground" /> : <SiReddit className="h-3 w-3 shrink-0 text-muted-foreground" />}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/accounts"}>
                      <Link href="/accounts" className="flex items-center gap-3 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>All Accounts</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

          </SidebarContent>
        </Sidebar>
        <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
          <header className="h-14 flex items-center px-4 border-b border-border shrink-0 bg-background/95 backdrop-blur z-10">
            <SidebarTrigger className="mr-4" />
            
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-muted/30 border border-border/50 text-[10px] font-mono tracking-wider uppercase">
              <div className={`w-2 h-2 rounded-full ${isOverviewError ? 'bg-red-500 animate-pulse' : 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]'}`} />
              {isOverviewError ? 'System Degraded' : 'System Online'}
            </div>

            <div className="flex-1 flex justify-center px-4">
              <Button variant="outline" className="hidden md:flex gap-2 text-muted-foreground w-full max-w-sm justify-start text-xs font-mono bg-muted/20" onClick={() => setCmdOpen(true)}>
                <Search className="h-3.5 w-3.5" />
                Search network...
                <kbd className="ml-auto bg-muted px-1.5 py-0.5 rounded text-[10px]">⌘K</kbd>
              </Button>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" asChild className="relative w-8 h-8">
                <Link href="/queue">
                  <Bell className="h-4 w-4" />
                  {failedCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 w-4 h-4 p-0 flex items-center justify-center bg-destructive text-[10px] animate-in zoom-in">{failedCount}</Badge>
                  )}
                </Link>
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="w-8 h-8"
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </div>
          </header>
          <div className="flex-1 overflow-auto bg-muted/10 p-6">
            <div className="max-w-[1600px] mx-auto">
              {children}
            </div>
          </div>
        </main>
      </div>

      <Dialog open={cmdOpen} onOpenChange={setCmdOpen}>
        <DialogContent className="p-0 overflow-hidden shadow-2xl border-border max-w-xl">
          <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
            <CommandInput placeholder="Type a command or search..." />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup heading="Quick Actions">
                <CommandItem onSelect={() => { setLocation('/'); setCmdOpen(false); }}>
                  <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
                </CommandItem>
                <CommandItem onSelect={() => { setLocation('/compose'); setCmdOpen(false); }}>
                  <PenSquare className="mr-2 h-4 w-4" /> Compose
                </CommandItem>
                <CommandItem onSelect={() => { setLocation('/posts'); setCmdOpen(false); }}>
                  <FileText className="mr-2 h-4 w-4" /> Posts
                </CommandItem>
                <CommandItem onSelect={() => { setLocation('/calendar'); setCmdOpen(false); }}>
                  <CalendarIcon className="mr-2 h-4 w-4" /> Calendar
                </CommandItem>
                <CommandItem onSelect={() => { setLocation('/analytics'); setCmdOpen(false); }}>
                  <BarChart3 className="mr-2 h-4 w-4" /> Analytics
                </CommandItem>
                <CommandItem onSelect={() => { setLocation('/queue'); setCmdOpen(false); }}>
                  <ListTree className="mr-2 h-4 w-4" /> Queue
                </CommandItem>
                <CommandItem onSelect={() => { setLocation('/audit'); setCmdOpen(false); }}>
                  <Activity className="mr-2 h-4 w-4" /> Audit
                </CommandItem>
                <CommandItem onSelect={() => { setLocation('/settings'); setCmdOpen(false); }}>
                  <SlidersHorizontal className="mr-2 h-4 w-4" /> Settings
                </CommandItem>
              </CommandGroup>
              <CommandGroup heading="Accounts">
                {accounts?.map(acc => (
                  <CommandItem key={acc.id} onSelect={() => { setLocation(`/accounts/${acc.id}`); setCmdOpen(false); }}>
                    <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: acc.color }} />
                    {acc.displayName}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
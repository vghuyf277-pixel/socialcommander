import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { 
  Sidebar, SidebarContent, SidebarHeader, SidebarProvider, 
  SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarGroup,
  SidebarGroupLabel, SidebarGroupContent, SidebarTrigger
} from "@/components/ui/sidebar";
import { 
  LayoutDashboard, Users, PenSquare, Calendar as CalendarIcon, 
  BarChart3, ListTree, Activity, Settings, Plus, Moon, Sun
} from "lucide-react";
import { useListAccounts } from "@workspace/api-client-react";
import { SiX, SiReddit } from "react-icons/si";
import { useTheme } from "../theme-provider";
import { Button } from "@/components/ui/button";

export function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { data: accounts } = useListAccounts();
  const { theme, setTheme } = useTheme();

  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen w-full bg-background text-foreground">
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

            <SidebarGroup className="mt-auto pt-4 border-t border-border">
              <SidebarGroupLabel className="text-xs font-mono uppercase tracking-wider text-muted-foreground">System</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {[
                    { href: "/queue", label: "Queue Health", icon: ListTree },
                    { href: "/audit", label: "Audit Log", icon: Activity },
                  ].map(item => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={location === item.href}>
                        <Link href={item.href} className="flex items-center gap-3 text-muted-foreground">
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
          <header className="h-14 flex items-center px-4 border-b border-border shrink-0 bg-background/95 backdrop-blur z-10">
            <SidebarTrigger className="mr-4" />
            <div className="flex-1" />
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="w-8 h-8"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </header>
          <div className="flex-1 overflow-auto bg-muted/20 p-6">
            <div className="max-w-[1600px] mx-auto">
              {children}
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}

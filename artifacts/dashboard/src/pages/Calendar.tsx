import { useState } from "react";
import { useGetCalendar, useListAccounts, Post } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Plus } from "lucide-react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, parseISO } from "date-fns";
import { SiX, SiReddit } from "react-icons/si";
import { useLocation } from "wouter";

export default function Calendar() {
  const [, setLocation] = useLocation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all");

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  
  const { data: accounts } = useListAccounts();
  const { data: calendarData, isLoading } = useGetCalendar({
    startDate: monthStart.toISOString(),
    endDate: monthEnd.toISOString(),
    accountId: selectedAccountId === "all" ? undefined : Number(selectedAccountId)
  });

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Map entries by date string (YYYY-MM-DD)
  const entriesByDate = calendarData?.reduce((acc, entry) => {
    acc[entry.date] = entry.posts;
    return acc;
  }, {} as Record<string, Post[]>) || {};

  let scheduledCount = 0;
  let publishedCount = 0;
  
  if (calendarData) {
    calendarData.forEach(day => {
      day.posts.forEach(p => {
        if (p.status === 'scheduled') scheduledCount++;
        if (p.status === 'published') publishedCount++;
      });
    });
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-sans">Content Matrix</h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">Timeline of scheduled and published transmissions.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Accounts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Accounts</SelectItem>
              {accounts?.map((acc) => (
                <SelectItem key={acc.id} value={acc.id.toString()}>
                  {acc.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <div className="flex items-center rounded-md border bg-card p-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="w-[120px] text-center font-bold font-mono">
              {format(currentDate, 'MMMM yyyy')}
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden bg-card/50">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 border-b shrink-0 bg-muted/20 gap-3">
          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0 no-scrollbar">
            {accounts?.map(acc => (
              <div key={acc.id} className="flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-md bg-background border border-border/50 text-xs">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: acc.color }} />
                <span className="font-medium whitespace-nowrap">{acc.displayName}</span>
              </div>
            ))}
          </div>
          
          <div className="flex gap-3 text-xs font-mono shrink-0 whitespace-nowrap">
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500" /> {scheduledCount} Scheduled</div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500" /> {publishedCount} Published</div>
          </div>
        </div>
        
        <div className="grid grid-cols-7 border-b shrink-0">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="py-3 text-center text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground border-r last:border-r-0">
              {day}
            </div>
          ))}
        </div>
        
        <div className="flex-1 overflow-y-auto bg-background/50">
          {isLoading ? (
            <div className="grid grid-cols-7 h-full">
              {[...Array(35)].map((_, i) => (
                <div key={i} className="border-r border-b min-h-[120px] p-2">
                  <Skeleton className="h-4 w-6 mb-2" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-7 auto-rows-fr h-full">
              {/* Padding days for first week */}
              {Array.from({ length: monthStart.getDay() }).map((_, i) => (
                <div key={`empty-start-${i}`} className="border-r border-b min-h-[120px] bg-muted/10 opacity-50 p-2" />
              ))}
              
              {days.map((day) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const dayPosts = entriesByDate[dateKey] || [];
                const isCurrentMonth = isSameMonth(day, currentDate);
                
                return (
                  <div 
                    key={dateKey} 
                    className={`border-r border-b min-h-[120px] p-2 transition-colors hover:bg-muted/30 group ${
                      !isCurrentMonth ? 'bg-muted/10 opacity-50' : ''
                    }`}
                    onClick={(e) => {
                      if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('flex-1')) {
                         setLocation(`/compose?date=${dateKey}`);
                      }
                    }}
                  >
                    <div className="flex justify-between items-start mb-2 pointer-events-none">
                      <span className={`text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday(day) ? 'bg-primary text-primary-foreground' : ''
                      }`}>
                        {format(day, 'd')}
                      </span>
                      {dayPosts.length > 0 && (
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-mono">
                          {dayPosts.length}
                        </Badge>
                      )}
                      {dayPosts.length === 0 && (
                         <Plus className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-50 mt-1 mr-1" />
                      )}
                    </div>
                    
                    <div className="space-y-1.5 overflow-y-auto max-h-[100px] no-scrollbar">
                      {dayPosts.map((post) => (
                        <div 
                          key={post.id} 
                          className={`text-[10px] p-1.5 rounded-sm border truncate cursor-pointer hover:border-foreground/30 transition-colors flex flex-col gap-0.5
                            ${post.status === 'scheduled' ? 'border-dashed opacity-80' : ''}
                          `}
                          title={post.content}
                          style={{ 
                            borderLeftWidth: '3px', 
                            borderLeftColor: post.account?.color || 'var(--primary)',
                            backgroundColor: 'var(--card)'
                          }}
                        >
                          <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5 font-mono">
                            {post.platform === 'twitter' ? <SiX className="h-2 w-2 shrink-0" /> : <SiReddit className="h-2 w-2 shrink-0 text-orange-500" />}
                            {post.scheduledAt && post.status === 'scheduled' && (
                              <span className="flex items-center gap-0.5"><Clock className="h-2 w-2" /> {format(new Date(post.scheduledAt), 'h:mm a')}</span>
                            )}
                            <span className="truncate">@{post.account?.username}</span>
                          </div>
                          <span className="truncate text-foreground font-medium">{post.content}</span>
                        </div>
                      ))}
                    </div>
                    {/* Invisible div to fill space and capture clicks for new posts */}
                    <div className="flex-1 min-h-[40px] cursor-pointer" />
                  </div>
                );
              })}

              {/* Padding days for last week */}
              {Array.from({ length: 6 - monthEnd.getDay() }).map((_, i) => (
                <div key={`empty-end-${i}`} className="border-r border-b min-h-[120px] bg-muted/10 opacity-50 p-2" />
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
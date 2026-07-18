import { useState } from "react";
import { useGetCalendar, useListAccounts, Post } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, parseISO } from "date-fns";
import { SiX, SiReddit } from "react-icons/si";

export default function Calendar() {
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
        <div className="grid grid-cols-7 border-b shrink-0">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="py-3 text-center text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground border-r last:border-r-0">
              {day}
            </div>
          ))}
        </div>
        
        <div className="flex-1 overflow-y-auto">
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
                    className={`border-r border-b min-h-[120px] p-2 transition-colors hover:bg-muted/30 ${
                      !isCurrentMonth ? 'bg-muted/10 opacity-50' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
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
                    </div>
                    
                    <div className="space-y-1.5 overflow-y-auto max-h-[100px] no-scrollbar">
                      {dayPosts.map((post) => (
                        <div 
                          key={post.id} 
                          className="text-xs p-1.5 rounded-sm border truncate cursor-pointer hover:border-foreground/30 transition-colors flex items-center gap-1.5"
                          title={post.content}
                          style={{ 
                            borderLeftWidth: '3px', 
                            borderLeftColor: post.account?.color || 'var(--primary)',
                            backgroundColor: 'var(--card)'
                          }}
                        >
                          {post.platform === 'twitter' ? <SiX className="h-2.5 w-2.5 shrink-0" /> : <SiReddit className="h-2.5 w-2.5 shrink-0 text-orange-500" />}
                          <span className="truncate flex-1">{post.content}</span>
                          {post.status === 'scheduled' && <CalendarIcon className="h-2.5 w-2.5 shrink-0 text-blue-500" />}
                        </div>
                      ))}
                    </div>
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

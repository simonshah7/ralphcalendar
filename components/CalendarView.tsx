'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Activity, Status } from '@/db/schema';
import { startOfMonth, endOfMonth, addDays, isSameDay, getContrastTextColor } from '@/lib/utils';

interface CalendarViewProps {
  activities: Activity[];
  statuses: Status[];
  onActivityClick: (activity: Activity) => void;
  onDateClick: (date: string) => void;
}

interface SpanningBar {
  activity: Activity;
  startCol: number;
  span: number;
  showTitle: boolean;
  row: number;
}

export function CalendarView({
  activities,
  statuses,
  onActivityClick,
  onDateClick,
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [popover, setPopover] = useState<{
    date: Date;
    activities: Activity[];
    anchorRect: DOMRect;
  } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  const calendarStart = new Date(monthStart);
  calendarStart.setDate(calendarStart.getDate() - calendarStart.getDay());

  const calendarEnd = new Date(monthEnd);
  calendarEnd.setDate(calendarEnd.getDate() + (6 - calendarEnd.getDay()));

  const days: Date[] = [];
  let day = new Date(calendarStart);
  while (day <= calendarEnd) {
    days.push(new Date(day));
    day = addDays(day, 1);
  }

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const toDateStr = (date: Date) => date.toISOString().split('T')[0];

  const getActivitiesForDay = useCallback((date: Date) => {
    const dateStr = toDateStr(date);
    return activities.filter((activity) => {
      return dateStr >= activity.startDate && dateStr <= activity.endDate;
    });
  }, [activities]);

  const getActivityStyle = (activity: Activity) => {
    const status = statuses.find((s) => s.id === activity.statusId);
    const bgColor = activity.color || status?.color || '#3B53FF';
    return {
      backgroundColor: bgColor,
      color: getContrastTextColor(bgColor),
    };
  };

  const isCurrentMonth = (date: Date) => date.getMonth() === currentDate.getMonth();
  const isToday = (date: Date) => isSameDay(date, new Date());

  const navigatePrev = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const navigateNext = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const navigateToday = () => setCurrentDate(new Date());

  // Detect if an activity is multi-day
  const isMultiDay = (activity: Activity) => activity.startDate !== activity.endDate;

  // Compute spanning bars for a given week
  const getSpanningBarsForWeek = useCallback((week: Date[]): SpanningBar[] => {
    const weekStartStr = toDateStr(week[0]);
    const weekEndStr = toDateStr(week[6]);

    // Find all multi-day activities that overlap this week
    const multiDayActivities = activities.filter((activity) => {
      if (!isMultiDay(activity)) return false;
      return activity.startDate <= weekEndStr && activity.endDate >= weekStartStr;
    });

    // Sort for stable ordering: by start date, then by longer duration first, then by title
    const sorted = [...multiDayActivities].sort((a, b) => {
      if (a.startDate !== b.startDate) return a.startDate < b.startDate ? -1 : 1;
      const aDur = a.endDate.localeCompare(a.startDate);
      const bDur = b.endDate.localeCompare(b.startDate);
      if (aDur !== bDur) return bDur - aDur;
      return a.title.localeCompare(b.title);
    });

    const bars: SpanningBar[] = [];
    // Track rows used per column to stack bars
    const rowMap = new Map<string, number>(); // activity.id -> assigned row (persistent across weeks)

    // Assign rows greedily
    const usedRows: boolean[][] = Array.from({ length: 7 }, () => []);

    for (const activity of sorted) {
      const actStartStr = activity.startDate;
      const actEndStr = activity.endDate;

      // Clamp to this week
      const visibleStartStr = actStartStr < weekStartStr ? weekStartStr : actStartStr;
      const visibleEndStr = actEndStr > weekEndStr ? weekEndStr : actEndStr;

      // Find column indices
      let startCol = -1;
      let endCol = -1;
      for (let i = 0; i < 7; i++) {
        const ds = toDateStr(week[i]);
        if (ds === visibleStartStr) startCol = i;
        if (ds === visibleEndStr) endCol = i;
      }
      if (startCol === -1 || endCol === -1) continue;

      const span = endCol - startCol + 1;
      const showTitle = actStartStr >= weekStartStr; // show title on first visible day of each week row

      // Find the first available row for this span
      let row = 0;
      let found = false;
      while (!found) {
        let available = true;
        for (let c = startCol; c <= endCol; c++) {
          if (usedRows[c][row]) {
            available = false;
            break;
          }
        }
        if (available) {
          found = true;
        } else {
          row++;
        }
      }

      // Mark rows as used
      for (let c = startCol; c <= endCol; c++) {
        usedRows[c][row] = true;
      }

      bars.push({ activity, startCol, span, showTitle, row });
    }

    return bars;
  }, [activities]);

  // Compute single-day activities for a given date (exclude multi-day ones)
  const getSingleDayActivitiesForDay = useCallback((date: Date) => {
    const dateStr = toDateStr(date);
    return activities.filter((activity) => {
      if (isMultiDay(activity)) return false;
      return dateStr >= activity.startDate && dateStr <= activity.endDate;
    });
  }, [activities]);

  // Get number of spanning bar rows for a week to reserve space
  const getSpanningRowCount = (bars: SpanningBar[]) => {
    if (bars.length === 0) return 0;
    return Math.max(...bars.map((b) => b.row)) + 1;
  };

  // Close popover on click outside
  useEffect(() => {
    if (!popover) return;
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopover(null);
      }
    };
    // Delay to avoid the same click that opened it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [popover]);

  // Close popover on month navigation
  useEffect(() => {
    setPopover(null);
  }, [currentDate]);

  const handleMoreClick = (e: React.MouseEvent, date: Date, dayActivities: Activity[]) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPopover({ date, activities: dayActivities, anchorRect: rect });
  };

  // Memoize spanning bars per week
  const weekBars = useMemo(() => {
    return weeks.map((week) => getSpanningBarsForWeek(week));
  }, [weeks, getSpanningBarsForWeek]);

  // Max single-day items visible before "+N more" (accounting for spanning bar space)
  const MAX_SINGLE_DAY_VISIBLE = 2;

  return (
    <div className="flex-1 flex flex-col bg-card overflow-hidden">
      {/* Calendar Controls */}
      <div className="flex items-center justify-between px-2 sm:px-4 py-2.5 border-b border-card-border bg-surface">
        <div className="flex items-center gap-1.5">
          <button
            onClick={navigatePrev}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-sm sm:text-lg font-semibold text-foreground min-w-[120px] sm:min-w-[200px] text-center">
            {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h2>
          <button
            onClick={navigateNext}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Click any day to add an activity</span>
          </div>
          <button
            onClick={navigateToday}
            className="px-3 py-1 text-xs font-medium text-foreground bg-muted rounded-md hover:bg-card-hover transition-colors"
          >
            Today
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b border-card-border bg-surface">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div
              key={day}
              className="py-1.5 sm:py-2 text-center text-xs sm:text-sm font-medium text-muted-foreground"
            >
              <span className="sm:hidden">{day.charAt(0)}</span>
              <span className="hidden sm:inline">{day}</span>
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="flex-1 grid grid-rows-[repeat(auto-fill,minmax(0,1fr))] overflow-auto">
          {weeks.map((week, weekIndex) => {
            const bars = weekBars[weekIndex];
            const spanningRowCount = getSpanningRowCount(bars);
            const SPANNING_ROW_HEIGHT = 20; // px per spanning bar row
            const spanningAreaHeight = spanningRowCount * SPANNING_ROW_HEIGHT;

            return (
              <div key={weekIndex} className="grid grid-cols-7 border-b border-card-border/30 relative">
                {/* Spanning bars layer */}
                {bars.map((bar) => {
                  const style = getActivityStyle(bar.activity);
                  const leftPercent = (bar.startCol / 7) * 100;
                  const widthPercent = (bar.span / 7) * 100;
                  // Position: top of cell + date number height (~28px) + row offset
                  const topOffset = 28 + bar.row * SPANNING_ROW_HEIGHT;

                  return (
                    <div
                      key={`${bar.activity.id}-${bar.startCol}`}
                      className="absolute z-10 cursor-pointer hover:opacity-80 truncate text-[10px] sm:text-xs px-1 sm:px-1.5 flex items-center rounded-sm"
                      style={{
                        ...style,
                        left: `calc(${leftPercent}% + 2px)`,
                        width: `calc(${widthPercent}% - 4px)`,
                        top: `${topOffset}px`,
                        height: `${SPANNING_ROW_HEIGHT - 2}px`,
                        lineHeight: `${SPANNING_ROW_HEIGHT - 2}px`,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onActivityClick(bar.activity);
                      }}
                    >
                      {bar.showTitle ? bar.activity.title : ''}
                    </div>
                  );
                })}

                {/* Day cells */}
                {week.map((date, dayIndex) => {
                  const allDayActivities = getActivitiesForDay(date);
                  const singleDayActivities = getSingleDayActivitiesForDay(date);
                  const dateStr = toDateStr(date);

                  // How many single-day items can we show
                  const visibleSingle = singleDayActivities.slice(0, MAX_SINGLE_DAY_VISIBLE);
                  const hiddenCount = allDayActivities.length - (spanningRowCount > 0 ? bars.filter(b => {
                    // count spanning bars visible on this day
                    return dayIndex >= b.startCol && dayIndex < b.startCol + b.span;
                  }).length : 0) - visibleSingle.length;

                  // Total remaining = all activities for this day minus those already shown
                  const spanningOnThisDay = bars.filter(b => dayIndex >= b.startCol && dayIndex < b.startCol + b.span);
                  const shownCount = spanningOnThisDay.length + visibleSingle.length;
                  const totalForDay = allDayActivities.length;
                  const remainingCount = totalForDay - shownCount;

                  return (
                    <div
                      key={dayIndex}
                      className={`min-h-[60px] sm:min-h-[100px] border-r border-card-border/30 p-1 sm:p-1.5 cursor-pointer transition-colors hover:bg-accent-soft/30 ${
                        !isCurrentMonth(date) ? 'bg-muted/30' : ''
                      }`}
                      onClick={() => onDateClick(dateStr)}
                    >
                      <div
                        className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full transition-colors ${
                          isToday(date)
                            ? 'bg-accent text-white'
                            : isCurrentMonth(date)
                              ? 'text-foreground'
                              : 'text-muted-foreground'
                          }`}
                      >
                        {date.getDate()}
                      </div>
                      {/* Spacer for spanning bars */}
                      {spanningAreaHeight > 0 && (
                        <div style={{ height: `${spanningAreaHeight}px` }} />
                      )}
                      {/* Single-day activities */}
                      <div className="space-y-0.5">
                        {visibleSingle.map((activity) => (
                          <div
                            key={activity.id}
                            className="text-[10px] sm:text-xs px-1 sm:px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80"
                            style={getActivityStyle(activity)}
                            onClick={(e) => {
                              e.stopPropagation();
                              onActivityClick(activity);
                            }}
                          >
                            {activity.title}
                          </div>
                        ))}
                        {remainingCount > 0 && (
                          <div
                            className="text-[10px] sm:text-xs text-accent-purple px-1 cursor-pointer hover:underline"
                            onClick={(e) => handleMoreClick(e, date, allDayActivities)}
                          >
                            +{remainingCount} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Popover for "+N more" */}
      {popover && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={`Activities for ${popover.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`}
          className="fixed z-50 bg-card border border-card-border rounded-lg shadow-lg p-2 min-w-[180px] max-w-[260px] max-h-[300px] overflow-y-auto"
          style={{
            top: Math.min(popover.anchorRect.bottom + 4, window.innerHeight - 320),
            left: Math.min(popover.anchorRect.left, window.innerWidth - 270),
          }}
        >
          <div className="text-xs font-semibold text-foreground mb-2 px-1">
            {popover.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </div>
          <div className="space-y-1">
            {popover.activities.map((activity) => {
              const style = getActivityStyle(activity);
              return (
                <div
                  key={activity.id}
                  className="flex items-center gap-2 px-1.5 py-1 rounded cursor-pointer hover:bg-muted transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPopover(null);
                    onActivityClick(activity);
                  }}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: style.backgroundColor }}
                  />
                  <span className="text-xs text-foreground truncate">{activity.title}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

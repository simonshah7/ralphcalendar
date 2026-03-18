'use client';

import { useState } from 'react';
import { Activity, Status } from '@/db/schema';
import { startOfMonth, endOfMonth, addDays, isSameDay, getContrastTextColor } from '@/lib/utils';

interface CalendarViewProps {
  activities: Activity[];
  statuses: Status[];
  onActivityClick: (activity: Activity) => void;
  onDateClick: (date: string) => void;
}

export function CalendarView({
  activities,
  statuses,
  onActivityClick,
  onDateClick,
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

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

  const getActivitiesForDay = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return activities.filter((activity) => {
      return dateStr >= activity.startDate && dateStr <= activity.endDate;
    });
  };

  const getActivityStyle = (activity: Activity) => {
    const status = statuses.find((s) => s.id === activity.statusId);
    const bgColor = activity.color || status?.color || '#2563EB';
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
        <button
          onClick={navigateToday}
          className="px-3 py-1 text-xs font-medium text-foreground bg-muted rounded-md hover:bg-card-hover transition-colors"
        >
          Today
        </button>
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
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7 border-b border-card-border/30">
              {week.map((date, dayIndex) => {
                const dayActivities = getActivitiesForDay(date);
                const dateStr = date.toISOString().split('T')[0];

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
                    <div className="space-y-0.5">
                      {dayActivities.slice(0, 2).map((activity) => (
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
                      {dayActivities.length > 2 && (
                        <div
                          className="text-[10px] sm:text-xs text-accent-purple px-1 cursor-pointer hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            onActivityClick(dayActivities[2]);
                          }}
                        >
                          +{dayActivities.length - 2} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Activity, Status } from '@/db/schema';
import { startOfMonth, endOfMonth, addDays, isSameDay } from '@/lib/utils';

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

  // Get first day of the calendar grid (might be from previous month)
  const calendarStart = new Date(monthStart);
  calendarStart.setDate(calendarStart.getDate() - calendarStart.getDay());

  // Get last day of the calendar grid
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
    return {
      backgroundColor: activity.color || status?.color || '#3B82F6',
    };
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  const isToday = (date: Date) => {
    return isSameDay(date, new Date());
  };

  const navigatePrev = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const navigateNext = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const navigateToday = () => {
    setCurrentDate(new Date());
  };

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 overflow-hidden">
      {/* Calendar Controls */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <button
            onClick={navigatePrev}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white min-w-[200px] text-center">
            {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h2>
          <button
            onClick={navigateNext}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <button
          onClick={navigateToday}
          className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          Today
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div
              key={day}
              className="py-2 text-center text-sm font-medium text-gray-500 dark:text-gray-400"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="flex-1 grid grid-rows-[repeat(auto-fill,minmax(0,1fr))] overflow-auto">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-800">
              {week.map((date, dayIndex) => {
                const dayActivities = getActivitiesForDay(date);
                const dateStr = date.toISOString().split('T')[0];

                return (
                  <div
                    key={dayIndex}
                    className={`min-h-[100px] border-r border-gray-100 dark:border-gray-800 p-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                      !isCurrentMonth(date) ? 'bg-gray-50 dark:bg-gray-900/50' : ''
                    }`}
                    onClick={() => onDateClick(dateStr)}
                  >
                    <div
                      className={`text-sm font-medium mb-1 w-7 h-7 flex items-center justify-center rounded-full ${
                        isToday(date)
                          ? 'bg-blue-600 text-white'
                          : isCurrentMonth(date)
                          ? 'text-gray-900 dark:text-white'
                          : 'text-gray-400 dark:text-gray-500'
                      }`}
                    >
                      {date.getDate()}
                    </div>
                    <div className="space-y-1">
                      {dayActivities.slice(0, 3).map((activity) => (
                        <div
                          key={activity.id}
                          className="text-xs px-1.5 py-0.5 rounded truncate text-white cursor-pointer hover:opacity-80"
                          style={getActivityStyle(activity)}
                          onClick={(e) => {
                            e.stopPropagation();
                            onActivityClick(activity);
                          }}
                        >
                          {activity.title}
                        </div>
                      ))}
                      {dayActivities.length > 3 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 px-1">
                          +{dayActivities.length - 3} more
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

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Activity, Swimlane, Status } from '@/db/schema';
import { addDays, getDaysBetween } from '@/lib/utils';
import { SwimlaneSidebar } from './SwimlaneSidebar';

interface TimelineViewProps {
  activities: Activity[];
  swimlanes: Swimlane[];
  statuses: Status[];
  onActivityClick: (activity: Activity) => void;
  onActivityCreate: (swimlaneId: string, startDate: string, endDate: string) => void;
  onActivityUpdate: (id: string, updates: Partial<Activity>) => Promise<void>;
  onAddSwimlane: (name: string) => void;
  onEditSwimlane: (id: string, name: string) => void;
  onDeleteSwimlane: (id: string) => void;
  onReorderSwimlanes: (swimlaneId: string, newIndex: number) => void;
}

type ZoomLevel = 'year' | 'quarter' | 'month';

const ZOOM_CONFIG: Record<ZoomLevel, { daysVisible: number; dayWidth: number }> = {
  year: { daysVisible: 365, dayWidth: 4 },
  quarter: { daysVisible: 90, dayWidth: 10 },
  month: { daysVisible: 30, dayWidth: 30 },
};

const ROW_HEIGHT = 60;
const DEFAULT_SIDEBAR_WIDTH = 200;
const MIN_SIDEBAR_WIDTH = 150;
const MAX_SIDEBAR_WIDTH = 400;
const HEADER_HEIGHT = 60;

export function TimelineView({
  activities,
  swimlanes,
  statuses,
  onActivityClick,
  onActivityCreate,
  onActivityUpdate,
  onAddSwimlane,
  onEditSwimlane,
  onDeleteSwimlane,
  onReorderSwimlanes,
}: TimelineViewProps) {
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('quarter');
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; swimlaneId: string } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<number | null>(null);
  const [resizing, setResizing] = useState<{ activityId: string; edge: 'start' | 'end'; initialDate: string } | null>(null);
  const [moving, setMoving] = useState<{ activityId: string; initialX: number; initialStartDate: string } | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const handleSidebarWidthChange = useCallback((width: number) => {
    setSidebarWidth(Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, width)));
  }, []);

  const config = ZOOM_CONFIG[zoomLevel];
  const totalWidth = config.daysVisible * config.dayWidth;

  const getDateFromX = useCallback((x: number): Date => {
    const dayOffset = Math.floor(x / config.dayWidth);
    return addDays(startDate, dayOffset);
  }, [config.dayWidth, startDate]);

  const getXFromDate = useCallback((date: Date | string): number => {
    const d = new Date(date);
    const daysDiff = getDaysBetween(startDate, d) - 1;
    return daysDiff * config.dayWidth;
  }, [config.dayWidth, startDate]);

  const getActivityStyle = (activity: Activity) => {
    const start = getXFromDate(activity.startDate);
    const end = getXFromDate(activity.endDate);
    const width = end - start + config.dayWidth;
    const status = statuses.find((s) => s.id === activity.statusId);
    const color = activity.color || status?.color || '#3B82F6';

    return {
      left: `${start}px`,
      width: `${Math.max(width, config.dayWidth)}px`,
      backgroundColor: color,
    };
  };

  const handleMouseDown = (e: React.MouseEvent, swimlaneId: string) => {
    if ((e.target as HTMLElement).closest('.activity-bar')) return;

    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left + (timelineRef.current?.scrollLeft || 0);
    setDragStart({ x, swimlaneId });
    setDragCurrent(x);
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left + (timelineRef.current?.scrollLeft || 0);

    if (isDragging && dragStart) {
      setDragCurrent(x);
    }

    if (resizing) {
      const activity = activities.find((a) => a.id === resizing.activityId);
      if (!activity) return;

      const newDate = getDateFromX(x).toISOString().split('T')[0];

      if (resizing.edge === 'end') {
        if (newDate >= activity.startDate) {
          onActivityUpdate(activity.id, { endDate: newDate });
        }
      } else {
        if (newDate <= activity.endDate) {
          onActivityUpdate(activity.id, { startDate: newDate });
        }
      }
    }

    if (moving) {
      const activity = activities.find((a) => a.id === moving.activityId);
      if (!activity) return;

      const deltaX = x - moving.initialX;
      const deltaDays = Math.round(deltaX / config.dayWidth);
      const initialStart = new Date(moving.initialStartDate);
      const newStart = addDays(initialStart, deltaDays);
      const duration = getDaysBetween(activity.startDate, activity.endDate);
      const newEnd = addDays(newStart, duration - 1);

      onActivityUpdate(activity.id, {
        startDate: newStart.toISOString().split('T')[0],
        endDate: newEnd.toISOString().split('T')[0],
      });
    }
  };

  const handleMouseUp = () => {
    if (isDragging && dragStart && dragCurrent !== null) {
      const minX = Math.min(dragStart.x, dragCurrent);
      const maxX = Math.max(dragStart.x, dragCurrent);

      if (maxX - minX > 10) {
        const startDateStr = getDateFromX(minX).toISOString().split('T')[0];
        const endDateStr = getDateFromX(maxX).toISOString().split('T')[0];
        onActivityCreate(dragStart.swimlaneId, startDateStr, endDateStr);
      }
    }

    setIsDragging(false);
    setDragStart(null);
    setDragCurrent(null);
    setResizing(null);
    setMoving(null);
  };

  const handleActivityMouseDown = (e: React.MouseEvent, activity: Activity) => {
    e.stopPropagation();

    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const relativeX = e.clientX - rect.left;
    const width = rect.width;

    if (relativeX < 10) {
      setResizing({ activityId: activity.id, edge: 'start', initialDate: activity.startDate });
    } else if (relativeX > width - 10) {
      setResizing({ activityId: activity.id, edge: 'end', initialDate: activity.endDate });
    } else {
      const timelineRect = timelineRef.current?.getBoundingClientRect();
      if (timelineRect) {
        const x = e.clientX - timelineRect.left + (timelineRef.current?.scrollLeft || 0);
        setMoving({ activityId: activity.id, initialX: x, initialStartDate: activity.startDate });
      }
    }
  };

  const handleSwimlaneChange = async (activityId: string, newSwimlaneId: string) => {
    await onActivityUpdate(activityId, { swimlaneId: newSwimlaneId });
  };

  const renderTimeHeader = () => {
    const headers: React.ReactElement[] = [];
    const subHeaders: React.ReactElement[] = [];
    let currentDate = new Date(startDate);

    if (zoomLevel === 'year') {
      for (let i = 0; i < 12; i++) {
        const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
        const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
        const width = daysInMonth * config.dayWidth;

        headers.push(
          <div
            key={`month-${i}`}
            className="flex-shrink-0 border-r border-gray-200 dark:border-gray-700 text-center text-sm font-medium text-gray-700 dark:text-gray-200 py-2"
            style={{ width: `${width}px` }}
          >
            {monthStart.toLocaleDateString('en-US', { month: 'short' })}
          </div>
        );
      }
    } else if (zoomLevel === 'quarter') {
      for (let i = 0; i < 3; i++) {
        const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
        const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
        const width = daysInMonth * config.dayWidth;

        headers.push(
          <div
            key={`month-${i}`}
            className="flex-shrink-0 border-r border-gray-200 dark:border-gray-700 text-center text-sm font-medium text-gray-700 dark:text-gray-200 py-2"
            style={{ width: `${width}px` }}
          >
            {monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </div>
        );

        for (let d = 1; d <= daysInMonth; d++) {
          const dayDate = new Date(monthStart.getFullYear(), monthStart.getMonth(), d);
          const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;
          subHeaders.push(
            <div
              key={`day-${i}-${d}`}
              className={`flex-shrink-0 border-r border-gray-100 dark:border-gray-800 text-center text-xs py-1 ${
                isWeekend ? 'bg-gray-50 dark:bg-gray-800/50 text-gray-400' : 'text-gray-500 dark:text-gray-400'
              }`}
              style={{ width: `${config.dayWidth}px` }}
            >
              {d}
            </div>
          );
        }
      }
    } else {
      const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();

      headers.push(
        <div
          key="month"
          className="flex-shrink-0 text-center text-sm font-medium text-gray-700 dark:text-gray-200 py-2"
          style={{ width: `${totalWidth}px` }}
        >
          {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </div>
      );

      for (let d = 1; d <= daysInMonth; d++) {
        const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), d);
        const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;
        const dayName = dayDate.toLocaleDateString('en-US', { weekday: 'short' });
        subHeaders.push(
          <div
            key={`day-${d}`}
            className={`flex-shrink-0 border-r border-gray-100 dark:border-gray-800 text-center text-xs py-1 ${
              isWeekend ? 'bg-gray-50 dark:bg-gray-800/50 text-gray-400' : 'text-gray-500 dark:text-gray-400'
            }`}
            style={{ width: `${config.dayWidth}px` }}
          >
            <div>{dayName}</div>
            <div className="font-medium">{d}</div>
          </div>
        );
      }
    }

    return (
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex">{headers}</div>
        {subHeaders.length > 0 && <div className="flex">{subHeaders}</div>}
      </div>
    );
  };

  const renderTodayLine = () => {
    const today = new Date();
    const x = getXFromDate(today);
    if (x < 0 || x > totalWidth) return null;

    return (
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none"
        style={{ left: `${x}px` }}
      >
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-red-500 rounded-full" />
      </div>
    );
  };

  const renderDragSelection = () => {
    if (!isDragging || !dragStart || dragCurrent === null) return null;

    const swimlaneIndex = swimlanes.findIndex((s) => s.id === dragStart.swimlaneId);
    if (swimlaneIndex === -1) return null;

    const minX = Math.min(dragStart.x, dragCurrent);
    const maxX = Math.max(dragStart.x, dragCurrent);

    return (
      <div
        className="absolute bg-blue-200/50 dark:bg-blue-600/30 border-2 border-blue-400 dark:border-blue-500 rounded pointer-events-none"
        style={{
          left: `${minX}px`,
          top: `${swimlaneIndex * ROW_HEIGHT + 4}px`,
          width: `${maxX - minX}px`,
          height: `${ROW_HEIGHT - 8}px`,
        }}
      />
    );
  };

  // Navigate timeline
  const navigatePrev = () => {
    const days = zoomLevel === 'year' ? 365 : zoomLevel === 'quarter' ? 90 : 30;
    setStartDate(addDays(startDate, -days));
  };

  const navigateNext = () => {
    const days = zoomLevel === 'year' ? 365 : zoomLevel === 'quarter' ? 90 : 30;
    setStartDate(addDays(startDate, days));
  };

  const navigateToday = () => {
    const now = new Date();
    setStartDate(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false);
      setDragStart(null);
      setDragCurrent(null);
      setResizing(null);
      setMoving(null);
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  if (swimlanes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-2">No swimlanes yet</p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Add swimlanes to start organizing your activities
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 overflow-hidden">
      {/* Timeline Controls */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center gap-2">
          <button
            onClick={navigatePrev}
            className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={navigateToday}
            className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Today
          </button>
          <button
            onClick={navigateNext}
            className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-4">
          {/* Activity Creation Hint */}
          <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/50 px-3 py-1.5 rounded-full">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Drag on timeline to create activity</span>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            {(['year', 'quarter', 'month'] as ZoomLevel[]).map((level) => (
              <button
                key={level}
                onClick={() => setZoomLevel(level)}
                className={`px-3 py-1 text-sm rounded ${
                  zoomLevel === level
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline Content */}
      <div className="flex-1 flex overflow-hidden" ref={containerRef}>
        {/* Swimlane Sidebar with Management */}
        <SwimlaneSidebar
          swimlanes={swimlanes}
          rowHeight={ROW_HEIGHT}
          headerHeight={HEADER_HEIGHT}
          sidebarWidth={sidebarWidth}
          onSidebarWidthChange={handleSidebarWidthChange}
          onAddSwimlane={onAddSwimlane}
          onEditSwimlane={onEditSwimlane}
          onDeleteSwimlane={onDeleteSwimlane}
          onReorderSwimlanes={onReorderSwimlanes}
        />

        {/* Timeline Area */}
        <div
          ref={timelineRef}
          className="flex-1 overflow-auto"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Time Header */}
          <div style={{ width: `${totalWidth}px`, height: `${HEADER_HEIGHT}px` }}>
            {renderTimeHeader()}
          </div>

          {/* Swimlane Rows */}
          <div className="relative" style={{ width: `${totalWidth}px` }}>
            {renderTodayLine()}
            {renderDragSelection()}

            {swimlanes.map((swimlane, index) => {
              const swimlaneActivities = activities.filter((a) => a.swimlaneId === swimlane.id);
              const isEmpty = swimlaneActivities.length === 0;

              return (
                <div
                  key={swimlane.id}
                  className={`relative border-b border-gray-100 dark:border-gray-800 ${
                    index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/50 dark:bg-gray-800/50'
                  } ${isDragging && dragStart?.swimlaneId === swimlane.id ? 'bg-blue-50/30 dark:bg-blue-900/20' : ''}`}
                  style={{ height: `${ROW_HEIGHT}px` }}
                  onMouseDown={(e) => handleMouseDown(e, swimlane.id)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const activityId = e.dataTransfer.getData('activityId');
                    if (activityId) {
                      handleSwimlaneChange(activityId, swimlane.id);
                    }
                  }}
                >
                  {/* Empty state hint */}
                  {isEmpty && !isDragging && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-xs text-gray-400 dark:text-gray-500 opacity-50">
                        Click and drag to create an activity
                      </span>
                    </div>
                  )}

                  {swimlaneActivities.map((activity) => {
                    const style = getActivityStyle(activity);
                    return (
                      <div
                        key={activity.id}
                        className="activity-bar absolute top-2 bottom-2 rounded shadow-sm cursor-pointer hover:shadow-md transition-shadow flex items-center px-2 overflow-hidden group"
                        style={style}
                        onClick={() => onActivityClick(activity)}
                        onMouseDown={(e) => handleActivityMouseDown(e, activity)}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('activityId', activity.id);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        title={`${activity.title}\n${activity.startDate} - ${activity.endDate}`}
                      >
                        {/* Resize handles */}
                        <div className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-black/20" />
                        <div className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-black/20" />

                        <span className="text-xs text-white font-medium truncate">
                          {activity.title}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

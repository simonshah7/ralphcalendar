'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Activity, Swimlane, Status, Campaign } from '@/db/schema';
import { addDays, getDaysBetween } from '@/lib/utils';
import { SwimlaneSidebar } from './SwimlaneSidebar';

interface TimelineViewProps {
  activities: Activity[];
  swimlanes: Swimlane[];
  statuses: Status[];
  campaigns: Campaign[];
  onActivityClick: (activity: Activity) => void;
  onActivityCreate: (swimlaneId: string, startDate: string, endDate: string, defaults?: Partial<Activity>, silent?: boolean) => void;
  onActivityUpdate: (id: string, updates: Partial<Activity>) => Promise<void>;
  onAddSwimlane: (name: string) => void;
  onEditSwimlane: (id: string, name: string) => void;
  onDeleteSwimlane: (id: string) => void;
  onReorderSwimlanes: (swimlaneId: string, newIndex: number) => void;
}

type ZoomLevel = 'year' | 'quarter' | 'month';

const ZOOM_CONFIG: Record<ZoomLevel, { daysVisible: number; dayWidth: number }> = {
  year: { daysVisible: 365, dayWidth: 4 },
  quarter: { daysVisible: 90, dayWidth: 24 },
  month: { daysVisible: 30, dayWidth: 30 },
};

type CardStyle = 'small' | 'medium' | 'large';

const STYLE_CONFIG: Record<CardStyle, { rowHeight: number; fontSize: string; padding: string }> = {
  small: { rowHeight: 40, fontSize: 'text-[10px]', padding: 'py-0.5' },
  medium: { rowHeight: 60, fontSize: 'text-xs', padding: 'py-1' },
  large: { rowHeight: 100, fontSize: 'text-sm', padding: 'py-2' },
};

const AVAILABLE_FIELDS = [
  { id: 'status', label: 'Status' },
  { id: 'campaign', label: 'Campaign' },
  { id: 'cost', label: 'Cost/Budget' },
  { id: 'region', label: 'Region' },
  { id: 'tags', label: 'Tags' },
  { id: 'description', label: 'Description' },
];

const DEFAULT_SIDEBAR_WIDTH = 200;
const MIN_SIDEBAR_WIDTH = 150;
const MAX_SIDEBAR_WIDTH = 400;
const HEADER_HEIGHT = 60;

export function TimelineView({
  activities,
  swimlanes,
  statuses,
  campaigns,
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
  const [moving, setMoving] = useState<{ activityId: string; initialX: number; initialStartDate: string; initialSwimlaneId: string } | null>(null);
  const [tempActivity, setTempActivity] = useState<{ id: string; startDate: string; endDate: string; swimlaneId: string } | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);

  // View Settings
  const [cardStyle, setCardStyle] = useState<CardStyle>('medium');
  const [visibleFields, setVisibleFields] = useState<string[]>(['status', 'campaign']);
  const [showSettings, setShowSettings] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Load settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('timeline_view_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.cardStyle) setCardStyle(parsed.cardStyle);
        if (parsed.visibleFields) setVisibleFields(parsed.visibleFields);
      } catch (e) {
        console.error('Failed to parse timeline settings', e);
      }
    }
  }, []);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('timeline_view_settings', JSON.stringify({ cardStyle, visibleFields }));
  }, [cardStyle, visibleFields]);

  // Close settings when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const rowHeight = STYLE_CONFIG[cardStyle].rowHeight;

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

  // Activity Stacking Logic
  const getSwimlaneActivitiesWithLevels = (swimlaneId: string) => {
    const rawActivities = activities.filter((a) => {
      const isTemp = tempActivity && tempActivity.id === a.id;
      const currentSwimlaneId = isTemp ? tempActivity.swimlaneId : a.swimlaneId;
      return currentSwimlaneId === swimlaneId;
    });

    // If current temp activity is for a new creation (not move/resize), add it
    if (isDragging && dragStart && dragStart.swimlaneId === swimlaneId && dragCurrent !== null) {
      const minX = Math.min(dragStart.x, dragCurrent);
      const maxX = Math.max(dragStart.x, dragCurrent);
      const start = getDateFromX(minX).toISOString().split('T')[0];
      const end = getDateFromX(maxX).toISOString().split('T')[0];

      // If it exists in rawActivities (e.g. update), it's already handled
      // But for new drag creation, we add a mock activity
      if (!rawActivities.find(a => a.id === 'temp-new')) {
        rawActivities.push({
          id: 'temp-new',
          title: 'New Activity',
          startDate: start,
          endDate: end,
          swimlaneId: swimlaneId,
          statusId: '',
          campaignId: '',
          color: null,
          cost: null,
          currency: 'USD',
          region: null,
          tags: null,
          description: null,
          calendarId: '',
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Activity);
      }
    }

    // Sort by start date, then by duration (longer first)
    const sorted = [...rawActivities].sort((a, b) => {
      const aStart = new Date(tempActivity?.id === a.id ? tempActivity.startDate : a.startDate).getTime();
      const bStart = new Date(tempActivity?.id === b.id ? tempActivity.startDate : b.startDate).getTime();
      if (aStart !== bStart) return aStart - bStart;

      const aEnd = new Date(tempActivity?.id === a.id ? tempActivity.endDate : a.endDate).getTime();
      const bEnd = new Date(tempActivity?.id === b.id ? tempActivity.endDate : b.endDate).getTime();
      return (bEnd - bStart) - (aEnd - aStart);
    });

    const activitiesWithLevels: (Activity & { level: number })[] = [];
    const levels: { end: number }[][] = [];

    sorted.forEach(activity => {
      const isTemp = tempActivity && tempActivity.id === activity.id;
      const start = new Date(isTemp ? tempActivity.startDate : activity.startDate).getTime();
      const end = new Date(isTemp ? tempActivity.endDate : activity.endDate).getTime();

      let levelFound = -1;
      for (let i = 0; i < levels.length; i++) {
        // Check if any activity in this level overlaps
        const hasOverlap = levels[i].some(l => {
          // Add a small buffer (1ms) to prevent edge-to-edge overlap issues if desired, 
          // or keep it strict if same day end/start is okay.
          // In this calendar, end date is inclusive, so we need to check if start <= levelEnd
          return start <= l.end;
        });

        if (!hasOverlap) {
          levelFound = i;
          break;
        }
      }

      if (levelFound === -1) {
        levelFound = levels.length;
        levels.push([{ end }]);
      } else {
        levels[levelFound].push({ end });
      }

      activitiesWithLevels.push({ ...activity, level: levelFound });
    });

    return {
      activities: activitiesWithLevels,
      maxLevel: levels.length > 0 ? levels.length - 1 : 0,
      totalHeight: Math.max(1, levels.length) * rowHeight
    };
  };

  const swimlaneData = swimlanes.reduce((acc, s) => {
    acc[s.id] = getSwimlaneActivitiesWithLevels(s.id);
    return acc;
  }, {} as Record<string, { activities: (Activity & { level: number })[], maxLevel: number, totalHeight: number }>);

  const getActivityStyle = (activity: Activity & { level?: number }) => {
    const isTemp = tempActivity && tempActivity.id === activity.id;
    const start = getXFromDate(isTemp ? tempActivity.startDate : activity.startDate);
    const end = getXFromDate(isTemp ? tempActivity.endDate : activity.endDate);
    const width = end - start + config.dayWidth;
    const status = statuses.find((s) => s.id === activity.statusId);
    const color = activity.color || status?.color || '#3B82F6';
    const level = activity.level ?? 0;

    return {
      left: `${start}px`,
      width: `${Math.max(width, config.dayWidth)}px`,
      top: `${(level * rowHeight) + 8}px`,
      height: `${rowHeight - 16}px`,
      backgroundColor: color,
      opacity: isTemp ? 0.7 : 1,
      zIndex: isTemp ? 20 : 1,
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
          setTempActivity({
            id: activity.id,
            startDate: activity.startDate,
            endDate: newDate,
            swimlaneId: activity.swimlaneId
          });
        }
      } else {
        if (newDate <= activity.endDate) {
          setTempActivity({
            id: activity.id,
            startDate: newDate,
            endDate: activity.endDate,
            swimlaneId: activity.swimlaneId
          });
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

      // Calculate current swimlane based on Y position
      const y = e.clientY - rect.top + (timelineRef.current?.scrollTop || 0) - HEADER_HEIGHT;
      const swimlaneIndex = Math.max(0, Math.min(swimlanes.length - 1, Math.floor(y / rowHeight)));
      const currentSwimlaneId = swimlanes[swimlaneIndex].id;

      setTempActivity({
        id: activity.id,
        startDate: newStart.toISOString().split('T')[0],
        endDate: newEnd.toISOString().split('T')[0],
        swimlaneId: currentSwimlaneId
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
        onActivityCreate(dragStart.swimlaneId, startDateStr, endDateStr, {}, true);
      }
    }

    if (tempActivity) {
      onActivityUpdate(tempActivity.id, {
        startDate: tempActivity.startDate,
        endDate: tempActivity.endDate,
        swimlaneId: tempActivity.swimlaneId
      });
    }

    setIsDragging(false);
    setDragStart(null);
    setDragCurrent(null);
    setResizing(null);
    setMoving(null);
    setTempActivity(null);
  };

  const handleActivityMouseDown = (e: React.MouseEvent, activity: Activity) => {
    e.stopPropagation();

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
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
        setMoving({
          activityId: activity.id,
          initialX: x,
          initialStartDate: activity.startDate,
          initialSwimlaneId: activity.swimlaneId
        });
      }
    }
  };

  const handleCloneActivity = (e: React.MouseEvent, activity: Activity) => {
    e.stopPropagation();
    const { id, calendarId, ...rest } = activity;
    onActivityCreate(activity.swimlaneId, activity.startDate, activity.endDate, rest);
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
            className="flex-shrink-0 border-r border-card-border text-center text-sm font-medium text-foreground py-2"
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
            className="flex-shrink-0 border-r border-card-border text-center text-sm font-medium text-foreground py-2"
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
              className={`flex-shrink-0 border-r border-card-border/50 text-center text-xs py-1 ${isWeekend ? 'bg-muted text-muted-foreground' : 'text-muted-foreground'
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
          className="flex-shrink-0 text-center text-sm font-medium text-foreground py-2"
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
            className={`flex-shrink-0 border-r border-gray-100 dark:border-gray-800 text-center text-xs py-1 ${isWeekend ? 'bg-gray-50 dark:bg-gray-800/50 text-gray-400' : 'text-gray-500 dark:text-gray-400'
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
      <div className="border-b border-card-border">
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

    const data = swimlaneData[dragStart.swimlaneId];
    if (!data) return null;

    return (
      <div
        className="absolute bg-blue-200/50 dark:bg-blue-600/30 border-2 border-blue-400 dark:border-blue-500 rounded pointer-events-none"
        style={{
          left: `${minX}px`,
          top: `${swimlanes.slice(0, swimlaneIndex).reduce((sum, s) => sum + swimlaneData[s.id].totalHeight, 0) + (data.maxLevel * rowHeight) + 4}px`,
          width: `${maxX - minX}px`,
          height: `${rowHeight - 8}px`,
          zIndex: 30,
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
      <div className="flex-1 flex items-center justify-center bg-background">
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
    <div className="flex-1 flex flex-col bg-card overflow-hidden">
      {/* Timeline Controls */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-card-border bg-background">
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
            className="px-3 py-1 text-sm font-medium text-foreground bg-muted rounded hover:opacity-80 transition-opacity"
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
        </div>

        <div className="flex items-center gap-2 relative" ref={settingsRef}>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${showSettings
              ? 'bg-accent-purple text-white'
              : 'bg-muted text-foreground hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            <span>View Settings</span>
          </button>

          {showSettings && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-card border border-card-border rounded-lg shadow-xl z-50 p-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                    Card Style
                  </label>
                  <div className="grid grid-cols-3 gap-1 bg-muted p-1 rounded-md">
                    {(['small', 'medium', 'large'] as CardStyle[]).map((style) => (
                      <button
                        key={style}
                        onClick={() => setCardStyle(style)}
                        className={`px-2 py-1 text-xs rounded capitalize ${cardStyle === style
                          ? 'bg-card text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                          }`}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                    Visible Fields
                  </label>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground opacity-50 cursor-not-allowed">
                      <input type="checkbox" checked readOnly className="rounded" />
                      <span>Title (Always shown)</span>
                    </div>
                    {AVAILABLE_FIELDS.map((field) => (
                      <label key={field.id} className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-muted rounded cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={visibleFields.includes(field.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setVisibleFields([...visibleFields, field.id]);
                            } else {
                              setVisibleFields(visibleFields.filter(f => f !== field.id));
                            }
                          }}
                          className="rounded text-accent-purple focus:ring-accent-purple"
                        />
                        <span className="text-foreground">{field.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Timeline Content */}
      <div className="flex-1 flex overflow-hidden" ref={containerRef}>
        <SwimlaneSidebar
          swimlanes={swimlanes}
          rowHeights={swimlanes.map(s => swimlaneData[s.id].totalHeight)}
          headerHeight={HEADER_HEIGHT}
          sidebarWidth={sidebarWidth}
          onSidebarWidthChange={handleSidebarWidthChange}
          onAddSwimlane={onAddSwimlane}
          onEditSwimlane={onEditSwimlane}
          onDeleteSwimlane={onDeleteSwimlane}
          onReorderSwimlanes={onReorderSwimlanes}
        />

        <div
          ref={timelineRef}
          className="flex-1 overflow-auto"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div style={{ width: `${totalWidth}px`, height: `${HEADER_HEIGHT}px` }}>
            {renderTimeHeader()}
          </div>

          <div className="relative" style={{ width: `${totalWidth}px` }}>
            {renderTodayLine()}
            {renderDragSelection()}

            {swimlanes.map((swimlane, index) => {
              const { activities: swimlaneActivities, totalHeight } = swimlaneData[swimlane.id];
              const isEmpty = swimlaneActivities.length === 0 && (!isDragging || dragStart?.swimlaneId !== swimlane.id);

              return (
                <div
                  key={swimlane.id}
                  className={`relative border-b border-card-border/50 ${index % 2 === 0 ? 'bg-card' : 'bg-background/50'
                    } ${isDragging && dragStart?.swimlaneId === swimlane.id ? 'bg-accent-purple/10' : ''}`}
                  style={{ height: `${totalHeight}px` }}
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
                  {isEmpty && !isDragging && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-xs text-gray-400 dark:text-gray-500 opacity-50">
                        Click and drag to create an activity
                      </span>
                    </div>
                  )}

                  {swimlaneActivities.map((activity) => {
                    const style = getActivityStyle(activity);
                    const status = statuses.find(s => s.id === activity.statusId);
                    const campaign = campaigns.find(c => c.id === activity.campaignId);
                    const config = STYLE_CONFIG[cardStyle];

                    return (
                      <div
                        key={activity.id}
                        className={`activity-bar absolute rounded shadow-sm cursor-pointer hover:shadow-md transition-shadow overflow-hidden group border border-black/10`}
                        style={style}
                        onDoubleClick={() => onActivityClick(activity)}
                        onMouseDown={(e) => handleActivityMouseDown(e, activity)}
                        title={`${activity.title}\n${activity.startDate} - ${activity.endDate}`}
                      >
                        {/* Resize handles */}
                        <div className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-white/30 hover:bg-white/50 transition-colors z-10" />
                        <div className="absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-white/30 hover:bg-white/50 transition-colors z-10" />

                        {/* Actions group */}
                        <div className="absolute right-1 top-1 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all z-20">
                          <button
                            className="p-1 rounded bg-black/20 hover:bg-black/40 text-white"
                            onClick={(e) => handleCloneActivity(e, activity)}
                            title="Clone"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                            </svg>
                          </button>
                          <button
                            className="p-1 rounded bg-black/20 hover:bg-black/40 text-white"
                            onClick={(e) => {
                              e.stopPropagation();
                              onActivityClick(activity);
                            }}
                            title="Edit"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        </div>

                        {/* Content */}
                        <div className={`h-full flex flex-col px-2 ${config.padding} pointer-events-none`}>
                          <div className={`font-bold text-white truncate ${config.fontSize} pr-6`}>
                            {activity.title}
                          </div>

                          {cardStyle !== 'small' && (
                            <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5 overflow-hidden">
                              {visibleFields.includes('status') && status && (
                                <span className="text-[10px] bg-white/20 text-white px-1 rounded truncate max-w-full">
                                  {status.name}
                                </span>
                              )}
                              {visibleFields.includes('campaign') && campaign && (
                                <span className="text-[10px] text-white/80 italic truncate">
                                  {campaign.name}
                                </span>
                              )}
                              {visibleFields.includes('cost') && activity.cost !== null && (
                                <span className="text-[10px] text-white font-medium">
                                  {activity.currency} {activity.cost.toLocaleString()}
                                </span>
                              )}
                              {visibleFields.includes('region') && activity.region && (
                                <span className="text-[10px] text-white/70">
                                  🌍 {activity.region}
                                </span>
                              )}
                            </div>
                          )}

                          {cardStyle === 'large' && (
                            <>
                              {visibleFields.includes('tags') && activity.tags && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {activity.tags.split(',').map((tag, i) => (
                                    <span key={i} className="text-[9px] bg-black/10 text-white px-1 rounded border border-white/20">
                                      {tag.trim()}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {visibleFields.includes('description') && activity.description && (
                                <div className="text-[10px] text-white/90 line-clamp-2 mt-1 italic leading-tight">
                                  {activity.description}
                                </div>
                              )}
                            </>
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
      </div>
    </div>
  );
}

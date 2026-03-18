'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Activity, Swimlane, Status, Campaign } from '@/db/schema';
import { addDays, getDaysBetween, getContrastTextColor, formatCurrency } from '@/lib/utils';
import { SwimlaneSidebar } from './SwimlaneSidebar';
import { useActivityLayout, useTimelineDrag, TimelineHeader, ActivityBar } from './timeline';

export interface TimelineEvent {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  statusId: string | null;
  color?: string | null;
}

interface TimelineViewProps {
  activities: Activity[];
  swimlanes: Swimlane[];
  statuses: Status[];
  campaigns: Campaign[];
  events?: TimelineEvent[];
  onActivityClick: (activity: Activity) => void;
  onActivityCreate: (swimlaneId: string, startDate: string, endDate: string, defaults?: Partial<Activity>, silent?: boolean) => void;
  onActivityUpdate: (id: string, updates: Partial<Activity>) => Promise<void>;
  onAddSwimlane: (name: string) => void;
  onEditSwimlane: (id: string, name: string) => void;
  onDeleteSwimlane: (id: string) => void;
  onReorderSwimlanes: (swimlaneId: string, newIndex: number) => void;
  onEventClick?: (eventId: string) => void;
  onEventCreate?: (startDate: string, endDate: string) => void;
}

type ZoomLevel = 'year' | 'quarter' | 'month';
type CardStyle = 'small' | 'medium' | 'large';

const ZOOM_CONFIG: Record<ZoomLevel, { daysVisible: number; dayWidth: number }> = {
  year: { daysVisible: 365, dayWidth: 4 },
  quarter: { daysVisible: 90, dayWidth: 24 },
  month: { daysVisible: 30, dayWidth: 30 },
};

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
  events: timelineEvents = [],
  onActivityClick,
  onActivityCreate,
  onActivityUpdate,
  onAddSwimlane,
  onEditSwimlane,
  onDeleteSwimlane,
  onReorderSwimlanes,
  onEventClick,
  onEventCreate,
}: TimelineViewProps) {
  // --- View state ---
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('quarter');
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [cardStyle, setCardStyle] = useState<CardStyle>('medium');
  const [visibleFields, setVisibleFields] = useState<string[]>(['status', 'campaign']);
  const [showSettings, setShowSettings] = useState(false);

  // --- Refs ---
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  // --- Derived values ---
  const config = ZOOM_CONFIG[zoomLevel];
  const totalWidth = config.daysVisible * config.dayWidth;
  const rowHeight = STYLE_CONFIG[cardStyle].rowHeight;
  const swimlaneIds = useMemo(() => swimlanes.map((s) => s.id), [swimlanes]);

  // --- Layout computation (decoupled from drag state) ---
  const baseLayout = useActivityLayout(activities, swimlaneIds, rowHeight);

  // --- Event row drag-to-create ---
  const [eventDrag, setEventDrag] = useState<{ startX: number; currentX: number } | null>(null);

  const handleEventRowMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.event-bar')) return;
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left + (timelineRef.current?.scrollLeft || 0);
    setEventDrag({ startX: x, currentX: x });
  }, []);

  const handleEventRowMouseMove = useCallback((e: React.MouseEvent) => {
    if (!eventDrag) return;
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left + (timelineRef.current?.scrollLeft || 0);
    setEventDrag(prev => prev ? { ...prev, currentX: x } : null);
  }, [eventDrag]);

  const handleEventRowMouseUp = useCallback(() => {
    if (!eventDrag) return;
    const minX = Math.min(eventDrag.startX, eventDrag.currentX);
    const maxX = Math.max(eventDrag.startX, eventDrag.currentX);
    if (maxX - minX > 10 && onEventCreate) {
      const getDateFromX = (x: number): string => {
        const dayOffset = Math.floor(x / config.dayWidth);
        const d = addDays(startDate, dayOffset);
        return d.toISOString().split('T')[0];
      };
      onEventCreate(getDateFromX(minX), getDateFromX(maxX));
    }
    setEventDrag(null);
  }, [eventDrag, config.dayWidth, startDate, onEventCreate]);

  // --- Drag interaction ---
  const {
    dragState,
    tempActivity,
    handleEmptyMouseDown,
    handleActivityMouseDown,
    handleMouseMove,
    handleMouseUp,
  } = useTimelineDrag({
    activities,
    swimlanes,
    swimlaneData: baseLayout,
    dayWidth: config.dayWidth,
    rowHeight,
    headerHeight: HEADER_HEIGHT,
    startDate,
    timelineRef,
    onActivityCreate,
    onActivityUpdate,
  });

  // --- Compute display layout: base layout + drag overlay ---
  const swimlaneData = useMemo(() => {
    if (!tempActivity) return baseLayout;

    // Only recompute the affected swimlanes during drag
    const result = { ...baseLayout };
    const affectedIds = new Set<string>();

    // Find which swimlane the activity was in (base) and where it's moving to
    for (const [slId, data] of Object.entries(baseLayout)) {
      if (data.activities.some((a) => a.id === tempActivity.id)) {
        affectedIds.add(slId);
      }
    }
    affectedIds.add(tempActivity.swimlaneId);

    for (const slId of affectedIds) {
      let slActivities = baseLayout[slId]?.activities || [];

      // Apply temp overrides
      slActivities = slActivities
        .filter((a) => {
          if (a.id !== tempActivity.id) return true;
          // If activity is being moved to a different swimlane, remove from original
          return tempActivity.swimlaneId === slId;
        })
        .map((a) => {
          if (a.id === tempActivity.id) {
            return { ...a, startDate: tempActivity.startDate, endDate: tempActivity.endDate, swimlaneId: tempActivity.swimlaneId };
          }
          return a;
        });

      // If activity is being moved to this swimlane from elsewhere, add it
      if (tempActivity.swimlaneId === slId && !slActivities.some((a) => a.id === tempActivity.id)) {
        const origActivity = activities.find((a) => a.id === tempActivity.id);
        if (origActivity) {
          slActivities.push({
            ...origActivity,
            ...tempActivity,
            level: 0,
          } as any);
        }
      }

      // Recompute levels for affected swimlanes
      const sorted = [...slActivities].sort((a, b) => {
        const aStart = new Date(a.id === tempActivity.id ? tempActivity.startDate : a.startDate).getTime();
        const bStart = new Date(b.id === tempActivity.id ? tempActivity.startDate : b.startDate).getTime();
        return aStart - bStart;
      });

      const levels: { end: number }[][] = [];
      const withLevels = sorted.map((activity) => {
        const sd = activity.id === tempActivity.id ? tempActivity.startDate : activity.startDate;
        const ed = activity.id === tempActivity.id ? tempActivity.endDate : activity.endDate;
        const start = new Date(sd).getTime();
        const end = new Date(ed).getTime();
        let levelFound = -1;
        for (let i = 0; i < levels.length; i++) {
          if (!levels[i].some((l) => start <= l.end)) {
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
        return { ...activity, level: levelFound };
      });

      result[slId] = {
        activities: withLevels,
        maxLevel: levels.length > 0 ? levels.length - 1 : 0,
        totalHeight: Math.max(1, levels.length) * rowHeight,
      };
    }

    return result;
  }, [baseLayout, tempActivity, activities, rowHeight]);

  // --- Settings persistence ---
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

  useEffect(() => {
    localStorage.setItem('timeline_view_settings', JSON.stringify({ cardStyle, visibleFields }));
  }, [cardStyle, visibleFields]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- Coordinate helpers ---
  const getXFromDate = useCallback((date: Date | string): number => {
    const d = new Date(date);
    const daysDiff = getDaysBetween(startDate, d) - 1;
    return daysDiff * config.dayWidth;
  }, [config.dayWidth, startDate]);

  const getActivityStyle = useCallback((activity: Activity & { level?: number }) => {
    const isTemp = tempActivity && tempActivity.id === activity.id;
    const sd = isTemp ? tempActivity.startDate : activity.startDate;
    const ed = isTemp ? tempActivity.endDate : activity.endDate;
    const start = getXFromDate(sd);
    const end = getXFromDate(ed);
    const width = end - start + config.dayWidth;
    const status = statuses.find((s) => s.id === activity.statusId);
    const color = activity.color || status?.color || '#2563EB';
    const level = activity.level ?? 0;

    return {
      left: `${start}px`,
      width: `${Math.max(width, config.dayWidth)}px`,
      top: `${(level * rowHeight) + 6}px`,
      height: `${rowHeight - 12}px`,
      backgroundColor: color,
      opacity: isTemp ? 0.7 : 1,
      zIndex: isTemp ? 20 : 1,
    };
  }, [config.dayWidth, getXFromDate, rowHeight, statuses, tempActivity]);

  const handleSidebarWidthChange = useCallback((width: number) => {
    setSidebarWidth(Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, width)));
  }, []);

  const handleCloneActivity = useCallback((e: React.MouseEvent, activity: Activity) => {
    e.stopPropagation();
    const { id, calendarId, ...rest } = activity;
    onActivityCreate(activity.swimlaneId, activity.startDate, activity.endDate, rest);
  }, [onActivityCreate]);

  const handleSwimlaneChange = useCallback(async (activityId: string, newSwimlaneId: string) => {
    await onActivityUpdate(activityId, { swimlaneId: newSwimlaneId });
  }, [onActivityUpdate]);

  // --- Navigation ---
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

  // --- Today line ---
  const renderTodayLine = () => {
    const today = new Date();
    const x = getXFromDate(today);
    if (x < 0 || x > totalWidth) return null;

    return (
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-today-line z-10 pointer-events-none"
        style={{ left: `${x}px` }}
      >
        <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2 h-2 bg-today-line rounded-full" />
      </div>
    );
  };

  // --- Drag selection preview ---
  const renderDragSelection = () => {
    if (!dragState.isDragging || !dragState.dragStart || dragState.dragCurrent === null) return null;
    const swimlaneIndex = swimlanes.findIndex((s) => s.id === dragState.dragStart!.swimlaneId);
    if (swimlaneIndex === -1) return null;
    const minX = Math.min(dragState.dragStart.x, dragState.dragCurrent);
    const maxX = Math.max(dragState.dragStart.x, dragState.dragCurrent);
    const data = swimlaneData[dragState.dragStart.swimlaneId];
    if (!data) return null;

    return (
      <div
        className="absolute bg-accent/15 border-2 border-accent/40 rounded-lg pointer-events-none"
        style={{
          left: `${minX}px`,
          top: `${swimlanes.slice(0, swimlaneIndex).reduce((sum, s) => sum + (swimlaneData[s.id]?.totalHeight || rowHeight), 0) + (data.maxLevel * rowHeight) + 4}px`,
          width: `${maxX - minX}px`,
          height: `${rowHeight - 8}px`,
          zIndex: 30,
        }}
      />
    );
  };

  // --- Empty state ---
  if (swimlanes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 bg-warm-soft rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-warm" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M12 17.25h8.25" />
            </svg>
          </div>
          <p className="text-base font-semibold text-foreground mb-1">No channels yet</p>
          <p className="text-sm text-muted-foreground">
            Channels (swimlanes) organize your timeline into rows like &quot;Social Media&quot;, &quot;Email&quot;, or &quot;Paid Ads&quot;. Add one above to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-card overflow-hidden">
      {/* Timeline Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-2 sm:px-4 py-2 border-b border-card-border bg-surface">
        <div className="flex items-center gap-1.5">
          <button onClick={navigatePrev} className="p-1.5 rounded hover:bg-muted">
            <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button onClick={navigateToday} className="px-3 py-1 text-xs font-medium text-foreground bg-muted rounded-md hover:bg-card-hover transition-colors">
            Today
          </button>
          <button onClick={navigateNext} className="p-1.5 rounded hover:bg-muted">
            <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Drag to create activities or events</span>
          </div>

          <div className="flex bg-muted rounded-md p-0.5">
            {(['year', 'quarter', 'month'] as ZoomLevel[]).map((level) => (
              <button
                key={level}
                onClick={() => setZoomLevel(level)}
                className={`px-2.5 py-1 text-xs font-medium rounded capitalize transition-colors ${
                  zoomLevel === level
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 relative" ref={settingsRef}>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${showSettings
              ? 'bg-accent-purple-btn text-white'
              : 'bg-muted text-foreground hover:opacity-80'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            <span className="hidden sm:inline">View Settings</span>
          </button>

          {showSettings && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-card border border-card-border rounded-lg shadow-xl z-50 p-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
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
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Visible Fields
                  </label>
                  <p className="text-[10px] text-muted-foreground mb-2">Choose which fields appear on activity cards.</p>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 px-2 py-1.5 text-[11px] text-muted-foreground/50">
                      <div className="w-3.5 h-3.5 rounded border border-accent/30 bg-accent/10 flex items-center justify-center">
                        <svg className="w-2.5 h-2.5 text-accent" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span>Title (always shown)</span>
                    </div>
                    {AVAILABLE_FIELDS.map((field) => (
                      <label key={field.id} className="flex items-center gap-2 px-2 py-1.5 text-[11px] hover:bg-muted rounded-md cursor-pointer transition-colors">
                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
                          visibleFields.includes(field.id)
                            ? 'border-accent bg-accent'
                            : 'border-card-border'
                        }`}>
                          {visibleFields.includes(field.id) && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
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
                          className="sr-only"
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
          rowHeights={swimlanes.map((s) => swimlaneData[s.id]?.totalHeight || rowHeight)}
          headerHeight={HEADER_HEIGHT}
          sidebarWidth={sidebarWidth}
          onSidebarWidthChange={handleSidebarWidthChange}
          onAddSwimlane={onAddSwimlane}
          onEditSwimlane={onEditSwimlane}
          onDeleteSwimlane={onDeleteSwimlane}
          onReorderSwimlanes={onReorderSwimlanes}
          eventsRowHeight={rowHeight + 12}
        />

        <div
          ref={timelineRef}
          className="flex-1 overflow-auto"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div style={{ width: `${totalWidth}px`, height: `${HEADER_HEIGHT}px` }}>
            <TimelineHeader
              startDate={startDate}
              zoomLevel={zoomLevel}
              dayWidth={config.dayWidth}
              totalWidth={totalWidth}
            />
          </div>

          <div className="relative" style={{ width: `${totalWidth}px` }}>
            {renderTodayLine()}
            {renderDragSelection()}

            {/* Events Row - always visible, supports drag-to-create */}
            <div
              className="relative border-b-2 border-accent/20 bg-accent/5"
              style={{ height: `${rowHeight + 12}px` }}
              onMouseDown={handleEventRowMouseDown}
              onMouseMove={handleEventRowMouseMove}
              onMouseUp={handleEventRowMouseUp}
              onMouseLeave={() => { if (eventDrag) handleEventRowMouseUp(); }}
            >
              {timelineEvents.length === 0 && !eventDrag && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-xs text-accent/40">
                    Drag here to create an event
                  </span>
                </div>
              )}

              {/* Drag selection preview */}
              {eventDrag && Math.abs(eventDrag.currentX - eventDrag.startX) > 5 && (
                <div
                  className="absolute bg-purple-500/20 border-2 border-purple-400/50 rounded-lg pointer-events-none"
                  style={{
                    left: `${Math.min(eventDrag.startX, eventDrag.currentX)}px`,
                    width: `${Math.abs(eventDrag.currentX - eventDrag.startX)}px`,
                    top: '4px',
                    height: `${rowHeight}px`,
                    zIndex: 30,
                  }}
                >
                  <div className="flex items-center justify-center h-full">
                    <span className="text-[10px] font-medium text-purple-400">New Event</span>
                  </div>
                </div>
              )}

              {timelineEvents.map((evt) => {
                const startX = getXFromDate(evt.startDate);
                const endX = getXFromDate(evt.endDate);
                const width = endX - startX + config.dayWidth;
                const status = statuses.find((s) => s.id === evt.statusId);
                const color = evt.color || status?.color || '#7C3AED';

                return (
                  <div
                    key={evt.id}
                    className="event-bar absolute rounded-lg cursor-pointer hover:shadow-lg transition-shadow overflow-hidden border border-white/20"
                    style={{
                      left: `${startX}px`,
                      width: `${Math.max(width, config.dayWidth)}px`,
                      top: '6px',
                      height: `${rowHeight - 4}px`,
                      backgroundColor: color,
                      opacity: 0.9,
                    }}
                    onClick={() => onEventClick?.(evt.id)}
                    title={`Event: ${evt.title}\nClick to view details`}
                  >
                    <div className="px-2 py-1 flex items-center gap-1.5 h-full">
                      <svg className="w-3 h-3 text-white/70 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                      </svg>
                      <span className="text-white text-[10px] font-medium truncate" style={{ color: 'white' }}>
                        {evt.title}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {swimlanes.map((swimlane, index) => {
              const slData = swimlaneData[swimlane.id] || { activities: [], totalHeight: rowHeight };
              const { activities: swimlaneActivities, totalHeight } = slData;
              const isEmpty = swimlaneActivities.length === 0 && (!dragState.isDragging || dragState.dragStart?.swimlaneId !== swimlane.id);

              return (
                <div
                  key={swimlane.id}
                  className={`relative border-b border-card-border/30 ${
                    index % 2 === 0 ? 'bg-card' : 'bg-surface/30'
                  } ${dragState.isDragging && dragState.dragStart?.swimlaneId === swimlane.id ? 'bg-accent/5' : ''}`}
                  style={{ height: `${totalHeight}px` }}
                  onMouseDown={(e) => handleEmptyMouseDown(e, swimlane.id)}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const activityId = e.dataTransfer.getData('activityId');
                    if (activityId) handleSwimlaneChange(activityId, swimlane.id);
                  }}
                >
                  {isEmpty && !dragState.isDragging && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-xs text-muted-foreground/50">
                        Click and drag to create an activity
                      </span>
                    </div>
                  )}

                  {swimlaneActivities.map((activity) => {
                    const status = statuses.find((s) => s.id === activity.statusId);
                    const campaign = campaigns.find((c) => c.id === activity.campaignId);

                    return (
                      <ActivityBar
                        key={activity.id}
                        activity={activity}
                        status={status}
                        campaign={campaign}
                        style={getActivityStyle(activity)}
                        cardStyle={cardStyle}
                        visibleFields={visibleFields}
                        onDoubleClick={() => onActivityClick(activity)}
                        onMouseDown={(e) => handleActivityMouseDown(e, activity)}
                        onClone={(e) => handleCloneActivity(e, activity)}
                        onEdit={(e) => {
                          e.stopPropagation();
                          onActivityClick(activity);
                        }}
                      />
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

import { useState, useCallback, useEffect, useRef } from 'react';
import { Activity, Swimlane } from '@/db/schema';
import { addDays, getDaysBetween } from '@/lib/utils';
import { SwimlaneLayoutData } from './useActivityLayout';

interface DragState {
  isDragging: boolean;
  dragStart: { x: number; swimlaneId: string } | null;
  dragCurrent: number | null;
}

interface ResizeState {
  activityId: string;
  edge: 'start' | 'end';
  initialDate: string;
}

interface MoveState {
  activityId: string;
  initialX: number;
  initialStartDate: string;
  initialSwimlaneId: string;
}

export interface TempActivityState {
  id: string;
  startDate: string;
  endDate: string;
  swimlaneId: string;
}

interface UseTimelineDragOptions {
  activities: Activity[];
  swimlanes: Swimlane[];
  swimlaneData: Record<string, SwimlaneLayoutData>;
  dayWidth: number;
  rowHeight: number;
  headerHeight: number;
  startDate: Date;
  timelineRef: React.RefObject<HTMLDivElement | null>;
  onActivityCreate: (swimlaneId: string, startDate: string, endDate: string, defaults?: Partial<Activity>, silent?: boolean) => void;
  onActivityUpdate: (id: string, updates: Partial<Activity>) => Promise<void>;
}

function getDateFromX(x: number, dayWidth: number, startDate: Date): Date {
  const dayOffset = Math.floor(x / dayWidth);
  return addDays(startDate, dayOffset);
}

export function useTimelineDrag({
  activities,
  swimlanes,
  swimlaneData,
  dayWidth,
  rowHeight,
  headerHeight,
  startDate,
  timelineRef,
  onActivityCreate,
  onActivityUpdate,
}: UseTimelineDragOptions) {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    dragStart: null,
    dragCurrent: null,
  });
  const [resizing, setResizing] = useState<ResizeState | null>(null);
  const [moving, setMoving] = useState<MoveState | null>(null);
  const [tempActivity, setTempActivity] = useState<TempActivityState | null>(null);

  // Store pre-drag state for rollback on failed API calls
  const preDragStateRef = useRef<{ id: string; startDate: string; endDate: string; swimlaneId: string } | null>(null);

  const getX = useCallback(
    (e: React.MouseEvent | MouseEvent): number => {
      const rect = timelineRef.current?.getBoundingClientRect();
      if (!rect) return 0;
      return e.clientX - rect.left + (timelineRef.current?.scrollLeft || 0);
    },
    [timelineRef]
  );

  const handleEmptyMouseDown = useCallback(
    (e: React.MouseEvent, swimlaneId: string) => {
      if ((e.target as HTMLElement).closest('.activity-bar')) return;
      const x = getX(e);
      setDragState({ isDragging: true, dragStart: { x, swimlaneId }, dragCurrent: x });
    },
    [getX]
  );

  const handleActivityMouseDown = useCallback(
    (e: React.MouseEvent, activity: Activity) => {
      e.stopPropagation();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const width = rect.width;

      // Store pre-drag state for rollback
      preDragStateRef.current = {
        id: activity.id,
        startDate: activity.startDate,
        endDate: activity.endDate,
        swimlaneId: activity.swimlaneId,
      };

      const RESIZE_HANDLE_PX = 10;
      const resizeThreshold = Math.max(RESIZE_HANDLE_PX, width * 0.1);
      if (relativeX < resizeThreshold) {
        setResizing({ activityId: activity.id, edge: 'start', initialDate: activity.startDate });
      } else if (relativeX > width - resizeThreshold) {
        setResizing({ activityId: activity.id, edge: 'end', initialDate: activity.endDate });
      } else {
        const x = getX(e);
        setMoving({
          activityId: activity.id,
          initialX: x,
          initialStartDate: activity.startDate,
          initialSwimlaneId: activity.swimlaneId,
        });
      }
    },
    [getX]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const x = getX(e);

      if (dragState.isDragging && dragState.dragStart) {
        setDragState((prev) => ({ ...prev, dragCurrent: x }));
      }

      if (resizing) {
        const activity = activities.find((a) => a.id === resizing.activityId);
        if (!activity) return;
        const newDate = getDateFromX(x, dayWidth, startDate).toISOString().split('T')[0];
        if (resizing.edge === 'end') {
          if (newDate >= activity.startDate) {
            setTempActivity({ id: activity.id, startDate: activity.startDate, endDate: newDate, swimlaneId: activity.swimlaneId });
          }
        } else {
          if (newDate <= activity.endDate) {
            setTempActivity({ id: activity.id, startDate: newDate, endDate: activity.endDate, swimlaneId: activity.swimlaneId });
          }
        }
      }

      if (moving) {
        const activity = activities.find((a) => a.id === moving.activityId);
        if (!activity) return;
        const deltaX = x - moving.initialX;
        const deltaDays = Math.round(deltaX / dayWidth);
        const initialStart = new Date(moving.initialStartDate);
        const newStart = addDays(initialStart, deltaDays);
        const duration = getDaysBetween(activity.startDate, activity.endDate);
        const newEnd = addDays(newStart, duration - 1);

        const rect = timelineRef.current?.getBoundingClientRect();
        if (!rect) return;
        const y = e.clientY - rect.top + (timelineRef.current?.scrollTop || 0) - headerHeight;
        let cumulativeHeight = 0;
        let swimlaneIndex = 0;
        for (let i = 0; i < swimlanes.length; i++) {
          const slHeight = swimlaneData[swimlanes[i].id]?.totalHeight || rowHeight;
          if (y < cumulativeHeight + slHeight) {
            swimlaneIndex = i;
            break;
          }
          cumulativeHeight += slHeight;
          swimlaneIndex = i;
        }
        swimlaneIndex = Math.max(0, Math.min(swimlanes.length - 1, swimlaneIndex));

        setTempActivity({
          id: activity.id,
          startDate: newStart.toISOString().split('T')[0],
          endDate: newEnd.toISOString().split('T')[0],
          swimlaneId: swimlanes[swimlaneIndex].id,
        });
      }
    },
    [activities, dayWidth, dragState, headerHeight, moving, resizing, rowHeight, startDate, swimlaneData, swimlanes, timelineRef, getX]
  );

  const handleMouseUp = useCallback(async () => {
    // Handle drag-to-create
    if (dragState.isDragging && dragState.dragStart && dragState.dragCurrent !== null) {
      const minX = Math.min(dragState.dragStart.x, dragState.dragCurrent);
      const maxX = Math.max(dragState.dragStart.x, dragState.dragCurrent);
      if (maxX - minX > 10) {
        const startDateStr = getDateFromX(minX, dayWidth, startDate).toISOString().split('T')[0];
        const endDateStr = getDateFromX(maxX, dayWidth, startDate).toISOString().split('T')[0];
        onActivityCreate(dragState.dragStart.swimlaneId, startDateStr, endDateStr, {}, true);
      }
    }

    // Handle move/resize commit with error rollback
    if (tempActivity) {
      try {
        await onActivityUpdate(tempActivity.id, {
          startDate: tempActivity.startDate,
          endDate: tempActivity.endDate,
          swimlaneId: tempActivity.swimlaneId,
        });
      } catch (error) {
        console.error('Failed to update activity, rolling back:', error);
        // Rollback: re-apply original state
        if (preDragStateRef.current) {
          try {
            await onActivityUpdate(preDragStateRef.current.id, {
              startDate: preDragStateRef.current.startDate,
              endDate: preDragStateRef.current.endDate,
              swimlaneId: preDragStateRef.current.swimlaneId,
            });
          } catch (rollbackError) {
            console.error('Rollback also failed:', rollbackError);
          }
        }
      }
    }

    preDragStateRef.current = null;
    setDragState({ isDragging: false, dragStart: null, dragCurrent: null });
    setResizing(null);
    setMoving(null);
    setTempActivity(null);
  }, [dragState, tempActivity, dayWidth, startDate, onActivityCreate, onActivityUpdate]);

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseUp]);

  return {
    dragState,
    tempActivity,
    isInteracting: dragState.isDragging || !!resizing || !!moving,
    handleEmptyMouseDown,
    handleActivityMouseDown,
    handleMouseMove,
    handleMouseUp,
  };
}

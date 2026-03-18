import { useMemo } from 'react';
import { Activity } from '@/db/schema';

export interface ActivityWithLevel extends Activity {
  level: number;
}

export interface SwimlaneLayoutData {
  activities: ActivityWithLevel[];
  maxLevel: number;
  totalHeight: number;
}

/**
 * Computes the vertical stacking layout for activities within swimlanes.
 * This is the "base layout" that only recomputes when activities or swimlanes change,
 * NOT on every pixel of mouse movement during drag operations.
 */
export function useActivityLayout(
  activities: Activity[],
  swimlaneIds: string[],
  rowHeight: number
): Record<string, SwimlaneLayoutData> {
  return useMemo(() => {
    const result: Record<string, SwimlaneLayoutData> = {};

    for (const swimlaneId of swimlaneIds) {
      const rawActivities = activities.filter((a) => a.swimlaneId === swimlaneId);

      const sorted = [...rawActivities].sort((a, b) => {
        const aStart = new Date(a.startDate).getTime();
        const bStart = new Date(b.startDate).getTime();
        if (aStart !== bStart) return aStart - bStart;
        const aEnd = new Date(a.endDate).getTime();
        const bEnd = new Date(b.endDate).getTime();
        return (bEnd - bStart) - (aEnd - aStart);
      });

      const activitiesWithLevels: ActivityWithLevel[] = [];
      const levels: { end: number }[][] = [];

      sorted.forEach((activity) => {
        const start = new Date(activity.startDate).getTime();
        const end = new Date(activity.endDate).getTime();

        let levelFound = -1;
        for (let i = 0; i < levels.length; i++) {
          const hasOverlap = levels[i].some((l) => start <= l.end);
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

      result[swimlaneId] = {
        activities: activitiesWithLevels,
        maxLevel: levels.length > 0 ? levels.length - 1 : 0,
        totalHeight: Math.max(1, levels.length) * rowHeight,
      };
    }

    return result;
  }, [activities, swimlaneIds, rowHeight]);
}

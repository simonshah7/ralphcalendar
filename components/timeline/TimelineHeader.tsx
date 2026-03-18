import React from 'react';

type ZoomLevel = 'year' | 'quarter' | 'month';

interface TimelineHeaderProps {
  startDate: Date;
  zoomLevel: ZoomLevel;
  dayWidth: number;
  totalWidth: number;
}

export function TimelineHeader({ startDate, zoomLevel, dayWidth, totalWidth }: TimelineHeaderProps) {
  const headers: React.ReactElement[] = [];
  const subHeaders: React.ReactElement[] = [];
  const currentDate = new Date(startDate);

  if (zoomLevel === 'year') {
    for (let i = 0; i < 12; i++) {
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
      const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
      const width = daysInMonth * dayWidth;
      headers.push(
        <div
          key={`month-${i}`}
          className="flex-shrink-0 border-r border-card-border text-center text-xs font-medium text-muted-foreground py-2"
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
      const width = daysInMonth * dayWidth;

      headers.push(
        <div
          key={`month-${i}`}
          className="flex-shrink-0 border-r border-card-border text-center text-xs font-semibold text-foreground py-2"
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
            className={`flex-shrink-0 border-r border-card-border/40 text-center text-[10px] py-1 ${
              isWeekend ? 'bg-muted/60 text-muted-foreground/60' : 'text-muted-foreground'
            }`}
            style={{ width: `${dayWidth}px` }}
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
        className="flex-shrink-0 text-center text-xs font-semibold text-foreground py-2"
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
          className={`flex-shrink-0 border-r border-card-border/50 text-center text-xs py-1 ${
            isWeekend ? 'bg-muted text-muted-foreground' : 'text-muted-foreground'
          }`}
          style={{ width: `${dayWidth}px` }}
        >
          <div className="leading-tight">{dayName}</div>
          <div className="font-medium">{d}</div>
        </div>
      );
    }
  }

  return (
    <div className="border-b border-card-border bg-surface">
      <div className="flex">{headers}</div>
      {subHeaders.length > 0 && <div className="flex">{subHeaders}</div>}
    </div>
  );
}

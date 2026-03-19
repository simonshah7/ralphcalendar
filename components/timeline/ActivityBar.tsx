import React from 'react';
import { Activity, Status } from '@/db/schema';
import type { Campaign } from '@/db/schema';
import { getContrastTextColor } from '@/lib/utils';
import { SolarAddCircle, SolarPenLinear } from '../SolarIcons';

type CardStyle = 'small' | 'medium' | 'large';

const STYLE_CONFIG: Record<CardStyle, { rowHeight: number; fontSize: string; padding: string }> = {
  small: { rowHeight: 40, fontSize: 'text-[10px]', padding: 'py-0.5' },
  medium: { rowHeight: 60, fontSize: 'text-xs', padding: 'py-1' },
  large: { rowHeight: 100, fontSize: 'text-sm', padding: 'py-2' },
};

interface ActivityBarProps {
  activity: Activity & { level?: number };
  status: Status | undefined;
  campaign: Campaign | undefined;
  style: React.CSSProperties;
  cardStyle: CardStyle;
  visibleFields: string[];
  onDoubleClick: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onClone: (e: React.MouseEvent) => void;
  onEdit: (e: React.MouseEvent) => void;
}

export function ActivityBar({
  activity,
  status,
  campaign,
  style,
  cardStyle,
  visibleFields,
  onDoubleClick,
  onMouseDown,
  onClone,
  onEdit,
}: ActivityBarProps) {
  const bgColor = activity.color || status?.color || '#3B53FF';
  const textColor = getContrastTextColor(bgColor);
  const isLight = textColor === '#000000';
  const config = STYLE_CONFIG[cardStyle];

  return (
    <div
      className="activity-bar absolute rounded-lg cursor-pointer hover:shadow-lg transition-shadow overflow-hidden group border border-foreground/15"
      style={style}
      role="button"
      tabIndex={0}
      aria-label={`${activity.title}, ${activity.startDate} to ${activity.endDate}`}
      onDoubleClick={onDoubleClick}
      onMouseDown={onMouseDown}
      onKeyDown={(e) => { if (e.key === 'Enter') onDoubleClick(); }}
      title={`${activity.title}\n${activity.startDate} - ${activity.endDate}`}
    >
      {/* Resize handles */}
      <div className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-foreground/20 hover:bg-foreground/40 transition-colors z-10" />
      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-foreground/20 hover:bg-foreground/40 transition-colors z-10" />

      {/* Actions */}
      <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-all z-20">
        <button
          className="p-1 rounded bg-foreground/30 hover:bg-foreground/50 text-white dark:text-black"
          onClick={onClone}
          aria-label="Clone activity"
          title="Clone"
        >
          <SolarAddCircle className="w-3 h-3" />
        </button>
        <button
          className="p-1 rounded bg-foreground/30 hover:bg-foreground/50 text-white dark:text-black"
          onClick={onEdit}
          aria-label="Edit activity"
          title="Edit"
        >
          <SolarPenLinear className="w-3 h-3" />
        </button>
      </div>

      {/* Content */}
      <div className={`h-full flex flex-col px-2 ${config.padding} pointer-events-none`}>
        <div className={`font-bold truncate ${config.fontSize} pr-6 flex items-center gap-1`} style={{ color: textColor }}>
          {status && cardStyle === 'small' && (
            <span className={`text-[8px] ${isLight ? 'bg-black/10' : 'bg-white/20'} px-0.5 rounded flex-shrink-0`} style={{ color: textColor }}>
              {status.name.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="truncate">{activity.title}</span>
        </div>

        {cardStyle !== 'small' && (
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5 overflow-hidden">
            {visibleFields.includes('status') && status && (
              <span className={`text-[10px] ${isLight ? 'bg-black/10' : 'bg-white/20'} px-1 rounded truncate max-w-full`} style={{ color: textColor }}>
                {status.name}
              </span>
            )}
            {visibleFields.includes('campaign') && campaign && (
              <span className="text-[10px] italic truncate" style={{ color: textColor, opacity: 0.8 }}>
                {campaign.name}
              </span>
            )}
            {visibleFields.includes('cost') && activity.cost !== null && (
              <span className="text-[10px] font-medium" style={{ color: textColor }}>
                {activity.currency} {activity.cost.toLocaleString()}
              </span>
            )}
            {visibleFields.includes('region') && activity.region && (
              <span className="text-[10px]" style={{ color: textColor, opacity: 0.8 }}>
                {activity.region}
              </span>
            )}
          </div>
        )}

        {cardStyle === 'large' && (
          <>
            {visibleFields.includes('tags') && activity.tags && (
              <div className="flex flex-wrap gap-1 mt-1">
                {activity.tags.split(',').map((tag, i) => (
                  <span key={i} className={`text-[9px] ${isLight ? 'bg-foreground/10 border-foreground/20' : 'bg-white/10 border-white/20'} px-1 rounded border`} style={{ color: textColor }}>
                    {tag.trim()}
                  </span>
                ))}
              </div>
            )}
            {visibleFields.includes('description') && activity.description && (
              <div className="text-[10px] line-clamp-2 mt-1 italic leading-tight" style={{ color: textColor, opacity: 0.9 }}>
                {activity.description}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

import React from 'react';
import { Activity, Status, Campaign } from '@/db/schema';
import { getContrastTextColor } from '@/lib/utils';

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
  const bgColor = activity.color || status?.color || '#2563EB';
  const textColor = getContrastTextColor(bgColor);
  const isLight = textColor === '#000000';
  const config = STYLE_CONFIG[cardStyle];

  return (
    <div
      className="activity-bar absolute rounded-lg cursor-pointer hover:shadow-lg transition-shadow overflow-hidden group border border-white/15"
      style={style}
      onDoubleClick={onDoubleClick}
      onMouseDown={onMouseDown}
      title={`${activity.title}\n${activity.startDate} - ${activity.endDate}`}
    >
      {/* Resize handles */}
      <div className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-black/20 hover:bg-black/40 transition-colors z-10" />
      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-black/20 hover:bg-black/40 transition-colors z-10" />

      {/* Actions */}
      <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-all z-20">
        <button
          className="p-1 rounded bg-black/30 hover:bg-black/50 text-white"
          onClick={onClone}
          title="Clone"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.5a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
          </svg>
        </button>
        <button
          className="p-1 rounded bg-black/30 hover:bg-black/50 text-white"
          onClick={onEdit}
          title="Edit"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className={`h-full flex flex-col px-2 ${config.padding} pointer-events-none`}>
        <div className={`font-bold truncate ${config.fontSize} pr-6`} style={{ color: textColor }}>
          {activity.title}
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
                  <span key={i} className={`text-[9px] ${isLight ? 'bg-black/10 border-black/20' : 'bg-white/10 border-white/20'} px-1 rounded border`} style={{ color: textColor }}>
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

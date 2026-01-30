'use client';

import { Calendar } from '@/db/schema';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { ThemeToggle } from './ThemeToggle';

type ViewType = 'timeline' | 'calendar' | 'table';

interface HeaderProps {
  calendars: Calendar[];
  currentCalendar: Calendar | null;
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  onCalendarSelect: (calendar: Calendar) => void;
  onCreateCalendar: () => void;
  onCreateActivity: () => void;
  onExport: () => void;
}

export function Header({
  calendars,
  currentCalendar,
  currentView,
  onViewChange,
  onCalendarSelect,
  onCreateCalendar,
  onCreateActivity,
  onExport,
}: HeaderProps) {
  const views: { key: ViewType; label: string }[] = [
    { key: 'timeline', label: 'Timeline' },
    { key: 'calendar', label: 'Calendar' },
    { key: 'table', label: 'Table' },
  ];

  return (
    <header className="bg-background border-b border-card-border px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          {/* Logo */}
          <h1 className="text-xl font-bold text-accent-purple">
            CampaignOS
          </h1>

          {/* View Tabs */}
          <div className="flex bg-muted rounded-lg p-1">
            {views.map((view) => (
              <button
                key={view.key}
                onClick={() => onViewChange(view.key)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${currentView === view.key
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                {view.label}
              </button>
            ))}
          </div>

          {/* Workspace Switcher */}
          <WorkspaceSwitcher
            calendars={calendars}
            currentCalendar={currentCalendar}
            onSelect={onCalendarSelect}
            onCreateNew={onCreateCalendar}
          />
        </div>

        <div className="flex items-center gap-3">
          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Export Button */}
          <button
            onClick={onExport}
            disabled={!currentCalendar}
            className="px-4 py-2 text-sm font-medium text-foreground bg-muted rounded-lg hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Export
          </button>

          {/* New Activity Button */}
          <button
            onClick={onCreateActivity}
            disabled={!currentCalendar}
            className="px-4 py-2 text-sm font-medium text-white bg-accent-purple rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Activity
          </button>
        </div>
      </div>
    </header>
  );
}

'use client';

import { Calendar } from '@/db/schema';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { ThemeToggle } from './ThemeToggle';

type ViewType = 'timeline' | 'calendar' | 'table' | 'dashboard';

interface HeaderProps {
  calendars: Calendar[];
  currentCalendar: Calendar | null;
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  onCalendarSelect: (calendar: Calendar) => void;
  onCreateCalendar: () => void;
  onCreateActivity: () => void;
  onExport: () => void;
  onToggleCopilot?: () => void;
  onOpenBriefGenerator?: () => void;
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
  onToggleCopilot,
  onOpenBriefGenerator,
}: HeaderProps) {
  const views: { key: ViewType; label: string }[] = [
    { key: 'timeline', label: 'Timeline' },
    { key: 'calendar', label: 'Calendar' },
    { key: 'table', label: 'Table' },
    { key: 'dashboard', label: 'Dashboard' },
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

          {/* AI Brief Generator */}
          {onOpenBriefGenerator && (
            <button
              onClick={onOpenBriefGenerator}
              disabled={!currentCalendar}
              className="px-3 py-2 text-sm font-medium text-foreground bg-muted rounded-lg hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              title="AI Campaign Brief Generator"
            >
              <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              AI Brief
            </button>
          )}

          {/* AI Copilot */}
          {onToggleCopilot && (
            <button
              onClick={onToggleCopilot}
              disabled={!currentCalendar}
              className="px-3 py-2 text-sm font-medium text-foreground bg-muted rounded-lg hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              title="AI Copilot"
            >
              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              Copilot
            </button>
          )}

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

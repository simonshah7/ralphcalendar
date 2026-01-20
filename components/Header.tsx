'use client';

import { Calendar } from '@/db/schema';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';

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
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          {/* Logo */}
          <h1 className="text-xl font-bold text-blue-600 dark:text-blue-400">
            CampaignOS
          </h1>

          {/* View Tabs */}
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            {views.map((view) => (
              <button
                key={view.key}
                onClick={() => onViewChange(view.key)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  currentView === view.key
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
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
          {/* Export Button */}
          <button
            onClick={onExport}
            disabled={!currentCalendar}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Export
          </button>

          {/* New Activity Button */}
          <button
            onClick={onCreateActivity}
            disabled={!currentCalendar}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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

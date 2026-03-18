'use client';

import { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar } from '@/db/schema';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { ThemeToggle } from './ThemeToggle';

type ViewType = 'timeline' | 'calendar' | 'table' | 'dashboard' | 'events';

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
  onSeedData?: (action: 'seed' | 'reset' | 'clear') => void;
  isSeedingData?: boolean;
}

const VIEW_ICONS: Record<ViewType, React.ReactNode> = {
  timeline: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M12 17.25h8.25" />
    </svg>
  ),
  calendar: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  ),
  table: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M11.25 12h.008v.008h-.008V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  ),
  dashboard: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  ),
  events: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
    </svg>
  ),
};

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
  onSeedData,
  isSeedingData,
}: HeaderProps) {
  const views: { key: ViewType; label: string }[] = [
    { key: 'timeline', label: 'Timeline' },
    { key: 'calendar', label: 'Calendar' },
    { key: 'table', label: 'Table' },
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'events', label: 'Events' },
  ];

  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const activeTab = tabRefs.current[currentView];
    if (activeTab) {
      const parent = activeTab.parentElement;
      if (parent) {
        setIndicatorStyle({
          left: activeTab.offsetLeft,
          width: activeTab.offsetWidth,
        });
      }
    }
  }, [currentView]);

  const [seedMenuOpen, setSeedMenuOpen] = useState(false);

  return (
    <header className="bg-card/80 backdrop-blur-xl border-b border-card-border px-5 py-2.5 sticky top-0 z-40">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-5">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
            <h1 className="text-base font-semibold tracking-tight text-foreground">
              CampaignOS
            </h1>
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-card-border" />

          {/* View Tabs with sliding indicator */}
          <div className="relative flex bg-muted rounded-lg p-0.5">
            <motion.div
              className="absolute top-0.5 bottom-0.5 bg-card rounded-md shadow-sm"
              animate={{
                left: indicatorStyle.left,
                width: indicatorStyle.width,
              }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
            {views.map((view) => (
              <button
                key={view.key}
                ref={(el) => { tabRefs.current[view.key] = el; }}
                onClick={() => onViewChange(view.key)}
                className={`relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-200 ${
                  currentView === view.key
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {VIEW_ICONS[view.key]}
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

        <div className="flex items-center gap-2">
          {/* Seed Data Menu */}
          {onSeedData && <SeedDataMenu onAction={onSeedData} isLoading={isSeedingData} />}

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
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-muted-foreground bg-muted rounded-lg hover:text-foreground hover:bg-card-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Export
          </button>

          {/* New Activity Button */}
          <button
            onClick={onCreateActivity}
            disabled={!currentCalendar}
            className="px-4 py-2 text-sm font-medium text-white bg-accent-purple-btn rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Activity
          </button>
        </div>
      </div>
    </header>
  );
}

// ─── Seed Data Dropdown Menu ────────────────────────────────
function SeedDataMenu({ onAction, isLoading }: { onAction: (action: 'seed' | 'reset' | 'clear') => void; isLoading?: boolean }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const actions = [
    {
      key: 'seed' as const,
      label: 'Seed Sample Data',
      desc: 'Clear & populate with demo data',
      icon: (
        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v6m3-3H9m4.06-7.19l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V8.25a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
        </svg>
      ),
    },
    {
      key: 'reset' as const,
      label: 'Reset Data',
      desc: 'Clear everything & re-seed fresh',
      icon: (
        <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
        </svg>
      ),
    },
    {
      key: 'clear' as const,
      label: 'Clear All Data',
      desc: 'Remove all calendars & activities',
      icon: (
        <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
        </svg>
      ),
    },
  ];

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        disabled={isLoading}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-muted-foreground bg-muted rounded-lg hover:text-foreground hover:bg-card-hover transition-colors disabled:opacity-60"
        title="Seed / Reset Data"
      >
        {isLoading ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125v-3.75" />
          </svg>
        )}
        Data
        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-1.5 w-64 bg-card border border-card-border rounded-xl shadow-xl z-50 overflow-hidden"
          >
            <div className="px-3 py-2 border-b border-card-border">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Demo Data</p>
            </div>
            {actions.map((action) => (
              <button
                key={action.key}
                onClick={() => {
                  setOpen(false);
                  onAction(action.key);
                }}
                disabled={isLoading}
                className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left disabled:opacity-50"
              >
                <div className="mt-0.5">{action.icon}</div>
                <div>
                  <p className="text-sm font-medium text-foreground">{action.label}</p>
                  <p className="text-xs text-muted-foreground">{action.desc}</p>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

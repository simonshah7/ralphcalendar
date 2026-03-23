'use client';

import { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar } from '@/db/schema';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { ThemeToggle } from './ThemeToggle';
import {
  SolarListLinear,
  SolarCalendarLinear,
  SolarTableLinear,
  SolarWidgetLinear,
  SolarUsersGroupRounded,
  SolarAddLinear,
  SolarCloseLinear,
  SolarHamburgerMenu,
  SolarMenuDots,
  SolarAltArrowDown,
  SolarChatRoundLinear,
  SolarClipboardLinear,
  SolarDownloadLinear,
  SolarDatabaseLinear,
  SolarFolderLinear,
  SolarRestartLinear,
  SolarTrashBinLinear,
  SolarSpinner,
  SolarSettingsLinear,
  SolarChartLinear,
  SolarQuestionCircle,
} from './SolarIcons';

type ViewType = 'timeline' | 'calendar' | 'table' | 'dashboard' | 'events' | 'reports';

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
  onSeedData?: (action: 'seed' | 'reset' | 'clear') => void;
  isSeedingData?: boolean;
  onOpenFeedbackReview?: () => void;
  onOpenSettings?: () => void;
  onOpenHelp?: () => void;
}

const VIEW_ICONS: Record<ViewType, React.ReactNode> = {
  timeline: <SolarListLinear className="w-4 h-4" />,
  calendar: <SolarCalendarLinear className="w-4 h-4" />,
  table: <SolarTableLinear className="w-4 h-4" />,
  dashboard: <SolarWidgetLinear className="w-4 h-4" />,
  events: <SolarUsersGroupRounded className="w-4 h-4" />,
  reports: <SolarChartLinear className="w-4 h-4" />,
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
  onSeedData,
  isSeedingData,
  onOpenFeedbackReview,
  onOpenSettings,
  onOpenHelp,
}: HeaderProps) {
  const views: { key: ViewType; label: string; description: string }[] = [
    { key: 'timeline', label: 'Timeline', description: 'Gantt-style timeline with drag-to-create activities' },
    { key: 'calendar', label: 'Calendar', description: 'Month grid view of all activities' },
    { key: 'table', label: 'Table', description: 'Spreadsheet view with inline editing' },
    { key: 'events', label: 'Events', description: 'Manage events, attendees, and checklists' },
    { key: 'dashboard', label: 'Dashboard', description: 'Budget, SAO, and performance analytics' },
    { key: 'reports', label: 'Reports', description: 'Campaign, budget, and event ROI reporting decks' },
  ];

  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    setIsDark(root.classList.contains('dark'));
    const observer = new MutationObserver(() => {
      setIsDark(root.classList.contains('dark'));
    });
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

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

  // Close mobile menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    }
    if (mobileMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [mobileMenuOpen]);

  // Close mobile menu on view change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [currentView]);

  return (
    <header className="bg-card/80 backdrop-blur-xl border-b border-card-border px-3 sm:px-5 py-2.5 sticky top-0 z-40">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-5 min-w-0">
          {/* Logo */}
          <div className="flex items-center flex-shrink-0">
            <span className="text-xl sm:text-2xl tracking-tight text-foreground">Tim<span className="font-bold">b</span>e<span className="font-bold">r</span>line</span>
          </div>

          {/* Divider - hidden on mobile */}
          <div className="w-px h-6 bg-card-border hidden md:block" />

          {/* View Tabs - hidden on mobile, shown on md+ */}
          <div className="relative hidden md:flex bg-muted rounded-lg p-0.5">
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
                title={view.description}
                aria-label={view.label}
                className={`relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-200 ${
                  currentView === view.key
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {VIEW_ICONS[view.key]}
                <span className="hidden lg:inline">{view.label}</span>
              </button>
            ))}
          </div>

          {/* Mobile View Selector - visible on mobile only */}
          <div className="flex md:hidden bg-muted rounded-lg p-0.5">
            {views.map((view) => (
              <button
                key={view.key}
                onClick={() => onViewChange(view.key)}
                className={`relative z-10 flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors duration-200 ${
                  currentView === view.key
                    ? 'text-foreground bg-card shadow-sm'
                    : 'text-muted-foreground'
                }`}
                title={view.description}
                aria-label={view.label}
              >
                {VIEW_ICONS[view.key]}
              </button>
            ))}
          </div>

          {/* Workspace Switcher - hidden on small mobile */}
          <div className="hidden sm:block">
            <WorkspaceSwitcher
              calendars={calendars}
              currentCalendar={currentCalendar}
              onSelect={onCalendarSelect}
              onCreateNew={onCreateCalendar}
            />
          </div>
        </div>

        {/* Desktop Actions - hidden on mobile */}
        <div className="hidden lg:flex items-center gap-2">
          <ThemeToggle />

          {onOpenHelp && (
            <button
              onClick={onOpenHelp}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Help"
              aria-label="Help"
            >
              <SolarQuestionCircle className="w-5 h-5" />
            </button>
          )}

          <ToolsMenu
            currentCalendar={currentCalendar}
            onSeedData={onSeedData}
            isSeedingData={isSeedingData}
            onToggleCopilot={onToggleCopilot}
            onOpenFeedbackReview={onOpenFeedbackReview}
            onExport={onExport}
            onOpenSettings={onOpenSettings}
          />

          <button
            onClick={onCreateActivity}
            disabled={!currentCalendar}
            className="px-4 py-2 text-sm font-medium text-white bg-accent-purple-btn rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <SolarAddLinear className="w-4 h-4" />
            New Activity
          </button>
        </div>

        {/* Mobile actions: New Activity + Hamburger */}
        <div className="flex lg:hidden items-center gap-1.5">
          <ThemeToggle />
          <button
            onClick={onCreateActivity}
            disabled={!currentCalendar}
            className="p-2 text-white bg-accent-purple-btn rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            title="New Activity"
            aria-label="New Activity"
          >
            <SolarAddLinear className="w-4 h-4" />
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menu"
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            {mobileMenuOpen ? (
              <SolarCloseLinear className="w-5 h-5" />
            ) : (
              <SolarHamburgerMenu className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            ref={mobileMenuRef}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden overflow-hidden border-t border-card-border mt-2.5 pt-2.5"
          >
            <div className="space-y-2 pb-2">
              {/* Workspace Switcher for small mobile */}
              <div className="sm:hidden">
                <WorkspaceSwitcher
                  calendars={calendars}
                  currentCalendar={currentCalendar}
                  onSelect={(cal) => { onCalendarSelect(cal); setMobileMenuOpen(false); }}
                  onCreateNew={() => { onCreateCalendar(); setMobileMenuOpen(false); }}
                />
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-2">
                {onSeedData && (
                  <SeedDataMenu onAction={(action) => { onSeedData(action); setMobileMenuOpen(false); }} isLoading={isSeedingData} />
                )}

                {onToggleCopilot && (
                  <button
                    onClick={() => { onToggleCopilot(); setMobileMenuOpen(false); }}
                    disabled={!currentCalendar}
                    className="px-3 py-2 text-sm font-medium text-foreground bg-muted rounded-lg hover:opacity-80 transition-opacity disabled:opacity-50 flex items-center gap-1.5 justify-center"
                  >
                    <SolarChatRoundLinear className="w-4 h-4 text-blue-500" />
                    Copilot
                  </button>
                )}

                {onOpenFeedbackReview && (
                  <button
                    onClick={() => { onOpenFeedbackReview(); setMobileMenuOpen(false); }}
                    className="flex items-center gap-1.5 justify-center px-3 py-2 text-sm font-medium text-muted-foreground bg-muted rounded-lg hover:text-foreground transition-colors"
                  >
                    <SolarClipboardLinear className="w-4 h-4 text-purple-500" />
                    Feedback
                  </button>
                )}

                <button
                  onClick={() => { onExport(); setMobileMenuOpen(false); }}
                  disabled={!currentCalendar}
                  className="flex items-center gap-1.5 justify-center px-3 py-2 text-sm font-medium text-muted-foreground bg-muted rounded-lg hover:text-foreground transition-colors disabled:opacity-40"
                >
                  <SolarDownloadLinear className="w-4 h-4" />
                  Export
                </button>

                {onOpenSettings && (
                  <button
                    onClick={() => { onOpenSettings(); setMobileMenuOpen(false); }}
                    className="flex items-center gap-1.5 justify-center px-3 py-2 text-sm font-medium text-muted-foreground bg-muted rounded-lg hover:text-foreground transition-colors"
                  >
                    <SolarSettingsLinear className="w-4 h-4" />
                    Settings
                  </button>
                )}

                {onOpenHelp && (
                  <button
                    onClick={() => { onOpenHelp(); setMobileMenuOpen(false); }}
                    className="flex items-center gap-1.5 justify-center px-3 py-2 text-sm font-medium text-muted-foreground bg-muted rounded-lg hover:text-foreground transition-colors"
                  >
                    <SolarQuestionCircle className="w-4 h-4 text-blue-500" />
                    Help
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

// ─── Tools Overflow Menu ────────────────────────────────────
function ToolsMenu({
  currentCalendar,
  onSeedData,
  isSeedingData,
  onToggleCopilot,
  onOpenFeedbackReview,
  onExport,
  onOpenSettings,
}: {
  currentCalendar: Calendar | null;
  onSeedData?: (action: 'seed' | 'reset' | 'clear') => void;
  isSeedingData?: boolean;
  onToggleCopilot?: () => void;
  onOpenFeedbackReview?: () => void;
  onExport: () => void;
  onOpenSettings?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [seedSubmenuOpen, setSeedSubmenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSeedSubmenuOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const items: { key: string; label: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean }[] = [];

  if (onToggleCopilot) {
    items.push({
      key: 'copilot',
      label: 'Copilot',
      icon: <SolarChatRoundLinear className="w-4 h-4 text-blue-500" />,
      onClick: () => { onToggleCopilot(); setOpen(false); },
      disabled: !currentCalendar,
    });
  }

  if (onOpenFeedbackReview) {
    items.push({
      key: 'feedback',
      label: 'Feedback',
      icon: <SolarClipboardLinear className="w-4 h-4 text-purple-500" />,
      onClick: () => { onOpenFeedbackReview(); setOpen(false); },
    });
  }

  items.push({
    key: 'export',
    label: 'Export',
    icon: <SolarDownloadLinear className="w-4 h-4" />,
    onClick: () => { onExport(); setOpen(false); },
    disabled: !currentCalendar,
  });

  if (onOpenSettings) {
    items.push({
      key: 'settings',
      label: 'Settings',
      icon: <SolarSettingsLinear className="w-4 h-4 text-muted-foreground" />,
      onClick: () => { onOpenSettings(); setOpen(false); },
    });
  }

  const seedActions = [
    { key: 'seed' as const, label: 'Seed Sample Data', icon: <SolarFolderLinear className="w-4 h-4 text-green-500" /> },
    { key: 'reset' as const, label: 'Reset Data', icon: <SolarRestartLinear className="w-4 h-4 text-amber-500" /> },
    { key: 'clear' as const, label: 'Clear All Data', icon: <SolarTrashBinLinear className="w-4 h-4 text-red-500" /> },
  ];

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => { setOpen(!open); setSeedSubmenuOpen(false); }}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
          open
            ? 'text-foreground bg-muted'
            : 'text-muted-foreground bg-muted hover:text-foreground hover:bg-card-hover'
        }`}
        title="Tools & actions"
      >
        <SolarMenuDots className="w-4 h-4" />
        More
        <SolarAltArrowDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-1.5 w-52 bg-card border border-card-border rounded-xl shadow-xl z-50 overflow-hidden"
          >
            <div className="py-1">
              {items.map((item) => (
                <button
                  key={item.key}
                  onClick={item.onClick}
                  disabled={item.disabled}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}

              {onSeedData && (
                <>
                  <div className="h-px bg-card-border my-1" />
                  <div className="relative">
                    <button
                      onClick={() => setSeedSubmenuOpen(!seedSubmenuOpen)}
                      disabled={isSeedingData}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors disabled:opacity-60"
                    >
                      {isSeedingData ? (
                        <SolarSpinner className="w-4 h-4 animate-spin" />
                      ) : (
                        <SolarDatabaseLinear className="w-4 h-4" />
                      )}
                      Data
                      <SolarAltArrowDown className={`w-3 h-3 ml-auto transition-transform ${seedSubmenuOpen ? 'rotate-180' : ''}`} />
                    </button>
                    <AnimatePresence>
                      {seedSubmenuOpen && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.15 }}
                          className="overflow-hidden"
                        >
                          {seedActions.map((action) => (
                            <button
                              key={action.key}
                              onClick={() => { onSeedData(action.key); setOpen(false); setSeedSubmenuOpen(false); }}
                              disabled={isSeedingData}
                              className="w-full flex items-center gap-2.5 pl-9 pr-3 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
                            >
                              {action.icon}
                              {action.label}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
      icon: <SolarFolderLinear className="w-4 h-4 text-green-500" />,
    },
    {
      key: 'reset' as const,
      label: 'Reset Data',
      desc: 'Clear everything & re-seed fresh',
      icon: <SolarRestartLinear className="w-4 h-4 text-amber-500" />,
    },
    {
      key: 'clear' as const,
      label: 'Clear All Data',
      desc: 'Remove all calendars & activities',
      icon: <SolarTrashBinLinear className="w-4 h-4 text-red-500" />,
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
          <SolarSpinner className="w-4 h-4 animate-spin" />
        ) : (
          <SolarDatabaseLinear className="w-4 h-4" />
        )}
        Data
        <SolarAltArrowDown className="w-3 h-3" />
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

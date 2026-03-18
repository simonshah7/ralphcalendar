'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar } from '@/db/schema';

interface WorkspaceSwitcherProps {
  calendars: Calendar[];
  currentCalendar: Calendar | null;
  onSelect: (calendar: Calendar) => void;
  onCreateNew: () => void;
}

export function WorkspaceSwitcher({
  calendars,
  currentCalendar,
  onSelect,
  onCreateNew,
}: WorkspaceSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-muted transition-colors text-sm"
      >
        <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
        </svg>
        <span className="font-medium text-foreground max-w-[140px] truncate">
          {currentCalendar?.name || 'Select Workspace'}
        </span>
        <svg
          className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 mt-1.5 w-60 bg-card rounded-xl shadow-lg shadow-black/8 border border-card-border z-50 overflow-hidden"
          >
            <div className="p-1.5">
              <div className="px-2.5 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Workspaces
              </div>
              {calendars.map((calendar) => (
                <button
                  key={calendar.id}
                  onClick={() => { onSelect(calendar); setIsOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                    currentCalendar?.id === calendar.id
                      ? 'bg-accent-soft text-accent font-medium'
                      : 'text-foreground hover:bg-muted'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${
                    currentCalendar?.id === calendar.id ? 'bg-accent' : 'bg-card-border'
                  }`} />
                  {calendar.name}
                </button>
              ))}
            </div>
            <div className="border-t border-card-border p-1.5">
              <button
                onClick={() => { onCreateNew(); setIsOpen(false); }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-accent hover:bg-accent-soft transition-colors font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                New Calendar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

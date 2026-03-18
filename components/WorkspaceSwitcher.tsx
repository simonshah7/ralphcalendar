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
        <span className="font-medium text-foreground">
          {currentCalendar?.name || 'Select Workspace'}
        </span>
        <svg
          className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`}
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
                New Workspace
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

'use client';

import { useState, useRef, useEffect } from 'react';
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
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors"
      >
        <span className="font-medium text-gray-900 dark:text-white">
          {currentCalendar?.name || 'Select Workspace'}
        </span>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-card rounded-lg shadow-lg border border-card-border z-50">
          <div className="py-1">
            {calendars.map((calendar) => (
              <button
                key={calendar.id}
                onClick={() => {
                  onSelect(calendar);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-2 text-left hover:bg-muted ${currentCalendar?.id === calendar.id
                    ? 'bg-accent-purple/10 text-accent-purple'
                    : 'text-foreground'
                  }`}
              >
                {calendar.name}
              </button>
            ))}
            {calendars.length > 0 && (
              <div className="border-t border-card-border my-1" />
            )}
            <button
              onClick={() => {
                onCreateNew();
                setIsOpen(false);
              }}
              className="w-full px-4 py-2 text-left text-accent-purple hover:bg-muted flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create New Calendar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

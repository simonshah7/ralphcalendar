'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (startDate: string, endDate: string, exportType: 'timeline' | 'calendar' | 'table', exportFormat: 'png' | 'csv' | 'pptx') => void;
  currentView: 'timeline' | 'calendar' | 'table';
}

export function ExportModal({ isOpen, onClose, onExport, currentView }: ExportModalProps) {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const [startDate, setStartDate] = useState(firstOfMonth.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(lastOfMonth.toISOString().split('T')[0]);
  const [exportType, setExportType] = useState<'timeline' | 'calendar' | 'table'>(currentView);
  const [exportFormat, setExportFormat] = useState<'png' | 'csv' | 'pptx'>('png');

  const setQuickRange = (range: 'month' | 'quarter' | 'year' | 'all') => {
    const now = new Date();
    let start: Date;
    let end: Date;

    switch (range) {
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), quarter * 3, 1);
        end = new Date(now.getFullYear(), quarter * 3 + 3, 0);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
        break;
      case 'all':
        start = new Date(now.getFullYear() - 1, 0, 1);
        end = new Date(now.getFullYear() + 1, 11, 31);
        break;
    }

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const handleExport = () => {
    onExport(startDate, endDate, exportType, exportFormat);
    onClose();
  };

  const handleTypeChange = (type: 'timeline' | 'calendar' | 'table') => {
    setExportType(type);
    if (type !== 'table' && (exportFormat === 'csv')) {
      setExportFormat('png');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-overlay backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative bg-card rounded-2xl shadow-xl max-w-md w-full mx-4 p-6 border border-card-border"
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-full bg-accent-soft flex items-center justify-center">
                <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
              </div>
              <h2 className="text-base font-semibold text-foreground">Export Data</h2>
            </div>

            <div className="space-y-5">
              {/* Export View */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  View
                </label>
                <div className="flex gap-1.5 bg-muted p-0.5 rounded-lg">
                  {(['timeline', 'calendar', 'table'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => handleTypeChange(type)}
                      className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${
                        exportType === type
                          ? 'bg-card text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Export Format */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Format
                </label>
                <div className="flex gap-1.5 bg-muted p-0.5 rounded-lg">
                  <button
                    onClick={() => setExportFormat('png')}
                    className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      exportFormat === 'png'
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    PNG Image
                  </button>
                  <button
                    onClick={() => setExportFormat('csv')}
                    disabled={exportType !== 'table'}
                    className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      exportFormat === 'csv'
                        ? 'bg-card text-foreground shadow-sm'
                        : exportType !== 'table'
                          ? 'text-muted-foreground/30 cursor-not-allowed'
                          : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    CSV
                  </button>
                </div>
                {exportType !== 'table' && (
                  <p className="mt-1.5 text-[11px] text-muted-foreground/60">
                    CSV is only available for Table view
                  </p>
                )}
              </div>

              {/* Quick Selects */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Quick Range
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { key: 'month' as const, label: 'This Month' },
                    { key: 'quarter' as const, label: 'This Quarter' },
                    { key: 'year' as const, label: 'This Year' },
                    { key: 'all' as const, label: 'All Time' },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setQuickRange(key)}
                      className="px-3 py-1.5 text-xs font-medium bg-muted text-muted-foreground rounded-md hover:bg-card-hover hover:text-foreground transition-colors"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    From
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-card-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-accent/40 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    To
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-card-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-accent/40 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 mt-6 pt-5 border-t border-card-border">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-foreground bg-muted rounded-lg hover:bg-card-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                className="px-5 py-2 text-sm font-medium text-white bg-accent rounded-lg hover:bg-accent-hover transition-colors shadow-sm shadow-accent/20"
              >
                Export {exportFormat.toUpperCase()}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (startDate: string, endDate: string, exportType: 'timeline' | 'calendar' | 'table', exportFormat: 'png' | 'csv') => void;
  currentView: string;
}

export function ExportModal({ isOpen, onClose, onExport, currentView }: ExportModalProps) {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const [startDate, setStartDate] = useState(firstOfMonth.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(lastOfMonth.toISOString().split('T')[0]);
  const [exportType, setExportType] = useState<'timeline' | 'calendar' | 'table'>(
    currentView === 'timeline' || currentView === 'calendar' || currentView === 'table'
      ? currentView
      : 'timeline'
  );
  const [exportFormat, setExportFormat] = useState<'png' | 'csv'>('png');

  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card rounded-lg shadow-xl max-w-md w-full mx-4 p-6 border border-card-border">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Export Data
        </h2>

        <div className="space-y-6">
          {/* Export View */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Select View to Export
            </label>
            <div className="flex gap-2">
              {(['timeline', 'calendar', 'table'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => handleTypeChange(type)}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg capitalize transition-colors ${exportType === type
                      ? 'bg-accent-purple-btn text-white'
                      : 'bg-muted text-foreground hover:opacity-80'
                    }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Export Format */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Select Format
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setExportFormat('png')}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${exportFormat === 'png'
                    ? 'bg-accent-purple-btn text-white'
                    : 'bg-muted text-foreground hover:opacity-80'
                  }`}
              >
                PNG Image
              </button>
              <button
                onClick={() => setExportFormat('csv')}
                disabled={exportType !== 'table'}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${exportFormat === 'csv'
                    ? 'bg-accent-purple-btn text-white'
                    : exportType !== 'table'
                      ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'
                      : 'bg-muted text-foreground hover:opacity-80'
                  }`}
              >
                CSV Spreadsheet
              </button>
            </div>
            {exportType !== 'table' && (
              <p className="mt-1 text-xs text-muted-foreground">
                CSV export is only available for Table view.
              </p>
            )}
          </div>

          {/* Quick Selects */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Quick Range
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setQuickRange('month')}
                className="px-3 py-1.5 text-sm bg-muted text-foreground rounded hover:opacity-80"
              >
                This Month
              </button>
              <button
                onClick={() => setQuickRange('quarter')}
                className="px-3 py-1.5 text-sm bg-muted text-foreground rounded hover:opacity-80"
              >
                Cancel
              </button>
              <button
                onClick={() => setQuickRange('year')}
                className="px-3 py-1.5 text-sm bg-muted text-foreground rounded hover:opacity-80"
              >
                Export {exportFormat.toUpperCase()}
              </button>
              <button
                onClick={() => setQuickRange('all')}
                className="px-3 py-1.5 text-sm bg-muted text-foreground rounded hover:opacity-80"
              >
                All Time
              </button>
            </div>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                From
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-card-border rounded-lg bg-background text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                To
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-card-border rounded-lg bg-background text-foreground"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-8">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-foreground bg-muted rounded-lg hover:opacity-80 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            className="px-6 py-2 text-sm font-medium text-white bg-accent-purple-btn rounded-lg hover:opacity-90 transition-colors"
          >
            Export {exportFormat.toUpperCase()}
          </button>
        </div>
      </div>
    </div>
  );
}

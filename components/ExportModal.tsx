'use client';

import { useState } from 'react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (startDate: string, endDate: string, exportType: 'timeline' | 'calendar' | 'table', exportFormat: 'png' | 'csv') => void;
  currentView: 'timeline' | 'calendar' | 'table';
}

export function ExportModal({ isOpen, onClose, onExport, currentView }: ExportModalProps) {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const [startDate, setStartDate] = useState(firstOfMonth.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(lastOfMonth.toISOString().split('T')[0]);
  const [exportType, setExportType] = useState<'timeline' | 'calendar' | 'table'>(currentView);
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

  // When export type changes to something other than table, reset format to png
  const handleTypeChange = (type: 'timeline' | 'calendar' | 'table') => {
    setExportType(type);
    if (type !== 'table' && exportFormat === 'csv') {
      setExportFormat('png');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Export Data
        </h2>

        <div className="space-y-6">
          {/* Export View */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              Select View to Export
            </label>
            <div className="flex gap-2">
              {(['timeline', 'calendar', 'table'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => handleTypeChange(type)}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg capitalize transition-colors ${exportType === type
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Export Format */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              Select Format
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setExportFormat('png')}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${exportFormat === 'png'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
              >
                PNG Image
              </button>
              <button
                onClick={() => setExportFormat('csv')}
                disabled={exportType !== 'table'}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${exportFormat === 'csv'
                    ? 'bg-blue-600 text-white'
                    : exportType !== 'table'
                      ? 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed opacity-50'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
              >
                CSV Spreadsheet
              </button>
            </div>
            {exportType !== 'table' && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                CSV export is only available for Table view.
              </p>
            )}
          </div>

          {/* Quick Selects */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              Quick Range
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setQuickRange('month')}
                className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                This Month
              </button>
              <button
                onClick={() => setQuickRange('quarter')}
                className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                This Quarter
              </button>
              <button
                onClick={() => setQuickRange('year')}
                className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                This Year
              </button>
              <button
                onClick={() => setQuickRange('all')}
                className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                All Time
              </button>
            </div>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                From
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                To
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-8">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Export {exportFormat.toUpperCase()}
          </button>
        </div>
      </div>
    </div>
  );
}


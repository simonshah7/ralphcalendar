'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { FeedbackItem } from '@/db/schema';

interface FeedbackReviewViewProps {
  isOpen: boolean;
  onClose: () => void;
}

const SCREEN_LABELS: Record<string, string> = {
  TimelineView: 'Timeline View',
  CalendarView: 'Calendar View',
  TableView: 'Table View',
  DashboardView: 'Dashboard',
  EventsListView: 'Events List',
  EventDetailView: 'Event Detail',
  ActivityModal: 'Activity Modal',
  CreateCalendarModal: 'Create Calendar',
  ExportModal: 'Export Modal',
  AICopilot: 'AI Copilot',
  AIBriefGenerator: 'AI Brief Generator',
};

const CATEGORY_STYLES: Record<string, string> = {
  bug: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  suggestion: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  question: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  general: 'bg-gray-100 text-gray-700 dark:bg-gray-700/30 dark:text-gray-400',
};

const PRIORITY_STYLES: Record<string, string> = {
  low: 'text-gray-500',
  medium: 'text-yellow-600 dark:text-yellow-400',
  high: 'text-orange-600 dark:text-orange-400',
  critical: 'text-red-600 dark:text-red-400',
};

const STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
];

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

export function FeedbackReviewView({ isOpen, onClose }: FeedbackReviewViewProps) {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterScreen, setFilterScreen] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterScreen) params.set('screen', filterScreen);
      if (filterCategory) params.set('category', filterCategory);
      if (filterStatus) params.set('status', filterStatus);

      const res = await fetch(`/api/feedback?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (error) {
      console.error('Error fetching feedback:', error);
    } finally {
      setLoading(false);
    }
  }, [filterScreen, filterCategory, filterStatus]);

  useEffect(() => {
    if (isOpen) fetchItems();
  }, [isOpen, fetchItems]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/feedback/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, status: newStatus as FeedbackItem['status'] } : item
          )
        );
      }
    } catch (error) {
      console.error('Error updating feedback status:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/feedback/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setItems((prev) => prev.filter((item) => item.id !== id));
      }
    } catch (error) {
      console.error('Error deleting feedback:', error);
    }
  };

  // Collect unique screen names from items for filter dropdown
  const screenNames = [...new Set(items.map((i) => i.screenName))].sort();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative bg-card rounded-xl shadow-2xl border border-card-border w-full max-w-4xl mx-4 max-h-[85vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-card-border">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
            </svg>
            <h2 className="text-base font-semibold text-foreground">Feedback Review</h2>
            <span className="text-xs text-muted bg-card-hover px-2 py-0.5 rounded-full">{items.length} items</span>
          </div>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-card-border bg-card-hover/50">
          <select
            value={filterScreen}
            onChange={(e) => setFilterScreen(e.target.value)}
            className="px-2 py-1.5 border border-card-border rounded bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-accent-purple"
          >
            <option value="">All Screens</option>
            {screenNames.map((s) => (
              <option key={s} value={s}>{SCREEN_LABELS[s] || s}</option>
            ))}
          </select>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-2 py-1.5 border border-card-border rounded bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-accent-purple"
          >
            <option value="">All Categories</option>
            <option value="bug">Bug</option>
            <option value="suggestion">Suggestion</option>
            <option value="question">Question</option>
            <option value="general">General</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-2 py-1.5 border border-card-border rounded bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-accent-purple"
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          <button
            onClick={fetchItems}
            className="ml-auto text-xs text-accent hover:text-accent/80 transition-colors"
          >
            Refresh
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted text-sm">Loading...</div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted">
              <svg className="w-10 h-10 mb-3 opacity-40" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
              <p className="text-sm">No feedback yet</p>
              <p className="text-xs mt-1">Feedback submitted via the widget will appear here</p>
            </div>
          ) : (
            <div className="divide-y divide-card-border">
              {items.map((item) => (
                <div key={item.id} className="px-5 py-3 hover:bg-card-hover/30 transition-colors">
                  <div className="flex items-start gap-3">
                    {/* Left: category + priority indicators */}
                    <div className="flex flex-col items-center gap-1 pt-0.5">
                      <span className={`w-2 h-2 rounded-full ${
                        item.priority === 'critical' ? 'bg-red-500' :
                        item.priority === 'high' ? 'bg-orange-500' :
                        item.priority === 'medium' ? 'bg-yellow-500' :
                        'bg-gray-400'
                      }`} title={`Priority: ${item.priority}`} />
                    </div>

                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${CATEGORY_STYLES[item.category] || CATEGORY_STYLES.general}`}>
                          {item.category}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent/10 text-accent">
                          {SCREEN_LABELS[item.screenName] || item.screenName}
                        </span>
                        <span className={`text-[10px] font-medium ${PRIORITY_STYLES[item.priority] || ''}`}>
                          {item.priority}
                        </span>
                        <span className="text-[10px] text-muted ml-auto">{timeAgo(item.createdAt as unknown as string)}</span>
                      </div>

                      <p
                        className={`text-xs text-foreground ${expandedId === item.id ? '' : 'line-clamp-2'} cursor-pointer`}
                        onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                      >
                        {item.content}
                      </p>

                      {/* Expanded details */}
                      {expandedId === item.id && (
                        <div className="mt-2 space-y-1 text-[11px] text-muted bg-card-hover/50 rounded p-2">
                          {item.browserInfo && (() => {
                            try {
                              const info = JSON.parse(item.browserInfo);
                              return (
                                <>
                                  <p><span className="font-medium">Viewport:</span> {info.viewport}</p>
                                  <p><span className="font-medium">Browser:</span> {info.userAgent?.slice(0, 80)}...</p>
                                </>
                              );
                            } catch {
                              return <p><span className="font-medium">Browser:</span> {item.browserInfo}</p>;
                            }
                          })()}
                          {item.url && <p><span className="font-medium">URL:</span> {item.url}</p>}
                          <p><span className="font-medium">Submitted:</span> {new Date(item.createdAt as unknown as string).toLocaleString()}</p>
                        </div>
                      )}
                    </div>

                    {/* Right: status + actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        value={item.status}
                        onChange={(e) => handleStatusChange(item.id, e.target.value)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium border-0 focus:outline-none focus:ring-1 focus:ring-accent-purple cursor-pointer ${
                          item.status === 'new' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                          item.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                          item.status === 'resolved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          'bg-gray-100 text-gray-600 dark:bg-gray-700/30 dark:text-gray-400'
                        }`}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-muted hover:text-red-500 transition-colors"
                        title="Delete feedback"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

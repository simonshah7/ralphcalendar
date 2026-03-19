'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from './Toast';
import { SolarChatRoundLinear, SolarCloseLinear } from './SolarIcons';

type ViewType = 'timeline' | 'calendar' | 'table' | 'dashboard' | 'events';

interface FeedbackContextData {
  calendarName?: string;
  activityName?: string;
  activityId?: string;
  eventTitle?: string;
  eventId?: string;
  activeFilters?: {
    campaigns?: string[];
    statuses?: string[];
    searchQuery?: string;
  };
}

interface FeedbackWidgetProps {
  currentView: ViewType;
  selectedEventId: string | null;
  activeModals: {
    activityModal: boolean;
    createCalendar: boolean;
    exportModal: boolean;
    copilot: boolean;
    briefGenerator: boolean;
  };
  contextData?: FeedbackContextData;
}

const CATEGORIES = [
  { value: 'bug', label: 'Bug', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  { value: 'suggestion', label: 'Suggestion', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'question', label: 'Question', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  { value: 'general', label: 'General', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700/30 dark:text-gray-400' },
] as const;

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
] as const;

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

function getActiveScreen(props: FeedbackWidgetProps): string {
  // Modals take priority (they overlay views)
  if (props.activeModals.activityModal) return 'ActivityModal';
  if (props.activeModals.createCalendar) return 'CreateCalendarModal';
  if (props.activeModals.exportModal) return 'ExportModal';
  if (props.activeModals.copilot) return 'AICopilot';
  if (props.activeModals.briefGenerator) return 'AIBriefGenerator';
  // Views
  if (props.currentView === 'events' && props.selectedEventId) return 'EventDetailView';
  if (props.currentView === 'events') return 'EventsListView';
  if (props.currentView === 'timeline') return 'TimelineView';
  if (props.currentView === 'calendar') return 'CalendarView';
  if (props.currentView === 'table') return 'TableView';
  if (props.currentView === 'dashboard') return 'DashboardView';
  return props.currentView;
}

export function FeedbackWidget(props: FeedbackWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<string>('general');
  const [priority, setPriority] = useState<string>('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const screenName = getActiveScreen(props);
  const screenLabel = SCREEN_LABELS[screenName] || screenName;

  // Build a human-readable context hint for the widget header
  const contextHint = (() => {
    if (props.contextData?.activityName && props.activeModals.activityModal) {
      return `Editing: "${props.contextData.activityName}"`;
    }
    if (props.contextData?.eventTitle && screenName === 'EventDetailView') {
      return `Viewing: "${props.contextData.eventTitle}"`;
    }
    if (props.contextData?.calendarName) {
      return props.contextData.calendarName;
    }
    return null;
  })();

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setIsSubmitting(true);

    try {
      const browserInfo = JSON.stringify({
        userAgent: navigator.userAgent,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        timestamp: new Date().toISOString(),
      });

      const metadata: Record<string, string> = {};
      if (props.contextData?.calendarName) {
        metadata.calendarName = props.contextData.calendarName;
      }
      if (props.contextData?.activityName) {
        metadata.activityName = props.contextData.activityName;
      }
      if (props.contextData?.activityId) {
        metadata.activityId = props.contextData.activityId;
      }
      if (props.contextData?.eventTitle) {
        metadata.eventTitle = props.contextData.eventTitle;
      }
      if (props.contextData?.eventId) {
        metadata.eventId = props.contextData.eventId;
      }
      if (props.contextData?.activeFilters) {
        const f = props.contextData.activeFilters;
        if (f.campaigns?.length) metadata.filterCampaigns = f.campaigns.join(', ');
        if (f.statuses?.length) metadata.filterStatuses = f.statuses.join(', ');
        if (f.searchQuery) metadata.filterSearch = f.searchQuery;
      }

      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screenName,
          content: content.trim(),
          category,
          priority,
          browserInfo,
          url: window.location.href,
          metadata: Object.keys(metadata).length > 0 ? metadata : null,
        }),
      });

      if (!res.ok) throw new Error('Failed to submit');

      toast.success('Feedback submitted — thank you!');
      setContent('');
      setCategory('general');
      setPriority('medium');
      setIsOpen(false);
    } catch {
      toast.error('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed bottom-4 left-4 z-[9998]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-14 left-0 w-80 bg-card border border-card-border rounded-lg shadow-xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 bg-accent/10 border-b border-card-border">
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <SolarChatRoundLinear className="w-4 h-4 text-accent shrink-0" />
                  <span className="text-xs font-medium text-foreground">{screenLabel}</span>
                </div>
                {contextHint && (
                  <span className="text-[10px] text-muted truncate pl-6">{contextHint}</span>
                )}
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-muted hover:text-foreground transition-colors shrink-0"
              >
                <SolarCloseLinear className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 space-y-3">
              {/* Category pills */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-muted mb-1.5">Category</label>
                <div className="flex gap-1.5 flex-wrap">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setCategory(c.value)}
                      className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-all ${
                        category === c.value
                          ? c.color + ' ring-1 ring-current'
                          : 'bg-white/10 text-gray-300 hover:text-white hover:bg-white/20'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-muted mb-1.5">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-2 py-1.5 border border-card-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-accent-purple text-xs"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              {/* Content */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-muted mb-1.5">Your Feedback</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Describe the issue, suggestion, or question..."
                  rows={4}
                  className="w-full px-2 py-1.5 border border-card-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-accent-purple text-xs resize-none"
                />
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={!content.trim() || isSubmitting}
                className="w-full py-1.5 px-3 rounded text-xs font-medium text-white bg-accent hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`flex items-center gap-2 px-3 py-2 rounded-full shadow-lg transition-colors ${
          isOpen
            ? 'bg-accent text-white'
            : 'bg-card border border-card-border text-foreground hover:bg-card-hover'
        }`}
      >
        <SolarChatRoundLinear className="w-4 h-4" />
        <span className="text-xs font-medium">Feedback</span>
      </motion.button>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Header } from '@/components/Header';
import { FilterBar } from '@/components/FilterBar';
import { TimelineView } from '@/components/TimelineView';
import { CalendarView } from '@/components/CalendarView';
import { TableView } from '@/components/TableView';
import { DashboardView } from '@/components/DashboardView';
import { ActivityModal, ActivityFormData } from '@/components/ActivityModal';
import { CreateCalendarModal } from '@/components/CreateCalendarModal';
import { ExportModal } from '@/components/ExportModal';
import { AICopilot } from '@/components/AICopilot';
import { AIBriefGenerator, GeneratedActivity } from '@/components/AIBriefGenerator';
import { Calendar, Status, Swimlane, Campaign, Activity } from '@/db/schema';
import { EventsListView } from '@/components/EventsListView';
import type { EventListItem } from '@/components/EventsListView';
import { EventDetailView } from '@/components/EventDetailView';
import type { VoiceAgentCallbacks, CalendarContext } from '@/hooks/useVoiceAgent';
import { exportToPNG, exportToCSV } from '@/lib/export';
import { ToastProvider, useToast } from '@/components/Toast';
import { FeedbackWidget } from '@/components/FeedbackWidget';
import { FeedbackReviewView } from '@/components/FeedbackReviewView';
import { SettingsPanel } from '@/components/SettingsPanel';
import { DriveBrowser } from '@/components/DriveBrowser';
import { ReportsView } from '@/components/ReportsView';

type ViewType = 'timeline' | 'calendar' | 'table' | 'dashboard' | 'events' | 'reports';

interface CalendarData extends Calendar {
  statuses: Status[];
  swimlanes: Swimlane[];
  campaigns: Campaign[];
  activities: Activity[];
}

export default function Home() {
  return (
    <ToastProvider>
      <HomeInner />
    </ToastProvider>
  );
}

function HomeInner() {
  const { toast } = useToast();
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [currentCalendar, setCurrentCalendar] = useState<CalendarData | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>('timeline');
  const [isLoading, setIsLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const [selectedStatusIds, setSelectedStatusIds] = useState<string[]>([]);

  const [showCreateCalendar, setShowCreateCalendar] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showCopilot, setShowCopilot] = useState(false);
  const [showBriefGenerator, setShowBriefGenerator] = useState(false);
  const [isSeedingData, setIsSeedingData] = useState(false);
  const [showFeedbackReview, setShowFeedbackReview] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDriveBrowser, setShowDriveBrowser] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [activityDefaults, setActivityDefaults] = useState<{
    swimlaneId?: string;
    startDate?: string;
    endDate?: string;
    defaults?: Partial<Activity>;
  }>({});

  // Event management state
  const [eventsList, setEventsList] = useState<EventListItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [showEventCreate, setShowEventCreate] = useState(false);

  const mainContentRef = useRef<HTMLDivElement>(null);

  // --- URL state sync: read view/event from URL on mount ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view') as ViewType | null;
    const eventParam = params.get('event');
    if (viewParam && ['timeline', 'calendar', 'table', 'dashboard', 'events', 'reports'].includes(viewParam)) {
      setCurrentView(viewParam);
    }
    if (eventParam) {
      setSelectedEventId(eventParam);
      setCurrentView('events');
    }
  }, []);

  // --- URL state sync: write view/event to URL ---
  useEffect(() => {
    const params = new URLSearchParams();
    if (currentView !== 'timeline') params.set('view', currentView);
    if (selectedEventId) params.set('event', selectedEventId);
    const qs = params.toString();
    const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, '', newUrl);
  }, [currentView, selectedEventId]);

  useEffect(() => {
    fetchCalendars();
  }, []);

  const fetchCalendars = async () => {
    try {
      const response = await fetch('/api/calendars');
      if (!response.ok) {
        console.error('Failed to fetch calendars:', response.status);
        setCalendars([]);
        setIsLoading(false);
        return;
      }
      const data = await response.json();
      setCalendars(data);
      if (data.length > 0 && !currentCalendar) {
        fetchCalendarData(data[0].id);
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Failed to fetch calendars:', error);
      setCalendars([]);
      setIsLoading(false);
    }
  };

  const fetchCalendarData = async (calendarId: string) => {
    try {
      const response = await fetch(`/api/calendars/${calendarId}`);
      if (!response.ok) {
        console.error('Failed to fetch calendar data:', response.status);
        return;
      }
      const data = await response.json();
      setCurrentCalendar(data);
      fetchEvents(calendarId);
    } catch (error) {
      console.error('Failed to fetch calendar data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEvents = useCallback(async (calendarId: string) => {
    try {
      const res = await fetch(`/api/events?calendarId=${calendarId}`);
      if (res.ok) {
        const data = await res.json();
        setEventsList(data);
      }
    } catch (error) {
      console.error('Failed to fetch events:', error);
    }
  }, []);

  const handleCreateCalendar = async (name: string) => {
    const response = await fetch('/api/calendars', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) throw new Error('Failed to create calendar');
    const newCalendar = await response.json();
    setCalendars((prev) => [...prev, newCalendar]);
    fetchCalendarData(newCalendar.id);
    toast.success(`Workspace "${name}" created`);
  };

  const handleCreateSwimlane = async (name: string) => {
    if (!currentCalendar) return;
    try {
      const response = await fetch('/api/swimlanes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendarId: currentCalendar.id, name }),
      });
      if (response.ok) {
        fetchCalendarData(currentCalendar.id);
        toast.success(`Channel "${name}" added`);
      } else {
        toast.error('Failed to create channel');
      }
    } catch {
      toast.error('Failed to create channel');
    }
  };

  const handleEditSwimlane = async (id: string, name: string) => {
    const response = await fetch(`/api/swimlanes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (response.ok && currentCalendar) fetchCalendarData(currentCalendar.id);
  };

  const handleDeleteSwimlane = async (id: string) => {
    const response = await fetch(`/api/swimlanes/${id}`, { method: 'DELETE' });
    if (response.ok && currentCalendar) {
      fetchCalendarData(currentCalendar.id);
      toast.info('Channel deleted');
    } else {
      toast.error('Failed to delete channel');
    }
  };

  const handleReorderSwimlanes = async (swimlaneId: string, newIndex: number) => {
    if (!currentCalendar) return;
    const swimlanes = [...currentCalendar.swimlanes];
    const currentIndex = swimlanes.findIndex(s => s.id === swimlaneId);
    if (currentIndex === -1) return;
    const [movedSwimlane] = swimlanes.splice(currentIndex, 1);
    swimlanes.splice(newIndex, 0, movedSwimlane);
    const order = swimlanes.map((s, idx) => ({ id: s.id, sortOrder: idx }));

    try {
      const response = await fetch('/api/swimlanes/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order }),
      });
      if (response.ok) fetchCalendarData(currentCalendar.id);
    } catch (error) {
      console.error('Failed to reorder swimlanes:', error);
    }
  };

  const handleActivitySubmit = async (data: ActivityFormData) => {
    if (!currentCalendar) return;
    const url = editingActivity ? `/api/activities/${editingActivity.id}` : '/api/activities';
    const method = editingActivity ? 'PUT' : 'POST';
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, calendarId: currentCalendar.id }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to save activity');
    }
    fetchCalendarData(currentCalendar.id);
    toast.success(editingActivity ? 'Activity updated' : 'Activity created');
  };

  const handleActivityDelete = async (id: string) => {
    const response = await fetch(`/api/activities/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete activity');
    if (currentCalendar) fetchCalendarData(currentCalendar.id);
    toast.info('Activity deleted');
  };

  const handleActivityUpdate = async (id: string, updates: Partial<Activity>) => {
    const response = await fetch(`/api/activities/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(err.error || 'Failed to update activity');
    }
    if (currentCalendar) fetchCalendarData(currentCalendar.id);
  };

  const handleActivityClick = (activity: Activity) => {
    setEditingActivity(activity);
    setActivityDefaults({});
    setShowActivityModal(true);
  };

  const handleActivityCreate = async (swimlaneId: string, startDate: string, endDate: string, defaults?: Partial<Activity>, silent?: boolean) => {
    const activityData: ActivityFormData = {
      title: defaults?.title || 'New Activity',
      startDate, endDate,
      statusId: defaults?.statusId || currentCalendar?.statuses[0]?.id || '',
      swimlaneId,
      campaignId: defaults?.campaignId || null,
      description: defaults?.description || '',
      cost: Number(defaults?.cost) || 0,
      actualCost: 0,
      currency: defaults?.currency || 'USD',
      region: defaults?.region || 'US',
      tags: defaults?.tags || '',
      color: defaults?.color || '',
      expectedSaos: 0,
      targetSaos: 0,
      actualSaos: 0,
      pipelineGenerated: 0,
      revenueGenerated: 0,
      attachments: [],
    };

    if (silent) {
      try { await handleActivitySubmit(activityData); } catch (error) { console.error('Failed to create activity silently:', error); }
    } else {
      setEditingActivity(null);
      setActivityDefaults({ swimlaneId, startDate, endDate, defaults });
      setShowActivityModal(true);
    }
  };

  const handleApplyBrief = async (generatedActivities: GeneratedActivity[]) => {
    if (!currentCalendar) return;
    const defaultSwimlaneId = currentCalendar.swimlanes[0]?.id;
    const defaultStatusId = currentCalendar.statuses[0]?.id || '';
    if (!defaultSwimlaneId) return;

    const items = generatedActivities.map((ga) => {
      const matchedSwimlane = currentCalendar.swimlanes.find(
        (s) => s.name.toLowerCase() === ga.swimlaneSuggestion.toLowerCase()
      );
      return {
        title: ga.title,
        startDate: ga.startDate,
        endDate: ga.endDate,
        statusId: defaultStatusId,
        swimlaneId: matchedSwimlane?.id || defaultSwimlaneId,
        campaignId: null,
        description: ga.description,
        cost: ga.estimatedCost,
        actualCost: 0,
        currency: 'USD',
        region: 'US',
        tags: '',
        color: '',
        expectedSaos: 0,
        targetSaos: 0,
        actualSaos: 0,
        pipelineGenerated: 0,
        revenueGenerated: 0,
        attachments: [],
      };
    });

    try {
      const response = await fetch('/api/activities/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendarId: currentCalendar.id, items }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        toast.error(err.error || 'Failed to create activities from brief');
      } else {
        toast.success(`${items.length} activities created from brief`);
      }
      fetchCalendarData(currentCalendar.id);
    } catch (error) {
      console.error('Failed to apply brief:', error);
      toast.error('Failed to apply brief');
    }
    setShowBriefGenerator(false);
  };

  const handleCreateEvent = async (startDateParam?: string, endDateParam?: string) => {
    if (!currentCalendar) return;
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const eventStartDate = startDateParam || today;
    const eventEndDate = endDateParam || nextWeek.toISOString().split('T')[0];

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendarId: currentCalendar.id,
          title: 'New Event',
          startDate: eventStartDate,
          endDate: eventEndDate,
          statusId: currentCalendar.statuses[0]?.id || null,
        }),
      });
      if (res.ok) {
        const newEvent = await res.json();
        await fetchEvents(currentCalendar.id);
        setCurrentView('events');
        setSelectedEventId(newEvent.id);
        toast.success('Event created');
      } else {
        toast.error('Failed to create event');
      }
    } catch (error) {
      console.error('Failed to create event:', error);
      toast.error('Failed to create event');
    }
  };

  const handleDateClick = (date: string) => {
    setEditingActivity(null);
    setActivityDefaults({ startDate: date, endDate: date });
    setShowActivityModal(true);
  };

  const handleSeedData = async (action: 'seed' | 'reset' | 'clear') => {
    setIsSeedingData(true);
    try {
      const method = action === 'clear' ? 'DELETE' : action === 'reset' ? 'PUT' : 'POST';
      const response = await fetch('/api/seed', { method });
      if (!response.ok) throw new Error('Failed to ' + action);
      // Refresh everything
      setCurrentCalendar(null);
      setSearchQuery('');
      setSelectedCampaignIds([]);
      setSelectedStatusIds([]);
      await fetchCalendars();
      toast.success(action === 'clear' ? 'All data cleared' : action === 'reset' ? 'Data reset' : 'Sample data loaded');
    } catch (error) {
      console.error('Seed action failed:', error);
      toast.error('Data operation failed');
    } finally {
      setIsSeedingData(false);
    }
  };

  const handleExport = async (startDate: string, endDate: string, exportType: 'timeline' | 'calendar' | 'table', exportFormat: 'png' | 'csv' | 'pptx') => {
    if (exportFormat === 'csv') {
      if (!currentCalendar) return;
      exportToCSV(
        filteredActivities,
        currentCalendar.statuses,
        currentCalendar.swimlanes,
        currentCalendar.campaigns,
        startDate,
        endDate
      );
      toast.success('CSV exported');
      return;
    }
    const elementToCapture = mainContentRef.current;
    if (!elementToCapture) { toast.error('Unable to export: content not ready'); return; }
    try {
      await exportToPNG(elementToCapture, exportType, startDate, endDate);
      toast.success('PNG exported');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Export failed. Please try again.');
    }
  };

  const filteredActivities = useMemo(() => currentCalendar?.activities.filter((activity) => {
    if (searchQuery && !activity.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (selectedCampaignIds.length > 0 && (!activity.campaignId || !selectedCampaignIds.includes(activity.campaignId))) return false;
    if (selectedStatusIds.length > 0 && (!activity.statusId || !selectedStatusIds.includes(activity.statusId))) return false;
    return true;
  }) || [], [currentCalendar?.activities, searchQuery, selectedCampaignIds, selectedStatusIds]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="text-center"
        >
          <div className="relative w-10 h-10 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-2 border-card-border" />
            <div className="absolute inset-0 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground">Loading LaunchGrid</p>
        </motion.div>
        <FeedbackWidget
          currentView={currentView}
          selectedEventId={null}
          activeModals={{ activityModal: false, createCalendar: false, exportModal: false, copilot: false, briefGenerator: false }}
        />
      </div>
    );
  }

  // Empty state - no calendars
  if (calendars.length === 0) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header
          calendars={[]}
          currentCalendar={null}
          currentView={currentView}
          onViewChange={setCurrentView}
          onCalendarSelect={() => {}}
          onCreateCalendar={() => setShowCreateCalendar(true)}
          onCreateActivity={() => { }}
          onExport={() => { }}
          onToggleCopilot={() => { }}
          onOpenBriefGenerator={() => { }}
          onSeedData={handleSeedData}
          isSeedingData={isSeedingData}
          onOpenSettings={() => setShowSettings(true)}
        />
        <div className="flex-1 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="text-center max-w-md mx-auto px-4"
          >
            <div className="w-16 h-16 bg-accent-soft rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold text-foreground mb-2 tracking-tight">
              Welcome to LaunchGrid
            </h1>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              Plan, visualize, and manage your marketing campaigns with an intuitive timeline.
            </p>
            <div className="text-left bg-muted/50 rounded-lg p-4 mb-6 space-y-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Here&apos;s how it works:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li><strong>Create a workspace</strong> &mdash; one per team, quarter, or region</li>
                <li><strong>Add channels</strong> &mdash; like Social, Email, Paid, Events</li>
                <li><strong>Plan activities</strong> &mdash; drag on the timeline or click &quot;New Activity&quot;</li>
                <li><strong>Track performance</strong> &mdash; budgets, SAOs, and pipeline in the Dashboard</li>
              </ol>
            </div>
            <button
              onClick={() => setShowCreateCalendar(true)}
              className="px-6 py-2.5 text-sm font-medium text-white bg-accent rounded-lg hover:bg-accent-hover transition-colors shadow-sm shadow-accent/20"
            >
              Create Your First Workspace
            </button>
          </motion.div>
        </div>

        <CreateCalendarModal
          isOpen={showCreateCalendar}
          onClose={() => setShowCreateCalendar(false)}
          onSubmit={handleCreateCalendar}
        />
        <FeedbackWidget
          currentView={currentView}
          selectedEventId={null}
          activeModals={{ activityModal: false, createCalendar: showCreateCalendar, exportModal: false, copilot: false, briefGenerator: false }}
        />
      </div>
    );
  }

  const hasNoSwimlanes = currentCalendar && currentCalendar.swimlanes.length === 0;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header
        calendars={calendars}
        currentCalendar={currentCalendar}
        currentView={currentView}
        onViewChange={(view: ViewType) => { setCurrentView(view); setSelectedEventId(null); }}
        onCalendarSelect={(calendar) => {
          setSearchQuery('');
          setSelectedCampaignIds([]);
          setSelectedStatusIds([]);
          setSelectedEventId(null);
          fetchCalendarData(calendar.id);
        }}
        onCreateCalendar={() => setShowCreateCalendar(true)}
        onCreateActivity={() => {
          setEditingActivity(null);
          setActivityDefaults({});
          setShowActivityModal(true);
        }}
        onExport={() => setShowExportModal(true)}
        onToggleCopilot={() => setShowCopilot(!showCopilot)}
        onOpenBriefGenerator={() => setShowBriefGenerator(true)}
        onSeedData={handleSeedData}
        isSeedingData={isSeedingData}
        onOpenFeedbackReview={() => setShowFeedbackReview(true)}
        onOpenSettings={() => setShowSettings(true)}
      />

      {currentView !== 'dashboard' && currentView !== 'events' && currentView !== 'reports' && (
        <FilterBar
          campaigns={currentCalendar?.campaigns || []}
          statuses={currentCalendar?.statuses || []}
          searchQuery={searchQuery}
          selectedCampaignIds={selectedCampaignIds}
          selectedStatusIds={selectedStatusIds}
          onSearchChange={setSearchQuery}
          onCampaignChange={setSelectedCampaignIds}
          onStatusChange={setSelectedStatusIds}
        />
      )}

      <main className="flex-1 flex flex-col overflow-hidden" ref={mainContentRef}>
        {hasNoSwimlanes ? (
          <div className="flex-1 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="text-center max-w-md mx-auto px-4"
            >
              <div className="w-12 h-12 bg-warm-soft rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-warm" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M12 17.25h8.25" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-1.5">
                Add Your First Channel
              </h2>
              <p className="text-sm text-muted-foreground mb-5">
                Channels are the rows on your timeline. Each one represents a marketing category. Type a name below and press Enter to add it.
              </p>
              <div className="flex flex-col gap-2 max-w-xs mx-auto">
                <input
                  type="text"
                  placeholder="e.g. Social Media, Email, Paid Ads, Events"
                  className="px-4 py-2 border border-card-border rounded-lg bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-accent/40"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                      handleCreateSwimlane(e.currentTarget.value.trim());
                      e.currentTarget.value = '';
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground/60">
                  Press Enter to add. You can add more channels later.
                </p>
              </div>
            </motion.div>
          </div>
        ) : (
          <>
            {currentView === 'timeline' && currentCalendar && (
              <TimelineView
                activities={filteredActivities}
                swimlanes={currentCalendar.swimlanes}
                statuses={currentCalendar.statuses}
                campaigns={currentCalendar.campaigns}
                events={eventsList.map((e) => ({ id: e.id, title: e.title, startDate: e.startDate, endDate: e.endDate, statusId: e.statusId, color: null }))}
                onActivityClick={handleActivityClick}
                onActivityCreate={handleActivityCreate}
                onActivityUpdate={handleActivityUpdate}
                onAddSwimlane={handleCreateSwimlane}
                onEditSwimlane={handleEditSwimlane}
                onDeleteSwimlane={handleDeleteSwimlane}
                onReorderSwimlanes={handleReorderSwimlanes}
                onEventClick={(id) => { setCurrentView('events'); setSelectedEventId(id); }}
                onEventCreate={(startDate, endDate) => handleCreateEvent(startDate, endDate)}
              />
            )}

            {currentView === 'calendar' && currentCalendar && (
              <CalendarView
                activities={filteredActivities}
                statuses={currentCalendar.statuses}
                onActivityClick={handleActivityClick}
                onDateClick={handleDateClick}
              />
            )}

            {currentView === 'table' && currentCalendar && (
              <TableView
                activities={filteredActivities}
                statuses={currentCalendar.statuses}
                swimlanes={currentCalendar.swimlanes}
                campaigns={currentCalendar.campaigns}
                onActivityClick={handleActivityClick}
                onActivityUpdate={handleActivityUpdate}
                onActivityDelete={handleActivityDelete}
              />
            )}

            {currentView === 'dashboard' && currentCalendar && (
              <DashboardView
                activities={filteredActivities}
                campaigns={currentCalendar.campaigns}
                swimlanes={currentCalendar.swimlanes}
                statuses={currentCalendar.statuses}
                calendarId={currentCalendar.id}
              />
            )}

            {currentView === 'reports' && currentCalendar && (
              <ReportsView calendarId={currentCalendar.id} />
            )}

            {currentView === 'events' && currentCalendar && !selectedEventId && (
              <EventsListView
                events={eventsList}
                statuses={currentCalendar.statuses}
                campaigns={currentCalendar.campaigns}
                onEventClick={(id) => setSelectedEventId(id)}
                onCreateEvent={() => handleCreateEvent()}
              />
            )}

            {currentView === 'events' && currentCalendar && selectedEventId && (
              <EventDetailView
                eventId={selectedEventId}
                statuses={currentCalendar.statuses}
                campaigns={currentCalendar.campaigns}
                allEvents={eventsList.map((e) => ({ id: e.id, title: e.title, seriesName: e.seriesName }))}
                onBack={() => setSelectedEventId(null)}
                onRefreshEvents={() => fetchEvents(currentCalendar.id)}
              />
            )}
          </>
        )}
      </main>

      <CreateCalendarModal
        isOpen={showCreateCalendar}
        onClose={() => setShowCreateCalendar(false)}
        onSubmit={handleCreateCalendar}
      />

      {currentCalendar && (
        <ActivityModal
          isOpen={showActivityModal}
          activity={editingActivity}
          statuses={currentCalendar.statuses}
          swimlanes={currentCalendar.swimlanes}
          campaigns={currentCalendar.campaigns}
          defaultStartDate={activityDefaults.startDate}
          defaultEndDate={activityDefaults.endDate}
          defaultSwimlaneId={activityDefaults.swimlaneId}
          defaults={activityDefaults.defaults as any}
          onClose={() => {
            setShowActivityModal(false);
            setEditingActivity(null);
            setActivityDefaults({});
          }}
          onCampaignsChange={() => fetchCalendarData(currentCalendar.id)}
          onStatusesChange={() => fetchCalendarData(currentCalendar.id)}
          onSwimlanesChange={() => fetchCalendarData(currentCalendar.id)}
          onSubmit={handleActivitySubmit}
          onDelete={handleActivityDelete}
        />
      )}

      <ExportModal
        isOpen={showExportModal}
        currentView={currentView}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
        calendarId={currentCalendar?.id}
      />

      {/* AI Copilot (with integrated voice) */}
      {currentCalendar && (
        <AICopilot
          calendarId={currentCalendar.id}
          isOpen={showCopilot}
          onClose={() => setShowCopilot(false)}
          voiceContext={{
            calendarId: currentCalendar.id,
            swimlanes: currentCalendar.swimlanes.map((s) => ({ id: s.id, name: s.name })),
            statuses: currentCalendar.statuses.map((s) => ({ id: s.id, name: s.name, color: s.color })),
            campaigns: currentCalendar.campaigns.map((c) => ({ id: c.id, name: c.name })),
            activities: currentCalendar.activities.map((a) => ({
              id: a.id,
              title: a.title,
              swimlaneId: a.swimlaneId,
              statusId: a.statusId || '',
              campaignId: a.campaignId,
            })),
          } satisfies CalendarContext}
          voiceCallbacks={{
            onCreateActivity: async (data) => {
              await handleActivityCreate(data.swimlaneId, data.startDate, data.endDate, {
                title: data.title,
                statusId: data.statusId,
                description: data.description || '',
                cost: data.cost !== undefined ? String(data.cost) : '0',
                currency: (data.currency || 'USD') as 'USD' | 'GBP' | 'EUR',
                region: (data.region || 'US') as 'US' | 'EMEA' | 'ROW',
                campaignId: data.campaignId || null,
              } as Partial<Activity>, true);
            },
            onUpdateActivity: handleActivityUpdate,
            onDeleteActivity: handleActivityDelete,
            onSwitchView: setCurrentView,
            onSetSearch: setSearchQuery,
            onSetCampaignFilter: setSelectedCampaignIds,
            onSetStatusFilter: setSelectedStatusIds,
            onClearFilters: () => {
              setSearchQuery('');
              setSelectedCampaignIds([]);
              setSelectedStatusIds([]);
            },
            onOpenCopilot: () => setShowCopilot(true),
            onOpenBriefGenerator: () => setShowBriefGenerator(true),
          } satisfies VoiceAgentCallbacks}
        />
      )}

      {/* AI Brief Generator */}
      {currentCalendar && (
        <AIBriefGenerator
          isOpen={showBriefGenerator}
          calendarId={currentCalendar.id}
          swimlanes={currentCalendar.swimlanes.map((s) => ({ id: s.id, name: s.name }))}
          onClose={() => setShowBriefGenerator(false)}
          onApply={handleApplyBrief}
        />
      )}

      {/* Feedback Collection */}
      <FeedbackWidget
        currentView={currentView}
        selectedEventId={selectedEventId}
        activeModals={{
          activityModal: showActivityModal,
          createCalendar: showCreateCalendar,
          exportModal: showExportModal,
          copilot: showCopilot,
          briefGenerator: showBriefGenerator,
        }}
        contextData={{
          calendarName: currentCalendar?.name,
          activityName: editingActivity?.title,
          activityId: editingActivity?.id,
          eventTitle: selectedEventId
            ? eventsList.find((e) => e.id === selectedEventId)?.title
            : undefined,
          eventId: selectedEventId || undefined,
          activeFilters: {
            campaigns: selectedCampaignIds.length > 0
              ? currentCalendar?.campaigns
                  ?.filter((c) => selectedCampaignIds.includes(c.id))
                  .map((c) => c.name)
              : undefined,
            statuses: selectedStatusIds.length > 0
              ? currentCalendar?.statuses
                  ?.filter((s) => selectedStatusIds.includes(s.id))
                  .map((s) => s.name)
              : undefined,
            searchQuery: searchQuery || undefined,
          },
        }}
      />

      <FeedbackReviewView
        isOpen={showFeedbackReview}
        onClose={() => setShowFeedbackReview(false)}
      />

      <SettingsPanel
        open={showSettings}
        onClose={() => setShowSettings(false)}
      />

      <DriveBrowser
        open={showDriveBrowser}
        onClose={() => setShowDriveBrowser(false)}
      />
    </div>
  );
}

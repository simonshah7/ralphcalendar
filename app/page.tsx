'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from '@/components/Header';
import { FilterBar } from '@/components/FilterBar';
import { TimelineView } from '@/components/TimelineView';
import { CalendarView } from '@/components/CalendarView';
import { TableView } from '@/components/TableView';
import { ActivityModal, ActivityFormData } from '@/components/ActivityModal';
import { CreateCalendarModal } from '@/components/CreateCalendarModal';
import { ExportModal } from '@/components/ExportModal';
import { Calendar, Status, Swimlane, Campaign, Activity } from '@/db/schema';
import html2canvas from 'html2canvas';

type ViewType = 'timeline' | 'calendar' | 'table';

interface CalendarData extends Calendar {
  statuses: Status[];
  swimlanes: Swimlane[];
  campaigns: Campaign[];
  activities: Activity[];
}

export default function Home() {
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [currentCalendar, setCurrentCalendar] = useState<CalendarData | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>('timeline');
  const [isLoading, setIsLoading] = useState(true);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [selectedStatusId, setSelectedStatusId] = useState<string | null>(null);

  // Modal state
  const [showCreateCalendar, setShowCreateCalendar] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [activityDefaults, setActivityDefaults] = useState<{
    swimlaneId?: string;
    startDate?: string;
    endDate?: string;
  }>({});

  const mainContentRef = useRef<HTMLDivElement>(null);

  // Fetch calendars on mount
  useEffect(() => {
    fetchCalendars();
  }, []);

  const fetchCalendars = async () => {
    try {
      const response = await fetch('/api/calendars');
      const data = await response.json();
      setCalendars(data);

      if (data.length > 0 && !currentCalendar) {
        fetchCalendarData(data[0].id);
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Failed to fetch calendars:', error);
      setIsLoading(false);
    }
  };

  const fetchCalendarData = async (calendarId: string) => {
    try {
      const response = await fetch(`/api/calendars/${calendarId}`);
      const data = await response.json();
      setCurrentCalendar(data);
    } catch (error) {
      console.error('Failed to fetch calendar data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCalendar = async (name: string) => {
    const response = await fetch('/api/calendars', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      throw new Error('Failed to create calendar');
    }

    const newCalendar = await response.json();
    setCalendars((prev) => [...prev, newCalendar]);
    fetchCalendarData(newCalendar.id);
  };

  const handleCreateSwimlane = async (name: string) => {
    if (!currentCalendar) return;

    const response = await fetch('/api/swimlanes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ calendarId: currentCalendar.id, name }),
    });

    if (response.ok) {
      fetchCalendarData(currentCalendar.id);
    }
  };

  const handleEditSwimlane = async (id: string, name: string) => {
    const response = await fetch(`/api/swimlanes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    if (response.ok && currentCalendar) {
      fetchCalendarData(currentCalendar.id);
    }
  };

  const handleDeleteSwimlane = async (id: string) => {
    const response = await fetch(`/api/swimlanes/${id}`, {
      method: 'DELETE',
    });

    if (response.ok && currentCalendar) {
      fetchCalendarData(currentCalendar.id);
    }
  };

  const handleReorderSwimlanes = async (swimlaneId: string, newIndex: number) => {
    if (!currentCalendar) return;

    // Optimistically reorder locally
    const swimlanes = [...currentCalendar.swimlanes];
    const currentIndex = swimlanes.findIndex(s => s.id === swimlaneId);
    if (currentIndex === -1) return;

    const [movedSwimlane] = swimlanes.splice(currentIndex, 1);
    swimlanes.splice(newIndex, 0, movedSwimlane);

    // Update sortOrder for all swimlanes
    const updates = swimlanes.map((s, idx) => ({
      id: s.id,
      sortOrder: idx,
    }));

    // Update each swimlane's sortOrder
    try {
      await Promise.all(
        updates.map((update) =>
          fetch(`/api/swimlanes/${update.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sortOrder: update.sortOrder }),
          })
        )
      );
      fetchCalendarData(currentCalendar.id);
    } catch (error) {
      console.error('Failed to reorder swimlanes:', error);
    }
  };

  const handleActivitySubmit = async (data: ActivityFormData) => {
    if (!currentCalendar) return;

    const url = editingActivity
      ? `/api/activities/${editingActivity.id}`
      : '/api/activities';
    const method = editingActivity ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        calendarId: currentCalendar.id,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to save activity');
    }

    fetchCalendarData(currentCalendar.id);
  };

  const handleActivityDelete = async (id: string) => {
    const response = await fetch(`/api/activities/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to delete activity');
    }

    if (currentCalendar) {
      fetchCalendarData(currentCalendar.id);
    }
  };

  const handleActivityUpdate = async (id: string, updates: Partial<Activity>) => {
    const response = await fetch(`/api/activities/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    if (response.ok && currentCalendar) {
      fetchCalendarData(currentCalendar.id);
    }
  };

  const handleActivityClick = (activity: Activity) => {
    setEditingActivity(activity);
    setActivityDefaults({});
    setShowActivityModal(true);
  };

  const handleActivityCreate = (swimlaneId: string, startDate: string, endDate: string) => {
    setEditingActivity(null);
    setActivityDefaults({ swimlaneId, startDate, endDate });
    setShowActivityModal(true);
  };

  const handleDateClick = (date: string) => {
    setEditingActivity(null);
    setActivityDefaults({ startDate: date, endDate: date });
    setShowActivityModal(true);
  };

  const handleExport = async (startDate: string, endDate: string) => {
    if (!mainContentRef.current) return;

    try {
      const canvas = await html2canvas(mainContentRef.current, {
        backgroundColor: document.documentElement.classList.contains('dark') ? '#111827' : '#ffffff',
        scale: 2,
      });

      const link = document.createElement('a');
      link.download = `campaignos-export-${startDate}-to-${endDate}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  // Filter activities
  const filteredActivities = currentCalendar?.activities.filter((activity) => {
    if (searchQuery && !activity.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (selectedCampaignId && activity.campaignId !== selectedCampaignId) {
      return false;
    }
    if (selectedStatusId && activity.statusId !== selectedStatusId) {
      return false;
    }
    return true;
  }) || [];

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading CampaignOS...</p>
        </div>
      </div>
    );
  }

  // Empty state - no calendars
  if (calendars.length === 0) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
        <Header
          calendars={[]}
          currentCalendar={null}
          currentView={currentView}
          onViewChange={setCurrentView}
          onCalendarSelect={() => {}}
          onCreateCalendar={() => setShowCreateCalendar(true)}
          onCreateActivity={() => {}}
          onExport={() => {}}
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md mx-auto px-4">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-8 h-8 text-blue-600 dark:text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Welcome to CampaignOS
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Your marketing campaign planning tool. Create your first calendar to get started.
            </p>
            <button
              onClick={() => setShowCreateCalendar(true)}
              className="px-6 py-3 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Create Your First Calendar
            </button>
          </div>
        </div>

        <CreateCalendarModal
          isOpen={showCreateCalendar}
          onClose={() => setShowCreateCalendar(false)}
          onSubmit={handleCreateCalendar}
        />
      </div>
    );
  }

  // Empty swimlanes state
  const hasNoSwimlanes = currentCalendar && currentCalendar.swimlanes.length === 0;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <Header
        calendars={calendars}
        currentCalendar={currentCalendar}
        currentView={currentView}
        onViewChange={setCurrentView}
        onCalendarSelect={(calendar) => fetchCalendarData(calendar.id)}
        onCreateCalendar={() => setShowCreateCalendar(true)}
        onCreateActivity={() => {
          setEditingActivity(null);
          setActivityDefaults({});
          setShowActivityModal(true);
        }}
        onExport={() => setShowExportModal(true)}
      />

      <FilterBar
        campaigns={currentCalendar?.campaigns || []}
        statuses={currentCalendar?.statuses || []}
        searchQuery={searchQuery}
        selectedCampaignId={selectedCampaignId}
        selectedStatusId={selectedStatusId}
        onSearchChange={setSearchQuery}
        onCampaignChange={setSelectedCampaignId}
        onStatusChange={setSelectedStatusId}
      />

      <main className="flex-1 flex flex-col overflow-hidden" ref={mainContentRef}>
        {hasNoSwimlanes ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md mx-auto px-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Add Swimlanes to Get Started
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Swimlanes help organize your activities into channels or categories.
              </p>
              <div className="flex flex-col gap-2 max-w-xs mx-auto">
                <input
                  type="text"
                  placeholder="Enter swimlane name"
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                      handleCreateSwimlane(e.currentTarget.value.trim());
                      e.currentTarget.value = '';
                    }
                  }}
                />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Press Enter to add swimlane
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {currentView === 'timeline' && currentCalendar && (
              <TimelineView
                activities={filteredActivities}
                swimlanes={currentCalendar.swimlanes}
                statuses={currentCalendar.statuses}
                onActivityClick={handleActivityClick}
                onActivityCreate={handleActivityCreate}
                onActivityUpdate={handleActivityUpdate}
                onAddSwimlane={handleCreateSwimlane}
                onEditSwimlane={handleEditSwimlane}
                onDeleteSwimlane={handleDeleteSwimlane}
                onReorderSwimlanes={handleReorderSwimlanes}
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
              />
            )}
          </>
        )}
      </main>

      {/* Modals */}
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
          onClose={() => {
            setShowActivityModal(false);
            setEditingActivity(null);
            setActivityDefaults({});
          }}
          onSubmit={handleActivitySubmit}
          onDelete={handleActivityDelete}
        />
      )}

      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
      />
    </div>
  );
}

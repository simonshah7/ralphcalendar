'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Status, Campaign } from '@/db/schema';
import { formatCurrency, formatDate } from '@/lib/utils';
import PptxGenJS from 'pptxgenjs';

interface SubEventData {
  id: string;
  title: string;
  type: string | null;
  startDatetime: string;
  endDatetime: string;
  location: string | null;
  description: string | null;
  sortOrder: number | null;
}

interface AttendeeData {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  attendeeType: 'internal' | 'customer';
  role: string | null;
  hasPass: boolean;
  travelStatus: string | null;
  notes: string | null;
}

interface ChecklistItemData {
  id: string;
  title: string;
  isDone: boolean;
  category: string | null;
  dueDate: string | null;
  sortOrder: number | null;
}

interface PriorEventData {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  cost: string | null;
  actualCost: string | null;
  expectedSaos: string | null;
  actualSaos: string | null;
  pipelineGenerated: string | null;
  attendeeCount: number;
  subEventCount: number;
  checklistTotal: number;
  checklistDone: number;
  allocatedPasses: number;
  totalPasses: number | null;
}

interface EventDetailData {
  id: string;
  calendarId: string;
  title: string;
  seriesName: string | null;
  startDate: string;
  endDate: string;
  location: string | null;
  venue: string | null;
  statusId: string | null;
  statusName: string | null;
  totalPasses: number | null;
  slackWebhookUrl: string | null;
  description: string | null;
  priorEventId: string | null;
  cost: string | null;
  actualCost: string | null;
  currency: string | null;
  region: string | null;
  expectedSaos: string | null;
  actualSaos: string | null;
  pipelineGenerated: string | null;
  revenueGenerated: string | null;
  subEvents: SubEventData[];
  attendees: AttendeeData[];
  checklistItems: ChecklistItemData[];
  linkedCampaigns: Campaign[];
  priorEvent: PriorEventData | null;
}

interface EventDetailViewProps {
  eventId: string;
  statuses: Status[];
  campaigns: Campaign[];
  allEvents: { id: string; title: string; seriesName: string | null }[];
  onBack: () => void;
  onRefreshEvents: () => void;
}

type TabType = 'overview' | 'sub-events' | 'attendees' | 'checklist' | 'comparison' | 'actions';

function num(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
}

const CHECKLIST_CATEGORIES = ['content', 'logistics', 'materials', 'registrations', 'comms'];

export function EventDetailView({ eventId, statuses, campaigns, allEvents, onBack, onRefreshEvents }: EventDetailViewProps) {
  const [event, setEvent] = useState<EventDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string | number | null>>({});

  // Sub-event form
  const [showSubEventForm, setShowSubEventForm] = useState(false);
  const [subEventForm, setSubEventForm] = useState({ title: '', type: '', startDatetime: '', endDatetime: '', location: '', description: '' });

  // Attendee form
  const [showAttendeeForm, setShowAttendeeForm] = useState(false);
  const [attendeeForm, setAttendeeForm] = useState<{ name: string; email: string; company: string; attendeeType: 'internal' | 'customer'; role: string; hasPass: boolean; travelStatus: string; notes: string }>({ name: '', email: '', company: '', attendeeType: 'internal', role: '', hasPass: false, travelStatus: 'not_booked', notes: '' });

  // Checklist form
  const [newChecklistTitle, setNewChecklistTitle] = useState('');
  const [newChecklistCategory, setNewChecklistCategory] = useState('');

  // Slack message
  const [slackMessage, setSlackMessage] = useState('');
  const [slackSending, setSlackSending] = useState(false);
  const [slackResult, setSlackResult] = useState<string | null>(null);

  // Campaign linking
  const [showCampaignLink, setShowCampaignLink] = useState(false);

  const fetchEvent = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}`);
      if (!res.ok) throw new Error('Failed to fetch event');
      const data = await res.json();
      setEvent(data);
    } catch (error) {
      console.error('Error fetching event:', error);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  const handleUpdateEvent = async (updates: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        fetchEvent();
        onRefreshEvents();
      }
    } catch (error) {
      console.error('Error updating event:', error);
    }
  };

  const handleDeleteEvent = async () => {
    if (!confirm('Are you sure you want to delete this event? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/events/${eventId}`, { method: 'DELETE' });
      if (res.ok) {
        onRefreshEvents();
        onBack();
      }
    } catch (error) {
      console.error('Error deleting event:', error);
    }
  };

  // Sub-event handlers
  const handleAddSubEvent = async () => {
    if (!subEventForm.title.trim()) return;
    try {
      await fetch('/api/sub-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, ...subEventForm }),
      });
      setSubEventForm({ title: '', type: '', startDatetime: '', endDatetime: '', location: '', description: '' });
      setShowSubEventForm(false);
      fetchEvent();
    } catch (error) {
      console.error('Error adding sub-event:', error);
    }
  };

  const handleDeleteSubEvent = async (id: string) => {
    await fetch(`/api/sub-events/${id}`, { method: 'DELETE' });
    fetchEvent();
  };

  // Attendee handlers
  const handleAddAttendee = async () => {
    if (!attendeeForm.name.trim()) return;
    try {
      await fetch('/api/event-attendees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, ...attendeeForm }),
      });
      setAttendeeForm({ name: '', email: '', company: '', attendeeType: 'internal', role: '', hasPass: false, travelStatus: 'not_booked', notes: '' });
      setShowAttendeeForm(false);
      fetchEvent();
    } catch (error) {
      console.error('Error adding attendee:', error);
    }
  };

  const handleTogglePass = async (attendeeId: string, currentVal: boolean) => {
    await fetch(`/api/event-attendees/${attendeeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hasPass: !currentVal }),
    });
    fetchEvent();
  };

  const handleUpdateTravelStatus = async (attendeeId: string, status: string) => {
    await fetch(`/api/event-attendees/${attendeeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ travelStatus: status }),
    });
    fetchEvent();
  };

  const handleDeleteAttendee = async (id: string) => {
    await fetch(`/api/event-attendees/${id}`, { method: 'DELETE' });
    fetchEvent();
  };

  // Checklist handlers
  const handleAddChecklistItem = async () => {
    if (!newChecklistTitle.trim()) return;
    await fetch('/api/checklist-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, title: newChecklistTitle, category: newChecklistCategory || null }),
    });
    setNewChecklistTitle('');
    setNewChecklistCategory('');
    fetchEvent();
  };

  const handleToggleChecklist = async (id: string, isDone: boolean) => {
    await fetch(`/api/checklist-items/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDone: !isDone }),
    });
    fetchEvent();
  };

  const handleDeleteChecklistItem = async (id: string) => {
    await fetch(`/api/checklist-items/${id}`, { method: 'DELETE' });
    fetchEvent();
  };

  // Campaign linking
  const handleLinkCampaign = async (campaignId: string) => {
    await fetch('/api/campaign-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, campaignId }),
    });
    setShowCampaignLink(false);
    fetchEvent();
    onRefreshEvents();
  };

  // Slack notification
  const handleSendSlackUpdate = async (type: string) => {
    setSlackSending(true);
    setSlackResult(null);
    try {
      const res = await fetch(`/api/events/${eventId}/slack-notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, message: slackMessage }),
      });
      const data = await res.json();
      if (res.ok) {
        setSlackResult('Notification sent!');
        setSlackMessage('');
      } else {
        setSlackResult(data.error || 'Failed to send');
      }
    } catch {
      setSlackResult('Failed to send notification');
    } finally {
      setSlackSending(false);
    }
  };

  // Logistics deck PPTX generation
  const handleGenerateLogisticsDeck = async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/logistics-deck`);
      if (!res.ok) throw new Error('Failed to fetch logistics data');
      const data = await res.json();

      const pptx = new PptxGenJS();
      pptx.layout = 'LAYOUT_WIDE';

      // Title slide
      const slide1 = pptx.addSlide();
      slide1.addText(data.event.title, { x: 0.5, y: 1.5, w: '90%', fontSize: 36, bold: true, color: '1a1a1a' });
      slide1.addText(`${data.event.startDate} - ${data.event.endDate}`, { x: 0.5, y: 2.5, w: '90%', fontSize: 18, color: '666666' });
      slide1.addText(data.event.location || 'Location TBD', { x: 0.5, y: 3.0, w: '90%', fontSize: 16, color: '888888' });
      slide1.addText(`Status: ${data.event.statusName || 'N/A'}`, { x: 0.5, y: 3.5, w: '90%', fontSize: 14, color: '888888' });

      // Overview slide
      const slide2 = pptx.addSlide();
      slide2.addText('Event Overview', { x: 0.5, y: 0.3, w: '90%', fontSize: 24, bold: true, color: '1a1a1a' });
      const overviewRows: string[][] = [
        ['Metric', 'Value'],
        ['Passes', `${data.passAllocation.allocated}/${data.passAllocation.total} allocated`],
        ['Internal Attendees', String(data.attendees.internal.length)],
        ['Customer Attendees', String(data.attendees.customers.length)],
        ['Sub-Events', String(data.subEvents.length)],
        ['Checklist', `${data.checklist.filter((c: ChecklistItemData) => c.isDone).length}/${data.checklist.length} complete`],
        ['Budget', formatCurrency(num(data.event.cost))],
      ];
      slide2.addTable(overviewRows.map((row: string[]) => row.map((cell: string) => ({ text: cell }))), { x: 0.5, y: 1.2, w: 8, fontSize: 12, border: { type: 'solid', pt: 0.5, color: 'cccccc' } });

      // Sub-events slide
      if (data.subEvents.length > 0) {
        const slide3 = pptx.addSlide();
        slide3.addText('Schedule / Sub-Events', { x: 0.5, y: 0.3, w: '90%', fontSize: 24, bold: true, color: '1a1a1a' });
        const subRows: string[][] = [['Title', 'Type', 'Time', 'Location']];
        data.subEvents.forEach((se: SubEventData) => {
          subRows.push([se.title, se.type || '-', `${se.startDatetime} - ${se.endDatetime}`, se.location || '-']);
        });
        slide3.addTable(subRows.map((row: string[]) => row.map((cell: string) => ({ text: cell }))), { x: 0.5, y: 1.2, w: 12, fontSize: 11, border: { type: 'solid', pt: 0.5, color: 'cccccc' } });
      }

      // Attendees slide
      if (data.attendees.internal.length > 0 || data.attendees.customers.length > 0) {
        const slide4 = pptx.addSlide();
        slide4.addText('Attendees', { x: 0.5, y: 0.3, w: '90%', fontSize: 24, bold: true, color: '1a1a1a' });
        const attRows: string[][] = [['Name', 'Type', 'Role', 'Company', 'Pass', 'Travel']];
        [...data.attendees.internal, ...data.attendees.customers].forEach((a: AttendeeData) => {
          attRows.push([a.name, a.attendeeType, a.role || '-', a.company || '-', a.hasPass ? 'Yes' : 'No', a.travelStatus || '-']);
        });
        slide4.addTable(attRows.map((row: string[]) => row.map((cell: string) => ({ text: cell }))), { x: 0.5, y: 1.2, w: 12, fontSize: 10, border: { type: 'solid', pt: 0.5, color: 'cccccc' } });
      }

      await pptx.writeFile({ fileName: `${data.event.title.replace(/[^a-zA-Z0-9]/g, '_')}_Logistics.pptx` });
    } catch (error) {
      console.error('Error generating logistics deck:', error);
      alert('Failed to generate logistics deck');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="relative w-8 h-8">
          <div className="absolute inset-0 rounded-full border-2 border-card-border" />
          <div className="absolute inset-0 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-24 text-muted-foreground">
        Event not found.
        <button onClick={onBack} className="ml-2 text-accent underline">Go back</button>
      </div>
    );
  }

  const allocatedPasses = event.attendees.filter((a: AttendeeData) => a.hasPass).length;
  const checklistDone = event.checklistItems.filter((c: ChecklistItemData) => c.isDone).length;
  const checklistTotal = event.checklistItems.length;
  const checklistPct = checklistTotal > 0 ? (checklistDone / checklistTotal) * 100 : 0;

  const tabs: { key: TabType; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'sub-events', label: 'Sub-Events', count: event.subEvents.length },
    { key: 'attendees', label: 'Attendees', count: event.attendees.length },
    { key: 'checklist', label: 'Checklist', count: checklistTotal },
    { key: 'comparison', label: 'Prior Year' },
    { key: 'actions', label: 'Actions' },
  ];

  const linkedCampaignIds = new Set(event.linkedCampaigns.map((c: Campaign) => c.id));
  const unlinkedCampaigns = campaigns.filter((c) => !linkedCampaignIds.has(c.id));

  // Group checklist by category
  const checklistByCategory = CHECKLIST_CATEGORIES.reduce((acc, cat) => {
    acc[cat] = event.checklistItems.filter((c: ChecklistItemData) => c.category === cat);
    return acc;
  }, {} as Record<string, ChecklistItemData[]>);
  const uncategorized = event.checklistItems.filter((c: ChecklistItemData) => !c.category || !CHECKLIST_CATEGORIES.includes(c.category));

  return (
    <div className="p-4 max-w-[1200px] mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={onBack}
          className="mt-1 p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold text-foreground truncate">{event.title}</h1>
            {event.statusName && (
              <span
                className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0"
                style={{
                  backgroundColor: event.statusId ? `${statuses.find((s) => s.id === event.statusId)?.color || '#888'}20` : undefined,
                  color: statuses.find((s) => s.id === event.statusId)?.color || '#888',
                }}
              >
                {event.statusName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{formatDate(event.startDate)} - {formatDate(event.endDate)}</span>
            {event.location && <span>{event.location}</span>}
            {event.seriesName && <span className="text-xs bg-muted px-1.5 py-0.5 rounded">Series: {event.seriesName}</span>}
          </div>
        </div>
        <button
          onClick={handleDeleteEvent}
          className="px-3 py-1.5 text-xs text-red-500 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors"
        >
          Delete
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <div className="bg-card border border-card-border rounded-lg p-2.5 text-center">
          <div className="text-lg font-bold text-foreground">{event.subEvents.length}</div>
          <div className="text-[10px] text-muted-foreground uppercase">Sub-Events</div>
        </div>
        <div className="bg-card border border-card-border rounded-lg p-2.5 text-center">
          <div className="text-lg font-bold text-foreground">{event.attendees.length}</div>
          <div className="text-[10px] text-muted-foreground uppercase">Attendees</div>
        </div>
        <div className="bg-card border border-card-border rounded-lg p-2.5 text-center">
          <div className="text-lg font-bold text-foreground">{allocatedPasses}/{event.totalPasses || 0}</div>
          <div className="text-[10px] text-muted-foreground uppercase">Passes</div>
        </div>
        <div className="bg-card border border-card-border rounded-lg p-2.5 text-center">
          <div className={`text-lg font-bold ${checklistPct === 100 ? 'text-green-500' : 'text-foreground'}`}>
            {checklistDone}/{checklistTotal}
          </div>
          <div className="text-[10px] text-muted-foreground uppercase">Checklist</div>
        </div>
        <div className="bg-card border border-card-border rounded-lg p-2.5 text-center">
          <div className="text-lg font-bold text-foreground">{formatCurrency(num(event.cost))}</div>
          <div className="text-[10px] text-muted-foreground uppercase">Budget</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-card-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-[1px] ${
              activeTab === tab.key
                ? 'border-accent text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="ml-1 text-xs opacity-60">({tab.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Editable fields */}
          <div className="bg-card border border-card-border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Event Details</h3>
              <button
                onClick={() => {
                  if (isEditing) {
                    handleUpdateEvent(editForm);
                    setIsEditing(false);
                  } else {
                    setEditForm({
                      title: event.title,
                      seriesName: event.seriesName,
                      startDate: event.startDate,
                      endDate: event.endDate,
                      location: event.location,
                      venue: event.venue,
                      statusId: event.statusId,
                      totalPasses: event.totalPasses,
                      description: event.description,
                      cost: event.cost,
                      actualCost: event.actualCost,
                      currency: event.currency,
                      region: event.region,
                      priorEventId: event.priorEventId,
                    });
                    setIsEditing(true);
                  }
                }}
                className="text-xs text-accent hover:underline"
              >
                {isEditing ? 'Save' : 'Edit'}
              </button>
            </div>

            {isEditing ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Title</label>
                  <input className="w-full px-2 py-1.5 text-sm bg-muted border border-card-border rounded text-foreground" value={editForm.title as string || ''} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Series Name</label>
                  <input className="w-full px-2 py-1.5 text-sm bg-muted border border-card-border rounded text-foreground" value={editForm.seriesName as string || ''} onChange={(e) => setEditForm({ ...editForm, seriesName: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Start Date</label>
                  <input type="date" className="w-full px-2 py-1.5 text-sm bg-muted border border-card-border rounded text-foreground" value={editForm.startDate as string || ''} onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">End Date</label>
                  <input type="date" className="w-full px-2 py-1.5 text-sm bg-muted border border-card-border rounded text-foreground" value={editForm.endDate as string || ''} onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Location</label>
                  <input className="w-full px-2 py-1.5 text-sm bg-muted border border-card-border rounded text-foreground" value={editForm.location as string || ''} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Venue</label>
                  <input className="w-full px-2 py-1.5 text-sm bg-muted border border-card-border rounded text-foreground" value={editForm.venue as string || ''} onChange={(e) => setEditForm({ ...editForm, venue: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Status</label>
                  <select className="w-full px-2 py-1.5 text-sm bg-muted border border-card-border rounded text-foreground" value={editForm.statusId as string || ''} onChange={(e) => setEditForm({ ...editForm, statusId: e.target.value })}>
                    <option value="">None</option>
                    {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Total Passes</label>
                  <input type="number" className="w-full px-2 py-1.5 text-sm bg-muted border border-card-border rounded text-foreground" value={editForm.totalPasses as number || 0} onChange={(e) => setEditForm({ ...editForm, totalPasses: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Planned Cost</label>
                  <input type="number" className="w-full px-2 py-1.5 text-sm bg-muted border border-card-border rounded text-foreground" value={editForm.cost as string || '0'} onChange={(e) => setEditForm({ ...editForm, cost: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Actual Cost</label>
                  <input type="number" className="w-full px-2 py-1.5 text-sm bg-muted border border-card-border rounded text-foreground" value={editForm.actualCost as string || '0'} onChange={(e) => setEditForm({ ...editForm, actualCost: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Prior Event (YoY link)</label>
                  <select className="w-full px-2 py-1.5 text-sm bg-muted border border-card-border rounded text-foreground" value={editForm.priorEventId as string || ''} onChange={(e) => setEditForm({ ...editForm, priorEventId: e.target.value })}>
                    <option value="">None</option>
                    {allEvents.filter((e) => e.id !== eventId).map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground">Description</label>
                  <textarea className="w-full px-2 py-1.5 text-sm bg-muted border border-card-border rounded text-foreground min-h-[60px]" value={editForm.description as string || ''} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                {event.description && (
                  <div className="col-span-2 text-muted-foreground mb-2">{event.description}</div>
                )}
                <div><span className="text-muted-foreground">Venue:</span> <span className="text-foreground">{event.venue || 'TBD'}</span></div>
                <div><span className="text-muted-foreground">Region:</span> <span className="text-foreground">{event.region || 'US'}</span></div>
                <div><span className="text-muted-foreground">Planned Cost:</span> <span className="text-foreground">{formatCurrency(num(event.cost))}</span></div>
                <div><span className="text-muted-foreground">Actual Cost:</span> <span className="text-foreground">{formatCurrency(num(event.actualCost))}</span></div>
                <div><span className="text-muted-foreground">Currency:</span> <span className="text-foreground">{event.currency || 'US$'}</span></div>
                <div><span className="text-muted-foreground">Total Passes:</span> <span className="text-foreground">{event.totalPasses || 0}</span></div>
              </div>
            )}
          </div>

          {/* Linked Campaigns */}
          <div className="bg-card border border-card-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-foreground">Linked Campaigns</h3>
              {unlinkedCampaigns.length > 0 && (
                <button onClick={() => setShowCampaignLink(!showCampaignLink)} className="text-xs text-accent hover:underline">
                  + Link Campaign
                </button>
              )}
            </div>
            {showCampaignLink && (
              <div className="mb-3 flex gap-2 flex-wrap">
                {unlinkedCampaigns.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleLinkCampaign(c.id)}
                    className="px-2 py-1 text-xs bg-muted border border-card-border rounded hover:bg-accent hover:text-white transition-colors"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
            {event.linkedCampaigns.length === 0 ? (
              <p className="text-xs text-muted-foreground">No campaigns linked.</p>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {event.linkedCampaigns.map((c: Campaign) => (
                  <span key={c.id} className="inline-flex px-2 py-1 rounded text-xs bg-muted text-foreground">
                    {c.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'sub-events' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Sub-Events</h3>
            <button onClick={() => setShowSubEventForm(!showSubEventForm)} className="text-xs text-accent hover:underline">
              + Add Sub-Event
            </button>
          </div>

          {showSubEventForm && (
            <div className="bg-card border border-card-border rounded-lg p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Title *" className="px-2 py-1.5 text-sm bg-muted border border-card-border rounded text-foreground" value={subEventForm.title} onChange={(e) => setSubEventForm({ ...subEventForm, title: e.target.value })} />
                <input placeholder="Type (e.g. workshop, dinner)" className="px-2 py-1.5 text-sm bg-muted border border-card-border rounded text-foreground" value={subEventForm.type} onChange={(e) => setSubEventForm({ ...subEventForm, type: e.target.value })} />
                <input type="datetime-local" className="px-2 py-1.5 text-sm bg-muted border border-card-border rounded text-foreground" value={subEventForm.startDatetime} onChange={(e) => setSubEventForm({ ...subEventForm, startDatetime: e.target.value })} />
                <input type="datetime-local" className="px-2 py-1.5 text-sm bg-muted border border-card-border rounded text-foreground" value={subEventForm.endDatetime} onChange={(e) => setSubEventForm({ ...subEventForm, endDatetime: e.target.value })} />
                <input placeholder="Location" className="px-2 py-1.5 text-sm bg-muted border border-card-border rounded text-foreground" value={subEventForm.location} onChange={(e) => setSubEventForm({ ...subEventForm, location: e.target.value })} />
                <input placeholder="Description" className="px-2 py-1.5 text-sm bg-muted border border-card-border rounded text-foreground" value={subEventForm.description} onChange={(e) => setSubEventForm({ ...subEventForm, description: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <button onClick={handleAddSubEvent} className="px-3 py-1 text-xs text-white bg-accent rounded hover:opacity-90">Add</button>
                <button onClick={() => setShowSubEventForm(false)} className="px-3 py-1 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
              </div>
            </div>
          )}

          {event.subEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No sub-events yet.</p>
          ) : (
            <div className="space-y-2">
              {event.subEvents.map((se: SubEventData) => (
                <div key={se.id} className="bg-card border border-card-border rounded-lg p-3 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-foreground">{se.title}</span>
                      {se.type && <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground">{se.type}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {se.startDatetime} - {se.endDatetime}
                      {se.location && ` | ${se.location}`}
                    </div>
                    {se.description && <div className="text-xs text-muted-foreground mt-1">{se.description}</div>}
                  </div>
                  <button onClick={() => handleDeleteSubEvent(se.id)} className="text-xs text-red-400 hover:text-red-500 ml-2">Delete</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'attendees' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              Attendees ({event.attendees.length})
              <span className="text-xs font-normal text-muted-foreground ml-2">
                Passes: {allocatedPasses}/{event.totalPasses || 0}
              </span>
            </h3>
            <button onClick={() => setShowAttendeeForm(!showAttendeeForm)} className="text-xs text-accent hover:underline">
              + Add Attendee
            </button>
          </div>

          {showAttendeeForm && (
            <div className="bg-card border border-card-border rounded-lg p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Name *" className="px-2 py-1.5 text-sm bg-muted border border-card-border rounded text-foreground" value={attendeeForm.name} onChange={(e) => setAttendeeForm({ ...attendeeForm, name: e.target.value })} />
                <input placeholder="Email" className="px-2 py-1.5 text-sm bg-muted border border-card-border rounded text-foreground" value={attendeeForm.email} onChange={(e) => setAttendeeForm({ ...attendeeForm, email: e.target.value })} />
                <select className="px-2 py-1.5 text-sm bg-muted border border-card-border rounded text-foreground" value={attendeeForm.attendeeType} onChange={(e) => setAttendeeForm({ ...attendeeForm, attendeeType: e.target.value as 'internal' | 'customer' })}>
                  <option value="internal">Internal</option>
                  <option value="customer">Customer</option>
                </select>
                <input placeholder="Role" className="px-2 py-1.5 text-sm bg-muted border border-card-border rounded text-foreground" value={attendeeForm.role} onChange={(e) => setAttendeeForm({ ...attendeeForm, role: e.target.value })} />
                <input placeholder="Company" className="px-2 py-1.5 text-sm bg-muted border border-card-border rounded text-foreground" value={attendeeForm.company} onChange={(e) => setAttendeeForm({ ...attendeeForm, company: e.target.value })} />
                <select className="px-2 py-1.5 text-sm bg-muted border border-card-border rounded text-foreground" value={attendeeForm.travelStatus} onChange={(e) => setAttendeeForm({ ...attendeeForm, travelStatus: e.target.value })}>
                  <option value="not_booked">Not Booked</option>
                  <option value="booked">Booked</option>
                  <option value="confirmed">Confirmed</option>
                </select>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-foreground">
                  <input type="checkbox" checked={attendeeForm.hasPass} onChange={(e) => setAttendeeForm({ ...attendeeForm, hasPass: e.target.checked })} />
                  Has Pass
                </label>
                <button onClick={handleAddAttendee} className="px-3 py-1 text-xs text-white bg-accent rounded hover:opacity-90">Add</button>
                <button onClick={() => setShowAttendeeForm(false)} className="px-3 py-1 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
              </div>
            </div>
          )}

          {/* Internal */}
          {event.attendees.filter((a: AttendeeData) => a.attendeeType === 'internal').length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Internal Team</h4>
              <div className="bg-card border border-card-border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left text-muted-foreground">Name</th>
                      <th className="px-3 py-2 text-left text-muted-foreground">Role</th>
                      <th className="px-3 py-2 text-center text-muted-foreground">Pass</th>
                      <th className="px-3 py-2 text-left text-muted-foreground">Travel</th>
                      <th className="px-3 py-2 text-right text-muted-foreground"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-card-border">
                    {event.attendees.filter((a: AttendeeData) => a.attendeeType === 'internal').map((a: AttendeeData) => (
                      <tr key={a.id} className="hover:bg-muted/30">
                        <td className="px-3 py-2 text-foreground">{a.name}<br /><span className="text-muted-foreground">{a.email}</span></td>
                        <td className="px-3 py-2 text-muted-foreground">{a.role || '-'}</td>
                        <td className="px-3 py-2 text-center">
                          <button onClick={() => handleTogglePass(a.id, a.hasPass)} className={`w-5 h-5 rounded border ${a.hasPass ? 'bg-green-500 border-green-500 text-white' : 'border-card-border'} flex items-center justify-center mx-auto`}>
                            {a.hasPass && <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>}
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          <select value={a.travelStatus || 'not_booked'} onChange={(e) => handleUpdateTravelStatus(a.id, e.target.value)} className="text-xs bg-transparent border border-card-border rounded px-1 py-0.5 text-foreground">
                            <option value="not_booked">Not Booked</option>
                            <option value="booked">Booked</option>
                            <option value="confirmed">Confirmed</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button onClick={() => handleDeleteAttendee(a.id)} className="text-red-400 hover:text-red-500">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Customers */}
          {event.attendees.filter((a: AttendeeData) => a.attendeeType === 'customer').length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Customers</h4>
              <div className="bg-card border border-card-border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left text-muted-foreground">Name</th>
                      <th className="px-3 py-2 text-left text-muted-foreground">Company</th>
                      <th className="px-3 py-2 text-left text-muted-foreground">Role</th>
                      <th className="px-3 py-2 text-right text-muted-foreground"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-card-border">
                    {event.attendees.filter((a: AttendeeData) => a.attendeeType === 'customer').map((a: AttendeeData) => (
                      <tr key={a.id} className="hover:bg-muted/30">
                        <td className="px-3 py-2 text-foreground">{a.name}<br /><span className="text-muted-foreground">{a.email}</span></td>
                        <td className="px-3 py-2 text-muted-foreground">{a.company || '-'}</td>
                        <td className="px-3 py-2 text-muted-foreground">{a.role || '-'}</td>
                        <td className="px-3 py-2 text-right">
                          <button onClick={() => handleDeleteAttendee(a.id)} className="text-red-400 hover:text-red-500">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'checklist' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              Readiness Checklist
              <span className="text-xs font-normal text-muted-foreground ml-2">{checklistDone}/{checklistTotal} complete</span>
            </h3>
          </div>

          {/* Progress bar */}
          {checklistTotal > 0 && (
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${checklistPct === 100 ? 'bg-green-500' : checklistPct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                style={{ width: `${checklistPct}%` }}
              />
            </div>
          )}

          {/* Add item form */}
          <div className="flex items-center gap-2">
            <input
              placeholder="Add checklist item..."
              className="flex-1 px-2 py-1.5 text-sm bg-muted border border-card-border rounded text-foreground"
              value={newChecklistTitle}
              onChange={(e) => setNewChecklistTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddChecklistItem(); }}
            />
            <select
              className="px-2 py-1.5 text-sm bg-muted border border-card-border rounded text-foreground"
              value={newChecklistCategory}
              onChange={(e) => setNewChecklistCategory(e.target.value)}
            >
              <option value="">No category</option>
              {CHECKLIST_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
            <button onClick={handleAddChecklistItem} className="px-3 py-1.5 text-xs text-white bg-accent rounded hover:opacity-90">Add</button>
          </div>

          {/* Grouped items */}
          {CHECKLIST_CATEGORIES.map((cat) => {
            const items = checklistByCategory[cat];
            if (items.length === 0) return null;
            return (
              <div key={cat}>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">{cat}</h4>
                <div className="space-y-1">
                  {items.map((item: ChecklistItemData) => (
                    <div key={item.id} className="flex items-center gap-2 group">
                      <button
                        onClick={() => handleToggleChecklist(item.id, item.isDone)}
                        className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center ${item.isDone ? 'bg-green-500 border-green-500 text-white' : 'border-card-border hover:border-accent'}`}
                      >
                        {item.isDone && <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>}
                      </button>
                      <span className={`text-sm flex-1 ${item.isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{item.title}</span>
                      {item.dueDate && <span className="text-[10px] text-muted-foreground">{formatDate(item.dueDate)}</span>}
                      <button onClick={() => handleDeleteChecklistItem(item.id)} className="text-xs text-red-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">Delete</button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {uncategorized.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Other</h4>
              <div className="space-y-1">
                {uncategorized.map((item: ChecklistItemData) => (
                  <div key={item.id} className="flex items-center gap-2 group">
                    <button
                      onClick={() => handleToggleChecklist(item.id, item.isDone)}
                      className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center ${item.isDone ? 'bg-green-500 border-green-500 text-white' : 'border-card-border hover:border-accent'}`}
                    >
                      {item.isDone && <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>}
                    </button>
                    <span className={`text-sm flex-1 ${item.isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{item.title}</span>
                    <button onClick={() => handleDeleteChecklistItem(item.id)} className="text-xs text-red-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">Delete</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'comparison' && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Year-over-Year Comparison</h3>
          {event.priorEvent ? (
            <div className="bg-card border border-card-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Metric</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">{event.priorEvent.title}</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">{event.title}</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-card-border">
                  {[
                    { label: 'Planned Cost', prior: num(event.priorEvent.cost), current: num(event.cost), format: 'currency' },
                    { label: 'Actual Cost', prior: num(event.priorEvent.actualCost), current: num(event.actualCost), format: 'currency' },
                    { label: 'Attendees', prior: event.priorEvent.attendeeCount, current: event.attendees.length, format: 'number' },
                    { label: 'Sub-Events', prior: event.priorEvent.subEventCount, current: event.subEvents.length, format: 'number' },
                    { label: 'Expected SAOs', prior: num(event.priorEvent.expectedSaos), current: num(event.expectedSaos), format: 'number' },
                    { label: 'Actual SAOs', prior: num(event.priorEvent.actualSaos), current: num(event.actualSaos), format: 'number' },
                    { label: 'Pipeline', prior: num(event.priorEvent.pipelineGenerated), current: num(event.pipelineGenerated), format: 'currency' },
                    { label: 'Pass Utilization', prior: event.priorEvent.allocatedPasses, current: allocatedPasses, format: 'passes', priorTotal: event.priorEvent.totalPasses, currentTotal: event.totalPasses },
                  ].map((row) => {
                    const change = row.current - row.prior;
                    const changePct = row.prior > 0 ? ((change / row.prior) * 100).toFixed(1) : null;
                    return (
                      <tr key={row.label}>
                        <td className="px-3 py-2 text-foreground">{row.label}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">
                          {row.format === 'currency' ? formatCurrency(row.prior) : row.format === 'passes' ? `${row.prior}/${row.priorTotal || 0}` : row.prior}
                        </td>
                        <td className="px-3 py-2 text-right text-foreground tabular-nums">
                          {row.format === 'currency' ? formatCurrency(row.current) : row.format === 'passes' ? `${row.current}/${row.currentTotal || 0}` : row.current}
                        </td>
                        <td className={`px-3 py-2 text-right tabular-nums font-medium ${change > 0 ? 'text-green-500' : change < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                          {change > 0 ? '+' : ''}{row.format === 'currency' ? formatCurrency(change) : change}
                          {changePct && <span className="text-xs ml-1">({changePct}%)</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <p>No prior event linked for comparison.</p>
              <p className="text-xs mt-1">Link a prior event in the Overview tab to enable YoY comparison.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'actions' && (
        <div className="space-y-4">
          {/* Logistics Deck */}
          <div className="bg-card border border-card-border rounded-lg p-4">
            <h3 className="text-sm font-semibold text-foreground mb-2">Generate Logistics Deck</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Download a PPTX with event overview, schedule, attendees, and checklist status.
            </p>
            <button
              onClick={handleGenerateLogisticsDeck}
              className="px-4 py-2 text-sm font-medium text-white bg-accent rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Download Logistics Deck
            </button>
          </div>

          {/* Slack Notifications */}
          <div className="bg-card border border-card-border rounded-lg p-4">
            <h3 className="text-sm font-semibold text-foreground mb-2">Slack Notifications</h3>
            <div className="space-y-3">
              <button
                onClick={() => handleSendSlackUpdate('status_update')}
                disabled={slackSending}
                className="px-3 py-1.5 text-sm border border-card-border rounded-lg hover:bg-muted transition-colors text-foreground disabled:opacity-50"
              >
                Send Status Update
              </button>
              <div className="flex items-center gap-2">
                <input
                  placeholder="Custom message..."
                  className="flex-1 px-2 py-1.5 text-sm bg-muted border border-card-border rounded text-foreground"
                  value={slackMessage}
                  onChange={(e) => setSlackMessage(e.target.value)}
                />
                <button
                  onClick={() => handleSendSlackUpdate('custom')}
                  disabled={slackSending || !slackMessage.trim()}
                  className="px-3 py-1.5 text-sm text-white bg-accent rounded hover:opacity-90 disabled:opacity-50"
                >
                  Send
                </button>
              </div>
              {slackResult && (
                <p className={`text-xs ${slackResult.includes('sent') ? 'text-green-500' : 'text-red-500'}`}>{slackResult}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

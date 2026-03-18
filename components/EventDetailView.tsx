'use client';

import { useState, useEffect, useCallback } from 'react';
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

// Inline editable field component
function InlineField({ label, value, onSave, type = 'text', options, placeholder }: {
  label: string;
  value: string | number | null;
  onSave: (val: string) => void;
  type?: 'text' | 'date' | 'number' | 'select' | 'textarea';
  options?: { value: string; label: string }[];
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [tempVal, setTempVal] = useState(String(value ?? ''));

  const commit = () => {
    onSave(tempVal);
    setEditing(false);
  };

  if (editing) {
    const inputClass = "w-full px-2 py-1 text-sm bg-muted border border-accent/40 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30";
    return (
      <div>
        <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium block mb-1">{label}</label>
        {type === 'select' && options ? (
          <select
            className={inputClass}
            value={tempVal}
            onChange={(e) => setTempVal(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
            autoFocus
          >
            <option value="">None</option>
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : type === 'textarea' ? (
          <textarea
            className={inputClass + " min-h-[60px] resize-none"}
            value={tempVal}
            onChange={(e) => setTempVal(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false); }}
            placeholder={placeholder}
            autoFocus
          />
        ) : (
          <input
            type={type}
            className={inputClass}
            value={tempVal}
            onChange={(e) => setTempVal(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
            placeholder={placeholder}
            autoFocus
          />
        )}
      </div>
    );
  }

  const displayVal = type === 'select' && options
    ? options.find(o => o.value === String(value))?.label || (value ? String(value) : '')
    : String(value ?? '');

  return (
    <div
      className="group cursor-pointer rounded-lg px-2 py-1.5 -mx-2 hover:bg-muted/50 transition-colors"
      onClick={() => { setTempVal(String(value ?? '')); setEditing(true); }}
    >
      <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium block mb-0.5">{label}</label>
      <div className="flex items-center justify-between">
        <span className={`text-sm ${displayVal ? 'text-foreground' : 'text-muted-foreground/50 italic'}`}>
          {displayVal || placeholder || 'Click to set'}
        </span>
        <svg className="w-3 h-3 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
        </svg>
      </div>
    </div>
  );
}

export function EventDetailView({ eventId, statuses, campaigns, allEvents, onBack, onRefreshEvents }: EventDetailViewProps) {
  const [event, setEvent] = useState<EventDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');

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

      const slide1 = pptx.addSlide();
      slide1.addText(data.event.title, { x: 0.5, y: 1.5, w: '90%', fontSize: 36, bold: true, color: '1a1a1a' });
      slide1.addText(`${data.event.startDate} - ${data.event.endDate}`, { x: 0.5, y: 2.5, w: '90%', fontSize: 18, color: '666666' });
      slide1.addText(data.event.location || 'Location TBD', { x: 0.5, y: 3.0, w: '90%', fontSize: 16, color: '888888' });
      slide1.addText(`Status: ${data.event.statusName || 'N/A'}`, { x: 0.5, y: 3.5, w: '90%', fontSize: 14, color: '888888' });

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

      if (data.subEvents.length > 0) {
        const slide3 = pptx.addSlide();
        slide3.addText('Schedule / Sub-Events', { x: 0.5, y: 0.3, w: '90%', fontSize: 24, bold: true, color: '1a1a1a' });
        const subRows: string[][] = [['Title', 'Type', 'Time', 'Location']];
        data.subEvents.forEach((se: SubEventData) => {
          subRows.push([se.title, se.type || '-', `${se.startDatetime} - ${se.endDatetime}`, se.location || '-']);
        });
        slide3.addTable(subRows.map((row: string[]) => row.map((cell: string) => ({ text: cell }))), { x: 0.5, y: 1.2, w: 12, fontSize: 11, border: { type: 'solid', pt: 0.5, color: 'cccccc' } });
      }

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

  const tabs: { key: TabType; label: string; count?: number; icon: string }[] = [
    { key: 'overview', label: 'Overview', icon: 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25' },
    { key: 'sub-events', label: 'Schedule', count: event.subEvents.length, icon: 'M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z' },
    { key: 'attendees', label: 'People', count: event.attendees.length, icon: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z' },
    { key: 'checklist', label: 'Checklist', count: checklistTotal, icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { key: 'comparison', label: 'Compare', icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z' },
    { key: 'actions', label: 'Actions', icon: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z' },
  ];

  const linkedCampaignIds = new Set(event.linkedCampaigns.map((c: Campaign) => c.id));
  const unlinkedCampaigns = campaigns.filter((c) => !linkedCampaignIds.has(c.id));

  // Group checklist by category
  const checklistByCategory = CHECKLIST_CATEGORIES.reduce((acc, cat) => {
    acc[cat] = event.checklistItems.filter((c: ChecklistItemData) => c.category === cat);
    return acc;
  }, {} as Record<string, ChecklistItemData[]>);
  const uncategorized = event.checklistItems.filter((c: ChecklistItemData) => !c.category || !CHECKLIST_CATEGORIES.includes(c.category));

  const today = new Date().toISOString().split('T')[0];
  const isActive = event.startDate <= today && event.endDate >= today;
  const isPast = event.endDate < today;
  const isUpcoming = event.startDate > today;

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-[1100px] mx-auto p-4 md:p-6 space-y-5">
        {/* Breadcrumb & Header */}
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Events
          </button>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-foreground font-medium truncate">{event.title}</span>
        </div>

        {/* Title Section - click to edit */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1.5">
              {editingTitle ? (
                <input
                  className="text-xl font-bold text-foreground bg-transparent border-b-2 border-accent focus:outline-none w-full"
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  onBlur={() => { handleUpdateEvent({ title: titleValue }); setEditingTitle(false); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { handleUpdateEvent({ title: titleValue }); setEditingTitle(false); }
                    if (e.key === 'Escape') setEditingTitle(false);
                  }}
                  autoFocus
                />
              ) : (
                <h1
                  className="text-xl font-bold text-foreground truncate cursor-pointer hover:text-accent transition-colors"
                  onClick={() => { setTitleValue(event.title); setEditingTitle(true); }}
                  title="Click to edit title"
                >
                  {event.title}
                </h1>
              )}
              {isActive && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/10 text-green-500 flex-shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  Live Now
                </span>
              )}
              {isUpcoming && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-500 flex-shrink-0">Upcoming</span>
              )}
              {isPast && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground flex-shrink-0">Ended</span>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                {formatDate(event.startDate)} - {formatDate(event.endDate)}
              </span>
              {event.location && (
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0115 0z" />
                  </svg>
                  {event.location}
                </span>
              )}
              {event.seriesName && (
                <span className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Series: {event.seriesName}</span>
              )}
            </div>
          </div>
          <button
            onClick={handleDeleteEvent}
            className="p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
            title="Delete event"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </button>
        </div>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
          <div className="bg-card border border-card-border rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-foreground tabular-nums">{event.subEvents.length}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Schedule</div>
          </div>
          <div className="bg-card border border-card-border rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-foreground tabular-nums">{event.attendees.length}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">People</div>
          </div>
          <div className="bg-card border border-card-border rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-foreground tabular-nums">{allocatedPasses}/{event.totalPasses || 0}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Passes</div>
          </div>
          <div className="bg-card border border-card-border rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <div className={`text-lg font-bold tabular-nums ${checklistPct === 100 ? 'text-green-500' : 'text-foreground'}`}>
                {checklistTotal > 0 ? `${Math.round(checklistPct)}%` : '-'}
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Ready</div>
            {checklistTotal > 0 && (
              <div className="w-full h-1 bg-muted rounded-full overflow-hidden mt-1.5">
                <div
                  className={`h-full rounded-full transition-all ${checklistPct === 100 ? 'bg-green-500' : checklistPct >= 50 ? 'bg-amber-500' : 'bg-red-400'}`}
                  style={{ width: `${checklistPct}%` }}
                />
              </div>
            )}
          </div>
          <div className="bg-card border border-card-border rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-foreground tabular-nums">{formatCurrency(num(event.cost))}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Budget</div>
          </div>
        </div>

        {/* Tabs - with icons */}
        <div className="flex items-center gap-0.5 border-b border-card-border overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-[1px] whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-accent text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
              </svg>
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`text-[10px] px-1.5 py-0 rounded-full ${
                  activeTab === tab.key ? 'bg-accent/10 text-accent' : 'bg-muted text-muted-foreground'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ===== OVERVIEW TAB ===== */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left column - Event Details */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-card border border-card-border rounded-xl p-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Event Details</h3>
                <p className="text-[10px] text-muted-foreground/60 mb-3">Click any field to edit it inline</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <InlineField
                    label="Series"
                    value={event.seriesName}
                    onSave={(v) => handleUpdateEvent({ seriesName: v || null })}
                    placeholder="e.g. AWS re:Invent"
                  />
                  <InlineField
                    label="Status"
                    value={event.statusId}
                    type="select"
                    options={statuses.map(s => ({ value: s.id, label: s.name }))}
                    onSave={(v) => handleUpdateEvent({ statusId: v || null })}
                  />
                  <InlineField
                    label="Start Date"
                    value={event.startDate}
                    type="date"
                    onSave={(v) => handleUpdateEvent({ startDate: v })}
                  />
                  <InlineField
                    label="End Date"
                    value={event.endDate}
                    type="date"
                    onSave={(v) => handleUpdateEvent({ endDate: v })}
                  />
                  <InlineField
                    label="Location"
                    value={event.location}
                    onSave={(v) => handleUpdateEvent({ location: v || null })}
                    placeholder="e.g. Las Vegas, NV"
                  />
                  <InlineField
                    label="Venue"
                    value={event.venue}
                    onSave={(v) => handleUpdateEvent({ venue: v || null })}
                    placeholder="e.g. The Venetian"
                  />
                  <InlineField
                    label="Total Passes"
                    value={event.totalPasses}
                    type="number"
                    onSave={(v) => handleUpdateEvent({ totalPasses: parseInt(v) || 0 })}
                  />
                  <InlineField
                    label="Prior Event (YoY)"
                    value={event.priorEventId}
                    type="select"
                    options={allEvents.filter(e => e.id !== eventId).map(e => ({ value: e.id, label: e.title }))}
                    onSave={(v) => handleUpdateEvent({ priorEventId: v || null })}
                  />
                  <div className="col-span-2">
                    <InlineField
                      label="Description"
                      value={event.description}
                      type="textarea"
                      onSave={(v) => handleUpdateEvent({ description: v || null })}
                      placeholder="Add a description..."
                    />
                  </div>
                </div>
              </div>

              {/* Financials */}
              <div className="bg-card border border-card-border rounded-xl p-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Financials</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1">
                  <InlineField
                    label="Planned Cost"
                    value={event.cost}
                    type="number"
                    onSave={(v) => handleUpdateEvent({ cost: v })}
                    placeholder="0"
                  />
                  <InlineField
                    label="Actual Cost"
                    value={event.actualCost}
                    type="number"
                    onSave={(v) => handleUpdateEvent({ actualCost: v })}
                    placeholder="0"
                  />
                  <InlineField
                    label="Currency"
                    value={event.currency}
                    type="select"
                    options={[{ value: 'USD', label: 'USD' }, { value: 'GBP', label: 'GBP' }, { value: 'EUR', label: 'EUR' }]}
                    onSave={(v) => handleUpdateEvent({ currency: v })}
                  />
                  <InlineField
                    label="Region"
                    value={event.region}
                    type="select"
                    options={[{ value: 'US', label: 'US' }, { value: 'EMEA', label: 'EMEA' }, { value: 'ROW', label: 'ROW' }]}
                    onSave={(v) => handleUpdateEvent({ region: v })}
                  />
                </div>
              </div>
            </div>

            {/* Right column - Campaigns + Metrics */}
            <div className="space-y-4">
              {/* Linked Campaigns */}
              <div className="bg-card border border-card-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Campaigns</h3>
                  {unlinkedCampaigns.length > 0 && (
                    <button onClick={() => setShowCampaignLink(!showCampaignLink)} className="text-[10px] text-accent hover:underline font-medium">
                      + Link
                    </button>
                  )}
                </div>
                {showCampaignLink && (
                  <div className="mb-3 flex gap-1.5 flex-wrap">
                    {unlinkedCampaigns.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => handleLinkCampaign(c.id)}
                        className="px-2 py-1 text-[10px] bg-muted border border-card-border rounded-lg hover:bg-accent hover:text-white transition-colors"
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
                {event.linkedCampaigns.length === 0 ? (
                  <p className="text-xs text-muted-foreground/60 italic">No campaigns linked yet</p>
                ) : (
                  <div className="flex gap-1.5 flex-wrap">
                    {event.linkedCampaigns.map((c: Campaign) => (
                      <span key={c.id} className="inline-flex px-2 py-1 rounded-lg text-xs bg-muted text-foreground">
                        {c.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Metrics */}
              <div className="bg-card border border-card-border rounded-xl p-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Metrics</h3>
                <div className="space-y-1">
                  <InlineField
                    label="Expected SAOs"
                    value={event.expectedSaos}
                    type="number"
                    onSave={(v) => handleUpdateEvent({ expectedSaos: v })}
                    placeholder="0"
                  />
                  <InlineField
                    label="Actual SAOs"
                    value={event.actualSaos}
                    type="number"
                    onSave={(v) => handleUpdateEvent({ actualSaos: v })}
                    placeholder="0"
                  />
                  <InlineField
                    label="Pipeline Generated"
                    value={event.pipelineGenerated}
                    type="number"
                    onSave={(v) => handleUpdateEvent({ pipelineGenerated: v })}
                    placeholder="0"
                  />
                  <InlineField
                    label="Revenue Generated"
                    value={event.revenueGenerated}
                    type="number"
                    onSave={(v) => handleUpdateEvent({ revenueGenerated: v })}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== SUB-EVENTS TAB ===== */}
        {activeTab === 'sub-events' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Schedule</h3>
                <p className="text-xs text-muted-foreground">Sub-events, workshops, dinners, and sessions within this event</p>
              </div>
              <button
                onClick={() => setShowSubEventForm(!showSubEventForm)}
                className="px-3 py-1.5 text-xs font-medium text-white bg-accent-purple-btn rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add
              </button>
            </div>

            {showSubEventForm && (
              <div className="bg-card border border-accent/20 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input placeholder="Title *" className="px-3 py-2 text-sm bg-muted border border-card-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30" value={subEventForm.title} onChange={(e) => setSubEventForm({ ...subEventForm, title: e.target.value })} />
                  <input placeholder="Type (e.g. workshop, dinner)" className="px-3 py-2 text-sm bg-muted border border-card-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30" value={subEventForm.type} onChange={(e) => setSubEventForm({ ...subEventForm, type: e.target.value })} />
                  <input type="datetime-local" className="px-3 py-2 text-sm bg-muted border border-card-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30" value={subEventForm.startDatetime} onChange={(e) => setSubEventForm({ ...subEventForm, startDatetime: e.target.value })} />
                  <input type="datetime-local" className="px-3 py-2 text-sm bg-muted border border-card-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30" value={subEventForm.endDatetime} onChange={(e) => setSubEventForm({ ...subEventForm, endDatetime: e.target.value })} />
                  <input placeholder="Location" className="px-3 py-2 text-sm bg-muted border border-card-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30" value={subEventForm.location} onChange={(e) => setSubEventForm({ ...subEventForm, location: e.target.value })} />
                  <input placeholder="Description" className="px-3 py-2 text-sm bg-muted border border-card-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30" value={subEventForm.description} onChange={(e) => setSubEventForm({ ...subEventForm, description: e.target.value })} />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleAddSubEvent} className="px-4 py-1.5 text-xs font-medium text-white bg-accent rounded-lg hover:opacity-90">Add Sub-Event</button>
                  <button onClick={() => setShowSubEventForm(false)} className="px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                </div>
              </div>
            )}

            {event.subEvents.length === 0 ? (
              <div className="text-center py-12 bg-card border border-card-border rounded-xl">
                <svg className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                </svg>
                <p className="text-sm text-muted-foreground">No schedule items yet</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">Add workshops, sessions, or dinners that happen within this event</p>
              </div>
            ) : (
              <div className="space-y-2">
                {event.subEvents.map((se: SubEventData) => (
                  <div key={se.id} className="bg-card border border-card-border rounded-xl p-3.5 flex items-start justify-between group hover:border-card-border/80 transition-colors">
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-foreground">{se.title}</span>
                          {se.type && <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded-md text-muted-foreground">{se.type}</span>}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {se.startDatetime && se.endDatetime ? `${se.startDatetime} - ${se.endDatetime}` : 'Time TBD'}
                          {se.location && ` · ${se.location}`}
                        </div>
                        {se.description && <div className="text-xs text-muted-foreground/70 mt-1">{se.description}</div>}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteSubEvent(se.id)}
                      className="p-1 rounded text-muted-foreground/40 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== ATTENDEES TAB ===== */}
        {activeTab === 'attendees' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">People ({event.attendees.length})</h3>
                <p className="text-xs text-muted-foreground">
                  Passes: {allocatedPasses}/{event.totalPasses || 0} allocated
                </p>
              </div>
              <button
                onClick={() => setShowAttendeeForm(!showAttendeeForm)}
                className="px-3 py-1.5 text-xs font-medium text-white bg-accent-purple-btn rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add Person
              </button>
            </div>

            {showAttendeeForm && (
              <div className="bg-card border border-accent/20 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input placeholder="Name *" className="px-3 py-2 text-sm bg-muted border border-card-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30" value={attendeeForm.name} onChange={(e) => setAttendeeForm({ ...attendeeForm, name: e.target.value })} />
                  <input placeholder="Email" className="px-3 py-2 text-sm bg-muted border border-card-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30" value={attendeeForm.email} onChange={(e) => setAttendeeForm({ ...attendeeForm, email: e.target.value })} />
                  <select className="px-3 py-2 text-sm bg-muted border border-card-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30" value={attendeeForm.attendeeType} onChange={(e) => setAttendeeForm({ ...attendeeForm, attendeeType: e.target.value as 'internal' | 'customer' })}>
                    <option value="internal">Internal</option>
                    <option value="customer">Customer</option>
                  </select>
                  <input placeholder="Role" className="px-3 py-2 text-sm bg-muted border border-card-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30" value={attendeeForm.role} onChange={(e) => setAttendeeForm({ ...attendeeForm, role: e.target.value })} />
                  <input placeholder="Company" className="px-3 py-2 text-sm bg-muted border border-card-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30" value={attendeeForm.company} onChange={(e) => setAttendeeForm({ ...attendeeForm, company: e.target.value })} />
                  <select className="px-3 py-2 text-sm bg-muted border border-card-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30" value={attendeeForm.travelStatus} onChange={(e) => setAttendeeForm({ ...attendeeForm, travelStatus: e.target.value })}>
                    <option value="not_booked">Not Booked</option>
                    <option value="booked">Booked</option>
                    <option value="confirmed">Confirmed</option>
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer">
                    <input type="checkbox" checked={attendeeForm.hasPass} onChange={(e) => setAttendeeForm({ ...attendeeForm, hasPass: e.target.checked })} className="rounded border-card-border" />
                    Has Pass
                  </label>
                  <button onClick={handleAddAttendee} className="px-4 py-1.5 text-xs font-medium text-white bg-accent rounded-lg hover:opacity-90">Add Person</button>
                  <button onClick={() => setShowAttendeeForm(false)} className="px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                </div>
              </div>
            )}

            {/* Internal Team */}
            {event.attendees.filter((a: AttendeeData) => a.attendeeType === 'internal').length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded bg-blue-500/10 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  </div>
                  Internal Team
                </h4>
                <div className="bg-card border border-card-border rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2.5 text-left text-muted-foreground font-medium">Name</th>
                        <th className="px-3 py-2.5 text-left text-muted-foreground font-medium">Role</th>
                        <th className="px-3 py-2.5 text-center text-muted-foreground font-medium">Pass</th>
                        <th className="px-3 py-2.5 text-left text-muted-foreground font-medium">Travel</th>
                        <th className="px-3 py-2.5 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-card-border/50">
                      {event.attendees.filter((a: AttendeeData) => a.attendeeType === 'internal').map((a: AttendeeData) => (
                        <tr key={a.id} className="hover:bg-muted/20 group">
                          <td className="px-3 py-2.5">
                            <div className="text-foreground font-medium">{a.name}</div>
                            {a.email && <div className="text-muted-foreground text-[10px]">{a.email}</div>}
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground">{a.role || '-'}</td>
                          <td className="px-3 py-2.5 text-center">
                            <button onClick={() => handleTogglePass(a.id, a.hasPass)} className={`w-5 h-5 rounded-md border ${a.hasPass ? 'bg-green-500 border-green-500 text-white' : 'border-card-border hover:border-accent/40'} flex items-center justify-center mx-auto transition-colors`}>
                              {a.hasPass && <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>}
                            </button>
                          </td>
                          <td className="px-3 py-2.5">
                            <select value={a.travelStatus || 'not_booked'} onChange={(e) => handleUpdateTravelStatus(a.id, e.target.value)} className="text-xs bg-transparent border border-card-border rounded-md px-1.5 py-0.5 text-foreground focus:outline-none focus:ring-1 focus:ring-accent/30">
                              <option value="not_booked">Not Booked</option>
                              <option value="booked">Booked</option>
                              <option value="confirmed">Confirmed</option>
                            </select>
                          </td>
                          <td className="px-3 py-2.5">
                            <button onClick={() => handleDeleteAttendee(a.id)} className="p-0.5 rounded text-muted-foreground/30 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
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
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded bg-purple-500/10 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                  </div>
                  Customers
                </h4>
                <div className="bg-card border border-card-border rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2.5 text-left text-muted-foreground font-medium">Name</th>
                        <th className="px-3 py-2.5 text-left text-muted-foreground font-medium">Company</th>
                        <th className="px-3 py-2.5 text-left text-muted-foreground font-medium">Role</th>
                        <th className="px-3 py-2.5 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-card-border/50">
                      {event.attendees.filter((a: AttendeeData) => a.attendeeType === 'customer').map((a: AttendeeData) => (
                        <tr key={a.id} className="hover:bg-muted/20 group">
                          <td className="px-3 py-2.5">
                            <div className="text-foreground font-medium">{a.name}</div>
                            {a.email && <div className="text-muted-foreground text-[10px]">{a.email}</div>}
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground">{a.company || '-'}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{a.role || '-'}</td>
                          <td className="px-3 py-2.5">
                            <button onClick={() => handleDeleteAttendee(a.id)} className="p-0.5 rounded text-muted-foreground/30 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {event.attendees.length === 0 && (
              <div className="text-center py-12 bg-card border border-card-border rounded-xl">
                <svg className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
                <p className="text-sm text-muted-foreground">No attendees added yet</p>
              </div>
            )}
          </div>
        )}

        {/* ===== CHECKLIST TAB ===== */}
        {activeTab === 'checklist' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Readiness Checklist</h3>
                <p className="text-xs text-muted-foreground">{checklistDone}/{checklistTotal} items complete</p>
              </div>
            </div>

            {/* Progress bar */}
            {checklistTotal > 0 && (
              <div className="bg-card border border-card-border rounded-xl p-3">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-muted-foreground">Overall Progress</span>
                  <span className={`font-semibold ${checklistPct === 100 ? 'text-green-500' : 'text-foreground'}`}>{Math.round(checklistPct)}%</span>
                </div>
                <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${checklistPct === 100 ? 'bg-green-500' : checklistPct >= 50 ? 'bg-amber-500' : 'bg-red-400'}`}
                    style={{ width: `${checklistPct}%` }}
                  />
                </div>
              </div>
            )}

            {/* Add item */}
            <div className="flex items-center gap-2">
              <input
                placeholder="Add checklist item..."
                className="flex-1 px-3 py-2 text-sm bg-card border border-card-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 placeholder:text-muted-foreground"
                value={newChecklistTitle}
                onChange={(e) => setNewChecklistTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddChecklistItem(); }}
              />
              <select
                className="px-3 py-2 text-sm bg-card border border-card-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
                value={newChecklistCategory}
                onChange={(e) => setNewChecklistCategory(e.target.value)}
              >
                <option value="">No category</option>
                {CHECKLIST_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
              <button
                onClick={handleAddChecklistItem}
                disabled={!newChecklistTitle.trim()}
                className="px-4 py-2 text-xs font-medium text-white bg-accent rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                Add
              </button>
            </div>

            {/* Grouped items */}
            {CHECKLIST_CATEGORIES.map((cat) => {
              const items = checklistByCategory[cat];
              if (items.length === 0) return null;
              const catDone = items.filter((i: ChecklistItemData) => i.isDone).length;
              return (
                <div key={cat} className="bg-card border border-card-border rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-foreground capitalize">{cat}</h4>
                    <span className="text-[10px] text-muted-foreground">{catDone}/{items.length}</span>
                  </div>
                  <div className="space-y-1">
                    {items.map((item: ChecklistItemData) => (
                      <div key={item.id} className="flex items-center gap-2.5 group py-1">
                        <button
                          onClick={() => handleToggleChecklist(item.id, item.isDone)}
                          className={`w-5 h-5 rounded-md border flex-shrink-0 flex items-center justify-center transition-colors ${item.isDone ? 'bg-green-500 border-green-500 text-white' : 'border-card-border hover:border-accent/40'}`}
                        >
                          {item.isDone && <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>}
                        </button>
                        <span className={`text-sm flex-1 ${item.isDone ? 'line-through text-muted-foreground/50' : 'text-foreground'}`}>{item.title}</span>
                        {item.dueDate && <span className="text-[10px] text-muted-foreground">{formatDate(item.dueDate)}</span>}
                        <button onClick={() => handleDeleteChecklistItem(item.id)} className="p-0.5 rounded text-muted-foreground/30 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {uncategorized.length > 0 && (
              <div className="bg-card border border-card-border rounded-xl p-3">
                <h4 className="text-xs font-semibold text-foreground mb-2">Other</h4>
                <div className="space-y-1">
                  {uncategorized.map((item: ChecklistItemData) => (
                    <div key={item.id} className="flex items-center gap-2.5 group py-1">
                      <button
                        onClick={() => handleToggleChecklist(item.id, item.isDone)}
                        className={`w-5 h-5 rounded-md border flex-shrink-0 flex items-center justify-center transition-colors ${item.isDone ? 'bg-green-500 border-green-500 text-white' : 'border-card-border hover:border-accent/40'}`}
                      >
                        {item.isDone && <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>}
                      </button>
                      <span className={`text-sm flex-1 ${item.isDone ? 'line-through text-muted-foreground/50' : 'text-foreground'}`}>{item.title}</span>
                      <button onClick={() => handleDeleteChecklistItem(item.id)} className="p-0.5 rounded text-muted-foreground/30 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {checklistTotal === 0 && (
              <div className="text-center py-12 bg-card border border-card-border rounded-xl">
                <svg className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-muted-foreground">No checklist items yet</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">Track readiness with logistics, materials, and comms checklists</p>
              </div>
            )}
          </div>
        )}

        {/* ===== COMPARISON TAB ===== */}
        {activeTab === 'comparison' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Year-over-Year Comparison</h3>
              <p className="text-xs text-muted-foreground">Compare this event against its prior year version</p>
            </div>
            {event.priorEvent ? (
              <div className="bg-card border border-card-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Metric</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">{event.priorEvent.title}</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-foreground">{event.title}</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-card-border/50">
                    {[
                      { label: 'Planned Cost', prior: num(event.priorEvent.cost), current: num(event.cost), format: 'currency' as const },
                      { label: 'Actual Cost', prior: num(event.priorEvent.actualCost), current: num(event.actualCost), format: 'currency' as const },
                      { label: 'Attendees', prior: event.priorEvent.attendeeCount, current: event.attendees.length, format: 'number' as const },
                      { label: 'Sub-Events', prior: event.priorEvent.subEventCount, current: event.subEvents.length, format: 'number' as const },
                      { label: 'Expected SAOs', prior: num(event.priorEvent.expectedSaos), current: num(event.expectedSaos), format: 'number' as const },
                      { label: 'Actual SAOs', prior: num(event.priorEvent.actualSaos), current: num(event.actualSaos), format: 'number' as const },
                      { label: 'Pipeline', prior: num(event.priorEvent.pipelineGenerated), current: num(event.pipelineGenerated), format: 'currency' as const },
                    ].map((row) => {
                      const change = row.current - row.prior;
                      const changePct = row.prior > 0 ? ((change / row.prior) * 100).toFixed(1) : null;
                      return (
                        <tr key={row.label}>
                          <td className="px-4 py-3 text-foreground">{row.label}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">
                            {row.format === 'currency' ? formatCurrency(row.prior) : row.prior}
                          </td>
                          <td className="px-4 py-3 text-right text-foreground tabular-nums font-medium">
                            {row.format === 'currency' ? formatCurrency(row.current) : row.current}
                          </td>
                          <td className={`px-4 py-3 text-right tabular-nums font-medium ${change > 0 ? 'text-green-500' : change < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                            {change > 0 ? '+' : ''}{row.format === 'currency' ? formatCurrency(change) : change}
                            {changePct && <span className="text-xs ml-1 opacity-70">({changePct}%)</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 bg-card border border-card-border rounded-xl">
                <svg className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
                <p className="text-sm text-muted-foreground">No prior event linked</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">Link a prior event in the Overview tab to enable YoY comparison</p>
              </div>
            )}
          </div>
        )}

        {/* ===== ACTIONS TAB ===== */}
        {activeTab === 'actions' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Logistics Deck */}
            <div className="bg-card border border-card-border rounded-xl p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">Logistics Deck</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Generate a PPTX with event overview, schedule, attendees, and checklist.
                  </p>
                  <button
                    onClick={handleGenerateLogisticsDeck}
                    className="px-4 py-2 text-xs font-medium text-white bg-blue-500 rounded-lg hover:opacity-90 transition-opacity"
                  >
                    Download PPTX
                  </button>
                </div>
              </div>
            </div>

            {/* Slack Notifications */}
            <div className="bg-card border border-card-border rounded-xl p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-foreground mb-1">Slack</h3>
                  <p className="text-xs text-muted-foreground mb-3">Send notifications to your team channel.</p>
                  <div className="space-y-2">
                    <button
                      onClick={() => handleSendSlackUpdate('status_update')}
                      disabled={slackSending}
                      className="px-3 py-1.5 text-xs border border-card-border rounded-lg hover:bg-muted transition-colors text-foreground disabled:opacity-50"
                    >
                      Send Status Update
                    </button>
                    <div className="flex items-center gap-2">
                      <input
                        placeholder="Custom message..."
                        className="flex-1 px-2.5 py-1.5 text-xs bg-muted border border-card-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-accent/30"
                        value={slackMessage}
                        onChange={(e) => setSlackMessage(e.target.value)}
                      />
                      <button
                        onClick={() => handleSendSlackUpdate('custom')}
                        disabled={slackSending || !slackMessage.trim()}
                        className="px-3 py-1.5 text-xs text-white bg-purple-500 rounded-lg hover:opacity-90 disabled:opacity-40"
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

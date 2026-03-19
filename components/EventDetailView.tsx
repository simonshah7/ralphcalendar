'use client';

import React, { useState, useEffect, useCallback, ReactNode } from 'react';
import { Status, Campaign } from '@/db/schema';
import { formatCurrency, formatDate } from '@/lib/utils';
import PptxGenJS from 'pptxgenjs';
import { generateEventRoiDeck } from '@/lib/pptx/eventRoiDeck';
import {
  SolarAltArrowLeft,
  SolarCalendarLinear,
  SolarMapPointLinear,
  SolarTrashBinLinear,
  SolarClockCircle,
  SolarHomeLinear,
  SolarListLinear,
  SolarUsersGroupRounded,
  SolarCheckCircle,
  SolarChartLinear,
  SolarSettingsLinear,
  SolarAddLinear,
  SolarCloseLinear,
  SolarCheckLinear,
  SolarDownloadLinear,
  SolarChatSquareLinear,
  SolarPenLinear,
} from '@/components/SolarIcons';

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
        <SolarPenLinear className="w-3 h-3 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
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
      pptx.author = 'LaunchGrid';
      pptx.company = 'LaunchGrid';

      // Brand constants
      const B = {
        forestBlack: '082029', teal: '006170', turquoise: '34E5E2',
        white: 'FFFFFF', navyMid: '0E2E38', lightGrey: 'F2F2F2',
        lightTeal: 'EBF5F3', textMuted: '7C9AA3', textDim: '8FB3BB',
        red: 'E24650',
      };
      const headFont = 'Archivo';
      const bodyFont = 'Roboto';

      // Slide 1: Title (Forest Black bg, Pattern A)
      const slide1 = pptx.addSlide();
      slide1.background = { color: B.forestBlack };
      slide1.addShape('rect' as PptxGenJS.ShapeType, { x: 0, y: 0, w: '100%', h: 0.04, fill: { color: B.turquoise } });
      slide1.addText(data.event.title, { x: 0.8, y: 1.5, w: '80%', fontSize: 42, bold: true, color: B.white, fontFace: headFont, charSpacing: -1, shadow: { type: 'none' } as any });
      slide1.addText(`${data.event.startDate} - ${data.event.endDate}`, { x: 0.8, y: 3.2, w: '80%', fontSize: 18, color: B.turquoise, fontFace: headFont, shadow: { type: 'none' } as any });
      slide1.addText(data.event.location || 'Location TBD', { x: 0.8, y: 3.8, w: '80%', fontSize: 14, color: B.textDim, fontFace: bodyFont, shadow: { type: 'none' } as any });
      slide1.addText(`Status: ${data.event.statusName || 'N/A'}`, { x: 0.8, y: 4.2, w: '80%', fontSize: 12, color: B.textDim, fontFace: bodyFont, shadow: { type: 'none' } as any });
      slide1.addShape('rect' as PptxGenJS.ShapeType, { x: 0, y: 6.6, w: '100%', h: 0.65, fill: { color: B.navyMid } });
      slide1.addText('Redwood', { x: 0.5, y: 6.85, w: 1.5, h: 0.3, fontSize: 11, fontFace: headFont, bold: true, color: B.white, shadow: { type: 'none' } as any });

      // Slide 2: Overview (White bg, Pattern C)
      const slide2 = pptx.addSlide();
      slide2.background = { color: B.white };
      slide2.addText('Event overview', { x: 0.5, y: 0.5, w: '90%', fontSize: 36, bold: true, color: B.forestBlack, fontFace: headFont, charSpacing: -1, shadow: { type: 'none' } as any });
      const overviewRows: string[][] = [
        ['Metric', 'Value'],
        ['Passes', `${data.passAllocation.allocated}/${data.passAllocation.total} allocated`],
        ['Internal Attendees', String(data.attendees.internal.length)],
        ['Customer Attendees', String(data.attendees.customers.length)],
        ['Sub-Events', String(data.subEvents.length)],
        ['Checklist', `${data.checklist.filter((c: ChecklistItemData) => c.isDone).length}/${data.checklist.length} complete`],
        ['Budget', formatCurrency(num(data.event.cost))],
      ];
      const headerRow2 = overviewRows[0].map((cell: string) => ({ text: cell, options: { bold: true, color: B.white, fill: { color: B.teal }, fontSize: 11, fontFace: headFont, shadow: { type: 'none' } as any } }));
      const dataRows2 = overviewRows.slice(1).map((row: string[], ri: number) => row.map((cell: string) => ({ text: cell, options: { fontSize: 11, color: B.forestBlack, fontFace: bodyFont, fill: { color: ri % 2 === 0 ? B.white : B.lightGrey }, shadow: { type: 'none' } as any } })));
      slide2.addTable([headerRow2, ...dataRows2], { x: 0.5, y: 1.4, w: 8, fontSize: 11, border: { type: 'solid', pt: 0.5, color: B.lightTeal } });
      slide2.addText('Redwood', { x: 0.5, y: 6.85, w: 1.5, h: 0.3, fontSize: 11, fontFace: headFont, bold: true, color: B.forestBlack, shadow: { type: 'none' } as any });

      if (data.subEvents.length > 0) {
        const slide3 = pptx.addSlide();
        slide3.background = { color: B.white };
        slide3.addText('Schedule / sub-events', { x: 0.5, y: 0.5, w: '90%', fontSize: 36, bold: true, color: B.forestBlack, fontFace: headFont, charSpacing: -1, shadow: { type: 'none' } as any });
        const subHeaders = ['Title', 'Type', 'Time', 'Location'];
        const subHeaderRow = subHeaders.map((h: string) => ({ text: h, options: { bold: true, color: B.white, fill: { color: B.teal }, fontSize: 10, fontFace: headFont, shadow: { type: 'none' } as any } }));
        const subDataRows = data.subEvents.map((se: SubEventData, ri: number) =>
          [se.title, se.type || '-', `${se.startDatetime} - ${se.endDatetime}`, se.location || '-'].map((cell: string) => ({ text: cell, options: { fontSize: 10, color: B.forestBlack, fontFace: bodyFont, fill: { color: ri % 2 === 0 ? B.white : B.lightGrey }, shadow: { type: 'none' } as any } }))
        );
        slide3.addTable([subHeaderRow, ...subDataRows], { x: 0.5, y: 1.4, w: 12, fontSize: 10, border: { type: 'solid', pt: 0.5, color: B.lightTeal } });
        slide3.addText('Redwood', { x: 0.5, y: 6.85, w: 1.5, h: 0.3, fontSize: 11, fontFace: headFont, bold: true, color: B.forestBlack, shadow: { type: 'none' } as any });
      }

      if (data.attendees.internal.length > 0 || data.attendees.customers.length > 0) {
        const slide4 = pptx.addSlide();
        slide4.background = { color: B.white };
        slide4.addText('Attendees', { x: 0.5, y: 0.5, w: '90%', fontSize: 36, bold: true, color: B.forestBlack, fontFace: headFont, charSpacing: -1, shadow: { type: 'none' } as any });
        const attHeaders = ['Name', 'Type', 'Role', 'Company', 'Pass', 'Travel'];
        const attHeaderRow = attHeaders.map((h: string) => ({ text: h, options: { bold: true, color: B.white, fill: { color: B.teal }, fontSize: 10, fontFace: headFont, shadow: { type: 'none' } as any } }));
        const attDataRows = [...data.attendees.internal, ...data.attendees.customers].map((a: AttendeeData, ri: number) =>
          [a.name, a.attendeeType, a.role || '-', a.company || '-', a.hasPass ? 'Yes' : 'No', a.travelStatus || '-'].map((cell: string) => ({ text: cell, options: { fontSize: 10, color: B.forestBlack, fontFace: bodyFont, fill: { color: ri % 2 === 0 ? B.white : B.lightGrey }, shadow: { type: 'none' } as any } }))
        );
        slide4.addTable([attHeaderRow, ...attDataRows], { x: 0.5, y: 1.4, w: 12, fontSize: 10, border: { type: 'solid', pt: 0.5, color: B.lightTeal } });
        slide4.addText('Redwood', { x: 0.5, y: 6.85, w: 1.5, h: 0.3, fontSize: 11, fontFace: headFont, bold: true, color: B.forestBlack, shadow: { type: 'none' } as any });
      }

      await pptx.writeFile({ fileName: `${data.event.title.replace(/[^a-zA-Z0-9]/g, '_')}_Logistics.pptx` });
    } catch (error) {
      console.error('Error generating logistics deck:', error);
      alert('Failed to generate logistics deck');
    }
  };

  const [exportingRoi, setExportingRoi] = useState(false);

  const handleGenerateRoiDeck = async () => {
    setExportingRoi(true);
    try {
      const res = await fetch(`/api/reports/event-roi?eventId=${eventId}`);
      if (!res.ok) throw new Error('Failed to fetch event ROI data');
      const data = await res.json();
      await generateEventRoiDeck(data);
    } catch (error) {
      console.error('Error generating ROI deck:', error);
      alert('Failed to generate event ROI report');
    }
    setExportingRoi(false);
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

  const tabs: { key: TabType; label: string; count?: number; icon: ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <SolarHomeLinear className="w-3.5 h-3.5" /> },
    { key: 'sub-events', label: 'Schedule', count: event.subEvents.length, icon: <SolarListLinear className="w-3.5 h-3.5" /> },
    { key: 'attendees', label: 'People', count: event.attendees.length, icon: <SolarUsersGroupRounded className="w-3.5 h-3.5" /> },
    { key: 'checklist', label: 'Checklist', count: checklistTotal, icon: <SolarCheckCircle className="w-3.5 h-3.5" /> },
    { key: 'comparison', label: 'Compare', icon: <SolarChartLinear className="w-3.5 h-3.5" /> },
    { key: 'actions', label: 'Actions', icon: <SolarSettingsLinear className="w-3.5 h-3.5" /> },
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
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
          <button
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <SolarAltArrowLeft className="w-4 h-4" />
            Events
          </button>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-foreground font-medium truncate">{event.title}</span>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-muted-foreground capitalize">{activeTab === 'sub-events' ? 'Schedule' : activeTab === 'overview' ? 'Overview' : activeTab === 'attendees' ? 'People' : activeTab === 'checklist' ? 'Checklist' : activeTab === 'comparison' ? 'Compare' : 'Actions'}</span>
        </nav>

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
                <SolarCalendarLinear className="w-3.5 h-3.5" />
                {formatDate(event.startDate)} - {formatDate(event.endDate)}
              </span>
              {event.location && (
                <span className="flex items-center gap-1">
                  <SolarMapPointLinear className="w-3.5 h-3.5" />
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
            <SolarTrashBinLinear className="w-4 h-4" />
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
              {tab.icon}
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
                <SolarAddLinear className="w-3.5 h-3.5" />
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
                <SolarListLinear className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No schedule items yet</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">Add workshops, sessions, or dinners that happen within this event</p>
              </div>
            ) : (
              <div className="space-y-2">
                {event.subEvents.map((se: SubEventData) => (
                  <div key={se.id} className="bg-card border border-card-border rounded-xl p-3.5 flex items-start justify-between group hover:border-card-border/80 transition-colors">
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <SolarClockCircle className="w-4 h-4 text-accent" />
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
                      <SolarTrashBinLinear className="w-3.5 h-3.5" />
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
                <SolarAddLinear className="w-3.5 h-3.5" />
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
                              {a.hasPass && <SolarCheckLinear className="w-3 h-3" />}
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
                              <SolarCloseLinear className="w-3.5 h-3.5" />
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
                              <SolarCloseLinear className="w-3.5 h-3.5" />
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
                <SolarUsersGroupRounded className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
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
                          {item.isDone && <SolarCheckLinear className="w-3 h-3" />}
                        </button>
                        <span className={`text-sm flex-1 ${item.isDone ? 'line-through text-muted-foreground/50' : 'text-foreground'}`}>{item.title}</span>
                        {item.dueDate && <span className="text-[10px] text-muted-foreground">{formatDate(item.dueDate)}</span>}
                        <button onClick={() => handleDeleteChecklistItem(item.id)} className="p-0.5 rounded text-muted-foreground/30 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                          <SolarCloseLinear className="w-3.5 h-3.5" />
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
                        {item.isDone && <SolarCheckLinear className="w-3 h-3" />}
                      </button>
                      <span className={`text-sm flex-1 ${item.isDone ? 'line-through text-muted-foreground/50' : 'text-foreground'}`}>{item.title}</span>
                      <button onClick={() => handleDeleteChecklistItem(item.id)} className="p-0.5 rounded text-muted-foreground/30 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                        <SolarCloseLinear className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {checklistTotal === 0 && (
              <div className="text-center py-12 bg-card border border-card-border rounded-xl">
                <SolarCheckCircle className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
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
                <SolarChartLinear className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
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
                  <SolarDownloadLinear className="w-5 h-5 text-blue-500" />
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

            {/* Event ROI Report */}
            <div className="bg-card border border-card-border rounded-xl p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0">
                  <SolarChartLinear className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">ROI Report</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Generate a PPTX with financial summary, attendee analysis, and YoY comparison.
                  </p>
                  <button
                    onClick={handleGenerateRoiDeck}
                    disabled={exportingRoi}
                    className="px-4 py-2 text-xs font-medium text-white bg-green-500 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {exportingRoi ? 'Generating...' : 'Download PPTX'}
                  </button>
                </div>
              </div>
            </div>

            {/* Slack Notifications */}
            <div className="bg-card border border-card-border rounded-xl p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                  <SolarChatSquareLinear className="w-5 h-5 text-purple-500" />
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

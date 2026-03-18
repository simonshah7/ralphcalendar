'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Status, Campaign } from '@/db/schema';
import { formatCurrency, formatDate } from '@/lib/utils';

export interface EventListItem {
  id: string;
  title: string;
  seriesName: string | null;
  startDate: string;
  endDate: string;
  location: string | null;
  venue: string | null;
  statusId: string | null;
  totalPasses: number | null;
  cost: string | null;
  actualCost: string | null;
  currency: string | null;
  region: string | null;
  description: string | null;
  attendeeCount: number;
  internalCount: number;
  customerCount: number;
  allocatedPasses: number;
  subEventCount: number;
  checklistTotal: number;
  checklistDone: number;
  campaignIds: string[];
}

interface EventsListViewProps {
  events: EventListItem[];
  statuses: Status[];
  campaigns: Campaign[];
  onEventClick: (eventId: string) => void;
  onCreateEvent: () => void;
}

type SortField = 'title' | 'startDate' | 'status' | 'checklist' | 'attendees' | 'cost';
type SortDir = 'asc' | 'desc';

function num(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
}

export function EventsListView({ events, statuses, campaigns, onEventClick, onCreateEvent }: EventsListViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('startDate');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const statusMap = useMemo(() => new Map(statuses.map((s) => [s.id, s])), [statuses]);
  const campaignMap = useMemo(() => new Map(campaigns.map((c) => [c.id, c])), [campaigns]);

  const filtered = useMemo(() => {
    let items = events;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.location?.toLowerCase().includes(q) ||
          e.seriesName?.toLowerCase().includes(q)
      );
    }
    if (statusFilter) {
      items = items.filter((e) => e.statusId === statusFilter);
    }
    return items;
  }, [events, searchQuery, statusFilter]);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    rows.sort((a, b) => {
      let va: number | string = 0;
      let vb: number | string = 0;
      switch (sortField) {
        case 'title':
          va = a.title.toLowerCase();
          vb = b.title.toLowerCase();
          break;
        case 'startDate':
          va = a.startDate;
          vb = b.startDate;
          break;
        case 'status': {
          const sa = a.statusId ? statusMap.get(a.statusId)?.name || '' : '';
          const sb = b.statusId ? statusMap.get(b.statusId)?.name || '' : '';
          va = sa.toLowerCase();
          vb = sb.toLowerCase();
          break;
        }
        case 'checklist':
          va = a.checklistTotal > 0 ? a.checklistDone / a.checklistTotal : 0;
          vb = b.checklistTotal > 0 ? b.checklistDone / b.checklistTotal : 0;
          break;
        case 'attendees':
          va = a.attendeeCount;
          vb = b.attendeeCount;
          break;
        case 'cost':
          va = num(a.cost);
          vb = num(b.cost);
          break;
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [filtered, sortField, sortDir, statusMap]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  const today = new Date().toISOString().split('T')[0];

  // Summary stats
  const totalEvents = events.length;
  const upcomingEvents = events.filter((e) => e.startDate > today).length;
  const activeEvents = events.filter((e) => e.startDate <= today && e.endDate >= today).length;
  const totalCost = events.reduce((s, e) => s + num(e.cost), 0);

  return (
    <div className="p-4 space-y-4 max-w-[1400px] mx-auto">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-card-border rounded-lg p-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Total Events</div>
          <div className="text-2xl font-bold text-foreground">{totalEvents}</div>
        </div>
        <div className="bg-card border border-card-border rounded-lg p-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Active Now</div>
          <div className="text-2xl font-bold text-green-500">{activeEvents}</div>
        </div>
        <div className="bg-card border border-card-border rounded-lg p-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Upcoming</div>
          <div className="text-2xl font-bold text-blue-500">{upcomingEvents}</div>
        </div>
        <div className="bg-card border border-card-border rounded-lg p-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Total Budget</div>
          <div className="text-2xl font-bold text-foreground">{formatCurrency(totalCost)}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search events..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-3 py-1.5 text-sm bg-card border border-card-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring w-64"
        />
        <select
          value={statusFilter || ''}
          onChange={(e) => setStatusFilter(e.target.value || null)}
          className="px-3 py-1.5 text-sm bg-card border border-card-border rounded-lg text-foreground"
        >
          <option value="">All Statuses</option>
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <div className="ml-auto">
          <button
            onClick={onCreateEvent}
            className="px-4 py-2 text-sm font-medium text-white bg-accent-purple-btn rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Event
          </button>
        </div>
      </div>

      {/* Events Table */}
      {sorted.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
          </div>
          <p className="text-sm text-muted-foreground mb-4">No events yet. Create your first event to get started.</p>
          <button
            onClick={onCreateEvent}
            className="px-4 py-2 text-sm font-medium text-white bg-accent rounded-lg hover:bg-accent-hover transition-colors"
          >
            Create Event
          </button>
        </div>
      ) : (
        <div className="bg-card border border-card-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <SortHeader field="title" current={sortField} dir={sortDir} onSort={handleSort}>Event</SortHeader>
                  <SortHeader field="startDate" current={sortField} dir={sortDir} onSort={handleSort}>Dates</SortHeader>
                  <SortHeader field="status" current={sortField} dir={sortDir} onSort={handleSort}>Status</SortHeader>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Campaigns</th>
                  <SortHeader field="checklist" current={sortField} dir={sortDir} onSort={handleSort} align="center">Readiness</SortHeader>
                  <SortHeader field="attendees" current={sortField} dir={sortDir} onSort={handleSort} align="right">Attendees</SortHeader>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">Passes</th>
                  <SortHeader field="cost" current={sortField} dir={sortDir} onSort={handleSort} align="right">Cost</SortHeader>
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border">
                {sorted.map((event, idx) => {
                  const status = event.statusId ? statusMap.get(event.statusId) : null;
                  const isActive = event.startDate <= today && event.endDate >= today;
                  const isPast = event.endDate < today;
                  const checklistPct = event.checklistTotal > 0 ? (event.checklistDone / event.checklistTotal) * 100 : 0;

                  return (
                    <tr
                      key={event.id}
                      className={`hover:bg-muted/30 transition-colors cursor-pointer ${idx % 2 === 1 ? 'bg-muted/15' : ''}`}
                      onClick={() => onEventClick(event.id)}
                    >
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          {isActive && (
                            <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" title="Active now" />
                          )}
                          {isPast && (
                            <span className="w-2 h-2 rounded-full bg-gray-400 flex-shrink-0" title="Past" />
                          )}
                          <div>
                            <div className="font-medium text-foreground">{event.title}</div>
                            {event.location && (
                              <div className="text-xs text-muted-foreground">{event.location}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground whitespace-nowrap text-xs">
                        {formatDate(event.startDate)} - {formatDate(event.endDate)}
                      </td>
                      <td className="px-3 py-3">
                        {status && (
                          <span
                            className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium"
                            style={{
                              backgroundColor: `${status.color}20`,
                              color: status.color,
                            }}
                          >
                            {status.name}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {event.campaignIds.slice(0, 2).map((cid) => {
                            const camp = campaignMap.get(cid);
                            return camp ? (
                              <span key={cid} className="inline-flex px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground">
                                {camp.name}
                              </span>
                            ) : null;
                          })}
                          {event.campaignIds.length > 2 && (
                            <span className="text-[10px] text-muted-foreground">+{event.campaignIds.length - 2}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {event.checklistTotal > 0 ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${checklistPct === 100 ? 'bg-green-500' : checklistPct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                style={{ width: `${checklistPct}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {event.checklistDone}/{event.checklistTotal}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                        <span className="text-xs">{event.attendeeCount}</span>
                        <span className="text-[10px] text-muted-foreground/60 ml-1">
                          ({event.internalCount}i + {event.customerCount}c)
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-xs text-muted-foreground">
                        {event.allocatedPasses}/{event.totalPasses || 0}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                        {formatCurrency(num(event.cost))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SortHeader({
  field,
  current,
  dir,
  onSort,
  children,
  align = 'left',
}: {
  field: SortField;
  current: SortField;
  dir: SortDir;
  onSort: (f: SortField) => void;
  children: React.ReactNode;
  align?: 'left' | 'right' | 'center';
}) {
  const active = current === field;
  const textAlign = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return (
    <th
      className={`px-3 py-2.5 ${textAlign} text-xs font-medium text-muted-foreground uppercase tracking-wide cursor-pointer hover:text-foreground select-none whitespace-nowrap`}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {active && <span className="text-[8px]">{dir === 'asc' ? '\u25B2' : '\u25BC'}</span>}
      </span>
    </th>
  );
}

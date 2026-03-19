'use client';

import { useState, useMemo } from 'react';
import { Status, Campaign } from '@/db/schema';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  SolarAddLinear,
  SolarCalendarLinear,
  SolarMapPointLinear,
  SolarUsersGroupRounded,
  SolarListLinear,
  SolarTicketLinear,
  SolarMagniferLinear,
  SolarWidgetLinear,
  SolarDollarCircle,
} from '@/components/SolarIcons';

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

type ViewMode = 'cards' | 'table';
type FilterTab = 'all' | 'active' | 'upcoming' | 'past';

function num(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
}

function getDaysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getEventTimeStatus(event: EventListItem): 'active' | 'upcoming' | 'past' {
  const today = new Date().toISOString().split('T')[0];
  if (event.startDate <= today && event.endDate >= today) return 'active';
  if (event.startDate > today) return 'upcoming';
  return 'past';
}

export function EventsListView({ events, statuses, campaigns, onEventClick, onCreateEvent }: EventsListViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('cards');

  const statusMap = useMemo(() => new Map(statuses.map((s) => [s.id, s])), [statuses]);
  const campaignMap = useMemo(() => new Map(campaigns.map((c) => [c.id, c])), [campaigns]);

  const today = new Date().toISOString().split('T')[0];

  // Counts for filter tabs
  const counts = useMemo(() => {
    const all = events.length;
    const active = events.filter((e) => e.startDate <= today && e.endDate >= today).length;
    const upcoming = events.filter((e) => e.startDate > today).length;
    const past = events.filter((e) => e.endDate < today).length;
    return { all, active, upcoming, past };
  }, [events, today]);

  const filtered = useMemo(() => {
    let items = events;

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.location?.toLowerCase().includes(q) ||
          e.seriesName?.toLowerCase().includes(q) ||
          e.venue?.toLowerCase().includes(q)
      );
    }

    // Time filter
    if (filterTab === 'active') {
      items = items.filter((e) => e.startDate <= today && e.endDate >= today);
    } else if (filterTab === 'upcoming') {
      items = items.filter((e) => e.startDate > today);
    } else if (filterTab === 'past') {
      items = items.filter((e) => e.endDate < today);
    }

    // Sort: active first, then upcoming by date, then past
    return [...items].sort((a, b) => {
      const aStatus = getEventTimeStatus(a);
      const bStatus = getEventTimeStatus(b);
      const order = { active: 0, upcoming: 1, past: 2 };
      if (order[aStatus] !== order[bStatus]) return order[aStatus] - order[bStatus];
      return a.startDate.localeCompare(b.startDate);
    });
  }, [events, searchQuery, filterTab, today]);

  // Summary stats
  const totalCost = events.reduce((s, e) => s + num(e.cost), 0);
  const totalAttendees = events.reduce((s, e) => s + e.attendeeCount, 0);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1400px] mx-auto">
      {/* Header Section */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Events</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage conferences, trade shows, and sponsored events
          </p>
        </div>
        <button
          onClick={onCreateEvent}
          className="px-4 py-2.5 text-sm font-medium text-white bg-accent-purple-btn rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2 shadow-sm"
        >
          <SolarAddLinear className="w-4 h-4" />
          New Event
        </button>
      </div>

      {/* Summary Stats - compact and informative */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-card-border rounded-xl p-3.5">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <SolarCalendarLinear className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Total</span>
          </div>
          <div className="text-2xl font-bold text-foreground">{events.length}</div>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-3.5">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-green-500/10 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            </div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Active</span>
          </div>
          <div className="text-2xl font-bold text-green-500">{counts.active}</div>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-3.5">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <SolarUsersGroupRounded className="w-3.5 h-3.5 text-purple-500" />
            </div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Attendees</span>
          </div>
          <div className="text-2xl font-bold text-foreground">{totalAttendees}</div>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-3.5">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <SolarDollarCircle className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Budget</span>
          </div>
          <div className="text-2xl font-bold text-foreground">{formatCurrency(totalCost)}</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Filter tabs */}
        <div className="flex bg-muted rounded-lg p-0.5">
          {([
            { key: 'all' as FilterTab, label: 'All', count: counts.all },
            { key: 'active' as FilterTab, label: 'Active', count: counts.active },
            { key: 'upcoming' as FilterTab, label: 'Upcoming', count: counts.upcoming },
            { key: 'past' as FilterTab, label: 'Past', count: counts.past },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterTab(tab.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filterTab === tab.key
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
              <span className="ml-1 opacity-60">{tab.count}</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <SolarMagniferLinear className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-card border border-card-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* View toggle */}
        <div className="flex bg-muted rounded-lg p-0.5 ml-auto">
          <button
            onClick={() => setViewMode('cards')}
            className={`p-1.5 rounded-md transition-colors ${viewMode === 'cards' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
            title="Card view"
          >
            <SolarWidgetLinear className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
            title="Table view"
          >
            <SolarListLinear className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <SolarCalendarLinear className="w-8 h-8 text-accent/60" />
          </div>
          {events.length === 0 ? (
            <>
              <h3 className="text-base font-semibold text-foreground mb-1">No events yet</h3>
              <p className="text-sm text-muted-foreground mb-5 max-w-sm mx-auto">
                Create your first event to start tracking conferences, trade shows, and sponsored dinners. You can also drag on the Timeline to quickly create events.
              </p>
              <button
                onClick={onCreateEvent}
                className="px-5 py-2.5 text-sm font-medium text-white bg-accent-purple-btn rounded-xl hover:opacity-90 transition-opacity shadow-sm"
              >
                Create Your First Event
              </button>
            </>
          ) : (
            <>
              <h3 className="text-base font-semibold text-foreground mb-1">No matching events</h3>
              <p className="text-sm text-muted-foreground">Try adjusting your search or filter.</p>
            </>
          )}
        </div>
      ) : viewMode === 'cards' ? (
        /* Card View */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((event) => {
            const timeStatus = getEventTimeStatus(event);
            const status = event.statusId ? statusMap.get(event.statusId) : null;
            const checklistPct = event.checklistTotal > 0 ? (event.checklistDone / event.checklistTotal) * 100 : 0;
            const daysInfo = timeStatus === 'upcoming' ? getDaysUntil(event.startDate) : timeStatus === 'active' ? getDaysUntil(event.endDate) : 0;

            return (
              <div
                key={event.id}
                onClick={() => onEventClick(event.id)}
                className="bg-card border border-card-border rounded-xl p-4 cursor-pointer hover:border-accent/30 hover:shadow-md transition-all group"
              >
                {/* Card Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-foreground truncate group-hover:text-accent transition-colors">
                      {event.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      {event.location && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <SolarMapPointLinear className="w-3 h-3" />
                          {event.location}
                        </span>
                      )}
                      {event.seriesName && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded-md text-muted-foreground">{event.seriesName}</span>
                      )}
                    </div>
                  </div>

                  {/* Time Status Badge */}
                  {timeStatus === 'active' && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/10 text-green-500 flex-shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      Live
                    </span>
                  )}
                  {timeStatus === 'upcoming' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-500 flex-shrink-0">
                      {daysInfo <= 7 ? `${daysInfo}d away` : `${formatDate(event.startDate)}`}
                    </span>
                  )}
                  {timeStatus === 'past' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground flex-shrink-0">
                      Ended
                    </span>
                  )}
                </div>

                {/* Date Row */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                  <SolarCalendarLinear className="w-3.5 h-3.5" />
                  {formatDate(event.startDate)} - {formatDate(event.endDate)}
                </div>

                {/* Status & Campaigns */}
                <div className="flex items-center gap-1.5 flex-wrap mb-3">
                  {status && (
                    <span
                      className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium"
                      style={{
                        backgroundColor: `${status.color}15`,
                        color: status.color,
                      }}
                    >
                      {status.name}
                    </span>
                  )}
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

                {/* Readiness Progress */}
                {event.checklistTotal > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span className="text-muted-foreground">Readiness</span>
                      <span className={`font-medium ${checklistPct === 100 ? 'text-green-500' : 'text-muted-foreground'}`}>
                        {Math.round(checklistPct)}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${checklistPct === 100 ? 'bg-green-500' : checklistPct >= 50 ? 'bg-amber-500' : 'bg-red-400'}`}
                        style={{ width: `${checklistPct}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Bottom Stats */}
                <div className="flex items-center gap-4 pt-2 border-t border-card-border/50">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground" title="Attendees">
                    <SolarUsersGroupRounded className="w-3.5 h-3.5" />
                    <span className="tabular-nums">{event.attendeeCount}</span>
                  </div>
                  {event.subEventCount > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground" title="Sub-events">
                      <SolarListLinear className="w-3.5 h-3.5" />
                      <span className="tabular-nums">{event.subEventCount}</span>
                    </div>
                  )}
                  {(event.totalPasses ?? 0) > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground" title="Passes allocated">
                      <SolarTicketLinear className="w-3.5 h-3.5" />
                      <span className="tabular-nums">{event.allocatedPasses}/{event.totalPasses}</span>
                    </div>
                  )}
                  <div className="ml-auto text-xs font-medium text-foreground tabular-nums">
                    {formatCurrency(num(event.cost))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Event</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Dates</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide">Readiness</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">Attendees</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border">
                {filtered.map((event) => {
                  const timeStatus = getEventTimeStatus(event);
                  const status = event.statusId ? statusMap.get(event.statusId) : null;
                  const checklistPct = event.checklistTotal > 0 ? (event.checklistDone / event.checklistTotal) * 100 : 0;

                  return (
                    <tr
                      key={event.id}
                      className="hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => onEventClick(event.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {timeStatus === 'active' && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />}
                          {timeStatus === 'past' && <span className="w-2 h-2 rounded-full bg-gray-400 flex-shrink-0" />}
                          <div>
                            <div className="font-medium text-foreground">{event.title}</div>
                            {event.location && <div className="text-xs text-muted-foreground">{event.location}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                        {formatDate(event.startDate)} - {formatDate(event.endDate)}
                      </td>
                      <td className="px-4 py-3">
                        {status && (
                          <span
                            className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium"
                            style={{ backgroundColor: `${status.color}15`, color: status.color }}
                          >
                            {status.name}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {event.checklistTotal > 0 ? (
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${checklistPct === 100 ? 'bg-green-500' : checklistPct >= 50 ? 'bg-amber-500' : 'bg-red-400'}`}
                                style={{ width: `${checklistPct}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-muted-foreground tabular-nums">{event.checklistDone}/{event.checklistTotal}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground text-center block">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">
                        {event.attendeeCount}
                      </td>
                      <td className="px-4 py-3 text-right text-foreground tabular-nums font-medium">
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

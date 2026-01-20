'use client';

import { useState } from 'react';
import { Activity, Status, Swimlane, Campaign } from '@/db/schema';
import { formatDate, formatCurrency, CURRENCIES, REGIONS } from '@/lib/utils';

interface TableViewProps {
  activities: Activity[];
  statuses: Status[];
  swimlanes: Swimlane[];
  campaigns: Campaign[];
  onActivityClick: (activity: Activity) => void;
  onActivityUpdate: (id: string, updates: Partial<Activity>) => Promise<void>;
}

type SortField = 'title' | 'startDate' | 'endDate' | 'status' | 'swimlane' | 'campaign' | 'cost';
type SortDirection = 'asc' | 'desc';

export function TableView({
  activities,
  statuses,
  swimlanes,
  campaigns,
  onActivityClick,
  onActivityUpdate,
}: TableViewProps) {
  const [sortField, setSortField] = useState<SortField>('startDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedActivities = [...activities].sort((a, b) => {
    let aValue: string | number = '';
    let bValue: string | number = '';

    switch (sortField) {
      case 'title':
        aValue = a.title.toLowerCase();
        bValue = b.title.toLowerCase();
        break;
      case 'startDate':
        aValue = a.startDate;
        bValue = b.startDate;
        break;
      case 'endDate':
        aValue = a.endDate;
        bValue = b.endDate;
        break;
      case 'status':
        aValue = statuses.find((s) => s.id === a.statusId)?.name || '';
        bValue = statuses.find((s) => s.id === b.statusId)?.name || '';
        break;
      case 'swimlane':
        aValue = swimlanes.find((s) => s.id === a.swimlaneId)?.name || '';
        bValue = swimlanes.find((s) => s.id === b.swimlaneId)?.name || '';
        break;
      case 'campaign':
        aValue = campaigns.find((c) => c.id === a.campaignId)?.name || '';
        bValue = campaigns.find((c) => c.id === b.campaignId)?.name || '';
        break;
      case 'cost':
        aValue = parseFloat(a.cost || '0');
        bValue = parseFloat(b.cost || '0');
        break;
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return sortDirection === 'asc' ? (
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  const handleInlineEdit = async (activityId: string, field: string, value: string | null) => {
    const updates: Partial<Activity> = {};

    switch (field) {
      case 'title':
        if (value && value.trim()) {
          updates.title = value.trim();
        }
        break;
      case 'statusId':
        updates.statusId = value || '';
        break;
      case 'swimlaneId':
        updates.swimlaneId = value || '';
        break;
      case 'campaignId':
        updates.campaignId = value;
        break;
      case 'startDate':
      case 'endDate':
        if (value) {
          (updates as Record<string, string>)[field] = value;
        }
        break;
      case 'cost':
        updates.cost = value || '0';
        break;
      case 'currency':
        updates.currency = value || 'USD';
        break;
      case 'region':
        updates.region = value || 'US';
        break;
    }

    if (Object.keys(updates).length > 0) {
      await onActivityUpdate(activityId, updates);
    }
    setEditingCell(null);
  };

  return (
    <div className="flex-1 overflow-auto bg-white dark:bg-gray-800">
      <table className="w-full min-w-[1200px]">
        <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900 z-10">
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="text-left px-4 py-3">
              <button
                onClick={() => handleSort('title')}
                className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white"
              >
                Title <SortIcon field="title" />
              </button>
            </th>
            <th className="text-left px-4 py-3">
              <button
                onClick={() => handleSort('status')}
                className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white"
              >
                Status <SortIcon field="status" />
              </button>
            </th>
            <th className="text-left px-4 py-3">
              <button
                onClick={() => handleSort('startDate')}
                className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white"
              >
                Start Date <SortIcon field="startDate" />
              </button>
            </th>
            <th className="text-left px-4 py-3">
              <button
                onClick={() => handleSort('endDate')}
                className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white"
              >
                End Date <SortIcon field="endDate" />
              </button>
            </th>
            <th className="text-left px-4 py-3">
              <button
                onClick={() => handleSort('swimlane')}
                className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white"
              >
                Swimlane <SortIcon field="swimlane" />
              </button>
            </th>
            <th className="text-left px-4 py-3">
              <button
                onClick={() => handleSort('campaign')}
                className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white"
              >
                Campaign <SortIcon field="campaign" />
              </button>
            </th>
            <th className="text-left px-4 py-3">
              <button
                onClick={() => handleSort('cost')}
                className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white"
              >
                Cost <SortIcon field="cost" />
              </button>
            </th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-200">
              Currency
            </th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-200">
              Region
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedActivities.map((activity, index) => {
            const status = statuses.find((s) => s.id === activity.statusId);
            const swimlane = swimlanes.find((s) => s.id === activity.swimlaneId);
            const campaign = campaigns.find((c) => c.id === activity.campaignId);

            return (
              <tr
                key={activity.id}
                className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer ${
                  index % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-800/50'
                }`}
                onClick={() => onActivityClick(activity)}
              >
                {/* Title */}
                <td className="px-4 py-3">
                  {editingCell?.id === activity.id && editingCell?.field === 'title' ? (
                    <input
                      type="text"
                      defaultValue={activity.title}
                      autoFocus
                      className="w-full px-2 py-1 border border-blue-500 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      onClick={(e) => e.stopPropagation()}
                      onBlur={(e) => handleInlineEdit(activity.id, 'title', e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleInlineEdit(activity.id, 'title', e.currentTarget.value);
                        } else if (e.key === 'Escape') {
                          setEditingCell(null);
                        }
                      }}
                    />
                  ) : (
                    <span
                      className="text-sm text-gray-900 dark:text-white"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingCell({ id: activity.id, field: 'title' });
                      }}
                    >
                      {activity.title}
                    </span>
                  )}
                </td>

                {/* Status */}
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <select
                    value={activity.statusId}
                    onChange={(e) => handleInlineEdit(activity.id, 'statusId', e.target.value)}
                    className="text-sm px-2 py-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    style={{ borderLeftColor: status?.color, borderLeftWidth: '4px' }}
                  >
                    {statuses.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </td>

                {/* Start Date */}
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="date"
                    value={activity.startDate}
                    onChange={(e) => handleInlineEdit(activity.id, 'startDate', e.target.value)}
                    className="text-sm px-2 py-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </td>

                {/* End Date */}
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="date"
                    value={activity.endDate}
                    onChange={(e) => handleInlineEdit(activity.id, 'endDate', e.target.value)}
                    className="text-sm px-2 py-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </td>

                {/* Swimlane */}
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <select
                    value={activity.swimlaneId}
                    onChange={(e) => handleInlineEdit(activity.id, 'swimlaneId', e.target.value)}
                    className="text-sm px-2 py-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {swimlanes.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </td>

                {/* Campaign */}
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <select
                    value={activity.campaignId || ''}
                    onChange={(e) => handleInlineEdit(activity.id, 'campaignId', e.target.value || null)}
                    className="text-sm px-2 py-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">None</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </td>

                {/* Cost */}
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={activity.cost || '0'}
                    onChange={(e) => handleInlineEdit(activity.id, 'cost', e.target.value)}
                    className="text-sm px-2 py-1 w-24 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </td>

                {/* Currency */}
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <select
                    value={activity.currency || 'USD'}
                    onChange={(e) => handleInlineEdit(activity.id, 'currency', e.target.value)}
                    className="text-sm px-2 py-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </td>

                {/* Region */}
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <select
                    value={activity.region || 'US'}
                    onChange={(e) => handleInlineEdit(activity.id, 'region', e.target.value)}
                    className="text-sm px-2 py-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {REGIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {activities.length === 0 && (
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500 dark:text-gray-400">No activities found</p>
        </div>
      )}
    </div>
  );
}

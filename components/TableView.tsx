'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, Status, Swimlane, Campaign } from '@/db/schema';
import { CURRENCIES, REGIONS, CURRENCY_LABELS } from '@/lib/utils';

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

interface ColumnDef {
  id: string;
  label: string;
  sortField?: SortField;
  minWidth?: string;
}

const ALL_COLUMNS: ColumnDef[] = [
  { id: 'title', label: 'Title', sortField: 'title', minWidth: '200px' },
  { id: 'status', label: 'Status', sortField: 'status', minWidth: '140px' },
  { id: 'startDate', label: 'Start Date', sortField: 'startDate', minWidth: '150px' },
  { id: 'endDate', label: 'End Date', sortField: 'endDate', minWidth: '150px' },
  { id: 'swimlane', label: 'Swimlane', sortField: 'swimlane', minWidth: '140px' },
  { id: 'campaign', label: 'Campaign', sortField: 'campaign', minWidth: '140px' },
  { id: 'cost', label: 'Cost', sortField: 'cost', minWidth: '110px' },
  { id: 'currency', label: 'Currency', minWidth: '100px' },
  { id: 'region', label: 'Region', minWidth: '100px' },
];

const STORAGE_KEY = 'table_view_column_settings';

interface ColumnSettings {
  order: string[];
  hidden: string[];
}

function loadColumnSettings(): ColumnSettings {
  if (typeof window === 'undefined') {
    return { order: ALL_COLUMNS.map((c) => c.id), hidden: [] };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Ensure any new columns are appended
      const knownIds = new Set(ALL_COLUMNS.map((c) => c.id));
      const order = parsed.order.filter((id: string) => knownIds.has(id));
      for (const col of ALL_COLUMNS) {
        if (!order.includes(col.id)) order.push(col.id);
      }
      return { order, hidden: parsed.hidden || [] };
    }
  } catch {}
  return { order: ALL_COLUMNS.map((c) => c.id), hidden: [] };
}

function saveColumnSettings(settings: ColumnSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

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
  const [columnSettings, setColumnSettings] = useState<ColumnSettings>(loadColumnSettings);
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [draggedColId, setDraggedColId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);

  useEffect(() => {
    saveColumnSettings(columnSettings);
  }, [columnSettings]);

  // Close column menu on outside click
  useEffect(() => {
    if (!showColumnMenu) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-column-menu]')) {
        setShowColumnMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showColumnMenu]);

  const visibleColumns = columnSettings.order
    .filter((id) => !columnSettings.hidden.includes(id))
    .map((id) => ALL_COLUMNS.find((c) => c.id === id)!)
    .filter(Boolean);

  const toggleColumn = (colId: string) => {
    // Don't allow hiding title — it's the primary identifier
    if (colId === 'title') return;
    setColumnSettings((prev) => {
      const hidden = prev.hidden.includes(colId)
        ? prev.hidden.filter((id) => id !== colId)
        : [...prev.hidden, colId];
      return { ...prev, hidden };
    });
  };

  const resetColumns = () => {
    setColumnSettings({ order: ALL_COLUMNS.map((c) => c.id), hidden: [] });
  };

  // --- Column drag-and-drop ---
  const handleColDragStart = (colId: string) => {
    setDraggedColId(colId);
  };

  const handleColDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    if (colId !== draggedColId) {
      setDragOverColId(colId);
    }
  };

  const handleColDrop = (targetColId: string) => {
    if (!draggedColId || draggedColId === targetColId) {
      setDraggedColId(null);
      setDragOverColId(null);
      return;
    }
    setColumnSettings((prev) => {
      const order = [...prev.order];
      const fromIdx = order.indexOf(draggedColId);
      const toIdx = order.indexOf(targetColId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      order.splice(fromIdx, 1);
      order.splice(toIdx, 0, draggedColId);
      return { ...prev, order };
    });
    setDraggedColId(null);
    setDragOverColId(null);
  };

  const handleColDragEnd = () => {
    setDraggedColId(null);
    setDragOverColId(null);
  };

  // --- Menu item drag-and-drop for reordering in the settings panel ---
  const [menuDragId, setMenuDragId] = useState<string | null>(null);
  const [menuDragOverId, setMenuDragOverId] = useState<string | null>(null);

  const handleMenuDragStart = (colId: string) => {
    setMenuDragId(colId);
  };

  const handleMenuDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    if (colId !== menuDragId) setMenuDragOverId(colId);
  };

  const handleMenuDrop = (targetColId: string) => {
    if (!menuDragId || menuDragId === targetColId) {
      setMenuDragId(null);
      setMenuDragOverId(null);
      return;
    }
    setColumnSettings((prev) => {
      const order = [...prev.order];
      const fromIdx = order.indexOf(menuDragId);
      const toIdx = order.indexOf(targetColId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      order.splice(fromIdx, 1);
      order.splice(toIdx, 0, menuDragId);
      return { ...prev, order };
    });
    setMenuDragId(null);
    setMenuDragOverId(null);
  };

  // --- Sorting ---
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
      case 'title': aValue = a.title.toLowerCase(); bValue = b.title.toLowerCase(); break;
      case 'startDate': aValue = a.startDate; bValue = b.startDate; break;
      case 'endDate': aValue = a.endDate; bValue = b.endDate; break;
      case 'status': aValue = statuses.find((s) => s.id === a.statusId)?.name || ''; bValue = statuses.find((s) => s.id === b.statusId)?.name || ''; break;
      case 'swimlane': aValue = swimlanes.find((s) => s.id === a.swimlaneId)?.name || ''; bValue = swimlanes.find((s) => s.id === b.swimlaneId)?.name || ''; break;
      case 'campaign': aValue = campaigns.find((c) => c.id === a.campaignId)?.name || ''; bValue = campaigns.find((c) => c.id === b.campaignId)?.name || ''; break;
      case 'cost': aValue = Number(a.cost) || 0; bValue = Number(b.cost) || 0; break;
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <svg className="w-3.5 h-3.5 text-muted-foreground/40" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
        </svg>
      );
    }
    return sortDirection === 'asc' ? (
      <svg className="w-3.5 h-3.5 text-accent" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
      </svg>
    ) : (
      <svg className="w-3.5 h-3.5 text-accent" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
      </svg>
    );
  };

  const handleInlineEdit = useCallback(async (activityId: string, field: string, value: string | null) => {
    const updates: Partial<Activity> = {};
    switch (field) {
      case 'title': if (value && value.trim()) updates.title = value.trim(); break;
      case 'statusId': updates.statusId = value || ''; break;
      case 'swimlaneId': updates.swimlaneId = value || ''; break;
      case 'campaignId': updates.campaignId = value; break;
      case 'startDate': case 'endDate': if (value) (updates as Record<string, string>)[field] = value; break;
      case 'cost': updates.cost = String(parseFloat(value || '0')); break;
      case 'currency': updates.currency = (value || 'USD') as 'USD' | 'GBP' | 'EUR'; break;
      case 'region': updates.region = (value || 'US') as 'US' | 'EMEA' | 'ROW'; break;
    }
    if (Object.keys(updates).length > 0) await onActivityUpdate(activityId, updates);
    setEditingCell(null);
  }, [onActivityUpdate]);

  // --- Render cell by column id ---
  const renderCell = (col: ColumnDef, activity: Activity) => {
    const status = statuses.find((s) => s.id === activity.statusId);
    const swimlane = swimlanes.find((s) => s.id === activity.swimlaneId);
    const campaign = campaigns.find((c) => c.id === activity.campaignId);

    switch (col.id) {
      case 'title':
        return editingCell?.id === activity.id && editingCell?.field === 'title' ? (
          <input
            type="text"
            defaultValue={activity.title}
            autoFocus
            className="w-full px-2 py-1 text-sm border border-accent-purple rounded-md bg-card text-foreground outline-none focus:ring-2 focus:ring-accent-purple/30"
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
            className="text-sm font-medium text-foreground cursor-text hover:text-accent-purple transition-colors"
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditingCell({ id: activity.id, field: 'title' });
            }}
            title="Double-click to edit"
          >
            {activity.title}
          </span>
        );

      case 'status':
        return (
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <span
              className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: status?.color || '#D6E4EA' }}
            />
            <select
              value={activity.statusId || ''}
              onChange={(e) => handleInlineEdit(activity.id, 'statusId', e.target.value)}
              className="text-sm bg-transparent text-foreground outline-none cursor-pointer hover:text-accent-purple transition-colors appearance-none pr-4"
            >
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        );

      case 'startDate':
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <input
              type="date"
              value={activity.startDate}
              onChange={(e) => handleInlineEdit(activity.id, 'startDate', e.target.value)}
              className="text-sm bg-transparent text-foreground outline-none cursor-pointer"
            />
          </div>
        );

      case 'endDate':
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <input
              type="date"
              value={activity.endDate}
              onChange={(e) => handleInlineEdit(activity.id, 'endDate', e.target.value)}
              className="text-sm bg-transparent text-foreground outline-none cursor-pointer"
            />
          </div>
        );

      case 'swimlane':
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <select
              value={activity.swimlaneId}
              onChange={(e) => handleInlineEdit(activity.id, 'swimlaneId', e.target.value)}
              className="text-sm bg-transparent text-foreground outline-none cursor-pointer hover:text-accent-purple transition-colors"
            >
              {swimlanes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        );

      case 'campaign':
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <select
              value={activity.campaignId || ''}
              onChange={(e) => handleInlineEdit(activity.id, 'campaignId', e.target.value || null)}
              className="text-sm bg-transparent text-foreground outline-none cursor-pointer hover:text-accent-purple transition-colors"
            >
              <option value="">None</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        );

      case 'cost':
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <input
              type="number"
              min="0"
              step="0.01"
              value={activity.cost || '0'}
              onChange={(e) => handleInlineEdit(activity.id, 'cost', e.target.value)}
              className="text-sm bg-transparent text-foreground outline-none w-20 tabular-nums"
            />
          </div>
        );

      case 'currency':
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <select
              value={activity.currency || 'USD'}
              onChange={(e) => handleInlineEdit(activity.id, 'currency', e.target.value)}
              className="text-sm bg-transparent text-foreground outline-none cursor-pointer"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        );

      case 'region':
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <select
              value={activity.region || 'US'}
              onChange={(e) => handleInlineEdit(activity.id, 'region', e.target.value)}
              className="text-sm bg-transparent text-foreground outline-none cursor-pointer"
            >
              {REGIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        );

      default:
        return null;
    }
  };

  const thClass = "text-left px-4 py-2.5";
  const thBtnClass = "flex items-center gap-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors";
  const inputClass = "text-sm px-2 py-1 border border-card-border rounded-md bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-accent/40 focus:border-accent/40";

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-card-border bg-surface">
        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Click a row to open details. Edit fields directly in the table. Double-click titles to rename. Drag column headers to reorder.</span>
        </div>
        {/* Column settings button */}
        <div className="relative" data-column-menu>
          <button
            onClick={() => setShowColumnMenu(!showColumnMenu)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted rounded-md transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            Columns
          </button>

          {showColumnMenu && (
            <div className="absolute right-0 top-full mt-1 w-64 bg-card border border-card-border rounded-lg shadow-lg z-50 overflow-hidden">
              <div className="px-3 py-2 border-b border-card-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Manage Columns</span>
                  <button
                    onClick={resetColumns}
                    className="text-xs text-muted-foreground hover:text-accent-purple transition-colors"
                  >
                    Reset
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Drag to reorder · Toggle visibility</p>
              </div>
              <div className="py-1 max-h-80 overflow-y-auto">
                {columnSettings.order.map((colId) => {
                  const col = ALL_COLUMNS.find((c) => c.id === colId);
                  if (!col) return null;
                  const isHidden = columnSettings.hidden.includes(colId);
                  const isTitle = colId === 'title';
                  return (
                    <div
                      key={colId}
                      draggable
                      onDragStart={() => handleMenuDragStart(colId)}
                      onDragOver={(e) => handleMenuDragOver(e, colId)}
                      onDrop={() => handleMenuDrop(colId)}
                      onDragEnd={() => { setMenuDragId(null); setMenuDragOverId(null); }}
                      className={`flex items-center gap-2 px-3 py-1.5 cursor-grab active:cursor-grabbing transition-colors ${
                        menuDragOverId === colId ? 'bg-accent-purple/10' : 'hover:bg-muted/50'
                      } ${menuDragId === colId ? 'opacity-50' : ''}`}
                    >
                      {/* Drag handle */}
                      <svg className="w-3.5 h-3.5 text-muted-foreground shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
                      </svg>

                      {/* Toggle */}
                      <button
                        onClick={() => toggleColumn(colId)}
                        disabled={isTitle}
                        className={`relative w-7 h-4 rounded-full transition-colors shrink-0 ${
                          isTitle
                            ? 'bg-accent-purple-btn/50 cursor-not-allowed'
                            : isHidden
                              ? 'bg-muted-foreground/40 cursor-pointer'
                              : 'bg-accent-purple-btn cursor-pointer'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                            !isHidden ? 'translate-x-3' : ''
                          }`}
                        />
                      </button>

                      <span className={`text-sm ${isHidden ? 'text-muted-foreground' : 'text-foreground'}`}>
                        {col.label}
                      </span>

                      {isTitle && (
                        <span className="ml-auto text-xs text-muted-foreground">Required</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full min-w-[800px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-muted/60 border-b border-card-border">
              {visibleColumns.map((col) => (
                <th
                  key={col.id}
                  className={`${col.id === 'cost' ? 'text-right' : 'text-left'} px-4 py-2.5 select-none transition-colors ${
                    dragOverColId === col.id ? 'bg-accent-purple/10' : ''
                  } ${draggedColId === col.id ? 'opacity-40' : ''}`}
                  style={{ minWidth: col.minWidth }}
                  draggable
                  onDragStart={() => handleColDragStart(col.id)}
                  onDragOver={(e) => handleColDragOver(e, col.id)}
                  onDrop={() => handleColDrop(col.id)}
                  onDragEnd={handleColDragEnd}
                >
                  {col.sortField ? (
                    <button
                      onClick={() => handleSort(col.sortField!)}
                      className="group flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {col.label}
                      <SortIcon field={col.sortField} />
                    </button>
                  ) : (
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {col.label}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-card-border/40">
            {sortedActivities.map((activity, index) => (
              <tr
                key={activity.id}
                className={`border-b border-card-border/30 hover:bg-muted/50 cursor-pointer transition-colors ${
                  index % 2 === 0 ? '' : 'bg-surface/20'
                }`}
                onClick={() => onActivityClick(activity)}
              >
                {visibleColumns.map((col) => (
                  <td
                    key={col.id}
                    className={`px-4 py-2.5 ${col.id === 'cost' ? 'text-right' : ''}`}
                    onClick={col.id !== 'title' ? (e) => e.stopPropagation() : undefined}
                  >
                    {renderCell(col, activity)}
                  </td>
                ))}
              </tr>
            ))}

        </tbody>
      </table>

      {activities.length === 0 && (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <svg className="w-10 h-10 text-muted-foreground/30" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
          </svg>
          <p className="text-sm font-medium text-muted-foreground">No activities found</p>
          <p className="text-xs text-muted-foreground/70 max-w-xs text-center">
            Create your first activity using the &quot;New Activity&quot; button in the header, or switch to Timeline view and drag to create one.
          </p>
        </div>
      )}
      </div>
    </div>
  );
}

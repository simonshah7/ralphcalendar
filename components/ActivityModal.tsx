'use client';

import { useState, useEffect } from 'react';
import { Activity, Status, Swimlane, Campaign } from '@/db/schema';
import { CURRENCIES, REGIONS } from '@/lib/utils';
import { CampaignDropdown } from './CampaignDropdown';

interface ActivityModalProps {
  isOpen: boolean;
  activity?: Activity | null;
  statuses: Status[];
  swimlanes: Swimlane[];
  campaigns: Campaign[];
  defaultStartDate?: string;
  defaultEndDate?: string;
  defaultSwimlaneId?: string;
  defaults?: Partial<ActivityFormData>;
  onClose: () => void;
  onSubmit: (data: ActivityFormData) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onCampaignsChange?: () => void;
}

export interface ActivityFormData {
  title: string;
  startDate: string;
  endDate: string;
  statusId: string;
  swimlaneId: string;
  campaignId: string | null;
  description: string;
  cost: number;
  currency: string;
  region: string;
  tags: string;
  color: string;
}

export function ActivityModal({
  isOpen,
  activity,
  statuses,
  swimlanes,
  campaigns,
  defaultStartDate,
  defaultEndDate,
  defaultSwimlaneId,
  defaults,
  onClose,
  onSubmit,
  onDelete,
  onCampaignsChange,
}: ActivityModalProps) {
  const [formData, setFormData] = useState<ActivityFormData>({
    title: '',
    startDate: '',
    endDate: '',
    statusId: '',
    swimlaneId: '',
    campaignId: null,
    description: '',
    cost: 0,
    currency: 'USD',
    region: 'US',
    tags: '',
    color: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (activity) {
      setFormData({
        title: activity.title,
        startDate: activity.startDate,
        endDate: activity.endDate,
        statusId: activity.statusId,
        swimlaneId: activity.swimlaneId,
        campaignId: activity.campaignId,
        description: activity.description || '',
        cost: activity.cost || 0,
        currency: activity.currency || 'USD',
        region: activity.region || 'US',
        tags: activity.tags || '',
        color: activity.color || '',
      });
    } else {
      setFormData({
        title: defaults?.title || '',
        startDate: defaults?.startDate || defaultStartDate || new Date().toISOString().split('T')[0],
        endDate: defaults?.endDate || defaultEndDate || new Date().toISOString().split('T')[0],
        statusId: defaults?.statusId || statuses[0]?.id || '',
        swimlaneId: defaults?.swimlaneId || defaultSwimlaneId || swimlanes[0]?.id || '',
        campaignId: defaults?.campaignId ?? null,
        description: defaults?.description || '',
        cost: defaults?.cost || 0,
        currency: defaults?.currency || 'USD',
        region: defaults?.region || 'US',
        tags: defaults?.tags || '',
        color: defaults?.color || '',
      });
    }
    setErrors({});
    setShowDeleteConfirm(false);
  }, [activity, isOpen, statuses, swimlanes, defaultStartDate, defaultEndDate, defaultSwimlaneId, defaults]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }
    if (!formData.startDate) {
      newErrors.startDate = 'Start date is required';
    }
    if (!formData.endDate) {
      newErrors.endDate = 'End date is required';
    }
    if (formData.startDate && formData.endDate && formData.endDate < formData.startDate) {
      newErrors.endDate = 'End date must be after start date';
    }
    if (!formData.statusId) {
      newErrors.statusId = 'Status is required';
    }
    if (!formData.swimlaneId) {
      newErrors.swimlaneId = 'Swimlane is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save activity';
      setErrors({ form: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!activity || !onDelete) return;
    setIsSubmitting(true);
    try {
      await onDelete(activity.id);
      onClose();
    } catch {
      setErrors({ form: 'Failed to delete activity' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[95vh] overflow-y-auto border border-card-border">
        <div className="sticky top-0 bg-card border-b border-card-border px-6 py-3 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {activity ? 'Edit Activity' : 'Create Activity'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errors.form && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
              {errors.form}
            </div>
          )}

          <div className="grid grid-cols-12 gap-4">
            {/* Title */}
            <div className="col-span-8">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-1.5 border border-card-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-accent-purple text-sm"
              />
              {errors.title && <p className="mt-0.5 text-xs text-red-600">{errors.title}</p>}
            </div>

            {/* Campaign */}
            <div className="col-span-4">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Campaign
              </label>
              <CampaignDropdown
                campaigns={campaigns}
                selectedCampaignId={formData.campaignId}
                calendarId={activity?.calendarId || swimlanes[0]?.calendarId || ''}
                onSelect={(id) => setFormData({ ...formData, campaignId: id })}
                onCampaignsChange={onCampaignsChange || (() => { })}
              />
            </div>

            {/* Dates, Status, Swimlane */}
            <div className="col-span-3">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Start Date *
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-3 py-1.5 border border-card-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-accent-purple text-sm"
              />
              {errors.startDate && <p className="mt-0.5 text-xs text-red-600">{errors.startDate}</p>}
            </div>

            <div className="col-span-3">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                End Date *
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full px-3 py-1.5 border border-card-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-accent-purple text-sm"
              />
              {errors.endDate && <p className="mt-0.5 text-xs text-red-600">{errors.endDate}</p>}
            </div>

            <div className="col-span-3">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Status *
              </label>
              <select
                value={formData.statusId}
                onChange={(e) => setFormData({ ...formData, statusId: e.target.value })}
                className="w-full px-3 py-1.5 border border-card-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-accent-purple text-sm"
              >
                <option value="">Select status</option>
                {statuses.map((status) => (
                  <option key={status.id} value={status.id}>
                    {status.name}
                  </option>
                ))}
              </select>
              {errors.statusId && <p className="mt-0.5 text-xs text-red-600">{errors.statusId}</p>}
            </div>

            <div className="col-span-3">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Swimlane *
              </label>
              <select
                value={formData.swimlaneId}
                onChange={(e) => setFormData({ ...formData, swimlaneId: e.target.value })}
                className="w-full px-3 py-1.5 border border-card-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-accent-purple text-sm"
              >
                <option value="">Select</option>
                {swimlanes.map((swimlane) => (
                  <option key={swimlane.id} value={swimlane.id}>
                    {swimlane.name}
                  </option>
                ))}
              </select>
              {errors.swimlaneId && <p className="mt-0.5 text-xs text-red-600">{errors.swimlaneId}</p>}
            </div>

            {/* Cost, Currency, Region, Tags */}
            <div className="col-span-3">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Cost
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.cost}
                onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-1.5 border border-card-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-accent-purple text-sm"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Currency
              </label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="w-full px-3 py-1.5 border border-card-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-accent-purple text-sm"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Region
              </label>
              <select
                value={formData.region}
                onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                className="w-full px-3 py-1.5 border border-card-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-accent-purple text-sm"
              >
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-5">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Tags (comma-separated)
              </label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="social, paid..."
                className="w-full px-3 py-1.5 border border-card-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-accent-purple text-sm"
              />
            </div>

            {/* Description & Color */}
            <div className="col-span-8">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                className="w-full px-3 py-1.5 border border-card-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-accent-purple text-sm resize-none"
              />
            </div>

            <div className="col-span-4">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Color Override
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={formData.color || '#3B82F6'}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-8 h-8 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  placeholder="#Hex"
                  className="flex-1 px-2 py-1.5 border border-card-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-accent-purple text-xs"
                />
                {formData.color && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, color: '' })}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-between pt-3 border-t border-card-border">
            <div>
              {activity && onDelete && (
                <>
                  {showDeleteConfirm ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-600 dark:text-gray-300">Delete permanently?</span>
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={isSubmitting}
                        className="px-2 py-1 text-xs text-white bg-red-600 rounded hover:bg-red-700 font-bold"
                      >
                        YES
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(false)}
                        className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800 font-bold"
                      >
                        NO
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="px-3 py-1.5 text-xs font-bold text-red-600 hover:text-red-700 uppercase tracking-tight"
                    >
                      Delete Activity
                    </button>
                  )
                  }
                </>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 text-xs font-bold text-foreground bg-muted rounded hover:opacity-80 transition-opacity uppercase tracking-tight"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-1.5 text-xs font-bold text-white bg-accent-purple rounded hover:opacity-90 transition-opacity disabled:opacity-50 uppercase tracking-tight"
              >
                {isSubmitting ? 'Saving...' : 'Save Activity'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

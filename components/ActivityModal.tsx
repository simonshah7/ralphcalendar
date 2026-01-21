'use client';

import { useState, useEffect } from 'react';
import { Activity, Status, Swimlane, Campaign } from '@/db/schema';
import { CURRENCIES, REGIONS } from '@/lib/utils';

interface ActivityModalProps {
  isOpen: boolean;
  activity?: Activity | null;
  statuses: Status[];
  swimlanes: Swimlane[];
  campaigns: Campaign[];
  defaultStartDate?: string;
  defaultEndDate?: string;
  defaultSwimlaneId?: string;
  onClose: () => void;
  onSubmit: (data: ActivityFormData) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
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
  onClose,
  onSubmit,
  onDelete,
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
        cost: parseFloat(activity.cost || '0'),
        currency: activity.currency || 'USD',
        region: activity.region || 'US',
        tags: activity.tags || '',
        color: activity.color || '',
      });
    } else {
      setFormData({
        title: '',
        startDate: defaultStartDate || new Date().toISOString().split('T')[0],
        endDate: defaultEndDate || new Date().toISOString().split('T')[0],
        statusId: statuses[0]?.id || '',
        swimlaneId: defaultSwimlaneId || swimlanes[0]?.id || '',
        campaignId: null,
        description: '',
        cost: 0,
        currency: 'USD',
        region: 'US',
        tags: '',
        color: '',
      });
    }
    setErrors({});
    setShowDeleteConfirm(false);
  }, [activity, isOpen, statuses, swimlanes, defaultStartDate, defaultEndDate, defaultSwimlaneId]);

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
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {activity ? 'Edit Activity' : 'Create Activity'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errors.form && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
              {errors.form}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Start Date *
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.startDate && <p className="mt-1 text-sm text-red-600">{errors.startDate}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                End Date *
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.endDate && <p className="mt-1 text-sm text-red-600">{errors.endDate}</p>}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Status *
            </label>
            <select
              value={formData.statusId}
              onChange={(e) => setFormData({ ...formData, statusId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select status</option>
              {statuses.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.name}
                </option>
              ))}
            </select>
            {errors.statusId && <p className="mt-1 text-sm text-red-600">{errors.statusId}</p>}
          </div>

          {/* Swimlane */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Swimlane *
            </label>
            <select
              value={formData.swimlaneId}
              onChange={(e) => setFormData({ ...formData, swimlaneId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select swimlane</option>
              {swimlanes.map((swimlane) => (
                <option key={swimlane.id} value={swimlane.id}>
                  {swimlane.name}
                </option>
              ))}
            </select>
            {errors.swimlaneId && <p className="mt-1 text-sm text-red-600">{errors.swimlaneId}</p>}
          </div>

          {/* Campaign */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Campaign
            </label>
            <select
              value={formData.campaignId || ''}
              onChange={(e) => setFormData({ ...formData, campaignId: e.target.value || null })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">None</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Cost & Currency */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Cost
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.cost}
                onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Currency
              </label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Region */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Region
            </label>
            <select
              value={formData.region}
              onChange={(e) => setFormData({ ...formData, region: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              placeholder="social, paid, q1"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Color Override */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Color Override
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={formData.color || '#3B82F6'}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="w-10 h-10 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
              />
              <input
                type="text"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                placeholder="#3B82F6"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {formData.color && (
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, color: '' })}
                  className="px-2 py-2 text-gray-500 hover:text-gray-700"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
            <div>
              {activity && onDelete && (
                <>
                  {showDeleteConfirm ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 dark:text-gray-300">Delete?</span>
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={isSubmitting}
                        className="px-3 py-1 text-sm text-white bg-red-600 rounded hover:bg-red-700"
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(false)}
                        className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700"
                    >
                      Delete
                    </button>
                  )}
                </>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

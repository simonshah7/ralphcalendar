'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

interface AttachmentData {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
  uploadedAt: string;
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
  actualCost: number;
  currency: string;
  region: string;
  tags: string;
  color: string;
  expectedSaos: number;
  actualSaos: number;
  pipelineGenerated: number;
  revenueGenerated: number;
  attachments: AttachmentData[];
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
    actualCost: 0,
    currency: 'US$',
    region: 'US',
    tags: '',
    color: '',
    expectedSaos: 0,
    actualSaos: 0,
    pipelineGenerated: 0,
    revenueGenerated: 0,
    attachments: [],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'metrics' | 'documents'>('details');

  useEffect(() => {
    if (activity) {
      setFormData({
        title: activity.title,
        startDate: activity.startDate,
        endDate: activity.endDate,
        statusId: activity.statusId || '',
        swimlaneId: activity.swimlaneId,
        campaignId: activity.campaignId,
        description: activity.description || '',
        cost: Number(activity.cost) || 0,
        actualCost: Number(activity.actualCost) || 0,
        currency: activity.currency || 'US$',
        region: activity.region || 'US',
        tags: activity.tags || '',
        color: activity.color || '',
        expectedSaos: Number(activity.expectedSaos) || 0,
        actualSaos: Number(activity.actualSaos) || 0,
        pipelineGenerated: Number(activity.pipelineGenerated) || 0,
        revenueGenerated: Number(activity.revenueGenerated) || 0,
        attachments: (activity.attachments as AttachmentData[]) || [],
      });
    } else {
      setFormData({
        title: defaults?.title || '', startDate: defaults?.startDate || defaultStartDate || new Date().toISOString().split('T')[0],
        endDate: defaults?.endDate || defaultEndDate || new Date().toISOString().split('T')[0],
        statusId: defaults?.statusId || statuses[0]?.id || '',
        swimlaneId: defaults?.swimlaneId || defaultSwimlaneId || swimlanes[0]?.id || '',
        campaignId: defaults?.campaignId ?? null,
        description: defaults?.description || '',
        cost: Number(defaults?.cost) || 0,
        actualCost: 0,
        currency: defaults?.currency || 'US$',
        region: defaults?.region || 'US',
        tags: defaults?.tags || '',
        color: defaults?.color || '',
        expectedSaos: 0,
        actualSaos: 0,
        pipelineGenerated: 0,
        revenueGenerated: 0,
        attachments: [],
      });
    }
    setErrors({});
    setShowDeleteConfirm(false);
  }, [activity, isOpen, statuses, swimlanes, defaultStartDate, defaultEndDate, defaultSwimlaneId, defaults]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const newAttachments: AttachmentData[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fd = new FormData();
        fd.append('file', file);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: fd,
        });

        if (response.ok) {
          const attachment = await response.json();
          newAttachments.push(attachment);
        }
      }
      setFormData((prev) => ({
        ...prev,
        attachments: [...prev.attachments, ...newAttachments],
      }));
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const removeAttachment = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((a) => a.id !== id),
    }));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!isOpen) return null;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.title.trim()) newErrors.title = 'Title is required';
    if (!formData.startDate) newErrors.startDate = 'Start date is required';
    if (!formData.endDate) newErrors.endDate = 'End date is required';
    if (formData.startDate && formData.endDate && formData.endDate < formData.startDate) newErrors.endDate = 'End date must be on or after start date';
    if (!formData.statusId) newErrors.statusId = 'Status is required';
    if (!formData.swimlaneId) newErrors.swimlaneId = 'Channel is required';
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
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-overlay backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative bg-card rounded-2xl shadow-xl max-w-4xl w-full mx-4 max-h-[95vh] overflow-y-auto border border-card-border"
          >
            <div className="sticky top-0 bg-card border-b border-card-border px-6 py-3.5 flex items-center justify-between z-10 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${activity ? 'bg-warm-soft' : 'bg-accent-soft'}`}>
                  {activity ? (
                    <svg className="w-4 h-4 text-warm" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  )}
                </div>
                <h2 className="text-base font-semibold text-foreground">
                  {activity ? 'Edit Activity' : 'New Activity'}
                </h2>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

          <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-12 gap-4">
            {/* Title */}
            <div className="col-span-8">
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-1.5 border border-card-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-accent-purple text-sm"
              />
              {errors.title && <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{errors.title}</p>}
            </div>

            {/* Campaign */}
            <div className="col-span-4">
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
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
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Start Date *
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-3 py-1.5 border border-card-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-accent-purple text-sm"
              />
              {errors.startDate && <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{errors.startDate}</p>}
            </div>

            <div className="col-span-3">
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                End Date *
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full px-3 py-1.5 border border-card-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-accent-purple text-sm"
              />
              {errors.endDate && <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{errors.endDate}</p>}
            </div>

            <div className="col-span-3">
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
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
              {errors.statusId && <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{errors.statusId}</p>}
            </div>

            <div className="col-span-3">
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
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
              {errors.swimlaneId && <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{errors.swimlaneId}</p>}
            </div>

            {/* Currency & Region */}
            <div className="col-span-3">
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

            <div className="col-span-3">
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

            <div className="col-span-6">
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
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
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
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Color Override
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={formData.color || '#3B82F6'}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-8 h-8 rounded border border-card-border cursor-pointer"
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
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
          )}

          {/* === BUDGET & METRICS TAB === */}
          {activeTab === 'metrics' && (
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12">
              <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Cost Tracking</h3>
            </div>

            <div className="col-span-3">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Planned Cost
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

            <div className="col-span-3">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Actual Cost
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.actualCost}
                onChange={(e) => setFormData({ ...formData, actualCost: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-1.5 border border-card-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-accent-purple text-sm"
              />
            </div>

            <div className="col-span-3">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Variance
              </label>
              <div className={`px-3 py-1.5 border border-card-border rounded text-sm font-medium ${
                formData.actualCost > formData.cost
                  ? 'text-red-600 bg-red-50 dark:bg-red-900/20'
                  : formData.actualCost > 0 && formData.actualCost < formData.cost
                  ? 'text-green-600 bg-green-50 dark:bg-green-900/20'
                  : 'text-gray-500 bg-gray-50 dark:bg-gray-800'
              }`}>
                {formData.cost > 0 ? `${(((formData.actualCost - formData.cost) / formData.cost) * 100).toFixed(1)}%` : '--'}
                {formData.actualCost > formData.cost && ' over budget'}
                {formData.actualCost > 0 && formData.actualCost < formData.cost && ' under budget'}
              </div>
            </div>

            <div className="col-span-3">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Currency
              </label>
              <div className="px-3 py-1.5 border border-card-border rounded bg-gray-50 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-400">
                {formData.currency}
              </div>
            </div>

            <div className="col-span-12 mt-2">
              <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Performance Metrics</h3>
            </div>

            <div className="col-span-3">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Expected SAOs
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={formData.expectedSaos}
                onChange={(e) => setFormData({ ...formData, expectedSaos: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-1.5 border border-card-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-accent-purple text-sm"
              />
            </div>

            <div className="col-span-3">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Actual SAOs
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={formData.actualSaos}
                onChange={(e) => setFormData({ ...formData, actualSaos: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-1.5 border border-card-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-accent-purple text-sm"
              />
            </div>

            <div className="col-span-3">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                SAO Attainment
              </label>
              <div className={`px-3 py-1.5 border border-card-border rounded text-sm font-medium ${
                formData.expectedSaos > 0 && formData.actualSaos >= formData.expectedSaos
                  ? 'text-green-600 bg-green-50 dark:bg-green-900/20'
                  : formData.expectedSaos > 0 && formData.actualSaos > 0
                  ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/20'
                  : 'text-gray-500 bg-gray-50 dark:bg-gray-800'
              }`}>
                {formData.expectedSaos > 0 ? `${((formData.actualSaos / formData.expectedSaos) * 100).toFixed(0)}%` : '--'}
              </div>
            </div>

            <div className="col-span-3">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Cost per SAO
              </label>
              <div className="px-3 py-1.5 border border-card-border rounded bg-gray-50 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-400">
                {formData.actualSaos > 0 && formData.actualCost > 0
                  ? `${formData.currency}${(formData.actualCost / formData.actualSaos).toFixed(0)}`
                  : '--'}
              </div>
            </div>

            <div className="col-span-3">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Pipeline Generated
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.pipelineGenerated}
                onChange={(e) => setFormData({ ...formData, pipelineGenerated: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-1.5 border border-card-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-accent-purple text-sm"
              />
            </div>

            <div className="col-span-3">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Revenue Generated
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.revenueGenerated}
                onChange={(e) => setFormData({ ...formData, revenueGenerated: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-1.5 border border-card-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-accent-purple text-sm"
              />
            </div>

            <div className="col-span-3">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Pipeline ROI
              </label>
              <div className={`px-3 py-1.5 border border-card-border rounded text-sm font-medium ${
                formData.actualCost > 0 && formData.pipelineGenerated > formData.actualCost
                  ? 'text-green-600 bg-green-50 dark:bg-green-900/20'
                  : 'text-gray-500 bg-gray-50 dark:bg-gray-800'
              }`}>
                {formData.actualCost > 0 ? `${(formData.pipelineGenerated / formData.actualCost).toFixed(1)}x` : '--'}
              </div>
            </div>

            <div className="col-span-3">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Revenue ROI
              </label>
              <div className={`px-3 py-1.5 border border-card-border rounded text-sm font-medium ${
                formData.actualCost > 0 && formData.revenueGenerated > formData.actualCost
                  ? 'text-green-600 bg-green-50 dark:bg-green-900/20'
                  : 'text-gray-500 bg-gray-50 dark:bg-gray-800'
              }`}>
                {formData.actualCost > 0 ? `${(formData.revenueGenerated / formData.actualCost).toFixed(1)}x` : '--'}
              </div>
            </div>
          </div>
          )}

          {/* === DOCUMENTS TAB === */}
          {activeTab === 'documents' && (
          <div className="space-y-4">
            {/* Upload area */}
            <div className="border-2 border-dashed border-card-border rounded-lg p-6 text-center hover:border-accent-purple/50 transition-colors">
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.csv,.txt,.zip"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <svg className="w-10 h-10 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {isUploading ? 'Uploading...' : 'Click to upload contracts, briefs, creative assets'}
                </p>
                <p className="text-xs text-gray-400 mt-1">PDF, DOC, XLS, PPT, images up to 10MB</p>
              </label>
            </div>

            {/* File list */}
            {formData.attachments.length > 0 && (
              <div className="space-y-2">
                {formData.attachments.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-3 bg-card border border-card-border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-accent-purple/10 flex items-center justify-center">
                        <svg className="w-4 h-4 text-accent-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{file.name}</p>
                        <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-accent-purple hover:underline"
                      >
                        View
                      </a>
                      <button
                        type="button"
                        onClick={() => removeAttachment(file.id)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {formData.attachments.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                No documents attached yet. Upload contracts, briefs, or creative assets.
              </p>
            )}
          </div>
          )}

          <div className="flex justify-between pt-3 border-t border-card-border">
            <div>
              {activity && onDelete && (
                <>
                  {showDeleteConfirm ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-foreground">Delete permanently?</span>
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
                        className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground font-bold"
                      >
                        Clear
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
                className="px-6 py-1.5 text-xs font-bold text-white bg-accent-purple-btn rounded hover:opacity-90 transition-opacity disabled:opacity-50 uppercase tracking-tight"
              >
                {isSubmitting ? 'Saving...' : 'Save Activity'}
              </button>
            </div>
          </div>
          </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

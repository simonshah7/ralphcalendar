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
    title: '', startDate: '', endDate: '', statusId: '', swimlaneId: '',
    campaignId: null, description: '', cost: 0, currency: 'US$', region: 'US', tags: '', color: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (activity) {
      setFormData({
        title: activity.title, startDate: activity.startDate, endDate: activity.endDate,
        statusId: activity.statusId || '', swimlaneId: activity.swimlaneId,
        campaignId: activity.campaignId, description: activity.description || '',
        cost: Number(activity.cost) || 0, currency: activity.currency || 'US$',
        region: activity.region || 'US', tags: activity.tags || '', color: activity.color || '',
      });
    } else {
      setFormData({
        title: defaults?.title || '', startDate: defaults?.startDate || defaultStartDate || new Date().toISOString().split('T')[0],
        endDate: defaults?.endDate || defaultEndDate || new Date().toISOString().split('T')[0],
        statusId: defaults?.statusId || statuses[0]?.id || '',
        swimlaneId: defaults?.swimlaneId || defaultSwimlaneId || swimlanes[0]?.id || '',
        campaignId: defaults?.campaignId ?? null, description: defaults?.description || '',
        cost: Number(defaults?.cost) || 0, currency: defaults?.currency || 'US$',
        region: defaults?.region || 'US', tags: defaults?.tags || '', color: defaults?.color || '',
      });
    }
    setErrors({});
    setShowDeleteConfirm(false);
  }, [activity, isOpen, statuses, swimlanes, defaultStartDate, defaultEndDate, defaultSwimlaneId, defaults]);

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

  const inputClass = "w-full px-3 py-1.5 border border-card-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-accent/40 focus:border-accent/40 text-sm";
  const labelClass = "block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1";

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

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {errors.form && (
                <div className="p-3 bg-danger-soft text-danger rounded-lg text-sm flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  {errors.form}
                </div>
              )}

              <div className="grid grid-cols-12 gap-4">
                {/* Title */}
                <div className="col-span-8">
                  <label className={labelClass}>Title *</label>
                  <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className={inputClass} placeholder="Activity name" />
                  {errors.title && <p className="mt-0.5 text-[11px] text-danger">{errors.title}</p>}
                </div>

                {/* Campaign */}
                <div className="col-span-4">
                  <label className={labelClass}>Campaign</label>
                  <CampaignDropdown
                    campaigns={campaigns}
                    selectedCampaignId={formData.campaignId}
                    calendarId={activity?.calendarId || swimlanes[0]?.calendarId || ''}
                    onSelect={(id) => setFormData({ ...formData, campaignId: id })}
                    onCampaignsChange={onCampaignsChange || (() => {})}
                  />
                </div>

                {/* Dates, Status, Swimlane */}
                <div className="col-span-3">
                  <label className={labelClass}>Start Date *</label>
                  <input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} className={inputClass} />
                  {errors.startDate && <p className="mt-0.5 text-[11px] text-danger">{errors.startDate}</p>}
                </div>

                <div className="col-span-3">
                  <label className={labelClass}>End Date *</label>
                  <input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} className={inputClass} />
                  {errors.endDate && <p className="mt-0.5 text-[11px] text-danger">{errors.endDate}</p>}
                </div>

                <div className="col-span-3">
                  <label className={labelClass}>Status *</label>
                  <select value={formData.statusId} onChange={(e) => setFormData({ ...formData, statusId: e.target.value })} className={inputClass}>
                    <option value="">Select status</option>
                    {statuses.map((status) => (
                      <option key={status.id} value={status.id}>{status.name}</option>
                    ))}
                  </select>
                  {errors.statusId && <p className="mt-0.5 text-[11px] text-danger">{errors.statusId}</p>}
                </div>

                <div className="col-span-3">
                  <label className={labelClass}>Channel *</label>
                  <select value={formData.swimlaneId} onChange={(e) => setFormData({ ...formData, swimlaneId: e.target.value })} className={inputClass}>
                    <option value="">Select</option>
                    {swimlanes.map((swimlane) => (
                      <option key={swimlane.id} value={swimlane.id}>{swimlane.name}</option>
                    ))}
                  </select>
                  {errors.swimlaneId && <p className="mt-0.5 text-[11px] text-danger">{errors.swimlaneId}</p>}
                </div>

                {/* Cost, Currency, Region, Tags */}
                <div className="col-span-3">
                  <label className={labelClass}>Cost</label>
                  <input type="number" min="0" step="0.01" value={formData.cost} onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })} className={`${inputClass} tabular-nums`} />
                </div>

                <div className="col-span-2">
                  <label className={labelClass}>Currency</label>
                  <select value={formData.currency} onChange={(e) => setFormData({ ...formData, currency: e.target.value })} className={inputClass}>
                    {CURRENCIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className={labelClass}>Region</label>
                  <select value={formData.region} onChange={(e) => setFormData({ ...formData, region: e.target.value })} className={inputClass}>
                    {REGIONS.map((r) => (<option key={r} value={r}>{r}</option>))}
                  </select>
                </div>

                <div className="col-span-5">
                  <label className={labelClass}>Tags (comma-separated)</label>
                  <input type="text" value={formData.tags} onChange={(e) => setFormData({ ...formData, tags: e.target.value })} placeholder="social, paid..." className={inputClass} />
                </div>

                {/* Description & Color */}
                <div className="col-span-8">
                  <label className={labelClass}>Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    className={`${inputClass} resize-none`}
                  />
                </div>

                <div className="col-span-4">
                  <label className={labelClass}>Color Override</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.color || '#0d9488'}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="w-8 h-8 rounded-lg border border-card-border cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      placeholder="#hex"
                      className={`flex-1 ${inputClass} text-xs`}
                    />
                    {formData.color && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, color: '' })}
                        className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t border-card-border">
                <div>
                  {activity && onDelete && (
                    <>
                      {showDeleteConfirm ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Delete permanently?</span>
                          <button type="button" onClick={handleDelete} disabled={isSubmitting} className="px-2.5 py-1 text-xs text-white bg-danger rounded-md hover:bg-red-700 font-medium transition-colors">
                            Yes, delete
                          </button>
                          <button type="button" onClick={() => setShowDeleteConfirm(false)} className="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowDeleteConfirm(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger-soft rounded-md transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                          Delete
                        </button>
                      )}
                    </>
                  )}
                </div>
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-1.5 text-sm font-medium text-foreground bg-muted rounded-lg hover:bg-card-hover transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-1.5 text-sm font-medium text-white bg-accent rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50 shadow-sm shadow-accent/20"
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

'use client';

import { useState, useRef } from 'react';
import { SolarLightbulbLinear, SolarSpinner } from './SolarIcons';

export interface GeneratedActivity {
  title: string;
  startDate: string;
  endDate: string;
  estimatedCost: number;
  swimlaneSuggestion: string;
  description: string;
}

interface AIBriefPanelProps {
  calendarId: string;
  swimlanes: Array<{ id: string; name: string }>;
  onApply: (activities: GeneratedActivity[]) => void;
}

interface BriefFormData {
  goal: string;
  budget: number;
  region: 'US' | 'EMEA' | 'ROW';
  startDate: string;
  endDate: string;
  audience: string;
  objective: string;
}

interface GeneratedPlan {
  suggestedName: string;
  activities: GeneratedActivity[];
}

type Step = 'input' | 'review';

export function AIBriefPanel({ calendarId, swimlanes, onApply }: AIBriefPanelProps) {
  const [step, setStep] = useState<Step>('input');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<BriefFormData>({
    goal: '',
    budget: 0,
    region: 'US',
    startDate: '',
    endDate: '',
    audience: 'Companies with revenue >= $3B in NA and Europe using SAP',
    objective: '',
  });

  const [plan, setPlan] = useState<GeneratedPlan | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [editableActivities, setEditableActivities] = useState<GeneratedActivity[]>([]);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleGenerate = async () => {
    if (!formData.goal.trim()) {
      setError('Please enter a campaign goal.');
      return;
    }
    if (!formData.startDate || !formData.endDate) {
      setError('Please select a date range.');
      return;
    }
    if (formData.endDate < formData.startDate) {
      setError('End date must be after start date.');
      return;
    }

    setError(null);
    setIsGenerating(true);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/ai/campaign-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendarId,
          goal: formData.goal.trim(),
          budget: formData.budget,
          region: formData.region,
          startDate: formData.startDate,
          endDate: formData.endDate,
          audience: formData.audience.trim(),
          objective: formData.objective.trim(),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to generate campaign brief');
      }

      const result: GeneratedPlan = await response.json();
      setPlan(result);
      setEditableActivities([...result.activities]);
      setSelectedIds(new Set(result.activities.map((_, i) => i)));
      setExpandedIndex(null);
      setStep('review');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError('Failed to generate plan. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleActivity = (index: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === editableActivities.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(editableActivities.map((_, i) => i)));
    }
  };

  const updateActivity = (index: number, field: keyof GeneratedActivity, value: string | number) => {
    setEditableActivities((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const totalCost = editableActivities.reduce(
    (sum, a, i) => (selectedIds.has(i) ? sum + a.estimatedCost : sum),
    0
  );

  const handleApply = () => {
    const selected = editableActivities.filter((_, i) => selectedIds.has(i));
    if (selected.length === 0) {
      setError('Please select at least one activity.');
      return;
    }
    onApply(selected);
    setStep('input');
    setError(null);
    setPlan(null);
    setSelectedIds(new Set());
    setEditableActivities([]);
  };

  const labelClass = 'block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1';
  const inputClass = 'w-full px-3 py-2 border border-card-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-accent-purple text-sm';

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Step 1: Input */}
        {step === 'input' && (
          <div className="space-y-4">
            {/* Brief header */}
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-accent-purple/10 flex items-center justify-center">
                <SolarLightbulbLinear className="w-3.5 h-3.5 text-accent-purple" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground uppercase tracking-wider">Campaign Brief</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                  Describe your goal and AI will generate a plan.
                </p>
              </div>
            </div>

            <div>
              <label className={labelClass}>Campaign Goal *</label>
              <textarea
                value={formData.goal}
                onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
                rows={2}
                placeholder="e.g., Q3 product launch targeting enterprise EMEA"
                className={`${inputClass} resize-none placeholder:text-gray-400`}
              />
            </div>

            <div>
              <label className={labelClass}>Objective</label>
              <input
                type="text"
                value={formData.objective}
                onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
                placeholder="e.g., Drive pipeline for FA prospects"
                className={`${inputClass} placeholder:text-gray-400`}
              />
            </div>

            <div>
              <label className={labelClass}>Audience / ICP</label>
              <input
                type="text"
                value={formData.audience}
                onChange={(e) => setFormData({ ...formData, audience: e.target.value })}
                placeholder="e.g., CFOs at mid-market companies"
                className={`${inputClass} placeholder:text-gray-400`}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Budget</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={formData.budget || ''}
                    onChange={(e) => setFormData({ ...formData, budget: parseFloat(e.target.value) || 0 })}
                    placeholder="50000"
                    className={`${inputClass} pl-7`}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Region</label>
                <select
                  value={formData.region}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value as BriefFormData['region'] })}
                  className={inputClass}
                >
                  <option value="US">US</option>
                  <option value="EMEA">EMEA</option>
                  <option value="ROW">ROW</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Start Date *</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>End Date *</label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Review */}
        {step === 'review' && plan && (
          <div className="space-y-3">
            {/* Suggested campaign name */}
            <div className="p-3 bg-accent-purple/5 border border-accent-purple/20 rounded-lg">
              <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">
                Suggested Campaign Name
              </p>
              <p className="text-sm font-bold text-accent-purple">{plan.suggestedName}</p>
            </div>

            {/* Select all */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedIds.size === editableActivities.length}
                  onChange={toggleAll}
                  className="w-3.5 h-3.5 rounded border-card-border text-accent-purple focus:ring-accent-purple"
                />
                <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Select All ({selectedIds.size}/{editableActivities.length})
                </span>
              </label>
              <p className="text-xs text-foreground">
                <span className="font-bold text-accent-purple">${totalCost.toLocaleString()}</span>
                {formData.budget > 0 && (
                  <span className={`ml-1 text-[10px] ${totalCost > formData.budget ? 'text-red-500' : 'text-green-500'}`}>
                    ({totalCost <= formData.budget ? 'within' : 'over'} budget)
                  </span>
                )}
              </p>
            </div>

            {/* Activity cards - accordion style */}
            <div className="space-y-2">
              {editableActivities.map((activity, index) => {
                const isExpanded = expandedIndex === index;
                return (
                  <div
                    key={`${activity.title}-${activity.startDate}-${index}`}
                    className={`border rounded-lg transition-colors ${
                      selectedIds.has(index)
                        ? 'border-accent-purple/40 bg-card'
                        : 'border-card-border bg-muted opacity-60'
                    }`}
                  >
                    {/* Collapsed header */}
                    <div className="flex items-center gap-2 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(index)}
                        onChange={() => toggleActivity(index)}
                        className="w-3.5 h-3.5 rounded border-card-border text-accent-purple focus:ring-accent-purple flex-shrink-0"
                      />
                      <button
                        onClick={() => setExpandedIndex(isExpanded ? null : index)}
                        className="flex-1 flex items-center justify-between text-left min-w-0"
                      >
                        <span className="text-sm font-medium text-foreground truncate">{activity.title}</span>
                        <span className="text-[10px] text-gray-400 flex-shrink-0 ml-2">
                          ${activity.estimatedCost.toLocaleString()}
                        </span>
                      </button>
                      <svg
                        className={`w-3.5 h-3.5 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>

                    {/* Expanded edit fields */}
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-1 border-t border-card-border space-y-2">
                        <div>
                          <label className={labelClass}>Title</label>
                          <input
                            type="text"
                            value={activity.title}
                            onChange={(e) => updateActivity(index, 'title', e.target.value)}
                            className={inputClass}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className={labelClass}>Swimlane</label>
                            <select
                              value={activity.swimlaneSuggestion}
                              onChange={(e) => updateActivity(index, 'swimlaneSuggestion', e.target.value)}
                              className={`${inputClass} text-xs`}
                            >
                              <option value={activity.swimlaneSuggestion}>{activity.swimlaneSuggestion}</option>
                              {swimlanes
                                .filter((s) => s.name !== activity.swimlaneSuggestion)
                                .map((s) => (
                                  <option key={s.id} value={s.name}>{s.name}</option>
                                ))}
                            </select>
                          </div>
                          <div>
                            <label className={labelClass}>Est. Cost</label>
                            <input
                              type="number"
                              min="0"
                              step="100"
                              value={activity.estimatedCost}
                              onChange={(e) => updateActivity(index, 'estimatedCost', parseFloat(e.target.value) || 0)}
                              className={inputClass}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className={labelClass}>Start</label>
                            <input
                              type="date"
                              value={activity.startDate}
                              onChange={(e) => updateActivity(index, 'startDate', e.target.value)}
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className={labelClass}>End</label>
                            <input
                              type="date"
                              value={activity.endDate}
                              onChange={(e) => updateActivity(index, 'endDate', e.target.value)}
                              className={inputClass}
                            />
                          </div>
                        </div>
                        <div>
                          <label className={labelClass}>Description</label>
                          <input
                            type="text"
                            value={activity.description}
                            onChange={(e) => updateActivity(index, 'description', e.target.value)}
                            className={inputClass}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="px-4 py-3 border-t border-card-border bg-card flex-shrink-0">
        {step === 'input' ? (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full px-4 py-2 text-sm font-bold text-white bg-accent-purple rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 uppercase tracking-tight flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <SolarSpinner className="w-3.5 h-3.5 animate-spin" />
                Generating...
              </>
            ) : (
              'Generate Plan'
            )}
          </button>
        ) : (
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleApply}
              disabled={selectedIds.size === 0}
              className="w-full px-4 py-2 text-sm font-bold text-white bg-accent-purple rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 uppercase tracking-tight"
            >
              Apply to Calendar ({selectedIds.size})
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep('input')}
                className="flex-1 px-3 py-1.5 text-xs font-bold text-foreground bg-muted rounded hover:opacity-80 transition-opacity uppercase tracking-tight"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="flex-1 px-3 py-1.5 text-xs font-bold text-foreground border border-card-border rounded hover:opacity-80 transition-opacity disabled:opacity-50 uppercase tracking-tight flex items-center justify-center gap-1"
              >
                {isGenerating ? (
                  <>
                    <SolarSpinner className="w-3 h-3 animate-spin" />
                    Regenerating...
                  </>
                ) : (
                  'Regenerate'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

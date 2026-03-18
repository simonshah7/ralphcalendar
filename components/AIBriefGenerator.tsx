'use client';

import { useState } from 'react';

export interface GeneratedActivity {
  title: string;
  startDate: string;
  endDate: string;
  estimatedCost: number;
  swimlaneSuggestion: string;
  description: string;
}

interface AIBriefGeneratorProps {
  isOpen: boolean;
  calendarId: string;
  swimlanes: Array<{ id: string; name: string }>;
  onClose: () => void;
  onApply: (activities: GeneratedActivity[]) => void;
}

interface BriefFormData {
  goal: string;
  budget: number;
  region: 'US' | 'EMEA' | 'ROW';
  startDate: string;
  endDate: string;
}

interface GeneratedPlan {
  suggestedName: string;
  activities: GeneratedActivity[];
}

type Step = 'input' | 'review';

export function AIBriefGenerator({
  isOpen,
  calendarId,
  swimlanes,
  onClose,
  onApply,
}: AIBriefGeneratorProps) {
  const [step, setStep] = useState<Step>('input');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<BriefFormData>({
    goal: '',
    budget: 0,
    region: 'US',
    startDate: '',
    endDate: '',
  });

  const [plan, setPlan] = useState<GeneratedPlan | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [editableActivities, setEditableActivities] = useState<GeneratedActivity[]>([]);

  const resetState = () => {
    setStep('input');
    setError(null);
    setPlan(null);
    setSelectedIds(new Set());
    setEditableActivities([]);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

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
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate campaign brief');
      }

      const result: GeneratedPlan = await response.json();
      setPlan(result);
      setEditableActivities([...result.activities]);
      setSelectedIds(new Set(result.activities.map((_, i) => i)));
      setStep('review');
    } catch {
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
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative bg-card rounded-lg shadow-xl max-w-4xl w-full mx-2 sm:mx-4 max-h-[90vh] flex flex-col border border-card-border">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-card-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent-purple/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-accent-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">AI Brief Generator</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {step === 'input' ? 'Describe your campaign goal and AI will generate a plan of activities with suggested channels, dates, and costs.' : 'Review the generated activities below. Edit any details, uncheck ones you don\'t need, then apply to your calendar.'}
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-foreground transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Step 1: Input */}
          {step === 'input' && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                  Campaign Goal *
                </label>
                <textarea
                  value={formData.goal}
                  onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
                  rows={3}
                  placeholder="e.g., Q3 product launch targeting enterprise EMEA"
                  className="w-full px-3 py-2 border border-card-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-accent-purple text-sm resize-none placeholder:text-gray-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Budget
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={formData.budget || ''}
                      onChange={(e) => setFormData({ ...formData, budget: parseFloat(e.target.value) || 0 })}
                      placeholder="50000"
                      className="w-full pl-7 pr-3 py-2 border border-card-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-accent-purple text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Region
                  </label>
                  <select
                    value={formData.region}
                    onChange={(e) => setFormData({ ...formData, region: e.target.value as BriefFormData['region'] })}
                    className="w-full px-3 py-2 border border-card-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-accent-purple text-sm"
                  >
                    <option value="US">US</option>
                    <option value="EMEA">EMEA</option>
                    <option value="ROW">ROW</option>
                  </select>
                </div>

                <div />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-card-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-accent-purple text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    End Date *
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-card-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-accent-purple text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Review */}
          {step === 'review' && plan && (
            <div className="space-y-5">
              {/* Suggested campaign name */}
              <div className="p-3 bg-accent-purple/5 border border-accent-purple/20 rounded-lg">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                  Suggested Campaign Name
                </p>
                <p className="text-base font-bold text-accent-purple">{plan.suggestedName}</p>
              </div>

              {/* Select all */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === editableActivities.length}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded border-card-border text-accent-purple focus:ring-accent-purple"
                  />
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Select All ({selectedIds.size}/{editableActivities.length})
                  </span>
                </label>
                <p className="text-sm text-foreground">
                  Total: <span className="font-bold text-accent-purple">${totalCost.toLocaleString()}</span>
                  {formData.budget > 0 && (
                    <span className={`ml-2 text-xs ${totalCost > formData.budget ? 'text-red-500' : 'text-green-500'}`}>
                      ({totalCost <= formData.budget ? 'within' : 'over'} budget)
                    </span>
                  )}
                </p>
              </div>

              {/* Activities */}
              <div className="space-y-3">
                {editableActivities.map((activity, index) => (
                  <div
                    key={index}
                    className={`border rounded-lg p-4 transition-colors ${
                      selectedIds.has(index)
                        ? 'border-accent-purple/40 bg-card'
                        : 'border-card-border bg-muted opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(index)}
                        onChange={() => toggleActivity(index)}
                        className="mt-1 w-4 h-4 rounded border-card-border text-accent-purple focus:ring-accent-purple"
                      />
                      <div className="flex-1 space-y-3">
                        {/* Title row */}
                        <div className="grid grid-cols-12 gap-2 sm:gap-3">
                          <div className="col-span-12 sm:col-span-6">
                            <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">
                              Title
                            </label>
                            <input
                              type="text"
                              value={activity.title}
                              onChange={(e) => updateActivity(index, 'title', e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-card-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-accent-purple"
                            />
                          </div>
                          <div className="col-span-6 sm:col-span-3">
                            <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">
                              Swimlane
                            </label>
                            <select
                              value={activity.swimlaneSuggestion}
                              onChange={(e) => updateActivity(index, 'swimlaneSuggestion', e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-card-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-accent-purple"
                            >
                              <option value={activity.swimlaneSuggestion}>{activity.swimlaneSuggestion}</option>
                              {swimlanes
                                .filter((s) => s.name !== activity.swimlaneSuggestion)
                                .map((s) => (
                                  <option key={s.id} value={s.name}>
                                    {s.name}
                                  </option>
                                ))}
                            </select>
                          </div>
                          <div className="col-span-6 sm:col-span-3">
                            <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">
                              Est. Cost
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="100"
                              value={activity.estimatedCost}
                              onChange={(e) => updateActivity(index, 'estimatedCost', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1 text-sm border border-card-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-accent-purple"
                            />
                          </div>
                        </div>

                        {/* Dates and description */}
                        <div className="grid grid-cols-12 gap-2 sm:gap-3">
                          <div className="col-span-6 sm:col-span-3">
                            <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">
                              Start
                            </label>
                            <input
                              type="date"
                              value={activity.startDate}
                              onChange={(e) => updateActivity(index, 'startDate', e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-card-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-accent-purple"
                            />
                          </div>
                          <div className="col-span-6 sm:col-span-3">
                            <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">
                              End
                            </label>
                            <input
                              type="date"
                              value={activity.endDate}
                              onChange={(e) => updateActivity(index, 'endDate', e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-card-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-accent-purple"
                            />
                          </div>
                          <div className="col-span-12 sm:col-span-6">
                            <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">
                              Description
                            </label>
                            <input
                              type="text"
                              value={activity.description}
                              onChange={(e) => updateActivity(index, 'description', e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-card-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-accent-purple"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-card-border flex flex-col-reverse sm:flex-row justify-between items-center gap-2">
          {step === 'input' ? (
            <>
              <div />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-1.5 text-xs font-bold text-foreground bg-muted rounded hover:opacity-80 transition-opacity uppercase tracking-tight"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="px-6 py-1.5 text-xs font-bold text-white bg-accent-purple rounded hover:opacity-90 transition-opacity disabled:opacity-50 uppercase tracking-tight flex items-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Generating...
                    </>
                  ) : (
                    'Generate Plan'
                  )}
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep('input')}
                className="px-4 py-1.5 text-xs font-bold text-foreground bg-muted rounded hover:opacity-80 transition-opacity uppercase tracking-tight"
              >
                Back
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="px-4 py-1.5 text-xs font-bold text-foreground border border-card-border rounded hover:opacity-80 transition-opacity disabled:opacity-50 uppercase tracking-tight flex items-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Regenerating...
                    </>
                  ) : (
                    'Regenerate'
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={selectedIds.size === 0}
                  className="px-6 py-1.5 text-xs font-bold text-white bg-accent-purple rounded hover:opacity-90 transition-opacity disabled:opacity-50 uppercase tracking-tight"
                >
                  Apply to Calendar ({selectedIds.size})
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

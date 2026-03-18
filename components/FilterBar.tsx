'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Campaign, Status } from '@/db/schema';

interface FilterBarProps {
  campaigns: Campaign[];
  statuses: Status[];
  searchQuery: string;
  selectedCampaignId: string | null;
  selectedStatusId: string | null;
  onSearchChange: (query: string) => void;
  onCampaignChange: (campaignId: string | null) => void;
  onStatusChange: (statusId: string | null) => void;
}

export function FilterBar({
  campaigns,
  statuses,
  searchQuery,
  selectedCampaignId,
  selectedStatusId,
  onSearchChange,
  onCampaignChange,
  onStatusChange,
}: FilterBarProps) {
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const campaignRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (campaignRef.current && !campaignRef.current.contains(event.target as Node)) {
        setCampaignOpen(false);
      }
      if (statusRef.current && !statusRef.current.contains(event.target as Node)) {
        setStatusOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId);
  const selectedStatus = statuses.find((s) => s.id === selectedStatusId);
  const hasActiveFilters = !!selectedCampaignId || !!selectedStatusId || !!searchQuery;

  return (
    <div className="bg-background border-b border-card-border px-4 py-2">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search activities..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-card border border-card-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-purple text-foreground"
            />
          </svg>
          <input
            type="text"
            placeholder="Search activities..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-muted border border-transparent rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:bg-card focus:border-accent/40 focus:ring-1 focus:ring-ring transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <span className="text-foreground">
                {selectedCampaign?.name || 'All Campaigns'}
              </span>
              <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
        </div>

        {/* Campaign Filter */}
        <div className="relative" ref={campaignRef}>
          <button
            onClick={() => { setCampaignOpen(!campaignOpen); setStatusOpen(false); }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${
              selectedCampaignId
                ? 'bg-accent-soft text-accent border border-accent/20 font-medium'
                : 'bg-muted text-muted-foreground hover:text-foreground border border-transparent'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            <span>{selectedCampaign?.name || 'Campaign'}</span>
            <svg className={`w-3.5 h-3.5 transition-transform ${campaignOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <AnimatePresence>
            {campaignOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full left-0 mt-1.5 w-52 bg-card rounded-xl shadow-lg shadow-black/8 border border-card-border z-50 overflow-hidden"
              >
                <div className="py-1">
                  <button
                    onClick={() => { onCampaignChange(null); setCampaignOpen(false); }}
                    className={`w-full px-3.5 py-2 text-left text-sm transition-colors ${
                      !selectedCampaignId ? 'bg-accent-soft text-accent font-medium' : 'text-foreground hover:bg-muted'
                    }`}
                  >
                    All Campaigns
                  </button>
                  {campaigns.map((campaign) => (
                    <button
                      key={campaign.id}
                      onClick={() => { onCampaignChange(campaign.id); setCampaignOpen(false); }}
                      className={`w-full px-3.5 py-2 text-left text-sm transition-colors ${
                        selectedCampaignId === campaign.id ? 'bg-accent-soft text-accent font-medium' : 'text-foreground hover:bg-muted'
                      }`}
                    >
                      {campaign.name}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

          {/* Status Filter */}
          <div className="relative" ref={statusRef}>
            <button
              onClick={() => setStatusOpen(!statusOpen)}
              className="flex items-center gap-2 px-3 py-2 bg-card border border-card-border rounded-lg text-sm hover:bg-muted"
            >
              {selectedStatus && (
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: selectedStatus.color }}
                />
              )}
              <span className="text-foreground">
                {selectedStatus?.name || 'All Statuses'}
              </span>
              <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {statusOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full left-0 mt-1.5 w-48 bg-card rounded-xl shadow-lg shadow-black/8 border border-card-border z-50 overflow-hidden"
              >
                <div className="py-1">
                  <button
                    onClick={() => { onStatusChange(null); setStatusOpen(false); }}
                    className={`w-full px-3.5 py-2 text-left text-sm transition-colors ${
                      !selectedStatusId ? 'bg-accent-soft text-accent font-medium' : 'text-foreground hover:bg-muted'
                    }`}
                  >
                    All Statuses
                  </button>
                  {statuses.map((status) => (
                    <button
                      key={status.id}
                      onClick={() => { onStatusChange(status.id); setStatusOpen(false); }}
                      className={`w-full px-3.5 py-2 text-left text-sm flex items-center gap-2.5 transition-colors ${
                        selectedStatusId === status.id ? 'bg-accent-soft text-accent font-medium' : 'text-foreground hover:bg-muted'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full ring-1 ring-black/10" style={{ backgroundColor: status.color }} />
                      {status.name}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Clear All Filters */}
        <AnimatePresence>
          {hasActiveFilters && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={() => {
                onSearchChange('');
                onCampaignChange(null);
                onStatusChange(null);
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear filters
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

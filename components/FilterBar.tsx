'use client';

import { useState, useRef, useEffect } from 'react';
import { ThemeToggle } from './ThemeToggle';
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

  return (
    <div className="bg-background border-b border-card-border px-4 py-2">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
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
          </div>

          {/* Campaign Filter */}
          <div className="relative" ref={campaignRef}>
            <button
              onClick={() => setCampaignOpen(!campaignOpen)}
              className="flex items-center gap-2 px-3 py-2 bg-card border border-card-border rounded-lg text-sm hover:bg-muted"
            >
              <span className="text-foreground">
                {selectedCampaign?.name || 'All Campaigns'}
              </span>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {campaignOpen && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-card rounded-lg shadow-lg border border-card-border z-50">
                <button
                  onClick={() => {
                    onCampaignChange(null);
                    setCampaignOpen(false);
                  }}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-muted ${!selectedCampaignId ? 'bg-accent-purple/10 text-accent-purple' : 'text-foreground'
                    }`}
                >
                  All Campaigns
                </button>
                {campaigns.map((campaign) => (
                  <button
                    key={campaign.id}
                    onClick={() => {
                      onCampaignChange(campaign.id);
                      setCampaignOpen(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-muted ${selectedCampaignId === campaign.id
                      ? 'bg-accent-purple/10 text-accent-purple'
                      : 'text-foreground'
                      }`}
                  >
                    {campaign.name}
                  </button>
                ))}
              </div>
            )}
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
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {statusOpen && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-card rounded-lg shadow-lg border border-card-border z-50">
                <button
                  onClick={() => {
                    onStatusChange(null);
                    setStatusOpen(false);
                  }}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-muted ${!selectedStatusId ? 'bg-accent-purple/10 text-accent-purple' : 'text-foreground'
                    }`}
                >
                  All Statuses
                </button>
                {statuses.map((status) => (
                  <button
                    key={status.id}
                    onClick={() => {
                      onStatusChange(status.id);
                      setStatusOpen(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-muted flex items-center gap-2 ${selectedStatusId === status.id
                      ? 'bg-accent-purple/10 text-accent-purple'
                      : 'text-foreground'
                      }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: status.color }}
                    />
                    {status.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Theme Toggle */}
        <ThemeToggle />
      </div>
    </div>
  );
}

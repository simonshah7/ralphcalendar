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
    <div className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-2">
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
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
            />
          </div>

          {/* Campaign Filter */}
          <div className="relative" ref={campaignRef}>
            <button
              onClick={() => setCampaignOpen(!campaignOpen)}
              className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <span className="text-gray-700 dark:text-gray-200">
                {selectedCampaign?.name || 'All Campaigns'}
              </span>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {campaignOpen && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                <button
                  onClick={() => {
                    onCampaignChange(null);
                    setCampaignOpen(false);
                  }}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                    !selectedCampaignId ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'text-gray-900 dark:text-white'
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
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      selectedCampaignId === campaign.id
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600'
                        : 'text-gray-900 dark:text-white'
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
              className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {selectedStatus && (
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: selectedStatus.color }}
                />
              )}
              <span className="text-gray-700 dark:text-gray-200">
                {selectedStatus?.name || 'All Statuses'}
              </span>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {statusOpen && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                <button
                  onClick={() => {
                    onStatusChange(null);
                    setStatusOpen(false);
                  }}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                    !selectedStatusId ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'text-gray-900 dark:text-white'
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
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 ${
                      selectedStatusId === status.id
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600'
                        : 'text-gray-900 dark:text-white'
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

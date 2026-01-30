'use client';

import { useState, useRef, useEffect } from 'react';
import { Campaign } from '@/db/schema';

interface CampaignDropdownProps {
    campaigns: Campaign[];
    selectedCampaignId: string | null;
    calendarId: string;
    onSelect: (campaignId: string | null) => void;
    onCampaignsChange: () => void;
}

export function CampaignDropdown({
    campaigns,
    selectedCampaignId,
    calendarId,
    onSelect,
    onCampaignsChange,
}: CampaignDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [newName, setNewName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setEditingId(null);
                setIsAdding(false);
                setError(null);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredCampaigns = campaigns.filter((c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId);

    const handleCreate = async () => {
        if (!newName.trim()) return;
        setIsSubmitting(true);
        setError(null);
        try {
            const response = await fetch('/api/campaigns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ calendarId, name: newName.trim() }),
            });
            if (!response.ok) throw new Error('Failed to create campaign');
            const data = await response.json();
            setIsAdding(false);
            setNewName('');
            onCampaignsChange();
            onSelect(data.id);
        } catch (err) {
            setError('Failed to create campaign');
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdate = async (id: string) => {
        if (!editName.trim()) return;
        setIsSubmitting(true);
        setError(null);
        try {
            const response = await fetch(`/api/campaigns/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: editName.trim() }),
            });
            if (!response.ok) throw new Error('Failed to update campaign');
            setEditingId(null);
            onCampaignsChange();
        } catch (err) {
            setError('Failed to update campaign');
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this campaign? All activities in this campaign will be set to "None".')) return;

        setIsSubmitting(true);
        setError(null);
        try {
            const response = await fetch(`/api/campaigns/${id}`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error('Failed to delete campaign');
            if (selectedCampaignId === id) {
                onSelect(null);
            }
            onCampaignsChange();
        } catch (err) {
            setError('Failed to delete campaign');
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const startEditing = (e: React.MouseEvent, campaign: Campaign) => {
        e.stopPropagation();
        setEditingId(campaign.id);
        setEditName(campaign.name);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-3 py-2 border border-card-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent-purple"
            >
                <span className={selectedCampaign ? 'text-foreground' : 'text-gray-500'}>
                    {selectedCampaign?.name || 'Select campaign'}
                </span>
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-full bg-card rounded-lg shadow-xl border border-card-border z-50 flex flex-col max-h-80">
                    <div className="p-2 border-b border-card-border">
                        <input
                            type="text"
                            placeholder="Search or add..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-3 py-1.5 bg-background border border-card-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-accent-purple"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && searchQuery.trim() && !filteredCampaigns.some(c => c.name.toLowerCase() === searchQuery.toLowerCase())) {
                                    setNewName(searchQuery);
                                    handleCreate();
                                }
                            }}
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        <button
                            type="button"
                            onClick={() => {
                                onSelect(null);
                                setIsOpen(false);
                            }}
                            className={`w-full px-4 py-2 text-left text-sm hover:bg-muted ${!selectedCampaignId ? 'bg-accent-purple/10 text-accent-purple font-medium' : 'text-foreground'}`}
                        >
                            None
                        </button>

                        {filteredCampaigns.map((campaign) => (
                            <div
                                key={campaign.id}
                                className={`group flex items-center justify-between px-4 py-2 text-sm hover:bg-muted cursor-pointer ${selectedCampaignId === campaign.id ? 'bg-accent-purple/10 text-accent-purple font-medium' : 'text-foreground'}`}
                                onClick={() => {
                                    if (editingId !== campaign.id) {
                                        onSelect(campaign.id);
                                        setIsOpen(false);
                                    }
                                }}
                            >
                                {editingId === campaign.id ? (
                                    <div className="flex items-center gap-2 flex-1" onClick={e => e.stopPropagation()}>
                                        <input
                                            autoFocus
                                            type="text"
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            className="flex-1 px-2 py-1 bg-background border border-accent-purple rounded text-sm focus:outline-none"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleUpdate(campaign.id);
                                                if (e.key === 'Escape') setEditingId(null);
                                            }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleUpdate(campaign.id)}
                                            disabled={isSubmitting}
                                            className="text-accent-purple hover:text-accent-purple/80"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEditingId(null)}
                                            className="text-gray-400 hover:text-gray-600"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <span className="truncate flex-1">{campaign.name}</span>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                type="button"
                                                onClick={(e) => startEditing(e, campaign)}
                                                className="p-1 text-gray-400 hover:text-accent-purple"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                </svg>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => handleDelete(e, campaign.id)}
                                                className="p-1 text-gray-400 hover:text-red-500"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}

                        {searchQuery && !filteredCampaigns.some(c => c.name.toLowerCase() === searchQuery.toLowerCase()) && (
                            <button
                                type="button"
                                onClick={handleCreate}
                                disabled={isSubmitting}
                                className="w-full px-4 py-2 text-left text-sm text-accent-purple hover:bg-muted flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Create "{searchQuery}"
                            </button>
                        )}
                    </div>

                    {error && (
                        <div className="p-2 bg-red-50 text-red-600 text-xs text-center border-t border-red-100">
                            {error}
                        </div>
                    )}

                    <div className="p-2 border-t border-card-border bg-muted/30">
                        {isAdding ? (
                            <div className="flex items-center gap-2">
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="New campaign name"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    className="flex-1 px-3 py-1.5 bg-background border border-card-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-accent-purple"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleCreate();
                                        if (e.key === 'Escape') setIsAdding(false);
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={handleCreate}
                                    disabled={isSubmitting}
                                    className="p-1.5 bg-accent-purple text-white rounded hover:bg-accent-purple/90 disabled:opacity-50"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsAdding(false)}
                                    className="p-1.5 bg-gray-200 text-gray-600 rounded hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setIsAdding(true)}
                                className="w-full py-1.5 text-sm font-medium text-foreground hover:bg-muted rounded border border-dashed border-card-border flex items-center justify-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                Add New Campaign
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

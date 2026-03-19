'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Campaign } from '@/db/schema';
import { SolarAltArrowDown, SolarCheckLinear, SolarCloseLinear, SolarPenLinear, SolarTrashBinLinear, SolarAddLinear } from '@/components/SolarIcons';

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
        if (!confirm('Delete this campaign? Activities will be set to "None".')) return;
        setIsSubmitting(true);
        setError(null);
        try {
            const response = await fetch(`/api/campaigns/${id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete campaign');
            if (selectedCampaignId === id) onSelect(null);
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
                className="w-full flex items-center justify-between px-3 py-1.5 border border-card-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-accent/40 focus:border-accent/40 text-sm"
            >
                <span className={selectedCampaign ? 'text-foreground' : 'text-muted-foreground'}>
                    {selectedCampaign?.name || 'Select campaign'}
                </span>
                <SolarAltArrowDown className="w-4 h-4 text-muted-foreground" />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -4, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.98 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full left-0 mt-1.5 w-full bg-card rounded-xl shadow-lg shadow-black/8 border border-card-border z-50 flex flex-col max-h-80"
                    >
                        <div className="p-2 border-b border-card-border">
                            <input
                                type="text"
                                placeholder="Search or add..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-muted border-none rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-accent/40 text-foreground placeholder:text-muted-foreground"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && searchQuery.trim() && !filteredCampaigns.some(c => c.name.toLowerCase() === searchQuery.toLowerCase())) {
                                        setNewName(searchQuery);
                                        handleCreate();
                                    }
                                }}
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto py-1">
                            <button
                                type="button"
                                onClick={() => { onSelect(null); setIsOpen(false); }}
                                className={`w-full px-3.5 py-2 text-left text-sm transition-colors ${
                                    !selectedCampaignId ? 'bg-accent-soft text-accent font-medium' : 'text-foreground hover:bg-muted'
                                }`}
                            >
                                None
                            </button>

                            {filteredCampaigns.map((campaign) => (
                                <button
                                    type="button"
                                    key={campaign.id}
                                    className={`group w-full flex items-center justify-between px-3.5 py-2 text-sm cursor-pointer transition-colors ${
                                        selectedCampaignId === campaign.id ? 'bg-accent-soft text-accent font-medium' : 'text-foreground hover:bg-muted'
                                    }`}
                                    onClick={() => {
                                        if (editingId !== campaign.id) { onSelect(campaign.id); setIsOpen(false); }
                                    }}
                                >
                                    {editingId === campaign.id ? (
                                        <div className="flex items-center gap-2 flex-1" onClick={e => e.stopPropagation()}>
                                            <input
                                                autoFocus
                                                type="text"
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                className="flex-1 px-2 py-1 bg-background border border-accent/40 rounded-md text-sm focus:outline-none"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleUpdate(campaign.id);
                                                    if (e.key === 'Escape') setEditingId(null);
                                                }}
                                            />
                                            <button type="button" onClick={() => handleUpdate(campaign.id)} disabled={isSubmitting} className="text-accent hover:text-accent-hover">
                                                <SolarCheckLinear className="w-4 h-4" />
                                            </button>
                                            <button type="button" onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground">
                                                <SolarCloseLinear className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <span className="truncate flex-1">{campaign.name}</span>
                                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button type="button" onClick={(e) => startEditing(e, campaign)} className="p-1 text-muted-foreground hover:text-accent rounded transition-colors">
                                                    <SolarPenLinear className="w-3 h-3" />
                                                </button>
                                                <button type="button" onClick={(e) => handleDelete(e, campaign.id)} className="p-1 text-muted-foreground hover:text-danger rounded transition-colors">
                                                    <SolarTrashBinLinear className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </button>
                            ))}

                            {searchQuery && !filteredCampaigns.some(c => c.name.toLowerCase() === searchQuery.toLowerCase()) && (
                                <button
                                    type="button"
                                    onClick={handleCreate}
                                    disabled={isSubmitting}
                                    className="p-1.5 bg-accent-purple-btn text-white rounded hover:opacity-90 disabled:opacity-50"
                                >
                                    <SolarAddLinear className="w-3.5 h-3.5" />
                                    Create &ldquo;{searchQuery}&rdquo;
                                </button>
                            )}
                        </div>

                        {error && (
                            <div className="p-2 bg-danger-soft text-danger text-xs text-center border-t border-card-border">
                                {error}
                            </div>
                        )}

                        <div className="p-2 border-t border-card-border">
                            {isAdding ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        autoFocus
                                        type="text"
                                        placeholder="New campaign name"
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        className="flex-1 px-2.5 py-1.5 bg-muted border-none rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-accent/40"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleCreate();
                                            if (e.key === 'Escape') setIsAdding(false);
                                        }}
                                    />
                                    <button type="button" onClick={handleCreate} disabled={isSubmitting} className="p-1.5 bg-accent text-white rounded-md hover:bg-accent-hover disabled:opacity-50 transition-colors">
                                        <SolarCheckLinear className="w-3.5 h-3.5" />
                                    </button>
                                    <button type="button" onClick={() => setIsAdding(false)} className="p-1.5 bg-muted text-muted-foreground rounded-md hover:bg-card-hover transition-colors">
                                        <SolarCloseLinear className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setIsAdding(false)}
                                    className="p-1.5 bg-muted text-foreground rounded hover:opacity-80"
                                >
                                    <SolarAddLinear className="w-3.5 h-3.5" />
                                    New Campaign
                                </button>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

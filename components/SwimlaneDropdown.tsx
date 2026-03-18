'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Swimlane } from '@/db/schema';

interface SwimlaneDropdownProps {
    swimlanes: Swimlane[];
    selectedSwimlaneId: string;
    calendarId: string;
    onSelect: (swimlaneId: string) => void;
    onSwimlanesChange: () => void;
}

export function SwimlaneDropdown({
    swimlanes,
    selectedSwimlaneId,
    calendarId,
    onSelect,
    onSwimlanesChange,
}: SwimlaneDropdownProps) {
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

    const filteredSwimlanes = swimlanes.filter((s) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const selectedSwimlane = swimlanes.find((s) => s.id === selectedSwimlaneId);

    const handleCreate = async () => {
        if (!newName.trim()) return;
        setIsSubmitting(true);
        setError(null);
        try {
            const response = await fetch('/api/swimlanes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ calendarId, name: newName.trim() }),
            });
            if (!response.ok) throw new Error('Failed to create swimlane');
            const data = await response.json();
            setIsAdding(false);
            setNewName('');
            onSwimlanesChange();
            onSelect(data.id);
        } catch (err) {
            setError('Failed to create swimlane');
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
            const response = await fetch(`/api/swimlanes/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: editName.trim() }),
            });
            if (!response.ok) throw new Error('Failed to update swimlane');
            setEditingId(null);
            onSwimlanesChange();
        } catch (err) {
            setError('Failed to update swimlane');
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm('Delete this swimlane? Activities in it will also be deleted.')) return;
        setIsSubmitting(true);
        setError(null);
        try {
            const response = await fetch(`/api/swimlanes/${id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete swimlane');
            if (selectedSwimlaneId === id) onSelect('');
            onSwimlanesChange();
        } catch (err) {
            setError('Failed to delete swimlane');
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const startEditing = (e: React.MouseEvent, swimlane: Swimlane) => {
        e.stopPropagation();
        setEditingId(swimlane.id);
        setEditName(swimlane.name);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-3 py-1.5 border border-card-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-accent-purple text-sm"
            >
                <span className={selectedSwimlane ? 'text-foreground' : 'text-muted-foreground'}>
                    {selectedSwimlane?.name || 'Select swimlane'}
                </span>
                <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
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
                                    if (e.key === 'Enter' && searchQuery.trim() && !filteredSwimlanes.some(s => s.name.toLowerCase() === searchQuery.toLowerCase())) {
                                        setNewName(searchQuery);
                                        handleCreate();
                                    }
                                }}
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto py-1">
                            {filteredSwimlanes.map((swimlane) => (
                                <div
                                    key={swimlane.id}
                                    className={`group flex items-center justify-between px-3.5 py-2 text-sm cursor-pointer transition-colors ${
                                        selectedSwimlaneId === swimlane.id ? 'bg-accent-soft text-accent font-medium' : 'text-foreground hover:bg-muted'
                                    }`}
                                    onClick={() => {
                                        if (editingId !== swimlane.id) { onSelect(swimlane.id); setIsOpen(false); }
                                    }}
                                >
                                    {editingId === swimlane.id ? (
                                        <div className="flex items-center gap-2 flex-1" onClick={e => e.stopPropagation()}>
                                            <input
                                                autoFocus
                                                type="text"
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                className="flex-1 px-2 py-1 bg-background border border-accent/40 rounded-md text-sm focus:outline-none"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleUpdate(swimlane.id);
                                                    if (e.key === 'Escape') setEditingId(null);
                                                }}
                                            />
                                            <button type="button" onClick={() => handleUpdate(swimlane.id)} disabled={isSubmitting} className="text-accent hover:text-accent-hover">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            </button>
                                            <button type="button" onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <span className="truncate flex-1">{swimlane.name}</span>
                                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button type="button" onClick={(e) => startEditing(e, swimlane)} className="p-1 text-muted-foreground hover:text-accent rounded transition-colors">
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                                                    </svg>
                                                </button>
                                                <button type="button" onClick={(e) => handleDelete(e, swimlane.id)} className="p-1 text-muted-foreground hover:text-danger rounded transition-colors">
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}

                            {searchQuery && !filteredSwimlanes.some(s => s.name.toLowerCase() === searchQuery.toLowerCase()) && (
                                <button
                                    type="button"
                                    onClick={() => { setNewName(searchQuery); handleCreate(); }}
                                    disabled={isSubmitting}
                                    className="w-full px-3.5 py-2 text-left text-sm text-accent hover:bg-muted transition-colors flex items-center gap-2"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                    </svg>
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
                                        placeholder="New swimlane name"
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        className="flex-1 px-2.5 py-1.5 bg-muted border-none rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-accent/40"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleCreate();
                                            if (e.key === 'Escape') { setIsAdding(false); setNewName(''); }
                                        }}
                                    />
                                    <button type="button" onClick={handleCreate} disabled={isSubmitting} className="p-1.5 bg-accent text-white rounded-md hover:bg-accent-hover disabled:opacity-50 transition-colors">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                    </button>
                                    <button type="button" onClick={() => { setIsAdding(false); setNewName(''); }} className="p-1.5 bg-muted text-muted-foreground rounded-md hover:bg-card-hover transition-colors">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setIsAdding(true)}
                                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                    </svg>
                                    New Swimlane
                                </button>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

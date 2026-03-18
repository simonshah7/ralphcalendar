'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Status } from '@/db/schema';

interface StatusDropdownProps {
    statuses: Status[];
    selectedStatusId: string;
    calendarId: string;
    onSelect: (statusId: string) => void;
    onStatusesChange: () => void;
}

const DEFAULT_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#6B7280'];

export function StatusDropdown({
    statuses,
    selectedStatusId,
    calendarId,
    onSelect,
    onStatusesChange,
}: StatusDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editColor, setEditColor] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [newName, setNewName] = useState('');
    const [newColor, setNewColor] = useState(DEFAULT_COLORS[0]);
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

    const filteredStatuses = statuses.filter((s) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const selectedStatus = statuses.find((s) => s.id === selectedStatusId);

    const handleCreate = async () => {
        if (!newName.trim()) return;
        setIsSubmitting(true);
        setError(null);
        try {
            const response = await fetch('/api/statuses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ calendarId, name: newName.trim(), color: newColor }),
            });
            if (!response.ok) throw new Error('Failed to create status');
            const data = await response.json();
            setIsAdding(false);
            setNewName('');
            setNewColor(DEFAULT_COLORS[0]);
            onStatusesChange();
            onSelect(data.id);
        } catch (err) {
            setError('Failed to create status');
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
            const response = await fetch(`/api/statuses/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: editName.trim(), color: editColor }),
            });
            if (!response.ok) throw new Error('Failed to update status');
            setEditingId(null);
            onStatusesChange();
        } catch (err) {
            setError('Failed to update status');
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm('Delete this status? Activities using it will have no status.')) return;
        setIsSubmitting(true);
        setError(null);
        try {
            const response = await fetch(`/api/statuses/${id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete status');
            if (selectedStatusId === id) onSelect('');
            onStatusesChange();
        } catch (err) {
            setError('Failed to delete status');
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const startEditing = (e: React.MouseEvent, status: Status) => {
        e.stopPropagation();
        setEditingId(status.id);
        setEditName(status.name);
        setEditColor(status.color);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-3 py-1.5 border border-card-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-accent-purple text-sm"
            >
                <span className="flex items-center gap-2">
                    {selectedStatus && (
                        <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: selectedStatus.color }}
                        />
                    )}
                    <span className={selectedStatus ? 'text-foreground' : 'text-muted-foreground'}>
                        {selectedStatus?.name || 'Select status'}
                    </span>
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
                                    if (e.key === 'Enter' && searchQuery.trim() && !filteredStatuses.some(s => s.name.toLowerCase() === searchQuery.toLowerCase())) {
                                        setNewName(searchQuery);
                                        setIsAdding(true);
                                    }
                                }}
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto py-1">
                            {filteredStatuses.map((status) => (
                                <div
                                    key={status.id}
                                    className={`group flex items-center justify-between px-3.5 py-2 text-sm cursor-pointer transition-colors ${
                                        selectedStatusId === status.id ? 'bg-accent-soft text-accent font-medium' : 'text-foreground hover:bg-muted'
                                    }`}
                                    onClick={() => {
                                        if (editingId !== status.id) { onSelect(status.id); setIsOpen(false); }
                                    }}
                                >
                                    {editingId === status.id ? (
                                        <div className="flex items-center gap-2 flex-1" onClick={e => e.stopPropagation()}>
                                            <input
                                                type="color"
                                                value={editColor}
                                                onChange={(e) => setEditColor(e.target.value)}
                                                className="w-6 h-6 rounded border border-card-border cursor-pointer p-0"
                                            />
                                            <input
                                                autoFocus
                                                type="text"
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                className="flex-1 px-2 py-1 bg-background border border-accent/40 rounded-md text-sm focus:outline-none"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleUpdate(status.id);
                                                    if (e.key === 'Escape') setEditingId(null);
                                                }}
                                            />
                                            <button type="button" onClick={() => handleUpdate(status.id)} disabled={isSubmitting} className="text-accent hover:text-accent-hover">
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
                                            <span className="flex items-center gap-2 truncate flex-1">
                                                <span
                                                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                                    style={{ backgroundColor: status.color }}
                                                />
                                                {status.name}
                                            </span>
                                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button type="button" onClick={(e) => startEditing(e, status)} className="p-1 text-muted-foreground hover:text-accent rounded transition-colors">
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                                                    </svg>
                                                </button>
                                                <button type="button" onClick={(e) => handleDelete(e, status.id)} className="p-1 text-muted-foreground hover:text-danger rounded transition-colors">
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}

                            {searchQuery && !filteredStatuses.some(s => s.name.toLowerCase() === searchQuery.toLowerCase()) && (
                                <button
                                    type="button"
                                    onClick={() => { setNewName(searchQuery); setIsAdding(true); }}
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
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={newColor}
                                            onChange={(e) => setNewColor(e.target.value)}
                                            className="w-6 h-6 rounded border border-card-border cursor-pointer p-0"
                                        />
                                        <input
                                            autoFocus
                                            type="text"
                                            placeholder="New status name"
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
                                    <div className="flex gap-1 px-1">
                                        {DEFAULT_COLORS.map((c) => (
                                            <button
                                                key={c}
                                                type="button"
                                                onClick={() => setNewColor(c)}
                                                className={`w-5 h-5 rounded-full border-2 transition-all ${newColor === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                                                style={{ backgroundColor: c }}
                                            />
                                        ))}
                                    </div>
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
                                    New Status
                                </button>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

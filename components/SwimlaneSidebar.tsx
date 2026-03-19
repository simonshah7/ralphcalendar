'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Swimlane } from '@/db/schema';
import { ConfirmDialog } from './ConfirmDialog';
import { SolarAddLinear, SolarUsersGroupRounded, SolarDragHandle, SolarPenLinear, SolarTrashBinLinear } from './SolarIcons';

interface SwimlaneSidebarProps {
  swimlanes: Swimlane[];
  rowHeights: number[];
  headerHeight: number;
  sidebarWidth: number;
  onSidebarWidthChange: (width: number) => void;
  onAddSwimlane: (name: string) => void;
  onEditSwimlane: (id: string, name: string) => void;
  onDeleteSwimlane: (id: string) => void;
  onReorderSwimlanes: (swimlaneId: string, newIndex: number) => void;
  eventsRowHeight?: number;
}

export function SwimlaneSidebar({
  swimlanes,
  rowHeights,
  headerHeight,
  sidebarWidth,
  onSidebarWidthChange,
  onAddSwimlane,
  onEditSwimlane,
  onDeleteSwimlane,
  onReorderSwimlanes,
  eventsRowHeight,
}: SwimlaneSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newSwimlaneValue, setNewSwimlaneValue] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const editInputRef = useRef<HTMLInputElement>(null);
  const newInputRef = useRef<HTMLInputElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = Math.max(150, Math.min(400, e.clientX));
      onSidebarWidthChange(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, onSidebarWidthChange]);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  useEffect(() => {
    if (isAddingNew && newInputRef.current) {
      newInputRef.current.focus();
    }
  }, [isAddingNew]);

  const handleStartEdit = (swimlane: Swimlane) => {
    setEditingId(swimlane.id);
    setEditValue(swimlane.name);
  };

  const handleSaveEdit = () => {
    if (editingId && editValue.trim()) {
      onEditSwimlane(editingId, editValue.trim());
    }
    setEditingId(null);
    setEditValue('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const handleAddNew = () => {
    if (newSwimlaneValue.trim()) {
      onAddSwimlane(newSwimlaneValue.trim());
      setNewSwimlaneValue('');
      setIsAddingNew(false);
    }
  };

  const handleCancelAdd = () => {
    setNewSwimlaneValue('');
    setIsAddingNew(false);
  };

  const handleDragStart = (e: React.DragEvent, swimlaneId: string) => {
    setDraggedId(swimlaneId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', swimlaneId);
  };

  const handleDragOver = (e: React.DragEvent, swimlaneId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedId && draggedId !== swimlaneId) setDragOverId(swimlaneId);
  };

  const handleDragLeave = () => setDragOverId(null);

  const handleDrop = (e: React.DragEvent, targetSwimlaneId: string) => {
    e.preventDefault();
    if (draggedId && draggedId !== targetSwimlaneId) {
      const targetIndex = swimlanes.findIndex(s => s.id === targetSwimlaneId);
      if (targetIndex !== -1) onReorderSwimlanes(draggedId, targetIndex);
    }
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  const swimlaneToDelete = swimlanes.find(s => s.id === deleteConfirm);

  return (
    <div
      className="flex-shrink-0 border-r border-card-border bg-sidebar-bg relative select-none"
      style={{ width: `${sidebarWidth}px` }}
    >
      {/* Header */}
      <div
        className="border-b border-card-border px-3 py-2 flex items-center justify-between bg-surface"
        style={{ height: `${headerHeight}px` }}
      >
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Channels
        </span>
        <button
          onClick={() => setIsAddingNew(true)}
          className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-accent transition-colors"
          title="Add channel"
        >
          <SolarAddLinear className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* New Swimlane Input */}
      {isAddingNew && (
        <div className="px-2.5 py-2.5 border-b border-card-border bg-accent-soft/50">
          <input
            ref={newInputRef}
            type="text"
            value={newSwimlaneValue}
            onChange={(e) => setNewSwimlaneValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddNew();
              if (e.key === 'Escape') handleCancelAdd();
            }}
            placeholder="Swimlane name..."
            className="w-full px-2 py-1 text-sm border border-card-border rounded bg-background text-foreground focus:ring-2 focus:ring-accent-purple focus:border-transparent"
          />
          <div className="flex gap-1.5 mt-2">
            <button
              onClick={handleAddNew}
              disabled={!newSwimlaneValue.trim()}
              className="flex-1 px-2 py-1 text-xs bg-accent-purple-btn text-white rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add
            </button>
            <button
              onClick={handleCancelAdd}
              className="flex-1 px-2 py-1 text-xs bg-muted text-foreground rounded hover:opacity-80"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Events Row Label */}
      {eventsRowHeight && eventsRowHeight > 0 && (
        <div
          className="flex items-center px-3 border-b-2 border-accent/20 bg-accent/5"
          style={{ height: `${eventsRowHeight}px` }}
        >
          <div className="flex items-center gap-1.5">
            <SolarUsersGroupRounded className="w-3.5 h-3.5 text-accent" />
            <span className="text-xs font-semibold text-accent truncate">Events</span>
          </div>
        </div>
      )}

      {/* Swimlane List */}
      {swimlanes.map((swimlane, index) => (
        <div
          key={swimlane.id}
          draggable={editingId !== swimlane.id}
          onDragStart={(e) => handleDragStart(e, swimlane.id)}
          onDragOver={(e) => handleDragOver(e, swimlane.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, swimlane.id)}
          onDragEnd={handleDragEnd}
          className={`
            px-2 border-b border-card-border/50 flex items-center gap-2 group
            ${draggedId === swimlane.id ? 'opacity-50' : ''}
            ${dragOverId === swimlane.id ? 'bg-accent-purple/10 border-t-2 border-t-accent-purple' : ''}
            ${editingId === swimlane.id ? 'bg-muted' : ''}
          `}
          style={{ height: `${rowHeights[index]}px` }}
        >
          {/* Drag Handle */}
          <div className="cursor-grab opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground flex-shrink-0">
            <SolarDragHandle className="w-4 h-4" />
          </div>

          {editingId === swimlane.id ? (
            <div className="flex-1 flex items-center gap-1">
              <input
                ref={editInputRef}
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit();
                  if (e.key === 'Escape') handleCancelEdit();
                }}
                onBlur={handleSaveEdit}
                className="flex-1 px-2 py-1 text-sm border border-card-border rounded bg-background text-foreground focus:ring-2 focus:ring-accent-purple focus:border-transparent"
              />
            </div>
          ) : (
            <>
              <span
                className="flex-1 text-sm font-medium text-foreground truncate cursor-pointer hover:text-accent-purple"
                onDoubleClick={() => handleStartEdit(swimlane)}
                title="Double-click to edit"
              >
                {swimlane.name}
              </span>

              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleStartEdit(swimlane)}
                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                  title="Edit swimlane"
                >
                  <SolarPenLinear className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setDeleteConfirm(swimlane.id)}
                  className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
                  title="Delete swimlane"
                >
                  <SolarTrashBinLinear className="w-3 h-3" />
                </button>
              </div>
            </>
          )}
        </div>
      ))}

      {/* Empty State */}
      {swimlanes.length === 0 && !isAddingNew && (
        <div className="px-3 py-4 text-center">
          <p className="text-sm text-muted-foreground mb-2">No swimlanes yet</p>
          <button
            onClick={() => setIsAddingNew(true)}
            className="text-sm text-accent-purple hover:underline"
          >
            Add your first channel
          </button>
        </div>
      )}

      {/* Resize Handle */}
      <div
        ref={resizeRef}
        onMouseDown={handleResizeMouseDown}
        className={`
          absolute top-0 right-0 w-1 h-full cursor-col-resize
          hover:bg-accent-purple transition-colors
          ${isResizing ? 'bg-accent-purple' : 'bg-transparent hover:bg-accent-purple/70'}
        `}
        title="Drag to resize"
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        title="Delete Channel"
        message={`Are you sure you want to delete "${swimlaneToDelete?.name}"? All activities in this channel will also be deleted.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (deleteConfirm) {
            onDeleteSwimlane(deleteConfirm);
            setDeleteConfirm(null);
          }
        }}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}

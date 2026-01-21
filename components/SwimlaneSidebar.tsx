'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Swimlane } from '@/db/schema';
import { ConfirmDialog } from './ConfirmDialog';

interface SwimlaneSidebarProps {
  swimlanes: Swimlane[];
  rowHeight: number;
  headerHeight: number;
  sidebarWidth: number;
  onSidebarWidthChange: (width: number) => void;
  onAddSwimlane: (name: string) => void;
  onEditSwimlane: (id: string, name: string) => void;
  onDeleteSwimlane: (id: string) => void;
  onReorderSwimlanes: (swimlaneId: string, newIndex: number) => void;
}

export function SwimlaneSidebar({
  swimlanes,
  rowHeight,
  headerHeight,
  sidebarWidth,
  onSidebarWidthChange,
  onAddSwimlane,
  onEditSwimlane,
  onDeleteSwimlane,
  onReorderSwimlanes,
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

  // Handle sidebar width resizing
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

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, onSidebarWidthChange]);

  // Focus edit input when editing starts
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  // Focus new input when adding
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

  // Drag and drop reordering
  const handleDragStart = (e: React.DragEvent, swimlaneId: string) => {
    setDraggedId(swimlaneId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', swimlaneId);
  };

  const handleDragOver = (e: React.DragEvent, swimlaneId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedId && draggedId !== swimlaneId) {
      setDragOverId(swimlaneId);
    }
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = (e: React.DragEvent, targetSwimlaneId: string) => {
    e.preventDefault();
    if (draggedId && draggedId !== targetSwimlaneId) {
      const targetIndex = swimlanes.findIndex(s => s.id === targetSwimlaneId);
      if (targetIndex !== -1) {
        onReorderSwimlanes(draggedId, targetIndex);
      }
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
      className="flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 relative select-none"
      style={{ width: `${sidebarWidth}px` }}
    >
      {/* Header */}
      <div
        className="border-b border-gray-200 dark:border-gray-700 px-3 py-2 flex items-center justify-between"
        style={{ height: `${headerHeight}px` }}
      >
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
          Swimlanes
        </span>
        <button
          onClick={() => setIsAddingNew(true)}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          title="Add swimlane"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* New Swimlane Input */}
      {isAddingNew && (
        <div className="px-2 py-2 border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20">
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
            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="flex gap-1 mt-1">
            <button
              onClick={handleAddNew}
              disabled={!newSwimlaneValue.trim()}
              className="flex-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add
            </button>
            <button
              onClick={handleCancelAdd}
              className="flex-1 px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Swimlane List */}
      {swimlanes.map((swimlane) => (
        <div
          key={swimlane.id}
          draggable={editingId !== swimlane.id}
          onDragStart={(e) => handleDragStart(e, swimlane.id)}
          onDragOver={(e) => handleDragOver(e, swimlane.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, swimlane.id)}
          onDragEnd={handleDragEnd}
          className={`
            px-2 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2 group
            ${draggedId === swimlane.id ? 'opacity-50' : ''}
            ${dragOverId === swimlane.id ? 'bg-blue-100 dark:bg-blue-900/30 border-t-2 border-t-blue-500' : ''}
            ${editingId === swimlane.id ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}
          `}
          style={{ height: `${rowHeight}px` }}
        >
          {/* Drag Handle */}
          <div className="cursor-grab opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM8 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM8 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM14 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM14 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" />
            </svg>
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
                className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          ) : (
            <>
              <span
                className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-200 truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                onDoubleClick={() => handleStartEdit(swimlane)}
                title="Double-click to edit"
              >
                {swimlane.name}
              </span>

              {/* Action Buttons */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleStartEdit(swimlane)}
                  className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  title="Edit swimlane"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button
                  onClick={() => setDeleteConfirm(swimlane.id)}
                  className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                  title="Delete swimlane"
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

      {/* Empty State */}
      {swimlanes.length === 0 && !isAddingNew && (
        <div className="px-3 py-4 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">No swimlanes yet</p>
          <button
            onClick={() => setIsAddingNew(true)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Add your first swimlane
          </button>
        </div>
      )}

      {/* Resize Handle */}
      <div
        ref={resizeRef}
        onMouseDown={handleResizeMouseDown}
        className={`
          absolute top-0 right-0 w-1 h-full cursor-col-resize
          hover:bg-blue-500 transition-colors
          ${isResizing ? 'bg-blue-500' : 'bg-transparent hover:bg-blue-400'}
        `}
        title="Drag to resize"
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        title="Delete Swimlane"
        message={`Are you sure you want to delete "${swimlaneToDelete?.name}"? All activities in this swimlane will also be deleted.`}
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

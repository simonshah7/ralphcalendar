'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface CreateCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}

export function CreateCalendarModal({ isOpen, onClose, onSubmit }: CreateCalendarModalProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Calendar name is required');
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit(name.trim());
      setName('');
      onClose();
    } catch {
      setError('Failed to create calendar');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setName('');
    setError('');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-overlay backdrop-blur-sm"
            onClick={handleClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative bg-card rounded-2xl shadow-xl max-w-md w-full mx-4 p-6 border border-card-border"
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-full bg-accent-soft flex items-center justify-center">
                <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
              </div>
              <h2 className="text-base font-semibold text-foreground">Create Calendar</h2>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="mb-5">
                <label htmlFor="name" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Calendar Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Marketing Calendar"
                  className="w-full px-3 py-2 border border-card-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-accent/40 text-sm"
                  autoFocus
                />
                {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
              </div>
              <div className="flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-sm font-medium text-foreground bg-muted rounded-lg hover:bg-card-hover transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-sm font-medium text-white bg-accent rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50 shadow-sm shadow-accent/20"
                >
                  {isSubmitting ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SolarCheckLinear, SolarCloseLinear, SolarInfoCircle } from './SolarIcons';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastMethods {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

interface ToastContextValue {
  toast: ToastMethods;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const accentColors: Record<ToastType, { border: string; icon: string; bg: string }> = {
  success: { border: 'border-l-green-500', icon: 'text-green-500', bg: 'bg-green-500/10' },
  error: { border: 'border-l-red-500', icon: 'text-red-500', bg: 'bg-red-500/10' },
  info: { border: 'border-l-blue-500', icon: 'text-blue-500', bg: 'bg-blue-500/10' },
};

const icons: Record<ToastType, React.ReactNode> = {
  success: <SolarCheckLinear className="w-5 h-5" />,
  error: <SolarCloseLinear className="w-5 h-5" />,
  info: <SolarInfoCircle className="w-5 h-5" />,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => removeToast(id), 4000);
    },
    [removeToast]
  );

  const toast: ToastMethods = React.useMemo(
    () => ({
      success: (message: string) => addToast('success', message),
      error: (message: string) => addToast('error', message),
      info: (message: string) => addToast('info', message),
    }),
    [addToast]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => {
            const accent = accentColors[t.type];
            return (
              <motion.div
                key={t.id}
                layout
                role="alert"
                aria-live="polite"
                initial={{ opacity: 0, x: 80, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 80, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                onClick={() => removeToast(t.id)}
                className={`pointer-events-auto cursor-pointer flex items-center gap-3 px-4 py-3 rounded-lg border border-card-border border-l-4 ${accent.border} bg-card shadow-lg min-w-[280px] max-w-[400px]`}
              >
                <span className={`flex-shrink-0 ${accent.icon}`} aria-hidden="true">
                  {icons[t.type]}
                </span>
                <span className="text-sm text-foreground leading-snug">
                  <span className="sr-only">{t.type === 'success' ? 'Success: ' : t.type === 'error' ? 'Error: ' : 'Info: '}</span>
                  {t.message}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

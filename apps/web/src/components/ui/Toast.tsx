'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react';
import styles from './toast.module.css';

type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => undefined });

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      const id = nextId++;
      setItems((prev) => [...prev.slice(-3), { id, tone, message }]);
      setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={styles.region} role="region" aria-label="Notifications" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={[styles.toast, styles[t.tone]].join(' ')}>
            {t.tone === 'success' ? (
              <CheckCircle2 size={16} aria-hidden />
            ) : t.tone === 'error' ? (
              <CircleAlert size={16} aria-hidden />
            ) : (
              <Info size={16} aria-hidden />
            )}
            <span className={styles.message}>{t.message}</span>
            <button className={styles.dismiss} onClick={() => dismiss(t.id)} aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

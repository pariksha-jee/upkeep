'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import styles from './modal.module.css';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

export function Modal({ open, onClose, title, children, footer, wide }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={styles.backdrop} onClick={onClose} role="presentation">
      <div
        className={[styles.modal, wide === true ? styles.wide : ''].join(' ')}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button className={styles.close} onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </header>
        <div className={styles.body}>{children}</div>
        {footer !== undefined ? <footer className={styles.footer}>{footer}</footer> : null}
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
  busy,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p className={styles.confirmMessage}>{message}</p>
      <div className={styles.confirmActions}>
        <button className={styles.cancelBtn} onClick={onCancel} disabled={busy === true}>
          Cancel
        </button>
        <button className={styles.dangerBtn} onClick={onConfirm} disabled={busy === true}>
          {busy === true ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

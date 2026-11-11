'use client';

import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import styles from './table.module.css';

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className={styles.wrap}>{children}</div>;
}

export function Table({
  children,
  'aria-label': ariaLabel,
}: {
  children: ReactNode;
  'aria-label'?: string;
}) {
  return (
    <table className={styles.table} aria-label={ariaLabel}>
      {children}
    </table>
  );
}

export function Th({ children }: { children: ReactNode }) {
  return <th className={styles.th}>{children}</th>;
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={[styles.td, className ?? ''].filter(Boolean).join(' ')}>{children}</td>;
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}>{icon ?? <Inbox size={22} aria-hidden />}</div>
      <p className={styles.emptyTitle}>{title}</p>
      {hint !== undefined ? <p className={styles.emptyHint}>{hint}</p> : null}
      {action}
    </div>
  );
}

interface PaginationProps {
  page: number;
  total: number;
  limit: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, total, limit, onChange }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  return (
    <nav className={styles.pagination} aria-label="Pagination">
      <button
        className={styles.pageBtn}
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label="Previous page"
      >
        <ChevronLeft size={15} />
      </button>
      <span className={styles.pageInfo}>
        Page {page} of {pages}
      </span>
      <button
        className={styles.pageBtn}
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
        aria-label="Next page"
      >
        <ChevronRight size={15} />
      </button>
    </nav>
  );
}

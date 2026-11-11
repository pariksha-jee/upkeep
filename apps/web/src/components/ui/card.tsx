'use client';

import type { ReactNode } from 'react';
import styles from './card.module.css';

interface CardProps {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}

export function Card({ children, className, padded = true }: CardProps) {
  return (
    <section
      className={[styles.card, padded ? styles.padded : '', className ?? '']
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  action,
  subtitle,
}: {
  title: ReactNode;
  action?: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <header className={styles.header}>
      <div>
        <h2 className={styles.title}>{title}</h2>
        {subtitle !== undefined ? <p className={styles.subtitle}>{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  tone?: 'default' | 'up' | 'down' | 'warning';
  icon?: ReactNode;
}

export function StatCard({ label, value, tone = 'default', icon }: StatCardProps) {
  return (
    <div className={[styles.stat, styles[tone]].join(' ')}>
      <div className={styles.statIcon}>{icon}</div>
      <div>
        <p className={styles.statLabel}>{label}</p>
        <p className={[styles.statValue, 'numeric'].join(' ')}>{value}</p>
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={[styles.skeleton, className ?? ''].filter(Boolean).join(' ')} />;
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className={styles.card} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={styles.skeletonRow} />
      ))}
    </div>
  );
}

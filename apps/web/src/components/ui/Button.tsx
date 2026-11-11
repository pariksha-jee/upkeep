'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './button.module.css';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  const cls = [styles.button, styles[variant], styles[size], className ?? '']
    .filter(Boolean)
    .join(' ');
  return (
    <button className={cls} disabled={disabled === true || loading} {...rest}>
      {loading ? <span className={styles.spinner} aria-hidden /> : null}
      {children}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
}

export function IconButton({ label, className, children, ...rest }: IconButtonProps) {
  return (
    <button
      className={[styles.iconButton, className ?? ''].filter(Boolean).join(' ')}
      aria-label={label}
      title={label}
      {...rest}
    >
      {children}
    </button>
  );
}

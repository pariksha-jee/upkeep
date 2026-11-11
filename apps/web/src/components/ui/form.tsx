'use client';

import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import styles from './form.module.css';

interface FieldProps {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
  htmlFor?: string;
}

export function Field({ label, hint, error, required, children, htmlFor }: FieldProps) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={htmlFor}>
        {label}
        {required === true ? <span className={styles.required}> *</span> : null}
      </label>
      {children}
      {hint !== undefined && error === undefined ? <p className={styles.hint}>{hint}</p> : null}
      {error !== undefined ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };

export function Input({ invalid, className, ...rest }: InputProps) {
  return (
    <input
      className={[styles.input, invalid === true ? styles.invalid : '', className ?? '']
        .filter(Boolean)
        .join(' ')}
      {...rest}
    />
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean };

export function Textarea({ invalid, className, ...rest }: TextareaProps) {
  return (
    <textarea
      className={[styles.textarea, invalid === true ? styles.invalid : '', className ?? '']
        .filter(Boolean)
        .join(' ')}
      {...rest}
    />
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean };

export function Select({ invalid, className, children, ...rest }: SelectProps) {
  return (
    <select
      className={[styles.select, invalid === true ? styles.invalid : '', className ?? '']
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </select>
  );
}

interface SwitchProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, disabled }: SwitchProps) {
  return (
    <label className={[styles.switchWrap, disabled === true ? styles.disabled : ''].join(' ')}>
      <input
        type="checkbox"
        className={styles.switchInput}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={styles.switchTrack} aria-hidden>
        <span className={styles.switchThumb} />
      </span>
      <span className={styles.switchLabel}>{label}</span>
    </label>
  );
}

'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Activity } from 'lucide-react';
import { api } from '@/lib/api';
import { useSessionStore } from '@/stores/session';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/form';
import styles from '../auth.module.css';

export default function RegisterPage() {
  const router = useRouter();
  const setSession = useSessionStore((s) => s.setSession);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (password.length < 10) {
      setError('Password must be at least 10 characters');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const tokens = await api.register({ name: name.trim(), email: email.trim(), password });
      setSession(tokens.user);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.authPage}>
      <div className={styles.authCard}>
        <Link href="/" className={styles.authBrand}>
          <span className={styles.authBrandMark}>
            <Activity size={16} aria-hidden />
          </span>
          Upkeep
        </Link>
        <h1 className={styles.authTitle}>Create your account</h1>
        <p className={styles.authSubtitle}>Start monitoring in under a minute</p>
        <form className={styles.authForm} onSubmit={onSubmit}>
          {error !== null ? (
            <div className={styles.authError} role="alert">
              {error}
            </div>
          ) : null}
          <Field label="Name" htmlFor="reg-name">
            <Input
              id="reg-name"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ada Lovelace"
            />
          </Field>
          <Field label="Email" htmlFor="reg-email">
            <Input
              id="reg-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </Field>
          <Field label="Password" htmlFor="reg-password" hint="At least 10 characters">
            <Input
              id="reg-password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••"
            />
          </Field>
          <Button type="submit" loading={busy}>
            Create account
          </Button>
        </form>
        <p className={styles.authSwitch}>
          Already registered? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

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

export default function LoginPage() {
  const router = useRouter();
  const setSession = useSessionStore((s) => s.setSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const tokens = await api.login(email.trim(), password);
      setSession(tokens.user);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
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
        <h1 className={styles.authTitle}>Welcome back</h1>
        <p className={styles.authSubtitle}>Sign in to your monitoring dashboard</p>
        <form className={styles.authForm} onSubmit={onSubmit}>
          {error !== null ? (
            <div className={styles.authError} role="alert">
              {error}
            </div>
          ) : null}
          <Field label="Email" htmlFor="login-email">
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </Field>
          <Field label="Password" htmlFor="login-password">
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••"
            />
          </Field>
          <Button type="submit" loading={busy}>
            Sign in
          </Button>
        </form>
        <p className={styles.authSwitch}>
          No account yet? <Link href="/register">Create one</Link>
        </p>
      </div>
    </div>
  );
}

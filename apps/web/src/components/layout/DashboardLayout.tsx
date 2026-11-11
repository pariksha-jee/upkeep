'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  LayoutDashboard,
  Moon,
  Radio,
  Settings,
  Sun,
  LogOut,
  Menu,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useSession } from '@/hooks/api';
import { useSessionStore } from '@/stores/session';
import { useUiStore } from '@/stores/ui';
import { Button } from '@/components/ui/Button';
import styles from './DashboardLayout.module.css';

const NAV = [
  { href: '/dashboard', label: 'Monitors', icon: LayoutDashboard },
  { href: '/dashboard/incidents', label: 'Incidents', icon: AlertTriangle },
  { href: '/dashboard/tunnels', label: 'Tunnels', icon: Radio },
  { href: '/dashboard/channels', label: 'Channels', icon: Bell },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const hydrated = useSessionStore((s) => s.hydrated);
  const router = useRouter();
  const pathname = usePathname();
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);

  // Sync store theme once mounted (avoids hydration mismatch).
  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme');
    if (current === 'dark' || current === 'light') {
      useUiStore.setState({ theme: current });
    }
  }, []);

  useEffect(() => {
    if (hydrated && session === null && !pathname.startsWith('/dashboard/monitors/new')) {
      router.replace('/login');
    }
  }, [hydrated, session, router, pathname]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname, setSidebarOpen]);

  async function logout(): Promise<void> {
    await api.logout().catch(() => undefined);
    useSessionStore.getState().setSession(null);
    router.replace('/login');
  }

  if (!hydrated || session == null) {
    return (
      <div className={styles.loading}>
        <Activity className={styles.loadingPulse} size={28} aria-hidden />
        <p>Loading your dashboard…</p>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      {sidebarOpen ? (
        <button
          className={styles.scrim}
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        <Link href="/dashboard" className={styles.brand}>
          <span className={styles.brandMark}>
            <Activity size={17} aria-hidden />
          </span>
          Upkeep
        </Link>
        <nav className={styles.nav} aria-label="Main navigation">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === '/dashboard' ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`${styles.navItem} ${active === true ? styles.navItemActive : ''}`}
                aria-current={active === true ? 'page' : undefined}
              >
                <Icon size={17} aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className={styles.sidebarFooter}>
          <div className={styles.userBlock}>
            <span className={styles.avatar}>{session.name.charAt(0).toUpperCase()}</span>
            <div className={styles.userMeta}>
              <p className={styles.userName}>{session.name}</p>
              <p className={styles.userEmail}>{session.email}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={logout} className={styles.logout}>
            <LogOut size={15} aria-hidden /> Sign out
          </Button>
        </div>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <button
            className={styles.menuBtn}
            aria-label="Open menu"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={18} />
          </button>
          <div className={styles.topbarSpacer} />
          <button className={styles.themeBtn} onClick={toggleTheme} aria-label="Toggle color theme">
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </header>
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className={styles.pageHeader}>
      <div>
        <h1 className={styles.pageTitle}>{title}</h1>
        {subtitle !== undefined ? <p className={styles.pageSubtitle}>{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

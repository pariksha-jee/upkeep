import Link from 'next/link';
import {
  Activity,
  Bell,
  CheckCircle2,
  Globe,
  KeyRound,
  Radio,
  ShieldCheck,
  Smartphone,
  Webhook,
} from 'lucide-react';
import styles from './landing.module.css';

const FEATURES = [
  {
    icon: Globe,
    title: 'Public & private endpoints',
    text: 'HTTP(S) and raw TCP checks for anything on the internet — and, uniquely, anything behind it.',
  },
  {
    icon: KeyRound,
    title: 'SSH tunnel monitors',
    text: 'Bring your own keys. Upkeep dials your bastion with local port forwarding and checks targets inside.',
  },
  {
    icon: Radio,
    title: 'OpenVPN monitors',
    text: 'Paste a client config or point at a signed URL. Your VPN, our route-scoped checking.',
  },
  {
    icon: ShieldCheck,
    title: 'Zero-persistence mode',
    text: 'Standards that forbid third-party key storage? Fetch credentials at runtime from your own AWS S3 / GCS signed URLs.',
  },
  {
    icon: Bell,
    title: 'Every alert channel',
    text: 'Email, SMS, mobile push and HMAC-signed webhooks — with anti-flapping thresholds and cooldowns.',
  },
  {
    icon: Smartphone,
    title: 'Web + Android',
    text: 'A fast dashboard for the desk, push notifications in your pocket. One account, both apps.',
  },
];

export default function LandingPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <span className={styles.brand}>
            <span className={styles.brandMark}>
              <Activity size={16} aria-hidden />
            </span>
            Upkeep
          </span>
          <nav className={styles.headerNav}>
            <Link href="/login" className={styles.navLink}>
              Sign in
            </Link>
            <Link href="/register" className={styles.navCta}>
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <section className={styles.hero}>
        <p className={styles.heroKicker}>Uptime monitoring, everywhere your services live</p>
        <h1 className={styles.heroTitle}>
          Watch every endpoint.
          <br />
          <span className={styles.heroAccent}>Even the ones nobody else can reach.</span>
        </h1>
        <p className={styles.heroText}>
          Upkeep checks your public services like any uptime monitor — then goes further with
          SSH-tunnel and OpenVPN monitors for private, internal endpoints. From 30-second intervals
          to quiet-hours-aware alerts, you stay in control.
        </p>
        <div className={styles.heroActions}>
          <Link href="/register" className={styles.heroPrimary}>
            Create free account
          </Link>
          <Link href="/login" className={styles.heroSecondary}>
            Sign in
          </Link>
        </div>
        <ul className={styles.heroPoints}>
          <li>
            <CheckCircle2 size={15} aria-hidden /> 30s – 1h intervals
          </li>
          <li>
            <CheckCircle2 size={15} aria-hidden /> Email · SMS · Push ·{' '}
            <Webhook size={13} aria-hidden /> webhooks
          </li>
          <li>
            <CheckCircle2 size={15} aria-hidden /> BYO credentials — encrypted or never stored
          </li>
        </ul>
      </section>

      <section className={styles.features}>
        {FEATURES.map((f) => (
          <article key={f.title} className={styles.feature}>
            <span className={styles.featureIcon}>
              <f.icon size={19} aria-hidden />
            </span>
            <h2 className={styles.featureTitle}>{f.title}</h2>
            <p className={styles.featureText}>{f.text}</p>
          </article>
        ))}
      </section>

      <footer className={styles.footer}>
        <p>Upkeep — open-source uptime monitoring for public and private endpoints.</p>
      </footer>
    </div>
  );
}
